# Arquitetura

O sistema é um monólito modular em Next.js, TypeScript e PostgreSQL. Estoque, compras, fornecedores, financeiro, configurações e dashboard têm responsabilidades próprias e interfaces públicas em `src/modules/<módulo>/index.ts`. O deploy usa o runtime Node.js; o acesso ao PostgreSQL ocorre no servidor com Prisma e o adaptador `pg`.

## Fluxo de uma alteração

```mermaid
flowchart TD
  UI[Formulário React] --> Controller[Controller HTTP]
  Controller --> Session[Sessão e origem da solicitação]
  Session --> Validation[Validação Zod]
  Validation --> Service[Service: permissão e regras]
  Service --> Repository[Repository: consultas e persistência]
  Repository --> Prisma[Prisma + adaptador pg]
  Prisma --> Database[PostgreSQL]
```

As páginas compõem telas, obtêm os dados iniciais e tratam navegação. Os componentes recebem dados serializáveis e enviam comandos; não decidem aprovação de compra, custo médio, ajuste de estoque ou pagamento. `/api/commands` autentica o responsável, verifica a origem da solicitação, valida o comando e encaminha o payload ao service. Os schemas de cada módulo validam a entrada novamente no limite do domínio, de modo que um uso do service fora da interface mantém as mesmas regras.

A rota de dashboard `[...section]` distribui os endereços de estoque, compras, fornecedores, financeiro, relatórios e configurações aos componentes de cada módulo. Isso concentra navegação sem concentrar regras de negócio. Os endereços das áreas permanecem distintos e podem evoluir para páginas separadas.

## Camadas e dependências

| Camada | Responsabilidade |
| --- | --- |
| `app/` e controllers | Sessão, entrada HTTP, navegação, composição e resposta |
| `components/` | Exibição, acessibilidade, formulários e interação |
| `schemas/` | Formatos, campos obrigatórios, precisão, limites e combinações válidas |
| `services/` | Autorizações, decisões, cálculos e coordenação de transações |
| `repositories/` | Consultas com escopo da organização, locks e persistência |
| `shared/lib/` | Prisma, transações, sessão, permissões, auditoria, datas e erros |
| PostgreSQL | Integridade referencial, precisão, restrições e preservação dos históricos |

Repositories não aprovam compras, calculam custos ou alteram regras de reposição. Services não retornam segredos de autenticação. Os módulos consumidores usam a interface pública do outro módulo, preservando a possibilidade de reorganizar seus arquivos internos.

O módulo de configurações contém operações administrativas simples de cadastro e onboarding. Seu service usa Prisma diretamente para essas operações, sem criar repositories que apenas repetiriam cada chamada. Estoque, compras e financeiro usam repositories porque possuem consultas recorrentes, locks e coordenação de várias entidades.

O dashboard possui uma camada de queries para consolidar consultas de leitura. Ela retorna dados da organização e limita históricos exibidos; o service transforma os resultados em indicadores e DTOs serializáveis. A leitura do dashboard é uma visão operacional que é atualizada após comandos. As garantias de atomicidade pertencem aos services de gravação.

As listas exibem registros recentes com limites de carregamento. Abrir um detalhe de inventário, lista de compras, cotação ou pedido usa um foco por ID, sempre acompanhado de `organizationId`, e consulta o registro diretamente sem o corte da lista recente. O detalhe de uma lista carrega todas as suas cotações para comparação. A contagem de pedidos pendentes consulta o conjunto completo, e a tela de contas a pagar inclui todos os compromissos pendentes, independentemente desses limites e do mês selecionado.

## Integração entre os módulos

```mermaid
flowchart LR
  Inventory[Estoque] -->|saldo mínimo| Requests[Necessidades e listas]
  Suppliers[Fornecedores e condições] --> Quotes[Cotações]
  Requests --> Quotes
  Quotes -->|escolha humana| Orders[Pedido e aprovação]
  Orders --> Receipt[Recebimento]
  Receipt -->|receiveStock| Inventory
  Receipt -->|histórico de preço| Suppliers
  Receipt -->|createPurchasePayable| Finance[Financeiro]
  Inventory --> Dashboard[Dashboard e relatórios]
  Finance --> Dashboard
  Orders --> Dashboard
```

`receivePurchaseOrder` inicia uma única transação e chama `receiveStock(tx, actor, input)`, `recordSupplierPrice(tx, actor, input, "PURCHASE")` e `createPurchasePayable(tx, actor, input)`. Essas funções reutilizam o mesmo cliente transacional. Uma falha em qualquer etapa desfaz recebimento, itens, movimentações, saldo, custo, histórico de preço, contas a pagar e auditoria daquele comando.

O service de estoque mantém funções puras em `stock.rules.ts` para saldo, mínimo, quantidade sugerida, diferença de inventário, valor e custo médio. Elas usam `Prisma.Decimal` e podem ser testadas sem banco ou servidor HTTP.

## Consistência e concorrência

Operações críticas usam `transaction`, em `shared/lib/transaction.ts`, com isolamento `Serializable`. Conflitos de serialização são repetidos até quatro tentativas. O callback realiza somente trabalho no banco; não envia mensagens, dispara integrações ou realiza pagamentos externos.

O estoque bloqueia a linha do ingrediente antes de decidir o novo saldo. Inventários guardam quantidade e `updatedAt` do produto na abertura, bloqueiam produtos em uma ordem estável na finalização e recusam uma contagem cujo snapshot ficou desatualizado. A abertura de inventário bloqueia a organização e impede duas contagens abertas simultaneamente.

Recebimentos possuem chave de idempotência por organização. Repetir a mesma chave com os mesmos itens retorna o recebimento anterior; mudar o payload com uma chave já usada causa conflito. Duas requisições simultâneas com a mesma chave não criam dois saldos ou duas despesas.

As migrations adicionam controles de integridade no PostgreSQL, além das validações dos services. Movimentações e outros históricos são imutáveis. A igualdade entre saldo do produto e soma de suas entradas menos saídas é validada ao final da transação. Essa restrição permite gravar saldo e movimentação em qualquer ordem dentro da mesma transação, mas rejeita divergência no commit.

## Organizações e segurança

`Actor` contém `userId`, `organizationId` e `role` obtidos da sessão. O cliente não escolhe a organização do comando. Consultas de negócio filtram `organizationId`, e relacionamentos usam chaves compostas para impedir vínculos entre organizações no próprio banco.

Senhas usam bcrypt; tokens de sessão aleatórios são guardados apenas como hash no banco. O cookie de sessão é `HttpOnly`, `SameSite=Lax` e `Secure` em produção. Login e cadastro têm limitação de tentativas persistida no banco. Mutações HTTP verificam a origem antes de executar comandos.

Permissões são verificadas no servidor. Ocultar uma ação na interface melhora a experiência, mas não substitui a verificação no service. OWNER e ADMIN administram o sistema; BUYER cuida de pesquisa e pedidos; OPERATOR registra estoque e recebimentos; VIEWER consulta. As permissões detalhadas estão em `business-rules.md`.

O JSON enviado ao cliente contém valores decimais como strings. Nenhum cálculo monetário depende de `Number` ou `Float`. Datas de filtros de negócio são interpretadas no fuso `America/Sao_Paulo`; timestamps persistidos representam instantes.

## Testes

Testes unitários exercitam cálculos, validações, permissões e decisões dos services. `tests/integration/workflow.test.ts` executa os services reais contra PostgreSQL, cobrindo o ciclo operacional, recebimentos parciais, concorrência, idempotência, rollback, isolamento entre organizações e as restrições do banco.

O banco local `restaurante_test` é separado de `restaurante`. Cada execução cria organizações com nomes e e-mails únicos. Os dados dessas organizações permanecem no banco de testes porque seus históricos são imutáveis; a base de demonstração é preservada. Para apagar uma base de testes, recrie o banco inteiro por um procedimento explícito de desenvolvimento, sem enfraquecer os controles da aplicação.

Uma conexão remota de testes exige `TEST_DATABASE_URL`. As migrations precisam ser aplicadas nessa conexão antes da suíte de integração. Para a configuração local, use:

```powershell
$env:TEST_DATABASE_URL = "postgresql://restaurante:restaurante_local@127.0.0.1:55432/restaurante_test?schema=public"
$env:DATABASE_URL = $env:TEST_DATABASE_URL
$env:DIRECT_URL = $env:TEST_DATABASE_URL
npm run db:deploy
npm run test:integration
```

Depois de executar, abra outro terminal para continuar usando as URLs do `.env` do aplicativo.

## Deploy e evolução

Vercel pode hospedar o Next.js, e qualquer PostgreSQL compatível pode persistir os dados. `DATABASE_URL` configura o runtime; `DIRECT_URL` permite uma conexão direta para migrations quando o runtime utiliza pool. Migrations são executadas como etapa controlada de deploy; o seed fictício não é executado automaticamente em produção.

Integrações futuras deverão chamar interfaces de módulos ou adicionar adapters próprios. Se mensagens externas forem acrescentadas, use uma fila ou outbox gravada na transação e processada depois do commit. Folha, pagamentos automáticos, fiscal, PDV e integrações bancárias permanecem no roadmap.
