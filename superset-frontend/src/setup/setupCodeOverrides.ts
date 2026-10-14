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

// PTM: ponto único de integração — só este arquivo importa src/ptm e chama applyPTMExtensions().
import getBootstrapData from 'src/utils/getBootstrapData';
import { applyPTMExtensions } from 'src/ptm';

/**
 * Configuration options for setting up code overrides in different contexts.
 */
interface CodeOverrideOptions {
  /**
   * Whether the application is running in embedded mode.
   */
  embedded?: boolean;
}

let ptmInitialized = false;

/**
 * Hook for individual deployments to add custom overrides
 * @param options - Configuration options for the setup process
 */
export default function setupCodeOverrides(options: CodeOverrideOptions = {}) {
  // O embedded não carrega as extensões PTM (a 6.0 só chamava no app principal)
  if (ptmInitialized || options.embedded) {
    return;
  }

  const bootstrapData = getBootstrapData();
  const flags = bootstrapData?.common?.feature_flags as
    | Record<string, boolean>
    | undefined;

  if (flags?.PTM_EXTENSION_ENABLED === true) {
    try {
      applyPTMExtensions();
      if (process.env.NODE_ENV === 'development') {
        console.info('[Setup Code Overrides] PTM extensions applied');
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[Setup Code Overrides] PTM extensions failed:', error);
      }
    }
  }

  ptmInitialized = true;
}
