#!/usr/bin/env python3
"""Read-only standard-library audit of archived PortPlan V5 evidence.

No solver runs, JS imports, or imports from review-v4/certify-v4. This is an
internal second implementation, not third-party certification or ranking proof.
"""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
import math
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EXPECTED_PROTOCOL_HASH = "7cfee99b5522236c3fd70a13b4fcbf11e2273d0c0cd3dd887465608c1f1c2109"
SCHEMA = "portplan-readonly-review-v5"
METHODS = ("rawMILP", "v4EventSearch", "fastEvent")
ROLLING_METHODS = ("dailyReopt", "stableRetain")
RESOURCES = ("truck", "warehouse", "staging")
EVENTS = ("pickupDay", "unloadDay", "returnDay")
EVENT_NAMES = dict(zip(EVENTS, ("pickup", "unloadStart", "return")))
EVENT_FIELDS = {value: key for key, value in EVENT_NAMES.items()}
TOTAL_KEYS = ("storageCost", "ddCost", "totalCost", "sunkCost", "incrementalCost")
TARIFF = {"pncFreeDays": 4, "ddFreeDays": 10, "pncMultiplier": 1,
          "ddMultiplier": 1, "pncMode": "retroactive", "ddMode": "progressive"}
OPERATIONS = {"returnLagDays": 1, "stagingUnit": "container"}
TOLERANCE = 1e-6


def require(condition, message):
    if not condition:
        raise ValueError(message)


def integer(value):
    return type(value) is int


def finite(value):
    return type(value) in (int, float) and math.isfinite(value)


def close(actual, expected, label):
    require(finite(actual) and abs(actual - expected) <= TOLERANCE,
            f"{label}: expected {expected}, received {actual}")


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read_json(path):
    require(path.is_file(), f"Missing required archived evidence: {path}")
    def reject(value):
        raise ValueError(f"Non-finite JSON constant {value} in {path}")
    return json.loads(path.read_text(encoding="utf-8"), parse_constant=reject)


def capacity(scenario, resource, day):
    value = scenario[resource + "Capacity"]
    return value[day] if isinstance(value, list) else value


def validate_scenario(scenario, label):
    require(isinstance(scenario, dict), f"{label}: scenario must be an object")
    date.fromisoformat(scenario["horizonStart"])
    horizon = scenario["horizonDays"]
    require(integer(horizon) and 2 <= horizon <= 31, f"{label}: invalid horizon")
    for resource in RESOURCES:
        value = scenario[resource + "Capacity"]
        require(not isinstance(value, list) or len(value) == horizon, f"{label}: capacity array length")
        require(all(integer(capacity(scenario, resource, day)) and capacity(scenario, resource, day) >= 0
                    for day in range(horizon)), f"{label}: invalid {resource} capacity")
    containers = scenario["containers"]
    require(isinstance(containers, list) and 1 <= len(containers) <= 100, f"{label}: invalid container count")
    ids = [container["id"] for container in containers]
    require(all(isinstance(value, str) and value for value in ids) and len(set(ids)) == len(ids), f"{label}: duplicate/malformed IDs")
    for container in containers:
        require(integer(container["sizeFt"]) and container["sizeFt"] in (20, 40), f"{label}: invalid size")
        require(all(integer(container[key]) and 0 <= container[key] < horizon for key in ("releaseDay", "dueDay")), f"{label}: invalid release/deadline")
        require(integer(container["unloadDays"]) and 1 <= container["unloadDays"] < horizon, f"{label}: invalid duration")
        stamp = datetime.fromisoformat(container["dischargeDateTime"])
        require(stamp.tzinfo is not None, f"{label}: discharge timestamp lacks offset")
        discharged = stamp.astimezone(timezone(timedelta(hours=9))).date()
        require(container["releaseDay"] >= (discharged - date.fromisoformat(scenario["horizonStart"])).days, f"{label}: release before discharge")
    tariff, operation = {**TARIFF, **scenario.get("tariff", {})}, {**OPERATIONS, **scenario.get("operations", {})}
    for key in ("pncFreeDays", "ddFreeDays"):
        require(integer(tariff[key]) and 0 <= tariff[key] <= 365, f"{label}: invalid {key}")
    for key in ("pncMultiplier", "ddMultiplier"):
        require(finite(tariff[key]) and 0 <= tariff[key] <= 100, f"{label}: invalid {key}")
    require(all(tariff[key] in ("retroactive", "progressive") for key in ("pncMode", "ddMode")), f"{label}: invalid fee mode")
    require(integer(operation["returnLagDays"]) and operation["returnLagDays"] in (0, 1)
            and operation["stagingUnit"] in ("container", "teu"), f"{label}: invalid operations")


def charge(days, ends, rates, mode):
    days = max(0, days)
    if not days:
        return 0
    def rate(day):
        return next(amount for end, amount in zip(ends, rates) if day <= end)
    return sum(rate(days if mode == "retroactive" else day) for day in range(1, days + 1))


def reprice(scenario, container, pickup, returned):
    tariff = {**TARIFF, **scenario.get("tariff", {})}
    start = date.fromisoformat(scenario["horizonStart"])
    local = datetime.fromisoformat(container["dischargeDateTime"]).astimezone(timezone(timedelta(hours=9)))
    discharged = local.date()
    storage_start = discharged + timedelta(days=int(local.hour >= 8))
    storage_days = max(0, (start - storage_start).days + pickup + 1)
    dd_days = max(0, (start - discharged).days + returned + 1)
    def storage(days):
        return charge(days - tariff["pncFreeDays"], (3, 5, 10, math.inf), (9100, 18200, 31850, 45500),
                      tariff["pncMode"]) * container["sizeFt"] / 20 * tariff["pncMultiplier"]
    def dd(days):
        rates = (15000, 30000, 50000) if container["sizeFt"] == 20 else (30000, 50000, 90000)
        return charge(days - tariff["ddFreeDays"], (5, 10, math.inf), rates, tariff["ddMode"]) * tariff["ddMultiplier"]
    storage_cost, dd_cost = storage(storage_days), dd(dd_days)
    prior_storage, prior_dd = storage(max(0, (start - storage_start).days)), dd(max(0, (start - discharged).days))
    return {"storageDays": storage_days, "ddDays": dd_days, "storageCost": storage_cost, "ddCost": dd_cost,
            "priorStorageCost": prior_storage, "priorDDCost": prior_dd,
            "totalCost": storage_cost + dd_cost, "sunkCost": prior_storage + prior_dd,
            "incrementalCost": storage_cost + dd_cost - prior_storage - prior_dd}


def audit_dates(scenario, rows, label, fixed=None, day=0):
    require(isinstance(rows, list) and len(rows) == len(scenario["containers"]), f"{label}: incomplete container coverage")
    containers = {container["id"]: container for container in scenario["containers"]}
    fixed = fixed or {}
    horizon = scenario["horizonDays"]
    operation = {**OPERATIONS, **scenario.get("operations", {})}
    seen, usage, by_id = set(), [[0, 0, 0] for _ in range(horizon)], {}
    for row in rows:
        require(isinstance(row, dict), f"{label}: malformed decision row")
        identifier = row["id"]
        require(identifier in containers and identifier not in seen, f"{label}: unknown/duplicate container {identifier}")
        seen.add(identifier)
        by_id[identifier] = row
        pickup, unload, returned = (row[key] for key in EVENTS)
        require(all(integer(value) and 0 <= value < horizon for value in (pickup, unload, returned)), f"{label}/{identifier}: invalid event date")
        container = containers[identifier]
        end = unload + container["unloadDays"] - 1
        require(pickup >= container["releaseDay"] and unload >= pickup and end <= container["dueDay"]
                and end < horizon and returned >= end + operation["returnLagDays"], f"{label}/{identifier}: release/precedence/deadline violation")
        for key in EVENTS:
            if key in fixed.get(identifier, {}):
                require(row[key] == fixed[identifier][key], f"{label}/{identifier}: changed executed {key}")
            else:
                require(row[key] >= day, f"{label}/{identifier}: unexecuted {key} in past")
        usage[pickup][0] += 1
        usage[returned][0] += 1
        for occupied in range(unload, end + 1):
            usage[occupied][1] += 1
        for occupied in range(pickup, returned):
            usage[occupied][2] += container["sizeFt"] / 20 if operation["stagingUnit"] == "teu" else 1
    require(seen == set(containers), f"{label}: missing container")
    for occupied, amounts in enumerate(usage):
        for index, resource in enumerate(RESOURCES):
            require(amounts[index] <= capacity(scenario, resource, occupied), f"{label}: {resource} over capacity on day {occupied}")
    return {"byId": by_id, "usage": usage}


def audit_schedule(scenario, result, label):
    require(isinstance(result, dict) and isinstance(result.get("rows"), list), f"{label}: rows must be an array")
    rows = result["rows"]
    if not rows:
        require(result.get("status") not in ("feasible", "optimal") and result.get("complete") is not True, f"{label}: success without complete rows")
        require(all(result.get(key) is None for key in (*TOTAL_KEYS, "objectiveCost")), f"{label}: failed/partial episode must have null fees")
        return None
    audited = audit_dates(scenario, rows, label)
    containers = {container["id"]: container for container in scenario["containers"]}
    totals = {key: 0 for key in TOTAL_KEYS}
    primary = 0
    mode = result.get("objectiveMode", scenario.get("objectiveMode", "joint"))
    require(mode in ("joint", "storageOnly", "ddOnly"), f"{label}: unknown objective")
    for row in rows:
        container = containers[row["id"]]
        require(row.get("unloadEndDay") == row["unloadDay"] + container["unloadDays"] - 1
                and row.get("sizeFt") == container["sizeFt"], f"{label}/{row['id']}: duration/size mismatch")
        costs = reprice(scenario, container, row["pickupDay"], row["returnDay"])
        for key, value in costs.items():
            close(row.get(key), value, f"{label}/{row['id']}/{key}")
        for key in totals:
            totals[key] += costs[key]
        primary += (costs["storageCost"] - costs["priorStorageCost"] if mode == "storageOnly" else
                    costs["ddCost"] - costs["priorDDCost"] if mode == "ddOnly" else costs["incrementalCost"])
        for key, event in (("pickupDate", "pickupDay"), ("unloadDate", "unloadDay"), ("returnDate", "returnDay")):
            if key in row:
                require(row[key] == (date.fromisoformat(scenario["horizonStart"]) + timedelta(days=row[event])).isoformat(), f"{label}/{row['id']}/{key}: inconsistent date")
    for key, value in totals.items():
        close(result.get(key), value, f"{label}/{key}")
    close(result.get("objectiveCost"), primary, f"{label}/objectiveCost")
    if "usage" in result:
        usage = result["usage"]
        end = result.get("executionThroughDay", scenario["horizonDays"] - 1)
        require(isinstance(usage, list) and len(usage) == end + 1, f"{label}: daily usage length mismatch")
        for day, row in enumerate(usage):
            for index, resource in enumerate(RESOURCES):
                close(row.get(resource), audited["usage"][day][index], f"{label}/day{day}/{resource}")
                if resource + "Capacity" in row:
                    close(row[resource + "Capacity"], capacity(scenario, resource, day), f"{label}/day{day}/{resource}Capacity")
    return {**totals, "objectiveCost": primary}


def stable_json(value):
    return json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(",", ":"), allow_nan=False)


def checksum(value, recorded):
    require(isinstance(recorded, str), "Missing observation checksum")
    encoded = stable_json(value)
    if recorded.startswith("sha256:"):
        return "sha256:" + hashlib.sha256(encoded.encode("utf-8")).hexdigest()
    require(recorded.startswith("fnv1a32:"), "Unknown observation checksum algorithm")
    units, result = encoded.encode("utf-16-le"), 2166136261
    for offset in range(0, len(units), 2):
        result = ((result ^ int.from_bytes(units[offset:offset + 2], "little")) * 16777619) & 0xffffffff
    return f"fnv1a32:{result:08x}"


def expanded(scenario):
    result = copy.deepcopy(scenario)
    for resource in RESOURCES:
        result[resource + "Capacity"] = [capacity(scenario, resource, day) for day in range(scenario["horizonDays"])]
    return result


def realize(nominal, events):
    result = expanded(nominal)
    for _, event in sorted(enumerate(events), key=lambda pair: (pair[1]["revealDay"], pair[0])):
        for day in range(event["revealDay"], min(nominal["horizonDays"], event["revealDay"] + event["duration"])):
            result[event["resource"] + "Capacity"][day] = event["capacity"]
    return result


def observed_snapshot(nominal, actual, events, day):
    result = expanded(nominal)
    for _, event in sorted(enumerate(events), key=lambda pair: (pair[1]["revealDay"], pair[0])):
        if event["revealDay"] <= day and "announcedDuration" in event:
            for future in range(event["revealDay"], min(nominal["horizonDays"], event["revealDay"] + event["announcedDuration"])):
                result[event["resource"] + "Capacity"][future] = event["capacity"]
    for resource in RESOURCES:
        for past in range(day + 1):
            result[resource + "Capacity"][past] = capacity(actual, resource, past)
    observations = []
    for resource in RESOURCES:
        observations.append({"kind": "day_start_capacity", "day": day, "resource": resource,
            "capacity": capacity(actual, resource, day),
            "activeShockIds": [event["id"] for event in events if event["resource"] == resource and event["revealDay"] <= day < event["revealDay"] + event["duration"]],
            "announcements": [{key: event[key] for key in ("id", "revealDay", "resource", "capacity", "announcedDuration") if key in event}
                              for event in events if event["resource"] == resource and event["revealDay"] == day]})
    return result, observations


def execution_state(scenario, fixed, day):
    states = []
    for container in scenario["containers"]:
        events = fixed.get(container["id"], {})
        phase = "not_picked_up"
        if "pickupDay" in events:
            phase = "staged"
        if "unloadDay" in events:
            phase = "unloading" if day < events["unloadDay"] + container["unloadDays"] - 1 else "awaiting_return"
        if "returnDay" in events:
            phase = "returned"
        states.append({"id": container["id"], "phase": phase, **events})
    return states


def feasible_dates(scenario, rows, fixed, day):
    try:
        audit_dates(scenario, rows, "cache feasibility", fixed, day)
        return True
    except (ValueError, KeyError, TypeError, IndexError):
        return False


def planner_records(stats, result):
    if isinstance(result.get("plannerTrace"), list):
        return result["plannerTrace"]
    for key in ("decisionLog", "calls", "decisions", "history"):
        if isinstance(stats.get(key), list):
            return stats[key]
    raise ValueError("plannerStats must preserve the per-call decisionLog")


def audit_timeline(case, result, method, label):
    nominal, actual, events = case["nominalScenario"], case["scenario"], case["events"]
    timeline = result.get("timeline")
    require(isinstance(timeline, list) and 1 <= len(timeline) <= nominal["horizonDays"], f"{label}: missing/overlong timeline")
    stats = result.get("plannerStats")
    require(isinstance(stats, dict), f"{label}: missing plannerStats")
    logs = planner_records(stats, result)
    require(len(logs) == len(timeline), f"{label}: planner calls omitted from log")
    fixed, previous, revision_total = {}, None, 0
    solver_calls = reused = replanned = 0
    wall_total = 0
    flattened = []
    for day, (entry, log) in enumerate(zip(timeline, logs)):
        require(entry["day"] == day and log["day"] == day, f"{label}: nonconsecutive timeline/call log")
        observation, observations = observed_snapshot(nominal, actual, events, day)
        require(entry["observedEvents"] == observations, f"{label}: disclosed wrong observations/private duration on day {day}")
        hashed = {"scenario": observation, "observedEvents": observations, "fixedEvents": fixed, "minEventDay": day}
        require(checksum(hashed, entry["observationHash"]) == entry["observationHash"], f"{label}: causal observation hash mismatch on day {day}")
        for key in ("fixedEvents", "minEventDay"):
            if key in log:
                require(log[key] == (fixed if key == "fixedEvents" else day), f"{label}: planner log {key} differs from execution history")
        wall = log.get("callWallMs", log.get("wallMs", log.get("runtimeMs")))
        require(finite(wall) and wall >= 0, f"{label}: missing/invalid per-call planning wall time")
        wall_total += wall
        metadata = log.get("plannerMetadata", log.get("metadata", log))
        if method == "dailyReopt":
            solver_calls += 1
            source = metadata.get("candidateSource", log.get("candidateSource", "solver_daily"))
            require(source == "daily_solver", f"{label}: daily optimizer improperly retained/substituted a plan")
        else:
            require(isinstance(metadata, dict), f"{label}: stable metadata absent")
            source = metadata.get("candidateSource")
            cached_valid = previous is not None and feasible_dates(observation, list(previous.values()), fixed, day)
            expected_source = "retained_plan" if cached_valid else "solver_replan" if previous is not None else "solver_initial"
            require(source == expected_source, f"{label}: stable trigger violated on day {day}: expected {expected_source}, received {source}")
            if source == "retained_plan":
                reused += 1
                require(metadata.get("accepted") is True, f"{label}: retained plan marked unaccepted")
            else:
                solver_calls += 1
                replanned += previous is not None
        for key, expected in (("decisionCalls", day + 1), ("solverCalls", solver_calls), ("reusedPlans", reused), ("replannedDueToInvalid", replanned)):
            require(integer(metadata.get(key)) and metadata[key] == expected, f"{label}: cumulative {key} mismatch on day {day}")
        close(metadata.get("planningWallMs"), wall_total, f"{label}/day{day}/cumulativePlanningWallMs")
        decisions, executed = entry.get("decisions"), entry.get("executedEvents")
        require(isinstance(decisions, list) and isinstance(executed, list), f"{label}: malformed decisions/execution")
        if entry["status"] == "executed":
            require(metadata.get("accepted") is True, f"{label}: executed candidate marked unaccepted")
            audited = audit_dates(observation, decisions, f"{label}/day{day}", fixed, day)
            by_id = audited["byId"]
            if source == "retained_plan":
                require(by_id == previous, f"{label}: retained plan changed its dates")
            for index, resource in enumerate(RESOURCES):
                require(audited["usage"][day][index] <= capacity(actual, resource, day), f"{label}: realized {resource} exceeded")
            expected_execution = [{"id": row["id"], "event": EVENT_NAMES[key], "day": day}
                                  for row in decisions for key in EVENTS if row[key] == day]
            require(executed == expected_execution, f"{label}: missing/extra/reordered executed event on day {day}")
            changes = [{"id": row["id"], "event": EVENT_NAMES[key], "previousDay": previous[row["id"]][key], "newDay": row[key]}
                       for row in decisions for key in EVENTS if previous is not None and key not in fixed.get(row["id"], {}) and previous[row["id"]][key] != row[key]]
            require(entry.get("revisions") == changes, f"{label}: incorrect revision identities/count on day {day}")
            revision_total += len(changes)
            require(entry["revisionCount"] == revision_total, f"{label}: cumulative revisions mismatch")
            for event in executed:
                field = EVENT_FIELDS[event["event"]]
                require(field not in fixed.get(event["id"], {}), f"{label}: repeated physical event")
                fixed.setdefault(event["id"], {})[field] = day
            previous = by_id
        else:
            require(day == len(timeline) - 1 and not executed, f"{label}: actions after failed planning")
            require(entry["revisionCount"] == revision_total, f"{label}: failure changed revision count")
        state_day = day if entry["status"] == "executed" else day - 1
        require(entry["state"] == execution_state(nominal, fixed, state_day), f"{label}: state differs from frozen physical events")
        flattened.extend(executed)
    require(result["revisionCount"] == revision_total and result["executedEvents"] == flattened, f"{label}: final revision/execution totals differ")
    require(result["finalState"] == timeline[-1]["state"], f"{label}: final state differs from timeline")
    require(type(result.get("complete")) is bool, f"{label}: complete must be boolean")
    if result["complete"]:
        require(result["status"] == "feasible" and result.get("failure") is None, f"{label}: incorrect completion status")
        require(result.get("executionThroughDay") == len(timeline) - 1, f"{label}: incorrect execution cutoff")
        for row in result["rows"]:
            require(all(row[key] == fixed.get(row["id"], {}).get(key) for key in EVENTS), f"{label}: final dates differ from executed history")
    else:
        require(result["status"] == "rolling_failed" and isinstance(result.get("failure"), dict)
                and result["failure"]["day"] == len(timeline) - 1 and not result["rows"], f"{label}: missing failure/cost boundary")
    for key, expected in (("decisionCalls", len(timeline)), ("solverCalls", solver_calls), ("reusedPlans", reused), ("replannedDueToInvalid", replanned)):
        require(integer(stats.get(key)) and stats[key] == expected, f"{label}: total planner {key} mismatch")
    close(stats.get("planningWallMs"), wall_total, f"{label}/planningWallMs")
    require(finite(result.get("runtimeMs")) and result["runtimeMs"] + TOLERANCE >= wall_total, f"{label}: planning time exceeds whole episode runtime")
    return {"timelineEntries": len(timeline), "solverCalls": solver_calls, "reusedPlans": reused,
            "replannedDueToInvalid": replanned, "revisions": revision_total, "planningWallMs": wall_total}


def median(values):
    values = sorted(values)
    count = len(values)
    return None if not count else values[count // 2] if count % 2 else (values[count // 2 - 1] + values[count // 2]) / 2


def timing(values):
    values = sorted(values)
    return {"median": median(values), "p95": values[math.ceil(.95 * len(values)) - 1] if values else None, "max": max(values) if values else None}


def compare_summary(actual, expected, label):
    require(isinstance(actual, dict), f"{label}: summary must be object")
    for key, value in actual.items():
        require(key in expected, f"{label}: unsupported summary field {key}; cannot silently validate it")
        calculated = expected[key]
        if isinstance(value, dict):
            compare_summary(value, calculated, label + "/" + key)
        elif calculated is None:
            require(value is None, f"{label}/{key}: zero denominator must be null")
        elif type(calculated) is int:
            require(integer(value) and value == calculated, f"{label}/{key}: expected {calculated}, received {value}")
        elif finite(calculated):
            close(value, calculated, label + "/" + key)
        else:
            require(value == calculated, f"{label}/{key}: expected {calculated}, received {value}")


def paired_summary(cases, baseline, candidate, rolling=False):
    feasible = lambda result: bool(result["rows"]) and (not rolling or result["complete"])
    pairs = [(case["policies"][baseline], case["policies"][candidate]) for case in cases
             if feasible(case["policies"][baseline]) and feasible(case["policies"][candidate])]
    denominator = sum(base["incrementalCost"] for base, _ in pairs)
    candidate_cost = sum(other["incrementalCost"] for _, other in pairs)
    deltas = [base["incrementalCost"] - other["incrementalCost"] for base, other in pairs]
    result = {"baselineMethod": baseline, "candidateMethod": candidate, "caseCount": len(cases), "pairedCaseCount": len(pairs),
              "baselineIncrementalKRW": denominator, "candidateIncrementalKRW": candidate_cost, "incrementalSavingsKRW": denominator - candidate_cost,
              "weightedIncrementalSavingsPct": 100 * (denominator - candidate_cost) / denominator if denominator > 0 else None,
              "baselineTotalKRW": sum(base["totalCost"] for base, _ in pairs), "candidateTotalKRW": sum(other["totalCost"] for _, other in pairs),
              "positiveSavingsCount": sum(delta > TOLERANCE for delta in deltas), "tiedCount": sum(abs(delta) <= TOLERANCE for delta in deltas),
              "negativeSavingsCount": sum(delta < -TOLERANCE for delta in deltas), "zeroBaselineCount": sum(base["incrementalCost"] == 0 for base, _ in pairs),
              "missingBaselineCount": sum(not feasible(case["policies"][baseline]) for case in cases),
              "missingCandidateCount": sum(not feasible(case["policies"][candidate]) for case in cases), "worstLossKRW": max([0] + [-delta for delta in deltas])}
    total_base = result["baselineTotalKRW"]
    result["weightedTotalSavingsPct"] = 100 * (total_base - result["candidateTotalKRW"]) / total_base if total_base else None
    if rolling:
        result.update(baselineRevisionsAll=sum(case["policies"][baseline]["revisionCount"] for case in cases),
                      candidateRevisionsAll=sum(case["policies"][candidate]["revisionCount"] for case in cases),
                      baselineSolverCallsAll=sum(case["policies"][baseline]["plannerStats"]["solverCalls"] for case in cases),
                      candidateSolverCallsAll=sum(case["policies"][candidate]["plannerStats"]["solverCalls"] for case in cases),
                      baselineRevisionsPaired=sum(base["revisionCount"] for base, _ in pairs), candidateRevisionsPaired=sum(other["revisionCount"] for _, other in pairs),
                      baselineSolverCallsPaired=sum(base["plannerStats"]["solverCalls"] for base, _ in pairs), candidateSolverCallsPaired=sum(other["plannerStats"]["solverCalls"] for _, other in pairs))
    return result


def static_summary(cases):
    policies = {}
    for method in METHODS:
        results = [case["policies"][method] for case in cases]
        statuses, sources = {}, {}
        for result in results:
            statuses[result["status"]] = statuses.get(result["status"], 0) + 1
            source = result.get("incumbentSource") or "none"
            sources[source] = sources.get(source, 0) + 1
        policies[method] = {"caseCount": len(results), "feasibleCount": sum(bool(result["rows"]) for result in results),
            "provenOptimalCount": sum(bool(result["rows"]) and result.get("optimality") == "proven_optimal" and result["endToEndCompletedWithinBudget"] for result in results),
            "completedWithinBudgetCount": sum(result["endToEndCompletedWithinBudget"] for result in results),
            "hardDeadlineCount": sum(result["deadlineReached"] for result in results), "retainedCheckpointCount": sum(result["retainedCheckpoint"] for result in results),
            "medianWallMs": median([result["wallTimeMs"] for result in results]), "wallTimeMs": timing([result["wallTimeMs"] for result in results]),
            "processExitWallTimeMs": timing([result["processExitWallTimeMs"] for result in results]),
            "statuses": statuses, "incumbentSources": sources,
            "auditFailureCount": sum(bool(result.get("auditErrors")) for result in results)}
    return {"caseCount": len(cases), "byPolicy": policies,
        "comparisons": {"fastVsV4": paired_summary(cases, "v4EventSearch", "fastEvent"), "fastVsRaw": paired_summary(cases, "rawMILP", "fastEvent"), "v4VsRaw": paired_summary(cases, "rawMILP", "v4EventSearch")},
        "byScale": {str(count): {"caseCount": sum(case["count"] == count for case in cases),
                       "feasibleCounts": {method: sum(case["count"] == count and bool(case["policies"][method]["rows"]) for case in cases) for method in METHODS}}
                    for count in sorted(set((16, 50, 100)) | {case["count"] for case in cases})},
        "completeSchedulesAudited": sum(bool(result["rows"]) for case in cases for result in case["policies"].values())}


def check_deadline(result, budget, label):
    require(result["hardWallMs"] == budget, f"{label}: changed end-to-end budget")
    require(all(type(result[key]) is bool for key in ("endToEndCompletedWithinBudget", "retainedCheckpoint", "deadlineReached", "auditValid")), f"{label}: deadline flags must be boolean")
    require(bool(result["rows"]) == result["auditValid"], f"{label}: audit flag contradicts rows")
    require(finite(result["wallTimeMs"]) and result["wallTimeMs"] >= 0 and finite(result["processExitWallTimeMs"]) and result["processExitWallTimeMs"] >= 0, f"{label}: invalid wall time")
    if result["endToEndCompletedWithinBudget"]:
        require(finite(result["finalReceivedMs"]) and 0 <= result["finalReceivedMs"] <= budget, f"{label}: late final result")
    else:
        require(result.get("finalReceivedMs") is None, f"{label}: unaccepted final receipt retained")
    if result["retainedCheckpoint"]:
        require(bool(result["rows"]) and not result["endToEndCompletedWithinBudget"] and result["optimality"] == "feasible_incumbent_only"
                and result.get("solverStatus") is None and finite(result["checkpointReceivedMs"]) and 0 <= result["checkpointReceivedMs"] <= budget,
                f"{label}: retained checkpoint has late/invalid proof")
    if result.get("optimality") == "proven_optimal":
        require(bool(result["rows"]) and result["endToEndCompletedWithinBudget"] and not result["retainedCheckpoint"], f"{label}: late/unusable optimum claim")


def generated_scenario(config, protocol):
    """Independent translation of frozen V2 generator; called only after results exist."""
    state = config["seed"] & 0xffffffff
    def draw():
        nonlocal state
        state = (state * 1664525 + 1013904223) & 0xffffffff
        return state / 4294967296
    count, start = config["count"], protocol["horizon"]["start"]
    capacities = [math.ceil(count / d) for d in ((4, 5, 2) if config["capacityProfile"] == "balanced" else (6, 8, 4))]
    containers = []
    for index in range(count):
        size = 40 if draw() < .45 else 20
        duration_draw = draw()
        duration = 1 if duration_draw < .7 else 2 if duration_draw < .95 else 3
        if config["mechanism"] == "aged-backlog":
            discharge = -(3 + math.floor(draw() * 14)); release = math.floor(draw() * 4); slack = 3 + math.floor(draw() * 5)
        elif config["mechanism"] == "new-arrivals":
            release = math.floor(draw() * 9); discharge = release - (0 if draw() < .75 else 1); slack = 2 + math.floor(draw() * 4)
        elif config["mechanism"] == "batch-release":
            release = (0, 4, 7)[math.floor(draw() * 3)]; discharge = release - (2 + math.floor(draw() * 5)); slack = 2 + math.floor(draw() * 4)
        else:
            raise ValueError("Unrecognized frozen generation mechanism")
        hour = "07" if draw() < .5 else "10"
        containers.append({"id": f"{config['id']}-C{index + 1:03d}", "sizeFt": size, "unloadDays": duration, "releaseDay": release,
                           "dischargeDateTime": f"{(date.fromisoformat(start) + timedelta(days=discharge)).isoformat()}T{hour}:00:00+09:00",
                           "dueDay": min(12, release + duration - 1 + slack), "dataOrigin": "synthetic"})
    return {"id": config["id"], "name": f"V2 {config['mechanism']} / {config['capacityProfile']} / {count}", "seed": config["seed"],
            "horizonStart": start, "horizonDays": protocol["horizon"]["days"],
            **dict(zip((resource + "Capacity" for resource in RESOURCES), capacities)),
            "tariff": protocol["defaultTariff"], "operations": protocol["defaultOperations"], "containers": containers}


def source_binding(root, archive, snapshot_name):
    hashes = archive.get("implementationHashes")
    require(isinstance(hashes, dict) and hashes, f"{snapshot_name}: missing implementation hashes")
    snapshot = root / "vendor" / "experiments" / snapshot_name
    manifest = read_json(snapshot / "manifest.json")
    manifest_hashes = manifest.get("implementationHashes", manifest.get("files", {}))
    checks = []
    for filename, expected in hashes.items():
        path = Path(filename)
        require(not path.is_absolute() and ".." not in path.parts and isinstance(expected, str), "Invalid source snapshot path/hash")
        manifest_value = manifest_hashes.get(filename)
        if isinstance(manifest_value, dict):
            manifest_value = manifest_value.get("expectedSHA256", manifest_value.get("sha256"))
        require(sha256(snapshot / path) == expected == manifest_value, f"Source snapshot mismatch: {snapshot_name}/{filename}")
        current = sha256(root / path)
        checks.append({"path": filename, "experimentSHA256": expected, "snapshotMatches": True,
                       "currentSHA256": current, "currentMatchesFirstRun": current == expected})
    return checks


def audit_native(root, benchmark_path, cases, controls, complete_count):
    path = root / "data" / "certificate-v5.json"
    if not path.is_file():
        return {"status": "not_provided", "scope": "Native verification is extra budget and not required for this standard-library ledger review"}
    report = read_json(path)
    input_path = root / "data" / "certificate-input-v5.json"
    flattened = read_json(input_path)
    require(report["inputSha256"] == sha256(input_path), "Native certificate is bound to another flattened input")
    origin_hash = sha256(benchmark_path)
    require(flattened.get("originArchiveSha256", report.get("originArchiveSha256")) == origin_hash, "Native flattened input is bound to another original archive")
    for value in (flattened, report):
        if "originArchiveSha256" in value:
            require(value["originArchiveSha256"] == origin_hash, "Native origin archive hash mismatch")
    combined = cases + controls
    bindings = report.get("evidenceBindings")
    require(isinstance(bindings, dict), "Native certificate lacks V5 evidenceBindings")
    protocol_hash = sha256(root / "data" / "protocol-v5.json")
    primary_ids, control_ids = [case["id"] for case in cases], [case["id"] for case in controls]
    require(bindings.get("originArchiveSha256") == origin_hash and bindings.get("protocolSha256") == protocol_hash,
            "Native evidenceBindings archive/protocol hash mismatch")
    require(flattened.get("protocolSha256") == protocol_hash and flattened.get("primaryCaseIds") == primary_ids and flattened.get("scaleControlCaseIds") == control_ids,
            "Native flattened input protocol/primary/control identity binding mismatch")
    require(bindings.get("primaryCaseIds") == primary_ids and bindings.get("scaleControlCaseIds") == control_ids
            and bindings.get("independentPrimaryScenarioCount") == len(cases) and bindings.get("repeatedInputBudgetControlCount") == len(controls),
            "Native evidenceBindings primary/control coverage mismatch")
    require(bindings.get("implementationSha256") == sha256(root / "scripts" / "certify-v4.py")
            and bindings.get("wrapperSha256") == sha256(root / "scripts" / "certify-v5.py"), "Native certifier/wrapper implementation hash mismatch")
    require([case["id"] for case in flattened["cases"]] == [case["id"] for case in combined], "Native flattened input omitted/reordered primary/control cases")
    for source, supplied in zip(combined, flattened["cases"]):
        require(supplied["scenario"] == source["scenario"] and supplied["policies"] == source["policies"], f"{source['id']}: native flattened input differs from archived scenario/policies")
    require([case["id"] for case in report["cases"]] == [case["id"] for case in combined], "Native certificate omitted/reordered primary/control cases")
    summary = report["summary"]
    require(summary["inputCaseCount"] == summary["caseCount"] == summary["passedCaseCount"] == len(combined)
            and summary["failedCaseCount"] == summary["omittedCaseCount"] == 0
            and summary["auditedCandidateCount"] == complete_count, "Native summary omits cases/candidates")
    native_results = []
    for source, certified in zip(combined, report["cases"]):
        require(certified["valid"] and not certified["errors"] and set(certified["policyAudits"]) == set(source["policies"]), "Native policy coverage/validity mismatch")
        for name, result in source["policies"].items():
            audit = certified["policyAudits"][name]
            require(audit["valid"] and not audit["errors"] and audit["audited"] == bool(result["rows"]), "Native audit/complete rows mismatch")
            if result["rows"]:
                for key in TOTAL_KEYS:
                    close(audit["independentCosts"][key], result[key], "Native per-policy " + key)
        for certificate in certified["certificates"].values():
            native_results.append(certificate)
            require(not certificate["provenOptimal"] or certificate["hasIncumbent"] and certificate["numericalAssurance"]["primarySafeInteger"], "Native floated objective mislabeled exact")
    require(summary["provenOptimalCount"] == sum(value["provenOptimal"] for value in native_results)
            and summary["provenInfeasibleCount"] == sum(value["certificateStatus"] == "proven_infeasible" for value in native_results)
            and summary["noCertificateCount"] == sum(value["certificateStatus"] == "no_certificate" for value in native_results), "Native certificate summary status counts differ from cases")
    if "solverOptimalWithNumericToleranceCount" in summary:
        require(summary["solverOptimalWithNumericToleranceCount"] == sum(value["solverOptimal"] and not value["provenOptimal"] for value in native_results), "Native numeric optimum count differs from cases")
    by_group = {}
    for group, values in (("primary", report["cases"][:len(cases)]), ("sameInputScaleControls", report["cases"][len(cases):])):
        counts = {}
        for case in values:
            for certificate in case["certificates"].values():
                status = certificate["certificateStatus"]
                counts[status] = counts.get(status, 0) + 1
        by_group[group] = {"caseCount": len(values), "certificateStatuses": counts}
    return {"status": "bound_and_consistent", "inputSha256": report["inputSha256"], "originArchiveSha256": origin_hash,
            "primaryCaseCount": len(cases), "sameInputControlCaseCount": len(controls), "controlsAreAdditionalIndependentSamples": False,
            "evidenceBindings": bindings, "byGroup": by_group,
            "summary": summary, "sha256": sha256(path), "flattenedInputSha256": sha256(input_path)}


def review(root=ROOT, expected_hash=EXPECTED_PROTOCOL_HASH, fixture=False):
    files = {name: root / "data" / (name + ".json") for name in ("protocol-v5", "benchmark-v5", "rolling-v5")}
    # Require every completed archive before any independent generator call.
    protocol, benchmark, rolling = (read_json(files[name]) for name in ("protocol-v5", "benchmark-v5", "rolling-v5"))
    require(benchmark["executionState"] == rolling["executionState"] == "complete", "Unfinished V5 archive; no final evidence review performed")
    protocol_hash = sha256(files["protocol-v5"])
    require(protocol_hash == expected_hash == benchmark["protocolHash"] == rolling["protocolHash"], "Frozen V5 protocol hash mismatch")
    require(benchmark.get("protocol") == protocol and rolling.get("protocol") == protocol["rolling"], "Archive protocol content differs from frozen bytes")
    require(protocol["methods"] == list(METHODS) and protocol["rolling"]["methods"] == list(ROLLING_METHODS), "Declared method sets changed")
    main_config, rolling_config = protocol["primaryCases"], protocol["rolling"]["cases"]
    main, roll = benchmark["cases"], rolling["cases"]
    require([case["id"] for case in main] == [case["id"] for case in main_config], "Missing/reordered primary case")
    require([case["id"] for case in roll] == [case["id"] for case in rolling_config], "Missing/reordered rolling case")
    if not fixture:
        require(len(main) == 36 and len(roll) == 24 and len({case["seed"] for case in main_config}) == 36
                and len({case["seed"] for case in rolling_config}) == 24, "Frozen 36/24 new-seed coverage changed")
    controls = benchmark["scaleControls"]["cases"]
    control_config = protocol["optionalScaleControl"]["cases"]
    require([case["id"] for case in controls] == [case["id"] for case in control_config], "Missing/reordered committed scale control")
    if not fixture:
        require(len(controls) == 6, "Scale controls are not six declared same-input repeats")
    static_count = control_count = timely = checkpoints = 0
    for collection, configs, budget, is_control in ((main, main_config, protocol["budget"]["hardWallMs"], False),
            (controls, control_config, protocol["optionalScaleControl"]["hardWallMs"], True)):
        for index, (case, config) in enumerate(zip(collection, configs)):
            for key, value in config.items():
                require(case.get(key) == value, f"{case['id']}: frozen configuration mismatch: {key}")
            scenario = case["scenario"]
            validate_scenario(scenario, case["id"])
            if is_control:
                reference = next((other for other in main if other["id"] == case.get("referenceCaseId")), None)
                require(reference is not None and scenario == reference["scenario"], f"{case['id']}: scale control is not the identical reference input")
                require(fixture or case["count"] == 100, "Control is not a declared 100-box input")
            elif not fixture:
                require(scenario == generated_scenario(config, protocol), f"{case['id']}: orders differ from independent frozen generator")
            require(set(case["policies"]) == set(METHODS), f"{case['id']}: omitted method")
            expected_order = [METHODS[(index + offset) % len(METHODS)] for offset in range(len(METHODS))]
            require(case["methodExecutionOrder"] == expected_order, f"{case['id']}: changed rotated execution order")
            for method, result in case["policies"].items():
                label = case["id"] + "/" + method
                totals = audit_schedule(scenario, result, label)
                check_deadline(result, budget, label)
                require(result.get("objectiveMode", "joint") == "joint", f"{label}: primary is not joint objective")
                if is_control:
                    control_count += totals is not None
                else:
                    static_count += totals is not None
                timely += result["endToEndCompletedWithinBudget"]
                checkpoints += result["retainedCheckpoint"]
        actual_summary = benchmark["scaleControls"]["summary"] if is_control else benchmark["summary"]
        expected_summary = static_summary(collection)
        require(set(actual_summary) >= {"caseCount", "byPolicy", "comparisons", "byScale", "completeSchedulesAudited"}, "Static summary missing required ledgers")
        require(set(actual_summary["byPolicy"]) == set(METHODS) and actual_summary["caseCount"] == len(collection), "Static summary omitted methods/cases")
        for fields in actual_summary["byPolicy"].values():
            require(set(fields) >= {"caseCount", "feasibleCount", "provenOptimalCount", "hardDeadlineCount", "retainedCheckpointCount", "medianWallMs", "wallTimeMs", "processExitWallTimeMs"},
                    "Static per-method summary omitted coverage/deadline/timing")
        require(set(actual_summary["comparisons"]) == {"fastVsV4", "fastVsRaw", "v4VsRaw"}, "Protocol-required pairwise comparison omitted")
        for fields in actual_summary["comparisons"].values():
            require(set(fields) >= {"baselineMethod", "candidateMethod", "pairedCaseCount", "baselineIncrementalKRW", "candidateIncrementalKRW", "incrementalSavingsKRW", "weightedIncrementalSavingsPct",
                                    "baselineTotalKRW", "candidateTotalKRW", "positiveSavingsCount", "tiedCount", "negativeSavingsCount", "zeroBaselineCount", "missingBaselineCount", "missingCandidateCount", "worstLossKRW"},
                    "Static pairwise summary omitted failure/zero/adverse outcome ledgers")
        require(set(actual_summary["byScale"]) >= {"16", "50", "100"}, "Static summary omitted declared scale strata")
        for fields in actual_summary["byScale"].values():
            require(set(fields) >= {"caseCount", "feasibleCounts"} and set(fields["feasibleCounts"]) == set(METHODS), "Static scale summary omitted methods/counts")
        compare_summary(actual_summary, expected_summary, "scaleControlSummary" if is_control else "staticSummary")
    timeline_count = rolling_complete = 0
    rolling_audits = []
    for case, config in zip(roll, rolling_config):
        for key, value in config.items():
            require(case.get(key) == value, f"{case['id']}: frozen rolling configuration differs: {key}")
        nominal = case["nominalScenario"]
        validate_scenario(nominal, case["id"])
        if not fixture:
            require(nominal == generated_scenario(config, protocol), f"{case['id']}: rolling orders differ from frozen generator")
        expected_events = [{**event, "capacity": max(0, capacity(nominal, event["resource"], event["revealDay"]) - event["reduction"])}
                           for event in config["shocks"]]
        require(case["events"] == expected_events and all("announcedDuration" not in event for event in case["events"]), f"{case['id']}: changed/revealed private capacity shocks")
        require(case["scenario"] == realize(nominal, expected_events), f"{case['id']}: realized capacities differ from shocks")
        require(set(case["policies"]) == set(ROLLING_METHODS), f"{case['id']}: missing rolling method")
        expected_order = list(ROLLING_METHODS) if len(rolling_audits) % 2 == 0 else list(reversed(ROLLING_METHODS))
        require(case["methodExecutionOrder"] == expected_order, f"{case['id']}: changed alternating rolling method order")
        methods = {}
        for method, result in case["policies"].items():
            label = case["id"] + "/" + method
            require(result["timeLimitSeconds"] == protocol["rolling"]["timeLimitSeconds"], f"{label}: different solver-call limit")
            rolling_complete += audit_schedule(case["scenario"], result, label) is not None
            methods[method] = audit_timeline(case, result, method, label)
            timeline_count += methods[method]["timelineEntries"]
        rolling_audits.append({"id": case["id"], "methods": methods})
        initial = [sorted(case["policies"][method]["timeline"][0]["decisions"], key=lambda row: row["id"]) for method in ROLLING_METHODS]
        require(type(case["initialComparison"]["decisionsEqual"]) is bool and case["initialComparison"]["decisionsEqual"] == (initial[0] == initial[1]),
                f"{case['id']}: initial solver plan differences concealed/mislabeled")
    # Rolling summary schema is checked against independent terminal ledgers.
    summary = rolling["summary"]
    require(summary["caseCount"] == len(roll) and set(summary["byMethod"]) == set(ROLLING_METHODS), "Rolling summary omitted cases/methods")
    for fields in summary["byMethod"].values():
        require(set(fields) >= {"caseCount", "completeCount", "failureCount", "revisionCount", "solverCalls", "reusedPlans", "decisionCalls", "planningWallMs"},
                "Rolling summary omitted completion/solver/revision counters")
    by_policy = {}
    for method in ROLLING_METHODS:
        values = [case["policies"][method] for case in roll]
        by_policy[method] = {"caseCount": len(values), "completeCount": sum(result["complete"] for result in values),
            "failedCount": sum(not result["complete"] for result in values), "failureCount": sum(not result["complete"] for result in values),
            "solverCalls": sum(result["plannerStats"]["solverCalls"] for result in values), "totalSolverCalls": sum(result["plannerStats"]["solverCalls"] for result in values),
            "reusedPlans": sum(result["plannerStats"]["reusedPlans"] for result in values), "totalReusedPlans": sum(result["plannerStats"]["reusedPlans"] for result in values),
            "replannedDueToInvalid": sum(result["plannerStats"]["replannedDueToInvalid"] for result in values),
            "revisionCount": sum(result["revisionCount"] for result in values), "totalRevisionCount": sum(result["revisionCount"] for result in values),
            "totalRevisions": sum(result["revisionCount"] for result in values),
            "planningWallMs": sum(result["plannerStats"]["planningWallMs"] for result in values),
            "decisionCalls": sum(result["plannerStats"]["decisionCalls"] for result in values),
            "runtimeMs": timing([result["runtimeMs"] for result in values])}
    compare_summary(summary["byMethod"], by_policy, "rollingSummary/byMethod")
    pair = paired_summary(roll, "dailyReopt", "stableRetain", rolling=True)
    paired = [(case["policies"]["dailyReopt"], case["policies"]["stableRetain"]) for case in roll
              if case["policies"]["dailyReopt"]["complete"] and case["policies"]["stableRetain"]["complete"]]
    base_total, stable_total = pair["baselineTotalKRW"], pair["candidateTotalKRW"]
    base_revisions, stable_revisions = pair["baselineRevisionsPaired"], pair["candidateRevisionsPaired"]
    expected_pair = {"caseCount": len(paired), "dailyTotalCost": base_total, "stableTotalCost": stable_total,
        "stableExtraCost": stable_total - base_total, "stablePremiumPct": 100 * (stable_total - base_total) / base_total if base_total else None,
        "dailyRevisionCount": base_revisions, "stableRevisionCount": stable_revisions,
        "changeReductionPct": 100 * (base_revisions - stable_revisions) / base_revisions if base_revisions else None,
        "dailySolverCalls": pair["baselineSolverCallsPaired"], "stableSolverCalls": pair["candidateSolverCallsPaired"],
        "stableCheaperCount": sum(other["totalCost"] < base["totalCost"] - TOLERANCE for base, other in paired),
        "equalCostCount": sum(abs(other["totalCost"] - base["totalCost"]) <= TOLERANCE for base, other in paired),
        "stableMoreExpensiveCount": sum(other["totalCost"] > base["totalCost"] + TOLERANCE for base, other in paired)}
    require(set(summary["paired"]) >= set(expected_pair), "Rolling paired summary omitted incomplete/zero/adverse comparisons")
    compare_summary(summary["paired"], expected_pair, "rollingSummary/paired")
    for key, expected in (("gainedCompletionCases", [case["id"] for case in roll if case["policies"]["stableRetain"]["complete"] and not case["policies"]["dailyReopt"]["complete"]]),
                          ("lostCompletionCases", [case["id"] for case in roll if not case["policies"]["stableRetain"]["complete"] and case["policies"]["dailyReopt"]["complete"]]),
                          ("initialPlansDifferCaseIds", [case["id"] for case in roll if not case["initialComparison"]["decisionsEqual"]])):
        require(summary[key] == expected, f"rollingSummary/{key}: missing/reordered outcomes")
    native = audit_native(root, files["benchmark-v5"], main, controls, static_count + control_count)
    static_sources = source_binding(root, benchmark, "v5-first-run-source")
    rolling_snapshot = rolling.get("sourceSnapshot", "v5-rolling-first-run-source")
    if isinstance(rolling_snapshot, dict):
        rolling_snapshot = rolling_snapshot.get("directory", rolling_snapshot.get("path"))
    if isinstance(rolling_snapshot, str) and "/" in rolling_snapshot:
        rolling_snapshot = Path(rolling_snapshot).name
    rolling_sources = source_binding(root, rolling, rolling_snapshot)
    return {"schemaVersion": SCHEMA, "valid": True, "readOnly": True, "solverRuns": 0, "importsMainImplementation": False,
            "fixture": fixture, "scope": "Handcrafted unit fixture only" if fixture else
                "Internal second implementation of declared daily fees, resource execution, causal information, frozen history and ledger counts; synthetic evidence, not third-party certification or competition ranking proof",
            "protocolHash": protocol_hash, "inputHashes": {str(path.relative_to(root)): sha256(path) for path in files.values()},
            "reviewImplementationSHA256": sha256(Path(__file__).resolve()),
            "sourceHashes": {"static": static_sources, "rolling": rolling_sources}, "nativeVerification": native,
            "rollingAudits": rolling_audits, "rollingRecomputedComparison": pair,
            "summary": {"primaryCases": len(main), "primaryMethodRecords": len(main) * len(METHODS),
                        "sameInputScaleControls": len(controls), "scaleControlMethodRecords": len(controls) * len(METHODS),
                        "scaleControlsAreAdditionalIndependentSamples": False,
                        "rollingCases": len(roll), "rollingMethodRecords": len(roll) * len(ROLLING_METHODS),
                        "primaryCompleteSchedulesRepriced": static_count, "controlCompleteSchedulesRepriced": control_count,
                        "rollingCompleteSchedulesRepriced": rolling_complete, "rollingTimelineEntriesChecked": timeline_count,
                        "timelyFinalResultsChecked": timely, "timelyRetainedCheckpointsChecked": checkpoints,
                        "feeAbsoluteTolerance": TOLERANCE}}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=ROOT, help="Project/archive root; read-only")
    parser.add_argument("--fixture", action="store_true", help="Explicit handcrafted unit-fixture scope; never competition evidence")
    parser.add_argument("--expected-protocol-hash", default=EXPECTED_PROTOCOL_HASH, help="Override permitted only with --fixture")
    args = parser.parse_args(argv)
    if args.expected_protocol_hash != EXPECTED_PROTOCOL_HASH and not args.fixture:
        parser.error("Custom protocol hashes require --fixture")
    try:
        report = review(args.root.resolve(), args.expected_protocol_hash, args.fixture)
    except (OSError, ValueError, KeyError, TypeError, IndexError, StopIteration) as error:
        print(json.dumps({"schemaVersion": SCHEMA, "valid": False, "readOnly": True, "solverRuns": 0,
                          "importsMainImplementation": False, "fixture": args.fixture, "error": str(error)}, ensure_ascii=False))
        return 1
    print(json.dumps(report, ensure_ascii=False, indent=2, allow_nan=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
