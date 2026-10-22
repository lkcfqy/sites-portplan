#!/usr/bin/env python3
"""Read-only, standard-library review of PortPlan's archived V4 evidence.

No solver runs, JS imports, or imports from certify-v4.py. The default root is
derived from this file. Nothing is written to the evidence files.
"""

from __future__ import annotations

import hashlib
import json
import math
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
RESOURCES = ("truck", "warehouse", "staging")
EVENTS = ("pickupDay", "unloadDay", "returnDay")
EVENT_FIELD = {"pickup": "pickupDay", "unloadStart": "unloadDay", "return": "returnDay"}
TOTAL_KEYS = ("storageCost", "ddCost", "totalCost", "sunkCost", "incrementalCost")
SUCCESS = ("feasible", "optimal")
TOLERANCE = 1e-6


def require(condition, message):
    if not condition:
        raise ValueError(message)


def close(actual, expected, message):
    require(isinstance(actual, (int, float)) and not isinstance(actual, bool)
            and math.isfinite(actual) and abs(actual - expected) <= TOLERANCE,
            f"{message}: expected {expected}, received {actual}")


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read_json(path):
    def reject_constant(value):
        raise ValueError(f"Non-finite JSON constant {value} in {path}")
    return json.loads(path.read_text(encoding="utf-8"), parse_constant=reject_constant)


def capacity(scenario, resource, day):
    value = scenario[resource + "Capacity"]
    return value[day] if isinstance(value, list) else value


def charge(days, ends, rates, mode):
    days = max(0, days)
    if not days:
        return 0
    rate = lambda index: next(value for end, value in zip(ends, rates) if index <= end)
    return days * rate(days) if mode == "retroactive" else sum(rate(d) for d in range(1, days + 1))


def reprice(scenario, container, pickup, returned):
    tariff = {"pncFreeDays": 4, "ddFreeDays": 10, "pncMultiplier": 1,
              "ddMultiplier": 1, "pncMode": "retroactive", "ddMode": "progressive",
              **scenario.get("tariff", {})}
    start = date.fromisoformat(scenario["horizonStart"])
    timestamp = datetime.fromisoformat(container["dischargeDateTime"])
    require(timestamp.tzinfo is not None, f"{container['id']}: discharge timestamp lacks timezone")
    local = timestamp.astimezone(timezone(timedelta(hours=9)))
    discharged = local.date()
    storage_start = discharged + timedelta(days=int(local.hour >= 8))
    storage_days = max(0, (start - storage_start).days + pickup + 1)
    dd_days = max(0, (start - discharged).days + returned + 1)

    def storage(days):
        return charge(days - tariff["pncFreeDays"], (3, 5, 10, math.inf),
                      (9100, 18200, 31850, 45500), tariff["pncMode"]) * container["sizeFt"] / 20 * tariff["pncMultiplier"]

    def dd(days):
        rates = (15000, 30000, 50000) if container["sizeFt"] == 20 else (30000, 50000, 90000)
        return charge(days - tariff["ddFreeDays"], (5, 10, math.inf), rates,
                      tariff["ddMode"]) * tariff["ddMultiplier"]

    storage_cost, dd_cost = storage(storage_days), dd(dd_days)
    prior_storage = storage(max(0, (start - storage_start).days))
    prior_dd = dd(max(0, (start - discharged).days))
    return {"storageDays": storage_days, "ddDays": dd_days,
            "storageCost": storage_cost, "ddCost": dd_cost,
            "priorStorageCost": prior_storage, "priorDDCost": prior_dd,
            "totalCost": storage_cost + dd_cost, "sunkCost": prior_storage + prior_dd,
            "incrementalCost": storage_cost + dd_cost - prior_storage - prior_dd}


def audit_schedule(scenario, result, label):
    rows = result.get("rows")
    require(isinstance(rows, list), f"{label}: rows must be an array")
    if not rows:
        require(result.get("status") not in SUCCESS, f"{label}: success without rows")
        require(all(result.get(key) is None for key in (*TOTAL_KEYS, "objectiveCost")),
                f"{label}: missing complete plan has a fee instead of null")
        return None
    horizon = scenario["horizonDays"]
    containers = {c["id"]: c for c in scenario["containers"]}
    require(len(rows) == len(containers), f"{label}: incomplete container coverage")
    operation = {"returnLagDays": 1, "stagingUnit": "container", **scenario.get("operations", {})}
    seen, usage = set(), [[0, 0, 0] for _ in range(horizon)]
    totals = {key: 0 for key in TOTAL_KEYS}
    primary = 0
    mode = result.get("objectiveMode", scenario.get("objectiveMode", "joint"))
    require(mode in ("joint", "storageOnly", "ddOnly"), f"{label}: unknown objective")
    for row in rows:
        identifier = row["id"]
        require(identifier in containers and identifier not in seen, f"{label}: unknown/duplicate {identifier}")
        seen.add(identifier)
        c = containers[identifier]
        pickup, unload, returned = (row[key] for key in EVENTS)
        require(all(type(v) is int and 0 <= v < horizon for v in (pickup, unload, returned)),
                f"{label}/{identifier}: invalid event date")
        end = unload + c["unloadDays"] - 1
        require(pickup >= c["releaseDay"] and unload >= pickup
                and end <= c["dueDay"] and returned >= end + operation["returnLagDays"],
                f"{label}/{identifier}: release/precedence/deadline violation")
        require(row["unloadEndDay"] == end and row["sizeFt"] == c["sizeFt"],
                f"{label}/{identifier}: duration/size mismatch")
        costs = reprice(scenario, c, pickup, returned)
        for key, value in costs.items():
            close(row.get(key), value, f"{label}/{identifier}/{key}")
        for key in totals:
            totals[key] += costs[key]
        primary += (costs["storageCost"] - costs["priorStorageCost"] if mode == "storageOnly" else
                    costs["ddCost"] - costs["priorDDCost"] if mode == "ddOnly" else costs["incrementalCost"])
        usage[pickup][0] += 1
        usage[returned][0] += 1
        for day in range(unload, end + 1):
            usage[day][1] += 1
        for day in range(pickup, returned):
            usage[day][2] += c["sizeFt"] / 20 if operation["stagingUnit"] == "teu" else 1
    require(seen == set(containers), f"{label}: container coverage mismatch")
    for day, amounts in enumerate(usage):
        for index, resource in enumerate(RESOURCES):
            require(amounts[index] <= capacity(scenario, resource, day), f"{label}: {resource} over capacity on {day}")
    for key, value in totals.items():
        close(result.get(key), value, f"{label}/{key}")
    close(result.get("objectiveCost"), primary, f"{label}/objectiveCost")
    return totals


def stable_json(value):
    return json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(",", ":"), allow_nan=False)


def observation_checksum(value, recorded):
    encoded = stable_json(value)
    if recorded.startswith("sha256:"):
        return "sha256:" + hashlib.sha256(encoded.encode("utf-8")).hexdigest()
    require(recorded.startswith("fnv1a32:"), "Unknown observation hash algorithm")
    checksum, units = 2166136261, encoded.encode("utf-16-le")
    for index in range(0, len(units), 2):
        checksum = ((checksum ^ int.from_bytes(units[index:index + 2], "little")) * 16777619) & 0xffffffff
    return f"fnv1a32:{checksum:08x}"


def audit_timeline(case, result, label):
    nominal, actual, shocks = case["nominalScenario"], case["scenario"], case["events"]
    fixed, previous, revisions, checked = {}, None, 0, 0
    for entry in result["timeline"]:
        day = entry["day"]
        require(day == checked, f"{label}: nonconsecutive timeline")
        checked += 1
        observation = json.loads(json.dumps(nominal))
        for resource in RESOURCES:
            observation[resource + "Capacity"] = [capacity(nominal, resource, d) for d in range(nominal["horizonDays"])]
        for shock in shocks:
            if shock["revealDay"] <= day and "announcedDuration" in shock:
                for d in range(shock["revealDay"], min(nominal["horizonDays"], shock["revealDay"] + shock["announcedDuration"])):
                    observation[shock["resource"] + "Capacity"][d] = shock["capacity"]
        for resource in RESOURCES:
            for d in range(day + 1):
                observation[resource + "Capacity"][d] = capacity(actual, resource, d)
        require(observation_checksum({"scenario": observation, "observedEvents": entry["observedEvents"],
                                      "fixedEvents": fixed, "minEventDay": day}, entry["observationHash"])
                == entry["observationHash"], f"{label}: observed snapshot hash mismatch on {day}")
        decisions = {row["id"]: row for row in entry["decisions"]}
        for row in decisions.values():
            for key in EVENTS:
                if key in fixed.get(row["id"], {}):
                    require(row[key] == fixed[row["id"]][key], f"{label}: changed executed {key}")
                else:
                    require(type(row[key]) is int and row[key] >= day, f"{label}: unexecuted {key} in past")
        for observed in entry["observedEvents"]:
            require(observed["capacity"] == capacity(actual, observed["resource"], day), f"{label}: incorrect current observation")
        executed = entry["executedEvents"]
        if entry["status"] == "executed":
            expected = sorted((row["id"], key, day) for row in decisions.values() for key in EVENTS if row[key] == day)
            received = sorted((event["id"], EVENT_FIELD[event["event"]], event["day"]) for event in executed)
            require(expected == received, f"{label}: missing/extra executed event on {day}")
            changes = sum(previous.get(identifier, {}).get(key) != row[key]
                          for identifier, row in decisions.items() for key in EVENTS
                          if key not in fixed.get(identifier, {})) if previous is not None else 0
            require(changes == len(entry.get("revisions", [])), f"{label}: revision count mismatch on {day}")
            revisions += changes
            require(revisions == entry["revisionCount"], f"{label}: cumulative revision mismatch")
            previous = decisions
        else:
            require(not executed, f"{label}: failed decision executed actions")
        for event in executed:
            field = EVENT_FIELD[event["event"]]
            require(event["day"] == day and field not in fixed.get(event["id"], {}), f"{label}: repeated execution")
            fixed.setdefault(event["id"], {})[field] = day
    require(revisions == result["revisionCount"], f"{label}: final revisions mismatch")
    if result["complete"]:
        for row in result["rows"]:
            require(all(row[key] == fixed[row["id"]][key] for key in EVENTS), f"{label}: final dates differ from execution")
    else:
        require(result.get("failure") and not result["rows"], f"{label}: incomplete execution lacks failure")
    return checked


def review():
    files = {name: ROOT / "data" / (name + ".json") for name in
             ("benchmark-v4", "protocol-v4", "rolling-v4", "rolling-protocol-v4", "certificate-v4")}
    data = {name: read_json(path) for name, path in files.items()}
    benchmark, rolling, certificate = (data[name] for name in ("benchmark-v4", "rolling-v4", "certificate-v4"))
    protocol = data["protocol-v4"]
    require(benchmark["executionState"] == rolling["executionState"] == "complete", "Unfinished experiment archive")
    require(benchmark["protocolHash"] == sha256(files["protocol-v4"]), "Benchmark protocol hash mismatch")
    require(rolling["protocolHash"] == sha256(files["rolling-protocol-v4"])
            and rolling["protocol"] == data["rolling-protocol-v4"], "Rolling protocol hash/content mismatch")
    require(certificate["inputSha256"] == sha256(files["benchmark-v4"]), "Certificate bound to another input archive")
    ids = [case["id"] for case in benchmark["cases"]]
    require(ids == [case["id"] for case in protocol["primaryCases"]], "Missing/reordered benchmark case")
    require([case["id"] for case in rolling["cases"]] == [case["id"] for case in data["rolling-protocol-v4"]["cases"]], "Missing/reordered rolling case")
    require([case["id"] for case in certificate["cases"]] == ids, "Missing/reordered certificate case")
    static_count, rolling_count, timeline_count, final_count, checkpoint_count = 0, 0, 0, 0, 0
    for case in benchmark["cases"]:
        require(set(case["policies"]) == set(protocol["methods"]), f"{case['id']}: missing method")
        for name, result in case["policies"].items():
            label = case["id"] + "/" + name
            totals = audit_schedule(case["scenario"], result, label)
            static_count += totals is not None
            require(bool(totals) == bool(result["auditValid"]), f"{label}: audit flag contradicts complete rows")
            require(result["hardWallMs"] == protocol["budget"]["hardWallMs"], f"{label}: different budget")
            if result["endToEndCompletedWithinBudget"]:
                require(0 <= result["finalReceivedMs"] <= result["hardWallMs"], f"{label}: late final result")
                final_count += 1
            if result["retainedCheckpoint"]:
                require(totals is not None and not result["endToEndCompletedWithinBudget"]
                        and result["optimality"] == "feasible_incumbent_only" and result["solverStatus"] is None
                        and 0 <= result["checkpointReceivedMs"] <= result["hardWallMs"], f"{label}: invalid retained checkpoint/proof")
                checkpoint_count += 1
            require(result["optimality"] != "proven_optimal" or result["endToEndCompletedWithinBudget"], f"{label}: late optimality proof")
    for case in rolling["cases"]:
        require(set(case["policies"]) == {"static", "rolling", "hindsight"}, f"{case['id']}: missing rolling method")
        for name, result in case["policies"].items():
            label = case["id"] + "/" + name
            rolling_count += audit_schedule(case["scenario"], result, label) is not None
            if name != "hindsight":
                timeline_count += audit_timeline(case, result, label)
    for case, native in zip(benchmark["cases"], certificate["cases"]):
        require(native["valid"] and not native["errors"], f"{case['id']}: certificate reports contradiction")
        require(set(native["policyAudits"]) == set(case["policies"]), f"{case['id']}: certificate omitted method")
        for name, result in case["policies"].items():
            audit = native["policyAudits"][name]
            require(audit["valid"] and not audit["errors"] and audit["audited"] == bool(result["rows"]), f"{case['id']}/{name}: certificate audit mismatch")
            if result["rows"]:
                for key in TOTAL_KEYS:
                    close(audit["independentCosts"][key], result[key], f"{case['id']}/{name}: native costs")
        for value in native["certificates"].values():
            require(not value["provenOptimal"] or value["hasIncumbent"] and value["numericalAssurance"]["primarySafeInteger"], f"{case['id']}: invalid native exact-optimum label")
    close(benchmark["summary"]["audit"]["completeSchedulesChecked"], static_count, "Benchmark checked schedule count")
    require(benchmark["summary"]["caseCount"] == len(ids) and rolling["summary"]["caseCount"] == len(rolling["cases"]), "Summary omits cases")
    native_summary = certificate["summary"]
    require(native_summary["inputCaseCount"] == native_summary["caseCount"] == native_summary["passedCaseCount"] == len(ids)
            and native_summary["omittedCaseCount"] == native_summary["failedCaseCount"] == 0
            and native_summary["auditedCandidateCount"] == static_count, "Native summary omits candidates/cases")
    native_results = [value for case in certificate["cases"] for value in case["certificates"].values()]
    require(native_summary["provenOptimalCount"] == sum(value["provenOptimal"] for value in native_results)
            and native_summary["provenInfeasibleCount"] == sum(value["certificateStatus"] == "proven_infeasible" for value in native_results)
            and native_summary["noCertificateCount"] == sum(value["certificateStatus"] == "no_certificate" for value in native_results),
            "Native certificate status counts differ from cases")
    snapshot_root = ROOT / "vendor" / "experiments" / "v4-first-run-source"
    manifest = read_json(snapshot_root / "manifest.json")
    source_checks = []
    for filename, expected in benchmark["implementationHashes"].items():
        archived = sha256(snapshot_root / filename)
        require(archived == expected == manifest["files"][filename]["expectedSHA256"], f"Source snapshot hash mismatch: {filename}")
        current = sha256(ROOT / filename)
        source_checks.append({"path": filename, "experimentSHA256": expected, "snapshotMatches": True,
                              "currentSHA256": current, "currentMatchesFirstRun": current == expected})
    for filename, info in manifest["additionalFiles"].items():
        require(sha256(snapshot_root / filename) == info["sha256"], f"Additional snapshot hash mismatch: {filename}")
    return {"schemaVersion": "portplan-readonly-review-v4", "valid": True,
            "scope": "Internal independent implementation; disclosed daily tariffs and synthetic orders, not third-party certification",
            "readOnly": True, "solverRuns": 0, "importsMainImplementation": False,
            "inputHashes": {str(path.relative_to(ROOT)): sha256(path) for path in files.values()},
            "reviewImplementationSHA256": sha256(Path(__file__).resolve()), "sourceHashes": source_checks,
            "summary": {"benchmarkCases": len(ids), "rollingCases": len(rolling["cases"]), "certificateCases": len(certificate["cases"]),
                        "staticCompleteSchedulesRepriced": static_count, "rollingCompleteSchedulesRepriced": rolling_count,
                        "allCompleteSchedulesRepriced": static_count + rolling_count, "rollingTimelineEntriesChecked": timeline_count,
                        "timelyFinalResultsChecked": final_count, "timelyRetainedCheckpointsChecked": checkpoint_count,
                        "nativeProvenOptimal": native_summary["provenOptimalCount"], "nativeProvenInfeasible": native_summary["provenInfeasibleCount"],
                        "feeAbsoluteTolerance": TOLERANCE}}


if __name__ == "__main__":
    try:
        report = review()
    except (OSError, ValueError, KeyError, TypeError, IndexError) as error:
        print(json.dumps({"schemaVersion": "portplan-readonly-review-v4", "valid": False,
                          "readOnly": True, "error": str(error)}, ensure_ascii=False))
        sys.exit(1)
    print(json.dumps(report, ensure_ascii=False, indent=2, allow_nan=False))
