#!/usr/bin/env python3
"""Barcode Navigation Validation runner.

Calls the barcode API for each input barcode/SKU and reports whether the
response navigates directly to a single product (PLP).

Usage:
  cd barcode_navigation_validation
  python3 run.py

  BARCODES_JSON_PATH=/path/to/plp_redirect_ALL_skus.json python3 run.py

  # 3-round execution (default)
  ROUND=all python3 run.py
  ROUND=1 python3 run.py
  ROUND=2 RESUME_ROUNDS=true python3 run.py
  FORCE_ROUND=2 python3 run.py

Manual product dataset generation (never runs during normal validation):
  python3 run.py --generate-product-dataset
  GENERATE_DATASET=true python3 run.py

Environment:
  ENVIRONMENT           qa | prod (default: qa)
  BARCODE_API_URL       Override barcode endpoint
  BASE_URL              Shared override (maps /search -> /barcode)
  SEARCH_API_URL        Shared override (maps /search -> /barcode)
  BARCODES_JSON_PATH    Input JSON (yes_skus / no_skus)
  BARCODES_CSV_PATH     Input CSV override
  SKU_SET               all | yes | no (JSON only, default: all)
  MAX_WORKERS           Parallel request workers (default: 8)
  CHECKPOINT_EVERY      Persist round CSV every N SKUs (default: 100)
  ROUND                 all | 1 | 2 | 3 (default: all)
  ROUND_COUNT           Number of rounds (default: 3)
  RESUME_ROUNDS         Skip rounds marked complete (default: true)
  FORCE_ROUND           Force rerun one round number
  FORCE_NEW_VERSION=1   Always create a new report version folder
  REQUEST_TIMEOUT_S     HTTP timeout seconds
  MAX_RETRIES           Retry attempts
  RETRY_BACKOFF_S       Backoff multiplier
  REQUEST_DELAY_S       Delay between barcodes (sequential mode only)
  BARCODE_API_MOCK=1    Offline mode using tests/fixtures/mock_responses.json
"""

from __future__ import annotations

import csv
import json
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any

MODULE_DIR = Path(__file__).resolve().parent
if str(MODULE_DIR) not in sys.path:
    sys.path.insert(0, str(MODULE_DIR))

from config import OUTPUT_DIR, Settings, load_settings
from reports.console_summary import print_console_summary
from reports.csv_report import write_results_csv
from reports.html_dashboard import write_dashboard_html
from reports.json_report import build_summary, write_results_json
from reports.version_manager import (
    compute_results_fingerprint,
    record_version_run,
    resolve_versioned_outputs,
    sync_latest_root_copies,
)
from services.barcode_api import BarcodeApiClient
from services.identifier_classifier import (
    build_identifier_lookup,
    classify_identifier,
)
from services.round_planner import (
    clear_round_result_files,
    compute_round_ranges,
    init_round_state,
    input_mtime,
    load_round_state,
    merge_round_csvs,
    round_csv_path,
    round_state_path,
    save_round_state,
    validate_completed_round_files,
    write_round_csv,
)
from validators.response_validator import validate_barcode_response


def _load_barcodes_from_csv(path: Path) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    with path.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            barcode = (row.get("barcode") or row.get("Barcode") or "").strip()
            if not barcode:
                continue
            expected = (row.get("expected") or row.get("Expected") or "success").strip()
            rows.append({"barcode": barcode, "expected": expected or "success"})
    return rows


def _load_barcodes_from_json(path: Path, sku_set: str) -> list[dict[str, str]]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise SystemExit(f"JSON input must be an object: {path}")

    selected: list[str] = []
    if sku_set in {"all", "yes"}:
        yes_skus = data.get("yes_skus") or []
        if isinstance(yes_skus, list):
            selected.extend(str(item).strip() for item in yes_skus if str(item).strip())
    if sku_set in {"all", "no"}:
        no_skus = data.get("no_skus") or []
        if isinstance(no_skus, list):
            selected.extend(str(item).strip() for item in no_skus if str(item).strip())

    # Fallback shapes: {"skus": [...]} or {"queries": [...]}
    if not selected:
        for key in ("skus", "queries", "barcodes"):
            values = data.get(key)
            if isinstance(values, list):
                selected.extend(
                    str(item).strip() for item in values if str(item).strip()
                )
                break

    seen: set[str] = set()
    rows: list[dict[str, str]] = []
    for barcode in selected:
        if barcode in seen:
            continue
        seen.add(barcode)
        rows.append({"barcode": barcode, "expected": "success"})
    return rows


def _load_barcodes(path: Path, sku_set: str) -> list[dict[str, str]]:
    if not path.is_file():
        raise SystemExit(f"Missing input file: {path}")

    if path.suffix.lower() == ".json":
        rows = _load_barcodes_from_json(path, sku_set)
    else:
        rows = _load_barcodes_from_csv(path)

    if not rows:
        raise SystemExit(f"No barcodes found in {path}")
    return rows


def _load_mock_responses() -> dict[str, dict[str, Any]]:
    fixture = MODULE_DIR / "tests" / "fixtures" / "mock_responses.json"
    if not fixture.is_file():
        return {}
    data = json.loads(fixture.read_text(encoding="utf-8"))
    return data if isinstance(data, dict) else {}


def _execute_lookup(
    client: BarcodeApiClient,
    barcode: str,
    *,
    mock_responses: dict[str, dict[str, Any]] | None = None,
) -> tuple[dict[str, Any], int, str, float]:
    if mock_responses is not None:
        if barcode not in mock_responses:
            return {}, 200, "Empty response", 1.0
        entry = mock_responses[barcode]
        payload = entry.get("payload") if isinstance(entry, dict) else entry
        http_status = (
            int(entry.get("http_status", 200)) if isinstance(entry, dict) else 200
        )
        error = str(entry.get("error", "")) if isinstance(entry, dict) else ""
        if not isinstance(payload, dict):
            payload = {}
        elapsed = (
            float(entry.get("execution_time_ms", 12.0))
            if isinstance(entry, dict)
            else 12.0
        )
        return payload, http_status, error, elapsed
    return client.lookup(barcode)


def _evaluate_barcode(
    client: BarcodeApiClient,
    item: dict[str, str],
    *,
    mock_responses: dict[str, dict[str, Any]] | None = None,
    identifier_lookup: dict[str, str] | None = None,
) -> dict[str, Any]:
    barcode = item["barcode"]
    try:
        payload, http_status, api_error, elapsed_ms = _execute_lookup(
            client, barcode, mock_responses=mock_responses
        )
        outcome = validate_barcode_response(payload, http_status, api_error)
    except Exception as exc:  # noqa: BLE001
        outcome = validate_barcode_response({}, 0, str(exc) or "Unexpected error")
        elapsed_ms = 0.0

    return {
        "barcode": barcode,
        "identifier_type": classify_identifier(barcode, identifier_lookup or {}),
        "expected": item["expected"],
        "status": outcome["status"],
        "reason": outcome["reason"],
        "http_status": outcome["http_status"],
        "product_id": outcome["product_id"],
        "product_name": outcome["product_name"],
        "total_results": outcome["total_results"],
        "plp": outcome["plp"],
        "execution_time_ms": round(elapsed_ms, 2),
    }


def _csv_rows(results: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        {
            "barcode": row["barcode"],
            "identifier_type": row.get("identifier_type", ""),
            "status": row["status"],
            "reason": row["reason"],
            "http_status": row["http_status"],
            "product_id": row["product_id"],
            "product_name": row["product_name"],
            "execution_time_ms": row["execution_time_ms"],
        }
        for row in results
    ]


def _load_existing_results(
    path: Path, *, identifier_lookup: dict[str, str] | None = None
) -> dict[str, dict[str, Any]]:
    if not path.is_file():
        return {}
    existing: dict[str, dict[str, Any]] = {}
    with path.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            barcode = (row.get("barcode") or "").strip()
            if not barcode:
                continue
            identifier_type = (row.get("identifier_type") or "").strip()
            if not identifier_type:
                identifier_type = classify_identifier(
                    barcode, identifier_lookup or {}
                )
            existing[barcode] = {
                "barcode": barcode,
                "identifier_type": identifier_type,
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
    return existing


def _write_reports(
    settings: Settings,
    results: list[dict[str, Any]],
    *,
    execution_time_s: float,
    write_html: bool = True,
    product_dataset_path: Path | None = None,
    dashboard_kind: str = "full",
) -> dict[str, Any]:
    force_new = os.environ.get("FORCE_NEW_VERSION", "").strip().lower() in {
        "1",
        "true",
        "yes",
    }
    fingerprint = compute_results_fingerprint(
        results,
        kind=dashboard_kind,
        extra={
            "input_path": str(settings.input_path),
            "environment": settings.environment,
            "barcode_api_url": settings.barcode_api_url,
        },
    )
    versioned = resolve_versioned_outputs(
        settings.output_dir,
        fingerprint,
        force_new=force_new,
    )

    summary = build_summary(
        results,
        barcode_api_url=settings.barcode_api_url,
        environment=settings.environment,
        barcodes_csv=str(settings.input_path),
        execution_time_s=execution_time_s,
    )
    summary["version"] = versioned.version
    summary["version_label"] = versioned.version_label
    summary["dashboard_kind"] = versioned.kind
    summary["version_dir"] = str(versioned.output_dir)

    csv_rows = _csv_rows(results)
    write_results_csv(versioned.out_csv, csv_rows)
    write_results_json(versioned.out_json, summary, results)
    if write_html:
        write_dashboard_html(
            versioned.out_html,
            results,
            summary,
            product_dataset_path=product_dataset_path,
        )

    sync_latest_root_copies(
        versioned=versioned,
        root_csv=settings.out_csv,
        root_json=settings.out_json,
        root_html=settings.out_html,
    )
    record_version_run(settings.output_dir, versioned, summary=summary)
    print(
        f"Report version: {versioned.version_label} "
        f"(kind={versioned.kind}, new={versioned.is_new_version}) "
        f"-> {versioned.output_dir}",
        flush=True,
    )
    return summary


def _parse_selected_rounds(round_count: int) -> list[int]:
    raw = os.environ.get("ROUND", "all").strip().lower() or "all"
    if raw in {"all", "*"}:
        return list(range(1, round_count + 1))
    try:
        value = int(raw)
    except ValueError as exc:
        raise SystemExit(f"Invalid ROUND value: {raw!r} (use all|1|2|3)") from exc
    if value < 1 or value > round_count:
        raise SystemExit(f"ROUND must be between 1 and {round_count}, got {value}")
    return [value]


def _parse_force_round(round_count: int) -> int | None:
    raw = os.environ.get("FORCE_ROUND", "").strip()
    if not raw:
        return None
    try:
        value = int(raw)
    except ValueError as exc:
        raise SystemExit(f"Invalid FORCE_ROUND value: {raw!r}") from exc
    if value < 1 or value > round_count:
        raise SystemExit(
            f"FORCE_ROUND must be between 1 and {round_count}, got {value}"
        )
    return value


def _process_barcode_items(
    *,
    settings: Settings,
    client: BarcodeApiClient,
    items: list[dict[str, str]],
    mock_responses: dict[str, dict[str, Any]] | None,
    identifier_lookup: dict[str, str],
    existing: dict[str, dict[str, Any]],
    round_label: str,
    round_csv: Path,
) -> list[dict[str, Any]]:
    """Run existing validation over a barcode slice; persist only round CSV."""
    results: list[dict[str, Any] | None] = [None] * len(items)
    pending: list[tuple[int, dict[str, str]]] = []
    for index, item in enumerate(items):
        prior = existing.get(item["barcode"])
        if prior is not None:
            results[index] = prior
        else:
            pending.append((index, item))

    completed = len(items) - len(pending)
    started = time.perf_counter()
    print(
        f"{round_label}: {len(items)} barcodes "
        f"(resume={completed}, pending={len(pending)}, workers={settings.max_workers})",
        flush=True,
    )

    def _persist_round() -> None:
        done_rows = [row for row in results if row is not None]
        write_round_csv(round_csv, _csv_rows(done_rows))

    def _handle_result(index: int, row: dict[str, Any]) -> None:
        nonlocal completed
        results[index] = row
        completed += 1
        print(
            f"[{round_label} {completed}/{len(items)}] {row['barcode']} "
            f"[{row.get('identifier_type', '')}] -> {row['status']}"
            + (f" ({row['reason']})" if row["reason"] else "")
            + f" [{row['execution_time_ms']} ms]",
            flush=True,
        )
        if completed % settings.checkpoint_every == 0 or completed == len(items):
            _persist_round()
            print(
                f"{round_label} checkpoint ({completed}/{len(items)}) -> {round_csv}",
                flush=True,
            )

    if not pending:
        print(f"{round_label}: nothing pending.", flush=True)
        _persist_round()
    elif settings.max_workers == 1 or mock_responses is not None:
        for offset, (index, item) in enumerate(pending):
            if settings.request_delay_s > 0 and offset > 0 and mock_responses is None:
                time.sleep(settings.request_delay_s)
            row = _evaluate_barcode(
                client,
                item,
                mock_responses=mock_responses,
                identifier_lookup=identifier_lookup,
            )
            _handle_result(index, row)
    else:
        with ThreadPoolExecutor(max_workers=settings.max_workers) as executor:
            futures = {
                executor.submit(
                    _evaluate_barcode,
                    client,
                    item,
                    mock_responses=mock_responses,
                    identifier_lookup=identifier_lookup,
                ): index
                for index, item in pending
            }
            for future in as_completed(futures):
                index = futures[future]
                row = future.result()
                _handle_result(index, row)

    final_rows = [row for row in results if row is not None]
    _persist_round()
    elapsed_s = round(time.perf_counter() - started, 2)
    print(
        f"{round_label} complete: processed={len(final_rows)} in {elapsed_s}s",
        flush=True,
    )
    return final_rows


def _print_round_summary(
    *,
    dataset_size: int,
    ranges: list[tuple[int, int]],
    state: dict[str, Any],
    summary: dict[str, Any],
    elapsed_s: float,
) -> None:
    print("=" * 55, flush=True)
    print("Round execution summary", flush=True)
    print("=" * 55, flush=True)
    print(f"Dataset size : {dataset_size}", flush=True)
    for index, (start, end) in enumerate(ranges, start=1):
        info = (state.get("rounds") or {}).get(str(index), {})
        processed = info.get("processed", end - start)
        status = info.get("status", "pending")
        print(
            f"Round {index}     : {processed} processed ({status}) "
            f"[{start}:{end}]",
            flush=True,
        )
    print(f"Passed       : {summary.get('passed', 0)}", flush=True)
    print(f"Failed       : {summary.get('failed', 0)}", flush=True)
    print(f"Execution    : {round(elapsed_s / 60.0, 2)} minutes", flush=True)
    print("=" * 55, flush=True)


def run() -> int:
    settings = load_settings()
    barcodes = _load_barcodes(settings.input_path, settings.sku_set)
    limit_raw = os.environ.get("LIMIT", "").strip()
    if limit_raw:
        barcodes = barcodes[: max(0, int(limit_raw))]

    mock_mode = os.environ.get("BARCODE_API_MOCK", "").strip().lower() in {
        "1",
        "true",
        "yes",
    }
    resume_barcodes = os.environ.get("RESUME", "1").strip().lower() in {
        "1",
        "true",
        "yes",
    }
    resume_rounds = os.environ.get("RESUME_ROUNDS", "true").strip().lower() in {
        "1",
        "true",
        "yes",
    }
    selected_rounds = _parse_selected_rounds(settings.round_count)
    force_round = _parse_force_round(settings.round_count)

    mock_responses = _load_mock_responses() if mock_mode else None
    client = BarcodeApiClient(settings)
    product_dataset = Path(
        os.environ.get("PRODUCT_DATASET_PATH", "").strip()
        or (OUTPUT_DIR / "product_dataset.xlsx")
    ).expanduser().resolve()
    identifier_lookup = build_identifier_lookup(product_dataset)
    print(
        f"Identifier lookup loaded from {product_dataset} "
        f"({len(identifier_lookup)} values)",
        flush=True,
    )

    dataset_size = len(barcodes)
    ranges = compute_round_ranges(dataset_size, settings.round_count)
    state_path = round_state_path(settings.rounds_dir)
    state = load_round_state(state_path)
    current_mtime = input_mtime(settings.input_path)
    identity_mismatch = (
        not state
        or state.get("dataset_size") != dataset_size
        or state.get("input_path") != str(settings.input_path)
        or state.get("ranges") != [[start, end] for start, end in ranges]
        or state.get("input_mtime") != current_mtime
    )
    if identity_mismatch:
        had_prior_state = bool(state)
        removed = clear_round_result_files(settings.rounds_dir, settings.round_count)
        state = init_round_state(
            input_path=str(settings.input_path),
            dataset_size=dataset_size,
            ranges=ranges,
            input_mtime_value=current_mtime,
        )
        save_round_state(state_path, state)
        if had_prior_state or removed:
            print(
                "Round state reset because dataset identity changed. "
                "Existing round files cleared.",
                flush=True,
            )

    round_mode = os.environ.get("ROUND", "all").strip() or "all"
    print("", flush=True)
    print("Execution configuration:", flush=True)
    print(f"  Input path       : {settings.input_path}", flush=True)
    print(f"  Dataset size     : {dataset_size}", flush=True)
    print(f"  ROUND            : {round_mode}", flush=True)
    print(f"  Selected rounds  : {selected_rounds}", flush=True)
    print(f"  ROUND_COUNT      : {settings.round_count}", flush=True)
    print(f"  RESUME_ROUNDS    : {str(resume_rounds).lower()}", flush=True)
    print(f"  RESUME           : {str(resume_barcodes).lower()}", flush=True)
    if force_round is not None:
        print(f"  FORCE_ROUND      : {force_round}", flush=True)
    print(f"  MAX_WORKERS      : {settings.max_workers}", flush=True)
    print(f"  CHECKPOINT_EVERY : {settings.checkpoint_every}", flush=True)
    print(f"  REQUEST_DELAY_S  : {settings.request_delay_s}", flush=True)
    print("", flush=True)
    print(f"Dataset size: {dataset_size}", flush=True)
    print("Round execution plan:", flush=True)
    for index, (start, end) in enumerate(ranges, start=1):
        print(f"Round {index}:", flush=True)
        print(f"  Start index: {start}", flush=True)
        print(f"  End index: {end}", flush=True)
        print(f"  Records: {end - start}", flush=True)
    print("", flush=True)

    overall_started = time.perf_counter()
    rounds_meta = state.setdefault("rounds", {})

    for round_no in selected_rounds:
        start, end = ranges[round_no - 1]
        expected_size = end - start
        round_key = str(round_no)
        round_info = rounds_meta.setdefault(
            round_key,
            {"status": "pending", "processed": 0, "start": start, "end": end},
        )
        out_csv = round_csv_path(settings.rounds_dir, round_no)
        should_force = force_round == round_no
        if (
            resume_rounds
            and not should_force
            and round_info.get("status") == "complete"
            and out_csv.is_file()
        ):
            print(
                f"Round {round_no}: skipped (already complete) -> {out_csv}",
                flush=True,
            )
            continue

        print(
            f"Starting Round {round_no}/{settings.round_count} "
            f"rows [{start}:{end}]",
            flush=True,
        )
        round_info["status"] = "running"
        round_info["start"] = start
        round_info["end"] = end
        save_round_state(state_path, state)

        slice_items = barcodes[start:end]
        existing: dict[str, dict[str, Any]] = {}
        if resume_barcodes and out_csv.is_file() and not should_force:
            existing = _load_existing_results(
                out_csv, identifier_lookup=identifier_lookup
            )

        round_rows = _process_barcode_items(
            settings=settings,
            client=client,
            items=slice_items,
            mock_responses=mock_responses,
            identifier_lookup=identifier_lookup,
            existing=existing,
            round_label=f"Round {round_no}",
            round_csv=out_csv,
        )
        processed = len(round_rows)
        round_info["processed"] = processed
        round_info["path"] = str(out_csv)
        if processed != expected_size:
            round_info["status"] = "failed"
            save_round_state(state_path, state)
            print(
                f"Round {round_no}: incomplete "
                f"(processed={processed}, expected={expected_size}). "
                "Status left as failed; not marked complete.",
                flush=True,
            )
            continue

        round_info["status"] = "complete"
        save_round_state(state_path, state)

    # Final reports only when every round is complete.
    all_complete = all(
        (rounds_meta.get(str(index)) or {}).get("status") == "complete"
        for index in range(1, settings.round_count + 1)
    )
    if not all_complete:
        print(
            "Not all rounds are complete yet; skipping final report merge.",
            flush=True,
        )
        print(f"Round state: {state_path}", flush=True)
        for index in range(1, settings.round_count + 1):
            info = rounds_meta.get(str(index), {})
            print(
                f"  Round {index}: {info.get('status', 'pending')} "
                f"(processed={info.get('processed', 0)})",
                flush=True,
            )
        return 0

    validate_completed_round_files(
        rounds_dir=settings.rounds_dir,
        ranges=ranges,
    )
    round_paths = [
        round_csv_path(settings.rounds_dir, index)
        for index in range(1, settings.round_count + 1)
    ]
    merged = merge_round_csvs(round_paths)
    elapsed_s = round(time.perf_counter() - overall_started, 2)
    summary = _write_reports(
        settings,
        merged,
        execution_time_s=elapsed_s,
        write_html=True,
        product_dataset_path=product_dataset,
    )

    print_console_summary(summary)
    _print_round_summary(
        dataset_size=dataset_size,
        ranges=ranges,
        state=state,
        summary=summary,
        elapsed_s=elapsed_s,
    )
    print(f"CSV  : {settings.out_csv}")
    print(f"JSON : {settings.out_json}")
    print(f"HTML : {settings.out_html}")
    print(f"Version: {summary.get('version_label')} ({summary.get('version_dir')})")
    print(f"Rounds state: {state_path}")

    return 1 if summary["failed"] else 0


def _wants_product_dataset_generation(argv: list[str]) -> bool:
    """Return True only when the user explicitly enables dataset generation."""
    if "--generate-product-dataset" in argv:
        return True
    for key in ("GENERATE_DATASET", "generate_dataset"):
        if os.environ.get(key, "").strip().lower() in {"1", "true", "yes"}:
            return True
    return False


if __name__ == "__main__":
    if _wants_product_dataset_generation(sys.argv):
        from dataset_generator.generator import run_dataset_generation

        raise SystemExit(run_dataset_generation())
    raise SystemExit(run())
