# API Mock Studio — Phase 12D / 12E Docs, Demos & Release Pass

> **Branch:** `feautre/apimock`  
> **Status:** Planning only — **not started**. Product code through **12A–12C** (+ P0–P3 polish) is shipped; this document scopes the deferred **12D–12E** docs/release pass.  
> **Created:** 2026-08-13  
> **Parent plan:** [`apimock-studio-plan.md`](./apimock-studio-plan.md) (§11.3, Phase 12)  
> **Policy:** Update this file as each 12D/12E deliverable lands. Do not claim features in public docs that §6 marks as limited or deferred.

---

## 1. Purpose

Phases **12D** and **12E** turn a shipped product into a **documentable, demoable, merge-ready** feature:

| Phase | Goal |
|---|---|
| **12D** | Authoritative written docs + an exact end-to-end training walkthrough that matches the real UI on **web and Tauri**. |
| **12E** | Gallery samples, Demo Hub lessons, selector catalog, Playwright multi-server E2E, and product-surface sync (`README` / `ROADMAP` / `CHANGELOG` / conventions). |

This file is the **execution checklist** for that pass. It was produced by comparing `apimock-studio-plan.md` against the current implementation under:

- `src/features/api-mock/`
- `src/shared/api-mock/`
- `src-server/api-mock/` + `src-server/routes/api-mock/`
- `src-tauri/src/api_mock/` (native listener)
- `cli/mockCommands.ts` + `examples/api-mock/`
- Workflow / Test Runner integration
- Existing plan fixtures & mockups under `docs/plan/future/apimock/`

---

## 2. Current state (gap analysis)

### 2.1 Already shipped (do not rebuild — reference from docs)

| Area | What exists |
|---|---|
| Product UI | Studio / Runtime / Conflicts IA; multi-server tabs; rule editor; Pattern Toolbox; Simulate; Import Review; Server Settings (Proxy + TLS/mTLS); Runtime Settings; Conflict Inspector; Live Strip; undo-on-delete |
| Engine | Matching, selection policies, conflict analysis, simulation, templates + curated Faker, faults, scenario state, journal, diagnostics |
| Network (Node companion) | HTTPS, HTTP/2 on TLS, mTLS, unmatched proxy + record-as-drafts, callbacks, transforms, journal persist-to-disk |
| Network (Tauri native) | Listen/journal via Rust listener (HTTP/1.1); capability warnings for unsupported subset |
| CLI | `mock simulate`, `mock verify`, `mock start` (+ `--standalone`) — documented in `cli/README.md` |
| Examples | `examples/api-mock/` (sample workspace, Dockerfile, CI snippet) |
| Workflow | `apiMockStart` / `Apply` / `ResetState` / `Stop` / `AssertCalls` |
| Test Runner | Optional API Mock fixture panel + isolate-run helpers |
| Import | cURL, OpenAPI, Catalog, Requests, native export, WireMock, HAR |
| Export | Workspace JSON/YAML, server/routes JSON, WireMock (+ loss report), HAR journal (+ loss report) |
| Plan artifacts | Full phase plan, 8 interactive mockups + screenshots, conformance fixtures under `docs/plan/future/apimock/fixtures/` |
| Hardening | 12A perf budgets, 12B automated a11y wiring, 12C recovery helpers + persistence |

### 2.2 Missing (this pass owns)

| Deliverable | Status today |
|---|---|
| Standalone guides / training manual under `docs/guides/` | **None** |
| Product architecture / security / ops docs (user-facing) | **Only inside the plan** |
| Gallery domain `api-mock` | **Not in** `GalleryDomain` / registry / training paths |
| Demo Hub lessons | **Zero** files under `packages/demo-hub` for API Mock |
| Playwright E2E (`e2e/*api-mock*`) | **None** |
| Top-level `README.md` / `ROADMAP.md` / `CHANGELOG.md` | **No API Mock Studio section** |
| `.cursor/rules/project-conventions.mdc` key-file row | **Not synced** |
| Centralized selectors | `src/shared/selectors/apiMock.ts` exists (**22** constants) but is **not** barrel-exported from `selectors.ts` and is **unused**; 100+ inline `data-testid`s in components |
| 12B manual a11y / 200% zoom human pass | **Not recorded** |
| Fresh-import walkthrough evidence (web + Tauri) | **Not recorded** |

---

## 3. Non-goals

- Re-implementing engine features already shipped in earlier phases.
- Treating mockups under `docs/plan/future/apimock/mockups/` as end-user docs (they remain design evidence).
- Claiming **full mitmproxy-style interception**, external mock-payload telemetry, or 100% WireMock/OpenAPI fidelity.
- Claiming native Tauri parity with the Node companion (document the subset honestly — §6).
- Full Demo Hub lesson wrapper unit-test bar — use the **5-item demo lesson done checklist** when lessons land.

---

## 4. Phase 12D — Documentation & training manual

### 4.1 Document set (proposed file layout)

Create under `docs/guides/api-mock/` (new folder):

| File | Audience | Contents |
|---|---|---|
| `README.md` | Index | Links to all guides below + “Start here” path (web vs Tauri) |
| `getting-started.md` | New users | Install/run prerequisites, create first server, Start, hit with Requests or cURL, read journal |
| `studio-walkthrough.md` | Training | **Exact click-by-click** E2E sample (see §4.3) — web **and** Tauri columns where UI differs |
| `architecture.md` | Advanced / ops | Control plane (`:3001`) vs data-plane listeners; `serverId` identity; hot-apply generations; web companion vs Tauri native |
| `contracts.md` | Integrators | Workspace envelope, `ApiMock*V1` overview, fingerprints, import/export shapes, capability gates |
| `matching-and-conflicts.md` | Authors | Path kinds, predicate tree, selection policies, Conflict Inspector kinds, Apply severity gate |
| `runtime-and-journal.md` | Authors / QA | Transactions, state, variables, settings, diagnostics, redaction, fallback modes |
| `tls-mtls-proxy.md` | Authors / security | HTTPS, self-signed generation, mTLS CA + client credentials, unmatched proxy + record-as-drafts |
| `import-export.md` | Authors | All 7 import sources, merge/replace/copy, WireMock/HAR loss reports, Catalog/Requests promotion |
| `cli-and-ci.md` | Automation | `mock simulate|verify|start`, Docker example, GitHub Actions snippet (expand `examples/api-mock/README.md`) |
| `workflow-and-test-runner.md` | Automation | Workflow nodes + Test Runner fixture + isolation |
| `troubleshooting.md` | Support | Companion unavailable, port in use / ownership, corrupt storage, native capability warnings, journal drops |
| `security.md` | Security | Redaction, secret stripping on export/duplicate, no PEM in journal, proxy anti-recursion, fail-closed native operators |
| `migration.md` | Maintainers | Schema version / `migrateWorkspace`, what happens on unsupported versions |

Also update (light touch in 12D, finalize in 12E):

- Cross-link from `examples/api-mock/README.md` → guides
- Optional: short “API Mock” stub in `docs/guides/` index if one exists later

### 4.2 Architecture doc — required topics (from implementation)

1. **Tab = Mock Server** (durable definition + runtime lifecycle).
2. **Control plane** at companion port `3001` (`/api/mock/...`) vs **data plane** on user ports (`4600+`).
3. **Identity** is `serverId`, not port.
4. **Hot-apply**: validate → atomic commit → bump generation; in-flight requests pinned to prior generation.
5. **Web**: Node companion required for listen (`npm run server:dev`).
6. **Tauri desktop**: native Rust listener for listen/journal; companion still used for TLS cert generation and other protocols.
7. **Persistence**: workspace envelope via storage abstraction (`api-mock-workspace-v1`); runtime status reconciled live, not trusted from disk.
8. **Safety ceilings**: body size, connections, journal size, route counts (point at `HARD_CEILINGS` / Runtime Settings).

### 4.3 Training walkthrough spine (must match live UI labels)

Use a **fresh workspace** each pass. Prefer importing a published Gallery/export sample once 12E samples exist; until then use `examples/api-mock/sample-workspace.json` plus an extended “Users API” fixture derived from `docs/plan/future/apimock/fixtures/valid-server-with-routes.json`.

#### Track A — Core (required for 12D exit)

| Step | Action (labels must match product) | Expected |
|---|---|---|
| A1 | Protocols → **API Mock** | Empty state or restored workspace |
| A2 | Create **Mock Server** (or import sample) | Tab appears; port shown (e.g. `:4600`) |
| A3 | **Studio** → add route `GET /health` (or sample route) | Route in explorer; editor opens |
| A4 | **Response → Content** set JSON body; Save/dirty clear as designed | Variant body visible |
| A5 | Server bar → **Start** | Status **Running**; listen URL copyable |
| A6 | **Requests** (or cURL) hit listen URL | 200 + body |
| A7 | **Runtime → Transactions** | Journal row; outcome matched |
| A8 | Edit route body → **Apply** | Generation bumps; new traffic sees new body |
| A9 | **Simulate** modal on a sample | Offline match trace without side effects |
| A10 | **Stop** | Status Stopped; listen fails |

#### Track B — Matching & Conflicts (required)

| Step | Action | Expected |
|---|---|---|
| B1 | Two overlapping routes (same method/path, different priorities/predicates) | Conflict Inspector findings |
| B2 | Filters by kind; open witness → **Simulate** | Witness request seeded |
| B3 | Adjust priority / acknowledge | Apply gate behavior matches severity policy |
| B4 | Pattern Toolbox → JSONPath on array field | Path like `$.items[0].sku`; Add conditions |

#### Track C — Import / Export (required)

| Step | Action | Expected |
|---|---|---|
| C1 | Import **cURL** | Preview + merge into server |
| C2 | Import **OpenAPI** snippet | Stub routes created |
| C3 | Export **Workspace JSON** | Redacted envelope downloads |
| C4 | Export **WireMock** | Mappings + loss report present when features are lossy |
| C5 | Catalog or Requests → **Export to API Mock** | Modal → rules appear in Studio |

#### Track D — Runtime settings & journal (required)

| Step | Action | Expected |
|---|---|---|
| D1 | Runtime → **Settings** | Selection / CORS / limits / journal / fallback / LAN |
| D2 | Toggle redaction headers; send `Authorization` | Journal redacts |
| D3 | Fallback **closest match debug** unmatched | Debug body explains near miss |
| D4 | **State** / **Variables** / **Diagnostics** tabs | Readable without raw secrets |

#### Track E — TLS / Proxy / Faults (advanced; document as companion-capable)

| Step | Action | Expected |
|---|---|---|
| E1 | Server Settings → **TLS** enable + generate | HTTPS listen (companion); note native HTTP/1.1 |
| E2 | mTLS CA + issue client credential | Client cert required when enabled |
| E3 | Unmatched → **Proxy** allowlisted upstream + record drafts | Proxied outcome; drafts mergeable |
| E4 | Fault variant (timeout / reset) | Journal fault outcome |

#### Track F — Automation (advanced)

| Step | Action | Expected |
|---|---|---|
| F1 | CLI `mock simulate` on sample file | JSON/JUnit exit 0 |
| F2 | CLI `mock start --standalone` | Port serves `/health` |
| F3 | Workflow: Start → HTTP → AssertCalls → Stop | Trace shows mock port / assertions |
| F4 | Test Runner fixture panel | Isolated mock for run; teardown |

### 4.4 Screenshot / evidence requirements (12D exit)

For Track A–C at minimum:

- [ ] Web Chrome screenshots (desktop) with current labels
- [ ] Tauri screenshots where chrome differs (native capability banner, HTTP/1.1 badge)
- [ ] Store under `docs/guides/api-mock/screenshots/` (or attach to a validation record)
- [ ] Commands in docs copy-paste verified on a clean clone

### 4.5 12D exit criteria

- [ ] All files in §4.1 exist and link correctly from the index
- [ ] Track A–C walkthroughs pass on **fresh web** and **fresh Tauri** workspaces
- [ ] Docs never claim native features listed in §6 as full-parity
- [ ] CLI section matches `cli/README.md` + `examples/api-mock/`
- [ ] Parent plan Phase 12D row updated to **Completed** with date

---

## 5. Phase 12E — Gallery, Demo Hub, E2E, release sync

Depends on **12D** drafts being accurate enough that lesson narration and Gallery descriptions do not lie.

### 5.1 Selectors first (blocking for demos + E2E)

| Task | Detail |
|---|---|
| Expand `src/shared/selectors/apiMock.ts` | Cover Studio nav, server bar, route explorer, dock/page tabs, Simulate, Import, Conflict Inspector, Pattern Toolbox, Runtime Settings, TLS/Proxy controls |
| Export from `src/shared/selectors.ts` | `export { API_MOCK } from './selectors/apiMock'` (or named `AMS` alias if preferred — pick one and stick to it) |
| Replace lesson/E2E raw strings | Lessons and Playwright must import constants; no inline `'[data-testid="api-mock-…"]'` in new code |
| Audit | Grep for `data-testid="api-mock-` and ensure critical paths are named |

### 5.2 Gallery samples

Add domain **`api-mock`** to:

- `src/data/galleries/types.ts` (`GalleryDomain`)
- `src/data/galleries/registry.ts`
- `src/data/galleries/trainingPaths/contentPaths.ts` (optional path)
- New folder e.g. `src/data/galleries/api-mock/`

#### Proposed sample pack

| ID | Name | Teaches | Contents |
|---|---|---|---|
| `am-gallery-health` | Health check mock | First Start + journal | Single server `:4600`, `GET /health` |
| `am-gallery-users` | Users API | Parameterized path, JSON body, examples | Routes from plan fixture “Users API” |
| `am-gallery-conflicts` | Ambiguous routes | Conflict Inspector | Two overlapping GETs + witness samples |
| `am-gallery-states` | Scenario state | State machine / sequence variant | Login → stateful GET |
| `am-gallery-faults` | Fault injection | Timeout / reset | One route with fault variant |
| `am-gallery-openapi` | From OpenAPI | Import story | Pre-imported stub set + note to re-import |
| `am-gallery-workflow` | Workflow fixture | Start/Assert/Stop | Tiny workflow JSON referencing mock definition |

**Exit:** each sample imports cleanly into a wiped workspace and Track A (or its specialty track) passes.

### 5.3 Demo Hub lessons

Follow `docs/guides/demo-lesson-done-checklist.md` (5 items). Prefer a small roster over a large unfinished set.

#### Proposed lesson roster

| Lesson ID | Title | Est. min | Beats |
|---|---|---|---|
| `AM-1` | Create & Start a Mock Server | 3–4 | Empty → create → Start → cURL/Requests → journal |
| `AM-2` | Author a Route & Hot-Apply | 4 | Match + Response → Apply → generation |
| `AM-3` | Pattern Toolbox & Predicates | 5 | JSONPath / constraints → Add conditions |
| `AM-4` | Conflict Inspector | 4 | Overlap → analyze → witness → priority |
| `AM-5` | Import from cURL / OpenAPI | 4 | Import Review → merge |
| `AM-6` | Runtime Journal & Settings | 4 | Transactions filter, redaction, fallback |
| `AM-7` *(optional)* | TLS basics (companion) | 5 | Enable HTTPS, hit with Requests TLS |
| `AM-8` *(optional)* | Workflow Start → Assert → Stop | 5 | Designer nodes |

**Lesson engineering rules (from repo demo conventions):**

- Import only via `@redfireforge/demo-hub` adapters — add `apiMockStudioAdapter` if missing
- Selectors from `API_MOCK` constants only
- One concept per step; close modals before canvas/studio steps
- `preAction` guards for rapid Next
- Collapse app sidebars when they steal space (mirror workflow helpers if needed)

### 5.4 Playwright E2E

#### Required multi-server scenario (plan §12.2)

Script as `e2e/api-mock-multi-server.spec.ts` (name flexible):

1. Open API Mock Studio  
2. Users API `:4600`, Payments API `:4601`  
3. Start both → green / Running tabs  
4. Send from Requests Studio to each listener  
5. Distinct bodies + journals  
6. Hot-apply Users only → Payments unchanged  
7. Third server on `:4600` → ownership / port conflict  
8. Stop Users → Payments still running  
9. Restart app/control plane → reconciliation  

#### Additional focused specs (plan §12.1 #5)

| Spec theme | Coverage |
|---|---|
| Hot apply | Dirty → Apply → generation |
| Import | cURL + OpenAPI happy paths |
| Promotion | Catalog/Requests → Export to API Mock |
| Conflicts | Pre-Apply warning / inspector |
| Near miss | Closest-match debug fallback |
| State | Scenario transition visible in Runtime → State |
| Persistence | Reload reconciles stopped/running correctly |

**Prereq:** companion on `:3001` for web E2E (document in spec header / `webServer` config). Prefer isolated project `demo-api-mock` or `api-mock` with `workers: 1` for listen-port tests.

### 5.5 Product surface sync

| File | Update |
|---|---|
| `README.md` | Feature row: API Mock Studio (multi-server local HTTP mock, import/export, CLI) |
| `ROADMAP.md` | Mark API Mock Studio shipped / docs-demo pass |
| `CHANGELOG.md` | `[Unreleased]` → Added API Mock Studio (+ bullets for Studio/Runtime/Conflicts, CLI, workflow, TLS) |
| `.cursor/rules/project-conventions.mdc` | Key files table: Studio page, shared contracts, control routes, CLI |
| `apimock-studio-plan.md` | Mark 12D–12E complete; tick acceptance checkboxes |
| This file | Check off §7 |

### 5.6 Manual a11y / zoom pass (12B leftover)

Record evidence in `docs/guides/api-mock/a11y-zoom-pass.md` (short):

- [ ] Keyboard: server tabs, route list, Studio/Runtime/Conflicts, modals (footer actions, Escape)
- [ ] Screen reader: live region announcements for create/delete
- [ ] Contrast: badges/status on dark theme
- [ ] 200% zoom desktop + tablet + mobile widths (use Studio responsive drawer)

### 5.7 12E exit criteria

- [ ] Selectors exported and used by lessons + E2E  
- [ ] ≥3 Gallery samples import/run  
- [ ] ≥4 Demo Hub lessons pass the 5-item checklist  
- [ ] Multi-server Playwright spec green (HTML report)  
- [ ] README / ROADMAP / CHANGELOG / conventions updated  
- [ ] Parent plan 12E row **Completed**  
- [ ] User approval before merge to `develop` (per branching rules)

---

## 6. Honest limitations (docs & demos must not over-claim)

| Topic | Truth in product |
|---|---|
| Web without companion | Start/Apply/journal fail with companion-unavailable guidance (`npm run server:dev`) |
| Tauri native listener | HTTP/1.1 only; warns/blocks unsupported: HTTP/2, proxy/recording, callbacks, transforms, journal disk persist, full faker, many faults, some body operators (xpath/xmlSchema/multipart fail-closed) |
| Node companion | Full feature set including HTTP/2 on TLS, proxy, callbacks, all faults |
| WireMock export | Subset + **loss report** |
| HAR import/export | Size/redaction limits |
| OpenAPI import | Stub generation, not full contract fidelity |
| Pattern Toolbox | Helper for authoring — runtime parity evaluator, not a separate engine |
| External interception product | Out of scope |

---

## 7. Execution checklist (ordered)

### 12D

1. [ ] Scaffold `docs/guides/api-mock/` + index  
2. [ ] Write `getting-started.md` + `studio-walkthrough.md` (Tracks A–C) against live UI  
3. [ ] Write architecture / contracts / matching / runtime / import-export  
4. [ ] Write TLS-proxy, CLI-CI, workflow-test-runner, troubleshooting, security, migration  
5. [ ] Capture web + Tauri screenshots for Track A  
6. [ ] Validate walkthroughs from wiped storage  
7. [ ] Update parent plan 12D status  

### 12E

8. [ ] Complete + export `API_MOCK` selectors  
9. [ ] Gallery domain + first 3 samples  
10. [ ] Demo Hub adapter + AM-1…AM-4 lessons  
11. [ ] Playwright multi-server + 2 focused specs  
12. [ ] Remaining optional lessons/samples (AM-5+, gallery pack)  
13. [ ] README / ROADMAP / CHANGELOG / conventions  
14. [ ] Manual a11y/zoom evidence  
15. [ ] Full product coverage gate + Playwright HTML report (merge gate)  
16. [ ] User verify → merge feature branch → delete branch  

---

## 8. Mapping back to parent plan

| Parent plan item | Covered here |
|---|---|
| Phase 12D row (architecture…training walkthrough) | §4 |
| Phase 12 deliverable #4 Training manual | §4.3 |
| Phase 12 deliverable #5 Demo Hub + Gallery | §5.2–5.3 |
| Phase 12 deliverable #6 Security/migration/ops docs | §4.1 |
| Phase 12 acceptance: web+Tauri walkthrough | §4.4–4.5 |
| Phase 12 acceptance: full quality gates / Playwright | §5.4, §5.7 |
| §11.3 “12D–12E later” bullet | This entire document |
| §12.1 #5 Playwright topics | §5.4 |
| §12.2 Multi-server E2E | §5.4 |
| 12B manual zoom pass | §5.6 |

---

## 9. Suggested ownership split

| Stream | Owner focus | Parallelizable? |
|---|---|---|
| Docs prose + screenshots | 12D | Starts immediately |
| Selectors + Gallery JSON | 12E early | After Track A labels freeze |
| Demo Hub lessons | 12E | After selectors |
| Playwright | 12E | After selectors + sample fixtures |
| README/CHANGELOG | 12E late | After feature set frozen |

Docs may start before Gallery exists by pointing at `examples/api-mock/sample-workspace.json` and plan fixtures; **revisit links** when Gallery IDs land.

---

## 10. Definition of done (12D + 12E)

A new engineer can:

1. Read `docs/guides/api-mock/README.md` and run Track A on web **and** Tauri without asking the team.  
2. Import a Gallery sample and hit a running mock from Requests.  
3. Play Demo Hub **AM-1** at 1× and finish with a visible journal row.  
4. Run `npx playwright test` for the API Mock multi-server project and get green.  
5. Find API Mock described in README / CHANGELOG / ROADMAP consistently with this branch.

Only then mark Phase **12** complete in `apimock-studio-plan.md` and request merge approval.
