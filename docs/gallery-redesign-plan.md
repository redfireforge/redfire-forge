# Unified Gallery — Architecture & Implementation Plan

> **Status:** Phases 1–8 complete; Phase 9 (E2E) remaining
> **Depends on:** Structured assertions (✅), Workflow templates (✅), Catalog specs (✅)

---

## Problem Statement

The current gallery system is fragmented:

| What exists | Type extends `GalleryEntry<T>`? | Has gallery UI? | Live API? |
|---|---|---|---|
| 27 workflow templates | ❌ standalone `SampleWorkflowEntry` | ✅ `TemplateGalleryContent` tab | Partial (jsonplaceholder only) |
| 5 assertion presets | ✅ `AssertionPresetEntry` | ❌ popover menu only | ❌ none |
| 2 catalog specs | ❌ standalone `SampleCatalogEntry` | ❌ none | ❌ localhost mock |
| Request samples | — | — | — (doesn't exist) |
| Test samples | — | — | — (doesn't exist) |

**Issues:**
1. No unified browsing experience — users can't discover what's available
2. Three different type hierarchies for the same concept
3. Only workflows have a proper gallery UI
4. Most samples use `jsonplaceholder` or `api.example.com` (fake URLs)
5. No request or test sample galleries exist at all

---

## Design Goals

1. **Unified type system** — All galleries extend `GalleryEntry<T>` with domain-specific fields
2. **Five gallery domains** — Requests, Catalog, Tests, Workflows, Assertion Presets
3. **Real public APIs** — Every sample hits a real, reliable, free API
4. **Unified gallery UI** — Shared `GalleryGrid` / `GalleryCard` components; each domain adds its own cards/details
5. **Future-proof** — Adding a new gallery domain = add data + register in catalog
6. **Progressive complexity** — Easy / Medium / Advanced samples in each domain

---

## Public API Selection

All samples must use **real, free, no-auth-required** public APIs. Selected for reliability and diversity:

| API | Base URL | Why |
|---|---|---|
| **JSONPlaceholder** | `https://jsonplaceholder.typicode.com` | Users, posts, comments, todos, albums — versatile REST, supports POST/PUT/DELETE |
| **ReqRes** | `https://reqres.in/api` | Pagination, user CRUD, register/login (returns tokens), delayed responses |
| **DummyJSON** | `https://dummyjson.com` | Products, carts, users, auth, search, pagination — rich responses |
| **PokéAPI** | `https://pokeapi.co/api/v2` | Deeply nested data, linked resources — great for extraction demos |
| **REST Countries** | `https://restcountries.com/v3.1` | Filter by name/code/region/language — rich query patterns |
| **Dog CEO** | `https://dog.ceo/api` | Simple image API — good for quick "hello world" demos |
| **Cat Facts** | `https://catfact.ninja` | Facts + breeds with pagination — simple paginated API |
| **Open Library** | `https://openlibrary.org` | Book search, author lookup — real-world data, large payloads |
| **HTTPBin** | `https://httpbin.org` | Echo headers, auth testing, status codes, delays — testing-focused |
| **{JSON} Placeholder Guide** | `https://jsonplaceholder.typicode.com/guide` | Already in use, keep for backward compat |

---

## Architecture

### Unified Type System

```
src/data/galleries/
  types.ts                              ← GalleryEntry<T>, GalleryDomain, GalleryDifficulty
  registry.ts                           ← unified catalog registry (all domains)
  
  requests/                             ← NEW: request samples
    types.ts                            ← RequestSampleEntry extends GalleryEntry<Scenario>
    presets.ts                          ← factory functions
    index.ts                            ← requestSampleCatalog[]
  
  catalog-specs/                        ← MIGRATED from src/data/sampleCatalogSpecs.ts (deleted)
    types.ts                            ← CatalogSpecEntry extends GalleryEntry<string>  (specYaml)
    specs.ts                            ← factory functions
    index.ts                            ← catalogSpecCatalog[]
  
  tests/                                ← NEW: test scenario samples
    types.ts                            ← TestSampleEntry extends GalleryEntry<FeatureGroup>
    presets.ts                          ← factory functions
    index.ts                            ← testSampleCatalog[]
  
  workflows/                            ← MIGRATED from src/data/sampleWorkflows/ (deleted)
    types.ts                            ← WorkflowSampleEntry extends GalleryEntry<Workflow>
    apiPatterns.ts                      ← (moved)
    flowControl.ts                      ← (moved)
    eventDriven.ts                      ← (moved)
    orchestration.ts                    ← (moved)
    asyncCorrelation.ts                 ← (moved)
    index.ts                            ← workflowSampleCatalog[]
  
  assertion-presets/                    ← EXISTS (keep as-is, already extends GalleryEntry)
    types.ts
    presets.ts
    index.ts
```

### Updated `GalleryEntry<T>`

```typescript
// src/data/galleries/types.ts

export type GalleryDifficulty = 'easy' | 'medium' | 'advanced';

export type GalleryDomain = 'requests' | 'catalog' | 'tests' | 'workflows' | 'assertions';

export interface GalleryEntry<T> {
  id: string;
  domain: GalleryDomain;
  name: string;
  description: string;
  icon: string;
  category: string;
  difficulty: GalleryDifficulty;
  tags: string[];
  /** The public API(s) this sample interacts with. */
  liveApis: string[];
  factory: () => T;
}
```

Changes from current:
- Added `domain` — identifies which gallery this entry belongs to
- Added `liveApis` — lists the real API base URLs the sample uses (for display + trust)

### Domain-Specific Entry Types

```typescript
// requests/types.ts
export type RequestCategory = 'crud' | 'search' | 'auth' | 'pagination' | 'file-upload';
export interface RequestSampleEntry extends GalleryEntry<Scenario> {
  category: RequestCategory;
  method: Scenario['method'];
  /** Short preview of the target URL (e.g. "/api/v2/pokemon/pikachu") */
  previewPath: string;
}

// catalog-specs/types.ts
export type CatalogSpecCategory = 'rest-api' | 'webhooks' | 'microservices' | 'public-api';
export interface CatalogSpecEntry extends GalleryEntry<string> {
  category: CatalogSpecCategory;
  endpointCount: number;
  /** OpenAPI version (e.g. "3.0.3") */
  specVersion: string;
}

// tests/types.ts
export type TestCategory = 'smoke' | 'regression' | 'load' | 'contract' | 'security';
export interface TestSampleEntry extends GalleryEntry<FeatureGroup> {
  category: TestCategory;
  scenarioCount: number;
  /** Which assertion types are demonstrated */
  assertionTypes: string[];
}

// workflows/types.ts  (migrate from SampleWorkflowEntry)
export type WorkflowCategory = 'api-patterns' | 'flow-control' | 'event-driven' | 'orchestration';
export interface WorkflowSampleEntry extends GalleryEntry<Workflow> {
  category: WorkflowCategory;
  nodeCount: number;
  primaryNodes: string[];
  secondaryNodes: string[];
  companionFactories?: Array<() => Workflow>;
  simulatorOf?: string;
}

// assertion-presets/types.ts (already exists, add liveApis + domain)
export type AssertionPresetCategory = 'api-validation' | 'data-quality' | 'security';
export interface AssertionPresetEntry extends GalleryEntry<Assertion[]> {
  category: AssertionPresetCategory;
  assertionCount: number;
  assertionTypes: string[];
}
```

### Unified Registry

```typescript
// src/data/galleries/registry.ts

import type { GalleryEntry, GalleryDomain } from './types';
import { requestSampleCatalog } from './requests';
import { catalogSpecCatalog } from './catalog-specs';
import { testSampleCatalog } from './tests';
import { workflowSampleCatalog } from './workflows';
import { assertionPresetCatalog } from './assertion-presets';

export interface GalleryDomainConfig {
  domain: GalleryDomain;
  label: string;
  icon: string;
  description: string;
  entries: GalleryEntry<unknown>[];
}

export const galleryDomains: GalleryDomainConfig[] = [
  {
    domain: 'requests',
    label: 'Requests',
    icon: '🔌',
    description: 'Ready-to-send HTTP requests against real public APIs',
    entries: requestSampleCatalog,
  },
  {
    domain: 'catalog',
    label: 'API Catalog',
    icon: '📚',
    description: 'OpenAPI specs for popular public APIs — import and explore',
    entries: catalogSpecCatalog,
  },
  {
    domain: 'tests',
    label: 'Tests',
    icon: '🏋',
    description: 'Pre-built test scenarios with assertions against live endpoints',
    entries: testSampleCatalog,
  },
  {
    domain: 'workflows',
    label: 'Workflows',
    icon: '🔧',
    description: 'Workflow templates demonstrating node types and patterns',
    entries: workflowSampleCatalog,
  },
  {
    domain: 'assertions',
    label: 'Assertion Presets',
    icon: '✅',
    description: 'Reusable assertion sets for common validation patterns',
    entries: assertionPresetCatalog,
  },
];
```

---

## Sample Catalog — What to Build

### Requests Gallery (NEW — 12 samples)

| # | Name | Difficulty | API | Method | Category |
|---|---|---|---|---|---|
| 1 | Get All Users | Easy | JSONPlaceholder | GET | crud |
| 2 | Get Pokémon Details | Easy | PokéAPI | GET | crud |
| 3 | Random Dog Image | Easy | Dog CEO | GET | crud |
| 4 | Search Countries by Name | Easy | REST Countries | GET | search |
| 5 | Create a New Post | Easy | JSONPlaceholder | POST | crud |
| 6 | Search Books | Medium | Open Library | GET | search |
| 7 | Paginated User List | Medium | ReqRes | GET | pagination |
| 8 | Product Search with Query | Medium | DummyJSON | GET | search |
| 9 | Update a Resource (PUT) | Medium | JSONPlaceholder | PUT | crud |
| 10 | Delete a Resource | Medium | JSONPlaceholder | DELETE | crud |
| 11 | Auth Login (Token) | Medium | ReqRes | POST | auth |
| 12 | Echo Headers & Body | Advanced | HTTPBin | POST | auth |

Each factory returns a `Scenario` with pre-filled URL, method, headers, body, and basic validation.

### Catalog Specs Gallery (EXPAND — 6 specs total)

| # | Name | Difficulty | Real API | Endpoints | Category |
|---|---|---|---|---|---|
| 1 | JSONPlaceholder API | Easy | jsonplaceholder.typicode.com | 12 | rest-api |
| 2 | ReqRes API | Easy | reqres.in | 8 | rest-api |
| 3 | PokéAPI | Medium | pokeapi.co | 10 | public-api |
| 4 | DummyJSON Products | Medium | dummyjson.com | 15 | rest-api |
| 5 | REST Countries | Medium | restcountries.com | 8 | public-api |
| 6 | HTTPBin Toolkit | Advanced | httpbin.org | 20+ | microservices |

Each factory returns a `string` (OpenAPI 3.0 YAML) describing the real public API's endpoints.
**Migrate existing** 2 entries from `src/data/galleries/catalog-specs/specs.ts` (Correlation Wait API + Pet Store) into this structure.

### Tests Gallery (NEW — 8 samples)

| # | Name | Difficulty | API | Scenarios | Category |
|---|---|---|---|---|---|
| 1 | User API Smoke Test | Easy | JSONPlaceholder | 3 | smoke |
| 2 | Product Listing Check | Easy | FakeStore / DummyJSON | 2 | smoke |
| 3 | Paginated API Regression | Medium | ReqRes | 4 | regression |
| 4 | Pokémon Data Contract | Medium | PokéAPI | 3 | contract |
| 5 | Country Search Suite | Medium | REST Countries | 4 | regression |
| 6 | Auth Flow Validation | Medium | ReqRes | 3 | security |
| 7 | E-Commerce Full Suite | Advanced | DummyJSON | 6 | regression |
| 8 | Multi-API Load Profile | Advanced | Multiple APIs | 5 | load |

Each factory returns a `FeatureGroup` with pre-configured `TestScenario[]`, each with `Scenario[]` including URL, assertions, and extractions.

### Workflows Gallery (KEEP + EXPAND — 27 existing + 5 new)

Keep all 27 existing workflow samples. Add 5 new ones that use **diverse** public APIs:

| # | Name | Difficulty | API | Pattern |
|---|---|---|---|---|
| 28 | Pokémon Evolution Chain | Medium | PokéAPI | Chain: fetch → extract → fetch linked |
| 29 | Country → Capital Weather | Medium | REST Countries + Open-Meteo | Multi-API: lookup country → get coordinates → fetch weather |
| 30 | Product Price Monitor | Medium | DummyJSON | Loop: iterate products → condition: price threshold → aggregate |
| 31 | Book Search & Enrich | Advanced | Open Library + REST Countries | Fork/join: search books → parallel author lookup + country lookup |
| 32 | Multi-API Health Dashboard | Advanced | Multiple (5 APIs) | Fork/join: parallel health checks → aggregate status → condition alert |

### Assertion Presets Gallery (KEEP — 5 existing)

Already well-designed. Add `domain: 'assertions'` and `liveApis` fields to existing entries.

---

## UI Architecture

### Shared Components (NEW)

```
src/components/gallery/
  GalleryPage.tsx              ← top-level gallery page with domain tabs
  GalleryPage.css
  GalleryGrid.tsx              ← responsive card grid with search/filter
  GalleryCard.tsx              ← base card (icon, name, desc, difficulty, tags, live-api badges)
  GalleryDetailPanel.tsx       ← right-side detail panel (preview, metadata, import button)
  GalleryFilters.tsx           ← category filter, difficulty filter, search, API filter
  DomainBadge.tsx              ← colored domain pill (Requests, Tests, etc.)
  DifficultyDots.tsx           ← ● ●● ●●● difficulty indicator (extract from TemplateGalleryModal)
  LiveApiBadge.tsx             ← small badge showing which public API is used
```

### Gallery Page Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  🏪 Gallery                                        [🔍 Search... ] │
├──────────┬──────────────────────────────────────────────────────────┤
│          │                                                          │
│ DOMAINS  │  GALLERY GRID                                            │
│          │                                                          │
│ ▸ All    │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│ ▸ Request│  │ 🔌 GET   │ │ 🐕 Dog   │ │ 📄 Page  │ │ 🌍 Search│   │
│ ▸ Catalog│  │ All Users│ │ Random   │ │ Users    │ │ Country  │   │
│ ▸ Tests  │  │ ● Easy   │ │ Image    │ │ ●● Med   │ │ ● Easy   │   │
│ ▸ Workfl │  │ JSONPlac… │ │ ● Easy   │ │ ReqRes   │ │ RESTCoun │   │
│ ▸ Assert │  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
│          │                                                          │
│ FILTERS  │  ┌──────────┐ ┌──────────┐ ┌──────────┐                │
│          │  │ 🏋 Smoke │ │ 🔐 Auth  │ │ 📝 Full  │                │
│ Category │  │ Test     │ │ Login    │ │ Contract │                │
│ [All   ▾]│  │ ● Easy   │ │ ●● Med   │ │ ●●● Adv  │                │
│          │  │ JSONPlac… │ │ ReqRes   │ │ Multiple │                │
│ Difficul │  └──────────┘ └──────────┘ └──────────┘                │
│ [All   ▾]│                                                          │
│          │                                                          │
│ Live API │ ────────────────────────────────────────────────────────  │
│ [All   ▾]│  DETAIL PANEL (appears when card selected)               │
│          │  ┌──────────────────────────────────────────────────────┐ │
│          │  │ 🔌 Get All Users                        [Import ▶] │ │
│          │  │ GET https://jsonplaceholder.../users    [Try It ▶]  │ │
│          │  │                                                      │ │
│          │  │ Difficulty: ● Easy                                   │ │
│          │  │ Live API:  jsonplaceholder.typicode.com              │ │
│          │  │ Tags: #users #rest #crud                             │ │
│          │  │                                                      │ │
│          │  │ Preview:                                              │ │
│          │  │ ┌────────────────────────────────────────────────┐   │ │
│          │  │ │ { method: "GET", url: "https://json..." }      │   │ │
│          │  │ └────────────────────────────────────────────────┘   │ │
│          │  └──────────────────────────────────────────────────────┘ │
└──────────┴──────────────────────────────────────────────────────────┘
```

### Navigation Integration

The Gallery becomes a **top-level domain** (not a sub-tab of Workflow):

```typescript
type Domain = 'api' | 'workflow' | 'testing' | 'gallery' | 'settings';
//                                                ^^^^^^^^ NEW

// Gallery has no sub-tabs — it's a single-page experience with domain sidebar filters
```

Activity bar icon: `🏪` (or `📦`)

When the user clicks **Import** on a gallery card:
- **Request** → creates a new Scenario in Requests tab and switches to it
- **Catalog** → imports OpenAPI spec into Catalog tab and switches to it
- **Test** → creates a FeatureGroup in Scenarios tab and switches to it
- **Workflow** → loads workflow into Designer tab and switches to it (existing behavior)
- **Assertion** → opens AssertionPresetMenu behavior (or imports into active test)

### Import Actions per Domain

```typescript
// Each domain registers an import handler
interface GalleryImportHandler<T> {
  domain: GalleryDomain;
  /** Label for the primary action button */
  actionLabel: string;
  /** Optional secondary action (e.g. "Try It" for requests) */
  secondaryLabel?: string;
  /** Execute the import — receives factory output + app dispatch */
  onImport: (item: T, dispatch: AppDispatch) => void;
  /** Optional: execute secondary action */
  onSecondary?: (item: T, dispatch: AppDispatch) => void;
}
```

---

## Training Manuals — Aligned to Gallery

### Design Principle: 1 Gallery Entry = 1 Training Manual

Every gallery sample gets a companion training manual stored under `docs/training-manuals/`.

### Folder Structure

Mirrors the gallery domain structure under `docs/training-manuals/`:

```
docs/training-manuals/
  CONVENTIONS.md                                ← existing naming rules

  requests/                                     ← NEW domain
    requests.html                               ← domain overview manual
    get-all-users-easy.html
    get-pokemon-details-easy.html
    random-dog-image-easy.html
    search-countries-easy.html
    create-new-post-easy.html
    search-books-medium.html
    paginated-user-list-medium.html
    product-search-medium.html
    update-resource-medium.html
    delete-resource-medium.html
    auth-login-medium.html
    echo-headers-advanced.html

  catalog/                                      ← NEW domain
    catalog.html                                ← domain overview manual
    jsonplaceholder-api-easy.html
    reqres-api-easy.html
    pokeapi-medium.html
    dummyjson-products-medium.html
    rest-countries-medium.html
    httpbin-toolkit-advanced.html

  tests/                                        ← NEW domain
    tests.html                                  ← domain overview manual
    user-api-smoke-easy.html
    product-listing-easy.html
    paginated-regression-medium.html
    pokemon-contract-medium.html
    country-search-medium.html
    auth-flow-medium.html
    ecommerce-full-suite-advanced.html
    multi-api-load-advanced.html

  workflow/                                     ← EXISTS — expand
    workflow.html                               ← NEW domain overview manual
    node-reference/                             ← existing
      node-reference.html
    async-correlation/                          ← existing (4 manuals)
      ...
    script-node/                                ← existing (4 manuals)
      ...
    api-patterns/                               ← NEW subfolder
      create-extract-verify-easy.html
      parallel-api-calls-easy.html
      debug-trace-pipeline-medium.html
      expression-functions-medium.html
      script-formatter-easy.html
    flow-control/                               ← NEW subfolder
      conditional-branch-easy.html
      switch-router-medium.html
      loop-aggregator-medium.html
      batch-provisioning-medium.html
      error-handler-medium.html
      workflow-error-handler-medium.html
      script-validator-medium.html
    event-driven/                               ← NEW subfolder
      webhook-trigger-easy.html
      schedule-trigger-medium.html
      wait-for-condition-medium.html
    orchestration/                              ← NEW subfolder
      sub-workflow-orchestrator-medium.html
      order-pipeline-medium.html
      deploy-orchestrator-advanced.html
      script-data-pipeline-advanced.html
    new-samples/                                ← NEW subfolder (Phase 7 samples)
      pokemon-evolution-chain-medium.html
      country-capital-weather-medium.html
      product-price-monitor-medium.html
      book-search-enrich-advanced.html
      multi-api-health-dashboard-advanced.html

  assertions/                                   ← FROM assertion-presets-plan.md
    assertions.html                             ← domain overview manual
    api-healthcheck-easy.html
    paginated-list-easy.html
    token-expiry-medium.html
    price-guard-medium.html
    api-contract-advanced.html
```

### Manual Template Structure

Every manual follows the existing conventions from `CONVENTIONS.md` and the proven structure in `json-formatter-easy.html`:

```
┌─────────────────────────────────────────────────────┐
│  COVER PAGE                                         │
│  • Icon + Title + Domain badge + Difficulty badge   │
│  • Gallery ID (for cross-reference)                 │
│  • Live API(s) used                                 │
│  • "Import this sample" deeplink to gallery         │
├─────────────────────────────────────────────────────┤
│  TABLE OF CONTENTS                                  │
├─────────────────────────────────────────────────────┤
│  1. PURPOSE & USE CASE                              │
│     What this sample demonstrates                   │
│     When you'd use this pattern                     │
├─────────────────────────────────────────────────────┤
│  2. CONCEPTS YOU'LL LEARN                           │
│     Bullet list of features/concepts covered        │
├─────────────────────────────────────────────────────┤
│  3. THE LIVE API                                    │  ← NEW SECTION
│     Which public API(s) are used                    │
│     Sample response shapes                          │
│     Endpoint documentation links                    │
├─────────────────────────────────────────────────────┤
│  4. ARCHITECTURE / FLOW DIAGRAM                     │
│     ASCII diagram or step flow                      │
│     (Requests: request → response flow)             │
│     (Tests: scenario → assertion matrix)            │
│     (Workflows: node graph)                         │
│     (Catalog: endpoint tree)                        │
├─────────────────────────────────────────────────────┤
│  5. STEP-BY-STEP WALKTHROUGH                        │
│     Numbered steps with screenshots/code blocks     │
│     "In RedfireForge, click X → configure Y"        │
├─────────────────────────────────────────────────────┤
│  6. EXPECTED RESULTS                                │
│     What the response/execution should look like    │
│     Sample JSON responses from the live API         │
├─────────────────────────────────────────────────────┤
│  7. TRY IT YOURSELF — EXERCISES                     │
│     2-3 modifications the reader can try            │
│     "Change the URL to /users/2 and verify..."      │
├─────────────────────────────────────────────────────┤
│  8. RELATED GALLERY ENTRIES                         │  ← NEW SECTION
│     Links to related samples in other domains       │
│     "See also: User API Smoke Test (Tests)"         │
└─────────────────────────────────────────────────────┘
```

**New sections vs. existing template:**
- **Section 3 "The Live API"** — documents the real public API, its base URL, response shape, and link to external docs. Builds user confidence.
- **Section 8 "Related Gallery Entries"** — cross-links between domains. A Request manual links to the Test that validates it, the Workflow that orchestrates it, and the Catalog spec that documents it.

### Domain Overview Manuals

Each domain gets an overview manual (`<domain>.html`) that:

1. Explains what this gallery domain is for
2. Lists all samples in a summary table (name, difficulty, API, what you'll learn)
3. Suggests a learning path: Easy → Medium → Advanced
4. Links to every individual sample manual

### Cross-Domain Linkage

Gallery entries that use the same public API are cross-linked in their manuals:

| API | Request Manual | Test Manual | Workflow Manual | Catalog Manual | Assertion Manual |
|---|---|---|---|---|---|
| JSONPlaceholder | `get-all-users-easy` | `user-api-smoke-easy` | `create-extract-verify-easy` | `jsonplaceholder-api-easy` | `api-healthcheck-easy` |
| ReqRes | `paginated-user-list-medium` | `paginated-regression-medium` | — | `reqres-api-easy` | — |
| PokéAPI | `get-pokemon-details-easy` | `pokemon-contract-medium` | `pokemon-evolution-chain-medium` | `pokeapi-medium` | — |
| DummyJSON | `product-search-medium` | `ecommerce-full-suite-advanced` | `product-price-monitor-medium` | `dummyjson-products-medium` | — |
| REST Countries | `search-countries-easy` | `country-search-medium` | `country-capital-weather-medium` | `rest-countries-medium` | — |

This creates a **learning web** — a user who imports "Get All Users" from the Requests gallery can follow links to:
- Test it → "User API Smoke Test" manual
- See the spec → "JSONPlaceholder API" catalog manual
- Automate it → "Create → Extract → Verify" workflow manual
- Validate it → "API Health Check" assertion manual

### Gallery UI Integration

The gallery detail panel adds a **📖 Manual** button:

```
┌──────────────────────────────────────────────────────┐
│ 🔌 Get All Users                        [Import ▶]  │
│ GET https://jsonplaceholder.../users    [Try It ▶]   │
│ ...                                                   │
└──────────────────────────────────────────────────────┘
```

### Manual Count Summary

| Domain | Overview | Sample Manuals | Total |
|---|---|---|---|
| Requests | 1 | 12 | 13 |
| Catalog | 1 | 6 | 7 |
| Tests | 1 | 8 | 9 |
| Workflows | 1 | 27 existing + 5 new = 32 | 33 |
| Assertions | 1 | 5 | 6 |
| **Total** | **5** | **63** | **68** |

Note: 8 workflow manuals already exist (script-node × 4, async-correlation × 4). Remaining workflow manuals to create: 24 + 5 new = 29.

### Implementation Phases for Manuals

Manuals are built **per domain**, alongside the gallery data for that domain:

| Gallery Phase | Manual Phase | Manuals Created | Status |
|---|---|---|---|
| Phase 2 — Requests & Tests data | Phase 8a — Request manuals | 13 (overview + 12 samples) | ✅ |
| Phase 2 — Requests & Tests data | Phase 8b — Test manuals | 9 (overview + 8 samples) | ✅ |
| Phase 3 — Catalog Specs | Phase 8c — Catalog manuals | 7 (overview + 6 samples) | ✅ |
| Phase 4 — Workflow Migration | Phase 8d — Workflow manuals | 36 (1 master + 4 category overviews + 15 new + 16 existing) | ✅ |
| (already planned) | Phase 8e — Assertion manuals | 6 (overview + 5 samples) | ✅ |

---

## Migration Strategy

### Phase 1 — Type Unification (non-breaking) ✅

1. ~~Update `GalleryEntry<T>` with `domain` and `liveApis` fields~~
2. ~~Make `WorkflowSampleEntry` extend `GalleryEntry<Workflow>` (add `tags`, `liveApis`, `domain`)~~
3. ~~Make `CatalogSpecEntry` extend `GalleryEntry<string>` (add `difficulty`, `tags`, `liveApis`, `domain`)~~
4. ~~Add `domain` + `liveApis` to existing `AssertionPresetEntry` entries~~
5. ~~Keep old type aliases as deprecated re-exports for backward compat~~
6. ~~Create `registry.ts`~~

**Files changed:** `types.ts`, `assertion-presets/index.ts`, + new adapter files
**Files created:** `registry.ts`
**No UI changes** — existing gallery tab continues to work

### Phase 2 — New Request & Test Galleries (data only) ✅

1. ~~Create `src/data/galleries/requests/` — types, 12 factory functions, index~~
2. ~~Create `src/data/galleries/tests/` — types, 8 factory functions, index~~
3. ~~Register in `registry.ts`~~
4. ~~Unit tests for all factories~~

**Result:** 12 request samples + 8 test samples registered

### Phase 3 — Expand Catalog Specs ✅

1. ~~Create `src/data/galleries/catalog-specs/` — migrate 2 existing + add 4 new specs~~
2. ~~Write real OpenAPI 3.0 YAML for JSONPlaceholder, ReqRes, PokéAPI, DummyJSON, REST Countries, HTTPBin~~
3. ~~Deprecate `src/data/sampleCatalogSpecs.ts` → re-export from new location~~ → **Shims removed, file deleted**
4. ~~Unit tests~~

**Result:** 6 catalog spec entries

### Phase 4 — Migrate Workflow Templates ✅

1. ~~Create `src/data/galleries/workflows/` — move all 27 + add 5 new~~
2. ~~`WorkflowSampleEntry` now extends `GalleryEntry<Workflow>`~~
3. ~~Deprecate `src/data/sampleWorkflows/` → re-export from new location~~ → **Shims removed, directory deleted**
4. ~~Update `TemplateGalleryContent` imports to use new paths~~
5. ~~Unit tests~~

**Result:** 25 workflow entries across 5 categories (apiPatterns, asyncCorrelation, eventDriven, flowControl, orchestration)

### Phase 5 — Shared Gallery UI Components ✅

1. ~~Create `src/shared/components/gallery/` — `GalleryGrid`, `GalleryCard`, `GalleryFilters`, `GalleryDetailPanel`, `DifficultyDots`, `DomainBadge`, `LiveApiBadge`~~
2. ~~Extract reusable parts from `TemplateGalleryModal.tsx`~~
3. ~~Unit tests for all components~~

**Result:** 7 components + 39 unit tests in `gallery.test.tsx`

### Phase 6 — Unified Gallery Page ✅

1. ~~Create `GalleryPage.tsx` — assembles shared components + domain tabs~~
2. ~~Add Gallery as a top-level domain in `App.tsx` navigation~~
3. ~~Wire import handlers for each domain (requests, catalog, tests, workflows)~~
4. ~~Keep existing `TemplateGalleryContent` as a thin wrapper (or deprecate)~~
5. ~~CSS styling~~

**Result:** Gallery page with domain sidebar, search, category/difficulty/live-API filters, card grid, detail panel with tabbed preview (requests), sample status tracking

### Phase 7 — New Workflow Samples with Diverse APIs ✅

1. ~~Add 5 new workflow samples using PokéAPI, REST Countries, DummyJSON, Open Library~~
2. ~~These demonstrate multi-API orchestration patterns~~
3. ~~Unit tests~~

**Result:** 30 total workflow entries — 25 original + 5 diverse API samples:
- 🐾 Pokémon Evolution Chain (PokéAPI — linked-resource traversal)
- 🌍 Country Currency Lookup (REST Countries — filter + enrich)
- 🛒 Product Search & Cart (DummyJSON — search → detail → POST)
- 📚 Book Search & Enrichment (Open Library — search + linked-data)
- 📊 Multi-API Dashboard (3 APIs — Fork/Join parallel orchestration)

Training manuals: `docs/training-manuals/workflow/diverse-apis/` (5 HTML files)

### Phase 8 — CLI Examples & Training Manuals ✅

> **Result:** 73 training manual HTML files created across 5 domains + 8 workflow subdirectories.

**Phase 8a — Request manuals (13 files)** ✅
1. ~~`docs/training-manuals/requests/requests.html` — domain overview~~
2. ~~12 sample manuals (one per request gallery entry)~~

**Phase 8b — Test manuals (9 files)** ✅
1. ~~`docs/training-manuals/tests/tests.html` — domain overview~~
2. ~~8 sample manuals (one per test gallery entry)~~

**Phase 8c — Catalog manuals (7 files)** ✅
1. ~~`docs/training-manuals/catalog/catalog.html` — domain overview~~
2. ~~6 sample manuals (one per catalog spec entry)~~

**Phase 8d — Workflow manuals (36 files total)** ✅
1. ~~`docs/training-manuals/workflow/workflow.html` — domain overview~~
2. ~~api-patterns/: 1 overview + 4 samples~~
3. ~~flow-control/: 1 overview + 5 samples~~
4. ~~event-driven/: 1 overview + 3 samples~~
5. ~~orchestration/: 1 overview + 4 samples~~
6. ~~script-node/: 1 overview + 3 samples (existing)~~
7. ~~async-correlation/: 1 overview + 4 samples (existing)~~
8. ~~diverse-apis/: 5 samples (existing)~~
9. ~~node-reference/: 1 reference (existing)~~

**Phase 8e — Assertion manuals (6 files)** ✅
1. ~~`docs/training-manuals/assertions/assertions.html` — domain overview~~
2. ~~5 sample manuals (one per assertion preset)~~

**Total manual files: 73** (5 domain overviews + 8 category overviews + 60 sample/reference manuals)

### Phase 9 — E2E Tests & Quality Gate

1. E2E tests for gallery navigation, filtering, import actions
2. Full test suite pass
3. Coverage >90% on new files

---

## File Count Estimates

| Phase | New Files | Modified Files | Status |
|---|---|---|---|
| 1 — Type Unification | 1 | 5 | ✅ |
| 2 — Requests & Tests data | 6 | 1 | ✅ |
| 3 — Catalog Specs | 3 | 2 | ✅ |
| 4 — Workflow Migration | 8 | 3 | ✅ |
| 5 — Shared UI | 8 | 1 | ✅ |
| 6 — Gallery Page | 3 | 2 | ✅ |
| 7 — New Workflow Samples | 2 | 1 | ✅ |
| 8 — CLI & Manuals | 73 manuals | 1 | ✅ |
| 9 — E2E & QA | 2 | 1 | ❌ |
| **Total** | **~120** | **~18** | **8/9 done** |

---

## Design Decisions & Rationale

### Why `GalleryEntry<T>` as the base?
- Already exists, proven pattern
- Generic `T` allows type-safe factories per domain
- `factory: () => T` keeps data lazy (no upfront cost)

### Why `liveApis` field?
- Users see which real API the sample hits → builds trust
- Enables an "API" filter in the gallery sidebar
- Future: could show API health status badges

### Why top-level Gallery domain?
- Gallery spans all features — it's not "workflow templates" anymore
- Users expect a single place to browse all available samples
- Avoids hunting through 4 different tabs for examples

### Why not a modal?
- Gallery has too much content for a modal (50+ entries across 5 domains)
- Full-page layout enables detail panel, filters, search
- Consistent with modern tool UX (VS Code extensions, Figma community, etc.)

### Why these specific public APIs?
- All are **free, no API key required, CORS-friendly**
- Cover diverse response shapes (arrays, nested objects, paginated, linked resources)
- Collectively demonstrate: CRUD, search, pagination, auth flows, nested data, multi-API orchestration
- Have been stable for years (JSONPlaceholder since 2014, PokéAPI since 2016)

### Future Extension Points

Adding a new gallery domain (e.g. "Environments", "Mocks") requires:

1. Create `src/data/galleries/<domain>/types.ts` extending `GalleryEntry<T>`
2. Create factory functions in `presets.ts`
3. Export catalog array in `index.ts`
4. Register in `registry.ts`
5. Add import handler in `GalleryPage.tsx`

No changes to shared components, types, or existing galleries needed.

---

## Cross-Reference: Public API → Gallery Entries

| Public API | Requests | Catalog | Tests | Workflows | Assertions |
|---|---|---|---|---|---|
| JSONPlaceholder | ✅ 3 | ✅ 1 | ✅ 1 | ✅ (existing) | ✅ 2 |
| ReqRes | ✅ 2 | ✅ 1 | ✅ 2 | — | — |
| DummyJSON | ✅ 1 | ✅ 1 | ✅ 2 | ✅ 1 | — |
| PokéAPI | ✅ 1 | ✅ 1 | ✅ 1 | ✅ 1 | — |
| REST Countries | ✅ 1 | ✅ 1 | ✅ 1 | ✅ 1 | — |
| Dog CEO | ✅ 1 | — | — | — | — |
| Cat Facts | — | — | — | — | — |
| Open Library | ✅ 1 | — | — | ✅ 1 | — |
| HTTPBin | ✅ 1 | ✅ 1 | — | — | — |
| FakeStore | — | — | ✅ 1 | — | ✅ 1 |

**Total entries:** 12 requests + 6 catalog + 8 tests + 32 workflows + 5 assertions = **63 gallery entries**
