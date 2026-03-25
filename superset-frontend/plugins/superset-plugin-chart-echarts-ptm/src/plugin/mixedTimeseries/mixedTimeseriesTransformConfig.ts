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

import { t } from '@superset-ui/core';
import { ControlSetRow } from '@superset-ui/chart-controls';
import type { TransformConfig } from '../../shared/transformHelpers';

export const MIXED_TIMESERIES_TRANSFORM_CONFIG: TransformConfig = {
  defaults: true,
  seriesType: false, // Query A / Query B already define series types
  dataZoom: true,
  colorPalette: true,
  pillFormat: false,
  userOverrides: true,
  textCasing: true,
};

/** Rounded bars for bar series (Query A/B). Always visible; applies when chart has bar series. */
export const mixedTimeseriesBarRadiusControlRow1: ControlSetRow = [
  {
    name: 'ptm_bar_radius_enabled',
    config: {
      type: 'CheckboxControl',
      label: t('Rounded bars'),
      default: true,
      renderTrigger: true,
    },
  },
  {
    name: 'ptm_bar_radius_size',
    config: {
      type: 'TextControl',
      label: t('Radius (px)'),
      default: '8',
      isInt: true,
      renderTrigger: true,
      visibility: ({
        controls,
      }: {
        controls?: { ptm_bar_radius_enabled?: { value?: boolean } };
      }) => controls?.ptm_bar_radius_enabled?.value === true,
    },
  },
];

export const mixedTimeseriesBarRadiusControlRow2: ControlSetRow = [
  {
    name: 'ptm_bar_radius_round_top',
    config: {
      type: 'CheckboxControl',
      label: t('Round top'),
      default: true,
      renderTrigger: true,
      visibility: ({
        controls,
      }: {
        controls?: { ptm_bar_radius_enabled?: { value?: boolean } };
      }) => controls?.ptm_bar_radius_enabled?.value === true,
    },
  },
  {
    name: 'ptm_bar_radius_round_bottom',
    config: {
      type: 'CheckboxControl',
      label: t('Round bottom'),
      default: true,
      renderTrigger: true,
      visibility: ({
        controls,
      }: {
        controls?: { ptm_bar_radius_enabled?: { value?: boolean } };
      }) => controls?.ptm_bar_radius_enabled?.value === true,
    },
  },
];

// Reuse zoom control from timeseries
export { timeseriesZoomControl } from '../timeseries/timeseriesTransformConfig';
