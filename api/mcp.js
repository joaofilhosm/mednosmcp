import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { buildServer } from '../src/handlers.js';
export const config = { maxDuration: 60 };
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.setHeader('Allow','POST, GET, DELETE, OPTIONS'); return res.status(204).end(); }
  const server = buildServer({compact: req.query?.mode === 'compact' || new URL(req.url, 'http://localhost').searchParams.get('mode') === 'compact'});
  const transport = new StreamableHTTPServerTransport({sessionIdGenerator:undefined,enableJsonResponse:true});
  res.on('close', () => { transport.close().catch(() => {}); server.close().catch(() => {}); });
  try { await server.connect(transport); await transport.handleRequest(req, res, req.body); }
  catch (error) {
    if (!res.headersSent) res.status(500).json({jsonrpc:'2.0',error:{code:-32603,message:'Erro interno do concentrador'},id:null});
    else res.end();
  }
}
