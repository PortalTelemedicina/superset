<!--
Licensed to the Apache Software Foundation (ASF) under one
or more contributor license agreements.  See the NOTICE file
distributed with this work for additional information
regarding copyright ownership.  The ASF licenses this file
to you under the Apache License, Version 2.0 (the
"License"); you may not use this file except in compliance
with the License.  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing,
software distributed under the License is distributed on an
"AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, either express or implied.  See the License for the
specific language governing permissions and limitations
under the License.
-->

# PTM Superset — Upstream Sync Guide

Complete runbook for syncing the PTM fork with upstream Apache Superset.

---

## Overview

| Item | Value |
|------|-------|
| Fork | `PortalTelemedicina/superset` |
| Upstream | `apache/superset` (remote: `upstream`) |
| PTM branch | `upgrade/6.1` (or latest `upgrade/*`) |
| Strategy | Per-area port onto the upstream tag (version upgrades) or merge |
| PTM isolation | `src/ptm/`, `superset/extensions/portal/`, `plugins/*-ptm/` |
| Core touchpoints | ~5 files (see PATCH_INDEX.md) |

---

## Prerequisites

```bash
# Verify upstream remote
git remote -v
# Should show:
#   upstream  https://github.com/apache/superset.git (fetch)
#   origin    https://github.com/PortalTelemedicina/superset.git (fetch)

# If missing, add it:
git remote add upstream https://github.com/apache/superset.git
```

---

## Quick Sync (TL;DR)

```bash
# 1. Version upgrade: port by area (see "Version upgrade by per-area port").
#    Quick merge sync of a tag:
./scripts/ptm/sync-upstream.sh 6.1.0 --merge

# 2. If conflicts occur, resolve them and commit:
#    git add <resolved-file> && git commit

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
git fetch upstream --tags
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
makes the merge easier — fewer commits means fewer potential conflicts.

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
# Strategy is mandatory
./scripts/ptm/sync-upstream.sh 6.1.0 --merge

# Sync to latest master (for testing, not recommended for production)
./scripts/ptm/sync-upstream.sh upstream/master --merge

# --rebase only runs with PTM_ALLOW_REBASE=1 (rewrites history, needs force-push)
```

For version upgrades prefer the per-area port (see "Version upgrade by
per-area port" below) over this script.

The script will:
1. Fetch upstream with tags
2. Create a backup branch (`backup/upgrade-6.0-pre-sync-YYYYMMDD`)
3. Create a refresh branch (`refresh/upstream-master-YYYYMMDD`)
4. Merge the target into your branch (or rebase, if explicitly allowed)

#### 2.2 Resolve conflicts

When conflicts occur, the script will pause and guide you.

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
   | `setupCodeOverrides.ts` | The `applyPTMExtensions()` call + import |
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

# Conclude the merge
git commit   # (merge) ; with an explicitly allowed rebase: git rebase --continue

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

### Per-area port (recommended for version upgrades)

See "Version upgrade by per-area port" below. `upgrade/6.x` starts from the
upstream tag and PTM code is ported area by area. No history rewrite, no
force-push, and the previous `upgrade/*` branch stays as reference.

### Rebase (blocked by default)

**Cons:** Rewrites history (force-push needed), conflicts resolved per-commit.
`sync-upstream.sh --rebase` only runs with `PTM_ALLOW_REBASE=1`.

### Merge

```
upstream:  A---B---C---D---E  (v6.1.0)
                \             \
PTM:             P1--P2--P3----M  (upgrade/6.1)
```

**Pros:** Preserves full history, single conflict resolution.
**Cons:** Messy history over multiple syncs, harder to identify PTM changes.

### Recommendation

Use the **per-area port** for planned version upgrades (e.g., 6.0 → 6.1).
Use **merge** for quick syncs where history preservation matters.

## Version upgrade by per-area port

Procedure used in the 6.0 → 6.1 upgrade.

1. `git fetch upstream --tags`, then create `upgrade/6.x` from the new upstream
   tag (`git switch -c upgrade/6.1 v6.1.0`). Previous `upgrade/*` branches stay
   untouched as reference.
2. Port PTM code one commit per area, from lowest to highest risk:
   1. Isolated code: `superset-frontend/src/ptm`, `superset/extensions/portal`,
      `superset-frontend/plugins/*-ptm`.
   2. Backend touchpoints: `superset/initialization/__init__.py`,
      `superset/dashboards/schemas.py`, `superset/dashboards/api.py`,
      `superset/daos/dashboard.py`, `superset/viz.py`,
      `superset/commands/report/execute.py`, `superset/config.py`,
      `superset/security/manager.py`.
   3. Frontend touchpoints: `setupCodeOverrides.ts` (formerly
      `setupExtensions`), theme/i18n imports (changed upstream), and the
      dashboard files, now TypeScript: `actions/dashboardState.ts`,
      `components/Dashboard.tsx`, `components/Header/index.tsx`,
      `components/gridComponents/Chart/Chart.tsx`. The `.jsx`/`.js` paths in
      older docs and branches no longer exist.
   4. Dockerfile/Playwright, compose override, pt_BR translations.
3. For each touchpoint file, a 3-way merge helps: base = previous upstream tag,
   ours = file on the old `upgrade/*` branch, theirs = file on the new tag
   (`git merge-file`, see Troubleshooting).
4. Dependencies are never resolved by hand: recompile with
   `scripts/uv-pip-compile.sh` (runs in Docker).
5. Run `verify-touchpoints.sh` and `validate-build.sh`, then the smoke tests.

---

## Troubleshooting

### "Too many conflicts in a file"

Do a 3-way merge of that file only, with the previous upstream tag as base:
```bash
git show v6.0.0:<path> > /tmp/base
git show upgrade/6.0:<path> > /tmp/ours
git show v6.1.0:<path> > /tmp/theirs
git merge-file -p /tmp/ours /tmp/base /tmp/theirs > <path>
```

### "I need to abort and start over"

`upgrade/6.0` is never touched, so just drop the new branch:
```bash
git checkout upgrade/6.0
git branch -D upgrade/6.1             # delete failed attempt
```

### "PTM extensions don't load after sync"

1. Check `setupCodeOverrides.ts` still calls `applyPTMExtensions()`
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
| Weekly | `git fetch upstream --tags` — stay aware |
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
