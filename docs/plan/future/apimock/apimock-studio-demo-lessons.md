# API Mock Studio — Demo Hub Lessons Plan

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
| `AM-1` | Create & Start a Mock Server | 4 | 9–10 | Empty or health gallery | Track A1–A7, A11 |
| `AM-2` | Author a Route & Hot-Apply | 4 | 8–9 | Running health (or empty + create) | Track A3–A8 |
| `AM-3` | Pattern Toolbox & Predicates | 5 | 9–10 | Users gallery or AM-2 server | Track B6–B7 |
| `AM-4` | Conflict Inspector | 4 | 8–9 | Conflicts gallery | Track B1–B5 |
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
- E2E: `bash scripts/run-demo-e2e.sh <lesson-id>` when wired; companion required for Start specs

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
| **Est.** | 5 min · **14** steps (split so each highlight is one small control + pause). |
| **Human pacing** | One spotlight per step; outcome steps (Running, journal row) are **pause-only** after the click step — never combine Start + Running in one flash. |

### Gaps closed vs first draft

- Empty-state **read** beat before Create click  
- Dedicated highlight on **server tab** and **listen address** (not whole server bar)  
- Match path / Response body as **separate** fills with pauses  
- **Running** status as its own verify step (after Start)  
- Traffic via in-app `fetch` to the listen URL (viewer watches journal, not a shell)  
- Journal: open Live → Transactions, then highlight **first row** / detail  
- Stop as final cleanup beat viewers can see  

### Highlight rules (mandatory)

- Spotlight the **smallest** control named in narration (`CREATE_FIRST`, `ADDRESS`, `START`, `STATUS_LABEL`, `PATH_INPUT`, `VARIANT_BODY`, …).  
- Never highlight `STUDIO`, `SERVER_BAR`, or the whole dock.  
- After a state change, use a **follow-up step** that only highlights the outcome and delays (no second click).  

### Beats

| # | Step id | Narration focus | Highlight (exact) | Action | Pause after |
|---|---|---|---|---|---|
| 1 | `empty-welcome` | Empty Studio — why local mocks | `CREATE_FIRST` | none (read) | reading time only |
| 2 | `create-server` | Create first server | `CREATE_FIRST` | click Create | wait `SERVER_BAR` + live “created on port” · **1000ms** |
| 3 | `show-tab` | New tab name + port | first `api-mock-tab-*` / active tab label | none | **1200ms** |
| 4 | `show-address` | Listen URL clients will hit | `ADDRESS` | none (optional copy later) | **1200ms** |
| 5 | `add-route` | Add a rule | `ADD_ROUTE` | click Add rule | wait `ROUTE_EDITOR` · **800ms** |
| 6 | `set-path` | Match: GET + `/health` Exact | `PATH_INPUT` | fill `/health` (method already GET) | **800ms** on filled path |
| 7 | `open-response` | Switch to Response | `#api-mock-btab-response` (`BTAB_RESPONSE`) | click tab | wait `VARIANT_BODY` · **800ms** |
| 8 | `set-body` | JSON body `{"ok":true}` | `VARIANT_BODY` | fill body | **1000ms** on body |
| 9 | `start` | Start the listener | `START` | click Start | wait Running · **do not** highlight bar |
| 10 | `running` | Confirm **Running** | `STATUS_LABEL` | none | **1200ms** |
| 11 | `send-traffic` | Send GET to listen URL | `ADDRESS` | `fetch(address + '/health')` quietly after short pause | wait journal ≥1 · **800ms** |
| 12 | `open-journal` | Live → Transactions | `LIVE_TRANSACTIONS` | click | wait `DOCK_TAB_TRANSACTIONS` / Runtime · **800ms** |
| 13 | `inspect-tx` | Matched journal row | first tx row → then `TX_DETAIL` | click row | **1200ms** on detail |
| 14 | `stop` | Stop when done | `STOP` | click Stop | live “Server stopped.” · **800ms** |

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

`EMPTY`, `CREATE_FIRST`, `tab(id)` / active tab, `ADDRESS`, `ADD_ROUTE`, `PATH_INPUT`, `BTAB_RESPONSE`, `VARIANT_BODY`, `START`, `STATUS_LABEL`, `LIVE_TRANSACTIONS`, `JOURNAL_FIRST_ROW` / `TX_DETAIL`, `STOP`, `LIVE_REGION`

---

## AM-2 — Author a Route & Hot-Apply

| | |
|---|---|
| **Goal** | Change a live mock without full Restart — dirty badge → Apply → generation. |
| **Teaches** | Match/Response editing, dirty state, Apply vs Restart, optional Simulate. |
| **Seed** | AM-1 outcome **or** import `am-gallery-health`, Start, select Health route. |
| **Companion** | Required. |
| **Est.** | 4 min · ~9 steps |

### Beats

| # | Step id | Viewer focus | Action | Highlight | Verify |
|---|---|---|---|---|---|
| 1 | `ensure-running` | Server bar | Ensure Running + Health selected | `START` if needed · `route(*)` | Running; `ROUTE_EDITOR` |
| 2 | `edit-body` | Response | Change body to `{"ok":true,"v":2}` | `VARIANT_BODY` | Dirty badge appears (`DIRTY_BADGE`) while running |
| 3 | `callout-dirty` | Draft changed | Pause — explain Apply vs Restart | `DIRTY_BADGE` | Apply enabled |
| 4 | `apply` | Apply | Click **Apply** | `APPLY` | Live `Applied generation {n}.`; dirty clears |
| 5 | `prove-apply` | Traffic | Curl/Requests again | `ADDRESS` | Body includes `"v":2` |
| 6 | `tweak-path` | Match | Optionally rename route / bump priority | `ROUTE_NAME` or `PRIORITY_INPUT` | Dirty again |
| 7 | `simulate` | Offline match | Route toolbar **Simulate** → Run | `SIMULATE` → `SIMULATE_RUN` | `SIMULATE_RESULT` matched; close (`SIMULATE_CLOSE`) |
| 8 | `apply-or-discard` | Apply | Apply second edit **or** show Restart as heavier path | `APPLY` / `RESTART` | Generation increments or full restart |
| 9 | `journal-check` | Transactions | Live → Transactions | `LIVE_TRANSACTIONS` | New matched rows present |

### `preAction`

- Import health if missing; Start; select `/health`; ensure Response tab for body steps.
- Close Simulate before Apply steps if viewer skipped close.

### Narration cues

- **Apply** = hot commit while Running; **Restart** = tear down + bring up with full definition.
- Dirty only matters when Running (stopped edits don’t show Apply).

### Selectors

`DIRTY_BADGE`, `APPLY`, `RESTART`, `VARIANT_BODY`, `SIMULATE`, `SIMULATE_WORKSPACE`, `SIMULATE_RUN`, `SIMULATE_RESULT`, `SIMULATE_CLOSE`, `LIVE_REGION`

---

## AM-3 — Pattern Toolbox & Predicates

| | |
|---|---|
| **Goal** | Build a JSONPath (or constraint) matcher visually and attach it as a Match condition. |
| **Teaches** | Pattern Toolbox tabs, JSONPath pick-from-sample, Add conditions / Apply matcher. |
| **Seed** | Import `am-gallery-users` (has POST Create with body predicates) **or** blank server + POST `/users` route. Prefer gallery for speed. |
| **Companion** | Optional until Start; Simulate works offline. |
| **Est.** | 5 min · ~10 steps |

### Beats

| # | Step id | Viewer focus | Action | Highlight | Verify |
|---|---|---|---|---|---|
| 1 | `import-users` | Gallery or Studio | Load Users sample / ensure server | Gallery domain or existing tab | Server with Users folder; live import message if gallery |
| 2 | `select-create` | Explorer | Select **Create User** (POST) | `route(route-id)` | Match tab; method POST |
| 3 | `open-toolbox` | Conditions | Click **+ Condition** / condition toolbox wand | `api-mock-add-condition` / condition toolbox | `PATTERN_TOOLBOX` opens |
| 4 | `tab-jsonpath` | Toolbox | Select **JSON body / JSONPath** | `api-mock-toolbox-tab-jsonpath` | JSONPath pane active |
| 5 | `paste-sample` | Sample JSON | Ensure sample body (gallery example or paste `{"name":"Ada","role":"admin"}`) | `TOOLBOX_JSON_SAMPLE` | Sample visible |
| 6 | `pick-path` | Click field | Click `role` (or `name`) in sample | sample interaction | `TOOLBOX_JSONPATH` shows `$.role` (or similar); resolved value (`TOOLBOX_JSON_RESOLVED`) |
| 7 | `apply-condition` | Footer | **Add conditions** / **Apply matcher** | `TOOLBOX_APPLY` | Toolbox closes; Match shows new predicate row |
| 8 | `optional-constraints` | Toolbox again | Open **Query & headers**; add header constraint if time | `api-mock-toolbox-tab-constraints` | Second condition or skip |
| 9 | `simulate-body` | Simulate | Run with matching vs non-matching body | `SIMULATE` | Matching → matched; wrong body → unmatched / other route |
| 10 | `close` | Modal | Close Simulate | `SIMULATE_CLOSE` | Studio visible |

### `preAction`

- Ensure Users (or POST) route selected; close leftover toolbox (`TOOLBOX_CANCEL`).
- If gallery import already done, skip to select Create User.

### Narration cues

- Toolbox is the power-user path — no hand-written JSONPath required.
- Predicate operators include **JSON subset** (`json_subset`) on gallery Create User — call out the label in Match conditions.
- Fresh select-all in JSON sample if path sticks (see troubleshooting guide).

### Selectors

`PATTERN_TOOLBOX`, `TOOLBOX_JSON_SAMPLE`, `TOOLBOX_JSONPATH`, `TOOLBOX_JSON_RESOLVED`, `TOOLBOX_APPLY`, `TOOLBOX_CANCEL`, `api-mock-toolbox-tab-jsonpath`, `api-mock-add-condition`, `SIMULATE_*`

### Note for authors

Extend `API_MOCK` with `ADD_CONDITION` / `TOOLBOX_TAB_*` before lesson merge if those constants are still missing from the public selector object (UI already has the testids).

---

## AM-4 — Conflict Inspector

| | |
|---|---|
| **Goal** | Spot overlapping routes, simulate a witness, fix via priority, optionally acknowledge. |
| **Teaches** | Conflicts view, analyze, finding detail, Simulate witness, Adjust priority. |
| **Seed** | **Required:** Gallery `am-gallery-conflicts` (two `GET /orders`, equal priority, reject-multiple). |
| **Companion** | Optional for Simulate; Start not required for analyze/simulate. |
| **Est.** | 4 min · ~9 steps |

### Beats

| # | Step id | Viewer focus | Action | Highlight | Verify |
|---|---|---|---|---|---|
| 1 | `import-conflicts` | Gallery | Load **Ambiguous routes** | `GALLERY_DOMAIN_API_MOCK` → Load | Live `Gallery mock server imported.`; Studio opens |
| 2 | `open-conflicts` | Workspace nav | **Conflicts** | `VIEW_CONFLICTS` | `CONFLICTS_PAGE` |
| 3 | `analyze` | Header / guide | **Analyze** / **Re-analyze** if needed | `CONFLICTS_ANALYZE` or `CONFLICT_GUIDE_ANALYZE` | Live `{n} potential conflict(s) found.` · list non-empty |
| 4 | `open-finding` | List | Select first finding | `CONFLICT_LIST` / finding row | `CONFLICT_DETAIL` + witness (`CONFLICT_SIMULATE` enabled) |
| 5 | `simulate-witness` | Detail | **Simulate witness** → Run | `CONFLICT_SIMULATE` → `SIMULATE_RUN` | Result shows ambiguous / 409 per sample expectation |
| 6 | `close-sim` | Modal | Close | `SIMULATE_CLOSE` | Back on Conflicts |
| 7 | `adjust-priority` | Actions | **Adjust priority** → prefer left/right | `CONFLICT_ADJUST_PRIORITY` → prio left/right | Live `Priority adjusted for {routeId}.` |
| 8 | `reanalyze` | Header | Re-analyze | `CONFLICTS_ANALYZE` | Finding severity drops or clears; or remaining potential only |
| 9 | `ack` *(optional)* | Detail | **Acknowledge** when stable | `CONFLICT_ACKNOWLEDGE` | Live `Conflict acknowledged.` |

### `preAction`

- Import conflicts sample if explorer lacks two `/orders` routes.
- Close Simulate before priority/ack steps.

### Narration cues

- Conflicts are **pre-Apply safety**, not just post-failure debug.
- Gallery settings use reject-multiple — witness expects **ambiguous**, not silent winner.
- After priority change, Apply if server was Running (`CONFLICT_APPLY` when dirty).

### Selectors

`VIEW_CONFLICTS`, `CONFLICTS_PAGE`, `CONFLICTS_ANALYZE`, `CONFLICT_INSPECTOR`, `CONFLICT_DETAIL`, `CONFLICT_SIMULATE`, `CONFLICT_ADJUST_PRIORITY`, `CONFLICT_ACKNOWLEDGE`, `CONFLICT_APPLY`, `SIMULATE_*`, `LIVE_REGION`

---

## AM-5 — Import from cURL / OpenAPI

| | |
|---|---|
| **Goal** | Promote external specs into inactive draft routes via Import Review. |
| **Teaches** | Import menu, cURL parse, OpenAPI parse, merge mode, draft enablement. |
| **Seed** | Blank mock server (create if empty). Do **not** rely on Catalog/Requests for this lesson (that’s walkthrough C5 / optional beat). |
| **Companion** | Not required until optional Start. |
| **Est.** | 4 min · ~9 steps |

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
| **Est.** | 4 min · ~9 steps |

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
| **Est.** | 5 min · ~9 steps |

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
| **Est.** | 5 min · ~10 steps |

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
- [ ] `AM-1`  
- [ ] `AM-2`  
- [ ] `AM-3`  
- [ ] `AM-4`  
- [ ] Each passes 5-item done checklist  

### Batch B

- [ ] `AM-5`  
- [ ] `AM-6`  

### Batch C (optional)

- [ ] `AM-7`  
- [ ] `AM-8`  

---

## 7. Mapping

| Source | Link |
|---|---|
| Walkthrough Tracks A–F | [`studio-walkthrough.md`](../../guides/api-mock/studio-walkthrough.md) |
| Selectors | `src/shared/selectors/apiMock.ts` |
| Gallery presets | `src/data/galleries/api-mock/` |
| 12E checklist 10 / 12 | [`apimock-studio-demo-doc.md`](./apimock-studio-demo-doc.md) |
| Parent plan 12E | [`apimock-studio-plan.md`](./apimock-studio-plan.md) |
