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

import type { ComponentType, ReactNode } from 'react';
import { createContext, useContext } from 'react';
import type {
  ChartDataReliabilityOverlayProps,
  DashboardHeaderExtensionProps,
} from '@superset-ui/core';
import type { HorizontalBarProps } from 'src/dashboard/components/nativeFilters/FilterBar/types';

/** Props for the dashboard CSS injector component (injected at root). */
export interface DashboardCssInjectorProps {
  dashboardCss: string;
  dashboard: {
    id?: number;
    tags?: Array<{ name?: string | null }>;
    metadata?: Record<string, unknown>;
  } | null;
}

/** Args for slice header controls extensions (function-based; only this slot uses functions). */
export interface SliceHeaderControlsExtensionArgs {
  slice: {
    slice_id: number;
    viz_type: string;
    slice_name?: string;
  };
}

export interface SliceHeaderControlsClassNamesResult {
  menu?: string;
  controls?: string;
}

/**
 * Dashboard extension overrides provided from the composition root.
 * All lookups are done once at root; components use this context instead of getExtensionsRegistry().
 */
export interface DashboardExtensionsValue {
  headerComponent?: ComponentType<DashboardHeaderExtensionProps>;
  filterBarComponent?: ComponentType<HorizontalBarProps>;
  filterValueLoadingComponent?: ComponentType;
  filterBarSettingsComponent?: ComponentType;
  sliceHeaderControlsClassNamesFn?: (
    args: SliceHeaderControlsExtensionArgs,
  ) => SliceHeaderControlsClassNamesResult;
  sliceHeaderControlsTriggerFn?: (
    args: SliceHeaderControlsExtensionArgs,
  ) => ReactNode;
  dashboardCssInjectorComponent?: ComponentType<DashboardCssInjectorProps>;
  chartDataReliabilityOverlayComponent?: ComponentType<ChartDataReliabilityOverlayProps>;
}

const defaultValue: DashboardExtensionsValue = {};

export const DashboardExtensionsContext =
  createContext<DashboardExtensionsValue>(defaultValue);

export function useDashboardExtensions(): DashboardExtensionsValue {
  return useContext(DashboardExtensionsContext);
}
