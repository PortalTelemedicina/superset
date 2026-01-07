<!--
Licensed to the Apache Software Foundation (ASF) under one
or more contributor license agreements.  See the NOTICE file
distributed with this work for additional information
regarding copyright ownership.  The ASF licenses this file
to you under the Apache License, Version 2.0 (the
"License"); you may not use this file except in compliance
with the License.  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing,
software distributed under the License is distributed on an
"AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, either express or implied.  See the License for the
specific language governing permissions and limitations
under the License.
-->

# @superset-ui/legacy-preset-chart-deckgl-maplibre-ptm

**Portal Telemedicina deck.gl Chart Preset with MapLibre for Apache Superset**

A comprehensive set of map visualizations powered by [deck.gl](https://deck.gl/) and [MapLibre GL JS](https://maplibre.org/) - completely free, no API key required!

## 🎯 Overview

This preset provides advanced geospatial visualizations with the following features:

- ✅ **Free & Open Source**: Uses MapLibre GL JS - no Mapbox API key needed
- ✅ **CARTO Basemaps**: Beautiful free basemaps from CARTO
- ✅ **deck.gl Power**: WebGL-powered, high-performance map layers
- ✅ **Multiple Layer Types**: Arc, Scatter, Polygon, Path, Hex, Grid, and more
- ✅ **PTM Branding**: Consistent Portal Telemedicina styling

## 📦 Included Chart Types

| Chart Type | Description |
|------------|-------------|
| **Arc** | Draw arcs between origin and destination points |
| **Scatter** | Plot points with customizable size and color |
| **Polygon** | Draw filled/stroked polygon areas |
| **Path** | Draw lines/routes on the map |
| **Hex** | Hexagonal binning aggregation |
| **Grid** | Square grid aggregation |
| **Screengrid** | Pixel-based grid aggregation |
| **Heatmap** | Density heatmap visualization |
| **Contour** | Contour/isoline visualization |
| **GeoJSON** | Render GeoJSON data directly |
| **Multiple Layers** | Combine multiple layer types |

## 🚀 Usage

### Register the Preset

Import the preset and register all chart plugins at once:

```js
import { DeckGLChartPresetPTM } from '@superset-ui/legacy-preset-chart-deckgl-maplibre-ptm';

new DeckGLChartPresetPTM().register();
```

### Register Individual Charts

Or register charts one by one:

```js
import { ArcChartPlugin } from '@superset-ui/legacy-preset-chart-deckgl-maplibre-ptm';

new ArcChartPlugin().configure({ key: 'deck_arc_ptm' }).register();
```

### Use via SuperChart

```js
<SuperChart
  chartType="deck_arc_ptm"
  width={600}
  height={600}
  formData={...}
  queriesData={[{
    data: {...},
  }]}
/>
```

## 🗺️ Available Map Styles

| Style | Description |
|-------|-------------|
| Light (Positron) | Clean light theme, great for data visualization |
| Dark | Dark theme for contrast |
| Voyager | Colorful street map style |
| Light (No Labels) | Minimal light theme without labels |
| Dark (No Labels) | Minimal dark theme without labels |

## 🎨 Common Controls

All deck.gl charts include:

- **Map Style**: Choose from CARTO basemaps
- **Viewport**: Pan, zoom, pitch, and bearing controls
- **Auto Zoom**: Automatically fit data bounds
- **Color Picker**: Customize layer colors
- **JavaScript Controls**: Advanced data transformation options

## 🔧 Layer-Specific Features

### Arc Layer
- Start/end coordinates
- Stroke width
- Color by dimension

### Scatter Layer
- Point size (fixed or metric-based)
- Min/max radius
- Color by dimension

### Polygon Layer
- Fill/stroke colors
- Elevation (3D)
- Line width

### Heatmap Layer
- Intensity
- Radius
- Color gradients

## 🔗 Resources

- [deck.gl Documentation](https://deck.gl/docs)
- [MapLibre GL JS](https://maplibre.org/)
- [CARTO Basemaps](https://carto.com/basemaps/)
- [Superset Documentation](https://superset.apache.org/docs/intro)

---

**Maintained by**: Portal Telemedicina Development Team  
**Version**: 0.20.4  
**Last Updated**: January 2025
