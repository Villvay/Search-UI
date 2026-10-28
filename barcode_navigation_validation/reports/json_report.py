"""JSON report writer for barcode navigation validation."""

from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any

from constants import STATUS_FAIL, STATUS_PASS


def build_summary(
    rows: list[dict[str, Any]],
    *,
    barcode_api_url: str,
    environment: str,
    barcodes_csv: str,
    execution_time_s: float,
) -> dict[str, Any]:
    passed = sum(1 for row in rows if row.get("status") == STATUS_PASS)
    failed = sum(1 for row in rows if row.get("status") == STATUS_FAIL)
    return {
        "barcode_api_url": barcode_api_url,
        "environment": environment,
        "barcodes_csv": barcodes_csv,
        "generated_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "total_tested": len(rows),
        "passed": passed,
        "failed": failed,
        "execution_time_s": execution_time_s,
    }


def write_results_json(
    path: Path, summary: dict[str, Any], rows: list[dict[str, Any]]
) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {"summary": summary, "results": rows}
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
