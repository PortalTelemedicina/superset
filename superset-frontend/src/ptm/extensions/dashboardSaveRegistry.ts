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

import { getExtensionsRegistry } from '@superset-ui/core';
import { SupersetClient } from '@superset-ui/core';
import rison from 'rison';
import { isPtmExtensionEnabled } from '../config/featureFlags';
import {
  getPtmChartMapping,
  getLegacyChartMapping,
  isPtmVizType,
} from '../utils/ptmChartMapping';
import type { DashboardSaveHookArgs } from '@superset-ui/core';

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
 * PTM dashboard save hook handler.
 * Toggle between new (PTM) and original (legacy) chart versions:
 * - When "Use PTM" is on: convert charts to PTM equivalents on save.
 * - When "Use PTM" is off or unset: revert any PTM charts to legacy on save.
 * Tag PTM does not affect this; only the dashboard metadata flag does.
 */
async function ptmDashboardSaveHook(
  args: DashboardSaveHookArgs,
): Promise<void> {
  // Do not run PTM conversion when the extension is disabled (e.g. production).
  if (!isPtmExtensionEnabled()) {
    return;
  }
  const { dashboard, slices, mode, newDashboardId } = args;
  const metadata = dashboard?.metadata ?? {};

  if (metadata.ptm_locked === true) {
    return;
  }

  // Only strict true means "use PTM". false, undefined, or any other value must never trigger conversion.
  const usePtmVersions = metadata.ptm_autoconvert === true;

  // Use legacy: revert any PTM charts to original versions (update mode only).
  // Skip entirely when there are no PTM charts (e.g. already reverted) to avoid unnecessary API calls.
  if (!usePtmVersions && mode === 'update' && Object.keys(slices).length > 0) {
    const hasAnyPtmChart = Object.values(slices).some(slice => {
      const vizType = getVizType(slice.form_data);
      return !!vizType && isPtmVizType(vizType);
    });
    if (hasAnyPtmChart) {
      await revertPtmCharts(slices);
    }
    return;
  }

  // Never convert unless ptm_autoconvert is explicitly true. Presence of the key with value false
  // (e.g. after adding it to metadata) must not trigger conversion.
  if (metadata.ptm_autoconvert !== true) {
    return;
  }

  // For copy mode, we need to fetch slices from the new dashboard
  if (mode === 'copy' && newDashboardId) {
    try {
      // Fetch the new dashboard to get its slices
      const dashResponse = await SupersetClient.get({
        endpoint: `/api/v1/dashboard/${newDashboardId}`,
      });
      const dashboardData = dashResponse.json.result;

      // Fetch slices for the new dashboard
      if (dashboardData.slices && dashboardData.slices.length > 0) {
        const sliceIds = dashboardData.slices.map((s: { id: number }) => s.id);
        const slicesResponse = await SupersetClient.get({
          endpoint: `/api/v1/chart/?q=${rison.encode({
            filters: [{ col: 'id', opr: 'in', value: sliceIds }],
          })}`,
        });

        const fetchedSlices = slicesResponse.json.result || [];
        const conversionPromises = [];

        for (const slice of fetchedSlices) {
          const formData = JSON.parse(slice.params || '{}') as Record<
            string,
            unknown
          >;
          const currentVizType = getVizType(formData, slice.viz_type);

          if (!currentVizType) continue;

          const mapping = getPtmChartMapping(currentVizType);
          if (!mapping) continue; // No PTM equivalent

          // Skip if already converted
          if (currentVizType === mapping.ptmVizType) continue;

          const updatedFormData: PtmFormData = {
            ...(formData ?? {}),
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

          const updatePromise = SupersetClient.put({
            endpoint: `/api/v1/chart/${slice.id}`,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              params: JSON.stringify(updatedFormData),
              viz_type: mapping.ptmVizType,
              slice_name: slice.slice_name,
              datasource_id: slice.datasource_id,
              datasource_type: slice.datasource_type,
            }),
          }).catch(error => {
            console.warn(
              `Failed to convert chart ${slice.id} (${slice.slice_name}) to PTM:`,
              error,
            );
            // Don't throw - continue with other conversions
          });

          conversionPromises.push(updatePromise);
        }

        if (conversionPromises.length > 0) {
          await Promise.allSettled(conversionPromises);
        }
      }
    } catch (error) {
      console.warn('Failed to convert charts to PTM after copy:', error);
      // Continue anyway - don't block dashboard creation
    }
    return;
  }

  // For update mode, use slices from Redux state
  const conversionPromises = [];

  for (const sliceId in slices) {
    const slice = slices[sliceId];
    const currentVizType = getVizType(slice.form_data);

    if (!currentVizType) continue;

    const mapping = getPtmChartMapping(currentVizType);
    if (!mapping) continue; // No PTM equivalent

    // Skip if already converted
    if (currentVizType === mapping.ptmVizType) continue;

    // Prepare updated form_data
    const updatedFormData: PtmFormData = {
      ...(slice.form_data ?? {}),
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

    // Parse datasource if it's a string like "123__table"
    let datasourceId = slice.form_data?.datasource_id;
    let datasourceType = slice.form_data?.datasource_type || 'table';
    if (!datasourceId && slice.datasource) {
      const parts = String(slice.datasource).split('__');
      if (parts.length === 2) {
        datasourceId = parseInt(parts[0], 10);
        datasourceType = parts[1].toLowerCase();
      }
    }

    // Update slice via API - use minimal payload with required fields
    const updatePromise = SupersetClient.put({
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
      // Don't throw - continue with other conversions
    });

    conversionPromises.push(updatePromise);
  }

  // Wait for all conversions to complete (or fail gracefully)
  if (conversionPromises.length > 0) {
    await Promise.allSettled(conversionPromises);
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
    const dashResponse = await SupersetClient.get({
      endpoint: `/api/v1/dashboard/${dashboardId}`,
    });
    const dashboardData = dashResponse.json.result;
    const sliceList = dashboardData.slices ?? [];
    if (sliceList.length === 0) return;

    const sliceIds = sliceList.map((s: { id: number }) => s.id);
    const chartsResponse = await SupersetClient.get({
      endpoint: `/api/v1/chart/?q=${rison.encode({
        filters: [{ col: 'id', opr: 'in', value: sliceIds }],
      })}`,
    });
    const charts = chartsResponse.json.result ?? [];

    const slices: Record<
      string,
      {
        form_data?: Record<string, unknown>;
        slice_name?: string;
        datasource?: string | number;
      }
    > = {};
    charts.forEach((chart: { id: number; params?: string; slice_name?: string; datasource_id?: number; datasource_type?: string }) => {
      const formData = (chart.params ? JSON.parse(chart.params) : {}) as Record<string, unknown>;
      slices[String(chart.id)] = {
        form_data: { ...formData, datasource_id: chart.datasource_id, datasource_type: chart.datasource_type },
        slice_name: chart.slice_name,
        datasource: chart.datasource_id,
      };
    });

    const hasAnyPtmChart = Object.values(slices).some(s => {
      const vizType = getVizType(s.form_data);
      return !!vizType && isPtmVizType(vizType);
    });
    if (hasAnyPtmChart) {
      await revertPtmCharts(slices);
    }
  } catch (error) {
    console.warn('Failed to revert PTM charts for dashboard:', error);
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
