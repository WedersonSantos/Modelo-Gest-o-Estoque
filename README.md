# Mesa — Gestão operacional e financeira

V1 funcional para restaurante familiar: estoque → lista → cotação → aprovação → pedido → recebimento → conta a pagar. Nome e dados de demonstração fictícios. Interface em português, responsiva, com isolamento entre organizações.

## Stack
Next.js 16.3.8, React 19.3.0, TypeScript 6.0.3, PostgreSQL, Prisma 7.10.0, Tailwind 4.3.3, componentes locais no padrão shadcn/ui (Button/Input), Radix e Zod 4.6.5. As versões são reproduzidas pelo package-lock.json. O TypeScript 6 mantém compatibilidade com as ferramentas de análise do projeto. Prisma 8 estava em release candidate; a V1 usa a versão estável 7. O wrapper `embedded-postgres` é uma ferramenta opcional e somente de desenvolvimento, publicado pelo mantenedor com etiqueta beta; o deploy usa PostgreSQL externo e `pg` estável.

## Executar localmente
Requer Node.js 24 LTS e npm. Clone o repositório e execute os comandos na raiz da aplicação:

```powershell
git clone https://github.com/WedersonSantos/Modelo-Gest-o-Estoque.git
cd Modelo-Gest-o-Estoque
```

A pasta clonada já contém o package.json na raiz:

```powershell
npm ci
Copy-Item .env.example .env
npm run db:local
```

Deixe o banco aberto. Em outro terminal:

```powershell
npm run db:deploy
npm run db:seed
npm run dev
```

Abra http://127.0.0.1:3000. O banco local persiste em `.local/postgres`; também cria `restaurante_test` para integração. Encerre com Ctrl+C. Pode substituir o banco embutido por qualquer PostgreSQL compatível e ajustar as URLs. Não use as senhas locais em produção.

## Demonstração e primeiro acesso
Após o seed, entre com `admin@exemplo.com` / `Demo@123456`. O seed inclui 9 ingredientes, 3 fornecedores, preços históricos, inventário, consumos, cotações, pedidos e lançamentos fictícios. Só executa com `ALLOW_DEMO_SEED=true` e recusa ambiente de produção. Não redefine dados de uma demonstração existente.

Para dados próprios, use **Criar restaurante**. A conta inicial é proprietária; as categorias básicas são criadas automaticamente. Cadastre a equipe, os ingredientes e os mínimos/ideais; faça inventário físico inicial. Estoque inicial não tem custo estimado: informe as próximas compras para formar o custo médio.

## Variáveis
`DATABASE_URL`: conexão PostgreSQL do runtime, inclusive URL com pool. `DIRECT_URL`: conexão direta para migrations, sem transaction pooler. `APP_URL`: origem exata da aplicação, usada na proteção contra requisições entre sites. `ALLOW_DEMO_SEED`: autorização para inserir dados fictícios. Segredos permanecem no servidor; `.env` não é versionado. Veja [.env.example](.env.example).

## Migrations e testes
```powershell
npm run db:generate
npm run db:migrate -- --name minha_alteracao
npm run lint
npm run typecheck
npm test
npm run test:integration
npx playwright install chromium
npm run test:e2e
npm run build
```

Integração usa `restaurante_test` por padrão ou `TEST_DATABASE_URL`. Aplique as migrations nele antes de rodar; veja [setup](docs/setup.md). Testes de integração exercitam transações, concorrência, isolamento e invariantes em PostgreSQL real. Não remova os históricos: organizações de teste têm nomes únicos e são preservadas no banco de testes. E2E cria um restaurante isolado pela interface e percorre o fluxo completo. Capturas ficam em `test-results/`.

## Arquitetura e modelo
Monólito modular: interface → controller → Zod → service → repository → Prisma → PostgreSQL. Services concentram decisões e transações; páginas não importam Prisma. Repositories concentram consultas. Módulos expõem `index.ts`. O controller de comandos usa sessão, origem, payload e autorização; nenhum `organizationId` recebido do navegador define o escopo.

Rotas operacionais usam um compositor comum em `src/app/(dashboard)/[...section]/page.tsx`, evitando páginas repetidas. Formulários e tabelas estão separados nos componentes dos módulos. Estoque, valores e totais usam Decimal no servidor; conversão para número na UI serve apenas à apresentação. Há recebimentos parciais idempotentes, histórico imutável e triggers de consistência do saldo.

Veja [arquitetura](docs/architecture.md), [modelo e ERD](docs/database-model.md), [regras](docs/business-rules.md), [instalação e deploy](docs/setup.md), [roadmap](docs/roadmap.md) e [relatório de entrega](docs/delivery.md).

## Deploy
Repositório na Vercel, preset Next.js, raiz do repositório (sem subpasta), Node 24 LTS e PostgreSQL em Supabase, Neon ou equivalente. Configure URLs e APP_URL HTTPS; aplique `npm run db:deploy` em etapa de release, execute `npm run build` e publique. Nunca rode migrations ou seed a cada requisição. Banco embutido e seed não participam do deploy. A sessão usa cookie Secure em produção.

## Limites da V1
Sem integrações externas, automação de pagamentos, folha, PDV, fiscal ou custo dos pratos. Escolha de fornecedor é humana e exige motivo e atendimento da lista inteira. A V1 permite separar ingredientes em listas distintas antes de cotar; distribuir uma mesma lista automaticamente entre cotações fica no roadmap. Frete entra na despesa da compra, não no custo médio do ingrediente. Contas de compras vencem no recebimento; condições textuais não são interpretadas automaticamente. A interface mostra as últimas 100 movimentações/pedidos/cotações, 30 inventários, 40 listas e 200 lançamentos do período; contas a pagar incluem todos os compromissos pendentes. Os agregados financeiros e consumo consideram todos os registros correspondentes. Listas antigas e inventários fora desses limites devem ganhar paginação em evolução.
