---
name: apply-dashboard-feedback
description: >-
  Apply BI feedback documents (docx/xlsx) to existing PTM Superset dashboards.
  Builds a change matrix, edits bootstrap_via_api.py specs, re-bootstraps locally,
  validates against DOD_CHECKLIST.md, and logs changes in FEEDBACK_LOG.md. Use when
  updating an existing dashboard from stakeholder suggestions or review notes.
---

# Apply Dashboard Feedback

## When to use

User shares a feedback document (e.g. `Sugestões - Dashboard de imunização .docx`) for an existing `dashboards_ptm/<name>/` package.

## Reference docs

- [dashboards_ptm/_docs/DOD_CHECKLIST.md](../../dashboards_ptm/_docs/DOD_CHECKLIST.md)
- [dashboards_ptm/_docs/CHART_CHOICE_MATRIX.md](../../dashboards_ptm/_docs/CHART_CHOICE_MATRIX.md)
- Target package README (e.g. [dashboards_ptm/immunization/README.md](../../dashboards_ptm/immunization/README.md))

## Step 1 — Extract feedback

Use the docx extractor from [create-dashboard-from-spec](../create-dashboard-from-spec/SKILL.md).

## Step 2 — Build change matrix

| # | Suggestion | Chart key | Edit type | DoD rule |
|---|------------|-----------|-----------|----------|
| 1 | Remove KPI icons | `chart.v2.*` | params: `show_icon=False` | Visual complexity |
| 2 | Short titles + tooltip | same | `slice_name`, `description` | Tooltips informativos |
| 3 | Bar → pivot for dense data | `chart.v2.07_*` | `viz_type: ptm_pivot_table` | Adequação gráfico |
| … | | | | |

Map each item to:

- `CHARTS_V2` entry in `bootstrap_via_api.py`
- Position builders (`build_dashboard_position_v2`, `_state`, `_muni`) if layout changes
- `UUIDS` if adding/removing charts (never delete UUIDs for retired charts — use `_RETIRED_CHART_KEYS`)

## Step 3 — Implement spec edits

Common patterns (immunization reference):

```python
# KPI: clean card
{
    "key": "chart.v2.25_kpi_total_children",
    "slice_name": "Total de Crianças Atendidas",
    "description": "Crianças distintas atendidas no município…",
    "viz_type": "ptm_big_number_total",
    "params": _ptm_kpi(show_icon=False, additional_text="", extra={...}),
}

# Dense vaccine × dose → pivot
"viz_type": "ptm_pivot_table",
"params": {
    "groupbyRows": ["vaccine_name"],
    "groupbyColumns": ["dose_label"],
    "metrics": [_metric("Doses em atraso", "SUM", "overdue_count")],
    "valueFormat": ",",
    "conditional_formatting": [{"operator": ">", "targetValue": 0, "colorScheme": "#d32f2f"}],
}

# Workload → sortable table
"viz_type": "ptm_table",
"groupby": ["vaccine_name"],
"metrics": [_metric("Devidas Hoje", "SUM", "due_count"), _metric("A Vencer", "SUM", "upcoming_count")],
"show_cell_bars": True,
```

Update `ensure_chart` payload if adding fields (`description` must be top-level on chart, not inside `params`).

## Step 4 — Re-bootstrap + validate

Same loop as create-dashboard-from-spec. After visual check, export bundle:

```bash
python bootstrap_via_api.py --base-url http://localhost:8088 \
  --username admin --password admin --export
```

## Step 5 — Log feedback

Append to `dashboards_ptm/<name>/FEEDBACK_LOG.md`:

```markdown
## YYYY-MM-DD — <source document>

| Item | Change | Charts |
|------|--------|--------|
| KPI icons removed | show_icon=False | v2.25, v2.28, … |
```

Commit on feature branch with message referencing the feedback source.

## Reject or defer

If feedback conflicts with DoD or data grain, note in FEEDBACK_LOG with rationale instead of implementing blindly.
