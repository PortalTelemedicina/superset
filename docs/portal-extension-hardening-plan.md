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

# Portal Extension Hardening – Plano de Mudanças e Validação

Este documento descreve o plano de mudanças por arquivo e as observações de risco/validação para as melhorias aplicadas ao fork Superset (extensão Portal + PTM).

---

## 1. Plano de mudanças por arquivo

### 1.1 Substituição de react-beautiful-dnd por @hello-pangea/dnd

| Arquivo | Mudança |
|---------|---------|
| `superset-frontend/package.json` | Remover `react-beautiful-dnd` e `@types/react-beautiful-dnd`; adicionar `@hello-pangea/dnd` (ex.: ^16.6.0). |
| `superset-frontend/package-lock.json` | Gerado por `npm install` após alterar `package.json`. |
| `superset-frontend/src/extensions/portal/dashboard/header/components/HeaderSlotEditor.tsx` | Trocar import de `react-beautiful-dnd` para `@hello-pangea/dnd`; manter `DragDropContext`, `Droppable`, `Draggable` e `onDragEnd` (API compatível). |

### 1.2 Tipagem: trigger retorna ReactNode

| Arquivo | Mudança |
|---------|---------|
| `superset-frontend/packages/superset-ui-core/src/ui-overrides/types.ts` | Alterar `'dashboard.sliceHeaderControls.trigger': (...) => ReactElement \| null` para `(...) => ReactNode`. |
| `superset-frontend/packages/superset-ui-core/src/ui-overrides/ExtensionsRegistry.ts` | Guard do trigger já aceita ReactNode (string/number/boolean/element); validação permanece. |
| `superset-frontend/src/dashboard/components/SliceHeaderControls/index.tsx` | Nenhuma alteração necessária; uso de `extensionTriggerNode ?? <VerticalDotsTrigger />` já é compatível com ReactNode. |

### 1.3 Refatoração do guard: mapa de validators

| Arquivo | Mudança |
|---------|---------|
| `superset-frontend/packages/superset-ui-core/src/ui-overrides/ExtensionsRegistry.ts` | Introduzir `validators: Partial<Record<keyof Extensions, (value: unknown) => unknown \| null>>` com funções por chave (`validateHeaderReplacement`, `validateSliceHeaderControlsTrigger`, `validateCssTransform`, `validateSliceHeaderControlsClassNames`). `guardExtensionOverride` passa a chamar `validators[key]` quando existir; senão retorna `value`. Comportamento e `console.error` mantidos. |

### 1.4 Tokens de tema centralizados (getThemeTokens)

| Arquivo | Mudança |
|---------|---------|
| `superset-frontend/src/extensions/portal/shared/themeTokens.ts` | **Novo.** `getThemeTokens(theme)` retorna objeto com tokens (sizeUnit, fontSizeSM, colorText, colorTextSecondary, colorBgContainer, colorBorder, colorPrimary, etc.) com fallbacks para tema legado (gridUnit, colors.grayscale, typography). |
| `superset-frontend/src/extensions/portal/dashboard/header/components/HeaderSlotEditor.tsx` | Importar `getThemeTokens`; em styled components trocar `(theme as any).xxx` por `getThemeTokens(theme).xxx`. |
| `superset-frontend/src/extensions/portal/dashboard/header/components/SlotRenderer.tsx` | Idem: importar `getThemeTokens` e substituir `(theme as any).xxx`. |
| `superset-frontend/src/extensions/portal/dashboard/header/components/CustomizableHeader.tsx` | Idem: importar `getThemeTokens` e usar em `HeaderContainer`. |
| `superset-frontend/plugins/superset-plugin-chart-echarts-ptm/src/themeTokens.ts` | **Novo.** Cópia do helper para o plugin (evita dependência do plugin em `src/extensions`). |
| `superset-frontend/plugins/superset-plugin-chart-echarts-ptm/src/plugin/table/PtmTableChart.tsx` | `const tok = useMemo(() => getThemeTokens(theme), [theme])` e substituir todos `(theme as any).xxx` por `tok.xxx`; adicionar `tok` nas dependências de `useCallback` onde aplicável. |
| `superset-frontend/plugins/superset-plugin-chart-echarts-ptm/src/plugin/table/Styles.tsx` | Em `styled.div` usar `getThemeTokens(theme)` dentro do callback e substituir `(theme as any).fontFamily` por `tok.fontFamily`. |
| `superset-frontend/plugins/superset-plugin-chart-echarts-ptm/src/SupersetPluginChartEchartsPtm.tsx` | Usar `getThemeTokens(theme)` nos styled (colorBgContainer, sizeUnit, borderRadiusLG). |
| `superset-frontend/plugins/superset-plugin-chart-echarts-ptm/src/plugin/bignumber/BigNumberViz.tsx` | Importar `getThemeTokens`; no styled usar `const tok = getThemeTokens(theme); return \`...\`` e substituir todos `(theme as any).xxx` por `tok.xxx`. |

### 1.5 CSS: line-height na PTM table

| Arquivo | Mudança |
|---------|---------|
| `superset-frontend/src/assets/stylesheets/ptm-dashboard.css` | Em `[data-test-viz-type='ptm_table'] .ptm-dt-search-input` alterar `line-height: 40px` para `line-height: 1.4` (valor proporcional que evita altura excessiva e mantém alinhamento). |

### 1.6 ID determinístico (evitar Math.random)

| Arquivo | Mudança |
|---------|---------|
| `superset-frontend/plugins/superset-plugin-chart-echarts-ptm/src/plugin/table/PtmDataTable.tsx` | Adicionar contador no módulo `let ptmDtIdSeq = 0;` e trocar `useRef(\`ptm-dt-${Math.random().toString(36).slice(2)}\`)` por `useRef(\`ptm-dt-${++ptmDtIdSeq}\`)`. ID estável por mount e adequado para SSR futuro. |

### 1.7 Limpeza final

| Arquivo | Mudança |
|---------|---------|
| `superset-frontend/package.json` | Conferir remoção de `react-beautiful-dnd` e `@types/react-beautiful-dnd` e presença de `@hello-pangea/dnd`. |
| `superset-frontend/package-lock.json` | Rodar `npm install` na raiz do frontend. |
| Testes | Rodar `npm run type` e testes afetados (ex.: `Header.test.tsx`, testes do ExtensionsRegistry se houver). |

---

## 2. Observações de risco e validação manual

### 2.1 react-beautiful-dnd → @hello-pangea/dnd

- **Risco:** Comportamento diferente em edge cases (animação, a11y, teclado).
- **Validação:**  
  - Com `PORTAL_EXTENSION_ENABLED=true`, abrir um dashboard em modo edição e abrir o editor de slots do header.  
  - Arrastar itens da lista (drag & drop), reordenar, soltar em outra posição.  
  - Confirmar que a ordem persiste após salvar e que não há erros no console.  
  - Testar com múltiplas instâncias do editor (ex.: dois dashboards em abas) para garantir que o contexto de dnd não conflita.

### 2.2 Tipo ReactNode no trigger

- **Risco:** Extensões que retornam string/number podem alterar levemente o layout (wrap em nó de texto).  
- **Validação:** Com extensão que registra `dashboard.sliceHeaderControls.trigger` (ex.: PTM retornando um botão/ReactNode), verificar que o controle customizado (ex.: “Ações”) continua a aparecer e que o menu 3-dots continua funcionando.

### 2.3 Validators map no ExtensionsRegistry

- **Risco:** Regressão na validação (aceitar valor inválido ou rejeitar válido).  
- **Validação:**  
  - Com flag ON, carregar dashboard com header/filterbar customizados e verificar que tudo renderiza.  
  - No console, disparar (via devtools) um `set` inválido (ex.: string onde se espera componente) e confirmar que `console.error` aparece e o valor não é registrado.

### 2.4 getThemeTokens e remoção de (theme as any)

- **Risco:** Fallbacks diferentes do tema legado podem mudar cores/espaçamentos em temas antigos.  
- **Validação:**  
  - Comparar visualmente header customizado, filterbar horizontal e um chart PTM (tabela + big number) antes e depois.  
  - Garantir que tema claro padrão e, se existir, tema escuro continuem coerentes.

### 2.5 line-height no .ptm-dt-search-input

- **Risco:** Input de busca da PTM table ficar cortado ou desalinhado.  
- **Validação:** Abrir um dashboard com chart PTM table; verificar o campo de busca (altura, alinhamento vertical do texto e ícone). Ajustar para padding no container se precisar de altura maior em vez de line-height.

### 2.6 ID determinístico no PtmDataTable

- **Risco:** Múltiplas tabelas na mesma página com mesmo id (se o contador for compartilhado e o id usado em mais de um lugar de forma incorreta).  
- **Validação:** Dashboard com 2+ charts PTM table na mesma página; inspecionar o input de busca global e confirmar que cada um tem id único (`ptm-dt-1`, `ptm-dt-2`, …) e que a busca continua funcionando por tabela.

### 2.7 Checklist pós-aplicação

- [ ] `npm install` em `superset-frontend` (sem erros).  
- [ ] `npm run type` sem erros.  
- [ ] Testes relevantes passando (ex.: `Header.test.tsx`, testes de extensão se houver).  
- [ ] Feature flag OFF: extensão não carrega; metadata de extensão é stripada no backend.  
- [ ] Feature flag ON: extensão carrega; header customizado, filterbar horizontal e slice controls (trigger/classNames) funcionam sem regressão.

---

## 3. Smoke tests rápidos

1. **Flag OFF:** Carregar dashboard; header e filterbar devem ser os padrões do Superset; nenhum recurso do Portal visível.  
2. **Flag ON – Header:** Editar layout do header; adicionar/remover/reordenar slots; salvar e recarregar; conferir persistência.  
3. **Flag ON – Filterbar:** Filtrar por um filtro nativo; aplicar; limpar; layout horizontal e estilos PTM devem permanecer.  
4. **Flag ON – Slice controls:** Em um chart PTM table, abrir o 3-dots e o trigger customizado (ex.: Ações); comportamento esperado sem erros.  
5. **PTM table:** Busca global, ordenação, paginação e estilos da tabela e do input de busca devem permanecer iguais.
