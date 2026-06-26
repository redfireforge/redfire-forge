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

## Prerequisites

### Learning Hub dev (all lessons)

```bash
npm run dev   # NOT build:prod-slim — Demo Hub must be enabled
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
| GQL-1 | Your First GraphQL Query | 13 | `npm run test:e2e:demo:gql1` | [ ] | [ ] | §11.0 baseline |
| GQL-2 | Variables & Arguments | 18 | `npm run test:e2e:demo:gql2` | [ ] | [ ] | Reference quality |
| GQL-3 | Schema Exploration | 10 | `npm run test:e2e:demo:gql3` | [ ] | [ ] | |
| GQL-4 | Authentication & Headers | 14 | `npm run test:e2e:demo:gql4` | [ ] | [ ] | Quality audit ✅ |
| GQL-5 | HTTPS, TLS & Certificates | 16 | `npm run test:e2e:demo:gql5` | [ ] | [ ] | **mTLS steps 9–11 — Tauri required** |
| GQL-6 | Mutations | 19 | `npm run test:e2e:demo:gql6` | [ ] | [ ] | Quality audit ✅ |
| GQL-7 | Subscriptions | 14 | `npm run test:e2e:demo:gql7` | [ ] | [ ] | Quality audit ✅ |
| GQL-8 | Query Builder | 10 | `npm run test:e2e:demo:gql8` | [ ] | [ ] | Quality audit ✅ |
| GQL-9 | Collections & History | 9 | `npm run test:e2e:demo:gql9` | [ ] | [ ] | Quality audit ✅ |
| GQL-10 | Export & Share | 7 | `npm run test:e2e:demo:gql10` | [ ] | [ ] | Quality audit ✅ |
| GQL-11 | Performance Tracing | 8 | `npm run test:e2e:demo:gql11` | [ ] | [ ] | Quality audit ✅ |
| GQL-12 | Schema Diff | 7 | `npm run test:e2e:demo:gql12` | [ ] | [ ] | Quality audit ✅ |
| GQL-13 | Mock Server | 15 | `npm run test:e2e:demo:gql13` | [ ] | [ ] | Desktop + :3001 mock |
| GQL-14 | Multi-Tab Workspaces | 10 | `npm run test:e2e:demo:gql14` | [ ] | [ ] | `tabBudget: 2` |
| GQL-15 | Batch Execution | 9 | `npm run test:e2e:demo:gql15` | [ ] | [ ] | `tabBudget: 2` |
| GQL-16 | Workflow Integration | 12 | `npm run test:e2e:demo:gql16` | [ ] | [ ] | Workflow tab |
| GQL-17 | Workflow Runner | 10 | `npm run test:e2e:demo:gql17` | [ ] | [ ] | |
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

### GQL-5 Tauri focus (steps 9–11)

- [ ] Client cert + key PEM fields paste and persist on desktop
- [ ] Connect `https://localhost:4445/graphql` — schema loads
- [ ] Step 12 restores plain `http://localhost:4010/graphql`
- [ ] Rapid **Next** through 9–11 — guards recover

Detail: [gql5-phase8-validation-checklist.md](./gql5-phase8-validation-checklist.md)

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
| Web human 1× (19 lessons) | User | | |
| Tauri human 1× (19 lessons) | User | | |
| GQL-5 mTLS Tauri | User | | |
