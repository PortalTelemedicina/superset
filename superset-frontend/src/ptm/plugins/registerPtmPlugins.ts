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

import { DeckGLChartPresetPTM } from '@superset-ui/legacy-preset-chart-deckgl-maplibre-ptm';
import MapLibreChartPluginPTM from '@superset-ui/legacy-plugin-chart-maplibre-ptm';
import {
  PtmTimeseriesChartPlugin,
  PtmPieChartPlugin,
  PtmBigNumberTotalChartPlugin,
  PtmBigNumberWithTrendlineChartPlugin,
  PtmTableChartPlugin,
  PtmMixedTimeseriesChartPlugin,
  PtmPivotTableChartPlugin,
} from '@superset-ui/superset-plugin-chart-echarts-ptm';

/**
 * Registers all PTM chart plugins and presets with the global chart registry.
 * Must be called after MainPreset has been registered (e.g. from setupExtensions).
 */
export function registerPtmPlugins(): void {
  new DeckGLChartPresetPTM().register();
  new MapLibreChartPluginPTM().configure({ key: 'maplibre_ptm' }).register();

  new PtmTimeseriesChartPlugin().configure({ key: 'ptm_echarts_timeseries' }).register();
  new PtmPieChartPlugin().configure({ key: 'ptm_pie' }).register();
  new PtmBigNumberTotalChartPlugin().configure({ key: 'ptm_big_number_total' }).register();
  new PtmBigNumberWithTrendlineChartPlugin().configure({ key: 'ptm_big_number_trendline' }).register();
  new PtmTableChartPlugin().configure({ key: 'ptm_table' }).register();
  new PtmMixedTimeseriesChartPlugin().configure({ key: 'ptm_mixed_timeseries' }).register();
  new PtmPivotTableChartPlugin().configure({ key: 'ptm_pivot_table' }).register();
}
