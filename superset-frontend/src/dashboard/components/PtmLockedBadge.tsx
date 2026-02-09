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
import { Icons, Label, Tooltip } from '@superset-ui/core/components';
import { t, useTheme } from '@superset-ui/core';

export type PtmLockedBadgeProps = {
  tooltipId?: string;
  tooltipTitle?: string;
  label?: string;
  className?: string;
};

export function PtmLockedBadge({
  tooltipId = 'ptm-locked-badge-tooltip',
  tooltipTitle = t('PTM Bloqueado'),
  label = t('PTM Bloqueado'),
  className,
}: PtmLockedBadgeProps) {
  const theme = useTheme();
  return (
    <Tooltip id={tooltipId} title={tooltipTitle} placement="top">
      <Label
        type="warning"
        className={className}
        icon={
          <Icons.LockOutlined iconSize="s" iconColor={theme.colorWarning} />
        }
        style={{ color: theme.colorWarningText, cursor: 'help' }}
      >
        {label}
      </Label>
    </Tooltip>
  );
}

export default PtmLockedBadge;
