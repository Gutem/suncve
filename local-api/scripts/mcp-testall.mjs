import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const transport = new StdioClientTransport({
  command: 'npx',
  args: ['tsx', 'src/mcp.ts'],
  env: { ...process.env, SUNCVE_DB: process.env.SUNCVE_DB }
});
const client = new Client({ name: 'testall', version: '0.0.0' });
await client.connect(transport);

const { tools } = await client.listTools();
console.log(`TOOLS LISTED: ${tools.length}`);
// annotations check
const missingAnno = tools.filter((t) => !t.annotations || t.annotations.readOnlyHint !== true);
console.log(`readOnlyHint on all tools: ${missingAnno.length === 0 ? 'YES' : 'NO (' + missingAnno.map((t) => t.name).join(',') + ')'}`);

async function call(name, args) {
  const r = await client.callTool({ name, arguments: args });
  if (r.isError) return { ok: false, err: r.content?.[0]?.text };
  try {
    return { ok: true, data: JSON.parse(r.content[0].text) };
  } catch {
    return { ok: true, data: r.content[0].text };
  }
}

// pick a real repo fullpath dynamically for the repo-detail tools
const repoSearch = await call('search_repositories', { sort: 'stars', order: 'desc', page_size: 1 });
const repoFullpath = repoSearch.ok && repoSearch.data.results?.[0]?.fullpath;

const cases = [
  ['search_cves', { nuclei: true, page_size: 5 }, (d) => `total=${d.total}, rows=${d.results.length}`],
  ['get_cve', { cve_id: 'CVE-2021-44228' }, (d) => `cve=${d.cve_id}, nuclei=${d.nuclei?.length}, scores=${d.scores?.length}`],
  ['search_repositories', { sort: 'stars', order: 'desc', page_size: 3 }, (d) => `total=${d.total}, top=${d.results[0]?.fullpath}`],
  ['get_repository', { fullpath: repoFullpath }, (d) => `repo=${d.fullpath}, cve_count=${d.cve_count}`],
  ['get_repository_cves', { fullpath: repoFullpath, page_size: 3 }, (d) => `total=${d.total}, rows=${d.cves?.length ?? d.results?.length}`],
  ['cve_stats', {}, (d) => `totalCVEs=${d.totalCVEs}, withExploit=${d.withExploit}`],
  ['cve_stats', { nuclei: true }, (d) => `filtered totalCVEs=${d.totalCVEs}`],
  ['repository_stats', {}, (d) => `totalRepos=${d.totalRepos}, withCVEs=${d.withCVEs}`],
  ['dashboard_recent', {}, (d) => `newCVEs=${d.newCVEs}, newCritical=${d.newCriticalCVEs}`],
  ['severity_distribution', { period: '30d' }, (d) => `crit=${d.critical}, high=${d.high}, med=${d.medium}`],
  ['cves_by_period', { period: '1y' }, (d) => `buckets=${d.length}`],
  ['cwe_trend', { period: '1y', top_n: 3 }, (d) => `cwes=${d.cwes?.length}, buckets=${d.data?.length}`],
  ['top_cwes', { period: '1y', limit: 5 }, (d) => `rows=${d.length}, top=${d[0]?.cwe_id}`],
  ['critical_cves', {}, (d) => `rows=${d.length}`],
  ['list_cwe_categories', {}, (d) => `categories=${d.length}`],
  ['list_filter_options', {}, (d) => `cwes=${d.cwes?.length}, langs=${d.languages?.length}`]
];

let pass = 0, fail = 0;
for (const [name, args, fmt] of cases) {
  const r = await call(name, args);
  if (!r.ok) {
    console.log(`FAIL  ${name}(${JSON.stringify(args)}) -> ${r.err}`);
    fail++;
    continue;
  }
  let summary;
  try {
    summary = fmt(r.data);
  } catch (e) {
    summary = `(unexpected shape) ${JSON.stringify(r.data).slice(0, 120)}`;
  }
  console.log(`PASS  ${name}  ->  ${summary}`);
  pass++;
}
console.log(`\nRESULT: ${pass} passed, ${fail} failed (of ${cases.length} calls across ${tools.length} tools)`);
await client.close();
