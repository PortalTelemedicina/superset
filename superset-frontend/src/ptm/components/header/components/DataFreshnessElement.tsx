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
import { type FC, useEffect, useMemo, useState } from 'react';
import { SupersetClient } from '@superset-ui/core';
import { Spin } from 'antd';

export interface DashboardFreshnessResponse {
  dashboard_id: number;
  min_last_modified_utc: string | null;
  max_last_modified_utc: string | null;
  tables_considered: number;
  datasets_total: number;
  skipped: {
    virtual: number;
    non_bigquery: number;
    missing: number;
    views: number;
  };
}

export interface DataFreshnessElementProps {
  dashboardId?: number;
  label?: string;
  timezone?: string;
  showTime?: boolean;
  aggregation?: 'min' | 'max';
  formatPreset?: string;
  dateStyle?: 'short' | 'medium' | 'long' | 'full';
  showDetails?: boolean;
}

const freshnessCache = new Map<number, Promise<DashboardFreshnessResponse>>();

const fetchDashboardFreshness = (dashboardId: number) => {
  const cached = freshnessCache.get(dashboardId);
  if (cached) {
    return cached;
  }

  const request = SupersetClient.get({
    endpoint: `/api/v1/dashboard/${dashboardId}/freshness`,
  })
    .then(({ json }) => json.result as DashboardFreshnessResponse)
    .catch(error => {
      freshnessCache.delete(dashboardId);
      throw error;
    });

  freshnessCache.set(dashboardId, request);
  return request;
};

const buildDetailsTooltip = (data: DashboardFreshnessResponse) =>
  `Tables: ${data.tables_considered}, Datasets: ${data.datasets_total}, ` +
  `Skipped: virtual ${data.skipped.virtual}, non-bigquery ${data.skipped.non_bigquery}, ` +
  `missing ${data.skipped.missing}, views ${data.skipped.views}`;

export const DataFreshnessElement: FC<DataFreshnessElementProps> = ({
  dashboardId,
  label = 'Última atualização',
  timezone = 'America/Sao_Paulo',
  showTime = true,
  aggregation = 'min',
  formatPreset,
  dateStyle,
  showDetails = false,
}) => {
  const [data, setData] = useState<DashboardFreshnessResponse | null>(null);
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!dashboardId) {
      return undefined;
    }
    let mounted = true;
    setIsLoading(true);
    fetchDashboardFreshness(dashboardId)
      .then(result => {
        if (mounted) {
          setData(result);
          setHasError(false);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (mounted) {
          setHasError(true);
          setIsLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [dashboardId]);

  const timestamp = useMemo(() => {
    if (!data) {
      return null;
    }
    return aggregation === 'max'
      ? data.max_last_modified_utc
      : data.min_last_modified_utc;
  }, [aggregation, data]);

  const formatted = useMemo(() => {
    if (!timestamp) {
      return null;
    }
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) {
      return null;
    }

    const locale = 'pt-BR';
    const useDateStyle =
      dateStyle === 'short' ||
      dateStyle === 'medium' ||
      dateStyle === 'long' ||
      dateStyle === 'full';

    const formatParts = (options: Intl.DateTimeFormatOptions) => {
      const formatter = new Intl.DateTimeFormat('en-GB', {
        ...options,
        timeZone: timezone,
        hour12: false,
      });
      return formatter
        .formatToParts(date)
        .reduce<Record<string, string>>((acc, part) => {
          acc[part.type] = part.value;
          return acc;
        }, {});
    };

    const formatPresetValue = formatPreset || '';
    if (formatPresetValue) {
      switch (formatPresetValue) {
        case 'pt_full':
        case 'pt_long':
        case 'pt_medium':
        case 'pt_short': {
          const presetStyle = formatPresetValue.replace('pt_', '') as
            | 'full'
            | 'long'
            | 'medium'
            | 'short';
          return new Intl.DateTimeFormat(locale, {
            timeZone: timezone,
            dateStyle: presetStyle,
            ...(showTime ? { timeStyle: 'short' } : {}),
          }).format(date);
        }
        case 'numeric_date': {
          return new Intl.DateTimeFormat(locale, {
            timeZone: timezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          }).format(date);
        }
        case 'iso_date': {
          const parts = formatParts({
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          });
          return `${parts.year}-${parts.month}-${parts.day}`;
        }
        case 'iso_datetime': {
          const parts = formatParts({
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          });
          return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
        }
        case 'time_hms': {
          const parts = formatParts({
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          });
          return `${parts.hour}:${parts.minute}:${parts.second}`;
        }
        default:
          break;
      }
    }

    const options: Intl.DateTimeFormatOptions = useDateStyle
      ? {
          timeZone: timezone,
          dateStyle,
          ...(showTime ? { timeStyle: 'short' } : {}),
        }
      : {
          timeZone: timezone,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          ...(showTime
            ? {
                hour: '2-digit',
                minute: '2-digit',
              }
            : {}),
        };

    return new Intl.DateTimeFormat(locale, options).format(date);
  }, [dateStyle, formatPreset, showTime, timestamp, timezone]);

  if (!dashboardId) {
    return null;
  }

  const value = formatted || '—';
  const display = label ? `${label}: ${value}` : value;
  const errorDisplay = label ? `${label}: —` : '—';
  const tooltip = showDetails && data ? buildDetailsTooltip(data) : undefined;

  if (isLoading) {
    return (
      <span title={tooltip}>
        <Spin size="small" />
      </span>
    );
  }

  return <span title={tooltip}>{hasError ? errorDisplay : display}</span>;
};

export default DataFreshnessElement;
