"""
Portal dashboard freshness API handler.

Isolated endpoint logic for dashboard freshness metadata.
"""
import logging

from superset.extensions.portal.services.dashboard_freshness import (
    compute_dashboard_freshness,
)
from superset.models.dashboard import Dashboard

logger = logging.getLogger(__name__)


def dashboard_freshness_handler(dashboard: Dashboard):
    try:
        result = compute_dashboard_freshness(dashboard)
        return 200, result, "OK"
    except Exception as err:
        logger.error("Error computing dashboard freshness: %s", err, exc_info=True)
        return 500, None, "Error computing dashboard freshness"
