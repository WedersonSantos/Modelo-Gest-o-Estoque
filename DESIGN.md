# Design system Casa Anatolia

Modo: Operate. Usuários de pequenos restaurantes consultam a operação durante o atendimento, em computadores, tablets na cozinha e celulares sob iluminação intensa.

A direção foi definida pelo briefing: software comercial claro, compacto e sóbrio. Sidebar verde escuro (#154E37), superfícies brancas, fundo #F4F6F5, primário #176347 e hover #0F4E36. Os tokens CSS centralizam a paleta obrigatória; status utilizam sucesso #256143/#E9F3ED, alerta #8A5B13/#FBF0DA e crítico #A32920/#FFF1EF.

Tipografia equivalente à Inter: Segoe UI e fontes nativas sem download, corpo 14px, títulos 28–32px, KPIs 24–32px. Espaçamento em múltiplos de quatro, bordas discretas, cantos de 14px. Sidebar desktop de 248px, drawer modal acessível abaixo de 1024px, KPIs em duas colunas e uma em telas estreitas. Tabelas preservam leitura por rolagem horizontal; nenhum dado fictício é usado em gráficos operacionais.

Dashboard: receitas recebidas, despesas pagas, compras recebidas e resultado; gráfico real por data de pagamento e estoque em atenção. O saldo de caixa permanece disponível. A cozinha usa três colunas e ações touch de pelo menos 52px, polling de quatro segundos, sem substituir a lista durante carregamento.

Componentes compartilhados: PageHeader, StatCard, StatusBadge/Badge, DataTable/Table, EmptyState/Empty, ConfirmDialog, FilterBar, SearchInput, SectionCard/Panel, FormSection, MoneyValue, QuantityValue, DateRangeFilter/PeriodFilter, LoadingSkeleton e AppShell/Sidebar/MobileNavigation.

Ações irreversíveis ou que alteram saldo pedem confirmação local. Os preços e dados financeiros ficam fora da API da cozinha. Importação fiscal sempre passa por conferência e conversão de unidade explícita. A interface exibe falhas em linguagem simples, com foco visível e respeito a prefers-reduced-motion.
