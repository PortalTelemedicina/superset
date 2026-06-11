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
 * Daily temporal bar charts: optional fixed-width bars in a fixed 7-day window
 * when fewer than 7 distinct days are present. Zoom is deferred to this module
 * and only applied once the window overflows (7+ days).
 */

import merge from 'lodash.merge';
import { getThemeDataZoom } from './dataZoom';

export const PTM_DAILY_BAR_WIDTH = 56;
export const PTM_BAR_MAX_WIDTH = PTM_DAILY_BAR_WIDTH;
/** Fixed number of day-slots visible on the time axis (bar width unchanged). */
export const PTM_DAILY_VISIBLE_DAYS = 7;
const DAY_MS = 86_400_000;

type AxisConfig = Record<string, unknown>;
type AxisLabelFormatter = (
  value: number | string,
  index: number,
) => string | number;

function parseTimestamp(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

function startOfDayUtc(ms: number): number {
  const date = new Date(ms);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function collectBarSeriesTimestamps(
  series: Record<string, unknown>[] | undefined,
  timeAxisKey: 'xAxis' | 'yAxis',
): number[] {
  if (!Array.isArray(series)) {
    return [];
  }

  const valueIndex = timeAxisKey === 'xAxis' ? 0 : 1;
  const timestamps: number[] = [];

  series.forEach(entry => {
    if (entry.type !== 'bar' || !Array.isArray(entry.data)) {
      return;
    }
    entry.data.forEach(row => {
      if (!Array.isArray(row)) {
        return;
      }
      const ts = parseTimestamp(row[valueIndex]);
      if (ts != null) {
        timestamps.push(ts);
      }
    });
  });

  return timestamps;
}

export function countUniqueDays(timestamps: number[]): number {
  const days = new Set(timestamps.map(startOfDayUtc));
  return days.size;
}

/** Fewer than the fixed window size — bars should be centered in a 7-day viewport. */
export function needsSparseBarWindow(timestamps: number[]): boolean {
  if (timestamps.length === 0) {
    return false;
  }
  return countUniqueDays(timestamps) < PTM_DAILY_VISIBLE_DAYS;
}

/** Window is full — native axis; zoom may be shown when enabled. */
export function hasBarWindowOverflow(timestamps: number[]): boolean {
  if (timestamps.length === 0) {
    return false;
  }
  return countUniqueDays(timestamps) >= PTM_DAILY_VISIBLE_DAYS;
}

export function startOfMonthUtc(ms: number): number {
  const date = new Date(ms);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
}

export function endOfMonthUtc(ms: number): number {
  const date = new Date(ms);
  return Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    0,
    23,
    59,
    59,
    999,
  );
}

function startOfYearUtc(ms: number): number {
  const date = new Date(ms);
  return Date.UTC(date.getUTCFullYear(), 0, 1);
}

function endOfYearUtc(ms: number): number {
  const date = new Date(ms);
  return Date.UTC(date.getUTCFullYear(), 11, 31, 23, 59, 59, 999);
}

export function endOfTodayUtc(nowMs = Date.now()): number {
  const date = new Date(nowMs);
  return Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    23,
    59,
    59,
    999,
  );
}

export function getCalendarPeriodBounds(
  minTimestamp: number,
  maxTimestamp: number,
  timeGrainSqla?: string,
): { periodStart: number; periodEnd: number } {
  const anchor = maxTimestamp;
  switch (timeGrainSqla) {
    case 'P1M':
    case 'P3M':
      return {
        periodStart: startOfYearUtc(anchor),
        periodEnd: endOfYearUtc(anchor),
      };
    case 'P1W':
    case 'P1D':
    default:
      return {
        periodStart: startOfMonthUtc(Math.min(minTimestamp, anchor)),
        periodEnd: endOfMonthUtc(anchor),
      };
  }
}

export function resolveSparseBarLayoutEnabled(
  formData: Record<string, unknown>,
): boolean {
  if (
    formData.ptm_sparse_bar_layout === true ||
    formData.ptmSparseBarLayout === true
  ) {
    return true;
  }

  const legacy =
    formData.ptm_sparse_bar_alignment ?? formData.ptmSparseBarAlignment;
  return (
    legacy === 'sparse' ||
    legacy === 'center' ||
    legacy === 'left' ||
    legacy === 'right'
  );
}

function getMaxRight(maxTs: number, periodEnd: number, nowMs: number): number {
  const isCurrentMonth = startOfMonthUtc(maxTs) === startOfMonthUtc(nowMs);
  if (!isCurrentMonth) {
    return periodEnd;
  }
  return Math.min(periodEnd, endOfTodayUtc(nowMs) + DAY_MS);
}

/** Centered on data cluster; may extend before periodStart (virtual padding). */
export function getCenteredZoomWindow(
  minTs: number,
  maxTs: number,
  periodStart: number,
  periodEnd: number,
  nowMs = Date.now(),
): { zoomStart: number; zoomEnd: number } {
  const center = (minTs + maxTs) / 2;
  const windowMs = PTM_DAILY_VISIBLE_DAYS * DAY_MS;
  const maxRight = getMaxRight(maxTs, periodEnd, nowMs);

  let zoomStart = center - windowMs / 2;
  let zoomEnd = center + windowMs / 2;

  if (zoomEnd > maxRight) {
    zoomEnd = maxRight;
    zoomStart = 2 * center - zoomEnd;
  }

  if (zoomEnd > periodEnd) {
    zoomEnd = periodEnd;
    zoomStart = 2 * center - zoomEnd;
  }

  return { zoomStart, zoomEnd };
}

function getAxisConfig(
  axis: AxisConfig | AxisConfig[] | undefined,
): AxisConfig | undefined {
  if (!axis) {
    return undefined;
  }
  return Array.isArray(axis) ? axis[0] : axis;
}

function setAxisConfig(
  axis: AxisConfig | AxisConfig[] | undefined,
  nextAxis: AxisConfig,
): AxisConfig | AxisConfig[] {
  if (Array.isArray(axis)) {
    return [nextAxis, ...axis.slice(1)];
  }
  return nextAxis;
}

function withVirtualPaddingAxisLabels(
  timeAxis: AxisConfig,
  periodStart: number,
): AxisConfig {
  const axisLabel = (timeAxis.axisLabel as Record<string, unknown>) || {};
  const existingFormatter = axisLabel.formatter as
    | AxisLabelFormatter
    | undefined;

  return {
    ...timeAxis,
    axisLabel: {
      ...axisLabel,
      formatter: (value: number | string, index: number) => {
        const ts = parseTimestamp(value);
        if (ts != null && ts < periodStart) {
          return '';
        }
        if (typeof existingFormatter === 'function') {
          return existingFormatter(value, index);
        }
        if (existingFormatter != null) {
          return existingFormatter;
        }
        return '';
      },
    },
  };
}

function isBarChart(formData: Record<string, unknown>): boolean {
  const ptmSeriesType = formData.ptmSeriesType ?? formData.ptm_series_type;
  const seriesType = formData.seriesType ?? formData.series_type;
  return ptmSeriesType === 'bar' || seriesType === 'bar';
}

function isDailyGrain(formData: Record<string, unknown>): boolean {
  const grain = formData.timeGrainSqla ?? formData.time_grain_sqla;
  return grain === 'P1D';
}

function applyBarSizing(
  series: Record<string, unknown>[],
): Record<string, unknown>[] {
  return series.map(entry =>
    entry.type === 'bar'
      ? {
          ...entry,
          barWidth: PTM_DAILY_BAR_WIDTH,
        }
      : entry,
  );
}

function applyOverflowZoom(
  options: Record<string, unknown>,
  formData: Record<string, unknown>,
): Record<string, unknown> {
  const zoomEnabled = formData.ptmZoomEnabled ?? formData.ptm_zoom_enabled;
  if (!zoomEnabled) {
    return {
      ...options,
      dataZoom: [],
      toolbox: { show: false },
    };
  }

  const themeZoomOverrides = getThemeDataZoom(formData);
  const next: Record<string, unknown> = { ...options };

  if (themeZoomOverrides.dataZoom !== undefined) {
    next.dataZoom = themeZoomOverrides.dataZoom;
  }
  if (themeZoomOverrides.toolbox !== undefined) {
    next.toolbox = themeZoomOverrides.toolbox;
  }
  if (
    themeZoomOverrides.grid !== undefined &&
    themeZoomOverrides.grid !== null
  ) {
    const currentGrid =
      next.grid && typeof next.grid === 'object'
        ? (next.grid as Record<string, unknown>)
        : {};
    next.grid = merge(
      {},
      currentGrid,
      themeZoomOverrides.grid as Record<string, unknown>,
    );
  }

  return next;
}

/** Daily bar charts with sparse layout defer zoom to applySparseTimeBarLayout. */
export function shouldDeferDailyBarZoom(
  formData: Record<string, unknown>,
): boolean {
  return (
    resolveSparseBarLayoutEnabled(formData) &&
    isBarChart(formData) &&
    isDailyGrain(formData)
  );
}

export function applySparseTimeBarLayout(
  options: Record<string, unknown>,
  formData: Record<string, unknown>,
  nowMs = Date.now(),
): Record<string, unknown> {
  if (!resolveSparseBarLayoutEnabled(formData)) {
    return options;
  }

  if (!isBarChart(formData) || !isDailyGrain(formData)) {
    return options;
  }

  const { orientation } = formData;
  const isHorizontal = orientation === 'horizontal';
  const timeAxisKey = isHorizontal ? 'yAxis' : 'xAxis';
  const timeAxis = getAxisConfig(
    options[timeAxisKey] as AxisConfig | AxisConfig[],
  );

  if (!timeAxis || timeAxis.type !== 'time') {
    return options;
  }

  const timestamps = collectBarSeriesTimestamps(
    options.series as Record<string, unknown>[] | undefined,
    timeAxisKey,
  );

  if (timestamps.length === 0) {
    return options;
  }

  if (hasBarWindowOverflow(timestamps)) {
    return applyOverflowZoom(options, formData);
  }

  if (!needsSparseBarWindow(timestamps)) {
    return options;
  }

  const minTs = Math.min(...timestamps);
  const maxTs = Math.max(...timestamps);
  const timeGrainSqla = (formData.timeGrainSqla ?? formData.time_grain_sqla) as
    | string
    | undefined;
  const { periodStart, periodEnd } = getCalendarPeriodBounds(
    minTs,
    maxTs,
    timeGrainSqla,
  );

  const series = options.series as Record<string, unknown>[] | undefined;
  const { zoomStart, zoomEnd } = getCenteredZoomWindow(
    minTs,
    maxTs,
    periodStart,
    periodEnd,
    nowMs,
  );

  return {
    ...options,
    series: Array.isArray(series) ? applyBarSizing(series) : series,
    [timeAxisKey]: setAxisConfig(
      options[timeAxisKey] as AxisConfig | AxisConfig[],
      withVirtualPaddingAxisLabels(
        {
          ...timeAxis,
          min: zoomStart,
          max: zoomEnd,
        },
        periodStart,
      ),
    ),
    dataZoom: [],
    toolbox: { show: false },
  };
}
