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

# PTM Styling Architecture

## Global CSS

- **File**: `src/assets/stylesheets/ptm-dashboard.css`
- **When applied**: Injected by the PTM dashboard CSS injector when the dashboard has the PTM tag.
- **Covers**: Dashboard-level layout (background, chart cards, grid), CSS variables (`:root`), header/slice container overrides, full-bleed layout for ptm_table slices. It does **not** define table cell/toolbar/footer styles; those live in the PTM table plugin.

## Theme Tokens

- **File**: `src/ptm/shared/themeTokens.ts`
- **Single source of truth** for PTM and PTM chart plugins. Exports `getThemeTokens(theme)` and `ThemeTokens` interface.
- Use this instead of hardcoded colors or direct `theme.xxx` access so both AntD-style and legacy Superset themes are supported.

## Plugins

- **Import shared tokens**: `import { getThemeTokens } from 'src/ptm/shared/themeTokens';`
- **Component-level styles**: Prefer the plugin’s own styled components / `Styles.tsx` using `getThemeTokens(theme)` rather than duplicating rules in `ptm-dashboard.css`.
- **Table/toolbar/footer**: Styled in `plugins/superset-plugin-chart-echarts-ptm/src/plugin/table/Styles.tsx`. Keep table-specific rules there, not in the global dashboard CSS.
