#!/usr/bin/env bash
set -euo pipefail

log()   { printf '[INFO]  %s\n' "$*"; }
error() { printf '[ERROR] %s\n' "$*" >&2; }

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    error "Missing required command: $1"
    exit 1
  fi
}

require_cmd gh
require_cmd tar

if ! gh auth status >/dev/null 2>&1; then
  error "gh is not authenticated. Run: gh auth login"
  exit 1
fi

REPO_SLUG="$(gh repo view --json nameWithOwner -q .nameWithOwner)"
RELEASE_TAG="db-snapshots"

log "Repo: ${REPO_SLUG}"

if ! gh release view "$RELEASE_TAG" --repo "$REPO_SLUG" >/dev/null 2>&1; then
  error "Release '${RELEASE_TAG}' not found in ${REPO_SLUG}"
  exit 1
fi

LATEST_ASSET="$(gh release view "$RELEASE_TAG" \
  --repo "$REPO_SLUG" \
  --json assets \
  --jq '.assets
    | map(select(.name | test("^snapshot-.*\\.tar\\.gz$")))
    | sort_by(.createdAt)
    | reverse
    | .[0].name // ""')"

if [[ -z "$LATEST_ASSET" ]]; then
  error "No snapshot found in release '${RELEASE_TAG}'"
  exit 1
fi

log "Downloading: ${LATEST_ASSET}"

mkdir -p public/db

TMP_FILE="$(mktemp /tmp/suncve-db.XXXXXX.tar.gz)"
trap 'rm -f "$TMP_FILE"' EXIT

gh release download "$RELEASE_TAG" \
  --repo "$REPO_SLUG" \
  --pattern "$LATEST_ASSET" \
  --output "$TMP_FILE"

log "Extracting to public/db/..."
tar -xzf "$TMP_FILE" -C .

log "Done. Files in public/db/:"
ls -lh public/db/
