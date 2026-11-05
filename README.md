# MedNos MCP

Concentrador de servidores MCP públicos para ChatGPT/OpenAI, Claude e clientes compatíveis com Streamable HTTP. O projeto encaminha cada chamada para a origem correspondente e não exige chave da OpenAI ou da Anthropic.

## Endereços

- `/mcp`: catálogo completo de ferramentas, paginado.
- `/mcp/compacto`: somente ferramentas de busca e execução, útil quando o cliente limita a quantidade de ferramentas ou o contexto. Pesquise com `hub_buscar_ferramentas` e execute com `hub_executar_ferramenta`.
- `/`: catálogo visual com busca e conferência de duplicidade.
- `/api/catalog`: servidores cadastrados e o último resultado de descoberta.
- `/api/status`: teste de um servidor registrado, mediante POST com `{"id":"..."}`.

Os nomes das ferramentas recebem o identificador da origem e um sufixo estável. Essa separação evita colisões mesmo quando dois serviços usam o mesmo nome. A interface e as ferramentas `hub_verificar_mcp` e `hub_listar_mcps` distinguem cadastro da situação observada na última atualização. O botão “Testar agora” executa uma verificação em tempo real, que não atualiza automaticamente o catálogo publicado.

## Cadastro e atualização

```bash
npm ci
npm run check:registry
npm run check:url -- 'https://exemplo.com/mcp'
npm run add:mcp -- 'https://exemplo.com/mcp' exemplo 'Nome da fonte'
npm run refresh
npm test
```

`servers.json` é a fonte de verdade, sob controle de versão. A validação impede IDs repetidos e URLs equivalentes, inclusive diferenças de maiúsculas no domínio, porta padrão, barra final e ordem de parâmetros. URLs alternativas conhecidas ficam em `aliases` e também são reconhecidas. URLs distintas ainda não identificadas como aliases podem levar ao mesmo serviço; isso exige conferência humana. O script `refresh` faz descoberta MCP, registra a data e gera `catalog.json`. Ao atualizar, revise as mudanças e publique novamente. Servidores que falham permanecem cadastrados, mas suas ferramentas não são anunciadas nessa atualização. Não são enviadas credenciais compartilhadas para fontes que exigem login.

## Uso

**Claude:** em Conectores, adicione um conector remoto com `https://mednosmcp.vercel.app/mcp` ou `/mcp/compacto`.

**ChatGPT:** em configurações de aplicativos, ative o modo de desenvolvedor quando disponível e crie um aplicativo MCP personalizado com o mesmo endereço.

**OpenAI Responses API:** defina `{ "type": "mcp", "server_label": "mednos", "server_url": "https://mednosmcp.vercel.app/mcp" }`; use `allowed_tools` para limitar a importação e preserve aprovações adequadas.

Os servidores de origem podem mudar, exigir autenticação, impor cotas ou ficar indisponíveis. Alguns expõem operações de escrita; revise as permissões e não exponha chaves pagas a usuários anônimos. Dados enviados a ferramentas são encaminhados ao provedor correspondente. O conteúdo clínico deve ser conferido em fontes primárias e não substitui julgamento profissional.

## Deploy

Este projeto usa funções Node.js na Vercel. Para publicar a partir de um checkout autorizado: `vercel link`, `vercel deploy --prod`. Execute `npm run refresh` antes do deploy para atualizar as ferramentas. Para verificação após o deploy: `node scripts/smoke.js https://mednosmcp.vercel.app`.

A cada push e pull request, o GitHub executa os testes e valida o cadastro e o catálogo. O build da Vercel também executa essas verificações antes da publicação: URLs ou IDs duplicados, catálogo desatualizado e inconsistências impedem o novo deploy, preservando a versão anteriormente publicada. Para alterar as origens, edite pelo script de cadastro, execute `npm run refresh`, revise os arquivos e faça o commit de `servers.json`, `catalog.json` e `catalog.json.gz` juntos.
