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

import { css, styled } from '@superset-ui/core';
import { getThemeTokens } from '../../shared/themeTokens';

export default styled.div`
  ${({ theme }) => {
    const tok = getThemeTokens(theme);
    return css`
      /* PTM Theme - Clean Minimal Pivot Table Design */
      &,
      & * {
        font-family: 'Inter', ${tok.fontFamily} !important;
      }

      /* ========================================
         PIVOT TABLE BASE STYLES
         ======================================== */
      table.pvtTable {
        width: 100% !important;
        font-size: ${tok.fontSizeSM}px !important;
        text-align: left !important;
        margin: 0 !important;
        border-collapse: separate !important;
        border-spacing: 0 !important;
        font-family: 'Inter', ${tok.fontFamily} !important;
        line-height: 1.4 !important;
        background: #ffffff !important;
      }

      /* ========================================
         HEADER STYLES
         ======================================== */
      table.pvtTable thead {
        background-color: #ffffff !important;
        position: sticky !important;
        top: 0 !important;
        z-index: 10 !important;
      }

      table.pvtTable thead tr th,
      table.pvtTable tbody tr th {
        border-top: 1px solid #e5e7eb !important;
        border-left: 1px solid #e5e7eb !important;
        font-size: 12px !important;
        padding: 12px 16px !important;
        font-weight: 600 !important;
        color: #6b7280 !important;
        text-transform: uppercase !important;
        letter-spacing: 0.05em !important;
        background-color: #ffffff !important;
      }

      table.pvtTable thead tr:last-of-type th,
      table.pvtTable thead tr:first-of-type th.pvtTotalLabel,
      table.pvtTable thead tr:nth-last-of-type(2) th.pvtColLabel,
      table.pvtTable thead th.pvtSubtotalLabel,
      table.pvtTable tbody tr:last-of-type th,
      table.pvtTable tbody tr:last-of-type td {
        border-bottom: 1px solid #e5e7eb !important;
      }

      table.pvtTable
        thead
        tr:last-of-type:not(:only-child)
        th.pvtAxisLabel
        ~ th.pvtColLabel,
      table.pvtTable tbody tr:first-of-type th,
      table.pvtTable tbody tr:first-of-type td {
        border-top: none !important;
      }

      table.pvtTable tbody tr td:last-of-type,
      table.pvtTable thead tr th:last-of-type:not(.pvtSubtotalLabel) {
        border-right: 1px solid #e5e7eb !important;
      }

      /* ========================================
         BODY / DATA CELLS
         ======================================== */
      table.pvtTable tbody tr {
        font-feature-settings: 'tnum' 1 !important;
        background-color: #ffffff !important;
      }

      table.pvtTable tbody tr td {
        color: #374151 !important;
        padding: 8px 16px !important;
        background-color: #ffffff !important;
        border-top: 1px solid #f3f4f6 !important;
        border-left: 1px solid #e5e7eb !important;
        vertical-align: top !important;
        text-align: right !important;
        font-size: 14px !important;
        font-weight: 400 !important;
      }

      table.pvtTable tbody tr th.pvtRowLabel {
        vertical-align: baseline !important;
        text-align: left !important;
        font-weight: 500 !important;
        color: #374151 !important;
      }

      /* Row totals */
      table.pvtTable tbody tr.pvtRowTotals {
        position: sticky !important;
        bottom: 0 !important;
        background-color: #f9fafb !important;
      }

      table.pvtTable tbody tr.pvtRowTotals th,
      table.pvtTable tbody tr.pvtRowTotals td {
        background-color: #f9fafb !important;
        font-weight: 600 !important;
        color: #111827 !important;
      }

      /* ========================================
         TOTALS & SUBTOTALS
         ======================================== */
      table.pvtTable .pvtTotalLabel {
        text-align: right !important;
        font-weight: 600 !important;
        color: #111827 !important;
      }

      table.pvtTable .pvtSubtotalLabel {
        font-weight: 600 !important;
        color: #374151 !important;
      }

      .pvtTotal,
      .pvtGrandTotal {
        font-weight: 600 !important;
        color: #111827 !important;
      }

      table.pvtTable tbody tr td.pvtRowTotal {
        vertical-align: middle !important;
      }

      /* ========================================
         INTERACTIVE STATES
         ======================================== */
      table.pvtTable tr th.active {
        background-color: #eff6ff !important;
      }

      .hoverable:hover {
        background-color: #f9fafb !important;
        cursor: pointer !important;
      }

      /* ========================================
         TOGGLE CONTROLS
         ======================================== */
      .toggle-wrapper {
        white-space: nowrap !important;
      }

      .toggle-wrapper > .toggle-val {
        white-space: normal !important;
      }

      .toggle {
        padding-right: ${tok.sizeUnit}px !important;
        cursor: pointer !important;
        color: #6b7280 !important;
      }

      .toggle:hover {
        color: #374151 !important;
      }
    `;
  }}
`;
