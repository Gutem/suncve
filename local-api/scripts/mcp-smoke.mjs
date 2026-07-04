import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const transport = new StdioClientTransport({
  command: 'npx',
  args: ['tsx', 'src/mcp.ts'],
  env: { ...process.env, SUNCVE_DB: process.env.SUNCVE_DB },
});
const client = new Client({ name: 'smoke', version: '0.0.0' });
await client.connect(transport);

const { tools } = await client.listTools();
console.log('TOOLS:', tools.map((t) => t.name).join(', '));
console.log('COUNT:', tools.length);

const g = await client.callTool({ name: 'cve_stats', arguments: {} });
console.log('cve_stats ->', g.content[0].text.slice(0, 200));

const n = await client.callTool({ name: 'search_cves', arguments: { nuclei: true } });
const parsed = JSON.parse(n.content[0].text);
console.log('search_cves(nuclei=true) total ->', parsed.total, parsed.results.map((r) => r.cve_id));

const d = await client.callTool({ name: 'get_cve', arguments: { cve_id: 'CVE-2021-44228' } });
const det = JSON.parse(d.content[0].text);
console.log('get_cve nuclei ->', JSON.stringify(det.nuclei));

await client.close();
console.log('MCP SMOKE OK');
