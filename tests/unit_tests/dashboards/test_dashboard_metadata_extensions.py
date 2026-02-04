"""
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
"""

from flask import current_app

from superset.dashboards.schemas import DashboardJSONMetadataSchema
from superset.extensions.portal import register_dashboard_extension_fields
from tests.unit_tests.conftest import with_feature_flags


@with_feature_flags(PTM_EXTENSION_ENABLED=False)
def test_extension_fields_ignored_when_disabled(app_context) -> None:
    data = {
        "headerLayout": {"enabled": True, "slots": []},
        "portal_header_layout": {"enabled": True},
    }
    result = DashboardJSONMetadataSchema().load(data)
    assert "headerLayout" not in result
    assert "portal_header_layout" not in result


@with_feature_flags(PTM_EXTENSION_ENABLED=True)
def test_extension_fields_accepted_when_enabled(app_context) -> None:
    register_dashboard_extension_fields(current_app)
    data = {"portal_header_layout": {"enabled": True, "slots": []}}
    result = DashboardJSONMetadataSchema().load(data)
    assert "headerLayout" in result


@with_feature_flags(PTM_EXTENSION_ENABLED=True)
def test_roundtrip_normalizes_legacy_to_new(app_context) -> None:
  register_dashboard_extension_fields(current_app)
  legacy = {"portalHeaderLayout": {"enabled": True, "slots": []}}
  loaded = DashboardJSONMetadataSchema().load(legacy)
  dumped = DashboardJSONMetadataSchema().dump(loaded)
  reloaded = DashboardJSONMetadataSchema().load(dumped)
  assert "headerLayout" in reloaded


@with_feature_flags(PTM_EXTENSION_ENABLED=False)
def test_extension_fields_stripped_on_dump(app_context) -> None:
    data = {"headerLayout": {"enabled": True, "slots": []}}
    dumped = DashboardJSONMetadataSchema().dump(data)
    assert "headerLayout" not in dumped
