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

import { t } from '@superset-ui/core';
import { CustomControlItem } from '@superset-ui/chart-controls';

export const titleFontSize: CustomControlItem = {
  name: 'title_font_size',
  config: {
    type: 'TextControl',
    label: t('Title Font Size (px)'),
    renderTrigger: true,
    isInt: true,
    default: 14,
    description: t('Font size for the title above the number (in pixels)'),
    placeholder: '14',
  },
};

export const headerFontSize: CustomControlItem = {
  name: 'header_font_size',
  config: {
    type: 'TextControl',
    label: t('Big Number Font Size (ratio)'),
    renderTrigger: true,
    isFloat: true,
    default: 0.4,
    description: t(
      'Font size ratio for the big number (0.0-1.0, proportion of available height)',
    ),
    placeholder: '0.4',
  },
};

export const subheaderFontSize: CustomControlItem = {
  name: 'subheader_font_size',
  config: {
    type: 'TextControl',
    label: t('Percentage Font Size (ratio)'),
    renderTrigger: true,
    isFloat: true,
    default: 0.15,
    description: t(
      'Font size ratio for the percentage/comparison text (0.0-1.0)',
    ),
    placeholder: '0.15',
  },
};

export const layoutMode: CustomControlItem = {
  name: 'layout_mode',
  config: {
    type: 'SelectControl',
    label: t('Layout Mode'),
    renderTrigger: true,
    clearable: false,
    default: 'ptm',
    description: t('Choose between classic or PTM custom layout'),
    options: [
      { label: t('Classic'), value: 'classic' },
      { label: t('PTM'), value: 'ptm' },
    ],
  },
};

export const showIcon: CustomControlItem = {
  name: 'show_icon',
  config: {
    type: 'CheckboxControl',
    label: t('Show Icon'),
    renderTrigger: true,
    default: false,
    description: t('Display an icon in the card (PTM layout only)'),
  },
};

export const iconName: CustomControlItem = {
  name: 'icon_name',
  config: {
    type: 'TextControl',
    label: t('Icon Name'),
    renderTrigger: true,
    default: 'Activity',
    description: t(
      'Name of the Lucide icon (e.g., Activity, TrendingUp, Users, Calendar, Heart)',
    ),
    visibility: ({ controls }: any) => controls?.show_icon?.value === true,
  },
};

export const iconSize: CustomControlItem = {
  name: 'icon_size',
  config: {
    type: 'SelectControl',
    label: t('Icon Size'),
    renderTrigger: true,
    clearable: false,
    default: 20,
    description: t('Size of the icon in pixels'),
    options: [
      { label: t('Small (12px)'), value: 12 },
      { label: t('Medium (20px)'), value: 20 },
      { label: t('Large (28px)'), value: 28 },
      { label: t('XLarge (32px)'), value: 32 },
    ],
    visibility: ({ controls }: any) => controls?.show_icon?.value === true,
  },
};

export const iconColor: CustomControlItem = {
  name: 'icon_color',
  config: {
    type: 'TextControl',
    label: t('Icon Color'),
    renderTrigger: true,
    default: '#000000',
    description: t('Color of the icon (hex code)'),
    visibility: ({ controls }: any) => controls?.show_icon?.value === true,
  },
};

export const iconBackgroundColor: CustomControlItem = {
  name: 'icon_background_color',
  config: {
    type: 'TextControl',
    label: t('Icon Background Color'),
    renderTrigger: true,
    default: '#F5F5F5',
    description: t('Background color of the icon container (hex code)'),
    visibility: ({ controls }: any) => controls?.show_icon?.value === true,
  },
};

export const additionalText: CustomControlItem = {
  name: 'additional_text',
  config: {
    type: 'TextAreaControl',
    label: t('Additional Text'),
    renderTrigger: true,
    default: '',
    description: t(
      'Additional text to display below the number (PTM layout only)',
    ),
  },
};

export const additionalTextFontSize: CustomControlItem = {
  name: 'additional_text_font_size',
  config: {
    type: 'TextControl',
    label: t('Additional Text Font Size (px)'),
    renderTrigger: true,
    isInt: true,
    default: 12,
    description: t('Font size for additional text (in pixels)'),
    placeholder: '12',
    visibility: ({ controls }: any) =>
      Boolean(controls?.additional_text?.value),
  },
};

export const autofit: CustomControlItem = {
  name: 'autofit',
  config: {
    type: 'CheckboxControl',
    label: t('Autofit Font Sizes'),
    renderTrigger: true,
    default: true,
    description: t(
      'When enabled, font sizes will scale proportionally to fit all content in the card. When disabled, configured sizes are used strictly (may clip if card is too small).',
    ),
  },
};
