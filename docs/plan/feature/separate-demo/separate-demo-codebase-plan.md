# Separate Demo Codebase Plan

> **Path:** `docs/plan/feature/separate-demo/separate-demo-codebase-plan.md`  
> **Branch:** `feature/separate-demo-codebase`  
> **Status:** Phase 1 ✅ · Phase 2 ✅ · Phase 3 ✅ · Phase 4 ✅ · Phase 5 ✅ · Phase 6 ✅ · Phase 7 ✅  
> **Last updated:** 2026-06-24

---

## Goal

Ship **RedfireForge production builds without demo lessons**, while keeping demo work in the same monorepo on a **separate quality gate**. Production releases must not be blocked by demo bugs, demo unit tests, or demo E2E suites.

Users download one of two desktop artifacts:

| Track | Artifact | Audience |
|-------|----------|----------|
| **Production** | `RedfireForge_X.Y.Z_<arch>.dmg` | Performance testers, daily work |
| **Learning Hub** | `RedfireForge_X.Y.Z-Demo_<arch>.dmg` | Onboarding, tutorials, training |

Both share one Rust/Tauri backend and one frontend codebase. Separation is achieved through **build flags**, **test project splits**, and **CI job boundaries** — not a second repository.

---

## Problem Statement

Demo work is expensive and fragile:

1. **Time** — Lessons require DOM selectors, timing, Docker stacks, and visual polish; each lesson spans many steps.
2. **Coupling** — Fixing a demo step often touches GraphQL Studio, Workflow Designer, Kafka Studio, and app shell bridges — not just `demo-player/`.
3. **Test blast radius** — ~90 unit test files under `demo-player/` run in the same `vitest run --coverage` gate as product code. Demo E2E (26+ specs, 10–15 min each for GraphQL lessons) can block merges.
4. **Release pressure** — Product features ready for `release/*` should not wait for GQL-19 step 11 or a flaky demo walk-through.

---

## What This Plan Delivers

| Deliverable | Outcome |
|-------------|---------|
| Build flag `VITE_ENABLE_DEMO_HUB` | Slim prod bundle; demo chunk tree-shaken out |
| Dual Tauri configs | Two installable apps (different bundle IDs) |
| Vitest `product` / `demo` projects | Prod PRs run product tests only |
| CI gate split | Prod merge ≠ demo merge requirements |
| Demo adapter layer | Lessons stop reaching into product internals |
| Documented dev workflow | Clear rules for which tests to run when |

---

## What This Plan Does **Not** Fix Automatically

Demo lessons **drive real product UI**. Shared surface area remains:

- `src/features/graphql/utils/gqlDemoWorkspace.ts` — demo tab lifecycle in GraphQL Studio
- `demoLessonId` field on GraphQL studio tabs
- App bridge hooks (`useDemoWorkflowBridge`, etc.)
- `data-testid` selectors in product components used by lessons

Build/test separation **unblocks releases**. The adapter layer (Phase 5) **reduces** cross-touching over time.

---

## Current State Inventory

### Demo source tree

| Location | Scale | Notes |
|----------|-------|-------|
| `src/features/demo-player/` | ~196 files, ~3.9 MB source | Lessons, hub UI, progress, spotlight |
| `src/styles/demo-player.css`, `demo-hub.css` | 2 files | Loaded unconditionally in `App.tsx` today |
| `src/app/hooks/useDemo*.ts` | 7 bridge hooks + 7 test files | Always mounted in `App.tsx` |
| `src/features/graphql/utils/gqlDemoWorkspace.ts` | 1 module + tests | Product code with demo-specific paths |
| `src/shared/selectors/gql.ts`, `wf.ts` | Partial | Demo `data-testid` constants |

### Unit tests (Vitest)

| Bucket | Count | CI today |
|--------|-------|----------|
| `src/features/demo-player/**/*.test.*` | ~90 files | Runs in `vitest run --coverage` |
| App demo bridge tests | ~8 files | Same gate |
| Product tests | Rest of `src/**/*.test.*` | Same gate |

Coverage config already excludes thin lesson wrapper files (`graphql-*.ts`, `ws-*.ts`, etc.) but **not** demo-player core or lesson helper tests.

### E2E (Playwright)

| Bucket | Count | CI today |
|--------|-------|----------|
| `e2e/demo-*.spec.ts` | 26 specs | Excluded from default `chromium` project ✅ |
| Isolated demo projects | `demo-gql1` … `demo-gql19`, `demo-gql110`, `demo-stepthrough`, `demo-gql-lessons` | Manual / per-lesson npm scripts |
| **Prod CI demo job** | `e2e-gql5-docker` in `.github/workflows/ci.yml` | Runs on **every PR** ❌ |

Default `chromium` project already ignores demo specs — good foundation.

### Build / Tauri

| Item | Today |
|------|-------|
| Vite | Single `npm run build`; no feature flag |
| Tauri | Single `tauri.conf.json`; `beforeBuildCommand: npm run build` |
| Release workflow | 4 platforms × 1 variant |

---

## Target Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Single monorepo (develop)                    │
├────────────────────────────┬────────────────────────────────────┤
│     PRODUCTION TRACK       │         DEMO / LEARNING TRACK       │
├────────────────────────────┼────────────────────────────────────┤
│ VITE_ENABLE_DEMO_HUB=false │ VITE_ENABLE_DEMO_HUB=true          │
│ build:prod                 │ build:demo                          │
│ tauri.conf.json            │ tauri.conf.demo.json                │
│ com.redfireforge.desktop   │ com.redfireforge.desktop.demo       │
├────────────────────────────┼────────────────────────────────────┤
│ vitest --project product   │ vitest --project demo               │
│ playwright chromium+docker │ playwright demo-gql* + stepthrough  │
├────────────────────────────┼────────────────────────────────────┤
│ Required for develop merge │ Required for demo artifact release  │
│ Required for release/master│ Nightly / demo-branch optional      │
└────────────────────────────┴────────────────────────────────────┘
                              │
                    Shared: src-tauri (Rust), product features
```

---

## Implementation Phases

| Phase | Name | Priority | Effort | Depends on |
|-------|------|----------|--------|------------|
| 0 | Branch + plan baseline | — | Done | — |
| 1 | Vitest project split + coverage | **P0** | Done | — |
| 2 | CI gate split | **P0** | Done | Phase 1 |
| 3 | Build flag + app shell gating | **P1** | 2–3 days | — |
| 4 | Dual Tauri builds + release matrix | **P1** | 1–2 days | Phase 3 |
| 5 | Demo adapter layer refactor | **P2** | 3–5 days | Phase 3 |
| 6 | Docs + conventions update | **P2** | 0.5 day | Phases 1–4 |
| 7 | Optional: `packages/demo-hub` extraction | **P3** | Done | Phase 5 |

Phases 1–2 unblock production merges fastest. Phases 3–4 deliver user-facing dual downloads.

---

## Phase 1 — Vitest Project Split

**Priority: P0 | Effort: 1–2 days**

### 1.1 Add Vitest workspace projects

**Files:** `vitest.config.ts`, `vitest.projectPatterns.ts` (shared globs + classifiers)

**File:** `vitest.config.ts` (or `vitest.workspace.ts` if splitting configs)

```typescript
// Conceptual structure
projects: [
  {
    name: 'product',
    test: {
      include: ['src/**/*.test.{ts,tsx}', 'src-server/**/*.test.{ts,tsx}', 'cli/**/*.test.ts'],
      exclude: [
        'src/features/demo-player/**',
        'src/app/hooks/useDemo*.test.ts',
        'src/app/components/AppLiveDemoOverlay.test.tsx',
      ],
    },
  },
  {
    name: 'demo',
    test: {
      include: [
        'src/features/demo-player/**/*.test.{ts,tsx}',
        'src/app/hooks/useDemo*.test.ts',
        'src/app/components/AppLiveDemoOverlay.test.tsx',
      ],
    },
  },
]
```

**Edge case:** Tests outside `demo-player/` that import demo modules (e.g. `gqlDemoWorkspace.test.ts` in graphql) — classify as **product** (they test product behavior) unless they only make sense with demo hub enabled.

**Also in demo project:** all `src/app/hooks/useDemo*.test.ts` bridge tests (workflow, canvas, auth, sidebar, config modal, app environment cleanup).

### 1.2 Coverage scope for production gate

**Files:** `vitest.config.ts`, `scripts/product-coverage-filter.ts` (shared `isDemoCoveragePath` in `vitest.projectPatterns.ts`)

Vitest `coverage.exclude` lists demo paths, but product tests that import demo helpers (e.g. `SettingsStorageTab` → `gql-demo-storage-cleanup`) can still instrument demo sources. After `test:product:coverage`, `product-coverage-filter.ts` strips demo paths from the Istanbul map and writes `coverage/coverage-summary.product.json` for audit.

**File:** `vitest.config.ts` → `coverage.exclude`

Add:

```
src/features/demo-player/**
src/app/hooks/useDemo*.ts
src/styles/demo-player.css
src/styles/demo-hub.css
```

Keep existing lesson-wrapper exclusions; add comment pointing to `docs/plan/feature/separate-demo/separate-demo-codebase-plan.md`.

**Production merge target:** >90% on all four metrics for **product** code only.

**Demo track target (soft):** Best-effort; no hard gate on `develop` merge initially.

### 1.3 npm scripts

**File:** `package.json`

```json
{
  "test:product": "vitest run --project product",
  "test:demo": "vitest run --project demo",
  "test:product:coverage": "vitest run --project product --coverage",
  "test:demo:coverage": "vitest run --project demo --coverage"
}
```

Keep `"test": "vitest run"` running **both** projects for local full-suite runs until Phase 2 CI is stable, then consider defaulting `test` to product-only.

### 1.4 Acceptance criteria

- [x] `npx vitest run --project product` passes with zero demo-player tests collected
- [x] `npx vitest run --project demo` collects ~90+ demo tests (98 files / 3663 tests)
- [x] `test:product:coverage` strips demo-player via `product-coverage-filter.ts`
- [x] `npx tsc -b --noEmit` still passes (unchanged)
- [x] Pre-commit hook: unchanged (tsc + lint-staged only; no full test run)
- [x] Meta tests: `src/test-utils/vitestProjectSplit.test.ts`

### 1.5 Unit test checklist

| # | Test case |
|---|-----------|
| 1 | Product project excludes all files under `src/features/demo-player/` |
| 2 | Demo project includes `useDemoHub.test.ts` |
| 3 | Demo project includes `useDemoShortcuts.test.ts` |
| 4 | Product project still includes `gqlDemoWorkspace.test.ts` (product module) |
| 5 | Coverage report JSON has no `demo-player` paths in product run |

---

## Phase 2 — CI Gate Split

**Priority: P0 | Effort: 1 day**

### 2.1 Update `.github/workflows/ci.yml`

**Implemented:** `changes` job (`dorny/paths-filter@v3`) + split unit test jobs.

| Job | Change |
|-----|--------|
| `unit-tests` | Renamed → `unit-tests-product`; runs `npm run test:product:coverage` |
| **New** `unit-tests-demo` | Runs `npm run test:demo` when demo paths change |
| **New** `changes` | Path filter gates demo jobs |
| `e2e-gql5-docker` | Renamed → `e2e-demo-gql5`; runs only when demo paths change |
| `typecheck` | Uses `npx tsc -b --noEmit` (project references) |
| `build-frontend` | `npm run build:prod` |

### 2.2 Path filters (recommended)

Demo CI runs when PR touches:

```
src/features/demo-player/**
e2e/demo-**
e2e/demo-player-helpers.ts
e2e/graphql-lesson-smoke-helpers.ts
e2e/graphql-demo-workspace-helpers.ts
src/shared/selectors/**
```

Otherwise demo jobs are **skipped** (not failed) on product-only PRs.

### 2.3 Required checks for merge to `develop`

| Check | Required |
|-------|----------|
| TypeScript | ✅ |
| ESLint | ✅ |
| Unit tests (product) + coverage | ✅ |
| Frontend build (prod) | ✅ |
| E2E chromium (product) | On `release/*` only (existing policy) |
| Unit tests (demo) | ❌ Optional on `feature/*`; ✅ on demo-touched paths |
| Demo E2E | ❌ Never blocks `develop` |

### 2.4 New workflow: `demo-nightly.yml`

**Implemented:** `.github/workflows/demo-nightly.yml` — weekly Monday 06:00 UTC + `workflow_dispatch`.

```yaml
on:
  schedule:
    - cron: '0 6 * * 1'  # Weekly Monday 6 UTC
  workflow_dispatch:

jobs:
  demo-unit:
    run: npm run test:demo
  demo-e2e-smoke:
    run: npm run test:e2e:demo:gql-smoke  # graphql-lessons.spec.ts
  demo-e2e-gql5:
    run: npm run test:e2e:demo:gql5:ci
```

### 2.5 Acceptance criteria

- [x] Product PR with no demo file changes: demo jobs skipped via `changes` filter
- [x] Demo PR: demo unit + GQL-5 E2E jobs run when demo paths change
- [x] `e2e-gql5-docker` no longer runs unconditionally on every PR
- [ ] GitHub branch protection: rename required check `Unit Tests` → `Unit Tests (product)` (manual admin step)

---

## Phase 3 — Build Flag + App Shell Gating

**Priority: P1 | Effort: 2–3 days**

### 3.1 Environment files

**File:** `.env.production`

```
VITE_ENABLE_DEMO_HUB=false
```

**File:** `.env.production.demo`

```
VITE_ENABLE_DEMO_HUB=true
```

**File:** `.env.development` (unchanged — demo **on** for local dev)

```
VITE_ENABLE_DEMO_HUB=true
```

### 3.2 Compile-time constant

**File:** `vite.config.ts`

```typescript
define: {
  __APP_VERSION__: JSON.stringify(pkg.version),
  __ENABLE_DEMO_HUB__: JSON.stringify(process.env.VITE_ENABLE_DEMO_HUB === 'true'),
}
```

**File:** `src/vite-env.d.ts` (or `global.d.ts`)

```typescript
declare const __ENABLE_DEMO_HUB__: boolean;
```

**File:** `src/config/features.ts`

```typescript
export const DEMO_HUB_ENABLED = __ENABLE_DEMO_HUB__;
```

### 3.3 App shell changes

**File:** `src/app/App.tsx`

| Today | Target |
|-------|--------|
| Static `import DemoHub` | `lazy(() => import(...))` only when `DEMO_HUB_ENABLED` |
| Always `useDemoHub()` | Stub/no-op hook when disabled (see 3.4) |
| Always mount demo bridges | Guard with `DEMO_HUB_ENABLED` |
| Always import demo CSS | Dynamic import or conditional side-effect |

**Files to gate:**

- `src/app/components/AppActivityBar.tsx` — hide Demo Hub button
- `src/app/components/AppSubNav.tsx` — hide Learning Hub tab
- `src/app/components/AppShellOverlays.tsx` — skip `AppLiveDemoOverlay`
- `src/app/hooks/useDemoShortcuts.ts` — no-op when disabled
- `src/app/utils/appTabUtils.ts` — omit `demo-hub` from tab sets when disabled

### 3.4 No-op demo hub stub

**File:** `src/app/hooks/useDemoHubStub.ts` (new)

When demo is disabled, export a stub matching `useDemoHub` return shape with idle state so `App.tsx` type-checks without importing `demo-player`:

```typescript
export function useDemoHubStub() {
  return {
    state: { view: 'domains' as const, selectedLesson: null, stepIndex: 0, isPlaying: false, speed: 1 },
    exitLiveDemo: async () => {},
    // ... minimal surface used by App.tsx
  };
}
```

### 3.5 Tree-shaking verification

After `build:prod`:

```bash
# demo-player chunk should be absent or near-zero
ls -la dist/assets/ | grep -i demo || echo "OK: no demo chunk"
du -sh dist/
```

Compare `dist/` size: prod vs demo (expect demo larger by ~1–3 MB minified).

### 3.6 npm scripts

```json
{
  "build:prod": "tsc -b && vite build --mode production",
  "build:demo": "tsc -b && vite build --mode production.demo",
  "dev:prod-slim": "VITE_ENABLE_DEMO_HUB=false vite"
}
```

### 3.7 Product tests for slim build

| # | Test |
|---|------|
| 1 | When `DEMO_HUB_ENABLED` false, activity bar has no demo-hub button |
| 2 | `demo-hub` tab not in `ALL_TABS` when disabled |
| 3 | App renders without importing `DemoHub` module (mock `import.meta` in test if needed) |

Use Vitest `vi.stubEnv('VITE_ENABLE_DEMO_HUB', 'false')` + `vi.resetModules()` in dedicated test file.

### 3.8 Acceptance criteria

- [x] `npm run build:prod` succeeds; demo lazy chunks not referenced from main `index` bundle (orphan chunk files may remain on disk until Phase 5 decouples `gqlDemoWorkspace`)
- [x] `npm run dev:prod-slim` — no Learning Hub in UI; app usable for GraphQL/Workflow
- [x] `npm run build:demo` includes demo chunk references in main bundle
- [x] `npx tsc -b --noEmit` passes for both modes
- [x] Product unit tests pass under default (demo-enabled) dev config

---

## Phase 4 — Dual Tauri Builds + Release Matrix

**Priority: P1 | Effort: 1–2 days**

### 4.1 Demo Tauri config

**File:** `src-tauri/tauri.conf.demo.json`

```json
{
  "productName": "RedfireForge Learning Hub",
  "identifier": "com.redfireforge.desktop.demo",
  "build": {
    "beforeBuildCommand": "npm run build:demo"
  },
  "app": {
    "windows": [{
      "title": "RedfireForge Learning Hub — Redfire Performance Workbench"
    }]
  }
}
```

**File:** `src-tauri/tauri.conf.json` — update:

```json
{
  "build": {
    "beforeBuildCommand": "npm run build:prod"
  }
}
```

Build with: `npx tauri build --config src-tauri/tauri.conf.demo.json`

### 4.2 npm scripts

```json
{
  "tauri:build:prod": "npm run build:prod && tauri build",
  "tauri:build:demo": "npm run build:demo && tauri build --config src-tauri/tauri.conf.demo.json"
}
```

Local dev stays: `npm run tauri:dev` (demo enabled via `.env.development`).

### 4.3 Release workflow

**File:** `.github/workflows/release.yml`

Expand matrix:

```yaml
matrix:
  include:
    - platform: macos-latest
      target: aarch64-apple-darwin
      variant: standard
    - platform: macos-latest
      target: aarch64-apple-darwin
      variant: demo
    # ... repeat for x64, linux, windows
```

| Variant | Build command | Artifact suffix |
|---------|---------------|-----------------|
| `standard` | `tauri:build:prod` | default name |
| `demo` | `tauri:build:demo` | `-Demo` in release asset name |

**Tag strategy:**

- `v1.0.0` — production artifacts (required)
- `v1.0.0-demo` or manual `workflow_dispatch` input — demo artifacts (when demo track is green)

Demo release may trail prod by weeks — document in CHANGELOG.

### 4.4 Acceptance criteria

- [ ] Two `.app` bundles install side-by-side on macOS (different bundle IDs) — manual verify on release
- [x] Prod app build path: `build:prod` + `tauri.conf.json` (`com.redfireforge.desktop`)
- [x] Demo app build path: `build:demo` + `tauri.conf.demo.json` (`com.redfireforge.desktop.demo`)
- [ ] Both pass smoke: open GraphQL Studio, run one query — manual verify
- [x] CLI resource embedding unchanged (`../cli/dist/redfireforge.mjs`)

---

## Phase 5 — Demo Adapter Layer (Coupling Reduction)

**Priority: P2 | Effort: 3–5 days**

Goal: Lessons interact with product features through a **stable adapter API**, not direct product hook internals.

### 5.1 New module

**Directory:** `src/features/demo-player/adapters/`

```
adapters/
├── index.ts                 # Public adapter surface for lessons
├── graphqlStudioAdapter.ts  # Tab create/switch/endpoint/auth for GQL demos
├── workflowDesignerAdapter.ts
├── kafkaStudioAdapter.ts
├── websocketStudioAdapter.ts
├── environmentAdapter.ts
└── types.ts
```

### 5.2 Rules

1. **Lessons** import only from `adapters/` and `shared/selectors` — never from `features/graphql/hooks/*`.
2. **Adapters** dispatch custom events or call documented bridge functions (existing pattern in `useDemoWorkflowBridge`).
3. **Product features** expose minimal hooks/events; demo-specific logic stays in adapters or `demo-player/`.
4. New `data-testid` for lessons → add to `src/shared/selectors/*.ts` only.

### 5.3 Migrate high-churn areas first

| Area | Files to refactor |
|------|-------------------|
| GraphQL | `gql-demo-tab.ts`, `lesson14-multi-tab.ts`, `lesson6-auth-headers.ts` |
| Workflow | `wf-demo-helpers.ts`, `lesson11-workflow-integration.ts` |
| App bridges | Collapse into adapter registry loaded only when demo enabled |

### 5.4 Acceptance criteria

- [x] Zero lesson files import from `features/graphql/hooks/` (grep audit)
- [x] High-churn modules migrated to `adapters/` (gql-demo-tab, core, lessons 6/11/12/14/17–19, https-tls, wf-demo-helpers, kafka/ws runners, storage cleanup)
- [x] Adapter unit tests + `adaptersImportAudit.test.ts` (>90% on adapter logic files)
- [ ] GQL-1 validated visually Web + Tauri (manual — user)

---

## Phase 6 — Documentation + Conventions

**Priority: P2 | Effort: 0.5 day** — **Done**

Update:

| File | Content | Status |
|------|---------|--------|
| `.cursor/rules/project-conventions.mdc` | Dual-track build/test commands | [x] |
| `.cursor/rules/demo-player-lessons.mdc` | Adapter import rules (§8) | [x] |
| `README.md` | Download options: Standard vs Learning Hub | [x] |
| `CHANGELOG.md` | Dual-track + adapter layer entry | [x] |
| `docs/guides/demo-lesson-done-checklist.md` | `test:product` vs `test:demo` | [x] |
| `e2e/DEMO-LESSON-E2E-MEMO.md` | Demo E2E not required for prod merge | [x] |

---

## Phase 7 — Optional Package Extraction (Future)

**Priority: P3 | Effort: 1–2 weeks**

If adapter layer still causes too much coupling, extract:

```
packages/
  demo-hub/          # @redfireforge/demo-hub — lessons + hub UI
  app/               # main app imports demo-hub only in demo build
```

Requires Vite alias + conditional dependency. Defer until Phases 1–5 prove insufficient.

---

## Development Workflow (After Implementation)

### Daily commands

| Task | Command |
|------|---------|
| Normal feature dev | `npm run dev` (demo on) |
| Test prod code only | `npm run test:product` |
| Test demo lessons | `npm run test:demo` |
| QA slim build locally | `npm run dev:prod-slim` |
| Single GraphQL demo E2E | `npm run test:e2e:demo:gqlN` |
| Product E2E | `npx playwright test --project=chromium` |

### PR checklist

**Product PR (no demo files touched):**

1. `npx tsc -b --noEmit`
2. `npm run test:product:coverage` (>90%)
3. `npm run build:prod`
4. ESLint clean

**Demo PR (touches `demo-player/` or `e2e/demo-*`):**

1. All product checks above
2. `npm run test:demo`
3. Relevant `test:e2e:demo:gqlN` for modified lessons
4. Visual validation per `.cursor/rules/demo-player-lessons.mdc` §12

### Branch strategy

| Branch pattern | Purpose | Merge gate |
|----------------|---------|------------|
| `feature/*` | Product features | Product tests only |
| `feature/demo-*` | Demo lessons | Product + demo tests |
| `develop` | Integration | Product required; demo nightly |
| `release/*` | Beta | Product E2E + prod build |
| Demo artifact | Tag or manual workflow | Demo test matrix green |

---

## Shared Code Map (Coupling Hotspots)

These files will **remain shared** after separation. Changes here may require both test suites:

| File | Role |
|------|------|
| `src/app/App.tsx` | Demo hub mount + bridges |
| `src/features/graphql/utils/gqlDemoWorkspace.ts` | Demo tab prepare/restore |
| `src/features/graphql/hooks/useGqlStudioTabs.ts` | `demoLessonId` on tabs |
| `src/features/graphql/utils/tabPersistence.ts` | Persists demo tabs |
| `src/features/workflow/hooks/useWorkflowDesignerControllerPartB.ts` | Demo workflow bridge consumer |
| `src/shared/selectors/gql.ts`, `wf.ts` | Lesson selectors |
| `src/app/hooks/useDemoWorkflowBridge.ts` | CustomEvent bridge |
| `src/app/hooks/useDemoWorkflowCanvasBridge.ts` | Canvas bridge |
| `src/app/hooks/useDemoWorkflowConfigModalBridge.ts` | Config modal bridge |
| `src/app/hooks/useDemoGlobalAuthBridge.ts` | Auth snapshot bridge |
| `src/app/hooks/useDemoAppEnvironmentCleanupBridge.ts` | Env cleanup bridge |
| `src/app/hooks/useDemoSidebarBridge.ts` | Sidebar expand bridge |

**Policy:** Product behavior changes → product tests. Lesson flow changes → demo tests. Shared file changes → run both locally before merge.

---

## E2E Project Reference

Already configured in `playwright.config.ts`:

| Project | Purpose | Prod gate? |
|---------|---------|------------|
| `chromium` | Standard UI | Yes (release) |
| `ws-mock-server` | Mock server | Yes |
| `docker` | Kafka/WS/GQL live | Release only |
| `demo-stepthrough` | WS workflow builder, etc. | No |
| `demo-gql1` … `demo-gql19` | Per-lesson walks | No |
| `demo-gql110` | Workspace isolation | No |
| `demo-gql-lessons` | GQL 1–3 smoke | Demo nightly |

**Helpers (do not duplicate):**

- `e2e/demo-player-helpers.ts`
- `e2e/graphql-lesson-smoke-helpers.ts`
- `e2e/graphql-demo-workspace-helpers.ts`
- `e2e/DEMO-LESSON-E2E-MEMO.md`

---

## Risk Register

| Risk | Mitigation |
|------|------------|
| Stub hook drift vs real `useDemoHub` API | Export shared type from `demo-player/types.ts` consumed by stub |
| Prod build still pulls demo via transitive import | Bundle analyzer check in Phase 3 CI; grep for `demo-player` in prod chunk |
| Demo falls far behind prod API | Nightly demo job; version suffix `-demo.N` |
| Developers forget to run demo tests | Path-filtered CI on demo files |
| Two DMGs confuse users | Clear download labels; Learning Hub subtitle |
| GraphQL demo tabs in storage on prod build | `gqlDemoWorkspace` create/mutate no-op when demo disabled; `purgeOrphanDemoTabs` still sweeps orphans on Studio mount |

---

## Rollout Sequence (Recommended)

```
Week 1:  Phase 1 (Vitest split) + Phase 2 (CI)     → immediate merge relief
Week 2:  Phase 3 (build flag) + Phase 3.8 tests
Week 3:  Phase 4 (Tauri dual build) + release.yml
Week 4+: Phase 5 adapters (incremental, per lesson)
         Phase 6 docs
```

Ship Phases 1–2 to `develop` first — **zero user-visible change**, maximum CI benefit.

---

## Definition of Done (Full Initiative)

- [x] Production DMG/web build excludes demo-player bundle at runtime (verified: `npm run audit:prod-demo-bundle` — main entry clean; DemoShellHost orphan chunk ~1.1 MB on disk only)
- [ ] Learning Hub DMG installs separately with full lesson roster
- [ ] `develop` merge requires product tests + prod build only
- [ ] Demo E2E removed from default PR CI
- [ ] README documents two download tracks
- [x] `packages/demo-hub/` adapter pilot (GQL-1 via `core.ts` + `gql-demo-tab`) — **engineering complete**; `audit:prod-demo-bundle` in CI ✅; optional manual Demo Hub visual verify on Standard build
- [x] `.cursor/rules/project-conventions.mdc` updated
- [ ] User verified both artifacts on Web + Tauri before merge to `release/*`

---

## Related Documents

| Document | Relevance |
|----------|-----------|
| `docs/plan/future/demo-player/demo-player-v2-plan.md` | Original hub architecture |
| `docs/plan/future/graphql/graphql-demo-lesson-enhancement.md` | Active lesson backlog |
| `e2e/DEMO-LESSON-E2E-MEMO.md` | Demo E2E pitfalls |
| `.cursor/rules/demo-player-lessons.mdc` | Lesson authoring rules |
| `.cursor/rules/e2e-testing.mdc` | E2E project conventions |
| `.cursor/rules/build-release.mdc` | Version bump + build commands |

---

## Appendix A — File Checklist for Phase 3

| File | Action |
|------|--------|
| `.env.production` | Create |
| `.env.production.demo` | Create |
| `vite.config.ts` | Add `__ENABLE_DEMO_HUB__` |
| `src/config/features.ts` | Create |
| `src/vite-env.d.ts` | Declare global |
| `src/app/App.tsx` | Conditional lazy load |
| `src/app/hooks/useDemoHubStub.ts` | Create |
| `src/app/components/AppActivityBar.tsx` | Gate button |
| `src/app/components/AppSubNav.tsx` | Gate tab |
| `src/app/components/AppShellOverlays.tsx` | Gate overlay |
| `src/app/utils/appTabUtils.ts` | Conditional tab enum |
| `package.json` | build:prod, build:demo scripts |

## Appendix B — CI Job Summary (Target State)

| Job | Trigger | Command |
|-----|---------|---------|
| `typecheck` | All PRs | `tsc -b --noEmit` |
| `lint` | All PRs | `eslint src/ cli/` |
| `unit-tests-product` | All PRs | `test:product:coverage` |
| `unit-tests-demo` | Demo path filter | `test:demo` |
| `build-frontend-prod` | develop/release | `build:prod` |
| `e2e-product` | release only | `playwright --project=chromium` |
| `e2e-demo-nightly` | Schedule | demo-gql smoke subset |
| `tauri-build-prod` | Release tag | `tauri:build:prod` |
| `tauri-build-demo` | Demo tag / manual | `tauri:build:demo` |

## Appendix C — Phase 1–2 Implementation Files

| File | Purpose |
|------|---------|
| `vitest.projectPatterns.ts` | Shared product/demo test globs + classifiers |
| `vitest.config.ts` | Vitest `product` / `demo` projects |
| `src/test-utils/vitestProjectSplit.test.ts` | Meta tests for glob classification |
| `scripts/product-coverage-filter.ts` | Strip demo paths from product coverage map |
| `package.json` | `test:product`, `test:demo`, `test:product:coverage`, `test:demo:coverage` |
| `.github/workflows/ci.yml` | Product gate + path-filtered demo jobs |
| `.github/workflows/demo-nightly.yml` | Weekly demo unit + E2E smoke |

## Re-evaluation log (2026-06-24)

Fixes applied after Phase 1–2 implementation review:

| Issue | Fix |
|-------|-----|
| `test:coverage` skipped demo strip script | Aliased to `test:product:coverage` |
| Coverage filter duplicated path logic | Moved `isDemoCoveragePath()` to `vitest.projectPatterns.ts`; filter is `scripts/product-coverage-filter.ts` |
| No full-repo partition test | Added vitestProjectSplit test (1416 files → demo xor product) |
| CI GQL-5 E2E missing browsers | Added `playwright install chromium --with-deps` |
| CI path filter incomplete | Added `fetch-depth: 0`, `product-coverage-filter.ts` to demo paths |
| `poolMatchGlobs` TS errors in project configs | Hoisted to root `test.poolMatchGlobs` in `vitest.config.ts` |
| `typecheck` script inconsistent | Uses `tsc -b --noEmit` |
| Demo coverage missing defaults | Demo project uses `coverageConfigDefaults.exclude` + `provider: 'v8'` |

### Round 3

| Issue | Fix |
|-------|-----|
| GraphQL `useDemoGql*.test.ts` still in product project | Broadened globs to `src/**/useDemo*.test.ts` (100 demo / 1316 product files) |
| Broken coverage-path `it(...)` block | Restored wrapper after edit |
| `demo-nightly` skipped typecheck | Added `typecheck` job before `demo-unit` |
| CI path filter too narrow | `src/**/useDemo*.ts`, overlay test file, `demo-nightly.yml` |
| `demo-player.css` leaked into filtered coverage | Fixed `isDemoCoveragePath` to match `.css` files |
| Filter output incomplete | Writes `coverage/coverage-final.product.json`; logs paths on failure |

### Round 4 — Phases 3–4 (2026-06-24)

| Issue | Fix |
|-------|-----|
| Phase 3 not started | Added `.env.production` / `.env.production.demo` / `.env.development`, `src/config/features.ts`, lazy `DemoShellHost` + `DemoHubPane`, activity bar / tab URL gating |
| Demo hooks in main App bundle | Moved bridges + overlay into lazy `DemoShellHost`; `onHubReady` callback updates App state |
| GraphQL demo bridges in prod | Extracted lazy `DemoGqlStudioBridges`; gated `SettingsStorageTab` demo purge import |
| Compile-time flag | Uses `import.meta.env.VITE_ENABLE_DEMO_HUB` (Vite DCE) instead of cross-module dead branches |
| Phase 4 not started | `tauri.conf.demo.json`, `build:prod` / `build:demo` / `dev:prod-slim`, release matrix 8 jobs, CI `build:prod` |
| Gating tests | `src/app/demo/demoHubFeatureGating.test.ts` with `vi.stubEnv` |

### Round 5 — Re-evaluation pass (2026-06-24)

| Issue | Fix |
|-------|-----|
| `onHubReady` + `setDemoHub` re-render loop | Removed; hub synced via `demoHubRuntimeRef` (no App state) |
| Stale `demoHub` in App for live-demo tab exit | `handleSetActiveTab` reads `demoHubRuntimeRef.current` |
| `DemoHubPane` separate lazy chunk + stale hub prop | Demo Hub rendered via portal inside `DemoShellHost` |
| App imported `DEMO_HUB_MOUNT_ID` from lazy module | Moved mount id to `demoHubRuntimeRef.ts` |
| Sidebar/subnav bypassed live-demo exit | Pass `handleSetActiveTab` to `AppSidebarRegion` + `AppSubNav` |
| Demo sub-nav never rendered | Added gated `domain === 'demo'` section in `AppSubNav` |
| `release.yml` job `if` precedence ambiguous | Wrapped conditions in explicit parentheses |
| Default `npm run build` not slim | Aliased to `build:prod` |

### Round 6 — Re-evaluation pass (2026-06-24)

| Issue | Fix |
|-------|-----|
| `.env.*` untracked — CI `build:demo` would omit demo flag | Explicit `VITE_ENABLE_DEMO_HUB=true/false` in `build:demo` / `build:prod` scripts |
| `writeTabToUrl` could persist `?tab=demo-hub` on slim builds | Guard rewrites to default tab when demo disabled |
| Product coverage leaked `src/app/demo/**` | Added to `PRODUCT_COVERAGE_EXCLUDE` + `isDemoCoveragePath` |
| Portal mount race on first demo-hub visit | `requestAnimationFrame` retry in `DemoShellHost` mount lookup |
| Demo release assets could collide with standard on same tag | `assetNamePattern` prefix for Learning Hub builds |

### Round 7 — Phases 5–6 (2026-06-24)

| Issue | Fix |
|-------|-----|
| Phase 5 not started | Added `src/features/demo-player/adapters/` (graphql/workflow/environment/appShell + kafka/ws stubs) |
| Lessons imported product utils/hooks directly | Migrated high-churn modules to adapters; `adaptersImportAudit.test.ts` enforces forbidden imports |
| `gqlDemoWorkspace` mutates storage on prod builds | Early return when `!DEMO_HUB_ENABLED` on `prepareDemoWorkspace`, `closeDemoWorkspace`, `patchDemoTabConnection`, `purgeOrphanDemoTabs` |
| `openWfNodeConfigModal` skipped dblclick fallback | `openWorkflowNodeConfig` returns boolean; fallback when bridge absent |
| Phase 6 docs missing | Updated project-conventions, demo-player-lessons §8, README, CHANGELOG, done checklist, E2E memo |
| Partial adapter mocks broke TLS/auth tests | Lesson tests use `importOriginal` for adapters — only stub storage/tab helpers |

### Round 8 — Re-evaluation pass (2026-06-24)

| Issue | Fix |
|-------|-----|
| `purgeOrphanDemoTabs` no-op on Standard build left orphan demo tabs in GraphQL Studio | Removed `DEMO_HUB_ENABLED` guard from `purgeOrphanDemoTabs` only — cleanup still runs when demo hub is off |
| `gqlDemoWorkspace` prod-slim guards untested | Added `vi.stubEnv` + dynamic-import tests for prepare/close/patch no-ops and purge still active |
| `lesson11` setup always delayed 300ms without bridge | `deleteWorkflowByName` returns `boolean`; delay only when bridge invoked |
| `adaptersImportAudit` migrated-module check overly complex | Simplified to single `from '…adapters'` regex |
| demo-player-lessons §10 cross-ref wrong | Fixed `estimatedMinutes` reference to §11 |

### Round 9 — Re-evaluation pass (2026-06-24)

| Issue | Fix |
|-------|-----|
| Stale `gql_demo_session_v1` on Standard build blocked orphan sweep | `purgeOrphanDemoTabs`: only skip when `session && DEMO_HUB_ENABLED`; clears stale session + demo tabs on disabled builds |
| `closeDemoWorkspace` no-op on Standard left demo tabs unrecoverable | Removed demo-disabled guard from `closeDemoWorkspace` (cleanup always allowed; create/mutate still gated) |
| Lesson tests still imported `graphql/utils` directly | Migrated `graphql-schema-diff.test`, `lesson13-mock-server.test`, `gql-demo-app-environment-cleanup.test` to adapters |
| `GQL_ENVS_STORAGE_KEY` not on adapter surface | Re-exported from `graphqlStudioAdapter` |

### Round 10 — Full Phase 1–6 re-evaluation (2026-06-24)

| Issue | Fix |
|-------|-----|
| `LessonPlayer`, `PrerequisiteGate`, `useDemoHub` still imported `graphql/utils` and `app/hooks/useDemo*` | Migrated to `adapters/`; added `closeWorkflowConfigModal`, exported `MAX_TABS` |
| Import audit only scanned `lessons/` | Extended audit to demo-player core (excl. `adapters/` + `lessons/`) |
| `useDemoHub.coverage.test` spied on removed sidebar bridge module | Updated to spy on `expandAppSidebar` from adapters |

### Round 11 — Full Phase 1–6 re-evaluation (2026-06-24)

| Issue | Fix |
|-------|-----|
| `purgeOrphanDemoTabs` left a demo tab when storage contained **only** demo tabs | Use `makeBlankTab()` fallback (matches `closeDemoWorkspace`); added unit test |
| `ws-workflow-builder.ts` still used raw `window.__wf*` | Migrated to `deleteWorkflowByName` / `connectWorkflowNodes` adapters |

**Verified (no code change):** `npx tsc -b --noEmit`; `npm run test:demo` (3691); `npm run test:product` (33969); prod `index.html` does not preload `DemoShellHost` / demo chunks; demo CSS loaded only from lazy `DemoShellHost`.

**Deferred (incremental Phase 5):** ~~`lesson12-schema-diff.ts` dynamic-imports `schemaSnapshot`; workflow lessons 17–19 + Kafka runner/produce/consume still use `window.__wf*` in source~~ — **completed Round 12** (see below).

### Round 12 — Incremental Phase 5 completion (2026-06-24)

| Item | Fix |
|------|-----|
| `lesson12-schema-diff.ts` imported `graphql/utils/schemaSnapshot` directly | Re-exported snapshot helpers from `graphqlStudioAdapter`; lesson uses static adapter imports |
| Lessons 17–19, Kafka produce/consume/runner, `ws-test-runner` used raw `window.__wf*` | Migrated to `workflowDesignerAdapter` (`seedNamedWorkflow`, `getWorkflowByName`, `connectWorkflowNodes`, `addWorkflowNodeWithPreset`) |
| Repeated delete/insert setup boilerplate | Added `seedNamedWorkflow()` helper with configurable pacing |
| Import audit gaps | Extended migrated-module list; added audit rule banning raw `window.__wf*` in lesson sources |

### Round 13 — Re-evaluation pass (2026-06-24)

| Issue | Fix |
|-------|-----|
| `seedNamedWorkflow` applied `insertPreDelayMs` even when `__wfInsertWorkflow` bridge absent | Gate pre-insert delay on insert bridge availability (matches legacy kafka/ws setup) |
| Import audit missed dynamic `graphql/utils` imports | Added `await import('…graphql/utils/…')` to forbidden patterns |

### Round 14 — Re-evaluation pass (2026-06-24)

**No code changes required.** Full verification pass — all checks green.

| Check | Result |
|-------|--------|
| `npx tsc -b --noEmit` | Pass |
| `npm run test:demo` | 3696 passed |
| Import audit + adapter + gating tests | 78 passed |
| `npm run build:prod` | Main `index.html` does not reference demo chunks |
| Lesson sources: raw `window.__wf*` | 0 |
| Lesson sources: `graphql/utils` imports | 0 |
| Demo-player core forbidden imports | 0 |
| `seedNamedWorkflow` pacing (Round 13 fix) | Verified via unit tests |

### Round 15 — Phase 7 package extraction (2026-06-26)

| Item | Change |
|------|--------|
| `packages/demo-hub/` | `@redfireforge/demo-hub` — moved from `src/features/demo-player/` |
| Path aliases | `@redfireforge/demo-hub`, `@shared`, `@graphql`, `@workflow` in tsconfig / Vite / Vitest |
| Vitest globs | Demo project → `packages/demo-hub/**`; product coverage excludes package |
| npm workspaces | `"workspaces": ["packages/*"]` |
| Phase 8 sweep | `PHASE8_E2E_SWEEP=1`, kill :5173 between lessons, HMR off, localStorage clear in `openDemoHub` |
