# Private Repo Separation Plan

> **Created:** 2026-08-24  
> **Purpose:** Step-by-step instructions for moving private planning documents out of the public `redfire-forge` repo into a separate private GitHub repository, while maintaining full version history and a seamless VS Code workspace.

---

## Status

| Step | Task | Status |
|------|------|--------|
| 1 | Create private GitHub repo | `TODO` |
| 2 | Initialize local private repo folder | `TODO` |
| 3 | Copy private content into private repo | `TODO` |
| 4 | First commit + push private repo | `TODO` |
| 5 | Add private paths to public `.gitignore` | `TODO` |
| 6 | Remove private paths from public git tracking | `TODO` |
| 7 | Commit the `.gitignore` change to public repo | `TODO` |
| 8 | Create VS Code multi-root workspace file | `TODO` |
| 9 | Verify both repos open correctly in VS Code | `TODO` |

---

## What Goes Where

### Private repo (`redfireforge-private`)

| Path in public repo | Move to private repo as |
|---------------------|------------------------|
| `docs/plan/` | `docs-plan/` |
| `.cursor/` | `.cursor/` |
| `REFACTORING_PLAN.md` | `REFACTORING_PLAN.md` |
| `RESTRUCTURING_PLAN.md` | `RESTRUCTURING_PLAN.md` |
| `ROADMAP.md` | `ROADMAP.md` |
| `SCENARIOS_TAB_ENHANCEMENTS.md` | `SCENARIOS_TAB_ENHANCEMENTS.md` |
| `RELEASE.md`, `RELEASE.archive.md` | `RELEASE.md`, `RELEASE.archive.md` |
| `CHANGELOG.archive.md` | `CHANGELOG.archive.md` |
| `harness-fg-snapshot.yml` | `harness-fg-snapshot.yml` |
| `results-dropdown.yml` | `results-dropdown.yml` |
| `runner-results.yml` | `runner-results.yml` |
| `plan/` (root level) | `plan/` |
| `training-ppt/` | `training-ppt/` |
| `coverage-analysis/` | `coverage-analysis/` |

### Stays in public repo (`redfire-forge`)

| Path | Reason |
|------|--------|
| `src/`, `src-server/`, `src-tauri/` | All source code |
| `cli/` | CLI source + tests |
| `packages/` | Shared packages |
| `docs/training-manuals/` | User-facing content |
| `e2e/` | Test suite |
| `scripts/` | Build scripts |
| `README.md` | Public facing |
| `CHANGELOG.md` | User-facing release notes |
| `CONTRIBUTING.md` | Contributor guide |
| `LICENSE` | Required public |
| `.github/` | CI, templates, Dependabot |
| `package.json`, `tsconfig*.json`, `vite.config.ts` | Build config |

---

## Step-by-Step Instructions

### Step 1: Create the private GitHub repo

1. Go to https://github.com/new
2. Repository name: `redfireforge-private`
3. Visibility: **Private**
4. Do NOT initialize with README, .gitignore, or license
5. Click **Create repository**
6. Copy the SSH clone URL: `git@github.com:your-username/redfireforge-private.git`

---

### Step 2: Initialize the local private repo folder

```bash
cd /Users/dz5jxr/workspace/gmai
mkdir redfireforge-private
cd redfireforge-private
git init
git remote add origin git@github.com:your-username/redfireforge-private.git
```

---

### Step 3: Copy private content into the private repo

Run from your workspace root (`/Users/dz5jxr/workspace/gmai`):

```bash
PUBLIC=./redfire-forge
PRIVATE=./redfireforge-private

# Planning docs
cp -r "$PUBLIC/docs/plan" "$PRIVATE/docs-plan"

# Cursor AI rules and skills
cp -r "$PUBLIC/.cursor" "$PRIVATE/.cursor"

# Root-level planning markdown files
cp "$PUBLIC/REFACTORING_PLAN.md"        "$PRIVATE/"
cp "$PUBLIC/RESTRUCTURING_PLAN.md"      "$PRIVATE/"
cp "$PUBLIC/ROADMAP.md"                 "$PRIVATE/"
cp "$PUBLIC/SCENARIOS_TAB_ENHANCEMENTS.md" "$PRIVATE/"
cp "$PUBLIC/RELEASE.md"                 "$PRIVATE/"
cp "$PUBLIC/RELEASE.archive.md"         "$PRIVATE/"
cp "$PUBLIC/CHANGELOG.archive.md"       "$PRIVATE/"

# Test harness snapshots / runner results (internal)
cp "$PUBLIC/harness-fg-snapshot.yml"    "$PRIVATE/"
cp "$PUBLIC/results-dropdown.yml"       "$PRIVATE/"
cp "$PUBLIC/runner-results.yml"         "$PRIVATE/"

# Other internal folders
cp -r "$PUBLIC/plan"            "$PRIVATE/plan"
cp -r "$PUBLIC/training-ppt"    "$PRIVATE/training-ppt"
cp -r "$PUBLIC/coverage-analysis" "$PRIVATE/coverage-analysis"
```

---

### Step 4: First commit and push the private repo

```bash
cd /Users/dz5jxr/workspace/gmai/redfireforge-private

git add .
git commit -m "chore: initial import of private planning documents from redfire-forge"
git push -u origin main
```

Verify on GitHub that the private repo is populated correctly before proceeding.

---

### Step 5: Add private paths to the public `.gitignore`

Open `/Users/dz5jxr/workspace/gmai/redfire-forge/.gitignore` and add this block at the bottom:

```
# ── Private: maintained in redfireforge-private repo ─────────────────────────
docs/plan/
.cursor/
REFACTORING_PLAN.md
RESTRUCTURING_PLAN.md
ROADMAP.md
SCENARIOS_TAB_ENHANCEMENTS.md
RELEASE.md
RELEASE.archive.md
CHANGELOG.archive.md
harness-fg-snapshot.yml
results-dropdown.yml
runner-results.yml
plan/
training-ppt/
coverage-analysis/
```

---

### Step 6: Remove private paths from public git tracking

This removes the files from git's index (stops tracking them) WITHOUT deleting them from disk:

```bash
cd /Users/dz5jxr/workspace/gmai/redfire-forge

git rm -r --cached \
  docs/plan/ \
  .cursor/ \
  REFACTORING_PLAN.md \
  RESTRUCTURING_PLAN.md \
  ROADMAP.md \
  SCENARIOS_TAB_ENHANCEMENTS.md \
  RELEASE.md \
  RELEASE.archive.md \
  CHANGELOG.archive.md \
  harness-fg-snapshot.yml \
  results-dropdown.yml \
  runner-results.yml \
  plan/ \
  training-ppt/ \
  coverage-analysis/
```

After running this, `git status` should show all those files as "deleted" (from git tracking). They still exist on your disk.

---

### Step 7: Commit the `.gitignore` change to the public repo

```bash
cd /Users/dz5jxr/workspace/gmai/redfire-forge

git add .gitignore
git commit -m "chore: exclude private planning docs from public repo

Sensitive planning documents, roadmap, competitor analysis, and internal
.cursor rules are now maintained in the private redfireforge-private repo."

git push
```

---

### Step 8: Create the VS Code multi-root workspace file

```bash
cat > /Users/dz5jxr/workspace/gmai/redfireforge.code-workspace << 'EOF'
{
  "folders": [
    {
      "name": "RedfireForge (public)",
      "path": "./redfire-forge"
    },
    {
      "name": "RedfireForge (private)",
      "path": "./redfireforge-private"
    }
  ],
  "settings": {
    "files.exclude": {}
  }
}
EOF
```

---

### Step 9: Open and verify the workspace

```bash
code /Users/dz5jxr/workspace/gmai/redfireforge.code-workspace
```

In VS Code Explorer you should see two root folders:
- `RedfireForge (public)` — source code, no plan docs
- `RedfireForge (private)` — all planning documents, `.cursor/`

Verify `.cursor/` rules still load correctly (Copilot/Cursor reads from the workspace root of the active file's repo).

---

## Day-to-Day Workflow After Setup

### Working on source code (public)
```bash
cd /Users/dz5jxr/workspace/gmai/redfire-forge
# normal git workflow: feature branch → commit → push
```

### Working on planning docs (private)
```bash
cd /Users/dz5jxr/workspace/gmai/redfireforge-private
git add docs-plan/
git commit -m "plan: update before-launching plan with L-24 domain setup"
git push
```

### Syncing .cursor rules across machines
The `.cursor/` folder is now version-controlled in the private repo. On a new machine:
```bash
git clone git@github.com:your-username/redfireforge-private.git
# Then symlink .cursor into the public repo working directory if needed:
ln -s /path/to/redfireforge-private/.cursor /path/to/redfire-forge/.cursor
```

---

## Verification Checklist

After completing all steps, verify:

- [ ] `redfireforge-private` repo is visible on GitHub as Private
- [ ] All plan docs are present in `redfireforge-private/docs-plan/`
- [ ] `.cursor/` is present in `redfireforge-private/.cursor/`
- [ ] Public `redfire-forge` repo: `git status` shows none of the private files
- [ ] Public `redfire-forge` repo: `git log --oneline -3` shows the gitignore commit
- [ ] Files still exist on disk (not deleted): `ls docs/plan/` returns files
- [ ] VS Code workspace file opens both repos side by side
- [ ] GitHub: visiting `github.com/your-username/redfire-forge` shows no plan docs in the file tree
- [ ] GitHub: `docs/plan/` is absent from the public repo file browser
