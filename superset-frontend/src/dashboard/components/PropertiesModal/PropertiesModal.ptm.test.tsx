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
  render,
  screen,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import fetchMock from 'fetch-mock';
import * as SupersetCore from '@superset-ui/core';
import { isFeatureEnabled } from '@superset-ui/core';
import {
  convertPtmChartsForDashboard,
  revertPtmChartsForDashboard,
} from 'src/ptm/extensions/dashboardSaveRegistry';
import PropertiesModal from '.';

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  isFeatureEnabled: jest.fn(() => false),
  getCategoricalSchemeRegistry: jest.fn(() => ({
    keys: () => ['supersetColors'],
    get: () => ['#FFFFFF', '#000000'],
    getDefaultKey: () => 'supersetColors',
    getMap: () => ({ supersetColors: ['#FFFFFF', '#000000'] }),
  })),
}));

jest.mock('src/dashboard/components/ColorSchemeControlWrapper', () => ({
  __esModule: true,
  default: () => null,
}));

// PTM extension is enabled in this suite so the "Use PTM" toggle and the
// reconciling conversion path are exercised.
jest.mock('src/ptm/config/featureFlags', () => ({
  ...jest.requireActual('src/ptm/config/featureFlags'),
  isPtmExtensionEnabled: () => true,
}));

jest.mock('src/ptm/extensions/dashboardSaveRegistry', () => ({
  convertPtmChartsForDashboard: jest.fn(() => Promise.resolve()),
  revertPtmChartsForDashboard: jest.fn(() => Promise.resolve()),
}));

const mockedConvert = convertPtmChartsForDashboard as jest.Mock;
const mockedRevert = revertPtmChartsForDashboard as jest.Mock;
const mockedIsFeatureEnabled = isFeatureEnabled as jest.Mock;

const DASHBOARD_ID = 30;

const buildDashboard = (metadata: Record<string, unknown>) => ({
  id: DASHBOARD_ID,
  dashboard_title: 'PTM Dashboard',
  json_metadata: JSON.stringify(metadata),
  css: '',
  owners: [],
  roles: [],
  certified_by: '',
  certification_details: '',
  slug: null,
});

const setupFetchMock = ({
  metadata,
  hasSharedCharts,
}: {
  metadata: Record<string, unknown>;
  hasSharedCharts: boolean;
}) => {
  fetchMock.restore();
  fetchMock.get('glob:*/api/v1/dashboard/related/owners*', {
    body: { count: 0, result: [] },
  });
  fetchMock.get('glob:*/api/v1/dashboard/related/roles*', {
    body: { count: 0, result: [] },
  });
  fetchMock.get(`glob:*/api/v1/dashboard/${DASHBOARD_ID}`, {
    body: { result: buildDashboard(metadata) },
  });
  fetchMock.get(`glob:*/api/v1/dashboard/${DASHBOARD_ID}/has_shared_charts`, {
    body: { result: hasSharedCharts },
  });
};

const createProps = (overrides: Record<string, unknown> = {}) => ({
  dashboardId: DASHBOARD_ID,
  show: true,
  colorScheme: 'supersetColors',
  onlyApply: false,
  onHide: jest.fn(),
  onSubmit: jest.fn(),
  addSuccessToast: jest.fn(),
  addDangerToast: jest.fn(),
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockedIsFeatureEnabled.mockReturnValue(false);
  jest
    .spyOn(SupersetCore.SupersetClient, 'put')
    .mockResolvedValue({ json: { result: {} } } as any);
});

afterAll(() => {
  fetchMock.restore();
});

describe('PropertiesModal PTM reconciling conversion', () => {
  test('Save converts charts when PTM is on, even without a toggle transition (self-heal)', async () => {
    setupFetchMock({
      metadata: { ptm_autoconvert: true },
      hasSharedCharts: false,
    });
    const props = createProps({ onlyApply: false });
    render(<PropertiesModal {...props} />, { useRedux: true });

    expect(
      await screen.findByTestId('dashboard-edit-properties-form'),
    ).toBeInTheDocument();

    userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(mockedConvert).toHaveBeenCalledWith(DASHBOARD_ID);
    });
    expect(mockedRevert).not.toHaveBeenCalled();
  });

  test('Apply (in-dashboard edit) also converts charts when PTM is on', async () => {
    setupFetchMock({
      metadata: { ptm_autoconvert: true },
      hasSharedCharts: false,
    });
    const props = createProps({ onlyApply: true });
    render(<PropertiesModal {...props} />, { useRedux: true });

    expect(
      await screen.findByTestId('dashboard-edit-properties-form'),
    ).toBeInTheDocument();

    userEvent.click(screen.getByRole('button', { name: 'Apply' }));

    await waitFor(() => {
      expect(mockedConvert).toHaveBeenCalledWith(DASHBOARD_ID);
    });
    expect(props.onSubmit).toHaveBeenCalledTimes(1);
  });

  test('does not convert when the dashboard has shared charts', async () => {
    setupFetchMock({
      metadata: { ptm_autoconvert: true },
      hasSharedCharts: true,
    });
    const props = createProps({ onlyApply: false });
    render(<PropertiesModal {...props} />, { useRedux: true });

    expect(
      await screen.findByTestId('dashboard-edit-properties-form'),
    ).toBeInTheDocument();

    userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(props.onSubmit).toHaveBeenCalledTimes(1);
    });
    expect(mockedConvert).not.toHaveBeenCalled();
    expect(mockedRevert).not.toHaveBeenCalled();
  });

  test('reverts charts when turning PTM off', async () => {
    setupFetchMock({
      metadata: { ptm_autoconvert: true },
      hasSharedCharts: false,
    });
    const props = createProps({ onlyApply: false });
    render(<PropertiesModal {...props} />, { useRedux: true });

    expect(
      await screen.findByTestId('dashboard-edit-properties-form'),
    ).toBeInTheDocument();

    userEvent.click(screen.getByRole('switch'));
    userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(mockedRevert).toHaveBeenCalledWith(DASHBOARD_ID);
    });
    expect(mockedConvert).not.toHaveBeenCalled();
  });

  test('does not convert or revert when PTM is off and was already off', async () => {
    setupFetchMock({ metadata: {}, hasSharedCharts: false });
    const props = createProps({ onlyApply: false });
    render(<PropertiesModal {...props} />, { useRedux: true });

    expect(
      await screen.findByTestId('dashboard-edit-properties-form'),
    ).toBeInTheDocument();

    userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(props.onSubmit).toHaveBeenCalledTimes(1);
    });
    expect(mockedConvert).not.toHaveBeenCalled();
    expect(mockedRevert).not.toHaveBeenCalled();
  });
});
