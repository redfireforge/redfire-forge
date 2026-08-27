# API Mock Studio — End-to-End Training Walkthrough

> **Exit criteria (12D):** Complete Tracks **A–C** on a **fresh** web workspace and a **fresh** Tauri workspace. Tracks D–F are advanced.  
> **Labels** below match the shipped UI as of the `feautre/apimock` branch. If a label drifts, fix this file — do not invent synonyms in demos.

## Before you start

| Item | Web | Tauri |
|---|---|---|
| App | `npm run dev` | `npm run tauri:dev` |
| Companion | `npm run server:dev` required | Native listen; companion for TLS helpers |
| Wipe state | Clear site data / storage for the origin, or use a clean profile | Clear persisted `api-mock-workspace-v1` via app storage / reinstall profile |
| Sample file | `examples/api-mock/sample-workspace.json` | same |

Navigation reminder:

- Top protocol tabs → **API Mock**
- Workspace nav → **Studio** | **Runtime** | **Conflicts**
- Server bar → **Start** / **Stop** / **Apply** / **Restart** + settings gear

---

## Track A — Core lifecycle (required)

| # | Steps | Expected |
|---|---|---|
| A1 | Protocols → **API Mock** | Studio shell; empty state or restored workspace |
| A2 | Create a mock server (**Create first mock server** or tab **+**) | Tab like `Mock Server 1:4600`; listen host/port visible; empty Studio explains unmatched requests **404** until a rule exists; **Start** remains enabled |
| A3 | **Studio** → **Add route** → Match: `GET` + `/health` (Exact) | Route selected in explorer |
| A4 | **Response** tab → body `{ "ok": true }`, status 200 | Content editor shows body |
| A5 | Server bar → **Start** | Status **Running**; copy address works |
| A6 | `curl -s http://127.0.0.1:<port>/health` (or Requests) | HTTP 200 + JSON body |
| A7 | Studio footer **Live** strip → **Transactions** | Deep-link opens **Runtime → Transactions**; row outcome **matched** |
| A8 | Edit body → **Apply** | Dirty clears; generation increments; new curl sees new body |
| A9 | Server bar gear or Studio tools → **Simulate** (if opened from route/examples) | Offline match without needing live traffic |
| A10 | Rename tab (F2) or **Duplicate** server | Rename sticks; duplicate gets next port and **no secrets** |
| A11 | **Stop** | Status **Stopped**; curl fails to connect |
| A12 | Close the tab (× or **Close Tab**) | Tab disappears; **Saved servers** count is unchanged; landing list appears if it was the last tab |
| A13 | **Saved servers** → **Open** on the closed server | Tab returns with its rules, examples, and settings intact |
| A14 | Tab context menu → **Delete Server…** → confirm, then **Undo** in the toast | Server leaves the library, then returns within the ~5s window |

**Web note:** If Start fails with companion unavailable, start `npm run server:dev` and retry.  
**Tauri note:** On TLS the server bar shows **HTTP/2** (same as web). Plaintext stays HTTP/1.1 (no h2c). Companion is still used to generate certificates. Capability-warning APIs remain wired for future stubs and currently return empty.

---

## Track B — Matching & Conflicts (required)

| # | Steps | Expected |
|---|---|---|
| B1 | Create two `GET /users/:id` (or same path) routes with different priorities / predicates | Both listed in explorer |
| B2 | Open **Conflicts** → run analysis (Analyze) | Findings: overlap / duplicate / shadowed / etc. |
| B3 | Open a finding → **Simulate** witness (or seed path/method) | Simulate modal opens with request seeded |
| B4 | Adjust priority from the inspector actions | Selection outcome copy updates; Apply gate follows severity policy |
| B5 | Acknowledge a finding when fingerprints stable | Ack badge; stale if definition changes |
| B6 | On a body predicate row, open **Pattern Toolbox** → **JSON body / JSONPath** | Click `sku` in sample → path `$.items[0].sku` |
| B7 | **Add conditions** | Predicate appears on Match tab |

---

## Track C — Import / Export (required)

| # | Steps | Expected |
|---|---|---|
| C1 | **Import** → **cURL command** → paste a GET/POST curl → preview → merge | Route + sample created |
| C2 | **Import** → **OpenAPI / Swagger** → paste a tiny OpenAPI 3 snippet | Stub routes listed in review |
| C3 | **Export** → **Workspace JSON** | Download; secrets redacted |
| C4 | **Export** → **WireMock mappings** | Mappings file + loss report when features are lossy |
| C5 | From **Catalog** or **Requests**, use **Export to API Mock** | Modal → rules land in Studio |

Import modes available in review: **merge**, **replace**, **copy**.

---

## Track D — Runtime settings & journal (required for ops literacy)

| # | Steps | Expected |
|---|---|---|
| D1 | **Runtime** → **Settings** | Cards: Selection, CORS, Limits, Fallback, Journal & redaction, LAN binding |
| D2 | Enable journal; set redact headers to include `authorization` | Save settings |
| D3 | Send a request with `Authorization: Bearer secret` | Journal shows redacted header |
| D4 | Set unmatched fallback to **Closest match debug**; hit unknown path | Debug body explains near miss |
| D5 | Enable **CORS**; from a browser (or curl) send `OPTIONS` with `Origin` | **204** preflight; **no** new journal row for OPTIONS |
| D6 | Open **State**, **Variables**, **Diagnostics**, **Console** | No raw PEM/secrets in diagnostics |
| D7 | Delete a route → undo toast → **Cmd/Ctrl+Z** or Restore | Route returns within ~5s window |

---

## Track E — TLS / Proxy / Faults (advanced; both runtimes)

| # | Steps | Expected |
|---|---|---|
| E1 | Server settings gear → **TLS** → enable HTTPS → generate self-signed | Listen URL becomes `https://…`; server bar **HTTP/2** badge (web and Tauri) |
| E2 | **Client certificates (mTLS)** → issue client credential | mTLS required when enabled |
| E3 | **Proxy** tab → enable; allowlist a real upstream; set fallback **Proxy to allowlisted upstream**; keep **Record … drafts** on | Unmatched traffic proxied |
| E4 | Hit an unmatched path that proxies successfully; wait ~2s | Live message about recorded drafts; **inactive** draft routes appear in explorer |
| E5 | Response → **Faults** → Timeout / Reset | Journal outcome fault / connection error |

**Tauri:** Track E runs on the native listener (HTTP/2, proxy, drafts, faults). Companion is still used to **generate** TLS PEMs.

---

## Track F — Automation (advanced)

| # | Steps | Expected |
|---|---|---|
| F1 | `npx tsx cli/index.ts mock simulate examples/api-mock/sample-workspace.json` | Exit 0; samples match |
| F2 | `npx tsx cli/index.ts mock start examples/api-mock/sample-workspace.json --standalone --wait-ready` | `curl` `/health` works |
| F3 | Workflow Designer → palette **API Mock** → **Start Mock Server** → HTTP call → **Assert Mock Calls** → **Stop Mock Server** | Run succeeds; mock port in variables |
| F4 | Test Runner → API Mock fixture panel → select server + isolate → run | Fixture starts; teardown stops isolated server |

---

## Done

When Tracks A–C pass on web and Tauri, the walkthrough exit criteria are met. Optional Tracks D–F can be recorded for your release notes.
