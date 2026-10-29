"""Extract product fields from Search / multisearch API responses."""

from __future__ import annotations

from typing import Any

PRODUCT_COLUMNS = (
    "Product",
    "materialNumber",
    "MFRPartNo",
    "UPCCode",
    "Alias",
)


def _as_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, (list, tuple)):
        parts = [str(item).strip() for item in value if str(item).strip()]
        return ", ".join(parts)
    return str(value).strip()


def extract_products(payload: dict[str, Any]) -> list[dict[str, str]]:
    """Return normalized product rows from one API page payload."""
    results = payload.get("results") if isinstance(payload, dict) else None
    products = None
    if isinstance(results, dict):
        products = results.get("products")
    if not isinstance(products, list):
        products = payload.get("products") if isinstance(payload, dict) else None
    if not isinstance(products, list):
        return []

    rows: list[dict[str, str]] = []
    for item in products:
        if not isinstance(item, dict):
            continue
        product_name = (
            _as_text(item.get("productTitle"))
            or _as_text(item.get("primaryProductTitle"))
            or _as_text(item.get("originalProductTitle"))
            or _as_text(item.get("name"))
            or _as_text(item.get("title"))
        )
        row = {
            "Product": product_name,
            "materialNumber": _as_text(item.get("materialNumber")),
            "MFRPartNo": _as_text(item.get("MFRPartNo")),
            "UPCCode": _as_text(item.get("UPCCode") or item.get("upcCode")),
            "Alias": _as_text(item.get("alias") or item.get("Alias")),
        }
        if any(row.values()):
            rows.append(row)
    return rows


def completeness_score(row: dict[str, str]) -> int:
    return sum(1 for key in PRODUCT_COLUMNS if (row.get(key) or "").strip())


def product_key(row: dict[str, str]) -> tuple[str, str]:
    """Return (key_type, key_value) for dedupe / merge lookups."""
    material = (row.get("materialNumber") or "").strip()
    if material:
        return "materialNumber", material
    mfr = (row.get("MFRPartNo") or "").strip()
    if mfr:
        return "MFRPartNo", mfr
    upc = (row.get("UPCCode") or "").strip()
    if upc:
        return "UPCCode", upc
    return "", ""


def merge_fill_blanks(
    existing: dict[str, str], incoming: dict[str, str]
) -> tuple[dict[str, str], bool]:
    """Fill blank fields on existing from incoming. Never overwrite with blanks."""
    updated = dict(existing)
    changed = False
    for key in PRODUCT_COLUMNS:
        current = (updated.get(key) or "").strip()
        new_value = (incoming.get(key) or "").strip()
        if not current and new_value:
            updated[key] = new_value
            changed = True
    return updated, changed
