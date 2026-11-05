import { writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { loadRegistry } from '../src/registry.js';
import { discover, publicToolName } from '../src/upstream.js';

const servers = await loadRegistry();
const concurrency = 8;
let next = 0;
const discovered = Array(servers.length);
async function worker() {
  for (;;) {
    const i = next++;
    if (i >= servers.length) return;
    const result = await discover(servers[i], 10000);
    discovered[i] = result;
    console.log(`${servers[i].id}: ${result.status}${result.transport ? ` (${result.transport})` : ''} — ${result.tools.length} ferramentas${result.error ? ` — ${result.error}` : ''}`);
  }
}
await Promise.all(Array.from({length: Math.min(concurrency, servers.length)}, worker));
const tools = [];
for (const result of discovered) for (const tool of result.tools) {
  if (!tool.name || !tool.inputSchema) continue;
  tools.push({ serverId: result.id, originalName: tool.name, definition: { ...tool, name: publicToolName(result.id, tool.name) } });
}
const names = new Set();
for (const tool of tools) {
  if (names.has(tool.definition.name)) throw new Error(`Colisão em ${tool.definition.name}`);
  names.add(tool.definition.name);
}
const catalog = { generatedAt: new Date().toISOString(), servers: discovered.map(({tools, ...rest}) => ({...rest, toolCount: tools.length})), tools };
const raw = JSON.stringify(catalog);
await writeFile(new URL('../catalog.json', import.meta.url), raw + '\n');
await writeFile(new URL('../catalog.json.gz', import.meta.url), gzipSync(raw, {level:9}));
console.log(`\nCatálogo atualizado: ${servers.length} servidores, ${tools.length} ferramentas.`);
