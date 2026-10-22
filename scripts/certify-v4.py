#!/usr/bin/env python3
"""Independent daily PortPlan verifier and trip-column MILP (SciPy/HiGHS).

This implementation reads scenario/result JSON only. It never imports the JS
engine, the GLPK model, or JS-generated coefficients. It is an internal
independent implementation, not third-party certification of operational data.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
import sys
import time
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import numpy as np
import scipy
from scipy.optimize import Bounds, LinearConstraint, milp
from scipy.sparse import coo_array


SCHEMA_VERSION = "portplan-independent-certificate-v4"
TARIFF_DEFAULTS = {
    "pncFreeDays": 4, "ddFreeDays": 10,
    "pncMultiplier": 1, "ddMultiplier": 1,
    "pncMode": "retroactive", "ddMode": "progressive",
}
OPERATION_DEFAULTS = {"returnLagDays": 1, "stagingUnit": "container"}
MODES = ("joint", "storageOnly", "ddOnly")
COST_KEYS = ("storageDays", "ddDays", "storageCost", "ddCost",
             "priorStorageCost", "priorDDCost", "totalCost", "sunkCost", "incrementalCost")
TOTAL_KEYS = ("storageCost", "ddCost", "totalCost", "sunkCost", "incrementalCost")
CAP_KEYS = ("truckCapacity", "warehouseCapacity", "stagingCapacity")
MAX_SAFE_INTEGER = 2 ** 53 - 1
COST_ABSOLUTE_TOLERANCE = 1e-12
COST_RELATIVE_TOLERANCE = 1e-10
BOUND_ABSOLUTE_TOLERANCE = 1e-6
BOUND_RELATIVE_TOLERANCE = 1e-10
DAY_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}$")
TIME_PATTERN = re.compile(
    r"^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?"
    r"(Z|([+-])(\d{2}):(\d{2}))$")
SEOUL = timezone(timedelta(hours=9))


def integer(value):
    return isinstance(value, int) and not isinstance(value, bool)


def finite(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def close(actual, expected):
    return finite(actual) and abs(actual - expected) <= max(COST_ABSOLUTE_TOLERANCE, abs(expected) * COST_RELATIVE_TOLERANCE)


def bounds_close(actual, expected):
    # A numerical consistency check cannot certify exact floating-point optima.
    return finite(actual) and abs(actual - expected) <= max(BOUND_ABSOLUTE_TOLERANCE, abs(expected) * BOUND_RELATIVE_TOLERANCE)


def integer_objective_close(actual, expected):
    return finite(actual) and abs(actual - expected) <= BOUND_ABSOLUTE_TOLERANCE


def parse_date(value):
    if not isinstance(value, str) or not DAY_PATTERN.fullmatch(value):
        raise ValueError("Expected YYYY-MM-DD")
    return date.fromisoformat(value)


def discharge_dates(value):
    match = TIME_PATTERN.fullmatch(value) if isinstance(value, str) else None
    if not match:
        raise ValueError("dischargeDateTime requires an ISO timestamp and explicit UTC offset")
    parse_date(match[1])
    hour, minute, second = int(match[2]), int(match[3]), int(match[4] or 0)
    offset_hour, offset_minute = int(match[7] or 0), int(match[8] or 0)
    if hour > 23 or minute > 59 or second > 59 or offset_hour > 14 or offset_minute > 59:
        raise ValueError("Invalid clock time or UTC offset")
    if offset_hour == 14 and offset_minute:
        raise ValueError("UTC offset must not exceed 14 hours")
    local = datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(SEOUL)
    discharged = local.date()
    storage_start = discharged + timedelta(days=int(local.hour >= 8))
    return discharged, storage_start


def parameters(scenario):
    return ({**TARIFF_DEFAULTS, **scenario.get("tariff", {})},
            {**OPERATION_DEFAULTS, **scenario.get("operations", {})})


def validate_scenario(scenario):
    errors = []
    if not isinstance(scenario, dict):
        return ["scenario must be an object"]
    try:
        horizon_start = parse_date(scenario.get("horizonStart"))
    except (ValueError, TypeError) as error:
        errors.append(f"horizonStart: {error}")
        horizon_start = None
    horizon = scenario.get("horizonDays")
    if not integer(horizon) or not 2 <= horizon <= 31:
        errors.append("horizonDays must be an integer from 2 to 31")
    for key in ("tariff", "operations"):
        if key in scenario and not isinstance(scenario[key], dict):
            errors.append(f"{key} must be an object")
    if any(key in scenario and not isinstance(scenario[key], dict) for key in ("tariff", "operations")):
        tariff, operations = TARIFF_DEFAULTS, OPERATION_DEFAULTS
    else:
        tariff, operations = parameters(scenario)
    for key in ("pncFreeDays", "ddFreeDays"):
        if not integer(tariff[key]) or not 0 <= tariff[key] <= 365:
            errors.append(f"{key} must be an integer from 0 to 365")
    for key in ("pncMultiplier", "ddMultiplier"):
        if not finite(tariff[key]) or not 0 <= tariff[key] <= 100:
            errors.append(f"{key} must be finite and between 0 and 100")
    for key in ("pncMode", "ddMode"):
        if tariff[key] not in ("retroactive", "progressive"):
            errors.append(f"{key} must be retroactive or progressive")
    if not integer(operations["returnLagDays"]) or operations["returnLagDays"] not in (0, 1):
        errors.append("returnLagDays must be 0 or 1")
    if operations["stagingUnit"] not in ("container", "teu"):
        errors.append("stagingUnit must be container or teu")
    if scenario.get("objectiveMode", "joint") not in MODES:
        errors.append("objectiveMode must be joint, storageOnly or ddOnly")
    for key in CAP_KEYS:
        capacity = scenario.get(key)
        if isinstance(capacity, list):
            valid = len(capacity) == horizon and all(integer(v) and v >= 0 for v in capacity)
        else:
            valid = integer(capacity) and capacity >= 0
        if not valid:
            errors.append(f"{key} must be a nonnegative integer or one such integer per horizon day")
    containers = scenario.get("containers")
    if not isinstance(containers, list) or not 1 <= len(containers) <= 100:
        errors.append("containers must contain 1 to 100 objects")
        return errors
    seen = set()
    for container in containers:
        if not isinstance(container, dict):
            errors.append("Each container must be an object")
            continue
        identifier = container.get("id")
        if not isinstance(identifier, str) or not identifier or identifier in seen:
            errors.append("Container IDs must be nonempty unique strings")
        if isinstance(identifier, str):
            seen.add(identifier)
        if not integer(container.get("sizeFt")) or container["sizeFt"] not in (20, 40):
            errors.append(f"{identifier}: sizeFt must be 20 or 40")
        for key in ("releaseDay", "dueDay"):
            value = container.get(key)
            if not integer(value) or not integer(horizon) or not 0 <= value < horizon:
                errors.append(f"{identifier}: {key} must be within the horizon")
        duration = container.get("unloadDays")
        if not integer(duration) or not integer(horizon) or not 1 <= duration < horizon:
            errors.append(f"{identifier}: unloadDays must be from 1 to horizonDays - 1")
        try:
            discharged, _ = discharge_dates(container.get("dischargeDateTime"))
            if horizon_start and integer(container.get("releaseDay")) and container["releaseDay"] < (discharged - horizon_start).days:
                errors.append(f"{identifier}: releaseDay is before vessel discharge")
        except (TypeError, ValueError, OverflowError) as error:
            errors.append(f"{identifier}: {error}")
    return errors


def charge(total_days, free_days, thresholds, rates, mode, multiplier):
    days = max(0, total_days - free_days)
    if not days:
        return 0.0
    def daily_rate(day):
        return next(rate for end, rate in zip(thresholds, rates) if day <= end)
    # Explicit daily enumeration differs from the JS engine's piecewise algebra.
    amount = sum(daily_rate(days if mode == "retroactive" else day) for day in range(1, days + 1))
    return amount * multiplier


def independent_costs(scenario, container, pickup, returned):
    tariff, _ = parameters(scenario)
    start = parse_date(scenario["horizonStart"])
    discharged, storage_start = discharge_dates(container["dischargeDateTime"])
    storage_days = max(0, (start - storage_start).days + pickup + 1)
    dd_days = max(0, (start - discharged).days + returned + 1)
    def storage(days):
        return charge(days, tariff["pncFreeDays"], (3, 5, 10, math.inf),
                      (9100, 18200, 31850, 45500), tariff["pncMode"],
                      tariff["pncMultiplier"] * container["sizeFt"] / 20)
    def dd(days):
        rates = (15000, 30000, 50000) if container["sizeFt"] == 20 else (30000, 50000, 90000)
        return charge(days, tariff["ddFreeDays"], (5, 10, math.inf), rates,
                      tariff["ddMode"], tariff["ddMultiplier"])
    storage_cost, dd_cost = storage(storage_days), dd(dd_days)
    prior_storage = storage(max(0, (start - storage_start).days))
    prior_dd = dd(max(0, (start - discharged).days))
    return {"storageDays": storage_days, "ddDays": dd_days,
            "storageCost": storage_cost, "ddCost": dd_cost,
            "priorStorageCost": prior_storage, "priorDDCost": prior_dd,
            "totalCost": storage_cost + dd_cost, "sunkCost": prior_storage + prior_dd,
            "incrementalCost": storage_cost + dd_cost - prior_storage - prior_dd}


def objective(costs, mode):
    if mode == "storageOnly":
        return costs["storageCost"] - costs["priorStorageCost"]
    if mode == "ddOnly":
        return costs["ddCost"] - costs["priorDDCost"]
    return costs["incrementalCost"]


def capacity_at(scenario, key, day):
    capacity = scenario[key]
    return capacity[day] if isinstance(capacity, list) else capacity


def audit_policy(scenario, result, mode=None):
    if not isinstance(result, dict):
        return {"valid": False, "errors": ["Policy result must be an object"], "audited": False}
    mode = mode or result.get("objectiveMode", scenario.get("objectiveMode", "joint"))
    if mode not in MODES:
        return {"valid": False, "errors": ["Invalid policy objectiveMode"], "audited": False}
    errors = []
    if result.get("status") not in ("optimal", "feasible", "infeasible", "time_limit", "hard_time_limit", "no_feasible_schedule_found", "worker_error", "audit_failed"):
        errors.append("Unrecognized policy result status")
    if result.get("executionConstraints") is not None:
        errors.append("Execution-locked/rolling results are outside this static certificate scope")
    rows = result.get("rows")
    has_rows = isinstance(rows, list) and bool(rows)
    claimed_feasible = result.get("status") in ("optimal", "feasible")
    if not has_rows and not claimed_feasible:
        if not isinstance(rows, list):
            errors.append("Failure result must expose an empty rows array")
        for key in TOTAL_KEYS:
            if result.get(key) is not None:
                errors.append(f"Failure result {key} must be null; a failed plan has no cost")
        if result.get("objectiveCost") is not None:
            errors.append("Failure result objectiveCost must be null or omitted")
        return {"valid": not errors, "errors": errors, "audited": False,
                "status": "no_complete_candidate", "candidateStatus": result.get("status"), "objectiveMode": mode,
                "objectiveCost": None, "independentCosts": None}
    if not isinstance(rows, list):
        rows = []
    if not claimed_feasible and result.get("status") not in ("time_limit", "hard_time_limit"):
        errors.append("Complete rows contradict the reported policy status")
    if len(rows) != len(scenario["containers"]):
        errors.append("Schedule does not cover every container exactly once")
    _, operations = parameters(scenario)
    by_id = {container["id"]: container for container in scenario["containers"]}
    seen = set()
    usage = [{"truck": 0, "warehouse": 0, "staging": 0} for _ in range(scenario["horizonDays"])]
    totals = {key: 0.0 for key in TOTAL_KEYS}
    primary = 0.0
    independent_rows = []
    for row in rows:
        if not isinstance(row, dict):
            errors.append("Schedule rows must be objects")
            continue
        identifier = row.get("id")
        if not isinstance(identifier, str) or identifier not in by_id or identifier in seen:
            errors.append(f"Unknown or duplicate container {identifier}")
            continue
        seen.add(identifier)
        container = by_id[identifier]
        days = tuple(row.get(key) for key in ("pickupDay", "unloadDay", "returnDay"))
        if not all(integer(day) and 0 <= day < scenario["horizonDays"] for day in days):
            errors.append(f"{identifier}: days must be integer indices within the horizon")
            continue
        pickup, unload, returned = days
        end = unload + container["unloadDays"] - 1
        if pickup < container["releaseDay"] or unload < pickup or returned < end + operations["returnLagDays"]:
            errors.append(f"{identifier}: release or pickup/unload/return precedence violated")
        if end > container["dueDay"] or end >= scenario["horizonDays"]:
            errors.append(f"{identifier}: unload completion deadline or horizon violated")
        if row.get("unloadEndDay") != end:
            errors.append(f"{identifier}: unloadEndDay mismatch")
        if row.get("sizeFt") != container["sizeFt"]:
            errors.append(f"{identifier}: sizeFt mismatch")
        if "dueDay" in row and row["dueDay"] != container["dueDay"]:
            errors.append(f"{identifier}: dueDay mismatch")
        if "late" in row and row["late"] is not False:
            errors.append(f"{identifier}: late must be false for a feasible plan")
        for key, day in (("pickupDate", pickup), ("unloadDate", unload), ("returnDate", returned)):
            if key in row and row[key] != (parse_date(scenario["horizonStart"]) + timedelta(days=day)).isoformat():
                errors.append(f"{identifier}: {key} mismatch")
        usage[pickup]["truck"] += 1
        usage[returned]["truck"] += 1
        for day in range(unload, min(end + 1, scenario["horizonDays"])):
            usage[day]["warehouse"] += 1
        weight = container["sizeFt"] / 20 if operations["stagingUnit"] == "teu" else 1
        for day in range(pickup, returned):
            usage[day]["staging"] += weight
        costs = independent_costs(scenario, container, pickup, returned)
        for key in COST_KEYS:
            if not close(row.get(key), costs[key]):
                errors.append(f"{identifier}: {key} expected {costs[key]}, received {row.get(key)}")
        independent_rows.append({"id": identifier, "pickupDay": pickup, "unloadDay": unload,
                                 "returnDay": returned, **costs})
        for key in TOTAL_KEYS:
            totals[key] += costs[key]
        primary += objective(costs, mode)
    if seen != set(by_id):
        errors.append("Container coverage mismatch")
    for day, amounts in enumerate(usage):
        for resource, key in zip(("truck", "warehouse", "staging"), CAP_KEYS):
            if amounts[resource] > capacity_at(scenario, key, day):
                errors.append(f"Day {day}: {resource} capacity exceeded ({amounts[resource]} > {capacity_at(scenario, key, day)})")
    for key in TOTAL_KEYS:
        if not close(result.get(key), totals[key]):
            errors.append(f"Total {key} expected {totals[key]}, received {result.get(key)}")
    if not close(result.get("objectiveCost"), primary):
        errors.append(f"objectiveCost expected {primary}, received {result.get('objectiveCost')}")
    if "lateCount" in result and result["lateCount"] != 0:
        errors.append("lateCount must be zero for a complete feasible plan")
    if "usage" in result:
        reported = result["usage"]
        if not isinstance(reported, list) or len(reported) != len(usage):
            errors.append("Daily usage must contain every horizon day")
        else:
            for day, amounts in enumerate(usage):
                if not isinstance(reported[day], dict):
                    errors.append(f"Day {day}: reported usage must be an object")
                    continue
                for resource, expected in amounts.items():
                    if not close(reported[day].get(resource), expected):
                        errors.append(f"Day {day}: reported {resource} usage mismatch")
    return {"valid": not errors, "errors": errors, "audited": True, "status": "audited_complete_candidate", "candidateStatus": result.get("status"),
            "objectiveMode": mode, "objectiveCost": primary,
            "independentCosts": totals, "rows": independent_rows, "usage": usage}


def enumerate_trips(scenario):
    """One column for each legal (container, pickup, unload, return) tuple."""
    _, operations = parameters(scenario)
    horizon = scenario["horizonDays"]
    columns = []
    domains = []
    for index, container in enumerate(scenario["containers"]):
        domain = []
        duration = container["unloadDays"]
        for pickup in range(container["releaseDay"], horizon):
            last_start = min(container["dueDay"] - duration + 1,
                             horizon - duration - operations["returnLagDays"])
            for unload in range(pickup, last_start + 1):
                for returned in range(unload + duration - 1 + operations["returnLagDays"], horizon):
                    # Repeated (p,r) costs are computed independently once per box.
                    domain.append(len(columns))
                    columns.append((index, pickup, unload, returned))
        domains.append(domain)
    return columns, domains


def solve_certificate(scenario, mode, time_limit):
    started = time.perf_counter()
    columns, domains = enumerate_trips(scenario)
    horizon, count = scenario["horizonDays"], len(scenario["containers"])
    metadata = {"objectiveMode": mode, "timeLimitSeconds": time_limit,
                "modelSize": {"binaryColumns": len(columns), "constraints": count + 3 * horizon},
                "formulation": "independent legal-trip set partitioning",
                "objectiveCost": None, "lowerBound": None, "relativeGap": None,
                "rows": [], "independentCosts": None,
                "numericalAssurance": {"primarySafeInteger": None,
                    "costComparisonTolerance": {"absolute": COST_ABSOLUTE_TOLERANCE, "relative": COST_RELATIVE_TOLERANCE},
                    "boundComparisonTolerance": {"absolute": BOUND_ABSOLUTE_TOLERANCE, "relative": BOUND_RELATIVE_TOLERANCE}}}
    if any(not domain for domain in domains):
        return {**metadata, "status": "infeasible", "certificateStatus": "proven_infeasible",
                "reason": "At least one container has no legal pickup/unload/return tuple",
                "wallSeconds": time.perf_counter() - started, "solverWallSeconds": 0.0,
                "hasIncumbent": False, "provenOptimal": False, "solverOptimal": False}
    _, operations = parameters(scenario)
    row_indices, column_indices, values = [], [], []
    costs, primary = [], []
    cached_costs = {}
    for column, (index, pickup, unload, returned) in enumerate(columns):
        container = scenario["containers"][index]
        cache_key = (index, pickup, returned)
        if cache_key not in cached_costs:
            cached_costs[cache_key] = independent_costs(scenario, container, pickup, returned)
        cost = cached_costs[cache_key]
        costs.append(cost)
        primary.append(objective(cost, mode))
        coefficients = [(index, 1), (count + pickup, 1), (count + returned, 1)]
        coefficients.extend((count + horizon + day, 1) for day in range(unload, unload + container["unloadDays"]))
        weight = container["sizeFt"] / 20 if operations["stagingUnit"] == "teu" else 1
        coefficients.extend((count + 2 * horizon + day, weight) for day in range(pickup, returned))
        for row, value in coefficients:
            row_indices.append(row)
            column_indices.append(column)
            values.append(value)
    safe_integer = (all(float(value).is_integer() and abs(value) <= MAX_SAFE_INTEGER for value in primary)
                    and sum(max(abs(primary[column]) for column in domain) for domain in domains) <= MAX_SAFE_INTEGER)
    metadata["numericalAssurance"].update(primarySafeInteger=safe_integer,
        interpretation="Integer-valued objective within JavaScript safe integer range" if safe_integer else
                       "Floating-point objective: HiGHS status and bound consistency use numerical tolerances; exact mathematical optimality is not certified")
    # COO -> CSC sums pickup+return duplicates, retaining two same-day moves.
    matrix = coo_array((np.asarray(values, dtype=np.float64),
                        (np.asarray(row_indices, dtype=np.int32), np.asarray(column_indices, dtype=np.int32))),
                       shape=(count + 3 * horizon, len(columns))).tocsc()
    lower = np.r_[np.ones(count), np.full(3 * horizon, -np.inf)]
    upper = np.r_[np.ones(count), [capacity_at(scenario, key, day) for key in CAP_KEYS for day in range(horizon)]]
    solver_started = time.perf_counter()
    try:
        result = milp(c=np.asarray(primary), integrality=np.ones(len(columns), dtype=np.uint8),
                      bounds=Bounds(0, 1), constraints=LinearConstraint(matrix, lower, upper),
                      options={"time_limit": time_limit, "mip_rel_gap": 0.0, "presolve": True})
    except Exception as error:
        return {**metadata, "status": "solver_error", "certificateStatus": "no_certificate",
                "reason": str(error), "wallSeconds": time.perf_counter() - started,
                "solverWallSeconds": time.perf_counter() - solver_started,
                "hasIncumbent": False, "provenOptimal": False, "solverOptimal": False}
    status = {0: "optimal", 1: "time_limit", 2: "infeasible", 3: "unbounded", 4: "solver_error"}.get(result.status, "solver_error")
    output = {**metadata, "status": status, "solverStatus": int(result.status), "reason": result.message,
              "wallSeconds": time.perf_counter() - started,
              "solverWallSeconds": time.perf_counter() - solver_started,
              "hasIncumbent": False, "solverOptimal": result.status == 0, "provenOptimal": result.status == 0 and safe_integer,
              "nodeCount": int(result.mip_node_count) if finite(getattr(result, "mip_node_count", None)) else None}
    dual = getattr(result, "mip_dual_bound", None)
    gap = getattr(result, "mip_gap", None)
    output["lowerBound"] = float(dual) if finite(dual) else None
    output["relativeGap"] = float(gap) if finite(gap) else None
    if result.x is not None:
        if np.max(np.abs(result.x - np.round(result.x))) > 1e-5:
            output.update(status="solver_error", certificateStatus="no_certificate", provenOptimal=False, solverOptimal=False,
                          reason="HiGHS returned noninteger columns")
            return output
        selected = np.flatnonzero(result.x > .5)
        selected_rows = []
        for column in selected:
            index, pickup, unload, returned = columns[column]
            container = scenario["containers"][index]
            selected_rows.append({"id": container["id"], "sizeFt": container["sizeFt"],
                                  "pickupDay": pickup, "unloadDay": unload,
                                  "unloadEndDay": unload + container["unloadDays"] - 1,
                                  "returnDay": returned, **costs[column]})
        totals = {key: sum(row[key] for row in selected_rows) for key in TOTAL_KEYS}
        primary_value = sum(objective(row, mode) for row in selected_rows)
        audit = audit_policy(scenario, {"status": "feasible", "rows": selected_rows, **totals,
                                        "objectiveMode": mode, "objectiveCost": primary_value})
        if not audit["valid"] or not close(float(result.fun), primary_value):
            output.update(status="solver_error", certificateStatus="no_certificate",
                          provenOptimal=False, solverOptimal=False, reason="Independent HiGHS incumbent audit failed", errors=audit["errors"])
            return output
        output.update(hasIncumbent=True, rows=selected_rows, independentCosts=totals, objectiveCost=primary_value)
    if output["solverOptimal"] and not output["hasIncumbent"]:
        output.update(status="solver_error", provenOptimal=False, solverOptimal=False, reason="Optimal solver status without an audited incumbent")
    output["certificateStatus"] = ("proven_optimal" if output["provenOptimal"] else
                                   "solver_optimal_with_numeric_tolerance" if output["solverOptimal"] else
                                   "proven_infeasible" if status == "infeasible" else
                                   "feasible_with_bound" if output["hasIncumbent"] and output["lowerBound"] is not None else
                                   "feasible_only" if output["hasIncumbent"] else "no_certificate")
    return output


def certify_case(case, time_limit):
    identifier = case.get("id") if isinstance(case, dict) else None
    scenario = case.get("scenario") if isinstance(case, dict) else None
    errors = validate_scenario(scenario)
    output = {"id": identifier, "valid": False, "errors": errors, "policyAudits": {}, "certificates": {}}
    if not isinstance(identifier, str) or not identifier:
        errors.append("Case id must be a nonempty string")
    if errors:
        return output
    policies = case.get("policies")
    if not isinstance(policies, dict):
        output["errors"].append("policies must be an object")
        return output
    modes = {scenario.get("objectiveMode", "joint")}
    for name, result in policies.items():
        audit = audit_policy(scenario, result)
        output["policyAudits"][name] = audit
        if audit["audited"] and audit.get("objectiveMode") in MODES:
            modes.add(audit["objectiveMode"])
        if not audit["valid"]:
            output["errors"].extend(f"{name}: {error}" for error in audit["errors"])
    for mode in MODES:
        if mode in modes:
            output["certificates"][mode] = solve_certificate(scenario, mode, time_limit)
    for name, audit in output["policyAudits"].items():
        if isinstance(policies[name], dict) and policies[name].get("status") == "infeasible" and audit.get("objectiveMode") in output["certificates"]:
            certificate = output["certificates"][audit["objectiveMode"]]
            if certificate["hasIncumbent"]:
                contradiction = "Claimed infeasibility contradicts an independently audited feasible solution"
                audit["valid"] = False
                audit["errors"].append(contradiction)
                output["errors"].append(f"{name}: {contradiction}")
        if not audit["valid"] or not audit["audited"]:
            continue
        certificate = output["certificates"][audit["objectiveMode"]]
        value = audit["objectiveCost"]
        contradictions = []
        if certificate["status"] == "infeasible":
            contradictions.append("Independent HiGHS model is proven infeasible but candidate is feasible")
        comparison_close = integer_objective_close if certificate["numericalAssurance"]["primarySafeInteger"] else bounds_close
        if certificate["lowerBound"] is not None and value < certificate["lowerBound"] and not comparison_close(value, certificate["lowerBound"]):
            contradictions.append(f"Candidate objective {value} is below independent lower bound {certificate['lowerBound']}")
        if policies[name].get("status") == "optimal" and certificate["provenOptimal"] and not comparison_close(value, certificate["objectiveCost"]):
            contradictions.append(f"Claimed optimal objective {value} differs from independent optimum {certificate['objectiveCost']}")
        if policies[name].get("status") == "optimal" and certificate["hasIncumbent"] and value > certificate["objectiveCost"] and not comparison_close(value, certificate["objectiveCost"]):
            contradictions.append("A better independent feasible solution contradicts the optimality claim")
        audit["certificateComparison"] = {
            "status": "contradiction" if contradictions else
                      "verified_optimal" if certificate["provenOptimal"] and comparison_close(value, certificate["objectiveCost"]) else
                      "bounds_consistent_with_numeric_tolerance" if certificate["lowerBound"] is not None and not certificate["numericalAssurance"]["primarySafeInteger"] else
                      "bounds_consistent" if certificate["lowerBound"] is not None else "unresolved",
            "lowerBound": certificate["lowerBound"], "independentIncumbentObjectiveCost": certificate["objectiveCost"],
            "absoluteGapToLowerBound": max(0.0, value - certificate["lowerBound"]) if certificate["lowerBound"] is not None else None,
            "numericalAssurance": certificate["numericalAssurance"],
        }
        if contradictions:
            audit["valid"] = False
            audit["errors"].extend(contradictions)
            output["errors"].extend(f"{name}: {error}" for error in contradictions)
    for mode, certificate in output["certificates"].items():
        if certificate["status"] in ("solver_error", "unbounded"):
            output["errors"].append(f"{mode}: certificate solver failed: {certificate['reason']}")
    output["valid"] = not output["errors"]
    return output


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, help="Absolute path to JSON {cases:[{id,scenario,policies}]}")
    parser.add_argument("--output", help="Optional output JSON path; without it the report is printed")
    parser.add_argument("--time-limit", type=float, default=2.0, help="HiGHS time limit per case/objective mode, seconds (default: 2)")
    parser.add_argument("--max-cases", type=int, default=12, help="Certify the first N input cases (default: 12)")
    args = parser.parse_args(argv)
    if not Path(args.input).is_absolute():
        parser.error("--input must be an absolute path")
    if not math.isfinite(args.time_limit) or args.time_limit <= 0 or args.max_cases < 1:
        parser.error("--time-limit must be positive and finite; --max-cases must be positive")
    try:
        raw = Path(args.input).read_bytes()
        def reject_constant(value):
            raise ValueError(f"Invalid JSON numeric constant {value}")
        payload = json.loads(raw, parse_constant=reject_constant)
        if not isinstance(payload, dict) or not isinstance(payload.get("cases"), list):
            raise ValueError("Input must be an object containing a cases array")
        if not payload["cases"]:
            raise ValueError("Input cases must not be empty")
    except (OSError, ValueError) as error:
        print(f"Input error: {error}", file=sys.stderr)
        return 2
    started = time.perf_counter()
    cases = [certify_case(case, args.time_limit) for case in payload["cases"][:args.max_cases]]
    certificates = [certificate for case in cases for certificate in case["certificates"].values()]
    report = {"schemaVersion": SCHEMA_VERSION, "inputSha256": hashlib.sha256(raw).hexdigest(),
              "implementation": {"language": "Python", "solver": "HiGHS via scipy.optimize.milp", "scipyVersion": scipy.__version__, "numpyVersion": np.__version__,
                                 "independentOfJavaScriptEngine": True, "thirdPartyCertification": False,
                                 "scope": "Daily deterministic model and declared tariff assumptions; not real operational savings or contract approval"},
              "settings": {"timeLimitSecondsPerObjective": args.time_limit, "maxCases": args.max_cases},
              "summary": {"inputCaseCount": len(payload["cases"]), "caseCount": len(cases),
                          "omittedCaseCount": max(0, len(payload["cases"]) - len(cases)),
                          "passedCaseCount": sum(case["valid"] for case in cases),
                          "failedCaseCount": sum(not case["valid"] for case in cases),
                          "provenOptimalCount": sum(certificate["provenOptimal"] for certificate in certificates),
                          "solverOptimalWithNumericToleranceCount": sum(certificate["solverOptimal"] and not certificate["provenOptimal"] for certificate in certificates),
                          "provenInfeasibleCount": sum(certificate["status"] == "infeasible" for certificate in certificates),
                          "noCertificateCount": sum(certificate["certificateStatus"] == "no_certificate" for certificate in certificates),
                          "auditedCandidateCount": sum(audit["audited"] for case in cases for audit in case["policyAudits"].values()),
                          "wallSeconds": time.perf_counter() - started}, "cases": cases}
    encoded = json.dumps(report, indent=2, ensure_ascii=False, allow_nan=False) + "\n"
    if args.output:
        Path(args.output).write_text(encoded, encoding="utf-8")
        print(json.dumps(report["summary"], ensure_ascii=False))
    else:
        print(encoded, end="")
    return 1 if report["summary"]["failedCaseCount"] else 0


if __name__ == "__main__":
    sys.exit(main())
