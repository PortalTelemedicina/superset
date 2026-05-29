# Onboarding de novo município — imunização

Checklist para ativar um município piloto (testado com **Parnaíba/PI — IBGE 220770**).

## Pré-requisitos

- Merge do `ptm-dw-modeling` (#478+) em produção com marts `dbt_gold`.
- DAG `imm_dbt_build_gold_immunization` reativado (ou run manual de gold).
- Acesso ao Django admin do `child-immunization` **ou** permissão de escrita em
  `ptm-data-prod.governance.municipality_activation`.

## Passos

### 1. Registrar o município (fonte da verdade)

**Opção A — Django admin (recomendado em produção)**

1. `child-immunization` → Admin → `activation_municipalityactivation`
2. Nova linha: IBGE-6, UF, `status` = `staging` ou `active`
3. Aguardar `imm_sync_activation_registry` (horário) ou disparar manualmente

**Opção B — BigQuery direto (teste rápido)**

```sql
INSERT INTO `ptm-data-prod.governance.municipality_activation`
  (municipality_code, state_code, municipality_name, environment, status,
   activated_at, notes, created_at, updated_at, synced_at)
VALUES
  ('220770', 'PI', 'Parnaíba', 'prod', 'staging', CURRENT_TIMESTAMP(),
   'Onboarding test', CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP());
```

### 2. Ingestão RNDS + dbt gold

1. Disparar `imm_ingest_immunization_records` (Airflow) — lê IBGEs ativos via `_naming.get_municipality_codes()`
2. Cadeia downstream: demographics → address → `imm_dbt_build_gold_immunization`
3. Validar em BigQuery:

```sql
SELECT municipality_code, SUM(overdue_count) AS overdue
FROM `ptm-data-prod.dbt_gold.gold_immunization_operational_backlog_daily`
WHERE municipality_code = '220770'
GROUP BY 1;
```

### 3. Dashboard Superset per-muni

```bash
cd dashboards_ptm/immunization
./apply_bi_feedback.sh superset dbt_gold
```

O script `patch_bi_feedback_inpod.py` cria/atualiza:

- `gestao-imunizacao-municipio-{IBGE}` com filtros Estado + Município pré-selecionados
- Charts compartilhados (UUID estável) + layout municipal (gráficos full-width)

URL esperada:

`https://superset.sosportal.com.br/superset/dashboard/gestao-imunizacao-municipio-220770/`

### 4. Validar visualmente

- KPI “Doses em atraso” coerente com query BQ
- Filtro Município = Parnaíba aplicado
- Rótulos PT-BR nas tabelas (colunas com `verbose_name`)
- Gráficos com rótulos de dados (`show_value`)

## Resultado do teste Parnaíba (2026-05-29)

| Etapa | Esforço | Notas |
|-------|---------|-------|
| Registry BQ | ~1 min | INSERT direto; Django + sync é o caminho oficial |
| Dados gold | Já existiam | 134 doses em atraso (ingestão parcial anterior) |
| Dashboard Superset | ~2 min | `./apply_bi_feedback.sh` — idempotente por UUID |
| Ingestão dedicada | Pendente | Disparar DAG após registry Django para dados completos |

**Conclusão:** onboarding de **dashboard** é rápido (minutos). O gargalo continua sendo **registry → ingest → dbt gold** (horas, depende de Airflow).

## Rollback

```sql
DELETE FROM `ptm-data-prod.governance.municipality_activation`
WHERE municipality_code = '220770' AND notes LIKE 'Onboarding test%';
```

Remover dashboard no Superset UI ou deixar órfão (não afeta dados).
