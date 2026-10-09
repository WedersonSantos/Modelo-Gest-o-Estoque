# Entrega — módulo de clientes
Data: 08/10/2026. Projeto: D:\Arabe Vanessa\restaurante-gestao.

## Implementação
- Rotas /clientes, /clientes/novo e /clientes/[id], com navegação integrada ao design system existente.
- Cadastro e edição de nome, telefone, telefone normalizado, e-mail, nascimento e observações; ativação/inativação preserva o histórico.
- Busca por nome, e-mail e telefone, incluindo números formatados. Listagem e histórico paginados em 50 registros.
- Perfil com contato, consentimento, total de pedidos, pedidos finalizados, total gasto, ticket médio, primeira/última compra e histórico de itens/status.
- Total gasto, ticket médio e datas de compra consideram somente pedidos COMPLETED; a data de compra é completedAt. Total de pedidos inclui todos os estados e o histórico preserva cancelados e rascunhos.
- Telefone não é único. A conferência e o resultado do cadastro rápido avisam sobre possíveis duplicidades; o perfil também apresenta o aviso, sempre limitado à organização.
- Link de abertura do WhatsApp apenas com telefone em formato válido. A validação cobre formato de números brasileiros e formato internacional explícito; não confirma que existe conta WhatsApp.
- Consentimento de marketing separado, desmarcado por padrão, com timestamp atribuído no servidor. Edição sem mudança mantém a data; revogação limpa o consentimento atual, com alteração registrada na auditoria.
- Não existe envio automático de mensagens, campo de CPF ou campo dedicado a saúde. O formulário orienta a não registrar informações de saúde nas observações.
- Permissões: OWNER, ADMIN e OPERATOR. A API e os serviços recusam outros perfis.
- Relação opcional Order.customerId; pedidos anônimos e o nome livre continuam disponíveis. Cadastro rápido ocorre na mesma transação do pedido e faz rollback se a criação falhar. Clientes inativos não são selecionáveis para novos pedidos; histórico permanece disponível.
- CustomerAddress e relações compostas preparados para delivery futuro. Não há formulário de endereços nesta versão.
- Todas as consultas/mutações usam organizationId derivado da sessão. FKs compostas impedem vincular pedidos e endereços a clientes de outra organização, inclusive em gravação direta ao banco.

## Banco e migration
Migration aditiva: prisma/migrations/202610090001_customers/migration.sql.
Aplicada nos bancos locais restaurante e restaurante_test (127.0.0.1:55432).
A conferência prisma migrate diff entre banco local e schema retornou “No difference detected”.
A migration não remove nem converte pedidos existentes; o relacionamento novo é nulo para pedidos anteriores.
O telefone tem índice por organização, sem restrição de unicidade. Restrições SQL validam nome, formato normalizado e consistência entre consentimento e sua data.

## Resultados reais
- Lint: aprovado.
- TypeScript: aprovado.
- Testes unitários: 86 aprovados, incluindo 4 novos testes de regras de clientes.
- PostgreSQL: 27 testes de integração aprovados, incluindo 9 novos testes de clientes.
- Build de produção: aprovada, com geração do Prisma e Next.js Webpack.
- Playwright sobre a build de produção: 6 testes aprovados em desktop (1440 × 960) e celular (390 × 844), incluindo 2 execuções do novo fluxo de clientes e 4 execuções dos fluxos existentes.
- Cobertura: cadastro, edição, busca, ativação/inativação, consentimento, telefone compartilhado, WhatsApp, isolamento no serviço e em FKs, pedido com/sem cliente, cadastro rápido atômico, métricas com finalizados/rascunhos/cancelados.
- Capturas do perfil desktop e celular revisadas; nenhum transbordamento horizontal da página. Tabelas usam rolagem interna no celular.
- Os testes de navegador verificam ausência de erros JavaScript de página. No log do servidor surgiram os avisos já conhecidos de pg client.query concorrente e “destination stream closed early” em navegação; os 6 testes passaram.

Evidências locais (ignoradas pelo Git): .local/validation/customers-*.log e test-results/clientes-perfil-{desktop,celular}.png.
Os testes usam exclusivamente dados fictícios em bancos locais. Nenhum seed de clientes foi executado em produção.

## Publicação
A migration de clientes foi aplicada no Neon de produção em 08/10/2026; prisma migrate status confirmou que o banco está atualizado. A publicação usa o repositório Modelo-Gest-o-Estoque, branch main, ligado ao projeto Netlify demo-restaurante-vanessa.
Destino: https://demo-restaurante-vanessa.netlify.app/clientes. A migration foi aplicada antes da publicação do código que consulta Customer. Os valores existentes de .env foram preservados; nenhum dado fictício foi criado em produção para os testes.
