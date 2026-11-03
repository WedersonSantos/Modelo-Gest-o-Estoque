# Auditoria legível
A tela de Configurações apresenta ações e tipos de registro em português, data e hora de São Paulo e nomes dos cadastros relacionados.
Exemplos: ORGANIZATION_RENAMED → Nome do restaurante alterado; DEMO_ORDER_CREATED → Pedido de demonstração criado; PAID → Pagamento registrado.
Pedidos de atendimento usam seu número; compras/cotações/recebimentos identificam o fornecedor; movimentações mostram o ingrediente; lançamentos financeiros mostram a descrição.
A referência completa, o tipo original e o código da ação continuam disponíveis em “Referência técnica”.
Não há migration, regravação nem exclusão dos eventos existentes. O limite permanece em 50 ações; empates de data possuem ordenação estável por identificador.
Quando o evento possui nome salvo nos detalhes, esse nome histórico é preferido. Renomeações usam o nome de destino salvo no evento. Para registros antigos sem snapshot, a tela resolve o nome atual do cadastro. Se ele não existir ou estiver fora da organização, exibe somente o tipo em português e a referência técnica. A apresentação não inventa nomes nem afirma que um nome atual é um snapshot histórico.
A resolução dos nomes usa consultas agrupadas por tipo de registro, com organizationId obrigatório, apenas na tela de Configurações. OWNER/ADMIN preservam o acesso à auditoria; os outros perfis continuam bloqueados.
Códigos futuros sem tradução apresentam “Ação registrada” e “Registro”, com o código original nos detalhes.
Validação: lint, TypeScript e build aprovados; 98 testes unitários, 46 de integração PostgreSQL e 10 de navegador aprovados. Novos testes cobrem traduções, snapshot, fallback, data/hora, referências ausentes, isolamento multi-tenant, RBAC e preservação dos eventos.
Evidências locais: .local/validation/audit-labels-*.log e test-results/auditoria-{desktop,celular}.png.
Os avisos preexistentes do servidor sobre stream interrompido em navegação e pg client.query concorrente permaneceram no log. As asserções de ausência de erros JavaScript na página passaram.
