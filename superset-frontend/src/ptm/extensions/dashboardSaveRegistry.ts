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
import { isPtmDashboard, getPtmChartMapping } from '../utils/ptmChartMapping';
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
 * PTM dashboard save hook handler.
 * Converts charts to PTM equivalents when PTM autoconvert is enabled.
 */
async function ptmDashboardSaveHook(
  args: DashboardSaveHookArgs,
): Promise<void> {
  const { dashboard, slices, mode, newDashboardId } = args;

  // Check if this is a PTM dashboard
  if (!isPtmDashboard(dashboard)) {
    return; // Not a PTM dashboard, skip conversion
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
 * Registers the PTM dashboard save hook extension.
 * This hook runs before dashboard save/update to convert charts to PTM equivalents.
 */
export function registerPtmDashboardSaveExtension(): void {
  const registry = getExtensionsRegistry();
  registry.set('dashboard.save.before', ptmDashboardSaveHook);
}
