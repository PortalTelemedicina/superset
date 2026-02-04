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
