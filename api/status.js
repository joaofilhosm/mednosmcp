import { checkServer } from '../src/handlers.js';
export const config = { maxDuration:20 };
export default async function handler(req,res) {
  if (req.method !== 'POST') return res.status(405).json({error:'Method not allowed'});
  const id = req.body?.id;
  if (typeof id !== 'string' || !/^[a-z0-9_]{1,24}$/.test(id)) return res.status(400).json({error:'Informe o ID de um servidor cadastrado.'});
  const result = await checkServer(id);
  if (!result) return res.status(404).json({error:'Servidor não cadastrado.'});
  res.setHeader('Cache-Control','no-store');
  return res.status(200).json(result);
}
