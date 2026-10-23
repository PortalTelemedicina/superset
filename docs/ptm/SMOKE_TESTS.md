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

## C. Bulk user import (PTM_USER_IMPORT)

Manual, in DEV only, with a synthetic CSV (never the real users file, which has passwords). Setup and details in [USERS_IMPORT.md](USERS_IMPORT.md). Needs `superset init` to have run after the deploy.

### 13. Flag off (default)

- [ ] Admin: Users list has no "Import" button
- [ ] `POST /api/v1/security/users/import` as Admin returns 404

### 14. Flag on (`SUPERSET_FEATURE_PTM_USER_IMPORT`, via GitOps)

- [ ] Admin sees the "Import" button; a non-Admin user does not and gets 403 on the endpoint
- [ ] Synthetic CSV with: CPF with and without leading zero, CPF already registered without the zero, duplicate username and duplicate email in the file, an inactive existing user, a password with accent
- [ ] Preview shows the right status and reason for each row, and creates nothing
- [ ] "Confirm" needs the default role chosen and the typed number of users
- [ ] Commit creates only the "To create" rows; created user logs in with the password without accent
- [ ] Running the same file again returns "already exists" for all rows
- [ ] Downloaded report has no password column and keeps the leading zeros of the usernames
- [ ] Audit event of the preview and of the commit is in the event log, without passwords

---

## D. Post-Sync Specific Checks

Run these only after an upstream sync (in addition to the above):

### 15. New upstream features

- [ ] Any new features from upstream CHANGELOG work correctly
- [ ] New dashboard features don't break PTM extensions
- [ ] New chart types are accessible

### 16. Database migrations

- [ ] `superset db upgrade` runs without errors
- [ ] Existing dashboards load (no migration-related breakage)
- [ ] PTM metadata fields preserved in database

### 17. Dependency compatibility

- [ ] No npm peer dependency warnings for PTM packages
- [ ] No Python import errors for portal extensions
- [ ] Frontend build completes without warnings in PTM code

### 18. Extension registry

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
