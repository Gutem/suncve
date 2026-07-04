#!/usr/bin/env node
// Download the latest SunCVE SQLite snapshot from the `db-snapshots` GitHub
// release, extract it, and gunzip it to local-api/data/source.sqlite.
//
// Mirrors ../../scripts/setup-db.sh. Uses the `gh` CLI when available (handles
// auth / private repos), otherwise falls back to the public REST API.

import { execFileSync, spawnSync } from 'node:child_process';
import { createReadStream, createWriteStream, existsSync, mkdirSync, readdirSync, rmSync, copyFileSync } from 'node:fs';
import { createGunzip } from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DATA_DIR = join(ROOT, 'data');
const REPO = process.env.SUNCVE_REPO || 'sunsecrn/suncve';
const TAG = 'db-snapshots';

const log = (...a) => console.log('[db:download]', ...a);
const die = (m) => {
  console.error('[db:download] ERROR:', m);
  process.exit(1);
};

function hasGh() {
  const r = spawnSync('gh', ['--version'], { stdio: 'ignore' });
  return r.status === 0;
}

function ghAuthed() {
  const r = spawnSync('gh', ['auth', 'status'], { stdio: 'ignore' });
  return r.status === 0;
}

/** Returns { name, url } of the newest snapshot-*.tar.gz asset. */
async function findAssetViaRest() {
  const headers = { 'User-Agent': 'suncve-local-api', Accept: 'application/vnd.github+json' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const res = await fetch(`https://api.github.com/repos/${REPO}/releases/tags/${TAG}`, { headers });
  if (!res.ok) die(`GitHub API ${res.status} fetching release '${TAG}' for ${REPO}`);
  const release = await res.json();
  const asset = (release.assets || [])
    .filter((a) => /^snapshot-.*\.tar\.gz$/.test(a.name))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
  if (!asset) die(`No snapshot-*.tar.gz asset in release '${TAG}'`);
  return { name: asset.name, url: asset.browser_download_url };
}

async function downloadViaRest(tarPath) {
  const { name, url } = await findAssetViaRest();
  log(`Downloading ${name} ...`);
  const headers = { 'User-Agent': 'suncve-local-api' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const res = await fetch(url, { headers, redirect: 'follow' });
  if (!res.ok || !res.body) die(`Download failed: HTTP ${res.status}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(tarPath));
}

function downloadViaGh(tarPath) {
  log('Using gh CLI to find and download the latest snapshot ...');
  const name = execFileSync('gh', [
    'release', 'view', TAG, '--repo', REPO, '--json', 'assets', '--jq',
    '.assets | map(select(.name | test("^snapshot-.*\\\\.tar\\\\.gz$"))) | sort_by(.createdAt) | reverse | .[0].name // ""'
  ]).toString().trim();
  if (!name) die(`No snapshot-*.tar.gz asset in release '${TAG}'`);
  log(`Downloading ${name} ...`);
  execFileSync('gh', ['release', 'download', TAG, '--repo', REPO, '--pattern', name, '--output', tarPath, '--clobber'], { stdio: 'inherit' });
}

async function main() {
  mkdirSync(DATA_DIR, { recursive: true });
  const tmp = join(tmpdir(), `suncve-db-${process.pid}`);
  const tarPath = `${tmp}.tar.gz`;
  const extractDir = `${tmp}-extract`;
  mkdirSync(extractDir, { recursive: true });

  const cleanup = () => {
    try { rmSync(tarPath, { force: true }); } catch {}
    try { rmSync(extractDir, { recursive: true, force: true }); } catch {}
  };
  process.on('exit', cleanup);

  try {
    if (hasGh() && ghAuthed()) downloadViaGh(tarPath);
    else await downloadViaRest(tarPath);

    log('Extracting archive ...');
    execFileSync('tar', ['-xzf', tarPath, '-C', extractDir], { stdio: 'inherit' });

    // Locate the .sqlite.gz and manifest.json inside the extracted tree.
    const found = { gz: null, manifest: null };
    const walk = (dir) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, entry.name);
        if (entry.isDirectory()) walk(p);
        else if (entry.name.endsWith('.sqlite.gz')) found.gz = p;
        else if (entry.name === 'manifest.json') found.manifest = p;
      }
    };
    walk(extractDir);
    if (!found.gz) die('No *.sqlite.gz found inside the snapshot archive');

    const out = join(DATA_DIR, 'source.sqlite');
    log(`Decompressing to ${out} ...`);
    await pipeline(createReadStream(found.gz), createGunzip(), createWriteStream(out));

    if (found.manifest && existsSync(found.manifest)) {
      copyFileSync(found.manifest, join(DATA_DIR, 'manifest.json'));
    }

    log('Done. Run: npm run start:api   (or)   npm run start:mcp');
  } finally {
    cleanup();
  }
}

main().catch((e) => die(e instanceof Error ? e.message : String(e)));
