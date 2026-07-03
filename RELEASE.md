# Release Process (Active)

This file is the concise operational release guide.

For full historical wording and legacy examples, see:
- RELEASE.archive.md

---

## Branch Model

- `feature/*` -> merge into `develop`
- `release/*` -> release stabilization branch
- `master` -> stable releases

---

## Standard Flow

### 1) Feature to Develop

```bash
git checkout develop
git checkout -b feature/my-feature
# implement
git add -A
git commit -m "feat: ..."
git checkout develop
git merge feature/my-feature
```

### 2) Alpha on Develop

```bash
./scripts/version.sh minor --pre 1
# or set explicit:
./scripts/version.sh set X.Y.Z --pre N
```

Commit updated version files.

### 3) Beta on Release Branch

```bash
git checkout develop
git checkout -b release/X.Y.Z
./scripts/version.sh set X.Y.Z --pre 1
npx tauri build
```

Iterate fixes on release branch, bump beta number each cycle.

### 4) Stable Release

```bash
git checkout master
git merge release/X.Y.Z
./scripts/version.sh set X.Y.Z
git tag vX.Y.Z
npx tauri build
```

Back-merge:

```bash
git checkout develop
git merge master
```

### 5) Hotfix

```bash
git checkout master
git checkout -b hotfix/critical-fix
# implement
./scripts/version.sh patch
git checkout master
git merge hotfix/critical-fix
git tag vX.Y.Z
npx tauri build
git checkout develop
git merge master
```

---

## Version Script Quick Reference

```bash
./scripts/version.sh
./scripts/version.sh major
./scripts/version.sh minor
./scripts/version.sh patch
./scripts/version.sh set X.Y.Z
./scripts/version.sh set X.Y.Z --pre N
```

Updated files:
- `package.json`
- `src-tauri/tauri.conf.json`
- `src-tauri/Cargo.toml`
- `src-tauri/Cargo.lock`

---

## Minimal Release Checklist

- Feature merged to `develop`
- Pre-release version bumped
- Release branch created and stabilized
- Stable version set on `master`
- Tag created (`vX.Y.Z`)
- Build artifacts produced
- `master` back-merged to `develop`

---

## Current Migration Guardrails

- gRPC describe payloads use `protoRoots` for proto file ingest.
- `/api/grpc/describe` enforces proto roots contract validation for `source=proto_files`.
- `GET /api/grpc/describe/usage` telemetry tracks source-level usage for regression visibility.

## Current CI Guardrails

- Phase 13B fixture-backed reliability gate is promoted in CI via `.github/workflows/ci.yml` job `grpc-phase13b-slo`.
- Canonical local/CI orchestration command: `npm run grpc:phase13b:ci`.
- The orchestration script enforces proxy bypass for localhost health/readiness probes (`curl --noproxy '*'`) to avoid false 504 failures from host proxy interception.
- CI run should upload `artifacts/grpc-phase13b-baseline.ci.json` for baseline diagnostics.
