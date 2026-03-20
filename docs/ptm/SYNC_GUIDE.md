# PTM Superset — Upstream Sync Guide

Complete runbook for syncing the PTM fork with upstream Apache Superset.

---

## Overview

| Item | Value |
|------|-------|
| Fork | `PortalTelemedicina/superset` |
| Upstream | `apache/superset` (remote: `apache`) |
| PTM branch | `upgrade/6.0` (or latest `upgrade/*`) |
| Strategy | Rebase-on-tag (preferred) or merge |
| PTM isolation | `src/ptm/`, `superset/extensions/portal/`, `plugins/*-ptm/` |
| Core touchpoints | ~5 files (see PATCH_INDEX.md) |

---

## Prerequisites

```bash
# Verify upstream remote
git remote -v
# Should show:
#   apache  https://github.com/apache/superset.git (fetch)
#   origin  git@github.com:PortalTelemedicina/superset.git (fetch)

# If missing, add it:
git remote add apache https://github.com/apache/superset.git
```

---

## Quick Sync (TL;DR)

```bash
# 1. Run the sync script (rebase onto target version)
./scripts/ptm/sync-upstream.sh 6.1.0

# 2. If conflicts occur, resolve them and continue:
#    git add <resolved-file> && git rebase --continue

# 3. Verify touchpoints
./scripts/ptm/verify-touchpoints.sh

# 4. Validate build
./scripts/ptm/validate-build.sh --quick   # fast: TS + lint
./scripts/ptm/validate-build.sh --full    # thorough: build + tests

# 5. Test manually
PTM_EXTENSION_ENABLED=true docker compose up
PTM_EXTENSION_ENABLED=false docker compose up

# 6. Push
git push origin upgrade/6.1
```

---

## Detailed Process

### Phase 1: Prepare

#### 1.1 Check upstream releases

Visit https://github.com/apache/superset/releases or:

```bash
git fetch apache --tags
git tag -l "v6.*" | sort -V
```

Read the UPDATING.md and CHANGELOG for breaking changes, especially:
- Extension registry API changes
- Dashboard component refactors
- Schema/API changes in `dashboards/`
- Python dependency changes

#### 1.2 Clean your working tree

```bash
git status  # must be clean
git stash   # if needed
```

#### 1.3 (Optional) Squash PTM commits first

If you have many incremental commits (50+), squashing into logical groups
makes the rebase much easier — fewer commits means fewer potential conflicts.

```bash
# Preview what would be squashed (no changes made)
./scripts/ptm/squash-ptm-commits.sh --dry-run

# Create a squashed branch (original untouched)
./scripts/ptm/squash-ptm-commits.sh

# Use the squashed branch for syncing
git checkout squashed/upgrade-6.0-YYYYMMDD
```

The squash script groups commits into:
1. Extension system & core integration
2. PTM frontend (`src/ptm/`)
3. PTM backend (`extensions/portal/`)
4. PTM chart plugins
5. Dashboard enhancements
6. UI/component updates
7. Config/Docker/infrastructure
8. Other changes

### Phase 2: Sync

#### 2.1 Run the sync script

```bash
# Rebase (default, recommended)
./scripts/ptm/sync-upstream.sh 6.1.0

# Or merge (if you prefer merge commits)
./scripts/ptm/sync-upstream.sh 6.1.0 --merge

# Or sync to latest master (for testing, not recommended for production)
./scripts/ptm/sync-upstream.sh apache/master
```

The script will:
1. Fetch upstream with tags
2. Create a backup branch (`backup/upgrade-6.0-pre-sync-YYYYMMDD`)
3. Create a refresh branch (`refresh/apache-master-YYYYMMDD`)
4. Rebase/merge your PTM commits onto the target

#### 2.2 Resolve conflicts

When conflicts occur during rebase, the script will pause and guide you.

**Priority order for conflict resolution:**

1. **PTM-isolated files** (`src/ptm/`, `extensions/portal/`, `plugins/*-ptm/`):
   These should NEVER conflict with upstream. If they do, always keep ours:
   ```bash
   git checkout --ours superset-frontend/src/ptm/
   git checkout --ours superset/extensions/portal/
   git add superset-frontend/src/ptm/ superset/extensions/portal/
   ```

2. **Core integration points** (the ~5 touchpoints):
   These ARE expected to conflict. Resolve manually:

   | File | What to preserve |
   |------|-----------------|
   | `setupExtensions.ts` | The `applyPTMExtensions()` call + import |
   | `initialization/__init__.py` | The `register_dashboard_extension_fields()` call |
   | `dashboards/schemas.py` | PTM conditional metadata fields |
   | `dashboards/api.py` | PTM endpoint imports |
   | `daos/dashboard.py` | PTM metadata handling |

   For each: accept upstream changes first, then re-add the PTM lines.

3. **Extension registry** (`ExtensionsRegistry.ts`, `types.ts`):
   Accept upstream, verify PTM keys still exist.

4. **Everything else** (components, plugins, configs):
   Accept upstream version, verify PTM functionality isn't broken.

**Conflict resolution loop:**
```bash
# See what's conflicted
git status

# Edit the file, resolve <<<< ==== >>>> markers

# Mark as resolved
git add <file>

# Continue to next commit
git rebase --continue

# If a commit is no longer needed (fully resolved by upstream):
git rebase --skip
```

### Phase 3: Verify

#### 3.1 Check touchpoints

```bash
./scripts/ptm/verify-touchpoints.sh
```

This checks all PTM integration points and reports pass/fail/warn for each.

#### 3.2 Validate build

```bash
# Quick check (TS + lint, ~2-3 min)
./scripts/ptm/validate-build.sh --quick

# Full check (build + backend + tests, ~10-15 min)
./scripts/ptm/validate-build.sh --full
```

### Phase 4: Test

#### 4.1 Test with PTM enabled

```bash
# Copy the override file if not present
cp docker-compose.override.yml.example docker-compose.override.yml

# Start with PTM
PTM_EXTENSION_ENABLED=true docker compose up

# Run through SMOKE_TESTS.md checklist
```

#### 4.2 Test with PTM disabled

```bash
# Disable PTM
PTM_EXTENSION_ENABLED=false docker compose up

# Verify vanilla Superset behavior (no PTM elements visible)
```

#### 4.3 Regression checklist

See [SMOKE_TESTS.md](SMOKE_TESTS.md) for the full checklist.

### Phase 5: Finalize

```bash
# Push the new branch
git push origin upgrade/6.1

# Update PATCH_INDEX.md if touchpoints changed
# Update this guide if process changed
# Tag if this becomes the new production base
git tag ptm-6.1.0 && git push origin ptm-6.1.0
```

---

## Strategies Compared

### Rebase (recommended)

```
upstream:  A---B---C---D---E  (v6.1.0)
                              \
PTM:                           P1'--P2'--P3'  (upgrade/6.1)
```

**Pros:** Clean linear history, easy to see what's PTM vs upstream.
**Cons:** Rewrites history (force-push needed), conflicts resolved per-commit.

### Merge

```
upstream:  A---B---C---D---E  (v6.1.0)
                \             \
PTM:             P1--P2--P3----M  (upgrade/6.1)
```

**Pros:** Preserves full history, single conflict resolution.
**Cons:** Messy history over multiple syncs, harder to identify PTM changes.

### Recommendation

Use **rebase** for planned version upgrades (e.g., 6.0 → 6.1).
Use **merge** for quick hotfix syncs where history preservation matters.

---

## Troubleshooting

### "Too many conflicts during rebase"

Squash first, then rebase:
```bash
./scripts/ptm/squash-ptm-commits.sh
git checkout squashed/upgrade-6.0-YYYYMMDD
./scripts/ptm/sync-upstream.sh 6.1.0
```

### "I need to abort and start over"

```bash
git rebase --abort                    # abort in-progress rebase
git checkout upgrade/6.0              # go back to original
git branch -D upgrade/6.1             # delete failed attempt
# Your backup is at: backup/upgrade-6.0-pre-sync-YYYYMMDD
```

### "PTM extensions don't load after sync"

1. Check `setupExtensions.ts` still calls `applyPTMExtensions()`
2. Check `PTM_EXTENSION_ENABLED` is `true` in your config
3. Check browser console for import errors from `src/ptm/`
4. Run `./scripts/ptm/verify-touchpoints.sh`

### "Backend 500 errors after sync"

1. Check `initialization/__init__.py` still imports portal
2. Run database migrations: `superset db upgrade`
3. Check for changed import paths in `superset/dashboards/`

### "TypeScript errors after sync"

Common causes:
- Upstream renamed types/interfaces → update imports in `src/ptm/`
- Upstream changed component props → update adapters in `src/ptm/components/`
- New strict checks → fix in PTM code

```bash
npx tsc --noEmit 2>&1 | grep "src/ptm"  # PTM-specific errors
npx tsc --noEmit 2>&1 | head -50        # all errors
```

---

## Maintenance Schedule

| Frequency | Action |
|-----------|--------|
| Weekly | `git fetch apache --tags` — stay aware |
| Per upstream release | Full sync process (this guide) |
| Before each sync | Review UPDATING.md and CHANGELOG |
| After each sync | Update PATCH_INDEX.md if touchpoints changed |
| Quarterly | Review if PTM patches can be upstreamed |

---

## Scripts Reference

| Script | Purpose |
|--------|---------|
| `scripts/ptm/sync-upstream.sh <ref>` | Main sync orchestrator |
| `scripts/ptm/squash-ptm-commits.sh` | Squash commits into logical groups |
| `scripts/ptm/verify-touchpoints.sh` | Check all PTM integration points |
| `scripts/ptm/validate-build.sh` | Build and test validation |

All scripts are in `scripts/ptm/` and are self-documented with `--help` or header comments.
