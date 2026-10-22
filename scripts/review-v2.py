#!/usr/bin/env python3
"""Read-only independent audit of archived PortPlan V2 experiments.

Uses Python's standard library only. Does not import project JavaScript helpers,
invoke a solver, rerun experiments, or alter archived results. Billing checks
verify the disclosed model interpretation, not shipment-contract applicability.
Run: python scripts/review-v2.py
"""
from __future__ import annotations

import hashlib
import json
import math
from collections import Counter
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SEOUL = timezone(timedelta(hours=9))
SOURCES = ["data/benchmark-v2.json", "data/robustness-v2.json", "data/conservative-v2.json"]
COST_KEYS = ("storageCost", "ddCost", "totalCost", "sunkCost", "incrementalCost")
ERRORS: list[dict] = []
COUNTS: Counter = Counter()


def same(actual, expected):
    return isinstance(actual, (int, float)) and math.isfinite(actual) and math.isclose(actual, expected, abs_tol=1e-6, rel_tol=1e-12)


def record(context, errors):
    if errors:
        ERRORS.append({"context": context, "errors": sorted(set(errors))})


def capacity(s, key, day):
    value = s[key]
    return value[day] if isinstance(value, list) else value


def independent_cost(box, pickup, returned, scenario):
    """Independent daily enumeration; free-time shifts follow the stated scenario."""
    t = dict(pncFreeDays=4, ddFreeDays=10, pncMultiplier=1, ddMultiplier=1,
             pncMode="retroactive", ddMode="progressive")
    t.update(scenario.get("tariff", {}))
    discharge_time = datetime.fromisoformat(box["dischargeDateTime"].replace("Z", "+00:00")).astimezone(SEOUL)
    discharge = discharge_time.date()
    storage_start = discharge + timedelta(days=int(discharge_time.hour >= 8))
    planning_start = date.fromisoformat(scenario["horizonStart"])

    def pnc(days):
        excess = max(0, days - t["pncFreeDays"])
        rate = lambda n: 9100 if n <= 3 else 18200 if n <= 5 else 31850 if n <= 10 else 45500
        amount = excess * rate(excess) if t["pncMode"] == "retroactive" else sum(rate(d) for d in range(1, excess + 1))
        return amount * box["sizeFt"] / 20 * t["pncMultiplier"]

    def dd(days):
        excess = max(0, days - t["ddFreeDays"])
        rates = (15000, 30000, 50000) if box["sizeFt"] == 20 else (30000, 50000, 90000)
        rate = lambda n: rates[0 if n <= 5 else 1 if n <= 10 else 2]
        amount = excess * rate(excess) if t["ddMode"] == "retroactive" else sum(rate(d) for d in range(1, excess + 1))
        return amount * t["ddMultiplier"]

    storage_days = max(0, (planning_start - storage_start).days + pickup + 1)
    dd_days = max(0, (planning_start - discharge).days + returned + 1)
    storage = pnc(storage_days)
    carrier = dd(dd_days)
    prior_storage = pnc(max(0, (planning_start - storage_start).days))
    prior_dd = dd(max(0, (planning_start - discharge).days))
    prior = prior_storage + prior_dd
    return dict(storageCost=storage, ddCost=carrier, totalCost=storage + carrier,
                sunkCost=prior, incrementalCost=storage + carrier - prior,
                priorStorageCost=prior_storage, priorDDCost=prior_dd,
                storageDays=storage_days, ddDays=dd_days)


def audit(scenario, result, costs=True, stored_end=True):
    """Recompute occupancy using actual durations; never use stored usage arrays."""
    errors = []
    rows = result.get("rows", [])
    boxes = {box["id"]: box for box in scenario["containers"]}
    ids = [row["id"] for row in rows]
    if len(boxes) != len(scenario["containers"]) or len(ids) != len(set(ids)) or set(ids) != set(boxes):
        errors.append("container coverage/uniqueness")
    horizon = scenario["horizonDays"]
    usage = [[0, 0, 0] for _ in range(horizon)]
    totals = Counter()
    operations = scenario.get("operations", {})
    lag = operations.get("returnLagDays", 1)
    for row in rows:
        if row["id"] not in boxes:
            continue
        box = boxes[row["id"]]
        p, u, r = (row[k] for k in ("pickupDay", "unloadDay", "returnDay"))
        if any(type(day) is not int for day in (p, u, r)):
            errors.append("noninteger event date")
            continue
        duration = box["unloadDays"]
        if p < box["releaseDay"] or u < p or r < u + duration - 1 + lag:
            errors.append("release/precedence")
        if u + duration - 1 > box["dueDay"]:
            errors.append("deadline")
        if stored_end and row.get("unloadEndDay") != u + duration - 1:
            errors.append("stored unloading end")
        for day in (p, r):
            if 0 <= day < horizon:
                usage[day][0] += 1
            else:
                errors.append("event outside horizon")
        for day in range(u, u + duration):
            if 0 <= day < horizon:
                usage[day][1] += 1
            else:
                errors.append("unloading outside horizon")
        weight = box["sizeFt"] / 20 if operations.get("stagingUnit") == "teu" else 1
        for day in range(p, r):
            if 0 <= day < horizon:
                usage[day][2] += weight
        values = independent_cost(box, p, r, scenario)
        for key, value in values.items():
            if costs and not same(row.get(key), value):
                errors.append("row " + key)
        totals.update({key: values[key] for key in COST_KEYS})
    for day, used in enumerate(usage):
        for index, key in enumerate(("truckCapacity", "warehouseCapacity", "stagingCapacity")):
            if used[index] > capacity(scenario, key, day):
                errors.append(key)
    if costs:
        for key in COST_KEYS:
            if not same(result.get(key), totals[key]):
                errors.append("total " + key)
    return errors


def complete(result, size):
    return result.get("status") in ("optimal", "feasible") and len(result.get("rows", [])) == size


def aggregate(cases):
    paired = []
    for case in cases:
        policies = case["policies"]
        baselines = [(v["incrementalCost"], key) for key, v in policies.items()
                     if key != "optimized" and complete(v, case["count"])]
        opt = policies["optimized"]
        valid = [v for v in policies.values() if complete(v, case["count"])]
        if len({v["totalCost"] - v["incrementalCost"] for v in valid}) > 1:
            record(case["id"], ["prior reference differs between policies"])
        if baselines and complete(opt, case["count"]):
            _, key = min(baselines)
            baseline = policies[key]
            paired.append((baseline, opt))
            if not same(case["comparison"]["baselineIncrementalKRW"], baseline["incrementalCost"]):
                record(case["id"], ["best baseline mismatch"])
    bi = sum(base["incrementalCost"] for base, _ in paired)
    oi = sum(opt["incrementalCost"] for _, opt in paired)
    bt = sum(base["totalCost"] for base, _ in paired)
    ot = sum(opt["totalCost"] for _, opt in paired)
    differences = [base["incrementalCost"] - opt["incrementalCost"] for base, opt in paired]
    return dict(caseCount=len(cases), pairedCaseCount=len(paired), baselineIncrementalKRW=bi,
                optimizedIncrementalKRW=oi, incrementalSavingsKRW=bi-oi,
                weightedIncrementalSavingsPct=100*(bi-oi)/bi if bi else None,
                baselineTotalKRW=bt, optimizedTotalKRW=ot,
                weightedTotalSavingsPct=100*(bt-ot)/bt if bt else None,
                positiveSavingsCount=sum(d>0 for d in differences), tiedCount=sum(d==0 for d in differences),
                negativeSavingsCount=sum(d<0 for d in differences),
                zeroBaselineCount=sum(base["incrementalCost"]==0 for base, _ in paired))


def main():
    documents = {name: json.loads((ROOT/name).read_text()) for name in SOURCES}
    benchmark = documents[SOURCES[0]]
    stress = documents[SOURCES[1]]
    conservative = documents[SOURCES[2]]
    groups = (("main", benchmark["cases"]), ("scale", benchmark["scaleControls"]["cases"]),
              ("sensitivity", benchmark["sensitivity"]["cases"]))
    for group, cases in groups:
        for case in cases:
            for policy, result in case["policies"].items():
                context = case["id"] + ":" + policy
                if result["status"] not in ("optimal", "feasible"):
                    if result.get("totalCost") is not None or result.get("incrementalCost") is not None:
                        record(context, ["failed result has comparable cost"])
                    continue
                COUNTS[group] += 1
                record(context, audit(case["scenario"], result))
            reference = case.get("referenceEvaluation")
            if reference:
                default = {**case["scenario"], "tariff": {}}
                boxes = {box["id"]: box for box in default["containers"]}
                totals = Counter()
                for row in case["policies"]["optimized"]["rows"]:
                    values = independent_cost(boxes[row["id"]], row["pickupDay"], row["returnDay"], default)
                    totals.update({key: values[key] for key in COST_KEYS})
                record(case["id"] + ":reference", [key for key in COST_KEYS if not same(reference.get(key), totals[key])])
    aggregates = {"main": aggregate(benchmark["cases"]), "scale": aggregate(benchmark["scaleControls"]["cases"])}
    for name, result in aggregates.items():
        saved = benchmark["summary"] if name == "main" else benchmark["scaleControls"]["summary"]
        record(name+":summary", [key for key, value in result.items()
                                 if saved.get(key) != value and not (value is not None and same(saved.get(key), value))])
    strict = []
    for variant in ("storageOnly", "ddOnly"):
        rows = [c for c in benchmark["sensitivity"]["cases"] if c["variant"] == variant
                and c.get("referenceEvaluation") and c["referenceEvaluation"]["strictAblationInterpretation"]]
        denominator = sum(c["referenceEvaluation"]["defaultTotalCost"] for c in rows)
        extra = sum(c["referenceEvaluation"]["deltaVsDefaultKRW"] for c in rows)
        strict.append(dict(variant=variant, caseCount=len(rows), extraCostKRW=extra,
                           defaultTotalCostKRW=denominator, extraCostPct=100*extra/denominator if denominator else None))
    initial_invalid = 0
    stress_by_id = {c["id"]: c for c in stress["cases"]}
    for case in stress["cases"]:
        for variant in case["variants"]:
            COUNTS["operationVariants"] += 1
            record(case["id"]+":"+variant["id"], audit(variant["scenario"], variant["result"]))
        for disruption in case["disruptions"]:
            errors = audit(disruption["scenario"], case["initialPlan"], costs=False, stored_end=False)
            initial_invalid += bool(errors)
            COUNTS["originalDisruptionChecks"] += 1
            if bool(errors) == disruption["initialAudit"]["valid"]:
                record(case["id"]+":"+disruption["name"], ["saved invalidity flag mismatch"])
            COUNTS["hindsight"] += 1
            record(case["id"]+":hindsight:"+disruption["name"], audit(disruption["scenario"], disruption["hindsight"]["result"]))
    original_total = conservative_total = 0
    for case in conservative["cases"]:
        rows = case["nominalResult"]["rows"]
        fixed_dates = lambda rs: {row["id"]: tuple(row[k] for k in ("pickupDay", "unloadDay", "returnDay")) for row in rs}
        if fixed_dates(rows) != fixed_dates(case["worstCaseResult"]["rows"]):
            record(case["id"], ["conservative plan changes fixed event dates"])
        original_total += case["originalPlan"]["totalCost"]
        conservative_total += case["nominalResult"]["totalCost"]
        COUNTS["conservativeNominalFeeRecalculations"] += 1
        record(case["id"]+":conservative-fees", audit(case["scenario"], case["nominalResult"], stored_end=False))
        worst = case["worstCaseScenario"]
        nominal_boxes = {x["id"]: x for x in case["scenario"]["containers"]}
        if any(x["unloadDays"] != nominal_boxes[x["id"]]["unloadDays"]+1 for x in worst["containers"]):
            record(case["id"], ["buffer does not add one day to every box"])
        if any(capacity(worst,"truckCapacity",d) != max(0,capacity(case["scenario"],"truckCapacity",d)-2)
               for d in range(worst["horizonDays"])):
            record(case["id"], ["buffer does not reserve two moves every day"])
        variants = [("nominal", case["scenario"]), ("worst", worst)] + [
            (d["name"], d["scenario"]) for d in stress_by_id[case["id"]]["disruptions"]]
        for label, scenario in variants:
            COUNTS["conservativeFixedPlanConstraintChecks"] += 1
            record(case["id"]+":conservative:"+label, audit(scenario,case["nominalResult"],costs=False,stored_end=False))
    premium = conservative_total-original_total
    csummary = conservative["summary"]
    record("conservative:summary", [key for key, value in {"totalOriginal": original_total, "totalPremium": premium,
           "totalPremiumPct":100*premium/original_total if original_total else None}.items()
           if not same(csummary.get(key),value)])
    fingerprints = {json.dumps([{k:v for k,v in box.items() if k != "id"} for box in c["scenario"]["containers"]],sort_keys=True)
                    for c in benchmark["cases"]}
    full_count = sum(COUNTS[k] for k in ("main","scale","sensitivity","operationVariants","hindsight"))
    report = {
        "generatedAt":datetime.now(timezone.utc).isoformat(), "status":"pass" if not ERRORS else "fail",
        "scope":"Independent standard-library Python audit of archived synthetic experiments; not solver reruns, third-party certification, contract validation, or independent statistical observations.",
        "script":"scripts/review-v2.py", "scriptSha256":hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        "sources":[{"path":name,"sha256":hashlib.sha256((ROOT/name).read_bytes()).hexdigest(),"generatedAt":documents[name].get("generatedAt")} for name in SOURCES],
        "counts":dict(COUNTS), "completeScheduleChecks":full_count,
        "mainUniqueSeeds":len({c["seed"] for c in benchmark["cases"]}), "mainDistinctOrderContentGroups":len(fingerprints),
        "independentAggregates":aggregates, "strictAblations":strict,
        "originalDisruptedPlansInvalid":initial_invalid, "conservativeCost":{"originalTotalKRW":original_total,"conservativeTotalKRW":conservative_total,"premiumKRW":premium,"premiumPct":100*premium/original_total if original_total else None},
        "errorCount":len(ERRORS),"errors":ERRORS,
        "limitations":["Checks implement the disclosed tariff interpretation; do not establish invoice applicability.","Repeated scenarios/variants and repeated checks are not independent samples.","An optimizer status is read from the archive; this checker verifies feasibility and costs, not a general optimality certificate.","Strong-search and MILP budgets differ; no equal-CPU or SOTA claim is validated."]}
    destination = ROOT/"data/review-v2.json"
    destination.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n")
    print(json.dumps({"status":report["status"],"completeScheduleChecks":full_count,"counts":dict(COUNTS),"errorCount":len(ERRORS),"output":str(destination)},ensure_ascii=False,indent=2))
    if ERRORS:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
