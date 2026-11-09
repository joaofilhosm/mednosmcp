import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalUrl, findByUrl, validateRegistry } from '../src/registry.js';
import { publicToolName, normalizeSchema } from '../src/upstream.js';

test('canonicaliza host, porta padrão, barra final e ordem dos parâmetros', () => {
  assert.equal(canonicalUrl('https://EXAMPLE.com:443/mcp/?z=2&a=1#fragment'), 'https://example.com/mcp?a=1&z=2');
});

test('rejeita entradas inseguras e identifica duplicidade normalizada', () => {
  assert.throws(()=>canonicalUrl('http://example.com/mcp'));
  assert.throws(()=>canonicalUrl('https://user:pass@example.com/mcp'));
  const servers=[{id:'a',name:'A',url:'https://EXAMPLE.com/mcp/'},{id:'b',name:'B',url:'https://example.com:443/mcp'}];
  assert.throws(()=>validateRegistry(servers),/URL duplicada/);
});

test('preserva diferenças reais de rota e impede IDs repetidos', () => {
  assert.doesNotThrow(()=>validateRegistry([{id:'a',name:'A',url:'https://example.com/api/mcp'},{id:'b',name:'B',url:'https://example.com/mcp'}]));
  assert.throws(()=>validateRegistry([{id:'a',name:'A',url:'https://example.com/a'},{id:'a',name:'B',url:'https://example.com/b'}]),/ID duplicado/);
});

test('nomes são estáveis, distintos e compatíveis com limite de 64 caracteres', () => {
  const a=publicToolName('origem','ferramenta/'.repeat(40));
  assert.ok(a.length<=64);assert.match(a,/^[a-zA-Z0-9_-]+$/);assert.equal(a,publicToolName('origem','ferramenta/'.repeat(40)));assert.notEqual(a,publicToolName('origem2','ferramenta/'.repeat(40)));
});

test('normaliza o tipo nulo em esquemas de origem preservando seus demais valores', () => {
  const before={type:'object',properties:{data:{type:['object',null],description:'x'}}};
  assert.deepEqual(normalizeSchema(before),{type:'object',properties:{data:{type:['object','null'],description:'x'}}});
});


test('reconhece endereços alternativos como o mesmo servidor', () => {
  const servers=[{id:'pesq_saude',name:'Pesquisa em Saúde',url:'https://pesq-saude.joaosmfilho.org/mcp',aliases:['https://pesquisa-saude.vercel.app/api/mcp']}];
  validateRegistry(servers);
  assert.equal(findByUrl(servers,'https://PESQUISA-SAUDE.vercel.app/api/mcp/').id,'pesq_saude');
  assert.throws(()=>validateRegistry([...servers,{id:'other',name:'Outro',url:'https://pesquisa-saude.vercel.app/api/mcp'}]),/URL duplicada/);
});

import { authHeaders } from '../src/upstream.js';
test('authHeaders lê a chave só do ambiente', () => {
  const server = { auth: { header: 'x-api-key', env: 'FOO_KEY' } };
  assert.deepEqual(authHeaders(server, { FOO_KEY: 'segredo' }), { 'x-api-key': 'segredo' });
  assert.deepEqual(authHeaders(server, {}), {});
  assert.deepEqual(authHeaders({}, { FOO_KEY: 'x' }), {});
});
