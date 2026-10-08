# Gestão do restaurante
<!-- impeccable:product-schema 1 -->
## Platform
web
## Stack
Next.js, TypeScript, PostgreSQL, Prisma, Tailwind, shadcn/ui e Zod conforme pedido.
## Users
Família que administra restaurante árabe, comprador e operadores, frequentemente pelo celular.
## Product Purpose
Responder quanto entrou e saiu, quanto há em estoque, o que comprar, de quem comprar e quanto foi consumido.
## Operating Context
Mesmo estoque para restaurante e eventos. Inventário inicial estabelece o saldo. Compras recebidas atualizam estoque, custo médio e contas a pagar em uma transação.
## Capabilities and Constraints
V1: estoque, inventários, fornecedores, preços, cotações, pedidos, recebimentos, financeiro gerencial, relatórios, papéis e auditoria. Pedidos de atendimento e cozinha com perfil KITCHEN; importação fiscal conferida via XML/entrada manual e identificação por QR/chave. Sem integração bancária, pagamentos automáticos, folha ou consulta automática SEFAZ. Dados demonstrativos são fictícios.
## Product Principles
Simplicidade; histórico preservado; decimais; isolamento por organização; decisões comerciais humanas.
## Open Decisions
Nome comercial: Casa Anatolia. Paleta, navegação e hierarquia definidas no briefing de redesign. MenuItem é separado de Product; pedidos não baixam ingredientes nem lançam receita sem ficha técnica ou pagamento.
