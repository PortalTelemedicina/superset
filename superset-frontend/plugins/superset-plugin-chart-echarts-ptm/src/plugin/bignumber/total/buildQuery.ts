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
import {
  buildQueryContext,
  getMetricLabel,
  QueryFormData,
  QueryFormMetric,
} from '@superset-ui/core';

export default function buildQuery(formData: QueryFormData) {
  return buildQueryContext(formData, baseQueryObject => {
    const fd = formData as QueryFormData & {
      subheader_metric?: QueryFormMetric;
    };
    const metrics = [...(baseQueryObject.metrics || [])];
    if (fd.subheader_metric) {
      const secondaryLabel = getMetricLabel(fd.subheader_metric);
      const alreadyIncluded = metrics.some(
        m => getMetricLabel(m) === secondaryLabel,
      );
      if (!alreadyIncluded) {
        metrics.push(fd.subheader_metric);
      }
    }
    return [
      {
        ...baseQueryObject,
        metrics,
      },
    ];
  });
}
