# Full Source Restructuring Plan

> **Goal**: Eliminate deep relative import chains (`../../../shared/types`) across the codebase by
> expanding path aliases, then sub-bucketing the flat `src/engine/` directory for clarity.
>
> **Scope**: Import path migration (Phase A) + engine directory split (Phase B). No feature logic changes.
> **Effort**: Phase A ~2 days, Phase B ~4 hours
> **Risk**: Low — TypeScript catches every broken import immediately; no runtime behavior changes
> **Branch**: `feature/full-source-restructuring`
> **Demo-hub impact**: None. Demo-hub only imports `@shared/*` which is unchanged throughout.
> **Status**: NOT YET STARTED — this is the implementation plan

---

## Table of Contents

1. [Current State Analysis](#1-current-state-analysis)
2. [What We Are NOT Doing](#2-what-we-are-not-doing)
3. [Phase A — Path Alias Expansion](#3-phase-a--path-alias-expansion)
   - [A1: Add new aliases](#a1-add-new-aliases-30-min-zero-risk)
   - [A2: Migrate @shared/* imports](#a2-migrate-shared-imports-3443-occurrences)
   - [A3: Migrate already-aliased features](#a3-migrate-graphql--grpc--workflow-to-their-aliases-1213-occurrences)
   - [A4: Migrate @engine/* and @test-utils/*](#a4-migrate-engine-and-test-utils-imports-506-occurrences)
4. [Phase B — Engine Sub-Bucketing](#4-phase-b--engine-sub-bucketing)
5. [Safety Rules](#5-safety-rules)
6. [Commit Structure](#6-commit-structure)
7. [Verification Gates](#7-verification-gates)
8. [Phase Status Tracker](#8-phase-status-tracker)

---

## 1. Current State Analysis

### Directory structure (already well-organized)

```
src/
  app/           148 files  — app shell: components, hooks, utils
  config/          1 file
  data/           75 files  — galleries, sample data
  engine/         80 files  — FLAT (problem area for Phase B)
  features/     2862 files  — domain feature modules (well-structured)
    api-mock/
    catalog/
    graphql/
    grpc/
    kafka/
    requests/
    results/
    scenarios/
    settings/
    test-runner/
    training/
    websocket/
    workflow/
  shared/       1143 files  — cross-cutting code
  shims/          10 files
  styles/         39 files
  test-utils/     14 files
  types/           2 files  — third-party type declaration shims
  utils/           2 files
```

### Existing path aliases (tsconfig.app.json + vite.config.ts)

| Alias | Target | Adoption |
|-------|--------|----------|
| `@shared/*` | `src/shared/*` | ~1 file uses it — rest use relative paths |
| `@graphql/*` | `src/features/graphql/*` | Partially adopted |
| `@grpc/*` | `src/features/grpc/*` | Partially adopted |
| `@workflow/*` | `src/features/workflow/*` | Partially adopted |
| `@redfireforge/demo-hub` | `packages/demo-hub/src/index.ts` | Fully adopted |

### The problem: 7,412 relative imports, 2,405 files cross two or more directory levels

Most painful patterns by frequency:

| Import pattern | Count | Can become |
|----------------|-------|------------|
| `../../../shared/types` | 638 | `@shared/types` |
| `../../../shared/types/graphql` | 203 | `@shared/types/graphql` |
| `../../../shared/grpc/contracts` | 136 | `@shared/grpc/contracts` |
| `../../shared/websocket/types` | 116 | `@shared/websocket/types` |
| `../../../shared/grpc/contractFixtures` | 107 | `@shared/grpc/contractFixtures` |
| `../../shared/types` | 85 | `@shared/types` |
| `../../../shared/api-mock/contracts` | 84 | `@shared/api-mock/contracts` |
| `../../../shared/components/CustomSelect` | 81 | `@shared/components/CustomSelect` |
| `../../../shared/utils/httpClient` | 64 | `@shared/utils/httpClient` |
| `../../../shared/utils/storage` | 62 | `@shared/utils/storage` |
| *(~30 more `../../../shared/*` variants)* | ~1800 | `@shared/*` |
| `../../features/workflow/types/workflow` | 20 | `@workflow/types/workflow` |
| `../../features/grpc/grpcStudioTypes` | 11 | `@grpc/grpcStudioTypes` |
| `../../../engine/executor` | 32 | `@engine/executor` |
| `../../../engine/dataSourceExpander` | 16 | `@engine/dataSourceExpander` |
| `../../../test-utils/customSelectHelper` | 89 | `@test-utils/customSelectHelper` |
| `../../../test-utils/factories` | 57 | `@test-utils/factories` |

### What already works well

- All `src/features/*/` are domain-organized with `components/`, `hooks/`, `types/`, `utils/`, `engine/` subfolders
- `src/app/` is split into `components/`, `hooks/`, `utils/`
- `src/shared/` is split into `api-mock/`, `components/`, `grpc/`, `hooks/`, `kafka/`, `selectors/`, `types/`, `utils/`, `websocket/`
- Intra-feature imports (e.g., `../types` within a feature folder) are already correct and should NOT be changed

---

## 2. What We Are NOT Doing

These are explicitly out of scope:

- **Intra-feature relative imports** — `../types`, `../utils/foo`, `./bar` within the same feature directory are already correct. Replacing them with absolute aliases would be wrong and harmful.
- **Per-feature aliases** (`@catalog/*`, `@requests/*`, etc.) — cross-feature imports into any single feature are tiny (max 48 occurrences). Not worth the alias overhead.
- **Moving files** in Phase A — zero file moves, only import string changes.
- **Full `src/app/` hook migration** into feature domains — app shell hooks are app-shell orchestration, not feature logic. They stay in `src/app/hooks/`.
- **Global directory sweep** — moving all legacy flat folders across the repo is deferred indefinitely (see `RESTRUCTURING_PLAN.md`).
- **Demo-hub changes** — demo-hub only uses `@shared/*` which is unchanged. No re-validation needed.

---

## 3. Phase A — Path Alias Expansion

Each sub-phase is one commit. Never combine alias additions with import migrations.

### A1: Add new aliases (30 min, zero risk)

**Files to edit**: `tsconfig.app.json` and `vite.config.ts`

Add to `tsconfig.app.json` under `"paths"`:

```json
"@engine/*":     ["src/engine/*"],
"@test-utils/*": ["src/test-utils/*"],
"@app/*":        ["src/app/*"]
```

Add to `vite.config.ts` under `alias`:

```ts
'@engine':     resolve(__dirname, 'src/engine'),
'@test-utils': resolve(__dirname, 'src/test-utils'),
'@app':        resolve(__dirname, 'src/app'),
```

**Verification**: `npx tsc -b --noEmit` — must pass with zero changes (aliases are purely additive).

**Commit**: `chore: add @engine, @test-utils, @app path aliases`

---

### A2: Migrate `@shared/*` imports (3,443 occurrences)

The relative path to `shared/` appears at four different depths depending on where the importing file lives. Each depth gets its own sed pass. We process patterns in descending frequency order.

**Key constraint**: There are four depth variants for every shared target:
- `../shared/...` — from inside `src/features/*/` at one level deep
- `../../shared/...` — from `src/features/*/{subdir}/`
- `../../../shared/...` — from `src/features/*/{subdir}/{subsubdir}/` (the most common)
- `../../../../shared/...` — from `src/features/*/{subdir}/{subsubdir}/{deeper}/`

Each sed pass is a single pattern at a single depth. Never combine depths in one regex.

#### Batch 1 — `@shared/types` (combined ~932 occurrences)

```bash
# depth 3
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' "s|from '\.\./\.\./\.\./shared/types'|from '@shared/types'|g"
# depth 2
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' "s|from '\.\./\.\./shared/types'|from '@shared/types'|g"
# depth 1
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' "s|from '\.\./shared/types'|from '@shared/types'|g"
# depth 4
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' "s|from '\.\./\.\./\.\./\.\./shared/types'|from '@shared/types'|g"
npx tsc -b --noEmit   # gate
```

#### Batch 2 — `@shared/types/graphql` (~221 occurrences)

```bash
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' "s|from '\.\./\.\./\.\./shared/types/graphql'|from '@shared/types/graphql'|g"
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' "s|from '\.\./\.\./\.\./\.\./shared/types/graphql'|from '@shared/types/graphql'|g"
npx tsc -b --noEmit
```

#### Batch 3 — `@shared/grpc/*` (~300 occurrences across all grpc modules)

```bash
# contracts
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' "s|from '\.\./\.\./\.\./shared/grpc/contracts'|from '@shared/grpc/contracts'|g"
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' "s|from '\.\./\.\./\.\./\.\./shared/grpc/contracts'|from '@shared/grpc/contracts'|g"
# contractFixtures
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' "s|from '\.\./\.\./\.\./shared/grpc/contractFixtures'|from '@shared/grpc/contractFixtures'|g"
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' "s|from '\.\./\.\./\.\./\.\./shared/grpc/contractFixtures'|from '@shared/grpc/contractFixtures'|g"
# grpcSavedRequest, grpcApiClient, grpcPersistenceSchema, grpcAdvancedFeatureContracts,
# grpcRedaction, grpcAuthPolicy, grpcTransportFacade, grpcTlsPolicy, grpcStreamClient,
# grpcSpringFixturePorts — same pattern for each
npx tsc -b --noEmit
```

#### Batch 4 — `@shared/websocket/*` (~145 occurrences)

```bash
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' "s|from '\.\./\.\./shared/websocket/types'|from '@shared/websocket/types'|g"
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' "s|from '\.\./\.\./shared/websocket/websocketStorage'|from '@shared/websocket/websocketStorage'|g"
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' "s|from '\.\./\.\./shared/websocket/protocols/protocolTypes'|from '@shared/websocket/protocols/protocolTypes'|g"
npx tsc -b --noEmit
```

#### Batch 5 — `@shared/api-mock/*` (~174 occurrences)

```bash
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' "s|from '\.\./\.\./\.\./shared/api-mock/contracts'|from '@shared/api-mock/contracts'|g"
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' "s|from '\.\./\.\./shared/api-mock/contracts'|from '@shared/api-mock/contracts'|g"
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' "s|from '\.\./\.\./\.\./shared/api-mock/defaults'|from '@shared/api-mock/defaults'|g"
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' "s|from '\.\./\.\./shared/api-mock/defaults'|from '@shared/api-mock/defaults'|g"
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' "s|from '\.\./\.\./\.\./shared/api-mock/schemaMatchers'|from '@shared/api-mock/schemaMatchers'|g"
npx tsc -b --noEmit
```

#### Batch 6 — `@shared/components/*` (~251 occurrences)

```bash
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' "s|from '\.\./\.\./\.\./shared/components/CustomSelect'|from '@shared/components/CustomSelect'|g"
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' "s|from '\.\./\.\./\.\./\.\./shared/components/CustomSelect'|from '@shared/components/CustomSelect'|g"
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' "s|from '\.\./\.\./shared/components/CustomSelect'|from '@shared/components/CustomSelect'|g"
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' "s|from '\.\./\.\./\.\./shared/components/AppModalFrame'|from '@shared/components/AppModalFrame'|g"
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' "s|from '\.\./\.\./\.\./shared/components/data-mapper'|from '@shared/components/data-mapper'|g"
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' "s|from '\.\./\.\./\.\./shared/components/data-mapper/types'|from '@shared/components/data-mapper/types'|g"
npx tsc -b --noEmit
```

#### Batch 7 — `@shared/utils/*` (~400 occurrences across all util modules)

```bash
# httpClient, storage, platform, helpers, jsonPath, fileSaver, idbGraphqlCollections,
# bodySerializer, panelMode — same pattern for each, all depths
# Example for httpClient:
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' "s|from '\.\./\.\./\.\./shared/utils/httpClient'|from '@shared/utils/httpClient'|g"
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' "s|from '\.\./shared/utils/httpClient'|from '@shared/utils/httpClient'|g"
# ...same for each util module
npx tsc -b --noEmit
```

#### Batch 8 — `@shared/hooks/*`, `@shared/kafka/*`, `@shared/selectors/*`, `@shared/constants/*`

```bash
# hooks/useModalDrag and other shared hooks
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' "s|from '\.\./\.\./\.\./shared/hooks/|from '@shared/hooks/|g"
# kafka/kafkaClient, kafkaConfig, kafkaStorage
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' "s|from '\.\./\.\./shared/kafka/|from '@shared/kafka/|g"
# selectors
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' "s|from '\.\./\.\./\.\./shared/selectors'|from '@shared/selectors'|g"
# constants/httpMethodColors
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' "s|from '\.\./\.\./\.\./shared/constants/|from '@shared/constants/|g"
npx tsc -b --noEmit
```

#### Batch 9 — Catch-all sweep for remaining `shared/` relative imports

```bash
# After all targeted batches, run a verification grep to find any missed patterns
grep -rn "from '\.\." src --include="*.ts" --include="*.tsx" | grep "shared/" | head -20
# Fix any remaining patterns found, then:
npx tsc -b --noEmit
```

**Commit**: `chore: migrate @shared/* imports (replace all relative paths)`

---

### A3: Migrate `@graphql/*`, `@grpc/*`, `@workflow/*` to their aliases (1,213 occurrences)

These aliases already exist in both tsconfig and vite — they just aren't being used everywhere.

#### Batch 1 — `@workflow/*` (~312 occurrences)

Most common patterns:

```bash
# features/workflow/types/workflow — most common at two depths
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' "s|from '\.\./\.\./features/workflow/types/workflow'|from '@workflow/types/workflow'|g"
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' "s|from '\.\./\.\./\.\./features/workflow/types/workflow'|from '@workflow/types/workflow'|g"
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' "s|from '\.\./features/workflow/types/workflow'|from '@workflow/types/workflow'|g"
# WorkflowToastProvider, useWorkflows, expressionFunctions/types, expressionEvaluator,
# workflowNodeFactory, engine/graphRunner, engine/graphRunnerNodeHandlerContext, etc.
# Same pattern for each.
npx tsc -b --noEmit
```

#### Batch 2 — `@grpc/*` (~120 occurrences)

```bash
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' "s|from '\.\./\.\./features/grpc/grpcStudioTypes'|from '@grpc/grpcStudioTypes'|g"
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' "s|from '\.\./\.\./features/grpc/hooks/grpcStudioSessionHelpers'|from '@grpc/hooks/grpcStudioSessionHelpers'|g"
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' "s|from '\.\./\.\./features/grpc/utils/resolveGrpcTabConnection'|from '@grpc/utils/resolveGrpcTabConnection'|g"
npx tsc -b --noEmit
```

#### Batch 3 — `@graphql/*`

```bash
# Any remaining relative imports into features/graphql/ from other features
grep -rn "from '\.\." src --include="*.ts" --include="*.tsx" | grep "features/graphql/" | head -20
# Apply sed for each found pattern
npx tsc -b --noEmit
```

**Commit**: `chore: migrate @graphql/@grpc/@workflow relative imports to aliases`

---

### A4: Migrate `@engine/*` and `@test-utils/*` imports (506 occurrences)

These use the new aliases added in A1.

#### `@engine/*` (~190 occurrences from outside src/engine/)

Most common patterns:

```bash
# executor — 32 occurrences at depth 3
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' "s|from '\.\./\.\./\.\./engine/executor'|from '@engine/executor'|g"
# dataSourceExpander — 16 at depth 3
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' "s|from '\.\./\.\./\.\./engine/dataSourceExpander'|from '@engine/dataSourceExpander'|g"
# tokenManager — 12 at depth 3, 5 at depth 2
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' "s|from '\.\./\.\./\.\./engine/tokenManager'|from '@engine/tokenManager'|g"
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' "s|from '\.\./\.\./engine/tokenManager'|from '@engine/tokenManager'|g"
# requestExecution, validator, allocationEngine, scriptLibraries, scriptLibraryVersioning,
# scriptSandbox, variableContext, fetchScenarioSample, graphRunner, debugController — same pattern
npx tsc -b --noEmit
```

Note: imports of `workflow/engine/graphRunner` etc. are already handled in A3.

#### `@test-utils/*` (~316 occurrences)

```bash
# customSelectHelper — 89 at depth 3, 45 at depth 4
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' "s|from '\.\./\.\./\.\./test-utils/customSelectHelper'|from '@test-utils/customSelectHelper'|g"
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' "s|from '\.\./\.\./\.\./\.\./test-utils/customSelectHelper'|from '@test-utils/customSelectHelper'|g"
# factories — 57 at depth 3, 32 at depth 2
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' "s|from '\.\./\.\./\.\./test-utils/factories'|from '@test-utils/factories'|g"
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' "s|from '\.\./\.\./test-utils/factories'|from '@test-utils/factories'|g"
# grpcFactories, reactFlowMock, domMocks, clipboardMock, uuidMock — same pattern
npx tsc -b --noEmit
```

**Commit**: `chore: migrate @engine/* and @test-utils/* to aliases`

---

## 4. Phase B — Engine Sub-Bucketing

> **Prerequisite**: Phase A complete and committed.

`src/engine/` is a flat directory of 80 files spanning three distinct concerns. This phase splits it into sub-directories without changing any logic.

### Proposed structure

```
src/engine/
  core/          — execution, validation, data expansion
    executor.ts
    requestExecution.ts
    dataSourceExpander.ts
    validator.ts              (+ all validator.*.ts test files)
    validationResult.ts
    assertions.ts             (+ test files)
    circuitBreaker.ts
    deepCompare.ts
    fieldOperatorEvaluation.ts
    allocationEngine.ts
    thinkTime.ts
    tokenManager.ts
    variableContext.ts
    scriptSandbox.ts
    scriptLibraries.ts
    scriptLibraryVersioning.ts
    fetchScenarioSample.ts
    validatorHttpHelpers.ts
    debugController.ts
  grpc/           — grpc-specific engine concerns
    grpcConnectionProfileHydration.ts
  load/           — load testing engine
    loadProfileRunner.ts
```

### Steps

1. Create the three subdirectories
2. `git mv` each file to its subdirectory (no content changes)
3. Update the ~20 external import sites (most already use `@engine/*` from Phase A — change `@engine/executor` to `@engine/core/executor`)
4. Update internal cross-references within engine (intra-engine imports)
5. `npx tsc -b --noEmit` — gate
6. `npx vitest run src/engine` — run engine unit tests
7. Commit: `refactor: split src/engine/ into core/, grpc/, load/ subdirectories`

### Impact on alias

After moving, update `tsconfig.app.json` and `vite.config.ts` to add sub-aliases (optional but clean):

```json
"@engine/core/*":  ["src/engine/core/*"],
"@engine/grpc/*":  ["src/engine/grpc/*"],
"@engine/load/*":  ["src/engine/load/*"]
```

The parent `@engine/*` alias can remain pointing at `src/engine/*` as a catch-all.

---

## 5. Safety Rules

1. **One pattern per sed command** — never combine multiple substitutions
2. **`npx tsc -b --noEmit` gate after every batch** — if it fails, `git checkout -- src` and diagnose before proceeding
3. **Never edit logic in a restructuring commit** — import strings only
4. **Commit after each sub-phase** — isolates any regression to a small diff
5. **`git mv` for file moves, never `cp` + `rm`** — preserves `git blame` history
6. **Move files without changing content** — no logic edits in the same commit as a move
7. **Do not touch intra-feature relative imports** — `../types`, `./utils/foo` within the same feature folder are correct as-is
8. **Test only touched files during development** — `npx vitest run src/engine` not the full suite; E2E only at merge gate

---

## 6. Commit Structure

```
A1  chore: add @engine, @test-utils, @app path aliases
A2  chore: migrate @shared/* imports (replace all relative paths)
A3  chore: migrate @graphql/@grpc/@workflow relative imports to aliases
A4  chore: migrate @engine/* and @test-utils/* to aliases
B   refactor: split src/engine/ into core/, grpc/, load/ subdirectories
```

Each commit is a standalone PR-ready unit. The branch can be merged after any commit — each leaves the codebase in a valid, fully-compiling state.

---

## 7. Verification Gates

After every batch and at final merge:

| Gate | Command | Must pass |
|------|---------|-----------|
| TypeScript | `npx tsc -b --noEmit` | 0 errors |
| Engine unit tests (Phase B only) | `npx vitest run src/engine` | all pass |
| Touched feature unit tests | `npx vitest run src/features/<name>` | all pass |
| Full unit suite (merge gate only) | `npx vitest run` | all pass |
| E2E (merge gate only) | `npx playwright test --reporter=list --workers=1` | all pass |

---

## 8. Phase Status Tracker

| Phase | Description | Status | Commit |
|-------|-------------|--------|--------|
| A1 | Add @engine, @test-utils, @app aliases | 🔲 Not started | — |
| A2 | Migrate @shared/* imports | 🔲 Not started | — |
| A3 | Migrate @graphql/@grpc/@workflow to aliases | 🔲 Not started | — |
| A4 | Migrate @engine/* and @test-utils/* to aliases | 🔲 Not started | — |
| B  | Engine sub-bucketing (core/grpc/load/) | 🔲 Not started | — |
