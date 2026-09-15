"""Shared constants for barcode navigation validation."""

from __future__ import annotations

DEFAULT_ENVIRONMENT = "qa"

API_URLS: dict[str, str] = {
    "qa": "https://search-api-wurthbaer-qa.search-villvay.workers.dev/barcode",
    "prod": "https://search-api-wurthbaer.search-villvay.workers.dev/barcode",
}

DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36"
)
DEFAULT_REFERER = "https://qa-baersupply.vercel.app/"
DEFAULT_REQUEST_TIMEOUT_S = 30
DEFAULT_MAX_RETRIES = 3
DEFAULT_RETRY_BACKOFF_S = 0.8
DEFAULT_REQUEST_DELAY_S = 0.0
DEFAULT_PAGE_SIZE = 20

INPUT_FILENAME = "barcodes.csv"
INPUT_JSON_FILENAME = "plp_redirect_ALL_skus.json"
OUT_CSV_FILENAME = "barcode_navigation_results.csv"
OUT_JSON_FILENAME = "barcode_navigation_results.json"
OUT_HTML_FILENAME = "barcode_navigation_dashboard.html"
DEFAULT_CHECKPOINT_EVERY = 100
DEFAULT_MAX_WORKERS = 8
DEFAULT_ROUND_COUNT = 3
ROUNDS_DIRNAME = "rounds"
ROUND_STATE_FILENAME = "rounds_state.json"
ROUND_CSV_TEMPLATE = "round_{round_no}_results.csv"

STATUS_PASS = "PASS"
STATUS_FAIL = "FAIL"

CSV_FIELDNAMES = [
    "barcode",
    "identifier_type",
    "status",
    "reason",
    "http_status",
    "product_id",
    "product_name",
    "execution_time_ms",
]

REASON_OK = ""
REASON_NO_PRODUCT = "No product returned"
REASON_PRODUCT_MISSING = "Product missing"
REASON_INVALID_RESPONSE = "Invalid response"
REASON_TIMEOUT = "Timeout"
REASON_EMPTY_RESPONSE = "Empty response"
REASON_UNEXPECTED = "Unexpected error"
