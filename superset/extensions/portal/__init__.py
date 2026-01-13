"""
Portal extensions for Superset.

This package contains all portal-specific extensions that can be
loaded without modifying Superset core code.
"""


def register_extensions():
    """
    Registers all portal extensions.
    
    This function should be called once during Superset initialization.
    It's safe to call multiple times (idempotent).
    """
    # Register dashboard metadata schema extension
    try:
        from superset.extensions.portal.schemas.dashboard_metadata import (
            PortalDashboardMetadataExtension
        )
        from superset.dashboards.schemas import DashboardJSONMetadataSchema
        PortalDashboardMetadataExtension.merge_into_base_schema(
            DashboardJSONMetadataSchema
        )
    except ImportError:
        # Extensions not available, continue without them
        pass

