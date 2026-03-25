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

# PTM Revolution — Refactor Plan

## Current touchpoints (audit)

### Frontend — core files that reference PTM/Portal

| File | Description |
|------|-------------|
| `superset-frontend/src/setup/setupExtensions.ts` | Single bootstrap: calls `applyPTMExtensions()` from `src/ptm` when `PTM_EXTENSION_ENABLED` |
| `superset-frontend/src/views/App.tsx` | Calls `setupExtensions()` at startup |
| `superset-frontend/src/visualizations/presets/MainPreset.js` | **Invasive:** Directly imports and registers PTM chart plugins + DeckGL PTM preset + MapLibre PTM (no flag) |
| `superset-frontend/src/dashboard/components/Header/index.jsx` | Extension point only: `extensionsRegistry.get('dashboard.header.replacement')` |
| `superset-frontend/src/dashboard/containers/DashboardPage.tsx` | Extension point only: `extensionsRegistry.get('dashboard.css.transform')` |
| `superset-frontend/src/dashboard/components/SliceHeaderControls/index.tsx` | Extension point only: `dashboard.sliceHeaderControls.classNames`, `dashboard.sliceHeaderControls.trigger` |
| `superset-frontend/src/dashboard/components/nativeFilters/FilterBar/Horizontal.tsx` | Extension point only: `dashboard.filterbar.horizontal.replacement` |
| `superset-frontend/src/dashboard/components/nativeFilters/FilterBar/FilterBarSettings/index.tsx` | Extension point only: `dashboard.filterbar.settings.replacement` |
| `superset-frontend/src/dashboard/actions/dashboardState.js` | Preserves `headerLayout` in metadata (extension-related, minimal) |
| `superset-frontend/packages/superset-ui-core/src/ui-overrides/ExtensionsRegistry.ts` | Defines extension keys (core mechanism — no PTM-specific code) |
| `superset-frontend/packages/superset-extension-portal/` | Re-exports from `src/extensions/portal` |

### Frontend — PTM/Portal implementation (to move under `src/ptm/`)

| File | Description |
|------|-------------|
| `superset-frontend/src/extensions/portal/` | All portal extension logic (header, CSS, slice header registries) |
| `superset-frontend/src/assets/stylesheets/ptm-dashboard.css` | Global PTM dashboard CSS (loaded via `dashboard.css.transform` when dashboard has PTM tag) |

### Backend

| File | Description |
|------|-------------|
| `superset/initialization/__init__.py` | Calls `register_dashboard_extension_fields` from `superset.extensions.portal` |
| `superset/dashboards/schemas.py` | `EXTENSION_METADATA_KEYS`, `portal_header_layout`, `ptm_branding` |
| `superset/extensions/portal/` | Portal API, schemas, services (dashboard header, freshness, image rehost) |
| `superset/dashboards/api.py` | Imports portal `dashboard_freshness`, `upload_header_image_handler` |
| `superset/viz.py` | PTM Deck.gl and MapLibre viz classes (many `*PTM` classes) |
| `superset/config.py` | CARTO basemaps comments for PTM |
| `docker/pythonpath_dev/superset_config.py` | `FEATURE_FLAGS.PTM_EXTENSION_ENABLED` |

### Infra

| File | Description |
|------|-------------|
| `docker-compose.yml` | Standard Superset volumes; no PTM-specific edits required if using override |

---

## Proposed new structure

```
superset-frontend/src/
  ptm/
    index.ts                 # applyPTMExtensions() — single entry
    config/
      featureFlags.ts       # PTM_* / PORTAL_* flags
    extensions/
      headerRegistry.ts      # dashboard.header.replacement
      dashboardCssRegistry.ts
      sliceHeaderControlsRegistry.tsx
      (filterBar when needed)
    plugins/
      registerPtmPlugins.ts   # PTM chart plugin registration (gated)
  assets/stylesheets/
    ptm-dashboard.css        # unchanged; loaded by CSS transform

superset/
  extensions/portal/          # keep; single backend wiring in initialization
  (optional) ptm/            # optional: ptm_config.py imported by superset_config

docs/ptm/
  PATCH_INDEX.md
  ARCHITECTURE.md
  SMOKE_TESTS.md
```

---

## Integration points (target)

1. **Frontend (one place)**  
   `setupExtensions.ts`: when `PTM_EXTENSION_ENABLED`, call `applyPTMExtensions()` from `src/ptm`.  
   `applyPTMExtensions()` registers UI extensions and PTM chart plugins (so MainPreset stays clean).

2. **Backend (one place)**  
   `superset_config.py`: import PTM flags/wiring from one module (e.g. `superset.extensions.portal` or `ptm_config`).  
   `initialization/__init__.py`: single call to register dashboard extension fields (already present).

3. **Infra**  
   Use `docker-compose.override.yml` for PTM dev (volumes, env). No edits in upstream `docker-compose.yml` where possible.

---

## Feature flags (PTM_*)

- `PTM_EXTENSION_ENABLED` — master switch for PTM frontend
- `PTM_ENABLE_GLOBAL_DASHBOARD_CSS` — inject ptm-dashboard.css for tagged dashboards
- `PTM_ENABLE_HEADER_CUSTOM` — custom dashboard header
- `PTM_ENABLE_PTM_CHART_PLUGINS` — register PTM ECharts/Table/BigNumber trendline (and Deck/MapLibre PTM) plugins
- `PTM_ENABLE_FILTERBAR_COLLAPSE` — reserved for collapsible filter bar behavior when implemented in extensions

All gated so upstream behavior is unchanged when flags are off.
