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
import { Badge, Divider } from 'antd';
import moment from 'moment';
import {
  HeaderSlot,
  SlotType,
  LogoSlot,
  TitleSlot,
  TextSlot,
  DateSlot,
  DataFreshnessSlot,
  BadgeSlot,
  SpacerSlot,
  DividerSlot,
} from '../types';
import DataFreshnessElement from './DataFreshnessElement';

const SlotContainer = styled.div<{ customStyle?: any }>`
  display: inline-flex;
  align-items: center;
  ${({ customStyle }) => customStyle && { ...customStyle }};
`;

const LogoImage = styled.img<{ size?: any }>`
  height: ${({ size }) => size?.height || size?.maxHeight || 40}px;
  ${({ size }) => size?.width && `width: ${size.width}px`};
  ${({ size }) => size?.maxWidth && `max-width: ${size.maxWidth}px`};
  ${({ size }) => size?.maxHeight && `max-height: ${size.maxHeight}px`};
  object-fit: contain;
  cursor: ${({ onClick }) => (onClick ? 'pointer' : 'default')};
  
  &:hover {
    opacity: ${({ onClick }) => (onClick ? 0.8 : 1)};
  }
`;

const TitleText = styled.div<{ fontSize?: number }>`
  font-size: ${({ fontSize }) => fontSize || 20}px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.grayscale.dark2};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const TextContent = styled.div`
  font-size: 14px;
  color: ${({ theme }) => theme.colors.grayscale.dark1};
`;

const DateText = styled.div`
  font-size: 14px;
  color: ${({ theme }) => theme.colors.grayscale.base};
`;

const SpacerDiv = styled.div<{ width?: number }>`
  width: ${({ width }) => width || 16}px;
  flex-shrink: 0;
`;

interface SlotRendererProps {
  slot: HeaderSlot;
  dashboardTitle?: string;
  onTitleChange?: (newTitle: string) => void;
  dashboardId?: number;
}

export const SlotRenderer: React.FC<SlotRendererProps> = ({
  slot,
  dashboardTitle,
  onTitleChange,
  dashboardId,
}) => {
  const renderSlot = useMemo(() => {
    const customStyle = slot.style || {};

    switch (slot.type) {
      case SlotType.LOGO: {
        const logoSlot = slot as LogoSlot;
        const logo = (
          <LogoImage
            src={logoSlot.url}
            alt={logoSlot.alt || 'Logo'}
            size={logoSlot.size}
            onClick={
              logoSlot.link
                ? () => {
                    if (logoSlot.openInNewTab) {
                      window.open(logoSlot.link, '_blank', 'noopener,noreferrer');
                    } else {
                      window.location.href = logoSlot.link!;
                    }
                  }
                : undefined
            }
          />
        );

        return (
          <SlotContainer customStyle={customStyle}>
            {logo}
          </SlotContainer>
        );
      }

      case SlotType.TITLE: {
        const titleSlot = slot as TitleSlot;
        const title = titleSlot.content || dashboardTitle || 'Dashboard';

        return (
          <SlotContainer customStyle={customStyle}>
            <TitleText fontSize={titleSlot.fontSize}>
              {title}
            </TitleText>
          </SlotContainer>
        );
      }

      case SlotType.TEXT: {
        const textSlot = slot as TextSlot;
        let content = textSlot.content;

        // Process dynamic content
        if (textSlot.supportsDynamicContent) {
          content = content
            .replace(/{date}/g, moment().format('DD/MM/YYYY'))
            .replace(/{time}/g, moment().format('HH:mm'))
            .replace(/{datetime}/g, moment().format('DD/MM/YYYY HH:mm'));
        }

        return (
          <SlotContainer customStyle={customStyle}>
            <TextContent>{content}</TextContent>
          </SlotContainer>
        );
      }

      case SlotType.DATE: {
        const dateSlot = slot as DateSlot;
        const format = dateSlot.showTime
          ? `${dateSlot.format || 'DD/MM/YYYY'} HH:mm`
          : dateSlot.format || 'DD/MM/YYYY';

        const dateStr = moment().format(format);

        return (
          <SlotContainer customStyle={customStyle}>
            <DateText>{dateStr}</DateText>
          </SlotContainer>
        );
      }

      case SlotType.DATA_FRESHNESS: {
        const freshnessSlot = slot as DataFreshnessSlot;
        return (
          <SlotContainer customStyle={customStyle}>
            <DateText>
              <DataFreshnessElement
                dashboardId={dashboardId}
                label={freshnessSlot.label}
                timezone={freshnessSlot.timezone}
                showTime={freshnessSlot.showTime}
                aggregation={freshnessSlot.aggregation}
                formatPreset={freshnessSlot.formatPreset}
                dateStyle={freshnessSlot.dateStyle}
                showDetails={freshnessSlot.showDetails}
              />
            </DateText>
          </SlotContainer>
        );
      }

      case SlotType.BADGE: {
        const badgeSlot = slot as BadgeSlot;
        const statusMap = {
          success: 'success',
          warning: 'warning',
          error: 'error',
          info: 'processing',
          default: 'default',
        };

        return (
          <SlotContainer customStyle={customStyle}>
            <Badge
              status={statusMap[badgeSlot.badgeType || 'default'] as any}
              text={`${badgeSlot.label}${badgeSlot.value ? `: ${badgeSlot.value}` : ''}`}
            />
          </SlotContainer>
        );
      }

      case SlotType.SPACER: {
        const spacerSlot = slot as SpacerSlot;
        return <SpacerDiv width={spacerSlot.width} />;
      }

      case SlotType.DIVIDER: {
        const dividerSlot = slot as DividerSlot;
        return (
          <SlotContainer customStyle={customStyle}>
            <Divider
              type={dividerSlot.orientation || 'vertical'}
              style={{
                height: dividerSlot.orientation === 'vertical' ? dividerSlot.height || 32 : undefined,
                margin: '0 8px',
              }}
            />
          </SlotContainer>
        );
      }

      default:
        return null;
    }
  }, [slot, dashboardTitle, onTitleChange, dashboardId]);

  if (!slot.visible) {
    return null;
  }

  return renderSlot;
};

export default SlotRenderer;

