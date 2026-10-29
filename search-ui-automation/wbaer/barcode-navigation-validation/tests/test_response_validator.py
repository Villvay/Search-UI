"""Unit tests for barcode response validation."""

from __future__ import annotations

import sys
from pathlib import Path

MODULE_DIR = Path(__file__).resolve().parents[1]
if str(MODULE_DIR) not in sys.path:
    sys.path.insert(0, str(MODULE_DIR))

from constants import STATUS_FAIL, STATUS_PASS
from validators.response_validator import validate_barcode_response


def test_pass_single_plp_product() -> None:
    payload = {
        "summary": {"total": 1, "plp": True},
        "results": {
            "plpProduct": {
                "materialNumber": "FL6903-20MC-48",
                "primaryProductTitle": "Formica laminate",
            }
        },
    }
    result = validate_barcode_response(payload, 200, "")
    assert result["status"] == STATUS_PASS
    assert result["product_id"] == "FL6903-20MC-48"


def test_fail_no_product() -> None:
    result = validate_barcode_response({"summary": {"total": 0, "plp": False}}, 200, "")
    assert result["status"] == STATUS_FAIL
    assert result["reason"] == "No product returned"


def test_fail_http_error() -> None:
    result = validate_barcode_response({}, 500, "HTTP 500")
    assert result["status"] == STATUS_FAIL
    assert result["reason"] == "HTTP 500"


def test_fail_timeout() -> None:
    result = validate_barcode_response({}, 0, "Timeout")
    assert result["status"] == STATUS_FAIL
    assert result["reason"] == "Timeout"


def test_fail_product_missing() -> None:
    payload = {"summary": {"total": 1, "plp": True}, "results": {}}
    result = validate_barcode_response(payload, 200, "")
    assert result["status"] == STATUS_FAIL
    assert result["reason"] == "Product missing"


if __name__ == "__main__":
    test_pass_single_plp_product()
    test_fail_no_product()
    test_fail_http_error()
    test_fail_timeout()
    test_fail_product_missing()
    print("All validator tests passed")
