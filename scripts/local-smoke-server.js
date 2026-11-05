import http from 'node:http';
import handler from '../api/mcp.js';
const server=http.createServer(async (req,res)=>{
  req.query=Object.fromEntries(new URL(req.url,'http://localhost').searchParams);
  if (req.url.startsWith('/mcp/compacto'))req.query.mode='compact';
  if (req.method==='POST') {
    let data='';for await (const chunk of req)data+=chunk;
    try {req.body=JSON.parse(data);} catch {req.body=undefined;}
  }
  res.status=code=>{res.statusCode=code;return res;};
  res.json=value=>{res.setHeader('content-type','application/json');return res.end(JSON.stringify(value));};
  await handler(req,res);
});
server.listen(34901,'127.0.0.1',()=>console.log('listening'));
