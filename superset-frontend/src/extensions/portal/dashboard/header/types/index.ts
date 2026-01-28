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
 * Header Slots System
 * 
 * Flexible system for customizing dashboard headers with drag-and-drop elements
 */

export enum SlotType {
  LOGO = 'logo',
  TITLE = 'title',
  TEXT = 'text',
  DATE = 'date',
  BADGE = 'badge',
  SPACER = 'spacer',
  DIVIDER = 'divider',
}

export enum SlotPosition {
  LEFT = 'left',
  CENTER = 'center',
  RIGHT = 'right',
  CUSTOM = 'custom',
}

export interface SlotStyle {
  fontSize?: number;
  color?: string;
  backgroundColor?: string;
  padding?: string | number;
  margin?: string | number;
  fontWeight?: string | number;
  borderRadius?: number;
  border?: string;
  [key: string]: any;
}

export interface BaseSlot {
  id: string;
  type: SlotType;
  position: SlotPosition;
  order: number;
  visible?: boolean;
  style?: SlotStyle;
  customPosition?: {
    x: number;
    y: number;
  };
  align?: 'start' | 'center' | 'end'; // Individual alignment within the slot group
  flexShrink?: number; // Control if slot can shrink (default 0)
  flexGrow?: number; // Control if slot can grow (default 0)
}

export interface LogoSlot extends BaseSlot {
  type: SlotType.LOGO;
  url: string;
  alt?: string;
  link?: string;
  size?: {
    width?: number;
    height?: number;
    maxWidth?: number;
    maxHeight?: number;
  };
  openInNewTab?: boolean;
}

export interface TitleSlot extends BaseSlot {
  type: SlotType.TITLE;
  content?: string; // If empty, uses dashboard title
  editable?: boolean;
  fontSize?: number;
}

export interface TextSlot extends BaseSlot {
  type: SlotType.TEXT;
  content: string;
  supportsDynamicContent?: boolean; // {date}, {user}, etc.
}

export interface DateSlot extends BaseSlot {
  type: SlotType.DATE;
  format?: string; // moment.js format string
  showTime?: boolean;
  locale?: string;
}

export interface BadgeSlot extends BaseSlot {
  type: SlotType.BADGE;
  label: string;
  value?: string;
  icon?: string; // Ant Design icon name
  badgeType?: 'default' | 'success' | 'warning' | 'error' | 'info';
}

export interface SpacerSlot extends BaseSlot {
  type: SlotType.SPACER;
  width?: number;
}

export interface DividerSlot extends BaseSlot {
  type: SlotType.DIVIDER;
  orientation?: 'vertical' | 'horizontal';
  height?: number;
}

export type HeaderSlot =
  | LogoSlot
  | TitleSlot
  | TextSlot
  | DateSlot
  | BadgeSlot
  | SpacerSlot
  | DividerSlot;

export interface HeaderLayout {
  enabled: boolean;
  slots: HeaderSlot[];
  globalStyle?: {
    backgroundColor?: string;
    height?: number;
    padding?: string | number;
    borderBottom?: string;
  };
}

export interface HeaderSlotConfig {
  headerLayout?: HeaderLayout;
}

// Helper functions
export const createDefaultSlot = (type: SlotType, position: SlotPosition = SlotPosition.LEFT): HeaderSlot => {
  const baseSlot: BaseSlot = {
    id: `slot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type,
    position,
    order: 0,
    visible: true,
  };

  switch (type) {
    case SlotType.LOGO:
      return {
        ...baseSlot,
        type: SlotType.LOGO,
        url: '',
        size: { maxHeight: 40 },
      } as LogoSlot;

    case SlotType.TITLE:
      return {
        ...baseSlot,
        type: SlotType.TITLE,
        editable: true,
        fontSize: 20,
      } as TitleSlot;

    case SlotType.TEXT:
      return {
        ...baseSlot,
        type: SlotType.TEXT,
        content: '',
        supportsDynamicContent: true,
      } as TextSlot;

    case SlotType.DATE:
      return {
        ...baseSlot,
        type: SlotType.DATE,
        format: 'DD/MM/YYYY',
        showTime: false,
      } as DateSlot;

    case SlotType.BADGE:
      return {
        ...baseSlot,
        type: SlotType.BADGE,
        label: 'Badge',
        badgeType: 'default',
      } as BadgeSlot;

    case SlotType.SPACER:
      return {
        ...baseSlot,
        type: SlotType.SPACER,
        width: 16,
      } as SpacerSlot;

    case SlotType.DIVIDER:
      return {
        ...baseSlot,
        type: SlotType.DIVIDER,
        orientation: 'vertical',
        height: 32,
      } as DividerSlot;

    default:
      throw new Error(`Unknown slot type: ${type}`);
  }
};

export const getSlotsByPosition = (slots: HeaderSlot[], position: SlotPosition): HeaderSlot[] => {
  return slots
    .filter(slot => slot.position === position && slot.visible !== false)
    .sort((a, b) => a.order - b.order);
};

export const getDefaultHeaderLayout = (): HeaderLayout => ({
  enabled: false,
  slots: [],
  globalStyle: {
    backgroundColor: '#ffffff',
    height: 64,
    padding: '0 24px',
    borderBottom: '1px solid #f0f0f0',
  },
});

