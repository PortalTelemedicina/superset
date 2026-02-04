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

/**
 * PTM extension system — single entry point.
 *
 * Registers all PTM UI extensions and chart plugins when PTM is enabled.
 * Core only calls this from setupExtensions(); no other core file imports PTM.
 */

import {
  isPtmExtensionEnabled,
  isPtmGlobalDashboardCssEnabled,
  isPtmHeaderCustomEnabled,
  isPtmFilterBarCollapseEnabled,
  isPtmChartPluginsEnabled,
  isPtmSliceHeaderControlsEnabled,
} from './config/featureFlags';
import { registerPtmHeaderExtension } from './extensions/headerRegistry';
import { registerPtmDashboardCssExtension } from './extensions/dashboardCssRegistry';
import { registerPtmFilterBarExtension } from './extensions/filterBarRegistry';
import { registerPtmSliceHeaderControlsExtension } from './extensions/sliceHeaderControlsRegistry';
import { registerPtmPlugins } from './plugins/registerPtmPlugins';

let applied = false;

/**
 * Applies all PTM extensions and registers PTM chart plugins when the PTM
 * feature is enabled. Safe to call multiple times; applies at most once.
 * When PTM is disabled, does nothing (upstream behavior unchanged).
 */
export function applyPTMExtensions(): void {
  if (applied) {
    return;
  }
  if (!isPtmExtensionEnabled()) {
    applied = true;
    return;
  }

  if (isPtmHeaderCustomEnabled()) {
    registerPtmHeaderExtension();
  }
  if (isPtmGlobalDashboardCssEnabled()) {
    registerPtmDashboardCssExtension();
  }
  if (isPtmFilterBarCollapseEnabled()) {
    registerPtmFilterBarExtension();
  }
  if (isPtmSliceHeaderControlsEnabled()) {
    registerPtmSliceHeaderControlsExtension();
  }
  if (isPtmChartPluginsEnabled()) {
    registerPtmPlugins();
  }

  applied = true;
}

/**
 * Resets the applied flag (for tests).
 */
export function resetPTMExtensions(): void {
  applied = false;
}
