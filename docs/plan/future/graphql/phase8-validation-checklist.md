# Phase 8 — Demo Hub Human Validation (All 19 GQL Lessons)

**Goal:** One auto-play pass at **1×** per lesson on **Web (Chrome)** and **Tauri (desktop)** before `develop` merge.

**Automated proxy (Web):** Playwright full-lesson walks (`npm run test:e2e:demo:gqlN`). Green E2E ≠ human sign-off — use for regression; still eyeball pacing and narration once.

**Last automated sweep:** 2026-06-26 — `./scripts/phase8-gql-e2e-sweep.sh` (see results below)

**Sweep results (2026-06-26):**
- First full sweep: 18/20 pass (GQL-12 timeout under stale IDB; gql110 blocked by script tail error)
- Fixes: IDB v9 alignment, GQL-12 baseline seed after `openDemoHub` clear, IDB wipe in `clearDemoE2EStorage`, workspace helpers → IDB tabs
- Re-verify under `PHASE8_E2E_SWEEP=1`: GQL-12 ✅ (1.6m), gql110 ✅ (4/4)
- Re-run full sweep before merge: `./scripts/phase8-gql-e2e-sweep.sh`

**Quality audit GQL-4..13:** ✅ `packages/demo-hub/src/lessons/protocols/graphql-lesson-quality-audit.test.ts` (11/11) — 2026-06-26

---

## Phase 8 spot-check (priority batch)

Run **before** the full 19-lesson human pass. Automated E2E first, then **Web + Tauri 1× human** for each row.

| Slot | Steps | Focus | Web E2E | Web 1× human | Tauri 1× human |
|------|------:|-------|---------|--------------|----------------|
| **GQL-5** | 16 | mTLS **11–14**; restore **15–16**; native rustls on Tauri | `npm run test:e2e:demo:gql5` | [x] E2E ✅ 2026-06-26 | [ ] **required** |
| **GQL-6** | 19 | create/update/delete observe splits | `npm run test:e2e:demo:gql6` | [x] E2E ✅ 2026-06-26 | [ ] |
| **GQL-7** | 15 | **`gql5-subscription-auth`** (step 9); subscribe step 10 | `npm run test:e2e:demo:gql7` | [x] E2E ✅ 2026-06-26 | [ ] |
| **GQL-14** | 10 | `tabBudget: 2`; profiles + polling | `npm run test:e2e:demo:gql14` | [x] E2E ✅ 2026-06-26 | [ ] |
| **GQL-15** | 9 | Advanced Settings → Batch; two tabs | `npm run test:e2e:demo:gql15` | [x] E2E ✅ 2026-06-26 | [ ] |
| **GQL-17** | 10 | Workflow Runner close-the-loop | `npm run test:e2e:demo:gql17` | [x] E2E ✅ 2026-06-26 | [ ] |

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
| GQL-1 | Your First GraphQL Query | 13 | `npm run test:e2e:demo:gql1` | [ ] | [x] | §11.0 baseline · human Tauri ✅ |
| GQL-2 | Variables & Arguments | 18 | `npm run test:e2e:demo:gql2` | [x] | [x] | Reference quality · human Web+Tauri ✅ |
| GQL-3 | Schema Exploration | 10 | `npm run test:e2e:demo:gql3` | [ ] | [x] | human Tauri ✅ |
| GQL-4 | Authentication & Headers | 14 | `npm run test:e2e:demo:gql4` | [ ] | [ ] | Quality audit ✅ |
| GQL-5 | HTTPS, TLS & Certificates | 16 | `npm run test:e2e:demo:gql5` | [ ] | [ ] | **mTLS steps 11–14 — Tauri required** |
| GQL-6 | Mutations | 19 | `npm run test:e2e:demo:gql6` | [ ] | [ ] | Quality audit ✅ · spot-check |
| GQL-7 | Subscriptions | 15 | `npm run test:e2e:demo:gql7` | [ ] | [ ] | **`gql5-subscription-auth`** · spot-check |
| GQL-8 | Query Builder | 11 | `npm run test:e2e:demo:gql8` | [x] | [x] | Quality audit ✅ · human Web+Tauri 2026-06-26 |
| GQL-9 | Collections & History | 9 | `npm run test:e2e:demo:gql9` | [ ] | [ ] | Quality audit ✅ |
| GQL-10 | Export & Share | 7 | `npm run test:e2e:demo:gql10` | [ ] | [ ] | Quality audit ✅ |
| GQL-11 | Performance Tracing | 8 | `npm run test:e2e:demo:gql11` | [ ] | [ ] | Quality audit ✅ |
| GQL-12 | Schema Diff | 7 | `npm run test:e2e:demo:gql12` | [ ] | [ ] | Quality audit ✅ |
| GQL-13 | Mock Server | 15 | `npm run test:e2e:demo:gql13` | [ ] | [ ] | Desktop + :3001 mock |
| GQL-14 | Multi-Tab Workspaces | 10 | `npm run test:e2e:demo:gql14` | [ ] | [ ] | `tabBudget: 2` · spot-check |
| GQL-15 | Batch Execution | 9 | `npm run test:e2e:demo:gql15` | [ ] | [ ] | `tabBudget: 2` · spot-check |
| GQL-16 | Workflow Integration | 12 | `npm run test:e2e:demo:gql16` | [ ] | [ ] | Enhancement complete ✅ |
| GQL-17 | Workflow Runner | 10 | `npm run test:e2e:demo:gql17` | [ ] | [ ] | spot-check |
| GQL-18 | Mutation Node in Workflow | 8 | `npm run test:e2e:demo:gql18` | [ ] | [ ] | CRUD + teardown |
| GQL-19 | Subscription in Workflow | 9 | `npm run test:e2e:demo:gql19` | [ ] | [ ] | |

**§11.0 acceptance:** `npm run test:e2e:demo:gql110` (4 scenarios)

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

### GQL-5 Tauri focus (steps 11–14)

- [ ] Client cert + key PEM fields paste and persist on desktop
- [ ] Connect `https://localhost:4445/graphql` — schema loads (`gqlt-mtls-connect`)
- [ ] Steps **15–16** restore plain `http://localhost:4010/graphql`
- [ ] Rapid **Next** through 11–14 — guards recover

Detail: [gql5-phase8-validation-checklist.md](./gql5-phase8-validation-checklist.md)

### GQL-7 auth step (step 9 — `gql5-subscription-auth`)

- [ ] Auth panel shows Bearer `{{authToken}}` resolving from demo environment
- [ ] Auth preview shows `Authorization: Bearer …` before Subscribe
- [ ] Subscribe (step 10) reaches **● LIVE** without separate WS auth panel

---

## GQL-4..13 quality audit (automated)

Unit gate: `npx vitest run packages/demo-hub/src/lessons/protocols/graphql-lesson-quality-audit.test.ts`

Checks vs GQL-1/GQL-2 bar:

- 700×430 concept diagram
- `pauseAfter` + `highlight` on every step
- `preAction` on every action step (except intro)
- Description depth (>80 chars non-intro)
- `setup` / `cleanup` on studio lessons
- `estimatedMinutes` vs step count

---

## Sign-off

| Gate | Owner | Date | Status |
|------|-------|------|--------|
| Quality audit GQL-4..13 | CI / agent | 2026-06-24 | ✅ 11/11 tests |
| Web E2E sweep (19 + gql110) | CI / agent | 2026-06-26 | ✅ GQL-12 + gql110 fixed; re-run full sweep |
| Spot-check E2E GQL-5/6/7/14/15/17 | CI / agent | 2026-06-26 | ✅ **19/19** Web batch (see §Spot-check) |
| Web human 1× (19 lessons) | User | 2026-06-26 | 🔨 **1/19** — GQL-2 ✅ |
| Tauri human 1× (19 lessons) | User | 2026-06-26 | 🔨 **4/19** — GQL-1 ✅, GQL-2 ✅, GQL-3 ✅, GQL-8 ✅ |
| GQL-5 mTLS Tauri | User | | Steps 11–14 |
