# Pilot 3 municípios — Cocal + Porto + Parnaíba (July 10)

Runbook to enable ranking / comparação histórica with **three** municipalities
before the immunization SME review. Do **not** scale to all 224 yet.

| Município | IBGE-7 | IBGE-6 (pipeline) | UF |
|-----------|--------|-------------------|----|
| **Cocal** | `2202703` | `220270` | PI |
| **Porto** | `2208502` | `220850` | PI |
| **Parnaíba** | `2207704` | `220770` | PI |

Confirm names↔IBGE in Django — never swap Cocal (`220270`) with Porto (`220850`).
See [pilot-municipalities-ibge.md](../../../airflow-custom-image/docs/reference/pilot-municipalities-ibge.md)
in `airflow-custom-image` (path may vary by clone layout).

## Steps (ops — requires human / Airflow access)

### 1. Geography + activation (Django `child-immunization`)

For each of the three IBGEs:

1. `/admin/geography/municipality/` — name + IBGE-7 correct
2. `/admin/activation/municipalityactivation/` — `environment=prod`, `status` in
   (`staging`, `active`)

### 2. Sync registry → BigQuery

```text
Trigger: imm_sync_activation_registry  (manual on onboard)
Then:    imm_reconcile_rls (if scheduled after registry asset)
```

Verify:

```sql
SELECT ibge_code, municipality_name, state_code, status
FROM `ptm-data-prod.governance.municipality_activation`
WHERE environment = 'prod'
  AND status IN ('staging', 'active')
ORDER BY municipality_name;
```

Expect rows for Cocal, Porto, Parnaíba.

### 3. Pipeline (do not manually fire mid-chain)

```text
Trigger: imm_ingest_immunization_records
→ imm_ingest_patient_demographics
→ imm_dbt_build_address
→ imm_enrich_address_geolocation
→ imm_dbt_build_gold_immunization   (--vars municipality_codes from registry)
```

Optional local/dbt dry-run after data is in BQ:

```bash
dbt build --select path:models/gold/immunization \
  --vars '{"municipality_codes":["220270","220850","220770"],"municipality_filter_required":true}'
```

### 4. Superset bootstrap

```bash
cd dashboards_ptm/immunization
# local
python bootstrap_via_api.py --version v2
python bootstrap_via_api.py --version per-muni   # optional dedicated slugs
# or prod
./apply_bi_feedback.sh
```

### 5. Smoke checks

- National v2: clear municipality filter → ranking shows **≥3** rows
- Section “Comparação entre municípios” (v2.06 + v2.32) populated
- Filter Cocal / Porto / Parnaíba one at a time — KPIs non-empty
- Run [validation_queries.sql](validation_queries.sql) sections 10–12 (July 10)

## Status

| Step | Owner | Status |
|------|-------|--------|
| Django activation ×3 | Ops | **Pending human** |
| Registry sync + ingest + gold | Airflow | **Pending human** |
| As-code dashboard (July 10 charts) | Eng | Done on `feature/immunization-july10-feedback` |
| Bootstrap apply (local/prod) | Eng | After gold has 3 munis |

## Notes

- Ingest cadence is every **6 hours** once activated.
- Empty registry → gold DAG raises `RuntimeError`.
- Patient / app vision remains **deferred** (see FEEDBACK_LOG #17).
