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

import { getExtensionsRegistry, SupersetClient } from '@superset-ui/core';
import type { DashboardSaveHookArgs } from '@superset-ui/core';
import { isPtmExtensionEnabled } from '../config/featureFlags';
import {
  getPtmChartMapping,
  getLegacyChartMapping,
  isPtmVizType,
} from '../utils/ptmChartMapping';

type PtmFormData = Record<string, unknown> & {
  viz_type?: string;
  subheader?: string;
  ptm_series_type?: string;
};

const getVizType = (
  formData?: Record<string, unknown>,
  fallback?: string,
): string | undefined => {
  const fromForm =
    formData && typeof formData.viz_type === 'string'
      ? formData.viz_type
      : undefined;
  return fromForm || fallback;
};

/**
 * Revert PTM charts to legacy equivalents (when auto-convert is turned off).
 */
async function revertPtmCharts(
  slices: Record<
    string,
    {
      form_data?: Record<string, unknown>;
      slice_name?: string;
      datasource?: string | number;
    }
  >,
): Promise<void> {
  const revertPromises: Promise<unknown>[] = [];

  for (const sliceId in slices) {
    const slice = slices[sliceId];
    const formData = slice.form_data ?? {};
    const currentVizType = getVizType(formData);

    if (!currentVizType || !isPtmVizType(currentVizType)) continue;

    const ptmSeriesType =
      typeof formData.ptm_series_type === 'string'
        ? formData.ptm_series_type
        : undefined;
    const legacyVizType = getLegacyChartMapping(currentVizType, ptmSeriesType);
    if (!legacyVizType) continue;

    const updatedFormData: Record<string, unknown> = {
      ...formData,
      viz_type: legacyVizType,
    };
    delete updatedFormData.ptm_series_type;

    let datasourceId = formData.datasource_id;
    let datasourceType = formData.datasource_type || 'table';
    if (!datasourceId && slice.datasource) {
      const parts = String(slice.datasource).split('__');
      if (parts.length === 2) {
        datasourceId = parseInt(parts[0], 10);
        datasourceType = parts[1].toLowerCase();
      }
    }

    revertPromises.push(
      SupersetClient.put({
        endpoint: `/api/v1/chart/${sliceId}`,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          params: JSON.stringify(updatedFormData),
          viz_type: legacyVizType,
          slice_name: slice.slice_name,
          datasource_id: datasourceId,
          datasource_type: datasourceType,
        }),
      }).catch(error => {
        console.warn(
          `Failed to revert chart ${sliceId} (${slice.slice_name}) to legacy:`,
          error,
        );
      }),
    );
  }

  if (revertPromises.length > 0) {
    await Promise.allSettled(revertPromises);
  }
}

/**
 * Convert legacy charts to their PTM equivalents (when auto-convert is turned on).
 */
async function convertPtmCharts(
  slices: Record<
    string,
    {
      form_data?: Record<string, unknown>;
      slice_name?: string;
      datasource?: string | number;
    }
  >,
): Promise<void> {
  const conversionPromises: Promise<unknown>[] = [];

  for (const sliceId in slices) {
    const slice = slices[sliceId];
    const formData = slice.form_data ?? {};
    const currentVizType = getVizType(formData);

    if (!currentVizType) continue;

    const mapping = getPtmChartMapping(currentVizType);
    if (!mapping) continue; // No PTM equivalent

    // Skip if already converted
    if (currentVizType === mapping.ptmVizType) continue;

    const updatedFormData: PtmFormData = {
      ...formData,
      viz_type: mapping.ptmVizType,
    };

    // PTM BigNumber: preserve chart header title as card title if empty
    if (
      (mapping.ptmVizType === 'ptm_big_number_total' ||
        mapping.ptmVizType === 'ptm_big_number_trendline') &&
      (!updatedFormData.subheader ||
        String(updatedFormData.subheader).trim() === '')
    ) {
      updatedFormData.subheader = slice.slice_name;
    }

    // Set PTM series type for timeseries variants
    if (mapping.ptmSeriesType) {
      updatedFormData.ptm_series_type = mapping.ptmSeriesType;
    }

    let datasourceId = formData.datasource_id;
    let datasourceType = formData.datasource_type || 'table';
    if (!datasourceId && slice.datasource) {
      const parts = String(slice.datasource).split('__');
      if (parts.length === 2) {
        datasourceId = parseInt(parts[0], 10);
        datasourceType = parts[1].toLowerCase();
      }
    }

    conversionPromises.push(
      SupersetClient.put({
        endpoint: `/api/v1/chart/${sliceId}`,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          params: JSON.stringify(updatedFormData),
          viz_type: mapping.ptmVizType,
          slice_name: slice.slice_name,
          datasource_id: datasourceId,
          datasource_type: datasourceType,
        }),
      }).catch(error => {
        console.warn(
          `Failed to convert chart ${sliceId} (${slice.slice_name}) to PTM:`,
          error,
        );
      }),
    );
  }

  if (conversionPromises.length > 0) {
    await Promise.allSettled(conversionPromises);
  }
}

/**
 * PTM dashboard save hook handler.
 *
 * IMPORTANT: chart PTM<->legacy conversion happens ONLY through explicit user intent:
 *  - toggling "Use PTM" in the dashboard Properties modal, which calls
 *    convertPtmChartsForDashboard / revertPtmChartsForDashboard directly, and
 *  - duplicating a PTM-enabled dashboard (copy mode, handled here).
 *
 * Routine saves (layout edits, rename, header Save) and the PTM tag NEVER convert or revert
 * charts on an existing dashboard. This prevents silent chart flips and cross-dashboard
 * collateral damage that earlier versions of this hook could cause on every save.
 */
export async function ptmDashboardSaveHook(
  args: DashboardSaveHookArgs,
): Promise<void> {
  // Do not run PTM conversion when the extension is disabled (e.g. production).
  if (!isPtmExtensionEnabled()) {
    return;
  }
  const { dashboard, mode, newDashboardId } = args;
  const metadata = dashboard?.metadata ?? {};

  // The only chart change performed by the save hook is converting a freshly duplicated dashboard
  // when the copy explicitly opts into PTM. Everything else (update/create/any other mode) is a
  // no-op for charts: existing dashboards are only changed via the explicit Properties toggle.
  if (mode !== 'copy' || !newDashboardId) {
    return;
  }

  // Only convert when the duplicated dashboard explicitly opts in, and never when locked.
  if (metadata.ptm_locked === true || metadata.ptm_autoconvert !== true) {
    return;
  }

  // Never touch charts shared with other dashboards (backend also forces ptm_locked in that case).
  try {
    const { json } = await SupersetClient.get({
      endpoint: `/api/v1/dashboard/${newDashboardId}/has_shared_charts`,
    });
    if ((json as { result?: boolean })?.result === true) {
      return;
    }
  } catch {
    // Non-fatal: proceed with conversion of the new dashboard's own charts.
  }

  try {
    // Scoped to the NEW dashboard's own charts, so the source dashboard is never touched.
    await convertPtmChartsForDashboard(newDashboardId);
  } catch (error) {
    console.warn('Failed to convert charts to PTM after copy:', error);
    // Continue anyway - don't block dashboard creation.
  }
}

/**
 * Revert all PTM charts on a dashboard to legacy equivalents.
 * Used when saving from the Properties modal with auto-convert turned off.
 */
export async function revertPtmChartsForDashboard(
  dashboardId: number,
): Promise<void> {
  try {
    const chartsResponse = await SupersetClient.get({
      endpoint: `/api/v1/dashboard/${dashboardId}/charts`,
    });
    const charts = chartsResponse.json?.result ?? [];
    if (charts.length === 0) return;

    const slices: Record<
      string,
      {
        form_data?: Record<string, unknown>;
        slice_name?: string;
        datasource?: string | number;
      }
    > = {};
    charts.forEach(
      (chart: {
        id: number;
        form_data?: Record<string, unknown>;
        params?: string;
        slice_name?: string;
        datasource_id?: number;
        datasource_type?: string;
      }) => {
        const formData = (chart.form_data ??
          (chart.params ? JSON.parse(chart.params) : {})) as Record<
          string,
          unknown
        >;
        slices[String(chart.id)] = {
          form_data: {
            ...formData,
            datasource_id: chart.datasource_id ?? formData.datasource_id,
            datasource_type: chart.datasource_type ?? formData.datasource_type,
          },
          slice_name: chart.slice_name,
          datasource:
            chart.datasource_id ??
            (formData.datasource_id as number | undefined),
        };
      },
    );

    const hasAnyPtmChart = Object.values(slices).some(s => {
      const vizType = getVizType(s.form_data);
      return !!vizType && isPtmVizType(vizType);
    });
    if (hasAnyPtmChart) {
      await revertPtmCharts(slices);
    }
  } catch (error) {
    console.warn('Failed to revert PTM charts for dashboard:', error);
    throw error;
  }
}

/**
 * Convert all eligible legacy charts on a dashboard to their PTM equivalents.
 * Used when saving from the Properties modal with auto-convert turned on, and when
 * duplicating a PTM-enabled dashboard. Scoped to this dashboard's own charts, so it
 * never touches charts that belong to other dashboards.
 */
export async function convertPtmChartsForDashboard(
  dashboardId: number,
): Promise<void> {
  try {
    const chartsResponse = await SupersetClient.get({
      endpoint: `/api/v1/dashboard/${dashboardId}/charts`,
    });
    const charts = chartsResponse.json?.result ?? [];
    if (charts.length === 0) return;

    const slices: Record<
      string,
      {
        form_data?: Record<string, unknown>;
        slice_name?: string;
        datasource?: string | number;
      }
    > = {};
    charts.forEach(
      (chart: {
        id: number;
        form_data?: Record<string, unknown>;
        params?: string;
        slice_name?: string;
        datasource_id?: number;
        datasource_type?: string;
      }) => {
        const formData = (chart.form_data ??
          (chart.params ? JSON.parse(chart.params) : {})) as Record<
          string,
          unknown
        >;
        slices[String(chart.id)] = {
          form_data: {
            ...formData,
            datasource_id: chart.datasource_id ?? formData.datasource_id,
            datasource_type: chart.datasource_type ?? formData.datasource_type,
          },
          slice_name: chart.slice_name,
          datasource:
            chart.datasource_id ??
            (formData.datasource_id as number | undefined),
        };
      },
    );

    await convertPtmCharts(slices);
  } catch (error) {
    console.warn('Failed to convert PTM charts for dashboard:', error);
    throw error;
  }
}

/**
 * Registers the PTM dashboard save hook extension.
 * This hook runs before dashboard save/update to convert charts to PTM equivalents.
 */
export function registerPtmDashboardSaveExtension(): void {
  const registry = getExtensionsRegistry();
  registry.set('dashboard.save.before', ptmDashboardSaveHook);
}
