"""Versioned dashboard/report outputs for barcode navigation validation."""

from __future__ import annotations

import hashlib
import json
import shutil
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from constants import OUT_CSV_FILENAME, OUT_HTML_FILENAME, OUT_JSON_FILENAME

VERSIONS_MANIFEST_FILENAME = "versions.json"
LATEST_POINTER_FILENAME = "latest.json"
VERSIONS_DIRNAME = "versions"


@dataclass(frozen=True)
class VersionedOutputs:
    version: int
    version_label: str
    kind: str
    output_dir: Path
    out_csv: Path
    out_json: Path
    out_html: Path
    is_new_version: bool
    fingerprint_key: str


def _load_manifest(path: Path) -> dict[str, Any]:
    if not path.is_file():
        return {"versions": [], "latest_version": 0, "latest_by_kind": {}}
    data = json.loads(path.read_text(encoding="utf-8"))
    data.setdefault("versions", [])
    data.setdefault("latest_version", 0)
    data.setdefault("latest_by_kind", {})
    return data


def _save_manifest(path: Path, manifest: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )


def compute_results_fingerprint(
    rows: list[dict[str, Any]],
    *,
    kind: str,
    extra: dict[str, Any] | None = None,
) -> dict[str, Any]:
    digest = hashlib.sha256()
    digest.update(str(kind or "full").encode("utf-8"))
    digest.update(b"\n")
    for row in rows:
        digest.update(
            (
                f"{row.get('barcode', '')}|"
                f"{row.get('status', '')}|"
                f"{row.get('identifier_type', '')}|"
                f"{row.get('reason', '')}\n"
            ).encode("utf-8")
        )
    payload = {
        "kind": kind or "full",
        "row_count": len(rows),
        "passed": sum(1 for row in rows if row.get("status") == "PASS"),
        "failed": sum(1 for row in rows if row.get("status") == "FAIL"),
        "results_sha256": digest.hexdigest(),
    }
    if extra:
        payload["extra"] = extra
    return payload


def fingerprint_key(fingerprint: dict[str, Any]) -> str:
    canonical = json.dumps(fingerprint, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _write_latest_pointer(
    outputs_dir: Path,
    *,
    version: int,
    version_label: str,
    kind: str,
    out_html_name: str = OUT_HTML_FILENAME,
) -> None:
    relative_dashboard = f"{VERSIONS_DIRNAME}/{version_label}/{out_html_name}"
    pointer = {
        "version": version,
        "version_label": version_label,
        "kind": kind,
        "output_dir": f"{VERSIONS_DIRNAME}/{version_label}",
        "dashboard": relative_dashboard,
        "report_csv": f"{VERSIONS_DIRNAME}/{version_label}/{OUT_CSV_FILENAME}",
        "report_json": f"{VERSIONS_DIRNAME}/{version_label}/{OUT_JSON_FILENAME}",
        "updated_at": time.strftime("%Y-%m-%d %H:%M:%S"),
    }
    (outputs_dir / LATEST_POINTER_FILENAME).write_text(
        json.dumps(pointer, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    redirect_html = f"""<!doctype html>
<html lang="en"><head>
<meta charset="utf-8" />
<meta http-equiv="refresh" content="0; url={relative_dashboard}" />
<title>Barcode Navigation redirect</title>
</head><body>
<p>Redirecting to <a href="{relative_dashboard}">{relative_dashboard}</a></p>
</body></html>
"""
    (outputs_dir / "latest.html").write_text(redirect_html, encoding="utf-8")


def resolve_versioned_outputs(
    outputs_dir: Path,
    fingerprint: dict[str, Any],
    *,
    force_new: bool = False,
) -> VersionedOutputs:
    """Return a version folder under output/versions/vN."""
    manifest_path = outputs_dir / VERSIONS_MANIFEST_FILENAME
    manifest = _load_manifest(manifest_path)
    key = fingerprint_key(fingerprint)
    kind = str(fingerprint.get("kind") or "full")

    if not force_new:
        for entry in reversed(manifest["versions"]):
            if entry.get("fingerprint_key") == key:
                version = int(entry["version"])
                version_label = entry.get("version_label") or f"v{version}"
                output_dir = outputs_dir / VERSIONS_DIRNAME / version_label
                output_dir.mkdir(parents=True, exist_ok=True)
                return VersionedOutputs(
                    version=version,
                    version_label=version_label,
                    kind=kind,
                    output_dir=output_dir,
                    out_csv=output_dir / OUT_CSV_FILENAME,
                    out_json=output_dir / OUT_JSON_FILENAME,
                    out_html=output_dir / OUT_HTML_FILENAME,
                    is_new_version=False,
                    fingerprint_key=key,
                )

    latest = int(manifest.get("latest_version") or 0)
    version = latest + 1
    version_label = f"v{version}"
    output_dir = outputs_dir / VERSIONS_DIRNAME / version_label
    output_dir.mkdir(parents=True, exist_ok=True)

    manifest["versions"].append(
        {
            "version": version,
            "version_label": version_label,
            "kind": kind,
            "output_dir": f"{VERSIONS_DIRNAME}/{version_label}",
            "created_at": time.strftime("%Y-%m-%d %H:%M:%S"),
            "fingerprint_key": key,
            "fingerprint": fingerprint,
        }
    )
    manifest["latest_version"] = version
    latest_by_kind = manifest.setdefault("latest_by_kind", {})
    latest_by_kind[kind] = {
        "version": version,
        "version_label": version_label,
        "output_dir": f"{VERSIONS_DIRNAME}/{version_label}",
    }
    _save_manifest(manifest_path, manifest)
    _write_latest_pointer(
        outputs_dir,
        version=version,
        version_label=version_label,
        kind=kind,
    )

    return VersionedOutputs(
        version=version,
        version_label=version_label,
        kind=kind,
        output_dir=output_dir,
        out_csv=output_dir / OUT_CSV_FILENAME,
        out_json=output_dir / OUT_JSON_FILENAME,
        out_html=output_dir / OUT_HTML_FILENAME,
        is_new_version=True,
        fingerprint_key=key,
    )


def record_version_run(
    outputs_dir: Path,
    versioned: VersionedOutputs,
    *,
    summary: dict[str, Any],
) -> None:
    manifest_path = outputs_dir / VERSIONS_MANIFEST_FILENAME
    manifest = _load_manifest(manifest_path)
    for entry in manifest["versions"]:
        if int(entry.get("version") or 0) != versioned.version:
            continue
        entry["last_run_at"] = summary.get("generated_at") or time.strftime(
            "%Y-%m-%d %H:%M:%S"
        )
        entry["kind"] = versioned.kind
        entry["total_tested"] = summary.get("total_tested")
        entry["passed"] = summary.get("passed")
        entry["failed"] = summary.get("failed")
        entry["artifacts"] = [
            OUT_CSV_FILENAME,
            OUT_JSON_FILENAME,
            OUT_HTML_FILENAME,
        ]
        entry["dashboard"] = (
            f"{VERSIONS_DIRNAME}/{versioned.version_label}/{OUT_HTML_FILENAME}"
        )
        break

    latest_by_kind = manifest.setdefault("latest_by_kind", {})
    latest_by_kind[versioned.kind] = {
        "version": versioned.version,
        "version_label": versioned.version_label,
        "output_dir": f"{VERSIONS_DIRNAME}/{versioned.version_label}",
        "dashboard": (
            f"{VERSIONS_DIRNAME}/{versioned.version_label}/{OUT_HTML_FILENAME}"
        ),
    }
    _save_manifest(manifest_path, manifest)
    _write_latest_pointer(
        outputs_dir,
        version=versioned.version,
        version_label=versioned.version_label,
        kind=versioned.kind,
    )


def sync_latest_root_copies(
    *,
    versioned: VersionedOutputs,
    root_csv: Path,
    root_json: Path,
    root_html: Path,
) -> None:
    """Keep root-level report filenames as convenience copies of this version."""
    root_csv.parent.mkdir(parents=True, exist_ok=True)
    if versioned.out_csv.is_file():
        shutil.copy2(versioned.out_csv, root_csv)
    if versioned.out_json.is_file():
        shutil.copy2(versioned.out_json, root_json)
    if versioned.out_html.is_file():
        shutil.copy2(versioned.out_html, root_html)


def list_versions(outputs_dir: Path) -> list[dict[str, Any]]:
    return list(
        _load_manifest(outputs_dir / VERSIONS_MANIFEST_FILENAME).get("versions") or []
    )
