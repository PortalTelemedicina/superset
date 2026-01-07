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

## [0.20.3] - 2025-01-07

### Changed

- **BREAKING**: Renamed package from `@superset-ui/legacy-plugin-chart-map-box-ptm` to `@superset-ui/legacy-plugin-chart-maplibre-ptm`
- Renamed internal components from `MapBox` to `MapLibre` for consistency
- Updated plugin key from `mapbox_ptm` to `maplibre_ptm`

### Notes

- This plugin is a fork of the original MapBox plugin, modified to use MapLibre GL JS instead of Mapbox GL JS
- No API key is required - uses free CARTO basemaps

## [0.20.0] - 2024-12-30

### Added

- Initial PTM version forked from `@superset-ui/legacy-plugin-chart-map-box`
- Replaced Mapbox GL JS with MapLibre GL JS
- Removed API key requirement
- Added free CARTO basemap styles (Positron, Dark Matter, Voyager)
- Updated controls to use MapLibre-compatible style URLs

### Features

- Free, open-source map rendering with MapLibre
- Multiple basemap options without API key
- Full clustering support
- Point customization (radius, color, opacity)
