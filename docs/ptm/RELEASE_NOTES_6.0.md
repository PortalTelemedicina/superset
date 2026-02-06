<!--
Licensed to the Apache Software Foundation (ASF) under one
or more contributor license agreements.  See the NOTICE file
distributed with this work for additional information
regarding copyright ownership.  The ASF licenses this file
to you under the Apache License, Version 2.0 (the
"License"); you may not use this file except in compliance
with the License.  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing,
software distributed under the License is distributed on an
"AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, either express or implied.  See the License for the
specific language governing permissions and limitations
under the License.
-->

# Release Notes — upgrade/6.0 (PTM/Portal)

Versão voltada para quem usa o Superset no dia a dia. Baseado nos commits desde `b96b2305183de5426eab13b7b7841ddc948d3510`.

---

## Novos layouts e customizações

### Novo layout para customização do header

- Layout mais flexível para adaptar título, ações e identidade visual do dashboard.
- Metadados `headerLayout` / `portal_header_layout` permitem personalizar o cabeçalho por dashboard.

### Nova visão horizontal da barra de filtros

- Barra de filtros em layout horizontal, ideal para telas largas.
- Melhor organização e leitura dos filtros nativos.

---

## Melhorias visuais

### Bordas arredondadas em barras empilhadas (stacked bar)

- Gráficos de barras empilhadas passam a ter bordas arredondadas por padrão.
- Visual mais moderno e consistente com o tema PTM.

### Estrutura padronizada de Big Number e Big Number com Trendline

- Big Number e Big Number com Trendline seguem a mesma estrutura visual e de comportamento.
- Experiência unificada entre as duas variantes.

---

## Novas visualizações PTM

- **Mixed Timeseries (PTM)**: gráfico de séries temporais mistas com múltiplas séries e tipos.
- **Pivot Table (PTM)**: tabela dinâmica com estilização PTM e controles de formatação.

---

## Controles de formatação e personalização

### Estrutura de capitalização de texto

- **Eixo (axis)**: padronização de capitalização nos rótulos do eixo (nenhum, MAIÚSCULAS, minúsculas, Title Case).
- **Legenda**: capitalização nos itens da legenda.
- **Tabela**: capitalização em cabeçalhos e células (Table / Pivot Table PTM).

### Controle de ícones e background no Big Number

- **Ícones**: exibir ícone no card, com escolha de ícone (Lucide), tamanho e cor.
- **Background do ícone**: cor de fundo do container do ícone (hex).
- Disponível em Big Number e Big Number com Trendline (layout PTM).

---

## Indicador de confiabilidade de dados

- Novo indicador visual que sinaliza a confiabilidade dos dados exibidos.
- Ícones informativos (info, warning, alert) com mensagem configurável.
- Ajuda o usuário a interpretar a qualidade dos dados do gráfico.

---

## Controle de estilo por TAG

- **TAG PTM**: dashboards com a tag "PTM" recebem automaticamente o tema visual PTM (`ptm-dashboard.css`).
- Permite aplicar estilos específicos apenas aos painéis marcados.
- Não é necessário editar CSS manualmente por dashboard quando a tag está ativa.

---

## Correções e estabilidade

- **Redução de flash de CSS ao aplicar filtros**: melhora na estabilidade visual ao alterar filtros.
- **Integração consistente dos plugins PTM**: gráficos PTM aparecem de forma integrada nos presets de visualização.

---

## Atenção — Impacto em customizações CSS

**Mudança significativa nos tokens e classes do Ant Design**

Muitos painéis podem perder suas customizações CSS anteriores. A migração para tokens semânticos do Ant Design alterou nomes de variáveis e classes, o que pode quebrar regras CSS customizadas que dependiam de valores antigos.

**Recomendação**

- Revisar dashboards que usam CSS customizado (campo "CSS" nas propriedades).
- Ajustar regras que referenciam tokens legados (ex.: `colors.grayscale`, `gridUnit`) para os novos tokens (ex.: `colorText`, `colorBgContainer`, `sizeUnit`).
- Consultar a documentação de theming e o arquivo `ptm-dashboard.css` para exemplos de tokens atuais.

---

## Resumo rápido (Slack / Teams)

Use este resumo para comunicar o release ao time:

1. **Layouts**: novo header customizável e barra de filtros horizontal.
2. **Visual**: bordas arredondadas em barras empilhadas; Big Number e Big Number com Trendline padronizados.
3. **Novos gráficos**: Mixed Timeseries PTM e Pivot Table PTM.
4. **Formatação**: capitalização de eixo, legenda e tabela; ícones e background no Big Number.
5. **Indicador de confiabilidade** nos gráficos e TAG "PTM" para controle de estilo.
6. **Atenção**: customizações CSS podem quebrar devido à mudança nos tokens e classes do Ant Design — revisar painéis com CSS próprio.
