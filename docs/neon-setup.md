# Configuração Neon — 06/10/2026

Projeto **restaurante-demo / gentle-rice-38227588**, branch **production / br-steep-mode-b66mxcyp**, banco **neondb**. A aplicação em http://127.0.0.1:3000/login utiliza agora o banco Neon.

Foi lida a skill solicitada em https://neon.com/.well-known/agent-skills/neon/SKILL.md e a skill neon-postgres instalada. Prisma, driver pg, autenticação, papéis, schema e regras do seed foram preservados.

## Todas as alterações

| Local | Alteração |
|---|---|
| CLI global | Neon 8.0.11 instalado em F:/npm-global; esbuild reconstruído com autorização específica de install script. |
| Perfil CLI | Login OAuth autorizado pelo usuário, armazenado no perfil DEFAULT e reutilizado. |
| .agents/skills e skills-lock.json | Oito skills ausentes instaladas: neon, neon-postgres, neon-postgres-branches, neon-postgres-egress-optimizer, neon-auth, neon-functions, neon-object-storage e neon-ai-gateway. A conferência posterior encontrou todas presentes; não foram reinstaladas. |
| MCP do Codex | Entrada Neon adicionada em C:/Users/weder/.codex/config.toml, com OAuth e URL https://mcp.neon.tech/mcp?projectId=gentle-rice-38227588. As operações desta sessão usaram o CLI autenticado. O MCP poderá pedir autorização própria no primeiro uso. |
| .neon e .gitignore | Diretório vinculado ao projeto existente e à branch fornecida; .neon incluído nas exclusões do Git. Exclusões anteriores preservadas. |
| neon.ts | Criado com import de defineConfig de @neon/config/v1 e export default defineConfig({}), conforme solicitado. |
| package.json / package-lock.json | @neon/config e @neon/env acrescentados como dependências de desenvolvimento; lockfile atualizado. |
| .env | DATABASE_URL passa a usar pool Neon; DATABASE_URL_UNPOOLED e NEON_BRANCH recebidas do CLI; DIRECT_URL sincronizada com a conexão direta. APP_URL, TEST_DATABASE_URL e ALLOW_DEMO_SEED preservadas. Segredos permanecem locais. |
| Backup privado | Configuração anterior copiada para .local/validation/env-antes-neon.backup. O banco local não foi apagado nem transferido. |
| prisma.config.ts | DATABASE_URL_UNPOOLED acrescentada como fallback após DIRECT_URL e antes de DATABASE_URL. |
| Banco Neon | Migration inicial aplicada e demonstração fictícia criada; nenhuma tabela removida. |
| tests/integration/setup.ts | Corrigido final de arquivo contendo os caracteres literais barra-n. |
| tests/e2e/restaurant.spec.ts | Teste agora aguarda a resposta de generatePurchaseRequest antes de navegar; a latência remota revelou cancelamento da requisição anterior. |
| docs/evidence/*.log | Corrigidos finais literais barra-n nos 11 logs antigos, mantendo as mensagens. |
| AGENTS.md / CLAUDE.md | Gerados automaticamente pelo Next.js ao iniciar next dev; regras mantidas. |
| Servidor | Reiniciado em modo desenvolvimento na porta 3000 para carregar o Neon. |
| Evidências e documentação | Este relatório, referências nos documentos setup/delivery, screenshots, CSV, medições e logs criados em docs/evidence/neon. Helpers e backup privado ficam em .local/validation. |

## Execução e preservação

O CLI confirmou que production corresponde ao ID do link enviado. A conexão SQL confirmou que o banco ainda não tinha tabelas públicas da aplicação.

neon config plan e neon deploy retornaram **No changes**. Nenhum serviço adicional, compute, branch, Auth gerenciado, Data API ou Function foi provisionado. O deploy Neon reconciliou a política vazia; o frontend continua local.

As variáveis foram obtidas com neon env pull --service postgres. Aplicação usa a URL com pool; Prisma Migrate usa a direta. Parâmetros TLS enviados pelo Neon foram preservados.

prisma generate, prisma migrate deploy e prisma db seed concluíram. A primeira chamada direta ao Prisma não disponibilizava tsx no PATH; o seed foi repetido com node_modules/.bin no PATH e passou. As proteções NODE_ENV=production e ALLOW_DEMO_SEED do seed permaneceram intactas; ele foi executado em ambiente de desenvolvimento, neste projeto autorizado para demonstração.

## Resultados reais

| Verificação | Resultado |
|---|---|
| Migration | 202610050001_initial aplicada, sem rollback |
| Tabelas públicas | 24, incluindo _prisma_migrations |
| Restrições e triggers | 14 CHECK constraints e 7 triggers |
| Demonstração | 9 ingredientes, 3 fornecedores, 6 lançamentos |
| Saldo versus histórico | Zero ingredientes com saldo divergente |
| Lint / TypeScript / build | Aprovados |
| Unitários | 52 testes aprovados |
| E2E contra Neon em next dev | Desktop passou em 29,0 s; celular em 31,9 s |
| Resultado persistido | Nas duas organizações: 15 kg de estoque, conta R$ 240,00 e situação PAID |
| Revisão complementar | 5 páginas em desktop e 5 em celular sem overflow do documento; controles verificados rotulados |
| CSV / logout | HTTP 200 e 10 linhas; acesso anônimo a /estoque redirecionou para /login |

Fluxo: cadastro/login → dashboard → ingrediente → inventário → consumo → alerta de mínimo → fornecedor → cotação → aprovação → pedido → recebimento → conta a pagar → pagamento.

As organizações de E2E e das tentativas interrompidas são fictícias e permanecem no banco. Celular foi emulado no Chrome; não houve teste em aparelho físico. Os testes de integração PostgreSQL da entrega anterior não foram repetidos no Neon; TEST_DATABASE_URL continua usando o banco local isolado.

Os avisos do pg sobre fila de consultas e semântica futura de sslmode=require continuam presentes. O servidor de desenvolvimento também registra stream encerrado durante navegações automatizadas. As verificações finais passaram. npm audit apontou 9 ocorrências altas nas cadeias de desenvolvimento de Prisma e ESLint/Next; não foi aplicado audit fix --force ou downgrade automático.

## Evidências e acesso

[Conferência do banco](evidence/neon/database-validation.json), [medições do navegador](evidence/neon/browser-validation.json), [CSV](evidence/neon/consumo-demonstracao.csv), [fluxo desktop](evidence/neon/fluxo-desktop.png), [fluxo celular](evidence/neon/fluxo-celular.png) e logs em evidence/neon.

Login fictício: **admin@exemplo.com / Demo@123456**. Para uma organização própria isolada, use Criar restaurante.

Com Node 24 e .env configurada:

~~~powershell
npm ci
npx prisma generate
npx prisma migrate deploy
# Somente na demonstração, com ALLOW_DEMO_SEED=true:
npx prisma db seed
npm run dev
~~~

Para alternar branch futuramente, sincronize DIRECT_URL com a nova DATABASE_URL_UNPOOLED antes de aplicar migrations; neon env pull não gerencia DIRECT_URL. Credenciais, .env, contexto .neon e backup privado permanecem fora do Git.