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
 * specific language governing limitations under the License.
 */

/**
 * Portal Extensions Entry Point
 * 
 * This module is the single entry point for all portal-specific extensions.
 * It should be imported once during application startup.
 */

import {
  isPortalFilterBarCustomEnabled,
  isPortalHeaderCustomEnabled,
  isPortalPtmThemeEnabled,
} from './config/featureFlags';
import { registerCustomHeaderExtension } from './dashboard/registries/dashboardHeaderRegistry';
import { registerCustomFilterBarExtensions } from './dashboard/registries/filterBarRegistry';
import { registerDashboardCssExtensions } from './dashboard/registries/dashboardCssRegistry';
import { registerSliceHeaderControlsExtensions } from './dashboard/registries/sliceHeaderControlsRegistry';
import './dashboard/header/styles/header-custom.css';

let initialized = false;

/**
 * Initializes all portal extensions.
 * 
 * This function is idempotent and safe to call multiple times.
 * 
 * @param options Configuration options for extensions
 */
export const initializePortalExtensions = (options?: {
  enableHeaderCustom?: boolean;
  enableFilterBarCustom?: boolean;
  enablePtmTheme?: boolean;
}) => {
  if (initialized) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[Portal Extensions] Already initialized');
    }
    return;
  }

  const headerCustomEnabled = 
    options?.enableHeaderCustom ?? isPortalHeaderCustomEnabled();
  const filterBarCustomEnabled =
    options?.enableFilterBarCustom ?? isPortalFilterBarCustomEnabled();
  const ptmThemeEnabled = options?.enablePtmTheme ?? isPortalPtmThemeEnabled();

  if (headerCustomEnabled) {
    registerCustomHeaderExtension();
    if (process.env.NODE_ENV === 'development') {
      console.info('[Portal Extensions] Custom header extension registered');
    }
  }

  if (filterBarCustomEnabled) {
    registerCustomFilterBarExtensions();
    if (process.env.NODE_ENV === 'development') {
      console.info('[Portal Extensions] Custom filter bar extensions registered');
    }
  }

  if (ptmThemeEnabled) {
    registerDashboardCssExtensions();
    registerSliceHeaderControlsExtensions();
    if (process.env.NODE_ENV === 'development') {
      console.info('[Portal Extensions] PTM theme extensions registered');
    }
  }

  initialized = true;
};

/**
 * Shuts down portal extensions (for testing/cleanup).
 */
export const shutdownPortalExtensions = () => {
  initialized = false;
};

// Auto-initialize when module is loaded (if in browser)
if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'test') {
  // Small delay to ensure Superset core is initialized
  setTimeout(() => {
    initializePortalExtensions();
  }, 0);
}

// Export components for direct use if needed
export { HeaderAdapter } from './dashboard/header/adapters/HeaderAdapter';
export { CustomizableHeader } from './dashboard/header/components/CustomizableHeader';
export { HeaderSlotEditor } from './dashboard/header/components/HeaderSlotEditor';
export * from './dashboard/header/types';
export { getDefaultHeaderLayout } from './dashboard/header/types';
export { useStandaloneMode } from './dashboard/header/hooks/useStandaloneMode';
export { useHeaderPreview } from './dashboard/header/hooks/useHeaderPreview';

