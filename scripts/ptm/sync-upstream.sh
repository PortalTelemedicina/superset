#!/usr/bin/env bash
# ==============================================================================
# sync-upstream.sh — Sync the PTM Superset fork with upstream Apache Superset
#
# Usage:
#   ./scripts/ptm/sync-upstream.sh <target-ref> [--rebase | --merge]
#
# Examples:
#   ./scripts/ptm/sync-upstream.sh 6.1.0            # rebase onto tag v6.1.0
#   ./scripts/ptm/sync-upstream.sh 6.1.0 --merge    # merge tag v6.1.0 instead
#   ./scripts/ptm/sync-upstream.sh apache/master     # sync to latest master
#
# What it does:
#   1. Stashes any uncommitted/untracked work (restored on exit)
#   2. Fetches latest upstream (apache remote)
#   3. Creates a backup branch of your current work
#   4. Creates a dated refresh branch tracking upstream
#   5. Creates a new upgrade branch and replays PTM commits onto it
#   6. Runs touchpoint verification
#
# Prerequisites:
#   - git remote "apache" pointing to https://github.com/apache/superset.git
#   - Clean working tree (no uncommitted changes) OR use auto-stash
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

# --- Configuration -----------------------------------------------------------
UPSTREAM_REMOTE="apache"
ORIGIN_REMOTE="origin"
CURRENT_BRANCH="$(git branch --show-current)"
DATE_TAG="$(date +%Y%m%d)"

# --- Colors -------------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

info()  { echo -e "${BLUE}[INFO]${NC}  $*"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; }
step()  { echo -e "\n${GREEN}━━━ Step $1: $2 ━━━${NC}"; }

# --- Stash management ---------------------------------------------------------
STASH_CREATED=false

stash_uncommitted() {
    # Stash both tracked changes and untracked files to protect them
    if ! git diff --quiet || ! git diff --cached --quiet || [[ -n "$(git ls-files --others --exclude-standard)" ]]; then
        info "Stashing uncommitted and untracked files..."
        git stash push --include-untracked -m "ptm-sync: auto-stash before sync $(date +%Y%m%d-%H%M%S)"
        STASH_CREATED=true
        ok "Working tree stashed (will be restored after sync)"
    fi
}

restore_stash() {
    if [[ "$STASH_CREATED" == true ]]; then
        info "Restoring stashed files..."
        if git stash pop; then
            ok "Stashed files restored"
        else
            warn "Could not auto-restore stash. Recover manually with: git stash pop"
        fi
    fi
}

# Restore stash on exit (success or failure)
trap restore_stash EXIT

# --- Usage --------------------------------------------------------------------
usage() {
    echo "Usage: $0 <target-ref> [--rebase | --merge]"
    echo ""
    echo "  <target-ref>  Upstream tag (e.g. 6.1.0) or branch (e.g. apache/master)"
    echo "  --rebase      Rebase PTM commits onto target (default)"
    echo "  --merge       Merge target into current branch instead"
    echo ""
    echo "Examples:"
    echo "  $0 6.1.0              # Rebase onto upstream tag v6.1.0"
    echo "  $0 6.1.0 --merge      # Merge v6.1.0 into current branch"
    echo "  $0 apache/master       # Sync to latest upstream master"
    exit 1
}

# --- Parse args ---------------------------------------------------------------
TARGET_REF="${1:-}"
STRATEGY="${2:---rebase}"

if [[ -z "$TARGET_REF" ]]; then
    usage
fi

if [[ "$STRATEGY" != "--rebase" && "$STRATEGY" != "--merge" ]]; then
    error "Unknown strategy: $STRATEGY (use --rebase or --merge)"
    exit 1
fi

# Resolve target: if it looks like a version number, prepend "v" for the tag
if [[ "$TARGET_REF" =~ ^[0-9]+\.[0-9]+ ]]; then
    RESOLVED_REF="v${TARGET_REF}"
    BRANCH_SUFFIX="${TARGET_REF}"
else
    RESOLVED_REF="$TARGET_REF"
    BRANCH_SUFFIX="$(echo "$TARGET_REF" | sed 's|.*/||')-${DATE_TAG}"
fi

# ==============================================================================
# Pre-flight checks
# ==============================================================================
step 0 "Pre-flight checks"

# Verify upstream remote exists
if ! git remote get-url "$UPSTREAM_REMOTE" &>/dev/null; then
    error "Remote '$UPSTREAM_REMOTE' not found. Add it with:"
    echo "  git remote add $UPSTREAM_REMOTE https://github.com/apache/superset.git"
    exit 1
fi

# Stash any uncommitted work (including untracked files like scripts/ptm/)
stash_uncommitted

ok "Current branch: $CURRENT_BRANCH"
ok "Upstream remote: $UPSTREAM_REMOTE ($(git remote get-url $UPSTREAM_REMOTE))"
info "Target reference: $RESOLVED_REF"
info "Strategy: $STRATEGY"

# ==============================================================================
# Step 1: Fetch upstream
# ==============================================================================
step 1 "Fetching upstream"

git fetch "$UPSTREAM_REMOTE" --tags --prune
ok "Upstream fetched with tags"

# Verify target ref exists
if ! git rev-parse --verify "$RESOLVED_REF" &>/dev/null; then
    # Try with apache/ prefix
    if git rev-parse --verify "$UPSTREAM_REMOTE/$RESOLVED_REF" &>/dev/null; then
        RESOLVED_REF="$UPSTREAM_REMOTE/$RESOLVED_REF"
    else
        error "Target ref '$RESOLVED_REF' not found. Available tags:"
        git tag -l "v6.*" | tail -10
        exit 1
    fi
fi

TARGET_SHA="$(git rev-parse "$RESOLVED_REF")"
ok "Target resolved: $RESOLVED_REF → ${TARGET_SHA:0:12}"

# ==============================================================================
# Step 2: Create backup branch
# ==============================================================================
step 2 "Creating backup branch"

BACKUP_BRANCH="backup/${CURRENT_BRANCH}-pre-sync-${DATE_TAG}"
if git rev-parse --verify "$BACKUP_BRANCH" &>/dev/null; then
    warn "Backup branch $BACKUP_BRANCH already exists, adding timestamp"
    BACKUP_BRANCH="backup/${CURRENT_BRANCH}-pre-sync-${DATE_TAG}-$(date +%H%M%S)"
fi

git branch "$BACKUP_BRANCH" "$CURRENT_BRANCH"
ok "Backup created: $BACKUP_BRANCH"

# ==============================================================================
# Step 3: Create refresh branch (snapshot of upstream)
# ==============================================================================
step 3 "Creating refresh branch"

REFRESH_BRANCH="refresh/apache-master-${DATE_TAG}"
git branch -f "$REFRESH_BRANCH" "$UPSTREAM_REMOTE/master"
ok "Refresh branch: $REFRESH_BRANCH → upstream master"

# ==============================================================================
# Step 4: Identify merge base and PTM commits
# ==============================================================================
step 4 "Analyzing commit history"

MERGE_BASE="$(git merge-base "$CURRENT_BRANCH" "$UPSTREAM_REMOTE/master")"
PTM_COMMIT_COUNT="$(git rev-list --count "$MERGE_BASE".."$CURRENT_BRANCH")"
UPSTREAM_AHEAD="$(git rev-list --count "$MERGE_BASE".."$UPSTREAM_REMOTE/master")"

info "Merge base: ${MERGE_BASE:0:12}"
info "PTM commits to replay: $PTM_COMMIT_COUNT"
info "Upstream commits ahead: $UPSTREAM_AHEAD"
echo ""

# Show PTM commits that will be replayed
echo "PTM commits to replay:"
echo "─────────────────────────────────────────"
git log --oneline "$MERGE_BASE".."$CURRENT_BRANCH" | head -30
if [[ "$PTM_COMMIT_COUNT" -gt 30 ]]; then
    echo "  ... and $((PTM_COMMIT_COUNT - 30)) more"
fi
echo ""

# ==============================================================================
# Step 5: Execute sync strategy
# ==============================================================================
if [[ "$STRATEGY" == "--rebase" ]]; then
    step 5 "Rebasing PTM commits onto $RESOLVED_REF"

    NEW_BRANCH="upgrade/${BRANCH_SUFFIX}"

    if git rev-parse --verify "$NEW_BRANCH" &>/dev/null; then
        error "Branch $NEW_BRANCH already exists. Delete it first or use a different target."
        echo "  git branch -D $NEW_BRANCH"
        exit 1
    fi

    # Create new branch from current and rebase onto target
    git checkout -b "$NEW_BRANCH" "$CURRENT_BRANCH"

    info "Starting rebase... This may take a while with $PTM_COMMIT_COUNT commits."
    info "If conflicts occur, resolve them and run: git rebase --continue"
    echo ""

    # Disable auto-stash restore during rebase — we'll handle it at the end
    if git rebase --onto "$RESOLVED_REF" "$MERGE_BASE" "$NEW_BRANCH"; then
        ok "Rebase completed successfully!"
        echo ""
        info "New branch: $NEW_BRANCH"
        info "Commits replayed: $PTM_COMMIT_COUNT"
    else
        warn "Rebase encountered conflicts."
        echo ""
        echo "┌─────────────────────────────────────────────────────────────────┐"
        echo "│  CONFLICT RESOLUTION GUIDE                                     │"
        echo "├─────────────────────────────────────────────────────────────────┤"
        echo "│                                                                │"
        echo "│  1. Check which files have conflicts:                          │"
        echo "│     git status                                                 │"
        echo "│                                                                │"
        echo "│  2. Focus on the PTM touchpoints (see PATCH_INDEX.md):         │"
        echo "│     - superset-frontend/src/setup/setupExtensions.ts           │"
        echo "│     - superset/initialization/__init__.py                      │"
        echo "│     - superset/dashboards/schemas.py                           │"
        echo "│     - superset/dashboards/api.py                               │"
        echo "│     - superset/daos/dashboard.py                               │"
        echo "│                                                                │"
        echo "│  3. After resolving each file:                                 │"
        echo "│     git add <resolved-file>                                    │"
        echo "│     git rebase --continue                                      │"
        echo "│                                                                │"
        echo "│  4. To abort and go back to your backup:                       │"
        echo "│     git rebase --abort                                         │"
        echo "│     git checkout $CURRENT_BRANCH                               │"
        echo "│                                                                │"
        echo "│  5. After rebase completes, run verification:                  │"
        echo "│     ./scripts/ptm/verify-touchpoints.sh                        │"
        echo "│                                                                │"
        echo "│  Backup branch: $BACKUP_BRANCH                                │"
        if [[ "$STASH_CREATED" == true ]]; then
        echo "│  Stash: git stash pop (after rebase completes)                 │"
        fi
        echo "└─────────────────────────────────────────────────────────────────┘"
        # Don't auto-restore stash during conflict resolution
        STASH_CREATED=false
        exit 1
    fi

elif [[ "$STRATEGY" == "--merge" ]]; then
    step 5 "Merging $RESOLVED_REF into $CURRENT_BRANCH"

    info "Starting merge..."

    if git merge "$RESOLVED_REF" --no-edit -m "merge: sync with upstream $RESOLVED_REF"; then
        ok "Merge completed successfully!"
    else
        warn "Merge encountered conflicts."
        echo ""
        echo "┌─────────────────────────────────────────────────────────────────┐"
        echo "│  CONFLICT RESOLUTION GUIDE                                     │"
        echo "├─────────────────────────────────────────────────────────────────┤"
        echo "│                                                                │"
        echo "│  1. Check conflicted files:                                    │"
        echo "│     git status                                                 │"
        echo "│                                                                │"
        echo "│  2. Focus on PTM touchpoints first (see PATCH_INDEX.md)        │"
        echo "│                                                                │"
        echo "│  3. For PTM-isolated dirs, keep ours:                          │"
        echo "│     git checkout --ours superset-frontend/src/ptm/             │"
        echo "│     git checkout --ours superset/extensions/portal/            │"
        echo "│                                                                │"
        echo "│  4. After resolving all conflicts:                             │"
        echo "│     git add .                                                  │"
        echo "│     git commit                                                 │"
        echo "│                                                                │"
        echo "│  5. To abort:                                                  │"
        echo "│     git merge --abort                                          │"
        echo "│                                                                │"
        echo "│  Backup branch: $BACKUP_BRANCH                                │"
        if [[ "$STASH_CREATED" == true ]]; then
        echo "│  Stash: git stash pop (after merge completes)                  │"
        fi
        echo "└─────────────────────────────────────────────────────────────────┘"
        STASH_CREATED=false
        exit 1
    fi
fi

# ==============================================================================
# Step 6: Post-sync verification
# ==============================================================================
step 6 "Running post-sync verification"

if [[ -x "$SCRIPT_DIR/verify-touchpoints.sh" ]]; then
    "$SCRIPT_DIR/verify-touchpoints.sh" || true
else
    warn "verify-touchpoints.sh not found or not executable. Run it manually."
fi

# ==============================================================================
# Summary
# ==============================================================================
echo ""
echo "┌─────────────────────────────────────────────────────────────────┐"
echo "│  SYNC COMPLETE                                                 │"
echo "├─────────────────────────────────────────────────────────────────┤"
echo "│                                                                │"
echo "│  Current branch:  $(printf '%-43s' "$(git branch --show-current)")│"
echo "│  Backup branch:   $(printf '%-43s' "$BACKUP_BRANCH")│"
echo "│  Refresh branch:  $(printf '%-43s' "$REFRESH_BRANCH")│"
echo "│  Target:           $(printf '%-42s' "$RESOLVED_REF")│"
echo "│                                                                │"
echo "│  Next steps:                                                   │"
echo "│  1. Run: ./scripts/ptm/validate-build.sh                      │"
echo "│  2. Test with PTM_EXTENSION_ENABLED=true                      │"
echo "│  3. Test with PTM_EXTENSION_ENABLED=false                     │"
echo "│  4. Run smoke tests: docs/ptm/SMOKE_TESTS.md                  │"
echo "│  5. Push: git push origin $(printf '%-30s' "$(git branch --show-current)")│"
echo "│                                                                │"
echo "└─────────────────────────────────────────────────────────────────┘"
