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

# Dashboard: Gestão de Imunização — Visão Operacional

Dashboards-as-code para o dashboard operacional de imunização. Vive aqui (no
fork PTM do Superset) porque depende dos plugins customizados PTM
(`ptm_big_number_*`, `ptm_pivot_table`, etc.) e do tema PTM.

Fontes de dados em `ptm-data-prod.gold.gold_immunization_*` — definidas em
[`ptm-dw-modeling`](https://github.com/PortalTelemedicina/ptm-dw-modeling/tree/feat/immunization-dbt-serving/models/gold/immunization).

> **Apresentação ao time** — para entender problema de negócio, marts,
> fórmulas e gráfico-a-gráfico, leia [`EXPLICACAO_DASHBOARD.md`](EXPLICACAO_DASHBOARD.md).
> Este README é o manual de **provisionamento**; aquele é o manual de
> **interpretação**.

---

## Workflow recomendado: local-first → dev

Construa, valide e itere o dashboard contra um **Superset local** no seu
laptop (admin/admin, sem OIDC, com plugins PTM já instalados). Quando estiver
pronto, exporte o estado para `bundle/`, faça commit, e promova ao Superset de
dev/prod por um caminho automatizável.

```text
1. spin up local       2. configure BQ      3. bootstrap charts
   ┌──────────────┐       ┌──────────────┐     ┌──────────────────┐
   │ make up-light│  ──▶  │ UI: add BQ   │ ──▶ │ python bootstrap │
   │ localhost    │       │ ptm-data-prod│     │   --base-url loc │
   │ :8088 admin  │       │ SA JSON      │     │   --schema dev   │
   └──────────────┘       └──────────────┘     └──────────────────┘
                                                        │
                                                        ▼
6. promote to dev      5. commit bundle/    4. iterate in UI
   ┌──────────────┐       ┌──────────────┐     ┌──────────────────┐
   │ kubectl exec │  ◀──  │ git diff /add│ ◀── │ drag, tweak,     │
   │ + bootstrap  │       │ git push     │     │ tune filters,    │
   │   --target=dev│      │ open PR      │     │ verify with data │
   └──────────────┘       └──────────────┘     └──────────────────┘
                                                        │
                                                        ▼
                                              ┌──────────────────┐
                                              │ python bootstrap │
                                              │   --export       │
                                              │ → overwrites     │
                                              │   bundle/        │
                                              └──────────────────┘
```

### Step-by-step

#### 1) Spin up local Superset (one-time, ~5 min first run)

The standard repo compose works as-is — port `8088` is exposed:

```bash
cd superset-portal/superset
docker-compose up -d
# wait ~2 min for the init job, then verify:
curl -sf http://localhost:8088/health && echo "ready"
```

Default credentials: **`admin / admin`** (set in `docker/docker-init.sh`).

#### 2) Register the BigQuery connection (one-time, via UI)

In `http://localhost:8088`:

1. **Data → Databases → + Database → BigQuery**
2. **Display name**: `ptm-data-prod` (must match exactly — the script looks
   it up by name)
3. Upload your `gcloud iam service-accounts keys create` JSON for a SA with
   `roles/bigquery.dataViewer` on `ptm-data-prod`
4. Test connection, save

The connection persists in the named volume `superset_home`, so you only do
this once per laptop.

> Alternative: bake the BQ creds into the compose. We don't currently because
> the repo policy says no SA JSONs in git. If you want a non-interactive setup
> for CI, mount the JSON at runtime and set `GOOGLE_APPLICATION_CREDENTIALS`
> in `docker/.env-local`.

#### 3) Bootstrap the dashboard

```bash
cd dashboards_ptm/immunization
pip install requests pyyaml

python bootstrap_via_api.py \
  --base-url http://localhost:8088 \
  --username admin --password admin \
  --database-name ptm-data-prod \
  --schema dbt_josue_silveira_gold \
  -v
```

Output ends with the dashboard URL:
`http://localhost:8088/superset/dashboard/gestao-imunizacao-operacional/`.

#### 4) Iterate in the UI

Open the URL. Drag charts around, tweak metric formats, adjust conditional
formatting, swap viz types between PTM variants, etc. Use real data from
`dbt_josue_silveira_gold` to validate calculations end-to-end.

This is also where you spot dataset issues, missing columns, wrong joins —
fix them in `ptm-dw-modeling` and re-run `dbt build`, no Superset changes
needed (the local Superset re-reads from BQ on every chart load).

#### 5) Capture changes back to `bundle/`

When the dashboard looks right, round-trip the live state into the YAML
bundle:

```bash
python bootstrap_via_api.py \
  --base-url http://localhost:8088 \
  --username admin --password admin \
  --export
```

This uses Superset's native `/api/v1/dashboard/export/` endpoint, downloads
a zip, and overwrites `bundle/` wholesale. Then:

```bash
git diff bundle/   # see exactly what changed
git add bundle/
git commit -m "Refresh immunization dashboard (chart 4 layout + chart 6 threshold)"
```

> The `bootstrap_via_api.py` in-code specs are only the **initial seed** for
> first-time deploys. After the first iteration in the UI, `bundle/` becomes
> the source of truth. Re-bootstraps after that should use `superset
> import-dashboards` with `bundle/` instead of running the Python specs again.

#### 6) Promote to dev

Three options, pick whichever fits your CI:

**A) `kubectl exec` + bootstrap from inside the cluster** (most direct):

```bash
POD=$(kubectl -n superset get pod -l app=superset -o jsonpath='{.items[0].metadata.name}')

# Copy the bundle into the pod
kubectl -n superset cp bundle "$POD":/tmp/imm-bundle
# Zip it and import
kubectl -n superset exec "$POD" -- sh -c \
  "cd /tmp && zip -r imm.zip imm-bundle && superset import-dashboards -p /tmp/imm.zip -u admin"
```

**B) `kubectl port-forward` + import via API**:

```bash
kubectl -n superset port-forward svc/superset 8088:8088 &
zip -r /tmp/imm.zip bundle/
curl -X POST http://localhost:8088/api/v1/dashboard/import/ \
  -H "Authorization: Bearer $JWT" \
  -F bundle=@/tmp/imm.zip -F overwrite=true
```

**C) `preset-cli sync` from a CI runner** (clean for PRs):

```bash
preset-cli --workspaces=https://superset.ptmdev.com.br \
  superset sync native ./bundle/
```

---

## Por que essa abordagem?

| Problema do path "API direto contra prod" | Como local-first resolve |
|-------------------------------------------|--------------------------|
| Kong tem OIDC obrigatório em `/`. `/api/v1/security/login` está IP-restrito ao backend TC (`34.95.140.48/32`), bloqueando seu laptop | Local não tem Kong. Login `admin/admin` direto |
| Cookies OIDC expiram em minutos no meio de iterações | Local usa Flask session padrão, dura horas |
| Não dá pra validar visualmente sem perigo de mexer em dashboards de prod | Local é descartável; recriação leva segundos |
| `viz_type` errado, filtros mal-configurados, etc. só são percebidos depois do deploy | Você vê o erro instantaneamente no UI antes de promover |
| Iterar pelo script obriga reinventar o que o UI faz bem | UI continua sendo a melhor ferramenta pra ajustar layout/tema |

A regra de ouro: **`bundle/` é o que dev/prod vão executar**. Local-first
garante que cada commit em `bundle/` foi visto funcionando.

---

## Conteúdo do diretório

```text
dashboards_ptm/immunization/
├── README.md                 # este arquivo
├── bootstrap_via_api.py      # script REST (seed inicial + --export round-trip)
├── generate_bundle.py        # regenera bundle/ a partir dos specs no script
└── bundle/                   # bundle YAML (artefato versionado, fonte da verdade)
    ├── metadata.yaml
    ├── databases/ptm_data_prod.yaml
    ├── datasets/gold/<8 tabelas>.yaml
    ├── charts/<11 charts>.yaml
    └── dashboards/gestao_imunizacao_operacional.yaml
```

---

## O que o seed inicial cria

- **8 datasets** (schema `gold`) com cache timeout e metrics nomeadas.
  Adiciona uma coluna calculada `coverage_pct_d1` em
  `gold_immunization_status_aggregate_daily`.
- **11 charts** usando `viz_type` PTM:
  | # | Chart | viz_type | Notas |
  |---|-------|----------|-------|
  | 1 | Cobertura média (D1) | `ptm_big_number_trendline` | usa `coverage_pct_d1` |
  | 2 | Crianças em atraso | `ptm_big_number_total` | `SUM(overdue_count)` |
  | 3 | Próximas 30 dias | `ptm_big_number_trendline` | `SUM(due_next_30_count)` |
  | 4 | Timeline de doses | `ptm_echarts_timeseries` | `ptm_series_type=bar` + rounded bars + zoom |
  | 5 | Mapa de alerta | `ptm_pivot_table` | conditional formatting traffic-light em `priority_score` ⚠️ |
  | 6 | Heatmap atraso | `ptm_pivot_table` | vaccine × dose, vermelho onde overdue>0 |
  | 7 | Timeliness | `ptm_mixed_timeseries` | barras (on_time) vs linha (late) |
  | 8 | Abandono | `ptm_pie` | dropout médio por vacina |
  | 9 | Ranking municípios | `ptm_table` | ordenado por priority_score DESC |
  | 10 | Registros suspeitos | `ptm_table` | aggregate por reason × vacina × dose |
  | 11 | Última ingestão | `ptm_big_number_total` | freshness |
- **1 dashboard** `Gestão de Imunização — Visão Operacional`, slug
  `gestao-imunizacao-operacional`, tag `PTM`,
  `metadata.ptm_autoconvert: true`, 4 native filters (município, vacina,
  dose, período).

> ⚠️ **Chart #5 caveat**: PTM não tem choropleth equivalente ao `country_map`
> upstream. `maplibre_ptm` é scatter (precisa de lat/lng). Solução atual:
> `ptm_pivot_table` com traffic-light em `priority_score`. Upgrade para
> `maplibre_ptm`: ver TODO no spec do chart 5 em `bootstrap_via_api.py`.

---

## Auth model — para casos onde local-first não serve

Para automação CI ou tooling, eventualmente alguém precisa chamar a API do
Superset de prod. Modelo de auth do cluster PTM
([`data-helm-charts/ingress-superset/values-dev.yaml`](https://github.com/PortalTelemedicina/data-helm-charts/blob/main/ingress-superset/values-dev.yaml)):

| Rota | Plugin Kong | Quem passa |
|------|-------------|------------|
| `/` (catch-all) | `oidc-auth` (Google SSO) | Browser logado, ou XHR com cookies válidos |
| `/api/v1/security/login` | `allow-list-tc-backend` (IP `34.95.140.48/32`) | **Talk Connect Backend** somente; bypassa OIDC |
| `/api/v1/security/csrf_token` | idem | idem |
| `/api/v1/security/guest_token/` | idem | idem |

Implicação prática:

- **CI no GKE com egress = `34.95.140.48`** → `--username admin --password X`
  via `/api/v1/security/login` funciona.
- **CI fora desse IP** → use `kubectl exec` (Path A do step 6).
- **Iteração ad-hoc do laptop sem cluster access** → cookies OIDC do
  browser (`--cookie "..." --csrf-token "..."`). Curto fôlego — cookies
  expiram em minutos.

```bash
# Cookie path (último recurso ad-hoc):
python bootstrap_via_api.py \
  --base-url https://superset.ptmdev.com.br \
  --cookie "$(cat ~/.superset-cookie)" \
  --csrf-token "$(cat ~/.superset-csrf)" \
  --database-name ptm-data-prod \
  --schema dbt_josue_silveira_gold \
  --dry-run -v
```

Se os cookies estiverem stale o script aborta cedo com mensagem clara em vez
de falhar com JSONDecodeError.

---

## UUIDs estáveis

Todos os objetos usam UUIDs derivados de
`uuid5(NAMESPACE_NIL, 'ptm.imm.<nome>')` (ver `bootstrap_via_api.py:UUIDS`).
Garante idempotência entre runs e ambientes — re-rodar atualiza em vez de
duplicar.

| Objeto | UUID |
|--------|------|
| dashboard | `d3c77fed-f119-576c-b53d-e322bedab20a` |
| database `ptm-data-prod` | `99a083e8-1c2c-5fd4-8a6e-5130c8de2466` |
| dataset `status_aggregate_daily` | `1398b0d3-9206-5577-a140-21c0f59a19f1` |
| chart 1 (cobertura) | `080ef4cc-d3cd-53ca-b043-cda380bbe5d3` |
| ... | ver `UUIDS` no script |

---

## Dashboard tiers (v2 family)

Três variantes compartilham os mesmos datasets e charts (`CHARTS_V2`), mas
diferem em layout, filtros padrão e público:

| Tier | `--version` | Slug exemplo | Público |
|------|-------------|--------------|---------|
| **Nacional (Interno)** | `v2` | `gestao-imunizacao-operacional-v2` | PTM — todos os estados, KPI de município UNKNOWN |
| **Por estado** | `per-state` | `gestao-imunizacao-estado-pi` | Cliente estadual — filtro Estado pré-selecionado |
| **Por município** | `per-muni` | `gestao-imunizacao-municipio-220850` | Cliente municipal — Estado + Município pré-selecionados |

A factory lê `governance.municipality_activation` (via
[`activation_registry.py`](activation_registry.py)) e cria um dashboard por UF
ativa e um por IBGE ativo (`status IN ('active', 'staging')`).

Gráficos NACIONAIS (`chart.v2.19_state_priority_table`,
`chart.v2.20_state_coverage_matrix`) ficam apenas no dashboard interno. Os
dashboards por estado/município reusam o `chart.v2.06_priority_ranking`
(que mostra municípios *dentro do estado* via filtro de coluna `state_name`)
e o `chart.v2.09_coverage_heatmap` (vacina × dose).

Filtros nativos (Estado, Município, Vacina, Dose, ...) são anchored em
`gold_immunization_operational_backlog_daily` e propagam automaticamente para
qualquer dataset que exponha a mesma coluna (Superset usa o `column.name` do
filtro para gerar o WHERE em cada chart com aquela coluna).

```bash
# Só o dashboard interno (correções de layout/filtros)
python bootstrap_via_api.py --version v2 ... --schema dbt_josue_silveira_gold

# Um estado (iteração rápida)
python bootstrap_via_api.py --version per-state --scope PI \
  --registry-env prod --schema dbt_josue_silveira_gold ...

# Um município piloto
python bootstrap_via_api.py --version per-muni --scope 220850 \
  --registry-env prod --schema dbt_josue_silveira_gold ...

# Todos os ativos no registry (produção)
python bootstrap_via_api.py --version per-state --registry-env prod ...
python bootstrap_via_api.py --version per-muni --registry-env prod ...
```

`--municipality-dim-schema` aponta para o dataset BigQuery de
`s3_dim_municipality` (default: `--schema` sem sufixo `_gold`).

---

## Dashboard v2 — Gestão de Imunização — Nacional (Interno)

O script suporta a versão v2 interna — visão nacional com tabelas em linha
inteira (sem scroll horizontal), filtros multi-dataset (inclui
`priority_daily_v2`), e KPI de município UNKNOWN. Criado em paralelo com o v1.
Slug: `gestao-imunizacao-operacional-v2`.

### Seções do v2

| # | Seção | Gráficos | Datasets |
|---|-------|----------|---------|
| 1 | **Resumo Executivo** | 5 KPIs + ranking de prioridade + backlog por vacina + timeliness + heatmap cobertura | `operational_backlog_daily`, `priority_daily_v2`, `timeliness_monthly`, `data_freshness` |
| 2 | **Operações Municipais** | Backlog por unidade de saúde + carga de trabalho + distribuição por severidade | `operational_backlog_daily` |
| 3 | **Abandono Vacinal** | Ranking de abandono + taxa horizontal por vacina | `dropout_by_series_v2` |
| 4 | **Qualidade de Dados** | Inconsistências por tipo + por vacina/dose + KPI UNKNOWN | `data_quality_daily`, `operational_backlog_daily` |
| 5 | **Monitoramento Estadual** | Tabela estadual + matriz cobertura (linha inteira) | `priority_daily_v2`, `operational_backlog_daily` |

> **Mapa omitido no v2**: `maplibre_ptm` é um plugin de scatter (precisa lat/lng
> por ponto). Não há choropleth disponível. TODO: quando `s2_dim_address_with_geolocation`
> estiver completo ou um plugin de mapa choropleth for adicionado.

### Novos gold marts (dbt)

| Tabela | Descrição |
|--------|-----------|
| `gold_immunization_operational_backlog_daily` | Backlog agregado criança×regra por dia, município, estabelecimento, vacina, dose e faixa etária |
| `gold_immunization_priority_daily_v2` | Score de prioridade ponderado (0,35×atraso_share + …) por município |
| `gold_immunization_dropout_by_series_v2` | Abandono com gap temporal, aviso de denominador pequeno e taxa efetiva |
| `gold_immunization_data_quality_daily` | Fusão de registros suspeitos + freshness com labels PT-BR e severity |
| `gold_immunization_child_rule_status_daily` | Atom criança×regra com patient_id hasheado — **apenas dbt**, não exposto no Superset |
| `int_imm_child_rule_status_daily` | Intermediário — grain criança×regra×data para alimentar os gold marts acima |

### Provisionando apenas o v2

```bash
cd dashboards_ptm/immunization
python bootstrap_via_api.py \
  --version v2 \
  --base-url http://localhost:8088 \
  --username admin --password admin \
  --database-name "Google BigQuery" \
  --schema dbt_josue_silveira \
  -v
```

O dashboard v2 estará disponível em:
`http://localhost:8088/superset/dashboard/gestao-imunizacao-operacional-v2/`

### Provisionando os dois ao mesmo tempo (padrão)

```bash
python bootstrap_via_api.py \
  --version all \
  --base-url http://localhost:8088 \
  --username admin --password admin \
  --database-name "Google BigQuery" \
  --schema dbt_josue_silveira \
  -v
```

Imprime duas URLs ao final (v1 + v2). Idempotente — seguro de re-rodar.

### Rodando só o dbt (novos models)

Após adicionar novos gold marts, execute um `--full-refresh` para que
as partições históricas incorporem as novas colunas:

```bash
cd ptm-dw-modeling

# 1. Enriquecer o s3_fact (CNES, establishment, residência)
dbt run --select "s3_fact_immunization_enriched" --full-refresh --target josue_silveira

# 2. Rodar o intermediário + gold marts downstream
dbt run \
  --select "int_imm_child_rule_status_daily+ gold_immunization_priority_daily_v2 gold_immunization_dropout_by_series_v2 gold_immunization_data_quality_daily" \
  --full-refresh \
  --target josue_silveira
```

---

## Referências

- Plugins PTM: [`superset-frontend/src/ptm/plugins/registerPtmPlugins.ts`](../../superset-frontend/src/ptm/plugins/registerPtmPlugins.ts)
- Mapping legacy → PTM: [`superset-frontend/src/ptm/utils/ptmChartMapping.ts`](../../superset-frontend/src/ptm/utils/ptmChartMapping.ts)
- Compose dev local: [`docker-compose.yml`](../../docker-compose.yml)
- Init local (admin/admin): [`docker/docker-init.sh`](../../docker/docker-init.sh)
- Modelos dbt: [`ptm-dw-modeling/models/gold/immunization/`](https://github.com/PortalTelemedicina/ptm-dw-modeling/tree/feat/immunization-dbt-serving/models/gold/immunization)
- Runbook (visão de produto): [`docs/SUPERSET_DASHBOARD_RUNBOOK.md`](https://github.com/PortalTelemedicina/ptm-dw-modeling/blob/feat/immunization-dbt-serving/docs/SUPERSET_DASHBOARD_RUNBOOK.md)
