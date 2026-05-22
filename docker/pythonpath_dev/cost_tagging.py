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
Helpers for cost attribution of Superset queries.

``extract_chart_context`` digs ``dashboard_id`` / ``slice_id`` / ``user_id``
out of the current Flask request (or ``flask.g.form_data`` for cache warmup
and async paths). It is consumed by ``SQL_QUERY_MUTATOR`` in
``superset_config.py`` to prefix queries with a JSON tag that BigQuery
preserves in ``INFORMATION_SCHEMA.JOBS.query``, enabling per-dashboard
cost attribution.

This module is intentionally self-contained so it can also be imported by
any production config override (volume mount, ConfigMap, custom image).
"""

from __future__ import annotations

from typing import Any

from flask import g, has_request_context, request

from superset.utils import json


def _parse_form_data_blob(blob: Any) -> dict[str, Any]:
    """Parse a possibly-JSON form_data blob into a dict (empty on failure)."""
    if isinstance(blob, dict):
        return blob
    if isinstance(blob, str) and blob:
        try:
            parsed = json.loads(blob)
        except (TypeError, ValueError):
            return {}
        if isinstance(parsed, dict):
            return parsed
    return {}


def _pick_ids(form_data: dict[str, Any], root: dict[str, Any]) -> dict[str, int]:
    """Extract dashboard_id / slice_id from a form_data dict + request root."""
    ids: dict[str, int] = {}
    dashboard_id = form_data.get("dashboardId") or form_data.get("dashboard_id")
    slice_id = (
        form_data.get("slice_id")
        or form_data.get("sliceId")
        or root.get("slice_id")
    )
    try:
        if dashboard_id is not None:
            ids["dashboard_id"] = int(dashboard_id)
    except (TypeError, ValueError):
        pass
    try:
        if slice_id is not None:
            ids["slice_id"] = int(slice_id)
    except (TypeError, ValueError):
        pass
    return ids


def extract_chart_context() -> dict[str, int]:
    """Best-effort extraction of dashboard_id / slice_id / user_id from request.

    Order of sources:
      1. JSON body (chart data API: form_data.dashboardId / form_data.slice_id).
      2. request.form["form_data"] (legacy /explore_json).
      3. request.args["form_data"] (URL-encoded explore links).
      4. flask.g.form_data (cache warmup, async queries).
    Returns only keys whose values were resolved.
    """
    ctx: dict[str, int] = {}

    if has_request_context():
        try:
            json_body = request.get_json(cache=True, silent=True) or {}
        except Exception:
            json_body = {}
        if isinstance(json_body, dict):
            ctx.update(
                _pick_ids(_parse_form_data_blob(json_body.get("form_data")), json_body)
            )

        for source in (request.form.get("form_data"), request.args.get("form_data")):
            if not source:
                continue
            parsed = _parse_form_data_blob(source)
            ctx = {**_pick_ids(parsed, parsed), **ctx}

    if ("dashboard_id" not in ctx or "slice_id" not in ctx) and hasattr(g, "form_data"):
        g_form_data = _parse_form_data_blob(getattr(g, "form_data", None))
        ctx = {**_pick_ids(g_form_data, g_form_data), **ctx}

    try:
        user = getattr(g, "user", None)
        user_id = getattr(user, "id", None)
        if user_id is not None:
            ctx["user_id"] = int(user_id)
    except Exception:
        pass

    return ctx
