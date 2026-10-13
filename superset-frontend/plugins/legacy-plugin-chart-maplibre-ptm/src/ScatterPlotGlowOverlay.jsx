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
/* eslint-disable react/require-default-props */
import PropTypes from 'prop-types';
import { useEffect, useRef, useCallback } from 'react';
import { useMap } from 'react-map-gl/maplibre';
import { kmToPixels, MILES_PER_KM } from './utils/geo';
import roundDecimal from './utils/roundDecimal';
import luminanceFromRGB from './utils/luminanceFromRGB';

const propTypes = {
  aggregation: PropTypes.string,
  compositeOperation: PropTypes.string,
  dotRadius: PropTypes.number,
  lngLatAccessor: PropTypes.func,
  locations: PropTypes.arrayOf(PropTypes.object).isRequired,
  pointRadiusUnit: PropTypes.string,
  renderWhileDragging: PropTypes.bool,
  rgb: PropTypes.arrayOf(
    PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  ),
  zoom: PropTypes.number,
  width: PropTypes.number,
  height: PropTypes.number,
  isDragging: PropTypes.bool,
};

const defaultProps = {
  // Same as browser default.
  compositeOperation: 'source-over',
  dotRadius: 4,
  lngLatAccessor: location => [location[0], location[1]],
  renderWhileDragging: true,
};

const computeClusterLabel = (properties, aggregation) => {
  const count = properties.point_count;
  if (!aggregation) {
    return count;
  }
  if (aggregation === 'sum' || aggregation === 'min' || aggregation === 'max') {
    return properties[aggregation];
  }
  const { sum } = properties;
  const mean = sum / count;
  if (aggregation === 'mean') {
    return Math.round(100 * mean) / 100;
  }
  const { squaredSum } = properties;
  const variance = squaredSum / count - (sum / count) ** 2;
  if (aggregation === 'var') {
    return Math.round(100 * variance) / 100;
  }
  if (aggregation === 'stdev') {
    return Math.round(100 * Math.sqrt(variance)) / 100;
  }

  // fallback to point_count, this really shouldn't happen
  return count;
};

function ScatterPlotGlowOverlay(props) {
  const {
    aggregation,
    compositeOperation = 'source-over',
    dotRadius = 4,
    lngLatAccessor = location => [location[0], location[1]],
    locations,
    pointRadiusUnit,
    renderWhileDragging = true,
    rgb,
    zoom,
    width,
    height,
    isDragging,
  } = props;

  const canvasRef = useRef(null);
  const { current: map } = useMap();

  const drawText = useCallback(
    (ctx, pixel, options = {}) => {
      const IS_DARK_THRESHOLD = 110;
      const {
        fontHeight = 0,
        label = '',
        radius = 0,
        rgb: textRgb = [0, 0, 0],
        shadow = false,
      } = options;
      const maxWidth = radius * 1.8;
      const luminance = luminanceFromRGB(textRgb[1], textRgb[2], textRgb[3]);

      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = luminance <= IS_DARK_THRESHOLD ? 'white' : 'black';
      ctx.font = `${fontHeight}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (shadow) {
        ctx.shadowBlur = 15;
        ctx.shadowColor = luminance <= IS_DARK_THRESHOLD ? 'black' : '';
      }

      const textWidth = ctx.measureText(label).width;
      if (textWidth > maxWidth) {
        const scale = fontHeight / textWidth;
        ctx.font = `${scale * maxWidth}px sans-serif`;
      }

      ctx.fillText(label, pixel[0], pixel[1]);
      ctx.globalCompositeOperation = compositeOperation;
      ctx.shadowBlur = 0;
      ctx.shadowColor = '';
    },
    [compositeOperation],
  );

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !map) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const radius = dotRadius;
    const clusterLabelMap = [];

    locations.forEach((location, i) => {
      if (location.properties.cluster) {
        clusterLabelMap[i] = computeClusterLabel(
          location.properties,
          aggregation,
        );
      }
    });

    const maxLabel = Math.max(...clusterLabelMap.filter(v => !Number.isNaN(v)));

    ctx.clearRect(0, 0, width, height);
    ctx.globalCompositeOperation = compositeOperation;

    // Project function using MapLibre's project method
    const project = lngLat => {
      const point = map.project(lngLat);
      return [point.x, point.y];
    };

    if ((renderWhileDragging || !isDragging) && locations) {
      locations.forEach((location, i) => {
        const pixel = project(lngLatAccessor(location));
        const pixelRounded = [
          roundDecimal(pixel[0], 1),
          roundDecimal(pixel[1], 1),
        ];

        if (
          pixelRounded[0] + radius >= 0 &&
          pixelRounded[0] - radius < width &&
          pixelRounded[1] + radius >= 0 &&
          pixelRounded[1] - radius < height
        ) {
          ctx.beginPath();
          if (location.properties.cluster) {
            let clusterLabel = clusterLabelMap[i];
            const scaledRadius = roundDecimal(
              (clusterLabel / maxLabel) ** 0.5 * radius,
              1,
            );
            const fontHeight = roundDecimal(scaledRadius * 0.5, 1);
            const [x, y] = pixelRounded;
            const gradient = ctx.createRadialGradient(
              x,
              y,
              scaledRadius,
              x,
              y,
              0,
            );

            gradient.addColorStop(
              1,
              `rgba(${rgb[1]}, ${rgb[2]}, ${rgb[3]}, 0.8)`,
            );
            gradient.addColorStop(
              0,
              `rgba(${rgb[1]}, ${rgb[2]}, ${rgb[3]}, 0)`,
            );
            ctx.arc(
              pixelRounded[0],
              pixelRounded[1],
              scaledRadius,
              0,
              Math.PI * 2,
            );
            ctx.fillStyle = gradient;
            ctx.fill();

            if (Number.isFinite(parseFloat(clusterLabel))) {
              if (clusterLabel >= 10000) {
                clusterLabel = `${Math.round(clusterLabel / 1000)}k`;
              } else if (clusterLabel >= 1000) {
                clusterLabel = `${Math.round(clusterLabel / 100) / 10}k`;
              }
              drawText(ctx, pixelRounded, {
                fontHeight,
                label: clusterLabel,
                radius: scaledRadius,
                rgb,
                shadow: true,
              });
            }
          } else {
            const defaultRadius = radius / 6;
            const radiusProperty = location.properties.radius;
            const pointMetric = location.properties.metric;
            let pointRadius =
              radiusProperty === null ? defaultRadius : radiusProperty;
            let pointLabel;

            if (radiusProperty !== null) {
              const pointLatitude = lngLatAccessor(location)[1];
              if (pointRadiusUnit === 'Kilometers') {
                pointLabel = `${roundDecimal(pointRadius, 2)}km`;
                pointRadius = kmToPixels(pointRadius, pointLatitude, zoom);
              } else if (pointRadiusUnit === 'Miles') {
                pointLabel = `${roundDecimal(pointRadius, 2)}mi`;
                pointRadius = kmToPixels(
                  pointRadius * MILES_PER_KM,
                  pointLatitude,
                  zoom,
                );
              }
            }

            if (pointMetric !== null) {
              pointLabel = Number.isFinite(parseFloat(pointMetric))
                ? roundDecimal(pointMetric, 2)
                : pointMetric;
            }

            // Fall back to default points if pointRadius wasn't a numerical column
            if (!pointRadius) {
              pointRadius = defaultRadius;
            }

            ctx.arc(
              pixelRounded[0],
              pixelRounded[1],
              roundDecimal(pointRadius, 1),
              0,
              Math.PI * 2,
            );
            ctx.fillStyle = `rgb(${rgb[1]}, ${rgb[2]}, ${rgb[3]})`;
            ctx.fill();

            if (pointLabel !== undefined) {
              drawText(ctx, pixelRounded, {
                fontHeight: roundDecimal(pointRadius, 1),
                label: pointLabel,
                radius: pointRadius,
                rgb,
                shadow: false,
              });
            }
          }
        }
      });
    }
  }, [
    aggregation,
    compositeOperation,
    dotRadius,
    drawText,
    height,
    isDragging,
    lngLatAccessor,
    locations,
    map,
    pointRadiusUnit,
    renderWhileDragging,
    rgb,
    width,
    zoom,
  ]);

  // Set up map event listeners for redrawing
  useEffect(() => {
    if (!map) return undefined;

    const handleMapMove = () => {
      redraw();
    };

    map.on('move', handleMapMove);
    map.on('moveend', handleMapMove);

    // Initial draw
    redraw();

    return () => {
      map.off('move', handleMapMove);
      map.off('moveend', handleMapMove);
    };
  }, [map, redraw]);

  // Redraw when props change
  useEffect(() => {
    redraw();
  }, [redraw]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'none',
      }}
    />
  );
}

ScatterPlotGlowOverlay.propTypes = propTypes;
ScatterPlotGlowOverlay.defaultProps = defaultProps;

export default ScatterPlotGlowOverlay;
