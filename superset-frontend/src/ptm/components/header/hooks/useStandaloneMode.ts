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
 * specific language governing limitations under the License.
 */
import { useMemo } from 'react';
import { getUrlParam } from 'src/utils/urlUtils';
import { URL_PARAMS } from 'src/constants';
import { isEmbedded as isEmbeddedInIframe } from 'src/dashboard/util/isEmbedded';

/**
 * Hook to detect if dashboard is in standalone/shared mode.
 *
 * Detects standalone mode by checking:
 * - URL parameter `standalone`
 * - If dashboard is embedded in iframe
 * - If dashboard has no userId (embedded mode)
 *
 * @param isEmbedded - Whether dashboard is embedded (no userId)
 * @returns true if in standalone/shared mode
 */
export const useStandaloneMode = (isEmbedded: boolean): boolean =>
  useMemo(() => {
    const standaloneParam = getUrlParam(URL_PARAMS.standalone);
    const isInIframe = isEmbeddedInIframe();
    // Show custom header when: standalone param exists OR in iframe OR isEmbedded (no userId)
    return !!standaloneParam || isInIframe || isEmbedded;
  }, [isEmbedded]);
