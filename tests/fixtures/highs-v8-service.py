#!/usr/bin/env python3
"""Synthetic protocol responses for adapter tests, never experiment evidence."""
import json
import os
import sys
import time

print(json.dumps({"type": "ready", "pid": os.getpid(), "fixture": True}), flush=True)
for line in sys.stdin:
    request = json.loads(line)
    fixture = request["scenario"]["nativeFixture"]
    time.sleep(fixture.get("delayMs", 0) / 1000)
    print(json.dumps({"type": "result", "id": request["id"], "result": fixture["reply"]}), flush=True)
