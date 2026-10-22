"""Hand-written service deadline cases. The fake solver performs no CP search."""
import importlib.util
import json
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("cpsat_service_deadline_fixture", ROOT / "scripts/cpsat-service-v12.py")
service = importlib.util.module_from_spec(spec)
spec.loader.exec_module(service)
SCENARIO = {"horizonStart": "2026-10-12", "horizonDays": 3, "truckCapacity": [1, 1, 0],
            "warehouseCapacity": [1, 0, 0], "stagingCapacity": [1, 0, 0],
            "containers": [{"id": "A", "sizeFt": 20, "releaseDay": 0, "unloadDays": 1, "dueDay": 0,
                            "dischargeDateTime": "2026-09-29T07:00:00+09:00"}]}


def check(phase):
    now = [0.0]

    class FakeSolver:
        def __init__(self):
            self.parameters = SimpleNamespace()
            self.num_branches = 0
            self.num_conflicts = 0
            self.wall_time = 0
            self.objective_value = 61850

        def solve(self, model):
            if phase == "late_infeasibility":
                now[0] = 1.1
                return service.cp_model.INFEASIBLE
            return service.cp_model.OPTIMAL

        def status_name(self, status):
            return "INFEASIBLE" if status == service.cp_model.INFEASIBLE else "OPTIMAL"

        @property
        def best_objective_bound(self):
            if phase == "late_bound_before_decoding":
                now[0] = 1.1
            return 61850

        def value(self, variable):
            values = {"pickup_0": 0, "unload_0": 0, "return_0": 1,
                      "storage_increment_0": 31850, "dd_increment_0": 30000}
            if phase == "late_complete_candidate" and variable.name == "dd_increment_0":
                now[0] = 1.1
            return values[variable.name]

    with patch.object(service.time, "perf_counter", side_effect=lambda: now[0]), \
         patch.object(service.time, "time", return_value=0), \
         patch.object(service.cp_model, "CpSolver", FakeSolver):
        result = service.solve({"scenario": SCENARIO, "deadlineUnixMs": 1000, "auditReserveMs": 0})
    assert result["status"] == "time_limit", result
    assert result["lowerBound"] is None and result["lowerBoundSource"] is None, result
    assert result["objectiveCost"] is None and result["independentCosts"] is None and result["rows"] == [], result
    assert not result["hasIncumbent"] and not result["provenOptimal"] and not result["provenInfeasible"], result
    assert result["discardedLateSolverTelemetry"]["solverStatus"] is not None, result
    if phase == "late_complete_candidate":
        assert result["discardedLateCandidate"]["lowerBound"] == 61850, result
        assert result["discardedLateCandidate"]["provenOptimal"], result
    if phase == "late_infeasibility":
        assert result["lateInfeasibilityProofDiscarded"], result
    return {"phase": phase, "valid": True, "status": result["status"],
            "topLevelBound": result["lowerBound"], "lateEvidencePreserved": True}


print(json.dumps({"valid": True, "solverSearchCalls": 0, "cases": [check(phase) for phase in
      ("late_bound_before_decoding", "late_complete_candidate", "late_infeasibility")]}))
