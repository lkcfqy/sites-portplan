#!/usr/bin/env python3
"""Independent standard-library ledger review of immutable cold V6 episodes.

No JavaScript imports, solver calls, reruns or writes to archived experiments.
Reuses the independent Python V5 date/fee/resource implementation.
"""
from __future__ import annotations

import argparse
import copy
import hashlib
import importlib.util
import json
import math
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PROTOCOL_HASH = "6b40337ee36ff9ff10dbd22e4953932aa17900a5d12cbc3a5f75e36518660311"
ARCHIVE_HASH = "695f7a62aeccd645bbd1374899fc21afe6caad1549bfbc7fa2d25e1ed62552a4"
SCHEMA = "portplan-independent-rolling-review-v6"
METHODS = ("dailyReoptV4", "stableRetainV5", "lockedRecoveryV6", "persistenceRecoveryV6")
COUNTERS = ("decisionCalls", "solverCalls", "constructorCalls", "reusedPlans", "replannedDueToInvalid", "planningWallMs")
PACKAGING = {"package.json", "package-lock.json"}
spec = importlib.util.spec_from_file_location("independent_v5_ledger", ROOT / "scripts/review-v5.py")
ledger = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ledger)


def require(condition, message):
    if not condition:
        raise ValueError(message)


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def compare(actual, expected, label):
    if isinstance(expected, dict):
        require(isinstance(actual, dict) and set(actual) == set(expected), f"{label}: missing/extra fields")
        for key, value in expected.items():
            compare(actual[key], value, label + "/" + key)
    elif isinstance(expected, list):
        require(isinstance(actual, list) and len(actual) == len(expected), f"{label}: missing/reordered entries")
        for index, (value, reference) in enumerate(zip(actual, expected)):
            compare(value, reference, label + f"/{index}")
    elif type(expected) is bool or expected is None or isinstance(expected, str):
        require(type(actual) is type(expected) and actual == expected, f"{label}: expected {expected}, received {actual}")
    elif type(expected) is int:
        require(type(actual) is int and actual == expected, f"{label}: expected {expected}, received {actual}")
    else:
        ledger.close(actual, expected, label)


def forecast(scenario, day, persistence_days):
    predicted = ledger.expanded(scenario)
    changes = []
    for resource in ledger.RESOURCES:
        key = resource + "Capacity"
        current = ledger.capacity(scenario, resource, day)
        for future in range(day + 1, min(scenario["horizonDays"], day + persistence_days + 1)):
            supplied = predicted[key][future]
            assumed = min(supplied, current)
            if assumed != supplied:
                predicted[key][future] = assumed
                changes.append({"resource": resource, "day": future, "suppliedForecastCapacity": supplied, "assumedCapacity": assumed})
    return predicted, changes


def price_rows(scenario, rows, label):
    require(len(rows) == len(scenario["containers"]), f"{label}: incomplete priced row coverage")
    boxes = {container["id"]: container for container in scenario["containers"]}
    seen = set()
    for row in rows:
        identifier = row["id"]
        require(identifier in boxes and identifier not in seen, f"{label}: unknown/duplicate priced box")
        seen.add(identifier)
        container = boxes[identifier]
        require(all(type(row[key]) is int and 0 <= row[key] < scenario["horizonDays"] for key in ledger.EVENTS), f"{label}: invalid priced event day")
        require(row["sizeFt"] == container["sizeFt"] and row["unloadEndDay"] == row["unloadDay"] + container["unloadDays"] - 1, f"{label}: priced size/duration mismatch")
        for key, value in ledger.reprice(scenario, container, row["pickupDay"], row["returnDay"]).items():
            ledger.close(row.get(key), value, label + "/" + identifier + "/" + key)
    return len(rows)


def call_stage(stage):
    return isinstance(stage, dict) and stage.get("status") != "budget_skipped"


def audit_episode(case, result, method, protocol):
    label = case["id"] + "/" + method
    budget = protocol["budget"]["hardWallMs"]
    require(result["policy"] == method and result["hardWallMs"] == budget, f"{label}: policy/budget mismatch")
    for key in ("complete", "auditValid", "executionHistoryUnavailable", "deadlineReached", "outputDeliveredWithinBudget", "endToEndCompletedWithinBudget", "episodeCompletedWithinBudget"):
        require(type(result[key]) is bool, f"{label}: {key} must be boolean")
    require(result["outputDeliveredWithinBudget"] == result["endToEndCompletedWithinBudget"], f"{label}: contradictory envelope flags")
    require(result["episodeCompletedWithinBudget"] == (result["outputDeliveredWithinBudget"] and result["complete"] and result["auditValid"]), f"{label}: complete episode deadline claim mismatch")
    require(ledger.finite(result["wallTimeMs"]) and result["wallTimeMs"] >= 0 and ledger.finite(result["processExitWallTimeMs"]) and result["processExitWallTimeMs"] >= 0, f"{label}: invalid parent clocks")
    require(result["processExitWallTimeMs"] + 1e-6 >= result["wallTimeMs"], f"{label}: process exit clock precedes decision/receipt")
    if result["deadlineReached"]:
        require(result["wallTimeMs"] + 1e-6 >= budget, f"{label}: hard deadline before declared wall budget")
    if result["outputDeliveredWithinBudget"]:
        require(ledger.finite(result["finalReceivedMs"]) and 0 <= result["finalReceivedMs"] <= budget and not result["deadlineReached"], f"{label}: late terminal envelope")
        ledger.close(result["wallTimeMs"], result["finalReceivedMs"], label + "/receipt clock")
    else:
        require(result["finalReceivedMs"] is None and not result["complete"], f"{label}: late result promoted to complete")
    if not result["complete"]:
        require(result["rows"] == [] and all(result.get(key) is None for key in (*ledger.TOTAL_KEYS, "objectiveCost", "lateCount")), f"{label}: failed/partial complete fees must be null")
    if result["executionHistoryUnavailable"]:
        require(result["status"] in ("hard_time_limit", "worker_error"), f"{label}: unavailable history has unsupported status")
        require(result["status"] != "hard_time_limit" or result["deadlineReached"] and not result["outputDeliveredWithinBudget"], f"{label}: hard-time-limit status without parent cutoff")
        require(not result["deadlineReached"] or result["status"] == "hard_time_limit", f"{label}: parent cutoff mislabeled as early worker error")
        require(not result["complete"] and not result["auditValid"] and result["timeline"] == result["executedEvents"] == result["plannerTrace"] == result["usage"] == [], f"{label}: unavailable history contains apparent execution")
        require(result["revisionCount"] is None and result["finalState"] is None and all(result["plannerStats"].get(key) is None for key in COUNTERS), f"{label}: unknown history/counters converted to zero")
        return {"complete": False, "historyAvailable": False, "timelineEntries": 0, "pricedRows": 0, "acceptedPlans": 0, "forecastCalls": 0}
    require(result["outputDeliveredWithinBudget"], f"{label}: known terminal history was not delivered")
    require(ledger.finite(result.get("runtimeMs")) and 0 <= result["runtimeMs"] <= result["wallTimeMs"] + 1e-6, f"{label}: episode runtime exceeds parent wall or is invalid")
    require(result["timeLimitSeconds"] == protocol["callBudgets"][method]["timeLimitSeconds"] and result.get("objectiveMode", "joint") == "joint", f"{label}: per-call/objective declaration changed")
    per_call = result["perCallBudget"]
    require(per_call["legacySolverSeconds"] == .2 and per_call["recoveryBudgetMs"] == (200 if method.endswith("V6") else None), f"{label}: mixed per-call semantics mislabeled")
    timeline, traces = result["timeline"], result["plannerTrace"]
    require(isinstance(timeline, list) and 1 <= len(timeline) <= case["scenario"]["horizonDays"] and len(traces) == len(timeline), f"{label}: missing/overlong timeline/call trace")
    nominal, actual, events = case["nominalScenario"], case["scenario"], case["events"]
    fixed, previous, executed_all = {}, None, []
    revisions = solver_calls = constructor_calls = reused = replans = priced = accepted = forecast_calls = 0
    call_walls = []
    for day, (entry, trace) in enumerate(zip(timeline, traces)):
        require(entry["status"] in ("executed", "planner_error", "planning_failed", "candidate_rejected", "execution_rejected"), f"{label}: unsupported coordinator timeline status")
        require(entry["day"] == trace["day"] == day, f"{label}: nonconsecutive decision day")
        observation, observations = ledger.observed_snapshot(nominal, actual, events, day)
        compare(entry["observedEvents"], observations, label + f"/day{day}/observations")
        recorded_hash = ledger.checksum({"scenario": observation, "observedEvents": observations, "fixedEvents": fixed, "minEventDay": day}, entry["observationHash"])
        require(recorded_hash == entry["observationHash"], f"{label}: future information or frozen-history checksum mismatch")
        planning = observation
        if method == "persistenceRecoveryV6":
            planning, changes = forecast(observation, day, protocol["callBudgets"][method]["persistenceDays"])
            forecast_calls += 1
            compare(trace.get("forecastChanges"), changes, label + f"/day{day}/forecastChanges")
            require(trace.get("persistenceDays") == 1 and trace.get("forecastPolicy") == "current-capacity-persistence"
                    and trace.get("nominalOptimalityClaim") is False and trace.get("nominalInfeasibilityClaim") is False, f"{label}: forecast mislabeled nominal proof")
            require(trace["plannerStatus"] not in ("optimal", "infeasible"), f"{label}: forecast result promoted to nominal proof")
            if trace.get("forecastSubproblemStatus") == "infeasible":
                require(trace["plannerStatus"] == "no_feasible_schedule_found", f"{label}: conservative subproblem infeasibility promoted")
            require(ledger.finite(trace.get("forecastWallMs")) and trace["forecastWallMs"] >= 0 and trace.get("wholeCallBudgetMs") == 200, f"{label}: missing forecast budget accounting")
        require(ledger.finite(trace["callWallMs"]) and trace["callWallMs"] >= 0, f"{label}: invalid call wall time")
        call_walls.append(trace["callWallMs"])
        require(trace["plannerStatus"] == entry.get("plannerStatus"), f"{label}: trace/coordinator planner status differs")
        source = trace.get("candidateSource")
        cached_valid = previous is not None and ledger.feasible_dates(planning, list(previous.values()), fixed, day)
        if method == "dailyReoptV4":
            require(source == "daily_solver", f"{label}: daily method substituted another policy")
            solver_calls += 1
        elif method == "stableRetainV5":
            expected_source = "retained_plan" if cached_valid else "solver_replan" if previous is not None else "solver_initial"
            require(source == expected_source, f"{label}: stable trigger violated")
            if cached_valid:
                reused += 1
            else:
                solver_calls += 1
                replans += previous is not None
        else:
            stages = trace.get("stages", {})
            require(isinstance(stages, dict), f"{label}: recovery stages absent")
            if previous is not None:
                cache = stages.get("cacheAudit")
                require(isinstance(cache, dict) and cache.get("valid") == cached_valid, f"{label}: recovery cache audit differs from independent current constraints")
                if not cached_valid:
                    replans += 1
                if cache.get("rows"):
                    priced += price_rows(planning, cache["rows"], label + f"/day{day}/cachePrices")
                    compare([{key: row[key] for key in ("id", *ledger.EVENTS)} for row in cache["rows"]], list(previous.values()), label + f"/day{day}/cached dates")
            if source == "retained_plan":
                require(cached_valid and not call_stage(stages.get("locked_constructor")) and not call_stage(stages.get("locked_milp")), f"{label}: retained plan invoked fresh stages")
                reused += 1
            else:
                constructor_calls += int(call_stage(stages.get("locked_constructor")))
                solver_calls += int(call_stage(stages.get("locked_milp")))
                require(source in ("locked_constructor", "locked_milp", "cached_incumbent", "no_complete_plan"), f"{label}: undeclared recovery source")
                if source in ("locked_constructor", "locked_milp"):
                    require(stages[source].get("audit", {}).get("valid") is True and stages[source]["status"] in ("feasible", "optimal"), f"{label}: unaudited recovery source")
        expected_counts = {"decisionCalls": day + 1, "solverCalls": solver_calls, "constructorCalls": constructor_calls, "reusedPlans": reused, "replannedDueToInvalid": replans}
        for key, value in expected_counts.items():
            compare(trace.get(key), value, label + f"/day{day}/" + key)
        decisions, executed = entry["decisions"], entry["executedEvents"]
        if entry["status"] == "executed":
            require(entry.get("audit", {}).get("scheduleAudit", {}).get("valid") is True and entry.get("audit", {}).get("freezeAudit", {}).get("valid") is True, f"{label}: executed an unaudited candidate")
            checked = ledger.audit_dates(observation, decisions, label + f"/day{day}", fixed, day)
            ledger.audit_dates(planning, decisions, label + f"/day{day}/planningForecast", fixed, day)
            if source == "retained_plan":
                compare(checked["byId"], previous, label + f"/day{day}/retained dates")
            expected_actions = [{"id": row["id"], "event": ledger.EVENT_NAMES[key], "day": day} for row in decisions for key in ledger.EVENTS if row[key] == day]
            compare(executed, expected_actions, label + f"/day{day}/execution")
            changes = [{"id": row["id"], "event": ledger.EVENT_NAMES[key], "previousDay": previous[row["id"]][key], "newDay": row[key]}
                       for row in decisions for key in ledger.EVENTS if previous is not None and key not in fixed.get(row["id"], {}) and previous[row["id"]][key] != row[key]]
            compare(entry.get("revisions"), changes, label + f"/day{day}/revisions")
            revisions += len(changes)
            for action in executed:
                field = ledger.EVENT_FIELDS[action["event"]]
                require(field not in fixed.get(action["id"], {}), f"{label}: repeated physical event")
                fixed.setdefault(action["id"], {})[field] = day
            previous = checked["byId"]
            accepted += 1
        else:
            require(day == len(timeline) - 1 and not executed, f"{label}: failed planning executed actions or continued")
        compare(entry["revisionCount"], revisions, label + f"/day{day}/revision count")
        compare(entry["state"], ledger.execution_state(nominal, fixed, day if entry["status"] == "executed" else day - 1), label + f"/day{day}/state")
        executed_all.extend(executed)
    compare(result["revisionCount"], revisions, label + "/total revisions")
    compare(result["executedEvents"], executed_all, label + "/all physical actions")
    compare(result["finalState"], timeline[-1]["state"], label + "/final state")
    stats = result["plannerStats"]
    for key, expected in expected_counts.items():
        compare(stats.get(key), expected, label + "/final " + key)
    compare(stats["callWallMs"], call_walls, label + "/call walls")
    ledger.close(stats["planningWallMs"], sum(call_walls), label + "/planning wall sum")
    ledger.close(stats["maxCallWallMs"], max(call_walls, default=0), label + "/max call wall")
    require(result["runtimeMs"] + 1e-6 >= stats["planningWallMs"], f"{label}: planning time exceeds episode runtime")
    if result["complete"]:
        require(result["status"] == "feasible" and result["auditValid"] and result["failure"] is None and result["executionThroughDay"] == len(timeline) - 1, f"{label}: incomplete execution promoted")
        require(result["terminalAudit"]["engine"]["valid"] is True and result["terminalAudit"]["engine"].get("errors") == [] and result["terminalAudit"]["independentErrors"] == [] and result["auditErrors"] == [], f"{label}: terminal dual audit contradicts success")
        ledger.audit_schedule(actual, result, label + "/terminal fees/resources")
        priced += len(result["rows"])
        for row in result["rows"]:
            require(all(row[key] == fixed.get(row["id"], {}).get(key) for key in ledger.EVENTS), f"{label}: terminal dates differ from physical history")
    else:
        require(not result["auditValid"] and result["status"] in ("rolling_failed", "audit_failed"), f"{label}: failed episode mislabeled")
        if result["status"] == "rolling_failed":
            require(result["failure"]["day"] == len(timeline) - 1, f"{label}: incorrect failure cutoff")
    return {"complete": result["complete"], "historyAvailable": True, "timelineEntries": len(timeline), "pricedRows": priced, "acceptedPlans": accepted,
            "forecastCalls": forecast_calls, "revisions": revisions, "solverCalls": solver_calls, "constructorCalls": constructor_calls, "reusedPlans": reused}


def initial_comparison(case):
    plans = {}
    for method in METHODS:
        result = case["policies"][method]
        timeline = result["timeline"]
        if (result["executionHistoryUnavailable"] or not timeline or timeline[0]["day"] != 0 or timeline[0]["status"] != "executed"
                or timeline[0].get("audit", {}).get("scheduleAudit", {}).get("valid") is not True
                or timeline[0].get("audit", {}).get("freezeAudit", {}).get("valid") is not True):
            plans[method] = None
        else:
            entry = timeline[0]
            observed, _ = ledger.observed_snapshot(case["nominalScenario"], case["scenario"], case["events"], 0)
            try:
                ledger.audit_dates(observed, entry["decisions"], case["id"] + "/initial " + method)
            except (ValueError, KeyError, TypeError, IndexError):
                plans[method] = None
            else:
                plans[method] = {"dates": sorted(entry["decisions"], key=lambda row: row["id"]), "hash": entry["observationHash"]}
    pairs = {}
    for a, baseline in enumerate(METHODS):
        for candidate in METHODS[a + 1:]:
            left, right = plans[baseline], plans[candidate]
            information_equal = bool(left and right and left["hash"] and left["hash"] == right["hash"])
            pairs[baseline + "__" + candidate] = {"baselineMethod": baseline, "candidateMethod": candidate,
                "evaluated": bool(left and right and information_equal), "informationEqual": information_equal if left and right else None,
                "decisionsEqual": left["dates"] == right["dates"] if left and right and information_equal else None}
    eligible = [method for method in METHODS if plans[method]]
    return {"eligibleMethods": eligible, "allMethodsEligible": len(eligible) == 4,
            "allEqual": all(pair["decisionsEqual"] for pair in pairs.values()) if len(eligible) == 4 and all(pair["evaluated"] for pair in pairs.values()) else None, "pairs": pairs}


def finite_summary(values):
    values = sorted(value for value in values if ledger.finite(value))
    return {"observedCount": len(values), "sum": sum(values), **ledger.timing(values)}


def complete(result):
    return result["complete"] and result["auditValid"] and result["status"] in ("feasible", "optimal") and bool(result["rows"])


def comparison(cases, baseline, candidate):
    pairs = [case for case in cases if complete(case["policies"][baseline]) and complete(case["policies"][candidate])]
    def total(method, key):
        return sum(case["policies"][method][key] for case in pairs)
    def stat(method, key):
        values = [case["policies"][method]["plannerStats"].get(key) for case in pairs]
        return sum(values) if all(ledger.finite(value) for value in values) else None
    old_total, new_total = total(baseline, "totalCost"), total(candidate, "totalCost")
    old_inc, new_inc = total(baseline, "incrementalCost"), total(candidate, "incrementalCost")
    old_changes, new_changes = total(baseline, "revisionCount"), total(candidate, "revisionCount")
    gained = [case for case in cases if complete(case["policies"][candidate]) and not complete(case["policies"][baseline])]
    return {"baselineMethod": baseline, "candidateMethod": candidate, "caseCount": len(cases), "pairedCaseCount": len(pairs),
        "missingBaselineCount": sum(not complete(case["policies"][baseline]) for case in cases), "missingCandidateCount": sum(not complete(case["policies"][candidate]) for case in cases),
        "baselineTotalKRW": old_total, "candidateTotalKRW": new_total, "totalSavingsKRW": old_total - new_total,
        "weightedTotalSavingsPct": 100 * (old_total - new_total) / old_total if old_total else None,
        "baselineIncrementalKRW": old_inc, "candidateIncrementalKRW": new_inc, "incrementalSavingsKRW": old_inc - new_inc,
        "weightedIncrementalSavingsPct": 100 * (old_inc - new_inc) / old_inc if old_inc else None,
        "zeroBaselineTotalCount": sum(case["policies"][baseline]["totalCost"] == 0 for case in pairs), "zeroBaselineIncrementalCount": sum(case["policies"][baseline]["incrementalCost"] == 0 for case in pairs),
        "positiveSavingsCount": sum(case["policies"][baseline]["totalCost"] - case["policies"][candidate]["totalCost"] > 1e-6 for case in pairs),
        "tiedCount": sum(abs(case["policies"][baseline]["totalCost"] - case["policies"][candidate]["totalCost"]) <= 1e-6 for case in pairs),
        "negativeSavingsCount": sum(case["policies"][baseline]["totalCost"] - case["policies"][candidate]["totalCost"] < -1e-6 for case in pairs),
        "worstLossKRW": max([0] + [case["policies"][candidate]["totalCost"] - case["policies"][baseline]["totalCost"] for case in pairs]),
        "baselineRevisionCount": old_changes, "candidateRevisionCount": new_changes,
        "revisionReductionPct": 100 * (old_changes - new_changes) / old_changes if old_changes else None,
        "baselineSolverCalls": stat(baseline, "solverCalls"), "candidateSolverCalls": stat(candidate, "solverCalls"),
        "baselineDecisionCalls": stat(baseline, "decisionCalls"), "candidateDecisionCalls": stat(candidate, "decisionCalls"),
        "gainedCompletionCaseIds": [case["id"] for case in gained],
        "lostCompletionCaseIds": [case["id"] for case in cases if complete(case["policies"][baseline]) and not complete(case["policies"][candidate])],
        "gainedFromKnownFailureCaseIds": [case["id"] for case in gained if not case["policies"][baseline]["executionHistoryUnavailable"]],
        "gainedFromUnavailableHistoryCaseIds": [case["id"] for case in gained if case["policies"][baseline]["executionHistoryUnavailable"]],
        "completionComparisonInterpretation": "Differences count timely delivered complete episodes. An unavailable baseline history is not proof of physical execution failure.",
        "negativeSavingsCaseIds": [case["id"] for case in pairs if case["policies"][candidate]["totalCost"] > case["policies"][baseline]["totalCost"] + 1e-6]}


def summary(cases):
    by_method = {}
    for method in METHODS:
        results = [case["policies"][method] for case in cases]
        known = [result for result in results if not result["executionHistoryUnavailable"]]
        statuses = {}
        for result in results:
            statuses[result["status"]] = statuses.get(result["status"], 0) + 1
        def observed(values):
            finite = [value for value in values if ledger.finite(value)]
            return {"observedSum": sum(finite), "knownEpisodeCount": len(finite), "unknownEpisodeCount": len(results) - len(finite)}
        by_method[method] = {"caseCount": len(results), "completeCount": sum(complete(result) for result in results), "failureCount": sum(not complete(result) for result in results),
            "knownExecutionFailureCount": sum(not complete(result) for result in known), "executionHistoryUnavailableCount": len(results) - len(known),
            "undeliveredEpisodeCount": sum(not result["outputDeliveredWithinBudget"] for result in results), "hardDeadlineCount": sum(result["deadlineReached"] for result in results),
            "auditFailureCount": sum(result["status"] == "audit_failed" for result in results), "statuses": statuses,
            "observedRevisionCount": observed([result["revisionCount"] for result in known]),
            "counters": {key: observed([result["plannerStats"].get(key) for result in known]) for key in COUNTERS},
            "callWallMs": finite_summary([value for result in known for value in result["plannerStats"].get("callWallMs", [])]),
            "wallTimeMs": finite_summary([result["wallTimeMs"] for result in results]), "processExitWallTimeMs": finite_summary([result["processExitWallTimeMs"] for result in results])}
    equality = {}
    for case in cases:
        for key, pair in case["initialComparison"]["pairs"].items():
            totals = equality.setdefault(key, {"evaluatedCaseCount": 0, "equalCaseCount": 0, "differentCaseCount": 0, "unavailableCaseCount": 0})
            if not pair["evaluated"]:
                totals["unavailableCaseCount"] += 1
            else:
                totals["evaluatedCaseCount"] += 1
                totals["equalCaseCount" if pair["decisionsEqual"] else "differentCaseCount"] += 1
    return {"caseCount": len(cases), "byMethod": by_method,
        "comparisons": {"lockedVsStable": comparison(cases, "stableRetainV5", "lockedRecoveryV6"), "persistenceVsStable": comparison(cases, "stableRetainV5", "persistenceRecoveryV6"),
                        "persistenceVsLocked": comparison(cases, "lockedRecoveryV6", "persistenceRecoveryV6"), "stableVsDaily": comparison(cases, "dailyReoptV4", "stableRetainV5")},
        "byScale": {str(count): {"caseCount": sum(case["count"] == count for case in cases), "completeCounts": {method: sum(case["count"] == count and complete(case["policies"][method]) for case in cases) for method in METHODS}} for count in sorted({case["count"] for case in cases})},
        "initialEquality": {"allMethodsEvaluatedCount": sum(case["initialComparison"]["allMethodsEligible"] and case["initialComparison"]["allEqual"] is not None for case in cases),
                            "allMethodsEqualCount": sum(case["initialComparison"]["allEqual"] is True for case in cases), "pairs": equality},
        "terminalAudit": {"completeEpisodes": sum(complete(result) for case in cases for result in case["policies"].values()),
                          "failedAudits": sum(result["status"] == "audit_failed" for case in cases for result in case["policies"].values())}}


def review(root=ROOT, *, fixture=False, expected_protocol_hash=PROTOCOL_HASH, expected_archive_hash=ARCHIVE_HASH):
    root = Path(root)
    started = time.perf_counter()
    paths = {"archive": root / "data/rolling-v6.json", "protocol": root / "data/protocol-v6.json", "development": root / "data/rolling-v5.json"}
    hashes = {name: digest(path) for name, path in paths.items()}
    require(hashes["archive"] == expected_archive_hash and hashes["protocol"] == expected_protocol_hash, "Immutable raw/protocol hash mismatch")
    archive, protocol, prior = (ledger.read_json(paths[name]) for name in ("archive", "protocol", "development"))
    require(archive["executionState"] == "complete" and archive["protocolHash"] == hashes["protocol"] and archive["protocol"] == protocol, "Incomplete archive/protocol binding mismatch")
    require(protocol["methods"] == list(METHODS) and protocol["budget"]["hardWallMs"] == 5000, "Declared four methods/common budget changed")
    primary, controls = archive["cases"], archive["developmentControls"]["cases"]
    require([case["id"] for case in primary] == [case["id"] for case in protocol["primaryCases"]], "Primary case order/coverage changed")
    development = protocol["developmentControls"]
    require(hashes["development"] == development["inputArchiveSha256"] and [case["id"] for case in prior["cases"]] == development["caseIds"], "Development source/order binding changed")
    require([case["referenceCaseId"] for case in controls] == development["caseIds"], "Development controls omitted/reordered")
    if not fixture:
        require(len(primary) == 36 and len(controls) == 24 and len({case["seed"] for case in protocol["primaryCases"]}) == 36, "Frozen 36+24 matrix changed")
    snapshot = root / "vendor/experiments/v6-first-run-source"
    manifest = ledger.read_json(snapshot / "manifest.json")
    require(manifest["capturedBeforePrimaryGeneration"] is True and manifest["protocolHash"] == hashes["protocol"] and manifest["implementationHashes"] == archive["implementationHashes"], "First-run manifest/source hash mismatch")
    source_checks = ledger.source_binding(root, archive, "v6-first-run-source")
    for check in source_checks:
        require(check["currentMatchesFirstRun"] or check["path"] in PACKAGING, "Current runtime changed from frozen experiment: " + check["path"])
        check["differenceClassification"] = "release_packaging_version_and_commands" if not check["currentMatchesFirstRun"] else "matches_first_run"
        if not check["currentMatchesFirstRun"]:
            old_package, current_package = ledger.read_json(snapshot / check["path"]), ledger.read_json(root / check["path"])
            check["versionFrom"], check["versionTo"] = old_package.get("version"), current_package.get("version")
            old_package.pop("version", None); current_package.pop("version", None)
            if check["path"] == "package-lock.json":
                old_package["packages"][""].pop("version", None); current_package["packages"][""].pop("version", None)
            else:
                additions = set(current_package["scripts"]) - set(old_package["scripts"])
                require(additions <= {"rolling:v6", "verify:v6", "defense:v6", "view:v6"}, "Undeclared package command added")
                check["addedReleaseCommands"] = sorted(additions)
                for command in additions:
                    current_package["scripts"].pop(command)
            compare(current_package, old_package, "Packaging dependencies/unchanged scripts: " + check["path"])
    cases, counts = [], {"episodes": 0, "completeEpisodes": 0, "knownFailureEpisodes": 0, "unavailableHistoryEpisodes": 0, "timelineEntries": 0, "acceptedPlans": 0, "pricedRows": 0, "forecastCalls": 0}
    prior_by_id = {case["id"]: case for case in prior["cases"]}
    configs = protocol["primaryCases"] + controls
    for index, case in enumerate(primary + controls):
        require(set(case["policies"]) == set(METHODS), "Omitted V6 method")
        compare(case["methodExecutionOrder"], [METHODS[(index + offset) % 4] for offset in range(4)], case["id"] + "/method rotation")
        if index < len(primary):
            config = protocol["primaryCases"][index]
            for key, value in config.items():
                compare(case.get(key), value, case["id"] + "/config " + key)
            require(case["dataRole"] == "held-out-primary", "Primary incorrectly relabeled development")
            if not fixture:
                compare(case["nominalScenario"], ledger.generated_scenario(config, protocol), case["id"] + "/independent generator")
            events = []
            for shock in config["shocks"]:
                capacity = ledger.capacity(case["nominalScenario"], shock["resource"], shock["revealDay"])
                event = {key: value for key, value in shock.items() if key not in ("reductionNumerator", "reductionDenominator")}
                event["capacity"] = max(0, capacity - math.ceil(capacity * shock["reductionNumerator"] / shock["reductionDenominator"]))
                events.append(event)
            compare(case["events"], events, case["id"] + "/declared shocks")
        else:
            reference = prior_by_id[case["referenceCaseId"]]
            require(case["id"] == reference["id"] + development["suffix"] and case["dataRole"] == "development-control", "Development identity relabeled as holdout")
            compare(case["nominalScenario"], reference["nominalScenario"], case["id"] + "/same development orders")
            compare(case["events"], reference["events"], case["id"] + "/same development events")
            for key in ("count", "seed", "mechanism", "capacityProfile", "repeat"):
                compare(case[key], reference[key], case["id"] + "/development " + key)
        ledger.validate_scenario(case["nominalScenario"], case["id"])
        require(not any("announcedDuration" in event for event in case["events"]), "Private shock duration publicly announced")
        compare(case["scenario"], ledger.realize(case["nominalScenario"], case["events"]), case["id"] + "/realization")
        methods = {}
        for method in METHODS:
            checked = audit_episode(case, case["policies"][method], method, protocol)
            methods[method] = checked
            counts["episodes"] += 1
            counts["completeEpisodes"] += checked["complete"]
            counts["knownFailureEpisodes"] += checked["historyAvailable"] and not checked["complete"]
            counts["unavailableHistoryEpisodes"] += not checked["historyAvailable"]
            for key in ("timelineEntries", "acceptedPlans", "pricedRows", "forecastCalls"):
                counts[key] += checked[key]
        equality = initial_comparison(case)
        compare({key: value for key, value in case["initialComparison"].items() if key != "interpretation"}, equality, case["id"] + "/initial full-candidate comparison")
        cases.append({"id": case["id"], "dataRole": case["dataRole"], "methods": methods, "initialComparison": equality})
    primary_summary, control_summary = summary(primary), summary(controls)
    compare(archive["summary"], primary_summary, "primary summary")
    compare(archive["developmentControls"]["summary"], control_summary, "development summary")
    require(hashes == {name: digest(path) for name, path in paths.items()}, "Read-only review changed original evidence")
    return {"schemaVersion": SCHEMA, "valid": True, "fixture": fixture, "readOnly": True, "solverRuns": 0, "importsJavaScript": False,
        "scope": "Internal second implementation of daily fee/resource/causal execution ledgers, declared conservative forecasts, clocks and accounting; no independent reproof of solver optimality/infeasibility, external operational certification or ranking guarantee",
        "inputHashes": {str(paths[name].relative_to(root)): value for name, value in hashes.items()},
        "reviewImplementationSha256": digest(Path(__file__)), "independentFeeAuditSha256": digest(ROOT / "scripts/review-v5.py"),
        "snapshotManifestSha256": digest(snapshot / "manifest.json"), "sourceHashes": source_checks,
        "summary": {"primaryCaseCount": len(primary), "developmentControlCaseCount": len(controls), "developmentControlsAreNewIndependentSamples": False, **counts,
                    "feesAbsoluteTolerance": 1e-6, "wallSeconds": time.perf_counter() - started},
        "primaryRecomputedSummary": primary_summary, "developmentRecomputedSummary": control_summary, "cases": cases}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=ROOT)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--fixture", action="store_true")
    parser.add_argument("--expected-protocol-hash", default=PROTOCOL_HASH)
    parser.add_argument("--expected-archive-hash", default=ARCHIVE_HASH)
    args = parser.parse_args(argv)
    if not args.fixture and (args.expected_protocol_hash != PROTOCOL_HASH or args.expected_archive_hash != ARCHIVE_HASH):
        parser.error("Custom frozen hashes require explicit fixture scope")
    try:
        restored = False
        # Git carries exact ordered chunks. Only the CLI may materialize a
        # missing canonical archive; importable review(root) remains read-only.
        if not args.fixture and not (args.root / "data/rolling-v6.json").exists():
            restore_path = args.root / "scripts/restore-evidence-v6.py"
            restore_spec = importlib.util.spec_from_file_location("v6_cli_evidence_restore", restore_path)
            restore_module = importlib.util.module_from_spec(restore_spec)
            restore_spec.loader.exec_module(restore_module)
            restored = restore_module.ensure_evidence(args.root)["restored"]
        report = review(args.root, fixture=args.fixture, expected_protocol_hash=args.expected_protocol_hash, expected_archive_hash=args.expected_archive_hash)
        transport_path = args.root / "data/archives-v6/rolling-v6/manifest.json"
        if not args.fixture and transport_path.exists():
            transport = json.loads(transport_path.read_text(encoding="utf-8"))
            require(transport["artifact"] == "data/rolling-v6.json" and transport["sha256"] == ARCHIVE_HASH
                    and transport["bytes"] == (args.root / "data/rolling-v6.json").stat().st_size, "Git transport does not declare the frozen canonical archive")
            report["cliEvidenceBootstrap"] = {"canonicalArchiveRestoredBeforeReadOnlyReview": restored,
                "existingEvidenceReplaced": False, "transportEncoding": "ordered lossless byte chunks",
                "transportManifestPath": "data/archives-v6/rolling-v6/manifest.json",
                "transportManifestSha256": digest(transport_path), "transportPartCount": len(transport["parts"]),
                "canonicalBytes": transport["bytes"], "canonicalSha256": ARCHIVE_HASH,
                "restoreImplementationSha256": digest(args.root / "scripts/restore-evidence-v6.py"),
                "scope": "Canonical full byte stream audited against frozen hash; per-chunk reconstruction checks belong to restore-evidence-v6.py; release ZIP retains original full JSON"}
        if args.output:
            require(args.output.resolve() not in {(args.root / "data" / name).resolve() for name in ("rolling-v6.json", "protocol-v6.json", "rolling-v5.json")}, "Refusing to overwrite source archives")
            args.output.parent.mkdir(parents=True, exist_ok=True)
            args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2, allow_nan=False) + "\n", encoding="utf-8")
            print(json.dumps({"valid": True, "summary": report["summary"], "output": str(args.output)}, ensure_ascii=False))
        else:
            print(json.dumps(report, ensure_ascii=False, indent=2, allow_nan=False))
    except (OSError, ValueError, KeyError, TypeError, IndexError, AssertionError, ImportError) as error:
        print(json.dumps({"schemaVersion": SCHEMA, "valid": False, "readOnly": True, "solverRuns": 0, "error": str(error)}, ensure_ascii=False))
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
