# Desempenho da navegação — 06/11/2026

## Diagnóstico em produção

Medição com Chrome/Playwright autenticado no ambiente de demonstração, uma amostra por rota, sem alterar dados de negócio. O tempo inclui rede, servidor e renderização, até o título principal aparecer. Não são médias nem garantia de tempo de resposta.

| Ação | Tempo observado |
| --- | ---: |
| Abrir Dashboard diretamente | 2,89 s |
| Abrir Estoque diretamente | 6,76 s |
| Abrir Financeiro diretamente | 3,65 s |
| Abrir Configurações diretamente | 4,04 s |
| Abrir Clientes diretamente | 1,84 s |
| Trocar para Estoque pelo menu | 1,83 s |
| Trocar para Financeiro pelo menu | 2,34 s |
| Trocar para Configurações pelo menu | 2,86 s |

Evidência local ignorada pelo Git: `.local/validation/navigation-baseline.json` e script correspondente.

O carregador compartilhado consultava conjuntos de todos os módulos a cada página: produtos, preços/histórico dos fornecedores, inventários, compras, finanças e usuários. Uma tela de estoque aguardava dados de finanças e compras que não utilizava. Nas telas com componentes cliente, esses conjuntos também eram serializados para o navegador.

Faltavam limites de carregamento dentro do layout autenticado e do segmento dinâmico compartilhado. A autenticação também podia ser consultada separadamente pelo layout e pela página durante a mesma renderização.

## Alterações locais

- Plano de recursos por página e aba, preservando o contrato de dados existente; os consumidores antigos que não informam uma rota continuam compatíveis.
- Exportação CSV utiliza o plano de relatórios.
- Indicador de carregamento existente aplicado dentro do painel e da rota dinâmica; o menu fica disponível enquanto o conteúdo é carregado.
- Autenticação deduplicada com React `cache`, restrita à renderização atual. Não há cache persistente de sessão, permissão ou dados de organizações.
- Preservados filtros de período, limites das listas existentes, busca de detalhes pelo ID e verificações de permissões/organização.

Contagem de chamadas Prisma do carregador para proprietário, verificada em testes. Não representa o total de SQL: relações podem gerar consultas adicionais; autenticação, layout e auditoria são operações separadas.

| Tela | Antes | Depois |
| --- | ---: | ---: |
| Estoque / ingredientes | 22 | 4 |
| Estoque / movimentações ou inventários | 22 | 5 |
| Compras / necessidades ou pedidos | 22 | 3 |
| Compras / listas ou cotações | 22 | 5 |
| Financeiro / lançamentos | 22 | 7 |
| Financeiro / contas a pagar | 22 | 6 |
| Financeiro / categorias | 22 | 5 |
| Relatórios | 22 | 7 |
| Configurações, antes da consulta paginada de auditoria | 22 | 4 |

## Validação

- Lint e TypeScript: aprovados.
- Build de produção com Node 24 / webpack: aprovado.
- 116 testes unitários: aprovados.
- 52 testes de integração no PostgreSQL local: aprovados.
- 12 testes de navegador, desktop e celular, usando o build de produção local: aprovados.
- Novo teste navega pelo menu e pelas abas de estoque e financeiro, confirma conteúdo, ausência de recarga do documento e ausência de transbordamento horizontal.
- Avisos já existentes de stream interrompido em navegações e de concorrência do driver pg apareceram no servidor de testes; nenhum teste falhou.

## Publicação

Alterações preparadas em `D:\Arabe Vanessa\restaurante-gestao`. Não houve commit, push ou deploy nesta investigação. Os tempos após a correção em produção ainda não foram medidos. Redução de chamadas não equivale a uma redução percentual garantida da latência; infraestrutura, rede e inicialização de funções continuam influenciando os tempos.
