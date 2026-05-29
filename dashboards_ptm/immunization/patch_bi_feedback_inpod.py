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
"""Apply immunization BI-feedback patches inside a Superset pod (ORM only)."""

from __future__ import annotations

import argparse
import json
import logging
import sys
import uuid as uuid_mod
from pathlib import Path
from typing import Any

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))

from activation_registry import ScopeRow, fetch_active_scopes, unique_states  # noqa: E402
from bootstrap_via_api import (  # noqa: E402
    CHARTS_V2,
    DATASETS_V2,
    UUIDS,
    _COLUMN_LABELS,
    _PILOT_MUNICIPALITY_NAME,
    build_dashboard_position_muni,
    build_dashboard_position_state,
    build_dashboard_position_v2,
    build_native_filters_v2,
    chart_keys_for_layout,
    scope_dashboard_uuid,
    scoped_chart_specs,
)

LOG = logging.getLogger("ptm.imm.patch_inpod")

# Mirrors the certification badge applied to the original dashboards so that
# every scoped dashboard (state/municipality) shows the same blue seal.
_CERTIFIED_BY = "Data Engineering — PTM"
_PTM_TAG_NAME = "PTM"


def _ensure_ptm_tag(dash) -> None:
    """Attach the ``PTM`` custom tag to ``dash`` via the ORM (idempotent).

    The PTM plugins rely on this tag (isPtmDashboard) and scoped dashboards
    created here would otherwise be missing it.
    """
    from superset import db
    from superset.tags.models import ObjectType, Tag, TaggedObject, TagType

    tag = (
        db.session.query(Tag)
        .filter(Tag.name == _PTM_TAG_NAME, Tag.type == TagType.custom)
        .one_or_none()
    )
    if tag is None:
        tag = Tag(name=_PTM_TAG_NAME, type=TagType.custom)
        db.session.add(tag)
        db.session.flush()
    exists = (
        db.session.query(TaggedObject)
        .filter(
            TaggedObject.tag_id == tag.id,
            TaggedObject.object_id == dash.id,
            TaggedObject.object_type == ObjectType.dashboard,
        )
        .first()
    )
    if exists is None:
        db.session.add(
            TaggedObject(
                tag_id=tag.id,
                object_id=dash.id,
                object_type=ObjectType.dashboard,
            )
        )
        LOG.info("tagged dashboard id=%s with %s", dash.id, _PTM_TAG_NAME)

_FALLBACK_SCOPES = [
    ScopeRow(
        municipality_code="220270",
        municipality_name="Cocal",
        state_code="PI",
        state_name="Piauí",
    ),
    ScopeRow(
        municipality_code="220770",
        municipality_name="Parnaíba",
        state_code="PI",
        state_name="Piauí",
    ),
]


def _load_scopes(
    *,
    bq_project: str,
    municipality_dim_schema: str,
    registry_env: str,
) -> list[ScopeRow]:
    try:
        return fetch_active_scopes(
            bq_project=bq_project,
            municipality_dim_schema=municipality_dim_schema,
            environment=registry_env,
        )
    except Exception as exc:
        LOG.warning(
            "activation registry unavailable (%s); using fallback scopes",
            exc,
        )
        return _FALLBACK_SCOPES


def _chart_uuid(key: str) -> uuid_mod.UUID:
    return uuid_mod.UUID(UUIDS[key])


def _dash_uuid(key: str) -> uuid_mod.UUID:
    return uuid_mod.UUID(UUIDS[key])


def _dataset_uuid(key: str) -> uuid_mod.UUID:
    return uuid_mod.UUID(UUIDS[key])


def patch_datasets(schema: str) -> dict[str, int]:
    from superset import db
    from superset.connectors.sqla.models import SqlaTable, SqlMetric, TableColumn
    from superset.models.core import Database

    database = (
        db.session.query(Database)
        .filter(Database.database_name == "ptm-data-prod")
        .one()
    )
    ids: dict[str, int] = {}
    for spec in DATASETS_V2:
        ds_uuid = _dataset_uuid(spec["key"])
        dataset = (
            db.session.query(SqlaTable)
            .filter(SqlaTable.uuid == ds_uuid)
            .one_or_none()
        )
        if not dataset:
            LOG.info("creating dataset %s", spec["table_name"])
            dataset = SqlaTable(
                uuid=ds_uuid,
                table_name=spec["table_name"],
                schema=schema,
                database=database,
                cache_timeout=spec.get("cache_timeout"),
            )
            db.session.add(dataset)
            db.session.flush()
        ids[spec["key"]] = dataset.id
        # Re-introspect the physical table so newly added dbt columns
        # (e.g. vaccine_name, severity_label, freshness_status_label) become
        # available to charts. Safe: only syncs columns to the real schema.
        try:
            dataset.fetch_metadata()
        except Exception as exc:  # noqa: BLE001
            LOG.warning("fetch_metadata failed for %s: %s", spec["table_name"], exc)
        existing_metrics = {m.metric_name: m for m in dataset.metrics}
        for m_spec in spec.get("metrics", []):
            metric = existing_metrics.get(m_spec["metric_name"])
            if metric:
                metric.verbose_name = m_spec.get("verbose_name", metric.verbose_name)
                metric.expression = m_spec["expression"]
                if m_spec.get("d3format"):
                    metric.d3format = m_spec["d3format"]
            else:
                dataset.metrics.append(
                    SqlMetric(
                        metric_name=m_spec["metric_name"],
                        verbose_name=m_spec.get("verbose_name"),
                        expression=m_spec["expression"],
                        d3format=m_spec.get("d3format"),
                    )
                )
        for col in dataset.columns:
            label = _COLUMN_LABELS.get(col.column_name)
            if label:
                col.verbose_name = label
        LOG.info("patched dataset %s (id=%s)", spec["table_name"], dataset.id)
    db.session.commit()
    return ids


def _upsert_chart(spec: dict, dataset_ids: dict[str, int]) -> int | None:
    """Create or update a single chart by UUID (ORM). Returns chart id."""
    from superset import db
    from superset.models.slice import Slice

    chart_uuid = uuid_mod.UUID(spec.get("uuid") or UUIDS[spec["key"]])
    dataset_id = dataset_ids.get(spec["dataset_key"])
    if not dataset_id:
        LOG.warning("dataset for %s missing", spec["key"])
        return None
    params = dict(spec["params"])
    params["datasource"] = f"{dataset_id}__table"
    params["viz_type"] = spec["viz_type"]
    params_json = json.dumps(params, default=str)

    chart = (
        db.session.query(Slice)
        .filter(Slice.uuid == chart_uuid)
        .one_or_none()
    )
    if not chart:
        chart = Slice(uuid=chart_uuid)
        db.session.add(chart)
    chart.slice_name = spec["slice_name"]
    chart.viz_type = spec["viz_type"]
    chart.datasource_id = dataset_id
    chart.datasource_type = "table"
    chart.params = params_json
    db.session.flush()
    return chart.id


def patch_charts(dataset_ids: dict[str, int]) -> dict[str, int]:
    """Upsert the base (national) chart set; returns key -> chart id."""
    from superset import db

    chart_ids: dict[str, int] = {}
    for spec in CHARTS_V2:
        cid = _upsert_chart(spec, dataset_ids)
        if cid is not None:
            chart_ids[spec["key"]] = cid
            LOG.info("patched chart %s (id=%s)", spec["slice_name"], cid)
    db.session.commit()
    return chart_ids


def provision_scoped_charts(
    dataset_ids: dict[str, int],
    scope_kind: str,
    scope_id: str,
    *,
    municipality_name: str | None = None,
    state_name: str | None = None,
) -> dict[str, int]:
    """Create/update scope-exclusive charts; returns base_key -> chart id."""
    from superset import db

    specs = scoped_chart_specs(
        scope_kind,
        scope_id,
        municipality_name=municipality_name,
        state_name=state_name,
    )
    chart_id_by_base_key: dict[str, int] = {}
    for spec in specs:
        cid = _upsert_chart(spec, dataset_ids)
        if cid is not None:
            chart_id_by_base_key[spec["base_key"]] = cid
    db.session.commit()
    LOG.info(
        "provisioned %d scoped charts for %s/%s",
        len(chart_id_by_base_key),
        scope_kind,
        scope_id,
    )
    return chart_id_by_base_key


def _patch_dashboard(
    *,
    dash_uuid: uuid_mod.UUID,
    title: str,
    slug: str,
    position: dict[str, Any],
    chart_ids: dict[str, int],
    dataset_ids: dict[str, int],
    default_state_name: str | None = None,
    default_municipality_name: str | None = None,
) -> None:
    from superset import db
    from superset.models.dashboard import Dashboard
    from superset.models.slice import Slice

    dash = (
        db.session.query(Dashboard)
        .filter(Dashboard.uuid == dash_uuid)
        .one_or_none()
    )
    layout_keys = chart_keys_for_layout(position)
    subset = {k: chart_ids[k] for k in layout_keys if k in chart_ids}
    metadata = {
        "color_scheme": "supersetColors",
        "refresh_frequency": 300,
        "native_filter_configuration": build_native_filters_v2(
            dataset_ids,
            default_state_name=default_state_name,
            default_municipality_name=default_municipality_name,
        ),
        "cross_filters_enabled": True,
        "ptm_autoconvert": True,
    }
    if not dash:
        dash = Dashboard(
            uuid=dash_uuid,
            dashboard_title=title,
            slug=slug,
            published=True,
        )
        db.session.add(dash)
        LOG.info("creating dashboard %s", slug)
    else:
        dash.dashboard_title = title
        dash.slug = slug
        dash.published = True

    dash.position_json = json.dumps(position)
    dash.json_metadata = json.dumps(metadata)
    dash.certified_by = _CERTIFIED_BY

    keep_ids = set(subset.values())
    for chart_id in keep_ids:
        chart = db.session.get(Slice, chart_id)
        if chart and dash not in chart.dashboards:
            chart.dashboards.append(dash)

    for chart in list(dash.slices):
        if chart.id not in keep_ids:
            chart.dashboards.remove(dash)

    db.session.flush()
    _ensure_ptm_tag(dash)

    LOG.info("patched dashboard %s (id=%s, %d charts)", slug, dash.id, len(subset))
    db.session.commit()


def patch_dashboards(
    chart_ids: dict[str, int],
    dataset_ids: dict[str, int],
    *,
    bq_project: str,
    municipality_dim_schema: str,
    registry_env: str,
) -> None:
    _patch_dashboard(
        dash_uuid=_dash_uuid("dashboard.gestao_imunizacao_operacional_v2"),
        title="Gestão de Imunização — Nacional (Interno)",
        slug="gestao-imunizacao-operacional-v2",
        position=build_dashboard_position_v2(chart_ids),
        chart_ids=chart_ids,
        dataset_ids=dataset_ids,
        default_municipality_name=_PILOT_MUNICIPALITY_NAME,
    )
    scopes = _load_scopes(
        bq_project=bq_project,
        municipality_dim_schema=municipality_dim_schema,
        registry_env=registry_env,
    )
    for state_row in unique_states(scopes):
        uf = state_row.state_code.lower()
        scoped_ids = provision_scoped_charts(
            dataset_ids,
            "state",
            uf,
            state_name=state_row.state_name,
        )
        _patch_dashboard(
            dash_uuid=uuid_mod.UUID(scope_dashboard_uuid("state", uf)),
            title=f"Gestão de Imunização — {state_row.state_name}",
            slug=f"gestao-imunizacao-estado-{uf}",
            position=build_dashboard_position_state(scoped_ids),
            chart_ids=scoped_ids,
            dataset_ids=dataset_ids,
            default_state_name=state_row.state_name,
        )
    for muni_row in scopes:
        ibge = muni_row.municipality_code
        scoped_ids = provision_scoped_charts(
            dataset_ids,
            "muni",
            ibge,
            municipality_name=muni_row.municipality_name,
        )
        _patch_dashboard(
            dash_uuid=uuid_mod.UUID(scope_dashboard_uuid("muni", ibge)),
            title=(
                f"Gestão de Imunização — "
                f"{muni_row.municipality_name}/{muni_row.state_code}"
            ),
            slug=f"gestao-imunizacao-municipio-{ibge}",
            position=build_dashboard_position_muni(scoped_ids),
            chart_ids=scoped_ids,
            dataset_ids=dataset_ids,
            default_state_name=muni_row.state_name,
            default_municipality_name=muni_row.municipality_name,
        )


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--schema", default="dbt_gold")
    parser.add_argument("--bq-project", default="ptm-data-prod")
    parser.add_argument("--registry-env", default="prod")
    parser.add_argument("--municipality-dim-schema", default=None)
    args = parser.parse_args()
    dim_schema = args.municipality_dim_schema or args.schema.removesuffix("_gold")

    from superset.app import create_app

    app = create_app()
    with app.app_context():
        dataset_ids = patch_datasets(args.schema)
        chart_ids = patch_charts(dataset_ids)
        patch_dashboards(
            chart_ids,
            dataset_ids,
            bq_project=args.bq_project,
            municipality_dim_schema=dim_schema,
            registry_env=args.registry_env,
        )
    LOG.info("BI feedback patch complete")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
