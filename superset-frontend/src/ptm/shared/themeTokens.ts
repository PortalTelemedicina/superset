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

/**
 * Theme tokens used by Portal/PTM components.
 * Prefers modern AntD-like tokens; falls back to legacy Superset theme (gridUnit, colors.grayscale, typography).
 */
export interface ThemeTokens {
  sizeUnit: number;
  fontSizeSM: number;
  fontSize: number;
  fontFamily: string;
  colorText: string;
  colorTextSecondary: string;
  colorTextHeading: string;
  colorTextLabel: string;
  colorBgContainer: string;
  colorBgLayout: string;
  colorBorder: string;
  colorBorderSecondary: string;
  colorPrimary: string;
  colorSuccess: string;
  colorError: string;
  colorSuccessBg: string;
  colorErrorBg: string;
  colorSuccessText: string;
  colorErrorText: string;
  colorSuccessTextActive: string;
  colorErrorTextActive: string;
  colorFillSecondary: string;
  colorFillTertiary: string;
  fontWeightStrong: number;
  borderRadius: number;
  borderRadiusLG: number;
}

/** Accepts Superset theme or any object with token-like / legacy theme shape. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ThemeLike = any;

const DEFAULT_SIZE_UNIT = 4;
const DEFAULT_FONT_SIZE_SM = 12;
const DEFAULT_FONT_SIZE = 14;
const DEFAULT_BORDER_RADIUS = 8;
const DEFAULT_BORDER_RADIUS_LG = 8;
const DEFAULT_FONT_WEIGHT_STRONG = 600;

/**
 * Read theme tokens with fallbacks compatible with both AntD-style tokens and legacy Superset theme.
 * Use this instead of (theme as any).xxx to centralize token access and avoid type casts.
 */
export function getThemeTokens(theme: ThemeLike): ThemeTokens {
  const t = theme as Record<string, unknown>;
  const gu = (t.sizeUnit as number) ?? (t.gridUnit as number) ?? DEFAULT_SIZE_UNIT;
  const colors = (theme.colors?.grayscale ?? {}) as Record<string, string>;
  const sizes = theme.typography?.sizes ?? {};
  const weights = theme.typography?.weights ?? {};

  return {
    sizeUnit: gu,
    fontSizeSM: (t.fontSizeSM as number) ?? sizes.s ?? DEFAULT_FONT_SIZE_SM,
    fontSize: (t.fontSize as number) ?? sizes.m ?? DEFAULT_FONT_SIZE,
    fontFamily: (t.fontFamily as string) ?? 'Inter, system-ui, sans-serif',
    colorText:
      (t.colorText as string) ?? colors.dark2 ?? colors.base ?? '#000000',
    colorTextSecondary:
      (t.colorTextSecondary as string) ?? (t.colorTextLabel as string) ?? colors.base ?? '#666666',
    colorTextHeading:
      (t.colorTextHeading as string) ?? (t.colorText as string) ?? colors.dark2 ?? '#000000',
    colorTextLabel:
      (t.colorTextLabel as string) ?? (t.colorTextSecondary as string) ?? colors.base ?? '#666666',
    colorBgContainer:
      (t.colorBgContainer as string) ?? colors.light5 ?? '#ffffff',
    colorBgLayout:
      (t.colorBgLayout as string) ?? (t.colorBgContainer as string) ?? colors.light5 ?? '#f5f5f5',
    colorBorder:
      (t.colorBorder as string) ?? colors.light2 ?? 'rgba(0,0,0,0.1)',
    colorBorderSecondary:
      (t.colorBorderSecondary as string) ?? (t.colorBorder as string) ?? colors.light2 ?? 'rgba(0,0,0,0.06)',
    colorPrimary: (t.colorPrimary as string) ?? '#1890ff',
    colorSuccess: (t.colorSuccess as string) ?? '#52c41a',
    colorError: (t.colorError as string) ?? '#ff4d4f',
    colorSuccessBg: (t.colorSuccessBg as string) ?? 'rgba(82, 196, 26, 0.1)',
    colorErrorBg: (t.colorErrorBg as string) ?? 'rgba(255, 77, 79, 0.1)',
    colorSuccessText: (t.colorSuccessText as string) ?? (t.colorSuccess as string) ?? '#52c41a',
    colorErrorText: (t.colorErrorText as string) ?? (t.colorError as string) ?? '#ff4d4f',
    colorSuccessTextActive: (t.colorSuccessTextActive as string) ?? (t.colorSuccess as string) ?? '#52c41a',
    colorErrorTextActive: (t.colorErrorTextActive as string) ?? (t.colorError as string) ?? '#ff4d4f',
    colorFillSecondary: (t.colorFillSecondary as string) ?? colors.light3 ?? '#f0f0f0',
    colorFillTertiary: (t.colorFillTertiary as string) ?? (t.colorFillSecondary as string) ?? colors.light4 ?? '#fafafa',
    fontWeightStrong: (t.fontWeightStrong as number) ?? weights.bold ?? DEFAULT_FONT_WEIGHT_STRONG,
    borderRadius: (t.borderRadius as number) ?? (t.borderRadiusLG as number) ?? DEFAULT_BORDER_RADIUS,
    borderRadiusLG: (t.borderRadiusLG as number) ?? (t.borderRadius as number) ?? DEFAULT_BORDER_RADIUS_LG,
  };
}
