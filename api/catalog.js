import { catalog } from '../src/data.js';
import { publicServers } from '../src/handlers.js';
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({error:'Method not allowed'});
  res.setHeader('Cache-Control','public, s-maxage=60, stale-while-revalidate=300');
  res.status(200).json({generatedAt:catalog.generatedAt,toolCount:catalog.tools.length,servers:publicServers()});
}
