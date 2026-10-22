#!/usr/bin/env python3
"""Reproduce bounded aggregate evidence from the official public YGPA CSV.

Usage: python data/public/profile_ygpa.py /tmp/portplan-source-cache/ygpa_west_2026h1.csv
The source is CP949 CSV; no individual vehicle identifiers enter the outputs.
No synthetic orders or PNC claims are generated.
"""
import collections
import csv
import datetime as dt
import hashlib
import io
import json
import math
from pathlib import Path
import sys

OUT = Path(__file__).resolve().parent
SOURCE_URL = "https://www.data.go.kr/cmm/cmm/fileDownload.do?atchFileId=FILE_000000003681505&fileDetailSn=1&insertDataPrcus=N"
CATALOG_URL = "https://www.data.go.kr/data/15059682/fileData.do"


def main(raw_path):
    raw = Path(raw_path).read_bytes()
    rows = list(csv.DictReader(io.StringIO(raw.decode("cp949"))))
    kept = []
    all_blank = 0
    invalid = []
    zero_duration = 0
    mismatch_gt_1min = 0
    dates = collections.defaultdict(list)
    exact_signatures = collections.Counter()
    nulls = collections.Counter()
    for line, row in enumerate(rows, start=2):
        if not any(row.values()):
            all_blank += 1
            continue
        for key, value in row.items():
            if not value:
                nulls[key] += 1
        exact_signatures[tuple(row.values())] += 1
        try:
            start = dt.datetime.strptime(row["진입일시"], "%Y-%m-%d %H:%M")
            end = dt.datetime.strptime(row["진출일시"], "%Y-%m-%d %H:%M")
            minutes = int((end - start).total_seconds() / 60)
            hh, mm = map(int, row["작업시간"].split(":"))
            if minutes < 0:
                raise ValueError("negative elapsed minutes")
        except (ValueError, KeyError) as exc:
            invalid.append({"source_line": line, "reason": str(exc)})
            continue
        zero_duration += minutes == 0
        mismatch_gt_1min += abs(minutes - (hh * 60 + mm)) > 1
        record = {
            "source_line": line,
            "entry_gate": row["진입게이트"],
            "entry_local": row["진입일시"],
            "exit_gate": row["진출게이트"],
            "exit_local": row["진출일시"],
            "reported_work_duration_hh_mm": row["작업시간"],
            "elapsed_minutes_derived": minutes,
        }
        kept.append(record)
        dates[start.date().isoformat()].append(minutes)
    durations = sorted(row["elapsed_minutes_derived"] for row in kept)

    def percentile(values, q):
        ordered = sorted(values)
        return ordered[max(0, math.ceil(q * len(ordered)) - 1)]

    first = dt.date.fromisoformat(min(dates))
    last = dt.date.fromisoformat(max(dates))
    missing_dates = [
        (first + dt.timedelta(days=i)).isoformat()
        for i in range((last - first).days + 1)
        if (first + dt.timedelta(days=i)).isoformat() not in dates
    ]
    edges = [0, 15, 30, 60, 90, 120, 180, 361]
    hist = [{"from_minutes_inclusive": a, "to_minutes_exclusive": b,
             "count": sum(a <= x < b for x in durations)} for a, b in zip(edges, edges[1:])]
    sample_indices = [i * (len(kept) - 1) // 199 for i in range(200)]
    sample = [kept[i] for i in sample_indices]
    sample_path = OUT / "ygpa_gate_sample_200.csv"
    with sample_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(sample[0]))
        writer.writeheader()
        writer.writerows(sample)
    stats = {
        "id": "ygpa_west_gate_2026h1",
        "title_zh": "光阳港西部集装箱码头车辆进出公开观测",
        "title_ko": "여수광양항만공사_광양항 서부컨테이너터미널 차량출입 데이터_20260630",
        "provider": "Yeosu Gwangyang Port Authority (YGPA)",
        "catalog_url": CATALOG_URL,
        "download_url": SOURCE_URL,
        "raw_sha256": hashlib.sha256(raw).hexdigest(),
        "raw_bytes": len(raw),
        "raw_encoding": "CP949",
        "source_grain": "one published vehicle terminal gate visit record; not a container order",
        "port": "Gwangyang",
        "terminal": "West Container Terminal",
        "timezone": {"value": "Asia/Seoul", "status": "inferred_from_Korean_terminal_location_not_explicit_in_CSV"},
        "use_in_optimizer": False,
        "permitted_interpretation_zh": "用于了解该码头观测到的车辆场内停留时间及检验数据质量；没有用于生成PNC需求、订单或节省收益。",
        "prohibited_interpretation_zh": "不可当作PNC订单、昌原运输需求、仓库卸货时长、完整车队容量或真实费用节省验证。",
        "license_catalog": "이용허락범위 제한 없음 (no usage restrictions stated in catalog)",
        "rows": {
            "raw_excluding_header": len(rows),
            "all_fields_blank": all_blank,
            "all_fields_blank_rate": all_blank / len(rows),
            "nonblank": len(rows) - all_blank,
            "valid_datetime_pairs": len(kept),
            "invalid_nonblank_datetime_pairs": len(invalid),
            "exact_duplicate_excess_nonblank": sum(n-1 for n in exact_signatures.values()),
            "exact_duplicate_groups_nonblank": sum(n > 1 for n in exact_signatures.values()),
            "exact_duplicate_affected_rows_nonblank": sum(n for n in exact_signatures.values() if n > 1),
            "duplicate_policy": "Retained: identical rows may be separate vehicles after plate masking; no stable visit ID is supplied.",
            "nulls_among_nonblank_rows": dict(nulls),
        },
        "period": {
            "first_entry_date": min(dates), "last_entry_date": max(dates),
            "calendar_days": (last - first).days + 1,
            "dates_with_records": len(dates),
            "dates_without_records": missing_dates,
            "missing_day_policy": "Absence of records is not asserted to mean zero traffic; no imputation.",
        },
        "elapsed_minutes": {
            "definition": "exit timestamp minus entry timestamp (minute-resolution timestamps); includes observed time inside the terminal, not road travel or warehouse unloading",
            "quantile_method": "nearest rank: sorted[ceil(p*n)-1]",
            "min": min(durations), "p50": percentile(durations, .5),
            "p90": percentile(durations, .9), "p95": percentile(durations, .95),
            "max": max(durations), "zero_count": zero_duration,
            "reported_duration_difference_over_1min_count": mismatch_gt_1min,
            "histogram": hist,
        },
        "daily": [{"date": date, "records": len(values), "p50_minutes": percentile(values, .5),
                   "p90_minutes": percentile(values, .9)} for date, values in sorted(dates.items())],
        "sample": {"path": "data/public/ygpa_gate_sample_200.csv", "rows": 200,
                   "selection": "200 evenly spaced row positions among valid nonblank rows, inclusive endpoints; deterministic and not a random representative sample",
                   "removed_fields": ["차량번호 (vehicle plate, already masked in source)"]},
        "field_provenance": {
            "entry_gate": "original 진입게이트",
            "entry_local": "original 진입일시",
            "exit_gate": "original 진출게이트",
            "exit_local": "original 진출일시",
            "reported_work_duration_hh_mm": "original 작업시간; observed format HH:MM",
            "elapsed_minutes_derived": "derived from exit_local minus entry_local",
            "source_line": "derived CSV physical record index including header",
            "container_id": "missing", "discharge_datetime": "missing",
            "empty_return_datetime": "missing/not identifiable from vehicle entry",
            "carrier_contract": "missing", "truck_fleet_capacity": "missing",
            "warehouse_capacity": "missing", "customer_deadline": "missing",
        },
    }
    (OUT / "ygpa_gate_statistics.json").write_text(json.dumps(stats, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"raw_rows": len(rows), "valid_rows": len(kept), "all_blank_rows": all_blank,
                      "sample": str(sample_path), "stats": str(OUT / "ygpa_gate_statistics.json")}, ensure_ascii=False))


if __name__ == "__main__":
    main(sys.argv[1])
