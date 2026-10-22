#!/usr/bin/env python3
"""Diagnose the nine immutable V7 failures using independent offline HiGHS.

Only diagnostic evidence is generated. No archived online policy is rerun and
no JavaScript model/matrix is read. Full actual future capacities occur only in
explicit hindsight layers, never in the original observed-prefix reconstruction.
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
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

os.environ["OMP_NUM_THREADS"] = "1"
os.environ["OPENBLAS_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"

ROOT = Path(__file__).resolve().parent.parent
SCHEMA = "portplan-offline-failure-diagnosis-v8"
METHOD = "costPolishV7"
EXPECTED_FAILURES = {
    "v7-aged-backlog-tight-n24-r1": 0,
    "v7-aged-backlog-tight-n24-r2": 7,
    "v7-aged-backlog-tight-n50-r1": 0,
    "v7-aged-backlog-tight-n50-r2": 0,
    "v7-aged-backlog-tight-n100-r1": 0,
    "v7-aged-backlog-tight-n100-r2": 0,
    "v7-new-arrivals-tight-n50-r2": 3,
    "v7-new-arrivals-tight-n100-r2": 0,
    "v7-batch-release-tight-n24-r1": 0,
}
LAYERS = ("nominalFromStart", "observedExecutedPrefix", "actualHindsightFromStart", "actualHindsightExecutedPrefix")


def load_module(name, filename):
    spec = importlib.util.spec_from_file_location(name, ROOT / "scripts" / filename)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


native = load_module("portplan_offline_v6", "diagnose-failures-v6.py")
review = load_module("portplan_review_v7", "review-rolling-v7.py")
ledger = native.ledger
require, canonical, digest = native.require, native.canonical, native.digest


def model_identity(scenario, fixed=None, minimum=0):
    # Scalar and repeated daily capacities are the same mathematical model.
    # Canonicalise them before hashing, avoiding duplicate D0 nominal solves.
    return {"scenario": ledger.expanded(scenario), "fixedEvents": copy.deepcopy(fixed or {}),
            "minEventDay": minimum, "objectiveMode": "joint"}


def identity_hash(identity):
    return "sha256:" + hashlib.sha256(canonical(identity).encode("utf-8")).hexdigest()


def feasibility(certificate):
    if certificate.get("provenInfeasible"):
        return "infeasible"
    if certificate.get("hasIncumbent"):
        return "feasible"
    return "unknown"


def classify(nominal, observed, actual, actual_locked):
    """Separate model feasibility from an untested original-policy time claim."""
    if feasibility(nominal) == "infeasible":
        return "nominal_infeasible_from_start"
    if feasibility(observed) == "feasible":
        return "observed_prefix_feasible_online_search_miss"
    if feasibility(observed) == "infeasible":
        if feasibility(actual) == "feasible":
            return "observed_prefix_infeasible_hindsight_from_start_feasible"
        if feasibility(actual) == "infeasible":
            return "actual_hindsight_and_observed_prefix_infeasible"
        return "observed_prefix_infeasible_actual_hindsight_unknown"
    return "observed_prefix_unknown_after_offline_budget"


def solve_escalating(identity, initial_limit, escalation_limit, solver=None):
    solver = solver or native.solve_locked
    attempts = []
    for limit in dict.fromkeys((initial_limit, escalation_limit)):
        proof = solver(identity["scenario"], identity["fixedEvents"], identity["minEventDay"], limit)
        require(proof["status"] not in ("solver_error", "unbounded"), "Diagnostic solver error: " + proof.get("reason", ""))
        attempts.append(proof)
        if feasibility(proof) != "unknown":
            break
    return {"identity": identity, "attempts": attempts, "certificate": attempts[-1],
            "feasibility": feasibility(attempts[-1]),
            "budgetClass": "additional_offline_diagnosis_not_online_performance"}


def source_paths(root):
    return {name: root / name for name in ("data/rolling-v7.json", "data/protocol-v7.json", "data/rolling-review-v7.json")}


def load_frozen(root):
    paths = source_paths(root)
    hashes = {name: digest(path) for name, path in paths.items()}
    require(hashes["data/rolling-v7.json"] == review.ARCHIVE_HASH, "Immutable V7 archive SHA-256 mismatch")
    require(hashes["data/protocol-v7.json"] == review.PROTOCOL_HASH, "Immutable V7 protocol SHA-256 mismatch")
    archive, protocol, prior_review = (ledger.read_json(paths[name]) for name in paths)
    require(archive["executionState"] == "complete" and archive["protocol"] == protocol
            and archive["protocolHash"] == hashes["data/protocol-v7.json"], "V7 archive/protocol binding mismatch")
    require(prior_review["valid"] is True, "Previous independent V7 review failed")
    for name in ("data/rolling-v7.json", "data/protocol-v7.json"):
        require(prior_review["inputHashes"][name] == hashes[name], "Prior review is not bound to the frozen V7 input: " + name)
    require(len(archive["cases"]) == 36, "Frozen primary case coverage changed")
    failed = [case for case in archive["cases"] if not case["policies"][METHOD]["complete"]]
    require({case["id"]: case["policies"][METHOD]["failure"]["day"] for case in failed} == EXPECTED_FAILURES,
            "Frozen nine V7 failure identities/days changed")
    return paths, hashes, archive, protocol, failed


def reconstruct(case, protocol):
    result = case["policies"][METHOD]
    require(result["executionHistoryUnavailable"] is False, "Cannot invent an unavailable execution prefix")
    ledger.validate_scenario(case["nominalScenario"], case["id"])
    review.compare(case["scenario"], ledger.realize(case["nominalScenario"], case["events"]), case["id"] + "/actual realization")
    checked = review.audit_episode(case, result, METHOD, protocol)
    require(not checked["complete"] and checked["historyAvailable"], "Expected an audited known V7 failure")
    snapshot = native.reconstruct_failure(case, result)
    observed, observations = ledger.observed_snapshot(case["nominalScenario"], case["scenario"], case["events"], snapshot["minEventDay"])
    payload = {"scenario": observed, "observedEvents": observations, "fixedEvents": snapshot["fixedEvents"],
               "minEventDay": snapshot["minEventDay"]}
    snapshot["reconstructedObservationSHA256"] = identity_hash(payload)
    snapshot["originalObservationHashVerified"] = True
    snapshot["timelineAudit"] = checked
    snapshot["usesOnlyInformationAvailableAtFailureDay"] = True
    return snapshot


def implementation_hashes(root):
    names = ("scripts/diagnose-failures-v8.py", "scripts/diagnose-failures-v6.py", "scripts/certify-v4.py",
             "scripts/review-v5.py", "scripts/review-rolling-v7.py")
    return {name: digest(root / name) for name in names}


def solver_versions():
    from scipy.optimize._highspy import _core
    return {"solver": "HiGHS via scipy.optimize.milp", "scipy": native.cert.scipy.__version__,
            "numpy": native.cert.np.__version__,
            "highs": ".".join(str(getattr(_core, "HIGHS_VERSION_" + key)) for key in ("MAJOR", "MINOR", "PATCH")),
            "python": sys.version.split()[0], "threads": 1}


def summarize(cases, models, cache_hits):
    return {"archivedPrimaryCaseCount": 36, "archivedV7CompletedCount": 27, "failureCaseCount": len(cases),
            "failureDayZeroCount": sum(case["failureSnapshot"]["minEventDay"] == 0 for case in cases),
            "failureAfterExecutionCount": sum(case["failureSnapshot"]["minEventDay"] > 0 for case in cases),
            "failureCategories": dict(Counter(case["category"] for case in cases)),
            "layerFeasibilityCounts": {layer: dict(Counter(models[case["layers"][layer]]["feasibility"] for case in cases)) for layer in LAYERS},
            "requestedLayerCount": len(cases) * len(LAYERS), "uniqueDiagnosticModelCount": len(models),
            "certificateCacheHits": cache_hits, "nativeSolveAttemptCount": sum(len(model["attempts"]) for model in models.values()),
            "escalatedModelCount": sum(len(model["attempts"]) > 1 for model in models.values()),
            "auditedFeasibleModelCount": sum(model["certificate"]["hasIncumbent"] for model in models.values()),
            "unknownModelCount": sum(model["feasibility"] == "unknown" for model in models.values()),
            "originalAlgorithmExtraBudgetReplay": "not_tested"}


def diagnose(root, initial_limit=10.0, escalation_limit=60.0, progress=True):
    started = time.perf_counter()
    paths, before, archive, protocol, failed = load_frozen(root)
    frozen_code = implementation_hashes(root)
    models, cases, cache_hits = {}, [], 0

    def model(scenario, fixed=None, minimum=0):
        nonlocal cache_hits
        identity = model_identity(scenario, fixed, minimum)
        key = identity_hash(identity)
        if key in models:
            cache_hits += 1
        else:
            if progress:
                print(json.dumps({"diagnosticModel": len(models) + 1, "minEventDay": minimum,
                                  "containers": len(scenario["containers"]), "modelHash": key}), file=sys.stderr, flush=True)
            models[key] = solve_escalating(identity, initial_limit, escalation_limit)
        return key

    for case in failed:
        snapshot = reconstruct(case, protocol)
        fixed, day = snapshot["fixedEvents"], snapshot["minEventDay"]
        layers = {"nominalFromStart": model(case["nominalScenario"]),
                  "observedExecutedPrefix": model(snapshot["scenario"], fixed, day),
                  "actualHindsightFromStart": model(case["scenario"]),
                  "actualHindsightExecutedPrefix": model(case["scenario"], fixed, day)}
        proof = {name: models[key]["certificate"] for name, key in layers.items()}
        category = classify(proof[LAYERS[0]], proof[LAYERS[1]], proof[LAYERS[2]], proof[LAYERS[3]])
        cases.append({"id": case["id"], "method": METHOD, "count": case["count"], "seed": case["seed"],
                      "dataRoleForV8": "development_diagnosis_not_new_holdout", "originalOnlineComplete": False,
                      "originalOnlineFailure": copy.deepcopy(case["policies"][METHOD]["failure"]),
                      "failureSnapshot": snapshot, "layers": layers, "category": category,
                      "originalAlgorithmExtraBudgetReplay": "not_tested",
                      "budgetInference": "A different solver finding a feasible plan proves a search miss, not that more time makes the original policy succeed.",
                      "hindsightScope": "actualHindsight layers contain future capacities and are diagnostic counterfactuals only, not executable online recovery advice."})
        if progress:
            print(json.dumps({"case": case["id"], "category": category}), file=sys.stderr, flush=True)
    require({name: digest(path) for name, path in paths.items()} == before, "Diagnosis modified an archived input")
    require(implementation_hashes(root) == frozen_code, "Diagnostic implementation changed during the run")
    report = {"schemaVersion": SCHEMA, "valid": True, "fixture": False,
              "generatedAt": datetime.now(timezone.utc).isoformat(), "sourceArchivesReadOnly": True,
              "usesJavaScriptEngine": False, "usesJavaScriptMatrix": False, "thirdPartyCertification": False,
              "onlinePolicyReruns": 0, "newHeldOutExperiments": 0,
              "inputHashes": before, "implementationHashes": frozen_code, "environment": solver_versions(),
              "method": {"formulation": "independently enumerated complete-trip set-partitioning MILP",
                         "initialTimeLimitSeconds": initial_limit, "escalationTimeLimitSeconds": escalation_limit,
                         "escalationRule": "Only unknown feasibility escalates; an audited feasible incumbent is sufficient for diagnosis.",
                         "sequentialSingleThread": True, "objective": "joint incremental KRW",
                         "source": "reuses independent Python V6 complete-trip model and V5 fee/resource audit; V7 ledger reverified",
                         "budgetScope": "additional offline diagnostic solver limits, not whole online episode limits",
                         "hindsightLayers": list(LAYERS[2:]), "originalAlgorithmExtraBudgetReplay": "not_tested"},
              "summary": summarize(cases, models, cache_hits), "cases": cases, "models": models,
              "wallSeconds": time.perf_counter() - started}
    verify_models(report)
    return report


def verify_models(report):
    require(report["schemaVersion"] == SCHEMA and report["valid"] is True, "Invalid diagnosis schema/status")
    require(report["method"]["originalAlgorithmExtraBudgetReplay"] == "not_tested", "Unperformed budget replay cannot be claimed")
    for key, model in report["models"].items():
        identity = model["identity"]
        require(identity_hash(identity) == key, "Diagnostic model identity SHA-256 mismatch")
        native.validate_locks(identity["scenario"], identity["fixedEvents"], identity["minEventDay"])
        require(model["attempts"] and model["certificate"] == model["attempts"][-1], "Final certificate differs from last attempt")
        for proof in model["attempts"]:
            require(proof["minEventDay"] == identity["minEventDay"] and proof["fixedEvents"] == identity["fixedEvents"], "Certificate lock identity mismatch")
            require(proof["solverThreads"] == 1, "Diagnostic solver is not single threaded")
            require(not (proof["hasIncumbent"] and proof["provenInfeasible"]), "Contradictory feasible/infeasible result")
            if proof["hasIncumbent"]:
                audit = native.audit_locked_incumbent(identity["scenario"], proof["rows"], identity["fixedEvents"], identity["minEventDay"])
                require(audit["valid"] and audit == proof["incumbentAudit"], "Independent diagnostic incumbent audit mismatch")
                ledger.audit_dates(identity["scenario"], proof["rows"], key, identity["fixedEvents"], identity["minEventDay"])
                review.price_rows(identity["scenario"], proof["rows"], key)
                require(native.cert.close(proof["objectiveCost"], audit["objectiveCost"]), "Diagnostic objective mismatch")
                if proof["lowerBound"] is not None:
                    require(proof["lowerBound"] <= proof["objectiveCost"] + 1e-5, "Diagnostic lower bound exceeds its incumbent")
            else:
                require(proof["rows"] == [] and proof["objectiveCost"] is None, "No-incumbent result has fake dates or fees")
            if proof["provenInfeasible"]:
                require(proof["solverStatus"] == 2 or proof["proofType"] == "empty_legal_locked_trip_domain", "Infeasibility lacks native or empty-domain evidence")
                if proof["proofType"] == "empty_legal_locked_trip_domain":
                    _, domains, _ = native.locked_columns(identity["scenario"], identity["fixedEvents"], identity["minEventDay"])
                    expected = [c["id"] for c, domain in zip(identity["scenario"]["containers"], domains) if not domain]
                    require(expected and proof["infeasibilityEvidence"]["emptyDomainContainerIds"] == expected, "Empty-domain evidence mismatch")
        require(model["feasibility"] == feasibility(model["certificate"]), "Feasibility label differs from native evidence")
    for case in report["cases"]:
        require(set(case["layers"]) == set(LAYERS), "Missing diagnostic layer")
        proofs = [report["models"][case["layers"][layer]]["certificate"] for layer in LAYERS]
        require(case["category"] == classify(*proofs), "Case classification differs from its evidence")
    expected = summarize(report["cases"], report["models"], report["summary"]["certificateCacheHits"])
    require(report["summary"] == expected, "Diagnostic summary differs from its cases")
    return True


def verify_saved(root, path):
    report = ledger.read_json(path)
    paths, hashes, _, protocol, failed = load_frozen(root)
    require(report["inputHashes"] == hashes, "Saved diagnosis input SHA-256 mismatch")
    require(report["implementationHashes"] == implementation_hashes(root), "Saved diagnosis implementation SHA-256 mismatch")
    require([case["id"] for case in report["cases"]] == [case["id"] for case in failed], "Saved diagnosis failure coverage mismatch")
    for record, case in zip(report["cases"], failed):
        snapshot = reconstruct(case, protocol)
        require(record["failureSnapshot"] == snapshot, "Saved failure snapshot differs from original observed execution prefix")
        identities = (model_identity(case["nominalScenario"]), model_identity(snapshot["scenario"], snapshot["fixedEvents"], snapshot["minEventDay"]),
                      model_identity(case["scenario"]), model_identity(case["scenario"], snapshot["fixedEvents"], snapshot["minEventDay"]))
        require(record["layers"] == {layer: identity_hash(identity) for layer, identity in zip(LAYERS, identities)}, "Diagnostic layer points to the wrong model")
    verify_models(report)
    require({name: digest(path) for name, path in paths.items()} == hashes, "Read-only verification changed an archive")
    return {"schemaVersion": SCHEMA, "valid": True, "solverRuns": 0, "summary": report["summary"]}


def document(report):
    summary = report["summary"]
    labels = {"feasible": "可行", "infeasible": "不可行", "unknown": "未决"}
    lines = ["# V8：V7 九个失败的独立离线分层", "",
             "这份诊断实际重建并审核 V7 九个未完成案例的原始观察和执行前缀；没有运行新留出实验，也没有重跑或覆盖 V7 在线成绩。原成绩仍为 27/36。旧 V7 案例已用于 V8 开发诊断，不能称为 V8 新留出。", "",
             f"九例包含七个 D0 失败和 D3、D7 各一个失败。四层共 {summary['requestedLayerCount']} 次模型请求，按完整输入 SHA-256 去重为 {summary['uniqueDiagnosticModelCount']} 个独立 trip-column 模型；缓存命中 {summary['certificateCacheHits']} 次。HiGHS {report['environment']['highs']} / SciPy {report['environment']['scipy']}，单线程串行，先每模型 {report['method']['initialTimeLimitSeconds']:g} 秒，仅可行性未决时再给 {report['method']['escalationTimeLimitSeconds']:g} 秒。实际原生调用 {summary['nativeSolveAttemptCount']} 次，升级 {summary['escalatedModelCount']} 个模型，最后未决 {summary['unknownModelCount']} 个模型。", "",
             "四层分别是：原始名义容量从开始；失败日当时已知容量加原执行锁；全知实际容量从开始；全知实际容量加同一执行锁。后两层只作事后反事实诊断，不能输入在线策略或当成在线恢复方案。", "",
             "| 失败案例 | 日 / 已执行动作数 | 原名义 | 当时观察＋原执行锁 | 全知实际无锁 | 全知实际同锁 |", "| --- | ---: | --- | --- | --- | --- |"]
    for case in report["cases"]:
        status = [labels[report["models"][case["layers"][layer]]["feasibility"]] for layer in LAYERS]
        snapshot = case["failureSnapshot"]
        lines.append(f"| {case['id']} | D{snapshot['minEventDay']} / {snapshot['executedEventCount']} | {' | '.join(status)} |")
    lines += ["", "分类计数：", ""]
    for label, count in summary["failureCategories"].items():
        lines.append(f"- `{label}`：{count} 例。")
    lines += ["", "不同求解器在额外离线预算找到完整可行方案，只能证明原在线方法当时未找到它。原算法加时重放为 **not tested**；不能据此声称给 V7 更多时间必然成功。不可行层也不计为 V8 应救回的案例。", "",
              "每个模型保留完整输入、模型 SHA-256、每次预算与原生状态、下界、gap、求解／建模墙钟，以及所有可行方案的完整提箱／卸货／还箱日期和独立费用。模型由 Python 独立枚举 trip，不读取 JavaScript 矩阵。已执行事件精确锁定，未执行事件不早于失败日；已开始卸货的全部连续占用和历史场地／运输需求都保留。", "",
              "可行候选同时通过独立费用／资源／执行锁审核和第二套 Python ledger 日期计费检查。不可行证据是空合法域或 HiGHS 原生 infeasible 状态；原生数值求解结论不是外部机构签章或形式化证明。没有 incumbent 的 time limit 保持未决，费用为 null。", "",
              "证据文件：[failure-diagnosis-v8.json](../data/failure-diagnosis-v8.json)。源档 SHA-256：", ""]
    for name, value in report["inputHashes"].items():
        lines.append(f"- `{name}`：`{value}`")
    lines += ["", "复核已保存证据，不重新求解：", "", "```bash", "python scripts/diagnose-failures-v8.py --verify-report data/failure-diagnosis-v8.json", "```", "",
              "重新运行诊断须写入新的输出路径；默认拒绝覆盖已存在文件。初始与升级预算控制的是额外原生求解时间，Python 启动、建模和审核另计，不能与 V7 的 5 秒完整冷 episode 成绩混用。", "",
              "```bash", "python scripts/diagnose-failures-v8.py --output artifacts/failure-diagnosis-v8-rerun.json --markdown-output artifacts/failure-diagnosis-v8-rerun.md", "```", "",
              "本证据仅针对声明的合成订单、容量和日级收费模型，不提供业务收益、策略因果优越性或比赛名次保证。", ""]
    return "\n".join(lines)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=ROOT)
    parser.add_argument("--initial-limit", type=float, default=10.0)
    parser.add_argument("--escalation-limit", type=float, default=60.0)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--markdown-output", type=Path)
    parser.add_argument("--verify-report", type=Path)
    parser.add_argument("--quiet", action="store_true")
    args = parser.parse_args(argv)
    try:
        require(all(math.isfinite(value) and value > 0 for value in (args.initial_limit, args.escalation_limit))
                and args.escalation_limit >= args.initial_limit, "Diagnostic budgets must be positive finite and escalation >= initial")
        root = args.root.resolve()
        if args.verify_report:
            require(args.output is None and args.markdown_output is None, "Verification is read-only and cannot specify output files")
            print(json.dumps(verify_saved(root, args.verify_report), ensure_ascii=False))
            return 0
        output = args.output or root / "data/failure-diagnosis-v8.json"
        markdown = args.markdown_output or root / "docs/failure-diagnosis-v8.md"
        require(not output.exists() and not markdown.exists(), "Refusing to overwrite existing evidence or documentation; choose new output paths")
        require(output.suffix == ".json" and markdown.suffix == ".md" and output.resolve() != markdown.resolve(), "Output types must be separate .json and .md paths")
        report = diagnose(root, args.initial_limit, args.escalation_limit, progress=not args.quiet)
        encoded, prose = json.dumps(report, ensure_ascii=False, indent=2, allow_nan=False) + "\n", document(report)
        output.parent.mkdir(parents=True, exist_ok=True)
        markdown.parent.mkdir(parents=True, exist_ok=True)
        with output.open("x", encoding="utf-8") as handle:
            handle.write(encoded)
        with markdown.open("x", encoding="utf-8") as handle:
            handle.write(prose)
        print(json.dumps({"valid": True, "output": str(output), "markdown": str(markdown), "summary": report["summary"], "wallSeconds": report["wallSeconds"]}, ensure_ascii=False))
        return 0
    except (OSError, ValueError, KeyError, TypeError, IndexError, RuntimeError) as error:
        print(json.dumps({"schemaVersion": SCHEMA, "valid": False, "error": str(error)}, ensure_ascii=False))
        return 1


if __name__ == "__main__":
    sys.exit(main())
