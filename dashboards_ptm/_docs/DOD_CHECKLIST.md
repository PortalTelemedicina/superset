# DoD — Definition of Done for Dashboard Delivery
Source: `DoD (Definition of Done) - Dashboards.xlsx` (sheet 1)

## VISUAL E DESIGN SYSTEM
- [ ] **Paleta de cores corporativa** — O dashboard usa cores padrão da Portal?
  - *Rationale:* Identidade visual gera sensação de "produto oficial". Consistência de marca gera autoridade. Um dashboard que foge do manual da marca é percebido como amador ou não-oficial, reduzindo a confiança do usuário no dado.
- [ ] **Semântica de Cores (Sinalização)** — Ex: Vermelho é ruim? Verde é bom?
  - *Rationale:* Em saúde, nem sempre alto é bom. Garanta que a cor siga a lógica do indicador
- [ ] **Formatação Numérica Consistente** — A formatação dos números está consiste?
  - *Rationale:* Ex: Dinheiro tem R$ e duas casas decimais? Percentual tem o símbolo %? Inteiros (ex: qtd pacientes) estão sem casas decimais?
- [ ] **Hierarquia Visual (Regra do "F")** — Os KPIs mais importantes estão no topo esquerdo? 
Se eu dividir a tela em 4 quadrantes, o KPI mais importante está no Quadrante 1 (Superior Esquerdo)?
  - *Rationale:* Os usuários costumam ler seguindo um padrão em “F”: primeiro fazem um movimento horizontal na parte superior da página, formando a barra superior do F; depois descem um pouco e realizam uma segunda leitura horizontal, geralmente mais curta, formando a barra inferior; por fim, percorrem verticalmente o lado esquerdo do conteúdo, em um movimento mais lento ou mais rápido, criando o “tronco” do F no mapa de calor.. O canto inferir direito é conhecido como "zona morta" por ser o último lugar para o qual olhamos.
- [ ] **Fundo e Contraste** — O fundo da página é branco (#FFFFFF) ou cinza muito claro (ex: #F5F7FA)? O dashboard é legível se for impresso em uma folha A4?
  - *Rationale:* Fundo escuro em ambiente iluminado causa reflexo e fadiga ocular, além de distrair o foco da métrica. Importante reduzir a carga cognitiva para interpretação de KPIs.
- [ ] **Complexidade Visual** — Há mais de 8 visualizações na mesma aba?
  - *Rationale:* Se precisa de scroll lateral ou vertical excessivo, quebre em duas páginas/abas
- [ ] **Rótulos** — Os rótulos estão visíveis?
  - *Rationale:* Não permitir rótulos sobrepostos ou inclinados/verticais para "caber". Se não cabe, vire o gráfico (de colunas verticais para barras horizontais).
- [ ] **Ordenação Intencional ** — Como os dados estão ordenados?
  - *Rationale:* É dado temporal (Janeiro, Fevereiro...)? -> Ordem Cronológica obrigatória.
É dado categórico (Especialidades, Unidades...)? -> Ordem de Grandeza (Pareto). Do maior para o menor.
Erro comum: Ordenar alfabeticamente (Acre, Bahia...). Isso só serve se o objetivo for procurar o nome na lista, não para comparar performance.
- [ ] **Disposição dos eixos** — Os dados do eixo Y estão começando no ZERO?
  - *Rationale:* O Eixo Y DEVE começar no zero para não distorcer a realidade
- [ ] **Timeline suficientemente pequena** — A visualização do Eixo X está limitada ou filtrada (Ex: últimos 12 meses, top 10 categorias) para garantir a leitura?
  - *Rationale:* Os dados de timeline precisam estar em um período suficiente para leitura. O Eixo X deve possuir filtros/limitação de dados para evitar poluição visual.
- [ ] **Adequação do gráfico ao tipo de análise** — O gráfico facilita a visualização dos dados e a geração de insights?
  - *Rationale:* Comparar Valores? Use Barras. (Horizontais se os nomes forem longos, Verticais se forem curtos).
Mostrar Tendência ao longo do tempo? Use Linhas.
Mostrar Parte do Todo? Use Barras Empilhadas (Stacked Bar). (Só use Pizza se forem poucas categorias: Sim/Não, Masculino/Feminino).
Mostrar Distribuição (Stat)? -> Histograma ou Boxplot. (Média sozinha engana)
Mostrar um número/resposta imediata? -> Big Number (Se em dash operacional: número bruto; Se em dash gerencial: Valor agregado/comparativo entre períodos ou % de atingimento de metas)
- [ ] **Fluxo lógico (Macro > Micro)** — O dashboard segue a ordem: 1. O Quê (KPIs macro); 2. Por Quê/Como (Gráficos de Tendência/Quebras); 3. Quem/Onde (Tabelas Detalhadas)?
  - *Rationale:* O cérebro precisa entender o cenário geral antes de mergulhar nos detalhes. Começar pela tabela detalhada gera sobrecarga cognitiva imediata.
- [ ] **Agrupamento Semântico** — Gráficos que explicam o mesmo assunto estão agrupados no mesmo bloco?
  - *Rationale:* Evita a fragmentação da história. Se estou analisando "Custos", por exemplo, todos os gráficos de custo devem estar juntos.
- [ ] **Rótulos nos eixos** — Os eixos X e Y estão nomeados? 
  - *Rationale:* Os rótulos informam ao usuário exatamente o que está sendo medido em cada dimensão, fortalecendo o entendimento da análise. Sem rótulos, a visualização se torna ambígua.

## INTEGRIDADE DE DADOS (DATA QUALITY)
- [ ] **Teste de valores da modelagem** — O número total no Dashboard bate com uma query SELECT COUNT(*) ou SUM() rodada direto no banco de dados? 
  - *Rationale:* Validação matemática obrigatória. Garante que nenhum registro foi perdido durante o ETL ou filtrado incorretamente na camada de visualização
- [ ] **Testes de valores na tela** — Se houver outras visões que mostrem os mesmos dados (ou que mostrem dados semelhantes), eles estão mostrando a mesma visão? Faz sentido?
  - *Rationale:* Validação matemática obrigatória. Garante que nenhuma visão no dash mostre dados que não fazem valor ou que são redundantes.
- [ ] **Verificação de Duplicidade (Join Risk)** — Se você filtrar por um ID de atendimento específico, aparece apenas uma linha ou o valor está duplicado?
  - *Rationale:* Erros de modelagem (relações 1:N incorretas) costumam inflar os números
- [ ] **Tratamento de Nulos (NULLs)** — O gráfico quebra se vier NULL? Existe uma regra clara? (Ex: NULL vira "Não Informado" ou "0"?). "Blank" não é aceitável em visualização.
  - *Rationale:* Redução de ambiguidade. "Em branco" parece erro de sistema. Precisamos explicitar se é zero, não aplicável ou pendente, para não induzir conclusões erradas.
- [ ] **Consistência Temporal** — As datas estão no padrão brasileiro (DD/MM/AAAA) ou, ao menos, no mesmo padrão? 
A ordenação dos meses no eixo X está cronológica e não alfabética (Jan, Fev, Mar... e não Abr, Ago, Dez)?
  - *Rationale:* Padronização evita erros de leitura (05/04 vs 04/05)
A ordenação cronológica é vital para análise de tendência
A ordenação alfabética de meses (Abr, Ago...) inutiliza o gráfico.

## USABILIDADE E INTERATIVIDADE
- [ ] **Teste de Filtros Cruzados** — Ao clicar em uma barra do gráfico A, o gráfico B filtra corretamente?
  - *Rationale:* Se a interação estiver quebrada ou confusa, o usuário perde a capacidade de explorar o contexto específico
- [ ] **Tooltips Informativos** — Ao passar o mouse sobre o KPI, aparece a definição funcional?
  - *Rationale:* Explica regras de negócio complexas (ex: critérios de exclusão) sem poluir a interface visual, reduzindo chamados de dúvidas para o time de dados
- [ ] **Estado "Sem Dados"** — Se o usuário selecionar um filtro absurdo, o dash mostra uma mensagem amigável ("Sem dados para esta seleção") ou fica em branco/quebrado?
  - *Rationale:* Uma tela em branco parece um bug. Uma mensagem clara ("Sem dados para este filtro") confirma que o sistema funcionou, mas o resultado é vazio.

## SEGURANÇA E GOVERNANÇA
- [ ] **Todas as roles de acesso ao dash devem estar ajustadas** — Quem pode ter acesso a esse dash e a seus dados?
  - *Rationale:* A segurança e o acesso aos dados devem ser definidos conforme o nível de informação necessária por cada público (Gerencial, Tático, Operacional). O usuário deve ter acesso apenas aos dados e visões que são pertinentes à sua função, limitando o risco de exposição de dados sensíveis.
- [ ] **Carimbo de Data/Hora (Data Freshness)** —  Existe um texto visível: "Dados atualizados em: DD/MM/AAAA HH:MM"?
  - *Rationale:* Segurança Operacional. O gestor precisa saber se está tomando decisão com base no dado de agora ou no do fechamento de ontem (D-1).
- [ ] **Anonimização de Dados** — Nomes de pacientes estão visíveis sem necessidade?
  - *Rationale:* Se for um dash gerencial, não deve haver nomes, apenas agregados. Se for operacional, deve haver controle de acesso

## JULY 10 FEEDBACK — IMMUNIZATION V2 (pre-SME review)

- [x] **KPI dual values** — Absolute + % (or % + count) visible on coverage, overdue children, applied, overdue/due doses, cross-juris cards (`subheader_metric`). *Verified in browser 2026-07-24 after `rawFormData` fix (83.2% / 16.8% / 22.4% / 34.6% rendering).*
- [x] **Age / lifetime copy** — “Crianças ≤15 anos (histórico)” + info tooltip explaining lifetime + age cap. *On screen 2026-07-24.*
- [x] **Coverage definition** — Info text states binary “zero overdue doses / total children”.
- [x] **Pontualidade colors** — Late series is red/pink (`#D32F2F`), not dark blue. *Verified 2026-07-24 after PTM mixed-timeseries pins `label_colors`; “% Atrasadas” line added on secondary axis.*
- [x] **Heatmaps** — Coverage, severity, dropout matrices have conditional color scales; dropout NULL → N/A not 0%. *Verified 2026-07-24 after 3 fixes: formatter `column` = metric label, unicode `≥`/`≤` operators, removal of the `!important` white cell background in the PTM pivot theme.*
- [x] **UBS backlog** — Table (not bar) with count + % of municipal overdue. *On screen 2026-07-24.*
- [x] **Cross-juris** — Split tables (out-of-state by UF / in-state by município) with %. *Charts v2.29/v2.30 present; C3 shares sum to 1.0.*
- [x] **Forecast** — Pivot labeled Mês/Ano. *Title “Volumes da demanda programada (Mês/Ano)”.*
- [x] **DQ by UBS** — Chart v2.17 openable by establishment. *C5: 0 UNKNOWN CNES, 17 UBS.*
- [x] **Comparação entre municípios** — Ranking + monthly compare on national/state (not muni-only). *v2.19 (row_limit 300) + v2.32 on national layout.*
- [x] **Filters** — National has no hardcoded Cocal default; Estado/Município propagate. *Filter bar shows 26 UFs / 205 municípios, no preselection.*
- [ ] **3-muni pilot** — Cocal + Porto + Parnaíba present in gold + ranking (≥3 rows). See `PILOT_3_MUNICIPALITIES.md`. *2026-07-24: Cocal (3.477 overdue) and Parnaíba (70) in the priority mart; **Porto (220850) has no rows** — verify activation/ingestion for Porto before the SME review.*
- [x] **Dropout audit** — MenC (and peers) reviewed; see `ptm-dw-modeling/docs/immunization-dropout-audit-2026-07.md`. *C4 2026-07-24: pairing correct (MenC 2012–2025 cohorts 5–27%); residual ~100% rows come from out-of-window cohorts — registered as delta G5 in `ptm-dw-modeling/specs/imunizacao/3. tasks.md`.*
- [x] **Vaccine labels** — Technical + commercial (`vaccine_label`) on pivots after dbt seed deploy. *Extended to v2.07/v2.09/v2.11/v2.12/v2.20; rendering verified (“VIP (Pólio inativada)”, “MenACWY (Meningocócica ACWY)”).*
- [x] **Deferred** — Patient app embed / push notifications explicitly out of this round (FEEDBACK_LOG #17).
