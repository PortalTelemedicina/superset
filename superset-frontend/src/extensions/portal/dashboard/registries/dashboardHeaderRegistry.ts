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
import React from 'react';
import { HeaderLayout } from '../header/types';

export interface HeaderRegistryEntry {
  component: React.ComponentType<any>;
  condition?: (props: any) => boolean;
  priority?: number;
}

/**
 * Registry for dashboard header extensions.
 * 
 * Allows registering custom header components that can be conditionally rendered
 * based on dashboard state (standalone mode, preview mode, etc.)
 */
class DashboardHeaderRegistry {
  private entries: Map<string, HeaderRegistryEntry> = new Map();

  register(id: string, entry: HeaderRegistryEntry) {
    this.entries.set(id, entry);
  }

  unregister(id: string) {
    this.entries.delete(id);
  }

  /**
   * Finds the first matching header component based on conditions.
   * 
   * @param props - Props to check conditions against
   * @returns Matching component or null
   */
  resolveHeader(props: {
    dashboardInfo?: { metadata?: { headerLayout?: HeaderLayout } };
    isStandaloneMode?: boolean;
    previewMode?: boolean;
  }): React.ComponentType<any> | null {
    const sortedEntries = Array.from(this.entries.values()).sort(
      (a, b) => (b.priority || 0) - (a.priority || 0)
    );

    for (const entry of sortedEntries) {
      if (!entry.condition || entry.condition(props)) {
        return entry.component;
      }
    }

    return null;
  }

  /**
   * Gets all registered entries.
   */
  getAllEntries(): Array<{ id: string; entry: HeaderRegistryEntry }> {
    return Array.from(this.entries.entries()).map(([id, entry]) => ({ id, entry }));
  }
}

// Singleton instance
export const dashboardHeaderRegistry = new DashboardHeaderRegistry();

/**
 * Registers the custom header extension.
 * Should be called once at application startup.
 */
export const registerCustomHeaderExtension = () => {
  const CustomizableHeader = require('../header/components/CustomizableHeader').default;
  
  dashboardHeaderRegistry.register('portal.custom-header', {
    component: CustomizableHeader,
    condition: (props) => {
      const headerLayout = props?.dashboardInfo?.metadata?.headerLayout;
      const isEnabled = headerLayout?.enabled === true;
      const isActive = props?.isStandaloneMode || props?.previewMode;
      return isEnabled && isActive;
    },
    priority: 100, // Higher priority = checked first
  });
};

