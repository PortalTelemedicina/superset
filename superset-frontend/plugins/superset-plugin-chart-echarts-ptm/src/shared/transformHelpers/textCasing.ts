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
 * software distributed on an "AS IS" BASIS, WITHOUT WARRANTIES
 * OR CONDITIONS OF ANY KIND, either express or implied.  See the
 * License for the specific language governing permissions and
 * limitations under the License.
 */

export type PtmTextCase = 'none' | 'upper' | 'lower' | 'capitalize';

/**
 * Applies text casing to a string.
 * - none: return as-is
 * - upper: UPPERCASE
 * - lower: lowercase
 * - capitalize: Title Case (capitalize first letter of each word)
 */
export function applyTextCasing(text: string, mode: PtmTextCase): string {
  if (!text || typeof text !== 'string' || mode === 'none') {
    return text;
  }
  const s = String(text);
  if (mode === 'upper') return s.toUpperCase();
  if (mode === 'lower') return s.toLowerCase();
  if (mode === 'capitalize') {
    return s.replace(/\b\w/g, c => c.toUpperCase());
  }
  return s;
}

/**
 * Resolve casing mode from formData (supports snake_case and camelCase keys).
 */
export function getCasingFromFormData(
  formData: Record<string, unknown>,
  key: 'axis' | 'legend' | 'table',
): PtmTextCase {
  const snakeKey = `ptm_${key === 'axis' ? 'axis' : key === 'legend' ? 'legend' : 'table'}_text_case`;
  const camelKey =
    key === 'axis'
      ? 'ptmAxisTextCase'
      : key === 'legend'
        ? 'ptmLegendTextCase'
        : 'ptmTableTextCase';
  const value = (formData[snakeKey] ?? formData[camelKey]) as string | undefined;
  if (value === 'upper' || value === 'lower' || value === 'capitalize' || value === 'none') {
    return value;
  }
  return 'none';
}

interface EchartOptions {
  xAxis?: Record<string, unknown> | Record<string, unknown>[];
  yAxis?: Record<string, unknown> | Record<string, unknown>[];
  legend?: Record<string, unknown>;
  [key: string]: unknown;
}

function wrapAxisLabelFormatter(
  axis: Record<string, unknown>,
  mode: PtmTextCase,
): void {
  if (mode === 'none') return;
  const axisLabel = axis.axisLabel as Record<string, unknown> | undefined;
  if (!axisLabel) return;
  const original = axisLabel.formatter as ((value: string) => string) | undefined;
  axisLabel.formatter = (value: string) => {
    const formatted = typeof original === 'function' ? original(value) : value;
    return applyTextCasing(String(formatted), mode);
  };
}

function processAxis(
  axisConfig: Record<string, unknown> | Record<string, unknown>[] | undefined,
  mode: PtmTextCase,
): void {
  if (!axisConfig || mode === 'none') return;
  const list = Array.isArray(axisConfig) ? axisConfig : [axisConfig];
  list.forEach(axis => {
    if (axis && typeof axis === 'object') wrapAxisLabelFormatter(axis as Record<string, unknown>, mode);
  });
}

/**
 * Applies PTM text casing to ECharts options (xAxis, yAxis, legend labels).
 */
export function applyTextCasingToEchartOptions(
  options: EchartOptions,
  formData: Record<string, unknown>,
): EchartOptions {
  const axisMode = getCasingFromFormData(formData, 'axis');
  const legendMode = getCasingFromFormData(formData, 'legend');
  if (axisMode === 'none' && legendMode === 'none') return options;

  const result = { ...options };

  processAxis(result.xAxis as Record<string, unknown> | Record<string, unknown>[] | undefined, axisMode);
  processAxis(result.yAxis as Record<string, unknown> | Record<string, unknown>[] | undefined, axisMode);

  if (result.legend && legendMode !== 'none') {
    const legend = { ...result.legend } as Record<string, unknown>;
    const originalFormatter = legend.formatter as ((name: string) => string) | undefined;
    legend.formatter = (name: string) => {
      const formatted = typeof originalFormatter === 'function' ? originalFormatter(name) : name;
      return applyTextCasing(String(formatted), legendMode);
    };
    result.legend = legend;
  }

  return result;
}
