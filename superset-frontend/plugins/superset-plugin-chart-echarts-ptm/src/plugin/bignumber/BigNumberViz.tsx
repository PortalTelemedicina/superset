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
import * as LucideIcons from 'lucide-react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import Echart from './EchartWrapper';
import { BigNumberVizProps } from './types';

const MONTSERRAT_FONT_ID = 'ptm-montserrat-font';
const loadMontserratFont = () => {
  if (typeof document !== 'undefined' && !document.getElementById(MONTSERRAT_FONT_ID)) {
    const link = document.createElement('link');
    link.id = MONTSERRAT_FONT_ID;
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap';
    document.head.appendChild(link);
  }
};
loadMontserratFont();

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
    const { title, titleFontSize } = this.props as BigNumberVizProps & { title?: string; titleFontSize?: number };
    if (!title) return null;

    return (
      <div 
        className="card-title"
        style={{ fontSize: titleFontSize || 14 }}
      >
        {title}
      </div>
    );
  }

  renderHeader(maxHeight: number) {
    const { bigNumber, headerFormatter, width, colorThresholdFormatters } =
      this.props;

    const text = bigNumber === null ? t('No data') : headerFormatter(bigNumber as number);

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
    const { bigNumber, subheader, width, bigNumberFallback, className } = this.props;
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
    const { showIcon, iconName, iconSize, iconColor } = this.props;
    
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
        <div className="ptm-icon-container" style={{ padding }}>
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

  renderAdditionalText() {
    const { additionalText, additionalTextFontSize } = this.props;
    
    if (!additionalText) return null;

    return (
      <div
        className="additional-text"
        style={{
          fontSize: additionalTextFontSize || 12,
        }}
      >
        {additionalText}
      </div>
    );
  }

  renderTrendBadge(fontSize: number) {
    const { subheader, className } = this.props;
    
    if (!subheader) return null;

    const isPositive = className?.includes('positive');
    const isNegative = className?.includes('negative');
    
    const TrendIcon = isPositive ? TrendingUp : isNegative ? TrendingDown : null;

    return (
      <div className={`trend-badge ${isPositive ? 'positive' : isNegative ? 'negative' : 'neutral'}`}>
        {TrendIcon && <TrendIcon className="trend-badge-icon" size={fontSize} strokeWidth={2} />}
        <span className="trend-badge-text" style={{ fontSize }}>{subheader}</span>
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
    } = this.props;
    const className = this.getClassName();

    // Calculate badge font size from subheaderFontSize control
    // Use a smaller multiplier for the badge to keep it compact
    const badgeFontSize = Math.max(
      Math.ceil(subheaderFontSize * height * 0.08),
      12 // Minimum 12px for readability
    );

    return (
      <div className={`${className} ptm-layout`} style={{ height }}>
        <div className="ptm-header-row">
          {this.renderIcon()}
          {this.renderTrendBadge(badgeFontSize)}
        </div>
        
        {title && (
          <div 
            className="ptm-title"
            style={{ fontSize: titleFontSize || 14 }}
          >
            {title}
          </div>
        )}
        
        {this.renderFallbackWarning()}
        {this.renderHeader(Math.ceil(headerFontSize * height))}
        {this.renderAdditionalText()}
        
        {showTrendLine && (
          <div className="ptm-bottom-trendline">
            {this.renderTrendline(60)}
          </div>
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
    } = this.props;
    const className = this.getClassName();

    if (showTrendLine) {
      const chartHeight = Math.floor(PROPORTION.TRENDLINE * height);
      const allTextHeight = height - chartHeight;

      return (
        <div className={className}>
          {this.renderTitle()}
          <div className="text-container" style={{ height: allTextHeight }}>
            {this.renderFallbackWarning()}
            {this.renderKicker(
              Math.ceil(
                (kickerFontSize || 0) * (1 - PROPORTION.TRENDLINE) * height,
              ),
            )}
            {this.renderHeader(
              Math.ceil(headerFontSize * (1 - PROPORTION.TRENDLINE) * height),
            )}
            {this.renderSubheader(
              Math.ceil(
                subheaderFontSize * (1 - PROPORTION.TRENDLINE) * height,
              ),
            )}
          </div>
          {this.renderTrendline(chartHeight)}
        </div>
      );
    }

    return (
      <div className={className} style={{ height }}>
        {this.renderTitle()}
        {this.renderFallbackWarning()}
        {this.renderKicker((kickerFontSize || 0) * height)}
        {this.renderHeader(Math.ceil(headerFontSize * height))}
        {this.renderSubheader(Math.ceil(subheaderFontSize * height))}
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
  ${({ theme }) => `
    font-family: 'Montserrat', ${theme.fontFamily};
    position: relative;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: flex-start;
    padding: ${theme.sizeUnit * 2}px ${theme.sizeUnit * 3}px;

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
        font-size: ${theme.fontSizeSM};
        margin: -0.5em 0 0.4em;
        line-height: 1;
        padding: ${theme.sizeUnit}px;
        border-radius: ${theme.sizeUnit}px;
      }
    }

    /* PTM: Card title above the number */
    .card-title {
      font-family: 'Montserrat', ${theme.fontFamily};
      font-weight: 500;
      font-size: 14px;
      color: ${theme.colorText};
      line-height: 1.4em;
      margin-bottom: ${theme.sizeUnit * 2}px;
      width: 100%;
    }

    /* PTM: Kicker/Headline - shows timestamp */
    .kicker {
      font-family: 'Montserrat', ${theme.fontFamily};
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: ${theme.colorText};
      line-height: 1.4em;
      margin-bottom: ${theme.sizeUnit}px;
      padding-bottom: 0;
    }

    /* PTM: Main big number */
    .header-line {
      font-family: 'Montserrat', ${theme.fontFamily};
      font-weight: 700;
      position: relative;
      line-height: 1em;
      white-space: nowrap;
      color: ${theme.colorBgElevated};
      margin-bottom: ${theme.sizeUnit}px;
      span {
        position: absolute;
        bottom: 0;
      }
    }

    /* PTM: Subheader below the number - description/percentage */
    .subheader-line {
      font-family: 'Montserrat', ${theme.fontFamily};
      font-weight: 500;
      line-height: 1.4em;
      color: ${theme.colorText};
      padding-bottom: 0;
    }

    &.is-fallback-value {
      .kicker,
      .header-line,
      .subheader-line {
        opacity: 0.35;
      }
    }

    /* PTM: Positive trend styling - green for growth */
    &.positive .subheader-line {
      color: ${theme.colorSuccess};
      font-weight: 600;
    }
    
    &.positive .subheader-line .trend-icon {
      color: ${theme.colorSuccess};
    }
    
    /* PTM: Negative trend styling - red for decline */
    &.negative .subheader-line {
      color: ${theme.colorError};
      font-weight: 600;
    }
    
    &.negative .subheader-line .trend-icon {
      color: ${theme.colorError};
    }

    /* PTM Layout Specific Styles */
    &.ptm-layout {
      padding: ${theme.sizeUnit * 3}px;
      gap: ${theme.sizeUnit * 2}px;

      .ptm-header-row {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        width: 100%;
        margin-bottom: ${theme.sizeUnit * 2}px;
      }

      .ptm-icon-container {
        display: flex;
        align-items: center;
        justify-content: center;
        background-color: ${theme.colorBorder};
        border-radius: ${theme.sizeUnit * 2}px;
      }

      .trend-badge {
        display: flex;
        align-items: center;
        gap: ${theme.sizeUnit}px;
        padding: ${theme.sizeUnit}px ${theme.sizeUnit * 2}px;
        border-radius: ${theme.sizeUnit * 1.5}px;
        transition: all 0.2s ease;

        &.positive {
          background-color: ${theme.colorSuccessBg};
          color: ${theme.colorSuccessActive};
        }

        &.negative {
          background-color: ${theme.colorErrorBg};
          color: ${theme.colorErrorActive};
        }

        &.neutral {
          background-color: ${theme.colorBorder};
          color: ${theme.colorTextSecondary};
        }

        .trend-badge-icon {
          flex-shrink: 0;
        }

        .trend-badge-text {
          font-family: 'Montserrat', ${theme.fontFamily};
          font-weight: 500;
          line-height: 1;
        }
      }

      .ptm-title {
        font-family: 'Montserrat', ${theme.fontFamily};
        font-weight: 400;
        color: ${theme.colorText};
        margin-bottom: ${theme.sizeUnit}px;
        line-height: 1.3;
      }

      .header-line {
        margin-bottom: ${theme.sizeUnit}px;
      }

      .additional-text {
        font-family: 'Montserrat', ${theme.fontFamily};
        font-weight: 400;
        color: ${theme.colorText};
        line-height: 1.5;
        margin-top: ${theme.sizeUnit}px;
      }

      .ptm-bottom-trendline {
        margin-top: ${theme.sizeUnit * 2}px;
        width: 100%;
        height: 60px;
        overflow: hidden;
      }
    }
  `}
`;

