#!/usr/bin/env python3
"""Pure-Python, solver-free review of published necessary-condition witnesses.

Enumerates complete pickup/unload/return triples independently of JavaScript.
Passing interval bounds never proves feasibility, recovery, or optimality.
"""
from __future__ import annotations

import argparse
import copy
import hashlib
import json
import math
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCHEMA = "portplan-pure-python-feasibility-review-v6"
RESOURCES = ("truck", "warehouse", "staging")
EVENTS = ("pickupDay", "unloadDay", "returnDay")
FIELDS = {"pickup": "pickupDay", "unloadStart": "unloadDay", "return": "returnDay"}
STATUS_PROVEN = "proven_infeasible_necessary_condition"
STATUS_UNKNOWN = "not_proven_infeasible"


def require(condition, message):
    if not condition:
        raise ValueError(message)


def read_json(path):
    require(path.is_file(), f"Missing input: {path}")
    def reject(value):
        raise ValueError(f"Non-finite JSON constant {value}")
    return json.loads(path.read_text(encoding="utf-8"), parse_constant=reject)


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def same(actual, expected):
    if type(expected) in (int, float):
        return type(actual) in (int, float) and math.isfinite(actual) and actual == expected
    if isinstance(expected, dict):
        return isinstance(actual, dict) and set(actual) == set(expected) and all(same(actual[key], value) for key, value in expected.items())
    if isinstance(expected, list):
        return isinstance(actual, list) and len(actual) == len(expected) and all(same(left, right) for left, right in zip(actual, expected))
    return type(actual) is type(expected) and actual == expected


def capacity(scenario, resource, day):
    value = scenario[resource + "Capacity"]
    return value[day] if isinstance(value, list) else value


def validate(scenario, options):
    require(isinstance(scenario, dict) and isinstance(options, dict), "Scenario/options must be objects")
    horizon = scenario["horizonDays"]
    require(type(horizon) is int and 2 <= horizon <= 31, "Invalid horizon")
    for resource in RESOURCES:
        value = scenario[resource + "Capacity"]
        require(not isinstance(value, list) or len(value) == horizon, "Capacity array length mismatch")
        require(all(type(capacity(scenario, resource, day)) is int and capacity(scenario, resource, day) >= 0 for day in range(horizon)), "Invalid resource capacity")
    containers = scenario["containers"]
    require(isinstance(containers, list) and 1 <= len(containers) <= 100, "Invalid container array")
    ids = [container["id"] for container in containers]
    require(all(isinstance(value, str) and value for value in ids) and len(set(ids)) == len(ids), "Malformed/duplicate box ID")
    for container in containers:
        require(type(container["sizeFt"]) is int and container["sizeFt"] in (20, 40), "Invalid size")
        require(all(type(container[key]) is int and 0 <= container[key] < horizon for key in ("releaseDay", "dueDay")), "Invalid release/deadline")
        require(type(container["unloadDays"]) is int and 1 <= container["unloadDays"] < horizon, "Invalid unload duration")
    operation = {"returnLagDays": 1, "stagingUnit": "container", **scenario.get("operations", {})}
    require(type(operation["returnLagDays"]) is int and operation["returnLagDays"] in (0, 1)
            and operation["stagingUnit"] in ("container", "teu"), "Invalid operations")
    minimum = options.get("minEventDay", 0)
    require(type(minimum) is int and 0 <= minimum <= horizon, "Invalid minEventDay")
    fixed = options.get("fixedEvents", {})
    require(isinstance(fixed, dict), "fixedEvents must be an object")
    for identifier, locks in fixed.items():
        require(identifier in ids and isinstance(locks, dict), "Unknown/malformed lock container")
        require(all(key in EVENTS and type(day) is int and 0 <= day < horizon for key, day in locks.items()), "Invalid fixed event date")
    maximum = options.get("maxWitnesses", 6)
    require(type(maximum) is int and 1 <= maximum <= 100, "Invalid maxWitnesses")
    return operation, minimum, fixed, maximum


def legal_trips(scenario, container, operation, fixed, minimum):
    """Capacity-free admissible dates, exactly the domain of a necessary bound."""
    trips = []
    duration, horizon = container["unloadDays"], scenario["horizonDays"]
    locks = fixed.get(container["id"], {})
    for pickup in range(container["releaseDay"], horizon):
        for unload in range(pickup, horizon):
            end = unload + duration - 1
            if end > container["dueDay"] or end >= horizon:
                continue
            for returned in range(end + operation["returnLagDays"], horizon):
                dates = (pickup, unload, returned)
                if all(day == locks[field] if field in locks else day >= minimum for field, day in zip(EVENTS, dates)):
                    trips.append(dates)
    return trips


def independent_event_domains(scenario, container, operation, fixed, minimum):
    # Earliest completion and last legal unloading day give each separate event
    # range. These domains can be nonempty individually while no full trip exists.
    duration, horizon = container["unloadDays"], scenario["horizonDays"]
    last_start = min(container["dueDay"] - duration + 1, horizon - duration - operation["returnLagDays"])
    candidates = {"pickup": range(container["releaseDay"], last_start + 1),
                  "unload": range(container["releaseDay"], last_start + 1),
                  "return": range(container["releaseDay"] + duration - 1 + operation["returnLagDays"], horizon)}
    locks = fixed.get(container["id"], {})
    domain_fields = {"pickup": "pickupDay", "unload": "unloadDay", "return": "returnDay"}
    return {kind: [day for day in dates if day == locks[domain_fields[kind]]] if domain_fields[kind] in locks else
            [day for day in dates if day >= minimum] for kind, dates in candidates.items()}


def overlap(first, last, left, right):
    return max(0, min(last, right) - max(first, left) + 1)


def interval_minima(trips, duration, weight, left, right):
    truck = warehouse = staging = math.inf
    for pickup, unload, returned in trips:
        # Explicitly price usage of each complete triple; no JS endpoint shortcut
        # across a conditional date range is used.
        truck = min(truck, int(left <= pickup <= right) + int(left <= returned <= right))
        warehouse = min(warehouse, overlap(unload, unload + duration - 1, left, right))
        staging = min(staging, weight * overlap(pickup, returned - 1, left, right))
        if truck == warehouse == staging == 0:
            break
    return {"truck": truck, "warehouse": warehouse, "staging": staging}


def calculate(scenario, options):
    operation, minimum, fixed, maximum = validate(scenario, options)
    domains = [(container, legal_trips(scenario, container, operation, fixed, minimum)) for container in scenario["containers"]]
    empty = [(container, trips) for container, trips in domains if not trips]
    counts = [{"id": container["id"], "admissibleTripCount": len(trips)} for container, trips in domains]
    if empty:
        witnesses = [{"kind": "empty_event_domain", "id": container["id"],
                      "eventDomains": independent_event_domains(scenario, container, operation, fixed, minimum)}
                     for container, _ in empty[:maximum]]
        return {"domainCounts": counts, "status": STATUS_PROVEN, "proofKind": "empty_event_domain", "emptyDomainCount": len(empty),
                "intervalsChecked": 0, "violatedBoundCount": 0, "witnesses": witnesses, "minEventDay": minimum}
    witnesses = []
    horizon = scenario["horizonDays"]
    for left in range(horizon):
        for right in range(left, horizon):
            required = dict.fromkeys(RESOURCES, 0)
            contributors = {resource: [] for resource in RESOURCES}
            for container, trips in domains:
                weight = container["sizeFt"] / 20 if operation["stagingUnit"] == "teu" else 1
                values = interval_minima(trips, container["unloadDays"], weight, left, right)
                for resource, value in values.items():
                    required[resource] += value
                    if value:
                        contributors[resource].append({"id": container["id"], "minimumUsage": value})
            for resource in RESOURCES:
                available = sum(capacity(scenario, resource, day) for day in range(left, right + 1))
                if required[resource] > available:
                    witnesses.append({"kind": "resource_interval_lower_bound", "resource": resource, "fromDay": left, "toDay": right,
                        "minimumRequired": required[resource], "availableCapacity": available, "deficit": required[resource] - available,
                        "contributors": contributors[resource]})
    witnesses.sort(key=lambda witness: (-witness["deficit"], witness["toDay"] - witness["fromDay"], witness["fromDay"], witness["resource"]))
    return {"domainCounts": counts, "status": STATUS_PROVEN if witnesses else STATUS_UNKNOWN,
            "proofKind": "resource_interval_lower_bound" if witnesses else None, "intervalsChecked": horizon * (horizon + 1) // 2,
            "violatedBoundCount": len(witnesses), "witnesses": witnesses[:maximum], "minEventDay": minimum}


def audit_explanation(scenario, options, published, label):
    computed = calculate(scenario, options)
    require("feasible" in published and published["feasible"] is None and published.get("optimality") == "not_applicable", f"{label}: necessary bounds improperly claim feasibility or optimality")
    require(published.get("usesOnlySuppliedScenarioAndExecutionConstraints") is True, f"{label}: missing information-scope claim")
    require(published.get("method") == "v6-necessary-resource-interval-bounds", f"{label}: different explanation method")
    for key in ("status", "proofKind", "domainCounts", "minEventDay", "intervalsChecked", "violatedBoundCount"):
        require(key in published and same(published[key], computed[key]), f"{label}: independent {key} mismatch")
    if "emptyDomainCount" in computed:
        require(published.get("emptyDomainCount") == computed["emptyDomainCount"], f"{label}: empty domain count mismatch")
    operation = {"returnLagDays": 1, "stagingUnit": "container", **scenario.get("operations", {})}
    require(published.get("resourceUnits") == {"truck": "movements", "warehouse": "slot-days", "staging": "TEU-days" if operation["stagingUnit"] == "teu" else "container-days"}, f"{label}: resource units mismatch")
    supplied = published.get("witnesses")
    require(isinstance(supplied, list) and len(supplied) == len(computed["witnesses"]), f"{label}: omitted/extra published witness")
    checked = []
    for expected, witness in zip(computed["witnesses"], supplied):
        for key, value in expected.items():
            require(key in witness and same(witness[key], value), f"{label}: witness {key} mismatch: expected {value}, received {witness.get(key)}")
        checked.append(expected)
    return {"valid": True, "status": computed["status"], "provesInfeasibility": computed["status"] == STATUS_PROVEN,
            "provesFeasibility": False, "tripCount": sum(value["admissibleTripCount"] for value in computed["domainCounts"]),
            "intervalsChecked": computed["intervalsChecked"], "violatedBoundCount": computed["violatedBoundCount"],
            "publishedWitnessesChecked": len(checked), "witnesses": checked}


def observed_failure_input(case, result):
    scenario = copy.deepcopy(case["nominalScenario"])
    day, fixed = result["failure"]["day"], {}
    for resource in RESOURCES:
        scenario[resource + "Capacity"] = [capacity(case["nominalScenario"], resource, index) for index in range(scenario["horizonDays"])]
    require(not any("announcedDuration" in event for event in case["events"]), "V5 observation reconstruction cannot disclose announced/private future duration")
    for entry in result["timeline"]:
        require(entry["day"] <= day, "Recorded execution continues past failure")
        for observation in entry["observedEvents"]:
            require(observation["resource"] in RESOURCES and observation["day"] == entry["day"], "Malformed historical observation")
            scenario[observation["resource"] + "Capacity"][entry["day"]] = observation["capacity"]
        for event in entry["executedEvents"]:
            require(event["day"] < day and event["day"] == entry["day"], "Failure input contains actions at/after failure")
            field = FIELDS[event["event"]]
            require(field not in fixed.get(event["id"], {}), "Duplicate executed event")
            fixed.setdefault(event["id"], {})[field] = event["day"]
    return {"scenario": scenario, "options": {"fixedEvents": fixed, "minEventDay": day}}


def review(root):
    started = time.perf_counter()
    witness_path, archive_path = root / "data/feasibility-witnesses-v6.json", root / "data/rolling-v5.json"
    source_path, native_path = root / "src/feasibility-explanation-v6.js", root / "data/failure-diagnosis-v6.json"
    published, archive, native = (read_json(path) for path in (witness_path, archive_path, native_path))
    before = {str(path.relative_to(root)): digest(path) for path in (witness_path, archive_path, source_path, native_path)}
    require(published["retrospective"] is True and published["inputArchiveSha256"] == digest(archive_path), "Witnesses are bound to another archive")
    require(published["implementationSha256"] == digest(source_path), "Explanation source changed after witnesses were generated")
    require(archive["executionState"] == "complete" and len(archive["cases"]) == 24, "V5 rolling coverage changed")
    require(native["valid"] and native["inputHashes"]["data/rolling-v5.json"] == digest(archive_path), "Native diagnosis has another input binding")
    require([case["id"] for case in published["cases"]] == [case["id"] for case in archive["cases"]], "Published cases omitted/reordered")
    native_cases = {case["id"]: case for case in native["cases"]}
    cases, failures, nominal_proven = [], [], 0
    for source, explanation in zip(archive["cases"], published["cases"]):
        nominal = audit_explanation(source["nominalScenario"], {}, explanation["nominal"], source["id"] + "/nominal")
        nominal_proven += nominal["provesInfeasibility"]
        expected_methods = {method for method, result in source["policies"].items() if not result["complete"]}
        require(set(explanation["failures"]) == expected_methods, "Failure method coverage changed")
        record = {"id": source["id"], "nominal": nominal, "failures": {}}
        for method, failure in explanation["failures"].items():
            reconstructed = observed_failure_input(source, source["policies"][method])
            require(failure["day"] == source["policies"][method]["failure"]["day"], "Published failure day differs")
            require(same(failure["input"]["scenario"], reconstructed["scenario"]) and same(failure["input"]["options"], reconstructed["options"]), "Published input differs from observed capacities/execution locks")
            checked = audit_explanation(reconstructed["scenario"], reconstructed["options"], failure["explanation"], source["id"] + "/" + method)
            diagnosed = native_cases[source["id"]]["methods"][method]
            snapshot = diagnosed["failureSnapshot"]
            require(snapshot["scenario"] == reconstructed["scenario"] and snapshot["fixedEvents"] == reconstructed["options"]["fixedEvents"]
                    and snapshot["minEventDay"] == reconstructed["options"]["minEventDay"], "Native and necessary-cut failure inputs differ")
            proof = native["models"][diagnosed["layers"]["observedExecutedPrefix"]]["certificate"]
            checked["nativeLockedCertificateStatus"] = proof["certificateStatus"]
            checked["nativeProofVerifiedByThisEnumeration"] = False
            require(not checked["provesInfeasibility"] or proof["provenInfeasible"], "Cheap witness contradicts native feasibility evidence")
            record["failures"][method] = checked
            failures.append(checked)
        cases.append(record)
    calculated = {"caseCount": len(cases), "nominalNecessaryInfeasibilityCount": nominal_proven, "failedMethodEpisodeCount": len(failures),
                  "failedEpisodeNecessaryInfeasibilityCount": sum(result["provesInfeasibility"] for result in failures),
                  "unresolvedFailedEpisodeCount": sum(not result["provesInfeasibility"] for result in failures)}
    require(published["summary"] == calculated, "Published summary overstates/omits necessary-cut coverage")
    source_text = source_path.read_text(encoding="utf-8")
    marker = "export function explainFeasibility"
    require(source_text.count(marker) == 1, "Single explanation function source binding changed")
    function_source = source_text[source_text.index(marker):]
    require(before == {str(path.relative_to(root)): digest(path) for path in (witness_path, archive_path, source_path, native_path)}, "Review changed an input")
    audits = [case["nominal"] for case in cases] + failures
    return {"schemaVersion": SCHEMA, "valid": True, "fixture": False, "readOnly": True, "solverRuns": 0, "importsJavaScript": False,
        "scope": "Independently enumerated necessary interval bounds and published witnesses only; no positive feasibility, native-solver reproof, new-seed outcome or operational certification",
        "inputHashes": before, "reviewImplementationSha256": digest(Path(__file__)),
        "implementationBindings": {"explanationModuleSha256": digest(source_path), "publishedExplanationSha256": published["implementationSha256"],
                                   "exportedFunctionSourceSha256": hashlib.sha256(function_source.encode("utf-8")).hexdigest(),
                                   "functionSourceExtraction": "Unique export function explainFeasibility declaration through end of its single-function module"},
        "summary": {**calculated, "explanationInputsChecked": len(audits), "publishedWitnessesChecked": sum(result["publishedWitnessesChecked"] for result in audits),
                    "legalTripDomainsEnumerated": sum(result["tripCount"] for result in audits),
                    "intervalsChecked": sum(result["intervalsChecked"] for result in audits),
                    "nativeLockedInfeasibilityRecordsReferenced": sum(result["nativeLockedCertificateStatus"] == "proven_infeasible" for result in failures),
                    "nativeProofsReverifiedByNecessaryCuts": sum(result["provesInfeasibility"] for result in failures),
                    "unknownNecessaryCutResultsAreFeasibleClaims": False, "wallSeconds": time.perf_counter() - started}, "cases": cases}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=ROOT)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--fixture-input", type=Path)
    args = parser.parse_args(argv)
    try:
        if args.fixture_input:
            payload = read_json(args.fixture_input)
            cases = [{"id": case["id"], "audit": audit_explanation(case["scenario"], case.get("options", {}), case["explanation"], case["id"])} for case in payload["cases"]]
            report = {"schemaVersion": SCHEMA, "valid": True, "fixture": True, "solverRuns": 0, "importsJavaScript": False, "cases": cases}
        else:
            report = review(args.root.resolve())
        output = args.output or (None if args.fixture_input else args.root / "data/feasibility-review-v6.json")
        if output:
            target, evidence = output.resolve(), (args.root / "data").resolve()
            require(not (target.is_file() and evidence in target.parents and target != evidence / "feasibility-review-v6.json"), "Refusing to overwrite original evidence")
            require(not args.fixture_input or target != args.fixture_input.resolve(), "Refusing to overwrite fixture input")
            output.parent.mkdir(parents=True, exist_ok=True)
            output.write_text(json.dumps(report, ensure_ascii=False, indent=2, allow_nan=False) + "\n", encoding="utf-8")
            print(json.dumps({"valid": True, "output": str(output), "summary": report.get("summary")}, ensure_ascii=False))
        else:
            print(json.dumps(report, ensure_ascii=False, indent=2, allow_nan=False))
    except (OSError, ValueError, KeyError, TypeError, IndexError) as error:
        print(json.dumps({"schemaVersion": SCHEMA, "valid": False, "solverRuns": 0, "error": str(error)}, ensure_ascii=False))
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
