# Troubleshooting

## Companion unavailable

**Symptom:** Start/Apply/journal fail; banner or diagnostic `COMPANION_UNAVAILABLE`.

**Fix (web):**

```bash
npm run server:dev
```

Confirm `http://127.0.0.1:3001` is reachable. Restart the Vite app if the UI still shows stale unknown state.

**Tauri:** Listen may still work via native; TLS generation helpers might need the companion.

## Port in use / owned

**Symptom:** `MOCK_PORT_IN_USE` or `MOCK_PORT_OWNED`, or Start fails with `EADDRINUSE`.

**Fix:**

1. Stop the other mock tab or process using the port.
2. Change the server port in settings to a free value — **Save settings** is blocked while another saved mock (open or parked) already claims that port. Creating a new tab also probes OS listeners in 4600–4699 and skips ports already bound.
3. On macOS: `lsof -nP -iTCP:<port> -sTCP:LISTEN` to find leftovers from a crashed companion / standalone CLI / another Studio runtime.

UI may show Stopped while a leftover process still holds the port — stop the process or pick a new port.

**Web + Tauri together:** If the companion still owns `:4600` from a web session, a Tauri tab will skip that port and take the next free one (e.g. `:4610`).

## Loopback curl returns HTML 504 / proxy page

**Symptom:** `curl http://127.0.0.1:46xx/health` returns a corporate **Gateway Timeout** HTML page instead of the mock JSON, even though Studio shows **Running** and the journal has rows.

**Cause:** An HTTP proxy env (`HTTP_PROXY` / `HTTPS_PROXY` / system proxy) is intercepting traffic to loopback.

**Fix:**

```bash
curl --noproxy '*' -s -i http://127.0.0.1:<port>/health
```

Or unset proxy vars for the shell. Studio’s own journal / Requests client is unaffected.

## Dirty but Apply disabled / validation errors

**Symptom:** Cannot Apply; validation diagnostics on route/settings.

**Fix:** Open the highlighted field (ceilings, empty required PEMs, invalid regex, proxy allowlist empty while proxy mode on). Fix and retry.

## Native capability warnings

**Symptom:** Unexpected native capability warnings on Tauri before Start/Apply.

**Fix:** As of 2026-08-13 those helpers return empty for the shipped operator set (`NATIVE_UNAVAILABLE_OPERATORS` is empty). A banner is a **regression**, not expected product behavior — see [compatibility.md](./compatibility.md). HTTP/2, unmatched proxy, recording drafts, callbacks, transforms, faker, journal disk, and xpath/xml/multipart run on native. Sidecar is still required for TLS PEM issuance and Kafka/GraphQL/webhooks.

## Journal empty while traffic is sent

Check:

1. Server **Running** (not Stopped).
2. Hitting the correct host/port/base path.
3. Journal enabled in Runtime Settings.
4. Filters on Transactions tab cleared.
5. Companion/native still healthy (Diagnostics / Console).

## Select-all JSONPath stuck on old path

Pattern Toolbox → JSON body: use a fresh select (click inside the textarea, Cmd/Ctrl+A). Path should become `$`. If HMR is stale, hard-refresh the app.

## Workspace wiped / empty after reload

Corrupt storage falls back to empty with diagnostics ([migration.md](./migration.md)). Re-import the last **Workspace JSON** export.

## CLI verify finds no calls

- Live mode needs a **running** mock and recent traffic.
- Use `--simulate` for offline corpus.
- Pass `--route` / `--expect-outcome` that match the definition.
- Ensure `--control-base` points at the companion when not on localhost.

## Proxy loops or 502

- Confirm allowlist origins.
- Ensure anti-recursion is not being stripped by an intermediate.
- Disable credential forwarding unless required.
- Prefer record-as-drafts + offline edit instead of long live proxy sessions.
