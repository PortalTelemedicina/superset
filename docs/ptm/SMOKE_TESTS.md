# PTM smoke tests

Use this checklist after upstream syncs, refactors, or releases to confirm PTM behavior.

Run `./scripts/ptm/verify-touchpoints.sh` and `./scripts/ptm/validate-build.sh` first, then test manually:

---

## Pre-test setup

```bash
# Copy override if not present
cp docker-compose.override.yml.example docker-compose.override.yml

# Start services
docker compose up -d

# Verify PTM flag is active
# Check browser console or /api/v1/me/ for feature flags
```

---

## A. PTM Enabled (PTM_EXTENSION_ENABLED=true)

### 1. Dashboard loads

- [ ] Open a dashboard with PTM tag — custom header renders
- [ ] Open a dashboard without PTM tag — default header renders
- [ ] No console errors on load
- [ ] Layout and all charts render correctly

### 2. Custom header

- [ ] PTM custom header appears (if dashboard has header layout metadata)
- [ ] Header slot editor works in edit mode
- [ ] Data freshness element shows correct timestamp
- [ ] Header survives save/reload cycle

### 3. Filters

- [ ] Native filters are visible and functional
- [ ] Collapsible filter bar works (if `PTM_ENABLE_FILTERBAR_COLLAPSE` is on)
- [ ] Filter bar collapse/expand preserves layout
- [ ] Cross-filter interactions work correctly

### 4. PTM table

- [ ] Dashboard contains a chart with `viz_type: ptm_table`
- [ ] PTM table renders with correct padding and styling
- [ ] Sorting, pagination work correctly
- [ ] Conditional formatting applies

### 5. PTM BigNumber trendline

- [ ] Chart with `viz_type: ptm_big_number_trendline` renders
- [ ] Trendline displays as expected
- [ ] Number formatting is correct

### 6. PTM ECharts

- [ ] PTM ECharts timeseries chart renders (`ptm_echarts_timeseries`)
- [ ] PTM pie chart renders (`ptm_pie`)
- [ ] PTM pivot table renders
- [ ] Charts match expected PTM styling and theme

### 7. Map visualizations

- [ ] MapLibre PTM plugin renders maps
- [ ] Deck.gl PTM preset works (if applicable)

### 8. PTM global CSS

- [ ] Open a PTM-tagged dashboard
- [ ] Global PTM styles applied (check computed styles or visual consistency)
- [ ] PTM CSS does NOT leak to non-PTM dashboards

### 9. Dashboard save

- [ ] Edit a PTM dashboard → save → header layout preserved
- [ ] PTM metadata (headerLayout, ptm_branding) persists across saves
- [ ] Shared charts lock mechanism works (if applicable)
- [ ] Save hooks fire correctly (no data loss)

### 10. Slice header controls

- [ ] Chart kebab menu shows PTM extensions (if any)
- [ ] Custom menu items function correctly
- [ ] Data reliability indicator appears on charts (if enabled)

### 11. Chart loading

- [ ] PTM custom loading spinner appears during chart load
- [ ] Loading spinner clears after chart renders

---

## B. PTM Disabled (PTM_EXTENSION_ENABLED=false)

### 12. Vanilla Superset behavior

- [ ] Disable PTM extension (feature flag off or env unset)
- [ ] Dashboards load with default Superset header
- [ ] No PTM-specific CSS, plugins, or UI elements visible
- [ ] No console errors related to PTM imports
- [ ] Default chart types work (non-PTM echarts, table, etc.)
- [ ] Dashboard save works normally
- [ ] Filter bar is default Superset style

---

## C. Post-Sync Specific Checks

Run these only after an upstream sync (in addition to the above):

### 13. New upstream features

- [ ] Any new features from upstream CHANGELOG work correctly
- [ ] New dashboard features don't break PTM extensions
- [ ] New chart types are accessible

### 14. Database migrations

- [ ] `superset db upgrade` runs without errors
- [ ] Existing dashboards load (no migration-related breakage)
- [ ] PTM metadata fields preserved in database

### 15. Dependency compatibility

- [ ] No npm peer dependency warnings for PTM packages
- [ ] No Python import errors for portal extensions
- [ ] Frontend build completes without warnings in PTM code

### 16. Extension registry

- [ ] All PTM extension keys still exist in ExtensionsRegistry
- [ ] No runtime errors from extension registry lookups
- [ ] Extension values resolve correctly (check with browser devtools)

---

## Automated checks

Before manual testing, ensure these pass:

```bash
# Touchpoint verification
./scripts/ptm/verify-touchpoints.sh

# Quick build check
./scripts/ptm/validate-build.sh --quick

# Full build check (before release)
./scripts/ptm/validate-build.sh --full
```

---

Run these manually (or automate where possible) after refactors, syncs, and before releasing.
