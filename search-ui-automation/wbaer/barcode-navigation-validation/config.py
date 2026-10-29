"""Configuration loading for barcode navigation validation."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from constants import (
    API_URLS,
    DEFAULT_CHECKPOINT_EVERY,
    DEFAULT_ENVIRONMENT,
    DEFAULT_MAX_RETRIES,
    DEFAULT_MAX_WORKERS,
    DEFAULT_PAGE_SIZE,
    DEFAULT_REFERER,
    DEFAULT_REQUEST_DELAY_S,
    DEFAULT_REQUEST_TIMEOUT_S,
    DEFAULT_RETRY_BACKOFF_S,
    DEFAULT_ROUND_COUNT,
    DEFAULT_USER_AGENT,
    INPUT_FILENAME,
    INPUT_JSON_FILENAME,
    OUT_CSV_FILENAME,
    OUT_HTML_FILENAME,
    OUT_JSON_FILENAME,
    ROUNDS_DIRNAME,
)

MODULE_DIR = Path(__file__).resolve().parent
INPUT_DIR = MODULE_DIR / "input"
OUTPUT_DIR = MODULE_DIR / "output"


@dataclass(frozen=True)
class Settings:
    barcode_api_url: str
    environment: str
    search_api_user_agent: str
    referer: str
    request_timeout_s: int
    max_retries: int
    retry_backoff_s: float
    request_delay_s: float
    page_size: int
    max_workers: int
    checkpoint_every: int
    round_count: int
    sku_set: str
    input_path: Path
    out_csv: Path
    out_json: Path
    out_html: Path
    output_dir: Path
    rounds_dir: Path

    @property
    def barcodes_csv(self) -> Path:
        """Backward-compatible alias used in reports."""
        return self.input_path


def _resolve_barcode_api_url() -> tuple[str, str]:
    """Return (barcode_api_url, environment) from env overrides."""
    environment = os.environ.get("ENVIRONMENT", DEFAULT_ENVIRONMENT).strip().lower()
    if environment not in API_URLS:
        environment = DEFAULT_ENVIRONMENT

    for key in ("BARCODE_API_URL", "BASE_URL", "SEARCH_API_URL"):
        override = os.environ.get(key, "").strip()
        if override:
            return _ensure_barcode_path(override), environment

    return API_URLS[environment], environment


def _ensure_barcode_path(url: str) -> str:
    """If a /search URL is provided, map it to the /barcode route."""
    cleaned = url.rstrip("/")
    if cleaned.endswith("/search"):
        return f"{cleaned[: -len('/search')]}/barcode"
    if cleaned.endswith("/barcode"):
        return cleaned
    return cleaned


def _resolve_input_path() -> Path:
    for key in ("BARCODES_JSON_PATH", "SKUS_JSON_PATH", "BARCODES_CSV_PATH"):
        override = os.environ.get(key, "").strip()
        if override:
            return Path(override).expanduser().resolve()

    default_json = INPUT_DIR / INPUT_JSON_FILENAME
    if default_json.is_file():
        return default_json.resolve()
    return (INPUT_DIR / INPUT_FILENAME).resolve()


def load_settings() -> Settings:
    barcode_api_url, environment = _resolve_barcode_api_url()
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    rounds_dir = (OUTPUT_DIR / ROUNDS_DIRNAME).resolve()
    rounds_dir.mkdir(parents=True, exist_ok=True)

    sku_set = os.environ.get("SKU_SET", "all").strip().lower()
    if sku_set not in {"all", "yes", "no"}:
        sku_set = "all"

    round_count = max(
        1, int(os.environ.get("ROUND_COUNT", str(DEFAULT_ROUND_COUNT)))
    )

    return Settings(
        barcode_api_url=barcode_api_url,
        environment=environment,
        search_api_user_agent=os.environ.get(
            "SEARCH_API_USER_AGENT", DEFAULT_USER_AGENT
        ).strip(),
        referer=os.environ.get("REFERER", DEFAULT_REFERER).strip(),
        request_timeout_s=int(
            os.environ.get("REQUEST_TIMEOUT_S", str(DEFAULT_REQUEST_TIMEOUT_S))
        ),
        max_retries=int(os.environ.get("MAX_RETRIES", str(DEFAULT_MAX_RETRIES))),
        retry_backoff_s=float(
            os.environ.get("RETRY_BACKOFF_S", str(DEFAULT_RETRY_BACKOFF_S))
        ),
        request_delay_s=float(
            os.environ.get("REQUEST_DELAY_S", str(DEFAULT_REQUEST_DELAY_S))
        ),
        page_size=int(os.environ.get("PAGE_SIZE", str(DEFAULT_PAGE_SIZE))),
        max_workers=max(
            1, int(os.environ.get("MAX_WORKERS", str(DEFAULT_MAX_WORKERS)))
        ),
        checkpoint_every=max(
            1,
            int(os.environ.get("CHECKPOINT_EVERY", str(DEFAULT_CHECKPOINT_EVERY))),
        ),
        round_count=round_count,
        sku_set=sku_set,
        input_path=_resolve_input_path(),
        out_csv=(OUTPUT_DIR / OUT_CSV_FILENAME).resolve(),
        out_json=(OUTPUT_DIR / OUT_JSON_FILENAME).resolve(),
        out_html=(OUTPUT_DIR / OUT_HTML_FILENAME).resolve(),
        output_dir=OUTPUT_DIR.resolve(),
        rounds_dir=rounds_dir,
    )
