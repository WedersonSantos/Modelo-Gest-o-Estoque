# Auditoria legível, paginada e filtrável
Atualização: 03/11/2026.

A Configuração exibe ações e tipos em português, data/hora de São Paulo, nomes de registros e referências técnicas completas em detalhes recolhidos.
A lista usa 10 registros por página e uma área de rolagem limitada. A navegação atualiza apenas o painel, sem redirecionar a página ou voltar ao topo das configurações. A entrada das páginas usa animação breve, desativada com prefers-reduced-motion.
O histórico completo pode ser consultado com Anterior/Próxima. O rodapé mostra quantidade, intervalo visível e página atual.
Filtros: data inicial e final, inclusive o dia final inteiro, com limites à meia-noite brasileira (UTC−03:00, igual aos filtros operacionais atuais). Aceita intervalos abertos, valida datas reais/ordem e volta à primeira página ao filtrar/limpar. Paginar mantém o período aplicado.
Sem resultados, loading, falha de consulta e retry têm feedback no painel. A consulta GET /api/audit é privada, sem cache, e exige OWNER/ADMIN.
A auditoria deixou de carregar os 50 eventos globais junto com os dados de todas as páginas. Apenas o painel de Configurações e sua API consultam os eventos paginados. Consultas de nomes são agrupadas por tipo e restritas por organizationId.

## Responsável, perfil e funcionário
Além do nome do usuário, o painel mostra o perfil de acesso (Proprietário, Administrador, Comprador, Operador, Consulta ou Cozinha) e o nome do Employee vinculado, se existir.
Cargo e Employee não definem permissões automaticamente.
A partir desta versão, o helper audit salva actorRole e actorEmployeeName na própria transação da operação. Alterações posteriores do perfil, nome ou vínculo do funcionário não reescrevem esses snapshots.
Eventos sem snapshot exibem o perfil e vínculo atuais, explicitamente identificados como atuais/não salvos na operação. Não se inventa qual era o perfil histórico.
A migration 202611030001_audit_actor_snapshot adiciona colunas nullable, sem backfill e sem modificar eventos antigos. Aplicada nos bancos locais e no Neon antes da publicação; Prisma confirmou banco atualizado.

## Preservação e isolamento
Nome salvo no evento tem prioridade. Renomeações usam o destino salvo. Na ausência de snapshot de nome, usa o cadastro atual dentro da organização; se ausente, exibe tipo traduzido e referência completa.
Códigos originais, identificadores e detalhes não são apagados, traduzidos no banco ou truncados.
A paginação tem ordenação estável (data e identificador decrescentes). Total e página são consultados na mesma transação; páginas fora do total são ajustadas para a última disponível.
Todas as consultas usam a organização da sessão; dados de outros restaurantes e perfis não autorizados permanecem bloqueados.

## Validação
Lint, TypeScript e build aprovados.
102 testes unitários e 52 de integração PostgreSQL aprovados.
10 testes Playwright aprovados em desktop e celular, incluindo filtros, paginação, scroll preservado, perfis, vínculo com funcionário, intervalo vazio, limpeza, rolagem limitada e bloqueio da API para KITCHEN.
Prisma migrate diff local: “No difference detected”. Detector Impeccable: sem achados.
Avisos preexistentes de pg client.query concorrente e stream encerrado em navegação permaneceram no servidor. As asserções de ausência de erros JavaScript no navegador passaram.
Evidências locais ignoradas pelo Git: .local/validation/audit-pagination-*.log e test-results/auditoria-{desktop,celular}.png.
Dados de teste permaneceram nos bancos locais; nenhum dado fictício foi inserido em produção nesta entrega.
