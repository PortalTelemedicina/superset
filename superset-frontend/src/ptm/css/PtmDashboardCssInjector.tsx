/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { useEffect, useRef } from 'react';
import type { DashboardCssInjectorProps } from 'src/dashboard/components/DashboardExtensionsContext';
import injectCustomCss from 'src/dashboard/util/injectCustomCss';

const PTM_TAG_NAME = 'PTM';
const PTM_CSS_URL = '/static/assets/stylesheets/ptm-dashboard.css';

function isPtmDashboardFromTags(
  dashboard: DashboardCssInjectorProps['dashboard'],
): boolean {
  const tags = dashboard?.tags;
  if (!Array.isArray(tags)) return false;
  return tags.some(
    t => String(t?.name || '').toUpperCase() === PTM_TAG_NAME,
  );
}

/**
 * PTM dashboard CSS injector: prepends @import for ptm-dashboard.css when
 * the dashboard has the PTM tag, then injects the combined CSS.
 */
export default function PtmDashboardCssInjector({
  css,
  dashboard,
}: DashboardCssInjectorProps) {
  const removeStyleRef = useRef<(() => void) | null>(null);
  const lastDashboardIdRef = useRef<number | null>(null);
  const lastCssRef = useRef<string>('');

  // Update style when css/dashboard changes; reuse same element (no remove/re-add)
  useEffect(() => {
    const dashboardId = dashboard?.id ?? null;
    const sameDashboard = dashboardId === lastDashboardIdRef.current;
    const dashboardCss = typeof css === 'string' ? css : '';
    const enablePtmTheme = isPtmDashboardFromTags(dashboard);
    const ptmImport =
      enablePtmTheme && dashboardCss.indexOf(PTM_CSS_URL) === -1
        ? `@import url("${PTM_CSS_URL}");\n`
        : '';
    const finalCss = `${ptmImport}${dashboardCss}`.trim();
    const cssChanged = finalCss !== lastCssRef.current;
    if (finalCss) {
      if (cssChanged) {
        removeStyleRef.current = injectCustomCss(finalCss);
        lastCssRef.current = finalCss;
      }
    } else {
      if (!sameDashboard) {
        removeStyleRef.current?.();
        removeStyleRef.current = null;
        lastCssRef.current = '';
      }
    }
    lastDashboardIdRef.current = dashboardId;
    // Intentionally no cleanup: avoid remove/re-add on filter apply (prevents flash/reflow)
  }, [css, dashboard]);

  // Remove style only on unmount
  useEffect(
    () => () => {
      removeStyleRef.current?.();
      removeStyleRef.current = null;
    },
    [],
  );

  return null;
}
