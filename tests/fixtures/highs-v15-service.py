#!/usr/bin/env python3
"""Handwritten wire responses only: no optimizer, numerical package or experiment."""
import json
import os
import sys
import time

print(json.dumps({"type": "ready", "pid": os.getpid(), "fixture": True}), flush=True)
for line in sys.stdin:
    request = json.loads(line)
    fixture = request["scenario"]["nativeFixture"]
    if fixture.get("mode") == "exit":
        os._exit(3)
    if fixture.get("mode") == "malformed":
        print("not-json-fixture", flush=True)
        continue
    if fixture.get("mode") == "never":
        time.sleep(60)
        continue
    result = dict(fixture["reply"])
    result["fixtureRequest"] = {key: request.get(key) for key in
                               ("deadlineUnixMs", "auditReserveMs", "minEventDay", "fixedEvents", "objectiveMode")}
    print(json.dumps({"type": "result", "id": request["id"], "result": result}), flush=True)
