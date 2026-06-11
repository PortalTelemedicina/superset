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

import {
  applySparseTimeBarLayout,
  countUniqueDays,
  getCalendarPeriodBounds,
  getCenteredZoomWindow,
  hasBarWindowOverflow,
  needsSparseBarWindow,
  PTM_DAILY_BAR_WIDTH,
  PTM_DAILY_VISIBLE_DAYS,
  resolveSparseBarLayoutEnabled,
  shouldDeferDailyBarZoom,
} from '../../src/plugin/timeseries/transformHelpers/sparseTimeBarLayout';

describe('sparseTimeBarLayout', () => {
  const june1 = Date.UTC(2026, 5, 1);
  const june2 = Date.UTC(2026, 5, 2);
  const nowOnJune2 = Date.UTC(2026, 5, 2, 12, 0, 0);

  test('getCalendarPeriodBounds for daily grain uses month boundaries', () => {
    const bounds = getCalendarPeriodBounds(june1, june2, 'P1D');
    expect(bounds.periodStart).toBe(Date.UTC(2026, 5, 1));
    expect(bounds.periodEnd).toBe(Date.UTC(2026, 5, 30, 23, 59, 59, 999));
  });

  test('resolveSparseBarLayoutEnabled defaults to false', () => {
    expect(resolveSparseBarLayoutEnabled({})).toBe(false);
    expect(resolveSparseBarLayoutEnabled({ ptm_sparse_bar_layout: true })).toBe(
      true,
    );
    expect(
      resolveSparseBarLayoutEnabled({ ptm_sparse_bar_alignment: 'center' }),
    ).toBe(true);
  });

  test('needsSparseBarWindow when fewer than 7 unique days', () => {
    expect(needsSparseBarWindow([june1, june2])).toBe(true);
    expect(countUniqueDays([june1, june2])).toBe(2);
  });

  test('hasBarWindowOverflow when 7 or more unique days', () => {
    const days = Array.from({ length: PTM_DAILY_VISIBLE_DAYS }, (_, index) =>
      Date.UTC(2026, 5, 1 + index),
    );
    expect(hasBarWindowOverflow(days)).toBe(true);
    expect(needsSparseBarWindow(days)).toBe(false);
  });

  test('getCenteredZoomWindow centers data and allows virtual pre-month padding', () => {
    const bounds = getCalendarPeriodBounds(june1, june2, 'P1D');
    const { zoomStart, zoomEnd } = getCenteredZoomWindow(
      june1,
      june2,
      bounds.periodStart,
      bounds.periodEnd,
      nowOnJune2,
    );
    const dataCenter = (june1 + june2) / 2;
    const viewportCenter = (zoomStart + zoomEnd) / 2;

    expect(Math.abs(dataCenter - viewportCenter)).toBeLessThan(DAY_MS);
    expect(zoomStart).toBeLessThan(bounds.periodStart);
  });

  test('shouldDeferDailyBarZoom when layout enabled on daily bar', () => {
    expect(
      shouldDeferDailyBarZoom({
        ptm_sparse_bar_layout: true,
        ptmSeriesType: 'bar',
        timeGrainSqla: 'P1D',
      }),
    ).toBe(true);
    expect(
      shouldDeferDailyBarZoom({
        ptmSeriesType: 'bar',
        timeGrainSqla: 'P1D',
      }),
    ).toBe(false);
  });

  test('applySparseTimeBarLayout is a no-op when layout disabled', () => {
    const options = {
      xAxis: { type: 'time', min: 1, max: 2 },
      dataZoom: [{ type: 'slider' }],
      series: [{ type: 'bar', data: [[june1, 100]] }],
    };

    const result = applySparseTimeBarLayout(
      options,
      {
        ptmSeriesType: 'bar',
        timeGrainSqla: 'P1D',
      },
      nowOnJune2,
    );

    expect(result).toBe(options);
  });

  test('applySparseTimeBarLayout applies centered layout for sparse data', () => {
    const options = {
      xAxis: { type: 'time' },
      dataZoom: [{ type: 'slider' }],
      series: [
        {
          type: 'bar',
          data: [
            [june1, 100],
            [june2, 200],
          ],
        },
      ],
    };

    const result = applySparseTimeBarLayout(
      options,
      {
        ptmSeriesType: 'bar',
        orientation: 'vertical',
        timeGrainSqla: 'P1D',
        ptm_sparse_bar_layout: true,
      },
      nowOnJune2,
    );

    const bounds = getCalendarPeriodBounds(june1, june2, 'P1D');
    const window = getCenteredZoomWindow(
      june1,
      june2,
      bounds.periodStart,
      bounds.periodEnd,
      nowOnJune2,
    );
    const xAxis = result.xAxis as {
      min: number;
      max: number;
      axisLabel: { formatter: (value: number) => string };
    };
    expect(xAxis.min).toBe(window.zoomStart);
    expect(xAxis.max).toBe(window.zoomEnd);
    expect(xAxis.axisLabel.formatter(bounds.periodStart - DAY_MS)).toBe('');
    expect(result.dataZoom).toEqual([]);
    expect((result.series as { barWidth: number }[])[0].barWidth).toBe(
      PTM_DAILY_BAR_WIDTH,
    );
  });

  test('applySparseTimeBarLayout enables zoom only on overflow', () => {
    const days = Array.from({ length: PTM_DAILY_VISIBLE_DAYS }, (_, index) =>
      Date.UTC(2026, 5, 1 + index),
    );
    const options = {
      xAxis: { type: 'time' },
      dataZoom: [],
      series: [
        {
          type: 'bar',
          data: days.map((ts, index) => [ts, index + 1]),
        },
      ],
    };

    const withoutZoom = applySparseTimeBarLayout(options, {
      ptmSeriesType: 'bar',
      timeGrainSqla: 'P1D',
      ptm_sparse_bar_layout: true,
      ptm_zoom_enabled: false,
    });
    expect(withoutZoom.dataZoom).toEqual([]);

    const withZoom = applySparseTimeBarLayout(options, {
      ptmSeriesType: 'bar',
      timeGrainSqla: 'P1D',
      ptm_sparse_bar_layout: true,
      ptm_zoom_enabled: true,
      ptm_zoom_axis: 'x',
      ptm_zoom_size: 'xs',
    });
    expect(Array.isArray(withZoom.dataZoom)).toBe(true);
    expect((withZoom.dataZoom as unknown[]).length).toBeGreaterThan(0);
  });

  test('applySparseTimeBarLayout skips non-daily grain', () => {
    const options = {
      xAxis: { type: 'time' },
      series: [{ type: 'bar', data: [] }],
    };
    const result = applySparseTimeBarLayout(options, {
      ptmSeriesType: 'bar',
      timeGrainSqla: 'P1M',
      ptm_sparse_bar_layout: true,
    });
    expect(result).toEqual(options);
  });
});

const DAY_MS = 86_400_000;
