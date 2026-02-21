#!/usr/bin/env bash
set -euo pipefail

# Reproduz localmente o workflow .github/workflows/db-snapshots.yml
# e publica snapshot no release/tag db-snapshots via gh CLI.

SNAPSHOT_TAG="${SNAPSHOT_TAG:-db-snapshots}"
REPO_BATCH_SIZE="${REPO_BATCH_SIZE:-200}"
KEEP_SNAPSHOTS="${KEEP_SNAPSHOTS:-3}"
PYTHON_BIN="${PYTHON_BIN:-python3}"
INSTALL_DEPS="${INSTALL_DEPS:-1}"
YEARLY_BOOTSTRAP="${YEARLY_BOOTSTRAP:-1}"
TMP_SNAPSHOT=""
TMP_SNAPSHOT_DIR=""

log() {
  printf '[INFO] %s\n' "$*"
}

cleanup() {
  if [[ -n "$TMP_SNAPSHOT" && -f "$TMP_SNAPSHOT" ]]; then
    rm -f "$TMP_SNAPSHOT"
  fi
  if [[ -n "$TMP_SNAPSHOT_DIR" && -d "$TMP_SNAPSHOT_DIR" ]]; then
    rmdir "$TMP_SNAPSHOT_DIR" 2>/dev/null || true
  fi
}

to_file_token() {
  local raw="${1:-}"
  local normalized
  normalized="$(printf '%s' "$raw" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+|-+$//g')"
  if [[ -z "$normalized" ]]; then
    printf 'unknown'
    return
  fi
  printf '%s' "$normalized"
}

trap cleanup EXIT

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    printf '[ERROR] Missing required command: %s\n' "$1" >&2
    exit 1
  fi
}

require_cmd gh
require_cmd jq
require_cmd tar
require_cmd "$PYTHON_BIN"

if ! gh auth status >/dev/null 2>&1; then
  printf '[ERROR] gh is not authenticated. Run: gh auth login\n' >&2
  exit 1
fi

ROOT_DIR="$(git rev-parse --show-toplevel)"
cd "$ROOT_DIR"

REPO_SLUG="$(gh repo view --json nameWithOwner -q .nameWithOwner)"
if [[ -z "${GITHUB_TOKEN:-}" ]]; then
  export GITHUB_TOKEN="$(gh auth token)"
fi

log "Repo: ${REPO_SLUG}"
log "Snapshot tag: ${SNAPSHOT_TAG}"
log "Batch size: ${REPO_BATCH_SIZE}"
log "Yearly bootstrap mode: ${YEARLY_BOOTSTRAP}"

if ! gh release view "$SNAPSHOT_TAG" --repo "$REPO_SLUG" >/dev/null 2>&1; then
  log "Release ${SNAPSHOT_TAG} not found; creating it..."
  gh release create "$SNAPSHOT_TAG" \
    --repo "$REPO_SLUG" \
    --title "DB Snapshots" \
    --notes "Rolling snapshots for incremental CVE DB state"
fi

LATEST_ASSET_NAME="$(
  gh release view "$SNAPSHOT_TAG" \
    --repo "$REPO_SLUG" \
    --json assets \
    --jq '.assets
      | map(select(.name | test("^snapshot-.*\\.tar\\.gz$")))
      | sort_by(.createdAt)
      | reverse
      | .[0].name // ""'
)"

mkdir -p data public/db

if [[ -n "$LATEST_ASSET_NAME" ]]; then
  log "Restoring latest snapshot: ${LATEST_ASSET_NAME}"
  TMP_SNAPSHOT_DIR="$(mktemp -d /tmp/latest-db-snapshot.XXXXXX)"
  TMP_SNAPSHOT="${TMP_SNAPSHOT_DIR}/latest-db-snapshot.tar.gz"
  gh release download "$SNAPSHOT_TAG" \
    --repo "$REPO_SLUG" \
    --pattern "$LATEST_ASSET_NAME" \
    --output "$TMP_SNAPSHOT"
  tar -xzf "$TMP_SNAPSHOT" -C .
else
  log "No previous snapshot found. Starting from current local state."
fi

if [[ ! -f data/source.sqlite && -f public/db/source_com_repositorios.sqlite.gz ]]; then
  log "Restoring data/source.sqlite from public/db/source_com_repositorios.sqlite.gz"
  "$PYTHON_BIN" - <<'PY'
import gzip
import shutil
from pathlib import Path

src = Path("public/db/source_com_repositorios.sqlite.gz")
dst = Path("data/source.sqlite")
dst.parent.mkdir(parents=True, exist_ok=True)
with gzip.open(src, "rb") as f_src, dst.open("wb") as f_dst:
    shutil.copyfileobj(f_src, f_dst, length=1024 * 1024)
PY
fi

if [[ "$INSTALL_DEPS" == "1" ]]; then
  log "Installing Python dependencies..."
  "$PYTHON_BIN" -m pip install --upgrade pip
  "$PYTHON_BIN" -m pip install requests urllib3 beautifulsoup4 cvss
fi

log "Incremental CVE update..."
if [[ "$YEARLY_BOOTSTRAP" == "1" ]]; then
  "$PYTHON_BIN" scripts/create-manifest.py cves --year-auto
else
  "$PYTHON_BIN" scripts/create-manifest.py cves
fi

log "Incremental repository verification..."
"$PYTHON_BIN" scripts/create-manifest.py repos --batch-size "$REPO_BATCH_SIZE"

log "Generating DB artifacts (manifest + gzip) from data/source.sqlite..."
bash scripts/build-db-artifacts.sh

test -f public/db/manifest.json
test -f public/db/source_com_repositorios.sqlite.gz

RANGE_FROM="$(jq -r '.scan_metadata.cve_range.from // "unknown"' public/db/manifest.json)"
RANGE_TO="$(jq -r '.scan_metadata.cve_range.to // "unknown"' public/db/manifest.json)"
RANGE_FROM_TOKEN="$(to_file_token "$RANGE_FROM")"
RANGE_TO_TOKEN="$(to_file_token "$RANGE_TO")"

SNAPSHOT_NAME="snapshot-${RANGE_FROM_TOKEN}-to-${RANGE_TO_TOKEN}-$(date -u +%Y%m%dT%H%M%SZ).tar.gz"
log "Packing snapshot ${SNAPSHOT_NAME}"
tar -czf "$SNAPSHOT_NAME" \
  public/db/manifest.json \
  public/db/source_com_repositorios.sqlite.gz

log "Uploading snapshot to release ${SNAPSHOT_TAG}"
gh release upload "$SNAPSHOT_TAG" "$SNAPSHOT_NAME" --repo "$REPO_SLUG"

log "Pruning old snapshots (keep ${KEEP_SNAPSHOTS})..."
ASSETS_TO_DELETE="$(
  gh release view "$SNAPSHOT_TAG" \
    --repo "$REPO_SLUG" \
    --json assets \
    --jq ".assets
      | map(select(.name | test(\"^snapshot-.*\\\\.tar\\\\.gz$\")))
      | sort_by(.createdAt)
      | reverse
      | .[$KEEP_SNAPSHOTS:]
      | .[].name"
)"

if [[ -n "$ASSETS_TO_DELETE" ]]; then
  while IFS= read -r asset_name; do
    [[ -z "$asset_name" ]] && continue
    log "Deleting old snapshot: ${asset_name}"
    gh release delete-asset "$SNAPSHOT_TAG" "$asset_name" --yes --repo "$REPO_SLUG"
  done <<< "$ASSETS_TO_DELETE"
fi

log "Done. New snapshot published: ${SNAPSHOT_NAME}"
