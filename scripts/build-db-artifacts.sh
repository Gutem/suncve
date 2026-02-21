#!/usr/bin/env bash
set -euo pipefail

SOURCE_DB="${SOURCE_DB:-data/source.sqlite}"
OUTPUT_DIR="${OUTPUT_DIR:-public/db}"
PUBLIC_DB_BASENAME="${PUBLIC_DB_BASENAME:-source_com_repositorios.sqlite}"
MANIFEST_BASE_URL="${MANIFEST_BASE_URL:-/db}"
PYTHON_BIN="${PYTHON_BIN:-python3}"

log() {
  printf '[INFO] %s\n' "$*"
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    printf '[ERROR] Missing required command: %s\n' "$1" >&2
    exit 1
  fi
}

require_cmd "$PYTHON_BIN"

if [[ ! -f "$SOURCE_DB" ]]; then
  printf '[ERROR] Source DB not found: %s\n' "$SOURCE_DB" >&2
  exit 1
fi

mkdir -p "$OUTPUT_DIR"

log "Building DB artifacts from ${SOURCE_DB}"
"$PYTHON_BIN" - "$SOURCE_DB" "$OUTPUT_DIR" "$PUBLIC_DB_BASENAME" "$MANIFEST_BASE_URL" <<'PY'
import gzip
import hashlib
import json
import shutil
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path

source_db = Path(sys.argv[1]).resolve()
output_dir = Path(sys.argv[2]).resolve()
db_basename = sys.argv[3]
base_url = sys.argv[4].rstrip("/")

gzip_path = output_dir / f"{db_basename}.gz"
manifest_path = output_dir / "manifest.json"
scan_metadata_path = output_dir / "scan-metadata.json"

with source_db.open("rb") as f_src, gzip_path.open("wb") as f_dst:
    with gzip.GzipFile(
        filename="",
        mode="wb",
        fileobj=f_dst,
        compresslevel=9,
        mtime=0,
    ) as gz:
        shutil.copyfileobj(f_src, gz, length=1024 * 1024)

digest = hashlib.sha256()
with gzip_path.open("rb") as f:
    for chunk in iter(lambda: f.read(1024 * 1024), b""):
        digest.update(chunk)

conn = sqlite3.connect(source_db)
cur = conn.cursor()

cur.execute(
    """
    SELECT source_name, last_verified, last_updated, last_release_file
    FROM sources
    ORDER BY COALESCE(last_verified, last_updated) DESC
    LIMIT 1
    """
)
source_row = cur.fetchone()

cur.execute(
    """
    SELECT cve_id
    FROM cves
    WHERE cve_id LIKE 'CVE-%'
      AND substr(cve_id, 5, 4) GLOB '[0-9][0-9][0-9][0-9]'
      AND substr(cve_id, 10) GLOB '[0-9]*'
    ORDER BY CAST(substr(cve_id, 5, 4) AS INTEGER) ASC,
             CAST(substr(cve_id, 10) AS INTEGER) ASC
    LIMIT 1
    """
)
first_row = cur.fetchone()

cur.execute(
    """
    SELECT cve_id
    FROM cves
    WHERE cve_id LIKE 'CVE-%'
      AND substr(cve_id, 5, 4) GLOB '[0-9][0-9][0-9][0-9]'
      AND substr(cve_id, 10) GLOB '[0-9]*'
    ORDER BY CAST(substr(cve_id, 5, 4) AS INTEGER) DESC,
             CAST(substr(cve_id, 10) AS INTEGER) DESC
    LIMIT 1
    """
)
last_row = cur.fetchone()

cur.execute("SELECT COUNT(*) FROM cves WHERE cve_id LIKE 'CVE-%'")
count_row = cur.fetchone()
conn.close()

now = datetime.now(timezone.utc)
scan_metadata = {
    "scanned_at": now.isoformat().replace("+00:00", "Z"),
    "source": {
        "name": source_row[0] if source_row else None,
        "last_verified": source_row[1] if source_row else None,
        "last_updated": source_row[2] if source_row else None,
        "last_release_file": source_row[3] if source_row else None,
    },
    "cve_range": {
        "from": first_row[0] if first_row else None,
        "to": last_row[0] if last_row else None,
    },
    "total_cves": int(count_row[0]) if count_row and count_row[0] is not None else 0,
}

manifest = {
    "version": now.strftime("%Y%m%d%H%M%S"),
    "generated_at": now.isoformat().replace("+00:00", "Z"),
    "sources": {
        "gzip": {
            "url": f"{base_url}/{db_basename}.gz",
            "encoding": "gzip",
            "size": gzip_path.stat().st_size,
            "sha256": digest.hexdigest(),
        }
    },
    "scan_metadata": scan_metadata,
}

scan_metadata_path.write_text(
    json.dumps(scan_metadata, ensure_ascii=False, indent=2) + "\n",
    encoding="utf-8",
)
manifest_path.write_text(
    json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
    encoding="utf-8",
)

print(f"[INFO] Gzip generated at: {gzip_path}")
print(f"[INFO] Manifest generated at: {manifest_path}")
print(f"[INFO] Scan metadata generated at: {scan_metadata_path}")
print(f"[INFO] Total CVEs: {scan_metadata['total_cves']}")
print(
    "[INFO] CVE range: "
    f"{scan_metadata['cve_range']['from']} -> {scan_metadata['cve_range']['to']}"
)
PY

