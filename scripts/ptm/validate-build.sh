#!/usr/bin/env bash
#
# Licensed to the Apache Software Foundation (ASF) under one or more
# contributor license agreements.  See the NOTICE file distributed with
# this work for additional information regarding copyright ownership.
# The ASF licenses this file to You under the Apache License, Version 2.0
# (the "License"); you may not use this file except in compliance with
# the License.  You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#
# ==============================================================================
# validate-build.sh — Full build and test validation after upstream sync
#
# Usage:
#   ./scripts/ptm/validate-build.sh [--quick | --full]
#
# Modes:
#   --quick   TypeScript check + lint only (fast, ~2-3 min)
#   --full    Full build + backend checks (slow, ~10-15 min)
#   (default) --quick
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

info()  { echo -e "${BLUE}[INFO]${NC}  $*"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; }
step()  { echo -e "\n${GREEN}━━━ Step $1: $2 ━━━${NC}"; }

MODE="${1:---quick}"
PASS=0
FAIL=0

record_pass() { ok "$*"; ((PASS++)); }
record_fail() { error "$*"; ((FAIL++)); }

# ==============================================================================
step 1 "Check Node.js & npm"
# ==============================================================================

if command -v node &>/dev/null; then
    record_pass "Node.js $(node --version)"
else
    record_fail "Node.js not found"
fi

if command -v npm &>/dev/null; then
    record_pass "npm $(npm --version)"
else
    record_fail "npm not found"
fi

# ==============================================================================
step 2 "Install frontend dependencies"
# ==============================================================================

cd "$REPO_ROOT/superset-frontend"

if [[ -f "package-lock.json" ]]; then
    info "Running npm ci..."
    if npm ci --loglevel=warn 2>&1 | tail -5; then
        record_pass "npm ci completed"
    else
        record_fail "npm ci failed"
        warn "Try: rm -rf node_modules && npm install"
    fi
else
    info "Running npm install..."
    if npm install --loglevel=warn 2>&1 | tail -5; then
        record_pass "npm install completed"
    else
        record_fail "npm install failed"
    fi
fi

# ==============================================================================
step 3 "TypeScript type checking"
# ==============================================================================

info "Running tsc --noEmit (this may take a minute)..."

if npx tsc --noEmit 2>&1 | tail -20; then
    record_pass "TypeScript compilation: no errors"
else
    record_fail "TypeScript compilation has errors"
    echo ""
    warn "Common post-sync TS errors:"
    echo "  - Missing imports in setupExtensions.ts"
    echo "  - Changed types in ExtensionsRegistry"
    echo "  - Updated component props in dashboard/"
    echo ""
    echo "Run 'npx tsc --noEmit' for full error output."
fi

# ==============================================================================
step 4 "ESLint check on PTM code"
# ==============================================================================

info "Linting PTM frontend code..."

if npx eslint src/ptm/ --ext .ts,.tsx --quiet 2>&1; then
    record_pass "ESLint: src/ptm/ clean"
else
    record_fail "ESLint errors in src/ptm/"
fi

if npx eslint src/setup/setupExtensions.ts --quiet 2>&1; then
    record_pass "ESLint: setupExtensions.ts clean"
else
    record_fail "ESLint errors in setupExtensions.ts"
fi

# ==============================================================================
# Full mode: additional checks
# ==============================================================================
if [[ "$MODE" == "--full" ]]; then

    # ==========================================================================
    step 5 "Frontend production build"
    # ==========================================================================

    info "Running npm run build (this takes several minutes)..."

    if npm run build 2>&1 | tail -10; then
        record_pass "Frontend build successful"
    else
        record_fail "Frontend build failed"
    fi

    # ==========================================================================
    step 6 "Backend Python checks"
    # ==========================================================================

    cd "$REPO_ROOT"

    if command -v python3 &>/dev/null; then
        record_pass "Python $(python3 --version 2>&1)"
    else
        record_fail "Python 3 not found"
    fi

    info "Checking backend PTM imports..."

    if python3 -c "
import sys
sys.path.insert(0, '.')
try:
    from superset.extensions.portal import register_dashboard_extension_fields
    print('  portal extension imports OK')
except ImportError as e:
    print(f'  FAIL: {e}')
    sys.exit(1)
" 2>&1; then
        record_pass "Backend PTM imports work"
    else
        record_fail "Backend PTM imports failed"
    fi

    # ==========================================================================
    step 7 "PTM feature flag validation"
    # ==========================================================================

    info "Checking feature flag consistency..."

    if grep -rq "PTM_EXTENSION_ENABLED" superset/config.py docker/pythonpath_dev/superset_config.py 2>/dev/null; then
        record_pass "PTM_EXTENSION_ENABLED in backend config"
    else
        warn "PTM_EXTENSION_ENABLED not found in standard config files"
    fi

    if grep -rq "PTM_EXTENSION_ENABLED" superset-frontend/src/ptm/config/ 2>/dev/null; then
        record_pass "PTM_EXTENSION_ENABLED in frontend PTM config"
    else
        record_fail "PTM_EXTENSION_ENABLED not in frontend PTM config"
    fi

    # ==========================================================================
    step 8 "Frontend unit tests (PTM-related)"
    # ==========================================================================

    cd "$REPO_ROOT/superset-frontend"

    info "Running PTM-related tests..."

    if npx jest --passWithNoTests --no-coverage \
        src/setup/ \
        src/ptm/ \
        2>&1 | tail -10; then
        record_pass "PTM unit tests pass"
    else
        record_fail "PTM unit tests failed"
    fi

fi  # end --full

# ==============================================================================
# Summary
# ==============================================================================
cd "$REPO_ROOT"

echo ""
echo "┌─────────────────────────────────────────────────────────────────┐"
echo "│  BUILD VALIDATION SUMMARY ($MODE)                              │"
echo "├─────────────────────────────────────────────────────────────────┤"
printf "│  ${GREEN}Passed: %-55s${NC}│\n" "$PASS"
printf "│  ${RED}Failed: %-55s${NC}│\n" "$FAIL"
echo "│                                                                │"

if [[ "$FAIL" -eq 0 ]]; then
    echo -e "│  ${GREEN}All checks passed!${NC}                                             │"
    echo "│                                                                │"
    echo "│  Next steps:                                                   │"
    echo "│  1. Test with PTM enabled:  PTM_EXTENSION_ENABLED=true         │"
    echo "│  2. Test with PTM disabled: PTM_EXTENSION_ENABLED=false        │"
    echo "│  3. Run smoke tests: docs/ptm/SMOKE_TESTS.md                   │"
else
    echo -e "│  ${RED}$FAIL check(s) failed — fix before proceeding.${NC}                  │"
fi

echo "└─────────────────────────────────────────────────────────────────┘"

if [[ "$FAIL" -gt 0 ]]; then
    exit 1
fi
exit 0
