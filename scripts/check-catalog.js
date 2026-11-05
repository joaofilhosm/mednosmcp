import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { isDeepStrictEqual } from 'node:util';
import { loadRegistry } from '../src/registry.js';
import { publicToolName } from '../src/upstream.js';

const fail = message => { throw new Error(message); };
const servers = await loadRegistry();
const raw = JSON.parse(await readFile(new URL('../catalog.json', import.meta.url), 'utf8'));
const compressed = JSON.parse(gunzipSync(await readFile(new URL('../catalog.json.gz', import.meta.url))).toString('utf8'));
if (!isDeepStrictEqual(raw, compressed)) fail('catalog.json e catalog.json.gz não coincidem. Execute npm run refresh.');
if (!Array.isArray(raw.servers) || !Array.isArray(raw.tools)) fail('Catálogo inválido. Execute npm run refresh.');
const registryIds = new Set(servers.map(server => server.id));
const statusIds = new Set();
for (const status of raw.servers) {
  if (!registryIds.has(status.id) || statusIds.has(status.id)) fail(`Entrada de status inválida ou duplicada: ${status.id}`);
  statusIds.add(status.id);
}
for (const id of registryIds) if (!statusIds.has(id)) fail(`O servidor ${id} ainda não foi verificado. Execute npm run refresh.`);
const toolNames = new Set(); const perServer = new Map(); const originals = new Set();
for (const entry of raw.tools) {
  if (!registryIds.has(entry.serverId) || typeof entry.originalName !== 'string' || !entry.definition?.inputSchema) fail('Ferramenta inválida no catálogo.');
  const name = entry.definition.name;
  if (name !== publicToolName(entry.serverId, entry.originalName) || name.length > 64 || toolNames.has(name)) fail(`Nome de ferramenta inválido ou duplicado: ${name}`);
  const originalKey = `${entry.serverId}\0${entry.originalName}`;
  if (originals.has(originalKey)) fail(`Ferramenta repetida na origem ${entry.serverId}: ${entry.originalName}`);
  originals.add(originalKey); toolNames.add(name);
  perServer.set(entry.serverId, (perServer.get(entry.serverId) || 0) + 1);
}
for (const status of raw.servers) if ((status.toolCount || 0) !== (perServer.get(status.id) || 0)) fail(`Contagem inconsistente para ${status.id}. Execute npm run refresh.`);
console.log(`Catálogo válido: ${servers.length} servidores e ${raw.tools.length} ferramentas.`);
