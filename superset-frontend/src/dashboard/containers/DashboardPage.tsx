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
import { createContext, lazy, FC, useEffect, useMemo, useRef } from 'react';
import { Global } from '@emotion/react';
import { useHistory } from 'react-router-dom';
import { getExtensionsRegistry, SupersetClient, t, useTheme } from '@superset-ui/core';
import {
  DashboardExtensionsContext,
  type DashboardExtensionsValue,
} from 'src/dashboard/components/DashboardExtensionsContext';
import {
  DefaultDashboardCssInjector,
} from 'src/dashboard/components/DashboardCssInjector';
import { useDispatch, useSelector } from 'react-redux';
import { createSelector } from '@reduxjs/toolkit';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import { Loading } from '@superset-ui/core/components';
import {
  useDashboard,
  useDashboardCharts,
  useDashboardDatasets,
} from 'src/hooks/apiResources';
import { hydrateDashboard } from 'src/dashboard/actions/hydrate';
import { setDatasources } from 'src/dashboard/actions/datasources';
import {
  getAllActiveFilters,
  getRelevantDataMask,
} from 'src/dashboard/util/activeAllDashboardFilters';
import { getActiveFilters } from 'src/dashboard/util/activeDashboardFilters';
import { LocalStorageKeys, setItem } from 'src/utils/localStorageHelpers';
import { URL_PARAMS } from 'src/constants';
import { getUrlParam } from 'src/utils/urlUtils';
import { setDatasetsStatus } from 'src/dashboard/actions/dashboardState';
import {
  getFilterValue,
  getPermalinkValue,
} from 'src/dashboard/components/nativeFilters/FilterBar/keyValue';
import DashboardContainer from 'src/dashboard/containers/Dashboard';
import CrudThemeProvider from 'src/components/CrudThemeProvider';

import { nanoid } from 'nanoid';
import { RootState } from '../types';
import {
  chartContextMenuStyles,
  filterCardPopoverStyle,
  focusStyle,
  headerStyles,
  chartHeaderStyles,
} from '../styles';
import SyncDashboardState, {
  getDashboardContextLocalStorage,
} from '../components/SyncDashboardState';
import OverwriteConfirm from '../components/OverwriteConfirm';
import { isPtmExtensionEnabled } from 'src/ptm/config/featureFlags';

export const DashboardPageIdContext = createContext('');

const DashboardBuilder = lazy(
  () =>
    import(
      /* webpackChunkName: "DashboardContainer" */
      /* webpackPreload: true */
      'src/dashboard/components/DashboardBuilder/DashboardBuilder'
    ),
);

type PageProps = {
  idOrSlug: string;
};

// TODO: move to Dashboard.jsx when it's refactored to functional component
const selectRelevantDatamask = createSelector(
  (state: RootState) => state.dataMask, // the first argument accesses relevant data from global state
  dataMask => getRelevantDataMask(dataMask, 'ownState'), // the second parameter conducts the transformation
);

const selectChartConfiguration = (state: RootState) =>
  state.dashboardInfo.metadata?.chart_configuration;
const selectNativeFilters = (state: RootState) => state.nativeFilters.filters;
const selectDataMask = (state: RootState) => state.dataMask;
const selectAllSliceIds = (state: RootState) => state.dashboardState.sliceIds;
// TODO: move to Dashboard.jsx when it's refactored to functional component
const selectActiveFilters = createSelector(
  [
    selectChartConfiguration,
    selectNativeFilters,
    selectDataMask,
    selectAllSliceIds,
  ],
  (chartConfiguration, nativeFilters, dataMask, allSliceIds) => ({
    ...getActiveFilters(),
    ...getAllActiveFilters({
      // eslint-disable-next-line camelcase
      chartConfiguration,
      nativeFilters,
      dataMask,
      allSliceIds,
    }),
  }),
);

export const DashboardPage: FC<PageProps> = ({ idOrSlug }: PageProps) => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const history = useHistory();
  const dashboardPageId = useMemo(() => nanoid(), []);
  const { addDangerToast } = useToasts();
  const { result: dashboard, error: dashboardApiError } =
    useDashboard(idOrSlug);
  const { result: charts, error: chartsApiError } =
    useDashboardCharts(idOrSlug);
  const {
    result: datasets,
    error: datasetsApiError,
    status,
  } = useDashboardDatasets(idOrSlug);
  const isDashboardHydrated = useRef(false);

  const hasDashboardInfoInitiated = useSelector<RootState, Boolean>(
    ({ dashboardInfo }) => {
      if (!dashboardInfo || Object.keys(dashboardInfo).length === 0) {
        return false;
      }
      // Ensure Redux has the CURRENT dashboard, not a previous one
      const dashId = String(dashboardInfo.id);
      return dashId === idOrSlug || dashId === String(dashboard?.id || '');
    },
  );
  const dashboardTheme = useSelector(
    (state: RootState) => state.dashboardInfo.theme,
  );

  // Reset hydration flag when navigating to a different dashboard
  useEffect(() => {
    isDashboardHydrated.current = false;
  }, [idOrSlug]);

  const error = dashboardApiError || chartsApiError;
  const readyToRender = Boolean(dashboard && charts);
  const { dashboard_title, id = 0 } = dashboard || {};

  // Get CSS from Redux state (updated by updateCss action) instead of API
  const css =
    useSelector((state: RootState) => state.dashboardState.css) ||
    dashboard?.css;

  useEffect(() => {
    // mark tab id as redundant when user closes browser tab - a new id will be
    // generated next time user opens a dashboard and the old one won't be reused
    const handleTabClose = () => {
      const dashboardsContexts = getDashboardContextLocalStorage();
      setItem(LocalStorageKeys.DashboardExploreContext, {
        ...dashboardsContexts,
        [dashboardPageId]: {
          ...dashboardsContexts[dashboardPageId],
          isRedundant: true,
        },
      });
    };
    window.addEventListener('beforeunload', handleTabClose);
    return () => {
      window.removeEventListener('beforeunload', handleTabClose);
    };
  }, [dashboardPageId]);

  useEffect(() => {
    dispatch(setDatasetsStatus(status));
  }, [dispatch, status]);

  useEffect(() => {
    // eslint-disable-next-line consistent-return
    async function getDataMaskApplied() {
      const permalinkKey = getUrlParam(URL_PARAMS.permalinkKey);
      const nativeFilterKeyValue = getUrlParam(URL_PARAMS.nativeFiltersKey);
      const isOldRison = getUrlParam(URL_PARAMS.nativeFilters);

      let dataMask = nativeFilterKeyValue || {};
      // activeTabs is initialized with undefined so that it doesn't override
      // the currently stored value when hydrating
      let activeTabs: string[] | undefined;
      if (permalinkKey) {
        const permalinkValue = await getPermalinkValue(permalinkKey);
        if (permalinkValue) {
          ({ dataMask, activeTabs } = permalinkValue.state);
        }
      } else if (nativeFilterKeyValue) {
        dataMask = await getFilterValue(id, nativeFilterKeyValue);
      }
      if (isOldRison) {
        dataMask = isOldRison;
      }

      if (readyToRender && dashboard) {
        if (!isDashboardHydrated.current) {
          isDashboardHydrated.current = true;
        }
        let dashboardToHydrate = dashboard;
        if (isPtmExtensionEnabled()) {
          try {
            const { json } = await SupersetClient.get({
              endpoint: `/api/v1/dashboard/${idOrSlug}/has_shared_charts`,
            });
            const hasSharedCharts = (json as { result?: boolean })?.result === true;
            dashboardToHydrate = {
              ...dashboard,
              metadata: {
                ...dashboard.metadata,
                has_shared_charts: hasSharedCharts,
              },
            };
          } catch {
            // Non-fatal: proceed without has_shared_charts
          }
        }
        dispatch(
          hydrateDashboard({
            history,
            dashboard: dashboardToHydrate,
            charts,
            activeTabs,
            dataMask,
          }),
        );
      }
      return null;
    }
    if (id) getDataMaskApplied();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readyToRender]);

  useEffect(() => {
    if (dashboard_title) {
      document.title = dashboard_title;
    }
    return () => {
      document.title = 'Superset';
    };
  }, [dashboard_title]);

  // Dashboard extensions: read registry once at root and provide via context
  const dashboardExtensions = useMemo((): DashboardExtensionsValue => {
    const registry = getExtensionsRegistry();
    return {
      headerComponent: registry.get('dashboard.header.replacement'),
      filterBarComponent: registry.get(
        'dashboard.filterbar.horizontal.replacement',
      ),
      filterValueLoadingComponent: registry.get(
        'dashboard.filterbar.filterValue.loading',
      ),
      filterBarSettingsComponent: registry.get(
        'dashboard.filterbar.settings.replacement',
      ),
      sliceHeaderControlsClassNamesFn: registry.get(
        'dashboard.sliceHeaderControls.classNames',
      ),
      sliceHeaderControlsTriggerFn: registry.get(
        'dashboard.sliceHeaderControls.trigger',
      ),
      dashboardCssInjectorComponent: registry.get(
        'dashboard.css.injector',
      ) as DashboardExtensionsValue['dashboardCssInjectorComponent'],
      chartDataReliabilityOverlayComponent: registry.get(
        'dashboard.chart.dataReliabilityOverlay',
      ),
    };
  }, []);

  const DashboardCssInjector =
    dashboardExtensions.dashboardCssInjectorComponent ??
    DefaultDashboardCssInjector;
  const dashboardCss = typeof css === 'string' ? css : '';

  useEffect(() => {
    if (datasetsApiError) {
      addDangerToast(
        t('Error loading chart datasources. Filters may not work correctly.'),
      );
    } else {
      dispatch(setDatasources(datasets));
    }
  }, [addDangerToast, datasets, datasetsApiError, dispatch]);

  const relevantDataMask = useSelector(selectRelevantDatamask);
  const activeFilters = useSelector(selectActiveFilters);

  if (error) throw error; // caught in error boundary

  const globalStyles = useMemo(
    () => [
      filterCardPopoverStyle(),
      headerStyles(theme),
      chartContextMenuStyles(theme),
      focusStyle(theme),
      chartHeaderStyles(theme),
    ],
    [theme],
  );

  if (error) throw error; // caught in error boundary

  const DashboardBuilderComponent = useMemo(() => <DashboardBuilder />, []);
  return (
    <>
      <Global styles={globalStyles} />
      {readyToRender && hasDashboardInfoInitiated ? (
        <>
          <SyncDashboardState dashboardPageId={dashboardPageId} />
          <OverwriteConfirm />
          <DashboardPageIdContext.Provider value={dashboardPageId}>
            <DashboardExtensionsContext.Provider value={dashboardExtensions}>
              <DashboardCssInjector
                dashboardCss={dashboardCss}
                dashboard={dashboard}
              />
              <CrudThemeProvider
                themeId={
                  dashboardTheme !== undefined
                    ? dashboardTheme?.id
                    : dashboard?.theme?.id
                }
              >
                <DashboardContainer
                  activeFilters={activeFilters}
                  ownDataCharts={relevantDataMask}
                >
                  {DashboardBuilderComponent}
                </DashboardContainer>
              </CrudThemeProvider>
            </DashboardExtensionsContext.Provider>
          </DashboardPageIdContext.Provider>
        </>
      ) : (
        <Loading />
      )}
    </>
  );
};

export default DashboardPage;
