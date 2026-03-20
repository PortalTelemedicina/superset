#!/usr/bin/env bash
# ==============================================================================
# verify-touchpoints.sh — Verify PTM integration points after upstream sync
#
# Usage:
#   ./scripts/ptm/verify-touchpoints.sh
#
# Checks that all PTM touchpoints in core Superset are present and correct
# after syncing with upstream. Run this after every sync/rebase/merge.
#
# Exit codes:
#   0 — All touchpoints verified
#   1 — One or more touchpoints missing or broken
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

# --- Colors -------------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PASS=0
FAIL=0
WARN=0

check_pass() { echo -e "  ${GREEN}✓${NC} $*"; ((PASS++)); }
check_fail() { echo -e "  ${RED}✗${NC} $*"; ((FAIL++)); }
check_warn() { echo -e "  ${YELLOW}⚠${NC} $*"; ((WARN++)); }

section() { echo -e "\n${BLUE}━━━ $* ━━━${NC}"; }

# ==============================================================================
section "1. PTM Frontend Directories"
# ==============================================================================

if [[ -d "superset-frontend/src/ptm" ]]; then
    check_pass "superset-frontend/src/ptm/ exists"
else
    check_fail "superset-frontend/src/ptm/ MISSING — PTM frontend code is gone"
fi

if [[ -f "superset-frontend/src/ptm/index.ts" ]]; then
    if grep -q "applyPTMExtensions" "superset-frontend/src/ptm/index.ts"; then
        check_pass "src/ptm/index.ts exports applyPTMExtensions()"
    else
        check_fail "src/ptm/index.ts exists but applyPTMExtensions() not found"
    fi
else
    check_fail "src/ptm/index.ts MISSING"
fi

if [[ -f "superset-frontend/src/ptm/config/featureFlags.ts" ]]; then
    check_pass "src/ptm/config/featureFlags.ts exists"
else
    check_fail "src/ptm/config/featureFlags.ts MISSING"
fi

# ==============================================================================
section "2. Frontend Core Integration (setupExtensions.ts)"
# ==============================================================================

SETUP_EXT="superset-frontend/src/setup/setupExtensions.ts"
if [[ -f "$SETUP_EXT" ]]; then
    check_pass "$SETUP_EXT exists"

    if grep -q "applyPTMExtensions" "$SETUP_EXT"; then
        check_pass "applyPTMExtensions() call present in setupExtensions.ts"
    else
        check_fail "applyPTMExtensions() call MISSING from setupExtensions.ts"
        echo -e "         ${YELLOW}Add: import { applyPTMExtensions } from 'src/ptm';${NC}"
        echo -e "         ${YELLOW}     if (flags?.PTM_EXTENSION_ENABLED) applyPTMExtensions();${NC}"
    fi

    if grep -q "PTM_EXTENSION_ENABLED" "$SETUP_EXT"; then
        check_pass "PTM_EXTENSION_ENABLED feature flag check present"
    else
        check_fail "PTM_EXTENSION_ENABLED check MISSING from setupExtensions.ts"
    fi
else
    check_fail "$SETUP_EXT MISSING — critical integration point"
fi

# ==============================================================================
section "3. Extension Registry Keys"
# ==============================================================================

EXT_REGISTRY="superset-frontend/packages/superset-ui-core/src/ui-overrides/ExtensionsRegistry.ts"
if [[ -f "$EXT_REGISTRY" ]]; then
    check_pass "ExtensionsRegistry.ts exists"

    REQUIRED_KEYS=(
        "dashboard.header.replacement"
        "dashboard.css"
        "dashboard.sliceHeaderControls"
        "dashboard.filterbar"
    )

    for key in "${REQUIRED_KEYS[@]}"; do
        if grep -q "$key" "$EXT_REGISTRY"; then
            check_pass "Extension key '$key' registered"
        else
            check_warn "Extension key '$key' not found — may have been renamed"
        fi
    done
else
    check_fail "ExtensionsRegistry.ts MISSING"
fi

EXT_TYPES="superset-frontend/packages/superset-ui-core/src/ui-overrides/types.ts"
if [[ -f "$EXT_TYPES" ]]; then
    check_pass "Extension types.ts exists"
else
    check_warn "Extension types.ts not found"
fi

# ==============================================================================
section "4. Dashboard Components (Extension Points)"
# ==============================================================================

DASH_EXT_CTX="superset-frontend/src/dashboard/components/DashboardExtensionsContext.tsx"
if [[ -f "$DASH_EXT_CTX" ]]; then
    check_pass "DashboardExtensionsContext.tsx exists"
else
    check_fail "DashboardExtensionsContext.tsx MISSING — dashboard extensions won't work"
fi

DASH_PAGE="superset-frontend/src/dashboard/containers/DashboardPage.tsx"
if [[ -f "$DASH_PAGE" ]]; then
    if grep -q "DashboardExtensionsContext\|ExtensionsContext\|extensionsRegistry" "$DASH_PAGE"; then
        check_pass "DashboardPage.tsx uses extensions context"
    else
        check_warn "DashboardPage.tsx may not use extensions context — verify manually"
    fi
else
    check_fail "DashboardPage.tsx MISSING"
fi

HEADER="superset-frontend/src/dashboard/components/Header/index.jsx"
if [[ -f "$HEADER" ]]; then
    if grep -q "header.replacement\|extensionsRegistry\|getExtensionsRegistry" "$HEADER"; then
        check_pass "Header/index.jsx has extension point"
    else
        check_warn "Header/index.jsx may be missing extension point — verify manually"
    fi
else
    # Check .tsx variant
    if [[ -f "${HEADER%.jsx}.tsx" ]]; then
        check_pass "Header/index.tsx found (converted from .jsx)"
    else
        check_warn "Header/index.jsx not found — may have been renamed"
    fi
fi

SLICE_HEADER="superset-frontend/src/dashboard/components/SliceHeaderControls/index.tsx"
if [[ -f "$SLICE_HEADER" ]]; then
    if grep -q "sliceHeaderControls\|extensionsRegistry\|getExtensionsRegistry" "$SLICE_HEADER"; then
        check_pass "SliceHeaderControls has extension point"
    else
        check_warn "SliceHeaderControls may be missing extension point"
    fi
else
    check_warn "SliceHeaderControls/index.tsx not found"
fi

# ==============================================================================
section "5. PTM Backend"
# ==============================================================================

if [[ -d "superset/extensions/portal" ]]; then
    check_pass "superset/extensions/portal/ exists"
else
    check_fail "superset/extensions/portal/ MISSING — backend extensions gone"
fi

INIT_FILE="superset/initialization/__init__.py"
if [[ -f "$INIT_FILE" ]]; then
    if grep -q "register_dashboard_extension_fields\|extensions.portal" "$INIT_FILE"; then
        check_pass "initialization/__init__.py has portal registration"
    else
        check_fail "initialization/__init__.py MISSING portal registration"
        echo -e "         ${YELLOW}Add: from superset.extensions.portal import register_dashboard_extension_fields${NC}"
    fi
else
    check_fail "initialization/__init__.py MISSING"
fi

SCHEMAS="superset/dashboards/schemas.py"
if [[ -f "$SCHEMAS" ]]; then
    if grep -q "PTM_EXTENSION_ENABLED\|portal\|headerLayout\|header_layout" "$SCHEMAS"; then
        check_pass "dashboards/schemas.py has PTM metadata fields"
    else
        check_warn "dashboards/schemas.py may be missing PTM metadata fields"
    fi
else
    check_warn "dashboards/schemas.py not found"
fi

DASH_API="superset/dashboards/api.py"
if [[ -f "$DASH_API" ]]; then
    if grep -q "portal\|freshness\|header_image\|PTM" "$DASH_API"; then
        check_pass "dashboards/api.py has PTM endpoints"
    else
        check_warn "dashboards/api.py may be missing PTM endpoints"
    fi
else
    check_warn "dashboards/api.py not found"
fi

DASH_DAO="superset/daos/dashboard.py"
if [[ -f "$DASH_DAO" ]]; then
    if grep -q "portal\|extension\|header_layout\|PTM" "$DASH_DAO"; then
        check_pass "daos/dashboard.py has PTM metadata handling"
    else
        check_warn "daos/dashboard.py may be missing PTM metadata handling"
    fi
else
    check_warn "daos/dashboard.py not found"
fi

# ==============================================================================
section "6. PTM Chart Plugins"
# ==============================================================================

PTM_PLUGIN_DIRS=(
    "superset-frontend/plugins/superset-plugin-chart-echarts-ptm"
    "superset-frontend/plugins/legacy-preset-chart-deckgl-maplibre-ptm"
    "superset-frontend/plugins/legacy-plugin-chart-maplibre-ptm"
)

for dir in "${PTM_PLUGIN_DIRS[@]}"; do
    if [[ -d "$dir" ]]; then
        check_pass "$(basename "$dir")/ exists"
    else
        check_warn "$(basename "$dir")/ not found"
    fi
done

# ==============================================================================
section "7. Configuration & Infrastructure"
# ==============================================================================

CONFIG="superset/config.py"
if [[ -f "$CONFIG" ]]; then
    if grep -q "PTM_EXTENSION_ENABLED" "$CONFIG"; then
        check_pass "PTM_EXTENSION_ENABLED in superset/config.py"
    else
        check_warn "PTM_EXTENSION_ENABLED not in config.py — may be in superset_config.py"
    fi
fi

if [[ -f "docker-compose.override.yml.example" ]]; then
    check_pass "docker-compose.override.yml.example exists"
else
    check_warn "docker-compose.override.yml.example not found"
fi

FF_FILE="superset-frontend/packages/superset-ui-core/src/utils/featureFlags.ts"
if [[ -f "$FF_FILE" ]]; then
    if grep -q "PTM_EXTENSION_ENABLED" "$FF_FILE"; then
        check_pass "PTM_EXTENSION_ENABLED in frontend featureFlags enum"
    else
        check_warn "PTM_EXTENSION_ENABLED not in frontend featureFlags enum"
    fi
fi

# ==============================================================================
section "8. Documentation"
# ==============================================================================

DOCS=(
    "docs/ptm/ARCHITECTURE.md"
    "docs/ptm/PATCH_INDEX.md"
    "docs/ptm/SMOKE_TESTS.md"
    "docs/ptm/SYNC_GUIDE.md"
)

for doc in "${DOCS[@]}"; do
    if [[ -f "$doc" ]]; then
        check_pass "$doc exists"
    else
        check_warn "$doc not found"
    fi
done

# ==============================================================================
# Summary
# ==============================================================================
echo ""
echo "┌─────────────────────────────────────────────────────────────────┐"
echo "│  VERIFICATION SUMMARY                                          │"
echo "├─────────────────────────────────────────────────────────────────┤"
printf "│  ${GREEN}Passed:  %-54s${NC}│\n" "$PASS"
printf "│  ${YELLOW}Warnings: %-53s${NC}│\n" "$WARN"
printf "│  ${RED}Failed:  %-54s${NC}│\n" "$FAIL"
echo "│                                                                │"

if [[ "$FAIL" -eq 0 ]]; then
    echo -e "│  ${GREEN}All critical touchpoints verified!${NC}                              │"
else
    echo -e "│  ${RED}$FAIL critical touchpoint(s) need attention.${NC}                     │"
    echo "│  See PATCH_INDEX.md for how to restore missing touchpoints.    │"
fi

if [[ "$WARN" -gt 0 ]]; then
    echo "│  Review warnings — some may need manual verification.          │"
fi

echo "└─────────────────────────────────────────────────────────────────┘"

if [[ "$FAIL" -gt 0 ]]; then
    exit 1
fi
exit 0
