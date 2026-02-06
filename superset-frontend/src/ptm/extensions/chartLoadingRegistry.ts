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
 * specific language governing limitations
 * under the License.
 */

import { getExtensionsRegistry } from '@superset-ui/core';
import { PtmChartLoading } from '../components/chart/PtmChartLoading';

/**
 * Registers the PTM chart loading extension.
 * Provides a custom centered loading spinner without the "Waiting on..." message.
 */
export function registerPtmChartLoadingExtension(): void {
  const registry = getExtensionsRegistry();
  registry.set('dashboard.chart.loading', PtmChartLoading);
  registry.set('explore.chart.loading', PtmChartLoading);
}
