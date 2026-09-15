"""CSV report writer for barcode navigation validation."""

from __future__ import annotations

import csv
from pathlib import Path
from typing import Any

from constants import CSV_FIELDNAMES


def write_results_csv(path: Path, rows: list[dict[str, Any]]) -> int:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle, fieldnames=CSV_FIELDNAMES, extrasaction="ignore"
        )
        writer.writeheader()
        for row in rows:
            writer.writerow({key: row.get(key, "") for key in CSV_FIELDNAMES})
    return len(rows)
