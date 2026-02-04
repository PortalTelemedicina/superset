# PTM extension architecture

PTM customizations are layered so that we prefer CSS and frontend extension hooks over chart plugins and backend changes. This keeps upstream Superset core as untouched as possible.

---

## Layers (A → E)

### Layer A — Global branding / visual (CSS)

- **Single file:** `superset-frontend/src/assets/stylesheets/ptm-dashboard.css` (or loaded from a URL referenced by the PTM extension).
- **Application:** The `dashboard.css.transform` extension (registered by PTM when enabled) prepends `@import url(".../ptm-dashboard.css")` for dashboards that have the PTM tag (or equivalent). No per-dashboard manual CSS edit required.
- **Selectors:** Prefer stable selectors (`data-test-*`, `aria-label`, viz wrapper class names like `.ptm_table`). Avoid fragile DOM chains.
- **Scoping:** Table and chart-holder padding overrides are scoped (e.g. only for `.ptm_table` or PTM viz wrappers).

### Layer B — Frontend extension system (UI/UX)

- **Single integration:** Core calls `getExtensionsRegistry()` and uses keys such as:
  - `dashboard.header.replacement`
  - `dashboard.css.transform`
  - `dashboard.sliceHeaderControls.classNames` / `dashboard.sliceHeaderControls.trigger`
  - `dashboard.filterbar.horizontal.replacement`
  - `dashboard.filterbar.settings.replacement`
- **PTM side:** One entry point, `applyPTMExtensions()` in `src/ptm/index.ts`, registers all PTM extensions when the PTM/Portal feature flag is on. Each feature (header, CSS, slice header, filter bar) is gated by its own flag where appropriate.
- **Core:** Remains unchanged except for the single place that invokes extensions (already present). No PTM-specific imports in core.

### Layer C — Chart plugins and viz strategy

- **Registration:** PTM chart plugins (ECharts PTM, PTM Table, BigNumber Trendline, Deck.gl PTM, MapLibre PTM) are registered only from `applyPTMExtensions()` (or a dedicated `registerPtmPlugins()` called from there). They are not listed in `MainPreset.js`.
- **Single touchpoint:** Only `setupExtensions.ts` triggers PTM; it runs after `setupPlugins()`, so PTM plugins are registered after the main preset.
- **Migration:** Use a migration/utility script to bulk-convert dashboards/charts from native `viz_type` to PTM `viz_type`; no core code change required.

### Layer D — Backend wiring

- **Minimal:** One wiring point: dashboard extension fields (and optional PTM flags) registered from `superset.extensions.portal` in `initialization/__init__.py`. Config (e.g. feature flags) lives in `superset_config.py` or an optional `ptm_config` module.
- **Avoid:** Invasive edits in core views/models; prefer config and extension hooks.

### Layer E — Infra overlays

- **Override only:** Use `docker-compose.override.yml` (or a separate PTM compose file) for volumes, env, and naming. Do not edit upstream `docker-compose.yml` for PTM-specific needs when possible.
- **Local PTM dev:** Copy `docker-compose.override.yml.example` to `docker-compose.override.yml` and run `docker compose up`. The example enables `PTM_EXTENSION_ENABLED` for the superset service. Add more env or volumes in the override as needed.

---

## Adding a new PTM feature

1. **Prefer Layer A (CSS):** If it’s purely visual, add rules to `ptm-dashboard.css` with stable, scoped selectors.
2. **Otherwise Layer B:** Implement as an extension (new or existing registry key). In `src/ptm/extensions/`, add a registrar that sets the extension when the corresponding PTM flag is on. Call that registrar from `applyPTMExtensions()`.
3. **Chart type (Layer C):** Implement as a plugin; register it in `registerPtmPlugins()` (or equivalent) inside `applyPTMExtensions()`, gated by `PTM_ENABLE_PTM_CHART_PLUGINS` (or similar).
4. **Backend (Layer D):** Only if necessary; add config or a small hook in `superset.extensions.portal` and wire it in `initialization/__init__.py` or config.
5. **Infra (Layer E):** Use override compose or env; do not change upstream compose.

Every feature must be gated by a PTM_* (or PORTAL_*) feature flag or env var so that disabling PTM restores default Superset behavior.

---

## Upgrade strategy

1. Pull latest upstream Superset.
2. Re-apply or verify only the touchpoints in `docs/ptm/PATCH_INDEX.md`.
3. Run `docs/ptm/SMOKE_TESTS.md` and fix any regressions in PTM layers (A–E).
4. Keep `src/ptm/` (and optional backend `ptm_config`) as the only PTM-specific namespaces; avoid re-introducing PTM logic into core files.
