"""Console summary for barcode navigation validation."""

from __future__ import annotations

from typing import Any


def print_console_summary(summary: dict[str, Any]) -> None:
    print("=" * 55)
    print("Barcode Navigation Validation")
    print("=" * 55)
    print(f"Total Tested : {summary.get('total_tested', 0)}")
    print(f"Passed       : {summary.get('passed', 0)}")
    print(f"Failed       : {summary.get('failed', 0)}")
    print(f"Environment  : {summary.get('environment', '')}")
    print(f"API URL      : {summary.get('barcode_api_url', '')}")
    print(f"Generated    : {summary.get('generated_at', '')}")
    print("=" * 55)
