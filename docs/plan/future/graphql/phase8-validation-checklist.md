# Phase 8 — Demo Hub Human Validation (All 19 GQL Lessons)

**Goal:** One auto-play pass at **1×** per lesson on **Web (Chrome)** and **Tauri (desktop)** before `develop` merge.

**Automated proxy (Web):** Playwright full-lesson walks (`npm run test:e2e:demo:gqlN`). Green E2E ≠ human sign-off — use for regression; still eyeball pacing and narration once.

**Last automated sweep:** 2026-06-28 — `./scripts/phase8-gql-e2e-sweep.sh` — **20/20 ✅** (GQL-1..19 + gql110; ~64 min; exit 0)

**Sweep results (2026-06-28 — final re-sweep):**
- **Passed (20):** GQL-1 GQL-2 GQL-3 GQL-4 GQL-5 GQL-6 GQL-7 GQL-8 GQL-9 GQL-10 GQL-11 GQL-12 GQL-13 GQL-14 GQL-15 GQL-16 GQL-17 GQL-18 GQL-19 gql110
- **Failed (0):** none
- Log: `/tmp/phase8-e2e-sweep-20260628.log`

**Earlier sweep history (2026-06-26):**
- First full sweep: 18/20 pass (GQL-12 timeout under stale IDB; gql110 blocked by script tail error)
- Fixes: IDB v9 alignment, GQL-12 baseline seed after `openDemoHub` clear, IDB wipe in `clearDemoE2EStorage`, workspace helpers → IDB tabs
- Re-verify under `PHASE8_E2E_SWEEP=1`: GQL-12 ✅ (1.6m), gql110 ✅ (5/5 incl. §11.0 hard refresh)
- ~~Re-run full sweep before merge~~ ✅ **Done** — `./scripts/phase8-gql-e2e-sweep.sh` 20/20 (2026-06-28)

**Phase 8 human validation:** ✅ **19/19** Web + Tauri signed off (2026-06-27)

**Quality audit GQL-4..13:** ✅ `packages/demo-hub/src/lessons/protocols/graphql-lesson-quality-audit.test.ts` (11/11) — 2026-06-26

---

## Phase 8 spot-check (priority batch)

Run **before** the full 19-lesson human pass. Automated E2E first, then **Web + Tauri 1× human** for each row.

| Slot | Steps | Focus | Web E2E | Web 1× human | Tauri 1× human |
|------|------:|-------|---------|--------------|----------------|
| **GQL-5** | 18 | auth-on-TLS **7–9**; mTLS **13–16**; restore **17–18** | `npm run test:e2e:demo:gql5` | [x] human Web ✅ 2026-06-28 | [x] human Tauri ✅ 2026-06-26 |
| **GQL-6** | 19 | create/update/delete observe splits | `npm run test:e2e:demo:gql6` | [x] human Web ✅ 2026-06-28 | [x] human Tauri ✅ |
| **GQL-7** | 15 | **`gql5-subscription-auth`** (step 9); subscribe step 10 | `npm run test:e2e:demo:gql7` | [x] human Web ✅ 2026-06-28 | [x] human Tauri ✅ |
| **GQL-14** | 12 | `tabBudget: 2`; profiles + polling | `npm run test:e2e:demo:gql14` | [x] human Web ✅ 2026-06-28 | [x] human Tauri ✅ 2026-06-28 |
| **GQL-15** | 10 | Advanced Settings → Batch; two tabs | `npm run test:e2e:demo:gql15` | [x] human Web ✅ 2026-06-28 | [x] human Tauri ✅ 2026-06-28 |
| **GQL-17** | 10 | Workflow Runner close-the-loop | `npm run test:e2e:demo:gql17` | [x] E2E ✅ 2026-06-26 | [x] human ✅ 2026-06-27 |

**Batch E2E (Web, Docker 4010):**

```bash
NO_PROXY='*' npx playwright test \
  e2e/demo-gql-https-tls.spec.ts \
  e2e/demo-gql-mutations.spec.ts \
  e2e/demo-gql-subscriptions.spec.ts \
  e2e/demo-gql-multi-tab.spec.ts \
  e2e/demo-gql-batch-execution.spec.ts \
  e2e/demo-gql-workflow-runner.spec.ts \
  --reporter=list --workers=1 --timeout=900000
```

GQL-5 full walk needs TLS (`4444`) + mTLS (`4446`) + plain GraphQL (`4010`) — see [gql5-phase8-validation-checklist.md](./gql5-phase8-validation-checklist.md).

**Last spot-check batch (2026-06-26):** **19/19 passed** (~23 min, `workers=1`) — GQL-5 shell + full walk, GQL-6 shell + 4 scenario walks + full lesson, GQL-7 shell + full walk, GQL-14 shell + full + rapid-Next guard, GQL-15 shell + full walk, GQL-17 shell + full walk.

---

## Prerequisites

### Learning Hub dev (all lessons)

```bash
npm run dev   # NOT build:prod — Demo Hub must be enabled
```

Kill stale server on :5173 if wrong build is reused:

```bash
lsof -ti :5173 | xargs kill -9 2>/dev/null || true
```

### Docker GraphQL (GQL-1..19 studio + most workflow lessons)

```bash
cd docker/graphql && docker compose up -d
curl --noproxy '*' http://127.0.0.1:4010/health
```

### TLS + mTLS (GQL-5 only)

See [gql5-phase8-validation-checklist.md](./gql5-phase8-validation-checklist.md).

### Mock proxy (GQL-13 only)

```bash
npm run server   # port 3001
```

### Tauri

```bash
# Option A — full stack
npm run tauri:dev

# Option B — Vite already on :5173 (E2E dev server)
cd src-tauri && cargo run --no-default-features
```

---

## Per-lesson checklist

| Slot | Lesson | Steps | Web E2E | Web 1× human | Tauri 1× human | Notes |
|------|--------|------:|---------|--------------|----------------|-------|
| GQL-1 | Your First GraphQL Query | 13 | `npm run test:e2e:demo:gql1` | [x] human Web ✅ 2026-06-28 | [x] human Tauri ✅ 2026-06-28 | §11.0 baseline · reference lesson |
| GQL-2 | Variables & Arguments | 18 | `npm run test:e2e:demo:gql2` | [x] human Web ✅ 2026-06-28 | [x] human Tauri ✅ 2026-06-28 | Reference quality |
| GQL-3 | Schema Exploration | 10 | `npm run test:e2e:demo:gql3` | [x] human Web ✅ 2026-06-28 | [x] human Tauri ✅ 2026-06-28 | |
| GQL-4 | Authentication & Headers | 14 | `npm run test:e2e:demo:gql4` | [x] human Web ✅ 2026-06-28 | [x] human Tauri ✅ 2026-06-28 | Basic + OAuth + Bearer |
| GQL-5 | HTTPS, TLS & Certificates | 18 | `npm run test:e2e:demo:gql5` | [x] human Web ✅ 2026-06-28 | [x] human Tauri ✅ 2026-06-28 | mTLS 13–16 · auth-on-TLS 7–9 |
| GQL-6 | Mutations | 19 | `npm run test:e2e:demo:gql6` | [x] human Web ✅ 2026-06-28 | [x] human Tauri ✅ 2026-06-28 | create/update/delete observe splits |
| GQL-7 | Subscriptions | 15 | `npm run test:e2e:demo:gql7` | [x] human Web ✅ 2026-06-28 | [x] human Tauri ✅ 2026-06-28 | `gql5-subscription-auth` step 9 |
| GQL-8 | Query Builder — Visual Operations | 11 | `npm run test:e2e:demo:gql8` | [x] human Web ✅ 2026-06-28 | [x] human Tauri ✅ 2026-06-28 | |
| GQL-9 | Collections & History | 11 | `npm run test:e2e:demo:gql9` | [x] human Web ✅ 2026-06-28 | [x] human Tauri ✅ 2026-06-28 | |
| GQL-10 | Export & Share Queries | 7 | `npm run test:e2e:demo:gql10` | [x] human Web ✅ 2026-06-28 | [x] human Tauri ✅ 2026-06-28 | |
| GQL-11 | Performance Tracing | 8 | `npm run test:e2e:demo:gql11` | [x] human Web ✅ 2026-06-28 | [x] human Tauri ✅ 2026-06-28 | |
| GQL-12 | Schema Diff & Breaking Changes | 7 | `npm run test:e2e:demo:gql12` | [x] human Web ✅ 2026-06-28 | [x] human Tauri ✅ 2026-06-28 | |
| GQL-13 | Mock Server | 15 | `npm run test:e2e:demo:gql13` | [x] human Web ✅ 2026-06-28 | [x] human Tauri ✅ 2026-06-28 | Desktop mock + :3001 proxy |
| GQL-14 | Multi-Tab Workspaces | 12 | `npm run test:e2e:demo:gql14` | [x] human Web ✅ 2026-06-28 | [x] human Tauri ✅ 2026-06-28 | `tabBudget: 2` · profiles + polling |
| GQL-15 | Batch Execution | 10 | `npm run test:e2e:demo:gql15` | [x] human Web ✅ 2026-06-28 | [x] human Tauri ✅ 2026-06-28 | `tabBudget: 2` · Advanced Settings batch |
| GQL-16 | Workflow Integration | 13 | `npm run test:e2e:demo:gql16` | [x] human Web ✅ 2026-06-28 | [x] human Tauri ✅ 2026-06-28 | Console + debug · Quick Test pass |
| GQL-17 | Workflow Runner & Results | 10 | `npm run test:e2e:demo:gql17` | [x] human Web ✅ 2026-06-27 | [x] human Tauri ✅ 2026-06-27 | Runner → Results → Explorer |
| GQL-18 | Mutation Node in Workflow | 15 | `npm run test:e2e:demo:gql18` | [x] human Web ✅ 2026-06-28 | [x] human Tauri ✅ 2026-06-28 | Blank canvas CRUD + Delete User |
| GQL-19 | Subscription Node in Workflow | 9 | `npm run test:e2e:demo:gql19` | [x] human Web ✅ 2026-06-28 | [x] human Tauri ✅ 2026-06-28 | createOrder → orderStatus · WebSocket 4010 |

**§11.0 acceptance:** `npm run test:e2e:demo:gql110` (5 scenarios incl. hard refresh)

**Full sweep:** `scripts/phase8-gql-e2e-sweep.sh` (sequential; kills :5173 + clears storage between lessons; `PHASE8_E2E_SWEEP=1` disables Vite HMR)

---

## Human pass procedure (each lesson)

1. Demo Hub → domain **Protocols** → **GraphQL** → pick lesson.
2. Read **Concept** — diagram renders at 700×430; no clipped text.
3. **Start Demo** → enable **auto-play at 1×** (not 2×).
4. Watch full walk — narration readable; ripples visible; no flash-dismiss live panel.
5. On last step: click through **Next** rapidly once — `preAction` guards recover (no stuck state).
6. **Exit** lesson — user workspace unchanged (studio lessons GQL-1..15).
7. Check console for unhandled errors.

### GQL-5 Tauri focus (steps 13–16 mTLS; 7–9 auth-on-TLS)

- [x] Steps **7–9** — Bearer auth on HTTPS (`gqlt-auth-tls-*`); Metadata shows `Authorization`
- [x] Client cert + key PEM fields paste and persist on desktop (steps **14–15**)
- [x] Connect `https://localhost:4445/graphql` — schema loads (`gqlt-mtls-connect`, step **15**)
- [x] Steps **17–18** restore plain `http://localhost:4010/graphql`
- [x] Rapid **Next** through 13–16 — guards recover

Detail: [gql5-phase8-validation-checklist.md](./gql5-phase8-validation-checklist.md)

### GQL-7 auth step (step 9 — `gql5-subscription-auth`)

- [x] Auth panel shows Bearer `{{authToken}}` resolving from demo environment
- [x] Auth preview shows `Authorization: Bearer …` before Subscribe
- [x] Subscribe (step 10) reaches **● LIVE** without separate WS auth panel

---

## GQL-4..19 quality audit (automated)

Unit gate: `npx vitest run packages/demo-hub/src/lessons/protocols/graphql-lesson-quality-audit.test.ts`

Checks vs GQL-1/GQL-2 bar (studio lessons) or workflow bar (GQL-16/17/19):

- 700×430 concept diagram
- `pauseAfter` + `highlight` on every step
- `preAction` on every action step (except intro)
- Description depth (>80 chars non-intro)
- `setup` / `cleanup` on studio + workflow lessons
- `estimatedMinutes` vs step count

| Suite | Lessons |
|-------|---------|
| GQL-4..13 | 11 studio lessons |
| GQL-16 | Workflow Integration (Designer diagram) |
| GQL-17 | Workflow Runner (Runner diagram) |
| GQL-19 | Subscription Node (Designer diagram) |

---

## Sign-off

| Gate | Owner | Date | Status |
|------|-------|------|--------|
| Quality audit GQL-4..19 | CI / agent | 2026-06-28 | ✅ 14/14 tests (incl. GQL-16/17/19) |
| Web E2E sweep (19 + gql110) | CI / agent | 2026-06-28 | ✅ gql110 5/5 incl. hard-refresh; re-run full sweep before merge |
| Spot-check E2E GQL-5/6/7/14/15/17 | CI / agent | 2026-06-26 | ✅ **19/19** Web batch (see §Spot-check) |
| Web human 1× (19 lessons) | User | 2026-06-27 | ✅ **19/19** |
| Tauri human 1× (19 lessons) | User | 2026-06-27 | ✅ **19/19** |
| GQL-5 mTLS Tauri | User | 2026-06-26 | ✅ Steps 13–16 (+ auth-on-TLS 7–9) |
| GQL-6 Mutations Tauri | User | 2026-06-27 | ✅ create/update/delete observe splits (19 steps) |
| GQL-8 Query Builder | User | 2026-06-27 | ✅ Web + Tauri · Visual Operations (11 steps) |
| GQL-9 Collections & History | User | 2026-06-27 | ✅ Tauri · Collections & History (11 steps) |
| GQL-10 Export & Share | User | 2026-06-27 | ✅ Tauri · Export & Share Queries (7 steps) |
| GQL-11 Performance Tracing | User | 2026-06-27 | ✅ Tauri · Performance Tracing (8 steps) |
| GQL-12 Schema Diff | User | 2026-06-27 | ✅ Tauri · Schema Diff & Breaking Changes (7 steps) |
| GQL-16 Workflow Integration | User | 2026-06-28 | ✅ Web + Tauri · 13 steps · 1× auto-play · console + debug · rapid-Next Web ✅ |
| GQL-19 Subscription Node in Workflow | User | 2026-06-28 | ✅ Web + Tauri · 9 steps · 1× auto-play · create→subscribe→assert · rapid-Next Web ✅ |
| GQL-17 Workflow Runner & Results | User | 2026-06-27 | ✅ Web + Tauri · 10 steps · 1× auto-play · Runner → Results → Explorer |
