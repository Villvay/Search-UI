"""Manual product dataset generator (opt-in only).

Fetches products from the Search multisearch API for each query in
``input/search_queries.csv`` and writes/updates ``output/product_dataset.xlsx``.
"""

from __future__ import annotations

import csv
import json
import os
import socket
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

from config import INPUT_DIR, OUTPUT_DIR, Settings, load_settings
from dataset_generator.excel_writer import (
    merge_products,
    read_existing_products,
    write_products,
)
from dataset_generator.extractor import (
    completeness_score,
    extract_products,
    product_key,
)

SEARCH_QUERIES_FILENAME = "search_queries.csv"
PRODUCT_DATASET_FILENAME = "product_dataset.xlsx"


def _resolve_multisearch_url(settings: Settings) -> str:
    override = os.environ.get("SEARCH_API_URL", "").strip() or os.environ.get(
        "MULTISEARCH_API_URL", ""
    ).strip()
    if override:
        cleaned = override.rstrip("/")
        if cleaned.endswith("/barcode"):
            return f"{cleaned[: -len('/barcode')]}/multisearch"
        if cleaned.endswith("/search"):
            return f"{cleaned[: -len('/search')]}/multisearch"
        if cleaned.endswith("/multisearch"):
            return cleaned
        return cleaned

    barcode_url = settings.barcode_api_url.rstrip("/")
    if barcode_url.endswith("/barcode"):
        return f"{barcode_url[: -len('/barcode')]}/multisearch"
    return "https://search-api-wurthbaer-qa.search-villvay.workers.dev/multisearch"


def _load_queries(path: Path) -> list[str]:
    if not path.is_file():
        raise SystemExit(f"Missing search queries file: {path}")
    queries: list[str] = []
    with path.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            query = (row.get("query") or row.get("Query") or "").strip()
            if query:
                queries.append(query)
    if not queries:
        raise SystemExit(f"No queries found in {path}")
    return queries


def _fetch_page(
    *,
    search_api_url: str,
    settings: Settings,
    query: str,
    page: int,
) -> tuple[dict[str, Any], int, str]:
    params = {
        "query": query,
        "page": str(page),
        "pageSize": str(settings.page_size),
    }
    url = f"{search_api_url}?{urllib.parse.urlencode(params)}"
    last_error = ""

    for attempt in range(1, settings.max_retries + 1):
        req = urllib.request.Request(url, method="GET")
        req.add_header("Accept", "application/json")
        req.add_header("Content-Type", "application/json")
        req.add_header("User-Agent", settings.search_api_user_agent)
        if settings.referer:
            req.add_header("Referer", settings.referer)
        try:
            with urllib.request.urlopen(req, timeout=settings.request_timeout_s) as resp:
                body = resp.read().decode("utf-8", errors="replace")
                if not body.strip():
                    return {}, int(resp.status), "Empty response"
                try:
                    payload = json.loads(body)
                except json.JSONDecodeError:
                    return {}, int(resp.status), "Invalid response"
                if not isinstance(payload, dict):
                    payload = {"data": payload}
                return payload, int(resp.status), ""
        except urllib.error.HTTPError as exc:
            last_error = f"HTTP {exc.code}"
            if exc.code in {429, 503} and attempt < settings.max_retries:
                time.sleep(settings.retry_backoff_s * attempt)
                continue
            return {}, int(exc.code), last_error
        except (TimeoutError, socket.timeout):
            last_error = "Timeout"
            if attempt < settings.max_retries:
                time.sleep(settings.retry_backoff_s * attempt)
                continue
            return {}, 0, last_error
        except urllib.error.URLError as exc:
            reason = str(getattr(exc, "reason", exc))
            last_error = (
                "Timeout"
                if "timed out" in reason.lower()
                else (reason or "Unexpected error")
            )
            if attempt < settings.max_retries:
                time.sleep(settings.retry_backoff_s * attempt)
                continue
        except Exception as exc:  # noqa: BLE001
            last_error = str(exc) or "Unexpected error"
            if attempt < settings.max_retries:
                time.sleep(settings.retry_backoff_s * attempt)
                continue

    return {}, 0, last_error or "Unexpected error"


def _dedupe_by_material(rows: list[dict[str, str]]) -> tuple[list[dict[str, str]], int]:
    """Keep one row per identity; prefer the first most-complete record."""
    best: dict[tuple[str, str], dict[str, str]] = {}
    order: list[tuple[str, str]] = []
    duplicates = 0

    # Prefer higher completeness when replacing; keep first complete-enough.
    for row in rows:
        key = product_key(row)
        if not key[0]:
            # No usable identity — keep as unique by Product text fallback.
            key = ("Product", (row.get("Product") or "").strip() or str(id(row)))
        if key not in best:
            best[key] = row
            order.append(key)
            continue
        duplicates += 1
        current = best[key]
        if completeness_score(row) > completeness_score(current):
            # Prefer more complete only when current was incomplete.
            filled = dict(current)
            for field, value in row.items():
                if not (filled.get(field) or "").strip() and (value or "").strip():
                    filled[field] = value
            best[key] = filled
        else:
            filled = dict(current)
            for field, value in row.items():
                if not (filled.get(field) or "").strip() and (value or "").strip():
                    filled[field] = value
            best[key] = filled

    return [best[key] for key in order], duplicates


def fetch_all_products_for_query(
    *,
    search_api_url: str,
    settings: Settings,
    query: str,
) -> tuple[list[dict[str, str]], str]:
    """Paginate multisearch for one query. Returns (products, error)."""
    collected: list[dict[str, str]] = []
    page = 1
    total_pages = 1

    while page <= total_pages:
        payload, http_status, error = _fetch_page(
            search_api_url=search_api_url,
            settings=settings,
            query=query,
            page=page,
        )
        if error or http_status != 200:
            if page == 1:
                return [], error or f"HTTP {http_status}"
            print(
                f"  page {page} failed ({error or http_status}); stopping pagination",
                flush=True,
            )
            break

        summary = payload.get("summary") if isinstance(payload.get("summary"), dict) else {}
        try:
            total_pages = int(summary.get("totalPages") or 1)
        except (TypeError, ValueError):
            total_pages = 1
        total_pages = max(total_pages, 1)

        page_products = extract_products(payload)
        collected.extend(page_products)
        if not page_products:
            break
        page += 1
        if settings.request_delay_s > 0:
            time.sleep(settings.request_delay_s)

    return collected, ""


def run_dataset_generation() -> int:
    settings = load_settings()
    queries_path = Path(
        os.environ.get("SEARCH_QUERIES_CSV_PATH", "").strip()
        or (INPUT_DIR / SEARCH_QUERIES_FILENAME)
    ).expanduser().resolve()
    excel_path = Path(
        os.environ.get("PRODUCT_DATASET_PATH", "").strip()
        or (OUTPUT_DIR / PRODUCT_DATASET_FILENAME)
    ).expanduser().resolve()
    overwrite = os.environ.get("OVERWRITE_PRODUCT_DATASET", "").strip().lower() in {
        "1",
        "true",
        "yes",
    } or ("--overwrite-product-dataset" in sys.argv)

    search_api_url = _resolve_multisearch_url(settings)
    queries = _load_queries(queries_path)

    print("=" * 55, flush=True)
    print("Product Dataset Generation (manual utility)", flush=True)
    print("=" * 55, flush=True)
    print(f"Search API : {search_api_url}", flush=True)
    print(f"Queries    : {queries_path}", flush=True)
    print(f"Excel      : {excel_path}", flush=True)
    print(f"Overwrite  : {overwrite}", flush=True)
    print(f"Queries    : {len(queries)}", flush=True)
    print("", flush=True)

    existing = [] if overwrite else read_existing_products(excel_path)
    all_returned: list[dict[str, str]] = []
    failed_queries = 0
    products_returned = 0

    for index, query in enumerate(queries, start=1):
        print(f"Processing query {index}/{len(queries)}: {query!r}", flush=True)
        products, error = fetch_all_products_for_query(
            search_api_url=search_api_url,
            settings=settings,
            query=query,
        )
        if error:
            failed_queries += 1
            print(f"  FAILED: {error}", flush=True)
            continue

        products_returned += len(products)
        all_returned.extend(products)
        unique_so_far, _ = _dedupe_by_material(all_returned)
        print(f"  Products extracted: {len(products)}", flush=True)
        print(f"  Unique products: {len(unique_so_far)}", flush=True)

    unique_rows, duplicates_removed = _dedupe_by_material(all_returned)
    merge_result = merge_products(existing, unique_rows)
    write_products(excel_path, merge_result["rows"])

    print("", flush=True)
    print("=" * 55, flush=True)
    print("Dataset generation summary", flush=True)
    print("=" * 55, flush=True)
    print(f"Queries processed            : {len(queries)}")
    print(f"Products returned            : {products_returned}")
    print(f"Existing products            : {merge_result['existing_count']}")
    print(f"New products added           : {merge_result['added']}")
    print(f"Existing products updated    : {merge_result['updated']}")
    print(f"Duplicate products skipped   : {merge_result['skipped']}")
    print(f"Duplicates removed (in-run)  : {duplicates_removed}")
    print(f"Failed queries               : {failed_queries}")
    print(f"Final unique product count   : {len(merge_result['rows'])}")
    print(f"Excel path                   : {excel_path}")
    print("=" * 55, flush=True)
    return 1 if failed_queries == len(queries) and queries else 0


if __name__ == "__main__":
    raise SystemExit(run_dataset_generation())
