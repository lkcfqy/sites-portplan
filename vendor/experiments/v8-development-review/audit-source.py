#!/usr/bin/env python3
"""Read-only Python reproduction of the V8 development mechanism audit.

Does not import JavaScript, construct a solver matrix, or call a solver.
Output is exclusive; preserve previous audit evidence when reproducing.
"""
import argparse
import hashlib
import importlib.util
import json
import math
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DIRECTORY = Path(__file__).resolve().parent


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def review():
    spec = importlib.util.spec_from_file_location("native", ROOT / "scripts/diagnose-failures-v6.py")
    native = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(native)
    ledger = native.ledger
    path = DIRECTORY / "results.json"
    report = json.loads(path.read_text())
    protocol_path = ROOT / "data/mechanism-protocol-v8.json"
    protocol = json.loads(protocol_path.read_text())
    assert report["executionState"] == "complete" and report["protocolHash"] == digest(protocol_path)
    for name, expected in {**report["inputHashes"], **report["implementationHashes"]}.items():
        assert digest(ROOT / name) == expected, "Changed input/runtime: " + name
    archive = json.loads((ROOT / "data/rolling-v7.json").read_text())
    by_case = {case["id"]: case for case in archive["cases"]}
    tasks = report["taskInputs"]
    by_task = {task["taskId"]: task for task in tasks}
    sha = lambda value: "sha256:" + hashlib.sha256(native.canonical(value).encode()).hexdigest()
    assert len(tasks) == len(by_task) == 28 and len({task["snapshotHash"] for task in tasks}) == 28
    for task in tasks:
        case, day = by_case[task["sourceCaseId"]], task["minEventDay"]
        timeline = case["policies"][task["sourceMethod"]]["timeline"]
        fixed = {}
        for entry in timeline[:day]:
            for event in entry["executedEvents"]:
                field = native.EVENT_FIELDS[event["event"]]
                assert field not in fixed.get(event["id"], {})
                fixed.setdefault(event["id"], {})[field] = event["day"]
        observed, events = ledger.observed_snapshot(case["nominalScenario"], case["scenario"], case["events"], day)
        previous = [{key: row[key] for key in ("id", *native.EVENTS)} for row in timeline[day - 1]["decisions"]] if day else None
        assert task["scenario"] == observed and task["observedEvents"] == events
        assert task["fixedEvents"] == fixed and task["previousDates"] == previous
        payload = {"scenario": observed, "observedEvents": events, "fixedEvents": fixed, "minEventDay": day}
        assert ledger.checksum(payload, timeline[day]["observationHash"]) == task["originalObservationHash"]
        assert task["snapshotHash"] == sha({**payload, "previousDates": previous})
        assert task["executedEventCount"] == sum(map(len, fixed.values()))
    expected_jobs = []
    methods = protocol["methods"]
    for task_index, task in enumerate(tasks):
        for budget_index, budget in enumerate(task["budgetsMs"]):
            for seed_index, seed in enumerate(protocol["algorithmSeeds"]):
                rotation = (task_index + budget_index + seed_index) % 4
                for offset in range(4):
                    expected_jobs.append((task["taskId"], methods[(rotation + offset) % 4], budget, seed, False, task["panel"]))
    for task in tasks:
        if task["panel"] == "observed-feasible-misses":
            for budget in (200, 1000):
                expected_jobs.append((task["taskId"], "alwaysRebuildV7", budget, task["sourceSeed"], True, "original-seed-budget-probe"))
    results = report["results"]
    assert len(results) == len(expected_jobs) == report["plannedJobCount"] == 392
    raw_audited = timely = 0
    for result, expected in zip(results, expected_jobs):
        assert tuple(result[key] for key in ("taskId", "method", "budgetMs", "seed", "probe", "panel")) == expected
        task = by_task[result["taskId"]]
        scenario, fixed, day = task["scenario"], task["fixedEvents"], task["minEventDay"]
        returned = result["rawReturnedResult"]
        assert result["inputHash"] == sha({"scenario": scenario, "fixedEvents": fixed, "minEventDay": day, "previousDates": task["previousDates"]})
        assert result["snapshotHash"] == task["snapshotHash"] and result["sourceExecutedEventCount"] == task["executedEventCount"]
        valid = returned.get("status") in ("optimal", "feasible")
        if valid:
            ledger.audit_schedule(scenario, returned, result["taskId"])
            ledger.audit_dates(scenario, returned["rows"], result["taskId"], fixed, day)
            raw_audited += 1
        assert result["audit"]["valid"] == result["returnedCompleteAudited"] == valid
        assert math.isfinite(result["wallTimeMs"]) and result["wallTimeMs"] >= result["methodReturnedMs"] >= 0
        assert abs(result["deadlineOverrunMs"] - max(0, result["wallTimeMs"] - result["budgetMs"])) < 1e-8
        accepted = valid and result["wallTimeMs"] <= result["budgetMs"]
        assert result["completeSnapshot"] == result["acceptedWithinBudget"] == accepted
        if not accepted:
            assert result["totalCost"] is result["incrementalCost"] is None and result["rows"] == [] and result["changes"] is None
            assert result["status"] == ("late_complete_snapshot" if valid else "no_complete_snapshot")
            continue
        timely += 1
        assert result["status"] == "timely_complete_snapshot"
        assert result["totalCost"] == returned["totalCost"] and result["incrementalCost"] == returned["incrementalCost"]
        assert result["rows"] == [{key: row[key] for key in ("id", *native.EVENTS)} for row in returned["rows"]]
        if task["previousDates"] is None:
            assert result["changes"] == {"referenceAvailable": False, "changedEventCount": None, "nearTermChangedEventCount": None, "totalShiftDays": None}
        else:
            old = {row["id"]: row for row in task["previousDates"]}
            changed = near = shift = pending = 0
            for row in result["rows"]:
                for key in native.EVENTS:
                    if key in fixed.get(row["id"], {}):
                        continue
                    pending += 1
                    prior = old[row["id"]][key]
                    if prior != row[key]:
                        changed += 1
                        shift += abs(prior - row[key])
                        near += prior <= day + 1
            assert result["changes"] == {"referenceAvailable": True, "pendingEventCount": pending, "changedEventCount": changed,
                                          "nearTermChangedEventCount": near, "totalShiftDays": shift}
    for panel, summary in report["summary"]["panelSummaries"].items():
        group = [result for result in results if not result["probe"] and result["panel"] + "-" + str(result["budgetMs"]) + "ms" == panel]
        for method, record in summary["methods"].items():
            rows = [result for result in group if result["method"] == method]
            success = [result for result in rows if result["completeSnapshot"]]
            assert record["taskSeedRunCount"] == len(rows) and record["timelyCompleteCount"] == len(success)
            assert record["statuses"] == dict(Counter(result["status"] for result in rows))
            assert record["changedEventCountOnTimelyResults"] == sum((result["changes"] or {}).get("changedEventCount") or 0 for result in success)
        for method, record in summary["adaptiveVs"].items():
            left = {(result["taskId"], result["seed"]): result for result in group if result["method"] == method}
            right = [result for result in group if result["method"] == "adaptiveV8"]
            joint = [(left[(result["taskId"], result["seed"])], result) for result in right
                     if result["completeSnapshot"] and left[(result["taskId"], result["seed"])]["completeSnapshot"]]
            assert record["jointTimelyRunCount"] == len(joint)
            assert record["gainedTimely"] == sum(result["completeSnapshot"] and not left[(result["taskId"], result["seed"])]["completeSnapshot"] for result in right)
            assert record["lostTimely"] == sum(not result["completeSnapshot"] and left[(result["taskId"], result["seed"])]["completeSnapshot"] for result in right)
            assert record["higherFeeCount"] == sum(b["totalCost"] > a["totalCost"] for a, b in joint)
            assert record["equalFeeCount"] == sum(b["totalCost"] == a["totalCost"] for a, b in joint)
            assert record["lowerFeeCount"] == sum(b["totalCost"] < a["totalCost"] for a, b in joint)
            assert record["snapshotTotalFeeDifferenceKRW"] == sum(b["totalCost"] - a["totalCost"] for a, b in joint)
            assert record["baselineChangedEvents"] == sum((a["changes"] or {}).get("changedEventCount") or 0 for a, b in joint)
            assert record["adaptiveChangedEvents"] == sum((b["changes"] or {}).get("changedEventCount") or 0 for a, b in joint)
    for pair in report["summary"]["originalSeedBudgetPairs"]:
        probe = [result for result in results if result["probe"] and result["taskId"] == pair["taskId"]]
        a, b = probe
        assert (a["budgetMs"], b["budgetMs"]) == (200, 1000) and a["seed"] == b["seed"] == pair["seed"]
        assert pair["at200ms"] == a["status"] and pair["at1000ms"] == b["status"]
        assert pair["foundOnlyWith1000ms"] == (not a["completeSnapshot"] and b["completeSnapshot"])
    return {"schemaVersion": "portplan-independent-python-mechanism-review-v8", "valid": True,
            "readOnlySources": True, "solverCalls": 0, "importsJavaScript": False, "resultSHA256": digest(path),
            "protocolSHA256": report["protocolHash"], "reviewImplementationSHA256": digest(Path(__file__)),
            "inputHashes": report["inputHashes"], "implementationHashes": report["implementationHashes"],
            "taskCount": len(tasks), "distinctSnapshotCount": len({task["snapshotHash"] for task in tasks}),
            "resultCount": len(results), "rawCompleteSchedulesAudited": raw_audited, "timelyCompleteSnapshotCount": timely,
            "lateCompleteSnapshotCount": sum(result["status"] == "late_complete_snapshot" for result in results),
            "scope": "Internal independent Python review of development warm-snapshot inputs, all schedules, deadlines, revisions and paired summaries; not cold full episodes, third-party certification or a new holdout."}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=DIRECTORY / "audit-reproduction.json")
    arguments = parser.parse_args()
    result = review()
    with arguments.output.open("x") as handle:
        handle.write(json.dumps(result, indent=2) + "\n")
    print(json.dumps({"valid": True, "output": str(arguments.output), "resultCount": result["resultCount"]}))
