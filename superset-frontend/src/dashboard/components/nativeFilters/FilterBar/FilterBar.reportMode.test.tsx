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

import { act, render } from 'spec/helpers/testing-library';
import { stateWithoutNativeFilters } from 'spec/fixtures/mockStore';
import { Constants } from '@superset-ui/core/components';
import { FilterBarOrientation } from 'src/dashboard/types';
import { DashboardStandaloneMode } from 'src/dashboard/util/constants';
import FilterBar from '.';
import { createFilterKey, updateFilterKey } from './keyValue';

jest.useFakeTimers();

jest.mock('./keyValue', () => ({
  createFilterKey: jest.fn(() => Promise.resolve('filter-key')),
  updateFilterKey: jest.fn(() => Promise.resolve('updated')),
  getFilterValue: jest.fn(() => Promise.resolve(null)),
}));

const mockedCreateFilterKey = createFilterKey as jest.Mock;
const mockedUpdateFilterKey = updateFilterKey as jest.Mock;

const filterBarProps = {
  orientation: FilterBarOrientation.Vertical,
  verticalConfig: {
    filtersOpen: true,
    toggleFiltersBar: jest.fn(),
    width: 280,
    height: 400,
    offset: 0,
  },
};

const stateWithNativeFilter = {
  ...stateWithoutNativeFilters,
  dashboardInfo: {
    id: 1,
    dash_edit_perm: true,
    filterBarOrientation: FilterBarOrientation.Vertical,
    metadata: {
      native_filter_configuration: [],
    },
  },
  dataMask: {
    'test-filter': {
      id: 'test-filter',
      filterState: { value: ['value-a'] },
      extraFormData: {},
    },
  },
  nativeFilters: {
    filters: {
      'test-filter': {
        id: 'test-filter',
        name: 'Test Filter',
        filterType: 'filter_select',
        targets: [{ datasetId: 1, column: { name: 'test_column' } }],
        defaultDataMask: {
          filterState: { value: ['value-a'] },
          extraFormData: {},
        },
        controlValues: {},
        cascadeParentIds: [],
        scope: {
          rootPath: ['ROOT_ID'],
          excluded: [],
        },
        type: 'NATIVE_FILTER',
        description: '',
        chartsInScope: [],
        tabsInScope: [],
      },
    },
    filtersState: {},
  },
};

const advancePublishDebounce = async () => {
  await act(async () => {
    jest.advanceTimersByTime(Constants.SLOW_DEBOUNCE + 100);
  });
};

describe('FilterBar report mode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not persist filter state when standalone=3', async () => {
    window.history.pushState(
      {},
      'Test',
      `/superset/dashboard/1/?standalone=${DashboardStandaloneMode.Report}`,
    );

    render(<FilterBar {...filterBarProps} />, {
      initialState: stateWithNativeFilter,
      useRedux: true,
      useRouter: true,
    });

    await advancePublishDebounce();

    expect(mockedCreateFilterKey).not.toHaveBeenCalled();
    expect(mockedUpdateFilterKey).not.toHaveBeenCalled();
  });

  it('persists filter state in normal dashboard mode', async () => {
    window.history.pushState({}, 'Test', '/superset/dashboard/1/');

    render(<FilterBar {...filterBarProps} />, {
      initialState: stateWithNativeFilter,
      useRedux: true,
      useRouter: true,
    });

    await advancePublishDebounce();

    expect(mockedCreateFilterKey).toHaveBeenCalled();
  });
});
