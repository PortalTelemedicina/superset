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
"""Read active municipality scopes from governance.municipality_activation."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Sequence

try:
    from google.cloud import bigquery
except ImportError:  # pragma: no cover - optional at import time
    bigquery = None  # type: ignore[assignment,misc]


@dataclass(frozen=True)
class ScopeRow:
    """One activated municipality with display labels for dashboard defaults."""

    municipality_code: str
    municipality_name: str
    state_code: str
    state_name: str

    def matches_scope_filter(self, scope: str | None) -> bool:
        """True when *scope* is unset or matches this row's IBGE or UF."""
        if not scope:
            return True
        needle = scope.strip().upper()
        if needle == self.municipality_code:
            return True
        if needle == self.state_code.upper():
            return True
        if needle == self.state_name.upper():
            return True
        if needle == self.municipality_name.upper():
            return True
        return False


def fetch_active_scopes(
    *,
    bq_project: str,
    municipality_dim_schema: str,
    environment: str = "prod",
    statuses: Sequence[str] = ("active", "staging"),
) -> list[ScopeRow]:
    """Return activated municipalities joined to s3_dim_municipality for names."""
    if bigquery is None:
        raise RuntimeError(
            "google-cloud-bigquery is required for activation registry lookup. "
            "Install it or pass scopes manually."
        )

    client = bigquery.Client(project=bq_project)
    query = f"""
        SELECT DISTINCT
            CAST(a.municipality_code AS STRING) AS municipality_code
            , COALESCE(m.municipality_name, 'Município desconhecido') AS municipality_name
            , COALESCE(m.state_code, 'UNKNOWN') AS state_code
            , COALESCE(m.state_name, 'Desconhecido') AS state_name
        FROM `{bq_project}.governance.municipality_activation` AS a
        LEFT JOIN `{bq_project}.{municipality_dim_schema}.s3_dim_municipality` AS m
            ON CAST(a.municipality_code AS STRING) = m.municipality_code
        WHERE a.environment = @environment
          AND a.status IN UNNEST(@statuses)
        ORDER BY state_code, municipality_name
    """
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("environment", "STRING", environment),
            bigquery.ArrayQueryParameter("statuses", "STRING", list(statuses)),
        ]
    )
    rows = client.query(query, job_config=job_config).result()
    return [
        ScopeRow(
            municipality_code=str(row.municipality_code),
            municipality_name=str(row.municipality_name),
            state_code=str(row.state_code),
            state_name=str(row.state_name),
        )
        for row in rows
    ]


def unique_states(scopes: Sequence[ScopeRow]) -> list[ScopeRow]:
    """One representative row per UF (first municipality in each state)."""
    seen: set[str] = set()
    out: list[ScopeRow] = []
    for row in scopes:
        uf = row.state_code.upper()
        if uf in seen:
            continue
        seen.add(uf)
        out.append(row)
    return out
