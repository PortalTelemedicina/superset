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

import { css, getExtensionsRegistry, t, useTheme } from '@superset-ui/core';
import { Icons } from '@superset-ui/core/components/Icons';

const sanitizeVizType = (vizType: string) =>
  String(vizType || '').replace(/[^a-zA-Z0-9_-]/g, '-');

const PtmActionsTrigger = () => {
  const theme = useTheme();
  return (
    <span
      css={css`
        display: inline-flex;
        align-items: center;
        gap: ${theme.sizeUnit}px;
        font-size: ${theme.fontSizeSM}px;
        font-weight: 600;
        color: ${theme.colorText};
        white-space: nowrap;
      `}
    >
      {t('Ações')}
      <Icons.DownOutlined
        css={css`
          color: ${theme.colorTextSecondary};
        `}
      />
    </span>
  );
};

/**
 * Registers SliceHeaderControls function overrides (classNames + trigger for ptm_table).
 * This is the only extension slot that uses functions instead of component replacement.
 */
export function registerPtmSliceHeaderControlsExtension(): void {
  const registry = getExtensionsRegistry();

  registry.set(
    'dashboard.sliceHeaderControls.classNames',
    ({ slice }: { slice: { viz_type: string } }) => {
      const viz = sanitizeVizType(slice?.viz_type);
      return {
        menu: `ptm-slice-menu ptm-slice-menu--${viz}`,
        controls: `ptm-slice-controls ptm-slice-controls--${viz}`,
      };
    },
  );

  registry.set(
    'dashboard.sliceHeaderControls.trigger',
    ({ slice }: { slice: { viz_type: string } }) => {
      if (slice?.viz_type !== 'ptm_table') {
        return null;
      }
      return <PtmActionsTrigger />;
    },
  );
}
