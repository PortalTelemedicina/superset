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
import { FC, useMemo } from 'react';
import { styled } from '@superset-ui/core';
import type { ChartDataReliabilityOverlayProps } from '@superset-ui/core';
import { DataReliabilityIndicator } from 'src/components/DataReliabilityIndicator';

const OverlayWrapper = styled.div`
  position: absolute;
  z-index: 4;
  pointer-events: none;
  & > * {
    pointer-events: auto;
  }
`;

export const DefaultChartDataReliabilityOverlay: FC<
  ChartDataReliabilityOverlayProps
> = ({ formData }) => {
  const positionStyle = useMemo(() => {
    const pos = formData?.data_reliability_position || 'top_right';
    const offset = 8;
    const s: Record<string, number> = {};
    if (pos.includes('top')) s.top = offset;
    if (pos.includes('bottom')) s.bottom = offset;
    if (pos.includes('left')) s.left = offset;
    if (pos.includes('right')) s.right = offset;
    return s;
  }, [formData?.data_reliability_position]);

  return (
    <OverlayWrapper style={positionStyle}>
      <DataReliabilityIndicator
        message={formData.data_reliability_message ?? ''}
        iconType={formData.data_reliability_icon}
      />
    </OverlayWrapper>
  );
};
