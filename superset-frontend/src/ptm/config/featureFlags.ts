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

import getBootstrapData from 'src/utils/getBootstrapData';

/** Master switch: when true, PTM extensions and plugins are applied. */
export const PTM_EXTENSION_ENABLED = 'PTM_EXTENSION_ENABLED';

export const PTM_ENABLE_GLOBAL_DASHBOARD_CSS =
  'PTM_ENABLE_GLOBAL_DASHBOARD_CSS';
export const PTM_ENABLE_HEADER_CUSTOM = 'PTM_ENABLE_HEADER_CUSTOM';
export const PTM_ENABLE_PTM_CHART_PLUGINS = 'PTM_ENABLE_PTM_CHART_PLUGINS';
export const PTM_ENABLE_FILTERBAR_COLLAPSE = 'PTM_ENABLE_FILTERBAR_COLLAPSE';
export const PTM_ENABLE_SLICE_HEADER_CONTROLS =
  'PTM_ENABLE_SLICE_HEADER_CONTROLS';
export const PTM_ENABLE_DATA_RELIABILITY_INDICATOR =
  'PTM_ENABLE_DATA_RELIABILITY_INDICATOR';

type FeatureFlags = Record<string, boolean>;

function getBootstrapFlags(): FeatureFlags {
  try {
    if (typeof window === 'undefined') return {};
    const data = getBootstrapData();
    return (data?.common?.feature_flags as FeatureFlags) ?? {};
  } catch {
    return {};
  }
}

function getWindowFeatureFlags(): FeatureFlags {
  try {
    if (typeof window !== 'undefined' && window.featureFlags) {
      return window.featureFlags as FeatureFlags;
    }
  } catch {
    // ignore
  }
  return {};
}

/**
 * True when PTM extension system should run (master switch).
 */
export function isPtmExtensionEnabled(): boolean {
  const flags = getBootstrapFlags();
  const winFlags = getWindowFeatureFlags();
  return (
    flags[PTM_EXTENSION_ENABLED] === true ||
    winFlags[PTM_EXTENSION_ENABLED] === true
  );
}

function isPtmFlagOn(flagKey: string, defaultValue: boolean): boolean {
  const winFlags = getWindowFeatureFlags();
  if (winFlags[flagKey] !== undefined) return Boolean(winFlags[flagKey]);
  const bootstrap = getBootstrapFlags();
  if (bootstrap[flagKey] !== undefined) return Boolean(bootstrap[flagKey]);
  try {
    if (
      typeof window !== 'undefined' &&
      window.featureFlags &&
      flagKey in window.featureFlags
    ) {
      const value = (window.featureFlags as Record<string, boolean>)[flagKey];
      return Boolean(value);
    }
  } catch {
    // ignore
  }
  const config = (
    window as unknown as {
      SUPERSET_CONFIG?: { extensions?: { portal?: Record<string, boolean> } };
    }
  )?.SUPERSET_CONFIG?.extensions?.portal;
  if (
    flagKey === PTM_ENABLE_HEADER_CUSTOM &&
    config?.headerCustomEnabled !== undefined
  ) {
    return Boolean(config.headerCustomEnabled);
  }
  if (
    flagKey === PTM_ENABLE_GLOBAL_DASHBOARD_CSS &&
    config?.ptmThemeEnabled !== undefined
  ) {
    return Boolean(config.ptmThemeEnabled);
  }
  if (
    flagKey === PTM_ENABLE_FILTERBAR_COLLAPSE &&
    config?.filterBarCustomEnabled !== undefined
  ) {
    return Boolean(config.filterBarCustomEnabled);
  }
  return defaultValue;
}

export function isPtmGlobalDashboardCssEnabled(): boolean {
  return isPtmFlagOn(PTM_ENABLE_GLOBAL_DASHBOARD_CSS, true);
}

export function isPtmHeaderCustomEnabled(): boolean {
  return isPtmFlagOn(PTM_ENABLE_HEADER_CUSTOM, true);
}

export function isPtmChartPluginsEnabled(): boolean {
  return isPtmFlagOn(PTM_ENABLE_PTM_CHART_PLUGINS, true);
}

export function isPtmFilterBarCollapseEnabled(): boolean {
  return isPtmFlagOn(PTM_ENABLE_FILTERBAR_COLLAPSE, true);
}

export function isPtmSliceHeaderControlsEnabled(): boolean {
  return isPtmFlagOn(PTM_ENABLE_SLICE_HEADER_CONTROLS, true);
}

export function isPtmDataReliabilityIndicatorEnabled(): boolean {
  return isPtmFlagOn(PTM_ENABLE_DATA_RELIABILITY_INDICATOR, true);
}
