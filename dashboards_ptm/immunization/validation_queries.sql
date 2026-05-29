-- ---------------------------------------------------------------------------
-- validation_queries.sql
--
-- Pre-review sanity checks for Immunization Dashboard v2.
-- Run in BigQuery against `ptm-data-prod` BEFORE the demo. Each query has an
-- expectation comment — flag if reality diverges.
--
-- Order matters: run top-down. The earlier ones are cheap, the later ones
-- (priority score + dropout) hit the heaviest gold marts.
-- ---------------------------------------------------------------------------

-- ===========================================================================
-- 1. FRESHNESS — last RNDS ingestion must be < 60 min for the KPI to look
-- healthy on screen. > 60 min ⇒ pipeline issue, mention it explicitly in the
-- review instead of hiding it.
-- ===========================================================================
SELECT
    s3_enriched_max_ingestion_ts
    , TIMESTAMP_DIFF(
        CURRENT_TIMESTAMP(), s3_enriched_max_ingestion_ts, MINUTE
    ) AS minutes_since_ingestion
    , s2_fact_immunization_rows
    , s3_fact_immunization_enriched_rows
FROM `ptm-data-prod.gold.gold_immunization_data_freshness`
ORDER BY checked_at DESC
LIMIT 1;
-- Expectation: minutes_since_ingestion < 60.

-- ===========================================================================
-- 2. OPERATIONAL BACKLOG ROW COUNT — sanity check that today's snapshot exists
-- and has data. Empty = dbt didn't run today.
-- ===========================================================================
SELECT
    ref_date
    , COUNT(*) AS rows
    , COUNT(DISTINCT municipality_code) AS municipalities
    , COUNT(DISTINCT vaccine_code) AS vaccines
    , SUM(overdue_count) AS total_overdue
    , SUM(due_count) AS total_due
    , SUM(applied_count) AS total_applied
FROM `ptm-data-prod.gold.gold_immunization_operational_backlog_daily`
WHERE ref_date = CURRENT_DATE()
GROUP BY ref_date;
-- Expectation: rows > 0, municipalities >= 1 (pilot), vaccines > 10.

-- ===========================================================================
-- 3. COVERAGE OUT-OF-BOUNDS CHECK — there must be no cell with coverage
-- < 0% or > 100%. If any row violates this, the heatmap will mislead.
-- ===========================================================================
SELECT
    vaccine_name
    , dose_label
    , SUM(applied_count) AS applied
    , SUM(child_rule_pairs) AS eligible
    , SAFE_DIVIDE(SUM(applied_count), NULLIF(SUM(child_rule_pairs), 0))
        AS coverage
FROM `ptm-data-prod.gold.gold_immunization_operational_backlog_daily`
WHERE ref_date = CURRENT_DATE()
GROUP BY vaccine_name, dose_label
HAVING coverage < 0 OR coverage > 1
ORDER BY coverage DESC;
-- Expectation: ZERO rows returned. Any returned row is a bug.

-- ===========================================================================
-- 4. STATUS BUCKET DISTRIBUTION — visualize the proportional mix at a glance.
-- Use to spot anomalies (ex.: 99% future, 0% applied — pipeline broken).
-- ===========================================================================
SELECT
    status_bucket
    , COUNT(*) AS cells
    , SUM(child_rule_pairs) AS total_pairs
    , ROUND(
        SAFE_DIVIDE(SUM(child_rule_pairs), SUM(SUM(child_rule_pairs)) OVER ())
        * 100
        , 2
    ) AS pct
FROM `ptm-data-prod.gold.gold_immunization_operational_backlog_daily`
WHERE ref_date = CURRENT_DATE()
GROUP BY status_bucket
ORDER BY total_pairs DESC;
-- Expectation: applied is usually 40-60% in a stable cohort, overdue 5-20%,
-- future the rest. If applied < 5%, suspicious.

-- ===========================================================================
-- 5. TOP-10 MUNICIPALITIES BY OVERDUE — compare with the dashboard's priority
-- ranking. Order should match (the dashboard adds weight from trend + DQ).
-- ===========================================================================
SELECT
    state_name
    , municipality_name
    , municipality_code
    , SUM(overdue_count) AS overdue_total
    , SUM(child_rule_pairs) AS eligible_total
    , ROUND(
        SAFE_DIVIDE(SUM(overdue_count), NULLIF(SUM(child_rule_pairs), 0))
        , 4
    ) AS overdue_share
FROM `ptm-data-prod.gold.gold_immunization_operational_backlog_daily`
WHERE ref_date = CURRENT_DATE()
GROUP BY state_name, municipality_name, municipality_code
ORDER BY overdue_total DESC
LIMIT 10;
-- Expectation: pilot municipalities (Porto/220850 etc.) dominate. If a
-- non-pilot municipality appears, check the activation_registry filter.

-- ===========================================================================
-- 6. PRIORITY SCORE TOP-10 — same list as #5 but using the score formula.
-- The top should make sense to the operational lead.
-- ===========================================================================
SELECT
    municipality_name
    , state_name
    , priority_score
    , priority_category
    , overdue_share
    , overdue_total
    , overdue_trend_7d
    , due_next_30
    , recommended_action
FROM `ptm-data-prod.gold.gold_immunization_priority_daily_v2`
WHERE ref_date = CURRENT_DATE()
ORDER BY priority_score DESC
LIMIT 10;
-- Expectation: at least 1 municipality with category 'alta' or 'crítica'.

-- ===========================================================================
-- 7. DROPOUT — check that the denominator_warning is filtering correctly.
-- Rows with denominator_warning=true should have effective_dropout_rate NULL.
-- ===========================================================================
SELECT
    denominator_warning
    , COUNT(*) AS rows
    , COUNTIF(effective_dropout_rate IS NULL) AS null_rate
    , COUNTIF(effective_dropout_rate IS NOT NULL) AS valid_rate
FROM `ptm-data-prod.gold.gold_immunization_dropout_by_series_v2`
GROUP BY denominator_warning
ORDER BY denominator_warning DESC;
-- Expectation: when denominator_warning=true, null_rate = rows
-- (effective rate is NULL); when false, valid_rate = rows.

-- ===========================================================================
-- 8. DROPOUT TOP-5 PROBLEMATIC SERIES — for the demo.
-- ===========================================================================
SELECT
    vaccine_name
    , dose_from_label
    , dose_to_label
    , cohort_birth_year
    , applied_from_count
    , applied_to_count
    , ROUND(effective_dropout_rate, 4) AS rate
    , priority_rank
FROM `ptm-data-prod.gold.gold_immunization_dropout_by_series_v2`
WHERE
    effective_dropout_rate IS NOT NULL
    AND applied_from_count >= 50
ORDER BY effective_dropout_rate DESC
LIMIT 5;
-- Expectation: rates between 0.10 and 0.50; cohort_birth_year recent.

-- ===========================================================================
-- 9. DATA QUALITY — total issues in the last 90 days + breakdown by severity.
-- Match with the KPI chart.v2.05_kpi_dq_issues.
-- ===========================================================================
SELECT
    severity
    , reason_label
    , SUM(issue_count) AS total
FROM `ptm-data-prod.gold.gold_immunization_data_quality_daily`
WHERE reference_month >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
GROUP BY severity, reason_label
ORDER BY total DESC;
-- Expectation: 'future_occurrence_date' should be 0 or very low — if high,
-- bronze ingestion has a clock issue.

-- ===========================================================================
-- 10. UNKNOWN MUNICIPALITY (internal-only KPI v2.18) — how many child×rule
-- pairs lack a resolved IBGE. Internal demo signal, not for clients.
-- ===========================================================================
SELECT
    SUM(child_rule_pairs) AS unknown_pairs
    , COUNT(DISTINCT vaccine_code) AS vaccines_affected
FROM `ptm-data-prod.gold.gold_immunization_operational_backlog_daily`
WHERE
    ref_date = CURRENT_DATE()
    AND municipality_code = 'UNKNOWN';
-- Expectation: a small number relative to the total (target < 5% of grand
-- total). High values ⇒ patient demographics pipeline needs investigation.

-- ===========================================================================
-- 11. ACTIVATION REGISTRY — confirm the pilot tenants are active. The
-- factory loop reads exactly this query.
-- ===========================================================================
SELECT
    a.municipality_code
    , a.status
    , a.activated_at
    , dim.municipality_name
    , dim.state_code
    , dim.state_name
FROM `ptm-data-prod.governance.municipality_activation` AS a
LEFT JOIN `ptm-data-prod.silver3.s3_dim_municipality` AS dim
    ON CAST(a.municipality_code AS STRING) = dim.municipality_code
WHERE a.status IN ('active', 'staging')
ORDER BY a.activated_at DESC;
-- Expectation: pilot (Porto/Piauí 220850) appears with status active.
-- If empty, the factory will provision ZERO state/muni dashboards.

-- ===========================================================================
-- 12. STATE-LEVEL FILTER PROPAGATION — confirms the v2 fix (state_name on
-- DQ / dropout / timeliness marts). Run after the dbt fix lands in prod.
-- ===========================================================================
SELECT
    'data_quality' AS mart
    , COUNT(DISTINCT state_name) AS distinct_states
FROM `ptm-data-prod.gold.gold_immunization_data_quality_daily`
UNION ALL
SELECT
    'dropout' AS mart
    , COUNT(DISTINCT state_name) AS distinct_states
FROM `ptm-data-prod.gold.gold_immunization_dropout_by_series_v2`
UNION ALL
SELECT
    'timeliness' AS mart
    , COUNT(DISTINCT state_name) AS distinct_states
FROM `ptm-data-prod.gold.gold_immunization_timeliness_monthly`;
-- Expectation: all three return distinct_states >= 1 and NOT NULL.
-- If query errors with "Unrecognized name: state_name", the fix PR is not
-- yet merged + applied to prod.
