"""Read/write product_dataset.xlsx with merge-on-materialNumber semantics."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from openpyxl import Workbook, load_workbook

from dataset_generator.extractor import (
    PRODUCT_COLUMNS,
    merge_fill_blanks,
    product_key,
)

SHEET_NAME = "Products"


def read_existing_products(path: Path) -> list[dict[str, str]]:
    if not path.is_file():
        return []
    workbook = load_workbook(path, read_only=True, data_only=True)
    try:
        sheet = workbook[SHEET_NAME] if SHEET_NAME in workbook.sheetnames else workbook.active
        rows_iter = sheet.iter_rows(values_only=True)
        header = next(rows_iter, None)
        if not header:
            return []
        headers = [str(cell or "").strip() for cell in header]
        products: list[dict[str, str]] = []
        for values in rows_iter:
            row = {
                col: "" if values[idx] is None else str(values[idx]).strip()
                for idx, col in enumerate(headers)
                if col in PRODUCT_COLUMNS and idx < len(values)
            }
            for col in PRODUCT_COLUMNS:
                row.setdefault(col, "")
            if any(row.values()):
                products.append(row)
        return products
    finally:
        workbook.close()


def _index_products(
    products: list[dict[str, str]],
) -> dict[tuple[str, str], int]:
    index: dict[tuple[str, str], int] = {}
    for idx, row in enumerate(products):
        key = product_key(row)
        if key[0] and key not in index:
            index[key] = idx
        # Also index secondary keys when materialNumber exists so fallbacks work.
        material = (row.get("materialNumber") or "").strip()
        mfr = (row.get("MFRPartNo") or "").strip()
        upc = (row.get("UPCCode") or "").strip()
        if material:
            index.setdefault(("materialNumber", material), idx)
        if mfr:
            index.setdefault(("MFRPartNo", mfr), idx)
        if upc:
            index.setdefault(("UPCCode", upc), idx)
    return index


def merge_products(
    existing: list[dict[str, str]],
    incoming: list[dict[str, str]],
) -> dict[str, Any]:
    """Merge incoming into existing; return rows + counters."""
    merged = [dict(row) for row in existing]
    index = _index_products(merged)
    added = 0
    updated = 0
    skipped = 0

    for row in incoming:
        key = product_key(row)
        match_idx: int | None = None
        if key[0] and key in index:
            match_idx = index[key]
        else:
            # Try fallbacks explicitly in required order.
            for key_type in ("materialNumber", "MFRPartNo", "UPCCode"):
                value = (row.get(key_type) or "").strip()
                if value and (key_type, value) in index:
                    match_idx = index[(key_type, value)]
                    break

        if match_idx is None:
            merged.append(dict(row))
            new_idx = len(merged) - 1
            for key_type in ("materialNumber", "MFRPartNo", "UPCCode"):
                value = (row.get(key_type) or "").strip()
                if value:
                    index[(key_type, value)] = new_idx
            added += 1
            continue

        filled, changed = merge_fill_blanks(merged[match_idx], row)
        if changed:
            merged[match_idx] = filled
            updated += 1
            for key_type in ("materialNumber", "MFRPartNo", "UPCCode"):
                value = (filled.get(key_type) or "").strip()
                if value:
                    index[(key_type, value)] = match_idx
        else:
            skipped += 1

    merged.sort(key=lambda item: (item.get("Product") or "").lower())
    return {
        "rows": merged,
        "existing_count": len(existing),
        "added": added,
        "updated": updated,
        "skipped": skipped,
    }


def write_products(path: Path, rows: list[dict[str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = SHEET_NAME
    sheet.append(list(PRODUCT_COLUMNS))
    for row in rows:
        sheet.append([row.get(col, "") for col in PRODUCT_COLUMNS])
    workbook.save(path)
