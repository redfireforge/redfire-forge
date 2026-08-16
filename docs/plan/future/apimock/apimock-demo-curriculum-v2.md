# API Mock Studio — Demo Curriculum v2 (full rewrite)

> **Branch:** `feautre/apimock`
> **Status:** In progress, one lesson at a time. **AM-01 … AM-15 shipped** (AM-04 is 7 steps, AM-06 is 6, AM-07 is 7, AM-11 is 9, AM-15 is 9, the rest are 8). Supersedes [`apimock-studio-demo-lessons.md`](./apimock-studio-demo-lessons.md) (v1, AM-1…AM-8, deleted).
> **Created:** 2026-08-13 · **Revised:** 2026-08-13 — step consolidation (multi-beat steps) + live-authoring-over-Gallery policy
> **Feature truth:** engine `src/shared/api-mock/**`, `src-server/api-mock/**` · UI `src/features/api-mock/**` · selectors `src/shared/selectors/apiMock.ts`
> **UI truth:** [`docs/guides/api-mock/studio-walkthrough.md`](../../guides/api-mock/studio-walkthrough.md)
> **Authoring rules:** [`.cursor/rules/demo-player-lessons.mdc`](../../../.cursor/rules/demo-player-lessons.mdc) · [`demo-lesson-done-checklist.md`](../../guides/demo-lesson-done-checklist.md)

---

## 1. Why rewrite instead of extend

The v1 pack (AM-1…AM-8, 128 steps) is structurally sound per-step but **teaches a thin slice** of the product. Audit result:

| Product area | Feature count (approx.) | v1 coverage |
|---|---:|---|
| Server/workspace model (tabs, ports, binding, basePath, limits, CORS, isolation) | 18 | 3 — create, start/stop, port |
| Path matching (exact, parameterized, glob, regex, inference, generalize) | 6 | 1 — exact only |
| Predicate sources & operators | 7 sources × 24 operators | 2 — `json_subset` (seeded), `jsonPath_equals` |
| Response content (status, reason, headers, cookies, 8 body kinds) | 14 | 2 — status, JSON body |
| Templating (helpers, faker, Monaco completions, Format, Map body) | 12 | 0 |
| Response modes (rules / sequence / weighted / state), variants, counters | 11 | 0 |
| Timing & eligibility (delay, jitter, maxMatches, expires, probability) | 5 | 0 |
| Connection faults (timeout, reset, close, malformed, dribble + chunks) | 6 | 0 |
| Outbound (transforms, callbacks, allowlist, retries) + variables | 9 | 0 |
| Selection policy & specificity, ambiguity response | 6 | 1 — equal-priority reject |
| Conflict kinds (duplicate, shadowed, definite, potential) + ack/stale | 8 | 3 |
| Import sources (cURL, OpenAPI, WireMock, HAR, Catalog, Requests, native) + modes | 12 | 2 — cURL, OpenAPI (merge only) |
| Export formats (6) + redaction + round-trip | 8 | 0 |
| Proxy passthrough + record-to-drafts | 9 | 0 |
| Journal forensics (near-misses, candidates, promotion actions, clear, export) | 11 | 3 |
| Runtime ops (CORS, limits, drain, LAN bind, persist, retention, diagnostics, console, state, variables) | 15 | 3 |
| TLS / mTLS / cert-subject matching | 9 | 2 — HTTPS generate, HTTP/2 |
| Simulation depth (seeds, sequential batch, expectations, trace export, fault timeline) | 10 | 4 |
| Workflow nodes (Start/Apply/Reset/Stop/Assert + assert criteria) | 12 | 4 |
| Test Runner fixtures / CLI / CI | 6 | 0 |
| **Total** | **≈ 210 demoable capabilities** | **≈ 35 (≈ 17%)** |

Root causes (not fixable by adding steps to v1):

1. **One-feature-per-lesson framing.** Eight lessons can never cover ~210 capabilities; the roster itself is the bottleneck.
2. **Gallery seeds are too small.** Three presets (health, users, conflicts) contain no variants, no state, no faults, no templating — so lessons *cannot* show them without authoring everything live.
3. **Pause-only padding.** 30+ of 128 steps are read-only delays; wall time is spent on pacing rather than surface area.
4. **No breadth contract.** Nothing fails when a feature is never demonstrated, so drift is invisible.

v2 fixes all four: **scenario-driven multi-feature lessons**, **eight new gallery presets**, **a feature-coverage roster enforced by a unit test**, and a **quality audit test** that caps pause-only steps.

---

## 2. Design principles

| # | Principle | Mechanism |
|---|---|---|
| 1 | **A lesson is a scenario, not a button.** Each lesson mocks a believable service ("flaky payment gateway", "checkout state machine") and covers the *cluster* of features that scenario needs. | Per-lesson `scenario` framing in `concept.body` |
| 2 | **Breadth is machine-checked.** A canonical `AM_FEATURE_MATRIX` lists every demoable capability; every tag must be claimed by ≥1 lesson and every claimed tag must exist. | `api-mock-feature-coverage.test.ts` |
| 3 | **One *concept* per step — several *actions* per step.** A step performs the whole group of clicks that concept needs, moving the spotlight between them with a hold on each. Never one click per step. Max 1 pure-pause step per lesson. | `api-mock-lesson-quality-audit.test.ts` (6–12 steps, ≤1 pause-only) |
| 4 | **Every lesson shows ≥1 power feature.** Generate, auto-detect, pick-from-JSON, generalize path, Map body, quick-fix, copy-as-cURL, promotion action. | Audit test asserts `powerFeature` tag present |
| 5 | **Every lesson ends on proof.** A journal row, a rendered response, a green assertion, or a passing workflow — never "…and that's the panel". | Audit test asserts last step `verify` is an outcome selector |
| 6 | **Live authoring, never a Gallery import as the demo.** The viewer watches the feature being built in the UI. Presets exist as *background corpus* only, loaded silently before the lesson starts — never as a visible "import sample" beat. | §5.1 starting-state policy |
| 7 | **Smallest-control spotlight.** Never highlight `STUDIO`, `SERVER_BAR`, a whole modal, or `LIVE_REGION`. | Audit test blocklist |
| 8 | **Honest about non-demoable.** Browser-only limits (client certs, shell curl, CLI) are narrated + shown via Simulate, never faked. | §5 "Non-demoable" register |

### Step composition contract

v1's biggest defect was **one click per step**: 128 steps that each did a single thing, so the viewer sat
through a reading pause and a Next click to watch one field get filled. v2 steps are **multi-beat**.

A **beat** is one visible thing: a spotlight hold, a click, a fill, a reveal. A **step** is a group of beats
that add up to one teachable idea, with the spotlight moving between them:

```
step "author-response"     ← one concept: what a client receives
  beat  spotlight Response tab → click                    (tab switch, 800ms)
  beat  spotlight 200 quick chip → click → hold           (chip is the power feature)
  beat  patch body → reveal byte counter → hold           (group break, 1000ms)
  beat  spotlight preview pane → hold 1200ms              (the payoff)
```

Mechanism: `spotlightBeat(ctx, selector, holdMs)` in `api-mock-demo-helpers.ts` wraps
`showSpotlightRing` from `demoRipple`, so a mid-step ring is visually identical to the step-level
spotlight — the viewer reads it as *the ring moved here*. `clickBeat` / `fillBeat` / `revealBeat`
bundle spotlight + interact + hold. Holds come from `AM_DEMO_TIMING`.

**Rules**

1. **Split on concept, never on click.** If two beats share one sentence of narration, they share a step.
2. **6–12 steps per lesson.** Above 12 means beats that belong together were split (test-enforced).
3. **Every step acts.** ≤1 pause-only step per lesson (test-enforced).
4. **Spotlight the smallest control, and move it.** A step with five beats has five ring positions, not
   one ring around the panel.
5. **Group break between clusters.** `AM_DEMO_TIMING.groupBreak` (1000ms) separates logical clusters
   inside one step (status cluster → body cluster → preview cluster) so it never reads as a blur.
6. **The last beat is the payoff**, held `1200ms` — the badge, preview, journal row, or green result.
7. **A step's `preAction` guard recreates the state of *all* its beats**, since rapid Next can skip the
   whole group.

Beat holds: view switch `900ms` · panel/editor ready `800ms` · tab switch `800ms` · filled field `550ms` ·
spotlight look `700ms` · generated content `1500–2000ms` · listener bind/drain `1600ms` · journal write
`1400ms` · **payoff** `1200ms` · group break `1000ms`.

Consolidation does **not** reduce coverage: total beats are unchanged (~330), total steps drop
from a planned 335 to **≈191**, and wall time drops mainly because ~140 redundant reading pauses
and Next clicks disappear.

---

## 3. Curriculum architecture

**24 lessons in 5 tracks**, ids `am-01-…` … `am-24-…`, **7–9 multi-beat steps each** (**≈ 191 steps**, ~330 beats), ~2h05m total runtime.

| Track | Lessons | Theme | Companion / Docker |
|---|---|---|---|
| **A — Foundations** | AM-01…03 | Studio literacy: first mock, multi-server workspace, rule library | Companion (AM-01) |
| **B — Matching** | AM-04…09 | Paths, predicates, payload formats, boolean logic, selection policy, conflicts | Mostly offline (Simulate) |
| **C — Responses** | AM-10…14 | Content, templating, variants/sequence, stateful/weighted, timing & faults | Companion (AM-14) |
| **D — Traffic & Ops** | AM-15…19 | Import, export, proxy/record, journal forensics, runtime ops | Companion; Docker echo (AM-17) |
| **E — Security, Verification, Automation** | AM-20…24 | TLS/mTLS, simulation suite, workflow, harness/CI, capstone | Companion |

### Roster

`Live` = what the viewer watches being authored in the UI. `Quiet corpus` = background state loaded
before step 1 with no visible import beat (§5.1).

| ID | Lesson id | Title | Est. | Steps | Quiet corpus | Authored live |
|---|---|---|---:|---:|---|---|
| AM-01 | `am-01-studio-tour` | Studio Tour & Your First Mock | 5 | 8 | *(none — empty workspace)* | server, rule, response, start, traffic |
| AM-02 | `am-02-multi-server` | Multi-Server Workspace: Tabs, Ports & Binding | 6 | 8 | 1 server w/ 2 rules | 2nd + 3rd server, rename, basePath, bind, duplicate |
| AM-03 | `am-03-rule-library` | Rule Library: Folders, Search, Filters & Docs | 6 | 8 | 12-rule store library | folder, drag, filters, disable, delete + undo, docs, analyze |
| AM-04 | `am-04-path-matching` | Path Matching & the Pattern Toolbox | 8 | 7 | 1 exact rule | every path kind, toolbox presets, generalize, glob, regex library |
| AM-05 | `am-05-request-predicates` | Query, Header, Cookie & Security Conditions | 9 | 8 | 1 rule, no conditions | every source + operator, None-of guard, cookie regex, bulk add |
| AM-06 | `am-06-body-matching` | Body Matching: Subset, Strict, JSONPath & JSON Schema | 8 | 6 | 1 rule w/ subset predicate | strict switch, pick-from-JSON, match style, schema preset + paste |
| AM-07 | `am-07-payload-formats` | Forms, Multipart, XML & Binary Matching | 9 | 7 | 4 bare rules (form/upload/xml/binary) | every format predicate + sha256 |
| AM-08 | `am-08-selection-policy` | Boolean Groups, Priority & Selection Policy | 9 | 8 | 2 overlapping rules | groups, nesting, priority, both policies |
| AM-09 | `am-09-conflicts` | Conflict Inspector: Four Overlap Kinds → Fix → Acknowledge | 13 | 12 | 4 overlapping pairs | analyze, pair-then-kind, witness, goto, shadowed-simulate, definite-simulate, potential-simulate, fix, acknowledge |
| AM-10 | `am-10-response-content` | Response Content: Status, Headers, Cookies & Body Kinds | 6 | 8 | 1 rule w/ plain 200 | status/reason/type, headers, cookies, kinds, Format |
| AM-11 | `am-11-templating` | Dynamic Responses: Templates, Faker & Body Mapper | 7 | 9 | 1 running rule, static body | every helper typed live, variables, Map body |
| AM-12 | `am-12-variants-sequence` | Response Variants: Rules & Sequence Modes | 6 | 8 | 1 cart rule, 1 variant | 2nd variant, conditions, default, sequence, 3 calls |
| AM-13 | `am-13-stateful` | Stateful Mocks: A Cart That Remembers | 7 | 8 | cart rule w/ 2 variants | same POST /cart twice, live state, reset, weighted, secret |
| AM-14 | `am-14-timing-faults` | When Payments Hang: Latency, Eligibility & Connection Faults | 7 | 8 | 1 payment rule | slow bank, used-up offer, hang/reset, dribble |
| AM-15 | `am-15-import` | Import Everything: cURL, OpenAPI, WireMock, HAR, Catalog | 7 | 9 | blank server + Catalog/Requests entries | all 7 import sources, modes, generalize, enable |
| AM-16 | `am-16-export` | Export & Round-Trip: JSON/YAML, WireMock, HAR, Redaction | 6 | 7 | store library + TLS + secret var | all 6 exports, redaction check, re-import as copy |
| AM-17 | `am-17-proxy-record` | Proxy Passthrough & Record-to-Drafts | 8 | 8 | blank server + Docker echo | proxy config, record, live proxied call, draft promote |
| AM-18 | `am-18-journal` | Journal Forensics: Near-Misses, Candidates & Promotion | 7 | 8 | store library (running) | live traffic incl. a miss, promotion actions, export |
| AM-19 | `am-19-runtime-ops` | Runtime Ops: CORS, Limits, Redaction, Diagnostics & Console | 7 | 8 | store library (running) | CORS, limits, redaction + proof, transforms, callbacks |
| AM-20 | `am-20-tls-mtls` | HTTPS, HTTP/2 & mTLS with Cert-Subject Matching | 7 | 8 | 1 plain server + 1 rule | TLS generate, HTTPS proof, mTLS, cert predicate |
| AM-21 | `am-21-simulation-suite` | Simulation as a Test Suite: Examples, Assertions, Trace | 7 | 8 | 8 samples w/ expectations | ad-hoc run, expectations, run-all, replay, examples |
| AM-22 | `am-22-workflow` | Workflow Orchestration: Start → Apply → Reset → Assert → Stop | 8 | 9 | checkout mock + blank workflow | all 5 mock nodes wired + Quick Test |
| AM-23 | `am-23-harness-ci` | Test Runner Fixtures & CI Handoff | 6 | 7 | store library + scenario suite | fixture config, isolated run, artifact export |
| AM-24 | `am-24-capstone` | Capstone: Ship a Contract Mock | 8 | 9 | *(none — spec import is the first beat)* | the whole pipeline, start to CI artifact |

Registry: new `packages/demo-hub/src/lessons/protocols/api-mock-lessons.ts` exporting `apiMockLessons` (ordered), spread into `protocolsDomain.lessons` — mirrors `graphqlLessons` / `grpcLessons`.

---

## 4. Feature coverage matrix

Canonical tag list lives in `packages/demo-hub/src/lessons/protocols/api-mock-lesson-contract/featureMatrix.ts`; each lesson declares `featureTags`. Test asserts **every tag is claimed** and **no lesson claims an unknown tag**.

| Domain | Tags | Lesson(s) |
|---|---|---|
| **Server lifecycle** | `create-server`, `auto-port`, `start-stop`, `restart`, `hot-apply`, `generation`, `dirty-draft`, `status-states` | 01, 02, 12 |
| **Workspace** | `multi-tab`, `tab-rename`, `tab-duplicate`, `tab-reorder`, `tab-ceiling`, `base-path`, `lan-binding`, `persistence-reload`, `runtime-reconcile` | 02, 19 |
| **Rule library** | `folders`, `folder-drag`, `route-search`, `filter-disabled`, `filter-conflicts`, `filter-method`, `enable-disable`, `delete-undo`, `docs-tab`, `tags-operation-id` | 03 |
| **Path matching** | `path-exact`, `path-parameterized`, `path-glob`, `path-regex`, `path-kind-badge`, `path-generalize`, `toolbox-path-presets`, `toolbox-regex-library` | 04 |
| **Predicates — request** | `pred-query`, `pred-header`, `pred-cookie`, `pred-security-cert`, `pred-security-token`, `op-exact`, `op-contains`, `op-prefix-suffix`, `op-regex`, `op-glob`, `op-present-absent`, `case-sensitivity`, `negate`, `toolbox-constraints` | 05, 20 |
| **Predicates — body** | `pred-json-subset`, `pred-json-strict`, `pred-jsonpath-exists`, `pred-jsonpath-equals`, `pick-from-json`, `pred-json-schema`, `match-style` | 06 |
| **Predicates — formats** | `pred-form-field`, `pred-multipart-field`, `pred-multipart-file`, `pred-xpath`, `pred-xml-schema`, `pred-binary-exact`, `pred-binary-sha256` | 07 |
| **Boolean & selection** | `group-all`, `group-any`, `group-not`, `nested-groups`, `priority`, `policy-highest-priority`, `policy-reject-multiple`, `policy-specificity`, `specificity-breakdown`, `ambiguity-response` | 08 |
| **Conflicts** | `analyze`, `kind-duplicate`, `kind-shadowed`, `kind-definite`, `kind-potential`, `conflict-dimensions`, `witness-simulate`, `adjust-priority`, `goto-rule`, `acknowledge`, `ack-stale`, `conflict-filters` | 09 |
| **Response content** | `status-quick`, `reason-phrase`, `content-type`, `resp-headers`, `resp-cookies`, `body-kind-json`, `body-kind-text-html-xml`, `body-kind-binary`, `format-json`, `body-size-badge`, `preview-pane` | 10 |
| **Templating** | `tpl-pathparam`, `tpl-query-header-cookie`, `tpl-jsonpath`, `tpl-uuid-now-random`, `tpl-oneof-repeat`, `tpl-faker`, `tpl-variables`, `monaco-completions`, `map-body-datamapper`, `template-error-diagnostic` | 11, 19 |
| **Variants & modes** | `variant-add`, `variant-default`, `variant-conditions`, `mode-rules`, `mode-sequence`, `sequence-position`, `mode-weighted`, `weights`, `mode-state`, `state-transition`, `counters`, `state-tab-live`, `state-reset` | 12, 13 |
| **Timing & faults** | `delay`, `jitter`, `max-matches`, `expires-at`, `expires-quick`, `probability`, `fault-timeout`, `fault-reset`, `fault-close`, `fault-malformed`, `fault-dribble`, `chunk-schedule`, `fault-timeline`, `outcome-fault` | 14 |
| **Outbound** | `transform-set-header`, `transform-set-status`, `transform-replace-body`, `callback-webhook`, `callback-allowlist`, `callback-retries`, `variables-crud`, `variables-sensitive` | 19 (transforms/callbacks) , 13 (variables) |
| **Import** | `import-curl`, `import-openapi`, `import-wiremock`, `import-wiremock-loss`, `import-har`, `import-catalog`, `import-requests`, `import-native`, `mode-merge`, `mode-replace`, `mode-copy`, `import-folder-dest`, `import-priority`, `import-generalize`, `draft-enable-prove` | 15 |
| **Export** | `export-workspace-json`, `export-workspace-yaml`, `export-servers`, `export-routes`, `export-wiremock`, `export-har`, `export-redaction`, `round-trip-reimport` | 16 |
| **Proxy & record** | `proxy-enable`, `proxy-allowlist`, `proxy-private-block`, `proxy-forward-auth`, `fallback-proxy`, `record-drafts`, `merge-drafts`, `anti-recursion` | 17 |
| **Journal** | `journal-rows`, `journal-filter`, `tx-detail`, `tx-candidates`, `tx-near-misses`, `promote-create-route`, `promote-save-example`, `promote-open-requests`, `tx-copy`, `journal-clear`, `journal-export`, `fallback-closest-match` | 18 |
| **Runtime ops** | `cors-enable`, `cors-preflight`, `limits-inbound`, `limits-connections`, `graceful-drain`, `redact-headers`, `redact-json-paths`, `journal-persist`, `diagnostics-p95`, `diagnostics-outcomes`, `console-log` | 19 |
| **Security** | `tls-enable`, `tls-generate`, `http2-badge`, `tls-live-proof`, `mtls-require`, `mtls-generate-client`, `cert-subject-match`, `pem-redaction`, `native-parity-warning` | 20 |
| **Simulation** | `sim-samples`, `sim-adhoc`, `sim-expected`, `sim-seed-repro`, `sim-sequential-batch`, `sim-run-all`, `sim-decision-trace`, `sim-normalized`, `sim-rendered`, `sim-assertions`, `sim-export-trace`, `examples-attach`, `examples-simulate`, `examples-try-requests` | 21 |
| **Workflow & CI** | `wf-start-node`, `wf-isolate`, `wf-port-vars`, `wf-apply-node`, `wf-reset-node`, `wf-stop-node`, `wf-assert-count`, `wf-assert-status`, `wf-assert-body`, `wf-assert-header`, `wf-assert-recency`, `wf-quick-test`, `harness-fixture`, `cli-concept` | 22, 23 |
| **Capstone** | `end-to-end-contract` | 24 |

**≈ 205 tags → 24 lessons.** Every tag maps; the test fails the build if a new product feature adds a tag nobody teaches.

### Non-demoable register (narrated, never faked)

| Capability | Why | How v2 handles it |
|---|---|---|
| Shell `curl -k`, `--noproxy` | No terminal in-app | In-app `fetch` / Vite `/__proxy`; cURL text shown via **Copy curl** |
| Real client-cert handshake from browser | Browsers can't attach PEM per-request | mTLS *configured* live; matching proven in **Simulate** `clientCertSubject`; narration explains curl equivalent |
| `cli mock simulate/verify/start` | Shell only | Concept + Test Runner fixture as in-app equivalent (AM-23) |
| Journal disk persistence path | OS temp FS | Setting toggled + narrated; no file browsing |
| `transport` predicate source, `unreachable` conflict kind, `hold_last` sequence exhaustion | Typed but not evaluated/emitted today | Excluded from matrix; tracked in §9 as product follow-ups |

---

## 5. Per-lesson specs

### 5.1 Starting-state policy — live authoring, never a visible import

**The demo never opens the Gallery.** A viewer must watch the feature being *built*, because "click
Import sample" teaches nothing about the feature and every v1 lesson that did it felt like a slideshow.

| Layer | Rule |
|---|---|
| **Every feature the lesson teaches** | Authored **live** in the UI, with visible clicks and spotlights. No exceptions. |
| **Background corpus** (a 12-rule library to search, 4 overlapping pairs to analyze, 8 samples to run) | Loaded **quietly** in `prepareBeforeNavigate`, before step 1 paints. No import beat, no Gallery modal, not narrated as an import. |
| **What may be quiet** | Only material the lesson does *not* teach: sibling rules that exist so filtering/conflicts/priority have something to act on, and prerequisites already taught in an earlier lesson. |
| **What may never be quiet** | Anything in the lesson's `featureTags`. If a tag is claimed, the viewer sees it done. |
| **Gallery presets** | Still ship as product code (real users load them), and lesson corpus reuses the same definitions — but the lesson imports them through the demo bridge, silently. Same content as the Gallery, live demo on top. |

Consequence for Phase 0: presets are still built (§6.2), but they are **corpus fixtures + a product
feature**, not the demo's content. Corpus is deliberately *minimal* — AM-04 starts from one exact rule,
not a finished path library, so the viewer authors every path kind themselves.

### 5.2 Naming — `AM-xx` codes are plan-internal only

The `AM-01 … AM-24` codes exist for this document, file names, E2E projects, and npm scripts.
**They never reach the viewer.**

| Surface | Rule |
|---|---|
| Lesson `name` | The plain title only — `'Studio Tour & Your First Mock'`, never `'AM-01 · …'`. Matches every other lesson in the hub (`SSE Studio`, `Mutations — Create, Update, Delete`). The hub renders order itself. |
| Narration / concept / key terms | Cross-reference other lessons by **title**: "the **Path Matching** lesson covers precedence", not "AM-04 covers precedence". A viewer has no idea what AM-04 is. |
| Lesson `id`, file names, E2E project + script names | Keep the code (`am-01-studio-tour`, `demo-am01`) — these are developer surfaces. |

Short titles for cross-references: **Multi-Server Workspace** (02) · **Rule Library** (03) ·
**Path Matching** (04) · **Request Predicates** (05) · **Body Matching** (06) · **Payload Formats** (07) ·
**Selection Policy** (08) · **Conflict Inspector** (09) · **Response Content** (10) ·
**Dynamic Responses** (11) · **Response Variants** (12) · **Stateful Mocks** (13) ·
**Latency & Faults** (14) · **Import** (15) · **Export & Round-Trip** (16) · **Proxy & Record** (17) ·
**Journal Forensics** (18) · **Runtime Ops** (19) · **HTTPS & mTLS** (20) · **Simulation Suite** (21) ·
**Workflow Orchestration** (22) · **Harness & CI** (23) · **Capstone** (24).

### 5.3 Step specs

Format: `#` **step-id** — concept · beats (`→` = next beat, spotlight moves with each) → **proof**.
`†` = selector/testid to be added in Phase 0.

### Track A — Foundations

#### AM-01 `am-01-studio-tour` — Studio Tour & Your First Mock (8 steps) — **IMPLEMENTED**
**Scenario:** A frontend needs `GET /health` before the real service exists.
**Start:** empty workspace, nothing seeded. **Companion:** required (web).
**Tags:** `create-server`, `auto-port`, `start-stop`, `status-states`, `journal-rows`, `tx-detail`, `path-exact`, `body-kind-json`, `status-quick`, `preview-pane` (power: **Copy address**, **Copy curl**).

1 **workspace-tour** — three views before you build anything · click Runtime → click Conflicts → click Studio → hold on the empty state → **`EMPTY`**
2 **create-server** — a definition + an auto-picked port · click **Create mock server** → reveal `SERVER_BAR` → hold on `ADDRESS` → click `COPY_ADDRESS` (tick) → hold on `STATUS_LABEL` (Stopped) → **`SERVER_BAR`**
3 **author-match** — a rule is match + response · click **+ Add rule** → reveal `ROUTE_EDITOR` → hold on `METHOD_SELECT` (GET) → fill `PATH_INPUT` `/health` → hold on `PATH_KIND` (Exact, inferred) → hold on `PRIORITY_INPUT` → **`PATH_KIND`**
4 **author-response** — what the client actually receives · click `BTAB_RESPONSE` → click `VARIANT_STATUS_QUICK_200` → hold on `VARIANT_STATUS` ⟂ patch JSON body → reveal `BODY_SIZE` → hold on body ⟂ hold on `RESPONSE_PREVIEW` → hold on `PREVIEW_HEADERS` → **`RESPONSE_PREVIEW`**
5 **start** — draft becomes generation 1 · click `START` → reveal `STOP` → hold on `STATUS_LABEL` (Running) → hold on `GENERATION` → hold on `ADDRESS` → **`STOP`**
6 **send-traffic** — real HTTP, no terminal · hold on `ADDRESS` → in-app fetch `GET /health` → hold on `LIVE_TRANSACTIONS` counter → click it → reveal `JOURNAL_FIRST_ROW` → **`JOURNAL_FIRST_ROW`**
7 **inspect** — the journal answers "why this response?" · click row → reveal `TX_DETAIL` → hold on matched rule + duration ⟂ hold on `RUNTIME_SAMPLE_CURL` → click `RUNTIME_COPY_CURL` → **`TX_DETAIL`**
8 **stop** — drain and free the port, keep the draft · click `STOP` → reveal `START` → hold on `STATUS_LABEL` (Stopped) → hold on `FIRST_ROUTE` (rule survived) → **`START`**

(`⟂` marks a `groupBreak` between clusters inside one step.)

#### AM-02 `am-02-multi-server` — Multi-Server Workspace: Tabs, Ports & Binding (8 steps) — **IMPLEMENTED**
**Scenario:** A checkout flow that talks to two services — a `Users API` mock already in the workspace, a `Payments` mock authored live beside it.
**Quiet corpus:** `am-gallery-users` (one server with rules, so tab-switching has something to show). **Live:** the second and third servers, every rename/setting/bind/close. **Companion:** required.
**Tags:** `multi-tab`, `tab-rename`, `tab-duplicate`, `tab-reorder`, `tab-ceiling`, `auto-port`, `base-path`, `lan-binding`, `persistence-reload`, `start-stop` (power: **Duplicate Tab**, **F2 rename**).

1 **tabs-and-new** — one tab per server, each with its own port and status dot · hold on `ACTIVE_TAB` status dot → click `TAB_ADD` → reveal second tab → hold on its auto-assigned port → **`ROUTES_EMPTY`** (a server is a container; rules come later; Start is allowed and unmatched requests 404)
2 **rename** — F2 renames in place; names are how you keep 5 mocks straight · hold on tab → F2 → fill `TAB_RENAME_INPUT`† `Payments` → Enter → hold on label → **`tabTitled('Payments')`**
3 **settings-general** — name/host/port/basePath in one panel; Host is `127.0.0.1` (IP loopback), `localhost` (same machine, hostname in the URL), or `0.0.0.0` (LAN) · click `SETTINGS` → `SETTINGS_TAB_GENERAL`† → hold on `SETTINGS_LISTEN_URL`† → fill `SETTINGS_BASE_PATH`† `/payments/v1` (every rule inherits the prefix) → hold ⟂ select `SETTINGS_HOST`† `0.0.0.0` → hold on `SETTINGS_HOST_WARNING`† (LAN exposure) → back to loopback → Save → **`ADDRESS`** shows the prefix
4 **start-both** — two listeners, two ports, no collision; empty Payments still Starts (every request 404 until a rule exists) · click `START` → reveal `STOP` → hold on empty-state 404 copy → switch to the corpus tab → click `START` → hold on both tab dots → **`TAB_STATUS_DOT_RUNNING`**
5 **switch-tab** — a tab switch swaps the entire workspace, not just the list · hold on corpus rules + address → click the payments tab → hold on `ROUTES_EMPTY` (404 until a rule exists) + prefixed address → click back → **`FIRST_ROUTE`**
6 **duplicate** — clone rules, drop secrets, take a new port · `openTabContextMenu` → `TAB_CTX_DUPLICATE`† → hold on new port → hold on cloned rule list → hold on the clone's **stopped** dot → **`tabTitled('Users API copy')`**
7 **reorder-and-ceiling** — order your stack; the 8-tab ceiling protects ports and memory · walk the order → drag last tab before first → walk the order again ⟂ hold on `TAB_ADD` (disabled at the ceiling) → **`SERVER_TAB`**
8 **persist-and-close** — the tab set, order, and active tab are saved; runtime is re-checked on load, and closing a running server offers **Stop & Close** · walk tabs → hold on the Running dot → `tabClose(Payments)` → reveal `CONFIRM_DIALOG`† → hold on `CONFIRM_TITLE`† (“Stop and close”, not “Confirm Deletion”) → `CONFIRM_ACCEPT`† → **`tabTitled('Users API')`** still serving

**Deviations from the original spec.** Persistence is narrated, not reload-driven — a bridge reload mid-lesson drops the demo player, so step 8 teaches persistence in narration and spends its beats on the safe-close flow instead. Base path is `/payments/v1` (service-shaped) rather than a generic `/api/v1`, and the host beat returns to loopback before saving so the lesson never leaves a LAN-exposed listener behind.

#### AM-03 `am-03-rule-library` — Rule Library: Folders, Search, Filters & Docs (8 steps) — **IMPLEMENTED**
**Scenario:** A storefront mock that has outgrown a flat list — twelve rules across Catalog / Cart / Orders, two of them parked as drafts and two of them quietly overlapping.
**Quiet corpus:** `am-gallery-store` — 12 rules, 3 folders, 2 drafts, 1 deliberate overlap (the corpus is the *subject*, not the lesson). **Live:** every navigation and edit feature. **Companion:** no.
**Tags:** `folders`, `folder-drag`, `route-search`, `filter-disabled`, `filter-conflicts`, `filter-method`, `enable-disable`, `delete-undo`, `docs-tab`, `tags-operation-id`, `analyze` (power: **Cmd+Z undo**, folder drag, tag-driven search).

1 **explorer-tour** — read the tree before you touch it · hold on `RULES_COUNT`† → walk the three folder headers ⟂ hold on `ROUTE_METHOD_CHIP`† → `ROUTE_PATH`† → `ROUTE_PRIORITY_BADGE`† ⟂ collapse + re-expand **Cart** → hold on `ROUTES_FOOTER` tally → **`ROUTE_EXPLORER`**
2 **search** — search reads path, name, tag, method and `operationId` · fill `ROUTE_SEARCH` `cart` → hold ⟂ fill `smoke` (a *tag* — three rules from three folders) → hold ⟂ fill `zzz-no-match` → reveal `ROUTES_NO_MATCH` → clear → **`ROUTE_ROW`**
3 **filters** — hide drafts, isolate a method · click `ROUTE_FILTER` → hold on `FILTER_SHOW_DISABLED` + `FILTER_CONFLICTS_ONLY` (empty until analysis) ⟂ toggle show-disabled off → hold on the tree without drafts → toggle back on ⟂ select `FILTER_METHOD` POST → hold → back to ALL → close → **`DRAFT_ROUTE`**
4 **folders** — group by domain, then drag a rule in · click `ADD_FOLDER` → double-click the header → rename to `Checkout` ⟂ drag `POST /orders` onto it → hold on the filled folder ⟂ hold on `UNGROUPED_LABEL`† (the reverse gesture) → **`folderNamed('Checkout')`†**
5 **enable-disable** — disable keeps the rule but takes it out of matching · hold on the row + tally → toggle `ROUTE_ENABLED` off → hold on the dimmed row + shifted tally ⟂ toggle back on → **`ROUTE_ENABLED`**
6 **delete-undo** — the confirm, then a 5-second undo window (and Cmd+Z) · click `routeDelete(id)`† → reveal `CONFIRM_DIALOG` → hold on the sample-unassociation warning → accept ⟂ reveal `UNDO_TOAST` → click `UNDO_RESTORE` → hold on the restored row → **`ROUTE_ROW`**
7 **docs** — Documentation is contract metadata, not comments · click `BTAB_DOCS` → hold on `DOCS_FOLDER`† (file without dragging) ⟂ fill `DOCS_SUMMARY`† → hold on `ROUTE_TITLE` following it → fill `DOCS_OPERATION_ID`† `searchProducts` → fill `DOCS_TAGS`† `catalog, regression` ⟂ search `regression` → hold on the one surfaced rule → clear → **`DOCS_TAGS`†**
8 **library-health** — two numbers and one button · hold on `RULES_COUNT`† + `ROUTES_FOOTER` ⟂ click `ANALYZE` → reveal `CONFLICT_INSPECTOR` → hold on `CONFLICT_SUMMARY` + first finding + equal-priority policy → **`CONFLICT_INSPECTOR`**

**Deviations from the original spec.** The old step 1 held on `CONFLICT_NOTICE`, which does not exist before an analysis — conflicts are computed, not stored — so the conflict story moved to the closing step. **Analyze all** now jumps to the Conflict Inspector, so step 8 follows that view instead of waiting on the (unmounted) explorer badge and **Conflicts only** filter. Folder rename is a double-click on the header (the product's affordance) rather than a fill on create, and the folders step also names the **Ungrouped** drop zone so the reverse gesture is discoverable. The documentation step ends by proving the tag it just wrote is searchable, which is the reason to write tags at all.

### Track B — Matching

#### AM-04 `am-04-path-matching` — Path Matching & the Pattern Toolbox (7 steps) — **IMPLEMENTED**
**Scenario:** One rule captured from one real request. The corpus is the *problem*: every other matcher kind is authored live on top of it.
**Quiet corpus:** `am-gallery-paths` — a single exact rule `/products/42`, no folders, no samples. **Offline** (Simulate only — no listener, no traffic).
**Tags:** `path-exact`, `path-parameterized`, `path-glob`, `path-regex`, `path-kind-badge`, `path-generalize`, `toolbox-path-presets`, `toolbox-regex-library`, `sim-adhoc`, `sim-rendered` (power: **path generalize**, **regex library with pass/fail samples**).

1 **exact-to-param** — a recorded path is a literal, and literals do not scale · hold on `PATH_INPUT` `/products/42` → hold on `PATH_KIND` (`exact`) ⟂ fill `/products/:id` → hold on the badge re-inferring **`parameterized`** → hold on `PRIORITY_INPUT` (kind and priority are independent) → **`PATH_KIND`**
2 **prove-param** — prove it before you trust it · Simulate `/products/7` → hold on `SIMULATE_OUTCOME`† MATCHED + the rule as Winner → `SIMULATE_TAB_REQUEST` → hold on `SIMULATE_NORMALIZED` (decoded path segments) ⟂ Simulate `/products/abc` → **also MATCHED** (the looseness the rest of the lesson fixes) → close → **`PATH_KIND`**
3 **toolbox-tour** — the wand is a pattern workbench, not a hint popup · click `PATH_TOOLBOX` → reveal `PATTERN_TOOLBOX` → preset `/users/:id` → hold on `TOOLBOX_PATTERN` + `TOOLBOX_SAMPLE` + `TOOLBOX_RESULT` ⟂ preset **nested params** → hold on `TOOLBOX_EXTRACTION`† (two captures) ⟂ preset `/api/**` → hold on `TOOLBOX_KIND` flipping to Glob ⟂ `TOOLBOX_CANCEL` → **`PATH_INPUT`** unchanged
4 **generalize** — generalize a recorded path, then test with a value you did not record · add rule `/orders/A-1098` → hold on `PATH_KIND` ⟂ `PATH_TOOLBOX` → hold on `TOOLBOX_SEGMENTS`† → click `toolboxSegment(1)`† → hold on `TOOLBOX_SUGGESTED`† `/orders/:orderId` ⟂ fill sample `/orders/B-2001` → hold on `TOOLBOX_RESULT` + `TOOLBOX_EXTRACTION`† (`orderId` captured) → `TOOLBOX_APPLY` → **`PATH_KIND`** parameterized
5 **glob** — one rule for a whole subtree, and the one character that changes it · add rule `/assets/**` → hold on `PATH_KIND` glob ⟂ sample `/assets/img/logo.png` → hold on match ⟂ pattern `/assets/*.png` → hold on **rejected** (`*` stays in one segment) ⟂ restore `**` → hold on match → `TOOLBOX_APPLY` → **`PATH_KIND`**
6 **regex-library** — take a tested pattern off the shelf, then anchor it to a path · reopen the products rule → `TOOLBOX_TAB_REGEX` → search `numeric` → pick **Numeric ID** → hold on `TOOLBOX_REGEX` + `TOOLBOX_SAFETY`† → walk each pass/fail sample row† ⟂ anchor to `^/products/[0-9]+$` → re-point the pass samples at real paths → hold on Safety ⟂ `TOOLBOX_FLAG_CI`†/`TOOLBOX_FLAG_CS`† → `TOOLBOX_APPLY` → **`PATH_KIND`** regex
7 **prove-regex** — a matcher you cannot fail is a guess · Simulate `/products/abc` → hold on **UNMATCHED** + the candidate's **Path failed** row† ⟂ Simulate `/products/42` → hold on MATCHED → `SIMULATE_TAB_RENDERED` → hold on `SIMULATE_RENDERED_BODY` → close → **`ROUTE_EXPLORER`** with three shapes

**Deviations from the original spec.** Simulate has no `pathParams` block in its trace, so the capture story lives where the product actually shows captures — the toolbox **Extraction** panel and the verdict line (steps 3, 4) — while step 2 uses **Normalized request** (`pathSegments`) to explain what the matcher compares. Step 2 gained a second probe (`/products/abc` matching) because that failure is the reason steps 5–7 exist; the old spec proved only the happy path. The glob beat authors a real rule instead of only typing in the toolbox, so `**` vs `*` is contrasted on a matcher that is then applied. The regex library ships id-shaped *fragments* (`^[0-9]+$`) with fragment samples, so step 6 anchors the expression to the whole path and re-points the pass samples at real paths — that rewrite is the teaching point, not a workaround. Kind is never picked from the `TOOLBOX_KIND` selector except via the `**` preset, which keeps inference as the lesson's spine.

#### AM-05 `am-05-request-predicates` — Query, Header, Cookie & Security Conditions (8 steps) — **IMPLEMENTED**
**Scenario:** One rule that answers every caller identically. The corpus is the *problem*: seven conditions across five sources are authored live on top of it.
**Quiet corpus:** `am-gallery-predicates` — one `GET /reports` rule with an **empty** Match group, no folders, no samples. **Offline** (Simulate only — no listener, no traffic).
**Tags:** `pred-query`, `pred-header`, `pred-cookie`, `pred-security`, `op-exact`, `op-prefix`, `op-regex`, `op-present`, `case-sensitivity`, `group-not`, `nested-groups`, `toolbox-constraints`, `sim-adhoc`, `sim-decision-trace` (power: **Security source facets**, **wand → toolbox on a condition**, **Query & headers bulk add**).

1 **first-condition** — same path, different behaviour by request shape · hold on `CONDITIONS_EMPTY` (matches on method and path alone) ⟂ click `ADD_CONDITION` → hold on the new row as the whole grammar → select `conditionSource`† **Query** (the 7-source list) → fill selector `page` → fill `conditionValue`† `2` → hold on `groupCount`† → **`FIRST_CONDITION`**
2 **prove-query** — matched *and* unmatched, both on purpose · Simulate `/reports?page=2` → hold on MATCHED → hold on the query trace row ⟂ Simulate `/reports?page=3` → hold on UNMATCHED + **Conditions failed** → hold on `query "page" exact failed — got "3"` → close → **`FIRST_CONDITION`**
3 **header-operators** — operators are the vocabulary · add condition → `x-tenant` (Header is already the default source) → select **Prefix** `acme-` → hold (starts-with, not contains-anywhere) ⟂ select **Exact** `acme-eu` → hold on the pinned row → **`LAST_CONDITION`**
4 **security-source** — auth without hand-parsing a header · add condition → select source **Security** → reveal the key field turning into a facet dropdown → select **Certificate subject** → hold on the `CN=client-name` placeholder ⟂ select **Scheme** → fill `Bearer` → hold → **`LAST_CONDITION`**
5 **guard-group** — turn a matcher into a guard · click `ADD_GROUP` → reveal `NESTED_GROUPS` → hold on `groupEmpty`† (inert on its own) → select `groupCombinator`† **None of** ⟂ click `groupAddCondition`† → fill `x-debug` → select **Present** → hold on the disabled value box → hold on the whole group → **`NESTED_GROUPS`**
6 **cookie-regex** — session-flavoured mocks, and the case flag that matters · add condition → select **Cookie** → fill `sid` → select **Regex** → reveal `conditionToolbox`† (the wand) ⟂ click the wand → fill `TOOLBOX_REGEX` `^S-[0-9]{4}$` → hold on `TOOLBOX_SAFETY` → rewrite four sample rows → hold on the lower-case row failing ⟂ `TOOLBOX_FLAG_CI` → hold on the same row passing → `TOOLBOX_APPLY` → **`LAST_CONDITION`**
7 **constraints-bulk** — compose a whole request shape at once · click `PATH_TOOLBOX` → `TOOLBOX_TAB_CONSTRAINTS` → compose header `x-api-version` `2024-11` ⟂ `TOOLBOX_ADD_CONSTRAINT`† → compose query `format` `json` ⟂ `TOOLBOX_APPLY` → hold on `groupCount`† jumping by two → hold on the appended row → **`LAST_CONDITION`**
8 **prove-all** — the trace ticks every predicate, so you know *which* one failed · Simulate the fully shaped request (query + `AUTHORIZATION` in upper case + `X-Tenant` + `X-Api-Version` + `Cookie: sid=s-2048`) → MATCHED → `SIMULATE_TAB_TRACE` → walk every trace row → hold on the **red** `x-debug` row inside None of ⟂ Simulate the same request **plus** `X-Debug: 1` → hold on UNMATCHED + **Conditions failed** → hold on the debug row now ticking → close → **`ROUTE_EXPLORER`**

**Deviations from the original spec.** There is no per-row negate toggle in the product — negation is a **group** combinator — so the old step 4 became a nested **None of** guard holding a `present` check, which is how the Studio actually spells "reject when this is true" (and it previews the group work in **Boolean Groups, Priority & Policy**). `Absent` is narrated as the mirror rather than authored, because a second value-less row teaches nothing new. There is no per-condition case toggle either: case-insensitivity is a regex/glob flag set from the wand, so it moved into the cookie step where **Ignore case** visibly flips one failing sample green. The old step 3 used `authorization` `contains Bearer`; that is exactly the hand-rolled matcher the **Security** source replaces, so the header step teaches `prefix` → `exact` on a tenant header instead and step 4 does auth properly. The toolbox tab is labelled **Query & headers** in the product (not "Constraints"), and its apply button is **Add conditions**. Step 8 sends a header name in upper case on purpose to prove names are normalized while values are not, and calls out that trace rows are *leaf* results — inside `None of`, a red row is the pass — because that is the single most confusing thing about reading the trace.

#### AM-06 `am-06-body-matching` — Body Matching: Subset, Strict, JSONPath & JSON Schema (6 steps) — **IMPLEMENTED**
**Scenario:** One `POST /orders` rule whose only condition is a forgiving `json_subset`. The corpus is the *starting point*; strict equality, a JSONPath matcher picked out of a sample payload, the match-style toggle, and a JSON Schema contract are authored live and proven in Simulate.
**Quiet corpus:** `am-gallery-bodies` — one `POST /orders` rule with a single `json_subset` predicate (`{"customer":{"tier":"gold"}}`) answering `201`, no folders, no samples. **Offline** (Simulate only — no listener, no traffic).
**Tags:** `pred-json-subset`, `pred-json-strict`, `pred-jsonpath-exists`, `pred-jsonpath-equals`, `pick-from-json`, `pred-json-schema`, `match-style`, `sim-adhoc`, `sim-rendered` (power: **pick-from-JSON**, **schema presets**).

1 **subset-baseline** — subset means "contains at least this" · hold on `conditionRow`† → hold on `conditionOperator`† (`json_subset`) → hold on `conditionSchema`† (the tiny expected fragment) ⟂ Simulate the rich payload (id + two items + `note`) → hold on MATCHED → hold on the `json_subset` trace row → close → **`FIRST_CONDITION`**
2 **strict-and-back** — strict is deep equality, and that is usually too strict for a mock · select `json_strict` → hold on the *unchanged* expected JSON ⟂ Simulate the same body → hold on UNMATCHED + **Conditions failed** → hold on the `json_strict` trace row naming the body it read ⟂ select `json_subset` again → **`FIRST_CONDITION`**
3 **pick-from-json** — stop memorizing JSONPath (merges old steps 3–5) · click `PATH_TOOLBOX` → `TOOLBOX_TAB_JSONPATH` → fill `TOOLBOX_JSON_SAMPLE` with the same payload → hold on `TOOLBOX_JSON_VALID`† ⟂ select `"RF-100"` in the editor → hold on derived `TOOLBOX_JSONPATH` `$.items[0].sku` → hold on `TOOLBOX_JSON_RESOLVED` ⟂ clear `TOOLBOX_JSON_EXPECTED` → hold on `TOOLBOX_JSON_RESULT` (exists) → refill → hold again (equals) → `TOOLBOX_APPLY` → hold on `groupCount`† → **`LAST_CONDITION`**
4 **match-style** — one button decides how the resolved value is compared · hold on `conditionExpr`† → hold on `conditionMatchStyle`† (`equals`) ⟂ click it → **`contains`** → fill `RF-` (one rule for the whole SKU family) → **`LAST_CONDITION`**
5 **json-schema** — validate *shape*, not values — the contract-testing matcher · `PATH_TOOLBOX` → `TOOLBOX_TAB_SCHEMA`† → hold on `TOOLBOX_SCHEMA_KIND_JSON`† ⟂ preset **Required id** → hold on `TOOLBOX_SCHEMA_EDITOR`† ⟂ fill the real contract (required `customer`/`items`, `customer.required` `id`+`tier`, tier enum, `minItems`) → `TOOLBOX_APPLY` → hold on `groupCount`† → hold on the `jsonSchema` row → **`LAST_CONDITION`**
6 **prove-schema** — the trace names the matcher that rejected the body · Simulate the order missing `customer.id` (subset ✓, JSONPath ✓) → hold on UNMATCHED → walk every trace row → hold on the red `jsonSchema` row ⟂ Simulate the complete order → MATCHED → `SIMULATE_TAB_RENDERED` → hold on `SIMULATE_RENDERED_BODY` → close → **`ROUTE_EXPLORER`**

**Deviations from the original spec.** Old steps 3–5 (**pick-from-json**, **resolved-value**, **exists-vs-equals**) are one step: they happen in the same toolbox tab on the same derived path, and splitting them would have re-read the same three fields across three reading pauses. That drops the lesson to **6 steps** without losing a beat. Selecting a value in the sample editor fills **Expected** automatically, so `exists` is taught by *clearing* it and watching the verdict change, then restoring it — the product's own switch between `jsonPath_exists` and `jsonPath_equals`. Match style is taught on a single-valued path rather than the wildcard `$.items[*].sku`: the toolbox's live verdict cannot express `contains` against a list of resolved values, so a wildcard demo there would show a misleading cross. The schema step uses the tab's **Required id** preset before pasting the real contract, per the "always demonstrate the power-user button" rule. Simulate is seeded from the selected rule, so it opens on `POST /orders` and the method is only picked when something left it on another verb.

#### AM-07 `am-07-payload-formats` — Forms, Multipart, XML & Binary Matching (7 steps) — **IMPLEMENTED**
**Scenario:** Four bare rules, none of them JSON — a urlencoded token form, a multipart upload, a namespaced SOAP order, a raw firmware blob. All four answer *any* body, which is the problem; every matcher is authored live and proven in Simulate.
**Quiet corpus:** `am-gallery-formats` — `POST /oauth/token`, `POST /uploads` (201), `POST /soap/orders` (XML response), `PUT /firmware`, all with empty Match groups, no folders, no samples. **Offline** (Simulate only — no listener, no traffic).
**Tags:** `pred-form-field`, `pred-form-regex`, `pred-multipart-field`, `pred-multipart-file`, `pred-xpath`, `pred-xml-schema`, `pred-binary-exact`, `pred-binary-sha256`, `sim-adhoc`, `sim-normalized`, `sim-rendered` (power: **XPath presets + live Resolved**, **XML Schema preset**).

1 **form-matching** — a form is a query string in the body, so match it by field · hold on each of the four bare rules → click the token rule → hold on `PATH_INPUT` → hold on `CONDITIONS_EMPTY` ⟂ add condition → source **Body** → hold on the greyed `(whole body)` key box → select `form_field_exact` → fill the `username` / `ada.lovelace` pair → **`FIRST_CONDITION`**
2 **prove-form** — the `Content-Type` is what makes it a form · Simulate the urlencoded body + `application/x-www-form-urlencoded` → hold on MATCHED → hold on the `form_field_exact` trace row → close ⟂ select `form_field_regex` → fill `^ada\.` ⟂ Simulate the regional body (`ada.lovelace.eu`) → MATCHED → hold on the `form_field_regex` row → close → **`FIRST_CONDITION`**
3 **multipart-fields** — text parts and file parts are matched separately · click the upload rule → hold on `CONDITIONS_EMPTY` ⟂ add `multipart_field` `title` / `Q3 revenue report` ⟂ add `multipart_file` `document` / `report.pdf` → hold on `groupCount`† → **`LAST_CONDITION`**
4 **prove-multipart** — a real multipart body, matched with no server running · Simulate the boundary-delimited payload + `multipart/form-data; boundary=…` → MATCHED → hold on both multipart trace rows ⟂ `SIMULATE_TAB_REQUEST` → hold on `SIMULATE_NORMALIZED` → `SIMULATE_TAB_RENDERED` → hold on the `201` body → close → **`LAST_CONDITION`**
5 **xpath** — let the toolbox write the namespace-safe expression, then prove it · click the SOAP rule → hold on `CONDITIONS_EMPTY` ⟂ `PATH_TOOLBOX` → `TOOLBOX_TAB_XPATH`† → preset **Local name** → fill sample + expr → hold `TOOLBOX_XPATH_RESOLVED`† → fill value → `TOOLBOX_APPLY` → Simulate the full envelope → ring `SIMULATE_RUN` → hold **MATCHED** + `xpath_equals` → close → **`LAST_CONDITION`**
6 **xml-schema** — required elements without the XSD ceremony · `TOOLBOX_TAB_SCHEMA` → preset **XML names** → fill the element list → `TOOLBOX_APPLY` → Simulate the envelope missing `<customer>` → ring `SIMULATE_RUN` → hold **UNMATCHED** → hold the ticking `xpath_equals` row, then the red `xmlSchema` row → close → **`LAST_CONDITION`**
7 **binary** — pin an upload by its bytes, or by its digest · click the firmware rule → add `binary_exact` → paste the blob ⟂ select `binary_sha256` → fill the 64-char digest ⟂ Simulate the matching payload → ring `SIMULATE_RUN` → hold **MATCHED** ⟂ Simulate `v2.4.1` → ring `SIMULATE_RUN` → hold **UNMATCHED** → hold `SIMULATE_PREDICATE_FAIL`† (`body binary_sha256 failed`) → close → **`ROUTE_EXPLORER`**

**Deviations from the original spec.** The corpus is **four** rules, not three: a firmware endpoint was added so the binary step has a rule of its own rather than borrowing the upload rule, and the old step 1 (**beyond-json**, a tour of the bare rules) is folded into the form step's opening beats — a reading pause to look at four empty rules is not a step. The XPath preset in the plan (`//Order/@id`) does not exist and would have taught the wrong thing: the product's presets are written with `local-name()`, which is what a namespaced SOAP envelope actually requires, so the step teaches that instead. `xmlSchema` takes a comma-separated **element list**, not an XSD, so the schema step fills that. The binary step pastes a short blob under `binary_exact` first — that is the beat that shows *why* the digest matcher exists — and re-points the same row to `binary_sha256` rather than adding a second row.

**Product changes this lesson forced.** The key box on a **body** condition is now disabled and reads `(whole body)`, because the matcher ignores it and an editable box implied otherwise. `form_field_present` now accepts a bare field name (the UI shows a single box for it, so the pair-shaped expected value was unreachable). The toolbox's XPath tab gained a live **Resolved** read and a ✓ / × verdict, matching the JSONPath tab — without it, a wrong expression only surfaced as a rule that never fired.

#### AM-08 `am-08-selection-policy` — Boolean Groups, Priority & Policy (8 steps) — **IMPLEMENTED**
**Scenario:** Two `GET /catalog` rules at equal priority. Regional already requires `X-Api-Version: 2024-11`; Default matches everything. Nested OR tenants, a None-of debug guard, a raised priority, and the two multiple-match policies are authored live and proven in Simulate.
**Quiet corpus:** `am-gallery-selection` — Catalog API with **Regional catalog** (header `x-api-version` exact `2024-11`) and **Default catalog** (empty Match), both priority 10, default `highest_priority` + `equalPriorityPolicy: reject`. **Offline** (Simulate only).
**Tags:** `group-all`, `group-any`, `group-not`, `nested-groups`, `priority`, `policy-highest-priority`, `policy-reject-multiple`, `policy-specificity`, `specificity-breakdown`, `ambiguity-response`, `sim-decision-trace`.

1 **all-vs-any** — All of is the AND; Any of lives in a nested group · hold on root `GROUP_COMBINATOR` (All of) → hold on the version row ⟂ `[ ] Group` → reveal nested group → switch nested combinator to **Any of** → hold on the empty nested group → **`NESTED_GROUPS`**
2 **nested-group** — real predicates are `A AND (B OR C)` · two `+ Condition` inside the nested group → `x-tenant` exact `acme-eu` ⟂ `x-tenant` exact `acme-us` → hold on the nested tree → **nested group**
3 **not-group** — None of is a guard, and it fails closed · `[ ] Group` → switch to **None of** → hold on the fail-closed note ⟂ `x-debug` **present** → **NOT group**
4 **prove-logic** — the same request still matches two rules · Simulate `GET /catalog` with version + `acme-eu` → **AMBIGUOUS** → hold on Regional's passing eu row and missing us row ⟂ hold on Default (empty Match) → close → **`ROUTE_EXPLORER`**
5 **priority** — priority breaks ties; higher wins · fill `PRIORITY_INPUT` 20 → hold ⟂ Settings → Selection → hold on the two policy selects → save → **`PRIORITY_INPUT`**
6 **highest-priority** — the quiet policy: pick the winner and move on · Simulate the same request → hold on **Winner** → hold on Default as a matching loser → close → **`PRIORITY_INPUT`**
7 **reject-multiple** — the loud policy: 409 instead of guessing · Settings → `reject_multiple` → edit `SETTINGS_AMBIGUITY_BODY` ⟂ Simulate → **AMBIGUOUS** → hold Rendered 409 body → close → **`ROUTE_EXPLORER`**
8 **specificity** — for equal priority, score the matchers · Settings → `specificity_then_id` (Regional back at 10) → Simulate → hold Winner + `SIMULATE_SPECIFICITY` + timeline step 3 → close → **`ROUTE_EXPLORER`**

**Deviations from the original spec.** The UI cannot wrap existing rows into a nested group, so step 1 does **not** flip the root combinator to Any of (that would turn the version header into an OR and make `A AND (B OR C)` unreachable). Root stays **All of**; **[ ] Group** adds a child that is switched to **Any of**, and the two tenant headers are authored inside it. Step 3 is a *second* nested group (None of), not a combinator change on the tenant group. Step 4's "failing branch" is the `acme-us` row inside Any of (and Default as a second overall match) — the request is constructed so Regional's logic *passes*, which is what makes the tie real. `reject_multiple` is taught after priority 20 on purpose: it fires *before* priority, so 20 does not save you. Step 8's guard restores equal priority and the quiet multiple-match policy so the live beat is only the equal-priority dropdown. Settings / Simulate overlays close before each step ends.

**Product changes this lesson forced.** `selectRoute` now populates `policyDecision.specificityBreakdown` when two or more rules tie at the highest priority (the field existed on the contract but was never filled). Simulate renders that list and a **Winner** `data-testid`. The Selection settings tab gained an editable **Ambiguous response** body (`{{requestId}}` / `{{competingRuleCount}}`). None-of groups show a fail-closed note. The demo bridge can quietly patch the active server's selection policy so replayed policy steps start clean.

#### AM-09 `am-09-conflicts` — Conflict Inspector (12 steps) — **IMPLEMENTED**
**Quiet corpus:** `am-gallery-overlaps` — eight path-disjoint rules that analyze into one finding of each kind (duplicate / shadowed / definite / potential). **Live:** analyze, Duplicate name → Simulate witness → Open in Studio, then Shadowed → Simulate MATCHED, then Definite → Simulate daily 409 and non-daily 200, then Potential → Simulate header 409 and no-header 404, fix, acknowledge. **Offline.**
**Tags:** `analyze`, `kind-duplicate`, `kind-shadowed`, `kind-definite`, `kind-potential`, `conflict-dimensions`, `conflict-filters`, `witness-simulate`, `adjust-priority`, `goto-rule`, `acknowledge`, `ack-stale`.

1 **analyze** — overlaps have names before any client sends · click `ANALYZE` → hold `CONFLICT_SUMMARY` (4 findings) → walk the list Duplicate → Shadowed → Definite → Potential → **`FIRST_FINDING`**
2 **duplicate** — Duplicate is the request line, not the record · open both `/health` rules → `VIEW_CONFLICTS` → `conflictFilter('duplicate')` → fingerprints → **`CONFLICT_FINGERPRINTS_OPEN`**
3 **witness** — Simulate this Duplicate; the mock refuses to guess · hold on `CONFLICT_WITNESS` → click `CONFLICT_SIMULATE` → run → hold on ambiguous → close → **ambiguous result**
4 **goto-rule** — the same Duplicate, from the rule · click `CONFLICT_GOTO_LEFT`† → reveal `ROUTE_EDITOR` → hold on the rule → back to Conflicts → **`ROUTE_EDITOR`**
5 **shadowed** — Shadowed is a rule that can never win · open both `/orders` rules → `VIEW_CONFLICTS` → `conflictFilter('shadowed')` → dimensions → **`CONFLICT_DETAIL`**
6 **shadowed-witness** — Simulate this Shadowed; the catch-all still wins · hold on `CONFLICT_WITNESS` → fill `x-tenant: acme` → run → both `GET /orders` → Winner catch-all → Rendered **200** `scope: "all"` → close → **`CONFLICT_INSPECTOR`**
7 **definite** — Definite is a collision the analyzer can prove · open Daily + Reports glob → `VIEW_CONFLICTS` → `conflictFilter('definite')` → dimensions → **`CONFLICT_DETAIL`**
8 **definite-witness** — Simulate this Definite; one path collides, the other does not · Save as sample + `/reports/daily` → **409** ⟂ Save as sample + `/reports/non-daily` → glob Winner → **200** `{"report":"any"}` → close → **`CONFLICT_INSPECTOR`**
9 **potential** — Potential is the honest “we cannot decide” · open both `/search` rules → `VIEW_CONFLICTS` → `conflictFilter('potential')` → **`CONFLICT_DIM_UNKNOWN`**
10 **potential-witness** — Simulate this Potential; the header decides the status · Save as sample + `x-client: acme-west` → **409** ⟂ Save as sample + no header → **404** → close → **`CONFLICT_INSPECTOR`**
11 **fix-priority** — ranking picks a winner, it does not delete the overlap · click `CONFLICT_PRIO_LEFT` → hold on the +10 → hold on the shrinking `CONFLICT_SUMMARY` → **summary dropped**
12 **acknowledge** — a snapshot, not a lifetime waiver · click `CONFLICT_ACKNOWLEDGE` → hold on `CONFLICT_ACK` ⟂ edit the rule → hold on `CONFLICT_STALE`† → **`CONFLICT_STALE`†**

### Track C — Responses

#### AM-10 `am-10-response-content` — Response Content (8 steps) — **IMPLEMENTED**
**Quiet corpus:** one rule returning a plain `200 {}`. **Live:** every status, header, cookie, and body kind. **Companion** for the final proof.
**Tags:** `status-quick`, `reason-phrase`, `content-type`, `resp-headers`, `resp-cookies`, `body-kind-json`, `body-kind-text-html-xml`, `body-kind-binary`, `format-json`, `body-size-badge`, `preview-pane` (power: **Format JSON**).

1 **status-line** — the whole status line is yours: code, reason, type · click `RESPONSE_TAB_CONTENT`† → click `VARIANT_STATUS_QUICK_201`† → hold ⟂ fill `VARIANT_STATUS_REASON`† (legacy clients read it) → select `VARIANT_CONTENT_TYPE_SELECT`† → **status 201 + reason**
2 **format-json** — paste minified, ship readable — Format never breaks templates · patch minified body → hold on the unreadable blob → click `BODY_FORMAT`† → hold on formatted body → hold on `BODY_SIZE`† → **formatted + size badge**
3 **headers** — cache, tracing, rate-limit headers are part of the contract · click `ADD_HEADER` → fill `x-request-id` → hold ⟂ add a second header → hold on the header list → **two header rows**
4 **cookies** — the cookie builder covers HttpOnly / Secure / SameSite · click `ADD_COOKIE` → fill `COOKIE_NAME`† + value → toggle `COOKIE_HTTPONLY`† → hold on the flag row → **cookie row**
5 **preview** — read the delivered bytes before a client does · hold on `PREVIEW_HEADERS`† → hold on cookie line → hold on body → **`RESPONSE_PREVIEW`**
6 **other-body-kinds** — HTML, text, XML, and base64 binary for non-JSON endpoints · select `text/html` + patch markup → hold on preview ⟂ select `application/octet-stream` → hold on the base64 callout → **preview switched**
7 **apply-live** — Apply hot-swaps the running listener without a restart · click `APPLY` → hold on `GENERATION` bump → hold on Running status → **generation bumped**
8 **prove** — the real response carries every piece you authored · in-app fetch → open `TX_DETAIL` → hold on response headers → hold on the cookie → hold on the body → **`TX_DETAIL`**

#### AM-11 `am-11-templating` — Dynamic Responses (9 steps) — **IMPLEMENTED**
**Quiet corpus:** one running rule with a static body. **Live:** every helper typed into the editor. **Companion:** required.
**Tags:** `tpl-pathparam`, `tpl-query-header-cookie`, `tpl-jsonpath`, `tpl-uuid-now-random`, `tpl-oneof-repeat`, `tpl-faker`, `tpl-variables`, `monaco-completions`, `browse-helpers`, `map-body-datamapper`, `template-error-diagnostic` (power: **Monaco `{{` completions**, **Browse helpers**, **Map body**).

1 **static-problem** — a static body cannot echo the request · hold on `VARIANT_BODY` → type `{{` → hold **2000ms** on the Monaco completion list → **Browse helpers** → hold the Request group → search `uuid` → **Close** → **catalog closed**
2 **echo-the-request** — templates read the request that arrived · patch `{{pathParam "id"}}` → hold on `BODY_TEMPLATE_BADGE`† ⟂ patch `{{query}}` / `{{header}}` / `{{cookie}}` → hold → patch `{{jsonPath "$.items[0].sku"}}` → hold → **template badge**
3 **generated-values** — ids, timestamps, and controlled randomness · patch `{{uuid}}` + `{{now}}` → hold ⟂ patch `{{randomInt}}` + `{{oneOf}}` → hold on the varied output → **body preview**
4 **repeat** — build list payloads of any length from one block · patch `{{repeat}}` → hold on the grown body → hold on `BODY_SIZE` → **body grew**
5 **faker** — realistic names, emails, addresses instead of `foo` · patch faker paths → hold **1500ms** on the rendered preview → **preview**
6 **variables** — server variables keep tenant/env out of every body · click `DOCK_TAB_VARIABLES` → add `tenant` → back to the rule → patch `{{variables.tenant}}` → hold → **variable resolved in preview**
7 **prove-twice** — dynamic means *different each call* · click `APPLY` → fetch `/products/42` → hold on `TX_DETAIL` (42 echoed, fresh uuid) ⟂ fetch again → hold on the changed uuid → **two different responses**
8 **map-body** — build a body visually from the request payload · click `BODY_MAP`† → reveal mapper modal → drag request field → response field → close → hold on the updated template → **template updated**
9 **template-error** — a broken expression is reported, never silently empty · patch a broken helper → hold on `DIAG_TEMPLATE_ERRORS`† → fix it → hold on the clean preview → **error surfaced then cleared**

#### AM-12 `am-12-variants-sequence` — Rules & Sequence Modes (8 steps) — **IMPLEMENTED**
**Quiet corpus:** one cart rule with a single 200 variant. **Live:** the second variant, its conditions, both modes. **Companion:** required.
**Tags:** `variant-add`, `variant-default`, `variant-conditions`, `mode-rules`, `mode-sequence`, `sequence-position`, `hot-apply`, `journal-rows`.

1 **one-rule-many-answers** — a rule holds a *set* of responses, chosen by a mode · hold on the variant list → hold on the four mode buttons → hold on `RESPONSE_MODE_RULES`† (the default) → **mode bar**
2 **add-variant** — a 404 sibling for the not-found case · click `ADD_VARIANT` → reveal card → fill `VARIANT_NAME`† → click `VARIANT_STATUS_QUICK_404`† → hold → **new variant card**
3 **variant-conditions** — in rules mode a variant wins on its own conditions · set `SELECTION_CONDITION`† jsonPath condition → hold on the condition row → **condition set**
4 **default-variant** — exactly one enabled default is the fallback · click `SELECTION_DEFAULT`† → hold on the Default badge → hold on the "one only" note → **Default badge**
5 **prove-rules** — same path, two answers, decided by payload · Simulate matching body → hold on variant A → Simulate non-matching → hold on variant B → **two variants proven**
6 **switch-sequence** — round-robin: the retry/backoff test mode · click `RESPONSE_MODE_SEQUENCE`† → hold card **Step 1 / Step 2** → hold `SEQUENCE_POSITION`† **Next: Step 1 of 2** on both cards → **shared cursor**
7 **three-calls** — same request three times — then it wraps · click `APPLY` → fetch → hold on journal row 1 → fetch → hold on the different status → fetch → hold on the wrap-around (200 again) → **three journal rows, two variants**
8 **state-tab** — the live cursor is visible, not guesswork · click `DOCK_TAB_STATE` → hold on `DOCK_SEQ_ROW`† → **`DOCK_SEQ_ROW`†**

#### AM-13 `am-13-stateful` — Stateful Mocks: A Cart That Remembers (8 steps) — **IMPLEMENTED**
**Quiet corpus:** cart rule with two response variants (bodies only — no state wiring). **Live:** state mode, transitions, counters, weights. **Companion:** required.
**Tags:** `mode-state`, `state-transition`, `counters`, `state-tab-live`, `state-reset`, `mode-weighted`, `weights`, `variables-crud`, `variables-sensitive`, `sim-sequential-batch`.

1 **why-state** — a real cart is never the same twice · hold on the two variants → click `RESPONSE_MODE_STATE`† → hold on the new state fields → **state mode**
2 **transition** — the first POST starts the cart and leaves a mark · fill `VARIANT_REQUIRED_STATE`† `EMPTY` → hold → fill `VARIANT_NEXT_STATE`† `HAS_ITEMS` → hold ⟂ click `COUNTER_ADD`† `items += 1` → hold on the counter row → **transition + counter**
3 **second-variant** — the next POST must already see the item · select variant 2 → fill required state `HAS_ITEMS` → hold on its body → **variant 2 wired**
4 **first-call** — send it once, the empty cart answers · click `APPLY` → fetch `POST /cart` → hold on the empty-cart response in `TX_DETAIL` → **journal row**
5 **state-live** — send it again, now there is a line item · click `DOCK_TAB_STATE` → hold on `DOCK_STATE_LIVE`† (`HAS_ITEMS`, `items=1`) ⟂ fetch the same request → hold on the *different* answer → **state advanced**
6 **reset-and-batch** — rewind the cart without killing the server · click `STATE_RESET` → hold on cleared state ⟂ click `SIMULATE_RUN_ALL` → hold on the per-sample state column (sequential, deterministic) → **batch states**
7 **weighted-and-seed** — most of the time empty, sometimes already a SKU · click `RESPONSE_MODE_WEIGHTED`† → fill `VARIANT_WEIGHT`† 90/10 → hold ⟂ run twice → hold on identical results → **identical session runs**
8 **variables** — the tenant stays in the mock, never in the export · click `VAR_ADD`† → add value → toggle sensitive → hold on the masked row → **masked variable**

#### AM-14 `am-14-timing-faults` — When Payments Hang: Latency, Eligibility & Connection Faults (8 steps) — **IMPLEMENTED**
**Quiet corpus:** one payment rule with a plain 200. **Live:** all timing, eligibility, and fault config. **Companion:** required.
**Tags:** `delay`, `jitter`, `max-matches`, `expires-at`, `expires-quick`, `probability`, `fault-timeout`, `fault-reset`, `fault-close`, `fault-malformed`, `fault-dribble`, `chunk-schedule`, `fault-timeline`, `outcome-fault`.

1 **delay-and-jitter** — clients hang on slow, not only on 500 · click `RESPONSE_TAB_TIMING`† → fill `VARIANT_DELAY`† 800 → hold → fill `VARIANT_JITTER`† 200 → hold on the spread note → **timing panel**
2 **preview-then-prove** — preview the wait, then feel it for real · Simulate → hold on the virtual-delay badge ⟂ click `APPLY` → fetch → hold on the ~1s duration in `TX_DETAIL` → **duration column**
3 **max-matches** — the paid answer is allowed once · fill `VARIANT_MAX_MATCHES`† 1 → hold → fetch → hold on variant A → fetch → hold on the fall-through to the sibling → **two outcomes**
4 **expires-and-probability** — not forever, and not every time · click `EXPIRES_QUICK_1H`† → hold on the resolved timestamp ⟂ fill `VARIANT_PROBABILITY`† 0.5 → hold on the eligibility summary → **eligibility set**
5 **faults-panel** — some failures never send HTTP · click `RESPONSE_TAB_FAULTS`† → reveal `FAULTS_PANEL` → hold on the five fault cards → **`FAULTS_PANEL`**
6 **timeout** — the payment never comes back · click `fault('timeout')`† → Apply → fetch (caught) → hold on outcome **fault** in `TX_DETAIL` → **fault outcome**
7 **reset-close-malformed** — the wire breaks, retry must survive · click `fault('reset')`† → Apply → fetch → hold on journal ⟂ hold on close + malformed cards → **fault row**
8 **dribble-and-timeline** — the body arrives in pieces, then stops · click `fault('dribble')`† → click `CHUNK_ADD`† ×2 → hold on the schedule ⟂ Simulate → click `SIMULATE_TAB_TRACE` → hold on the fault timeline → **timeline steps**

### Track D — Traffic & Ops

#### AM-15 `am-15-import` — Import Everything (9 steps) — **IMPLEMENTED**
**Quiet corpus:** blank server + Catalog/Requests entries to promote from. **Live:** every import. **Offline** until the final proof.
**Tags:** `import-curl`, `import-openapi`, `import-wiremock`, `import-wiremock-loss`, `import-har`, `import-catalog`, `import-requests`, `import-native`, `mode-merge`, `mode-replace`, `mode-copy`, `import-folder-dest`, `import-priority`, `import-generalize`, `draft-enable-prove`.

1 **import-panel** — seven sources, one review screen, three modes · click `IMPORT_MENU` → reveal `IMPORT_REVIEW` → hold on the source list → hold on `IMPORT_MODE_MERGE` (merge / replace / copy) → **`IMPORT_REVIEW`**
2 **curl** — the fastest path from "it works in curl" to a mock · fill `CURL_INPUT` → click `CURL_PARSE` → hold on the preview → select `IMPORT_FOLDER`† + fill `IMPORT_PRIORITY`† → hold ⟂ click `IMPORT_GENERALIZE`† → hold on `/users/42` → `/users/:id` → **generalized preview**
3 **drafts-are-safe** — imports land disabled so they cannot hijack traffic · click `IMPORT_CONFIRM` → reveal `DRAFT_ROUTE` → hold on the dimmed row → hold on footer tally → **`DRAFT_ROUTE`**
4 **openapi** — a stub per operation, with operationIds intact · `importSource('openapi')` → paste spec → parse → hold on the operation list → confirm → hold on three drafts → **three drafts**
5 **wiremock** — a stub Studio can keep in full · `importSource('wiremock')` → paste `equalTo` header + query + fixed delay → parse → hold on mapped preview (`GET /orders/99`) → **`IMPORT_PREVIEW`** (no loss report)
6 **har** — recorded browser traffic becomes rules · `importSource('har')` → paste → parse → hold on the request list → confirm → **rules created**
7 **internal-sources** — Catalog endpoints and saved Requests promote directly · `importSource('catalog')` → select two → hold ⟂ `importSource('requests')` → select all → hold → confirm → **rules created**
8 **replace-mode** — replace swaps the entire rule set; know before you click · hold on `IMPORT_MODE_REPLACE` → hold on the destructive-action warning → **warning visible**
9 **enable-and-prove** — an imported draft only matters once it answers traffic · toggle `ROUTE_ENABLED` → click `APPLY` → fetch → hold on the matched journal row → **matched row**

#### AM-16 `am-16-export` — Export & Round-Trip (7 steps)
**Quiet corpus:** store library + a TLS key + a sensitive variable (so redaction has something to strip). **Live:** every export + the re-import. **Offline.**
**Tags:** `export-workspace-json`, `export-workspace-yaml`, `export-servers`, `export-routes`, `export-wiremock`, `export-har`, `export-redaction`, `round-trip-reimport`.

1 **export-menu** — six shapes for six jobs · click `EXPORT` → reveal `EXPORT_MENU` → hold on each group → click `EXPORT_WORKSPACE` → hold on the confirmation → **`EXPORT_MENU`**
2 **narrower-scopes** — YAML for review, one server for a teammate, rules alone to graft · click `EXPORT_WORKSPACE_YAML` → hold ⟂ click `EXPORT_SERVERS` → hold ⟂ click `EXPORT_ROUTES` → hold → **three exports**
3 **redaction** — TLS keys and sensitive variables never leave the workspace · hold on the redaction callout → hold on the empty `SETTINGS_TLS_KEY` field in the exported shape → **redaction proof**
4 **wiremock** — hand a mapping set to a team still on WireMock, with a loss note · click `EXPORT_WIREMOCK` → hold on the confirmation → hold on the lossy-feature note → **loss note**
5 **har** — replay journal traffic in other tools · click `EXPORT_HAR` → hold on the entry count → **HAR export**
6 **round-trip** — the real test of an export is importing it back · click `IMPORT_MENU` → native source → **copy** mode → confirm → hold on duplicated rules with new ids → **rules duplicated**
7 **ci-handoff** — the export file is the artifact CI runs against · hold on `ROUTES_FOOTER` → hold on the copyable `cli mock simulate <file>` line → **command visible**

#### AM-17 `am-17-proxy-record` — Proxy & Record-to-Drafts (8 steps)
**Quiet corpus:** blank server (no proxy config — it is authored live). **Docker:** echo upstream (`docker/api-mock/`). **Companion:** required.
**Tags:** `proxy-enable`, `proxy-allowlist`, `proxy-private-block`, `proxy-forward-auth`, `fallback-proxy`, `record-drafts`, `merge-drafts`, `anti-recursion`, `fallback-closest-match`.

1 **proxy-on** — the fastest mock is a recording of the real thing · open `settingsTab('proxy')` → toggle `SETTINGS_PROXY_ENABLED` → hold on default-deny note → fill `SETTINGS_PROXY_ALLOWLIST` with the echo URL → hold → **allowlist set**
2 **proxy-safety** — a proxy inside a mock is an SSRF surface, so it is fenced · hold on `SETTINGS_PROXY_PRIVATE`† (private-network block) → toggle `SETTINGS_PROXY_FORWARD_AUTH`† (opt-in per header) → hold → **safety controls**
3 **record-and-fallback** — record successful exchanges, and route unmatched traffic upstream · toggle `SETTINGS_PROXY_RECORD` → hold ⟂ select `SETTINGS_FALLBACK_MODE`† Proxy → Save → **settings saved**
4 **start** — Start with the proxy armed · click `START` → reveal Running → hold on `ADDRESS` → **Running**
5 **proxied-call** — a path you never mocked still answers, from upstream · fetch an unmocked path → hold on the response → open `TX_DETAIL` → hold on outcome **proxied** + upstream status → **proxied outcome**
6 **draft-appears** — the real response becomes a draft rule automatically · hold on the new `DRAFT_ROUTE` → hold on its recorded body → **`DRAFT_ROUTE`**
7 **take-over** — enable the draft and the mock owns the endpoint · toggle `ROUTE_ENABLED` → `APPLY` → fetch → hold on **matched** (no upstream hop) → **matched row**
8 **guards** — mocks refuse to proxy themselves, and closest-match is the debugging fallback · hold on the 508 loop-guard note ⟂ select `SETTINGS_FALLBACK_MODE`† closest-match → hold → **fallback switched**

#### AM-18 `am-18-journal` — Journal Forensics & Promotion (8 steps)
**Quiet corpus:** store library, running. **Live:** all traffic (including the deliberate miss) and every promotion action. **Companion:** required.
**Tags:** `journal-rows`, `journal-filter`, `tx-detail`, `tx-candidates`, `tx-near-misses`, `promote-create-route`, `promote-save-example`, `promote-open-requests`, `tx-copy`, `journal-clear`, `journal-export`, `fallback-closest-match`.

1 **journal-tour** — every request and every decision in one table · click `DOCK_TAB_TRANSACTIONS` → fetch two matching requests → hold on the rows → hold on the outcome chips (matched / unmatched / ambiguous / fault / proxied) → **rows**
2 **filter** — find the call you care about, and get an honest empty state · fill `JOURNAL_FILTER` → hold on the narrowed table → fill nonsense → hold on `JOURNAL_FILTER_EMPTY` → clear → **table restored**
3 **the-miss** — why didn't my request match? · fetch `/produts/42` (typo) → hold on the unmatched row → click it → hold on `TX_CANDIDATES`† (everything evaluated) → hold on `TX_NEAR_MISSES`† (what almost matched) → **near-misses**
4 **closest-match** — put that explanation in the 404 body itself · select `RUNTIME_SETTINGS_FALLBACK` closest-match → Save → fetch the typo again → hold on the explanatory body → **debug body**
5 **create-route** — promote an unmatched request into a real rule · click `TX_CREATE_ROUTE`† → reveal the seeded `ROUTE_EDITOR` → hold on the pre-filled match → **seeded rule**
6 **save-example** — freeze a transaction as a regression case · click `TX_SAVE_EXAMPLE`† → reveal `EXAMPLES_GRID` → hold ⟂ click `TX_OPEN_REQUESTS`† → hold on the handoff → back → **example row**
7 **share-and-reset** — copy for a bug report, export for the record, clear between runs · click `TX_COPY`† → hold on copied ⟂ click `JOURNAL_EXPORT` → hold ⟂ click `JOURNAL_CLEAR` → hold on the empty table → **journal cleared**
8 **prove-example** — the saved example runs green · click `BTAB_EXAMPLES` → click `EXAMPLE_SIMULATE`† → hold on the passing result → **passed**

#### AM-19 `am-19-runtime-ops` — Runtime Ops (8 steps)
**Quiet corpus:** store library, running. **Live:** every setting, transform, and callback. **Companion:** required.
**Tags:** `cors-enable`, `cors-preflight`, `limits-inbound`, `limits-connections`, `graceful-drain`, `redact-headers`, `redact-json-paths`, `journal-persist`, `diagnostics-p95`, `diagnostics-outcomes`, `console-log`, `transform-set-header`, `transform-set-status`, `transform-replace-body`, `callback-webhook`, `callback-allowlist`, `callback-retries`.

1 **cors** — browser clients need it, and preflights are invisible on purpose · click `DOCK_TAB_SETTINGS` → toggle `RUNTIME_SETTINGS_CORS` → fill origins → Save ⟂ fetch OPTIONS → hold on the 204 and the *unchanged* journal count → **journal unchanged**
2 **limits** — cap payloads, connections, and the drain window · fill `RUNTIME_SETTINGS_INBOUND`† → hold → fill `RUNTIME_SETTINGS_CONN`† → hold → fill `RUNTIME_SETTINGS_DRAIN`† → hold → **limits set**
3 **redaction-config** — secrets must not land in a journal you will export · fill `RUNTIME_SETTINGS_REDACT_HEADERS` `authorization` → hold → fill `RUNTIME_SETTINGS_REDACT_PATHS` `$.password` → Save → **redaction configured**
4 **prove-redaction** — send a real secret and watch it disappear · fetch with auth header + password body → open `TX_DETAIL` → hold on `***` header → hold on `***` body field → **masked detail**
5 **persistence-and-diagnostics** — long runs need a durable journal and a latency budget · toggle `RUNTIME_SETTINGS_PERSIST`† → hold ⟂ click `DOCK_TAB_DIAGNOSTICS` → hold on `DIAG_MATCH_P95`† (sub-millisecond) → hold on outcome counters → **diagnostics**
6 **console** — lifecycle truth: start, commit, stop, errors · click `DOCK_TAB_CONSOLE` → hold on the start/commit lines → **console lines**
7 **transforms-and-callbacks** — rewrite after render; fire webhooks after delivery · click `TRANSFORM_ADD`† setHeader → hold ⟂ click `CALLBACK_ADD`† → fill url + body → hold on allowlist + retries fields → **both configured**
8 **prove-transform** — the transform lands on a real response · click `APPLY` → fetch → hold on the injected header in `TX_DETAIL` → **header visible**

### Track E — Security, Verification, Automation

#### AM-20 `am-20-tls-mtls` — HTTPS, HTTP/2 & mTLS (8 steps)
**Quiet corpus:** one plaintext server with one rule. **Live:** all TLS/mTLS config, PEM generation, cert predicate. **Companion:** required.
**Tags:** `tls-enable`, `tls-generate`, `http2-badge`, `tls-live-proof`, `mtls-require`, `mtls-generate-client`, `cert-subject-match`, `pred-security-cert`, `pem-redaction`, `native-parity-warning`.

1 **generate-tls** — clients that refuse plaintext need real TLS, without OpenSSL ceremony · click `SETTINGS` → `settingsTab('tls')` → toggle `SETTINGS_TLS_ENABLED` → click `SETTINGS_TLS_GENERATE` → hold **2000ms** on the PEM fields filling → **PEM populated**
2 **inspect-cert** — know what you generated: CN, expiry, and where the key lives · hold on `SETTINGS_TLS_CERT` summary → hold on the "keys stay in the workspace" note → **cert summary**
3 **https-live** — the address changes scheme, and HTTP/2 comes free via ALPN · click `SETTINGS_SAVE` → click `START` → hold on the `https://` `ADDRESS` → hold on `HTTP2_BADGE` (plaintext stays 1.1) → **`HTTP2_BADGE`**
4 **prove-https** — a real TLS request, not a claim · proxy fetch → hold on 200 → hold on the journal row → **200 over TLS**
5 **mtls** — now make the *client* prove identity · toggle `SETTINGS_MTLS_ENABLED` → hold → click `SETTINGS_MTLS_GENERATE` → hold **2000ms** on the client bundle + download hints → fill `SETTINGS_MTLS_CN`† → Save → Restart → **mTLS armed**
6 **cert-predicate** — a rule only certain clients can reach · add condition → select `security` source → select `certSubject` → fill expected CN → hold → **security condition**
7 **prove-cert-match** — browsers cannot attach a PEM, so Simulate carries the subject · fill `SIMULATE_CERT_SUBJECT`† with the pinned CN → run → hold on matched ⟂ change the CN → run → hold on unmatched → **both outcomes**
8 **redaction-parity** — PEMs are stripped from exports; desktop parity warnings are surfaced · hold on the export redaction note → hold on `NATIVE_WARNINGS` → click `STOP` → **stopped, keys retained locally**

#### AM-21 `am-21-simulation-suite` — Simulation as a Test Suite (8 steps)
**Quiet corpus:** 8 samples with expectations (the suite under test). **Live:** ad-hoc runs, expectation edits, run-all, seeding, example attach. **Offline.**
**Tags:** `sim-samples`, `sim-adhoc`, `sim-expected`, `sim-seed-repro`, `sim-sequential-batch`, `sim-run-all`, `sim-decision-trace`, `sim-normalized`, `sim-rendered`, `sim-assertions`, `sim-export-trace`, `examples-attach`, `examples-simulate`, `examples-try-requests`.

1 **suite-and-scratchpad** — Simulate is a unit-test runner, plus a scratch pad · click `SIMULATE` → hold on `SIMULATE_SAMPLES` saved section → hold on the scratch pad → fill `SIMULATE_PATH` → run → **result**
2 **three-views** — decision trace, normalized request, rendered response · hold on `SIMULATE_TIMELINE_FIRST` (the 7-step pipeline) → click `SIMULATE_TAB_REQUEST` → hold on what matchers actually see → click `SIMULATE_TAB_RENDERED` → hold on the shipped bytes → **rendered tab**
3 **expectations** — a sample without an expectation is a demo, not a test · click `SIMULATE_TAB_ASSERTIONS` → hold on outcome/status/body-contains rows → edit one → **expectation set**
4 **fail-loudly** — a wrong expectation must fail visibly · pick the failing sample → run → hold on the FAIL row → hold on the reason → **FAIL row**
5 **run-all** — the whole suite, sequentially, so state advances like production · click `SIMULATE_RUN_ALL` → hold on `SIMULATE_SUMMARY` tally → hold on the per-sample state column → **`SIMULATE_SUMMARY`**
6 **seed** — weighted, jitter, and probability become reproducible · run the dice sample → hold → run again → hold on the identical result → **identical session runs**
7 **export-trace** — hand the evidence to a PR or bug report · click `SIMULATE_EXPORT` → hold on the bundle contents → **export confirmed**
8 **examples** — per-rule regression cases that outlive the session · click `BTAB_EXAMPLES` → reveal `EXAMPLES_GRID` → click `EXAMPLE_ATTACH`† → hold ⟂ click `EXAMPLE_TRY_REQUESTS`† → hold on the handoff + `cli mock verify` note → **example row**

#### AM-22 `am-22-workflow` — Workflow Orchestration (9 steps)
**Quiet corpus:** checkout mock + an empty workflow. **Live:** every node dropped, configured, and wired. **Companion:** required. `allowedTabs: ['workflow','api-mock-studio']`.
**Tags:** `wf-start-node`, `wf-isolate`, `wf-port-vars`, `wf-apply-node`, `wf-reset-node`, `wf-stop-node`, `wf-assert-count`, `wf-assert-status`, `wf-assert-body`, `wf-assert-header`, `wf-assert-recency`, `wf-quick-test`, `state-reset`.

1 **designer-palette** — mocks belong in the test graph, not a side terminal · open Designer → collapse app sidebar → type `Mock` in `WF.PAL_SEARCH` → hold each of the five matching blocks → **search + palette group**
2 **start-node** — the lifecycle node, and why isolation matters · add `CANVAS_START` → connect Start trigger → Fit View → open config → select `WF_SERVER` Checkout → toggle `WF_ISOLATE` (private port, cannot clobber your Studio tab) → hold on `WF_PORT_VARS`† (`mockPort` / `mockBaseUrl`) → Save → **node configured**
3 **apply-node** — hot-swap the rule set mid-run for a second scenario · add `CANVAS_APPLY`† → connect under Start Mock → Fit View → open config → select the definition → Save → **node configured**
4 **http-node** — downstream nodes consume the published base URL · add HTTP node → connect under Apply → Fit View → fill `{{mockBaseUrl}}/cart` → Save → **node configured**
5 **assert-node** — assert against the journal, not your logs · add `CANVAS_ASSERT` → connect under HTTP → Fit View → fill `WF_ASSERT_MIN` 1 → hold ⟂ fill `WF_ASSERT_STATUS`† → hold on body-contains / header / last-call-within fields → Save → **assertions set**
6 **reset-node** — rewind the state machine between iterations · add `CANVAS_RESET`† → connect under Assert → Fit View → open config → hold on the state-reset option → Save → **node configured**
7 **stop-node** — guaranteed teardown, even on failure · add `CANVAS_STOP` → connect under Reset → Fit View → open config → Save → hold on the node → **node configured**
8 **wire** — Start Mock → Apply → HTTP → Assert → Reset → Stop · already wired as each node landed · walk the edges → Fit View → hold on the graph → **graph wired**
9 **quick-test** — open Console, then one click runs the whole lifecycle · click `WF.CONSOLE_BADGE` → click `WF.QUICK_TEST` → hold on nodes turning green in order → hold on the assert node's evidence (route + count) → **all green**

#### AM-23 `am-23-harness-ci` — Test Runner Fixtures & CI Handoff (7 steps)
**Quiet corpus:** store library + a small scenario suite. **Live:** fixture configuration and the run. **Companion:** required. `allowedTabs: ['test-runner','api-mock-studio']`.
**Tags:** `harness-fixture`, `wf-isolate`, `cli-concept`, `export-workspace-json`, `journal-export`, `sim-expected`.

1 **fixture-panel** — scenario suites need a mock that starts and stops with the run · open Test Runner → hold on `HARNESS_MOCK_FIXTURE`† → select `HARNESS_MOCK_SERVER`† Store → hold → **fixture selected**
2 **isolate** — a private port per run is what makes parallel suites safe · hold `HARNESS_MOCK_ISOLATE`† on (throwaway copy; Off would restore Studio's prior Running/Stopped) → **isolation on**
3 **run** — the fixture starts before the first scenario · run the suite → hold on the fixture start line → hold on the results → **results**
4 **teardown** — no orphan listeners after the run · hold on Stopped status → hold on the freed port → **stopped**
5 **evidence** — the journal is the run's audit trail · click `DOCK_TAB_TRANSACTIONS` → hold on the run's rows → **journal rows**
6 **artifact** — export the workspace as the file CI consumes · click `EXPORT_WORKSPACE` → hold on the confirmation → **export confirmed**
7 **cli-handoff** — `cli mock simulate` for unit-level, `cli mock verify` for live journals · hold on the copyable commands → hold on the recap (Studio → Simulate → Workflow/Harness → CLI) → **`ROUTES_FOOTER`**

#### AM-24 `am-24-capstone` — Ship a Contract Mock (9 steps)
**Quiet corpus:** none — the OpenAPI import in step 1 is the starting point. **Companion:** required.
**Tags:** `end-to-end-contract` + reprises across tracks. No new features — a timed, narrated integration of the pack.

1 **from-spec** — import an OpenAPI spec as drafts → generalize paths → enable the one you need
2 **matching** — add a JSONPath body predicate and prove it in Simulate
3 **response** — templated body with faker + a formatted preview
4 **variants** — a 404 variant with conditions, then a sequenced retry scenario
5 **resilience** — delay + probability, and one fault variant
6 **conflicts** — Analyze → read a finding → fix priority → re-analyze clean
7 **suite** — build the sample suite with expectations → Run all green
8 **live** — Start → real traffic → journal check (matched + one near-miss)
9 **ship** — export workspace + WireMock → drop+connect each workflow node + Fit View → Quick Test green

---

## 6. Supporting engineering work (Phase 0 — blocking)

### 6.1 Roster + coverage contract

```
packages/demo-hub/src/lessons/protocols/api-mock-lesson-contract/
  featureMatrix.ts   # AM_FEATURE_TAGS (≈205) grouped by domain
  roster.ts          # AM_ROSTER: id, number, title, estimatedMinutes, seedGallery, featureTags, companion, docker
  index.ts
api-mock-lessons.ts                    # ordered apiMockLessons export
api-mock-lessons.test.ts               # canonical order + unique ids
api-mock-feature-coverage.test.ts      # every tag claimed; no unknown tags
api-mock-lesson-quality-audit.test.ts  # 6–12 steps, <=1 pause-only, >=5 keyTerms, concept diagram, highlight blocklist, last step verify
api-mock-demo-helpers.ts               # AM_DEMO_TIMING + spotlightBeat/clickBeat/fillBeat/revealBeat  ✅ shipped
```

The step-count bounds are the consolidation gate: **<6** means the lesson is too thin to teach a
scenario, **>12** means beats that share a concept were split into separate steps (the v1 defect).

### 6.2 Corpus presets (`src/data/galleries/api-mock/presets.ts`)

**Dual role, one definition set:** these ship in the Gallery as a product feature *and* supply the
quiet background corpus for lessons (§5.1). Lessons never show the Gallery — they load a preset
silently in `prepareBeforeNavigate`, or a trimmed subset of it.

**Corpus must be minimal.** Each preset needs a "lesson corpus" variant containing only what the
lesson does *not* teach. AM-04 gets one exact rule, not a finished path library; AM-10 gets a plain
200, not a decorated response. If a preset already contains the feature the lesson teaches, the
lesson has nothing to author and the demo regresses to a slideshow.

| Sample id | Name | Contents | Used by |
|---|---|---|---|
| Sample id | Gallery contents (full, for real users) | Lesson corpus subset (quiet) | Corpus for |
|---|---|---|---|
| `am-gallery-store` | 12 routes / 3 folders; every path kind; templated bodies; headers+cookies; examples; tags/operationIds | 03: full library · 04: 1 exact rule · 10: 1 plain-200 rule · 11: 1 static-body rule · 16/18/19/23: full library | 03, 04, 10, 11, 16, 18, 19, 23 |
| `am-gallery-matchers` | Rules per predicate family: query/header/cookie, JSON subset/strict/JSONPath/schema, form, multipart, XML, binary + samples | 05: 1 rule, no predicates · 06: 1 subset predicate · 07: 3 bare rules (form/upload/xml) | 05, 06, 07 |
| `am-gallery-checkout` | Cart rules with `state` mode, transitions, counters, sequence + weighted variants, samples per state | 12: 1 rule / 1 variant · 13: 2 variants, no state wiring · 22: full (workflow consumes it) | 12, 13, 22 |
| `am-gallery-flaky` | Delay/jitter/probability/maxMatches/expires + one variant per fault kind + dribble chunk schedule | 14: 1 plain payment rule | 14 |
| `am-gallery-overlaps` | Eight path-disjoint rules producing one duplicate / shadowed / definite / potential finding | 09: all four pairs | 09 |
| `am-gallery-secure` | TLS+mTLS settings scaffold, cert-subject predicate rule, redaction policy, sensitive variables | 20: 1 plaintext server + 1 rule (all TLS authored live) | 20 |
| `am-gallery-proxy` | Proxy enabled w/ allowlist to Docker echo, `recordAsDrafts`, fallback proxy | 17: blank server (all proxy config authored live) | 17 |
| `am-gallery-suite` | 8 samples with expectations: pass, fail, ambiguous, fault, sequential-state | 21: all 8 (the suite is the subject) | 21 |

AM-01, AM-15, and AM-24 take **no** corpus — they start from nothing and author everything.
Existing `am-gallery-health` stays; `am-gallery-users` and `am-gallery-conflicts` are superseded by
`store` / `overlaps` — keep or retire (see §9 decision 4). Presets are product code → unit tests +
product coverage gate apply.

### 6.3 Selector work (`src/shared/selectors/apiMock.ts`)

Two buckets:

**(a) Export existing testids** that the UI already renders but the selector file omits — response sub-tabs, condition rows/controls, folder rows, dock chrome, tx actions, variables, diagnostics, settings fields per tab, import internals, simulate internals, conflict extras, `export-to-mock-*`. (~90 constants.)

**(b) Add missing `data-testid` in product components** (each needs a component unit-test touch):

| File | Add |
|---|---|
| `ApiMockRouteEditor.tsx` | `data-testid` on the 5 builder tabs (keep ids), condition selector/expected/operator/case/negate/matchstyle inputs, docs fields |
| `ApiMockResponseEditor.tsx` | response sub-tab buttons, header key/value/remove rows, variant name, status quick chips, body format/map/clear, size + template badges |
| `ApiMockResponseTimingPanel.tsx` / `ExpiresPicker` | delay/jitter/max-matches/probability, expires quick buttons |
| `ApiMockResponseFaultsPanel.tsx` | fault cards (`fault(kind)` helper), chunk rows |
| `ApiMockResponseSelectionPanel.tsx` | mode buttons, weight, required/next state, counter rows |
| `ApiMockVariantOutboundPanel.tsx` | transform key/value/remove, callback method/timeout/retries |
| `ApiMockPatternToolboxModal.tsx` (+ extra panels) | path presets, generalize-segment buttons, kind select, regex library search/rows/flags, xpath presets, schema kind |
| `ApiMockRouteExplorer.tsx` | folder expand/collapse, folder row, route delete, drag handles |
| `ApiMockServerSettingsModal.tsx` | all General/Selection/Network/Journal/Proxy fields (basePath, host, policies, fallback mode, ambiguity body, limits, private-block, forward-auth, mTLS CN) |
| `ApiMockDock.tsx` | dock chrome, state rows, variables rows, diagnostics metrics, console clear |
| `ApiMockServerTabs.tsx` | rename input, context-menu items (duplicate/close-others) |
| `ApiMockSimulateModal.tsx` | cert subject (exists), sample section headings (added), per-sample expected badges |
| `ApiMockNodeConfigs.tsx` | assert status/body/header/recency, apply/reset roots, isolate/idempotent, port vars hint |
| Test Runner fixture panel | verify existence first; add fixture selectors |

### 6.4 Adapter + bridge expansion

`packages/demo-hub/src/adapters/apiMockStudioAdapter.ts`:

```
openApiMockStudio(ctx)                     ensureApiMockServer(ctx, {name?})
wipeApiMockWorkspace()                     ensureApiMockRunning(ctx, {serverName?})
importApiMockGallerySample(id)             stopApiMockServer(ctx)
selectApiMockRoute(ctx, nameOrPath)        openApiMockBuilderTab(ctx, tab)
openApiMockResponseTab(ctx, tab)           openApiMockDockTab(ctx, tab)
patchApiMockActiveRoute(patch)             # extend: predicates, variants, mode, behavior, headers, cookies
sendMockRequest(ctx, req)                  # in-app fetch; TLS via /__proxy; tolerates fault rejections
waitForJournalOutcome(ctx, outcome)        resetApiMockRuntimeState(ctx)
setApiMockRuntimeSettings(ctx, patch)      analyzeApiMockConflicts(ctx)
closeApiMockOverlays(ctx)                  AM_DEMO_TIMING constants
```

Bridge (`src/app/hooks/useDemoApiMockBridge.ts`, demo-gated): `__demoApiMockPatchRoute`, `__demoApiMockSendRequest`, `__demoApiMockSetSettings`, `__demoApiMockResetState`, `__demoApiMockStart/Stop`, plus typing in `bridgeWindow.ts`. Enforced by `adaptersImportAudit.test.ts` — lessons never import `src/features/api-mock/**`.

### 6.5 Docker echo upstream (AM-17 only)

`docker/api-mock/docker-compose.yml` with an echo image on a fixed port; `dockerEndpoint` gate + `dockerCommand` on AM-17. **Why:** `proxyPolicy` blocks proxying to the control plane (`:3001`) and to active mock ports, so a third-party upstream is required for an honest record-to-drafts demo.

### 6.6 E2E wiring

- `e2e/demo-api-mock-am01.spec.ts` … `am24.spec.ts`; shared `e2e/api-mock-lesson-smoke-helpers.ts` with `walkApiMockLesson(page, lesson)`, `AM_LESSON_STEPS` (per-lesson step count), and per-lesson prepare (companion probe, Docker probe, quiet corpus seed). ✅ shipped for AM-01 … AM-12 (AM-04 and AM-05 need no companion — both are Simulate-only).
- `playwright.config.ts`: projects `demo-am01`…`demo-am24` (workers 1, retries 0, 900s).
- `package.json`: `test:e2e:demo:am01`…`am24`; `scripts/demo-lesson-e2e.ts` id+file aliases.
- `scripts/api-mock-e2e-sweep.sh` (mirrors `phase8-gql-e2e-sweep.sh`, honours the live-demo guard).

### 6.7 v1 retirement

Delete 8 wrappers + 8 helpers + 8 helper tests, `e2e/demo-api-mock-am{1..8}.spec.ts`, `demo-am1`…`demo-am8` projects, `test:e2e:demo:am1`…`am8` scripts, resolver aliases, and `index.ts` registrations. Old progress entries (`am-1-create-start`, …) simply stop resolving — no migration needed. Keep `am-gallery-health`.

### 6.8 Docs

This plan (source of truth) · `apimock-studio-demo-doc.md` §12E roster refresh · `studio-walkthrough.md` track↔lesson cross-links · `project-conventions.mdc` demo table · `CHANGELOG.md` under Unreleased.

---

## 7. Delivery phases

| Phase | Content | Exit criteria |
|---|---|---|
| **P0 — Foundation** | Roster + matrix + audit tests (red), selectors (a)+(b), product testids + unit tests, adapter/bridge, 8 gallery presets + tests, Docker echo, E2E harness rewrite | `tsc -b --noEmit` clean · scoped vitest green · product coverage ≥90% on touched files · audit tests fail only on "no lessons yet" |
| **P1 — Track A** | AM-01…03 | 3 lessons pass the 5-item done checklist; `am01..am03` E2E green |
| **P2 — Track B** | AM-04…09 | 6 lessons; matching tags fully claimed |
| **P3 — Track C** | AM-10…14 | 5 lessons; response/fault tags claimed |
| **P4 — Track D** | AM-15…19 | 5 lessons; import/export/proxy/ops tags claimed |
| **P5 — Track E** | AM-20…24 | 5 lessons; coverage test **green** (all tags claimed) |
| **P6 — Hardening** | v1 deletion, sweep, docs, CHANGELOG, full gates | Full demo E2E sweep green · `run-demo-coverage-full.sh` ≥90% · `run-product-coverage-fast.sh` green · manual 1× watch per lesson |

Each phase is independently mergeable behind the existing Demo Hub flag; lessons appear as they land.

---

## 8. Risks

| Risk | Mitigation |
|---|---|
| **Scope** (24 lessons ≈ 10k lines incl. tests) | Track-sized phases; each track ships value alone |
| **Product testid churn** breaks existing component tests | Phase 0 lands testids with test updates *before* any lesson work |
| **Companion dependency** for ~14 lessons | Reuse `PrerequisiteGate` with companion probe (`:3001/health`); offline lessons stay Simulate-only |
| **Docker for AM-17** | Single lightweight echo container; only lesson gated on it |
| **Fault lessons crash in-app fetch** | `sendMockRequest` swallows network rejections and asserts on the journal instead |
| **mTLS can't be proven from a browser** | Configure live, prove matching in Simulate, narrate the curl equivalent (§4 register) |
| **E2E wall time** (24 × ~3 min) | Per-lesson projects for dev; sweep script only at merge gates |
| **Gallery presets enter product coverage denominator** | Preset factories are pure data + unit-tested builders |
| **Lesson runtime creep** (2h+ pack) | Tracks are independently discoverable; capstone optional |

---

## 9. Decisions

### Resolved

| # | Decision | Effect on this plan |
|---|---|---|
| R1 | **Steps are multi-beat.** Several actions per step with the spotlight moving between them and proper pauses; combine simple steps that teach the same thing. | §2 principle 3 + step composition contract; every §5 spec regrouped; roster drops from ~335 to ≈191 steps; audit test enforces 6–12 |
| R2 | **Never demo by importing from the Gallery.** Always live authoring, even when the result mirrors a Gallery sample. | §2 principle 6 + §5.1 policy; §6.2 presets recast as quiet corpus with minimal per-lesson subsets |
| R3 | **Ship one lesson at a time**, each fully verified before the next. | §7 phases are per-lesson gates; AM-01…AM-24 done (pack complete) |

### Still open (need your call)

1. **Roster size** — 24 lessons (full breadth, ~205 tags) vs 18 (merge 05+07, 12+13, 16 into 15, 23 into 22) vs 14 (dense, 12 steps each).
2. **v1 pack** — delete AM-1…AM-8 outright, or keep them published until the matching v2 track ships?
3. **Product testid work** — approve adding ~120 `data-testid`s + unit-test updates across 14 api-mock components (required for ~60% of the new steps)?
4. **Legacy galleries** — retire `am-gallery-users` / `am-gallery-conflicts` (superseded by `store` / `overlaps`) or keep all 11 presets in the Gallery?
5. **Docker echo for AM-17** — **done.** `docker/api-mock/` ships a Node echo on `:4017`; AM-17 gates on `http://localhost:4017/health` and allowlists `http://localhost:4017` (hostname, not `127.0.0.1`). Live record-to-drafts is the lesson.
