# Runtime & Journal

## 1. Views

| View | Role |
|---|---|
| **Studio** | Authoring + compact dock + live strip deep-links |
| **Runtime** | Full-page ops: journal and settings |
| **Conflicts** | Dedicated inspector (not nested under Runtime) |

Studio live strip deep-links into Runtime tabs (Transactions, State, Variables, Settings, …).

## 2. Runtime page tabs

| Tab | Purpose |
|---|---|
| **Transactions** | Journal table — filter, export JSON, clear, open in Requests, promote |
| **State** | Scenario states, counters, sequence positions; reset |
| **Variables** | Server-scoped runtime variables |
| **Settings** | Selection, CORS, limits, journal & redaction, fallback, LAN bind |
| **Diagnostics** | Local counters (match timing, journal drops, outcomes) — no raw payloads |
| **Console** | Companion log stream |

Studio dock also exposes Transactions / Conflicts / State / Variables / Diagnostics / Console (Conflicts removed from Runtime page because of the top-level Conflicts view).

## 3. Transaction outcomes

Typical outcomes: **matched**, **ambiguous**, **unmatched**, **proxied**, **fault**, **error**.

Actions from a row (where wired):

- Copy request as cURL
- Open in Requests
- Save as example / promote to rule

Empty journal uses `ApiMockRuntimeGuide` (status, sample curl, next steps).

## 4. Runtime Settings (page)

Card layout (not ALL-CAPS dense grids):

| Section | Controls |
|---|---|
| Selection | Multiple-match + equal-priority policies |
| CORS | Enabled, allow origins (see below) |
| Limits | Inbound body, connections, drain timeout |
| Fallback | Default 404 / closest-match debug / proxy |
| Journal & redaction | Enable, max entries, persist to disk, redact headers/paths |
| LAN binding | Host `127.0.0.1` / `localhost` / `0.0.0.0` |

Sticky bar: listen URL, unsaved badge, **Save settings**.

**Persist to disk:** when enabled, both the Node companion and the native Tauri listener write a capped redacted JSON snapshot under `{tmpdir}/redfireforge-api-mock-journals/` (hint text in UI).

## 5. CORS (Node + native)

Shared rules live in `src/shared/api-mock/corsHeaders.ts` and apply on **both** listeners:

| Behavior | Detail |
|---|---|
| Enable | Runtime Settings / Server Settings → Network (or CORS card) |
| Preflight | Enabled CORS + `OPTIONS` → **204**, **no journal row**, no `inFlight` bump |
| ACAO | Allowlist / `*` / empty-allowlist semantics; request `Origin` echoed when credentials require it |
| Credentials | Never paired with `Access-Control-Allow-Origin: *` — origin is echoed and `Vary: Origin` is set |
| Defaults | Methods/headers fall back to a safe GET…OPTIONS / Content-Type,Authorization,Accept set when lists are empty |

Browser SPAs that call the mock cross-origin need CORS enabled and an appropriate origin allowlist.

## 6. Server Settings modal

Gear on server bar → tabs: **General**, **Selection**, **Network**, **Journal**, **Proxy**, **TLS**.

Use this for proxy allowlists, TLS/mTLS, and deeper network options; Runtime Settings covers day-to-day policy tweaks.

## 7. Redaction

- Header names (default includes authorization-related headers)
- JSONPath body paths
- Applied to journal capture and exports
- PEM material must never appear in the journal (TLS credentials stay in settings only)

## 8. Recorded proxy drafts (live merge)

While a server is **Running** and unmatched proxy has **Record as inactive drafts** on:

1. Studio polls `recorded-drafts` about every **1.5s** (web companion or native invoke).
2. New drafts are merged into the route tree as **inactive** rules (`mergeRecordedDraftsIntoRoutes`).
3. A live status message like `Recorded N proxied exchange(s) as inactive draft routes.` appears.
4. Drafts are **acked** so they are not imported twice.

Review drafts in the route explorer, enable/edit, then **Apply**.
