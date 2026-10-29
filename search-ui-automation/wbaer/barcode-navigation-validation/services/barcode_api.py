"""Barcode API client with retry/backoff (stdlib urllib).

Matches the storefront curl shape:
  GET {barcode_api_url}?query={sku}
  Referer + browser User-Agent + Content-Type: application/json
"""

from __future__ import annotations

import json
import socket
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

from config import Settings
from constants import REASON_INVALID_RESPONSE, REASON_TIMEOUT, REASON_UNEXPECTED


class BarcodeApiClient:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    def lookup(self, barcode: str) -> tuple[dict[str, Any], int, str, float]:
        """Return (payload, http_status, error_message, execution_time_ms)."""
        params = {"query": barcode}
        url = f"{self._settings.barcode_api_url}?{urllib.parse.urlencode(params)}"
        last_error = ""
        started = time.perf_counter()

        for attempt in range(1, self._settings.max_retries + 1):
            req = urllib.request.Request(url, method="GET")
            req.add_header("Accept", "application/json")
            req.add_header("Content-Type", "application/json")
            req.add_header("User-Agent", self._settings.search_api_user_agent)
            if self._settings.referer:
                req.add_header("Referer", self._settings.referer)
            try:
                with urllib.request.urlopen(
                    req, timeout=self._settings.request_timeout_s
                ) as resp:
                    body = resp.read().decode("utf-8", errors="replace")
                    if not body.strip():
                        elapsed_ms = (time.perf_counter() - started) * 1000.0
                        return {}, int(resp.status), "Empty response", elapsed_ms
                    try:
                        payload = json.loads(body)
                    except json.JSONDecodeError:
                        elapsed_ms = (time.perf_counter() - started) * 1000.0
                        return {}, int(resp.status), REASON_INVALID_RESPONSE, elapsed_ms
                    if not isinstance(payload, dict):
                        payload = {"data": payload}
                    elapsed_ms = (time.perf_counter() - started) * 1000.0
                    return payload, int(resp.status), "", elapsed_ms
            except urllib.error.HTTPError as exc:
                body = exc.read().decode("utf-8", errors="replace")
                last_error = f"HTTP {exc.code}"
                try:
                    payload = json.loads(body) if body.strip() else {}
                except json.JSONDecodeError:
                    payload = {}
                if not isinstance(payload, dict):
                    payload = {}
                elapsed_ms = (time.perf_counter() - started) * 1000.0
                if exc.code in {429, 503} and attempt < self._settings.max_retries:
                    time.sleep(self._settings.retry_backoff_s * attempt)
                    continue
                return payload, int(exc.code), last_error, elapsed_ms
            except (TimeoutError, socket.timeout):
                last_error = REASON_TIMEOUT
                if attempt < self._settings.max_retries:
                    time.sleep(self._settings.retry_backoff_s * attempt)
                    continue
                elapsed_ms = (time.perf_counter() - started) * 1000.0
                return {}, 0, last_error, elapsed_ms
            except urllib.error.URLError as exc:
                reason = str(getattr(exc, "reason", exc))
                if "timed out" in reason.lower() or isinstance(
                    getattr(exc, "reason", None), TimeoutError
                ):
                    last_error = REASON_TIMEOUT
                else:
                    last_error = reason or REASON_UNEXPECTED
                if attempt < self._settings.max_retries:
                    time.sleep(self._settings.retry_backoff_s * attempt)
                    continue
            except Exception as exc:  # noqa: BLE001
                last_error = str(exc) or REASON_UNEXPECTED
                if attempt < self._settings.max_retries:
                    time.sleep(self._settings.retry_backoff_s * attempt)
                    continue

        elapsed_ms = (time.perf_counter() - started) * 1000.0
        return {}, 0, last_error or REASON_UNEXPECTED, elapsed_ms
