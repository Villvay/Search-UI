"""Helpers for 3-round dataset execution (orchestration only)."""

from __future__ import annotations

import csv
import json
from pathlib import Path
from typing import Any

from constants import CSV_FIELDNAMES, ROUND_CSV_TEMPLATE, ROUND_STATE_FILENAME


def compute_round_ranges(
    total_records: int, round_count: int = 3
) -> list[tuple[int, int]]:
    """Return contiguous [start, end) ranges covering ``total_records``."""
    if total_records < 0:
        raise ValueError("total_records must be >= 0")
    if round_count < 1:
        raise ValueError("round_count must be >= 1")
    if total_records == 0:
        return [(0, 0) for _ in range(round_count)]

    base = total_records // round_count
    remainder = total_records % round_count
    ranges: list[tuple[int, int]] = []
    start = 0
    for round_index in range(round_count):
        size = base + (1 if round_index < remainder else 0)
        end = start + size
        ranges.append((start, end))
        start = end
    return ranges


def round_csv_path(rounds_dir: Path, round_no: int) -> Path:
    return rounds_dir / ROUND_CSV_TEMPLATE.format(round_no=round_no)


def round_state_path(rounds_dir: Path) -> Path:
    return rounds_dir / ROUND_STATE_FILENAME


def input_mtime(path: Path) -> float | None:
    """Return input file mtime when available (lightweight identity signal)."""
    try:
        if path.is_file():
            return path.stat().st_mtime
    except OSError:
        return None
    return None


def load_round_state(path: Path) -> dict[str, Any]:
    if not path.is_file():
        return {}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    return data if isinstance(data, dict) else {}


def save_round_state(path: Path, state: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(state, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def init_round_state(
    *,
    input_path: str,
    dataset_size: int,
    ranges: list[tuple[int, int]],
    input_mtime_value: float | None = None,
) -> dict[str, Any]:
    rounds: dict[str, Any] = {}
    for index, (start, end) in enumerate(ranges, start=1):
        rounds[str(index)] = {
            "status": "pending",
            "processed": 0,
            "start": start,
            "end": end,
        }
    return {
        "input_path": input_path,
        "dataset_size": dataset_size,
        "input_mtime": input_mtime_value,
        "ranges": [[start, end] for start, end in ranges],
        "rounds": rounds,
    }


def clear_round_result_files(rounds_dir: Path, round_count: int) -> list[Path]:
    """Delete existing round_*.csv files. Returns removed paths."""
    removed: list[Path] = []
    rounds_dir.mkdir(parents=True, exist_ok=True)
    for round_no in range(1, round_count + 1):
        path = round_csv_path(rounds_dir, round_no)
        if path.is_file():
            path.unlink()
            removed.append(path)
    return removed


def count_round_csv_rows(path: Path) -> int:
    """Count data rows in a round CSV (excludes header)."""
    with path.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        return sum(1 for row in reader if (row.get("barcode") or "").strip())


def validate_completed_round_files(
    *,
    rounds_dir: Path,
    ranges: list[tuple[int, int]],
) -> None:
    """Ensure each completed round CSV exists and matches expected row count."""
    for index, (start, end) in enumerate(ranges, start=1):
        expected = end - start
        path = round_csv_path(rounds_dir, index)
        if not path.is_file():
            raise RuntimeError(
                f"Cannot generate final report. Round {index} is marked complete "
                f"but {path.name} is missing or incomplete."
            )
        try:
            actual = count_round_csv_rows(path)
        except OSError as exc:
            raise RuntimeError(
                f"Cannot generate final report. Round {index} is marked complete "
                f"but {path.name} is missing or incomplete."
            ) from exc
        if actual != expected:
            raise RuntimeError(
                f"Cannot generate final report. Round {index} is marked complete "
                f"but {path.name} is missing or incomplete."
            )


def merge_round_csvs(round_paths: list[Path]) -> list[dict[str, Any]]:
    """Merge round CSVs in order; keep the first row per barcode.

    Callers must validate required files exist before invoking this helper.
    """
    merged: list[dict[str, Any]] = []
    seen: set[str] = set()
    for path in round_paths:
        if not path.is_file():
            raise RuntimeError(
                f"Cannot generate final report. Required round file is missing: {path}"
            )
        with path.open(newline="", encoding="utf-8") as handle:
            reader = csv.DictReader(handle)
            for row in reader:
                barcode = (row.get("barcode") or "").strip()
                if not barcode or barcode in seen:
                    continue
                seen.add(barcode)
                merged.append(
                    {
                        "barcode": barcode,
                        "identifier_type": row.get("identifier_type", ""),
                        "expected": "success",
                        "status": row.get("status", ""),
                        "reason": row.get("reason", ""),
                        "http_status": int(row.get("http_status") or 0),
                        "product_id": row.get("product_id", ""),
                        "product_name": row.get("product_name", ""),
                        "total_results": "",
                        "plp": "",
                        "execution_time_ms": float(row.get("execution_time_ms") or 0),
                    }
                )
    return merged


def write_round_csv(path: Path, rows: list[dict[str, Any]]) -> int:
    """Write a round CSV using the same columns as the final report CSV."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle, fieldnames=CSV_FIELDNAMES, extrasaction="ignore"
        )
        writer.writeheader()
        for row in rows:
            writer.writerow({key: row.get(key, "") for key in CSV_FIELDNAMES})
    return len(rows)
