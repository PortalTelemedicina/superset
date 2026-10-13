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

# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [0.20.4] - 2025-01-07

### Changed

- **BREAKING**: Renamed package from `@superset-ui/legacy-preset-chart-deckgl-ptm` to `@superset-ui/legacy-preset-chart-deckgl-maplibre-ptm`
- Renamed `mapboxStyle` control to `mapStyle` for consistency
- Updated all control panel imports to use `mapStyle`

### Notes

- This plugin is a fork of the original deck.gl preset, modified to use MapLibre GL JS instead of Mapbox GL JS
- No API key is required - uses free CARTO basemaps

## [0.20.0] - 2024-12-30

### Added

- Initial PTM version forked from `@superset-ui/legacy-preset-chart-deckgl`
- Replaced Mapbox GL JS with MapLibre GL JS
- Removed API key requirement
- Added free CARTO basemap styles (Positron, Dark Matter, Voyager)
- Updated all layer components to use MapLibre-compatible imports

### Features

- Free, open-source map rendering with MapLibre
- All original deck.gl layers supported:
  - Arc, Scatter, Polygon, Path
  - Hex, Grid, Screengrid
  - Heatmap, Contour
  - GeoJSON, Multiple Layers
- Full feature parity with original plugin
