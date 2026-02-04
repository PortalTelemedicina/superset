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

import type { ComponentType } from 'react';
import { getExtensionsRegistry } from '@superset-ui/core';
import type { HorizontalBarProps } from 'src/dashboard/components/nativeFilters/FilterBar/types';
import { FilterBarAdapter } from 'src/ptm/components/filterBar/adapters/FilterBarAdapter';
import { FilterValueLoading } from 'src/ptm/components/filterBar/components/FilterValueLoading';

/**
 * Registers the PTM horizontal filter bar (collapsible + chips) and filter value loading when enabled.
 */
export function registerPtmFilterBarExtension(): void {
  const registry = getExtensionsRegistry();
  registry.set(
    'dashboard.filterbar.horizontal.replacement',
    FilterBarAdapter as ComponentType<HorizontalBarProps>,
  );
  registry.set(
    'dashboard.filterbar.filterValue.loading',
    FilterValueLoading as ComponentType,
  );
}
