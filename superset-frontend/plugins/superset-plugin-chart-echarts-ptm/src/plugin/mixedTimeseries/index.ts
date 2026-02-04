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
import { createPtmPlugin, ptmTextCasingControls } from '../../shared';
import {
  MIXED_TIMESERIES_TRANSFORM_CONFIG,
  mixedTimeseriesBarRadiusControlRow1,
  mixedTimeseriesBarRadiusControlRow2,
  timeseriesZoomControl,
} from './mixedTimeseriesTransformConfig';
import { mixedTimeseriesPluginTransform } from './mixedTimeseriesPluginTransform';
import thumbnail from './images/thumbnail.png';

import MixedTimeseriesTransformProps from '@superset-ui/plugin-chart-echarts/MixedTimeseries/transformProps';
import MixedTimeseriesBuildQuery from '@superset-ui/plugin-chart-echarts/MixedTimeseries/buildQuery';
import MixedTimeseriesControlPanel from '@superset-ui/plugin-chart-echarts/MixedTimeseries/controlPanel';
import EchartsMixedTimeseries from '@superset-ui/plugin-chart-echarts/MixedTimeseries/EchartsMixedTimeseries';

import MIXED_TIMESERIES_PTM_DEFAULTS from './defaults';

const PtmMixedTimeseriesChartPlugin = createPtmPlugin({
  name: 'PTM Mixed Timeseries',
  description:
    'Mixed timeseries chart with Portal Telemedicina styling. Combines multiple metrics from different queries with rounded bars, zoom, and series type options.',
  category: 'Evolution',
  tags: ['ECharts', 'Timeseries', 'Mixed', 'Line', 'Bar', 'Temporal'],
  thumbnail,
  base: {
    buildQuery: MixedTimeseriesBuildQuery,
    transformProps: MixedTimeseriesTransformProps,
    controlPanel: MixedTimeseriesControlPanel,
    Chart: EchartsMixedTimeseries,
  },
  transforms: MIXED_TIMESERIES_TRANSFORM_CONFIG,
  ptmDefaults: MIXED_TIMESERIES_PTM_DEFAULTS,
  pluginTransform: mixedTimeseriesPluginTransform,
  additionalPtmControls: [
    mixedTimeseriesBarRadiusControlRow1,
    mixedTimeseriesBarRadiusControlRow2,
    timeseriesZoomControl,
    ptmTextCasingControls,
  ],
});

export default PtmMixedTimeseriesChartPlugin;
