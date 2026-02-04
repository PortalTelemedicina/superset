# PTM smoke tests

Use this checklist after changes or Superset upgrades to confirm PTM behavior.

---

## 1. Dashboard loads

- [ ] Open a dashboard (with and without PTM tag).
- [ ] No console errors; layout and header render.

---

## 2. Filters

- [ ] Native filters are visible and usable.
- [ ] If collapsible filter bar is enabled: collapse/expand works and layout updates.

---

## 3. PTM table

- [ ] Dashboard contains a chart with `viz_type: ptm_table`.
- [ ] PTM table renders with correct padding and styling (scoped to PTM table wrapper).

---

## 4. PTM BigNumber trendline

- [ ] Dashboard contains a chart with `viz_type: ptm_big_number_trendline`.
- [ ] Chart renders without errors and trendline displays as expected.

---

## 5. ECharts PTM wrapper

- [ ] Dashboard contains a PTM ECharts chart (e.g. `ptm_echarts_timeseries`, `ptm_pie`).
- [ ] Chart renders and matches expected PTM styling/behavior.

---

## 6. PTM global CSS

- [ ] Open a dashboard tagged with PTM (or equivalent).
- [ ] Global PTM styles (e.g. header, variables) are applied (check computed styles or visual consistency).

---

## 7. Extension off

- [ ] Disable PTM/Portal extension (feature flag off or env unset).
- [ ] Dashboards still load with default Superset header and no PTM-specific CSS or plugins.

---

Run these manually (or automate where possible) after refactors and before releasing.
