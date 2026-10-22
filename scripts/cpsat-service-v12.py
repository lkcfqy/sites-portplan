#!/usr/bin/env python3
"""Independent interval CP-SAT model and daily ledger; JSON-lines native service.

Uses OR-Tools (Apache-2.0), but no SciPy, HiGHS, JavaScript model coefficients,
certify-v4 helpers, hidden future events, or new prospective scenario inputs.
"""
from __future__ import annotations

import datetime as dt
import json
import math
import os
import re
import sys
import time

BOOT_STARTED = time.perf_counter()
for name in ("OMP_NUM_THREADS", "OPENBLAS_NUM_THREADS", "MKL_NUM_THREADS"):
    os.environ[name] = "1"
import ortools
from ortools.sat.python import cp_model

SCHEMA = "portplan-native-cpsat-v12"
MAX_SAFE = 2**53 - 1
FIELDS = ("pickupDay", "unloadDay", "returnDay")
TOTALS = ("storageCost", "ddCost", "totalCost", "sunkCost", "incrementalCost")
DEFAULT_TARIFF = {"pncFreeDays": 4, "ddFreeDays": 10, "pncMultiplier": 1, "ddMultiplier": 1,
                  "pncMode": "retroactive", "ddMode": "progressive"}
KST = dt.timezone(dt.timedelta(hours=9))


class BudgetExpired(Exception):
    pass


def require(condition, message):
    if not condition:
        raise ValueError(message)


def integer(value):
    return type(value) is int


def finite(value):
    return type(value) in (int, float) and math.isfinite(value)


def checkpoint(deadline):
    if time.perf_counter() >= deadline:
        raise BudgetExpired("Absolute whole-call deadline exhausted")


def cap(scenario, resource, day):
    value = scenario[resource + "Capacity"]
    return value[day] if isinstance(value, list) else value


def calendar_date(value):
    require(isinstance(value, str) and re.fullmatch(r"\d{4}-\d{2}-\d{2}", value), "Expected YYYY-MM-DD")
    return dt.date.fromisoformat(value)


def discharged(value):
    require(isinstance(value, str) and re.fullmatch(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})", value),
            "dischargeDateTime requires an ISO datetime and explicit UTC offset")
    if not value.endswith("Z"):
        offset = value[-5:].split(":")
        require(int(offset[0]) <= 14 and int(offset[1]) < 60 and (int(offset[0]) != 14 or int(offset[1]) == 0), "Invalid UTC offset")
    parsed = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
    return parsed.astimezone(KST)


def parameters(scenario):
    return {**DEFAULT_TARIFF, **scenario.get("tariff", {})}, {"returnLagDays": 1, "stagingUnit": "container", **scenario.get("operations", {})}


def validate(scenario, fixed, minimum):
    require(isinstance(scenario, dict), "Scenario must be an object")
    start = calendar_date(scenario["horizonStart"])
    horizon = scenario["horizonDays"]
    require(integer(horizon) and 2 <= horizon <= 31, "horizonDays must be 2..31")
    for key in ("tariff", "operations"):
        require(key not in scenario or isinstance(scenario[key], dict), key + " must be an object")
    tariff, operations = parameters(scenario)
    for key in ("pncFreeDays", "ddFreeDays"):
        require(integer(tariff[key]) and 0 <= tariff[key] <= 365, key + " must be 0..365")
    for key in ("pncMultiplier", "ddMultiplier"):
        require(finite(tariff[key]) and 0 <= tariff[key] <= 100, key + " must be finite and 0..100")
    for key in ("pncMode", "ddMode"):
        require(tariff[key] in ("retroactive", "progressive"), "Invalid fee mode")
    require(integer(operations["returnLagDays"]) and operations["returnLagDays"] in (0, 1), "returnLagDays must be 0 or 1")
    require(operations["stagingUnit"] in ("container", "teu"), "stagingUnit must be container or teu")
    for resource in ("truck", "warehouse", "staging"):
        value = scenario[resource + "Capacity"]
        if isinstance(value, list):
            require(len(value) == horizon, "Capacity list must cover every horizon day")
            values = value
        else:
            values = [value]
        require(all(integer(item) and 0 <= item <= MAX_SAFE for item in values), "Capacity must be a nonnegative safe integer")
    containers = scenario["containers"]
    require(isinstance(containers, list) and 1 <= len(containers) <= 100, "Provide 1..100 known containers")
    ids = set()
    for container in containers:
        require(isinstance(container, dict), "Container must be an object")
        identifier = container["id"]
        require(isinstance(identifier, str) and identifier and identifier not in ids, "Container ids must be nonempty and unique")
        ids.add(identifier)
        require(integer(container["sizeFt"]) and container["sizeFt"] in (20, 40), "Only 20/40-ft dry containers")
        for key in ("releaseDay", "dueDay"):
            require(integer(container[key]) and 0 <= container[key] < horizon, key + " outside horizon")
        require(integer(container["unloadDays"]) and 1 <= container["unloadDays"] < horizon, "unloadDays outside 1..H-1")
        require(container["releaseDay"] >= (discharged(container["dischargeDateTime"]).date() - start).days, "releaseDay before vessel discharge")
    require(integer(minimum) and 0 <= minimum <= horizon, "minEventDay outside horizon")
    require(isinstance(fixed, dict), "fixedEvents must be an object")
    for identifier, locks in fixed.items():
        require(identifier in ids and isinstance(locks, dict), "Unknown execution lock container")
        for field, day in locks.items():
            require(field in FIELDS and integer(day) and 0 <= day < minimum, "Execution locks must be strictly before minEventDay")


def fees(scenario, container, pickup, returned):
    """Independent explicit tariff arithmetic. No original ledger is imported."""
    tariff, _ = parameters(scenario)
    start = calendar_date(scenario["horizonStart"])
    local = discharged(container["dischargeDateTime"])
    storage_start = local.date() + dt.timedelta(days=int(local.hour >= 8))
    storage_days = max(0, (start - storage_start).days + pickup + 1)
    dd_days = max(0, (start - local.date()).days + returned + 1)

    def storage(days):
        count = max(0, days - tariff["pncFreeDays"])
        if tariff["pncMode"] == "retroactive":
            rate = 9100 if count <= 3 else 18200 if count <= 5 else 31850 if count <= 10 else 45500
            amount = count * rate
        else:
            amount = min(count, 3)*9100 + min(max(count-3, 0), 2)*18200 + min(max(count-5, 0), 5)*31850 + max(count-10, 0)*45500
        return amount * (container["sizeFt"] // 20) * tariff["pncMultiplier"]

    def detention(days):
        count = max(0, days - tariff["ddFreeDays"])
        rates = (15000, 30000, 50000) if container["sizeFt"] == 20 else (30000, 50000, 90000)
        if tariff["ddMode"] == "retroactive":
            amount = count * rates[0 if count <= 5 else 1 if count <= 10 else 2]
        else:
            amount = min(count, 5)*rates[0] + min(max(count-5, 0), 5)*rates[1] + max(count-10, 0)*rates[2]
        return amount * tariff["ddMultiplier"]

    storage_cost, dd_cost = storage(storage_days), detention(dd_days)
    prior_storage, prior_dd = storage(max(0, (start-storage_start).days)), detention(max(0, (start-local.date()).days))
    total, sunk = storage_cost + dd_cost, prior_storage + prior_dd
    return {"storageDays": storage_days, "ddDays": dd_days, "storageCost": storage_cost, "ddCost": dd_cost,
            "priorStorageCost": prior_storage, "priorDDCost": prior_dd, "totalCost": total, "sunkCost": sunk, "incrementalCost": total-sunk}


def audit(scenario, rows, fixed, minimum):
    """Daily ledger independent of cumulative interval/blocker constraints."""
    horizon = scenario["horizonDays"]
    _, operations = parameters(scenario)
    usage = [{"truck": 0, "warehouse": 0, "staging": 0} for _ in range(horizon)]
    by_id = {container["id"]: container for container in scenario["containers"]}
    seen = set()
    require(len(rows) == len(by_id), "Incumbent must cover every known box")
    totals = {key: 0 for key in TOTALS}
    for row in rows:
        identifier = row["id"]
        require(identifier in by_id and identifier not in seen, "Unknown or duplicate incumbent row")
        seen.add(identifier)
        container = by_id[identifier]
        require(all(integer(row[field]) and 0 <= row[field] < horizon for field in FIELDS), "Incumbent date outside horizon")
        pickup, unload, returned = (row[field] for field in FIELDS)
        end = unload + container["unloadDays"] - 1
        require(pickup >= container["releaseDay"] and unload >= pickup and end <= container["dueDay"] and returned >= end + operations["returnLagDays"], "Incumbent release, precedence or deadline violation")
        require(row["sizeFt"] == container["sizeFt"] and row["unloadEndDay"] == end, "Incumbent duration/size mismatch")
        locks = fixed.get(identifier, {})
        for field in FIELDS:
            require(row[field] == locks[field] if field in locks else row[field] >= minimum, "Incumbent changed physical past or moved pending event into past")
        usage[pickup]["truck"] += 1
        usage[returned]["truck"] += 1
        for day in range(unload, end + 1):
            usage[day]["warehouse"] += 1
        weight = container["sizeFt"] // 20 if operations["stagingUnit"] == "teu" else 1
        for day in range(pickup, returned):
            usage[day]["staging"] += weight
        recomputed = fees(scenario, container, pickup, returned)
        require(all(row[key] == value for key, value in recomputed.items()), "Incumbent price differs from daily fee ledger")
        for key in TOTALS:
            totals[key] += recomputed[key]
    for day, values in enumerate(usage):
        for resource, value in values.items():
            require(value <= cap(scenario, resource, day), f"Day {day}: {resource} capacity exceeded")
    return {"valid": True, "errors": [], "objectiveCost": totals["incrementalCost"], "independentCosts": totals,
            "locksChecked": True, "resourcesAndFeesChecked": True, "usage": usage}


def solve(request):
    started = time.perf_counter()
    remaining_ms = request["deadlineUnixMs"] - time.time()*1000
    deadline = started + max(0, remaining_ms)/1000
    reserve = request.get("auditReserveMs", 2)/1000
    output = {"schemaVersion": SCHEMA, "status": "time_limit", "solverStatus": None, "solverMessage": None,
              "solver": "OR-Tools CP-SAT", "solverThreads": 1, "solverSeed": 0,
              "formulation": "independent integer dates, interval cumulative resources with exact daily blockers, element fees",
              "objectiveMode": "joint", "objectiveCost": None, "lowerBound": None, "lowerBoundSource": None, "relativeGap": None,
              "hasIncumbent": False, "provenOptimal": False, "provenInfeasible": False, "rows": [], "independentCosts": None,
              "modelSize": None, "modelWallMs": 0, "solverWallMs": 0, "independentAuditWallMs": 0,
              "solverTimeLimitMs": 0, "remainingBudgetAtReceiptMs": max(0, remaining_ms),
              "certificateScope": "current observed deterministic model and fixed physical history; not rolling-policy optimality"}
    try:
        checkpoint(deadline)
        scenario, fixed, minimum = request["scenario"], request.get("fixedEvents", {}), request.get("minEventDay", 0)
        validate(scenario, fixed, minimum)
        require(request.get("objectiveMode", scenario.get("objectiveMode", "joint")) == "joint", "CP-SAT baseline supports joint incremental fees only")
        checkpoint(deadline)
        horizon = scenario["horizonDays"]
        _, operations = parameters(scenario)
        model = cp_model.CpModel()
        dates, fee_variables = [], []
        intervals = {key: [] for key in ("truck", "warehouse", "staging")}
        demands = {key: [] for key in intervals}
        max_objective = 0
        for index, container in enumerate(scenario["containers"]):
            checkpoint(deadline)
            pickup = model.new_int_var(0, horizon-1, f"pickup_{index}")
            unload = model.new_int_var(0, horizon-1, f"unload_{index}")
            returned = model.new_int_var(0, horizon-1, f"return_{index}")
            dates.append((pickup, unload, returned))
            model.add(pickup >= container["releaseDay"])
            model.add(unload >= pickup)
            model.add(unload + container["unloadDays"] - 1 <= container["dueDay"])
            model.add(returned >= unload + container["unloadDays"] - 1 + operations["returnLagDays"])
            for field, variable in zip(FIELDS, dates[-1]):
                if field in fixed.get(container["id"], {}):
                    model.add(variable == fixed[container["id"]][field])
                else:
                    model.add(variable >= minimum)
            intervals["truck"].extend((model.new_fixed_size_interval_var(pickup, 1, f"pickup_move_{index}"),
                                        model.new_fixed_size_interval_var(returned, 1, f"return_move_{index}")))
            demands["truck"].extend((1, 1))
            intervals["warehouse"].append(model.new_fixed_size_interval_var(unload, container["unloadDays"], f"continuous_unload_{index}"))
            demands["warehouse"].append(1)
            duration = model.new_int_var(0, horizon-1, f"staging_length_{index}")
            intervals["staging"].append(model.new_interval_var(pickup, duration, returned, f"half_open_staging_{index}"))
            demands["staging"].append(container["sizeFt"]//20 if operations["stagingUnit"] == "teu" else 1)
            pickup_fees, return_fees = [], []
            for day in range(horizon):
                checkpoint(deadline)
                price = fees(scenario, container, day, day)
                values = (price["storageCost"]-price["priorStorageCost"], price["ddCost"]-price["priorDDCost"])
                for value in values:
                    require(finite(value) and float(value).is_integer() and 0 <= value <= MAX_SAFE,
                            "CP-SAT requires integer-KRW event fees within the safe-integer range; no rounding is applied")
                pickup_fees.append(int(values[0])); return_fees.append(int(values[1]))
            max_objective += max(pickup_fees) + max(return_fees)
            require(max_objective <= MAX_SAFE, "Joint objective exceeds safe-integer range")
            for variable, values, label in ((pickup, pickup_fees, "storage"), (returned, return_fees, "dd")):
                cost = model.new_int_var(min(values), max(values), f"{label}_increment_{index}")
                model.add_element(variable, values, cost)
                fee_variables.append(cost)
        for resource in intervals:
            checkpoint(deadline)
            capacity = max(cap(scenario, resource, day) for day in range(horizon))
            # Occupying max-cap[d] for each complete daily slot leaves exactly
            # cap[d] available to the true intervals. Integer boundaries retain
            # the original atomic daily semantics, including all historical days.
            for day in range(horizon):
                blocked = capacity-cap(scenario, resource, day)
                if blocked:
                    intervals[resource].append(model.new_fixed_size_interval_var(day, 1, f"{resource}_daily_blocker_{day}"))
                    demands[resource].append(blocked)
            model.add_cumulative(intervals[resource], demands[resource], capacity)
        model.minimize(sum(fee_variables))
        output["modelSize"] = {"integerVariables": len(model.proto.variables), "constraints": len(model.proto.constraints),
                               "resourceIntervals": {key: len(value) for key, value in intervals.items()}}
        output["numericalAssurance"] = {"primarySafeInteger": True, "roundsFees": False,
                                        "integerArithmeticModel": True, "objectiveLimitKRW": MAX_SAFE}
        output["modelWallMs"] = (time.perf_counter()-started)*1000
        remaining = deadline-time.perf_counter()-reserve
        if remaining <= 0:
            raise BudgetExpired("Absolute deadline exhausted before CP-SAT search")
        output["solverTimeLimitMs"] = remaining*1000
        solver = cp_model.CpSolver()
        solver.parameters.num_search_workers = 1
        solver.parameters.random_seed = 0
        solver.parameters.max_time_in_seconds = remaining
        solver.parameters.log_search_progress = False
        solver.parameters.relative_gap_limit = 0
        solver.parameters.absolute_gap_limit = 0
        search_started = time.perf_counter()
        raw_status = solver.solve(model)
        output["solverWallMs"] = (time.perf_counter()-search_started)*1000
        name = solver.status_name(raw_status)
        output.update(solverStatus=int(raw_status), solverMessage=name, reason=name,
                      lowerBound=solver.best_objective_bound if finite(solver.best_objective_bound) else None,
                      branchCount=solver.num_branches, conflictCount=solver.num_conflicts,
                      reportedSolverWallMs=solver.wall_time*1000)
        if raw_status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            rows = []
            for container, variables in zip(scenario["containers"], dates):
                checkpoint(deadline)
                pickup, unload, returned = (int(solver.value(variable)) for variable in variables)
                rows.append({"id": container["id"], "sizeFt": container["sizeFt"], "pickupDay": pickup, "unloadDay": unload,
                             "returnDay": returned, "unloadEndDay": unload+container["unloadDays"]-1,
                             **fees(scenario, container, pickup, returned)})
            audit_started = time.perf_counter()
            audited = audit(scenario, rows, fixed, minimum)
            integer_objective = sum(int(solver.value(variable)) for variable in fee_variables)
            require(integer_objective == audited["objectiveCost"], "Exact CP-SAT integer objective differs from independent daily ledger")
            require(math.isclose(solver.objective_value, integer_objective, rel_tol=0,
                                 abs_tol=1e-6+8*sys.float_info.epsilon*max(1, abs(integer_objective))),
                    "CP-SAT floating objective telemetry differs from exact integer objective")
            output.update(exactIntegerObjective=integer_objective, reportedObjectiveDouble=solver.objective_value,
                          reportedLowerBoundDouble=solver.best_objective_bound)
            if raw_status == cp_model.OPTIMAL:
                output.update(lowerBound=integer_objective, lowerBoundSource="OPTIMAL status and exact audited integer objective")
            else:
                output["lowerBoundSource"] = "native reported best_objective_bound double; not rounded"
            output["independentAuditWallMs"] = (time.perf_counter()-audit_started)*1000
            output.update(status="optimal" if raw_status == cp_model.OPTIMAL else "feasible", rows=rows,
                          hasIncumbent=True, provenOptimal=raw_status == cp_model.OPTIMAL,
                          objectiveCost=audited["objectiveCost"], independentCosts=audited["independentCosts"], incumbentAudit=audited)
            output["relativeGap"] = abs(audited["objectiveCost"]-output["lowerBound"])/max(1, abs(audited["objectiveCost"])) if output["lowerBound"] is not None else None
        elif raw_status == cp_model.INFEASIBLE:
            output.update(status="infeasible", provenInfeasible=True, lowerBound=None, proofType="CP_SAT_model_infeasible")
        elif raw_status == cp_model.MODEL_INVALID:
            output.update(status="solver_error", lowerBound=None, reason="CP-SAT rejected the model: "+solver.solution_info())
        else:
            output.update(status="time_limit", lowerBound=None, reason="CP-SAT UNKNOWN: no audited incumbent or infeasibility proof")
        # Proof and complete incumbent output construction are also charged.
        checkpoint(deadline)
    except BudgetExpired as error:
        if output["solverStatus"] is not None:
            output["discardedLateSolverTelemetry"] = {key: output.get(key) for key in ("solverStatus", "solverMessage", "lowerBound", "lowerBoundSource", "provenOptimal", "provenInfeasible")}
        if output["hasIncumbent"]:
            output["discardedLateCandidate"] = {key: output[key] for key in ("rows", "objectiveCost", "independentCosts", "provenOptimal", "lowerBound", "lowerBoundSource")}
            output["lateCandidateDiscarded"] = True
        if output["provenInfeasible"]:
            output["lateInfeasibilityProofDiscarded"] = True
        output.update(status="time_limit", reason=str(error), hasIncumbent=False, provenOptimal=False, provenInfeasible=False,
                      rows=[], objectiveCost=None, independentCosts=None, lowerBound=None, lowerBoundSource=None, relativeGap=None)
    except (ValueError, TypeError, KeyError, IndexError, RuntimeError, OverflowError) as error:
        output.update(status="solver_error", reason=str(error), hasIncumbent=False, provenOptimal=False, provenInfeasible=False,
                      rows=[], objectiveCost=None, independentCosts=None, lowerBound=None, lowerBoundSource=None)
    output["serviceWallMs"] = (time.perf_counter()-started)*1000
    output["deadlineOverrunMs"] = max(0, (time.perf_counter()-deadline)*1000)
    if output["deadlineOverrunMs"] > 0 and (output["hasIncumbent"] or output["provenInfeasible"]):
        output["discardedLateSolverTelemetry"] = {key: output.get(key) for key in ("solverStatus", "solverMessage", "lowerBound", "lowerBoundSource", "provenOptimal", "provenInfeasible")}
        if output["hasIncumbent"]:
            output["discardedLateCandidate"] = {key: output[key] for key in ("rows", "objectiveCost", "independentCosts", "provenOptimal", "lowerBound", "lowerBoundSource")}
            output["lateCandidateDiscarded"] = True
        if output["provenInfeasible"]:
            output["lateInfeasibilityProofDiscarded"] = True
        output.update(status="time_limit", reason="Final service receipt exceeded absolute deadline", hasIncumbent=False,
                      provenOptimal=False, provenInfeasible=False, rows=[], objectiveCost=None, independentCosts=None, lowerBound=None, lowerBoundSource=None, relativeGap=None)
    return output


def emit(value):
    print(json.dumps(value, ensure_ascii=False, allow_nan=False, separators=(",", ":")), flush=True)


def main():
    emit({"type": "ready", "schemaVersion": SCHEMA, "pid": os.getpid(), "solverThreads": 1, "solverSeed": 0,
          "pythonVersion": sys.version.split()[0], "ortoolsVersion": ortools.__version__,
          "serviceInitializationMs": (time.perf_counter()-BOOT_STARTED)*1000})
    for line in sys.stdin:
        request = None
        try:
            request = json.loads(line, parse_constant=lambda value: (_ for _ in ()).throw(ValueError("Nonfinite JSON constant: "+value)))
            require(isinstance(request, dict), "Request must be an object")
            require(finite(request.get("deadlineUnixMs")), "A finite absolute deadlineUnixMs is required")
            require(finite(request.get("auditReserveMs", 2)) and request.get("auditReserveMs", 2) >= 0, "auditReserveMs must be nonnegative")
            result = solve(request)
        except Exception as error:
            result = {"schemaVersion": SCHEMA, "status": "solver_error", "reason": str(error), "rows": [],
                      "hasIncumbent": False, "provenOptimal": False, "provenInfeasible": False,
                      "objectiveCost": None, "lowerBound": None, "relativeGap": None, "solverStatus": None}
        emit({"type": "result", "id": request.get("id") if isinstance(request, dict) else None, "result": result})


if __name__ == "__main__":
    main()
