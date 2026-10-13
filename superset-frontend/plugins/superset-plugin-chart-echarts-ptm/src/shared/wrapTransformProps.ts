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
import { ChartProps } from '@superset-ui/core';
import merge from 'lodash.merge';
import {
  type TransformConfig,
  resolveTransformConfig,
  applyTextCasingToEchartOptions,
  safeParseJson,
} from './transformHelpers';
import { createDefaultPluginTransform } from './defaultPluginTransform';
import { applySparseTimeBarLayout } from '../plugin/timeseries/transformHelpers/sparseTimeBarLayout';
import { applyBarSeriesLabelLayout } from '../plugin/timeseries/transformHelpers/barSeriesLabelLayout';

export interface PtmTransformConfig {
  ptmDefaults: Record<string, unknown>;
  transforms?: TransformConfig;

  pluginTransform?: (
    options: EchartOptions,
    formData: Record<string, unknown>,
    transforms: TransformConfig,
  ) => EchartOptions;
}

interface EchartOptions {
  series?: Record<string, unknown>[];
  xAxis?: Record<string, unknown> | Record<string, unknown>[];
  yAxis?: Record<string, unknown> | Record<string, unknown>[];
  [key: string]: unknown;
}

export function wrapTransformProps<T extends ChartProps>(
  baseTransformProps: (chartProps: T) => Record<string, unknown>,
  config: PtmTransformConfig,
): (chartProps: T) => Record<string, unknown> {
  const { ptmDefaults, transforms: transformsConfig, pluginTransform } = config;

  const transforms = resolveTransformConfig(transformsConfig);
  const transform =
    pluginTransform || createDefaultPluginTransform(ptmDefaults);

  return (chartProps: T): Record<string, unknown> => {
    const base = baseTransformProps(chartProps);
    const formData = chartProps.formData as Record<string, unknown>;

    let finalOptions: EchartOptions = {
      ...((base.echartOptions as Record<string, unknown>) ??
        (base.echartsOptions as Record<string, unknown>) ??
        {}),
    };

    finalOptions = transform(finalOptions, formData, transforms);

    if (transforms.textCasing) {
      finalOptions = applyTextCasingToEchartOptions(finalOptions, formData);
    }

    if (transforms.userOverrides) {
      const ptmJson = (formData.ptm_options_json ?? formData.ptmOptionsJson) as
        | string
        | undefined;
      const userOverrides = safeParseJson(ptmJson);
      if (Object.keys(userOverrides).length > 0) {
        finalOptions = merge({}, finalOptions, userOverrides);
      }
    }

    finalOptions = applyBarSeriesLabelLayout(
      finalOptions as Record<string, unknown>,
    ) as EchartOptions;

    finalOptions = applySparseTimeBarLayout(
      finalOptions as Record<string, unknown>,
      formData,
    ) as EchartOptions;

    const result = {
      ...base,
      echartOptions: finalOptions,
    };

    return result;
  };
}

export default wrapTransformProps;
