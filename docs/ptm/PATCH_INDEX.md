# PTM — Minimal touchpoint index

This document lists every place in upstream Superset that is touched for PTM. The goal is to keep this list minimal so upgrades only require verifying these points.

---

## Frontend

| Location | Purpose |
|----------|---------|
| `superset-frontend/src/setup/setupExtensions.ts` | **Single integration point.** Calls `applyPTMExtensions()` from `src/ptm` when `PTM_EXTENSION_ENABLED` is true. No other core file imports PTM code. |

All other PTM behavior is additive under `src/ptm/` (or `src/extensions/portal/` until fully migrated). Core components only use the generic extension registry keys (`dashboard.header.replacement`, `dashboard.css.transform`, etc.); they do not reference PTM by name.

---

## Backend

| Location | Purpose |
|----------|---------|
| `superset/initialization/__init__.py` | Calls `register_dashboard_extension_fields()` from `superset.extensions.portal` so dashboard metadata (e.g. header layout, PTM branding) is accepted and stored. |
| `docker/pythonpath_dev/superset_config.py` (or project-specific config) | Sets `FEATURE_FLAGS['PTM_EXTENSION_ENABLED'] = True` and any PTM-related config. Prefer importing from a single `ptm_config` module if you add more flags. |

Optional: `superset/dashboards/schemas.py` and `superset/dashboards/api.py` already reference portal extension metadata; those are existing touchpoints for dashboard header/freshness. No new core files should be added for PTM.

---

## Infra

| Location | Purpose |
|----------|---------|
| `docker-compose.override.yml` | PTM dev overrides (volumes, env, naming). Upstream `docker-compose.yml` is not edited. Copy from `docker-compose.override.yml.example` to enable PTM in Docker. |

---

## What is not in core

- **Chart plugins:** Registered by `applyPTMExtensions()` (from `src/ptm`). `MainPreset.js` does not import or register PTM plugins (PTM was removed from MainPreset in this refactor).
- **Dashboard CSS:** Injected via `dashboard.css.transform` extension; implementation lives under `src/ptm/extensions/`.
- **Header / filter bar / slice header UI:** Implemented as extensions registered by `applyPTMExtensions()`; core only calls the extension registry.

When upgrading Superset, re-apply or re-verify only the lines listed in this index.
