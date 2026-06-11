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

# PTM — Minimal touchpoint index

This document lists every place in upstream Superset that is touched for PTM. The goal is to keep this list minimal so upgrades only require verifying these points.

After every upstream sync, use `./scripts/ptm/verify-touchpoints.sh` to automatically check these.

---

## Critical Integration Points (MUST verify after sync)

These are the files where PTM code is wired into core Superset. If these are lost during a sync, PTM will not function.

### Frontend — Single bootstrap

| File | Purpose | What to look for |
|------|---------|-----------------|
| `superset-frontend/src/setup/setupExtensions.ts` | **Primary integration point.** Calls `applyPTMExtensions()` from `src/ptm` when `PTM_EXTENSION_ENABLED` is true. | `import { applyPTMExtensions } from 'src/ptm'` and conditional call |

### Frontend — Extension registry definitions

| File | Purpose | What to look for |
|------|---------|-----------------|
| `superset-frontend/packages/superset-ui-core/src/ui-overrides/ExtensionsRegistry.ts` | Defines extension registry keys used by PTM | Keys: `dashboard.header.replacement`, `dashboard.css.*`, `dashboard.sliceHeaderControls.*`, `dashboard.filterbar.*`, `dashboard.chart.*` |
| `superset-frontend/packages/superset-ui-core/src/ui-overrides/types.ts` | TypeScript types for extension values | Type definitions for extension registry entries |

### Frontend — Dashboard extension context

| File | Purpose | What to look for |
|------|---------|-----------------|
| `superset-frontend/src/dashboard/components/DashboardExtensionsContext.tsx` | **New file (PTM).** Context provider for passing extension values to dashboard children | Entire file is PTM — re-add if deleted |
| `superset-frontend/src/dashboard/containers/DashboardPage.tsx` | Dashboard root — wraps with extensions context | `DashboardExtensionsContext` import and provider wrapper |

### Frontend — Extension consumption points

These are core components that read from the extension registry. They use generic keys (no PTM-specific imports), but must retain the registry lookups.

| File | Extension key used | Purpose |
|------|-------------------|---------|
| `superset-frontend/src/dashboard/components/Header/index.jsx` | `dashboard.header.replacement` | Allows PTM to replace the dashboard header |
| `superset-frontend/src/dashboard/components/SliceHeaderControls/index.tsx` | `dashboard.sliceHeaderControls.*` | Allows PTM to extend chart menu items |
| `superset-frontend/src/dashboard/components/nativeFilters/FilterBar/Horizontal.tsx` | `dashboard.filterbar.horizontal.replacement` | Allows PTM to replace horizontal filter bar |
| `superset-frontend/src/dashboard/components/nativeFilters/FilterBar/FilterBarSettings/index.tsx` | `dashboard.filterbar.settings.replacement` | Allows PTM to replace filter settings |
| `superset-frontend/src/dashboard/components/DashboardCssInjector/index.ts` | `dashboard.css.injector` | CSS injection extension point |
| `superset-frontend/src/dashboard/components/gridComponents/Chart/index.js` | `dashboard.chart.dataReliabilityOverlay`, `dashboard.chart.loading` | Chart overlay and loading extensions |

### Frontend — Dashboard state

| File | Purpose | What to look for |
|------|---------|-----------------|
| `superset-frontend/src/dashboard/actions/dashboardState.js` | Preserves `headerLayout` in metadata during save | `headerLayout` reference in save/update actions |
| `superset-frontend/src/dashboard/reducers/dashboardState.js` | State shape for extension metadata | Extension-related state fields |

### Backend — Registration

| File | Purpose | What to look for |
|------|---------|-----------------|
| `superset/initialization/__init__.py` | Calls `register_dashboard_extension_fields()` from `superset.extensions.portal` | Import and function call (~line 700) |

### Backend — Dashboard API/Schema

| File | Purpose | What to look for |
|------|---------|-----------------|
| `superset/dashboards/schemas.py` | Conditionally exposes PTM metadata fields (`headerLayout`, `ptm_branding`) when `PTM_EXTENSION_ENABLED` is true | `PTM_EXTENSION_ENABLED` check and `EXTENSION_METADATA_KEYS` |
| `superset/dashboards/api.py` | PTM endpoints (freshness, header image upload) | Imports from `superset.extensions.portal` |
| `superset/daos/dashboard.py` | Conditional dashboard metadata handling for PTM fields | Portal/extension metadata logic |

### Backend — Configuration

| File | Purpose | What to look for |
|------|---------|-----------------|
| `docker/pythonpath_dev/superset_config.py` | Sets `FEATURE_FLAGS['PTM_EXTENSION_ENABLED'] = True` | Feature flag definition |
| `superset/config.py` | Default feature flag (usually `False`) | `PTM_EXTENSION_ENABLED` in `DEFAULT_FEATURE_FLAGS` |

---

## PTM-Isolated Code (NO conflict risk)

These directories are entirely PTM-owned. They don't exist in upstream and will never conflict during sync. They should survive any rebase/merge untouched.

| Directory | Contents |
|-----------|----------|
| `superset-frontend/src/ptm/` | All PTM frontend: extensions, components, plugins, config, CSS |
| `superset/extensions/portal/` | All PTM backend: schemas, APIs, services |
| `superset-frontend/plugins/superset-plugin-chart-echarts-ptm/` | PTM ECharts plugin package |
| `superset-frontend/plugins/legacy-preset-chart-deckgl-maplibre-ptm/` | PTM Deck.gl + MapLibre preset |
| `superset-frontend/plugins/legacy-plugin-chart-maplibre-ptm/` | PTM MapLibre plugin |
| `docs/ptm/` | PTM documentation |
| `scripts/ptm/` | PTM sync and validation scripts |

---

## Other Modified Core Files (lower risk)

These files have PTM-related changes that are less critical. They may conflict during sync but are not essential for PTM to function.

### Frontend components with PTM modifications

| File | Nature of change |
|------|-----------------|
| `superset-frontend/src/dashboard/components/PtmLockedBadge.tsx` | New file — PTM locked dashboard indicator |
| `superset-frontend/src/components/DataReliabilityIndicator/index.tsx` | New file — data reliability badge |
| `superset-frontend/src/dashboard/components/gridComponents/ChartHolder/ChartHolder.tsx` | Extension point for chart overlay |
| `superset-frontend/src/dashboard/components/SliceHeader/index.tsx` | Extension point for slice header |
| `superset-frontend/src/features/home/SubMenu.tsx` | Minor PTM UI additions |
| `superset-frontend/src/features/databases/UploadDataModel/index.tsx` | Upload model updates |

### Backend files with minor PTM changes

| File | Nature of change |
|------|-----------------|
| `superset/viz.py` | PTM Deck.gl and MapLibre viz classes |
| `superset/commands/report/execute.py` | Alert notification PTM adjustments |
| `superset/models/dashboard.py` | Dashboard model extensions |

---

## Infrastructure

| File | Purpose |
|------|---------|
| `docker-compose.override.yml.example` | PTM dev environment — copy to `docker-compose.override.yml` |
| `Dockerfile` | Playwright addition (for PTM screenshot tests) |

---

## What is NOT in core

- **Chart plugins:** Registered by `applyPTMExtensions()` from `src/ptm`. `MainPreset.js` does NOT import PTM plugins.
- **Dashboard CSS:** Injected via extension; implementation in `src/ptm/extensions/`.
- **Header / filter bar / slice header UI:** Extensions registered by `applyPTMExtensions()`; core only reads the registry.

---

## Restoring a missing touchpoint

If a touchpoint is lost during sync, here's the minimal code to re-add each:

### setupExtensions.ts

```typescript
import { applyPTMExtensions } from 'src/ptm';

export default function setupExtensions() {
  // ... existing code ...
  const flags = getFeatureFlags();
  if (flags?.PTM_EXTENSION_ENABLED === true) {
    applyPTMExtensions();
  }
}
```

### initialization/__init__.py

```python
# Near the end of SupersetAppInitializer.init_views()
from superset.extensions.portal import register_dashboard_extension_fields
register_dashboard_extension_fields(self.superset_app)
```

### dashboards/schemas.py

```python
# Add PTM conditional metadata fields
from superset.utils.feature_flag_manager import is_feature_enabled
if is_feature_enabled("PTM_EXTENSION_ENABLED"):
    # Accept headerLayout and ptm_branding in dashboard metadata
    ...
```

When upgrading Superset, re-apply or re-verify only the lines listed in this index.
