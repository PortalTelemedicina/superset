# PTM (Portal Telemedicina) Extensions

PTM and Portal are the same: company portal / Telemedicina customizations.

- **This folder (`src/ptm`)** is the **single entry point** for PTM. Only `setupExtensions.ts` imports from here and calls `applyPTMExtensions()` when the PTM feature flag is enabled.
- **Extension pattern**: Most slots are **component replace**: `return Extension ? <Extension {...props} /> : <Default />` (Header, FilterBar, FilterBarSettings, FilterValue, CSS injector). **SliceHeaderControls** is the only **function-based** slot: extensions register `sliceHeaderControlsClassNamesFn` and `sliceHeaderControlsTriggerFn`; core calls them and uses the return values (classNames + trigger node). This keeps the core diff minimal (two variables, used inline) and avoids duplicating menu logic in PTM.
- **PTM UI** lives here: dashboard header, filter bar, CSS injector, slice header (classNames + trigger). Registration in `ptm/extensions/*`; components in `ptm/components/`, `ptm/css/`, `ptm/shared/`.
- **Core** never imports PTM; it only uses `DashboardExtensionsContext` and registry values provided at the root in `DashboardPage`.
- **Styling**: see [STYLING.md](./STYLING.md) for theme tokens, global CSS, and plugin styling.

All PTM dashboard overrides are registered in `src/ptm/index.ts` via `applyPTMExtensions()`.
