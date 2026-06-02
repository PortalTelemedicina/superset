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
import { styled } from '@superset-ui/core';
import { Loading } from '@superset-ui/core/components';

const LoadingContainer = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
`;

interface PtmChartLoadingProps {
  chartId: number;
  chartStatus?: string;
}

/**
 * PTM custom loading spinner component for charts.
 * Provides a centered spinner without the "Waiting on..." message text.
 */
export function PtmChartLoading({
  chartId,
  chartStatus,
}: PtmChartLoadingProps) {
  return (
    <LoadingContainer>
      <Loading position="inline-centered" />
    </LoadingContainer>
  );
}
