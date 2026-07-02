# gRPC Studio Concrete UX Spec

> Last updated: 2026-07-01 — reflects Mockup A (07-unified-shell-desktop.html) after full review session.

## Scope
This document defines the target UX for the gRPC Studio page so it reaches visual and interaction parity with the GraphQL and WebSocket Studio shells. Design-only — does not require immediate production implementation.

## Artifacts
- **Mockup A (primary)**: [mockups/07-unified-shell-desktop.html](mockups/07-unified-shell-desktop.html) — fully interactive, desktop 3-column shell
- Mockup B: [mockups/08-unified-shell-response-focus.html](mockups/08-unified-shell-response-focus.html) — response-focus mode exploration
- Mockup C: [mockups/09-unified-shell-tablet-mobile.html](mockups/09-unified-shell-tablet-mobile.html) — tablet/mobile adaptation

## Design Goals
1. Keep request and response visible without vertical scrolling on a 1440×900 desktop.
2. Eliminate redundant top-chrome stacking — one compact strip replaces two stacked rows.
3. Reuse shell patterns already established in GraphQL and WebSocket Studios (connection bar, TLS modal, auth tab, response tabs).
4. Support unary and streaming flows without changing mental model.
5. Each tab is fully independent — own target, TLS config, auth, and active method.
6. Keep tablet and mobile navigation usable with predictable stage-based navigation.

---

## Information Architecture

### Desktop vertical stack
| Row | Height | Content |
|---|---|---|
| App header | 44px | Logo, nav pills (API / Workflow / Harness / Protocols), env badge |
| Protocol tab bar | 38px | Kafka / WebSocket / GraphQL / SSE / **gRPC** |
| Protocol subnav | 36px | Studio / Collections / Call History (badge) / Advanced |
| **Multi-tab bar** | 38px | Named tabs with copy+close, + New tab counter |
| Connection row | 40px | All per-tab connection controls |
| Workspace | fill | 3-column main shell |

### Workspace columns (desktop)
| Column | Width | Content |
|---|---|---|
| Services Explorer | 220–280px (collapsible to 36px rail) | Service tree, search, footer, Manage Schemas |
| Request Composer | 40%–48% | Editor tabs + bottom tabs |
| Response Inspector | remaining (min 360px) | Top-level tabs, sub-tabs, status bar, latency |

---

## Multi-Tab System
- Maximum 8 tabs; counter shows `n/8` in the + New tab button.
- Each tab stores independently: target address, TLS mode, auth state, active method.
- Switching tabs syncs the entire connection row and composer method header.
- Tab actions: **copy** (duplicate all settings into a new tab), **close** (last tab cannot be closed).
- Typing in the address input updates the active tab's stored target.

---

## Component Specifications

### Connection Row
Single horizontal strip. Elements left to right:
1. **Profiles** button — load saved connection profiles.
2. **Target input** — `host:port` or `{{grpcHost}}` env variable.
3. **TLS badge** — opens shared TLS/mTLS modal; label reflects current mode (Plaintext / 🔒 TLS / 🛡 mTLS).
4. **Auth badge** — label reflects current auth state (Auth: None / Auth: Bearer / etc.).
5. **Deadline badge** — e.g. `30s`.
6. **Reflection loaded (n)** badge — green dot + count when reflection succeeded; matches "Schema loaded" pattern from GraphQL.
7. **↻** refresh reflection.
8. **⚙** connection settings.
9. **=n** call count badge — increments on each Send.
10. **▶ Send Unary** (or Send Stream) primary action button.

### TLS / mTLS Modal (shared with GraphQL and WebSocket)
Base sections are **identical** to GraphQL/WebSocket:
- Server Verification — Skip certificate validation checkbox.
- CA Certificate (optional) — PEM textarea.
- Client Identity / mTLS — Client cert + private key PEM textareas.
- Footer — Test TLS Connection, Reset to Defaults, Cancel, Save, Close.

**gRPC-only addition** (top of modal only):
- **TLS MODE** card selector: `Plaintext` | `TLS` | `mTLS` — because gRPC has a protocol-level plaintext HTTP/2 mode that HTTP-based protocols do not have.
- Selecting a card updates the TLS badge in the connection row on Save.

### Services Explorer
- **Header**: title + ⚙ settings + ↻ refresh + **‹/›** hide/show toggle.
- **Collapse**: sidebar folds to a 36px icon rail showing the active method name vertically; toggle flips to ›.
- **Search**: live filter input — hides non-matching methods instantly.
- **Service tree**: collapsible groups with colored icon (E, O, …), ▾/▸ caret, count badge; method rows show BD/CS/U/SS call-type badges; active method highlighted.
- **Footer** (sticky at bottom):
  - Source: ● Reflection badge
  - Services: n
  - Methods: n
  - ⚙ Manage Schemas button

### Request Composer
**Top tabs**: Form | JSON (share one source of truth; editing either updates the other)

**Editor toolbar** (between top tabs and editor area): Prettify button (right-aligned).

**Editor area**: form fields with type labels for Form mode; mono textarea for JSON mode.

**Bottom tabs** (persistent below editor):
- **Metadata** — key/value pairs sent as gRPC request metadata with every call.
- **Auth** — Auth type dropdown + Auth profile selector; shows "Editing page default auth" note matching GraphQL pattern.
- **Files** — attach binary files mapped to `bytes` fields.

### Response Inspector
**Top-level tabs** (parity with GraphQL's Response / Schema):
- **Response ●** — live dot when a result is present.
- **Proto ●** — syntax-highlighted `.proto` descriptor for the active service; Export .proto button.

**Status bar** (inside Response section, above sub-tabs):
`OK · <grpc-status-code> · <latency> · <size>` + **Tracing** badge + **Raw** toggle + **Copy** button.

**Sub-tabs**:
| Tab | Content |
|---|---|
| Body | Syntax-highlighted JSON (blue keys, green strings, peach numbers, mauve booleans) |
| Headers | Key/value table of response headers |
| Metadata | Key/value table of response metadata |
| Trailers | Key/value table of gRPC trailers (grpc-status, grpc-message, …) |
| Tracing | Resolver trace table (path / parent type / return type / duration) |
| Timing | Per-phase bar chart: DNS, TLS handshake, request sent, TTFB, response received, total |

**Body toolbar** (visible only on Body tab):
- JSON type label (left)
- **Pretty Format** button + **Copy** button (right)

**Latency distribution** (sticky footer inside Response section, parity with GraphQL):
- Min / Avg / p95 / Max stat chips
- Histogram bars color-coded: Fast (green) / Moderate (yellow) / Slow (red)
- Label: "Session history · n requests"

---

## Breakpoints
| Width | Layout |
|---|---|
| ≥ 1280px | 3-column desktop shell |
| 860px–1279px | 2-pane tablet: request + response side-by-side; Metadata/Auth as secondary panels |
| < 860px | Stage-tab mobile: one panel at a time; floating Send button |

---

## Parity Checklist vs GraphQL/WebSocket
- [x] Compact single top-chrome strip (no redundant stacking)
- [x] Profiles button in connection row
- [x] Reflection loaded badge (= "Schema loaded")
- [x] Call count badge (= "=n")
- [x] Shared TLS/mTLS modal (same base + gRPC mode selector extension)
- [x] Auth tab with "Editing page default auth" note
- [x] Response / Proto top-level tabs (= Response / Schema)
- [x] Status bar: code + latency + size + Tracing badge + Raw toggle
- [x] Body sub-tab with Pretty Format + Copy buttons and syntax highlighting
- [x] Headers / Metadata / Trailers / Tracing / Timing sub-tabs
- [x] Latency distribution histogram at bottom of response pane
- [x] Multi-tab bar with per-tab independent state (= per-tab in GraphQL)
- [x] Services sidebar hide/show toggle (extra: gRPC has a service tree, not in GraphQL)

## Acceptance Criteria
1. On a 1440×900 viewport, unary request and response are both visible after Send with no page-level vertical scroll.
2. Switching tabs updates target, TLS badge, auth badge, and composer method header immediately.
3. Closing a tab never leaves zero tabs open.
4. TLS modal Save updates the TLS badge to match the selected mode.
5. Services sidebar collapse/expand does not shift or reflow the request/response columns.
6. Pretty Format and Copy are present on the Body sub-tab; Copy briefly shows "Copied!" on success.
7. Latency distribution is always visible at the bottom of the Response section without scrolling.
8. On < 860px, stage tabs provide access to Request, Response, Metadata, and Auth panels.

## Open Product Questions
1. Should mode preference (Composer / Split / Response Focus) persist per tab, or globally?
2. Should the response-focus auto-switch trigger after every unary success, or only on user opt-in?
3. Should the mobile Send button stay floating or move into a sticky footer when the keyboard is open?
4. Should the `=n` call count badge reset when switching tabs, or be global across all tabs?

---

## UX Implementation Phases

These phases describe how to incrementally ship the Proposal A shell into production. They are separate from the product feature phases (1–13) in `grpc-studio-plan.md` — those shipped the gRPC engine and panels. These phases ship the **shell redesign** on top of that foundation.

### Phase UX-1 — Compact Shell + 3-Column Layout
**Goal:** Replace the current stacked layout with the unified 3-column desktop shell.

Implements:
- Remove redundant vertical stacking from current `GrpcStudioPage` top chrome.
- Single compact connection row (Profiles, target, TLS badge, Auth badge, deadline, ↻, ⚙, Send).
- 3-column CSS grid workspace: Services Explorer / Request Composer / Response Inspector.
- Services sidebar hide/show toggle (‹/›) collapsing to 36px icon rail.
- Reflection loaded badge (matching GraphQL "Schema loaded" pattern).
- Call count `=n` badge incrementing on each Send.

Does **not** include: multi-tab, response sub-tab changes, latency section.

Acceptance: On 1440×900, request and response are both visible after Send with no page-level scroll.

---

### Phase UX-2 — Multi-Tab Bar
**Goal:** Each tab is a fully independent workspace with its own server connection.

Implements:
- Tab bar between subnav and connection row.
- Per-tab state: target address, TLS mode, auth state, active method.
- Switching tabs syncs the entire connection row and composer method header.
- Tab copy (duplicate all settings), tab close (last tab cannot be closed).
- `+ New tab n/8` button with max-tab guard.
- Address input changes persist back to the active tab's stored state.

Depends on: UX-1.

---

### Phase UX-3 — Request Composer Parity
**Goal:** Request side matches GraphQL Studio's composer layout.

Implements:
- Top tabs: Form | JSON (shared source of truth; editing either updates the other).
- Prettify button in editor toolbar.
- Bottom tabs: Metadata | Auth | Files.
- Auth tab: auth type dropdown + auth profile selector + "Editing page default auth" note (matching GraphQL pattern).
- Files tab: binary file attachment for `bytes` fields.

Depends on: UX-1.

---

### Phase UX-4 — Response Inspector Parity
**Goal:** Response side matches GraphQL Studio's response panel.

Implements:
- Top-level tabs: **Response ●** / **Proto ●** (parity with GraphQL's Response / Schema).
- Proto tab: syntax-highlighted `.proto` descriptor for the active service + Export .proto button.
- Status bar: `OK · <code> · <latency> · <size>` + Tracing badge + Raw toggle + Copy button.
- Sub-tabs: Body / Headers / Metadata / Trailers / Tracing / Timing.
- Body toolbar: JSON type label + **Pretty Format** + **Copy** buttons; Pretty Format toggles between compact and indented; Copy writes to clipboard with "Copied!" confirmation.
- Syntax highlighting in Body: blue keys, green strings, peach numbers, mauve booleans, faint punctuation.
- Trailers sub-tab: `grpc-status`, `grpc-message` key-value table.
- Tracing sub-tab: resolver trace table (path / parent type / return type / duration).
- Timing sub-tab: per-phase bar chart (DNS, TLS handshake, request sent, TTFB, response received, total).

Depends on: UX-1.

---

### Phase UX-5 — Latency Distribution Footer
**Goal:** Response pane always shows session-level latency stats, matching GraphQL's bottom bar.

Implements:
- Sticky footer inside Response section (above nothing — always visible without scrolling).
- Min / Avg / p95 / Max stat chips.
- Histogram bars color-coded: Fast (green ≤50ms) / Moderate (yellow 50ms–1s) / Slow (red >1s).
- "Session history · n requests" sub-label.
- Resets per-tab when tab is closed; accumulates across calls within a tab session.

Depends on: UX-4.

---

### Phase UX-6 — Shared TLS Modal Refactor
**Goal:** gRPC reuses the exact same modal component as GraphQL and WebSocket, extended by one section.

Implements:
- Extract shared `TlsMtlsModal` component (Server Verification + CA cert + Client Identity).
- gRPC renders `TlsMtlsModal` with an additional `tlsModeSelector` slot at the top (Plaintext / TLS / mTLS cards).
- GraphQL and WebSocket render `TlsMtlsModal` without the slot — no behavior change for those protocols.
- TLS badge in connection row updates label on Save: Plaintext / 🔒 TLS / 🛡 mTLS.

Depends on: UX-1. Can be done in parallel with UX-2 through UX-5.

---

### Phase UX-7 — Tablet and Mobile Adaptation
**Goal:** Shell degrades gracefully on narrow viewports.

Implements:
- **860px–1279px (tablet)**: 2-pane layout — request + response side-by-side; Metadata/Auth become secondary panels or slide-overs.
- **< 860px (mobile)**: stage-tab navigation (Request / Response / Metadata / Auth); one panel visible at a time; floating Send button in viewport-safe zone.
- Minimum touch target ~32px on narrow layouts.
- All tab and mode controls keyboard-focusable with visible focus ring.

Depends on: UX-1 through UX-4.

---

### Phase Summary Table

| Phase | Delivers | Depends on | Priority |
|---|---|---|---|
| **UX-1** | Compact shell + 3-column layout + sidebar toggle | — | 🔴 First |
| **UX-2** | Multi-tab bar with per-tab state | UX-1 | 🔴 First |
| **UX-3** | Request composer parity (Prettify, bottom tabs, Auth, Files) | UX-1 | 🟡 Second |
| **UX-4** | Response inspector parity (Proto tab, sub-tabs, status bar, Pretty Format/Copy) | UX-1 | 🟡 Second |
| **UX-5** | Latency distribution footer | UX-4 | 🟢 Third |
| **UX-6** | Shared TLS modal refactor | UX-1 | 🟢 Third (parallel) |
| **UX-7** | Tablet and mobile adaptation | UX-1–4 | 🟢 Third |
