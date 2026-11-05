const $ = s => document.querySelector(s);
const endpoint = `${location.origin}/mcp`;
$('#endpoint').textContent = endpoint;
$('#endpoint-bottom').textContent = endpoint;
$('#compact-endpoint').textContent = `${endpoint}/compacto`;
for (const id of ['#copy','#copy-bottom']) $(id).addEventListener('click',async e=>{
  try { await navigator.clipboard.writeText(endpoint); const original=e.currentTarget.textContent; e.currentTarget.textContent='Copiado!'; setTimeout(()=>e.currentTarget.textContent=original,2000); } catch { alert('Endereço: '+endpoint); }
});
let servers = [];
function normalizeUrl(input) {
  const u = new URL(input.trim().replace(/\\:/g,':'));
  if(u.protocol!=='https:'||u.username||u.password)throw Error('URL inválida');
  u.hash=''; u.pathname=u.pathname.replace(/\/+$/,'')||'/';u.searchParams.sort();return u.toString();
}
function statusText(s) { return s.statusLabel || 'Ainda não verificado'; }
function el(type,className,text) {const node=document.createElement(type);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;}
function render() {
  const q=$('#search').value.toLocaleLowerCase('pt-BR').trim(), category=$('#filter').value;
  const matches=servers.filter(s=>(!category||s.category===category)&&`${s.name} ${s.url} ${(s.aliases||[]).join(" ")} ${s.category} ${s.id}`.toLocaleLowerCase('pt-BR').includes(q));
  const target=$('#cards');target.replaceChildren();
  if(!matches.length){target.append(el('p','empty','Nenhum servidor encontrado.'));return;}
  for(const s of matches){
    const card=el('article','card'), top=el('div','card-top'), icon=el('div','card-icon',s.name.slice(0,2).toUpperCase()), tag=el('span','tag',s.category);
    top.append(icon,tag);card.append(top,el('h3','',s.name),el('div','url',s.url));
    const bottom=el('div','card-bottom'), status=el('span','status '+s.status,`${statusText(s)} · ${s.toolCount} ferramentas`), button=el('button','','Testar agora ↗');
    button.type='button';button.addEventListener('click',async()=>{button.disabled=true;button.textContent='Testando…';try{const response=await fetch('/api/status',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:s.id})});if(!response.ok)throw Error();const result=await response.json();Object.assign(s,result);status.textContent=`${statusText(s)} agora · ${s.toolCount} na origem`;status.className='status '+s.status;button.textContent='Testar novamente ↗';}catch{button.textContent='Falha ao testar ↻';}finally{button.disabled=false;}});
    bottom.append(status,button);card.append(bottom);target.append(card);
  }
}
$('#check').addEventListener('click',()=>{const result=$('#check-result');try{const url=normalizeUrl($('#url-check').value);const match=servers.find(s=>[s.url,...(s.aliases||[])].some(item=>normalizeUrl(item)===url));result.textContent=match?`Já cadastrado: ${match.name} (${match.id}). ${statusText(match)}.`:'Essa URL não está cadastrada. Endereços diferentes podem apontar para o mesmo serviço.';}catch{result.textContent='Informe uma URL HTTPS válida, sem credenciais.';}});
$('#search').addEventListener('input',render);$('#filter').addEventListener('change',render);
fetch('/api/catalog').then(r=>{if(!r.ok)throw Error();return r.json();}).then(data=>{
  servers=data.servers;$('#n-servers').textContent=servers.length;$('#n-tools').textContent=data.toolCount;$('#n-online').textContent=servers.filter(s=>s.status==='available').length;$('#catalog-summary').textContent=`${servers.length} servidores cadastrados`;
  const categories=[...new Set(servers.map(s=>s.category))].sort((a,b)=>a.localeCompare(b,'pt-BR'));for(const c of categories){const option=el('option','',c);option.value=c;$('#filter').append(option);}
  $('#checked-at').textContent='Catálogo de ferramentas atualizado em '+new Date(data.generatedAt).toLocaleString('pt-BR',{timeZone:'America/Fortaleza'})+'. A verificação individual mostra a situação naquele momento; as ferramentas anunciadas mudam apenas após a atualização do catálogo.';render();
}).catch(()=>{$('#cards').replaceChildren(el('p','empty','Não foi possível carregar o catálogo. Tente novamente.'));$('#catalog-summary').textContent='Catálogo indisponível';});
