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
"""Generate the Superset import bundle from the in-code chart/dataset specs.

Run this whenever you change ``bootstrap_via_api.py`` to keep the
``bundle/`` directory in sync. The bundle can be imported via::

    superset import-directory bundle/
    # OR
    preset-cli ... superset sync native ./bundle/
"""

from __future__ import annotations

import json
import shutil
import textwrap
from datetime import datetime, timezone
from pathlib import Path

import yaml

import bootstrap_via_api as boot  # type: ignore

BUNDLE_DIR = Path(__file__).parent / "bundle"
DB_NAME = "ptm-data-prod"
SCHEMA = "gold"

LICENSE = textwrap.dedent(
    """\
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
    """
)


def _write(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    body = yaml.safe_dump(payload, sort_keys=False, allow_unicode=True)
    path.write_text(LICENSE + body, encoding="utf-8")


def write_metadata() -> None:
    _write(
        BUNDLE_DIR / "metadata.yaml",
        {
            "version": "1.0.0",
            "type": "Dashboard",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
    )


def write_database() -> None:
    _write(
        BUNDLE_DIR / "databases" / "ptm_data_prod.yaml",
        {
            "database_name": DB_NAME,
            "sqlalchemy_uri": "bigquery://ptm-data-prod",
            "cache_timeout": None,
            "expose_in_sqllab": True,
            "allow_run_async": True,
            "allow_ctas": False,
            "allow_cvas": False,
            "allow_dml": False,
            "extra": json.dumps(
                {
                    "engine_params": {
                        "connect_args": {
                            "credentials_path": "$BIGQUERY_CREDENTIALS_PATH",
                        },
                    },
                    "metadata_params": {},
                    "schemas_allowed_for_csv_upload": [],
                },
                indent=2,
            ),
            "uuid": boot.UUIDS["database.ptm_data_prod"],
            "version": "1.0.0",
        },
    )


def write_datasets() -> None:
    for spec in boot.DATASETS:
        dataset_uuid = boot.UUIDS[spec["key"]]
        columns = [
            {
                "column_name": col["column_name"],
                "verbose_name": col.get("verbose_name"),
                "is_dttm": False,
                "is_active": True,
                "type": col.get("type", "FLOAT"),
                "groupby": False,
                "filterable": True,
                "expression": col.get("expression"),
                "description": col.get("description"),
                "python_date_format": None,
            }
            for col in spec.get("calculated_columns", [])
        ]
        metrics = [
            {
                "metric_name": m["metric_name"],
                "verbose_name": m.get("verbose_name"),
                "metric_type": None,
                "expression": m["expression"],
                "description": m.get("description"),
                "d3format": m.get("d3format"),
                "extra": None,
                "warning_text": None,
            }
            for m in spec.get("metrics", [])
        ]
        payload = {
            "table_name": spec["table_name"],
            "main_dttm_col": spec.get("main_dttm_col"),
            "description": spec.get("description"),
            "default_endpoint": None,
            "offset": 0,
            "cache_timeout": spec.get("cache_timeout"),
            "schema": SCHEMA,
            "sql": "",
            "params": None,
            "template_params": None,
            "filter_select_enabled": True,
            "fetch_values_predicate": None,
            "extra": None,
            "uuid": dataset_uuid,
            "metrics": metrics,
            "columns": columns,
            "version": "1.0.0",
            "database_uuid": boot.UUIDS["database.ptm_data_prod"],
        }
        _write(
            BUNDLE_DIR / "datasets" / SCHEMA / f"{spec['table_name']}.yaml",
            payload,
        )


def write_charts() -> None:
    for spec in boot.CHARTS:
        dataset_uuid = boot.UUIDS[spec["dataset_key"]]
        params = dict(spec["params"])
        params["viz_type"] = spec["viz_type"]
        params["datasource"] = "{dataset_id}__table"
        payload = {
            "slice_name": spec["slice_name"],
            "description": spec.get("description"),
            "certified_by": None,
            "certification_details": None,
            "viz_type": spec["viz_type"],
            "params": params,
            "cache_timeout": None,
            "uuid": boot.UUIDS[spec["key"]],
            "version": "1.0.0",
            "dataset_uuid": dataset_uuid,
        }
        slug = spec["key"].split(".", 1)[1]
        _write(BUNDLE_DIR / "charts" / f"{slug}.yaml", payload)


def write_dashboard() -> None:
    chart_uuid_by_key = {k: boot.UUIDS[k] for k in (c["key"] for c in boot.CHARTS)}
    position = {
        "DASHBOARD_VERSION_KEY": "v2",
        "ROOT_ID": {"type": "ROOT", "id": "ROOT_ID", "children": ["GRID_ID"]},
        "GRID_ID": {
            "type": "GRID",
            "id": "GRID_ID",
            "children": ["ROW-kpis", "ROW-trend", "ROW-detail", "ROW-aux"],
            "parents": ["ROOT_ID"],
        },
        "HEADER_ID": {
            "type": "HEADER",
            "id": "HEADER_ID",
            "meta": {"text": "Gestão de Imunização — Visão Operacional"},
        },
    }
    rows = [
        ("ROW-kpis", [
            ("chart.01_kpi_cobertura_media", 4, 50),
            ("chart.02_kpi_criancas_em_atraso", 4, 50),
            ("chart.03_kpi_proximas_30_dias", 4, 50),
        ]),
        ("ROW-trend", [
            ("chart.04_timeline_doses", 4, 60),
            ("chart.05_mapa_alerta", 4, 60),
            ("chart.07_timeliness", 4, 60),
        ]),
        ("ROW-detail", [
            ("chart.06_heatmap_atraso", 6, 70),
            ("chart.09_ranking_municipios", 6, 70),
        ]),
        ("ROW-aux", [
            ("chart.08_dropout_serie", 4, 60),
            ("chart.10_registros_suspeitos", 5, 60),
            ("chart.11_freshness", 3, 60),
        ]),
    ]
    for row_id, charts in rows:
        children = []
        for key, width, height in charts:
            node_id = f"CHART-{key.split('.', 1)[1]}"[:50]
            children.append(node_id)
            position[node_id] = {
                "type": "CHART",
                "id": node_id,
                "children": [],
                "parents": ["ROOT_ID", "GRID_ID", row_id],
                "meta": {
                    "width": width,
                    "height": height,
                    "uuid": chart_uuid_by_key[key],
                },
            }
        position[row_id] = {
            "type": "ROW",
            "id": row_id,
            "children": children,
            "parents": ["ROOT_ID", "GRID_ID"],
            "meta": {"background": "BACKGROUND_TRANSPARENT"},
        }

    metadata = {
        "color_scheme": "supersetColors",
        "refresh_frequency": 300,
        "cross_filters_enabled": True,
        "native_filter_configuration": boot.NATIVE_FILTERS,
        "chart_configuration": {},
        "global_chart_configuration": {
            "scope": {"rootPath": ["ROOT_ID"], "excluded": []},
            "chartsInScope": [],
        },
        # Flag picked up by the PTM save hook (see ptmChartMapping.ts -
        # isPtmAutoconvertEnabled) so any non-PTM chart added later is
        # auto-converted to its PTM equivalent on save.
        "ptm_autoconvert": True,
    }
    payload = {
        "dashboard_title": "Gestão de Imunização — Visão Operacional",
        "description": (
            "Dashboard operacional para gestores municipais e regionais de "
            "imunização. Origem: ptm-data-prod.gold.gold_immunization_*"
        ),
        "css": "",
        "slug": "gestao-imunizacao-operacional",
        "certified_by": "Data Engineering — PTM",
        "certification_details": (
            "Modelos dbt validados em ptm-dw-modeling (gold layer)."
        ),
        "published": True,
        "uuid": boot.UUIDS["dashboard.gestao_imunizacao_operacional"],
        "position": position,
        "metadata": metadata,
        # PTM tag triggers theme/CSS via isPtmDashboard() check.
        "tags": [{"name": boot.PTM_TAG_NAME}],
        "version": "1.0.0",
    }
    _write(
        BUNDLE_DIR / "dashboards" / "gestao_imunizacao_operacional.yaml",
        payload,
    )


def main() -> None:
    if BUNDLE_DIR.exists():
        shutil.rmtree(BUNDLE_DIR)
    write_metadata()
    write_database()
    write_datasets()
    write_charts()
    write_dashboard()
    print(f"Bundle generated at {BUNDLE_DIR}")
    for p in sorted(BUNDLE_DIR.rglob("*.yaml")):
        print(f"  {p.relative_to(BUNDLE_DIR.parent)}")


if __name__ == "__main__":
    main()
