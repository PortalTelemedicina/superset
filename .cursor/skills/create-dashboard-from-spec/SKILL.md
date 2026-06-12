---
name: create-dashboard-from-spec
description: >-
  Scaffold PTM Superset dashboards from a requirements document (docx/xlsx/md).
  Validates chart choices against CHART_CHOICE_MATRIX.md and delivery against
  DOD_CHECKLIST.md. Use when creating a new dashboard from a spec, DoD, or
  requirements spreadsheet.
---

# Create Dashboard From Spec

## When to use

User provides a dashboard requirements document and wants a new `dashboards_ptm/<name>/` package with bootstrap scripts and bundle.

## Reference docs (read first)

- [dashboards_ptm/_docs/DOD_CHECKLIST.md](../../dashboards_ptm/_docs/DOD_CHECKLIST.md)
- [dashboards_ptm/_docs/CHART_CHOICE_MATRIX.md](../../dashboards_ptm/_docs/CHART_CHOICE_MATRIX.md)
- Template: [dashboards_ptm/immunization/](../../dashboards_ptm/immunization/) (`bootstrap_via_api.py`, `generate_bundle.py`, `bundle/`, `README.md`)

## Step 1 — Extract requirements

Binary docs cannot be read directly. Extract text from repo root or user path:

```bash
# docx
python3 -c "
import zipfile, re
with zipfile.ZipFile('SPEC.docx') as z:
    xml = z.read('word/document.xml').decode()
for p in re.split(r'</w:p>', xml):
    t = ''.join(re.findall(r'<w:t[^>]*>([^<]*)</w:t>', p)).strip()
    if t: print(t)
"

# xlsx (shared strings + sheets)
python3 dashboards_ptm/_docs/scripts/extract_xlsx.py 'DoD (Definition of Done) - Dashboards.xlsx'
```

Build a spec table: section | indicator | grain | dataset/mart | viz type | filters.

## Step 2 — Map to data + validate chart choice

1. Identify BigQuery gold marts in `ptm-dw-modeling/models/gold/`.
2. For each indicator, pick `viz_type` using `CHART_CHOICE_MATRIX.md`:
   - Dense cross-tabs → `ptm_pivot_table`
   - Operational line-by-line → `ptm_table` with cell bars
   - Trend over time → `ptm_echarts_timeseries` + `ptm_series_type: line`
   - Single operational KPI → `ptm_big_number_total` (no icons, short title, tooltip in `description`)
   - Pie only if sum=100% and fewer than 4 categories; otherwise bars or table
3. Record rejections (e.g. "stacked bar with 8 dose types → pivot table").

## Step 3 — Scaffold package

Create `dashboards_ptm/<slug>/`:

| File | Purpose |
|------|---------|
| `bootstrap_via_api.py` | Idempotent REST bootstrap; stable UUIDs in `UUIDS` |
| `generate_bundle.py` | Sync `bundle/` from in-code specs |
| `README.md` | Local-first workflow |
| `bundle/` | Importable YAML (metadata, databases, datasets, charts, dashboards) |

Copy patterns from immunization:

- `CHARTS_V2`-style list of dicts: `key`, `slice_name`, `description`, `viz_type`, `dataset_key`, `params`
- `_ptm_kpi(show_icon=False, additional_text="")` + business text in chart `description`
- Position builders: markdown section headers (`MD::## …`), KPI row first, tables last (Macro → Micro)

## Step 4 — Local validation loop

```bash
cd superset-portal/superset
docker-compose up -d
curl -sf http://localhost:8088/health

cd dashboards_ptm/<slug>
python bootstrap_via_api.py \
  --base-url http://localhost:8088 \
  --username admin --password admin \
  --database-name ptm-data-prod --schema gold
```

Open dashboard in browser. Walk [DOD_CHECKLIST.md](../../dashboards_ptm/_docs/DOD_CHECKLIST.md) and mark pass/fail.

Export live state:

```bash
python bootstrap_via_api.py --base-url http://localhost:8088 \
  --username admin --password admin --export
```

Commit on a feature branch (`feature/<slug>-dashboard`). Never merge automatically.

## Output checklist

- [ ] Every chart has stable UUID in `UUIDS`
- [ ] Every chart choice justified against chart matrix
- [ ] DoD checklist reviewed on local instance
- [ ] `bundle/` updated and committed
- [ ] README documents bootstrap + export commands
