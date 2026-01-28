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
import { useSelector } from 'react-redux';
import { URL_PARAMS } from 'src/constants';
import { RootState } from 'src/dashboard/types';
import { getUrlParam } from 'src/utils/urlUtils';

import { DefaultFilterBarSettings } from 'src/dashboard/components/nativeFilters/FilterBar/FilterBarSettings';

/**
 * Portal replacement for FilterBarSettings.
 *
 * This is intentionally implemented as an extension so core stays upstream-friendly.
 */
const PortalFilterBarSettings: FC = () => {
  const isEmbedded = useSelector<RootState, boolean>(
    state => !state.dashboardInfo?.userId,
  );
  const standaloneMode = getUrlParam(URL_PARAMS.standalone);

  // Hide settings (gear) in preview/standalone/embedded modes
  if (isEmbedded || standaloneMode !== null) {
    return null;
  }

  return <DefaultFilterBarSettings />;
};

export default PortalFilterBarSettings;

