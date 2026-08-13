# TLS, mTLS & Proxy

## 1. HTTPS (TLS)

**Server Settings → TLS**

1. Enable HTTPS.
2. Generate a self-signed certificate (companion TLS helper) or paste PEM.
3. **Start** — listen URL switches to `https://…`.
4. Clients must trust the certificate (dev trust store / disable verify only in controlled labs).

### HTTP/2

| Runtime | Behavior |
|---|---|
| **Node companion** | TLS listeners advertise **HTTP/2** (`h2`) with HTTP/1.1 fallback — server bar **HTTP/2** badge |
| **Tauri native** | Same: TLS advertises **HTTP/2** (`h2`) with HTTP/1.1 fallback; plaintext stays HTTP/1.1 (no h2c) |

## 2. mTLS

Still under **TLS** → **Client certificates (mTLS)**:

1. HTTPS must be enabled first (mTLS cannot outlive TLS).
2. Configure CA and/or use one-click issuance (creates CA + 365-day client cert, enables mTLS).
3. Match tab can assert **Certificate subject** (`security.certSubject`) — listener copies `CN=` + fingerprint onto the captured request. **PEM never enters the journal.**

## 3. Unmatched proxy

**Server Settings → Proxy** + fallback mode **Proxy to allowlisted upstream**:

| Setting | Purpose |
|---|---|
| Enable unmatched proxy | Active when fallback mode is Proxy |
| Allowlist | Host+scheme origins only (e.g. `https://api.example.com`). **No wildcards.** |
| Forward credential headers | Opt-in; default strips credentials |
| Timeout | Upstream timeout (ceiling 60s) |
| Record as inactive drafts | Proxied exchanges → draft routes for review/merge (default **on** in contract) |

Contract defaults / ceilings (`proxyContracts.ts`):

| Field | Default | Ceiling / note |
|---|---|---|
| `blockPrivateNetworks` | `true` | SSRF guard — blocks private/link-local upstreams unless disabled |
| `maxRedirects` | 5 | Max 10 |
| `maxResponseBytes` | 1 MiB | Max 10 MiB |
| `stripHopByHop` | `true` | Connection/Keep-Alive/etc. stripped |
| `timeoutMs` | 10_000 | Max 60_000 |
| `recordAsDrafts` | `true` | Studio polls + merges inactive routes |

Safety behaviors (engine — Node and native):

- Allowlist match required before any outbound
- Anti-recursion header on proxied calls
- Hop-by-hop header stripping
- Credential stripping unless forwarding enabled
- Set-Cookie stripping from upstream responses when configured by policy
- Private-network blocking by default

### Native listener

Unmatched proxy **and** record-as-drafts run on the Tauri native listener (same allowlist / hop-by-hop / redirect / body-cap stack as callbacks). Captures are polled into inactive Studio routes and acked — see [runtime-and-journal.md](./runtime-and-journal.md) §8.

## 4. Outbound callbacks & transforms

Configured per response variant (**Response → Outbound**):

- Global callback allowlist in server settings
- Per-variant HTTP callbacks after a match
- Response transform rules (header/body ops)

Native listener delivers outbound callbacks **and** the five typed response transforms with the same allowlist / SSRF policy as the Node companion.
