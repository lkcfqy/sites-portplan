#!/usr/bin/env python3
"""Persistent independent PortPlan event-index MILP service (JSON lines).

Only scenario, execution locks and a deadline cross the protocol. No JavaScript
matrix, unrevealed event list, or future realized capacity is accepted.
"""
from __future__ import annotations

import importlib.util
import json
import math
import os
from pathlib import Path
import sys
import time
import warnings

BOOT_STARTED = time.perf_counter()
# Set before NumPy/HiGHS are loaded; the native solver option also fixes threads.
for variable in ("OMP_NUM_THREADS", "OPENBLAS_NUM_THREADS", "MKL_NUM_THREADS"):
    os.environ[variable] = "1"

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location("portplan_independent_prices_v8", ROOT / "scripts" / "certify-v4.py")
cert = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cert)
FIELDS = ("pickupDay", "unloadDay", "returnDay")
SCHEMA = "portplan-native-highs-v8"


class BudgetExpired(Exception):
    pass


def require(condition, message):
    if not condition:
        raise ValueError(message)


def checkpoint(deadline):
    if time.perf_counter() >= deadline:
        raise BudgetExpired("Whole-call budget exhausted during independent model construction")


def finite_or_none(value):
    return float(value) if cert.finite(value) else None


def validate(scenario, fixed, minimum):
    errors = cert.validate_scenario(scenario)
    require(not errors, "; ".join(errors))
    require(type(minimum) is int and 0 <= minimum <= scenario["horizonDays"], "minEventDay must be an integer within the horizon")
    require(isinstance(fixed, dict), "fixedEvents must be an object")
    ids = {c["id"] for c in scenario["containers"]}
    for identifier, locks in fixed.items():
        require(identifier in ids and isinstance(locks, dict), "Unknown or malformed execution lock container")
        for field, day in locks.items():
            require(field in FIELDS and type(day) is int and 0 <= day < minimum,
                    "Executed event locks must be integer dates strictly before minEventDay")


def domains_for(scenario, container, fixed, minimum):
    """Independent legal event domains, tightened by single-container ordering."""
    horizon = scenario["horizonDays"]
    _, operation = cert.parameters(scenario)
    offset = container["unloadDays"] - 1 + operation["returnLagDays"]
    last_start = min(container["dueDay"] - container["unloadDays"] + 1, horizon - 1 - offset)
    ranges = ((container["releaseDay"], last_start), (container["releaseDay"], last_start),
              (container["releaseDay"] + offset, horizon - 1))
    locks = fixed.get(container["id"], {})
    domains = []
    for field, (lo, hi) in zip(FIELDS, ranges):
        domains.append([locks[field]] if field in locks and lo <= locks[field] <= hi else
                       [] if field in locks else list(range(max(lo, minimum), hi + 1)))
    # Bounds propagation removes dates that cannot participate in any legal
    # pickup <= unload and unload + offset <= return tuple. It does not use
    # capacities or discard a potentially feasible complete tuple.
    while all(domains):
        before = tuple(map(len, domains))
        pickup, unload, returned = domains
        pickup = [d for d in pickup if d <= unload[-1]]
        unload = [d for d in unload if pickup and pickup[0] <= d <= returned[-1] - offset]
        returned = [d for d in returned if unload and d >= unload[0] + offset]
        domains = [pickup, unload, returned]
        if tuple(map(len, domains)) == before:
            break
    return domains


def audit(scenario, rows, fixed, minimum):
    totals = {key: sum(row[key] for row in rows) for key in cert.TOTAL_KEYS}
    objective = sum(row["incrementalCost"] for row in rows)
    result = cert.audit_policy(scenario, {"status": "feasible", "rows": rows, **totals,
                                        "objectiveMode": "joint", "objectiveCost": objective})
    errors = list(result["errors"])
    for row in rows:
        locks = fixed.get(row["id"], {})
        for field in FIELDS:
            if field in locks:
                if row[field] != locks[field]:
                    errors.append(f"{row['id']}: executed {field} changed")
            elif row[field] < minimum:
                errors.append(f"{row['id']}: unexecuted {field} moved into past")
    require(not errors, "Independent incumbent audit failed: " + "; ".join(errors))
    return {"valid": True, "errors": [], "objectiveCost": objective,
            "independentCosts": totals, "locksChecked": True, "resourcesAndFeesChecked": True}


def solve(request):
    started = time.perf_counter()
    remaining_ms = request["deadlineUnixMs"] - time.time() * 1000
    deadline = started + max(0, remaining_ms) / 1000
    reserve = request.get("auditReserveMs", 2) / 1000
    scenario, fixed, minimum = request["scenario"], request.get("fixedEvents", {}), request.get("minEventDay", 0)
    output = {"schemaVersion": SCHEMA, "status": "time_limit", "solverStatus": None,
              "solverMessage": None, "solver": "HiGHS via scipy.optimize.milp", "solverThreads": 1,
              "formulation": "independent time-indexed pickup/unload/return binaries with cumulative precedence",
              "objectiveMode": "joint", "objectiveCost": None, "lowerBound": None, "relativeGap": None,
              "hasIncumbent": False, "provenOptimal": False, "provenInfeasible": False,
              "rows": [], "independentCosts": None, "modelSize": None,
              "modelWallMs": 0, "solverWallMs": 0, "independentAuditWallMs": 0,
              "solverTimeLimitMs": 0, "remainingBudgetAtReceiptMs": max(0, remaining_ms),
              "certificateScope": "current observed deterministic model and fixed history only; not rolling-policy optimality"}
    try:
        checkpoint(deadline)
        validate(scenario, fixed, minimum)
        checkpoint(deadline)
        require(request.get("objectiveMode", scenario.get("objectiveMode", "joint")) == "joint",
                "The frozen V8 native baseline supports joint incremental fees only")
        horizon, count = scenario["horizonDays"], len(scenario["containers"])
        _, operation = cert.parameters(scenario)
        domains, variables, objective = [], [], []
        event_indices = []
        for index, container in enumerate(scenario["containers"]):
            checkpoint(deadline)
            domain = domains_for(scenario, container, fixed, minimum)
            if not all(domain):
                return {**output, "status": "infeasible", "provenInfeasible": True,
                        "proofType": "empty_legal_event_domain", "emptyDomainContainerIds": [container["id"]],
                        "reason": "No legal event dates remain after exact locks and precedence bounds",
                        "modelWallMs": (time.perf_counter() - started) * 1000,
                        "serviceWallMs": (time.perf_counter() - started) * 1000}
            domains.append(domain)
            box_indices = []
            for event_index, dates in enumerate(domain):
                indices = {}
                for day in dates:
                    checkpoint(deadline)
                    column = len(variables)
                    indices[day] = column
                    variables.append((index, event_index, day))
                    # Costs are separable by pickup/return dates. Python's
                    # explicit daily charge enumeration is independent of JS.
                    if event_index == 1:
                        cost = 0
                    else:
                        prices = cert.independent_costs(scenario, container, day, day)
                        cost = prices["storageCost"] - prices["priorStorageCost"] if event_index == 0 else prices["ddCost"] - prices["priorDDCost"]
                    require(math.isfinite(cost) and float(cost).is_integer() and abs(cost) <= cert.MAX_SAFE_INTEGER,
                            "Native baseline requires integer-KRW event fees within the safe-integer range; no rounding is applied")
                    objective.append(cost)
                box_indices.append(indices)
            event_indices.append(box_indices)
        max_objective = sum(max(objective[i] for i in box[0].values()) + max(objective[i] for i in box[2].values()) for box in event_indices)
        require(max_objective <= cert.MAX_SAFE_INTEGER, "Joint fee sum exceeds safe-integer range")
        output["numericalAssurance"] = {"primarySafeInteger": True, "roundsFees": False,
                                        "optimalityUsesNativeNumericalTolerances": True}
        row_indices, column_indices, values, lower, upper = [], [], [], [], []

        def constraint(terms, lo=-cert.np.inf, hi=cert.np.inf):
            row = len(lower)
            for column, value in terms:
                if value:
                    row_indices.append(row); column_indices.append(column); values.append(value)
            lower.append(lo); upper.append(hi)

        for index, container in enumerate(scenario["containers"]):
            checkpoint(deadline)
            pickup, unload, returned = event_indices[index]
            for indices in (pickup, unload, returned):
                constraint(((column, 1) for column in indices.values()), 1, 1)
            offset = container["unloadDays"] - 1 + operation["returnLagDays"]
            # At each cut, an unload must have a pickup by that cut, and a
            # return must have an unload at least `offset` days earlier. These
            # cumulative inequalities strengthen simple expected-date bounds.
            for day in range(horizon):
                checkpoint(deadline)
                constraint([(column, 1) for date, column in unload.items() if date <= day] +
                           [(column, -1) for date, column in pickup.items() if date <= day], hi=0)
                constraint([(column, 1) for date, column in returned.items() if date <= day] +
                           [(column, -1) for date, column in unload.items() if date + offset <= day], hi=0)
        for day in range(horizon):
            checkpoint(deadline)
            truck, warehouse, staging = [], [], []
            for index, container in enumerate(scenario["containers"]):
                pickup, unload, returned = event_indices[index]
                if day in pickup:
                    truck.append((pickup[day], 1))
                if day in returned:
                    # Separate pickup/return columns preserve TWO same-day
                    # movements, including when returnLagDays is zero.
                    truck.append((returned[day], 1))
                warehouse.extend((column, 1) for date, column in unload.items() if date <= day < date + container["unloadDays"])
                weight = container["sizeFt"] // 20 if operation["stagingUnit"] == "teu" else 1
                staging.extend((column, weight) for date, column in pickup.items() if date <= day)
                staging.extend((column, -weight) for date, column in returned.items() if date <= day)
            constraint(truck, hi=cert.capacity_at(scenario, "truckCapacity", day))
            constraint(warehouse, hi=cert.capacity_at(scenario, "warehouseCapacity", day))
            # For integer precedence-feasible events this cumulative difference
            # is exactly [pickup, return), including every historical day.
            constraint(staging, hi=cert.capacity_at(scenario, "stagingCapacity", day))
        checkpoint(deadline)
        matrix = cert.coo_array((cert.np.asarray(values, dtype=cert.np.float64),
                                 (cert.np.asarray(row_indices, dtype=cert.np.int32), cert.np.asarray(column_indices, dtype=cert.np.int32))),
                                shape=(len(lower), len(variables))).tocsc()
        model = cert.LinearConstraint(matrix, cert.np.asarray(lower), cert.np.asarray(upper))
        output["modelSize"] = {"binaryColumns": len(variables), "constraints": len(lower), "nonzeros": matrix.nnz}
        output["modelWallMs"] = (time.perf_counter() - started) * 1000
        remaining = deadline - time.perf_counter() - reserve
        if remaining <= 0:
            raise BudgetExpired("Whole-call budget exhausted before native HiGHS solve")
        output["solverTimeLimitMs"] = remaining * 1000
        solver_started = time.perf_counter()
        with warnings.catch_warnings(record=True) as recorded:
            warnings.simplefilter("always")
            raw = cert.milp(c=cert.np.asarray(objective), integrality=cert.np.ones(len(variables), dtype=cert.np.uint8),
                            bounds=cert.Bounds(0, 1), constraints=model,
                            options={"time_limit": remaining, "mip_rel_gap": 0, "presolve": True,
                                     "threads": 1, "random_seed": 0, "disp": False})
        output["solverWallMs"] = (time.perf_counter() - solver_started) * 1000
        status = {0: "optimal", 1: "time_limit", 2: "infeasible", 3: "unbounded", 4: "solver_error"}.get(raw.status, "solver_error")
        output.update(status=status, solverStatus=int(raw.status), solverMessage=raw.message,
                      reason=raw.message, provenInfeasible=raw.status == 2, provenOptimal=raw.status == 0,
                      proofType="HiGHS_model_infeasible" if raw.status == 2 else "HiGHS_MILP",
                      lowerBound=finite_or_none(getattr(raw, "mip_dual_bound", None)),
                      relativeGap=finite_or_none(getattr(raw, "mip_gap", None)),
                      nodeCount=int(raw.mip_node_count) if cert.finite(getattr(raw, "mip_node_count", None)) else None,
                      solverOptionWarnings=[str(warning.message) for warning in recorded])
        if raw.x is not None:
            require(cert.np.max(cert.np.abs(raw.x - cert.np.round(raw.x))) <= 1e-5, "HiGHS returned fractional event columns")
            dates = [{} for _ in range(count)]
            for column in cert.np.flatnonzero(raw.x > 0.5):
                index, event_index, day = variables[column]
                field = FIELDS[event_index]
                require(field not in dates[index], "HiGHS returned duplicate selected events")
                dates[index][field] = day
            require(all(set(row) == set(FIELDS) for row in dates), "HiGHS returned an incomplete event assignment")
            rows = []
            for container, row in zip(scenario["containers"], dates):
                rows.append({"id": container["id"], "sizeFt": container["sizeFt"], **row,
                             "unloadEndDay": row["unloadDay"] + container["unloadDays"] - 1,
                             **cert.independent_costs(scenario, container, row["pickupDay"], row["returnDay"])})
            audit_started = time.perf_counter()
            independent_audit = audit(scenario, rows, fixed, minimum)
            require(cert.integer_objective_close(float(raw.fun), independent_audit["objectiveCost"]),
                    "Native objective differs from independent daily-fee audit")
            output.update(hasIncumbent=True, rows=rows, objectiveCost=independent_audit["objectiveCost"],
                          independentCosts=independent_audit["independentCosts"], incumbentAudit=independent_audit)
            output["independentAuditWallMs"] = (time.perf_counter() - audit_started) * 1000
        require(not output["provenOptimal"] or output["hasIncumbent"], "Optimal native status without audited incumbent")
        require(not output["provenInfeasible"] or not output["hasIncumbent"], "Infeasible native status with incumbent")
    except BudgetExpired as error:
        output.update(status="time_limit", reason=str(error), provenOptimal=False, provenInfeasible=False)
    except (ValueError, TypeError, KeyError, IndexError, RuntimeError) as error:
        output.update(status="solver_error", reason=str(error), provenOptimal=False, provenInfeasible=False,
                      hasIncumbent=False, rows=[], objectiveCost=None, independentCosts=None)
    output["serviceWallMs"] = (time.perf_counter() - started) * 1000
    if not output["modelWallMs"]:
        output["modelWallMs"] = output["serviceWallMs"] - output["solverWallMs"] - output["independentAuditWallMs"]
    output["deadlineOverrunMs"] = max(0, (time.perf_counter() - deadline) * 1000)
    return output


def emit(value):
    print(json.dumps(value, ensure_ascii=False, allow_nan=False, separators=(",", ":")), flush=True)


def main():
    emit({"type": "ready", "schemaVersion": SCHEMA, "pid": os.getpid(), "solverThreads": 1,
          "pythonVersion": sys.version.split()[0], "scipyVersion": cert.scipy.__version__, "numpyVersion": cert.np.__version__,
          "serviceInitializationMs": (time.perf_counter() - BOOT_STARTED) * 1000})
    for line in sys.stdin:
        request = None
        try:
            request = json.loads(line, parse_constant=lambda value: (_ for _ in ()).throw(ValueError("Nonfinite JSON constant: " + value)))
            require(isinstance(request, dict), "Protocol request must be an object")
            require(cert.finite(request.get("deadlineUnixMs")), "Protocol request requires finite deadlineUnixMs")
            require(cert.finite(request.get("auditReserveMs", 2)) and request.get("auditReserveMs", 2) >= 0,
                    "auditReserveMs must be nonnegative")
            result = solve(request)
        except Exception as error:
            result = {"schemaVersion": SCHEMA, "status": "solver_error", "reason": str(error), "rows": [],
                      "hasIncumbent": False, "provenOptimal": False, "provenInfeasible": False,
                      "objectiveCost": None, "lowerBound": None, "relativeGap": None, "solverStatus": None}
        emit({"type": "result", "id": request.get("id") if isinstance(request, dict) else None, "result": result})


if __name__ == "__main__":
    main()
