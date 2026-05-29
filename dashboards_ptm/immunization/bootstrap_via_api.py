#!/usr/bin/env python3
# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
"""Bootstrap the Gestão de Imunização (Operacional) Superset dashboard via REST.

Usage::

    python bootstrap_via_api.py \\
        --base-url https://superset.example.com \\
        --username admin --password secret \\
        --database-name ptm-data-prod \\
        --schema gold

The script is idempotent: it looks objects up by their stable UUID first and
only creates them if missing. Re-running updates existing objects in place.

It targets Apache Superset 4.x/5.x/6.x REST APIs (paths under ``/api/v1/``).
"""

from __future__ import annotations

import argparse
import copy
import io
import json
import logging
import os
import shutil
import sys
import tempfile
import textwrap
import uuid
import zipfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Literal

import requests

# Local module (same directory as this script).
sys.path.insert(0, str(Path(__file__).resolve().parent))
from activation_registry import ScopeRow, fetch_active_scopes, unique_states  # noqa: E402

LOG = logging.getLogger("ptm.imm.bootstrap")

NS = uuid.UUID("00000000-0000-0000-0000-000000000000")


def _uid(name: str) -> str:
    return str(uuid.uuid5(NS, f"ptm.imm.{name}"))


def scope_dashboard_uuid(kind: Literal["state", "muni"], scope_id: str) -> str:
    """Stable dashboard UUID per UF or IBGE (idempotent factory re-runs)."""
    return _uid(f"dashboard.imm.{kind}.{scope_id}")


# Active immunization pilot municipality. Used as the default value for
# the dashboard's Município native filter so the operational view loads
# scoped to the right IBGE on first paint. Verified unique against
# seeds/brazil_city_details.csv — only Porto/PI (IBGE 220850) carries
# this name, so a name-based default doesn't collide with other states.
_PILOT_MUNICIPALITY_NAME = "Porto"
_PILOT_MUNICIPALITY_CODE = "220850"


UUIDS: dict[str, str] = {
    "database.ptm_data_prod": _uid("database.ptm_data_prod"),
    "dataset.status_aggregate_daily": _uid(
        "dataset.gold_immunization_status_aggregate_daily"
    ),
    "dataset.dose_applied_monthly": _uid(
        "dataset.gold_immunization_dose_applied_monthly"
    ),
    "dataset.timeliness_monthly": _uid(
        "dataset.gold_immunization_timeliness_monthly"
    ),
    "dataset.municipality_ranking_daily": _uid(
        "dataset.gold_immunization_municipality_ranking_daily"
    ),
    "dataset.dropout_by_series": _uid(
        "dataset.gold_immunization_dropout_by_series"
    ),
    "dataset.suspicious_records": _uid(
        "dataset.gold_immunization_suspicious_records"
    ),
    "dataset.data_freshness": _uid(
        "dataset.gold_immunization_data_freshness"
    ),
    "dataset.rule_evaluation_summary": _uid(
        "dataset.gold_immunization_rule_evaluation_summary"
    ),
    "chart.01_kpi_cobertura_media": _uid("chart.01_kpi_cobertura_media"),
    "chart.02_kpi_criancas_em_atraso": _uid("chart.02_kpi_criancas_em_atraso"),
    "chart.03_kpi_proximas_30_dias": _uid("chart.03_kpi_proximas_30_dias"),
    "chart.04_timeline_doses": _uid("chart.04_timeline_doses"),
    "chart.05_mapa_alerta": _uid("chart.05_mapa_alerta"),
    "chart.06_heatmap_atraso": _uid("chart.06_heatmap_atraso"),
    "chart.07_timeliness": _uid("chart.07_timeliness"),
    "chart.08_dropout_serie": _uid("chart.08_dropout_serie"),
    "chart.09_ranking_municipios": _uid("chart.09_ranking_municipios"),
    "chart.10_registros_suspeitos": _uid("chart.10_registros_suspeitos"),
    "chart.11_freshness": _uid("chart.11_freshness"),
    "dashboard.gestao_imunizacao_operacional": _uid(
        "dashboard.gestao_imunizacao_operacional"
    ),
    # v2 datasets — new gold marts
    "dataset.operational_backlog_daily_v2": _uid(
        "dataset.gold_immunization_operational_backlog_daily_v2"
    ),
    "dataset.priority_daily_v2": _uid(
        "dataset.gold_immunization_priority_daily_v2"
    ),
    "dataset.dropout_by_series_v2": _uid(
        "dataset.gold_immunization_dropout_by_series_v2"
    ),
    "dataset.data_quality_daily_v2": _uid(
        "dataset.gold_immunization_data_quality_daily_v2"
    ),
    # v2 charts — Section 1 (Executive summary)
    "chart.v2.01_kpi_overdue": _uid("chart.v2.01_kpi_overdue"),
    "chart.v2.02_kpi_due_next_30": _uid("chart.v2.02_kpi_due_next_30"),
    "chart.v2.03_kpi_applied": _uid("chart.v2.03_kpi_applied"),
    "chart.v2.04_kpi_freshness": _uid("chart.v2.04_kpi_freshness"),
    "chart.v2.05_kpi_dq_issues": _uid("chart.v2.05_kpi_dq_issues"),
    "chart.v2.06_priority_ranking": _uid("chart.v2.06_priority_ranking"),
    "chart.v2.07_backlog_vaccine": _uid("chart.v2.07_backlog_vaccine"),
    "chart.v2.08_timeliness_trend": _uid("chart.v2.08_timeliness_trend"),
    "chart.v2.09_coverage_heatmap": _uid("chart.v2.09_coverage_heatmap"),
    # v2 charts — Section 2 (Municipal Ops)
    "chart.v2.10_backlog_establishment": _uid("chart.v2.10_backlog_establishment"),
    "chart.v2.11_upcoming_workload": _uid("chart.v2.11_upcoming_workload"),
    "chart.v2.12_overdue_bucket_dist": _uid("chart.v2.12_overdue_bucket_dist"),
    # v2 charts — Section 3 (Dropout)
    "chart.v2.13_dropout_ranking": _uid("chart.v2.13_dropout_ranking"),
    "chart.v2.14_dropout_bar": _uid("chart.v2.14_dropout_bar"),
    # v2 charts — Section 4 (Data Quality)
    "chart.v2.15_suspicious_by_reason": _uid("chart.v2.15_suspicious_by_reason"),
    "chart.v2.16_suspicious_by_vaccine": _uid("chart.v2.16_suspicious_by_vaccine"),
    "chart.v2.18_unknown_municipality": _uid("chart.v2.18_unknown_municipality"),
    # v2 charts — Section 5 (State Monitoring)
    "chart.v2.19_state_priority_table": _uid("chart.v2.19_state_priority_table"),
    "chart.v2.20_state_coverage_matrix": _uid("chart.v2.20_state_coverage_matrix"),
    # v2 dashboard
    "dashboard.gestao_imunizacao_operacional_v2": _uid(
        "dashboard.gestao_imunizacao_operacional_v2"
    ),
}


# ---------------------------------------------------------------------------
# HTTP client
# ---------------------------------------------------------------------------


@dataclass
class SupersetClient:
    """Minimal Superset REST client supporting three auth modes:

    1. **JWT bearer token** (``--token``) — for Superset with DB-backed auth.
    2. **Username + password** (``--username --password``) — DB-backed login,
       calls ``/api/v1/security/login`` and pulls a fresh JWT.
    3. **Cookie + CSRF** (``--cookie --csrf-token``) — for Superset behind
       OIDC/SAML/SSO proxies (Google, Auth0, Okta, etc). Copy the ``cookie``
       and ``x-csrftoken`` request headers from any authenticated browser
       request in DevTools and pass them in.
    """

    base_url: str
    username: str | None = None
    password: str | None = None
    token: str | None = None
    cookie: str | None = None
    csrf_token: str | None = None
    timeout: int = 30
    session: requests.Session = field(default_factory=requests.Session)
    _csrf: str | None = None

    def login(self) -> None:
        if self.cookie:
            self.session.headers.update(
                {
                    "Cookie": self.cookie,
                    "Referer": self.base_url,
                    "Accept": "application/json",
                }
            )
            if self.csrf_token:
                self._csrf = self.csrf_token
            else:
                r = self._raw_get(
                    f"{self.base_url}/api/v1/security/csrf_token/"
                )
                self._must_be_json(r, "/api/v1/security/csrf_token/")
                self._csrf = r.json()["result"]
            self.session.headers.update({"X-CSRFToken": self._csrf})
        elif self.token:
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        else:
            assert self.username and self.password, "username/password required"
            r = self.session.post(
                f"{self.base_url}/api/v1/security/login",
                json={
                    "username": self.username,
                    "password": self.password,
                    "provider": "db",
                    "refresh": True,
                },
                timeout=self.timeout,
                allow_redirects=False,
            )
            r.raise_for_status()
            self.token = r.json()["access_token"]
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
            r = self._raw_get(f"{self.base_url}/api/v1/security/csrf_token/")
            self._must_be_json(r, "/api/v1/security/csrf_token/")
            self._csrf = r.json()["result"]
            self.session.headers.update(
                {"X-CSRFToken": self._csrf, "Referer": self.base_url}
            )

        self._validate_session()

    # -- internal helpers -------------------------------------------------

    def _raw_get(self, url: str) -> requests.Response:
        """GET without auto-following redirects (so we can detect SSO loops)."""
        return self.session.get(url, timeout=self.timeout, allow_redirects=False)

    def _must_be_json(self, r: requests.Response, path: str) -> None:
        if r.status_code in (301, 302, 303, 307, 308):
            loc = r.headers.get("Location", "")
            if "accounts.google.com" in loc or "oauth" in loc.lower():
                raise SystemExit(
                    f"\n[auth] Superset redirected '{path}' to {loc[:120]}...\n"
                    "       This means your OIDC session cookies are stale or "
                    "expired. Re-grab them:\n"
                    "         1. In your browser, open Superset (it'll prompt "
                    "Google SSO if needed).\n"
                    "         2. DevTools (Cmd+Opt+I) -> Network tab -> click "
                    "any '/api/v1/*' XHR.\n"
                    "         3. Copy the 'cookie:' request header value to "
                    "~/.superset-cookie.\n"
                    "         4. Copy the 'x-csrftoken:' value to "
                    "~/.superset-csrf.\n"
                    "         5. Re-run the script (do NOT sign out between "
                    "step 3 and now).\n"
                )
            raise SystemExit(
                f"[auth] {path} returned {r.status_code} redirect to "
                f"{loc[:200]}"
            )
        ct = r.headers.get("Content-Type", "")
        if "application/json" not in ct.lower():
            raise SystemExit(
                f"[auth] {path} returned {r.status_code} {ct!r} (expected JSON). "
                f"Body[:300]: {r.text[:300]!r}"
            )

    def _validate_session(self) -> None:
        """Sanity-check auth before any real work.

        We don't use ``/api/v1/me/`` because it relies on ``g.user`` being
        populated, which only happens cleanly under Flask session auth (not
        JWT bearer). Instead we hit ``/api/v1/database/?q=(page_size:1)``
        which mirrors a real read we'd do anyway and is permission-equivalent
        to the work the script needs to perform.
        """
        path = "/api/v1/database/?q=(page_size:1)"
        r = self._raw_get(f"{self.base_url}{path}")
        self._must_be_json(r, path)
        if r.status_code == 401:
            raise SystemExit(
                f"[auth] {path} returned 401. Auth headers are not being "
                "accepted by Superset.\n"
                "       - If you used --username/--password: verify the user "
                "exists and the password is correct.\n"
                "       - If you used --token: the JWT is expired or signed "
                "with a different secret than Superset's.\n"
                "       - If you used --cookie: your OIDC cookies are stale; "
                "re-grab them from DevTools.\n"
                f"       Body: {r.text[:300]!r}"
            )
        r.raise_for_status()
        body = r.json()
        LOG.info(
            "session validated (%s reachable, %d databases visible)",
            path, body.get("count", 0),
        )

    def request(self, method: str, path: str, **kw: Any) -> requests.Response:
        url = f"{self.base_url}{path}"
        kw.setdefault("allow_redirects", False)
        r = self.session.request(method, url, timeout=self.timeout, **kw)
        if r.status_code in (301, 302, 303, 307, 308):
            loc = r.headers.get("Location", "")
            if "accounts.google.com" in loc or "oauth" in loc.lower():
                raise SystemExit(
                    f"\n[auth] {method} {path} got SSO redirect (status "
                    f"{r.status_code} -> {loc[:120]}...). Your cookies expired "
                    "mid-run. Re-grab them from DevTools and re-run."
                )
            LOG.error("unexpected %s redirect: %s %s -> %s", r.status_code, method, path, loc)
        if r.status_code >= 400:
            LOG.error("HTTP %s %s -> %s: %s", method, path, r.status_code, r.text[:500])
        r.raise_for_status()
        return r

    def get(self, path: str, **kw: Any) -> Any:
        return self.request("GET", path, **kw).json()

    def post(self, path: str, payload: dict) -> Any:
        return self.request("POST", path, json=payload).json()

    def put(self, path: str, payload: dict) -> Any:
        return self.request("PUT", path, json=payload).json()


# ---------------------------------------------------------------------------
# Lookup helpers (idempotent: search by UUID, fall back to name)
# ---------------------------------------------------------------------------


def _rison_str(s: str) -> str:
    """Format a Python string as a rison string literal.

    Superset's ``?q=`` query parameter is rison, not JSON. Rison strings are
    single-quoted with embedded single quotes escaped by doubling. Using
    ``json.dumps()`` here produces JSON double-quoted strings which Superset's
    parser silently tolerates for alphanumeric/hyphen content (e.g. UUIDs)
    but rejects when the value contains spaces — hence "Google BigQuery"
    fails while a UUID does not.
    """
    return "'" + s.replace("'", "''") + "'"


def find_database(c: SupersetClient, name: str) -> dict | None:
    rql = f"(filters:!((col:database_name,opr:eq,value:{_rison_str(name)})))"
    res = c.get(f"/api/v1/database/?q={rql}")
    if res.get("count", 0) > 0:
        return res["result"][0]
    return None


def find_dataset_by_uuid(c: SupersetClient, dataset_uuid: str) -> dict | None:
    rql = f"(filters:!((col:uuid,opr:eq,value:{_rison_str(dataset_uuid)})))"
    res = c.get(f"/api/v1/dataset/?q={rql}")
    if res.get("count", 0) > 0:
        return res["result"][0]
    return None


def find_chart_by_uuid(c: SupersetClient, chart_uuid: str) -> dict | None:
    rql = f"(filters:!((col:uuid,opr:eq,value:{_rison_str(chart_uuid)})))"
    res = c.get(f"/api/v1/chart/?q={rql}")
    if res.get("count", 0) > 0:
        return res["result"][0]
    return None


def find_dashboard_by_uuid(c: SupersetClient, dash_uuid: str) -> dict | None:
    rql = f"(filters:!((col:uuid,opr:eq,value:{_rison_str(dash_uuid)})))"
    res = c.get(f"/api/v1/dashboard/?q={rql}")
    if res.get("count", 0) > 0:
        return res["result"][0]
    return None


# ---------------------------------------------------------------------------
# Code → human-name translations for BigQuery
#
# These are the canonical Brazilian RNDS codes from seeds/vaccine_schedule.csv
# in ptm-dw-modeling. Until dbt models are enriched with vaccine_display via
# JOIN with the seed (TODO), Superset surfaces only numeric codes which are
# meaningless to analysts. We push the translation down as a calculated
# column so every chart groupby produces readable labels.
# ---------------------------------------------------------------------------

_VACCINE_NAME_CASE = """CASE CAST(vaccine_code AS STRING)
  WHEN '15' THEN 'BCG'
  WHEN '9' THEN 'Hepatite B'
  WHEN '42' THEN 'Pentavalente'
  WHEN '22' THEN 'VIP'
  WHEN '45' THEN 'Rotavírus'
  WHEN '26' THEN 'Pneumo 10'
  WHEN '41' THEN 'MenC'
  WHEN '33' THEN 'Influenza'
  WHEN '102' THEN 'COVID-19'
  WHEN '14' THEN 'Febre Amarela'
  WHEN '74' THEN 'MenACWY'
  WHEN '24' THEN 'SCR'
  WHEN '34' THEN 'Varicela'
  WHEN '46' THEN 'DTP'
  WHEN '35' THEN 'Hepatite A'
  WHEN '21' THEN 'Pneumo 23'
  WHEN '25' THEN 'dT'
  WHEN '67' THEN 'HPV4'
  WHEN '104' THEN 'Dengue'
  WHEN '57' THEN 'dTpa'
  WHEN '28' THEN 'VOP'
  WHEN '55' THEN 'HepAinf'
  WHEN '56' THEN 'SCRV'
  WHEN '59' THEN 'VPC13'
  WHEN '23' THEN 'IGHR'
  WHEN '108' THEN 'VVSR-Rec'
  WHEN '37' THEN 'Vero'
  WHEN '87' THEN 'COVID-19 Pfizer'
  WHEN '97' THEN 'COVID-19 Moderna'
  WHEN '112' THEN 'COVID-19 Serum'
  ELSE CONCAT('Cód. ', CAST(vaccine_code AS STRING))
END""".strip()

# Suspicious-records reason taxonomy
# (see gold_immunization_suspicious_records.sql).
_REASON_DESCRIPTION_CASE = """CASE reason_code
  WHEN 'age_before_min' THEN 'Idade abaixo do mínimo permitido'
  WHEN 'future_occurrence_date' THEN 'Data de aplicação no futuro'
  WHEN 'missing_vaccine_code' THEN 'Código de vacina ausente'
  WHEN 'duplicate_dose_same_day' THEN 'Dose duplicada no mesmo dia'
  ELSE reason_code
END""".strip()

# Brazilian SUS dose labels (D1, D2, DU, R, R1, R2)
# inferred from dose_sequence integer (no 1-to-1 mapping, use heuristic).
_DOSE_LABEL_CASE = """CASE
  WHEN dose_sequence = 1 THEN 'D1 / Única'
  WHEN dose_sequence = 2 THEN 'D2'
  WHEN dose_sequence = 3 THEN 'D3'
  WHEN dose_sequence = 4 THEN 'D4 / Reforço'
  WHEN dose_sequence = 5 THEN 'R2'
  WHEN dose_sequence = -1 THEN 'Sem dose'
  ELSE CONCAT('Dose ', CAST(dose_sequence AS STRING))
END""".strip()


def _calc_col(name: str, expression: str, verbose: str, desc: str) -> dict:
    return {
        "column_name": name,
        "expression": expression,
        "type": "STRING",
        "verbose_name": verbose,
        "description": desc,
    }


# Canonical PT-BR labels for native columns shared across v1 + v2 datasets.
# Applied via ensure_dataset → any column whose name appears here gets its
# verbose_name PATCHed in Superset so tables/charts render the friendly label
# instead of the raw SQL identifier.
_COLUMN_LABELS: dict[str, str] = {
    # Time / identifiers
    "ref_date": "Data de referência",
    "occurrence_date": "Data de aplicação",
    "reference_month": "Mês de referência",
    "checked_at": "Última verificação",
    # Geo / org
    "municipality_code": "Cód. IBGE",
    "municipality_name": "Município",
    "municipality_state_code": "UF (cód.)",
    "municipality_state_name": "Estado",
    "state_code": "UF (cód.)",
    "state_name": "Estado",
    "neighborhood": "Bairro",
    "cep": "CEP",
    "establishment_cnes": "CNES",
    "establishment_name": "Unidade de saúde",
    "establishment_type_label": "Tipo de unidade",
    "last_cnes": "Última unidade (CNES)",
    "team_id": "Equipe (ID)",
    "team_name": "Equipe",
    "microarea_code": "Micro-área",
    # Vaccine
    "vaccine_code": "Cód. vacina",
    "vaccine_name": "Vacina",
    "dose_code": "Cód. dose",
    "dose_label": "Tipo de dose",
    "dose_sequence": "Seq. da dose",
    "dose_from_label": "Dose (de)",
    "dose_to_label": "Dose (para)",
    "dose_from_sequence": "Seq. (de)",
    "dose_to_sequence": "Seq. (para)",
    "age_band_code": "Faixa etária",
    "age_bucket": "Faixa etária",
    # Status / classification
    "status_bucket": "Status",
    "overdue_bucket": "Severidade do atraso",
    "priority_category": "Prioridade",
    "priority_score": "Score de prioridade",
    "priority_rank": "Posição",
    "recommended_action": "Ação recomendada",
    "severity": "Severidade",
    "reason_code": "Código do motivo",
    "reason_label": "Motivo",
    "freshness_status": "Status de atualização",
    # Counts
    "child_rule_pairs": "Crianças no calendário",
    "overdue_count": "Em atraso",
    "due_count": "Devidas hoje",
    "upcoming_count": "A vencer",
    "applied_count": "Aplicadas",
    "applied_from_count": "Crianças (dose inicial)",
    "applied_to_count": "Crianças (dose seguinte)",
    "issue_count": "Inconsistências",
    "overdue_total": "Total em atraso",
    "total_pairs": "Total de crianças no calendário",
    # Rates
    "overdue_share": "% Atrasadas",
    "dropout_rate": "Taxa de abandono",
    "effective_dropout_rate": "Abandono efetivo",
    "dropout_gap": "Gap (dias)",
    "denominator_warning": "Aviso de denominador",
    # Cohort
    "cohort_birth_year": "Coorte (ano nasc.)",
    "birth_year": "Ano de nascimento",
    "birth_date": "Data de nascimento",
    # Freshness
    "hours_since_last_ingestion": "Horas desde última ingestão",
    "s3_enriched_max_ingestion_ts": "Última ingestão",
    "s2_fact_immunization_rows": "Linhas em s2_fact",
    "s3_fact_immunization_enriched_rows": "Linhas em s3_fact_enriched",
}


_VACCINE_NAME_COL = _calc_col(
    "vaccine_name",
    _VACCINE_NAME_CASE,
    "Vacina",
    "Nome humano da vacina, traduzido do código RNDS via CASE WHEN. "
    "Substitua por JOIN com vaccine_schedule no dbt quando possível.",
)
_REASON_DESC_COL = _calc_col(
    "reason_description",
    _REASON_DESCRIPTION_CASE,
    "Motivo",
    "Descrição em PT-BR do motivo da inconsistência.",
)
_DOSE_LABEL_COL = _calc_col(
    "dose_label",
    _DOSE_LABEL_CASE,
    "Tipo de dose",
    "Rótulo SUS (D1/D2/Reforço) inferido de dose_sequence.",
)


# ---------------------------------------------------------------------------
# Dataset definitions
# ---------------------------------------------------------------------------


DATASETS: list[dict] = [
    {
        "key": "dataset.status_aggregate_daily",
        "table_name": "gold_immunization_status_aggregate_daily",
        "main_dttm_col": "ref_date",
        "cache_timeout": 1800,
        "metrics": [
            {
                "metric_name": "applied",
                "verbose_name": "Doses aplicadas",
                "expression": "SUM(applied_count)",
                "d3format": ",",
            },
            {
                "metric_name": "due_total",
                "verbose_name": "Crianças elegíveis",
                "expression": "SUM(child_rule_pairs)",
                "d3format": ",",
            },
            {
                "metric_name": "overdue",
                "verbose_name": "Em atraso",
                "expression": "SUM(overdue_count)",
                "d3format": ",",
            },
            {
                "metric_name": "upcoming",
                "verbose_name": "Próximas",
                "expression": "SUM(upcoming_count)",
                "d3format": ",",
            },
            {
                "metric_name": "due_next_30",
                "verbose_name": "Devidas em 30d",
                "expression": "SUM(due_next_30_count)",
                "d3format": ",",
            },
            # Coverage KPI as a real metric (NOT a calculated column). Big
            # number viz references metrics by name; a calculated column with
            # the same name does not satisfy that lookup.
            {
                "metric_name": "coverage_pct_d1",
                "verbose_name": "Cobertura (%)",
                "expression": (
                    "SAFE_DIVIDE(SUM(applied_count), "
                    "NULLIF(SUM(child_rule_pairs), 0))"
                ),
                "d3format": ".1%",
                "description": (
                    "Razão doses aplicadas / crianças elegíveis no recorte."
                ),
            },
        ],
        "calculated_columns": [_VACCINE_NAME_COL, _DOSE_LABEL_COL],
    },
    {
        "key": "dataset.dose_applied_monthly",
        "table_name": "gold_immunization_dose_applied_monthly",
        "main_dttm_col": "reference_month",
        "cache_timeout": 1800,
        "metrics": [
            {
                "metric_name": "applied_count",
                "verbose_name": "Doses aplicadas",
                "expression": "SUM(dose_count)",
                "d3format": ",",
            },
            {
                "metric_name": "patient_count",
                "verbose_name": "Crianças únicas",
                "expression": "SUM(patient_count)",
                "d3format": ",",
            },
        ],
        "calculated_columns": [_VACCINE_NAME_COL],
    },
    {
        "key": "dataset.timeliness_monthly",
        "table_name": "gold_immunization_timeliness_monthly",
        "main_dttm_col": "reference_month",
        "cache_timeout": 1800,
        "metrics": [
            {
                "metric_name": "on_time",
                "verbose_name": "No prazo",
                "expression": "SUM(on_time_count)",
            },
            {
                "metric_name": "late",
                "verbose_name": "Atrasadas",
                "expression": "SUM(late_count)",
            },
            {
                "metric_name": "matched_total",
                "verbose_name": "Total com regra",
                "expression": "SUM(total_with_schedule_match)",
            },
        ],
    },
    {
        "key": "dataset.municipality_ranking_daily",
        "table_name": "gold_immunization_municipality_ranking_daily",
        "main_dttm_col": "ref_date",
        "cache_timeout": 1800,
        "metrics": [
            {
                "metric_name": "max_priority",
                "verbose_name": "Score máximo",
                "expression": "MAX(priority_score)",
                "d3format": ".2f",
            },
            {
                "metric_name": "overdue_total_sum",
                "verbose_name": "Atrasadas",
                "expression": "SUM(overdue_total)",
            },
        ],
    },
    {
        "key": "dataset.dropout_by_series",
        "table_name": "gold_immunization_dropout_by_series",
        "cache_timeout": 86400,
        "metrics": [
            {
                "metric_name": "avg_dropout_rate",
                "verbose_name": "Taxa de abandono média",
                "expression": "AVG(dropout_rate)",
                "d3format": ".1%",
            },
        ],
        "calculated_columns": [_VACCINE_NAME_COL],
    },
    {
        "key": "dataset.suspicious_records",
        "table_name": "gold_immunization_suspicious_records",
        "main_dttm_col": "reference_month",
        "cache_timeout": 1800,
        "metrics": [
            {
                "metric_name": "row_count_sum",
                "verbose_name": "Registros suspeitos",
                "expression": "SUM(row_count)",
            },
        ],
        "calculated_columns": [
            _VACCINE_NAME_COL,
            _DOSE_LABEL_COL,
            _REASON_DESC_COL,
        ],
    },
    {
        "key": "dataset.data_freshness",
        "table_name": "gold_immunization_data_freshness",
        "main_dttm_col": "checked_at",
        "cache_timeout": 300,
        "metrics": [
            # Big-number-friendly: seconds since last ingestion. d3 ',d'
            # renders as e.g. "12,847" — interpret as seconds. The chart
            # subheader gives the unit.
            {
                "metric_name": "seconds_since_last_ingestion",
                "verbose_name": "Segundos desde a última ingestão",
                "expression": (
                    "TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), "
                    "MAX(s3_enriched_max_ingestion_ts), SECOND)"
                ),
                "d3format": ",d",
            },
            # Minutes-since variant for a more human number on the dashboard.
            {
                "metric_name": "minutes_since_last_ingestion",
                "verbose_name": "Minutos desde a última ingestão",
                "expression": (
                    "TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), "
                    "MAX(s3_enriched_max_ingestion_ts), MINUTE)"
                ),
                "d3format": ",d",
            },
            {
                "metric_name": "last_rnds_ingestion_ts",
                "verbose_name": "Última atualização da RNDS",
                "expression": "MAX(s3_enriched_max_ingestion_ts)",
                "d3format": "%d/%m/%Y %H:%M",
            },
        ],
    },
    {
        "key": "dataset.rule_evaluation_summary",
        "table_name": "gold_immunization_rule_evaluation_summary",
        "main_dttm_col": "ref_date",
        "cache_timeout": 1800,
        "metrics": [
            {
                "metric_name": "status_total",
                "verbose_name": "Crianças no status",
                "expression": "SUM(status_count)",
            },
        ],
    },
]


# ---------------------------------------------------------------------------
# Chart definitions
# ---------------------------------------------------------------------------


def _filter_temporal(col: str) -> dict:
    return {
        "clause": "WHERE",
        "subject": col,
        "operator": "TEMPORAL_RANGE",
        "comparator": "Last year",
        "expressionType": "SIMPLE",
    }


# Snapshot tables: ref_date is rewritten to CURRENT_DATE() on every
# dbt build invocation (see gold_immunization_status_aggregate_daily.sql,
# WITH ref AS (SELECT CURRENT_DATE())). Until dbt runs daily there is
# only one value of ref_date in the table, and Superset's "Last year"
# TEMPORAL_RANGE is timezone-sensitive — easy to filter out the only
# date you have. The right semantic for these tables is "latest
# snapshot" (no temporal filter), since the table already IS today.
_SNAPSHOT_TIME_RANGE: dict = {"time_range": "No filter"}

# Chart params shared by bar/column/line timeseries (upstream ECharts plugin).
_PTM_SHOW_VALUE: dict = {"show_value": True}
_PTM_STACKED_BAR: dict = {
    "stack": "Stack",
    "show_value": True,
    "only_total": True,
}


def _metric(label: str, agg: str, col: str) -> dict:
    return {
        "label": label,
        "expressionType": "SIMPLE",
        "aggregate": agg,
        "column": {"column_name": col},
    }


# ---------------------------------------------------------------------------
# PTM plugin viz_types (source of truth:
# superset-portal/superset/superset-frontend/src/ptm/plugins/registerPtmPlugins.ts)
#
# Vanilla -> PTM mapping (see ptmChartMapping.ts):
#   big_number_total          -> ptm_big_number_total
#   big_number                -> ptm_big_number_trendline
#   pie                       -> ptm_pie
#   table                     -> ptm_table
#   pivot_table_v2            -> ptm_pivot_table
#   mixed_timeseries          -> ptm_mixed_timeseries
#   echarts_timeseries_*      -> ptm_echarts_timeseries + ptm_series_type
#   country_map               -> (no PTM equivalent; maplibre_ptm needs lat/lng)
#
# Defaults set per the PTM plugin control panels:
#   ptm_bar_radius_enabled=True, ptm_bar_radius_size='8'
#   ptm_bar_radius_round_top=True, ptm_bar_radius_round_bottom=True
#   ptm_zoom_enabled=True, ptm_zoom_axis='x', ptm_zoom_size='xs',
#   ptm_zoom_inset='24'
# ---------------------------------------------------------------------------


# Shared PTM bar-radius defaults for timeseries with bar series.
_PTM_BAR_RADIUS: dict = {
    "ptm_bar_radius_enabled": True,
    "ptm_bar_radius_size": "8",
    "ptm_bar_radius_round_top": True,
    "ptm_bar_radius_round_bottom": True,
}

# Shared PTM zoom defaults for timeseries.
_PTM_ZOOM: dict = {
    "ptm_zoom_enabled": True,
    "ptm_zoom_axis": "x",
    "ptm_zoom_size": "xs",
    "ptm_zoom_inset": "24",
}


# ---------------------------------------------------------------------------
# PTM Big-Number card defaults — matches the official PTM card style:
#   ┌──────────────────────────┐
#   │ [icon]                   │   ← lucide-react icon in colored pill
#   │   123,456                │   ← big number (header)
#   │   Descriptive text…      │   ← additional_text (NOT card-title)
#   └──────────────────────────┘
#
# Lucide icon names: any export from lucide-react (e.g. Syringe,
# AlertTriangle, CalendarClock, RefreshCw, Shield, Activity).
# See sharedControls.ts in superset-plugin-chart-echarts-ptm.
# ---------------------------------------------------------------------------

_PTM_KPI_DEFAULTS: dict = {
    "layout_mode": "ptm",
    "autofit": True,
    "show_icon": True,
    # 20 px = plugin "Medium"; keeps the pill proportional at row height ~22.
    "icon_size": 20,
    "header_font_size": 0.5,
    # BI feedback: larger caption text under KPI numbers on compact cards.
    "additional_text_font_size": 20,
    # subheader is the "Card Title" slot above the number — we deliberately
    # leave it empty per PTM card style. Descriptive text lives in
    # additional_text (below the number).
    "subheader": "",
}


def _ptm_kpi(
    *,
    icon_name: str,
    icon_color: str,
    icon_background_color: str,
    additional_text: str,
    extra: dict | None = None,
) -> dict:
    """Build a params dict for a PTM big-number card."""
    out = {
        **_PTM_KPI_DEFAULTS,
        "icon_name": icon_name,
        "icon_color": icon_color,
        "icon_background_color": icon_background_color,
        "additional_text": additional_text,
    }
    if extra:
        out.update(extra)
    return out


CHARTS: list[dict] = [
    # 1. Big number trendline — cobertura média ao longo do tempo
    {
        "key": "chart.01_kpi_cobertura_media",
        "slice_name": "Cobertura D1 — média no recorte",
        "viz_type": "ptm_big_number_trendline",
        "dataset_key": "dataset.status_aggregate_daily",
        "params": _ptm_kpi(
            icon_name="Syringe",
            icon_color="#00796B",
            icon_background_color="#E0F2F1",
            additional_text=(
                "Doses D1 aplicadas ÷ crianças elegíveis no recorte"
            ),
            extra={
                "metric": "coverage_pct_d1",
                "x_axis": "ref_date",
                "time_grain_sqla": "P1D",
                "adhoc_filters": [],
                **_SNAPSHOT_TIME_RANGE,
                "show_trend_line": True,
                "start_y_axis_at_zero": True,
                "y_axis_format": ".1%",
                "time_format": "smart_date",
                "rolling_type": "None",
                "color_picker": {"r": 0, "g": 121, "b": 107, "a": 1},
            },
        ),
    },
    # 2. Big number total — crianças em atraso
    {
        "key": "chart.02_kpi_criancas_em_atraso",
        "slice_name": "Doses em atraso",
        "viz_type": "ptm_big_number_total",
        "dataset_key": "dataset.status_aggregate_daily",
        "params": _ptm_kpi(
            icon_name="AlertTriangle",
            icon_color="#C62828",
            icon_background_color="#FFEBEE",
            additional_text=(
                "Pares criança × regra com aplicação vencida hoje"
            ),
            extra={
                "metric": "overdue",
                "adhoc_filters": [],
                **_SNAPSHOT_TIME_RANGE,
                "y_axis_format": ",",
            },
        ),
    },
    # 3. Big number trendline — próximas 30 dias
    {
        "key": "chart.03_kpi_proximas_30_dias",
        "slice_name": "A vencer nos próximos 30 dias",
        "viz_type": "ptm_big_number_trendline",
        "dataset_key": "dataset.status_aggregate_daily",
        "params": _ptm_kpi(
            icon_name="CalendarClock",
            icon_color="#EF6C00",
            icon_background_color="#FFF3E0",
            additional_text=(
                "Doses programadas até D+30 a partir de hoje"
            ),
            extra={
                "metric": "due_next_30",
                "x_axis": "ref_date",
                "time_grain_sqla": "P1D",
                "adhoc_filters": [],
                **_SNAPSHOT_TIME_RANGE,
                "show_trend_line": True,
                "start_y_axis_at_zero": True,
                "y_axis_format": ",",
                "color_picker": {"r": 239, "g": 108, "b": 0, "a": 1},
            },
        ),
    },
    # 4. Timeline doses — PTM echarts timeseries (bar variant)
    {
        "key": "chart.04_timeline_doses",
        "slice_name": "Doses aplicadas por mês × vacina",
        "viz_type": "ptm_echarts_timeseries",
        "dataset_key": "dataset.dose_applied_monthly",
        "params": {
            "x_axis": "reference_month",
            "time_grain_sqla": "P1M",
            "metrics": [_metric("Doses aplicadas", "SUM", "dose_count")],
            "groupby": ["vaccine_name"],
            "adhoc_filters": [_filter_temporal("reference_month")],
            "row_limit": 10000,
            "color_scheme": "supersetColors",
            "show_legend": True,
            "x_axis_time_format": "smart_date",
            "y_axis_format": ",",
            "ptm_series_type": "bar",
            **_PTM_BAR_RADIUS,
            **_PTM_ZOOM,
        },
    },
    # 6. Heatmap atraso — PTM pivot table
    {
        "key": "chart.06_heatmap_atraso",
        "slice_name": "Doses em atraso por vacina × dose",
        "viz_type": "ptm_pivot_table",
        "dataset_key": "dataset.status_aggregate_daily",
        "params": {
            "groupbyRows": ["vaccine_name"],
            "groupbyColumns": ["dose_label"],
            "metrics": [_metric("Doses em atraso", "SUM", "overdue_count")],
            "metricsLayout": "COLUMNS",
            "adhoc_filters": [],
            **_SNAPSHOT_TIME_RANGE,
            "row_limit": 10000,
            "valueFormat": ",",
            "rowOrder": "value_z_to_a",
            "colOrder": "key_a_to_z",
            "aggregateFunction": "Sum",
            "conditional_formatting": [
                {
                    "operator": ">",
                    "targetValue": 0,
                    "colorScheme": "#d32f2f",
                    "column": "SUM(overdue_count)",
                },
            ],
        },
    },
    # 7. Timeliness — PTM mixed timeseries (bar Query A vs line Query B)
    {
        "key": "chart.07_timeliness",
        "slice_name": "Pontualidade (no prazo vs atrasadas)",
        "viz_type": "ptm_mixed_timeseries",
        "dataset_key": "dataset.timeliness_monthly",
        "params": {
            "x_axis": "reference_month",
            "time_grain_sqla": "P1M",
            "metrics": [_metric("No prazo", "SUM", "on_time_count")],
            "metrics_b": [_metric("Atrasadas", "SUM", "late_count")],
            "groupby": [],
            "groupby_b": [],
            "adhoc_filters": [_filter_temporal("reference_month")],
            "adhoc_filters_b": [_filter_temporal("reference_month")],
            "seriesType": "echarts_timeseries_bar",
            "seriesTypeB": "echarts_timeseries_line",
            "show_legend": True,
            "y_axis_format": ",",
            "x_axis_time_format": "smart_date",
            **_PTM_SHOW_VALUE,
            "show_valueB": True,
            **_PTM_BAR_RADIUS,
            **_PTM_ZOOM,
        },
    },
    # 8. Dropout — PTM pie
    {
        "key": "chart.08_dropout_serie",
        "slice_name": "Abandono entre doses por vacina",
        "viz_type": "ptm_pie",
        "dataset_key": "dataset.dropout_by_series",
        "params": {
            "groupby": ["vaccine_name"],
            "metric": _metric("Taxa média de abandono", "AVG", "dropout_rate"),
            "adhoc_filters": [],
            "row_limit": 100,
            "sort_by_metric": True,
            "color_scheme": "d3Category20",
            "show_legend": True,
            "label_type": "key_value_percent",
            "number_format": ".1%",
        },
    },
    # 10. Suspicious records — PTM table (aggregate mode)
    {
        "key": "chart.10_registros_suspeitos",
        "slice_name": "Registros com inconsistências",
        "viz_type": "ptm_table",
        "dataset_key": "dataset.suspicious_records",
        "params": {
            "query_mode": "aggregate",
            "groupby": ["reason_description", "vaccine_name", "dose_label"],
            "metrics": [_metric("Registros", "SUM", "row_count")],
            "row_limit": 1000,
            "server_page_length": 25,
            "adhoc_filters": [_filter_temporal("reference_month")],
            "order_desc": True,
        },
    },
    # 11. Freshness — PTM big number total
    # Renders "minutes since last successful enrichment". Number is the raw
    # minute count; descriptive text below explains the unit and source.
    {
        "key": "chart.11_freshness",
        "slice_name": "Defasagem do enriquecimento (min)",
        "viz_type": "ptm_big_number_total",
        "dataset_key": "dataset.data_freshness",
        "params": _ptm_kpi(
            icon_name="RefreshCw",
            icon_color="#1565C0",
            icon_background_color="#E3F2FD",
            additional_text=(
                "Minutos desde a última carga em "
                "s3_fact_immunization_enriched"
            ),
            extra={
                "metric": "minutes_since_last_ingestion",
                "adhoc_filters": [],
                "y_axis_format": ",d",
            },
        ),
    },
]


# ---------------------------------------------------------------------------
# Dashboard layout — 3-row grid:
#   Row 1: 3 KPI cards (#1, #2, #3)
#   Row 2: Timeline (#4) | Map (#5) | Timeliness (#7)
#   Row 3: Heatmap (#6) | Ranking (#9) | Pie (#8)
#   Row 4: Suspicious (#10) | Freshness (#11)
# ---------------------------------------------------------------------------


def build_dashboard_position(chart_id_by_key: dict[str, int]) -> dict:
    """Build the ``position_json`` blob with stable shortIDs.

    Superset's grid is a 12-column horizontal layout per ROW. ``width`` is
    the number of grid columns the chart occupies (1-12), so a row's
    widths should sum to ≤ 12. ``height`` is the chart's height in dashboard
    units (each ≈10 px) and is per-chart, not per-row — the row's height is
    determined by the tallest chart in it.
    """

    def chart_node(key: str, width: int, height: int, parent_row: str) -> dict:
        slug = key.split(".", 1)[1]
        node_id = f"CHART-{slug}"[:50]
        return {
            "type": "CHART",
            "id": node_id,
            "children": [],
            "parents": ["ROOT_ID", "GRID_ID", parent_row],
            "meta": {
                "width": width,
                "height": height,
                "chartId": chart_id_by_key[key],
                "uuid": UUIDS[key],
            },
        }

    # Grid layout — single-municipality operational view, 4 rows.
    #
    # SIZING UNITS (these are NOT pixels):
    #   width:  12-column grid per row (3 = one quarter, 6 = half, 12 = full).
    #   height: Superset grid unit, ≈ 8 px each. So height=30 ≈ 240 px,
    #           height=50 ≈ 400 px, height=70 ≈ 560 px. Tune small for
    #           KPI cards (single number) and tall for tables/timeseries.
    #
    #   Row 1 (KPIs):        [ 3 | 3 | 3 | 3 ]   h 22   (single-number cards)
    #   Row 2 (trends):      [   6   |   6   ]   h 50   (timeseries need room)
    #   Row 3 (atraso):      [        12       ] h 55   (pivot vacina × dose)
    #   Row 4 (anomalias):   [   7   |    5    ] h 55   (table + pie)
    #
    # To change a card's footprint, edit (width, height) tuples below.
    # Widths in a row must sum to ≤ 12 or the last card wraps.
    rows = [
        ("ROW-kpis", [
            ("chart.01_kpi_cobertura_media", 3, 22),
            ("chart.02_kpi_criancas_em_atraso", 3, 22),
            ("chart.03_kpi_proximas_30_dias", 3, 22),
            ("chart.11_freshness", 3, 22),
        ]),
        ("ROW-trends", [
            ("chart.04_timeline_doses", 6, 50),
            ("chart.07_timeliness", 6, 50),
        ]),
        ("ROW-atraso", [
            ("chart.06_heatmap_atraso", 12, 55),
        ]),
        ("ROW-anomalias", [
            ("chart.10_registros_suspeitos", 7, 55),
            ("chart.08_dropout_serie", 5, 55),
        ]),
    ]

    position: dict[str, Any] = {
        "DASHBOARD_VERSION_KEY": "v2",
        "ROOT_ID": {
            "type": "ROOT",
            "id": "ROOT_ID",
            "children": ["GRID_ID"],
        },
        "GRID_ID": {
            "type": "GRID",
            "id": "GRID_ID",
            "children": [r[0] for r in rows],
            "parents": ["ROOT_ID"],
        },
        "HEADER_ID": {
            "type": "HEADER",
            "id": "HEADER_ID",
            "meta": {"text": "Gestão de Imunização — Visão Operacional"},
        },
    }
    for row_id, charts in rows:
        children: list[str] = []
        for key, width, height in charts:
            node = chart_node(key, width, height, row_id)
            position[node["id"]] = node
            children.append(node["id"])
        position[row_id] = {
            "type": "ROW",
            "id": row_id,
            "children": children,
            "parents": ["ROOT_ID", "GRID_ID"],
            "meta": {"background": "BACKGROUND_TRANSPARENT"},
        }
    return position


# Default scope = applies to entire dashboard. See FilterScope/utils.ts
# (getDefaultRootScope) and the canonical Filter fixture in state.test.ts.
# Every NATIVE_FILTER in json_metadata MUST carry: scope, cascadeParentIds,
# defaultDataMask, description — otherwise the frontend's
# getChartIdsInFilterScope(filter.scope, ...) throws
# "Cannot read properties of undefined (reading 'selectedLayers')" at
# AppContainer render time and the whole dashboard fails to mount.
_DEFAULT_SCOPE: dict = {"rootPath": ["ROOT_ID"], "excluded": []}


def _filter(
    id_: str,
    name: str,
    filter_type: str,
    targets: list[dict],
    *,
    control_values: dict | None = None,
    default_data_mask: dict | None = None,
) -> dict:
    """Build a native filter spec with all fields required by the dashboard
    frontend pre-filled."""
    return {
        "id": id_,
        "name": name,
        "filterType": filter_type,
        "type": "NATIVE_FILTER",
        "targets": targets,
        "scope": _DEFAULT_SCOPE,
        "cascadeParentIds": [],
        "controlValues": control_values or {},
        "defaultDataMask": default_data_mask or {},
        "description": "",
    }


# ---------------------------------------------------------------------------
# Native-filter specs (dataset key + column name; datasetId resolved at
# build time inside ``build_native_filters``).
#
# Each filter is anchored to ONE dataset whose distinct values populate the
# dropdown. When applied, Superset uses the column NAME as the WHERE
# predicate — so charts on other datasets are still filtered as long as
# they expose the same column. The companion calc cols (vaccine_name,
# dose_label) live on every dataset that needs to participate in cross-
# filtering; datasets that don't have the column are simply skipped.
# ---------------------------------------------------------------------------

_NATIVE_FILTER_SPECS: list[dict] = [
    {
        "id": "NATIVE_FILTER-municipality",
        "name": "Município",
        "filter_type": "filter_select",
        # Ranking carries every IBGE that ever appeared, plus the
        # municipality_name column from s3_dim_municipality. Anchoring
        # here keeps the dropdown dense AND human-readable. Every other
        # gold mart also carries municipality_name (same JOIN), so the
        # filter applies cross-chart.
        "dataset_key": "dataset.municipality_ranking_daily",
        "column": "municipality_name",
        "control_values": {
            "multiSelect": True,
            "enableEmptyFilter": False,
            "inverseSelection": False,
            "searchAllOptions": True,
        },
        # Default to the active municipality pilot. Other municipalities
        # only appear in the data as cross-jurisdiction noise (patients
        # from neighbouring cities registered/treated in this IBGE's
        # establishments). The operational dashboard is scoped to the
        # pilot's own residents — users can clear/swap the filter to
        # widen the view if needed.
        "default_data_mask": {
            "filterState": {"value": [_PILOT_MUNICIPALITY_NAME]},
        },
    },
    {
        "id": "NATIVE_FILTER-vaccine",
        "name": "Vacina",
        "filter_type": "filter_select",
        "dataset_key": "dataset.status_aggregate_daily",
        "column": "vaccine_name",
        "control_values": {
            "multiSelect": True,
            "enableEmptyFilter": False,
            "searchAllOptions": True,
        },
    },
    {
        "id": "NATIVE_FILTER-dose",
        "name": "Dose",
        "filter_type": "filter_select",
        "dataset_key": "dataset.status_aggregate_daily",
        "column": "dose_label",
        "control_values": {
            "multiSelect": True,
            "enableEmptyFilter": False,
            "searchAllOptions": True,
        },
    },
    {
        "id": "NATIVE_FILTER-ref-date",
        "name": "Período",
        "filter_type": "filter_time",
        # Time filter has no column target — Superset resolves the temporal
        # column from each chart's main_dttm_col.
        "dataset_key": None,
        "column": None,
        "control_values": {},
        "default_data_mask": {"filterState": {"value": "Last year"}},
    },
]


def build_native_filters(dataset_id_by_key: dict[str, int]) -> list[dict]:
    """Resolve ``_NATIVE_FILTER_SPECS`` against live dataset ids.

    The frontend dropdown for a select filter requires
    ``targets[].datasetId`` — without it Superset cannot query distinct
    values and the dropdown displays only ``<NULL>``.
    """
    filters: list[dict] = []
    for spec in _NATIVE_FILTER_SPECS:
        if spec["dataset_key"] is None:
            targets: list[dict] = [{}]
        else:
            dataset_id = dataset_id_by_key.get(spec["dataset_key"])
            if dataset_id is None:
                raise SystemExit(
                    f"Native filter {spec['id']} references unknown dataset "
                    f"key {spec['dataset_key']}"
                )
            targets = [
                {
                    "datasetId": dataset_id,
                    "column": {"name": spec["column"]},
                }
            ]
        filters.append(
            _filter(
                spec["id"],
                spec["name"],
                spec["filter_type"],
                targets,
                control_values=spec.get("control_values"),
                default_data_mask=spec.get("default_data_mask"),
            )
        )
    return filters


# ---------------------------------------------------------------------------
# Provisioning
# ---------------------------------------------------------------------------


# Fields Superset's DatasetMetricPutSchema / DatasetColumnPutSchema accept
# (see superset/datasets/schemas.py).  The GET response includes extra
# read-only fields (changed_on, created_on, created_by, etc.) that PUT
# rejects with Marshmallow "Unknown field." errors, so we project the GET
# response down to these allowlists before re-PUTting.
#
# ``id`` MUST be included for entries that already exist — it is the upsert
# key.  If you POST a metric back without ``id``, Superset tries to *create*
# a duplicate and 422s with "Uma ou mais métricas já existem".
_METRIC_PUT_FIELDS = frozenset({
    "id", "uuid",
    "metric_name", "expression", "metric_type", "description",
    "verbose_name", "d3format", "currency", "warning_text", "extra",
})
_COLUMN_PUT_FIELDS = frozenset({
    "id", "uuid",
    "column_name", "expression", "type", "advanced_data_type",
    "verbose_name", "description",
    "filterable", "groupby", "is_active", "is_dttm", "python_date_format",
    "extra",
})


def _project(d: dict, allowed: frozenset[str]) -> dict:
    """Project a dict to only the keys in ``allowed``."""
    return {k: v for k, v in d.items() if k in allowed}


def ensure_dataset(
    c: SupersetClient,
    dataset_spec: dict,
    database_id: int,
    schema: str,
    dry_run: bool,
) -> int:
    dataset_uuid = UUIDS[dataset_spec["key"]]
    existing = find_dataset_by_uuid(c, dataset_uuid)
    if existing:
        LOG.info("dataset %s already exists (id=%s)", dataset_spec["table_name"], existing["id"])
        dataset_id = existing["id"]
    else:
        payload = {
            "database": database_id,
            "schema": schema,
            "table_name": dataset_spec["table_name"],
            "owners": [],
        }
        if dry_run:
            LOG.info("[dry-run] would create dataset %s", payload)
            return -1
        result = c.post("/api/v1/dataset/", payload)
        dataset_id = result["id"]
        LOG.info("created dataset %s (id=%s)", dataset_spec["table_name"], dataset_id)
        c.put(
            f"/api/v1/dataset/{dataset_id}",
            {"uuid": dataset_uuid, "cache_timeout": dataset_spec.get("cache_timeout")},
        )

    # Re-introspect the underlying table so dbt-added columns surface in
    # Superset's column list. Without this, charts that reference newly
    # added columns (e.g. municipality_name from the s3_dim_municipality
    # JOIN) fail with "Faltam colunas no conjunto de dados".
    if not dry_run:
        c.put(f"/api/v1/dataset/{dataset_id}/refresh", {})
        LOG.debug("refreshed dataset metadata %s (id=%s)", dataset_spec["table_name"], dataset_id)

    # Push metrics & calculated columns (idempotent: pull current, merge)
    full = c.get(f"/api/v1/dataset/{dataset_id}")["result"]
    current_metrics = {m["metric_name"] for m in full.get("metrics", [])}
    new_metrics = [
        m for m in dataset_spec.get("metrics", [])
        if m["metric_name"] not in current_metrics
    ]
    current_cols = {c["column_name"] for c in full.get("columns", [])}
    new_calc_cols = [
        c for c in dataset_spec.get("calculated_columns", [])
        if c["column_name"] not in current_cols
    ]
    # Compute label updates for NATIVE columns missing or stale verbose_name.
    # Use the dataset-level override map if provided, else fall back to the
    # global _COLUMN_LABELS map. We only flag this work; the PUT below carries
    # the merged column list.
    label_map: dict[str, str] = {
        **_COLUMN_LABELS,
        **(dataset_spec.get("column_verbose_names") or {}),
    }
    labels_to_apply: dict[str, str] = {}
    for col in full.get("columns", []):
        col_name = col.get("column_name")
        desired = label_map.get(col_name)
        if desired and col.get("verbose_name") != desired:
            labels_to_apply[col_name] = desired

    if new_metrics or new_calc_cols or labels_to_apply:
        payload: dict[str, Any] = {}
        if new_metrics:
            existing_metrics = [
                _project(m, _METRIC_PUT_FIELDS) for m in full.get("metrics", [])
            ]
            payload["metrics"] = existing_metrics + new_metrics
        if new_calc_cols or labels_to_apply:
            # Project + apply verbose-name updates in-place on existing cols.
            existing_cols = []
            for col in full.get("columns", []):
                projected = _project(col, _COLUMN_PUT_FIELDS)
                name = projected.get("column_name")
                if name in labels_to_apply:
                    projected["verbose_name"] = labels_to_apply[name]
                existing_cols.append(projected)
            # NB: ``groupby=True`` is REQUIRED — calc cols are only offered as
            # a dimension in chart configs (and accepted by the explore API)
            # when this flag is true. Charts that reference these columns in
            # ``groupby``/``groupbyRows``/``groupbyColumns`` need this.
            new_cols_with_defaults = [
                {
                    "column_name": col["column_name"],
                    "expression": col.get("expression"),
                    "type": col.get("type"),
                    "verbose_name": col.get("verbose_name"),
                    "description": col.get("description"),
                    "filterable": True,
                    "groupby": True,
                    "is_active": True,
                }
                for col in new_calc_cols
            ]
            payload["columns"] = existing_cols + new_cols_with_defaults
        if dry_run:
            LOG.info(
                "[dry-run] would PUT dataset %s with %d new metric(s), %d new calc col(s), %d label(s)",
                dataset_spec["table_name"], len(new_metrics), len(new_calc_cols),
                len(labels_to_apply),
            )
        else:
            c.put(f"/api/v1/dataset/{dataset_id}?override_columns=true", payload)
            LOG.info(
                "updated dataset %s: +%d metric(s), +%d calc col(s), +%d label(s)",
                dataset_spec["table_name"], len(new_metrics), len(new_calc_cols),
                len(labels_to_apply),
            )
    return dataset_id


def ensure_chart(
    c: SupersetClient,
    chart_spec: dict,
    dataset_id_by_key: dict[str, int],
    dry_run: bool,
) -> int:
    chart_uuid = chart_spec.get("uuid") or UUIDS[chart_spec["key"]]
    existing = find_chart_by_uuid(c, chart_uuid)
    dataset_id = dataset_id_by_key[chart_spec["dataset_key"]]
    params = dict(chart_spec["params"])
    params["datasource"] = f"{dataset_id}__table"
    params["viz_type"] = chart_spec["viz_type"]
    payload = {
        "slice_name": chart_spec["slice_name"],
        "viz_type": chart_spec["viz_type"],
        "datasource_id": dataset_id,
        "datasource_type": "table",
        "params": json.dumps(params, default=str),
    }
    if existing:
        if dry_run:
            LOG.info("[dry-run] would PUT chart %s (id=%s)", chart_spec["slice_name"], existing["id"])
            return existing["id"]
        c.put(f"/api/v1/chart/{existing['id']}", payload)
        LOG.info("updated chart %s (id=%s)", chart_spec["slice_name"], existing["id"])
        return existing["id"]
    if dry_run:
        LOG.info("[dry-run] would CREATE chart %s", chart_spec["slice_name"])
        return -1
    result = c.post("/api/v1/chart/", payload)
    chart_id = result["id"]
    c.put(f"/api/v1/chart/{chart_id}", {"uuid": chart_uuid})
    LOG.info("created chart %s (id=%s)", chart_spec["slice_name"], chart_id)
    return chart_id


# Charts that USED to be on this dashboard but have been deliberately
# retired. Their UUIDs remain in UUIDS so we can find their existing
# Superset records and detach them on the next bootstrap run. Add a key
# here when removing a chart from CHARTS — never silently delete from
# UUIDS, because that breaks idempotent cleanup.
_RETIRED_CHART_KEYS: frozenset[str] = frozenset({
    # 5. Ranking pivot — replaced by single-municipality default scope.
    "chart.05_mapa_alerta",
    # 9. Ranking table — same reason; user only operates one IBGE today.
    "chart.09_ranking_municipios",
})


def detach_retired_charts(
    c: SupersetClient,
    dashboard_id: int,
    dry_run: bool,
) -> None:
    """Remove dashboard linkage from charts that have been retired.

    Leaves the chart records intact in Superset's catalog (so any user
    edits, annotations, alerts they own are preserved), but unlinks them
    from the dashboard so they no longer show up in the Edit-mode chart
    list or in the "unassigned" pool.
    """
    detached = 0
    for key in _RETIRED_CHART_KEYS:
        chart_uuid = UUIDS.get(key)
        if not chart_uuid:
            continue
        chart = find_chart_by_uuid(c, chart_uuid)
        if not chart:
            continue
        current = c.get(f"/api/v1/chart/{chart['id']}")["result"]
        existing_dash_ids = {
            d["id"] for d in current.get("dashboards", []) if "id" in d
        }
        if dashboard_id not in existing_dash_ids:
            continue
        new_ids = sorted(existing_dash_ids - {dashboard_id})
        if dry_run:
            LOG.info(
                "[dry-run] would detach retired chart %s (id=%s) from dashboard %s",
                key, chart["id"], dashboard_id,
            )
            continue
        c.put(f"/api/v1/chart/{chart['id']}", {"dashboards": new_ids})
        LOG.info(
            "detached retired chart %s (id=%s) from dashboard id=%s",
            key, chart["id"], dashboard_id,
        )
        detached += 1
    if detached:
        LOG.info("detached %d retired chart(s) from dashboard id=%s", detached, dashboard_id)


PTM_TAG_NAME = "PTM"

# superset/tags/models.py::ObjectType — used in the tag API path.
_TAG_OBJECT_TYPE_DASHBOARD = 3


def ensure_ptm_tag(c: SupersetClient, dashboard_id: int, dry_run: bool) -> None:
    """Tag the dashboard with ``PTM`` so isPtmDashboard() returns true.

    Uses ``POST /api/v1/tag/<object_type>/<object_id>/`` with body
    ``{"properties": {"tags": ["PTM"]}}`` (see TagRestApi.add_objects in
    superset/tags/api.py). This endpoint creates the tag on-the-fly if it
    does not exist yet, so we don't need a separate ensure-tag step.
    """
    if dry_run:
        LOG.info("[dry-run] would tag dashboard id=%s with %s", dashboard_id, PTM_TAG_NAME)
        return
    path = f"/api/v1/tag/{_TAG_OBJECT_TYPE_DASHBOARD}/{dashboard_id}/"
    c.post(path, {"properties": {"tags": [PTM_TAG_NAME]}})
    LOG.info("tagged dashboard id=%s with %s", dashboard_id, PTM_TAG_NAME)


def detach_orphan_charts_from_dashboard(
    c: SupersetClient,
    dashboard_id: int,
    keep_chart_ids: set[int],
    dry_run: bool,
) -> None:
    """Strip dashboard_id from chart.dashboards for charts not in the new layout.

    Superset renders ANY chart whose ``chart.dashboards`` includes the
    dashboard, regardless of whether it appears in ``position_json``. If we
    removed a chart from the layout we MUST also detach it here, otherwise
    it shows up at the bottom of the dashboard.
    """
    # rel_m_m=N filter: charts whose dashboards relation includes this id.
    res = c.get(
        f"/api/v1/chart/?q=(page_size:200,filters:!("
        f"(col:dashboards,opr:rel_m_m,value:{dashboard_id})))"
    )
    orphans: list[tuple[int, str]] = []
    for ch in res.get("result", []):
        cid = ch["id"]
        if cid in keep_chart_ids:
            continue
        orphans.append((cid, ch.get("slice_name", "?")))
    if not orphans:
        return
    if dry_run:
        for cid, name in orphans:
            LOG.info(
                "[dry-run] would detach orphan chart id=%s '%s' from dashboard id=%s",
                cid, name, dashboard_id,
            )
        return
    for cid, name in orphans:
        current = c.get(f"/api/v1/chart/{cid}")["result"]
        kept = sorted(
            {d["id"] for d in current.get("dashboards", []) if "id" in d}
            - {dashboard_id}
        )
        c.put(f"/api/v1/chart/{cid}", {"dashboards": kept})
        LOG.info(
            "detached orphan chart id=%s '%s' from dashboard id=%s",
            cid, name, dashboard_id,
        )


def attach_charts_to_dashboard(
    c: SupersetClient,
    chart_id_by_key: dict[str, int],
    dashboard_id: int,
    dry_run: bool,
) -> None:
    """Associate every chart with the dashboard so it renders.

    Superset's dashboard ↔ chart relation lives on the chart side (the
    ``slice.dashboards`` collection).  Dashboard PUT accepts ``position_json``
    and ``json_metadata`` but **not** ``slices`` — without per-chart PUT,
    every cell in the layout shows "Não há definição de gráfico associada".

    PUT semantics: the ``dashboards`` field is *replaced* on each call. We
    GET, merge, PUT, then re-GET and retry once. The re-check guards against
    lost-update if another process modifies the chart concurrently and
    against silent backend drops.
    """
    if dry_run:
        LOG.info(
            "[dry-run] would attach %d chart(s) to dashboard id=%s",
            len(chart_id_by_key), dashboard_id,
        )
        return
    attached = 0
    skipped = 0
    failed: list[tuple[str, int]] = []
    for key, chart_id in chart_id_by_key.items():
        if chart_id < 0:
            continue
        for attempt in range(2):
            current = c.get(f"/api/v1/chart/{chart_id}")["result"]
            existing_dash_ids = {
                d["id"] for d in current.get("dashboards", []) if "id" in d
            }
            if dashboard_id in existing_dash_ids:
                if attempt == 0:
                    skipped += 1
                break
            merged = sorted(existing_dash_ids | {dashboard_id})
            c.put(f"/api/v1/chart/{chart_id}", {"dashboards": merged})
            verify = c.get(f"/api/v1/chart/{chart_id}")["result"]
            verify_ids = {
                d["id"] for d in verify.get("dashboards", []) if "id" in d
            }
            if dashboard_id in verify_ids:
                attached += 1
                break
            LOG.warning(
                "chart id=%s attach to dashboard %s not persisted (attempt %d); retrying",
                chart_id, dashboard_id, attempt + 1,
            )
        else:
            failed.append((key, chart_id))
    LOG.info(
        "attached %d chart(s) to dashboard id=%s (already-attached=%d, failed=%d)",
        attached, dashboard_id, skipped, len(failed),
    )
    if failed:
        for key, chart_id in failed:
            LOG.error("FAILED to attach chart %s (id=%s) to dashboard %s",
                      key, chart_id, dashboard_id)


def ensure_dashboard(
    c: SupersetClient,
    chart_id_by_key: dict[str, int],
    dataset_id_by_key: dict[str, int],
    dry_run: bool,
) -> str:
    dash_uuid = UUIDS["dashboard.gestao_imunizacao_operacional"]
    position = build_dashboard_position(chart_id_by_key)
    # ptm_autoconvert=true makes the save hook keep any non-PTM chart users add
    # later auto-converted to PTM equivalents on save. See ptmChartMapping.ts
    # (isPtmAutoconvertEnabled()) in superset-portal.
    metadata = {
        "color_scheme": "supersetColors",
        "refresh_frequency": 300,
        "native_filter_configuration": build_native_filters(dataset_id_by_key),
        "cross_filters_enabled": True,
        "ptm_autoconvert": True,
    }
    payload = {
        "dashboard_title": "Gestão de Imunização — Visão Operacional",
        "slug": "gestao-imunizacao-operacional",
        "published": True,
        "position_json": json.dumps(position),
        "json_metadata": json.dumps(metadata),
    }
    existing = find_dashboard_by_uuid(c, dash_uuid)
    if existing:
        dash_id = existing["id"]
        if dry_run:
            LOG.info("[dry-run] would PUT dashboard id=%s", dash_id)
        else:
            c.put(f"/api/v1/dashboard/{dash_id}", payload)
            LOG.info("updated dashboard id=%s", dash_id)
        slug = existing.get("slug") or "gestao-imunizacao-operacional"
    else:
        if dry_run:
            LOG.info("[dry-run] would CREATE dashboard")
            return f"{c.base_url}/superset/dashboard/gestao-imunizacao-operacional/"
        result = c.post("/api/v1/dashboard/", payload)
        dash_id = result["id"]
        c.put(f"/api/v1/dashboard/{dash_id}", {"uuid": dash_uuid})
        slug = "gestao-imunizacao-operacional"
        LOG.info("created dashboard id=%s", dash_id)

    attach_charts_to_dashboard(c, chart_id_by_key, dash_id, dry_run)
    detach_retired_charts(c, dash_id, dry_run)
    ensure_ptm_tag(c, dash_id, dry_run)
    return f"{c.base_url}/superset/dashboard/{slug}/"


# ===========================================================================
# v2 — Immunization Dashboard v2: "Gestão de Imunização — Visão Operacional v2"
# ===========================================================================

# ---------------------------------------------------------------------------
# v2 Datasets
# ---------------------------------------------------------------------------

DATASETS_V2: list[dict] = [
    # New marts ----------------------------------------------------------------
    {
        "key": "dataset.operational_backlog_daily_v2",
        "table_name": "gold_immunization_operational_backlog_daily",
        "main_dttm_col": "ref_date",
        "cache_timeout": 900,
        "metrics": [
            {
                "metric_name": "overdue_count_v2",
                "verbose_name": "Doses em atraso",
                "expression": "SUM(overdue_count)",
                "d3format": ",",
            },
            {
                "metric_name": "due_count_v2",
                "verbose_name": "Doses devidas hoje",
                "expression": "SUM(due_count)",
                "d3format": ",",
            },
            {
                "metric_name": "upcoming_count_v2",
                "verbose_name": "A vencer em 30d",
                "expression": "SUM(upcoming_count)",
                "d3format": ",",
            },
            {
                "metric_name": "applied_count_v2",
                "verbose_name": "Doses aplicadas",
                "expression": "SUM(applied_count)",
                "d3format": ",",
            },
            {
                "metric_name": "total_pairs_v2",
                "verbose_name": "Total criança × regra",
                "expression": "SUM(child_rule_pairs)",
                "d3format": ",",
            },
            {
                "metric_name": "overdue_share_v2",
                "verbose_name": "% Atrasadas",
                "expression": (
                    "SAFE_DIVIDE(SUM(overdue_count), NULLIF(SUM(child_rule_pairs), 0))"
                ),
                "d3format": ".1%",
            },
        ],
    },
    {
        "key": "dataset.priority_daily_v2",
        "table_name": "gold_immunization_priority_daily_v2",
        "main_dttm_col": "ref_date",
        "cache_timeout": 900,
        "metrics": [
            {
                "metric_name": "max_priority_score",
                "verbose_name": "Score máx. de prioridade",
                "expression": "MAX(priority_score)",
                "d3format": ".2f",
            },
            {
                "metric_name": "overdue_total_prio",
                "verbose_name": "Doses em atraso (priorit.)",
                "expression": "SUM(overdue_total)",
                "d3format": ",",
            },
        ],
    },
    {
        "key": "dataset.dropout_by_series_v2",
        "table_name": "gold_immunization_dropout_by_series_v2",
        "main_dttm_col": None,
        "cache_timeout": 3600,
        "metrics": [
            {
                "metric_name": "effective_dropout_avg",
                "verbose_name": "Abandono efetivo médio",
                "expression": "AVG(effective_dropout_rate)",
                "d3format": ".1%",
            },
            {
                "metric_name": "applied_from_total",
                "verbose_name": "Crianças na dose inicial",
                "expression": "SUM(applied_from_count)",
                "d3format": ",",
            },
        ],
    },
    {
        "key": "dataset.data_quality_daily_v2",
        "table_name": "gold_immunization_data_quality_daily",
        "main_dttm_col": "reference_month",
        "cache_timeout": 1800,
        "metrics": [
            {
                "metric_name": "issue_count_total",
                "verbose_name": "Total de inconsistências",
                "expression": "SUM(issue_count)",
                "d3format": ",",
            },
            {
                "metric_name": "critical_issue_count",
                "verbose_name": "Inconsistências críticas",
                "expression": "SUM(CASE WHEN severity = 'critical' THEN issue_count ELSE 0 END)",
                "d3format": ",",
            },
        ],
    },
    # Reused v1 datasets — referenced by v2 charts
    {
        "key": "dataset.timeliness_monthly",
        "table_name": "gold_immunization_timeliness_monthly",
        "main_dttm_col": "reference_month",
        "cache_timeout": 1800,
        "metrics": [
            {
                "metric_name": "on_time",
                "verbose_name": "No prazo",
                "expression": "SUM(on_time_count)",
            },
            {
                "metric_name": "late",
                "verbose_name": "Atrasadas",
                "expression": "SUM(late_count)",
            },
            {
                "metric_name": "matched_total",
                "verbose_name": "Total com regra",
                "expression": "SUM(total_with_schedule_match)",
            },
        ],
    },
    {
        "key": "dataset.data_freshness",
        "table_name": "gold_immunization_data_freshness",
        "main_dttm_col": "checked_at",
        "cache_timeout": 300,
        "metrics": [
            {
                "metric_name": "minutes_since_last_ingestion",
                "verbose_name": "Minutos desde última ingestão",
                "expression": (
                    "TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), "
                    "MAX(s3_enriched_max_ingestion_ts), MINUTE)"
                ),
                "d3format": ",",
            },
            {
                "metric_name": "last_rnds_ingestion_ts",
                "verbose_name": "Última atualização da RNDS",
                "expression": "MAX(s3_enriched_max_ingestion_ts)",
                "d3format": "%d/%m/%Y %H:%M",
            },
        ],
    },
]


# ---------------------------------------------------------------------------
# v2 Charts
# ---------------------------------------------------------------------------

CHARTS_V2: list[dict] = [
    # -------------------------------------------------------------------------
    # Section 1 — Executive Summary
    # -------------------------------------------------------------------------
    {
        "key": "chart.v2.01_kpi_overdue",
        "slice_name": "Doses em atraso (hoje)",
        "viz_type": "ptm_big_number_total",
        "dataset_key": "dataset.operational_backlog_daily_v2",
        "params": _ptm_kpi(
            icon_name="AlertTriangle",
            icon_color="#C62828",
            icon_background_color="#FFEBEE",
            additional_text="Crianças com doses em atraso em relação ao calendário",
            extra={
                "metric": "overdue_count_v2",
                "adhoc_filters": [],
                **_SNAPSHOT_TIME_RANGE,
                "y_axis_format": ",",
            },
        ),
    },
    {
        "key": "chart.v2.02_kpi_due_next_30",
        "slice_name": "A vencer nos próximos 30 dias",
        "viz_type": "ptm_big_number_total",
        "dataset_key": "dataset.operational_backlog_daily_v2",
        "params": _ptm_kpi(
            icon_name="CalendarClock",
            icon_color="#EF6C00",
            icon_background_color="#FFF3E0",
            additional_text="Doses com vencimento em até 30 dias a partir de hoje",
            extra={
                "metric": "upcoming_count_v2",
                "adhoc_filters": [],
                **_SNAPSHOT_TIME_RANGE,
                "y_axis_format": ",",
            },
        ),
    },
    {
        "key": "chart.v2.03_kpi_applied",
        "slice_name": "Doses aplicadas (visão atual)",
        "viz_type": "ptm_big_number_total",
        "dataset_key": "dataset.operational_backlog_daily_v2",
        "params": _ptm_kpi(
            icon_name="Syringe",
            icon_color="#00796B",
            icon_background_color="#E0F2F1",
            additional_text="Total de doses já aplicadas no calendário de vacinação",
            extra={
                "metric": "applied_count_v2",
                "adhoc_filters": [],
                **_SNAPSHOT_TIME_RANGE,
                "y_axis_format": ",",
            },
        ),
    },
    {
        "key": "chart.v2.04_kpi_freshness",
        "slice_name": "Última atualização da RNDS",
        "viz_type": "ptm_big_number_total",
        "dataset_key": "dataset.data_freshness",
        "params": _ptm_kpi(
            icon_name="RefreshCw",
            icon_color="#0288D1",
            icon_background_color="#E1F5FE",
            additional_text="Data e hora da última carga de dados do RNDS",
            extra={
                "metric": "last_rnds_ingestion_ts",
                "adhoc_filters": [],
                **_SNAPSHOT_TIME_RANGE,
                "force_timestamp_formatting": True,
                "time_format": "%d/%m/%Y %H:%M",
                # Timestamp string is long; shrink so it fits the KPI card.
                "header_font_size": 0.18,
            },
        ),
    },
    {
        "key": "chart.v2.05_kpi_dq_issues",
        "slice_name": "Inconsistências de dados (90d)",
        "viz_type": "ptm_big_number_total",
        "dataset_key": "dataset.data_quality_daily_v2",
        "params": _ptm_kpi(
            icon_name="ShieldAlert",
            icon_color="#6A1B9A",
            icon_background_color="#F3E5F5",
            additional_text="Total de registros suspeitos nos últimos 90 dias",
            extra={
                "metric": "issue_count_total",
                "adhoc_filters": [_filter_temporal("reference_month")],
                "time_range": "last 90 days",
                "y_axis_format": ",",
            },
        ),
    },
    {
        "key": "chart.v2.06_priority_ranking",
        "slice_name": "Ranking de prioridade por município",
        "viz_type": "ptm_table",
        "dataset_key": "dataset.priority_daily_v2",
        "params": {
            "metrics": [
                _metric("Pontuação", "MAX", "priority_score"),
                _metric("Em atraso", "SUM", "overdue_total"),
                _metric("% Atraso", "MAX", "overdue_share"),
            ],
            "groupby": [
                "municipality_name",
                "priority_category",
                "recommended_action",
            ],
            "adhoc_filters": [],
            **_SNAPSHOT_TIME_RANGE,
            "row_limit": 50,
            "page_length": 20,
            "include_search": True,
            "show_cell_bars": True,
            "table_timestamp_format": "smart_date",
        },
    },
    {
        "key": "chart.v2.07_backlog_vaccine",
        "slice_name": "Doses em atraso por vacina e dose",
        "viz_type": "ptm_echarts_timeseries",
        "dataset_key": "dataset.operational_backlog_daily_v2",
        "params": {
            # Snapshot view: x-axis is the categorical dimension (vaccine),
            # not the ref_date — the mart only carries one ref_date today
            # so a time-grain x-axis would render empty.
            "x_axis": "vaccine_name",
            "metrics": [_metric("Doses em atraso", "SUM", "overdue_count")],
            "groupby": ["dose_label"],
            "adhoc_filters": [],
            **_SNAPSHOT_TIME_RANGE,
            "row_limit": 50000,
            "color_scheme": "supersetColors",
            "show_legend": True,
            "y_axis_format": ",",
            "ptm_series_type": "bar",
            "orientation": "horizontal",
            **_PTM_BAR_RADIUS,
            **_PTM_ZOOM,
            **_PTM_STACKED_BAR,
        },
    },
    {
        "key": "chart.v2.08_timeliness_trend",
        "slice_name": "Pontualidade — doses no prazo vs atrasadas",
        "viz_type": "ptm_mixed_timeseries",
        "dataset_key": "dataset.timeliness_monthly",
        "params": {
            "x_axis": "reference_month",
            "time_grain_sqla": "P1M",
            "metrics": [_metric("No prazo", "SUM", "on_time_count")],
            "metrics_b": [_metric("Atrasadas", "SUM", "late_count")],
            "groupby": [],
            "groupby_b": [],
            "adhoc_filters": [_filter_temporal("reference_month")],
            "adhoc_filters_b": [_filter_temporal("reference_month")],
            "seriesType": "echarts_timeseries_bar",
            "seriesTypeB": "echarts_timeseries_line",
            "show_legend": True,
            "y_axis_format": ",",
            "x_axis_time_format": "smart_date",
            **_PTM_SHOW_VALUE,
            "show_valueB": True,
        },
    },
    {
        "key": "chart.v2.09_coverage_heatmap",
        "slice_name": "Cobertura por vacina × dose",
        "viz_type": "ptm_pivot_table",
        "dataset_key": "dataset.operational_backlog_daily_v2",
        "params": {
            "groupbyRows": ["vaccine_name"],
            "groupbyColumns": ["dose_label"],
            # Real coverage: SUM(applied) / SUM(child × rule pairs).
            # AVG(overdue_share) was misleading — it averaged shares across
            # cells, not weighted by population, AND it measured overdue, not
            # applied. Compose an adhoc metric so we can reference the v2-
            # registered metrics without a JOIN.
            "metrics": [
                {
                    "expressionType": "SQL",
                    "label": "% Cobertura",
                    "sqlExpression": (
                        "SAFE_DIVIDE(SUM(applied_count), "
                        "NULLIF(SUM(child_rule_pairs), 0))"
                    ),
                    "hasCustomLabel": True,
                    "optionName": "metric_coverage_v2",
                }
            ],
            "metricsLayout": "COLUMNS",
            "adhoc_filters": [],
            **_SNAPSHOT_TIME_RANGE,
            "row_limit": 10000,
            "valueFormat": ".1%",
            "rowOrder": "value_z_to_a",
            "colOrder": "key_a_to_z",
            "aggregateFunction": "Sum",
        },
    },
    # -------------------------------------------------------------------------
    # Section 2 — Municipal Operations
    # -------------------------------------------------------------------------
    {
        "key": "chart.v2.10_backlog_establishment",
        "slice_name": "Doses em atraso por unidade de saúde",
        "viz_type": "ptm_echarts_timeseries",
        "dataset_key": "dataset.operational_backlog_daily_v2",
        "params": {
            # Snapshot view per establishment (no time series — single ref_date)
            "x_axis": "establishment_name",
            "metrics": [_metric("Doses em atraso", "SUM", "overdue_count")],
            "groupby": [],
            "adhoc_filters": [],
            **_SNAPSHOT_TIME_RANGE,
            "row_limit": 50,
            "color_scheme": "supersetColors",
            "show_legend": False,
            "y_axis_format": ",",
            "ptm_series_type": "bar",
            "orientation": "horizontal",
            "x_axis_sort": "Doses em atraso",
            "x_axis_sort_asc": False,
            **_PTM_BAR_RADIUS,
            **_PTM_ZOOM,
            **_PTM_SHOW_VALUE,
        },
    },
    {
        "key": "chart.v2.11_upcoming_workload",
        "slice_name": "Carga de trabalho prevista (próximas doses)",
        "viz_type": "ptm_echarts_timeseries",
        "dataset_key": "dataset.operational_backlog_daily_v2",
        "params": {
            # Snapshot grouped bar chart per vaccine (no time series).
            "x_axis": "vaccine_name",
            "metrics": [
                _metric("A vencer", "SUM", "upcoming_count"),
                _metric("Devidas hoje", "SUM", "due_count"),
            ],
            "groupby": [],
            "adhoc_filters": [],
            **_SNAPSHOT_TIME_RANGE,
            "row_limit": 10000,
            "show_legend": True,
            "y_axis_format": ",",
            "ptm_series_type": "bar",
            **_PTM_BAR_RADIUS,
            **_PTM_ZOOM,
            **_PTM_SHOW_VALUE,
        },
    },
    {
        "key": "chart.v2.12_overdue_bucket_dist",
        "slice_name": "Distribuição de atraso por severidade",
        "viz_type": "ptm_echarts_timeseries",
        "dataset_key": "dataset.operational_backlog_daily_v2",
        "params": {
            "x_axis": "vaccine_name",
            "time_grain_sqla": "P1D",
            "metrics": [_metric("Doses em atraso", "SUM", "overdue_count")],
            "groupby": ["overdue_bucket"],
            "adhoc_filters": [],
            **_SNAPSHOT_TIME_RANGE,
            "row_limit": 10000,
            "show_legend": True,
            "y_axis_format": ",",
            "ptm_series_type": "bar",
            **_PTM_BAR_RADIUS,
            **_PTM_SHOW_VALUE,
        },
    },
    # -------------------------------------------------------------------------
    # Section 3 — Dropout Analysis
    # -------------------------------------------------------------------------
    {
        "key": "chart.v2.13_dropout_ranking",
        "slice_name": "Ranking de abandono por série vacinal",
        "viz_type": "ptm_table",
        "dataset_key": "dataset.dropout_by_series_v2",
        "params": {
            "metrics": [
                _metric("Abandono efetivo", "AVG", "effective_dropout_rate"),
                _metric("Dose inicial (N)", "SUM", "applied_from_count"),
                _metric("Dose seguinte (N)", "SUM", "applied_to_count"),
                _metric("Ranking", "MIN", "priority_rank"),
            ],
            "groupby": [
                "vaccine_name",
                "dose_from_label",
                "dose_to_label",
                "cohort_birth_year",
            ],
            "adhoc_filters": [],
            "row_limit": 100,
            "page_length": 20,
            "include_search": True,
            "show_cell_bars": True,
        },
    },
    {
        "key": "chart.v2.14_dropout_bar",
        "slice_name": "Taxa de abandono por vacina (horizontal)",
        "viz_type": "ptm_echarts_timeseries",
        "dataset_key": "dataset.dropout_by_series_v2",
        "params": {
            "x_axis": "vaccine_name",
            "time_grain_sqla": "P1D",
            "metrics": [_metric("Taxa de abandono", "AVG", "effective_dropout_rate")],
            "groupby": ["dose_from_label"],
            "adhoc_filters": [],
            "row_limit": 200,
            "show_legend": True,
            "y_axis_format": ".1%",
            "ptm_series_type": "bar",
            **_PTM_BAR_RADIUS,
            **_PTM_SHOW_VALUE,
        },
    },
    # -------------------------------------------------------------------------
    # Section 4 — Data Quality
    # -------------------------------------------------------------------------
    {
        "key": "chart.v2.15_suspicious_by_reason",
        "slice_name": "Inconsistências por tipo de problema",
        "viz_type": "ptm_echarts_timeseries",
        "dataset_key": "dataset.data_quality_daily_v2",
        "params": {
            "x_axis": "reference_month",
            "time_grain_sqla": "P1M",
            "metrics": [_metric("Inconsistências", "SUM", "issue_count")],
            "groupby": ["reason_label"],
            "adhoc_filters": [_filter_temporal("reference_month")],
            "row_limit": 50000,
            "show_legend": True,
            "x_axis_time_format": "smart_date",
            "y_axis_format": ",",
            "ptm_series_type": "bar",
            **_PTM_BAR_RADIUS,
            **_PTM_ZOOM,
            **_PTM_SHOW_VALUE,
        },
    },
    {
        "key": "chart.v2.16_suspicious_by_vaccine",
        "slice_name": "Inconsistências por vacina × dose",
        "viz_type": "ptm_table",
        "dataset_key": "dataset.data_quality_daily_v2",
        "params": {
            "metrics": [
                _metric("Total", "SUM", "issue_count"),
                _metric("Críticas", "SUM", "issue_count"),
            ],
            "groupby": [
                "vaccine_code",
                "dose_sequence",
                "reason_label",
                "severity",
                "freshness_status",
            ],
            "adhoc_filters": [_filter_temporal("reference_month")],
            "row_limit": 200,
            "page_length": 20,
            "include_search": True,
            "show_cell_bars": True,
        },
    },
    {
        "key": "chart.v2.18_unknown_municipality",
        "slice_name": "Registros com município desconhecido",
        "viz_type": "ptm_big_number_total",
        "dataset_key": "dataset.operational_backlog_daily_v2",
        "params": _ptm_kpi(
            icon_name="MapPin",
            icon_color="#795548",
            icon_background_color="#EFEBE9",
            additional_text="Crianças com código IBGE de residência não resolvido (UNKNOWN)",
            extra={
                "metric": "total_pairs_v2",
                "adhoc_filters": [
                    {
                        "expressionType": "SIMPLE",
                        "subject": "municipality_code",
                        "operator": "==",
                        "comparator": "UNKNOWN",
                        "clause": "WHERE",
                        "filterOptionName": "filter_unknown_mun",
                    }
                ],
                **_SNAPSHOT_TIME_RANGE,
                "y_axis_format": ",",
            },
        ),
    },
    # -------------------------------------------------------------------------
    # Section 5 — State Monitoring
    # NOTE: map skipped — maplibre_ptm is scatter-only (no choropleth).
    # TODO: wire s2_dim_address_with_geolocation for per-address scatter, or
    #       add a country_map-style PTM plugin.
    # -------------------------------------------------------------------------
    {
        "key": "chart.v2.19_state_priority_table",
        "slice_name": "Prioridade por município — visão estadual",
        "viz_type": "ptm_table",
        "dataset_key": "dataset.priority_daily_v2",
        "params": {
            "metrics": [
                _metric("Pontuação", "MAX", "priority_score"),
                _metric("Em atraso", "SUM", "overdue_total"),
                _metric("A vencer", "SUM", "due_count"),
            ],
            "groupby": [
                "state_name",
                "municipality_name",
                "priority_category",
                "recommended_action",
            ],
            "adhoc_filters": [],
            **_SNAPSHOT_TIME_RANGE,
            "row_limit": 200,
            "page_length": 20,
            "include_search": True,
            "show_cell_bars": True,
        },
    },
    {
        "key": "chart.v2.20_state_coverage_matrix",
        "slice_name": "Matriz de cobertura — Estado × Vacina",
        "viz_type": "ptm_pivot_table",
        "dataset_key": "dataset.operational_backlog_daily_v2",
        "params": {
            "groupbyRows": ["state_name"],
            "groupbyColumns": ["vaccine_name"],
            "metrics": [
                {
                    "expressionType": "SQL",
                    "label": "% Cobertura",
                    "sqlExpression": (
                        "SAFE_DIVIDE(SUM(applied_count), "
                        "NULLIF(SUM(child_rule_pairs), 0))"
                    ),
                    "hasCustomLabel": True,
                    "optionName": "metric_coverage_state_v2",
                }
            ],
            "metricsLayout": "COLUMNS",
            "adhoc_filters": [],
            **_SNAPSHOT_TIME_RANGE,
            "row_limit": 10000,
            "valueFormat": ".1%",
            "rowOrder": "value_z_to_a",
            "colOrder": "key_a_to_z",
            "aggregateFunction": "Sum",
        },
    },
]


# ---------------------------------------------------------------------------
# v2 Native Filters
# ---------------------------------------------------------------------------

# Single-target filters anchored to backlog dataset; Superset propagates by
# column NAME match to any chart whose dataset exposes the same column.
# Multi-target arrays are not honoured by Superset's frontend
# (filterToEdit?.targets[0] is the only one read), so we make the wider
# datasets expose the canonical column names instead.
_BACKLOG_DS = "dataset.operational_backlog_daily_v2"

_SELECT_MULTI = {
    "multiSelect": True,
    "enableEmptyFilter": False,
    "searchAllOptions": True,
}

_NATIVE_FILTER_SPECS_V2: list[dict] = [
    {
        "id": "NATIVE_FILTER_V2-state",
        "name": "Estado",
        "filter_type": "filter_select",
        "dataset_key": _BACKLOG_DS,
        "column": "state_name",
        "control_values": _SELECT_MULTI,
    },
    {
        "id": "NATIVE_FILTER_V2-municipality",
        "name": "Município",
        "filter_type": "filter_select",
        "dataset_key": _BACKLOG_DS,
        "column": "municipality_name",
        "control_values": {**_SELECT_MULTI, "inverseSelection": False},
        "default_data_mask": {
            "filterState": {"value": [_PILOT_MUNICIPALITY_NAME]},
        },
    },
    {
        "id": "NATIVE_FILTER_V2-establishment",
        "name": "Unidade de Saúde",
        "filter_type": "filter_select",
        "dataset_key": _BACKLOG_DS,
        "column": "establishment_name",
        "control_values": _SELECT_MULTI,
    },
    {
        "id": "NATIVE_FILTER_V2-vaccine",
        "name": "Vacina",
        "filter_type": "filter_select",
        "dataset_key": _BACKLOG_DS,
        "column": "vaccine_name",
        "control_values": _SELECT_MULTI,
    },
    {
        "id": "NATIVE_FILTER_V2-dose",
        "name": "Dose",
        "filter_type": "filter_select",
        "dataset_key": _BACKLOG_DS,
        "column": "dose_label",
        "control_values": _SELECT_MULTI,
    },
    {
        "id": "NATIVE_FILTER_V2-age_band",
        "name": "Faixa etária",
        "filter_type": "filter_select",
        "dataset_key": _BACKLOG_DS,
        "column": "age_band_code",
        "control_values": _SELECT_MULTI,
    },
    {
        "id": "NATIVE_FILTER_V2-status",
        "name": "Status",
        "filter_type": "filter_select",
        "dataset_key": _BACKLOG_DS,
        "column": "status_bucket",
        "control_values": {
            "multiSelect": True,
            "enableEmptyFilter": False,
            "searchAllOptions": False,
        },
    },
    {
        "id": "NATIVE_FILTER_V2-overdue_bucket",
        "name": "Gravidade do atraso",
        "filter_type": "filter_select",
        "dataset_key": _BACKLOG_DS,
        "column": "overdue_bucket",
        "control_values": {
            "multiSelect": True,
            "enableEmptyFilter": False,
            "searchAllOptions": False,
        },
    },
    {
        "id": "NATIVE_FILTER_V2-period",
        "name": "Período",
        "filter_type": "filter_time",
        "dataset_key": None,
        "column": None,
        "control_values": {},
        "default_data_mask": {"filterState": {"value": "Last 30 days"}},
    },
]


# ---------------------------------------------------------------------------
# Per-scope chart cloning
#
# PTM's plugin locks layout customization when a chart is shared across
# dashboards, and shared charts also make per-dashboard native-filter
# defaults unreliable (all tiers render the national total). So each scoped
# dashboard (state / municipality) gets its OWN exclusive copy of every
# chart, with the scope predicate baked into ``adhoc_filters`` — the data is
# correctly scoped regardless of native-filter behavior.
#
# Datasets that expose the scope columns; charts on datasets NOT listed here
# (e.g. data_freshness — RNDS freshness is national) stay global.
# ---------------------------------------------------------------------------

_SCOPE_COLUMNS_BY_DATASET: dict[str, set[str]] = {
    "dataset.operational_backlog_daily_v2": {"municipality_name", "state_name"},
    "dataset.priority_daily_v2": {"municipality_name", "state_name"},
    "dataset.dropout_by_series_v2": {"municipality_name", "state_name"},
    "dataset.data_quality_daily_v2": {"municipality_name", "state_name"},
    "dataset.timeliness_monthly": {"municipality_name", "state_name"},
}


def _scope_filter(column: str, value: str) -> dict:
    return {
        "clause": "WHERE",
        "subject": column,
        "operator": "IN",
        "comparator": [value],
        "expressionType": "SIMPLE",
    }


def scoped_chart_specs(
    scope_kind: str,
    scope_id: str,
    *,
    municipality_name: str | None = None,
    state_name: str | None = None,
) -> list[dict]:
    """Deep-copy CHARTS_V2 into a scope-exclusive set with baked filters.

    Each returned spec carries:
      - ``base_key``: the original CHARTS_V2 key (used by layout builders).
      - ``key`` / ``uuid``: scope-suffixed, stable across re-runs.
      - ``params.adhoc_filters``: scope predicate appended when the chart's
        dataset exposes ``municipality_name`` / ``state_name``.
    """
    specs: list[dict] = []
    for base in CHARTS_V2:
        spec = copy.deepcopy(base)
        base_key = base["key"]
        spec["base_key"] = base_key
        spec["key"] = f"{base_key}.{scope_kind}.{scope_id}"
        spec["uuid"] = _uid(f"{base_key}.{scope_kind}.{scope_id}")
        cols = _SCOPE_COLUMNS_BY_DATASET.get(base["dataset_key"], set())
        predicate: dict | None = None
        if municipality_name and "municipality_name" in cols:
            predicate = _scope_filter("municipality_name", municipality_name)
        elif state_name and "state_name" in cols:
            predicate = _scope_filter("state_name", state_name)
        if predicate:
            params = dict(spec["params"])
            params["adhoc_filters"] = list(
                params.get("adhoc_filters") or []
            ) + [predicate]
            spec["params"] = params
        specs.append(spec)
    return specs


def provision_scoped_charts(
    c: SupersetClient,
    dataset_id_by_key: dict[str, int],
    scope_kind: str,
    scope_id: str,
    *,
    municipality_name: str | None = None,
    state_name: str | None = None,
    dry_run: bool,
) -> dict[str, int]:
    """Create/update scope-exclusive charts; return base_key -> chart id."""
    specs = scoped_chart_specs(
        scope_kind,
        scope_id,
        municipality_name=municipality_name,
        state_name=state_name,
    )
    chart_id_by_base_key: dict[str, int] = {}
    for spec in specs:
        chart_id_by_base_key[spec["base_key"]] = ensure_chart(
            c, spec, dataset_id_by_key, dry_run
        )
    return chart_id_by_base_key


def build_native_filters_v2(
    dataset_id_by_key: dict[str, int],
    *,
    default_state_name: str | None = None,
    default_municipality_name: str | None = None,
) -> list[dict]:
    """Resolve _NATIVE_FILTER_SPECS_V2 against live dataset ids.

    Filters anchor to a single dataset; Superset propagates by column-name
    match to any chart whose dataset has a column with the same name.

    Optional scope defaults override the spec's default_data_mask so
    state/muni factory dashboards land pre-scoped.
    """
    filters: list[dict] = []
    for spec in _NATIVE_FILTER_SPECS_V2:
        if spec["dataset_key"] is None:
            targets: list[dict] = [{}]
        else:
            dataset_id = dataset_id_by_key.get(spec["dataset_key"])
            if dataset_id is None:
                raise SystemExit(
                    f"Native filter {spec['id']} references unknown dataset "
                    f"key {spec['dataset_key']}"
                )
            targets = [
                {
                    "datasetId": dataset_id,
                    "column": {"name": spec["column"]},
                }
            ]
        default_mask = dict(spec.get("default_data_mask") or {})
        if spec["id"] == "NATIVE_FILTER_V2-state" and default_state_name:
            default_mask = {"filterState": {"value": [default_state_name]}}
        if spec["id"] == "NATIVE_FILTER_V2-municipality" and default_municipality_name:
            default_mask = {"filterState": {"value": [default_municipality_name]}}
        filters.append(
            _filter(
                spec["id"],
                spec["name"],
                spec["filter_type"],
                targets,
                control_values=spec.get("control_values"),
                default_data_mask=default_mask or None,
            )
        )
    return filters


# ---------------------------------------------------------------------------
# v2 Dashboard Layout
# ---------------------------------------------------------------------------

def _build_dashboard_position_from_rows(
    chart_id_by_key: dict[str, int],
    rows: list[tuple[str, list[tuple[str, int, int]]]],
    *,
    header_text: str,
    version_key: str,
    row_prefix: str = "ROW-V2",
) -> dict[str, Any]:
    """Shared grid builder for internal / state / municipality dashboards."""

    def chart_node(key: str, width: int, height: int, parent_row: str) -> dict:
        chart_id = chart_id_by_key[key]
        slug = key.replace(".", "-").replace("/", "-")
        node_id = f"CHART-{row_prefix}-{slug}"[:50]
        return {
            "type": "CHART",
            "id": node_id,
            "children": [],
            "parents": ["ROOT_ID", "GRID_ID", parent_row],
            "meta": {
                "width": width,
                "height": height,
                "chartId": chart_id,
                "uuid": UUIDS[key],
            },
        }

    position: dict[str, Any] = {
        "DASHBOARD_VERSION_KEY": version_key,
        "ROOT_ID": {
            "type": "ROOT",
            "id": "ROOT_ID",
            "children": ["GRID_ID"],
        },
        "GRID_ID": {
            "type": "GRID",
            "id": "GRID_ID",
            "children": [r[0] for r in rows],
            "parents": ["ROOT_ID"],
        },
        "HEADER_ID": {
            "type": "HEADER",
            "id": "HEADER_ID",
            "meta": {"text": header_text},
        },
    }
    for row_id, charts in rows:
        children: list[str] = []
        for key, width, height in charts:
            node = chart_node(key, width, height, row_id)
            position[node["id"]] = node
            children.append(node["id"])
        position[row_id] = {
            "type": "ROW",
            "id": row_id,
            "children": children,
            "parents": ["ROOT_ID", "GRID_ID"],
            "meta": {"background": "BACKGROUND_TRANSPARENT"},
        }
    return position


def build_dashboard_position_v2(chart_id_by_key: dict[str, int]) -> dict[str, Any]:
    """Internal (Nacional) layout — full-width tables, DQ unknown-muni KPI."""
    rows = [
        ("ROW-V2-kpis", [
            ("chart.v2.01_kpi_overdue", 3, 22),
            ("chart.v2.02_kpi_due_next_30", 3, 22),
            ("chart.v2.03_kpi_applied", 2, 22),
            ("chart.v2.04_kpi_freshness", 2, 22),
            ("chart.v2.05_kpi_dq_issues", 2, 22),
        ]),
        ("ROW-V2-unknown-muni", [
            ("chart.v2.18_unknown_municipality", 3, 22),
        ]),
        ("ROW-V2-priority-table", [
            ("chart.v2.06_priority_ranking", 12, 55),
        ]),
        ("ROW-V2-backlog-vaccine", [
            ("chart.v2.07_backlog_vaccine", 12, 55),
        ]),
        ("ROW-V2-backlog-establishment", [
            ("chart.v2.10_backlog_establishment", 12, 55),
        ]),
        ("ROW-V2-trends", [
            ("chart.v2.08_timeliness_trend", 6, 50),
        ]),
        ("ROW-V2-workload", [
            ("chart.v2.11_upcoming_workload", 12, 55),
        ]),
        ("ROW-V2-dropout", [
            ("chart.v2.13_dropout_ranking", 6, 50),
            ("chart.v2.14_dropout_bar", 6, 50),
        ]),
        ("ROW-V2-state-priority-table", [
            ("chart.v2.19_state_priority_table", 12, 55),
        ]),
        ("ROW-V2-coverage-matrix", [
            ("chart.v2.20_state_coverage_matrix", 12, 55),
        ]),
        ("ROW-V2-dq", [
            ("chart.v2.15_suspicious_by_reason", 6, 55),
            ("chart.v2.16_suspicious_by_vaccine", 6, 55),
        ]),
    ]
    return _build_dashboard_position_from_rows(
        chart_id_by_key,
        rows,
        header_text="Gestão de Imunização — Nacional (Interno)",
        version_key="v2-internal",
    )


def build_dashboard_position_state(chart_id_by_key: dict[str, int]) -> dict[str, Any]:
    """Per-state client layout.

    Drops national-only charts:
      - chart.v2.19_state_priority_table — multi-state listing
      - chart.v2.20_state_coverage_matrix — Estado × Vacina matrix

    Keeps chart.v2.06_priority_ranking — it shows municipalities WITHIN the
    state (filter-propagated by `state_name` column-name match).
    """
    rows = [
        ("ROW-STATE-kpis", [
            ("chart.v2.01_kpi_overdue", 3, 22),
            ("chart.v2.02_kpi_due_next_30", 3, 22),
            ("chart.v2.03_kpi_applied", 2, 22),
            ("chart.v2.04_kpi_freshness", 2, 22),
            ("chart.v2.05_kpi_dq_issues", 2, 22),
        ]),
        ("ROW-STATE-priority-table", [
            ("chart.v2.06_priority_ranking", 12, 55),
        ]),
        ("ROW-STATE-coverage-heatmap", [
            ("chart.v2.09_coverage_heatmap", 12, 55),
        ]),
        ("ROW-STATE-backlog", [
            ("chart.v2.07_backlog_vaccine", 12, 55),
        ]),
        ("ROW-STATE-establishment", [
            ("chart.v2.10_backlog_establishment", 12, 55),
        ]),
        ("ROW-STATE-trends", [
            ("chart.v2.08_timeliness_trend", 12, 50),
        ]),
        ("ROW-STATE-workload", [
            ("chart.v2.11_upcoming_workload", 12, 55),
        ]),
        ("ROW-STATE-dropout", [
            ("chart.v2.13_dropout_ranking", 6, 50),
            ("chart.v2.14_dropout_bar", 6, 50),
        ]),
        ("ROW-STATE-dq", [
            ("chart.v2.15_suspicious_by_reason", 6, 55),
            ("chart.v2.16_suspicious_by_vaccine", 6, 55),
        ]),
    ]
    return _build_dashboard_position_from_rows(
        chart_id_by_key,
        rows,
        header_text="Gestão de Imunização — Estado",
        version_key="v2-state",
        row_prefix="STATE",
    )


def build_dashboard_position_muni(chart_id_by_key: dict[str, int]) -> dict[str, Any]:
    """Per-municipality client layout (single-muni grain)."""
    rows = [
        ("ROW-MUNI-kpis", [
            ("chart.v2.01_kpi_overdue", 3, 22),
            ("chart.v2.02_kpi_due_next_30", 3, 22),
            ("chart.v2.03_kpi_applied", 2, 22),
            ("chart.v2.04_kpi_freshness", 2, 22),
            ("chart.v2.05_kpi_dq_issues", 2, 22),
        ]),
        ("ROW-MUNI-establishment", [
            ("chart.v2.10_backlog_establishment", 12, 55),
        ]),
        ("ROW-MUNI-vaccine", [
            ("chart.v2.07_backlog_vaccine", 12, 55),
        ]),
        ("ROW-MUNI-workload", [
            ("chart.v2.11_upcoming_workload", 12, 55),
        ]),
        ("ROW-MUNI-trends", [
            ("chart.v2.08_timeliness_trend", 6, 50),
            ("chart.v2.14_dropout_bar", 6, 50),
        ]),
        ("ROW-MUNI-coverage", [
            ("chart.v2.09_coverage_heatmap", 12, 55),
        ]),
        ("ROW-MUNI-dq-mix", [
            ("chart.v2.12_overdue_bucket_dist", 6, 50),
            ("chart.v2.15_suspicious_by_reason", 6, 50),
        ]),
        ("ROW-MUNI-dq-table", [
            ("chart.v2.16_suspicious_by_vaccine", 12, 55),
        ]),
    ]
    return _build_dashboard_position_from_rows(
        chart_id_by_key,
        rows,
        header_text="Gestão de Imunização — Município",
        version_key="v2-muni",
        row_prefix="MUNI",
    )


def chart_keys_for_layout(position: dict[str, Any]) -> list[str]:
    """Extract chart keys referenced in a position_json grid."""
    keys: list[str] = []
    uuid_to_key = {v: k for k, v in UUIDS.items() if k.startswith("chart.")}
    for node in position.values():
        if not isinstance(node, dict) or node.get("type") != "CHART":
            continue
        chart_uuid = node.get("meta", {}).get("uuid")
        if chart_uuid and chart_uuid in uuid_to_key:
            keys.append(uuid_to_key[chart_uuid])
    return keys


def ensure_scoped_dashboard(
    c: SupersetClient,
    *,
    dash_uuid: str,
    dashboard_title: str,
    slug: str,
    position: dict[str, Any],
    chart_id_by_key: dict[str, int],
    dataset_id_by_key: dict[str, int],
    dry_run: bool,
    default_state_name: str | None = None,
    default_municipality_name: str | None = None,
) -> str:
    """Create or update a dashboard with scoped native-filter defaults."""
    layout_keys = chart_keys_for_layout(position)
    metadata = {
        "color_scheme": "supersetColors",
        "refresh_frequency": 300,
        "native_filter_configuration": build_native_filters_v2(
            dataset_id_by_key,
            default_state_name=default_state_name,
            default_municipality_name=default_municipality_name,
        ),
        "cross_filters_enabled": True,
        "ptm_autoconvert": True,
    }
    payload = {
        "dashboard_title": dashboard_title,
        "slug": slug,
        "published": True,
        "position_json": json.dumps(position),
        "json_metadata": json.dumps(metadata),
        "certified_by": "Data Engineering — PTM",
    }
    existing = find_dashboard_by_uuid(c, dash_uuid)
    if existing:
        dash_id = existing["id"]
        if dry_run:
            LOG.info("[dry-run] would PUT dashboard %s id=%s", slug, dash_id)
        else:
            c.put(f"/api/v1/dashboard/{dash_id}", payload)
            LOG.info("updated dashboard %s id=%s", slug, dash_id)
        slug = existing.get("slug") or slug
    else:
        if dry_run:
            LOG.info("[dry-run] would CREATE dashboard %s", slug)
            return f"{c.base_url}/superset/dashboard/{slug}/"
        result = c.post("/api/v1/dashboard/", payload)
        dash_id = result["id"]
        c.put(f"/api/v1/dashboard/{dash_id}", {"uuid": dash_uuid})
        LOG.info("created dashboard %s id=%s", slug, dash_id)

    subset = {k: chart_id_by_key[k] for k in layout_keys if k in chart_id_by_key}
    attach_charts_to_dashboard(c, subset, dash_id, dry_run)
    detach_orphan_charts_from_dashboard(
        c, dash_id, set(subset.values()), dry_run
    )
    ensure_ptm_tag(c, dash_id, dry_run)
    return f"{c.base_url}/superset/dashboard/{slug}/"


def ensure_dashboard_v2(
    c: SupersetClient,
    chart_id_by_key: dict[str, int],
    dataset_id_by_key: dict[str, int],
    dry_run: bool,
) -> str:
    """Internal nacional dashboard (all states, pilot muni default)."""
    position = build_dashboard_position_v2(chart_id_by_key)
    return ensure_scoped_dashboard(
        c,
        dash_uuid=UUIDS["dashboard.gestao_imunizacao_operacional_v2"],
        dashboard_title="Gestão de Imunização — Nacional (Interno)",
        slug="gestao-imunizacao-operacional-v2",
        position=position,
        chart_id_by_key=chart_id_by_key,
        dataset_id_by_key=dataset_id_by_key,
        dry_run=dry_run,
        default_municipality_name=_PILOT_MUNICIPALITY_NAME,
    )


def ensure_dashboard_state(
    c: SupersetClient,
    chart_id_by_key: dict[str, int],
    dataset_id_by_key: dict[str, int],
    scope: ScopeRow,
    dry_run: bool,
) -> str:
    uf = scope.state_code.lower()
    scoped_ids = provision_scoped_charts(
        c,
        dataset_id_by_key,
        "state",
        uf,
        state_name=scope.state_name,
        dry_run=dry_run,
    )
    position = build_dashboard_position_state(scoped_ids)
    return ensure_scoped_dashboard(
        c,
        dash_uuid=scope_dashboard_uuid("state", uf),
        dashboard_title=f"Gestão de Imunização — {scope.state_name}",
        slug=f"gestao-imunizacao-estado-{uf}",
        position=position,
        chart_id_by_key=scoped_ids,
        dataset_id_by_key=dataset_id_by_key,
        dry_run=dry_run,
        default_state_name=scope.state_name,
    )


def ensure_dashboard_muni(
    c: SupersetClient,
    chart_id_by_key: dict[str, int],
    dataset_id_by_key: dict[str, int],
    scope: ScopeRow,
    dry_run: bool,
) -> str:
    ibge = scope.municipality_code
    scoped_ids = provision_scoped_charts(
        c,
        dataset_id_by_key,
        "muni",
        ibge,
        municipality_name=scope.municipality_name,
        dry_run=dry_run,
    )
    position = build_dashboard_position_muni(scoped_ids)
    return ensure_scoped_dashboard(
        c,
        dash_uuid=scope_dashboard_uuid("muni", ibge),
        dashboard_title=(
            f"Gestão de Imunização — {scope.municipality_name}/{scope.state_code}"
        ),
        slug=f"gestao-imunizacao-municipio-{ibge}",
        position=position,
        chart_id_by_key=scoped_ids,
        dataset_id_by_key=dataset_id_by_key,
        dry_run=dry_run,
        default_state_name=scope.state_name,
        default_municipality_name=scope.municipality_name,
    )


DEFAULT_BUNDLE_DIR = Path(__file__).resolve().parent / "bundle"

V2_CHART_VERSIONS = frozenset({"v2", "per-state", "per-muni", "all"})


def municipality_dim_schema_from_gold(schema: str) -> str:
    """Infer silver3 dataset id for s3_dim_municipality from gold schema name."""
    if schema.endswith("_gold"):
        return schema[: -len("_gold")]
    return schema


def pilot_scope_rows() -> list[ScopeRow]:
    """Hardcoded pilot row when the BQ activation registry is unreachable."""
    return [
        ScopeRow(
            municipality_code=_PILOT_MUNICIPALITY_CODE,
            municipality_name=_PILOT_MUNICIPALITY_NAME,
            state_code="PI",
            state_name="Piauí",
        )
    ]


def load_active_scopes(
    *,
    bq_project: str,
    municipality_dim_schema: str,
    environment: str,
    scope_filter: str | None,
) -> list[ScopeRow]:
    """Fetch scopes from BQ; fall back to pilot row when --scope is set and BQ fails."""
    try:
        return fetch_active_scopes(
            bq_project=bq_project,
            municipality_dim_schema=municipality_dim_schema,
            environment=environment,
        )
    except Exception as exc:
        if not scope_filter:
            raise
        LOG.warning(
            "activation registry unavailable (%s); using pilot fallback for --scope=%s",
            exc,
            scope_filter,
        )
        return [
            row
            for row in pilot_scope_rows()
            if row.matches_scope_filter(scope_filter)
        ]


def provision_v2_assets(
    c: SupersetClient,
    database_id: int,
    schema: str,
    dry_run: bool,
) -> tuple[dict[str, int], dict[str, int]]:
    """Ensure v2 datasets + charts; return (dataset_ids, chart_ids)."""
    dataset_id_by_key: dict[str, int] = {}
    for spec in DATASETS_V2:
        dataset_id_by_key[spec["key"]] = ensure_dataset(
            c, spec, database_id, schema, dry_run
        )
    chart_id_by_key: dict[str, int] = {}
    for spec in CHARTS_V2:
        chart_id_by_key[spec["key"]] = ensure_chart(
            c, spec, dataset_id_by_key, dry_run
        )
    return dataset_id_by_key, chart_id_by_key


def export_bundle(c: SupersetClient, out_dir: Path) -> None:
    """Round-trip the live dashboard back to YAML in ``out_dir``.

    Uses Superset's ``/api/v1/dashboard/export/`` which returns a zip in the
    exact format ``superset import-dashboards`` consumes. The zip is unpacked
    and overwrites ``out_dir`` wholesale. After this you can ``git diff
    bundle/`` to see exactly what changed in the UI.
    """
    dash_uuid = UUIDS["dashboard.gestao_imunizacao_operacional"]
    existing = find_dashboard_by_uuid(c, dash_uuid)
    if not existing:
        raise SystemExit(
            f"Dashboard {dash_uuid} not found at {c.base_url}. "
            "Bootstrap it first (drop --export and re-run)."
        )
    rql = f'!({existing["id"]})'
    LOG.info(
        "exporting dashboard id=%s from %s to %s",
        existing["id"], c.base_url, out_dir,
    )
    r = c.request("GET", f"/api/v1/dashboard/export/?q={rql}")
    if not r.content:
        raise SystemExit("Export returned empty body.")

    with tempfile.TemporaryDirectory() as tmpd:
        try:
            zipfile.ZipFile(io.BytesIO(r.content)).extractall(tmpd)
        except zipfile.BadZipFile as exc:
            raise SystemExit(
                f"Export response is not a valid zip (got "
                f"{r.headers.get('Content-Type', '?')}, "
                f"{len(r.content)} bytes). First 300 bytes: "
                f"{r.content[:300]!r}"
            ) from exc

        # Superset wraps everything under a single dir like "dashboard_export_20260527".
        roots = [
            Path(tmpd) / name
            for name in os.listdir(tmpd)
            if (Path(tmpd) / name).is_dir()
        ]
        if len(roots) != 1:
            raise SystemExit(
                f"Unexpected export structure ({len(roots)} root dirs in zip)"
            )
        src = roots[0]
        if out_dir.exists():
            shutil.rmtree(out_dir)
        shutil.copytree(src, out_dir)

    # Count what we wrote (for the log message)
    counts: dict[str, int] = {}
    for path in out_dir.rglob("*.yaml"):
        kind = path.parent.name
        counts[kind] = counts.get(kind, 0) + 1
    LOG.info(
        "export done: %d file(s) by kind: %s",
        sum(counts.values()),
        ", ".join(f"{k}={v}" for k, v in sorted(counts.items())),
    )


def run(args: argparse.Namespace) -> int:
    c = SupersetClient(
        base_url=args.base_url.rstrip("/"),
        username=args.username,
        password=args.password,
        token=args.token,
        cookie=args.cookie,
        csrf_token=args.csrf_token,
    )
    c.login()
    LOG.info("authenticated to %s (cookies/token validated)", c.base_url)

    # Export mode: round-trip back to bundle/, then exit.
    if args.export:
        out_dir = Path(args.bundle_dir).resolve()
        export_bundle(c, out_dir)
        LOG.info("done. Review with: git diff %s", out_dir)
        return 0

    db = find_database(c, args.database_name)
    if not db:
        LOG.error(
            "database %r not found in Superset. Create the BigQuery connection "
            "first (Data → Databases) or pass --bq-credentials to auto-create.",
            args.database_name,
        )
        return 2
    database_id = db["id"]
    LOG.info("found database %s (id=%s)", args.database_name, database_id)

    version = getattr(args, "version", "all")
    scope_filter = getattr(args, "scope", None)
    registry_env = getattr(args, "registry_env", "prod")

    dataset_id_by_key: dict[str, int] = {}
    chart_id_by_key: dict[str, int] = {}

    # v1 provisioning
    if version in ("v1", "all"):
        for spec in DATASETS:
            dataset_id_by_key[spec["key"]] = ensure_dataset(
                c, spec, database_id, args.schema, args.dry_run
            )
        for spec in CHARTS:
            chart_id_by_key[spec["key"]] = ensure_chart(
                c, spec, dataset_id_by_key, args.dry_run
            )
        url = ensure_dashboard(c, chart_id_by_key, dataset_id_by_key, args.dry_run)
        LOG.info("v1 dashboard available at: %s", url)
        print(url)

    v2_dataset_ids: dict[str, int] = {}
    v2_chart_ids: dict[str, int] = {}
    if version in V2_CHART_VERSIONS:
        v2_dataset_ids, v2_chart_ids = provision_v2_assets(
            c, database_id, args.schema, args.dry_run
        )

    if version in ("v2", "all"):
        url_v2 = ensure_dashboard_v2(
            c, v2_chart_ids, v2_dataset_ids, args.dry_run
        )
        LOG.info("internal v2 dashboard available at: %s", url_v2)
        print(url_v2)

    if version in ("per-state", "all"):
        dim_schema = getattr(
            args,
            "municipality_dim_schema",
            None,
        ) or municipality_dim_schema_from_gold(args.schema)
        scopes = load_active_scopes(
            bq_project=args.bq_project,
            municipality_dim_schema=dim_schema,
            environment=registry_env,
            scope_filter=scope_filter,
        )
        state_rows = unique_states(scopes)
        LOG.info(
            "per-state factory: %d state(s) from registry (env=%s)",
            len(state_rows),
            registry_env,
        )
        for state_row in state_rows:
            if not state_row.matches_scope_filter(scope_filter):
                continue
            url_state = ensure_dashboard_state(
                c, v2_chart_ids, v2_dataset_ids, state_row, args.dry_run
            )
            LOG.info("state dashboard %s: %s", state_row.state_code, url_state)
            print(url_state)

    if version in ("per-muni", "all"):
        dim_schema = getattr(
            args,
            "municipality_dim_schema",
            None,
        ) or municipality_dim_schema_from_gold(args.schema)
        scopes = load_active_scopes(
            bq_project=args.bq_project,
            municipality_dim_schema=dim_schema,
            environment=registry_env,
            scope_filter=scope_filter,
        )
        LOG.info(
            "per-muni factory: %d municipality(ies) from registry (env=%s)",
            len(scopes),
            registry_env,
        )
        for muni_row in scopes:
            if not muni_row.matches_scope_filter(scope_filter):
                continue
            url_muni = ensure_dashboard_muni(
                c, v2_chart_ids, v2_dataset_ids, muni_row, args.dry_run
            )
            LOG.info(
                "municipality dashboard %s: %s",
                muni_row.municipality_code,
                url_muni,
            )
            print(url_muni)

    return 0


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=textwrap.dedent(
            """
            Examples:

              # First-time deploy to prod
              python bootstrap_via_api.py \\
                  --base-url https://superset.example.com \\
                  --username admin --password secret \\
                  --database-name ptm-data-prod --schema gold

              # Test in your dev schema
              python bootstrap_via_api.py \\
                  --base-url http://localhost:8088 \\
                  --username admin --password admin \\
                  --database-name ptm-data-prod --schema dbt_josue_silveira_gold

              # SSO-protected Superset (Google/Auth0/Okta) — paste cookie + CSRF
              # from any authenticated XHR in browser DevTools:
              python bootstrap_via_api.py \\
                  --base-url https://superset.example.com \\
                  --cookie "$(cat ~/.superset-cookie)" \\
                  --csrf-token "$(cat ~/.superset-csrf)" \\
                  --database-name ptm-data-prod --schema gold

              # Inspect changes without applying
              python bootstrap_via_api.py ... --dry-run

              # Local-first workflow: after iterating on the dashboard in the
              # UI of your local Superset, export the live state back to
              # bundle/ for review and version control:
              python bootstrap_via_api.py \\
                  --base-url http://localhost:8088 \\
                  --username admin --password admin \\
                  --export
            """
        ),
    )
    p.add_argument("--base-url", required=True)
    auth = p.add_mutually_exclusive_group(required=True)
    auth.add_argument("--token", help="long-lived JWT access token")
    auth.add_argument("--username")
    auth.add_argument(
        "--cookie",
        help=(
            "Full Cookie request header from an authenticated browser session "
            "(use this for SSO-protected Superset). Pair with --csrf-token."
        ),
    )
    p.add_argument("--password")
    p.add_argument(
        "--csrf-token",
        help=(
            "x-csrftoken request header value. Optional with --cookie (auto-"
            "fetched if omitted but session has access to /api/v1/security/"
            "csrf_token/)."
        ),
    )
    p.add_argument(
        "--database-name",
        default="ptm-data-prod",
        help="Superset database connection name (Data → Databases), not the GCP project id.",
    )
    p.add_argument(
        "--bq-project",
        default="ptm-data-prod",
        help="GCP project id for activation-registry BigQuery queries.",
    )
    p.add_argument("--schema", default="gold")
    p.add_argument(
        "--export",
        action="store_true",
        help=(
            "Reverse direction: pull the live dashboard from Superset and "
            "overwrite ./bundle/ with the export. Use after iterating on the "
            "dashboard locally."
        ),
    )
    p.add_argument(
        "--bundle-dir",
        default=str(DEFAULT_BUNDLE_DIR),
        help="Directory to write the export to (defaults to ./bundle/).",
    )
    p.add_argument(
        "--version",
        choices=["v1", "v2", "per-state", "per-muni", "all"],
        default="all",
        help=(
            "Which dashboard tier to provision. "
            "'v1' = legacy operational view. "
            "'v2' = internal nacional dashboard only. "
            "'per-state' = one dashboard per active UF in the registry. "
            "'per-muni' = one dashboard per active IBGE in the registry. "
            "'all' = v1 + internal v2 + full state/muni factory."
        ),
    )
    p.add_argument(
        "--scope",
        default=None,
        help=(
            "Limit per-state/per-muni factory to one UF or IBGE "
            "(e.g. PI, 220850, Porto)."
        ),
    )
    p.add_argument(
        "--registry-env",
        default="prod",
        help="governance.municipality_activation environment column (default: prod).",
    )
    p.add_argument(
        "--municipality-dim-schema",
        default=None,
        help=(
            "BigQuery dataset for s3_dim_municipality. "
            "Defaults to --schema with '_gold' suffix stripped."
        ),
    )
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("-v", "--verbose", action="store_true")
    a = p.parse_args()
    if a.username and not a.password:
        p.error("--password is required when using --username")
    if a.export and a.dry_run:
        p.error("--dry-run is not supported with --export (export is read-only).")
    return a


if __name__ == "__main__":
    a = parse_args()
    logging.basicConfig(
        level=logging.DEBUG if a.verbose else logging.INFO,
        format="%(asctime)s %(levelname)-7s %(name)s %(message)s",
    )
    sys.exit(run(a))
