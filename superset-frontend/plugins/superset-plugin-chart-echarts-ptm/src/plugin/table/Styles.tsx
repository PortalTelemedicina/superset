/*
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

import { css, styled } from '@superset-ui/core';
import { getThemeTokens } from 'src/ptm/shared/themeTokens';

export default styled.div`
  ${({ theme }) => {
    const tok = getThemeTokens(theme);
    return css`
    /* PTM Theme - Clean Minimal Table Design */
    &,
    & * {
      font-family: 'Inter', ${tok.fontFamily} !important;
    }

    /* Ensure the wrapper itself takes full width */
    & {
      width: 100% !important;
      max-width: none !important;
    }

    /* Only force width on the immediate data table wrapper, not all nested divs */
    & > div:first-of-type {
      width: 100% !important;
      max-width: none !important;
    }

    /* Sticky table: add side padding and avoid forcing full width */
    & div[role="table"] {
      overflow-x: auto !important;
      overflow-y: auto !important;
      max-width: 100% !important;
    }

    & div[role="table"] > div[role="presentation"] {
      width: max-content !important;
      min-width: 100% !important;
      max-width: none !important;
      padding: 0 16px !important;
      box-sizing: border-box !important;
    }

    table.table {
      width: max-content !important;
      min-width: 100% !important;
      max-width: none !important;
      margin: 0 !important;
      border-collapse: collapse !important;
      border-spacing: 0 !important;
      background: #FFFFFF !important;
    }

    /* ========================================
       TABLE BASE STYLES
       ======================================== */
    table.table {
      width: auto !important;
      max-width: 100% !important;
      margin: 0 !important;
      border-collapse: collapse !important;
      border-spacing: 0 !important;
      background: #FFFFFF !important;
    }

    /* ========================================
       HEADER STYLES - Clean & Minimal
       ======================================== */
    table.table > thead > tr > th,
    table.table thead th {
      padding: 12px 16px !important;
      background: transparent !important;
      font-weight: 600 !important;
      font-size: 12px !important;
      color: #6B7280 !important;
      text-transform: uppercase !important;
      letter-spacing: 0.05em !important;
      border: none !important;
      border-bottom: 1px solid #E5E7EB !important;
      text-align: left;
    }

  table.table thead th > div[data-column-name] {
    width: 100% !important;
    /* Use the header's natural unwrapped width as the column's lower bound.
       This makes truncate-enabled cells default to the header text width
       (since the sizer's auto layout takes max(this, cells) for each column).
       The customize columns columnWidth still overrides via the th width hint. */
    min-width: max-content !important;
    white-space: normal !important;
    overflow-wrap: anywhere !important;
  }

  table.table thead th span[data-column-name] {
    min-width: 0 !important;
    white-space: normal !important;
    overflow-wrap: anywhere !important;
    word-break: normal !important;
  }

    /* Sort icons - subtle */
    table.table thead th svg {
      color: #D1D5DB !important;
      margin-left: 4px !important;
      opacity: 0.6 !important;
      transition: opacity 0.15s ease !important;
    }

    table.table thead th:hover svg {
      opacity: 1 !important;
      color: #6B7280 !important;
    }

    table.table thead th.is-sorted svg {
      opacity: 1 !important;
      color: #6B7280 !important;
    }

    /* ========================================
       BODY / DATA CELLS - Clean
       ======================================== */
    table.table > tbody > tr > td,
    table.table tbody td {
      padding: 8px 16px !important;
      font-size: 14px !important;
      color: #374151 !important;
      line-height: 1.25 !important;
      border: none !important;
      border-bottom: 1px solid #F3F4F6 !important;
      background: transparent !important;
      font-feature-settings: 'tnum' 1 !important;
      vertical-align: middle !important;
      white-space: normal !important;
      word-wrap: break-word !important;
    }

    /* Row styling - NO alternating colors */
    table.table > tbody > tr {
      background-color: #FFFFFF !important;
    }

    /* Override striped - keep all white */
    table.table.table-striped > tbody > tr:nth-of-type(odd),
    table.table.table-striped > tbody > tr:nth-of-type(even) {
      background-color: #FFFFFF !important;
    }

    /* Subtle hover */
    table.table > tbody > tr:hover,
    table.table.table-striped > tbody > tr:hover {
      background-color: #F9FAFB !important;
    }

    /* Last row no border */
    table.table > tbody > tr:last-of-type > td {
      border-bottom: none !important;
    }

    /* ========================================
       FOOTER / SUMMARY ROW
       ======================================== */
    table.table > tfoot > tr > th,
    table.table > tfoot > tr > td {
      padding-top: 16px !important;
    }

    /* ========================================
       NUMERIC CELLS & BARS
       ======================================== */
    .dt-metric {
      text-align: right !important;
      font-variant-numeric: tabular-nums !important;
      color: #111827 !important;
      font-weight: 500 !important;
    }

    /* Cell bar background - subtle */
    .cell-bar {
      opacity: 0.08 !important;
      background-color: #3B82F6 !important;
    }

    .cell-bar.negative {
      background-color: #EF4444 !important;
    }

    .cell-bar.positive {
      background-color: #10B981 !important;
    }

    /* ========================================
       SPECIAL CELLS
       ======================================== */
    .dt-totals {
      font-weight: 600 !important;
      background-color: #F9FAFB !important;
      color: #111827 !important;
    }

    .dt-is-null {
      color: #D1D5DB !important;
      font-style: normal !important;
    }

    /* Filter cells */
    td.dt-is-filter {
      cursor: pointer !important;
    }

    td.dt-is-filter:hover {
      background-color: #F3F4F6 !important;
    }

    td.dt-is-active-filter,
    td.dt-is-active-filter:hover {
      background-color: #EFF6FF !important;
    }

    /* ========================================
       TOOLBAR (Search / Time comparison)
       ======================================== */
    .ptm-dt-toolbar {
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
      gap: 12px !important;
      padding: 0 16px 12px 16px !important;
      flex-wrap: wrap !important;
    }

    .ptm-dt-toolbar-left,
    .ptm-dt-toolbar-right {
      display: flex !important;
      align-items: center !important;
      gap: 8px !important;
      min-width: 0 !important;
    }

    /* Search */
    .ptm-dt-search {
      display: inline-flex !important;
      align-items: center !important;
      gap: 8px !important;
      min-width: 220px !important;
      max-width: 340px !important;
      width: 100% !important;
      height: 34px !important;
      padding: 0 12px 0 16px !important;
      border-radius: 6px !important;
      border: 1px solid #E5E7EB !important;
      background: #FFFFFF !important;
    }

    .ptm-dt-search:focus-within {
      border-color: #9CA3AF !important;
    }

    .ptm-dt-search-icon {
      color: #9CA3AF !important;
      font-size: 16px !important;
      display: inline-flex !important;
      align-items: center !important;
      flex-shrink: 0 !important;
    }

    .ptm-dt-search-input {
      flex: 1 1 auto !important;
      min-width: 0 !important;
      height: 100% !important;
      border: none !important;
      outline: none !important;
      background: transparent !important;
      font-size: 13px !important;
      color: #374151 !important;
      padding: 0 !important;
    }

    /* Actions button (time comparison dropdown trigger) */
    .ptm-dt-actions-trigger {
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      gap: 6px !important;
      height: 28px !important;
      padding: 0 10px !important;
      border-radius: 6px !important;
      border: 1px solid #E5E7EB !important;
      background: #FFFFFF !important;
      color: #374151 !important;
      font-size: 13px !important;
      cursor: pointer !important;
      user-select: none !important;
      transition: background 0.15s ease !important;
      white-space: nowrap !important;
    }

    .ptm-dt-actions-trigger:hover {
      background: #F9FAFB !important;
    }

    /* Page size select */
    .ptm-dt-footer-left .dt-select-page-size,
    .ptm-dt-footer-left .form-inline {
      display: inline-flex !important;
      align-items: center !important;
      gap: 8px !important;
      margin: 0 !important;
    }

    .ptm-dt-footer-left select.form-control {
      height: 28px !important;
      border-radius: 6px !important;
      border: 1px solid #E5E7EB !important;
      background: #FFFFFF !important;
      color: #374151 !important;
      font-size: 13px !important;
      padding: 0 8px !important;
      outline: none !important;
    }

    .ptm-dt-footer-left select.form-control:focus {
      border-color: #9CA3AF !important;
      box-shadow: none !important;
    }

    /* ========================================
       PTM FOOTER
       ======================================== */
    .ptm-dt-footer {
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
      padding: 12px 16px !important;
      background: #FFFFFF !important;
      border-top: 1px solid #F3F4F6 !important;
      gap: 16px !important;
      flex-wrap: wrap !important;
    }

    /* Left section - Page size selector */
    .ptm-dt-footer-left {
      display: flex !important;
      align-items: center !important;
      gap: 8px !important;
      flex-shrink: 0 !important;
    }

    .ptm-dt-page-size-label {
      font-size: 13px !important;
      font-weight: 400 !important;
      color: #6B7280 !important;
      white-space: nowrap !important;
    }

    /* Center section - Range display */
    .ptm-dt-footer-center {
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      flex: 1 1 auto !important;
      min-width: 0 !important;
      gap: 4px !important;
    }

    .ptm-dt-range-bold {
      font-size: 13px !important;
      font-weight: 500 !important;
      color: #374151 !important;
      margin-right: 4px !important;
    }

    .ptm-dt-range-total {
      font-size: 13px !important;
      font-weight: 400 !important;
      color: #6B7280 !important;
    }

    /* Right section - Navigation buttons */
    .ptm-dt-footer-right {
      display: flex !important;
      align-items: center !important;
      gap: 4px !important;
      flex-shrink: 0 !important;
    }

    /* Ensure consistent spacing between all navigation elements */
    .ptm-dt-footer-right > * {
      margin: 0 !important;
    }

    /* Navigation buttons (first, prev, next, last) */
    .ptm-dt-footer-right button.ptm-dt-nav-btn {
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      width: 32px !important;
      height: 32px !important;
      padding: 0 !important;
      margin: 0 !important;
      border: none !important;
      border-radius: 6px !important;
      background: transparent !important;
      color: #374151 !important;
      font-size: 14px !important;
      cursor: pointer !important;
      transition: all 0.15s ease !important;
      flex-shrink: 0 !important;
      box-shadow: none !important;
      outline: none !important;
    }

    .ptm-dt-footer-right button.ptm-dt-nav-btn:hover:not(:disabled) {
      background: transparent !important;
      color: #374151 !important;
    }

    /* Disabled state - icon only (no background) */
    .ptm-dt-footer-right button.ptm-dt-nav-btn:disabled,
    .ptm-dt-footer-right button.ptm-dt-nav-btn[disabled] {
      background: transparent !important;
      color: #9CA3AF !important;
      cursor: not-allowed !important;
      opacity: 1 !important;
    }

    /* Enabled state - transparent background */
    .ptm-dt-footer-right button.ptm-dt-nav-btn:not(:disabled):not([disabled]) {
      background: transparent !important;
      color: #374151 !important;
    }

    .ptm-dt-footer-right button.ptm-dt-nav-btn svg {
      width: 12px !important;
      height: 12px !important;
      fill: currentColor !important;
    }

    .ptm-dt-footer-right button.ptm-dt-nav-btn:disabled svg,
    .ptm-dt-footer-right button.ptm-dt-nav-btn[disabled] svg {
      color: #9CA3AF !important;
    }

    /* Page number buttons container */
    .ptm-dt-pages {
      display: flex !important;
      align-items: center !important;
      gap: 4px !important;
      margin: 0 4px !important;
    }

    /* Page number buttons */
    .ptm-dt-pages button.ptm-dt-page-btn {
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      min-width: 32px !important;
      height: 32px !important;
      padding: 0 12px !important;
      margin: 0 !important;
      border: none !important;
      border-radius: 6px !important;
      background: #FFFFFF !important;
      color: #374151 !important;
      font-size: 13px !important;
      font-weight: 500 !important;
      cursor: pointer !important;
      transition: all 0.15s ease !important;
      box-shadow: none !important;
      outline: none !important;
    }

    .ptm-dt-pages button.ptm-dt-page-btn:hover {
      background: #F9FAFB !important;
      color: #374151 !important;
    }

    /* Active page button - Blue pill style */
    .ptm-dt-pages button.ptm-dt-page-btn.is-active,
    .ptm-dt-pages button.ptm-dt-page-btn.is-active:hover {
      background: #0A98D5 !important;
      color: #FFFFFF !important;
      font-weight: 500 !important;
    }

    /* Ellipsis */
    .ptm-dt-pages .ptm-dt-ellipsis {
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      width: 32px !important;
      height: 32px !important;
      color: #374151 !important;
      font-size: 14px !important;
      font-weight: 500 !important;
      user-select: none !important;
      border: none !important;
      border-radius: 6px !important;
      background: #FFFFFF !important;
    }

    

    /* ========================================
       MISC
       ======================================== */
    .dt-truncate-cell {
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      white-space: nowrap !important;
      /* Block-level so it fills the column width set by the colgroup,
         and inline-size containment so the nowrap content does NOT
         propagate its natural width back to the column sizer.
         This makes truncate-enabled cells default to the header's
         natural width instead of expanding the column to fit the value. */
      display: block !important;
      contain: inline-size !important;
    }

    .dt-truncate-cell:hover {
      overflow: visible !important;
      white-space: normal !important;
      height: auto !important;
    }

    .dt-no-results {
      text-align: center !important;
      padding: 40px 16px !important;
      color: #9CA3AF !important;
      font-size: 14px !important;
    }

    .right-border-only {
      border-right: 1px solid #F3F4F6 !important;
    }

    table .right-border-only:last-child {
      border-right: none !important;
    }

    /* ========================================
       PTM PILLS - Optional Styling
       Use by wrapping values: <span class="ptm-pill">Value</span>
       ======================================== */
    .ptm-pill {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 13px;
      font-weight: 500;
      line-height: 1.5;
      white-space: nowrap;
      
      /* Default colors - can be overridden with inline styles */
      background: #DBEAFE;
      color: #1E40AF;
    }

    .ptm-pill-empty {
      background: #F3F4F6 !important;
      color: #6B7280 !important;
    }
  `;
  }}
`;

