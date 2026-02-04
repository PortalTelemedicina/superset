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
import { useMemo } from 'react';
// Import from original pivot table plugin source (same monorepo)
// @ts-ignore - importing from external source directory
import PivotTableChart from '../../../../plugin-chart-pivot-table/src/PivotTableChart';
// @ts-ignore - importing from external source directory
import type { PivotTableProps } from '../../../../plugin-chart-pivot-table/src/types';
import { applyTextCasing } from '../../shared/transformHelpers';
import type { PtmTextCase } from '../../shared/transformHelpers';
import PivotTableStyles from './Styles';

/**
 * PTM Pivot Table Chart Component
 *
 * Wraps the original PivotTableChart with PTM styling and optional text casing.
 */
export default function PtmPivotTableChart(
  props: PivotTableProps & { ptmTableTextCase?: PtmTextCase },
) {
  const { ptmTableTextCase = 'none', verboseMap = {}, metrics = [], ...rest } = props;

  const casedProps = useMemo(() => {
    if (ptmTableTextCase === 'none') return props;
    const mode = ptmTableTextCase as PtmTextCase;
    const casedVerboseMap =
      typeof verboseMap === 'object' && verboseMap !== null
        ? Object.fromEntries(
            Object.entries(verboseMap).map(([k, v]) => [
              k,
              applyTextCasing(String(v ?? ''), mode),
            ]),
          )
        : verboseMap;
    const casedMetrics = Array.isArray(metrics)
      ? metrics.map(m =>
          typeof m === 'object' && m !== null && 'label' in m
            ? { ...m, label: applyTextCasing(String((m as { label?: string }).label ?? ''), mode) }
            : m,
        )
      : metrics;
    return {
      ...rest,
      verboseMap: casedVerboseMap,
      metrics: casedMetrics,
    };
  }, [props, ptmTableTextCase, verboseMap, metrics]);

  return (
    <PivotTableStyles>
      <PivotTableChart {...casedProps} />
    </PivotTableStyles>
  );
}
