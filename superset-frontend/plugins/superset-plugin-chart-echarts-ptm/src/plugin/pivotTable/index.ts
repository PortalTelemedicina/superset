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
 * software distributed on an "AS IS" BASIS, WITHOUT WARRANTIES
 * OR CONDITIONS OF ANY KIND, either express or implied.  See the
 * License for the specific language governing permissions and
 * limitations under the License.
 */
import { ChartProps } from '@superset-ui/core';
import { createPtmPlugin, ptmTextCasingControls } from '../../shared';
import { PIVOT_TABLE_TRANSFORM_CONFIG } from './pivotTableTransformConfig';
import thumbnail from './images/thumbnail.png';

// Import from original pivot table plugin source (same monorepo)
// @ts-ignore - importing from external source directory
import PivotTableTransformProps from '../../../../plugin-chart-pivot-table/src/plugin/transformProps';
// @ts-ignore - importing from external source directory
import PivotTableBuildQuery from '../../../../plugin-chart-pivot-table/src/plugin/buildQuery';
// @ts-ignore - importing from external source directory
import PivotTableControlPanel from '../../../../plugin-chart-pivot-table/src/plugin/controlPanel';
import PtmPivotTableChart from './PtmPivotTableChart';

const PIVOT_TABLE_PTM_DEFAULTS = {};

function wrapPivotTableTransformProps(
  base: (chartProps: ChartProps) => Record<string, unknown>,
) {
  return (chartProps: ChartProps) => {
    const result = base(chartProps) as Record<string, unknown>;
    const formData = chartProps.formData as Record<string, unknown>;
    result.ptmTableTextCase =
      formData.ptm_table_text_case ?? formData.ptmTableTextCase ?? 'none';
    return result;
  };
}

const PtmPivotTableChartPlugin = createPtmPlugin({
  name: 'PTM Pivot Table',
  description:
    'Pivot table with Portal Telemedicina styling. Clean, minimal design with Inter font for summarizing data across multiple dimensions.',
  category: 'Table',
  tags: ['Table', 'Tabular', 'Pivot', 'Data', 'PTM'],
  thumbnail,
  base: {
    buildQuery: PivotTableBuildQuery,
    transformProps: wrapPivotTableTransformProps(
      PivotTableTransformProps as (
        chartProps: ChartProps,
      ) => Record<string, unknown>,
    ) as (chartProps: ChartProps) => any,
    controlPanel: PivotTableControlPanel,
    Chart: PtmPivotTableChart as any,
  },
  transforms: PIVOT_TABLE_TRANSFORM_CONFIG,
  ptmDefaults: PIVOT_TABLE_PTM_DEFAULTS,
  additionalPtmControls: [ptmTextCasingControls],
});

export default PtmPivotTableChartPlugin;
