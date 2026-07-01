# gRPC Studio — Phase 4 Runbook (TLS, mTLS & Auth)

Operational guide for TLS/auth configuration, secret handling, troubleshooting, and Phase 4 acceptance verification.

See also:
- [Phase 3 runbook](./grpc-phase3-runbook.md) — descriptor sources, schema drift
- [Phase 4 threat model](./grpc-phase4-threat-model.md) — T1–T10 mitigations
- [Phase 4 security validation](./grpc-phase4-security-validation.md) — sign-off + triage
- [Cross-feature matrix](../plan/future/grpc/grpc-cross-feature-matrix.md) — export/replay rules (4H)
- [grpc-studio-plan.md](../plan/future/grpc/grpc-studio-plan.md) — Phase 4 sub-phases 4A–4I + **4J UI parity**

## Architecture (Phase 4)

```
Browser (gRPC Studio tab)
  ├─ Connection bar — TLS badge → GrpcTlsConfigModal; Auth badge → Auth tab; gear/deadline → settings drawer
  ├─ Settings drawer — TLS / Auth / Call / Compression / Health / K8s / Transport nav (Phase 4J)
  ├─ Auth panel → auth config (tokens in tab vault / session)
  ├─ Metadata editor → manual headers (normalized lowercase)
  └─ Execute → captureGrpcTabExecuteSnapshot
        → mergeGrpcExecuteMetadata (auth wins over manual Authorization)
        → prepareGrpcCallMetadata (compression when enabled — 4J-D)
        → POST /api/grpc/call | /api/grpc/stream/start

Express (src-server)
  ├─ grpcChannelCredentials — TLS/mTLS from snapshot target
  ├─ grpcAuthResolve — OAuth2 token fetch (server-side only)
  └─ createGrpcTransportErrorEnvelope — sanitized errors (no PEM/tokens in JSON)

Persistence / export (never raw secrets)
  ├─ grpcRedaction.ts — export/display redaction
  ├─ grpcSecretVault.ts — PEM/token vault
  ├─ grpcSavedRequest.ts — Phase 5 prep (4H)
  └─ grpcCrossFeatureExport.ts — workflow/harness/history bundles (4H)
```

## Safe defaults

| Setting | Default | Notes |
|---|---|---|
| `tlsMode` (new tab) | From page default / profile | Plaintext only when explicitly `disabled` |
| TLS PEM | Tab vault only | Never in call history or export JSON |
| Auth type | `none` | User selects bearer/basic/api_key/oauth2 per tab |
| OAuth2 token fetch | **Server-side only** | Browser never calls `tokenUrl` directly |
| Auth vs metadata | Auth panel wins | `mergeGrpcExecuteMetadata` at execute |
| Secret field UI | Masked after save | Write-only + Clear stored (4G) |
| Spring hints | Dismissible, localStorage | Health in call composer + settings drawer; PERMISSION_DENIED on status **7 only** |
| grpcurl export | No tokens/PEM in CLI | `filterMetadataForGrpcurlExport` (4H) |

## Local dev setup

Same base infra as Phase 1–3:

1. `npm run server` — Express :3001
2. `npm run dev` — Vite :5173
3. `cd docker/grpc && docker compose up -d --build` — echo fixture :50051 (plaintext)

Open **Protocols → gRPC** or `http://localhost:5173/?tab=grpc-studio`.

## Phase 4J manual smoke (1× walk — before Phase 5 UI)

Complete at **1× speed** when validating connection bar, TLS modal, and settings drawer after 4J changes.

### Connection bar + TLS modal

1. Open gRPC Studio; confirm **target input**, **TLS badge**, **Auth badge**, **deadline chip**, and **gear** are visible in the connection bar.
2. Enter valid target `localhost:50051` — validation badge shows OK; TLS/Auth/deadline/gear become enabled.
3. Click **TLS badge** → **`GrpcTlsConfigModal`** opens (no inline PEM on the main page).
4. Switch mode **TLS** or **mTLS** → confirm tri-mode selector and PEM fields render inside the modal only.
5. Change mode to **TLS** without saving → **Cancel** dismisses modal and **reverts** the badge to **Plaintext** (snapshot restore).
6. Re-open modal, change mode to **TLS**, click **Close** (or overlay) → modal dismisses and **keeps** the live edit (badge shows **TLS** / **TLS invalid** — GQL parity; no revert).
7. Re-open modal, change mode, click **Save** → modal closes; TLS badge label updates (Plaintext / TLS / mTLS).

### Settings drawer (gear + deadline)

1. Click **gear** → connection settings drawer opens on **TLS** nav (embedded TLS body — same fields as modal).
2. Click **Auth** nav → auth pills (not native `<select>`); secret fields mask after save.
3. Click **Call** nav (or click **deadline chip** in bar) → timeout/deadline editable; change value → send-bar timeout syncs.
4. Click **Compression** nav → toggle + algorithm preview; **Health** nav → probe UI (requires reflected descriptor for live probe).
5. **K8s** and **Transport** nav → stub panels render; Start/Native modes show deferred copy.
6. Close drawer via footer **Close** or Escape (overlay click does not close — connection bar stays interactive).

### TLS badge vs drawer (fast path)

1. Open drawer from gear → click **TLS badge** in bar → drawer closes, modal opens (badges stay clickable above drawer via CSS).
2. Open modal from badge → open drawer from gear → modal closes, drawer shows TLS nav (one embedded TLS body).

### Execute after TLS/auth (ties to Phase 4 logic)

1. Plaintext + Bearer auth on `localhost:50051` echo fixture → Send Unary → OK.
2. mTLS without client cert → local validation blocks Send before network.
3. Auth panel token wins over manual `authorization` metadata row.

See also [`grpc-studio-plan.md`](../plan/future/grpc/grpc-studio-plan.md) § Phase 4J acceptance checklist.

## Manual smoke flow (1× walk — Phase 4 TLS/auth logic)

Complete at **1× speed** when validating TLS/auth **execution** after changes (complements 4J UI smoke above).

### Plaintext + Bearer auth

1. Target `localhost:50051`, TLS **disabled**.
2. Reflect → select **Echo** → body `{ "message": "phase4-smoke" }`.
3. Auth panel → **Bearer** → enter token → **Send Unary** → 200/`OK`.
4. Confirm response panel shows result; no raw token in persisted tab JSON (DevTools → Application).

### TLS validation (modal or drawer)

1. Open TLS via **connection bar badge** (or settings drawer TLS nav).
2. Set TLS mode **mTLS** without client cert/key → local validation error before Send.
3. Add server CA PEM (or use plaintext fixture) → validation clears.
4. Optional: set **Server name override** → confirm SNI field saved on tab.

### Auth precedence

1. Metadata: `authorization: Bearer stale-manual`.
2. Auth panel: Bearer with different token → Send → request uses **panel** token (Network tab or server log).

### Spring hints (optional — Spring fixture)

1. Health `Check` on `health.v1.Health` (call composer **or** settings drawer Health nav) → Actuator hint visible; dismiss persists.
2. Simulate status **7** response → PERMISSION_DENIED hint; status **16** must **not** show it.

## Automated regression gate

```bash
# Phase 4J merge gate — 4I regression + 4J UI parity unit tests
npm run test:grpc:phase4j

# Phase 4I merge gate — acceptance + full 4A–4H chain (included in 4J gate)
npm run test:grpc:phase4i

# Individual sub-gates (during development)
npm run test:grpc:phase4a   # contracts
npm run test:grpc:phase4bc  # TLS + auth UI
npm run test:grpc:phase4d   # OAuth2 server-side
npm run test:grpc:phase4e   # vault + leak scan
npm run test:grpc:phase4f   # transport dial + TLS errors
npm run test:grpc:phase4g   # masked secrets + Spring hints
npm run test:grpc:phase4h   # cross-feature export + replay
```

`test:grpc:phase4j` runs deliverable checks, `tsc -b --noEmit`, `grpcPhase4JAcceptance.test.ts`, `test:grpc:phase4i`, then scoped 4J component/policy vitest (15 files).

`test:grpc:phase4i` runs `tsc -b --noEmit`, `grpcPhase4Acceptance.test.ts`, then each sub-gate above.

### Optional E2E (shell — no Docker)

```bash
npx playwright test e2e/grpc-studio-tls.spec.ts e2e/grpc-studio-shell.spec.ts --reporter=list
```

Validates TLS badge → modal, settings drawer nav (Compression, Health, Auth), auth badge → Auth tab, drawer Close/Escape, TLS badge closes open drawer — without the Go echo fixture (13 shell tests).

## Phase 4 test matrix

| Area | Case | Verified by |
|---|---|---|
| **4A** | Auth precedence contract | `grpcAuthPolicy.test.ts` |
| **4A** | TLS validation contract | `grpcTlsPolicy.test.ts` |
| **4A** | Redaction helpers | `grpcRedaction.test.ts` |
| **4B** | TLS modal/drawer + connection resolution | `GrpcTlsPanel.test.tsx`, `useGrpcTls.test.ts` |
| **4C** | Auth panel + metadata merge preview | `GrpcAuthPanel.test.tsx`, `grpcAuthPreview.test.ts` |
| **4D** | OAuth2 server-side only | `grpcOAuth2TokenService.test.ts`, `grpcStudioTypes.test.ts` |
| **4E** | Secret vault + leak scan | `grpcSecretVault.test.ts`, `grpcSecretLeakScan.test.ts` |
| **4F** | TLS transport + error classification | `grpcTransportErrors.test.ts`, `grpcClient.test.ts` |
| **4G** | Masked secret fields + Spring hints | `grpcSecretFieldUi.test.ts`, `grpcSpringHints.test.ts` |
| **4H** | Saved request replay + export bundles | `grpcReplayResolver.test.ts`, `grpcCrossFeatureExport.test.ts` |
| **4I** | Acceptance checklist traceability | `grpcPhase4Acceptance.test.ts` |
| **4J** | Connection bar, TLS modal, settings drawer, compression/health panels | `test:grpc:phase4j`; `grpcPhase4JAcceptance.test.ts`; component tests in gate script |

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Send blocked — mTLS validation | Missing client cert/key | Fill **Client certificate** + **Client key** in TLS modal or drawer TLS nav |
| `unknown_ca` / untrusted certificate | Missing or wrong CA PEM | Paste server CA in TLS modal/drawer or use `-plaintext` for local fixture |
| `hostname_mismatch` | SNI / cert CN mismatch | Set **Server name override** in TLS modal/drawer |
| Auth panel filled but 401/16 | Wrong token or metadata override | Clear manual `authorization` metadata; re-check Bearer value |
| OAuth2 execute fails shape validation | Missing tokenUrl/clientId/secret | Complete OAuth2 fields; secret from vault after save |
| Token visible in export JSON | Bypassed redaction helper | Use `prepareGrpc*Export` / `redactGrpc*` — never raw snapshot persist |
| PERMISSION_DENIED hint on 401 | Status 16 not 7 | Expected — hint is **status 7 only** |
| grpcurl copy missing headers | Secret headers stripped | By design — configure auth in Studio Auth panel / settings drawer |
| Replay uses wrong TLS/profile | Tab profile leaked into saved target | Fixed 4H — explicit target ignores tab `connectionId` |

## Phase 4 acceptance checklist

| Criterion | Verified by |
|---|---|
| `mtls` without cert or key is blocked locally with actionable validation | `grpcPhase4Acceptance.test.ts`; `validateGrpcTlsConfigContract` |
| TLS hostname mismatch and unknown-CA paths show distinct, understandable errors | `grpcPhase4Acceptance.test.ts`; `classifyGrpcTransportFailure` |
| Auth panel and metadata `Authorization` conflicts resolve deterministically | `grpcPhase4Acceptance.test.ts`; `mergeGrpcExecuteMetadata` |
| `-bin` metadata values round-trip as base64 without corruption | `grpcPhase4Acceptance.test.ts`; `metadataValidation.test.ts`; `requestValidation.test.ts` |
| Secret fields are redacted from persisted history and exports | `grpcPhase4Acceptance.test.ts` (all four forbidden persist targets); `grpcCrossFeatureExport.test.ts` |
| Spring `PERMISSION_DENIED` hint appears only for status 7 and is dismissible | `grpcPhase4Acceptance.test.ts` (status gate + dismiss persist); `grpcSpringHints.test.ts`; `GrpcSpringHintCard.test.tsx`; `GrpcResponsePanel.test.tsx` |

## Phase 5 handoff notes

- Use `createGrpcSavedRequestFromSnapshot` + `resolveGrpcSavedRequestReplay` for collection replay (4H).
- History persistence must call `prepareGrpcCallHistoryExport` before writing `grpc_call_history_v1`.
- grpcurl import parser: `parseGrpcurlCommand` — full descriptor/TLS file-path import (Phase 5F ✅); see `npm run test:grpc:phase5fg`.
- Env interpolation for saved targets (`{{grpcHost}}`) already wired in replay resolver.
