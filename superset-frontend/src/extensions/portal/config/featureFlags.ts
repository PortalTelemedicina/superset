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
import { isFeatureEnabled, FeatureFlag } from '@superset-ui/core';

export const PORTAL_HEADER_CUSTOM_ENABLED = 'PORTAL_HEADER_CUSTOM_ENABLED';

/**
 * Checks if custom header extension is enabled.
 * 
 * Can be controlled via:
 * 1. Feature flag (if registered)
 * 2. Config variable (window.SUPERSET_CONFIG.extensions.portal.headerCustomEnabled)
 * 3. Environment variable (PORTAL_HEADER_CUSTOM_ENABLED)
 * 
 * @returns true if custom header should be enabled
 */
export const isPortalHeaderCustomEnabled = (): boolean => {
  // Check feature flag first (if it exists in window.featureFlags)
  try {
    if (
      typeof window !== 'undefined' &&
      window.featureFlags &&
      PORTAL_HEADER_CUSTOM_ENABLED in window.featureFlags
    ) {
      // Use type assertion since this is a custom feature flag not in the enum
      const featureFlag = PORTAL_HEADER_CUSTOM_ENABLED as unknown as FeatureFlag;
      if (isFeatureEnabled(featureFlag)) {
        return true;
      }
    }
  } catch {
    // Silently fail if feature flag check fails
  }

  // Check config variable
  const configEnabled = 
    (window as any).SUPERSET_CONFIG?.extensions?.portal?.headerCustomEnabled;
  
  if (configEnabled !== undefined) {
    return Boolean(configEnabled);
  }

  // Default: enabled (can be changed to false for stricter control)
  return true;
};

