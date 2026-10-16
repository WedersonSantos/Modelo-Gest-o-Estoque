# Entrega — origem dos ingredientes e funcionários
Data: 16/10/2026. Projeto: D:\Arabe Vanessa\restaurante-gestao.

## Origem e abastecimento
Product recebeu originType (NATIONAL/IMPORTED), countryOfOrigin, supplierCountry opcional, purchaseCurrency, averageLeadTimeDays e originNotes.
Os produtos existentes recebem NATIONAL e BRL como padrões de compatibilidade; não são inferidos países, prazos nem procedências reais.
A tela de estoque possui badges Nacional/Importado, filtro por origem, país de origem, países dos fornecedores, moeda e prazo. O cadastro permite editar e limpar os metadados opcionais.
Supplier recebeu country editável no cadastro. O país do fornecedor não é tratado como país de origem do ingrediente.
supplierCountry do produto é uma informação manual opcional; quando vazio, a tela deriva os países dos fornecedores ativos vinculados. Vários países são listados, sem escolher um arbitrariamente. O valor derivado não é gravado no produto.
Exemplo validado: Tahine, origem Lebanon, fornecedor Brazil, moeda USD e prazo de 30 dias.
A API interna listInventory aceita filtro originType; listagem e busca respeitam organizationId.

## Compatibilidade e arquitetura futura
Saldo, unidade, custo médio, estoque mínimo, estoque ideal, inventários, recebimentos e sugestões atuais mantêm as regras anteriores.
Payloads antigos de edição que omitem campos novos preservam seus valores existentes.
averageLeadTimeDays fica disponível para alertas antecipados futuros; ainda não substitui o estoque mínimo nem gera alertas por prazo. Isso requer modelar consumo esperado e cobertura de estoque antes de ativar uma regra nova.
purchaseCurrency é metadado descritivo; os lançamentos atuais continuam na moeda operacional existente. Não há conversão cambial implícita.
O módulo acquisition-cost.ts fornece uma composição isolada de mercadoria, frete, taxas adicionais e custos de importação, com decimais. Todos os componentes devem estar na mesma moeda. O cálculo não é conectado aos recebimentos atuais, não grava dados e não altera custos de estoque.
Uma integração futura deverá fornecer câmbio explícito e rateio entre itens antes de usar o total no custo de aquisição.

## Funcionários
Rotas: /funcionarios, /funcionarios/novo, /funcionarios/[id] e /funcionarios/funcoes.
Cadastro, edição, ativação/inativação, pesquisa por nome/telefone/e-mail, filtros por função/setor/situação, paginação e perfil.
Employee contém os campos solicitados e userId opcional; JobRole contém nome, descrição e timestamps por organização. Funções podem ser cadastradas e editadas.
Responsabilidades aceitam várias linhas, exibidas individualmente no perfil.
A tela de funções apresenta os exemplos solicitados para orientar o administrador, sem criar registros automaticamente.
Menu administrativo, badges Ativo/Inativo, estados vazios, feedback de erro e salvamento, loading padronizado e telas responsivas.
Mantidos os componentes compartilhados e a paleta do design system atual.

## Acesso e isolamento
Gestão de funcionários e funções disponível somente para OWNER/ADMIN em serviços, páginas, API de consulta e comandos de escrita.
Employee e User são entidades separadas. Cadastrar funcionário não cria usuário, não copia permissões e não exige conta.
O vínculo é com uma conta existente da mesma organização; uma conta pode estar vinculada a apenas um funcionário.
Alterar cargo, responsabilidades, vínculo ou atividade do Employee não muda User.role, User.active nem sessões.
As permissões continuam sendo administradas em Configurações. Inativar Employee não bloqueia login de um User vinculado; isso é informado na tela.
KITCHEN mantém acesso à cozinha sem acesso administrativo/financeiro; BUYER mantém o acesso existente a estoque, compras e fornecedores.
Consultas e mutações de Employee/JobRole usam organizationId. FKs compostas impedem vincular função ou User de outro restaurante, inclusive em gravações diretas ao banco.
Opções e perfis de contas expõem apenas nome, e-mail, papel, situação e identificador, sem hashes.

## Migration e validação real
Migration aditiva: prisma/migrations/202610150001_origin_employees/migration.sql.
Aplicada somente em restaurante e restaurante_test locais. Prisma migrate diff retornou “No difference detected”.
Checks SQL validam prazo não negativo/limitado, formato de moeda e nomes de funcionário/função.
- Lint: aprovado.
- TypeScript: aprovado.
- Build de produção: aprovada.
- Unitários: 92 aprovados (6 novos).
- Integração PostgreSQL: 42 aprovados (15 novos).
- Playwright: 8 aprovados em desktop 1440×960 e celular 390×844, incluindo os fluxos anteriores.
- Detector visual da skill Impeccable: sem achados.
- Capturas de listagem/perfil de funcionários e origem no estoque revisadas em desktop e celular; tabelas possuem rolagem interna e não há transbordamento horizontal da página.
- Testes novos verificam cadastro, edição, atividade, funções, vínculo opcional, funcionário sem User, permissões, SQL e serviço multi-tenant, origem nacional/importada, países, filtros, edição antiga e preservação do estoque mínimo.
Os logs do servidor mantiveram os avisos preexistentes de pg client.query concorrente e “destination stream closed early” em navegações. Todos os testes passaram e os novos fluxos verificam ausência de erros JavaScript na página.

Evidências ignoradas pelo Git: .local/validation/origin-employees-*.log, .local/validation/origin-employees-design.json e capturas test-results/funcionarios-*.png e origem-estoque-*.png.
Todos os testes usaram dados fictícios em bancos locais.

## Publicação
O build de publicação do projeto do disco D foi executado novamente e aprovado. A migration 202610150001_origin_employees foi aplicada no Neon de produção em 16/10/2026; prisma migrate status confirmou que o banco está atualizado.
Publicação pela integração do GitHub (Modelo-Gest-o-Estoque, branch main) com o Netlify demo-restaurante-vanessa. A migration foi aplicada antes do código novo. O build Webpack e a configuração Node 24 foram mantidos. Destinos: https://demo-restaurante-vanessa.netlify.app/funcionarios e /estoque/produtos.
As variáveis de ambiente, registros de negócio existentes, paleta e permissões foram preservados. Produtos existentes recebem os padrões NATIONAL/BRL previstos na migration. Nenhum funcionário, função ou dado fictício foi cadastrado em produção nesta publicação.
