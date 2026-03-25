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
const PTM_LINK_ID = 'ptm-dashboard-css-link';

function isPtmDashboardFromTags(
  dashboard: DashboardCssInjectorProps['dashboard'],
): boolean {
  const tags = dashboard?.tags;
  if (!Array.isArray(tags)) return false;
  return tags.some(t => String(t?.name || '').toUpperCase() === PTM_TAG_NAME);
}

/**
 * Ensures PTM CSS link is loaded synchronously in the document head.
 * Returns a function to remove the link.
 */
function ensurePtmCssLink(): () => void {
  const head = document.head || document.getElementsByTagName('head')[0];
  let link = document.getElementById(PTM_LINK_ID) as HTMLLinkElement | null;

  if (!link) {
    link = document.createElement('link');
    link.id = PTM_LINK_ID;
    link.rel = 'stylesheet';
    link.type = 'text/css';
    link.href = PTM_CSS_URL;
    // Insert at the beginning to ensure PTM CSS loads before custom CSS
    head.insertBefore(link, head.firstChild);
  }

  return () => {
    const existingLink = document.getElementById(PTM_LINK_ID);
    if (existingLink) {
      existingLink.remove();
    }
  };
}

/**
 * PTM dashboard CSS injector: loads ptm-dashboard.css synchronously via <link>
 * when the dashboard has the PTM tag, then injects the dashboard custom CSS.
 */
export default function PtmDashboardCssInjector({
  dashboardCss,
  dashboard,
}: DashboardCssInjectorProps) {
  const removeStyleRef = useRef<(() => void) | null>(null);
  const removeLinkRef = useRef<(() => void) | null>(null);
  const lastDashboardIdRef = useRef<number | null>(null);
  const lastCssRef = useRef<string>('');

  // Update style when css/dashboard changes; reuse same element (no remove/re-add)
  useEffect(() => {
    const dashboardId = dashboard?.id ?? null;
    const sameDashboard = dashboardId === lastDashboardIdRef.current;
    const rawDashboardCss =
      typeof dashboardCss === 'string' ? dashboardCss : '';
    const enablePtmTheme = isPtmDashboardFromTags(dashboard);

    if (enablePtmTheme) {
      // Ensure PTM CSS link is loaded synchronously
      if (!removeLinkRef.current) {
        removeLinkRef.current = ensurePtmCssLink();
      }
    } else {
      // Remove PTM CSS link if dashboard doesn't have PTM tag
      if (removeLinkRef.current) {
        removeLinkRef.current();
        removeLinkRef.current = null;
      }
    }

    // Inject dashboard custom CSS (without @import, PTM CSS is already loaded via link)
    const finalCss = rawDashboardCss.trim();
    const cssChanged = finalCss !== lastCssRef.current;

    if (finalCss) {
      if (cssChanged) {
        removeStyleRef.current = injectCustomCss(finalCss);
        lastCssRef.current = finalCss;
      }
    } else if (!sameDashboard) {
      removeStyleRef.current?.();
      removeStyleRef.current = null;
      lastCssRef.current = '';
    }

    lastDashboardIdRef.current = dashboardId;
    // Intentionally no cleanup: avoid remove/re-add on filter apply (prevents flash/reflow)
  }, [dashboardCss, dashboard]);

  // Remove style and link only on unmount
  useEffect(
    () => () => {
      removeStyleRef.current?.();
      removeStyleRef.current = null;
      removeLinkRef.current?.();
      removeLinkRef.current = null;
    },
    [],
  );

  return null;
}
