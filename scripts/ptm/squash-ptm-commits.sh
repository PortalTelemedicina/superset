#!/usr/bin/env bash
# ==============================================================================
# squash-ptm-commits.sh — Squash PTM commits into logical groups before syncing
#
# Usage:
#   ./scripts/ptm/squash-ptm-commits.sh [--dry-run]
#
# Creates a new branch with PTM commits squashed into logical groups.
# Your current branch is NEVER modified.
#
# IMPORTANT: This script stashes untracked files (like scripts/ptm/ and
# docs/ptm/) before operating and restores them when done, so they won't
# be accidentally absorbed into squash commits.
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

DRY_RUN=false
if [[ "${1:-}" == "--dry-run" ]]; then
    DRY_RUN=true
    info "Dry run mode — will only show what would be squashed"
fi

# --- Stash management ---------------------------------------------------------
STASH_CREATED=false
ORIGINAL_BRANCH=""

stash_uncommitted() {
    if ! git diff --quiet || ! git diff --cached --quiet || [[ -n "$(git ls-files --others --exclude-standard)" ]]; then
        info "Stashing uncommitted and untracked files to protect them..."
        git stash push --include-untracked -m "ptm-squash: auto-stash $(date +%Y%m%d-%H%M%S)"
        STASH_CREATED=true
        ok "Working tree stashed"
    fi
}

cleanup() {
    local exit_code=$?
    # Always return to original branch
    if [[ -n "$ORIGINAL_BRANCH" ]]; then
        git checkout "$ORIGINAL_BRANCH" 2>/dev/null || true
    fi
    # Restore stashed files
    if [[ "$STASH_CREATED" == true ]]; then
        info "Restoring stashed files..."
        if git stash pop; then
            ok "Stashed files restored"
        else
            warn "Could not auto-restore stash. Recover with: git stash pop"
        fi
    fi
    exit $exit_code
}

trap cleanup EXIT

# --- Pre-flight ---------------------------------------------------------------
ORIGINAL_BRANCH="$(git branch --show-current)"
CURRENT_BRANCH="$ORIGINAL_BRANCH"
UPSTREAM_REMOTE="apache"
MERGE_BASE="$(git merge-base "$CURRENT_BRANCH" "$UPSTREAM_REMOTE/master")"
DATE_TAG="$(date +%Y%m%d)"
SQUASH_BRANCH="squashed/${CURRENT_BRANCH}-${DATE_TAG}"

info "Current branch: $CURRENT_BRANCH"
info "Merge base: ${MERGE_BASE:0:12}"

# Count commits
TOTAL_COMMITS="$(git rev-list --count "$MERGE_BASE".."$CURRENT_BRANCH")"
info "Total PTM commits: $TOTAL_COMMITS"
echo ""

# --- Classify commits by files they touch -------------------------------------
info "Analyzing commits by area..."
echo ""

# Get all PTM commits
COMMITS=$(git rev-list --reverse "$MERGE_BASE".."$CURRENT_BRANCH")

# Classification arrays (stored as temp files for portability)
TMP_DIR=$(mktemp -d)
# TMP_DIR cleaned up by OS; not in trap to avoid masking git cleanup

touch "$TMP_DIR/group_extension_system"
touch "$TMP_DIR/group_ptm_frontend"
touch "$TMP_DIR/group_ptm_backend"
touch "$TMP_DIR/group_ptm_plugins"
touch "$TMP_DIR/group_dashboard"
touch "$TMP_DIR/group_ui_components"
touch "$TMP_DIR/group_infra"
touch "$TMP_DIR/group_other"

for COMMIT in $COMMITS; do
    FILES=$(git diff-tree --no-commit-id --name-only -r "$COMMIT" 2>/dev/null || true)
    MSG=$(git log --format="%s" -1 "$COMMIT")
    SHORT=$(git log --format="%h" -1 "$COMMIT")

    if echo "$FILES" | grep -q "^superset-frontend/src/ptm/"; then
        echo "$SHORT $MSG" >> "$TMP_DIR/group_ptm_frontend"
    elif echo "$FILES" | grep -q "^superset/extensions/portal/"; then
        echo "$SHORT $MSG" >> "$TMP_DIR/group_ptm_backend"
    elif echo "$FILES" | grep -q "plugins/.*-ptm"; then
        echo "$SHORT $MSG" >> "$TMP_DIR/group_ptm_plugins"
    elif echo "$FILES" | grep -qE "ExtensionsRegistry|setupExtensions|DashboardExtensionsContext"; then
        echo "$SHORT $MSG" >> "$TMP_DIR/group_extension_system"
    elif echo "$FILES" | grep -qE "^superset-frontend/src/dashboard/"; then
        echo "$SHORT $MSG" >> "$TMP_DIR/group_dashboard"
    elif echo "$FILES" | grep -qE "docker|Dockerfile|superset_config|\.yml$|requirements/|pyproject"; then
        echo "$SHORT $MSG" >> "$TMP_DIR/group_infra"
    elif echo "$FILES" | grep -qE "^superset-frontend/(src/components|packages/superset-ui-core/src/components)"; then
        echo "$SHORT $MSG" >> "$TMP_DIR/group_ui_components"
    else
        echo "$SHORT $MSG" >> "$TMP_DIR/group_other"
    fi
done

# --- Report -------------------------------------------------------------------
echo "┌─────────────────────────────────────────────────────────────────┐"
echo "│  COMMIT CLASSIFICATION                                         │"
echo "└─────────────────────────────────────────────────────────────────┘"
echo ""

print_group() {
    local name="$1"
    local file="$2"
    local count=$(wc -l < "$file" | tr -d ' ')
    if [[ "$count" -gt 0 ]]; then
        echo -e "${GREEN}$name ($count commits):${NC}"
        cat "$file" | while read -r line; do
            echo "  $line"
        done
        echo ""
    fi
}

print_group "1. Extension System & Core Integration" "$TMP_DIR/group_extension_system"
print_group "2. PTM Frontend (src/ptm/)" "$TMP_DIR/group_ptm_frontend"
print_group "3. PTM Backend (extensions/portal/)" "$TMP_DIR/group_ptm_backend"
print_group "4. PTM Chart Plugins" "$TMP_DIR/group_ptm_plugins"
print_group "5. Dashboard Enhancements" "$TMP_DIR/group_dashboard"
print_group "6. UI/Component Updates" "$TMP_DIR/group_ui_components"
print_group "7. Config/Docker/Infrastructure" "$TMP_DIR/group_infra"
print_group "8. Other Changes" "$TMP_DIR/group_other"

if [[ "$DRY_RUN" == true ]]; then
    echo "─────────────────────────────────────────"
    info "Dry run complete. No changes made."
    info "Run without --dry-run to create squashed branch: $SQUASH_BRANCH"
    rm -rf "$TMP_DIR"
    exit 0
fi

# --- Confirmation -------------------------------------------------------------
echo "─────────────────────────────────────────"
echo ""
warn "This will create a NEW branch '$SQUASH_BRANCH' with squashed commits."
warn "Your current branch '$CURRENT_BRANCH' will NOT be modified."
echo ""
read -p "Continue? [y/N] " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    info "Aborted."
    rm -rf "$TMP_DIR"
    exit 0
fi

# --- Stash untracked files before branch operations ---------------------------
stash_uncommitted

# --- Create squashed branch ---------------------------------------------------
info "Creating squashed branch: $SQUASH_BRANCH"
echo ""

# Start from the merge base
git checkout -b "$SQUASH_BRANCH" "$MERGE_BASE"

# Helper to squash a group of commits
squash_group() {
    local group_name="$1"
    local group_file="$2"
    local commit_msg="$3"

    local count=$(wc -l < "$group_file" | tr -d ' ')
    if [[ "$count" -eq 0 ]]; then
        return
    fi

    info "Squashing: $group_name ($count commits)"

    local commits_in_group=$(cat "$group_file" | awk '{print $1}')

    for sha in $commits_in_group; do
        full_sha=$(git rev-parse "$sha" 2>/dev/null || true)
        if [[ -z "$full_sha" ]]; then
            warn "Could not resolve $sha, skipping"
            continue
        fi
        if ! git cherry-pick --no-commit "$full_sha" 2>/dev/null; then
            # On conflict, accept theirs for this cherry-pick and continue
            # Only resolve tracked files — never touch untracked
            git diff --name-only --diff-filter=U | while read -r conflicted; do
                git checkout --theirs "$conflicted" 2>/dev/null || true
                git add "$conflicted" 2>/dev/null || true
            done
        fi
    done

    # Stage ONLY tracked changes — do NOT use 'git add -A' which grabs untracked files
    if ! git diff --quiet 2>/dev/null; then
        git add -u  # only tracked files
        git commit -m "$commit_msg" --allow-empty 2>/dev/null || true
        ok "Squashed: $group_name"
    elif ! git diff --cached --quiet 2>/dev/null; then
        git commit -m "$commit_msg" --allow-empty 2>/dev/null || true
        ok "Squashed: $group_name"
    else
        info "No changes for: $group_name (already applied or empty)"
    fi
}

squash_group "Extension System" "$TMP_DIR/group_extension_system" \
    "feat(ptm): add extension system and core integration points

Adds ExtensionsRegistry keys for dashboard customization and the single
setupExtensions.ts integration point that calls applyPTMExtensions()
when PTM_EXTENSION_ENABLED is true."

squash_group "PTM Frontend" "$TMP_DIR/group_ptm_frontend" \
    "feat(ptm): add PTM frontend extension system

All PTM frontend code under src/ptm/:
- Extension registries (header, CSS, filterbar, slice header, chart loading)
- Components (CustomizableHeader, FilterBarAdapter, DataFreshness)
- Plugin registration (registerPtmPlugins)
- Feature flags and configuration"

squash_group "PTM Backend" "$TMP_DIR/group_ptm_backend" \
    "feat(ptm): add PTM backend extensions

Backend extensions under superset/extensions/portal/:
- Dashboard metadata schema extensions (header layout)
- Dashboard freshness API and service
- Image rehost service
- Registration hook in initialization/__init__.py"

squash_group "PTM Chart Plugins" "$TMP_DIR/group_ptm_plugins" \
    "feat(ptm): add PTM chart plugin packages

Dedicated PTM chart plugins:
- superset-plugin-chart-echarts-ptm (table, big number, pivot, timeseries)
- legacy-preset-chart-deckgl-maplibre-ptm (Deck.gl + MapLibre)
- legacy-plugin-chart-maplibre-ptm (MapLibre maps)"

squash_group "Dashboard Enhancements" "$TMP_DIR/group_dashboard" \
    "feat(ptm): dashboard component enhancements for extensions

Dashboard component changes to support extension registry:
- DashboardExtensionsContext for passing extensions to child components
- Header extension point for replacement components
- SliceHeaderControls extension for menu customization
- Save hooks for PTM validation and metadata preservation
- CSS injector support"

squash_group "UI/Component Updates" "$TMP_DIR/group_ui_components" \
    "fix(ptm): UI and component updates

Updates to shared UI components:
- Select/AsyncSelect component fixes
- Table layout and styling adjustments
- Various component compatibility updates"

squash_group "Config/Docker/Infrastructure" "$TMP_DIR/group_infra" \
    "chore(ptm): configuration and infrastructure updates

- Docker and superset_config.py updates for PTM flags
- docker-compose.override.yml.example for PTM dev
- Dependency updates
- Build configuration changes"

squash_group "Other Changes" "$TMP_DIR/group_other" \
    "fix(ptm): miscellaneous fixes and updates

Various fixes, tests, and minor changes that support PTM functionality."

# Clean up temp dir
rm -rf "$TMP_DIR"

# --- Summary ------------------------------------------------------------------
SQUASH_COUNT="$(git rev-list --count "$MERGE_BASE".."$SQUASH_BRANCH")"

echo ""
echo "┌─────────────────────────────────────────────────────────────────┐"
echo "│  SQUASH COMPLETE                                               │"
echo "├─────────────────────────────────────────────────────────────────┤"
echo "│                                                                │"
echo "│  Original branch:  $(printf '%-42s' "$CURRENT_BRANCH")│"
echo "│  Original commits: $(printf '%-42s' "$TOTAL_COMMITS")│"
echo "│  Squashed branch:  $(printf '%-42s' "$SQUASH_BRANCH")│"
echo "│  Squashed commits: $(printf '%-42s' "$SQUASH_COUNT")│"
echo "│                                                                │"
echo "│  Next steps:                                                   │"
echo "│  1. Review: git log --oneline $SQUASH_BRANCH"
echo "│  2. Sync:   ./scripts/ptm/sync-upstream.sh 6.1.0              │"
echo "│             (use the squashed branch as source)                │"
echo "│                                                                │"
echo "│  Your original branch is untouched.                            │"
echo "└─────────────────────────────────────────────────────────────────┘"

# cleanup trap will: checkout ORIGINAL_BRANCH + restore stash
