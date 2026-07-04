// Local read-only HTTP API over the SunCVE SQLite snapshot.
// Start: `npm run start:api` (PORT env, default 8787).

import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { openDb } from './db.js';
import { SunCveQueries } from './queries.js';
import { CWE_CATEGORIES } from './cwe-data.js';
import {
  parseCveFilters,
  parseCveSort,
  parseRepoFilters,
  parseRepoSort,
  parsePage,
  parsePageSize
} from './params.js';

const db = openDb();
const q = new SunCveQueries(db);
const app = new Hono();

// Permissive CORS so browser tooling / notebooks can call the local API.
app.use('*', async (c, next) => {
  c.header('Access-Control-Allow-Origin', '*');
  c.header('Access-Control-Allow-Headers', '*');
  c.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (c.req.method === 'OPTIONS') return c.body(null, 204);
  await next();
});

app.onError((err, c) => {
  console.error('[api] error:', err);
  return c.json({ error: err instanceof Error ? err.message : String(err) }, 500);
});

app.get('/', (c) =>
  c.json({
    name: 'suncve-local-api',
    endpoints: [
      '/api/health',
      '/api/cves',
      '/api/cves/:cveId',
      '/api/cves/stats',
      '/api/cves/filter-options',
      '/api/repositories',
      '/api/repositories/:fullpath',
      '/api/repositories/:fullpath/cves',
      '/api/repositories/stats',
      '/api/repositories/filter-options',
      '/api/stats/recent',
      '/api/stats/severity-distribution',
      '/api/stats/cves-by-period',
      '/api/stats/cwe-trend',
      '/api/stats/top-cwes',
      '/api/stats/critical-cves',
      '/api/stats/global',
      '/api/cwe-categories'
    ]
  })
);

app.get('/api/health', (c) => c.json(q.health()));

// ---- CVEs ---------------------------------------------------------------

app.get('/api/cves', (c) => {
  const rec = c.req.query();
  const filters = parseCveFilters(rec);
  const sort = parseCveSort(rec);
  const page = parsePage(rec);
  const pageSize = parsePageSize(rec, 50);
  return c.json(q.searchCVEs(filters, sort, page, pageSize));
});

app.get('/api/cves/stats', (c) => {
  const rec = c.req.query();
  const hasAny = Object.keys(rec).length > 0;
  return c.json(hasAny ? q.getFilteredStats(parseCveFilters(rec)) : q.getStats());
});

app.get('/api/cves/filter-options', (c) => c.json(q.getFilterOptions()));

app.get('/api/cves/:cveId', (c) => {
  const detail = q.getCVEDetails(c.req.param('cveId'));
  if (!detail) return c.json({ error: 'CVE not found' }, 404);
  return c.json(detail);
});

// ---- Repositories -------------------------------------------------------

app.get('/api/repositories', (c) => {
  const rec = c.req.query();
  const filters = parseRepoFilters(rec);
  const sort = parseRepoSort(rec);
  const page = parsePage(rec);
  const pageSize = parsePageSize(rec, 50);
  return c.json(q.searchRepositories(filters, sort, page, pageSize));
});

app.get('/api/repositories/stats', (c) => {
  const rec = c.req.query();
  const hasAny = Object.keys(rec).length > 0;
  return c.json(
    hasAny ? q.getRepoFilteredStats(parseRepoFilters(rec)) : q.getRepoStats()
  );
});

app.get('/api/repositories/filter-options', (c) =>
  c.json(q.getRepoFilterOptions())
);

// fullpath contains a slash (owner/name), so capture the rest of the path.
app.get('/api/repositories/:owner/:name/cves', (c) => {
  const fullpath = `${c.req.param('owner')}/${c.req.param('name')}`;
  const rec = c.req.query();
  return c.json(
    q.getRepositoryCVEs(fullpath, parsePage(rec), parsePageSize(rec, 20))
  );
});

app.get('/api/repositories/:owner/:name', (c) => {
  const fullpath = `${c.req.param('owner')}/${c.req.param('name')}`;
  const detail = q.getRepositoryDetails(fullpath);
  if (!detail) return c.json({ error: 'Repository not found' }, 404);
  return c.json(detail);
});

// ---- Dashboard / analytics ---------------------------------------------

app.get('/api/stats/recent', (c) => c.json(q.getRecentStats()));

app.get('/api/stats/severity-distribution', (c) => {
  const p = c.req.query('period');
  const period = p === '7d' || p === '120d' ? p : '30d';
  return c.json(q.getSeverityDistribution(period));
});

app.get('/api/stats/cves-by-period', (c) => {
  const p = c.req.query('period');
  const period = p === '1y' || p === '5y' ? p : '30d';
  return c.json(q.getCVEsByPeriod(period));
});

app.get('/api/stats/cwe-trend', (c) => {
  const p = c.req.query('period');
  const period = p === '1y' || p === '5y' ? p : '30d';
  const topN = Number(c.req.query('top_n') ?? 5) || 5;
  return c.json(q.getCWETrend(period, topN));
});

app.get('/api/stats/top-cwes', (c) => {
  const p = c.req.query('period');
  const period = p === '1y' || p === '5y' ? p : '30d';
  const limit = Number(c.req.query('limit') ?? 5) || 5;
  return c.json(q.getTopCWEs(limit, period));
});

app.get('/api/stats/critical-cves', (c) => c.json(q.getCriticalCVEsWithPOC()));

app.get('/api/stats/global', (c) => c.json(q.getStats()));

app.get('/api/cwe-categories', (c) => c.json(CWE_CATEGORIES));

const port = Number(process.env.PORT ?? 8787);
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`SunCVE local API listening on http://localhost:${info.port}`);
  console.log(`Database: ${db.path}`);
});
