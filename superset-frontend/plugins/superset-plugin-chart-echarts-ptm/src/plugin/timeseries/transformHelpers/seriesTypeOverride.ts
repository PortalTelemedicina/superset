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
 * Timeseries-specific: Series type override
 * Used by charts with series (timeseries, bar, etc.)
 */

export type PtmSeriesType = 'auto' | 'line' | 'bar' | 'smooth' | 'step';

export type PtmBarBorderRadiusOptions = {
  enabled?: boolean;
  /** Radius in px */
  radius?: number;
  /** For vertical bars: rounds top corners (for horizontal: rounds right corners) */
  roundTop?: boolean;
  /** For vertical bars: rounds bottom corners (for horizontal: rounds left corners) */
  roundBottom?: boolean;
};

function getAxisType(axis: unknown, idx = 0): string | undefined {
  if (!axis) return undefined;
  if (Array.isArray(axis)) {
    const item = axis[idx];
    if (item && typeof item === 'object') return (item as any).type as string | undefined;
    return undefined;
  }
  if (typeof axis === 'object') return (axis as any).type as string | undefined;
  return undefined;
}

function isHorizontalBar(options: Record<string, unknown>): boolean {
  // Typical horizontal bar: xAxis is "value" and yAxis is "category"
  const xType = getAxisType(options.xAxis, 0);
  const yType = getAxisType(options.yAxis, 0);
  return xType === 'value' && yType === 'category';
}

function getBarRadiusArray(
  radius: number,
  horizontal: boolean,
  roundTop: boolean,
  roundBottom: boolean,
): [number, number, number, number] {
  if (horizontal) {
    // ECharts uses [topLeft, topRight, bottomRight, bottomLeft]
    // For horizontal bars we interpret:
    // - roundBottom => round "start" (left)
    // - roundTop => round "end" (right)
    const left = roundBottom ? radius : 0;
    const right = roundTop ? radius : 0;
    return [left, right, right, left];
  }

  // Vertical bars: bottom rounding affects bottom corners, top rounding affects top corners
  const top = roundTop ? radius : 0;
  const bottom = roundBottom ? radius : 0;
  return [top, top, bottom, bottom];
}

function applyStackAwareBorderRadius(
  options: Record<string, unknown>,
  series: Record<string, unknown>[],
  barBorderRadius: PtmBarBorderRadiusOptions | undefined,
): Record<string, unknown>[] {
  const enabled = barBorderRadius?.enabled ?? true;
  const radius = Math.max(0, Number(barBorderRadius?.radius ?? 8));
  const roundTop = barBorderRadius?.roundTop ?? true;
  const roundBottom = barBorderRadius?.roundBottom ?? true;
  const horizontal = isHorizontalBar(options);

  if (!enabled || radius <= 0) {
    return series.map(s => ({
      ...s,
      itemStyle: {
        ...(((s.itemStyle as Record<string, unknown>) || {})),
        borderRadius: [0, 0, 0, 0],
      },
    }));
  }

  // Group series by stack key. Non-stacked series become their own group.
  const groups = new Map<string, number[]>();
  series.forEach((s, idx) => {
    const stack = (s.stack as string | number | undefined) ?? '';
    const key = stack ? `stack:${String(stack)}` : `nostack:${idx}`;
    const arr = groups.get(key);
    if (arr) arr.push(idx);
    else groups.set(key, [idx]);
  });

  const radiusByIndex: Record<number, [number, number, number, number]> = {};

  for (const indices of groups.values()) {
    const first = indices[0];
    const last = indices[indices.length - 1];

    indices.forEach(i => {
      radiusByIndex[i] = [0, 0, 0, 0];
    });

    // bottom/start segment
    radiusByIndex[first] = getBarRadiusArray(radius, horizontal, false, roundBottom);
    // top/end segment
    radiusByIndex[last] = getBarRadiusArray(radius, horizontal, roundTop, false);

    // If group has a single series, it should get both ends.
    if (first === last) {
      radiusByIndex[first] = getBarRadiusArray(radius, horizontal, roundTop, roundBottom);
    }
  }

  return series.map((s, idx) => ({
    ...s,
    itemStyle: {
      ...(((s.itemStyle as Record<string, unknown>) || {})),
      borderRadius: radiusByIndex[idx] ?? [0, 0, 0, 0],
    },
  }));
}

export function applyBarBorderRadius(
  options: Record<string, unknown>,
  barBorderRadius?: PtmBarBorderRadiusOptions,
): Record<string, unknown> {
  if (!options || !Array.isArray(options.series)) return options;

  const originalSeries = options.series as Record<string, unknown>[];

  // Only apply to bar series. If ECharts type is missing, we treat it as non-bar
  // to avoid changing line/area charts unexpectedly.
  const barIndexToPos = new Map<number, number>();
  const barSeries: Record<string, unknown>[] = [];
  originalSeries.forEach((s, idx) => {
    if (s.type === 'bar') {
      barIndexToPos.set(idx, barSeries.length);
      barSeries.push(s);
    }
  });

  if (barSeries.length === 0) return options;

  const updatedBarSeries = applyStackAwareBorderRadius(options, barSeries, barBorderRadius);
  const nextSeries = originalSeries.map((s, idx) => {
    const barPos = barIndexToPos.get(idx);
    return barPos === undefined ? s : updatedBarSeries[barPos];
  });

  return {
    ...options,
    series: nextSeries,
  };
}

export function applySeriesTypeOverride(
  options: Record<string, unknown>,
  ptmSeriesType?: PtmSeriesType,
  barBorderRadius?: PtmBarBorderRadiusOptions,
): Record<string, unknown> {
  if (
    !ptmSeriesType ||
    ptmSeriesType === 'auto' ||
    !options ||
    !Array.isArray(options.series)
  ) {
    return options;
  }

  const typeForEcharts =
    ptmSeriesType === 'smooth' || ptmSeriesType === 'step' ? 'line' : ptmSeriesType;

  // First, force the requested type and base bar props.
  let nextSeries = options.series.map((s: Record<string, unknown>) => {
    const next: Record<string, unknown> = { ...s, type: typeForEcharts };

    if (ptmSeriesType === 'smooth') {
      next.smooth = true;
    }
    if (ptmSeriesType === 'step') {
      next.step = 'middle';
      next.smooth = false;
    }
    if (ptmSeriesType === 'bar') {
      delete next.smooth;
      delete next.step;
      next.barMaxWidth = 48;
    }

    return next;
  });

  // Then, apply stack-aware border radius only for bars.
  if (ptmSeriesType === 'bar') {
    nextSeries = applyStackAwareBorderRadius(options, nextSeries, barBorderRadius);
  }

  return {
    ...options,
    series: nextSeries,
  };
}

