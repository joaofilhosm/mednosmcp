import { readFile, writeFile } from 'node:fs/promises';
import { canonicalUrl, findByUrl, loadRegistry, validateRegistry } from '../src/registry.js';
const file = new URL('../servers.json', import.meta.url);
const [action, value, id, ...name] = process.argv.slice(2);
const servers = await loadRegistry();
if (action === 'check') {
  console.log(`Cadastro válido: ${servers.length} servidores sem URLs nem IDs duplicados.`);
} else if (action === 'find' && value) {
  const match = findByUrl(servers, value);
  console.log(match ? JSON.stringify({cadastrado:true, servidor:match}, null, 2) : JSON.stringify({cadastrado:false,url:canonicalUrl(value)}, null, 2));
  process.exitCode = match ? 0 : 1;
} else if (action === 'add' && value && id && name.length) {
  const existing = findByUrl(servers, value);
  if (existing) { console.error(`Este MCP já está cadastrado: ${existing.id} — ${existing.url}`); process.exitCode = 1; }
  else {
    servers.push({id, name:name.join(' '), url:canonicalUrl(value), category:'Outros'});
    validateRegistry(servers);
    await writeFile(file, JSON.stringify(servers, null, 2) + '\n');
    console.log('MCP adicionado. Execute npm run refresh para verificar e atualizar as ferramentas.');
  }
} else {
  console.error('Uso: npm run check:registry | npm run check:url -- <url> | npm run add:mcp -- <url> <id> <nome>');
  process.exitCode = 1;
}
