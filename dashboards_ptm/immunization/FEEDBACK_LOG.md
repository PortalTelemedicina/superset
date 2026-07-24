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

Validated against: [DOD_CHECKLIST.md](../_docs/DOD_CHECKLIST.md)

