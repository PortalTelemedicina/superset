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
"""Portal dashboard freshness API handler.

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
