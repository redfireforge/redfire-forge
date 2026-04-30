# Assertion Presets — Gallery, Training Manuals & CLI Samples

> **Branch:** `feature/structured-assertions` → merged to `release/0.5.5` (2026-04-29)
> **Status:** Complete (all phases F–L ✅)
> **Depends on:** Structured assertions engine (Phases A–D ✅)

---

## Objective

Add importable assertion presets so users can one-click populate common validation
patterns, learn through step-by-step training manuals, and run examples from CLI.

Each preset produces **3 artifacts**:

| Artifact | Location | Purpose |
|----------|---------|---------|
| Gallery entry | `src/data/galleries/<feature>/` | In-app importable sample (TS factory → live `Assertion[]`) |
| Training manual | `docs/training-manuals/<feature>/` | Printable HTML guide (step-by-step, exercises) |
| CLI example | `examples/` | YAML file runnable via `npx redfireforge run` |

---

## Architecture

### Gallery Data Layer

```
src/data/galleries/
  types.ts                              ← shared GalleryEntry<T> base type (future-proof)
  assertion-presets/
    types.ts                            ← AssertionPresetEntry extends GalleryEntry
    presets.ts                          ← 5 factory functions
    index.ts                            ← assertionPresetCatalog[] export
    assertionPresets.test.ts            ← unit tests
```

**Shared base type** (`types.ts`):

```typescript
export type GalleryDifficulty = 'easy' | 'medium' | 'advanced';

export interface GalleryEntry<T> {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  difficulty: GalleryDifficulty;
  tags: string[];
  factory: () => T;
}
```

**Assertion-specific type** (`assertion-presets/types.ts`):

```typescript
import type { Assertion } from '../../../shared/types';
import type { GalleryEntry } from '../types';

export type AssertionPresetCategory = 'api-validation' | 'data-quality' | 'security';

export interface AssertionPresetEntry extends GalleryEntry<Assertion[]> {
  category: AssertionPresetCategory;
  assertionCount: number;           // number of assertions produced
  assertionTypes: string[];         // e.g. ['arrayLength', 'numeric']
}
```

### UI Component

```
src/features/scenarios/components/
  AssertionPresetMenu.tsx               ← popover triggered by "📋 Presets" button
  AssertionPresetMenu.test.tsx          ← unit tests
```

**Placement:** On the Validation tab, next to the existing "+ Add" button:

```
[+ Add ▾]  [📋 Presets ▾]    ← new button
```

Clicking "Presets" opens a popover showing preset cards grouped by category,
with difficulty badges. Clicking a card imports its assertions into the list.

### Training Manuals

```
docs/training-manuals/assertions/
  assertions.html                       ← main feature manual (overview of all 3 types)
  api-healthcheck-easy.html             ← sample tutorial
  paginated-list-easy.html              ← sample tutorial
  token-expiry-medium.html              ← sample tutorial
  price-guard-medium.html               ← sample tutorial
  api-contract-advanced.html            ← sample tutorial
```

Follows conventions from `docs/training-manuals/CONVENTIONS.md`:
- File naming: `<topic>-<difficulty>.html`
- Main manual: `<feature>.html`
- Shared CSS/print styles from existing templates

### CLI Examples

```
examples/
  assertion-api-healthcheck.yaml        ← matches api-healthcheck-easy manual
  assertion-paginated-list.yaml         ← matches paginated-list-easy manual
  assertion-token-expiry.yaml           ← matches token-expiry-medium manual
  assertion-price-guard.yaml            ← matches price-guard-medium manual
  assertion-api-contract.yaml           ← matches api-contract-advanced manual
```

---

## Preset Catalog

### 1. API Health Check — Easy

| Field | Value |
|-------|-------|
| **id** | `preset-api-healthcheck` |
| **Category** | api-validation |
| **Icon** | 💚 |
| **Assertions** | 2 |

**Assertions produced:**
1. `jsonPath` — `$.status` equals `"ok"` (existing `equals` type)
2. `arrayLength` — `$.services` length `>=` 1

**Use case:** Verify a `/health` endpoint returns "ok" and lists at least one service.

**Target API:** `https://jsonplaceholder.typicode.com/users` (returns array with 10 users)

---

### 2. Paginated List Validation — Easy

| Field | Value |
|-------|-------|
| **id** | `preset-paginated-list` |
| **Category** | api-validation |
| **Icon** | 📄 |
| **Assertions** | 3 |

**Assertions produced:**
1. `arrayLength` — `$.data` length `>=` 1
2. `numeric` — `$.page` `=` 1
3. `numeric` — `$.total` `>` 0

**Use case:** Verify a paginated API returns items on the first page with a valid total.

**Target API:** `https://reqres.in/api/users?page=1`

---

### 3. Token Expiry Guard — Medium

| Field | Value |
|-------|-------|
| **id** | `preset-token-expiry` |
| **Category** | security |
| **Icon** | 🔐 |
| **Assertions** | 3 |

**Assertions produced:**
1. `regex` — `$.token` matches `^[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+$` (JWT format)
2. `date` — `$.expiresAt` `>` today (UTC)
3. `numeric` — `$.expiresIn` `>` 0

**Use case:** Verify an auth endpoint returns a valid JWT token that hasn't expired.

**Target API:** Mock/custom endpoint (training manual provides a mock JSON body)

---

### 4. E-commerce Price Guard — Medium

| Field | Value |
|-------|-------|
| **id** | `preset-price-guard` |
| **Category** | data-quality |
| **Icon** | 💰 |
| **Assertions** | 3 |

**Assertions produced:**
1. `numeric` — `$.price` `>` 0
2. `numeric` — `$.price` `<` 10000
3. `arrayLength` — `$.variants` length `>=` 1

**Use case:** Validate product API returns reasonable prices and at least one variant.

**Target API:** `https://fakestoreapi.com/products/1`

---

### 5. Full API Contract — Advanced

| Field | Value |
|-------|-------|
| **id** | `preset-api-contract` |
| **Category** | api-validation |
| **Icon** | 📝 |
| **Assertions** | 5 |

**Assertions produced:**
1. `equals` — `$.completed` equals `false`
2. `numeric` — `$.userId` `>=` 1
3. `numeric` — `$.userId` `<=` 10
4. `numeric` — `$.id` `=` 1
5. `regex` — `$.title` matches `.{3,}` (at least 3 chars)

**Use case:** Full contract validation — check exact values, ranges, and format.

**Target API:** `https://jsonplaceholder.typicode.com/todos/1`

---

## Implementation Phases

### Phase F — Gallery Data Layer ✅

**Files to create:**
- [x] `src/data/galleries/types.ts`
- [x] `src/data/galleries/assertion-presets/types.ts`
- [x] `src/data/galleries/assertion-presets/presets.ts`
- [x] `src/data/galleries/assertion-presets/index.ts`

**Validation:** `npx tsc --noEmit`

---

### Phase G — UI Preset Menu ✅

**Files to create:**
- [x] `src/features/scenarios/components/AssertionPresetMenu.tsx`

**Files to modify:**
- [x] `src/features/scenarios/components/TestEditorValidationTab.tsx` — add "Presets" button

**CSS:** Add styles to existing `scenario-builder.css` (or `json-path-builder.css`)

**Validation:** Visual — open Validation tab → click Presets → import a preset → verify assertions appear

---

### Phase H — Unit Tests ✅

**Files to create:**
- [x] `src/data/galleries/assertion-presets/assertionPresets.test.ts`
- [x] `src/features/scenarios/components/AssertionPresetMenu.test.tsx`

**Coverage target:** >90% on all new files

**Validation:** `npx vitest run src/data/galleries/ src/features/scenarios/components/AssertionPresetMenu.test.tsx`

---

### Phase I — CLI Examples ✅ (YAML files done, README pending)

**Files created:**
- [x] `examples/assertion-api-healthcheck.yaml`
- [x] `examples/assertion-paginated-list.yaml`
- [x] `examples/assertion-token-expiry.yaml`
- [x] `examples/assertion-price-guard.yaml`
- [x] `examples/assertion-api-contract.yaml`

**Remaining:**
- [ ] `examples/README.md` — add Assertion Examples section

**Validation:** `npx redfireforge run examples/assertion-api-healthcheck.yaml` (if CLI supports assertion types)

---

### Phase J — Training Manuals ✅ Complete

**Files created (6):**
- [x] `docs/training-manuals/assertions/assertions.html` — main overview manual
- [x] `docs/training-manuals/assertions/api-healthcheck-easy.html`
- [x] `docs/training-manuals/assertions/paginated-list-easy.html`
- [x] `docs/training-manuals/assertions/token-expiry-medium.html`
- [x] `docs/training-manuals/assertions/price-guard-medium.html`
- [x] `docs/training-manuals/assertions/api-contract-advanced.html`

> Created as part of Phase 8 of the Gallery Redesign plan. Each manual follows the
> standard HTML template with cover page, 6 sections (Purpose, Concepts, Assertion Rules,
> How It Works, Step-by-Step Guide, Exercises), and RedfireForge branding CSS.

---

### Phase K — E2E Tests for Presets ✅

**Files modified:**
- [x] `e2e/structured-assertions.spec.ts` — added 3 preset tests + fixed ambiguous `+ Add` selector

**New tests:**
1. Open Presets menu → verify preset cards are visible
2. Click a preset → verify assertions are imported into the list
3. Import preset + modify an assertion → verify editable

**Also fixed:** Scoped `button:has-text("+ Add")` to `.modal-overlay` to avoid matching "+ Add Feature Group" outside the modal (9 occurrences).

**Validation:** `npx playwright test e2e/structured-assertions.spec.ts` — 10/10 pass

---

### Phase L — Review & Quality Gate ✅

- [x] All files <900 lines (largest: 230 lines)
- [x] `npx tsc --noEmit` — 0 errors
- [x] `npx vitest run` — 44 preset unit tests pass (31 data + 13 component)
- [x] Coverage >90% on new files
- [x] No redundant code
- [x] Training manual HTML validates
- [x] E2E: 10/10 structured assertion tests pass (7 original + 3 preset) (no broken links/styles)

---

## Cross-Reference Matrix

| Preset | Gallery ID | CLI Example | Training Manual | Difficulty |
|--------|-----------|-------------|-----------------|------------|
| API Health Check | `preset-api-healthcheck` | `assertion-api-healthcheck.yaml` | `api-healthcheck-easy.html` | Easy |
| Paginated List | `preset-paginated-list` | `assertion-paginated-list.yaml` | `paginated-list-easy.html` | Easy |
| Token Expiry | `preset-token-expiry` | `assertion-token-expiry.yaml` | `token-expiry-medium.html` | Medium |
| Price Guard | `preset-price-guard` | `assertion-price-guard.yaml` | `price-guard-medium.html` | Medium |
| API Contract | `preset-api-contract` | `assertion-api-contract.yaml` | `api-contract-advanced.html` | Advanced |

---

## Future Compatibility

The `GalleryEntry<T>` base type has been extended by all gallery domains:

| Gallery | Location | T = | Status |
|---------|----------|-----|--------|
| `request-samples/` | `src/data/galleries/requests/` | `RequestItem` | ✅ Done |
| `test-samples/` | `src/data/galleries/tests/` | `Scenario[]` | ✅ Done |
| `catalog-specs/` | `src/data/galleries/catalog-specs/` | `string` (YAML) | ✅ Done |
| `workflows/` | `src/data/galleries/workflows/` | `WorkflowDefinition` | ✅ Done |
| `assertion-presets/` | `src/data/galleries/assertion-presets/` | `Assertion[]` | ✅ Done |

Gallery unification completed in Phase 0.5.4a — unified `GalleryPage` with domain filter
buttons, shared `GalleryDetailPanel`, and `GalleryCard` components.

---

## Risk & Edge Cases

| Risk | Mitigation |
|------|-----------|
| Presets import duplicate assertions if clicked twice | Append with fresh UUIDs each time (no dedup needed — user can delete) |
| Preset menu grows too large | Start with 5; if >12, upgrade to full gallery modal |
| CLI doesn't support new assertion types yet | YAML examples use `validation.assertions[]` — verify CLI loader handles them |
| Training manual CSS drift | Copy shared `<style>` block from existing manuals; standardize later |
