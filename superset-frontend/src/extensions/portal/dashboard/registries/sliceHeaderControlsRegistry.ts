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

import { getExtensionsRegistry } from '@superset-ui/core';

const sanitizeVizType = (vizType: string) =>
  String(vizType || '').replace(/[^a-zA-Z0-9_-]/g, '-');

/**
 * Registers SliceHeaderControls className overrides.
 *
 * Key used:
 * - dashboard.sliceHeaderControls.classNames
 */
export const registerSliceHeaderControlsExtensions = () => {
  const extensionsRegistry = getExtensionsRegistry();

  extensionsRegistry.set(
    'dashboard.sliceHeaderControls.classNames' as any,
    ({ slice }: { slice: { viz_type: string } }) => {
      const viz = sanitizeVizType(slice?.viz_type);
      return {
        menu: `ptm-slice-menu ptm-slice-menu--${viz}`,
        controls: `ptm-slice-controls ptm-slice-controls--${viz}`,
      };
    },
  );
};

