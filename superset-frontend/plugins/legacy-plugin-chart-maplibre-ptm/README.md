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

# @superset-ui/legacy-plugin-chart-maplibre-ptm

**Portal Telemedicina MapLibre Scatter Chart Plugin for Apache Superset**

A scatter plot map visualization using [MapLibre GL JS](https://maplibre.org/) - a free, open-source map rendering library. No API key required!

## 🎯 Overview

This plugin provides a scatter plot map visualization with the following features:

- ✅ **Free & Open Source**: Uses MapLibre GL JS - no Mapbox API key needed
- ✅ **CARTO Basemaps**: Beautiful free basemaps from CARTO (Positron, Dark Matter, Voyager)
- ✅ **Clustering**: Automatic point clustering for better performance
- ✅ **Customizable**: Point radius, colors, opacity, and more
- ✅ **PTM Branding**: Consistent Portal Telemedicina styling

## 📦 Installation

This plugin is included in the Portal Telemedicina Superset distribution.

## 🚀 Usage

Configure `key` and register the plugin:

```js
import MapLibreChartPlugin from '@superset-ui/legacy-plugin-chart-maplibre-ptm';

new MapLibreChartPlugin().configure({ key: 'maplibre_ptm' }).register();
```

Then use it via `SuperChart`:

```js
<SuperChart
  chartType="maplibre_ptm"
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

## 🎨 Customization Options

- **Point Radius**: Fixed size or based on a metric
- **Point Color**: RGB color picker
- **Global Opacity**: 0-100%
- **Clustering**: Enable/disable automatic clustering
- **Aggregation**: Sum, Mean, Min, Max for clustered points

## 🔗 Resources

- [MapLibre GL JS](https://maplibre.org/) - Map rendering library
- [CARTO Basemaps](https://carto.com/basemaps/) - Free basemap styles
- [Superset Documentation](https://superset.apache.org/docs/intro)

---

**Maintained by**: Portal Telemedicina Development Team  
**Version**: 0.20.3  
**Last Updated**: January 2025
