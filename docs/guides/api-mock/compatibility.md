# Compatibility Matrix (Web Companion vs Tauri Native)

Use this table in docs, demos, and support answers. Warning APIs (`analyzeNativeUnsupported` / `native_capability_warnings`) remain wired for future stubs and currently return empty. Server bar **HTTP/2** badge appears on TLS for both runtimes.

| Capability | Web + Node companion | Tauri native listener |
|---|---|---|
| Start / Stop / Apply / journal | Yes (requires companion) | Yes |
| HTTP/1.1 plaintext | Yes | Yes |
| HTTPS | Yes | Yes (`h2` ALPN + HTTP/1.1 fallback) |
| HTTP/2 (`h2` ALPN) | Yes on TLS | Yes on TLS (plaintext stays HTTP/1.1; no h2c) |
| mTLS + certSubject match | Yes | Yes (native TLS path) |
| Self-signed / cert generation helpers | Companion TLS routes | Uses companion helpers where invoked from UI |
| Unmatched proxy | Yes | Yes (same outbound policy as callbacks) |
| Record proxied drafts | Yes | Yes (poll `recorded-drafts`; inactive Studio routes) |
| Outbound callbacks | Yes | Yes (same allowlist / SSRF policy) |
| Response transforms | Yes | Yes (same five typed ops) |
| Predicate operators | Full set | Same (`NATIVE_UNAVAILABLE_OPERATORS` is **empty**) |
| Curated Faker templates | Yes | Yes (same seeded tables) |
| Faults (timeout/reset/dribble/…) | Full | Full. Native malformed on HTTP/2 RST_STREAMs one stream; Node destroys the session. |
| Journal persist-to-disk | Temp snapshot under `redfireforge-api-mock-journals/` | Same temp dir |
| CLI `--standalone` | N/A (in-process Node) | Separate from Tauri UI native path |
| Workspace persistence | `api-mock-workspace-v1` | Same key via Tauri store |

## Guidance

1. **Author everywhere** — definitions are portable JSON.
2. **HTTP/2 on TLS** — native and companion advertise `h2` with HTTP/1.1 fallback. Plaintext stays HTTP/1.1 (no h2c).
3. **Unexpected native capability banners** are a regression, not expected product behavior. The warning helpers stay in place for future operator stubs.
4. Never claim “full WireMock parity.” Native HTTP mock matches the companion feature set; the sidecar still issues TLS PEMs and runs Kafka/GraphQL/webhooks. Intentional diffs: no h2c; XML Schema is an element-presence subset (both runtimes); commit does not rebind port/TLS; NOT combinator fail-closes when a child is `evaluated: false`.
