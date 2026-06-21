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

jest.mock('@superset-ui/core', () => ({
  SupersetClient: { get: jest.fn(), put: jest.fn() },
  getExtensionsRegistry: jest.fn(() => ({ set: jest.fn() })),
}));

jest.mock('../config/featureFlags', () => ({
  isPtmExtensionEnabled: () => true,
}));

import { SupersetClient } from '@superset-ui/core';
import {
  ptmDashboardSaveHook,
  convertPtmChartsForDashboard,
  revertPtmChartsForDashboard,
} from './dashboardSaveRegistry';

const mockGet = SupersetClient.get as unknown as jest.Mock;
const mockPut = SupersetClient.put as unknown as jest.Mock;

type Chart = {
  id: number;
  form_data: Record<string, unknown>;
  slice_name: string;
  datasource_id: number;
  datasource_type: string;
};

const legacyChart = (id: number, vizType = 'table'): Chart => ({
  id,
  form_data: { viz_type: vizType, datasource_id: 1, datasource_type: 'table' },
  slice_name: `chart-${id}`,
  datasource_id: 1,
  datasource_type: 'table',
});

const ptmChart = (id: number, vizType = 'ptm_table'): Chart => ({
  id,
  form_data: { viz_type: vizType, datasource_id: 1, datasource_type: 'table' },
  slice_name: `chart-${id}`,
  datasource_id: 1,
  datasource_type: 'table',
});

function setupClient(charts: Chart[], sharedCharts = false) {
  mockGet.mockImplementation(({ endpoint }: { endpoint: string }) => {
    if (endpoint.includes('has_shared_charts')) {
      return Promise.resolve({ json: { result: sharedCharts } });
    }
    if (endpoint.endsWith('/charts')) {
      return Promise.resolve({ json: { result: charts } });
    }
    return Promise.resolve({ json: { result: { json_metadata: '{}' } } });
  });
  mockPut.mockResolvedValue({ json: {} });
}

const putCalls = () =>
  mockPut.mock.calls.map(([arg]) => {
    const a = arg as { endpoint: string; body: string };
    return { endpoint: a.endpoint, body: JSON.parse(a.body) };
  });

const putEndpoints = () => putCalls().map(c => c.endpoint);

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ptmDashboardSaveHook (no chart changes on routine saves)', () => {
  test('update mode never changes charts even when ptm_autoconvert is true', async () => {
    setupClient([legacyChart(1)]);
    await ptmDashboardSaveHook({
      mode: 'update',
      dashboardId: 100,
      dashboard: { metadata: { ptm_autoconvert: true } },
      slices: { 1: { form_data: { viz_type: 'table' } } },
    } as any);

    expect(mockPut).not.toHaveBeenCalled();
  });

  test('update mode never reverts charts even when ptm_autoconvert is false', async () => {
    setupClient([ptmChart(1)]);
    await ptmDashboardSaveHook({
      mode: 'update',
      dashboardId: 100,
      dashboard: { metadata: { ptm_autoconvert: false } },
      slices: { 1: { form_data: { viz_type: 'ptm_table' } } },
    } as any);

    expect(mockPut).not.toHaveBeenCalled();
  });

  test('copy mode converts the NEW dashboard charts when it opts into PTM', async () => {
    setupClient([legacyChart(1), ptmChart(2)]);
    await ptmDashboardSaveHook({
      mode: 'copy',
      newDashboardId: 555,
      dashboard: { metadata: { ptm_autoconvert: true } },
      slices: {},
    } as any);

    const calls = putCalls();
    // only the legacy chart (1) is converted; the already-PTM chart (2) is skipped
    expect(calls).toHaveLength(1);
    expect(calls[0].endpoint).toBe('/api/v1/chart/1');
    expect(calls[0].body.viz_type).toBe('ptm_table');
  });

  test('copy mode does nothing when the copy does not opt into PTM', async () => {
    setupClient([legacyChart(1)]);
    await ptmDashboardSaveHook({
      mode: 'copy',
      newDashboardId: 555,
      dashboard: { metadata: { ptm_autoconvert: false } },
      slices: {},
    } as any);

    expect(mockPut).not.toHaveBeenCalled();
  });

  test('copy mode does nothing when the new dashboard has shared charts', async () => {
    setupClient([legacyChart(1)], /* sharedCharts */ true);
    await ptmDashboardSaveHook({
      mode: 'copy',
      newDashboardId: 555,
      dashboard: { metadata: { ptm_autoconvert: true } },
      slices: {},
    } as any);

    expect(mockPut).not.toHaveBeenCalled();
  });
});

describe('convertPtmChartsForDashboard', () => {
  test('converts only legacy charts with a PTM equivalent', async () => {
    setupClient([legacyChart(1, 'table'), ptmChart(2), legacyChart(3, 'table')]);
    await convertPtmChartsForDashboard(100);

    const endpoints = putEndpoints().sort();
    expect(endpoints).toEqual(['/api/v1/chart/1', '/api/v1/chart/3']);
    expect(endpoints).not.toContain('/api/v1/chart/2');
  });
});

describe('revertPtmChartsForDashboard', () => {
  test('reverts only PTM charts to their legacy equivalent', async () => {
    setupClient([ptmChart(1), legacyChart(2)]);
    await revertPtmChartsForDashboard(100);

    const calls = putCalls();
    expect(calls).toHaveLength(1);
    expect(calls[0].endpoint).toBe('/api/v1/chart/1');
    expect(calls[0].body.viz_type).toBe('table');
  });
});
