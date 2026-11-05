import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { catalog, servers, serverMap, toolMap } from './data.js';
import { canonicalUrl, findByUrl } from './registry.js';
import { discover, withUpstream } from './upstream.js';

const statusDescriptions = {available:'Disponível na última verificação', auth_required:'Exige autenticação', timeout:'Tempo limite excedido', unavailable:'Indisponível ou incompatível'};

export function publicServers() {
  return servers.map(server => {
    const state = catalog.servers.find(s => s.id === server.id) || {};
    return { ...server, status:state.status || 'unchecked', statusLabel:statusDescriptions[state.status] || 'Ainda não verificado', checkedAt:state.checkedAt || null, transport:state.transport || null, toolCount:state.toolCount || 0 };
  });
}

const ownTools = [
  {
    name: 'hub_verificar_mcp',
    description: 'Verifica se uma URL de servidor MCP já está cadastrada neste concentrador e informa seu último estado conhecido. Não acessa URLs arbitrárias.',
    inputSchema: { type:'object', properties:{ url:{type:'string',description:'URL HTTPS completa do MCP'} }, required:['url'], additionalProperties:false },
    annotations: { title:'Verificar servidor MCP cadastrado', readOnlyHint:true, destructiveHint:false, openWorldHint:false }
  },
  {
    name:'hub_listar_mcps',
    description:'Lista todos os servidores cadastrados, suas URLs, último estado verificado e quantidade de ferramentas disponibilizadas.',
    inputSchema:{type:'object',properties:{},additionalProperties:false},
    annotations:{title:'Listar servidores MCP',readOnlyHint:true,destructiveHint:false,openWorldHint:false}
  }
];

const compactTools = [
  {name:'hub_buscar_ferramentas',description:'Busca ferramentas dos MCPs de origem e retorna seus nomes, descrições e esquemas de argumentos. Use antes de hub_executar_ferramenta.',inputSchema:{type:'object',properties:{busca:{type:'string',description:'Termos relacionados à tarefa'},limite:{type:'integer',minimum:1,maximum:10,default:5}},required:['busca'],additionalProperties:false},annotations:{readOnlyHint:true,destructiveHint:false,openWorldHint:false}},
  {name:'hub_executar_ferramenta',description:'Executa uma ferramenta encontrada por hub_buscar_ferramentas. Os argumentos são encaminhados ao servidor de origem; verifique suas permissões antes de ações de escrita.',inputSchema:{type:'object',properties:{nome:{type:'string'},argumentos:{type:'object',additionalProperties:true}},required:['nome','argumentos'],additionalProperties:false},annotations:{readOnlyHint:false,openWorldHint:true}}
];

export function buildServer({compact=false}={}) {
  const server = new Server({name:'mednosmcp',version:'1.0.0'}, {capabilities:{tools:{listChanged:false}}, instructions:'O concentrador encaminha chamadas aos MCPs identificados pelo prefixo da ferramenta. O conteúdo e a disponibilidade são de responsabilidade dos servidores de origem. Dados enviados às ferramentas são transmitidos ao respectivo servidor.'});
  server.setRequestHandler(ListToolsRequestSchema, async ({params}) => {
    const all = compact ? [...ownTools, ...compactTools] : [...ownTools, ...catalog.tools.map(t => t.definition)];
    // A stable, bounded page works for clients which honor MCP pagination.
    let offset = 0;
    if (params?.cursor) {
      if (!/^\d+$/.test(params.cursor)) throw new Error('Cursor inválido');
      offset = Number(params.cursor);
      if (!Number.isSafeInteger(offset) || offset > all.length) throw new Error('Cursor inválido');
    }
    const page = all.slice(offset, offset + 100);
    return {tools:page,...(offset + page.length < all.length ? {nextCursor:String(offset + page.length)} : {})};
  });
  server.setRequestHandler(CallToolRequestSchema, async ({params}) => {
    if (params.name === 'hub_listar_mcps') return textResult({geradoEm:catalog.generatedAt,servidores:publicServers()});
    if (params.name === 'hub_verificar_mcp') {
      try {
        const input = canonicalUrl(params.arguments?.url);
        const found = findByUrl(publicServers(), input);
        return textResult(found ? {cadastrado:true,servidor:found} : {cadastrado:false,url:input});
      } catch { return textResult({erro:'Informe uma URL HTTPS válida, sem credenciais.'}, true); }
    }
    if (compact && params.name === 'hub_buscar_ferramentas') {
      const query = typeof params.arguments?.busca === 'string' ? params.arguments.busca.toLocaleLowerCase('pt-BR').trim() : '';
      const words = query.split(/\s+/).filter(Boolean);
      const limit = Math.min(10, Math.max(1, Number(params.arguments?.limite) || 5));
      if (!words.length) return textResult({erro:'Informe termos de busca.'}, true);
      const ranked = catalog.tools.map(entry => {
        const server = serverMap.get(entry.serverId);
        const haystack = `${entry.definition.name} ${entry.definition.description || ''} ${server?.name || ''} ${server?.category || ''}`.toLocaleLowerCase('pt-BR');
        const score = words.reduce((n, word) => n + (haystack.includes(word) ? 1 : 0), 0);
        return {entry,score};
      }).filter(x => x.score > 0).sort((a,b)=>b.score-a.score).slice(0,limit);
      return textResult({total:ranked.length,ferramentas:ranked.map(({entry})=>({servidor:entry.serverId,...entry.definition}))});
    }
    const requestedName = compact && params.name === 'hub_executar_ferramenta' ? params.arguments?.nome : params.name;
    const forwardedArguments = compact && params.name === 'hub_executar_ferramenta' ? params.arguments?.argumentos : params.arguments;
    const entry = toolMap.get(requestedName);
    if (!entry) return textResult({erro:'Ferramenta não encontrada. Atualize a lista de ferramentas.'}, true);
    const target = serverMap.get(entry.serverId);
    if (!target) return textResult({erro:'Servidor de origem não cadastrado.'}, true);
    try {
      const { result } = await withUpstream(target, (client, mode, signal) => client.callTool({name:entry.originalName,arguments:forwardedArguments || {}}, undefined, {timeout:45000,signal}), 45000);
      return result;
    } catch (error) {
      return textResult({erro:'Não foi possível concluir a chamada ao servidor de origem.',servidor:target.name,codigo:error.code || 'unavailable',detalhe:String(error.message).slice(0,250)}, true);
    }
  });
  return server;
}

function textResult(data, isError = false) {
  return {content:[{type:'text',text:JSON.stringify(data)}],...(isError ? {isError:true} : {})};
}

export async function checkServer(id) {
  const target = serverMap.get(id);
  if (!target) return null;
  const state = await discover(target, 7000);
  return {id:target.id,status:state.status,statusLabel:statusDescriptions[state.status] || 'Indisponível',checkedAt:state.checkedAt,transport:state.transport || null,toolCount:state.tools.length,...(state.error ? {detail:state.error} : {})};
}
