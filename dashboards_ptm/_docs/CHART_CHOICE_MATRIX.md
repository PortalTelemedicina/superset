# Chart Choice Matrix
Source: `DoD (Definition of Done) - Dashboards.xlsx` (sheet 2)

## COMPOSIÇÃO (PARTE DO TODO)
| Goal | Chart type | Questions | Action | Rules |
|------|------------|-----------|--------|-------|
| A proporção de um todo (100%) | Pizza/ Rosca | Se reprovar em qualquer item: Converta para Barras. Se aprovar: Use Rosca com o Total no centro. | ❌Se for, por exemplo: "Top 5 motivos", não pode ser pizza, pois a soma não é o todo |  |
- • Tem menos de 4 categorias? ❌Pizza com 10 fatias é ruído, não informação.
✅ Prefira gráfico de barras
- • A diferença entre as fatias é óbvia a olho nu? ❌ O cérebro humano tem dificuldade de comparar ângulos e áreas 
✅ O cérebro humano é melhor em comparar comprimentos (barras).
| Composição / Parte-do-Todo | Barras empilhadas | Use Barras Empilhadas 100% (para ver % da fatia no todo)  | ❌Não usar se houver muitas categorias pequenas, pois os segmentos ficam inlegíveis.
✅  Permite comparar a evolução da composição e estrutura ao longo dos meses. |  |
- • Queremos ver como o total mudou ao longo do tempo de acordo com a composição interna? Use Barras Empilhadas Normais (para ver fatia no volume total)

## TENDÊNCIA E EVOLUÇÃO
| Goal | Chart type | Questions | Action | Rules |
|------|------------|-----------|--------|-------|
| Evolução temporal | Linhas ou áreas | Use gráfico de linhas (foco no comportamento/tendência) ou de área (foco no volume) | 
❌Barras quebram a continuidade visual necessária para entender tendências.
✅ O olho humano detecta inclinação (slope) instantaneamente para entender velocidade de mudança. 
 |  |
- • Queremos ver a tendência/velocidade de mudança? Use gráfico de linhas
- • Queremos ver o volume (magnitude acumulada)? Use gráfico de área
- • Tem muitas categorias entrelaçadas? Use vários gráficos pequenos lado a lado

## DESTAQUE E CORRELAÇÃO
| Goal | Chart type | Questions | Action | Rules |
|------|------------|-----------|--------|-------|
| Número imediato | KPI Único (Big Number) | Destaque o número grande e coloque um contexto menor abaixo | ❌ Um número solto não conta história nenhuma. A história surge no Delta de valores. Sem contexto, não há julgamento de valores (bom/ruim)
❌ Em um dashboard gerencial de tendências, o Big Number não serve para dizer "quanto é agora" (isso é operacional). Ele serve para ancorar a análise.
✅ Para dasboards operacionais ou boletins mensais: O foco está em ações imediatas. Por isso, um número absoluto do mês ou acumulado basta para "gerar ações"; 
✅ Para dasboards gerenciais (estratégicos): O foco está no diagnóstico e na tendência. Por isso, o número deve trazer contexto e só pode estar em um dash gerencial se: 1. Mostra um valor mensal agregado ou; 2. Mostrar um comparativo entre 2 períodos ou;  3. Mostrar um indicador de atingimento de meta) |  |
| Correlação | Dispersão / Scatter Plot | Adicione uma linha de tendência se houver correlação estatística | ❌ Exige alto letramento de dados. Muitos gestores têm dificuldade de interpretar dois eixos numéricos simultâneos (X vs Y) sem ajuda
❌ Sensibilidade a Outliers: Um único ponto extremo (ex: um custo de 1 milhão quando a média é 100 reais) "esmaga" todos os outros pontos num canto do gráfico, tornando a análise impossível sem zoom ou escala logarítmica.
✅ É a única forma visual de validar hipóteses de causalidade ou agrupamento (clusters) sem usar tabelas gigantes |  |

## COMPARAÇÃO E RANKING
| Goal | Chart type | Questions | Action | Rules |
|------|------------|-----------|--------|-------|
| Dado "bruto", linha a linha | Tabelas e Matrizes | Use Tabela e, sempre que possível, adicione "Barras de Dados" ou "Mapa de Calor" nas colunas numéricas | ❌Tabelas puras são difíceis de escanerar
✅ Elementos visuais dentro da tabela (Data Bars) ajudam o olho a encontrar os maiores valores sem ler número por número |  |
| Comparação entre categorias | Barras | Use Barras Horizontais | ❌ Em colunas verticais, se os nomes forem longos, eles ficam inclinados ou cortados (dificulta a leitura)
✅ A leitura ocidental é da esquerda para a direita. Rótulos na horizontal evitam que o usuário precise inclinar a cabeça para ler |  |
- • A ordem importa? Ordene sempre por valor (do maior para o menor), nunca alfabético (salvo se for lista de busca)
|   | • São muitas categorias? | ❌Se plotamos muitas barras em um mesmo gráfico, não conseguimos gerar insights, apenas ruído. Não tem como, visualmente, compreender e comparar os dados |  |  |
