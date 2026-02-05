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
import { FC } from 'react';
import { css, SupersetTheme, t, useTheme } from '@superset-ui/core';
import { Icons } from '@superset-ui/core/components/Icons';
import { Tooltip } from '@superset-ui/core/components';

export type DataReliabilityIconType = 'info' | 'warning' | 'alert';

export interface DataReliabilityIndicatorProps {
  message: string;
  iconType?: DataReliabilityIconType;
}

const iconStyles = (theme: SupersetTheme) => css`
  color: ${theme.colorIcon};
  cursor: pointer;
  &.anticon {
    font-size: unset;
    .anticon {
      line-height: unset;
      vertical-align: unset;
    }
  }
`;

const warningIconStyles = (theme: SupersetTheme) => css`
  color: ${theme.colorWarning};
`;

const alertIconStyles = (theme: SupersetTheme) => css`
  color: ${theme.colorError};
`;

export const DataReliabilityIndicator: FC<DataReliabilityIndicatorProps> = ({
  message,
  iconType = 'info',
}) => {
  const theme = useTheme();

  const Icon =
    iconType === 'warning'
      ? Icons.WarningOutlined
      : iconType === 'alert'
        ? Icons.ExclamationCircleOutlined
        : Icons.InfoCircleOutlined;

  const iconCss =
    iconType === 'warning'
      ? [iconStyles(theme), warningIconStyles(theme)]
      : iconType === 'alert'
        ? [iconStyles(theme), alertIconStyles(theme)]
        : iconStyles(theme);

  const tooltipTitle = (
    <div>
      <div css={{ fontWeight: theme.fontWeightStrong }}>{t('Data Reliability')}</div>
      {message ? (
        <div style={{ whiteSpace: 'pre-wrap', marginTop: 4 }}>{message}</div>
      ) : null}
    </div>
  );

  return (
    <Tooltip title={tooltipTitle} placement="top">
      <span
        role="img"
        aria-label={t('Data Reliability Information')}
        css={iconCss}
      >
        <Icon iconSize="m" />
      </span>
    </Tooltip>
  );
};
