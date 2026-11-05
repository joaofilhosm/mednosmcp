import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { ListToolsResultSchema } from '@modelcontextprotocol/sdk/types.js';
import assert from 'node:assert/strict';
const base=process.argv[2] || 'http://localhost:3000';
for (const mode of ['', '/compacto']) {
  const client=new Client({name:'mednosmcp-smoke',version:'1.0'},{capabilities:{}});
  try {
    await client.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp${mode}`)),{timeout:15000});
    let cursor;const all=[];
    do {const page=await client.request({method:'tools/list',params:cursor?{cursor}:{}},ListToolsResultSchema,{timeout:15000});all.push(...page.tools);cursor=page.nextCursor;}while(cursor);
    assert.ok(all.find(t=>t.name==='hub_verificar_mcp'));
    if(mode)assert.ok(all.find(t=>t.name==='hub_buscar_ferramentas')); else assert.ok(all.length>2);
    const result=await client.callTool({name:'hub_verificar_mcp',arguments:{url:'https://KB.MEDNOS.APP:443/mcp/'}});
    assert.equal(JSON.parse(result.content[0].text).cadastrado,true);
    if(mode){const found=await client.callTool({name:'hub_buscar_ferramentas',arguments:{busca:'pubmed',limite:2}});assert.ok(JSON.parse(found.content[0].text).ferramentas.length>0);}
    console.log(`${mode || '/mcp'}: ${all.length} ferramentas; conexão, listagem e verificação OK`);
  } finally {await client.close().catch(()=>{});}
}
