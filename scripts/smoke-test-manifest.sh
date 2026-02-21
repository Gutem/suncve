#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ -z "${GITHUB_TOKEN:-}" ]]; then
  echo "[ERROR] GITHUB_TOKEN is required."
  echo "Export it first: export GITHUB_TOKEN=..."
  exit 1
fi

REPO_BATCH="${REPO_BATCH:-10}"

# Hardcoded IDs requested for smoke test
CVE_IDS="${CVE_IDS:-CVE-2026-25117,CVE-2026-25047,CVE-2026-24905,CVE-2026-24904,CVE-2020-36993,CVE-2026-1521,CVE-2025-55292,CVE-2026-24770,CVE-2026-23892,CVE-2026-23888}"

echo "[INFO] Root: $ROOT_DIR"
echo "[INFO] Smoke params: REPO_BATCH=$REPO_BATCH"
echo "[INFO] CVE IDs: $CVE_IDS"

echo "[INFO] Cleaning previous test artifacts..."
rm -rf data
rm -rf public/db
mkdir -p public/db

echo "[INFO] Ingesting REAL CVEs from hardcoded CVE IDs..."
python3 scripts/create-manifest.py cves-ids \
  --cve-ids "$CVE_IDS"

echo "[INFO] Verifying a few repositories in GitHub GraphQL..."
python3 scripts/create-manifest.py repos \
  --batch-size "$REPO_BATCH"

echo "[INFO] Copying DB to public/db for app usage..."
cp data/source.sqlite public/db/source_com_repositorios.sqlite

echo "[INFO] Generating manifest..."
python3 scripts/create-manifest.py manifest \
  --db-dir public/db \
  --db-file source_com_repositorios.sqlite \
  --manifest-base-url /db \
  --manifest-version "smoke-$(date +%Y%m%d%H%M%S)" \
  --compress-gzip

echo "[INFO] Smoke test completed."
echo "[INFO] Output files:"
ls -lah public/db
echo "[INFO] Manifest:"
cat public/db/manifest.json
