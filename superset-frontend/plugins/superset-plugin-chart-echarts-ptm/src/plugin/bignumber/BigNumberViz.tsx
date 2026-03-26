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
import { PureComponent, MouseEvent } from 'react';
import {
  t,
  getNumberFormatter,
  getTimeFormatter,
  SMART_DATE_VERBOSE_ID,
  computeMaxFontSize,
  BRAND_COLOR,
  styled,
  BinaryQueryObjectFilterClause,
} from '@superset-ui/core';
import { getThemeTokens } from '../../shared/themeTokens';
import * as LucideIcons from 'lucide-react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import Echart from './EchartWrapper';
import { BigNumberVizProps } from './types';

const defaultNumberFormatter = getNumberFormatter();

const PROPORTION = {
  KICKER: 0.1,
  HEADER: 0.3,
  SUBHEADER: 0.125,
  TRENDLINE: 0.3,
};

class BigNumberVis extends PureComponent<BigNumberVizProps> {
  static defaultProps = {
    className: '',
    headerFormatter: defaultNumberFormatter,
    formatTime: getTimeFormatter(SMART_DATE_VERBOSE_ID),
    headerFontSize: PROPORTION.HEADER,
    kickerFontSize: PROPORTION.KICKER,
    mainColor: BRAND_COLOR,
    showTimestamp: false,
    showTrendLine: false,
    startYAxisAtZero: true,
    subheader: '',
    subheaderFontSize: PROPORTION.SUBHEADER,
    timeRangeFixed: false,
  };

  getClassName() {
    const { className, showTrendLine, bigNumberFallback } = this.props;
    const names = `superset-legacy-chart-big-number ptm-big-number-hide-header ${className} ${
      bigNumberFallback ? 'is-fallback-value' : ''
    }`;
    if (showTrendLine) return names;
    return `${names} no-trendline`;
  }

  createTemporaryContainer() {
    const container = document.createElement('div');
    container.className = this.getClassName();
    container.style.position = 'absolute';
    container.style.opacity = '0';
    return container;
  }

  renderFallbackWarning() {
    const { bigNumberFallback, formatTime, showTimestamp } = this.props;
    if (!formatTime || !bigNumberFallback || showTimestamp) return null;
    return (
      <span
        className="alert alert-warning"
        role="alert"
        title={t(
          `Last available value seen on %s`,
          formatTime(bigNumberFallback[0]),
        )}
      >
        {t('Not up to date')}
      </span>
    );
  }

  renderKicker(maxHeight: number) {
    const { timestamp, showTimestamp, formatTime, width } = this.props;
    if (
      !formatTime ||
      !showTimestamp ||
      typeof timestamp === 'string' ||
      typeof timestamp === 'bigint' ||
      typeof timestamp === 'boolean'
    )
      return null;

    const text = timestamp === null ? '' : formatTime(timestamp);

    const container = this.createTemporaryContainer();
    document.body.append(container);
    const fontSize = computeMaxFontSize({
      text,
      maxWidth: width,
      maxHeight,
      className: 'kicker',
      container,
    });
    container.remove();

    return (
      <div
        className="kicker"
        style={{
          fontSize,
          height: 'auto',
        }}
      >
        {text}
      </div>
    );
  }

  renderTitle() {
    const { title, titleFontSize } = this.props as BigNumberVizProps & {
      title?: string;
      titleFontSize?: number;
    };
    if (!title) return null;

    return (
      <div className="card-title" style={{ fontSize: titleFontSize || 14 }}>
        {title}
      </div>
    );
  }

  renderHeader(maxHeight: number) {
    const { bigNumber, headerFormatter, width, colorThresholdFormatters } =
      this.props;

    const text =
      bigNumber === null ? t('No data') : headerFormatter(bigNumber as number);

    const hasThresholdColorFormatter =
      Array.isArray(colorThresholdFormatters) &&
      colorThresholdFormatters.length > 0;

    let numberColor;
    if (hasThresholdColorFormatter) {
      colorThresholdFormatters!.forEach(formatter => {
        const formatterResult = bigNumber
          ? formatter.getColorFromValue(bigNumber as number)
          : false;
        if (formatterResult) {
          numberColor = formatterResult;
        }
      });
    } else {
      numberColor = 'black';
    }

    const container = this.createTemporaryContainer();
    document.body.append(container);
    const fontSize = computeMaxFontSize({
      text,
      maxWidth: width * 0.9,
      maxHeight,
      className: 'header-line',
      container,
    });
    container.remove();

    const onContextMenu = (e: MouseEvent<HTMLDivElement>) => {
      if (this.props.onContextMenu) {
        e.preventDefault();
        this.props.onContextMenu(e.nativeEvent.clientX, e.nativeEvent.clientY);
      }
    };

    return (
      <div
        className="header-line"
        style={{
          display: 'flex',
          alignItems: 'center',
          fontSize,
          height: 'auto',
          color: numberColor,
        }}
        onContextMenu={onContextMenu}
      >
        {text}
      </div>
    );
  }

  renderSubheader(maxHeight: number) {
    const { bigNumber, subheader, width, bigNumberFallback, className } =
      this.props;
    let fontSize = 0;

    const NO_DATA_OR_HASNT_LANDED = t(
      'No data after filtering or data is NULL for the latest time record',
    );
    const NO_DATA = t(
      'Try applying different filters or ensuring your datasource has data',
    );
    let text = subheader;
    if (bigNumber === null) {
      text = bigNumberFallback ? NO_DATA : NO_DATA_OR_HASNT_LANDED;
    }
    if (text) {
      const container = this.createTemporaryContainer();
      document.body.append(container);
      fontSize = computeMaxFontSize({
        text,
        maxWidth: width * 0.9, // max width reduced
        maxHeight,
        className: 'subheader-line',
        container,
      });
      container.remove();

      const isPositive = className?.includes('positive');
      const isNegative = className?.includes('negative');
      const hasTrend = isPositive || isNegative;
      const trendIcon = isPositive ? '▲' : isNegative ? '▼' : '';

      return (
        <div
          className="subheader-line"
          style={{
            fontSize,
            height: maxHeight,
          }}
        >
          {hasTrend && <span className="trend-icon">{trendIcon} </span>}
          {text}
        </div>
      );
    }
    return null;
  }

  renderTrendline(maxHeight: number) {
    const { width, trendLineData, echartOptions, refs } = this.props;

    // if can't find any non-null values, no point rendering the trendline
    if (!trendLineData?.some(d => d[1] !== null)) {
      return null;
    }

    const eventHandlers: any = {
      contextmenu: (eventParams: any) => {
        if (this.props.onContextMenu) {
          eventParams.event.stop();
          const { data } = eventParams;
          if (data) {
            const pointerEvent = eventParams.event.event;
            const drillToDetailFilters: BinaryQueryObjectFilterClause[] = [];
            drillToDetailFilters.push({
              col: this.props.formData?.granularitySqla,
              grain: this.props.formData?.timeGrainSqla,
              op: '==',
              val: data[0],
              formattedVal: this.props.xValueFormatter?.(data[0]),
            });
            this.props.onContextMenu(
              pointerEvent.clientX,
              pointerEvent.clientY,
              { drillToDetail: drillToDetailFilters },
            );
          }
        }
      },
    };

    return (
      echartOptions && (
        <Echart
          refs={refs}
          width={Math.floor(width)}
          height={maxHeight}
          echartOptions={echartOptions}
          eventHandlers={eventHandlers}
        />
      )
    );
  }

  renderIcon() {
    const { showIcon, iconName, iconSize, iconColor, iconBackgroundColor } =
      this.props;

    if (!showIcon || !iconName) return null;

    try {
      // Get the icon component from lucide-react
      const IconComponent = (LucideIcons as any)[iconName];

      if (!IconComponent) {
        console.warn(`Icon "${iconName}" not found in lucide-react`);
        return null;
      }

      const size = iconSize || 24;
      const padding = size / 2; // Padding is half the icon size

      return (
        <div
          className="ptm-icon-container"
          style={{
            padding,
            backgroundColor: iconBackgroundColor || '#F5F5F5',
          }}
        >
          <IconComponent
            size={size}
            color={iconColor || '#666666'}
            strokeWidth={2}
          />
        </div>
      );
    } catch (error) {
      console.error('Error rendering icon:', error);
      return null;
    }
  }

  renderAdditionalText(scaledFontSize?: number) {
    const { additionalText, additionalTextFontSize } = this.props;

    if (!additionalText || additionalText.trim() === '') return null;

    return (
      <div
        className="additional-text"
        style={{
          fontSize: scaledFontSize ?? additionalTextFontSize ?? 12,
        }}
      >
        {additionalText}
      </div>
    );
  }

  renderTrendBadge(fontSize: number) {
    const { subheader, className } = this.props;

    // Only show trend badge if there's a positive or negative trend (comparison data)
    const isPositive = className?.includes('positive');
    const isNegative = className?.includes('negative');

    // Don't render if no trend data (neither positive nor negative)
    if (!subheader || (!isPositive && !isNegative)) return null;

    const TrendIcon = isPositive
      ? TrendingUp
      : isNegative
        ? TrendingDown
        : null;

    return (
      <div
        className={`trend-badge ${isPositive ? 'positive' : isNegative ? 'negative' : 'neutral'}`}
      >
        {TrendIcon && (
          <TrendIcon
            className="trend-badge-icon"
            size={fontSize}
            strokeWidth={2}
          />
        )}
        <span className="trend-badge-text" style={{ fontSize }}>
          {subheader}
        </span>
      </div>
    );
  }

  renderPTMLayout() {
    const {
      height,
      headerFontSize,
      subheaderFontSize,
      showTrendLine,
      title,
      titleFontSize,
      showIcon,
      additionalText,
      autofit = true,
    } = this.props;
    const className = this.getClassName();

    // Calculate responsive padding and gap based on card height
    const sizeUnit = 8;
    // Responsive padding: scales between 12px (min) and 24px (max) based on height
    const responsivePad = Math.max(
      sizeUnit * 1.5,
      Math.min(sizeUnit * 3, (height / 151) * sizeUnit * 2.5),
    );
    // Responsive gap: scales between 8px (min) and 16px (max) based on height
    const responsiveGap = Math.max(
      sizeUnit * 1,
      Math.min(sizeUnit * 2, (height / 151) * sizeUnit * 1.5),
    );

    // Base configured font sizes
    const baseTitleFontSize = titleFontSize || 14;
    const baseHeaderFontSize = headerFontSize || 0.4;
    const baseSubheaderFontSize = subheaderFontSize || 0.15;
    const baseAdditionalTextFontSize = this.props.additionalTextFontSize || 12;

    // Calculate fixed element heights (not scaled)
    const padding = responsivePad * 2;
    const headerRowHeight =
      showIcon || this.props.subheader ? 40 + responsiveGap : 0;
    const trendlineHeight = showTrendLine ? 60 + responsiveGap : 0;
    const totalGaps =
      (title ? 1 : 0) +
      (additionalText ? 1 : 0) +
      (showTrendLine ? 1 : 0) +
      (headerRowHeight > 0 ? 1 : 0);

    // Calculate target layout heights with configured sizes
    // First, estimate available height for header assuming configured sizes for title/additional text
    const targetTitleHeight = title
      ? baseTitleFontSize * 1.3 + responsiveGap
      : 0;
    const targetAdditionalTextHeight = additionalText
      ? baseAdditionalTextFontSize * 1.4 * 2 + responsiveGap
      : 0;

    // Calculate available height for the header (big number) with configured sizes
    const availableHeightForHeader = Math.max(
      height -
        padding -
        headerRowHeight -
        targetTitleHeight -
        targetAdditionalTextHeight -
        trendlineHeight -
        totalGaps * responsiveGap,
      30,
    );

    // Calculate target header height based on configured ratio
    const targetHeaderHeight = availableHeightForHeader * baseHeaderFontSize;

    // Calculate total target height with configured sizes
    const totalTargetHeight =
      padding +
      headerRowHeight +
      targetTitleHeight +
      targetHeaderHeight +
      targetAdditionalTextHeight +
      trendlineHeight +
      totalGaps * responsiveGap;

    // Calculate scale factor if autofit is enabled and content exceeds available space
    let scaleFactor = 1;
    if (autofit && totalTargetHeight > height) {
      // Calculate fixed height (doesn't scale)
      const fixedHeight =
        padding + headerRowHeight + trendlineHeight + totalGaps * responsiveGap;
      const availableForVariable = height - fixedHeight;

      // Approximate scale factor: scale variable elements proportionally
      // Account for the fact that header height depends on available height, which increases
      // as we scale down title/additionalText. Use a conservative estimate.
      const variableHeight =
        targetTitleHeight + targetHeaderHeight + targetAdditionalTextHeight;
      if (variableHeight > 0) {
        // Use a slightly more aggressive scale factor to account for the feedback effect
        // where scaling down title/additionalText frees up space for header
        const baseScale = availableForVariable / variableHeight;
        // Apply a small adjustment to account for header height dependency
        scaleFactor = Math.max(
          0.5, // Minimum scale factor to prevent too small text
          baseScale * 0.95, // Slight reduction to ensure it fits
        );
      }
    }

    // Apply scale factor to font sizes
    const scaledTitleFontSize = autofit
      ? Math.max(10, baseTitleFontSize * scaleFactor) // Min 10px for readability
      : baseTitleFontSize;
    const scaledHeaderFontSize = autofit
      ? baseHeaderFontSize * scaleFactor
      : baseHeaderFontSize;
    const scaledSubheaderFontSize = autofit
      ? baseSubheaderFontSize * scaleFactor
      : baseSubheaderFontSize;
    const scaledAdditionalTextFontSize = autofit
      ? Math.max(10, baseAdditionalTextFontSize * scaleFactor) // Min 10px for readability
      : baseAdditionalTextFontSize;

    // Recalculate heights with scaled sizes
    const scaledTitleHeight = title
      ? scaledTitleFontSize * 1.3 + responsiveGap
      : 0;
    const scaledAdditionalTextHeight = additionalText
      ? scaledAdditionalTextFontSize * 1.4 * 2 + responsiveGap
      : 0;

    const availableHeight = Math.max(
      height -
        padding -
        headerRowHeight -
        scaledTitleHeight -
        scaledAdditionalTextHeight -
        trendlineHeight -
        totalGaps * responsiveGap,
      30,
    );
    const headerMaxHeight = Math.max(
      availableHeight * scaledHeaderFontSize,
      30,
    );

    // Calculate badge font size from scaled subheaderFontSize
    const badgeFontSize = Math.max(
      Math.ceil(scaledSubheaderFontSize * height * 0.08),
      12, // Minimum 12px for readability
    );

    return (
      <div
        className={`${className} ptm-layout`}
        style={
          {
            height: '100%',
            boxSizing: 'border-box',
            overflow: 'hidden',
            '--pad': `${responsivePad}px`,
            '--gap': `${responsiveGap}px`,
          } as React.CSSProperties
        }
      >
        <div className="ptm-header-row">
          {this.renderIcon()}
          {this.renderTrendBadge(badgeFontSize)}
        </div>

        {title && (
          <div className="ptm-title" style={{ fontSize: scaledTitleFontSize }}>
            {title}
          </div>
        )}

        {this.renderFallbackWarning()}
        {this.renderHeader(headerMaxHeight)}
        {this.renderAdditionalText(scaledAdditionalTextFontSize)}

        {showTrendLine && (
          <div className="ptm-bottom-trendline">{this.renderTrendline(60)}</div>
        )}
      </div>
    );
  }

  renderClassicLayout() {
    const {
      showTrendLine,
      height,
      kickerFontSize,
      headerFontSize,
      subheaderFontSize,
      title,
    } = this.props;
    const className = this.getClassName();
    const sizeUnit = 8;
    const padding = sizeUnit * 2 * 2;
    const titleHeight = title
      ? (this.props.titleFontSize || 14) * 1.4 + sizeUnit * 2
      : 0;

    if (showTrendLine) {
      const chartHeight = Math.floor(PROPORTION.TRENDLINE * height);
      const allTextHeight = height - chartHeight - padding - titleHeight;

      return (
        <div
          className={className}
          style={{
            height: '100%',
            boxSizing: 'border-box',
            overflow: 'hidden',
          }}
        >
          {this.renderTitle()}
          <div
            className="text-container"
            style={{ height: allTextHeight, minHeight: 0 }}
          >
            {this.renderFallbackWarning()}
            {this.renderKicker(
              Math.ceil(
                (kickerFontSize || 0) *
                  (1 - PROPORTION.TRENDLINE) *
                  allTextHeight,
              ),
            )}
            {this.renderHeader(
              Math.max(
                Math.ceil(
                  headerFontSize * (1 - PROPORTION.TRENDLINE) * allTextHeight,
                ),
                30,
              ),
            )}
            {this.renderSubheader(
              Math.ceil(
                subheaderFontSize * (1 - PROPORTION.TRENDLINE) * allTextHeight,
              ),
            )}
          </div>
          {this.renderTrendline(chartHeight)}
        </div>
      );
    }

    const availableHeight = height - padding - titleHeight;
    const kickerHeight = (kickerFontSize || 0) * availableHeight;
    const subheaderHeight = subheaderFontSize * availableHeight;
    const headerAvailableHeight =
      availableHeight - kickerHeight - subheaderHeight - sizeUnit * 2;

    return (
      <div
        className={className}
        style={{ height: '100%', boxSizing: 'border-box', overflow: 'hidden' }}
      >
        {this.renderTitle()}
        {this.renderFallbackWarning()}
        {this.renderKicker(kickerHeight)}
        {this.renderHeader(
          Math.max(Math.ceil(headerFontSize * headerAvailableHeight), 30),
        )}
        {this.renderSubheader(Math.ceil(subheaderHeight))}
      </div>
    );
  }

  render() {
    const { layoutMode } = this.props;

    // Use PTM layout if specified, otherwise use classic
    if (layoutMode === 'ptm') {
      return this.renderPTMLayout();
    }

    return this.renderClassicLayout();
  }
}

export default styled(BigNumberVis)`
  ${({ theme }) => {
    const tok = getThemeTokens(theme);
    return `
    font-family: 'Inter', ${tok.fontFamily};
    position: relative;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    align-items: flex-start;
    padding: ${tok.sizeUnit * 2}px ${tok.sizeUnit * 3}px;
    box-sizing: border-box;
    overflow: hidden;
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;

    &.no-trendline .subheader-line {
      padding-bottom: 0.3em;
    }

    .text-container {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: flex-start;
      width: 100%;
      .alert {
        font-size: ${tok.fontSizeSM}px;
        margin: -0.5em 0 0.4em;
        line-height: 1;
        padding: ${tok.sizeUnit}px;
        border-radius: ${tok.sizeUnit}px;
      }
    }

    /* PTM: Card title above the number */
    .card-title {
      font-family: 'Inter', ${tok.fontFamily};
      font-weight: 500;
      font-size: 14px;
      color: ${tok.colorTextSecondary};
      line-height: 1.4em;
      margin-bottom: ${tok.sizeUnit * 2}px;
      width: 100%;
    }

    /* PTM: Kicker/Headline - shows timestamp */
    .kicker {
      font-family: 'Inter', ${tok.fontFamily};
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: ${tok.colorTextSecondary};
      line-height: 1.4em;
      margin-bottom: ${tok.sizeUnit}px;
      padding-bottom: 0;
    }

    /* PTM: Main big number */
    .header-line {
      font-family: 'Inter', ${tok.fontFamily};
      font-weight: 700;
      position: relative;
      line-height: 1.1;
      white-space: nowrap;
      color: ${tok.colorTextHeading};
      margin-bottom: ${tok.sizeUnit}px;
      display: flex;
      align-items: center;
      min-height: 0;
      overflow: visible;
      span {
        position: absolute;
        bottom: 0;
      }
    }

    /* PTM: Subheader below the number - description/percentage */
    .subheader-line {
      font-family: 'Inter', ${tok.fontFamily};
      font-weight: 500;
      line-height: 1.4em;
      color: ${tok.colorTextSecondary};
      padding-bottom: 0;
    }

    &.is-fallback-value {
      .kicker,
      .header-line,
      .subheader-line {
        opacity: 0.65;
      }
    }

    /* PTM: Positive trend styling - green for growth */
    &.positive .subheader-line {
      color: ${tok.colorSuccess};
      font-weight: 600;
    }

    &.positive .subheader-line .trend-icon {
      color: ${tok.colorSuccess};
    }

    /* PTM: Negative trend styling - red for decline */
    &.negative .subheader-line {
      color: ${tok.colorError};
      font-weight: 600;
    }

    &.negative .subheader-line .trend-icon {
      color: ${tok.colorError};
    }

    /* PTM Layout Specific Styles */
    &.ptm-layout {
      /* Responsive padding and gap using CSS custom properties with clamp() */
      --pad: clamp(${tok.sizeUnit * 1.5}px, ${tok.sizeUnit * 2.5}px, ${tok.sizeUnit * 3}px);
      --gap: clamp(${tok.sizeUnit * 1}px, ${tok.sizeUnit * 1.5}px, ${tok.sizeUnit * 2}px);
      padding: var(--pad);
      row-gap: var(--gap);
      box-sizing: border-box;
      overflow: hidden;
      min-height: 0;
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;

      .ptm-header-row {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        width: 100%;
        margin-bottom: 0;
        flex-shrink: 0;
        min-width: 0;
      }

      .ptm-icon-container {
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: ${tok.sizeUnit * 2}px;
      }

      .trend-badge {
        display: flex;
        align-items: center;
        gap: ${tok.sizeUnit}px;
        padding: ${tok.sizeUnit}px ${tok.sizeUnit * 2}px;
        border-radius: ${tok.sizeUnit * 1.5}px;
        transition: all 0.2s ease;

        &.positive {
          background-color: ${tok.colorSuccessBg};
          color: ${tok.colorSuccessText};
        }

        &.negative {
          background-color: ${tok.colorErrorBg};
          color: ${tok.colorErrorText};
        }

        &.neutral {
          background-color: ${tok.colorFillTertiary};
          color: ${tok.colorText};
        }

        .trend-badge-icon {
          flex-shrink: 0;
        }

        .trend-badge-text {
          font-family: 'Inter', ${tok.fontFamily};
          font-weight: 500;
          line-height: 1;
        }
      }

      .ptm-title {
        font-family: 'Inter', ${tok.fontFamily};
        font-weight: 400;
        color: ${tok.colorTextSecondary};
        margin-bottom: 0;
        line-height: clamp(1.2, 1.3, 1.4);
        flex-shrink: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        width: 100%;
      }

      .header-line {
        margin-bottom: 0;
        flex: 1 1 auto;
        min-height: 0;
        min-width: 0;
        overflow: visible;
        width: 100%;
        line-height: clamp(1.0, 1.1, 1.2);
        display: flex;
        align-items: center;
      }

      .additional-text {
        font-family: 'Inter', ${tok.fontFamily};
        font-weight: 400;
        color: ${tok.colorTextSecondary};
        line-height: clamp(1.3, 1.4, 1.5);
        margin-top: 0;
        flex-shrink: 0;
        width: 100%;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
        text-overflow: ellipsis;
        min-height: 1em;
      }

      .ptm-bottom-trendline {
        margin-top: 0;
        width: 100%;
        height: 60px;
        overflow: hidden;
        flex-shrink: 0;
      }
    }
  `;
  }}
`;
