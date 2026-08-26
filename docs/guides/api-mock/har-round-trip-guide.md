# HAR Round-Trip Comparison Guide

> **Track:** API Mock Studio — HAR enhancements  
> **Related:** [Import & Export Guide](./import-export.md)

Import a HAR file, mock the routes, replay the same requests against your mock server, then compare the mock responses to the originals side-by-side. This closes the loop: you know exactly which endpoints match and which diverge.

---

## What is HAR round-trip?

A **round-trip** is the full cycle:

```
Record browser traffic → .har file
         ↓
  Import HAR → mock rules
         ↓
  Enable routes on mock server
         ↓
  Replay same requests against mock
         ↓
  Journal → Compare mock vs original
```

The mock server stores the original HAR response alongside each imported rule (`harSourceEntry`). When a matched transaction arrives in the Journal, the **Compare HAR** button opens a side-by-side diff showing status codes and response bodies.

Use round-trip to:
- Verify a mock is faithful to real traffic before switching clients to it.
- Surface body fields the mock omits or adds.
- Detect template expressions (`{{helper}}`) that are intentional non-matches.

---

## Step-by-step

### 1 — Import the HAR

Open API Mock Studio → **Import** (top-right) → select source **HAR** → paste or upload your `.har` file.

The preview lists every accepted request with checkboxes. OPTIONS preflights, tracking domains, and duplicates are filtered automatically. Select the entries you want as rules.

Optionally check **Also create Simulate samples** to seed the Simulate panel at the same time.

Click **Confirm**. Each accepted entry becomes a disabled draft route with `harSourceEntry` metadata attached.

### 2 — Enable the imported routes

Select the draft routes and click **Enable** (or toggle the enable switch in each route editor). Click **Apply** to push the changes to the running server.

Routes must be enabled before they can match incoming traffic.

### 3 — Point your client at the mock server

The mock server listens on `http://127.0.0.1:4600` by default (check the server settings panel for the actual port).

Re-run the same requests that produced your HAR — either manually, via your test suite, or from the **Simulate** panel.

### 4 — Open the Journal

In the Dock, click **Journal**. Matched rows show outcome **matched** in green. The Journal captures every request the mock server receives.

### 5 — Inspect a single transaction

Click a matched Journal row to open the **Transaction Detail** panel. If the transaction matched a HAR-imported route, a **Compare HAR** button appears in the actions bar.

Click **Compare HAR** to open the round-trip comparison modal, which shows:

| Column | Meaning |
|--------|---------|
| **Status** | HTTP status code — ✓ Match / ✗ Mismatch |
| **Field / Line** | Each JSON field (or line for non-JSON bodies) |
| **Original HAR** | Value from the HAR file |
| **Diff** | ✓ match, ✗ mismatch, ~ template, ← only in original, → only in mock |
| **Mock response** | Value the server actually returned |

### 6 — Export the HAR report

If your mock has HAR-sourced routes, the Journal toolbar shows a **HAR report** button. Click it to download a JSON report covering all matched transactions:

```json
{
  "generatedAt": "...",
  "serverName": "my-server",
  "totalTransactions": 12,
  "matched": 10,
  "unmatched": 2,
  "statusMatches": 9,
  "statusMismatches": 1,
  "bodyMatches": 8,
  "bodyMismatches": 2,
  "entries": [ ... ]
}
```

See [`round-trip-example/comparison-report.json`](../../examples/har/round-trip-example/comparison-report.json) for a complete example.

---

## Comparing responses

### Status code match

A green **✓ Match** badge means the mock returned the same HTTP status the HAR recorded. A red **✗ Mismatch** means they differ — the most common cause is a fixed-status response that does not match the original.

### Body diff — JSON field-level

When both bodies are valid JSON objects, the diff engine compares field by field. Each row gets one of:

| Icon | Meaning |
|------|---------|
| ✓ | Field values are identical |
| ✗ | Field values differ |
| ~ | Mock value contains a `{{template}}` expression — intentional |
| ← | Field exists only in the original HAR response |
| → | Field exists only in the mock response |

### Body diff — line-by-line

For non-JSON bodies (plain text, XML, HTML) the diff falls back to line-by-line comparison using the same icons.

### Template expressions

When the mock response body contains `{{helper}}` expressions (e.g., `{{faker.name}}`), the diff marks that field as **template** rather than **mismatch**. Template fields count as body matches in the summary because divergence is expected and intentional.

---

## Bulk export

The **HAR report** button in the Journal toolbar exports a summary JSON covering **all** HAR-matched transactions since the last clear:

- `totalTransactions` — total Journal rows (including unmatched and proxied)
- `matched` — rows where a HAR-sourced route fingerprint was found
- `unmatched` — rows with no matching HAR fingerprint (e.g., routes imported from other sources)
- `statusMatches` / `statusMismatches` — count of status code outcomes
- `bodyMatches` / `bodyMismatches` — count of body outcomes (`template` counts as a match)
- `entries` — one object per matched transaction with `method`, `path`, `originalStatus`, `mockStatus`, `statusMatch`, `bodyMatch`, and an optional `diffSummary` string

The button only appears when at least one enabled route has a `harSourceEntry` — a purely non-HAR workspace hides it.

---

## Example

See [`docs/examples/har/round-trip-example/`](../../examples/har/round-trip-example/) for:
- `original.har` — a 4-entry HAR (3 accepted + 1 OPTIONS preflight filtered)
- `comparison-report.json` — the expected report after replaying against the mock

The example shows one status mismatch on `POST /users` (the HAR recorded 201, the mock defaults to 200) and two full matches on `GET /users` and `GET /users/1`.
