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

// For individual deployments to add custom overrides
// PTM: single integration point — only this file imports PTM and calls applyPTMExtensions().

import getBootstrapData from 'src/utils/getBootstrapData';
import { applyPTMExtensions } from 'src/ptm';

let extensionsInitialized = false;

export default function setupExtensions() {
  if (extensionsInitialized) {
    return;
  }

  const bootstrapData = getBootstrapData();
  const flags = bootstrapData?.common?.feature_flags as
    | Record<string, boolean>
    | undefined;
  const ptmExtensionEnabled = flags?.PTM_EXTENSION_ENABLED === true;

  if (ptmExtensionEnabled) {
    try {
      applyPTMExtensions();
      if (process.env.NODE_ENV === 'development') {
        console.info('[Setup Extensions] PTM extensions applied');
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[Setup Extensions] PTM extensions failed:', error);
      }
    }
  }

  extensionsInitialized = true;
}
