# API Mock Studio — Phase 12D / 12E Docs, Demos & Release Pass

> **Branch:** `feautre/apimock`  
> **Status:** **12D exit met** (2026-08-13) — guides + Tracks A–C evidence on web and Tauri in [`VALIDATION_RECORD.md`](../../guides/api-mock/screenshots/VALIDATION_RECORD.md). **12E in progress** — selectors + Gallery + multi-server Playwright done; Demo Hub is on [curriculum v2](./apimock-demo-curriculum-v2.md) (`am-01-studio-tour`, `am-02-multi-server`, `am-03-rule-library`, `am-04-path-matching`, `am-05-request-predicates` shipped — 12E lesson bar met); README/CHANGELOG/focused specs still open.  
> **Created:** 2026-08-13  
> **Last updated:** 2026-08-13  
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
| Network (Tauri native) | Listen/journal via Rust listener. TLS serves **HTTP/2** (`h2` ALPN + HTTP/1.1 fallback; no h2c). Proxy, recording drafts, callbacks, transforms, faker, journal disk, passphrase TLS, and xpath/xml/multipart run natively. `analyzeNativeUnsupported` currently returns empty. Sidecar still used for TLS cert generation and Kafka/GraphQL/webhooks. |
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
| Standalone guides / training manual under `docs/guides/` | **Done** — `docs/guides/api-mock/` + Tracks A–C evidence in `screenshots/VALIDATION_RECORD.md` |
| Product architecture / security / ops docs (user-facing) | **Authored** — see guide index |
| Gallery domain `api-mock` | **Not in** `GalleryDomain` / registry / training paths |
| Demo Hub lessons | **Zero** files under `packages/demo-hub` for API Mock |
| Playwright E2E (`e2e/*api-mock*`) | Demo smoke: `npm run test:e2e:demo:am1`…`am4`. Product multi-server: `npm run test:e2e:api-mock-multi-server` (`e2e/api-mock-multi-server.spec.ts`). |
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
- Claiming identical native vs Node behavior in every edge case (document intentional differences in §6). Do not describe native listen as HTTP/1.1-only.
- Full Demo Hub lesson wrapper unit-test bar — use the **5-item demo lesson done checklist** when lessons land.

---

## 4. Phase 12D — Documentation & training manual

### 4.1 Document set (`docs/guides/api-mock/`) — **authored 2026-08-13**

| File | Audience | Status |
|---|---|---|
| `README.md` | Index | **Done** |
| `getting-started.md` | New users | **Done** |
| `studio-walkthrough.md` | Training Tracks A–F | **Done** |
| `architecture.md` | Advanced / ops | **Done** |
| `contracts.md` | Integrators | **Done** |
| `matching-and-conflicts.md` | Authors (incl. Pattern Toolbox XPath/Schema) | **Done** |
| `runtime-and-journal.md` | Authors / QA | **Done** |
| `tls-mtls-proxy.md` | Authors / security | **Done** |
| `import-export.md` | Authors | **Done** |
| `cli-and-ci.md` | Automation | **Done** |
| `workflow-and-test-runner.md` | Automation | **Done** |
| `templates-and-responses.md` | Authors (variants, Faker, faults, Outbound, Data Mapper) | **Done** *(added in review — was missing from first draft)* |
| `operations.md` | Ops (ports, soak, backup) | **Done** *(added in review)* |
| `compatibility.md` | Web vs Tauri matrix | **Done** *(added in review)* |
| `troubleshooting.md` | Support | **Done** |
| `security.md` | Security | **Done** |
| `migration.md` | Maintainers | **Done** |
| `screenshots/VALIDATION_RECORD.md` | Evidence checklist | **Scaffolded** — Tracks A–C human pass open |

Also updated:

- [x] Cross-link from `examples/api-mock/README.md` → guides
- [ ] Optional `docs/guides/` hub index (none exists yet — skip until a docs index is introduced)

#### Review gaps closed vs first checklist draft

| Gap found against implementation | Where documented |
|---|---|
| Pattern Toolbox tabs include **XPath** + **Schema** (not only regex/path/jsonpath/constraints) | `matching-and-conflicts.md` |
| Response **Outbound** (callbacks/transforms) + **Map body** Data Mapper | `templates-and-responses.md`, `tls-mtls-proxy.md` |
| Server Settings tabs vs Runtime Settings page | `runtime-and-journal.md` |
| Runtime tabs include **Diagnostics** | `runtime-and-journal.md` |
| Curated Faker helper path list | `templates-and-responses.md` |
| Explicit web↔native matrix from `analyzeNativeUnsupported` | `compatibility.md` |
| Persistence key `api-mock-workspace-v1` + reconcile rules | `architecture.md`, `migration.md` |
| Operations / port map / backup | `operations.md` |

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

#### Track E — TLS / Proxy / Faults (advanced; both runtimes)

| Step | Action | Expected |
|---|---|---|
| E1 | Server Settings → **TLS** enable + generate | HTTPS listen; server bar **HTTP/2** badge on web and Tauri. Companion still generates PEMs. |
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
- [ ] Tauri screenshots where chrome differs (HTTP/2 badge on TLS; sidecar still used for cert generation)
- [ ] Store under `docs/guides/api-mock/screenshots/` (or attach to a validation record)
- [ ] Commands in docs copy-paste verified on a clean clone

### 4.5 12D exit criteria

- [x] All files in §4.1 exist and link correctly from the index
- [ ] Track A–C walkthroughs pass on **fresh web** and **fresh Tauri** workspaces *(human — `VALIDATION_RECORD.md`)*
- [x] Docs match §6 and [compatibility.md](../../guides/api-mock/compatibility.md) (HTTP mock feature-complete on native; sidecar for TLS PEMs and other protocols; intentional diffs listed honestly)
- [x] CLI section matches `cli/README.md` + `examples/api-mock/`
- [x] Parent plan Phase 12D row updated (docs authored; full **Completed** after evidence)

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
| `am-gallery-suite` | Simulation suite | Simulate as a test suite | Eight samples with expectations (pass, ambiguous, fault, unmatched, weighted, state, unassociated) |
| `am-gallery-response` | Plain 200 JSON | Response content | Single `GET /orders` answering `200 {}` |
| `am-gallery-states` | Scenario state | State machine / sequence variant | Login → stateful GET |
| `am-gallery-faults` | Fault injection | Timeout / reset | One route with fault variant |
| `am-gallery-openapi` | From OpenAPI | Import story | Pre-imported stub set + note to re-import |
| `am-gallery-workflow` | Workflow fixture | Start/Assert/Stop | Tiny workflow JSON referencing mock definition |

**Exit:** each sample imports cleanly into a wiped workspace and Track A (or its specialty track) passes.

### 5.3 Demo Hub lessons

**Moved** to [`apimock-demo-curriculum-v2.md`](./apimock-demo-curriculum-v2.md) (v1 roster in
[`apimock-studio-demo-lessons.md`](./apimock-studio-demo-lessons.md) is superseded and its 8 lessons
are deleted).

Summary: **24** planned (`am-01-studio-tour` … `am-24-*`), shipped one at a time against the 5-item
done checklist. **≥4** lessons required for 12E exit.

| Lesson | Id | Steps | E2E project |
|---|---|---:|---|
| Studio Tour & Your First Mock | `am-01-studio-tour` | 8 | `demo-am01` |
| Multi-Server Workspace: Tabs, Ports & Binding | `am-02-multi-server` | 8 | `demo-am02` |
| Rule Library: Folders, Search, Filters & Docs | `am-03-rule-library` | 8 | `demo-am03` |
| Path Matching & the Pattern Toolbox | `am-04-path-matching` | 7 | `demo-am04` |
| Query, Header, Cookie & Security Conditions | `am-05-request-predicates` | 8 | `demo-am05` |
| Body Matching: Subset, Strict, JSONPath & JSON Schema | `am-06-body-matching` | 6 | `demo-am06` |
| Forms, Multipart, XML & Binary Matching | `am-07-payload-formats` | 7 | `demo-am07` |
| Boolean Groups, Priority & Selection Policy | `am-08-selection-policy` | 8 | `demo-am08` |
| Conflict Inspector: Four Overlap Kinds | `am-09-conflicts` | 8 | `demo-am09` |
| Response Content: Status, Headers, Cookies & Body Kinds | `am-10-response-content` | 8 | `demo-am10` |
| Dynamic Responses: Templates, Faker & Body Mapper | `am-11-templating` | 9 | `demo-am11` |
| Response Variants: Rules & Sequence Modes | `am-12-variants-sequence` | 8 | `demo-am12` |
| Stateful Mocks: State Machine, Counters & Weighted Chaos | `am-13-stateful` | 8 | `demo-am13` |
| Latency, Eligibility & Connection Faults | `am-14-timing-faults` | 8 | `demo-am14` |
| Import Everything: cURL, OpenAPI, WireMock, HAR, Catalog | `am-15-import` | 9 | `demo-am15` |
| Export & Round-Trip: JSON/YAML, WireMock, HAR, Redaction | `am-16-export` | 7 | `demo-am16` |
| Proxy Passthrough & Record-to-Drafts | `am-17-proxy-record` | 8 | `demo-am17` |
| Journal Forensics: Near-Misses, Candidates & Promotion | `am-18-journal` | 8 | `demo-am18` |
| Runtime Ops: CORS, Limits, Redaction, Diagnostics & Console | `am-19-runtime-ops` | 8 | `demo-am19` |
| HTTPS, HTTP/2 & mTLS with Cert-Subject Matching | `am-20-tls-mtls` | 8 | `demo-am20` |
| Simulation as a Test Suite: Examples, Seeds, Assertions, Trace | `am-21-simulation-suite` | 8 | `demo-am21` |
| Workflow Orchestration: Start → Apply → Reset → Assert → Stop | `am-22-workflow` | 9 | `demo-am22` |
| Test Runner Fixtures & CI Handoff | `am-23-harness-ci` | 7 | `demo-am23` |
| Ship a Contract Mock | `am-24-capstone` | 9 | `demo-am24` |

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
- [x] Multi-server Playwright spec green (HTML report) — `npm run test:e2e:api-mock-multi-server`  
- [ ] ≥2 additional focused Playwright specs (hot-apply / import / conflicts / …) 
- [ ] README / ROADMAP / CHANGELOG / conventions updated  
- [ ] Parent plan 12E row **Completed**  
- [ ] User approval before merge to `develop` (per branching rules)

---

## 6. Honest limitations (docs & demos must not over-claim)

| Topic | Truth in product |
|---|---|
| Web without companion | Start/Apply/journal fail with companion-unavailable guidance (`npm run server:dev`) |
| Tauri native listener | HTTPS `h2` + HTTP/1.1 fallback (no h2c on plaintext). HTTP mock features run natively; `analyzeNativeUnsupported` is empty. Sidecar still used for TLS cert generation and Kafka/GraphQL/webhooks. Intentional diffs: commit does not rebind port/TLS; XML Schema is an element-presence subset; native malformed faults RST_STREAM one h2 stream (Node destroys the session). |
| Node companion | Same HTTP mock feature set including HTTP/2 on TLS, proxy, callbacks, transforms, faker, faults |
| WireMock export | Subset + **loss report** |
| HAR import/export | Size/redaction limits |
| OpenAPI import | Stub generation, not full contract fidelity |
| Pattern Toolbox | Helper for authoring — runtime parity evaluator, not a separate engine |
| External interception product | Out of scope |

---

## 7. Execution checklist (ordered)

### 12D

1. [x] Scaffold `docs/guides/api-mock/` + index  
2. [x] Write `getting-started.md` + `studio-walkthrough.md` (Tracks A–C) against live UI labels  
3. [x] Write architecture / contracts / matching / runtime / import-export  
4. [x] Write TLS-proxy, CLI-CI, workflow-test-runner, troubleshooting, security, migration  
5. [x] Write templates-and-responses / operations / compatibility (review gaps)  
5b. [x] Refresh guides for native HTTP/2/proxy/callback parity, CORS, recorded-draft poll, SSRF ceilings, route-delete undo, tab chrome, Live strip, JSONPath toolbox  
6. [x] Capture web + Tauri screenshots for Track A (see `VALIDATION_RECORD.md`)  
7. [x] Validate walkthroughs from wiped storage (web Playwright + Tauri MCP; Tracks A–C)  
8. [x] Update parent plan 12D status (exit met)  

### 12E

8. [x] Complete + export `API_MOCK` selectors (`src/shared/selectors/apiMock.ts` → `selectors.ts`)  
9. [x] Gallery domain + first 3 samples (`am-gallery-health`, `am-gallery-users`, `am-gallery-conflicts`)  
10. [x] Demo Hub adapter + curriculum v2 wiring — see [`apimock-demo-curriculum-v2.md`](./apimock-demo-curriculum-v2.md)  
11. [x] Playwright multi-server (`npm run test:e2e:api-mock-multi-server`) — focused specs still open  

12. [~] Demo lesson pack — v1 (AM-1…AM-8) deleted; v2 shipping one lesson at a time (`am-01-studio-tour`, `am-02-multi-server`, `am-03-rule-library`, `am-04-path-matching`, `am-05-request-predicates` done — 4-lesson 12E bar met)
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
| Phase 12 deliverable #5 Demo Hub + Gallery | §5.2 + [`apimock-studio-demo-lessons.md`](./apimock-studio-demo-lessons.md) |
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
3. Play Demo Hub **Studio Tour & Your First Mock** at 1× and finish with a visible journal row.  
4. Run `npx playwright test` for the API Mock multi-server project and get green.  
5. Find API Mock described in README / CHANGELOG / ROADMAP consistently with this branch.

Only then mark Phase **12** complete in `apimock-studio-plan.md` and request merge approval.
