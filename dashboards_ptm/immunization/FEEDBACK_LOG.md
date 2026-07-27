# Immunization Dashboard — BI Feedback Log

## 2026-06-12 — Sugestões - Dashboard de imunização .docx

Source: stakeholder UX review (less-is-more KPI cards, dense charts → tables).

| # | Suggestion | Change | Charts affected |
|---|------------|--------|-----------------|
| 1 | Remove KPI icons; short titles; tooltips | `show_icon=False`, `description` on chart, empty `additional_text` | v2.25, v2.28, v2.21, v2.27, v2.26, v2.03, v2.01, v2.02, v2.29, v2.31 |
| 1b | Keep alert icon on out-of-state card | `show_icon=True` + AlertTriangle | v2.30 |
| 2 | vaccine_name in Portuguese | Already native in gold marts | v2.09, tables/pivots |
| 3 | Integer data labels (no "k") | `y_axis_format: ",d"` on timeliness | v2.08 |
| 4 | Backlog by vaccine × dose → matrix | `ptm_pivot_table` | v2.07 |
| 5 | Workload → sortable table | `ptm_table` with cell bars, default sort Devidas Hoje | v2.11 |
| 6 | Severity distribution → matrix | `ptm_pivot_table` + `overdue_bucket_label` calc col | v2.12 |
| 7 | Demanda: line + pivot | Line trend (attended) + pivot volumes (resident) | v2.23, v2.24 |
| 8 | Dropout → matrix with color scale | `ptm_pivot_table` + conditional formatting | v2.14 |

Validated against: [DOD_CHECKLIST.md](../_docs/DOD_CHECKLIST.md)

## 2026-06-12 — Follow-up round (visual validation)

| # | Issue | Change | Charts affected |
|---|-------|--------|-----------------|
| 1 | KPI cards rendered with no visible title (additional_text was emptied) | Short PT title now set in `additional_text` (PTM card caption); long explanation stays in `description` tooltip | all v2 big numbers (v2.01–v2.05, v2.18, v2.21, v2.25–v2.31) |
| 2 | One warning icon remained (ShieldAlert on DQ card) | Icon removed; only the sanctioned AlertTriangle on "Residentes Fora do Estado" remains. Also removed generic RefreshCw/MapPin icons | v2.05, v2.04, v2.18 |
| 3 | "Tendência da demanda programada" unreadable with ~20 vaccine lines | Series limit = 5 (top vaccines by volume), data labels removed; Vacina native filter narrows further; exact volumes in v2.24 pivot | v2.23 |

## 2026-06-15 — Follow-up (info tooltips on KPI cards)

| # | Issue | Change | Charts affected |
|---|-------|--------|-----------------|
| 1 | KPI explanations existed in `description` but were invisible (PTM cards hide native header) | Added `info_text` param + info (i) icon tooltip in PTM big-number plugin; auto-wired from `description` in bootstrap | all PTM big-number cards (v2.01–v2.05, v2.18, v2.21, v2.25–v2.31, chart.01) |
| 2 | Out-of-state card keeps sanctioned AlertTriangle | No change to `show_icon=True` on v2.30; info icon added alongside | v2.30 |

Validated against: [DOD_CHECKLIST.md](../_docs/DOD_CHECKLIST.md)

## 2026-07-10 — Dashboard de imunização (apresentação Meira / Almeida)

Source: stakeholder walkthrough transcription + Gemini summary. Full next-round package before immunization SME review.

| # | Suggestion | Change | Charts / models affected |
|---|------------|--------|--------------------------|
| 1 | Filters estado / município (not hardcoded Cocal on national) | National default municipality cleared; scoped muni slug keeps Cocal; `state_name` aliases verified | native filters v2 |
| 2 | Clarify crianças atendidas (≤15a, histórico) | Titles/descriptions: “Crianças ≤15 anos (histórico)” | v2.25, v2.28 |
| 3 | Absolute + % on KPIs | `subheader_metric` on PTM big-number + share metrics in gold/bootstrap | v2.01–03, v2.21, v2.25–31 |
| 4 | Support text for binary coverage | Stronger `info_text` / description | v2.27 |
| 5 | Heatmaps coverage / severity / dropout | Richer conditional formatting color scales | v2.09, v2.12, v2.14 |
| 6 | Late series pink/red + % on pontualidade | Color override + late/on-time % metrics | v2.08 |
| 7 | Vaccine technical + commercial name | `vaccine_commercial_name` seed → `vaccine_label` in gold | pivots/tables using vaccine_name |
| 8 | UBS backlog → table | `ptm_table` with count + % | v2.10 |
| 9 | Cross-juris % of total attended | Share metrics on KPIs | v2.21, v2.29–31 |
| 10 | Split out-of-state vs in-state tables | Two `ptm_table`s replace stacked bar | v2.22a, v2.22b |
| 11 | Forecast table mês/ano labels | Slice/column rename + month format | v2.24 |
| 12 | Dropout audit; blanks → N/A or 0%; heatmap | Model: `adherence_rate`, `is_applicable_pair`; matrix NA/0% + green/red | dropout v2 + v2.14 |
| 13 | DQ deep-dive by UBS | `establishment_cnes/name` on suspicious + DQ daily; new table | v2.17 |
| 14 | Ranking + comparação histórica mensal | New section on national/state layouts | v2.06 enhanced + v2.32 |
| 15 | Pilot 3 municipalities | Cocal + Porto + Parnaíba activation runbook | ops / Airflow |
| 16 | Double-check data congruence | Extended `validation_queries.sql` + DoD | docs |
| 17 | Patient / app vision | **Deferred** — backlog only this round | docs |

Pilot municipalities: Cocal `220270`, Porto `220850`, Parnaíba `220770`.

Validated against: [DOD_CHECKLIST.md](../_docs/DOD_CHECKLIST.md)

## 2026-07-24 — Local validation round (render verification of the July 10 package)

Browser validation against local stack + `dbt_gold` exposed items that were
configured but never rendered. Root causes and fixes:

| # | Issue found | Root cause | Fix |
|---|-------------|-----------|-----|
| 1 | KPI %/absolute subheader never rendered (July 10 row 3) | PTM plugin `transformProps` read `subheader_metric` (snake_case) from the camelized `formData` | Read from `rawFormData` (same source `buildQuery` uses) |
| 2 | Heatmap cell colors never rendered on ANY pivot (July 10 rows 5/12) | Three stacked causes: (a) `conditional_formatting.column` referenced auto-generated metric names (`SUM(col)`) instead of the custom labels; (b) PTM pivot theme forced `background-color: #ffffff !important` on every cell, overriding the formatter's inline style; (c) `>=`/`<=` operators are `≥`/`≤` (unicode) in Superset's Comparator enum, so those rules were ignored | Formatter `column` now matches the metric label; removed the `!important` cell background from `Styles.tsx`; unicode operators; rules reordered least→most severe because the renderer lets the LAST matching rule win |
| 3 | "Atrasadas" series still blue (July 10 row 6) | Shared color map does not reliably apply `label_colors` to mixed-timeseries inside dashboards | PTM mixed-timeseries wrapper now pins `label_colors` directly on ECharts series (`itemStyle`/`lineStyle`) |
| 4 | Pontualidade had no % (July 10 row 6 was logged as done but only counts were plotted) | — | v2.08: counts as bars (Query A) + "% Atrasadas" line on secondary axis (Query B, `.1%`), denominator consistent with v2.32 |
| 5 | Rankings truncated (Meira: "o gestor estadual quer todos", not top-N) | `row_limit` 50 (v2.06) / 200 (v2.19) < 224 municípios do PI | `row_limit: 300` on both |
| 6 | `vaccine_label` (técnico + comercial) only on dropout charts | — | Extended to v2.07/v2.09/v2.11/v2.12/v2.20 (backlog mart exposes it); forecast mart has no `vaccine_label` yet, v2.23/v2.24 keep `vaccine_name` |
| 7 | "Moradores do Município" KPI had no % context | — | New `own_municipality_children_pct` dataset metric as subheader |
| 8 | Update frequency not stated anywhere | — | "atualizada automaticamente a cada 6 horas" on the RNDS freshness card description |
| 9 | Dashboard crash `Cannot read properties of undefined (reading 'start_offset')` | `Dashboard.onVisibilityChange` assumed a hidden event was always captured first | Guard + reset in `Dashboard.jsx` (upstream Superset bug) |

### Consistency sweep C1-C8 (2026-07-24, against `ptm-data-prod.dbt_gold`)

| Check | Result |
|-------|--------|
| C1 schema naming | FIXED — all 17 refs in `validation_queries.sql` now `dbt_gold.` |
| C2 denominators | PASS — snapshot 2026-07-24: 24,616 rows, 205 munis, 19 vaccines; 0 coverage cells outside [0,1] |
| C3 cross-juris shares | PASS — origin shares sum to exactly 1.0 per municipality |
| C4 dropout truth | PARTIAL — pairing fix holds (MenC 2012–2025 cohorts: 5–27%, no warning). NEW audit item G5: cohorts 2003–2009 (adolescent/catch-up dose, D2 never applicable) and 2026 (D2 not yet due) show ~100% with N≥30, bypassing `denominator_warning`. Registered in `ptm-dw-modeling/specs/imunizacao/3. tasks.md`. MenACWY is absent from the dropout mart (no pairable child-routine series) — expected |
| C5 DQ by UBS | PASS — 0 UNKNOWN `establishment_cnes`, 17 distinct UBS |
| C6 filter propagation | PASS — 0 null `state_name` on DQ / dropout / timeliness |
| C7 dedup grain | PASS — 0 duplicate groups on backlog full grain and DQ reason grain |
| C8 cross-chart reconciliation | PASS — total overdue 4,669 identical across KPI, vaccine×dose pivot and UBS groupings; matches on-screen KPI |

Validated against: [DOD_CHECKLIST.md](../_docs/DOD_CHECKLIST.md)

## 2026-07-27 — Reabertura do item de 12/jun (legibilidade de séries categóricas)

The 2026-06-12 round logged "Tendência da demanda programada unreadable with ~20
vaccine lines" as closed by capping the chart at the top-5 series. Revisiting the
rendered chart shows the underlying complaint — readability — was never resolved:
the PTM plugin wrapper (`applyColorPalette`) discards Superset's `color_scheme`
and defaults every chart to the six-shade **blue** ramp, so the surviving 5
vaccine lines are near-identical blues. Charts that set `color_scheme` explicitly
(`supersetColors`, `d3Category20`) were silently overridden.

| # | Issue | Change | Charts affected |
|---|-------|--------|-----------------|
| 1 | Top-5 vaccine lines indistinguishable (blue ramp) — 12/jun item 3 only half-fixed | Opt into the existing `mixed` ("Multicolorido") PTM palette via `_PTM_MULTI_HUE` | v2.23 |
| 2 | 2-series DQ chart: "Dose duplicada no mesmo dia" invisible behind "Dose aplicada antes da idade mínima" | idem | v2.15 |
| 3 | Same defect, not previously reported: monthly doses by vaccine, and a monochrome dropout pie | idem | chart.04, chart.08 |

Any PTM chart with a `groupby` needs `_PTM_MULTI_HUE`; the blue ramp is only safe
for single-series charts.

Found while verifying the above: the "Última atualização da RNDS" card rendered
the mart's UTC timestamp verbatim (`15:42` while the wall clock read `14:0x`), so
a freshness indicator was showing a time in the future. The metric now wraps the
aggregate in `DATETIME(…, 'America/Sao_Paulo')`. The d3 formatter renders the
epoch as UTC, so no second shift occurs.

> **Deployment gap:** `bootstrap_via_api.py` writes dataset metrics only when it
> *creates* the dataset — changing an `expression` in the spec never reaches an
> existing dataset. The local instance was patched over the API
> (`PUT /api/v1/dataset/<id>` with the full `metrics` array). **Production still
> renders the UTC timestamp** until the same patch is applied there.

DoD: "Paleta de cores corporativa" and "Semântica de Cores" stay **unchecked** —
`mixed` restores series differentiation but whether it matches the Portal brand
manual is a design ruling, not an engineering one.

## 2026-07-27 — Células vazias: cor enganosa e rótulo ambíguo

Two defects around cells with no value, both surfaced by the dropout matrix. They
live in frontend code shared beyond immunization, so the blast radius was measured
against a production export before choosing how to fix each one.

**1. Conditional formatting painted empty cells with the best colour.** The
relational operators in `getColorFunction` coerce `null`/`undefined` to `0`, so a
rule like "≤ 5% is green" matched every blank cell — a missing measurement read as
the best possible result. The guard now returns no colour for `null`, `undefined`,
`''` and `NaN`, while a real `0` is still coloured.

This lives in `superset-ui-chart-controls`, consumed by Table, Pivot Table, AG Grid
Table, Big Number Total and the PTM Big Number — **1,330 production charts use
conditional formatting**, mostly outside immunization. The fix was kept global on
purpose: painting an absent value is wrong everywhere. Covered by four assertions
in `getColorFormatters.test.ts`.

**2. The `N/A` placeholder is now opt-in per chart.** It started as unconditional
CSS in the PTM pivot theme, which would have reached **all 35 production charts of
viz type `ptm_pivot_table` — only 13 of them immunization**. The other 22 belong to
Telediagnóstico and Teleconsulta (`TD_mediana_cliente`, `TD_tabela_cliente_mes`,
`TC_desfechos_clinico2`, `HC_hora`, …), where a blank cell means "no volume in the
period", not "not applicable". Labelling those `N/A` would change the meaning of a
client-facing number.

The placeholder is now the `ptm_empty_cell_label` control (blank by default), and
only the dropout matrix sets it to `N/A` — the one chart where blank genuinely
means the dose pair is absent from the calendar or the base is under 30 children.

> **Deployment gap:** both fixes are frontend, so they need an image rebuild to
> reach production. Applying `bootstrap_via_api.py` alone propagates the
> `ptm_empty_cell_label` param but renders nothing until the build ships.

