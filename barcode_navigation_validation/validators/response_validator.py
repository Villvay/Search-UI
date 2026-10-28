"""Validate barcode API responses for direct product navigation."""

from __future__ import annotations

from typing import Any

from constants import (
    REASON_EMPTY_RESPONSE,
    REASON_INVALID_RESPONSE,
    REASON_NO_PRODUCT,
    REASON_PRODUCT_MISSING,
    REASON_TIMEOUT,
    REASON_UNEXPECTED,
    STATUS_FAIL,
    STATUS_PASS,
)


def deep_get(payload: Any, *paths: str) -> Any:
    for path in paths:
        cur = payload
        ok = True
        for part in path.split("."):
            if isinstance(cur, dict) and part in cur:
                cur = cur[part]
            else:
                ok = False
                break
        if ok and cur is not None:
            return cur
    return None


def as_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value != 0
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "y"}
    return False


def as_int(value: Any) -> int | None:
    if value is None or value == "":
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def extract_plp_product(payload: dict[str, Any]) -> dict[str, Any] | None:
    """Return the single product object used for PLP/direct navigation."""
    product = deep_get(payload, "results.plpProduct", "plpProduct")
    if isinstance(product, dict) and product:
        return product

    products = deep_get(payload, "results.products", "products")
    if isinstance(products, list) and products:
        first = products[0]
        if isinstance(first, dict) and first:
            return first
    return None


def extract_product_fields(product: dict[str, Any] | None) -> tuple[str, str]:
    if not product:
        return "", ""

    product_id = (
        product.get("materialNumber")
        or product.get("id")
        or product.get("sapId")
        or product.get("MFRPartNo")
        or ""
    )
    product_name = (
        product.get("primaryProductTitle")
        or product.get("productTitle")
        or product.get("groupName")
        or product.get("name")
        or ""
    )
    return str(product_id), str(product_name)


def validate_barcode_response(
    payload: dict[str, Any] | None,
    http_status: int,
    api_error: str,
) -> dict[str, Any]:
    """Return status, reason, total, plp flag, and product fields."""
    error = (api_error or "").strip()
    error_lower = error.lower()

    if error_lower == REASON_TIMEOUT.lower() or "timed out" in error_lower:
        return _fail(REASON_TIMEOUT, http_status)

    if error_lower == REASON_INVALID_RESPONSE.lower() or "invalid" in error_lower:
        return _fail(REASON_INVALID_RESPONSE, http_status)

    if error_lower == "empty response":
        return _fail(REASON_EMPTY_RESPONSE, http_status)

    if http_status == 0:
        return _fail(error or REASON_UNEXPECTED, http_status)

    if http_status != 200:
        reason = error if error.startswith("HTTP ") else f"HTTP {http_status}"
        return _fail(reason, http_status)

    if not isinstance(payload, dict) or not payload:
        return _fail(REASON_EMPTY_RESPONSE, http_status)

    summary = payload.get("summary") if isinstance(payload.get("summary"), dict) else {}
    total = as_int(summary.get("total") if summary else None)
    if total is None:
        total = as_int(deep_get(payload, "total"))
    total = total if total is not None else 0

    plp = as_bool(summary.get("plp") if summary else None) or as_bool(
        deep_get(payload, "plp")
    )
    product = extract_plp_product(payload)
    product_id, product_name = extract_product_fields(product)

    if total == 0:
        return _fail(REASON_NO_PRODUCT, http_status, total=total, plp=plp)

    if total != 1:
        return _fail(
            f"Expected 1 product, got {total}",
            http_status,
            total=total,
            plp=plp,
            product_id=product_id,
            product_name=product_name,
        )

    if not plp:
        return _fail(
            "Response does not indicate direct product navigation",
            http_status,
            total=total,
            plp=plp,
            product_id=product_id,
            product_name=product_name,
        )

    if product is None:
        return _fail(
            REASON_PRODUCT_MISSING,
            http_status,
            total=total,
            plp=plp,
        )

    return {
        "status": STATUS_PASS,
        "reason": "",
        "http_status": http_status,
        "total_results": total,
        "plp": plp,
        "product_id": product_id,
        "product_name": product_name,
    }


def _fail(
    reason: str,
    http_status: int,
    *,
    total: int = 0,
    plp: bool = False,
    product_id: str = "",
    product_name: str = "",
) -> dict[str, Any]:
    return {
        "status": STATUS_FAIL,
        "reason": reason,
        "http_status": http_status,
        "total_results": total,
        "plp": plp,
        "product_id": product_id,
        "product_name": product_name,
    }
