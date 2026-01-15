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
import React, { useMemo } from 'react';
import { styled } from '@superset-ui/core';
import { HeaderLayout, SlotPosition, getSlotsByPosition } from '../types';
import SlotRenderer from './SlotRenderer';

const HeaderContainer = styled.div<{ globalStyle?: any }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  background-color: ${({ globalStyle, theme }) =>
    globalStyle?.backgroundColor || theme.colors.grayscale.light5};
  height: ${({ globalStyle }) => globalStyle?.height || 64}px;
  padding: ${({ globalStyle }) => globalStyle?.padding || '0 24px'};
  border-bottom: ${({ globalStyle }) =>
    globalStyle?.borderBottom || '1px solid #f0f0f0'};
  ${({ globalStyle }) => globalStyle && { ...globalStyle }};
`;

const SlotGroup = styled.div<{ position: SlotPosition }>`
  display: flex;
  align-items: center;
  gap: 16px;
  flex: ${({ position }) => (position === SlotPosition.CENTER ? '1 1 auto' : '0 0 auto')};
  justify-content: ${({ position }) => {
    switch (position) {
      case SlotPosition.LEFT:
        return 'flex-start';
      case SlotPosition.CENTER:
        return 'center';
      case SlotPosition.RIGHT:
        return 'flex-end';
      default:
        return 'flex-start';
    }
  }};
  flex-wrap: nowrap;
  overflow: hidden;
  min-width: 0;
`;

interface CustomizableHeaderProps {
  headerLayout: HeaderLayout;
  dashboardTitle?: string;
  onTitleChange?: (newTitle: string) => void;
  dashboardId?: number;
}

export const CustomizableHeader: React.FC<CustomizableHeaderProps> = ({
  headerLayout,
  dashboardTitle,
  onTitleChange,
  dashboardId,
}) => {
  const leftSlots = useMemo(
    () => getSlotsByPosition(headerLayout.slots, SlotPosition.LEFT),
    [headerLayout.slots],
  );

  const centerSlots = useMemo(
    () => getSlotsByPosition(headerLayout.slots, SlotPosition.CENTER),
    [headerLayout.slots],
  );

  const rightSlots = useMemo(
    () => getSlotsByPosition(headerLayout.slots, SlotPosition.RIGHT),
    [headerLayout.slots],
  );

  if (!headerLayout.enabled || headerLayout.slots.length === 0) {
    return null;
  }

  return (
    <HeaderContainer 
      globalStyle={headerLayout.globalStyle}
      className="portal-header-custom"
    >
      {/* Left Section */}
      {leftSlots.length > 0 && (
        <SlotGroup position={SlotPosition.LEFT} className="portal-slot-group portal-slot-group-left">
          {leftSlots.map(slot => (
            <SlotRenderer
              key={slot.id}
              slot={slot}
              dashboardTitle={dashboardTitle}
              onTitleChange={onTitleChange}
              dashboardId={dashboardId}
            />
          ))}
        </SlotGroup>
      )}

      {/* Center Section */}
      {centerSlots.length > 0 && (
        <SlotGroup position={SlotPosition.CENTER} className="portal-slot-group portal-slot-group-center">
          {centerSlots.map(slot => (
            <SlotRenderer
              key={slot.id}
              slot={slot}
              dashboardTitle={dashboardTitle}
              onTitleChange={onTitleChange}
              dashboardId={dashboardId}
            />
          ))}
        </SlotGroup>
      )}

      {/* Right Section */}
      {rightSlots.length > 0 && (
        <SlotGroup position={SlotPosition.RIGHT} className="portal-slot-group portal-slot-group-right">
          {rightSlots.map(slot => (
            <SlotRenderer
              key={slot.id}
              slot={slot}
              dashboardTitle={dashboardTitle}
              onTitleChange={onTitleChange}
              dashboardId={dashboardId}
            />
          ))}
        </SlotGroup>
      )}
    </HeaderContainer>
  );
};

export default CustomizableHeader;

