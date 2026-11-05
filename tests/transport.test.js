import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { withUpstream } from '../src/upstream.js';

test('não repete operação quando há erro após conectar à origem', async () => {
  const httpServer=http.createServer(async (req,res)=>{
    const server=new Server({name:'test-upstream',version:'1'},{capabilities:{tools:{}}});
    const transport=new StreamableHTTPServerTransport({sessionIdGenerator:undefined,enableJsonResponse:true});
    res.on('close',()=>{transport.close().catch(()=>{});server.close().catch(()=>{});});
    await server.connect(transport);
    await transport.handleRequest(req,res);
  });
  httpServer.listen(0,'127.0.0.1');await once(httpServer,'listening');
  try {
    let attempts=0;
    await assert.rejects(withUpstream({url:`http://127.0.0.1:${httpServer.address().port}/mcp`},async()=>{attempts++;throw new Error('falha durante execução');},5000),/falha durante execução/);
    assert.equal(attempts,1);
  } finally {httpServer.close();await once(httpServer,'close');}
});
