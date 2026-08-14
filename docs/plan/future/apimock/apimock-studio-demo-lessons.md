# API Mock Studio — Demo Hub Lessons Plan (v1 — SUPERSEDED)

> **⚠️ Superseded by [`apimock-demo-curriculum-v2.md`](./apimock-demo-curriculum-v2.md).**
> v1 (AM-1…AM-8, 128 steps) covers ≈17% of the product surface. v2 replaces the roster with 24
> scenario-driven lessons plus a machine-enforced feature-coverage contract. Kept for history only.

> **Branch:** `feautre/apimock`  
> **Status:** Not started — selectors + Gallery samples ready; adapter + lessons open.  
> **Created:** 2026-08-13  
> **Last updated:** 2026-08-13  
> **Parent docs:** [`apimock-studio-demo-doc.md`](./apimock-studio-demo-doc.md) · [`apimock-studio-plan.md`](./apimock-studio-plan.md)  
> **UI truth:** [`docs/guides/api-mock/studio-walkthrough.md`](../../guides/api-mock/studio-walkthrough.md) · selectors `API_MOCK` / `AMS` in `src/shared/selectors/apiMock.ts`  
> **Done checklist:** [`docs/guides/demo-lesson-done-checklist.md`](../../guides/demo-lesson-done-checklist.md)

---

## 1. How many lessons?

| Tier | Count | IDs | Role |
|---|---:|---|---|
| **Required for 12E exit** | **≥4** | `AM-1` … `AM-4` | First shippable Demo Hub roster |
| **Core pack** | **6** | `AM-1` … `AM-6` | Studio story without TLS/workflow |
| **Optional** | **+2** | `AM-7`, `AM-8` | TLS + Workflow Start/Assert/Stop |
| **Total planned** | **8** | `AM-1` … `AM-8` | Full intended set |

---

## 2. Shared prerequisites & adapter

### Product / env

| Need | Detail |
|---|---|
| Web companion | `npm run server:dev` on `:3001` for Start / Apply / TLS PEM generation |
| Selectors | Import `API_MOCK` (alias `AMS`) from `src/shared/selectors` — never inline `data-testid` strings |
| Gallery | Domain `api-mock`: `am-gallery-health`, `am-gallery-users`, `am-gallery-conflicts` |
| Nav | Activity **Protocols** (`APP.AB_PROTOCOLS`) → sub-nav **API Mock** (`API_MOCK.APP_SUBNAV` / `nav-tab-api-mock-studio`) · deep link `?tab=api-mock-studio` |
| Verify hub | `API_MOCK.LIVE_REGION` (`role="status"`) — primary lesson `verify` target |

### Adapter work (blocking)

Add `apiMockStudioAdapter` under `packages/demo-hub/src/adapters/` (mirror GraphQL/WS pattern). Suggested surface:

| Helper | Purpose |
|---|---|
| `openApiMockStudio(ctx)` | Protocols → API Mock; wait `API_MOCK.STUDIO` or `EMPTY` |
| `wipeApiMockWorkspace(ctx)` | Clear `api-mock-workspace-v1` + dispatch reload / remount |
| `ensureMockServerRunning(ctx, opts?)` | Create-or-import → Start → wait Running + live message |
| `importGalleryMock(ctx, sampleId)` | Gallery → Load Mock Server (or call product import bridge) |
| `ensureRouteSelected(ctx, pathOrName)` | Select explorer row; open Match tab |
| `closeApiMockOverlays(ctx)` | Settings / Import / Pattern Toolbox / Simulate / undo toast |
| `collapseDemoSidebars(ctx)` | Hide app Workflows/Requests chrome when it steals space |

Lessons **must not** import `src/features/api-mock/**` directly.

### Shared UI facts (authoring pitfalls)

- Route editor tabs **Match / Response / Behavior / Examples / Documentation** use element ids `#api-mock-btab-match` etc. — **no** `data-testid` on the tab buttons. Click by label or `#api-mock-btab-*`.
- **Apply** appears only when server is **Running** and draft is dirty (`API_MOCK.APPLY` + `DIRTY_BADGE`).
- Auto ports: **4600–4699** with OS bind probe (`nextAutoPort`). Prefer relative “the listen address” over hard-coding `:4600` in narration when companion may hold ports.
- New routes from gallery/import are **drafts**; journal outcomes need **Start** + real traffic (or **Simulate** offline).
- Max **8** open mock tabs.

### Gallery seed reference

| Sample ID | Name | Contents |
|---|---|---|
| `am-gallery-health` | Health check mock | `GET /health` → `{"ok":true}`; one example sample |
| `am-gallery-users` | Users API | `basePath` `/api/v1`; folder Users; List / Get by id (parameterized + regex pred) / Create (POST + `json_subset`) |
| `am-gallery-conflicts` | Ambiguous routes | Two `GET /orders` same priority 10; reject-multiple policy; witness expects **ambiguous / 409** |

---

## 3. Roster summary

| ID | Title | Est. min | ~Steps | Seed | Maps to walkthrough |
|---|---|---|---:|---|---|
| `AM-1` | Create & Start a Mock Server | 6 | 18 | Empty wipe | Track A1–A7, A11 |
| `AM-2` | Author a Route & Hot-Apply | 9 | 22 | Gallery health + Running | Track A3–A8 |
| `AM-3` | Pattern Toolbox & Predicates | 6 | 16 | Users gallery | Track B6–B7 |
| `AM-4` | Conflict Inspector | 6 | 16 | Conflicts gallery | Track B1–B5 |
| `AM-5` | Import from cURL / OpenAPI | 4 | 8–9 | Empty/running blank server | Track C1–C2 |
| `AM-6` | Runtime Journal & Settings | 4 | 8–9 | Health + Start + traffic | Track D1–D4 |
| `AM-7` *(opt)* | TLS basics | 5 | 8–9 | Health + companion | Track E1–E2 |
| `AM-8` *(opt)* | Workflow Start → Assert → Stop | 5 | 9–11 | Health definition + Designer | Track F3 |

---

## 4. Lesson engineering rules

- One concept per step; spotlight the **smallest** control that changes
- Close modals before the next studio-surface step (`SIMULATE_CLOSE`, `TOOLBOX_CANCEL`, `SETTINGS_CANCEL`, `IMPORT_CLOSE`)
- `preAction` recreates Start/route/selection quietly for rapid Next
- Delays: tab/panel ~800ms · filled fields ~400–500ms · Apply/Start outcome ~800–1200ms
- `estimatedMinutes` ≈ steps × 30s at 1×, round up
- E2E: `bash scripts/run-demo-e2e.sh am-1-create-start` (… / `am-7-tls-basics` / `am-8-workflow-start-assert-stop`); companion required for AM-1/AM-2/AM-6/AM-7/AM-8

---

# 5. Detailed lesson specs

---

## AM-1 — Create & Start a Mock Server

| | |
|---|---|
| **Goal** | Viewer can open Studio, stand up a local mock, hit it, and see a journal row. |
| **Teaches** | Empty state → create → listen address → rule Match/Response → Start → traffic → journal → Stop. |
| **Seed** | Wiped workspace (`API_MOCK.EMPTY`) via `prepareBeforeNavigate` — never flash a leftover tab. |
| **Companion** | Required on **web** (`http://127.0.0.1:3001/health`). Tauri Start works natively; gate still recommended so web viewers aren’t blocked mid-lesson. |
| **Est.** | 6 min · **18** steps (split so each highlight is one small control + pause). |
| **Human pacing** | One spotlight per step; outcome steps (Running, matched detail, Stopped) are **pause-only** after the click step — never combine Start + Running (or Stop + Stopped) in one flash. |
| **Implementation** | `packages/demo-hub/src/lessons/protocols/api-mock-am1.ts` · helpers + `patchApiMockActiveRoute` for Monaco body. |

### Gaps closed vs first draft

- Empty-state **read** beat before Create click  
- Dedicated highlight on **server tab** and **listen address** (not whole server bar)  
- Match **method** callout (GET) before path fill  
- Match path / Response body as **separate** fills with pauses  
- Response **status 200** callout after body  
- **Running** status as its own verify step (after Start)  
- Traffic via in-app `fetch` to the listen URL (viewer watches journal, not a shell)  
- Journal: open Live → Transactions, click **first row**, then pause on **TX_DETAIL**  
- **Stopped** pause after Stop (mirrors Running)  
- Monaco body via `__demoPatchApiMockActiveRoute` (not `ctx.fill`)  

### Highlight rules (mandatory)

- Spotlight the **smallest** control named in narration (`CREATE_FIRST`, `ADDRESS`, `START`, `STATUS_LABEL`, `PATH_INPUT`, `VARIANT_BODY`, …).  
- Never highlight `STUDIO`, `SERVER_BAR`, or the whole dock.  
- After a state change, use a **follow-up step** that only highlights the outcome and delays (no second click).  

### Beats

| # | Step id | Narration focus | Highlight (exact) | Action | Pause after |
|---|---|---|---|---|---|
| 1 | `empty-welcome` | Empty Studio — why local mocks | `CREATE_FIRST` | none (read) | reading time only |
| 2 | `create-server` | Create first server | `CREATE_FIRST` | click Create | wait `SERVER_BAR` + live “created on port” · **1000ms** |
| 3 | `show-tab` | New tab name + port | `ACTIVE_TAB` (`aria-selected`) | none | **1200ms** |
| 4 | `show-address` | Listen URL clients will hit | `ADDRESS` | none | **1200ms** |
| 5 | `add-route` | Add a rule | `ADD_ROUTE` | click Add rule | wait `ROUTE_EDITOR` · **800ms** |
| 6 | `confirm-method` | Method stays GET | `METHOD_SELECT` | none | **1000ms** |
| 7 | `set-path` | Match: `/health` Exact | `PATH_INPUT` | fill `/health` | **800ms** on filled path |
| 8 | `open-response` | Switch to Response | `BTAB_RESPONSE` | click tab | wait `VARIANT_BODY` · **800ms** |
| 9 | `set-body` | JSON body `{"ok":true}` | `VARIANT_BODY` | bridge patch body | **1000ms** on body |
| 10 | `confirm-status` | Status stays 200 | `VARIANT_STATUS` | none | **1000ms** |
| 11 | `start` | Start the listener | `START` | click Start | wait Running · **do not** highlight bar |
| 12 | `running` | Confirm **Running** | `STATUS_LABEL` | none | **1200ms** |
| 13 | `send-traffic` | Send GET to listen URL | `ADDRESS` | `fetch(address + '/health')` | **800ms** |
| 14 | `open-journal` | Live → Transactions | `LIVE_TRANSACTIONS` | click | wait dock / rows · **800ms** |
| 15 | `inspect-tx` | Select journal row | `JOURNAL_FIRST_ROW` | click row | wait `TX_DETAIL` · **700ms** |
| 16 | `show-tx-detail` | Matched detail | `TX_DETAIL` | none | **1200ms** |
| 17 | `stop` | Stop when done | `STOP` | click Stop | wait not Running · **600ms** |
| 18 | `stopped` | Confirm **Stopped** | `STATUS_LABEL` | none | **1200ms** |

### `prepareBeforeNavigate` / `setup` / `cleanup`

- **prepareBeforeNavigate:** wipe `api-mock-workspace-v1` + stop orphan listeners (bridge).  
- **setup:** ensure empty Studio; collapse app sidebar; close overlays.  
- **cleanup:** Stop if running; wipe workspace again so the next lesson starts clean.  
- **preAction:** recreate create→route→Start only as far as prior steps require (no UI flash of later panels).

### Narration cues

- Port auto-pick **4600–4699** if busy — say “whatever port appears on the tab.”  
- Apply / Simulate / Conflicts are **out of scope** (AM-2 / AM-4).  
- Shell curl is optional homework; the lesson uses in-browser `fetch` so the journal updates live.

### Selectors (primary)

`EMPTY`, `CREATE_FIRST`, `ACTIVE_TAB`, `ADDRESS`, `ADD_ROUTE`, `METHOD_SELECT`, `PATH_INPUT`, `BTAB_RESPONSE`, `VARIANT_BODY`, `VARIANT_STATUS`, `START`, `STATUS_LABEL`, `LIVE_TRANSACTIONS`, `JOURNAL_FIRST_ROW`, `TX_DETAIL`, `STOP`

---

## AM-2 — Author a Route & Hot-Apply

| | |
|---|---|
| **Goal** | Change a live mock without full Restart — dirty badge → Apply → generation. |
| **Teaches** | Response edit while Running, dirty draft, Apply vs Restart, Simulate offline, journal proof. |
| **Seed** | Quiet wipe → import `am-gallery-health` → Start → select Health (no Gallery UI flash). |
| **Companion** | Required on web. |
| **Est.** | 9 min · **22** steps (one small highlight + pause per beat). |
| **Human pacing** | Never combine edit+dirty, Apply+generation, or Simulate open+result in one flash. |
| **Implementation** | `packages/demo-hub/src/lessons/protocols/api-mock-am2.ts` · Monaco body via `patchApiMockActiveRoute`. |

### Gaps closed vs first draft

- Seed is quiet gallery import (not “ensure-running” as a vague mega-step)  
- Dedicated **Running** + **Health route** read beats before editing  
- Open Response tab before body edit  
- Dirty callout **before** Apply click; generation callout **after** Apply  
- Prove via in-app `fetch` (not shell curl)  
- Second dirty via **priority** bump (visible P badge), then Restart callout vs Apply  
- Simulate inspector: Samples → Run → Decision trace → Normalized request → Rendered response → Assertions → Run all → Close  
- Journal open as final proof (not jammed into prove-apply)  

### Highlight rules (mandatory)

- Spotlight the **smallest** control (`DIRTY_BADGE`, `APPLY`, `GENERATION`, `PRIORITY_INPUT`, `SIMULATE_RUN`, …).  
- Never highlight `STUDIO`, `SERVER_BAR`, whole explorer, or `LIVE_REGION` (sr-only).  
- Outcome steps are pause-only after the click that caused them.  

### Beats

| # | Step id | Narration focus | Highlight (exact) | Action | Pause after |
|---|---|---|---|---|---|
| 1 | `running-ready` | Health mock already **Running** | `STATUS_LABEL` | none | **1200ms** |
| 2 | `select-health` | Health rule in explorer | `FIRST_ROUTE` | click route | wait `ROUTE_EDITOR` · **800ms** |
| 3 | `open-response` | Response tab | `BTAB_RESPONSE` | click | wait `VARIANT_BODY` · **800ms** |
| 4 | `edit-body` | Body → `{"ok":true,"v":2}` | `VARIANT_BODY` | bridge patch | **1000ms** |
| 5 | `callout-dirty` | **Draft changed** | `DIRTY_BADGE` | none | **1200ms** |
| 6 | `apply` | Hot **Apply** | `APPLY` | click Apply | wait dirty clears · **800ms** |
| 7 | `show-generation` | Generation bumped | `GENERATION` | none | **1200ms** |
| 8 | `prove-apply` | Hit listen URL | `ADDRESS` | `fetch` → body has `"v":2` | **1000ms** |
| 9 | `open-match` | Match tab for priority | `BTAB_MATCH` | click | **800ms** |
| 10 | `bump-priority` | Priority → `20` | `PRIORITY_INPUT` | fill | **800ms** |
| 11 | `dirty-again` | Dirty again | `DIRTY_BADGE` | none | **1000ms** |
| 12 | `callout-restart` | Restart = heavier path | `RESTART` | none (do not click) | **1200ms** |
| 13 | `apply-second` | Apply again (not Restart) | `APPLY` | click Apply | **800ms** |
| 14 | `open-simulate` | Offline Simulate | `SIMULATE` | click | wait workspace · **800ms** |
| 15 | `show-sim-samples` | Samples catalog | `SIMULATE_SAMPLE_HEALTH` | none | **1200ms** |
| 16 | `run-simulate` | Run simulation | `SIMULATE_RUN` | click | wait result · **800ms** |
| 17 | `sim-decision-trace` | Decision trace timeline | `SIMULATE_TIMELINE_FIRST` | none (tab already trace) | **1400ms** |
| 18 | `sim-normalized` | Normalized request | `SIMULATE_TAB_REQUEST` | click tab | wait JSON · **1200ms** |
| 19 | `sim-rendered` | Rendered body `"v":2` | `SIMULATE_TAB_RENDERED` | click tab | wait body · **1400ms** |
| 20 | `sim-assertions` | Assertion rows | `SIMULATE_TAB_ASSERTIONS` | click tab | wait table · **1400ms** |
| 21 | `sim-run-all` | Run 2 samples | `SIMULATE_RUN_ALL` | click | wait summary · **1500ms** |
| 22 | `close-simulate` | Close modal | `SIMULATE_CLOSE` | click Close | **700ms** |

### `prepareBeforeNavigate` / `setup` / `cleanup`

- **prepareBeforeNavigate:** wipe → import `am-gallery-health` → collapse sidebar.  
- **setup:** ensure Health server + Running; select `/health`; close overlays.  
- **cleanup:** close Simulate; Stop; wipe.  
- **preAction:** recreate Running + body/dirty/apply only as far as prior steps require.

### Narration cues

- **Apply** = hot commit while Running; **Restart** = tear down + bring up.  
- Dirty only appears while Running.  
- Simulate uses draft/applied rules offline — no Start required for that modal, but this lesson starts from Running.

### Selectors (primary)

`STATUS_LABEL`, `FIRST_ROUTE`, `BTAB_RESPONSE`, `VARIANT_BODY`, `DIRTY_BADGE`, `APPLY`, `GENERATION`, `ADDRESS`, `BTAB_MATCH`, `PRIORITY_INPUT`, `RESTART`, `SIMULATE`, `SIMULATE_SAMPLES`, `SIMULATE_RUN`, `SIMULATE_TIMELINE_FIRST`, `SIMULATE_TAB_REQUEST`, `SIMULATE_NORMALIZED`, `SIMULATE_TAB_RENDERED`, `SIMULATE_RENDERED_BODY`, `SIMULATE_TAB_ASSERTIONS`, `SIMULATE_ASSERTIONS`, `SIMULATE_RUN_ALL`, `SIMULATE_CLOSE`

---

## AM-3 — Pattern Toolbox & Predicates

| | |
|---|---|
| **Goal** | Build a JSONPath matcher visually and attach it as a Match condition. |
| **Teaches** | Existing gallery predicates, Pattern Toolbox, JSONPath pick-from-sample, Add conditions, Simulate match vs miss. |
| **Seed** | Quiet wipe → import `am-gallery-users` (no Gallery UI flash). Start **not** required (Simulate is offline). |
| **Companion** | Optional. |
| **Est.** | 6 min · **16** steps. |
| **Human pacing** | One small highlight per beat; never combine toolbox open + JSONPath fill + Apply in one flash. |
| **Implementation** | `packages/demo-hub/src/lessons/protocols/api-mock-am3.ts`. |

### Gaps closed vs first draft

- Quiet Users gallery seed (not visible Gallery navigation)
- Dedicated **Create User (POST)** select beat
- Callout existing **json_subset** condition before adding more
- Split toolbox: open → JSONPath tab → paste sample → pick `role` → show path → Apply → new row
- Skip optional Query & headers — keep one concept
- Simulate: matching body → result, then miss body → result, then Close

### Highlight rules (mandatory)

- Smallest control only (`CREATE_USER_ROUTE`, `PATH_TOOLBOX`, `TOOLBOX_JSONPATH`, `TOOLBOX_APPLY`, `SIMULATE_BODY`, …).
- Never highlight whole explorer, whole toolbox chrome, or `STUDIO`.
- Outcome pauses after Apply (new condition row) and after each Simulate run.

### Beats

| # | Step id | Narration focus | Highlight | Action | Pause after |
|---|---|---|---|---|---|
| 1 | `seed-ready` | Users API tab ready | `ACTIVE_TAB` | none | **1000ms** |
| 2 | `select-create` | **Create User** POST `/users` | `CREATE_USER_ROUTE` | click | wait editor · **800ms** |
| 3 | `callout-subset` | Existing **json_subset** body predicate | `FIRST_CONDITION` | none | **1200ms** |
| 4 | `open-toolbox` | Pattern Toolbox wand | `PATH_TOOLBOX` | click | wait toolbox · **800ms** |
| 5 | `tab-jsonpath` | JSON body / JSONPath | `TOOLBOX_TAB_JSONPATH` | click | **800ms** |
| 6 | `paste-sample` | Sample `{"name":"Ada","role":"admin"}` | `TOOLBOX_JSON_SAMPLE` | fill | **1000ms** |
| 7 | `pick-role` | Select `"role"` in sample | `TOOLBOX_JSON_SAMPLE` | selection → path | **800ms** |
| 8 | `show-jsonpath` | Generated `$.role` (+ resolved) | `TOOLBOX_JSONPATH` | none | **1200ms** |
| 9 | `apply-condition` | **Add conditions** | `TOOLBOX_APPLY` | click | toolbox closes · **800ms** |
| 10 | `show-new-condition` | New JSONPath condition row | `LAST_CONDITION` | none | **1200ms** |
| 11 | `open-simulate` | Simulate | `SIMULATE` | click | **800ms** |
| 12 | `fill-match` | Matching POST body | `SIMULATE_BODY` | method/path/body | **800ms** |
| 13 | `run-match` | Run simulation | `SIMULATE_RUN` | click | **700ms** |
| 14 | `result-match` | Matched result | `SIMULATE_RESULT` | none | **1200ms** |
| 15 | `run-miss` | Wrong `role` → miss | `SIMULATE_BODY` | fill guest + Run | wait result · **800ms** |
| 16 | `close-simulate` | Close | `SIMULATE_CLOSE` | click | **700ms** |

### `prepareBeforeNavigate` / `setup` / `cleanup`

- **prepareBeforeNavigate:** wipe → import `am-gallery-users` → collapse sidebar.
- **setup:** ensure Users server; select Create User; Match tab; close overlays.
- **cleanup:** close toolbox/simulate; wipe (Stop only if running).

### Narration cues

- Toolbox = power-user path — no hand-written JSONPath required.
- Gallery Create User already ships **json_subset** on `name` — call it out.
- New condition uses **jsonPath_equals** when Expected is set from the sample pick.
- Simulate offline — companion optional.

### Selectors (primary)

`ACTIVE_TAB`, `CREATE_USER_ROUTE`, `FIRST_CONDITION`, `LAST_CONDITION`, `PATH_TOOLBOX`, `ADD_CONDITION`, `TOOLBOX_TAB_JSONPATH`, `TOOLBOX_JSON_SAMPLE`, `TOOLBOX_JSONPATH`, `TOOLBOX_JSON_RESOLVED`, `TOOLBOX_APPLY`, `SIMULATE`, `SIMULATE_METHOD`, `SIMULATE_PATH`, `SIMULATE_BODY`, `SIMULATE_RUN`, `SIMULATE_RESULT`, `SIMULATE_CLOSE`

---

## AM-4 — Conflict Inspector

| | |
|---|---|
| **Goal** | Spot overlapping routes, simulate a witness, fix via priority, optionally acknowledge. |
| **Teaches** | Conflicts view, Analyze, finding detail, policy (reject → 409), Simulate witness, Adjust priority, Acknowledge. |
| **Seed** | Quiet wipe → import `am-gallery-conflicts` (two equal-priority `GET /orders`, reject-multiple). Start not required. |
| **Companion** | Optional. |
| **Est.** | 6 min · **16** steps. |
| **Human pacing** | One small highlight per beat; never combine Analyze+finding, Simulate open+result, or Adjust+Raise in one flash. |
| **Implementation** | `packages/demo-hub/src/lessons/protocols/api-mock-am4.ts`. |

### Gaps closed vs first draft

- Quiet gallery seed (no Gallery UI flash)
- Studio callout that two `/orders` rules share priority before leaving Studio
- Split Analyze → summary → select finding → detail → policy callout
- Simulate witness: open → Run → ambiguous result pause → Close
- Adjust priority: open menu → Raise left → summary after re-analyze
- Acknowledge as a real beat (not optional skip)

### Highlight rules (mandatory)

- Smallest control only (`VIEW_CONFLICTS`, `FIRST_FINDING`, `CONFLICT_SIMULATE`, `CONFLICT_PRIO_LEFT`, …).
- Never highlight whole inspector layout or `STUDIO`.
- Outcome pauses after Analyze, Simulate, priority change, and Acknowledge.

### Beats

| # | Step id | Narration focus | Highlight | Action | Pause after |
|---|---|---|---|---|---|
| 1 | `seed-ready` | Ambiguous routes tab | `ACTIVE_TAB` | none | **1000ms** |
| 2 | `callout-orders` | Two equal-priority `/orders` | `FIRST_ROUTE` | none | **1200ms** |
| 3 | `open-conflicts` | Conflicts workspace | `VIEW_CONFLICTS` | click | wait page · **800ms** |
| 4 | `analyze` | Analyze / guide Analyze | `CONFLICT_GUIDE_ANALYZE` or `CONFLICTS_ANALYZE` | click | wait list · **800ms** |
| 5 | `show-summary` | Findings count | `CONFLICT_SUMMARY` | none | **1000ms** |
| 6 | `select-finding` | First finding row | `FIRST_FINDING` | click | wait detail · **700ms** |
| 7 | `show-detail` | Overlap detail | `CONFLICT_DETAIL` | none | **1200ms** |
| 8 | `show-policy` | Equal priority → reject / 409 | `CONFLICT_POLICY_EQUAL` | none | **1200ms** |
| 9 | `simulate-witness` | Simulate witness | `CONFLICT_SIMULATE` | click | wait modal · **800ms** |
| 10 | `run-sim` | Run simulation | `SIMULATE_RUN` | click | **700ms** |
| 11 | `result-ambiguous` | Ambiguous / 409 | `SIMULATE_RESULT` | none | **1200ms** |
| 12 | `close-sim` | Close | `SIMULATE_CLOSE` | click | **700ms** |
| 13 | `open-prio` | Adjust priority | `CONFLICT_ADJUST_PRIORITY` | click | wait menu · **600ms** |
| 14 | `raise-left` | Raise left rule | `CONFLICT_PRIO_LEFT` | click | wait re-analyze · **800ms** |
| 15 | `after-priority` | Findings updated | `CONFLICT_SUMMARY` | none | **1200ms** |
| 16 | `acknowledge` | Acknowledge | `CONFLICT_ACKNOWLEDGE` | click | wait ack notice · **1000ms** |

### `prepareBeforeNavigate` / `setup` / `cleanup`

- **prepareBeforeNavigate:** wipe → import `am-gallery-conflicts` → collapse sidebar.
- **setup:** ensure Ambiguous server; Studio view; close overlays.
- **cleanup:** close Simulate; wipe.

### Narration cues

- Conflicts are **pre-Apply safety**, not only post-failure debug.
- Gallery uses **reject_multiple** + **reject** equal priority → witness expects **ambiguous** / 409.
- Adjust priority re-analyzes automatically; Acknowledge fingerprints the finding until rules change.

### Selectors (primary)

`ACTIVE_TAB`, `FIRST_ROUTE`, `VIEW_CONFLICTS`, `CONFLICTS_PAGE`, `CONFLICT_GUIDE_ANALYZE`, `CONFLICTS_ANALYZE`, `CONFLICT_SUMMARY`, `FIRST_FINDING`, `CONFLICT_DETAIL`, `CONFLICT_POLICY_EQUAL`, `CONFLICT_WITNESS`, `CONFLICT_SIMULATE`, `SIMULATE_RUN`, `SIMULATE_RESULT`, `SIMULATE_CLOSE`, `CONFLICT_ADJUST_PRIORITY`, `CONFLICT_PRIO_LEFT`, `CONFLICT_ACKNOWLEDGE`, `CONFLICT_ACK`

---

## AM-5 — Import from cURL / OpenAPI

| | |
|---|---|
| **Goal** | Promote external specs into inactive draft routes via Import Review. |
| **Teaches** | Import menu, cURL parse, OpenAPI parse, merge mode, draft enablement. |
| **Seed** | Blank mock server (create if empty). Do **not** rely on Catalog/Requests for this lesson (that’s walkthrough C5 / optional beat). |
| **Companion** | Not required until optional Start. |
| **Est.** | 5 min · 11 steps |

### Fixture snippets (embed in lesson helpers)

**cURL:**
```bash
curl -s 'http://api.example.com/v1/ping' -H 'Accept: application/json'
```

**OpenAPI 3 (minimal):**
```yaml
openapi: 3.0.3
info: { title: Demo, version: '1.0' }
paths:
  /ping:
    get:
      operationId: getPing
      responses:
        '200':
          description: ok
```

### Beats

| # | Step id | Viewer focus | Action | Highlight | Verify |
|---|---|---|---|---|---|
| 1 | `ensure-server` | Studio | Create server if empty | `CREATE_FIRST` / `TAB_ADD` | `SERVER_BAR` |
| 2 | `open-import` | Workspace nav | **Import** | `IMPORT_MENU` | Import & Promotion modal |
| 3 | `curl-source` | Source cards | **cURL command** | `importSource('curl')` | cURL pane |
| 4 | `paste-curl` | Textarea | Paste fixture → **Parse cURL** | `CURL_INPUT` · `CURL_PARSE` | Preview routes appear |
| 5 | `review-merge` | Review | Confirm mode **merge**, folder optional | `IMPORT_REVIEW` · mode merge | Preview list shows GET path from curl |
| 6 | `confirm-curl` | Footer | **Import N route(s)** | `IMPORT_CONFIRM` | Live `Imported {n} route(s) as drafts.`; explorer shows draft |
| 7 | `openapi-source` | Import again | Open Import → **OpenAPI / Swagger** | `importSource('openapi')` | Paste pane |
| 8 | `paste-openapi` | Paste | Paste YAML → **Parse** | `IMPORT_PASTE` · `IMPORT_PARSE` | Review lists `/ping` |
| 9 | `confirm-openapi` | Confirm | Import merge | `IMPORT_CONFIRM` | Second draft route; close import (`IMPORT_CLOSE`) |
| 10 | `enable-start` *(optional)* | Explorer | Enable a draft + Start + curl | `ROUTE_ENABLED` · `START` | Matched traffic |

### `preAction`

- Ensure ≥1 server; close import modal between sources if still open.
- Prefer wipe of prior imported `/ping` duplicates on restart to avoid clutter.

### Narration cues

- Imported routes are **inactive drafts** until enabled — safe by default.
- Modes: **merge** / **replace** / **copy** — stick to merge in the lesson.
- Mention Catalog/Requests **Export to API Mock** as the other promotion path (C5) without driving it here.

### Selectors

`IMPORT_MENU`, `importSource('curl'|'openapi')`, `CURL_INPUT`, `CURL_PARSE`, `IMPORT_PASTE`, `IMPORT_PARSE`, `IMPORT_REVIEW`, `IMPORT_CONFIRM`, `IMPORT_CLOSE`, `ROUTE_ENABLED`, `LIVE_REGION`

---

## AM-6 — Runtime Journal & Settings

| | |
|---|---|
| **Goal** | Use Runtime as the ops surface: filter journal, redact secrets, change unmatched fallback. |
| **Teaches** | Runtime dock tabs, journal filter/clear, Settings cards (journal redaction + fallback). |
| **Seed** | Health mock Running with ≥1 matched transaction (AM-1) **or** import health → Start → hit `/health`. |
| **Companion** | Required. |
| **Est.** | 5 min · 10 steps |

### Beats

| # | Step id | Viewer focus | Action | Highlight | Verify |
|---|---|---|---|---|---|
| 1 | `open-runtime` | Nav | **Runtime** | `VIEW_RUNTIME` | `RUNTIME_PAGE` + `DOCK` |
| 2 | `transactions` | Dock | Transactions tab | `DOCK_TAB_TRANSACTIONS` | Rows or empty guide (`RUNTIME_GUIDE`) |
| 3 | `seed-traffic` | If empty | Copy sample curl / hit `/health` | `RUNTIME_COPY_CURL` | ≥1 `tx(*)` row |
| 4 | `filter` | Toolbar | Type `health` in filter | `JOURNAL_FILTER` | Rows narrow |
| 5 | `settings` | Dock | **Settings** | `DOCK_TAB_SETTINGS` | `RUNTIME_SETTINGS_PANEL` |
| 6 | `redaction` | Journal card | Ensure journal on; set redact headers to include `authorization` | `RUNTIME_SETTINGS_JOURNAL` | Dirty settings badge |
| 7 | `save-settings` | Save | **Save** | `RUNTIME_SETTINGS_SAVE` | Settings persist |
| 8 | `fallback` | Fallback card | Set unmatched to **Closest match debug** (or equivalent label) | `RUNTIME_SETTINGS_FALLBACK` | Save again |
| 9 | `prove-fallback` | Traffic | Curl unknown path `/nope` | `ADDRESS` | Debug-ish unmatched body; journal unmatched row |
| 10 | `cors-callout` *(optional)* | CORS card | Enable CORS; note OPTIONS preflight skips journal | `RUNTIME_SETTINGS_CORS` | Short callout only — full OPTIONS in docs Track D5 |

### `preAction`

- Start health; ensure ≥1 journal row before filter step.
- Stay on Runtime (don’t leave Conflicts open).

### Narration cues

- Journal is the source of truth for “did my rule match?”
- Redaction protects tokens in the dock — still avoid pasting real secrets in demos.
- Diagnostics/Console exist but stay brief (`DOCK_TAB_DIAGNOSTICS`) — no PEM dumps.

### Selectors

`VIEW_RUNTIME`, `RUNTIME_PAGE`, `DOCK_TAB_TRANSACTIONS`, `DOCK_TAB_SETTINGS`, `JOURNAL_FILTER`, `JOURNAL_CLEAR`, `RUNTIME_SETTINGS_*`, `RUNTIME_SETTINGS_SAVE`, `tx(*)`, `LIVE_REGION`

---

## AM-7 *(optional)* — TLS basics

| | |
|---|---|
| **Goal** | Turn on HTTPS with a generated self-signed cert; show HTTP/2 badge; hit over TLS. |
| **Teaches** | Server settings TLS tab, generate cert, companion dependency, HTTP/2 badge. |
| **Seed** | Health mock Stopped (TLS changes usually need restart). |
| **Companion** | **Required** (cert generate) on web and Tauri. |
| **Est.** | 5 min · 9 steps |

### Beats

| # | Step id | Viewer focus | Action | Highlight | Verify |
|---|---|---|---|---|---|
| 1 | `open-settings` | Gear | **Server settings** | `SETTINGS` | `SETTINGS_MODAL` |
| 2 | `tls-tab` | Tabs | **TLS** | `settingsTab('tls')` | TLS panel |
| 3 | `enable-https` | Toggle | Enable HTTPS | `SETTINGS_TLS_ENABLED` | Controls enable |
| 4 | `generate` | Generate | **Generate self-signed** | `SETTINGS_TLS_GENERATE` | Cert/key fields fill |
| 5 | `save-settings` | Footer | **Save** | `SETTINGS_SAVE` | Modal closes |
| 6 | `start-https` | Server bar | **Start** | `START` | Address `https://127.0.0.1:46xx`; `HTTP2_BADGE` visible |
| 7 | `hit-tls` | Traffic | `curl -k --noproxy '*' https://127.0.0.1:46xx/health` | `ADDRESS` | 200 JSON |
| 8 | `mtls-callout` *(optional)* | TLS tab | Mention mTLS generate without full flow | `SETTINGS_MTLS_ENABLED` | Skip deep mTLS unless time |
| 9 | `stop` | Stop | **Stop** | `STOP` | Clean teardown |

### Pitfalls

- Plaintext remains HTTP/1.1 (no h2c) — only TLS shows **HTTP/2**.
- Corporate proxy: always `--noproxy '*'` for loopback curls.
- Restart required if toggling TLS while previously running on HTTP.

### Selectors

`SETTINGS`, `SETTINGS_MODAL`, `settingsTab('tls')`, `SETTINGS_TLS_ENABLED`, `SETTINGS_TLS_GENERATE`, `SETTINGS_SAVE`, `HTTP2_BADGE`, `ADDRESS`, `START`, `STOP`

---

## AM-8 *(optional)* — Workflow Start → Assert → Stop

| | |
|---|---|
| **Goal** | Drive a mock from Workflow Designer: Start → HTTP → Assert calls → Stop. |
| **Teaches** | API Mock palette subgroup, node config panels, isolate/port vars. |
| **Seed** | Persisted health (or users) definition available to Start node server picker; empty/small workflow. |
| **Companion** | Required for Start node execution. |
| **Est.** | 6 min · 10 steps |

### Palette nodes (product)

| Node | Canvas testid | Config panel |
|---|---|---|
| **Start Mock Server** | `api-mock-canvas-apiMockStart` | `api-mock-start-config` · server `api-mock-wf-server`, port override, isolate |
| **Apply Definition** | `api-mock-canvas-apiMockApply` | `api-mock-apply-config` |
| **Assert Mock Calls** | `api-mock-canvas-apiMockAssertCalls` | `api-mock-assert-config` |
| **Stop Mock Server** | `api-mock-canvas-apiMockStop` | `api-mock-stop-config` |
| Reset Mock State | `api-mock-canvas-apiMockResetState` | (mention only) |

### Beats

| # | Step id | Viewer focus | Action | Highlight | Verify |
|---|---|---|---|---|---|
| 1 | `open-designer` | Workflow | Open Workflow Designer; collapse app sidebar | WF nav + collapse helper | Canvas visible |
| 2 | `palette` | Blocks | Expand **API Mock** subgroup | palette group | Start/Assert/Stop visible |
| 3 | `drop-start` | Canvas | Add **Start Mock Server**; open config | `api-mock-canvas-apiMockStart` | `api-mock-start-config` |
| 4 | `pick-server` | Config | Select Health mock; show port vars (`mockPort` / `mockBaseUrl`) / isolate | `api-mock-wf-server` | Save/close config (use WF config helpers + pacing) |
| 5 | `http-node` | Canvas | Add HTTP request to `{{mockBaseUrl}}/health` (or resolved port) | HTTP node | Wired after Start |
| 6 | `assert` | Canvas | Add **Assert Mock Calls**; expect ≥1 GET `/health` | assert config | Save |
| 7 | `stop-node` | Canvas | Add **Stop Mock Server** | stop config | Same server id |
| 8 | `edges` | Canvas | Connect Start → HTTP → Assert → Stop | edges | Linear happy path |
| 9 | `run` | Runner | Run workflow | run control | All green; assert passes |
| 10 | `cleanup` | — | Ensure Stop ran; no orphan listener | — | Port free / Studio stopped |

### `preAction`

- Ensure a named mock definition exists in workspace for the picker.
- Use shared `wf-demo-helpers` for modal open/save pacing; collapse app Workflows sidebar after pick.

### Narration cues

- Isolate run avoids clobbering a Studio tab the user has open.
- Assert reads the mock journal — ties Studio + Workflow together.
- Point to Test Runner API Mock fixture as the sibling automation path (docs Track F4) without full coverage here.

### Selectors

Workflow palette/canvas testids above + `API_MOCK` only if jumping back to Studio. Prefer `WF.*` constants already used by workflow lessons; add any missing `api-mock-wf-*` to shared selectors before merge.

---

# 6. Delivery order & tracking

1. Adapter + wipe/open/import helpers  
2. **AM-1** → **AM-2** → **AM-4** (gallery-ready) → **AM-3**  
3. **AM-5**, **AM-6**  
4. Optional **AM-7**, **AM-8**

### Batch A (12E exit ≥4)

- [ ] Adapter + helpers  
- [x] `AM-1` — implemented (`api-mock-am1.ts`, Monaco body via `patchApiMockActiveRoute`)  
- [x] `AM-2` — implemented (`api-mock-am2.ts`, gallery health seed + hot-Apply)  
- [x] `AM-3` — implemented (`api-mock-am3.ts`, Users gallery + Pattern Toolbox)  
- [x] `AM-4` — implemented (`api-mock-am4.ts`, Conflicts gallery + inspector)  
- [ ] Each passes 5-item done checklist  

### Batch B

- [x] `AM-5` — implemented (`api-mock-am5.ts`, Import Review cURL + OpenAPI drafts)
- [x] `AM-6` — implemented (`api-mock-am6.ts`, Runtime journal filter + settings + closest-match fallback)

### Batch C (optional)

- [x] `AM-7` — implemented (`api-mock-am7.ts`, TLS generate + HTTPS Start + HTTP/2)
- [x] `AM-8` — implemented (`api-mock-am8.ts`, Workflow Start → HTTP → Assert → Stop)

---

## 7. Mapping

| Source | Link |
|---|---|
| Walkthrough Tracks A–F | [`studio-walkthrough.md`](../../guides/api-mock/studio-walkthrough.md) |
| Selectors | `src/shared/selectors/apiMock.ts` |
| Gallery presets | `src/data/galleries/api-mock/` |
| 12E checklist 10 / 12 | [`apimock-studio-demo-doc.md`](./apimock-studio-demo-doc.md) |
| Parent plan 12E | [`apimock-studio-plan.md`](./apimock-studio-plan.md) |
