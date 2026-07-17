# gRPC Studio — Phase 10 Runbook (10I)

Operational gate and troubleshooting for **Browser Transport Modes** (Phase 10A–10I).

## Gate commands

| Gate | Command |
|---|---|
| Phase 10I full hardening gate | `npm run test:grpc:phase10i` |
| Phase 10I acceptance only | `npx vitest run src/shared/grpc/grpcPhase10iAcceptance.test.ts` |
| Phase 10H cross-surface parity | `npm run test:grpc:phase10h` |
| Phase 10G transport selector guardrails | `npm run test:grpc:phase10g` |
| TypeScript check | `npx tsc -b --noEmit` |

**Prerequisites:** Node 20+, `npm install`. Unit tests use mocked transport — no live gRPC server required.

---

## Phase 10 features overview

### Transport capability matrix (10A)

- Four transport modes: `express` (Node HTTP/2 proxy), `tauri` (native gRPC), `grpc-web` (browser direct), `spring-servlet` (Spring gRPC servlet).
- **gRPC-Web** and **Spring Servlet** are **web build only** — on Tauri desktop, use Express Proxy or Tauri Native (`browserOnly: true` in the capability matrix).
- `client_streaming` and `bidi_streaming` are **blocked** on `grpc-web` and `spring-servlet` at execute preflight.
- `mTLS` is **blocked** on browser-direct modes at execute preflight (browser fetch cannot attach client certificates).
- `unary` and `server_streaming` are live on all four modes.
- `client_streaming` and `bidi_streaming` remain blocked on browser-direct modes (`grpc-web`, `spring-servlet`) by execute preflight and stream-start validation.
- Matrix call-type rules are enforced at execute time by `assertGrpcTransportExecutePreflight`; browser-direct stream start in `grpcStreamClient.ts` routes `server_streaming` to a local browser stream session bridge.

### Transport mode router (10B)

- `resolveGrpcStudioTabTransportMode(tab)` — resolves effective mode from tab state and profile defaults.
- Default platform mode: `tauri` on desktop, `express` in browser.

### gRPC-Web framing codec (10C)

- `encodeGrpcWebTextBody` / `decodeGrpcWebTextBody` — base64 round-trip for `application/grpc-web-text+proto`.
- `decodeGrpcWebResponseBody(rawBody, contentType)` — handles both binary and text content types transparently.
- `decodeGrpcWebFrames` — length-prefix frame parser.
- `normalizeGrpcWebUnaryResponse` — canonical normalization: lowercase keys, promote `grpc-status`/`grpc-message`, strip `grpc-*` from response headers.

### Spring Servlet path resolver (10D)

- `buildSpringServletMethodPath(service, method)` → `POST /{service}/{method}`.
- `normalizeSpringServletServiceSegment` — strips leading slashes/dots, rejects path traversal.
- `resolveSpringServletPathCandidates` — canonical + short service name fallback for package-qualified descriptors.

### Browser transport error taxonomy (10E)

- Failure kinds: `'cors' | 'proxy_unreachable' | 'protocol_mismatch' | 'timeout' | 'server_status'`
- `classifyBrowserTransportFetchFailure({ error, transportMode })` — classify fetch failures.
- `classifyBrowserTransportHttpResponse({ httpStatus, contentType, bodyLength, transportMode })` — classify HTTP responses.
- `formatBrowserTransportFailureMessage` — returns actionable user-facing message per kind.

### In-flight transport lock (10G + grpcStudioTypes)

- `canChangeGrpcTabTransportMode(tab)` — returns `false` during any in-flight lifecycle.
- In-flight states: `connecting`, `calling`, `activeRequestId` set, `streaming` stream lifecycle, `activeStreamId` set.
- Terminal/idle states allow transport changes: `idle`, `success`, `error`, `cancelled`.
- **Transport panel** (`GrpcTransportPanel.tsx`) clarifies that `server_streaming` is supported on browser-direct modes, while `client_streaming` and `bidi_streaming` require Express Proxy or Tauri Native.

---

## Troubleshooting: gRPC-Web transport (`grpc-web`)

### CORS errors

**Symptom:** Studio shows "Browser blocked the cross-origin request (CORS)."

**Root cause:** Browser rejected the cross-origin fetch to the gRPC server.

**Fix:**
1. Configure your backend (Envoy proxy or Spring gRPC servlet) to allow the Studio origin.
2. Allow required gRPC-Web headers: `x-grpc-web`, `content-type`, `grpc-timeout`, and any custom metadata keys.
3. Allow `grpc-status` and `grpc-message` in exposed response headers.
4. Alternatively, switch to **Express Proxy** transport — routes through the local Node server, bypassing CORS.

### Proxy unreachable / connection refused

**Symptom:** Studio shows "Could not reach the server using gRPC-Web."

**Root cause:** Browser cannot connect to the target address.

**Fix:**
1. Verify the target `host:port` is reachable from your browser (not just from Node/terminal).
2. Check if the gRPC-Web proxy (Envoy, improbable-eng grpc-web, or Spring servlet) is running.
3. If behind a firewall, check network policies.
4. Use **Express Proxy** — routes through the local Node server for HTTP/2 with no browser network restrictions.

### Protocol mismatch (HTML response)

**Symptom:** Studio shows "Server response is not compatible with gRPC-Web transport."

**Root cause:** Server returned HTML or JSON instead of gRPC-Web frames.

**Fix:**
1. Confirm the server exposes a gRPC-Web endpoint (not raw gRPC HTTP/2).
2. Check that Envoy or Spring gRPC servlet is correctly configured.
3. Try switching to **Spring Servlet** transport if the server uses `net.devh` or Spring gRPC servlet mode.
4. Try **Express Proxy** if the server speaks raw gRPC HTTP/2.

### Content-type mismatch (binary vs text mode)

**Symptom:** Frames fail to decode.

**Root cause:** Server sends `application/grpc-web-text+proto` (base64) but client expects binary, or vice versa.

**Fix:**
- `decodeGrpcWebResponseBody(rawBody, contentType)` selects binary or text decoding based on the `Content-Type` header automatically — no manual configuration required.
- **Requests** are always sent as binary `application/grpc-web+proto`; servers that accept only `grpc-web-text` requests are not supported yet.
- If you built a custom client: use `encodeGrpcWebTextBody` for base64-encoded requests and `decodeGrpcWebTextBody` for base64-encoded responses.

---

## Troubleshooting: Spring Servlet transport (`spring-servlet`)

### Path resolution for package-qualified service names

**Symptom:** 404 error when calling service `com.example.acme.OrderService`.

**Root cause:** Some Spring gRPC servlet configs expect the short service name (`OrderService`) rather than the fully-qualified name.

**Fix:**
1. Studio tries servlet paths in order via `resolveSpringServletPathCandidates` / `buildSpringServletMethodUrls`:
   - Canonical: `/com.example.acme.OrderService/CreateOrder`
   - Short fallback: `/OrderService/CreateOrder` (automatic retry on HTTP 404)
2. Check server logs for the registered path pattern.
3. If both paths fail, configure your proto descriptor to use the short service segment the server exposes.

### Path traversal / invalid segment rejection

**Symptom:** `SpringServletPathResolutionError` thrown during path build.

**Root cause:** Service or method name contains `..`, `/`, or `\`.

**Fix:** Ensure descriptor service names are valid identifier segments. Strip leading slashes from manually entered names.

---

## Troubleshooting: In-flight transport lock

**Symptom:** Transport mode selector is disabled and cannot be changed.

**Root cause:** An active call or stream is in-flight.

**Explanation:** Changing transport mid-call would corrupt the in-flight request. `canChangeGrpcTabTransportMode` returns `false` during:
- `lifecycle: 'connecting'` or `'calling'`
- `activeRequestId` is set (request tracking token present)
- `streamLifecycle`: `'starting'`, `'streaming'`, or `'ending'`
- `activeStreamId` is set

**Fix:** Wait for the call to complete, cancel it, or open a new tab for the new transport mode.

---

## Troubleshooting: Blocked call types

**Symptom:** Execute fails with "gRPC-Web does not support client streaming calls."

**Root cause:** `client_streaming` or `bidi_streaming` is not supported in browser-direct transport modes.

**Explanation:** Both `grpc-web` and `spring-servlet` transports use HTTP/1.1 Fetch — client streaming requires HTTP/2 bidirectional streaming which is not available in browsers.

**Fix:** Switch to **Express Proxy** or **Tauri Native** transport for `client_streaming` or `bidi_streaming` calls. The transport selector will show a warning when an incompatible combination is selected.

### Browser-direct server streaming behavior

**Behavior:** For `grpc-web` and `spring-servlet`, `startGrpcStream` creates a browser-local stream session and emits stream events from the browser fetch response. The session supports cancellation and sequence dedupe in the existing stream event pipeline.

**Current limitation:** Browser-direct modes still do not support `client_streaming` or `bidi_streaming`; use Express Proxy or Tauri Native for those call types.

---

## Phase 10 acceptance checklist

| Item | Status | Key implementation |
|---|---|---|
| `client_streaming`/`bidi_streaming` blocked on grpc-web/spring-servlet | ✅ | `assertGrpcTransportExecutePreflight` in `grpcWebTransportContracts.ts` |
| Unary/server-streaming status/trailer parity | ✅ | `normalizeGrpcWebUnaryResponse` in `grpcWebTrailerNormalize.ts`; both unary clients |
| `grpc-web-text` and binary content modes interoperate | ✅ | `decodeGrpcWebResponseBody` in `grpcWebFramingCodec.ts` |
| CORS/proxy failures reported with actionable errors | ✅ | `classifyBrowserTransportFetchFailure` + `formatBrowserTransportFailureMessage` in `grpcBrowserTransportErrorMapper.ts` |
| Switching transport does not mutate in-flight call | ✅ | `canChangeGrpcTabTransportMode` in `grpcStudioTypes.ts` |
| Spring Servlet resolves package-qualified service paths | ✅ | `buildSpringServletMethodPath` + `resolveSpringServletPathCandidates` + `buildSpringServletMethodUrls` retry in `grpcGrpcSpringServletUnaryClient.ts` |
| Server streaming on browser-direct modes starts via local browser stream sessions | ✅ | `startBrowserDirectServerStream` + `openBrowserDirectStreamEvents` in `grpcStreamClient.ts` |

---

## Key source files

| File | Purpose |
|---|---|
| `src/shared/grpc/grpcWebTransportContracts.ts` | Capability matrix, preflight enforcement, transport mode types |
| `src/shared/grpc/grpcWebFramingCodec.ts` | gRPC-Web binary/text framing codec |
| `src/shared/grpc/grpcWebTrailerNormalize.ts` | Canonical response/trailer normalization |
| `src/shared/grpc/grpcGrpcWebUnaryClient.ts` | gRPC-Web unary transport client |
| `src/shared/grpc/grpcGrpcSpringServletUnaryClient.ts` | Spring Servlet unary transport client |
| `src/shared/grpc/grpcSpringServletPathResolver.ts` | Spring Servlet path resolution |
| `src/shared/grpc/grpcBrowserTransportErrorMapper.ts` | CORS/proxy failure classification and error messages |
| `src/shared/grpc/grpcBrowserTransportAdapters.ts` | All four transport adapter wrappers |
| `src/features/grpc/grpcStudioTypes.ts` | Tab state, lifecycle types, in-flight transport lock |
| `src/shared/grpc/grpcPhase10iAcceptance.test.ts` | Phase 10 hardening acceptance tests |
