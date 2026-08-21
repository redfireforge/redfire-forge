# API Mock Studio — 12D Walkthrough Validation Record

> Filled from live execution of [`../studio-walkthrough.md`](../studio-walkthrough.md).  
> Design-only mockup PNGs under `docs/plan/future/apimock/mockups/screenshots/` are **not** substitutes for product evidence.

## Environment

| Field | Value |
|---|---|
| Date | 2026-08-13 |
| Branch / commit | `feautre/apimock` @ `ab5e8db1` |
| App version (`package.json`) | `0.7.0` |
| Web: Vite + companion | ☑ `http://127.0.0.1:5173` + companion `:3001` |
| Tauri | ☑ `cargo run --features mcp-bridge` → native listener (`redfireforge` process); MCP bridge `:9223` |
| OS | Darwin 25.6.0 arm64 |

## Track results

| Track | Web | Tauri | Notes / screenshot files |
|---|---|---|---|
| A Core lifecycle | ☑ | ☑ | Web: Start → curl 200 `{"ok":true}` → Apply → `{"ok":true,"v":2}` → Simulate → Stop. Tauri: native listen on `:4610` (4600 held by companion); curl `--noproxy '*'` 200; journal matched `GET /health`. |
| B Matching & Conflicts | ☑ | ☑ | Duplicate `GET /users/:id` P10 finding; Simulate witness; adjust priority / ack (web). Pattern Toolbox opened (web). |
| C Import / Export | ☑ | ☑ | Web: cURL + OpenAPI import, Workspace JSON + WireMock downloads; **C5** Requests → Export to API Mock → `GET /health` draft on Mock Server 1 (`track-c5-web-export-to-mock-modal.png`, `track-c5-web-studio-after-export.png`). Tauri: cURL import, OpenAPI `/ping` parse+import, Export menu (workspace/wiremock/har). |
| D Runtime settings | ☐ CORS OPTIONS + undo | — | Optional advanced; not required for 12D exit |
| E TLS / Proxy / Faults | ☐ drafts + HTTP/2 | ☐ HTTP/2 + drafts | Optional advanced |
| F Automation | ☐ | — | Optional |

## Screenshot naming

Files next to this record:

```text
track-a-web-start-running.png
track-a-web-runtime-transactions.png
track-a-web-simulate.png
track-a-web-stopped.png
track-a-tauri-server-bar.png
track-a-tauri-runtime-transactions.png
track-b-web-conflicts.png
track-b-web-simulate-witness.png
track-b-web-pattern-toolbox.png
track-b-tauri-conflicts.png
track-c-web-import-review.png
track-c-web-import-openapi.png
track-c-web-export-menu.png
track-c-web-studio-after-import.png
track-c-tauri-import-review.png
track-c-tauri-import-openapi.png
track-c-tauri-export-menu.png
track-c5-web-export-to-mock-modal.png
track-c5-web-studio-after-export.png
```

## Sign-off

| Role | Name | Date |
|---|---|---|
| Executor | Cursor agent (Playwright MCP + Tauri MCP bridge) | 2026-08-13 |
| Reviewer (optional) | | |

### Execution notes

- Fresh web workspace: wiped `localStorage` / IndexedDB before Track A.
- Fresh Tauri workspace: empty Studio state before create; port set to **4610** because companion still owned 4600/4601 from the web pass.
- Shell `curl` to loopback required `--noproxy '*'` on this machine (corporate proxy otherwise returned 504 HTML).
- Native Tauri listener confirmed via `lsof` (`redfireforge` PID on `:4610`) and matched journal row.
- **C5 follow-up (same day):** Requests collection → context menu **Export to API Mock** → modal targeted Mock Server 1 `:4600` with generated `GET /health`; Studio showed draft under folder **From Requests**. Export now dispatches `api-mock:workspace-changed` so a mounted Studio reloads without a full page refresh.

12D docs are **authored** and Tracks **A–C** (including **C5**) evidence is recorded for web + Tauri → **12D exit criteria met**.
