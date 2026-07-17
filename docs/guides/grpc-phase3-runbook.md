# gRPC Studio — Phase 3 Runbook

Operational guide for descriptor sources (reflection, proto files, protoset, BSR, URL), schema browser, schema drift, security policy, and Phase 3 acceptance verification.

See also:
- [Phase 1 runbook](./grpc-phase1-runbook.md) — unary setup, target validation, shared infra
- [Phase 2 runbook](./grpc-phase2-runbook.md) — streaming, SSE relay, stream E2E

## Architecture (Phase 3)

```
Browser (gRPC Studio UI)
  → Vite :5173  /api/grpc/reflect | /api/grpc/describe | /api/grpc/export-protoset
  → Express :3001  src-server/routes/grpc
  → descriptorLoader + descriptorCacheManager
       ├─ reflectionClient (v1 → v1alpha fallback)
       ├─ protoImportResolver (WKT + googleapis bundled)
       ├─ protoFetchGateway (url_proto — SSRF policy)
       └─ bsrFetchGateway (BSR module fetch)

Tab descriptor state (per tab):
  descriptor, sourceFingerprint, lastKnownGoodDescriptor
  driftState, driftIssues, suggestedRebinds, driftStaleMethod
```

**Security invariant:** URL and BSR fetches run **server-side only** — the browser never fetches private proto URLs directly.

## Descriptor sources

| Source | UI entry | API | Cache key |
|---|---|---|---|
| **Reflection** | Explorer **⟳ Reflect** | `POST /api/grpc/reflect` | `sourceRef` + content hash |
| **Proto files** | Manage Schemas → Proto Files | `POST /api/grpc/describe` (`proto_files`) | file content hash |
| **Protoset** | Manage Schemas → Protoset | `POST /api/grpc/describe` (`protoset`) | protoset bytes hash |
| **URL proto** | Manage Schemas → URL | `POST /api/grpc/describe` (`url_proto`) | URL + etag/digest |
| **BSR** | Manage Schemas → BSR | `POST /api/grpc/describe` (`bsr`) | module + version digest |

Reloading an **unchanged** local source (proto files, protoset) reuses the descriptor cache without re-parsing. **Reflection** always re-fetches from the target so schema drift can compare fresh descriptors (content-hash cache entries are still updated on success). URL proto revalidates with `If-None-Match` when an etag is known; BSR re-fetches and compares digest before reusing.

## Local dev setup

Same base infra as Phase 1:

1. `npm run server` — Express :3001
2. `npm run dev` — Vite :5173
3. `cd docker/grpc && docker compose up -d --build` — echo fixture :50051/:50052

Open **Protocols → gRPC** or `http://localhost:5173/?tab=grpc-studio`.

## Manual smoke flow (1× walk — human gate)

Complete at **1× speed** before marking Phase 3 done.

### Reflection + schema browser

1. Target `localhost:50051` → **Reflect** → `EchoService` appears.
2. Click **⚙ Manage Schemas** → **Schema Browser** tab → package tree shows `echo` / methods.
3. Select **Echo** method → detail pane shows signature; **Open in Tab** binds explorer selection.
4. **Export protoset** → downloads `.pb` file (requires schema loaded in current server session).

### Auto source fallback (auto mode)

When **source selection mode** is `auto` (default), a failed **Reflect** or **Load** attempt tries the next available source in precedence order: reflection → proto files → protoset → BSR → URL. Configure ingest tabs (proto files, protoset, etc.) before relying on fallback — empty ingest tabs are skipped.

### Proto files ingest

1. Manage Schemas → **Proto Files** → upload `docker/grpc/proto/echo.proto` (or paste-equivalent fixture).
2. **Load** → explorer updates with `echo.EchoService` (same tree as reflection).
3. Select **Echo** → send unary smoke (Phase 1 regression).

### Schema drift (blocking)

1. Reflect → select **Echo** → fill `message` = `drift-draft`.
2. Re-reflect against a server whose schema removed `Echo` **or** use a second proto load without Echo — drift banner shows **blocking**.
3. Confirm **Send Unary** (or **Start stream** for streaming rebinding) disabled; draft still visible.
4. Click a **Suggested rebinding** or pick another method → drift clears → primary action re-enabled.

### Schema drift (warning)

1. With `Echo` selected and body filled, reload descriptor where `Echo` exists but `message` field was removed from request schema.
2. Banner shows **warning**; editor stays enabled; **Send Unary** blocked.
3. **Prune stale fields** or edit body → drift clears (or **Dismiss** on warning).

## Automated regression gate

```bash
# Typecheck + Phase 3 scoped unit/integration tests (merge gate)
npm run test:grpc:phase3

# Full gRPC E2E (31 tests in 8 specs; auto-starts Docker when E2E_GRPC_SERVER=1)
npm run server   # separate terminal
npm run test:e2e:grpc
```

Use `npm run test:e2e:grpc` as the canonical gate — not `--project=docker` alone (Phase 3I `manage-schemas` / `schema-drift` specs are listed explicitly in that script).

`test:grpc:phase3` runs `tsc -b --noEmit` then vitest on:
`src/features/grpc`, `src/shared/grpc`, `src-server/grpc`, `src-server/routes/grpc`.

## E2E tests

| Spec | Docker | Backend | Notes |
|---|---|---|---|
| `e2e/grpc-studio-shell.spec.ts` | No | No | Shell / validation |
| `e2e/grpc-studio-manage-schemas.spec.ts` | Partial | Partial | Modal shell always; schema browser live when infra up |
| `e2e/grpc-studio-schema-drift.spec.ts` | No | No | Mocked `/api/grpc/reflect` — drift UI |
| `e2e/grpc-test-server.spec.ts` | Yes | Yes | API smoke + describe URL policy (SSRF test needs backend only) |
| `e2e/grpc-studio-unary.spec.ts` | Yes | Yes | Phase 1 regression |
| `e2e/grpc-studio-*-stream.spec.ts` (×3) | Yes | Yes | Phase 2 regression |

Live specs **skip** when :50051 or :3001 is down.

## Phase 3 test matrix

| Area | Case | Verified by |
|---|---|---|
| **3A Policy** | `auto` / `manual` source precedence | `descriptorSourcePolicy.test.ts` |
| **3A Policy** | Fingerprint compatibility guard | `descriptorSourcePolicy.test.ts` |
| **3B Proto** | Proto file upload + describe | `useGrpcStudio.test.ts` (describeFromIngest) |
| **3B Proto** | Protoset upload | `useGrpcStudio.test.ts` |
| **3C Import** | Transitive imports + WKT | `protoImportResolver.test.ts` |
| **3C Import** | Unresolved import diagnostics | `protoImportResolver.test.ts` |
| **3D Reflect** | v1 → v1alpha fallback | `reflectionClient.fallback.test.ts` |
| **3D Reflect** | Failure preserves LKG + tab binding | `grpcStudioSessionHelpers.test.ts`, `useGrpcStudio.test.ts` |
| **3E URL** | HTTPS allowed; HTTP localhost only | `protoFetchPolicy.test.ts` |
| **3E URL** | Private network / loopback / metadata blocked | `protoFetchPolicy.test.ts`, `e2e/grpc-test-server.spec.ts` |
| **3E BSR** | Module fetch gateway | `bsrFetchGateway.test.ts` |
| **3F Cache** | Hit/miss + invalidation on hash change (proto/protoset) | `descriptorCacheManager.test.ts`, `descriptorLoader.test.ts` |
| **3F Cache** | Reflection always re-fetches; URL/BSR revalidate | `descriptorLoader.test.ts`, `descriptorLoader.remote-cache.test.ts` |
| **3F Cache** | Failed refresh keeps prior descriptor | `grpcStudioSessionHelpers.test.ts` |
| **3D Reflect** | Active method stable when still in refreshed descriptor | `grpcStudioSessionHelpers.test.ts`, `useGrpcStudio.test.ts` |
| **3G Browser** | Package tree + search + grpcurl copy | `grpcSchemaBrowserModel.test.ts`, `GrpcSchemaBrowser.test.tsx` |
| **3G Browser** | Open in Tab sync | `GrpcSchemaBrowser.test.tsx`, `e2e/grpc-studio-manage-schemas.spec.ts` |
| **3H Drift** | Blocking / warning / none analysis | `grpcSchemaDrift.test.ts` |
| **3H Drift** | Execute blocked while drift active | `useGrpcStudio.test.ts` |
| **3H Drift** | Rebind / prune / dismiss | `useGrpcStudio.test.ts`, `GrpcSchemaDriftBanner.test.tsx` |
| **3H Drift** | E2E blocking (no dismiss) / rebind / dismiss / prune | `e2e/grpc-studio-schema-drift.spec.ts` |
| **3I Modal** | Manage Schemas tabs + schema browser shell | `e2e/grpc-studio-manage-schemas.spec.ts` |
| **3I Modal** | Schema browser live (Open in Tab, search) | `e2e/grpc-studio-manage-schemas.spec.ts` |
| **3I Security** | Describe URL SSRF API smoke | `e2e/grpc-test-server.spec.ts` (backend only) |
| **3I Modal** | Export protoset from schema browser | `grpc-service.test.ts`, `useGrpcStudio.test.ts` |
| **3I Fallback** | Auto cross-source retry on reflect/describe failure | `descriptorSourceFallback.test.ts`, `useGrpcStudio.test.ts` |
| **3I Form** | Map + oneof form builder + wire encode | `GrpcProtoFormBuilder.test.tsx`, `dynamicProtoCodec.test.ts` |
| **Regression** | Phase 1 unary E2E | `e2e/grpc-studio-unary.spec.ts` |
| **Regression** | Phase 2 streaming E2E | `e2e/grpc-studio-*-stream.spec.ts` |

## Troubleshooting — descriptor sources

| Symptom | Likely cause | Fix |
|---|---|---|
| Reflect fails immediately | Target down or no reflection on server | Start `docker/grpc`; confirm server enables reflection |
| Reflect v1 fails, v1alpha works | Older server | Expected fallback — check `reflectionVersion` in descriptor fingerprint |
| Proto load: unresolved import | Missing import root | Add import path in Manage Schemas; WKT/googleapis resolve automatically |
| Protoset load: empty tree | Wrong `.pb` file | Regenerate protoset with `protoc --descriptor_set_out` |
| URL load blocked | SSRF policy | Use `https://` public URL; `http://` only for localhost; no private IPs |
| BSR load fails | Token / module ref | Verify `buf.build/…` module path and version; token in BSR tab |
| Cache seems stale | Same sourceRef, changed content | Expected — content hash change invalidates; force re-load |
| Drift banner won't dismiss | Blocking drift | Must rebind to a valid method — dismiss only works on **warning** |
| Send disabled but form looks fine | Active drift | Resolve drift (rebind/prune/dismiss/edit body) |
| Manage Schemas schema tab disabled | No descriptor loaded | Reflect or load proto/protoset first |
| Export protoset fails | Server restarted or root cache evicted | Reload schema (Reflect or Load), then export again |
| Describe returns validation error | Missing required fields | Check `bsrModule` / `url` for BSR/URL sources |

## Phase 3 acceptance checklist

| Criterion | Verified by |
|---|---|
| Uploading split proto trees with transitive imports resolves without manual reordering | `protoImportResolver.test.ts`; manual proto walk |
| Reflection v1 failure correctly falls back to v1alpha without changing active request state | `reflectionClient.fallback.test.ts`; `useGrpcStudio.test.ts` |
| Protoset, BSR, and URL descriptor sources produce compatible service/method trees | `descriptorLoader.test.ts`, `bsrFetchGateway.test.ts`, `protoFetchGateway.test.ts` |
| Reloading unchanged source reuses cache; changed source invalidates via content hash | `descriptorCacheManager.test.ts`, `descriptorLoader.test.ts` |
| URL fetch policy blocks disallowed hosts/schemes with actionable error text | `protoFetchPolicy.test.ts`, `e2e/grpc-test-server.spec.ts` |
| Active method selection stable after refresh when method still exists | `grpcStudioSessionHelpers.test.ts`, `useGrpcStudio.test.ts` |
| Descriptor refresh with removed/changed fields preserves draft + drift UI | `grpcSchemaDrift.test.ts`, `useGrpcStudio.test.ts`, `e2e/grpc-studio-schema-drift.spec.ts` |

## Phase 5 handoff notes

- TLS / Auth / Connect bar builds on tab connection resolution (`resolveGrpcTabConnection.ts`).
- Execute snapshot already carries `sourceFingerprint` — Phase 4 did not break fingerprint compatibility checks.
- Phase 4 complete — see [grpc-phase4-runbook.md](./grpc-phase4-runbook.md) for TLS/auth gates and [grpc-phase4-security-validation.md](./grpc-phase4-security-validation.md) for sign-off.
