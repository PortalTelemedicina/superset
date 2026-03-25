"""
Portal extensions for Superset.

This package contains all portal-specific extensions that can be
loaded without modifying Superset core code.
"""

from __future__ import annotations

import logging
from typing import Optional

from flask import Flask

from superset import is_feature_enabled

logger = logging.getLogger(__name__)

_dashboard_extension_fields_registered = False


def register_dashboard_extension_fields(app: Flask) -> None:
    """
    Registers dashboard metadata extension fields when enabled.

    This function is intended to be invoked during app initialization.
    """
    global _dashboard_extension_fields_registered  # noqa: PLW0603
    if _dashboard_extension_fields_registered:
        return

    try:
        enabled = is_feature_enabled("PTM_EXTENSION_ENABLED")
    except Exception:  # pragma: no cover - guard against early init issues
        enabled = app.config.get("FEATURE_FLAGS", {}).get(
            "PTM_EXTENSION_ENABLED", False
        )

    if not enabled:
        return

    try:
        from superset.dashboards.schemas import DashboardJSONMetadataSchema
        from superset.extensions.portal.schemas.dashboard_metadata import (
            PortalDashboardMetadataExtension,
        )

        PortalDashboardMetadataExtension.merge_into_base_schema(
            DashboardJSONMetadataSchema
        )
        _dashboard_extension_fields_registered = True
    except Exception as ex:
        logger.exception("Failed to register portal dashboard extensions: %s", ex)


def register_extensions(app: Optional[Flask] = None) -> None:
    """
    Backward-compatible registration entry point.
    """
    if app is None:
        logger.warning(
            "Portal extension registration called without app; skipping registration"
        )
        return
    register_dashboard_extension_fields(app)
