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
