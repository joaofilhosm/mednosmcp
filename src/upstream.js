import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { ListToolsResultSchema } from '@modelcontextprotocol/sdk/types.js';
import { createHash } from 'node:crypto';

const protocol = { name: 'mednosmcp', version: '1.0.0' };

export function publicToolName(serverId, originalName) {
  const prefix = serverId.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 24);
  const base = originalName.replace(/[^A-Za-z0-9_-]/g, '_');
  const hash = createHash('sha256').update(serverId + '\0' + originalName).digest('hex').slice(0, 8);
  return prefix + '__' + base.slice(0, 64 - prefix.length - 11) + '_' + hash;
}

// Credenciais ficam só em variáveis de ambiente (nunca no repositório): server.auth = { header, env, prefix? }.
export function authHeaders(server, env = process.env) {
  const a = server.auth;
  if (!a) return {};
  const value = env[a.env];
  return value ? { [a.header]: (a.prefix || '') + value } : {};
}

function classify(error) {
  const s = String(error?.message || error);
  if (/401|403|unauthorized|forbidden|no auth provider|authentication required/i.test(s)) return 'auth_required';
  if (/timeout|timed out|abort|tempo limite/i.test(s)) return 'timeout';
  return 'unavailable';
}

// Only try the alternative transport if connecting fails. Never replay a tool call.
// Each request owns its client; sessions are never shared between users.
export async function withUpstream(server, fn, timeoutMs = 12000) {
  let last; const errors = [];
  const deadline = Date.now() + timeoutMs;
  for (const mode of ['streamable-http', 'sse']) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error('Tempo limite do MCP de origem')), remaining);
    const client = new Client(protocol, { capabilities: {} });
    let connected = false;
    try {
      const headers = authHeaders(server);
      const opts = { requestInit: { signal: controller.signal, headers } };
      if (mode === 'sse') opts.eventSourceInit = { fetch: (url, init) => fetch(url, { ...init, headers: { ...Object.fromEntries(new Headers(init?.headers)), ...headers } }) };
      const transport = mode === 'streamable-http'
        ? new StreamableHTTPClientTransport(new URL(server.url), opts)
        : new SSEClientTransport(new URL(server.url), opts);
      await Promise.race([
        client.connect(transport, { timeout: remaining, signal: controller.signal }),
        new Promise((_, reject) => controller.signal.addEventListener('abort', () => reject(new Error('Tempo limite ao conectar')), {once:true}))
      ]);
      connected = true;
      const result = await fn(client, mode, controller.signal);
      return { result, transport: mode };
    } catch (error) {
      last = error;
      errors.push(`${mode}: ${String(error?.message || error)}`);
      if (connected || classify(error) === 'auth_required') break;
    } finally {
      clearTimeout(timer);
      await client.close().catch(() => {});
    }
  }
  const error = new Error(errors.join(' | ') || String(last?.message || 'Tempo limite ao conectar'));
  error.code = classify(last);
  throw error;
}

// Correct a common invalid spelling of JSON Schema's null type without altering the rest of the schema.
export function normalizeSchema(schema) {
  if (Array.isArray(schema)) return schema.map(normalizeSchema);
  if (!schema || typeof schema !== 'object') return schema;
  return Object.fromEntries(Object.entries(schema).map(([key,value]) => [key, key === 'type' && Array.isArray(value) ? value.map(item => item === null ? 'null' : item) : normalizeSchema(value)]));
}

export async function discover(server, timeoutMs = 12000) {
  try {
    const { result, transport } = await withUpstream(server, async (client, _mode, signal) => {
      const tools = []; const seenCursors = new Set(); let cursor;
      do {
        // request() avoids SDK's eager output-schema compilation, so a single malformed upstream schema doesn't hide every tool.
        const page = await client.request({method:'tools/list',params:cursor ? {cursor} : {}}, ListToolsResultSchema, { timeout: timeoutMs, signal });
        if (!Array.isArray(page.tools)) throw new Error('Resposta de ferramentas inválida');
        tools.push(...page.tools);
        cursor = page.nextCursor;
        if (cursor && seenCursors.has(cursor)) throw new Error('Paginação cíclica no servidor de origem');
        if (cursor) seenCursors.add(cursor);
        if (tools.length > 3000) throw new Error('O servidor retornou ferramentas demais');
      } while (cursor);
      return tools.map(tool => ({...tool, inputSchema:normalizeSchema(tool.inputSchema), ...(tool.outputSchema ? {outputSchema:normalizeSchema(tool.outputSchema)} : {})}));
    }, timeoutMs);
    return { id: server.id, status: 'available', transport, tools: result, checkedAt: new Date().toISOString() };
  } catch (e) {
    return { id: server.id, status: e.code || 'unavailable', error: String(e.message).slice(0, 500), checkedAt: new Date().toISOString(), tools: [] };
  }
}
