#!/usr/bin/env python3
"""Offline V5 failure diagnosis with independent, execution-locked HiGHS models.

V1-V5 archives are read only. The additional solver budget is diagnostic work,
never an online-policy score. Reuses Python certificate pricing/trip mathematics
and Python review causal reconstruction; does not import JavaScript.
"""
from __future__ import annotations

import argparse
import copy
import hashlib
import importlib.util
import json
import math
import os
import sys
import time
import warnings
from pathlib import Path

# Native diagnosis is deliberately sequential and single threaded.
os.environ["OMP_NUM_THREADS"] = "1"
os.environ["OPENBLAS_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"

ROOT = Path(__file__).resolve().parent.parent
SCHEMA = "portplan-offline-failure-diagnosis-v6"
EVENTS = ("pickupDay", "unloadDay", "returnDay")
EVENT_FIELDS = {"pickup": "pickupDay", "unloadStart": "unloadDay", "return": "returnDay"}


def load_module(name, filename):
    specification = importlib.util.spec_from_file_location(name, ROOT / "scripts" / filename)
    module = importlib.util.module_from_spec(specification)
    specification.loader.exec_module(module)
    return module


cert = load_module("portplan_independent_certificate_v4", "certify-v4.py")
ledger = load_module("portplan_independent_ledger_v5", "review-v5.py")


def require(condition, message):
    if not condition:
        raise ValueError(message)


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False)


def validate_locks(scenario, fixed, minimum):
    errors = cert.validate_scenario(scenario)
    require(not errors, "Invalid scenario: " + "; ".join(errors))
    require(type(minimum) is int and 0 <= minimum <= scenario["horizonDays"], "minEventDay must be an integer within the horizon")
    require(isinstance(fixed, dict), "fixedEvents must be an object")
    identifiers = {container["id"] for container in scenario["containers"]}
    for identifier, locks in fixed.items():
        require(identifier in identifiers and isinstance(locks, dict), "Unknown/malformed execution lock container")
        for key, day in locks.items():
            require(key in EVENTS and type(day) is int and 0 <= day < minimum,
                    "Executed locks must be legal event fields strictly before minEventDay")


def locked_columns(scenario, fixed, minimum):
    """Unexecuted events cannot move into the past; executed events remain exact."""
    validate_locks(scenario, fixed, minimum)
    original, _ = cert.enumerate_trips(scenario)
    columns, domains = [], [[] for _ in scenario["containers"]]
    for column in original:
        index, *days = column
        locks = fixed.get(scenario["containers"][index]["id"], {})
        if all(day == locks[field] if field in locks else day >= minimum for field, day in zip(EVENTS, days)):
            domains[index].append(len(columns))
            columns.append(column)
    return columns, domains, len(original)


def audit_locked_incumbent(scenario, rows, fixed, minimum):
    totals = {key: sum(row[key] for row in rows) for key in cert.TOTAL_KEYS}
    primary = sum(cert.objective(row, "joint") for row in rows)
    audit = cert.audit_policy(scenario, {"status": "feasible", "rows": rows, **totals,
                                       "objectiveMode": "joint", "objectiveCost": primary})
    errors = list(audit["errors"])
    for row in rows:
        for key in EVENTS:
            if key in fixed.get(row["id"], {}):
                if row[key] != fixed[row["id"]][key]:
                    errors.append(f"{row['id']}: executed {key} changed")
            elif row[key] < minimum:
                errors.append(f"{row['id']}: unexecuted {key} before minEventDay")
    return {"valid": not errors, "errors": errors, "independentCosts": totals, "objectiveCost": primary,
            "locksChecked": True, "resourcesAndFeesChecked": True}


def solve_locked(scenario, fixed=None, minimum=0, time_limit=10.0):
    fixed = {} if fixed is None else fixed
    started = time.perf_counter()
    columns, domains, original_count = locked_columns(scenario, fixed, minimum)
    horizon, count = scenario["horizonDays"], len(scenario["containers"])
    base = {"objectiveMode": "joint", "formulation": "independent complete-trip set partitioning with exact executed locks",
            "timeLimitSeconds": time_limit, "solverThreads": 1, "minEventDay": minimum, "fixedEvents": copy.deepcopy(fixed),
            "modelSize": {"originalLegalColumns": original_count, "lockedLegalColumns": len(columns), "constraints": count + 3 * horizon},
            "objectiveCost": None, "lowerBound": None, "relativeGap": None, "rows": [], "independentCosts": None,
            "hasIncumbent": False, "provenOptimal": False, "solverOptimal": False, "solverStatus": None,
            "provenInfeasible": False, "scope": "Additional offline diagnostic budget; not the archived 0.2-second online result"}
    empty = [scenario["containers"][index]["id"] for index, domain in enumerate(domains) if not domain]
    if empty:
        return {**base, "status": "infeasible", "certificateStatus": "proven_infeasible", "provenInfeasible": True,
                "proofType": "empty_legal_locked_trip_domain", "reason": "At least one container has no legal trip after exact execution locking and minEventDay filtering",
                "infeasibilityEvidence": {"emptyDomainContainerIds": empty, "fixedEvents": copy.deepcopy(fixed), "minEventDay": minimum},
                "boundInterpretation": "No feasible objective exists; null is not a zero-cost bound", "solverWallSeconds": 0.0,
                "wallSeconds": time.perf_counter() - started}
    _, operation = cert.parameters(scenario)
    row_indices, column_indices, values, costs, primary = [], [], [], [], []
    price_cache = {}
    for column_index, (index, pickup, unload, returned) in enumerate(columns):
        container = scenario["containers"][index]
        price_key = (index, pickup, returned)
        if price_key not in price_cache:
            price_cache[price_key] = cert.independent_costs(scenario, container, pickup, returned)
        price = price_cache[price_key]
        costs.append(price)
        primary.append(cert.objective(price, "joint"))
        coefficients = [(index, 1), (count + pickup, 1), (count + returned, 1)]
        # Historical unloading starts continue occupying every completion day.
        coefficients.extend((count + horizon + day, 1) for day in range(unload, unload + container["unloadDays"]))
        weight = container["sizeFt"] / 20 if operation["stagingUnit"] == "teu" else 1
        coefficients.extend((count + 2 * horizon + day, weight) for day in range(pickup, returned))
        for row_index, value in coefficients:
            row_indices.append(row_index); column_indices.append(column_index); values.append(value)
    safe_integer = (all(float(value).is_integer() and abs(value) <= cert.MAX_SAFE_INTEGER for value in primary)
                    and sum(max(abs(primary[column]) for column in domain) for domain in domains) <= cert.MAX_SAFE_INTEGER)
    base["numericalAssurance"] = {"primarySafeInteger": safe_integer,
        "interpretation": "Safe-integer daily research objective" if safe_integer else "Floating objective: solver tolerance status does not certify exact mathematical optimality"}
    matrix = cert.coo_array((cert.np.asarray(values, dtype=cert.np.float64),
                            (cert.np.asarray(row_indices, dtype=cert.np.int32), cert.np.asarray(column_indices, dtype=cert.np.int32))),
                           shape=(count + 3 * horizon, len(columns))).tocsc()
    lower = cert.np.r_[cert.np.ones(count), cert.np.full(3 * horizon, -cert.np.inf)]
    upper = cert.np.r_[cert.np.ones(count), [cert.capacity_at(scenario, key, day) for key in cert.CAP_KEYS for day in range(horizon)]]
    solver_started = time.perf_counter()
    with warnings.catch_warnings(record=True) as recorded:
        warnings.simplefilter("always")
        raw = cert.milp(c=cert.np.asarray(primary), integrality=cert.np.ones(len(columns), dtype=cert.np.uint8),
                        bounds=cert.Bounds(0, 1), constraints=cert.LinearConstraint(matrix, lower, upper),
                        options={"time_limit": time_limit, "mip_rel_gap": 0, "presolve": True, "threads": 1})
    status = {0: "optimal", 1: "time_limit", 2: "infeasible", 3: "unbounded", 4: "solver_error"}.get(raw.status, "solver_error")
    output = {**base, "status": status, "solverStatus": int(raw.status), "reason": raw.message,
              "provenInfeasible": raw.status == 2, "proofType": "HiGHS_model_infeasible" if raw.status == 2 else "HiGHS_MILP",
              "solverOptimal": raw.status == 0, "provenOptimal": raw.status == 0 and safe_integer,
              "wallSeconds": time.perf_counter() - started, "solverWallSeconds": time.perf_counter() - solver_started,
              "solverOptionWarnings": [str(warning.message) for warning in recorded]}
    dual, gap = getattr(raw, "mip_dual_bound", None), getattr(raw, "mip_gap", None)
    output["lowerBound"] = float(dual) if cert.finite(dual) else None
    output["relativeGap"] = float(gap) if cert.finite(gap) else None
    if raw.x is not None:
        require(cert.np.max(cert.np.abs(raw.x - cert.np.round(raw.x))) <= 1e-5, "HiGHS returned noninteger locked columns")
        selected = cert.np.flatnonzero(raw.x > .5)
        rows = []
        for column in selected:
            index, pickup, unload, returned = columns[column]
            container = scenario["containers"][index]
            rows.append({"id": container["id"], "sizeFt": container["sizeFt"], "pickupDay": pickup,
                         "unloadDay": unload, "unloadEndDay": unload + container["unloadDays"] - 1,
                         "returnDay": returned, **costs[column]})
        audit = audit_locked_incumbent(scenario, rows, fixed, minimum)
        require(audit["valid"], "Locked incumbent audit failed: " + "; ".join(audit["errors"]))
        require(cert.close(float(raw.fun), audit["objectiveCost"]), "Locked incumbent objective differs from independently priced rows")
        output.update(hasIncumbent=True, rows=rows, independentCosts=audit["independentCosts"],
                      objectiveCost=audit["objectiveCost"], incumbentAudit=audit)
    require(not output["solverOptimal"] or output["hasIncumbent"], "Optimal status without audited incumbent")
    require(not output["provenInfeasible"] or not output["hasIncumbent"], "Infeasible status with an incumbent")
    output["certificateStatus"] = ("proven_infeasible" if output["provenInfeasible"] else "proven_optimal" if output["provenOptimal"] else
        "solver_optimal_with_numeric_tolerance" if output["solverOptimal"] else
        "feasible_with_bound" if output["hasIncumbent"] and output["lowerBound"] is not None else "feasible_only" if output["hasIncumbent"] else "no_certificate")
    if output["provenInfeasible"]:
        output["boundInterpretation"] = "HiGHS status 2 proves the stated constraints infeasible; there is no finite feasible objective, so null is not zero cost"
    return output


def reconstruct_failure(case, result):
    failure = result["failure"]
    minimum = failure["day"]
    require(type(minimum) is int and 0 <= minimum < case["nominalScenario"]["horizonDays"], "Invalid failure day")
    fixed = {}
    event_count = 0
    for entry in result["timeline"]:
        for event in entry["executedEvents"]:
            require(event["day"] < minimum and event["day"] == entry["day"], "Failed episode contains execution at/after failure day")
            field = EVENT_FIELDS[event["event"]]
            require(field not in fixed.get(event["id"], {}), "Repeated executed event in failure prefix")
            fixed.setdefault(event["id"], {})[field] = event["day"]
            event_count += 1
    observation, observations = ledger.observed_snapshot(case["nominalScenario"], case["scenario"], case["events"], minimum)
    entry = result["timeline"][-1]
    require(entry["day"] == minimum and entry["observedEvents"] == observations, "Failure snapshot differs from original observations")
    payload = {"scenario": observation, "observedEvents": observations, "fixedEvents": fixed, "minEventDay": minimum}
    require(ledger.checksum(payload, entry["observationHash"]) == entry["observationHash"], "Failure snapshot causal hash mismatch")
    validate_locks(observation, fixed, minimum)
    return {"scenario": observation, "fixedEvents": fixed, "minEventDay": minimum,
            "executedEventCount": event_count, "originalObservationHash": entry["observationHash"]}


def classify(nominal, actual, locked, online):
    if nominal["provenInfeasible"]:
        return "nominal_infeasible_from_start"
    if locked["hasIncumbent"]:
        return ("recoverable_but_online_no_incumbent" if online in ("time_limit", "hard_time_limit", "no_feasible_schedule_found") else
                "recoverable_online_infeasibility_claim_contradicted" if online == "infeasible" else "recoverable_after_other_online_failure")
    if locked["provenInfeasible"]:
        if actual["hasIncumbent"]:
            return "executed_prefix_unrecoverable_despite_hindsight_feasible"
        if actual["provenInfeasible"]:
            return "actual_hindsight_infeasible_and_locked_prefix_infeasible"
        return "observed_locked_prefix_proven_infeasible_actual_unresolved"
    return "unresolved_after_extra_budget"


def diagnose(root, time_limit):
    started = time.perf_counter()
    names = ("rolling-v5", "benchmark-v5", "certificate-v5", "certificate-input-v5", "protocol-v5", "review-v5")
    paths = {name: root / "data" / (name + ".json") for name in names}
    data = {name: ledger.read_json(path) for name, path in paths.items()}
    before = {name: digest(path) for name, path in paths.items()}
    rolling, benchmark = data["rolling-v5"], data["benchmark-v5"]
    require(rolling["executionState"] == benchmark["executionState"] == "complete", "V5 source archives are incomplete")
    require(len(rolling["cases"]) == 24 and len(benchmark["cases"]) == 36, "V5 case coverage changed")
    require(data["review-v5"]["valid"], "Prior independent ledger review did not pass")
    for key in ("rolling-v5", "benchmark-v5", "protocol-v5"):
        require(data["review-v5"]["inputHashes"]["data/" + key + ".json"] == before[key], "V5 archive changed after independent review: " + key)
    complete_static = sum(bool(result["rows"]) for case in benchmark["cases"] for result in case["policies"].values())
    controls = benchmark["scaleControls"]["cases"]
    complete_static += sum(bool(result["rows"]) for case in controls for result in case["policies"].values())
    ledger.audit_native(root, paths["benchmark-v5"], benchmark["cases"], controls, complete_static)
    models, cache_hits, cases, complete_episodes, timeline_entries = {}, 0, [], 0, 0
    def model(scenario, fixed=None, minimum=0):
        nonlocal cache_hits
        identity = {"scenario": scenario, "fixedEvents": fixed or {}, "minEventDay": minimum, "objectiveMode": "joint"}
        key = "sha256:" + hashlib.sha256(canonical(identity).encode("utf-8")).hexdigest()
        if key in models:
            cache_hits += 1
        else:
            proof = solve_locked(scenario, fixed, minimum, time_limit)
            require(proof["status"] not in ("solver_error", "unbounded"), "Diagnostic solver error: " + proof["reason"])
            models[key] = {"identity": identity, "certificate": proof}
        return key
    for case in rolling["cases"]:
        require(set(case["policies"]) == set(ledger.ROLLING_METHODS), "Rolling method coverage changed")
        record = {"id": case["id"], "count": case["count"], "seed": case["seed"], "methods": {}}
        for method, result in case["policies"].items():
            label = case["id"] + "/" + method
            ledger.audit_schedule(case["scenario"], result, label)
            verified = ledger.audit_timeline(case, result, method, label)
            timeline_entries += verified["timelineEntries"]
            if result["complete"]:
                complete_episodes += 1
                record["methods"][method] = {"onlineComplete": True, "category": "complete_no_failure", "extraSolverRun": False}
                continue
            snapshot = reconstruct_failure(case, result)
            nominal_key, actual_key = model(case["nominalScenario"]), model(case["scenario"])
            locked_key = model(snapshot["scenario"], snapshot["fixedEvents"], snapshot["minEventDay"])
            nominal, actual, locked = (models[key]["certificate"] for key in (nominal_key, actual_key, locked_key))
            online = result["failure"].get("plannerStatus", result["timeline"][-1].get("plannerStatus"))
            category = classify(nominal, actual, locked, online)
            counterfactual = None
            if actual["hasIncumbent"]:
                # Hindsight dates are checked without execution locks only; they
                # are not offered as a repair to already performed operations.
                ledger.audit_dates(snapshot["scenario"], actual["rows"], label + "/hindsight-witness-under-observation")
                counterfactual = {"actualWitnessAlsoFeasibleWithoutLocksUnderObservation": True,
                                  "isExecutableRecoveryFromRecordedPrefix": False}
            record["methods"][method] = {"onlineComplete": False, "category": category,
                "originalOnlineFailure": result["failure"], "originalPlannerStatus": online,
                "onlineAdvisorySolverLimitSeconds": result["timeLimitSeconds"], "failureSnapshot": snapshot,
                "layers": {"nominalFromStart": nominal_key, "actualHindsightFromStart": actual_key, "observedExecutedPrefix": locked_key},
                "counterfactualWitness": counterfactual,
                "contradictsOnlineInfeasibilityClaim": online == "infeasible" and locked["hasIncumbent"],
                "scope": "Offline classification; historical unloading/transport/staging usage is preserved"}
        cases.append(record)
    native_by_id = {case["id"]: case for case in data["certificate-v5"]["cases"]}
    static_misses = []
    for case in benchmark["cases"]:
        result = case["policies"]["fastEvent"]
        if result["rows"]:
            continue
        native = native_by_id[case["id"]]
        proof = native["certificates"]["joint"]
        require(native["valid"] and not native["errors"], "Static miss native certificate contains contradictions")
        if proof["hasIncumbent"]:
            checked = audit_locked_incumbent(case["scenario"], proof["rows"], {}, 0)
            require(checked["valid"] and cert.close(proof["objectiveCost"], checked["objectiveCost"]), "Existing static native witness failed fee/resource audit")
        static_misses.append({"id": case["id"], "onlineStatus": result["status"], "onlineHardWallMs": result["hardWallMs"],
            "existingNativeCertificateStatus": proof["certificateStatus"], "nativeSolverStatus": proof.get("solverStatus"),
            "nativeReason": proof.get("reason"), "hasIndependentFeasibleWitness": proof["hasIncumbent"],
            "provenModelInfeasible": proof["certificateStatus"] == "proven_infeasible", "objectiveCost": proof["objectiveCost"],
            "lowerBound": proof["lowerBound"], "relativeGap": proof["relativeGap"], "nativeTimeLimitSeconds": proof["timeLimitSeconds"],
            "evidenceFile": "data/certificate-v5.json", "newSolverRun": False})
    failed = [method for case in cases for method in case["methods"].values() if not method["onlineComplete"]]
    categories = {}
    for method in failed:
        categories[method["category"]] = categories.get(method["category"], 0) + 1
    model_counts = {}
    for model_info in models.values():
        status = model_info["certificate"]["certificateStatus"]
        model_counts[status] = model_counts.get(status, 0) + 1
    after = {name: digest(path) for name, path in paths.items()}
    require(after == before, "Diagnosis changed a V5 source archive")
    return {"schemaVersion": SCHEMA, "valid": True, "fixture": False, "sourceArchivesReadOnly": True,
        "usesJavaScriptEngine": False, "thirdPartyCertification": False,
        "method": {"reusesIndependentPythonCertifyV4Mathematics": True, "reusesPythonReviewV5CausalReconstruction": True,
                   "executionLockImplementation": "V6 filters complete trip columns by exact executed dates and lower bounds for every unexecuted event; separately audits incumbent locks",
                   "solver": "HiGHS via scipy.optimize.milp", "scipyVersion": cert.scipy.__version__, "solverThreads": 1,
                   "timeLimitSecondsPerUniqueModel": time_limit, "sequentialSolverCalls": True,
                   "budgetClassification": "Additional offline diagnostic budget; not online performance, recovery probability, or a new held-out benchmark"},
        "inputHashes": {"data/" + name + ".json": value for name, value in before.items()},
        "implementationHashes": {"scripts/diagnose-failures-v6.py": digest(Path(__file__)), "scripts/certify-v4.py": digest(ROOT / "scripts/certify-v4.py"),
                                 "scripts/review-v5.py": digest(ROOT / "scripts/review-v5.py")},
        "summary": {"rollingCaseCount": len(cases), "rollingMethodEpisodeCount": len(cases) * 2, "rollingCompleteEpisodeCount": complete_episodes,
                    "rollingFailedCaseCount": sum(any(not method["onlineComplete"] for method in case["methods"].values()) for case in cases),
                    "rollingFailedEpisodeCount": len(failed), "timelineEntriesRechecked": timeline_entries,
                    "failureCategoriesByEpisode": categories, "uniqueDiagnosticModelCount": len(models), "certificateCacheHits": cache_hits,
                    "diagnosticModelStatuses": model_counts, "onlineInfeasibilityContradictionCount": sum(method["contradictsOnlineInfeasibilityClaim"] for method in failed),
                    "staticFastEventMissCount": len(static_misses), "staticMissesWithIndependentFeasibleWitness": sum(miss["hasIndependentFeasibleWitness"] for miss in static_misses),
                    "staticMissesProvenInfeasible": sum(miss["provenModelInfeasible"] for miss in static_misses),
                    "wallSeconds": time.perf_counter() - started}, "cases": cases, "models": models, "staticFastEventMisses": static_misses}


def document(report):
    summary = report["summary"]
    lines = ["# V6：V5 剩余失败的离线诊断", "", "这是既有 V5 证据的分层检查，未重跑在线策略，未改 V1–V5 原始 JSON。它复用内部独立 Python 的日费用/完整 trip 数学，并新增严格的执行锁定过滤和逐箱锁审计；不是第三方认证或新留出成绩。", "",
        f"复核全部 {summary['rollingCaseCount']} 个滚动案例、{summary['rollingMethodEpisodeCount']} 个方法 episode、{summary['timelineEntriesRechecked']} 个逐日轨迹；其中 {summary['rollingFailedCaseCount']} 个案例、{summary['rollingFailedEpisodeCount']} 个 episode 未完成。额外诊断顺序运行 {summary['uniqueDiagnosticModelCount']} 个去重模型，HiGHS 单线程，每模型最多 {report['method']['timeLimitSecondsPerUniqueModel']:g} 秒。该预算不属于归档的在线 0.2 秒成绩。", "",
        "## 分层与证据", "", "每个失败分别求解 nominal 从开始、actual 全知从开始、失败日 observed＋实际已执行历史三层模型。最后一层锁住每个已执行提箱、开始卸货、还箱日，所有未执行事件至少在失败日；历史开始的卸货仍占用其整个持续区间，不能删除过去动作或进行中的占槽来伪造恢复。", "",
        "证据保留原生 status、求解消息、下界、MIP gap、完整可行 incumbent、求解及建模墙钟。空合法 trip 域的不可行是明确解析证明；其余不可行须 HiGHS status 2。不可行没有有限可行目标，bound=null 不代表费用 0。time_limit 没有 incumbent 仅是 unresolved，不能改成不可行。", "", "| 分类 | 失败 episode 数 |", "| --- | ---: |"]
    labels = {"nominal_infeasible_from_start": "nominal 初始即不可行", "actual_hindsight_infeasible_and_locked_prefix_infeasible": "actual 全知及已执行前缀均不可行",
              "executed_prefix_unrecoverable_despite_hindsight_feasible": "全知可行，但已执行前缀使当时观察下不可恢复",
              "observed_locked_prefix_proven_infeasible_actual_unresolved": "当时观察＋已执行前缀已证明不可行，全知层未判定",
              "recoverable_but_online_no_incumbent": "当时历史下可恢复，但在线未返回完整候选",
              "recoverable_online_infeasibility_claim_contradicted": "当时历史下可恢复，反驳在线不可行声明",
              "recoverable_after_other_online_failure": "当时历史下可恢复，在线发生其他失败",
              "unresolved_after_extra_budget": "额外预算后仍未判定"}
    for category, count in summary["failureCategoriesByEpisode"].items():
        lines.append(f"| {labels.get(category, category)} | {count} |")
    lines += ["", "全知从开始可行，不等于已经执行某些动作后仍可恢复；全知证据也不是在线策略可使用的信息。所有事件及证书输入、每个方法的固定历史、模型哈希及完整 rows 位于 [failure-diagnosis-v6.json](../data/failure-diagnosis-v6.json)。", "",
        "| 案例 / 方法 | 失败日 | nominal | actual 全知 | observed＋执行锁 |", "| --- | ---: | --- | --- | --- |"]
    for case in report["cases"]:
        for method, info in case["methods"].items():
            if info["onlineComplete"]:
                continue
            statuses = [report["models"][info["layers"][layer]]["certificate"]["certificateStatus"] for layer in ("nominalFromStart", "actualHindsightFromStart", "observedExecutedPrefix")]
            lines.append(f"| {case['id']} / {method} | {info['failureSnapshot']['minEventDay']} | {' | '.join(statuses)} |")
    lines += ["", "## 静态 fastEvent 的六个未找到解案例", "",
        f"既有 V5 原生证书表明：{summary['staticMissesWithIndependentFeasibleWitness']} 个存在独立完整可行方案，{summary['staticMissesProvenInfeasible']} 个证明模型不可行。搜索未找到完整方案不能整体解释为订单不可行；这里复用已绑定的证书，不新增静态实验。", "",
        "| 案例 | 在线状态 | 既有证书 | 目标 / KRW | 下界 / KRW |", "| --- | --- | --- | ---: | ---: |"]
    for miss in report["staticFastEventMisses"]:
        lines.append(f"| {miss['id']} | {miss['onlineStatus']} | {miss['existingNativeCertificateStatus']} | {miss['objectiveCost']} | {miss['lowerBound']} |")
    lines += ["", "## 范围与复现", "", "运行 `python scripts/diagnose-failures-v6.py` 生成诊断；`--time-limit` 控制每个去重模型的额外预算。每个 incumbent 都复核释放、先后、截止日、容量、费用、全部执行锁和最早未执行日期。源档案哈希在前后分别核对；所有模型都保留证据状态，没有将无解返回补成 0 成本。", "",
        "全部订单、容量及冲击仍为合成。此诊断不能证明真实业务回收率、因果最优行动、线上费用节省或比赛名次；若前缀已经不可行，新恢复启发式必须如实失败。全知不可行、nominal 初始不可行和历史承诺造成的不可恢复是不同边界，不能用删历史、删箱或全知未来修补在线成绩。", ""]
    return "\n".join(lines)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=ROOT)
    parser.add_argument("--time-limit", type=float, default=10.0)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--markdown-output", type=Path)
    parser.add_argument("--fixture-input", type=Path, help="Explicit hand-built lock model fixtures; never benchmark evidence")
    args = parser.parse_args(argv)
    if not math.isfinite(args.time_limit) or args.time_limit <= 0:
        parser.error("--time-limit must be positive and finite")
    try:
        if args.fixture_input:
            source = ledger.read_json(args.fixture_input)
            models = [{"id": case["id"], "certificate": solve_locked(case["scenario"], case.get("fixedEvents"), case.get("minEventDay", 0), args.time_limit)} for case in source["cases"]]
            report = {"schemaVersion": SCHEMA, "valid": True, "fixture": True, "models": models}
        else:
            report = diagnose(args.root.resolve(), args.time_limit)
        output = args.output or (None if args.fixture_input else args.root / "data" / "failure-diagnosis-v6.json")
        markdown = args.markdown_output or (None if args.fixture_input else args.root / "docs" / "failure-diagnosis-v6.md")
        evidence_root = (args.root / "data").resolve()
        if output:
            target = output.resolve()
            require(not (target.is_file() and evidence_root in target.parents and target != evidence_root / "failure-diagnosis-v6.json"), "Refusing to replace existing V1-V5 evidence JSON")
            require(not args.fixture_input or target != args.fixture_input.resolve(), "Refusing to overwrite fixture input")
        if markdown:
            require(markdown.suffix == ".md", "Markdown output must have .md extension, never a raw JSON archive")
        encoded = json.dumps(report, ensure_ascii=False, indent=2, allow_nan=False) + "\n"
        if output:
            output.parent.mkdir(parents=True, exist_ok=True); output.write_text(encoded, encoding="utf-8")
            print(json.dumps({"valid": True, "output": str(output), "summary": report.get("summary")}, ensure_ascii=False))
        else:
            print(encoded, end="")
        if markdown:
            require(not args.fixture_input, "Fixture is not a production diagnosis document")
            markdown.parent.mkdir(parents=True, exist_ok=True); markdown.write_text(document(report), encoding="utf-8")
    except (OSError, ValueError, KeyError, TypeError, IndexError, RuntimeError) as error:
        print(json.dumps({"schemaVersion": SCHEMA, "valid": False, "error": str(error)}, ensure_ascii=False))
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
