# Security

## 1. Principles

- Mock payloads and journals stay **local** — no external telemetry of request/response bodies.
- Exports and duplicates **strip secrets**.
- Journal capture applies **redaction** (headers + JSONPaths).
- TLS private keys / PEMs are settings material — **never** written to the journal.
- Proxy path is allowlist-only with anti-recursion and credential controls.

## 2. Redaction

Configured in **Runtime → Settings** or **Server Settings → Journal**:

| Control | Effect |
|---|---|
| Redact headers | Case-insensitive header name list (e.g. `authorization`) |
| Redact paths | JSONPath expressions over bodies |
| Preserve scheme | Optional scheme retention policy when configured |

Applied to journal rows and relevant exports.

## 3. Proxy safety

When unmatched proxy is enabled:

- Upstream must match **allowlist** (scheme+host; no wildcards)
- **`blockPrivateNetworks` defaults to true** (SSRF guard)
- Hop-by-hop headers stripped
- Credential headers stripped unless **Forward credential headers** is on
- Anti-recursion header prevents mock→mock loops
- Response body capped (`maxResponseBytes`)
- Record-as-drafts stores **redacted** captures for promotion

See [tls-mtls-proxy.md](./tls-mtls-proxy.md).

## 3.1 CORS safety

- Credentials are never returned with `Access-Control-Allow-Origin: *` (origin is echoed + `Vary: Origin`).
- OPTIONS preflights are answered without journaling request bodies.

## 4. mTLS / certSubject

- Client certificates are issued/stored as settings credentials.
- Match on **Certificate subject** uses CN/fingerprint projected onto the captured request — not full PEM in the journal.

## 5. Secret export policy

| Action | Behavior |
|---|---|
| Workspace / server export | Redacted envelope |
| Duplicate server tab | Secrets stripped on the copy |
| WireMock / HAR export | Loss + redaction reports |

## 6. Threat notes for trainers

- Binding `0.0.0.0` exposes the mock on the LAN — intentional for device testing, risky on untrusted networks.
- Disabling TLS verification in clients is a lab-only practice.
- Do not paste production secrets into mock templates or examples that will be exported/shared.
