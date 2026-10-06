# Entrega da V1 — Mesa

Validação local concluída em 05/10/2026, no Windows. As seis etapas solicitadas foram executadas. A aplicação está disponível nesta máquina em http://127.0.0.1:3000/login, com PostgreSQL persistente em loopback na porta 55432.

Acesso fictício: **admin@exemplo.com / Demo@123456**. Para começar uma operação própria, use **Criar restaurante**; as organizações são isoladas.

## Resultados das seis etapas

| Etapa | Resultado real |
|---|---|
| Migration inicial | SQL gerado em `prisma/migrations/202610050001_initial/migration.sql`, com transação, chaves estrangeiras por organização e invariantes incorporados. |
| Dois bancos | Migration aplicada a `restaurante` e `restaurante_test`. Conferência final: aplicada, sem rollback e nenhuma migration pendente em ambos. |
| Seed | Demonstração cadastrada no banco principal: 9 ingredientes, 3 fornecedores, 6 lançamentos financeiros, inventário, consumos, preços, cotações e pedidos. Segunda execução preservou os dados existentes. O banco de testes utiliza fixtures próprias. |
| Verificação de código | Lint e TypeScript sem erros; 52 testes unitários e 11 de integração aprovados; build de produção concluído. |
| Navegador | 2 testes E2E aprovados contra o build de produção, um desktop e um celular emulado; revisão de 5 páginas em cada tamanho, exportação CSV e logout também aprovados. |
| Relatório | Este documento, logs e evidências em `docs/evidence`. |

O ambiente executou Node **24.19.0**, Next **16.3.8**, React **19.3.0**, Prisma **7.10.0**, TypeScript **6.0.3** e PostgreSQL **18.4**. O Node global desta máquina é 26; para repetir os comandos, selecione Node 24 LTS, conforme `package.json`. Nesta validação foi utilizado o runtime Node 24 disponível no Codex. As dependências e o Prisma Client estão instalados.

## Consistência do banco

A consulta aos catálogos do PostgreSQL confirmou **14 CHECK constraints e 7 triggers** em cada banco: cinco preservam históricos e dois verificam, ao final da transação, que o saldo do ingrediente corresponde à soma das movimentações.

As restrições incluem limites de estoque, coerência entre mínimo e ideal, quantidades positivas, direção e resultado da movimentação, recebimentos dentro da quantidade pedida e consistência entre pagamento e data de pagamento. As chaves compostas impedem relacionamentos com registros de outra organização. Histórico de estoque, preços, recebimentos e auditoria permanece imutável.

Os testes reais verificaram escrita SQL direta inválida, isolamento entre organizações, perfis de acesso, concorrência de saídas, inventário desatualizado, rollback integral de recebimentos, recebimentos parciais e idempotência. A separação de produtos em listas distintas antes de cotar também foi validada sem duplicar necessidades.

Evidência: [estado dos bancos](evidence/database-validation.json). SQL de referência: [invariantes](../prisma/invariants.sql).

## Fluxo confirmado pela interface

Em cada projeto Playwright, foi criado um restaurante separado pela tela de cadastro. O teste cadastrou um ingrediente, fez inventário inicial de **10 kg**, registrou consumo de **7 kg** e confirmou a necessidade de **12 kg** para atingir o ideal de 15 kg. Em seguida cadastrou fornecedor, cotou a R$ 20/kg, justificou a escolha, solicitou aprovação, aprovou, confirmou o pedido, recebeu os ingredientes e marcou a conta gerada como paga.

A consulta posterior ao banco confirmou, nas duas organizações mais recentes, **15 kg de estoque**, **R$ 240,00 de despesa** e situação **PAID**. As organizações de E2E usam dados fictícios e permanecem no banco principal; os históricos não foram apagados.

Os testes de integração cobrem adicionalmente recebimento parcial e concorrência, que não foram percorridos como variantes separadas no navegador.

| Verificação | Resultado |
|---|---|
| Desktop | Chrome instalado, viewport 1440 × 960 |
| Celular | Emulação Pixel 7 no Chrome, viewport 390 × 844 |
| Páginas revisadas | Dashboard, ingredientes, cotações, pedido e contas a pagar |
| Largura do documento | Igual à largura da viewport nas 10 verificações; tabelas largas têm rolagem interna |
| Controles revisados | Nenhum botão, input ou select visível sem identificação no verificador utilizado |
| Toque no celular | Nenhum controle verificado abaixo de 44 px de altura nas cinco páginas |
| CSV | HTTP 200, conteúdo CSV, cabeçalho e 9 ingredientes, em ambos os tamanhos |
| Logout | Acesso posterior a /estoque redirecionou para /login |
| JavaScript no navegador | Nenhum evento pageerror durante a revisão final |

A avaliação móvel foi emulada; não houve teste em aparelho físico. A checagem de rótulos e tamanho de toque é limitada aos controles e páginas visitados, sem certificação WCAG ou cobertura de todos os navegadores.

Capturas: [dashboard desktop](evidence/dashboard-desktop.png), [dashboard celular](evidence/dashboard-celular.png), [pedido celular](evidence/pedido-celular.png), [financeiro celular](evidence/financeiro-celular.png), [fim do fluxo desktop](evidence/fluxo-desktop.png) e [fim do fluxo celular](evidence/fluxo-celular.png). Também estão disponíveis as capturas das demais páginas em ambos os tamanhos, o [CSV exportado](evidence/consumo-demonstracao.csv) e as [medições do navegador](evidence/browser-validation.json).

Na demonstração preservada, o dashboard apresentou entradas de **R$ 5.000,00**, saídas pagas de **R$ 1.630,00**, saldo de caixa de **R$ 3.370,00**, compromissos pendentes de **R$ 419,00** e compras recebidas no período de **R$ 130,00**. São valores fictícios, referentes ao período exibido nas capturas.

## Correções efetuadas durante a validação

- Compatibilidade dos testes com Vitest 5 e correção da exportação PostCSS apontada pelo lint.
- Consultas próprias dentro de transações executadas sequencialmente.
- Campo de senha com label separado da instrução de cadastro.
- Redirecionamento de sessão ausente também na página operacional, além do layout.
- Seleções opcionais podem voltar à opção vazia.
- Uso das movimentações distingue restaurante, evento, outros e ausência de contexto.
- Mensagem de contas a pagar vazias corresponde a compromissos pendentes.
- Controles móveis ampliados e saída reposicionada no cabeçalho.
- E2E espera a resposta do recebimento e do pagamento antes de avançar; o status do pedido é verificado no painel do pedido.
- CI preparada para executar E2E após o build de produção. O workflow não foi executado remotamente nesta entrega.

## Logs e reprodução

Os logs finais foram preservados em [evidências](evidence/). Os comandos retornaram código zero:

| Comando | Resultado |
|---|---|
| npm run db:deploy | Nenhuma migration pendente no banco principal |
| node scripts/db-test-prepare.mjs | Nenhuma migration pendente no banco de testes |
| npm run db:seed | Dados existentes preservados na execução de confirmação |
| npm run lint | Aprovado |
| npm run typecheck | Aprovado |
| npm test | 52 testes / 6 arquivos aprovados |
| npm run test:integration | 11 testes / 3 arquivos aprovados |
| npm run build | Build otimizado e 10 rotas compiladas |
| npm run test:e2e | 2 projetos aprovados, 8,3 segundos na execução final |

Para repetir o E2E de produção, com Node 24 e banco disponível:

```powershell
npm run build
# Em outro terminal, mantenha este servidor aberto:
npm run start
# No terminal dos testes:
$env:PLAYWRIGHT_PRODUCTION = "true"
$env:PLAYWRIGHT_CHANNEL = "chrome"
npm run test:e2e
```

Aqui foi usado o Chrome instalado. Em um ambiente sem Chrome, instale o Chromium com `npx playwright install chromium` e deixe PLAYWRIGHT_CHANNEL sem valor. O Playwright inicia um servidor se não encontrar um disponível. Veja [setup](setup.md) para configurar os bancos.

## Observações e limites de entrega

O driver **pg 8.23.1** ainda emite aviso de depreciação sobre consultas simultâneas no mesmo cliente. O rastreamento passa pelo adapter PostgreSQL do Prisma; executar sequencialmente as consultas próprias não eliminou o aviso. Os testes passaram, mas a compatibilidade deve ser revista antes de atualizar para pg 9. O aviso não foi suprimido nem corrigido por alteração no código de dependências.

O log do servidor também registrou mensagens **“The destination stream closed early”** durante a sessão de navegação automatizada. Não houve falha correspondente nos testes finais nem eventos pageerror. A causa exata não foi estabelecida; o log foi preservado para diagnóstico, e não se declara o servidor livre de mensagens de erro.

Esta entrega prepara e valida a aplicação localmente. Publicação em Vercel, banco gerenciado, configuração de domínio, backups e execução remota de CI não foram realizadas. Não foram executados testes de carga, auditoria completa de segurança ou matriz de navegadores.

A V1 inclui autenticação e perfis, estoque, inventários, fornecedores e preços, listas de compra, cotações, aprovação, pedidos, recebimentos, financeiro gerencial, relatórios CSV e auditoria. Ela permite separar ingredientes em listas antes de cotar; a escolha de uma cotação exige atendimento integral de cada lista. Distribuir automaticamente uma mesma lista entre várias cotações permanece no roadmap.

Os painéis recentes possuem limites de listagem; contas a pagar incluem todos os compromissos pendentes, e os agregados consideram os registros correspondentes completos. Paginação, recuperação de senha por e-mail, integrações externas, PDV, fiscal, ficha técnica e pagamentos bancários ficam para evolução. Frete compõe a despesa da compra, mas não o custo médio do ingrediente; condições textuais de pagamento não geram vencimentos automaticamente.

## Atualização de 06/10/2026 — Neon

O banco gerenciado Neon foi configurado e validado. Veja o [relatório de configuração Neon](neon-setup.md) com todas as alterações e resultados atuais.
