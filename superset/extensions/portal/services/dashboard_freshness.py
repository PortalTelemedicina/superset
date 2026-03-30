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
"""Portal dashboard freshness service.

Computes dashboard data freshness based on physical tables used
by charts in the dashboard. Currently supports BigQuery only.
"""

from __future__ import annotations

import logging
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import text

from superset import db
from superset.connectors.sqla.models import SqlaTable
from superset.extensions import cache_manager
from superset.models.dashboard import Dashboard

logger = logging.getLogger(__name__)

FRESHNESS_CACHE_TIMEOUT = 60


def _get_dashboard_dataset_ids(dashboard: Dashboard) -> set[int]:
    return {
        slice_.datasource_id
        for slice_ in (dashboard.slices or [])
        if slice_.datasource_type == "table" and slice_.datasource_id
    }


def _get_datasets(dataset_ids: set[int]) -> tuple[list[SqlaTable], int]:
    datasets = db.session.query(SqlaTable).filter(SqlaTable.id.in_(dataset_ids)).all()
    datasets_by_id = {dataset.id: dataset for dataset in datasets}
    missing_count = len(dataset_ids - set(datasets_by_id.keys()))
    return datasets, missing_count


def _escape_table_id(table_id: str) -> str:
    return table_id.replace("'", "''")


def _format_utc(dt: datetime | None) -> str | None:
    if not dt:
        return None
    return (
        dt.astimezone(timezone.utc)
        .replace(microsecond=0)
        .isoformat()
        .replace("+00:00", "Z")
    )


def _parse_freshness_table(
    freshness_table: str | None,
    dataset: SqlaTable,
) -> tuple[str | None, str | None, str | None] | None:
    if not freshness_table or not isinstance(freshness_table, str):
        return None

    parts = [part for part in freshness_table.split(".") if part]
    default_catalog = dataset.database.get_default_catalog()

    if len(parts) == 3:
        return parts[0], parts[1], parts[2]
    if len(parts) == 2:
        return dataset.catalog or default_catalog, parts[0], parts[1]
    if len(parts) == 1:
        return dataset.catalog or default_catalog, dataset.schema, parts[0]

    return None


def _should_count_view(table_type: Any) -> bool:
    if table_type is None:
        return False
    return str(table_type).lower() in {"2", "view"}


def _extract_row_fields(row: Any) -> tuple[str, Any, Any]:
    mapping = row._mapping if hasattr(row, "_mapping") else {}
    table_id = mapping.get("table_id", row[0])
    last_modified_time = mapping.get("last_modified_time", row[1])
    table_type = mapping.get("type", row[2])
    return table_id, last_modified_time, table_type


def _query_bigquery_metadata(
    database: Any,
    catalog: str,
    schema: str,
    table_names: set[str],
) -> list[Any] | None:
    escaped_table_ids = [
        f"'{_escape_table_id(table_name)}'" for table_name in table_names
    ]
    if not escaped_table_ids:
        return []

    # Table IDs are single-quoted literals from _escape_table_id (not user SQL).
    query = (
        "SELECT table_id, last_modified_time, type "
        f"FROM `{catalog}.{schema}.__TABLES__` "
        f"WHERE table_id IN ({', '.join(sorted(escaped_table_ids))})"
    )

    try:
        with database.get_sqla_engine(catalog=catalog, schema=schema) as engine:
            return engine.execute(text(query)).fetchall()
    except Exception as ex:
        logger.warning(
            "Error fetching BigQuery freshness metadata for %s.%s: %s",
            catalog,
            schema,
            ex,
            exc_info=True,
        )
        return None


def _collect_bigquery_tables(
    datasets: list[SqlaTable],
    skipped: dict[str, int],
) -> tuple[dict[tuple[int, str, str], set[str]], dict[int, Any]]:
    tables_by_key: dict[tuple[int, str, str], set[str]] = defaultdict(set)
    databases: dict[int, Any] = {}

    for dataset in datasets:
        if not dataset.database or dataset.database.backend != "bigquery":
            skipped["non_bigquery"] += 1
            continue

        catalog = dataset.catalog or dataset.database.get_default_catalog()
        schema = dataset.schema
        table_name = dataset.table_name

        if dataset.sql:
            override = _parse_freshness_table(
                dataset.extra_dict.get("freshness_table"),
                dataset,
            )
            if not override:
                skipped["virtual"] += 1
                continue
            catalog, schema, table_name = override

        if not catalog or not schema or not table_name:
            skipped["missing"] += 1
            continue

        key = (dataset.database.id, catalog, schema)
        tables_by_key[key].add(table_name)
        databases[dataset.database.id] = dataset.database

    return tables_by_key, databases


def _build_empty_result(dashboard_id: int, skipped: dict[str, int]) -> dict[str, Any]:
    return {
        "dashboard_id": dashboard_id,
        "min_last_modified_utc": None,
        "max_last_modified_utc": None,
        "tables_considered": 0,
        "datasets_total": 0,
        "skipped": skipped,
    }


def _build_result(
    dashboard_id: int,
    datasets_total: int,
    skipped: dict[str, int],
    timestamps: list[datetime],
    tables_found_global: set[str],
) -> dict[str, Any]:
    min_modified = min(timestamps) if timestamps else None
    max_modified = max(timestamps) if timestamps else None
    return {
        "dashboard_id": dashboard_id,
        "min_last_modified_utc": _format_utc(min_modified),
        "max_last_modified_utc": _format_utc(max_modified),
        "tables_considered": len(tables_found_global),
        "datasets_total": datasets_total,
        "skipped": skipped,
    }


def compute_dashboard_freshness(dashboard: Dashboard) -> dict[str, Any]:
    cache_key = f"dashboard_freshness:{dashboard.id}"
    if cached := cache_manager.cache.get(cache_key):
        return cached

    skipped = {
        "virtual": 0,
        "non_bigquery": 0,
        "missing": 0,
        "views": 0,
    }

    dataset_ids = _get_dashboard_dataset_ids(dashboard)
    datasets_total = len(dataset_ids)

    if not dataset_ids:
        result = _build_empty_result(dashboard.id, skipped)
        cache_manager.cache.set(cache_key, result, timeout=FRESHNESS_CACHE_TIMEOUT)
        return result

    datasets, missing_count = _get_datasets(dataset_ids)
    skipped["missing"] += missing_count
    tables_by_key, databases = _collect_bigquery_tables(datasets, skipped)

    tables_found_global: set[str] = set()
    timestamps: list[datetime] = []

    for (database_id, catalog, schema), table_names in tables_by_key.items():
        database = databases.get(database_id)
        if not database:
            skipped["missing"] += len(table_names)
            continue

        rows = _query_bigquery_metadata(database, catalog, schema, table_names)
        if rows is None:
            skipped["missing"] += len(table_names)
            continue

        found_tables = set()
        for row in rows:
            table_id, last_modified_time, table_type = _extract_row_fields(row)
            found_tables.add(table_id)
            tables_found_global.add(f"{catalog}.{schema}.{table_id}")

            if _should_count_view(table_type):
                skipped["views"] += 1

            try:
                last_modified_ms = float(last_modified_time)
            except (TypeError, ValueError):
                continue

            timestamps.append(
                datetime.fromtimestamp(last_modified_ms / 1000, tz=timezone.utc)
            )

        skipped["missing"] += len(set(table_names) - found_tables)

    result = _build_result(
        dashboard.id,
        datasets_total,
        skipped,
        timestamps,
        tables_found_global,
    )
    cache_manager.cache.set(cache_key, result, timeout=FRESHNESS_CACHE_TIMEOUT)
    return result
