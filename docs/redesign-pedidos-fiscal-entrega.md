# Entrega — redesign MESA, pedidos, cozinha e importação fiscal

Data: 08/10/2026. Implementação concluída no checkout local com Next.js 16.3.8, React 19, Prisma 7 e Node.js 24.

## Publicação Casa Anatolia

Identidade atual: Casa Anatolia · Restaurante turco. Build de produção aprovada pelo Netlify usando `next build --webpack`. A primeira publicação revelou uma referência externa inválida do Prisma gerada pelo Turbopack no pacote serverless. A build foi alterada para Webpack e a função foi reconstruída sem reutilizar o cache. Logs: https://app.netlify.com/projects/demo-restaurante-vanessa/deploys/6ac7f5bb5525ba202d189835. Validação do site publicado: login HTTP 200; dashboard, pedidos, cozinha, importação fiscal e financeiro HTTP 200; navegação móvel validada sem transbordamento; nenhum erro JavaScript de página. Evidência: `.local/validation/casa-anatolia-production-check.log`. As variáveis existentes de produção foram preservadas. A listagem completa dessas variáveis foi bloqueada pela revisão automática por poder capturar segredos; não foi necessária à publicação.

## Resultado

A aplicação recebeu a identidade visual solicitada, com sidebar de 248 px, paleta definida no briefing, ícones Lucide, tipografia nativa legível, tabelas responsivas, formulários agrupados, estados vazios, skeleton e mensagens de sucesso/erro. Dashboard, estoque, compras, fornecedores, financeiro, relatórios, configurações e autenticação utilizam a mesma base visual. O dashboard apresenta receitas, despesas, compras e resultado, gráfico financeiro baseado nos lançamentos pagos, estoque em atenção e atividades/pendências reais.

A busca global consulta ingredientes, fornecedores e compras da organização autenticada. No celular, navegação e filtros usam diálogos acessíveis, com fechamento por Escape e restauração de foco. Tabelas e gráficos podem rolar dentro de seus próprios contêineres sem transbordar a página.

## Novos módulos

- `/pedidos`: cardápio separado do cadastro de ingredientes; pedidos de mesa, retirada ou entrega; cliente opcional; quantidades e observações por item e gerais; total calculado no servidor; envio à cozinha; cancelamento com motivo e confirmação. Preços e nomes são preservados no pedido mesmo após editar o cardápio.
- `/cozinha`: colunas Novos, Em preparo e Prontos; número, mesa/tipo, tempo desde envio, quantidades e observações; ações de preparo, pronto e entrega; polling de 4 segundos preservando a lista durante falhas ou quando os dados não mudam. Layout e botões adequados a tablet.
- Perfil `KITCHEN`: cadastrado em Configurações, com acesso restrito à cozinha. APIs de busca, relatórios, financeiro e administração negam acesso; o DTO da cozinha omite preços e totais.
- `/compras/importar-nota`: upload XML, QR por câmera ou imagem, chave de acesso e entrada manual. A conferência exige associação de todos os itens com ingredientes internos e quantidade convertida para a unidade do estoque. Associações podem ser lembradas por fornecedor e código/GTIN/descrição.
- A confirmação fiscal cria documento, fornecedor quando necessário, compra recebida, recebimento, movimentos/saldo de estoque, preços/histórico do fornecedor e conta a pagar dentro de uma transação. Falhas tardias provocam rollback integral. Chaves duplicadas na mesma organização são bloqueadas, incluindo confirmações concorrentes.

## Componentes reutilizados ou consolidados

| Componente | Arquivo/base |
| --- | --- |
| PageHeader, StatCard, FilterBar, FormSection, MoneyValue, QuantityValue, LoadingSkeleton | `src/shared/components/design-system.tsx` |
| SectionCard, DataTable, StatusBadge, EmptyState | aliases dos componentes Panel, Table, Badge e Empty em `display.tsx` |
| ConfirmDialog | `confirm-dialog.tsx`; diálogo nativo com IDs únicos e estados de processamento/erro |
| SearchInput / busca global | `global-search.tsx` |
| DateRangeFilter / filtros por período | `period-filter.tsx` |
| Sidebar / MobileNavigation | composição compartilhada em `app-shell.tsx` |
| Gráfico financeiro | `financial-chart.tsx`; barras, valores acessíveis e detalhamento tabular |

## Banco de dados e consistência

Nova migration: `prisma/migrations/202610080001_orders_fiscal/migration.sql`.

Adiciona MenuItem, Order, OrderItem, FiscalDocument e SupplierFiscalMapping, perfil KITCHEN, contador de pedidos por organização e relacionamentos. Inclui chaves estrangeiras compostas para isolamento entre organizações, unicidade de numeração/chave fiscal/associação, verificações de valores e timestamps e preservação imutável dos itens do pedido e documentos fiscais.

A migration foi aplicada nos bancos locais `restaurante` e `restaurante_test`. `prisma migrate status` confirmou os dois atualizados, com 2 migrations. O seed local adicionou apenas três itens fictícios ao cardápio de demonstração e preservou os registros existentes. Atualização de publicação em 08/10/2026: a migration desta entrega também foi aplicada com sucesso no Neon. A versão Casa Anatolia · Restaurante turco foi publicada em https://demo-restaurante-vanessa.netlify.app, com Next.js Runtime 5.16.2. Deploy: 6ac7f5bb5525ba202d189835. O nome do restaurante de demonstração no Neon foi atualizado de Casa Zaatar para Casa Anatolia, sem recriar dados.

## Comportamentos e limites deliberados

Pedidos não baixam ingredientes, conforme solicitado, pois ainda não existe ficha técnica vinculada ao cardápio. Finalizar um pedido também não gera receita automaticamente: o fluxo atual não registra pagamento, e o financeiro continua usando os lançamentos explícitos existentes.

QR e chave identificam a nota; os itens estruturados vêm do XML ou da conferência manual. Nenhum endereço lido é consultado automaticamente pelo servidor. São validados HTTPS, allowlist de domínio, modelo 55/65 e chave de 44 dígitos com dígito verificador. XML tem limite de 2 MB e rejeita DTD/entidades externas. Importações XML exigem manter a chave fiscal para a proteção contra duplicidade. Frete e outros custos são conferidos separadamente; a data de recebimento registra o momento da importação, preservando a data de emissão no documento.

Foram adicionados fast-xml-parser, html5-qrcode e jsqr. A leitura por imagem tenta o decoder principal e utiliza jsQR como segundo decoder. qrcode e seus tipos foram adicionados apenas para gerar imagens dos testes. A interface mantém câmera e alternativas de arquivo/chave/XML; a câmera física de um smartphone não foi testada nesta sessão.

## Validação executada

| Verificação | Resultado real |
| --- | --- |
| `npm run lint` | Aprovado, sem avisos do ESLint |
| `npm run typecheck` | Aprovado |
| Vitest unitário + integração | 12 arquivos e 82 testes aprovados: 64 unitários e 18 de integração |
| `npm run build` | Aprovado, incluindo geração do Prisma Client e rotas novas |
| `npm run test:e2e` | 4 testes aprovados em 21,3 s, desktop e celular |
| Revisão visual | 22 telas: 11 rotas em 1440×960 e 390×844, HTTP 200, sem erros de página e sem transbordamento horizontal da página |
| Cozinha em tablet | 1024×768, verificada nos testes de navegador |
| Migrations locais | Ambos os bancos atualizados |

Os testes cobrem criação de pedido, totais e snapshots, envio e transições, cancelamento, timestamps, permissões KITCHEN, chave/URL fiscal, XML válido e inválido, DTD, limites, associação, documento duplicado, concorrência, compra, estoque, preço/histórico, financeiro e rollback de uma falha tardia. No navegador foram exercitados o fluxo operacional anterior e os módulos novos, inclusive QR por imagem sem BarcodeDetector, conferência/confirmação, estoque e conta a pagar, usuário Cozinha, busca, menu e filtros móveis.

Durante os testes o Next.js registrou mensagens de stream encerrado em navegações interrompidas, e o driver PostgreSQL emitiu um aviso de depreciação de consultas concorrentes. Não houve falha das verificações finais nem erro JavaScript de página na revisão visual; essas mensagens não foram ocultadas dos logs.

Evidências locais (ignoradas pelo Git): `.local/validation/final-lint.log`, `final-typecheck.log`, `final-tests.log`, `final-build.log`, `final-e2e.log`, `.local/validation/redesign/browser.json`, capturas em `.local/validation/redesign/` e `test-results/`. A inspeção mecânica do design retornou lista vazia de achados em `.local/validation/redesign-design-detect.json`.

Os servidores temporários da aplicação e do PostgreSQL foram encerrados ao concluir a validação. As portas 3000, 3001 e 55432 ficaram sem listeners.

## Arquivos alterados ou criados

A lista abaixo inclui os arquivos da implementação e seus testes. Caminhos relativos à raiz do repositório.

- `DESIGN.md`
- `docs/redesign-pedidos-fiscal-entrega.md`
- `next.config.ts`
- `package-lock.json`
- `package.json`
- `prisma/migrations/202610080001_orders_fiscal/migration.sql`
- `prisma/schema.prisma`
- `prisma/seed.ts`
- `PRODUCT.md`
- `src/app/(dashboard)/[...section]/page.tsx`
- `src/app/(dashboard)/compras/importar-nota/page.tsx`
- `src/app/(dashboard)/cozinha/page.tsx`
- `src/app/(dashboard)/pedidos/page.tsx`
- `src/app/api/commands/route.ts`
- `src/app/api/cozinha/route.ts`
- `src/app/api/search/route.ts`
- `src/app/globals.css`
- `src/app/loading.tsx`
- `src/modules/dashboard/components/dashboard-view.tsx`
- `src/modules/dashboard/queries/workspace.repository.ts`
- `src/modules/dashboard/services/workspace.service.ts`
- `src/modules/finance/components/finance-view.tsx`
- `src/modules/fiscal/components/fiscal-import-view.tsx`
- `src/modules/fiscal/components/qr-decoder.ts`
- `src/modules/fiscal/fiscal-adapter.ts`
- `src/modules/fiscal/fiscal.rules.ts`
- `src/modules/fiscal/fiscal.service.ts`
- `src/modules/inventory/components/inventory-view.tsx`
- `src/modules/orders/components/kitchen-view.tsx`
- `src/modules/orders/components/orders-view.tsx`
- `src/modules/orders/order.rules.ts`
- `src/modules/orders/order.service.ts`
- `src/modules/purchasing/components/purchasing-view.tsx`
- `src/modules/settings/components/settings-view.tsx`
- `src/modules/suppliers/components/suppliers-view.tsx`
- `src/shared/components/app-shell.tsx`
- `src/shared/components/auth-form.tsx`
- `src/shared/components/command-form.tsx`
- `src/shared/components/confirm-dialog.tsx`
- `src/shared/components/design-system.tsx`
- `src/shared/components/display.tsx`
- `src/shared/components/financial-chart.tsx`
- `src/shared/components/global-search.tsx`
- `src/shared/components/period-filter.tsx`
- `tests/e2e/orders-fiscal.spec.ts`
- `tests/e2e/restaurant.spec.ts`
- `tests/fixtures/fiscal.ts`
- `tests/integration/orders-fiscal.test.ts`
- `tests/unit/fiscal.test.ts`
- `tests/unit/orders.test.ts`
- `tests/unit/workspace.test.ts`
