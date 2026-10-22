#!/usr/bin/env python3
"""Independent, standard-library audit of the seen-V10 V11 prefix replay.

Reads archived inputs and raw episode ledgers; never invokes a solver or JS.
Reuses only the independent Python V5 physical/price ledger. A passed review
establishes the recorded conditional replay, not an unseen-test policy result,
competition standing, or a guarantee that the slack bound ensures completion.
The output path is created exclusively and must not already exist.
"""

from __future__ import annotations

import argparse
import copy
import hashlib
import importlib.util
import json
import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
SOURCE_INDEX = ROOT / "data/evidence-v10/v10-frozen-first/first-run/complete.json"
SOURCE_INDEX_SHA256 = "33d07f60afb4b4248682badc631512a54070cca22fd106c7dd5062d4669bf9c2"
CASE_ID = "v10-stress-new-arrivals-tight-n24-r3"
SCHEMA = "portplan-commitment-replay-v11-development-v1"
REVIEW_SCHEMA = "portplan-commitment-replay-v11-independent-review-v1"
REPEATS = {1: 49011, 2: 49023, 3: 49039}
BRANCHES = ("retain_cache", "lower_m_candidate")
PREFIX_FIELDS = ("day", "observedEvents", "observationHash", "decisions",
                 "executedEvents", "state", "revisions", "revisionCount")
LEDGER_PATH = ROOT / "scripts/review-v5.py"
spec = importlib.util.spec_from_file_location("portplan_independent_v5_ledger", LEDGER_PATH)
ledger = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ledger)
require = ledger.require


def canonical(value):
    return ledger.stable_json(value)


def digest_value(value):
    return hashlib.sha256(canonical(value).encode("utf-8")).hexdigest()


def canonical_equal(left, right, label):
    require(canonical(left) == canonical(right), f"{label}: canonical JSON differs")


def repository_path(value):
    require(isinstance(value, str) and value, "Missing repository-relative path")
    path = Path(value)
    require(not path.is_absolute() and ".." not in path.parts, f"Unsafe repository path: {value}")
    resolved = (ROOT / path).resolve()
    require(resolved.is_relative_to(ROOT.resolve()), f"Repository path escapes through a symlink: {value}")
    return resolved


def artifact_path(run_dir, value):
    require(isinstance(value, str) and value, "Missing replay artifact path")
    path = Path(value)
    require(not path.is_absolute() and ".." not in path.parts, f"Unsafe replay artifact path: {value}")
    resolved = (run_dir / path).resolve()
    require(resolved.is_relative_to(run_dir), f"Replay artifact escapes through a symlink: {value}")
    return resolved


def checked_hash(path, expected, label):
    require(isinstance(expected, str) and re.fullmatch(r"[0-9a-f]{64}", expected), f"{label}: malformed SHA256")
    actual = ledger.sha256(path)
    require(actual == expected, f"{label}: SHA256 differs for {path}")
    return actual


def dates(rows):
    require(isinstance(rows, list), "Dates must be an array")
    return [{key: row[key] for key in ("id", *ledger.EVENTS)} for row in rows]


def prefix_projection(timeline, last_day=3):
    require(isinstance(timeline, list) and len(timeline) > last_day, "Missing complete recorded prefix")
    return [{field: entry[field] for field in PREFIX_FIELDS} for entry in timeline[:last_day + 1]]


def plan_fees(scenario, rows, mode="joint"):
    require(mode in ("joint", "storageOnly", "ddOnly"), "Unknown replay objective")
    containers = {container["id"]: container for container in scenario["containers"]}
    totals = {key: 0 for key in ledger.TOTAL_KEYS}
    objective = 0
    for row in rows:
        costs = ledger.reprice(scenario, containers[row["id"]], row["pickupDay"], row["returnDay"])
        for key in totals:
            totals[key] += costs[key]
        objective += (costs["incrementalCost"] if mode == "joint" else
                      costs["storageCost"] - costs["priorStorageCost"] if mode == "storageOnly" else
                      costs["ddCost"] - costs["priorDDCost"])
    return {**totals, "objectiveCost": objective}


def check_fees(recorded, expected, label):
    require(isinstance(recorded, dict), f"{label}: missing fees")
    for key, value in expected.items():
        ledger.close(recorded.get(key), value, f"{label}/{key}")


def physical_usage(scenario, fixed, day):
    """Usage from physical events alone, never unexecuted future decisions."""
    result = {resource: 0 for resource in ledger.RESOURCES}
    unit = {**ledger.OPERATIONS, **scenario.get("operations", {})}["stagingUnit"]
    for container in scenario["containers"]:
        events = fixed.get(container["id"], {})
        result["truck"] += int(events.get("pickupDay") == day) + int(events.get("returnDay") == day)
        unload = events.get("unloadDay")
        if unload is not None and unload <= day < unload + container["unloadDays"]:
            result["warehouse"] += 1
        pickup, returned = events.get("pickupDay"), events.get("returnDay")
        if pickup is not None and pickup <= day and (returned is None or day < returned):
            result["staging"] += container["sizeFt"] / 20 if unit == "teu" else 1
    return result


def old_fixed_before(source_result, day):
    fixed = {}
    for entry in source_result["timeline"][:day]:
        require(entry["status"] == "executed", "Historical replay prefix was not executed")
        for event in entry["executedEvents"]:
            field = ledger.EVENT_FIELDS[event["event"]]
            require(field not in fixed.get(event["id"], {}), "Repeated historical physical event")
            fixed.setdefault(event["id"], {})[field] = event["day"]
    return fixed


def audit_episode(case, source_envelope, replay_envelope, record):
    nominal, events = case["nominalScenario"], case["events"]
    ledger.validate_scenario(nominal, "nominal replay input")
    actual = ledger.realize(nominal, events)
    source = source_envelope["result"]
    result = replay_envelope["result"]
    timeline, traces = result.get("timeline"), result.get("plannerTrace")
    label = record["episodeId"]
    require(isinstance(timeline, list) and 5 <= len(timeline) <= nominal["horizonDays"], f"{label}: missing/overlong replay timeline")
    require(isinstance(traces, list) and len(traces) == len(timeline), f"{label}: missing replay per-call trace")
    old_prefix, new_prefix = prefix_projection(source["timeline"]), prefix_projection(timeline)
    canonical_equal(new_prefix, old_prefix, f"{label}/D0-D3 prefix")
    original_d4 = source["timeline"][4]
    for key in ("day", "observedEvents", "observationHash"):
        canonical_equal(timeline[4][key], original_d4[key], f"{label}/D4 input {key}")
    endpoint_key = "beforeDates" if record["branch"] == "retain_cache" else "proposalDates"
    selection = source["plannerTrace"][4]["stabilitySelection"]
    selected_endpoint = selection[endpoint_key]
    canonical_equal(dates(timeline[4]["decisions"]), dates(selected_endpoint), f"{label}/D4 endpoint")
    d4_source_fixed = old_fixed_before(source, 4)
    fixed, previous, revision_total, flattened = {}, None, 0, []
    per_day, independent_fees = [], []
    for day, (entry, trace) in enumerate(zip(timeline, traces)):
        require(entry.get("day") == day and trace.get("day") == day, f"{label}: nonconsecutive timeline/trace")
        observed, observations = ledger.observed_snapshot(nominal, actual, events, day)
        canonical_equal(entry.get("observedEvents"), observations, f"{label}/D{day} public observations")
        hashed = {"scenario": observed, "observedEvents": observations,
                  "fixedEvents": fixed, "minEventDay": day}
        require(ledger.checksum(hashed, entry.get("observationHash")) == entry["observationHash"],
                f"{label}/D{day}: independent causal observation hash mismatch")
        canonical_equal(trace.get("publicSnapshot"), observed, f"{label}/D{day} planner public snapshot")
        canonical_equal(trace.get("fixedEvents"), fixed, f"{label}/D{day} planner physical locks")
        if day == 4:
            canonical_equal(fixed, d4_source_fixed, f"{label}/D4 historical input locks")
        decisions, executed = entry.get("decisions"), entry.get("executedEvents")
        require(isinstance(decisions, list) and isinstance(executed, list), f"{label}/D{day}: malformed decisions/execution")
        require(ledger.finite(trace.get("callWallMs")) and trace["callWallMs"] >= 0,
                f"{label}/D{day}: missing/nonfinite call wall time")
        if entry.get("status") == "executed":
            require(entry.get("plannerStatus") in ("feasible", "optimal"), f"{label}/D{day}: executed unsuccessful plan")
            require([row["id"] for row in decisions] == [c["id"] for c in nominal["containers"]],
                    f"{label}/D{day}: decision order/coverage differs from source container order")
            audited = ledger.audit_dates(observed, decisions, f"{label}/D{day}", fixed, day)
            canonical_equal(dates(trace.get("selectedDates")), dates(decisions), f"{label}/D{day} trace selected dates")
            expected_execution = [{"id": row["id"], "event": ledger.EVENT_NAMES[field], "day": day}
                                  for row in decisions for field in ledger.EVENTS if row[field] == day]
            canonical_equal(executed, expected_execution, f"{label}/D{day} physical execution")
            changes = [{"id": row["id"], "event": ledger.EVENT_NAMES[field],
                        "previousDay": previous[row["id"]][field], "newDay": row[field]}
                       for row in decisions for field in ledger.EVENTS
                       if previous is not None and field not in fixed.get(row["id"], {})
                       and previous[row["id"]][field] != row[field]]
            canonical_equal(entry.get("revisions"), changes, f"{label}/D{day} revision identities")
            revision_total += len(changes)
            require(type(entry.get("revisionCount")) is int and entry["revisionCount"] == revision_total,
                    f"{label}/D{day}: revision count differs")
            for event in executed:
                field = ledger.EVENT_FIELDS[event["event"]]
                require(field not in fixed.get(event["id"], {}), f"{label}/D{day}: repeated physical event")
                fixed.setdefault(event["id"], {})[field] = day
            if all("returnDay" in fixed.get(container["id"], {}) for container in nominal["containers"]):
                require(result.get("complete") is True and day == len(timeline) - 1,
                        f"{label}/D{day}: runner continued or reported failure after every return")
            usage = physical_usage(nominal, fixed, day)
            for index, resource in enumerate(ledger.RESOURCES):
                ledger.close(usage[resource], audited["usage"][day][index], f"{label}/D{day}/{resource} physical vs decisions")
                require(usage[resource] <= ledger.capacity(actual, resource, day), f"{label}/D{day}: physical {resource} exceeds actual capacity")
            fees = plan_fees(observed, decisions, result.get("objectiveMode", "joint"))
            check_fees(trace.get("fees"), fees, f"{label}/D{day} trace fees")
            if day <= 3:
                check_fees(source["plannerTrace"][day]["stabilitySelection"]["afterFees"], fees,
                           f"{label}/D{day} historical selected fees")
            if day == 4:
                fee_key = "beforeFees" if record["branch"] == "retain_cache" else "proposalFees"
                check_fees(selection[fee_key], fees, f"{label}/D4 original endpoint fees")
                require(fees["objectiveCost"] == 0, f"{label}/D4: original zero-fee endpoint changed")
            independent_fees.append({"day": day, **fees})
            previous = audited["byId"]
            per_day.append({"day": day, "executedEventCount": len(executed), "physicalUsage": usage,
                            "actualCapacity": {r: ledger.capacity(actual, r, day) for r in ledger.RESOURCES},
                            "observationHash": entry["observationHash"], "fixedEventsAfterSHA256": digest_value(fixed)})
        else:
            require(day == len(timeline) - 1 and not executed, f"{label}: actions after failed planning")
            require(entry.get("revisionCount") == revision_total, f"{label}: failed day changed revision count")
            require(trace.get("selectedDates") in (None, []), f"{label}: failed day claims selected endpoint")
            require(trace.get("fees") is None or all(trace["fees"].get(k) is None for k in (*ledger.TOTAL_KEYS, "objectiveCost")),
                    f"{label}: failed day claims completed-plan fees")
        state_day = day if entry.get("status") == "executed" else day - 1
        canonical_equal(entry.get("state"), ledger.execution_state(nominal, fixed, state_day), f"{label}/D{day} physical state")
        flattened.extend(executed)
    require(result.get("revisionCount") == revision_total, f"{label}: final revision count differs")
    canonical_equal(result.get("executedEvents"), flattened, f"{label}/flattened physical events")
    canonical_equal(result.get("finalState"), timeline[-1]["state"], f"{label}/final state")
    require(type(result.get("complete")) is bool, f"{label}: missing completion flag")
    totals = ledger.audit_schedule(actual, result, f"{label}/actual final ledger")
    if result["complete"]:
        require(result.get("status") == "feasible" and result.get("failure") is None, f"{label}: inconsistent completion status")
        require(all(entry.get("status") == "executed" for entry in timeline), f"{label}: complete result contains a failed planning day")
        require(result.get("executionThroughDay") == len(timeline) - 1, f"{label}: wrong final cutoff")
        require(len(flattened) == 3 * len(nominal["containers"]), f"{label}: complete result lacks exactly 3N physical events")
        for row in result["rows"]:
            require(all(row[field] == fixed.get(row["id"], {}).get(field) for field in ledger.EVENTS),
                    f"{label}: final row differs from physical history")
    else:
        require(result.get("status") == "rolling_failed" and isinstance(result.get("failure"), dict), f"{label}: missing failed-prefix boundary")
        require(result["failure"].get("day") == len(timeline) - 1 and not result.get("rows"), f"{label}: failed result has final rows/wrong day")
        require(all(result.get(key) is None for key in (*ledger.TOTAL_KEYS, "objectiveCost")), f"{label}: failed prefix fabricated completion fees")
    return {"episodeId": label, "branch": record["branch"], "repeatIndex": record["repeatIndex"],
            "algorithmSeed": record["algorithmSeed"], "valid": True, "complete": result["complete"],
            "failure": result.get("failure"), "timelineEntries": len(timeline),
            "historicalPrefixCanonicalSHA256": digest_value(old_prefix),
            "replayedPrefixCanonicalSHA256": digest_value(new_prefix),
            "d4ObservationHash": timeline[4]["observationHash"], "d4FixedEventsSHA256": digest_value(d4_source_fixed),
            "d4EndpointSHA256": digest_value(dates(selected_endpoint)), "executedEventCount": len(flattened),
            "physicalDailyLedger": per_day, "independentSelectedPlanFees": independent_fees,
            "independentActualCompletedFees": totals,
            "failedPrefixHasNoCompletedFees": not result["complete"] and totals is None}


def review(run_dir):
    index_path = run_dir / "complete.json"
    index = ledger.read_json(index_path)
    require(index.get("schemaVersion") == SCHEMA, "Unsupported replay schema")
    require(index.get("dataRole") == "seen-v10-controlled-prefix-development", "Replay must remain seen-case development")
    declaration = index.get("declaration")
    require(isinstance(declaration, dict), "Missing replay declaration")
    require(declaration.get("caseId") == CASE_ID and declaration.get("interventionDay") == 4
            and declaration.get("prefixDays") == [0, 1, 2, 3], "Changed case/intervention/prefix declaration")
    require(declaration.get("branches") == list(BRANCHES), "Changed replay branches")
    require(declaration.get("dailyBudgetMs") == 200 and declaration.get("parentHardWallMs") == 5000,
            "Changed replay budgets")
    require(declaration.get("repeats") == [{"index": index, "seed": seed} for index, seed in REPEATS.items()], "Changed replay repeat/seed mapping")
    recorded_declaration = ledger.read_json(run_dir / "declaration.json")
    # Permit a declaration envelope containing the identical signed declaration,
    # or the declaration object itself; neither permits replacement values.
    declaration_payload = recorded_declaration.get("declaration", recorded_declaration)
    canonical_equal(declaration_payload, declaration, "Pre-run declaration")
    binding_checks = []
    for field in ("implementationHashes", "sourceBindings"):
        bindings = index.get(field)
        require(isinstance(bindings, dict) and bindings, f"Missing {field}")
        for filename, expected in bindings.items():
            path = repository_path(filename)
            checked_hash(path, expected, field)
            binding_checks.append({"kind": field, "path": filename, "sha256": expected, "matches": True})
    checked_hash(SOURCE_INDEX, SOURCE_INDEX_SHA256, "Frozen V10 index anchor")
    frozen = ledger.read_json(SOURCE_INDEX)
    old_case = next(case for case in frozen["cases"] if case["id"] == CASE_ID)
    records = index.get("records")
    require(isinstance(records, list) and len(records) == 6, "Replay must contain exactly six branch episodes")
    expected_pairs = {(repeat, branch) for repeat in REPEATS for branch in BRANCHES}
    seen, seen_artifacts, seen_ids, results = set(), set(), set(), []
    for record in records:
        pair = (record.get("repeatIndex"), record.get("branch"))
        require(pair in expected_pairs and pair not in seen, "Missing/duplicate/unknown branch/repeat pair")
        seen.add(pair)
        require(record.get("caseId") == CASE_ID and record.get("algorithmSeed") == REPEATS[pair[0]], "Replay case/seed differs from frozen source")
        require(isinstance(record.get("episodeId"), str) and record["episodeId"] not in seen_ids, "Missing/duplicate episode ID")
        seen_ids.add(record["episodeId"])
        repeat = next(value for value in old_case["repeats"] if value["repeatIndex"] == pair[0])
        old_episode_binding = repeat["policies"]["stableHiGHSV10"]["artifact"]
        paths = {}
        for key, original_binding in (("sourceInputArtifact", old_case["inputArtifact"]),
                                      ("sourceEpisodeArtifact", old_episode_binding)):
            binding = record.get(key)
            require(isinstance(binding, dict), f"Missing {key}")
            path = repository_path(binding.get("path"))
            checked_hash(path, binding.get("sha256"), key)
            require(binding["sha256"] == original_binding["sha256"], f"{key}: changed frozen source binding")
            require(index["sourceBindings"].get(binding["path"]) == binding["sha256"], f"{key}: source not bound by run index")
            paths[key] = path
        artifact = record.get("artifact")
        require(isinstance(artifact, dict), "Missing raw replay artifact")
        path = artifact_path(run_dir, artifact.get("path"))
        require(path not in seen_artifacts, "Reused raw replay artifact across branches")
        seen_artifacts.add(path)
        checked_hash(path, artifact.get("sha256"), "Replay raw episode")
        envelope = ledger.read_json(path)
        for key in ("episodeId", "caseId", "repeatIndex", "algorithmSeed", "branch"):
            canonical_equal(envelope.get(key), record[key], f"Replay envelope {key}")
        case, source = (ledger.read_json(paths[key]) for key in ("sourceInputArtifact", "sourceEpisodeArtifact"))
        require(case["config"]["id"] == CASE_ID and source.get("caseId") == CASE_ID
                and source.get("repeatIndex") == pair[0] and source.get("algorithmSeed") == REPEATS[pair[0]]
                and source.get("method") == "stableHiGHSV10", "Frozen source envelope mismatch")
        result = audit_episode(case, source, envelope, record)
        raw = envelope["result"]
        if "status" in record:
            require(record["status"] == raw["status"], "Replay index/raw status mismatch")
        if "completeWithinBudget" in record:
            expected_complete = raw["complete"] and raw.get("episodeCompletedWithinBudget", raw.get("endToEndCompletedWithinBudget", False))
            require(type(record["completeWithinBudget"]) is bool and record["completeWithinBudget"] == expected_complete, "Replay completion/budget summary mismatch")
        result["sourceInputSHA256"] = ledger.sha256(paths["sourceInputArtifact"])
        result["sourceEpisodeSHA256"] = ledger.sha256(paths["sourceEpisodeArtifact"])
        result["rawReplaySHA256"] = ledger.sha256(path)
        results.append(result)
    require(seen == expected_pairs, "Replay branch/repeat coverage incomplete")
    return {"schemaVersion": REVIEW_SCHEMA, "valid": True, "dataRole": index["dataRole"],
            "scope": "Independent source, causal-prefix, physical-resource and tariff-ledger review of six posthoc seen-case conditional continuations; no new solver calls, no unseen experiments or whole-policy performance conclusion.",
            "solverCallsByThisReview": 0, "newHeldOutExperiments": 0,
            "replayIndex": {"path": str(index_path), "sha256": ledger.sha256(index_path)},
            "frozenV10IndexSHA256": SOURCE_INDEX_SHA256,
            "reviewImplementationSHA256": ledger.sha256(Path(__file__)),
            "independentLedgerSHA256": ledger.sha256(LEDGER_PATH),
            "declarationSHA256": ledger.sha256(run_dir / "declaration.json"),
            "sourceChecks": binding_checks, "episodeCount": len(results),
            "completeEpisodeCount": sum(row["complete"] for row in results), "episodes": results}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run-dir", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    require(not args.output.exists(), f"Review output already exists: {args.output}")
    result = review(args.run_dir.resolve())
    # Exclusive creation is deliberate: this audit never overwrites evidence.
    with args.output.open("x", encoding="utf-8") as stream:
        json.dump(result, stream, ensure_ascii=False, indent=2, allow_nan=False)
        stream.write("\n")
    print(json.dumps({"valid": True, "episodes": result["episodeCount"],
                      "completeEpisodes": result["completeEpisodeCount"], "output": str(args.output)}, ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except (ValueError, KeyError, TypeError, IndexError, OSError, StopIteration) as error:
        print(f"Replay review failed: {error}", file=sys.stderr)
        sys.exit(1)
