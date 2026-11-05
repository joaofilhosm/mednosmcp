import { readFile } from 'node:fs/promises';

export function canonicalUrl(input) {
  if (typeof input !== 'string' || input.length > 2048) throw new Error('URL inválida');
  const url = new URL(input.trim().replace(/\\:/g, ':'));
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Use uma URL HTTPS sem credenciais');
  url.hash = '';
  url.hostname = url.hostname.toLowerCase();
  url.pathname = url.pathname.replace(/\/+$/, '') || '/';
  url.searchParams.sort();
  return url.toString();
}

export function findByUrl(servers, input) {
  const url = canonicalUrl(input);
  return servers.find(s => [s.url, ...(s.aliases || [])].some(item => canonicalUrl(item) === url));
}

export function validateRegistry(servers) {
  const urls = new Map(); const ids = new Set();
  for (const s of servers) {
    if (!s || typeof s.id !== 'string' || !/^[a-z0-9_]{1,24}$/.test(s.id) || !s.name || !s.url || (s.aliases && !Array.isArray(s.aliases))) throw new Error('Entrada inválida: ' + JSON.stringify(s));
    if (ids.has(s.id)) throw new Error('ID duplicado: ' + s.id);
    for (const sourceUrl of [s.url, ...(s.aliases || [])]) {
      const url = canonicalUrl(sourceUrl);
      if (urls.has(url)) throw new Error(`URL duplicada: ${s.id} e ${urls.get(url)} (${url})`);
      urls.set(url, s.id);
    }
    ids.add(s.id);
  }
  return true;
}

export async function loadRegistry() {
  const servers = JSON.parse(await readFile(new URL('../servers.json', import.meta.url), 'utf8'));
  validateRegistry(servers);
  return servers;
}
