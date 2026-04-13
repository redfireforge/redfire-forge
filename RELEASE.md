# RedfireForge — Release Process

## Branch Overview

```
master              ← stable releases      (v1.0.0)
  └─ release/*      ← release candidates   (v1.0.0-beta.N)
  └─ develop        ← integration branch   (v1.0.0-alpha.N)
       └─ feature/* ← feature work         (merge into develop)
```

---

## 1. Develop a Feature

```bash
# Create a feature branch from develop
git checkout develop
git checkout -b feature/my-feature

# ... work on the feature ...
git add -A
git commit -m "feat: add my feature"
```

---

## 2. Merge Feature into Develop

```bash
git checkout develop
git merge feature/my-feature

# Bump alpha version
./scripts/version.sh minor --pre 1       # → 0.3.0-alpha.1
git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml src-tauri/Cargo.lock
git commit -m "chore: bump version to 0.3.0-alpha.1"
git status   # verify clean working tree
```

For subsequent alpha builds on the same cycle:

```bash
./scripts/version.sh set 0.3.0 --pre 2   # → 0.3.0-alpha.2
```

---

## 3. Create a Beta Release

```bash
# Create release branch from develop
git checkout develop
git checkout -b release/0.3.0

# Bump to beta
./scripts/version.sh set 0.3.0 --pre 1   # → 0.3.0-beta.1
git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml src-tauri/Cargo.lock
git commit -m "chore: bump version to 0.3.0-beta.1"
git status   # verify clean working tree

# Build the desktop app
npx tauri build
```

**Output:**
- `src-tauri/target/release/bundle/macos/RedfireForge.app`
- `src-tauri/target/release/bundle/dmg/RedfireForge_0.3.0-beta.1_aarch64.dmg`

Share the `.dmg` with coworkers for testing.

### Fix bugs during beta

```bash
# Stay on release/0.3.0
# ... fix bugs ...
git add -A
git commit -m "fix: resolve issue X"

# Bump beta number
./scripts/version.sh set 0.3.0 --pre 2   # → 0.3.0-beta.2
git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml src-tauri/Cargo.lock
git commit -m "chore: bump version to 0.3.0-beta.2"
git status   # verify clean working tree

npx tauri build
```

---

## 4. Stable Release

Once the beta is tested and approved:

```bash
# Merge release into master
git checkout master
git merge release/0.3.0

# Set stable version
./scripts/version.sh set 0.3.0
git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml src-tauri/Cargo.lock
git commit -m "chore: release v0.3.0"
git status   # verify clean working tree

# Tag it
git tag v0.3.0

# Build the final release
npx tauri build
```

**Output:**
- `src-tauri/target/release/bundle/dmg/RedfireForge_0.3.0_aarch64.dmg`

### Back-merge into develop

```bash
git checkout develop
git merge master
```

---

## 5. Hotfix (Urgent Production Fix)

```bash
# Branch from master
git checkout master
git checkout -b hotfix/critical-fix

# ... fix the issue ...
git add -A
git commit -m "fix: critical issue"

# Bump patch version
./scripts/version.sh patch               # → 0.3.1
git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml src-tauri/Cargo.lock
git commit -m "chore: release v0.3.1"
git status   # verify clean working tree

# Merge into master and tag
git checkout master
git merge hotfix/critical-fix
git tag v0.3.1

npx tauri build

# Back-merge into develop
git checkout develop
git merge master
```

---

## Version Script Reference

```bash
# Show current version and branch
./scripts/version.sh

# Bump commands (auto-tags based on branch)
./scripts/version.sh major               # 0.3.0 → 1.0.0
./scripts/version.sh minor               # 0.3.0 → 0.4.0
./scripts/version.sh patch               # 0.3.0 → 0.3.1

# Set explicit version
./scripts/version.sh set 0.3.0           # exact version (stable on master)
./scripts/version.sh set 0.3.0 --pre 1   # with pre-release (alpha/beta/dev based on branch)

# Pre-release tag is determined by branch:
#   master       → (none)     → 0.3.0
#   release/*    → beta       → 0.3.0-beta.1
#   develop      → alpha      → 0.3.0-alpha.1
#   feature/*    → dev        → 0.3.0-dev.1
```

Files updated by the script:
- `package.json`
- `src-tauri/tauri.conf.json`
- `src-tauri/Cargo.toml`
- `src-tauri/Cargo.lock` (auto-updated by build; **always commit this too**)

---

## Build Outputs

| Platform | Command | Artifacts |
|---|---|---|
| macOS (local) | `npx tauri build` | `.app`, `.dmg` in `src-tauri/target/release/bundle/` |
| All platforms (CI) | Push a tag `v*` | GitHub Actions builds macOS, Linux, Windows |

---

## Quick Checklist

- [ ] Feature merged into `develop`
- [ ] Alpha version bumped on `develop`
- [ ] Release branch created (`release/X.Y.Z`)
- [ ] Beta version bumped on release branch
- [ ] Beta build shared and tested
- [ ] Release branch merged into `master`
- [ ] Stable version set on `master`
- [ ] Git tag created (`vX.Y.Z`)
- [ ] Final build created
- [ ] `master` back-merged into `develop`
