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
 * PTM Chart Type Mapping Utilities
 * 
 * Provides functions to detect PTM dashboards and map standard chart types
 * to their PTM equivalents, including special handling for timeseries variants.
 */

const PTM_TAG_NAME = 'PTM';

/**
 * Check if a dashboard is a PTM dashboard based on tags or metadata flag
 */
export function isPtmDashboard(
  dashboard: { tags?: Array<{ name?: string }>; metadata?: { ptm_autoconvert?: boolean } } | null | undefined,
): boolean {
  if (!dashboard) return false;
  
  // Check metadata flag
  if (dashboard.metadata?.ptm_autoconvert === true) {
    return true;
  }
  
  // Check PTM tag
  const tags = dashboard.tags;
  if (Array.isArray(tags)) {
    return tags.some(
      t => String(t?.name || '').toUpperCase() === PTM_TAG_NAME,
    );
  }
  
  return false;
}

/**
 * Mapping from standard chart viz_type to PTM equivalent
 * For timeseries variants, also includes the ptm_series_type to set
 */
export type PtmChartMapping = {
  ptmVizType: string;
  ptmSeriesType?: string; // Only for timeseries variants
};

const PTM_CHART_TYPE_MAP: Record<string, PtmChartMapping> = {
  // Direct mappings
  'big_number_total': { ptmVizType: 'ptm_big_number_total' },
  'big_number': { ptmVizType: 'ptm_big_number_trendline' }, // BigNumber with Trendline
  'big_number_with_trendline': { ptmVizType: 'ptm_big_number_trendline' }, // Alias for compatibility
  'pie': { ptmVizType: 'ptm_pie' },
  'table': { ptmVizType: 'ptm_table' },
  'mixed_timeseries': { ptmVizType: 'ptm_mixed_timeseries' },
  'pivot_table_v2': { ptmVizType: 'ptm_pivot_table' },
  
  // Timeseries variants -> ptm_echarts_timeseries with series type
  'echarts_timeseries_bar': { 
    ptmVizType: 'ptm_echarts_timeseries',
    ptmSeriesType: 'bar',
  },
  'echarts_timeseries_line': {
    ptmVizType: 'ptm_echarts_timeseries',
    ptmSeriesType: 'line',
  },
  'echarts_timeseries_smooth': {
    ptmVizType: 'ptm_echarts_timeseries',
    ptmSeriesType: 'smooth',
  },
  'echarts_timeseries_step': {
    ptmVizType: 'ptm_echarts_timeseries',
    ptmSeriesType: 'step',
  },
  'echarts_timeseries': {
    ptmVizType: 'ptm_echarts_timeseries',
    ptmSeriesType: 'auto', // Keep original behavior
  },
};

/**
 * Get PTM equivalent for a chart viz_type
 * Returns null if no mapping exists
 */
export function getPtmChartMapping(vizType: string): PtmChartMapping | null {
  return PTM_CHART_TYPE_MAP[vizType] || null;
}

/**
 * Check if a viz_type has a PTM equivalent
 */
export function hasPtmEquivalent(vizType: string): boolean {
  return vizType in PTM_CHART_TYPE_MAP;
}
