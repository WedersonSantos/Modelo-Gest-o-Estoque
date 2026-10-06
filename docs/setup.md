# Instalação e publicação

## Desenvolvimento
Node 24 LTS. O diretório raiz da aplicação é `restaurante-gestao`. Execute `npm ci`, copie `.env.example` para `.env`, inicie `npm run db:local` e mantenha esse terminal aberto. O PostgreSQL local usa somente loopback, porta 55432, autenticação SCRAM e dados persistentes em `.local/postgres`. `embedded-postgres` é um wrapper de desenvolvimento; não faz parte da infraestrutura de produção.

Em outro terminal rode `npm run db:deploy`, `npm run db:seed`, `npm run dev`. Abra http://127.0.0.1:3000. O host da URL deve coincidir exatamente com `APP_URL`; cookies e proteção de origem usam essa informação. Não troque 127.0.0.1 por localhost sem atualizar APP_URL. PostgreSQL externo também pode ser usado localmente: nesse caso não execute db:local.

## Banco e migrations
`prisma/schema.prisma` define o modelo. `prisma/migrations` inclui o SQL inicial e invariantes: quantidades/valores não negativos, chaves compostas de organização, imutabilidade do histórico e verificação diferida da soma do saldo. Os triggers fazem parte da migration; `prisma db push` não os instala. Prefira migrations. `npm run db:migrate -- --name descricao` cria a próxima; revise o SQL antes de produção.

`DATABASE_URL` atende o runtime. `DIRECT_URL` é conexão direta de migrations (o config usa DATABASE_URL se não houver DIRECT_URL). Supabase: conexão direta ou session pooler para CLI, conexão adequada à aplicação serverless para runtime. Neon: runtime pode usar pool e CLI URL sem pool. Preserve parâmetros de TLS que o provedor exige. Não coloque URLs em variáveis NEXT_PUBLIC.

## Testes
`npm test` executa regras unitárias, permissões e schemas. Para testes reais do banco local:

```powershell
node scripts/db-test-prepare.mjs
npm run test:integration
```

Usa `TEST_DATABASE_URL` ou o banco `restaurante_test` no host local. A URL de testes deve apontar para banco dedicado. Fixtures usam organizações UUID e preservam históricos. Para UI: `npx playwright install chromium`, depois `npm run test:e2e`; a configuração inicia o servidor ou reutiliza um já disponível. O teste cria sua própria organização pela interface. Não é necessário disponibilizar senhas reais.

Verificação de entrega: `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:integration`, `npm run test:e2e`, `npm run build`. Não aplique seed em banco real. Os dados da demonstração são fictícios e o seed não remove dados.

## Vercel e PostgreSQL gerenciado
1. Envie o projeto para um repositório de sua escolha e conecte na Vercel. Configure Root Directory `restaurante-gestao` se o repositório contiver a pasta pai.
2. Selecione Next.js e Node 24 LTS; comando build `npm run build`. `npm ci` executa `prisma generate`; o build também o executa.
3. Crie banco PostgreSQL no provedor de sua escolha. Configure DATABASE_URL, DIRECT_URL e APP_URL HTTPS do domínio publicado. Não habilite ALLOW_DEMO_SEED.
4. Em ambiente de release com as variáveis, aplique `npm run db:deploy` antes de publicar a nova versão. Use uma única execução por release. Não use `migrate dev` em produção.
5. Publique e crie a organização inicial via `/cadastro`. Confira login, leitura e escrita, incluindo um recebimento de teste em organização separada. Nunca reutilize os usuários fictícios em produção.

O código usa o driver PostgreSQL padrão, sem SDK de provedor. O deploy requer banco externo: arquivos locais e PostgreSQL embutido não são suportados na Vercel. Cookie Secure é obrigatório em produção; use HTTPS. Para domínio de preview, configure APP_URL daquele ambiente. Cada ambiente deve possuir seu próprio banco e variáveis.

## Operação
Configure backups no provedor, teste restauração e monitore erros e conexões. Mantenha Node e dependências atualizados. Recuperação de senha por e-mail e convites estão no roadmap; na V1 o administrador cria os usuários na própria organização. Revogação de sessões ocorre no logout; sessões expiram em 7 dias e usuário inativo perde acesso imediatamente. Não há pagamentos externos ou automação bancária.


## Atualização de 06/10/2026 — Neon

O banco gerenciado Neon foi configurado e validado. Veja o [relatório de configuração Neon](neon-setup.md) com todas as alterações e resultados atuais.
