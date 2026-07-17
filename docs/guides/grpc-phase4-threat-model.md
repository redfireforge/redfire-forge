# gRPC Studio — Phase 4 Threat Model (4A)

Operational security contract for TLS, auth, and secret handling before Phase 4B–4I implementation.

See also:
- [Phase 3 runbook](./grpc-phase3-runbook.md)
- [Phase 4 security validation](./grpc-phase4-security-validation.md) — 4I sign-off
- [grpc-studio-plan.md](../plan/future/grpc/grpc-studio-plan.md) — Phase 4 sub-phases

## Trust boundaries

| Zone | Trust level | Secret handling |
|---|---|---|
| Browser renderer | Untrusted for long-term secrets | Session memory default; no OAuth token fetch |
| Express `src-server` | Trusted proxy | Holds PEM + tokens only for active request lifetime |
| Persistence (localStorage / Tauri FS) | Semi-trusted | TLS PEM via `grpc_tls_certs_v1`; secrets redacted on export |
| Call history / workflow / harness exports | Untrusted downstream | **Never** receive raw secrets — use `grpcRedaction.ts` |
| Error envelopes / toasts / logs | User-visible | Sanitize with `sanitizeGrpcErrorMessage()` |

## Threat checklist (Phase 4A freeze)

| ID | Threat | Mitigation (4A contract) | Owner phase |
|---|---|---|---|
| T1 | Bearer token leaked in call history | `redactGrpcMetadataForExport` + `redactGrpcCallRequestForExport` (auth-panel aware) | 4A contract, 4E wired ✅ |
| T2 | PEM private key in error toast | `sanitizeGrpcErrorMessage` + `createSanitizedGrpcErrorEnvelope` / `createGrpcTransportErrorEnvelope` on call failures | 4A + 4F wired (unary + stream) |
| T3 | OAuth client secret in browser network tab | OAuth acquisition **server-side only** (4D); browser never calls token URL (`prepareGrpcExecuteRequestMetadata` passthrough) | 4A + 4D |
| T4 | Manual `authorization` metadata fights auth panel | `mergeGrpcExecuteMetadata` — auth panel wins (unary + stream) | 4A contract, 4C UI |
| T5 | mTLS without client key reaches network | `validateGrpcTlsConfigContract` blocks locally | 4A + 4B |
| T6 | `-bin` metadata corrupted on round-trip | Existing `metadataValidation.ts` base64 gate | 1F (unchanged) |
| T7 | BSR token persisted in export bundle | `redactGrpcProtoIngestState` | 4A contract, 4E wired ✅ |
| T8 | TLS hostname override applied in plaintext mode | `normalizeGrpcTlsConfig` strips override when disabled | 4A contract |
| T9 | SSRF via URL/BSR proto fetch | Server-side fetch gateways (Phase 3E) | `protoFetchPolicy.test.ts` |
| T9b | SSRF via OAuth token URL | `validateOAuthTokenUrl` + `redirect: manual` on server-side token fetch | `oauthTokenFetchPolicy.test.ts`, `grpcOAuth2TokenService.test.ts` |
| T10 | Secret rehydrated into UI after save | Write-only secret fields + mask on edit (4G UI) | 4G |

### Operational toggle

- `GRPC_OUTBOUND_DNS_STRICT=true` (default): DNS-aware outbound validation stays enabled for proto and OAuth token fetches.
- `GRPC_OUTBOUND_DNS_STRICT=false`: disables DNS address resolution checks for controlled environments, while keeping protocol/auth/host policy checks.

## Redaction consumers (must use shared helpers)

Defined in `src/shared/grpc/grpcSecretPolicy.ts` as `GRPC_REDACTION_CONSUMERS`:

- `call_history`
- `workflow_export`
- `harness_export`
- `runner_artifacts`
- `toast_messages`
- `error_envelopes`
- `server_logs`
- `diagnostics`
- `clipboard_copy`

## Storage keys

| Key | Contents | Secret policy |
|---|---|---|
| `grpc_tls_certs_v1` | PEM material per target/profile | Encrypted local (web localStorage / Tauri FS) — Phase 4E ✅ |
| `grpc_connection_profiles_v1` | Target + tlsMode + auth **references** | No raw tokens in persisted JSON |

## Verification commands

```bash
# Phase 4I merge gate (acceptance + full 4A–4H chain)
npm run test:grpc:phase4i

# Individual sub-gates
npm run test:grpc:phase4a
npm run test:grpc:phase4e
npm run test:grpc:phase4f
npm run test:grpc:phase4h
```

See [grpc-phase4-runbook.md](./grpc-phase4-runbook.md) and [grpc-phase4-security-validation.md](./grpc-phase4-security-validation.md).
