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

/** Let ECharts drop bar value labels that would collide (e.g. dense monthly series). */
export function applyBarSeriesLabelLayout(
  options: Record<string, unknown>,
): Record<string, unknown> {
  const { series } = options;
  if (!Array.isArray(series)) {
    return options;
  }

  const nextSeries = series.map(entry => {
    if (entry.type !== 'bar') {
      return entry;
    }

    const label = entry.label as Record<string, unknown> | undefined;
    if (!label?.show) {
      return entry;
    }

    const existingLayout =
      (entry.labelLayout as Record<string, unknown> | undefined) ?? {};

    return {
      ...entry,
      labelLayout: {
        ...existingLayout,
        hideOverlap: existingLayout.hideOverlap ?? true,
      },
    };
  });

  return {
    ...options,
    series: nextSeries,
  };
}
