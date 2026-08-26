# Import & Export

## 1. Import (Studio → Import)

Modal: **Import Review**. Sources:

| Source | UI label | Input |
|---|---|---|
| `curl` | **cURL command** | Paste curl → rule + sample |
| `openapi` | **OpenAPI / Swagger** | Paste JSON/YAML |
| `catalog` | **Catalog endpoints** | Multi-select stored catalog ops |
| `requests` | **Requests collection** | Promote items/folders |
| `native` | **RedfireForge export** | Native envelope round-trip |
| `wiremock` | **WireMock mappings** | Stub JSON |
| `har` | **HAR capture** | Browser/devtools archive (redacted, size-limited) |

### Modes

- **Merge** — add into current server / folder
- **Replace** — replace target routes
- **Copy** — duplicate into a new server/folder as offered by the wizard

Review shows preview rows, diagnostics, and a **loss report** when the source cannot express a Studio feature 1:1. HAR/WireMock drafts may stay disabled until you enable them after review.

## 2. Export (Studio → Export)

| Menu item | Output |
|---|---|
| **Workspace JSON** | All servers, redacted |
| **Workspace YAML** | Source-control friendly |
| **Active server JSON** | Current tab only |
| **Active server routes** | Rules + samples |
| **WireMock mappings** | Subset + **loss report** file |
| **HAR (journal)** | Captured traffic + **loss report** |

Secrets and credential material are stripped/redacted on export. Duplicate server also strips secrets.

### WireMock loss (examples)

Weighted/sequence modes, complex predicate trees, and some path kinds are approximated or reported as loss — always read the loss report before treating export as authoritative.

## 3. Promotion from other studios

| From | Action |
|---|---|
| **Catalog** | Export to API Mock modal |
| **Requests** | Export to API Mock modal |
| **Journal / examples** | Open in Requests; save as example; promote to rule |

## 4. CLI file shapes

`mock simulate|verify|start` accept the same JSON/YAML workspace, `_exportMeta` envelope, or single-server definition as the GUI importer.

## 5. Creating Simulate samples from a HAR import

When importing a **HAR capture**, you can simultaneously create **Simulate saved samples** — one per accepted entry, pre-filled with the request and the expected HTTP status from the real HAR response.

### How to use

1. Open **Studio → Import** and select **HAR capture**
2. Paste your HAR JSON and click **Parse**
3. Review the entry list — uncheck any entries you don't want
4. Check **Also create Simulate samples** (shown below the entry list)
5. Click **Import as draft**

After import:
- Routes appear in the Routes list (as inactive drafts, ready to enable)
- Samples appear in **Simulate → Saved samples** — named `METHOD /path` (e.g. `GET /widgets`)

### What each sample contains

| Field | Source |
|-------|--------|
| Request method | HAR request method |
| Request path | HAR request URL path |
| Request headers | HAR request headers (sensitive values redacted) |
| Request body | HAR request body (if present) |
| `expected.status` | HAR response status (e.g. 200, 201, 404) |
| `expected.outcome` | `matched` for 1xx/2xx/3xx; `unmatched` for 4xx/5xx |

`expected.bodyExact` is **not** set — body assertions tend to be too brittle for live APIs. Add them manually after import if needed.

### Toggling off

Leave **Also create Simulate samples** unchecked to import routes only (the default behavior before this option existed). The toggle state persists within the session but resets when the Import modal is closed.

### Example

Try [`docs/examples/har/api-mock-samples-demo.har`](../../examples/har/api-mock-samples-demo.har) — 5 requests across 3 endpoints, including one 404, demonstrating that:
- 4xx responses produce `expected.outcome = 'unmatched'` samples
- 2xx/3xx responses produce `expected.outcome = 'matched'` samples
- The `X-Api-Key` header is redacted automatically

## 6. HAR per-entry preview and filtering

When you paste a HAR file and click **Parse**, the Import modal shows a detailed **entry-by-entry preview** before any routes are created.

### What you see

```
Found 3 requests · 3 filtered · 4 headers redacted
                                          [All]  [None]

  POST  /api/auth/login    200  🔒
  GET   /api/users/me      200  🔒
  GET   /api/orders        200

  ▶ 3 automatically filtered
      OPTIONS  /api/orders     [CORS]
      GET      /collect        [tracking]
      GET      /products       [duplicate]
```

- **Checkboxes** — uncheck any entry you don't want as a rule
- **🔒** — this entry's `Authorization`, `Cookie`, or API-key header was redacted
- **All / None** — bulk select/deselect controls
- **Automatically filtered** section — collapsed by default; expand to see what was removed and why

### Auto-filter categories

| Tag | What it means |
|-----|---------------|
| `[CORS]` | OPTIONS preflight — not a real API call, no rule needed |
| `[tracking]` | Known analytics/telemetry domain (Google Analytics, Hotjar, Mixpanel, etc.) |
| `[duplicate]` | Same method + path already seen earlier in the HAR |
| `[non-HTTP]` | `chrome-extension://`, `blob:`, `data:`, or other non-http(s) URL |

Redacted header values are replaced with `[REDACTED]` — the matching route will have `[REDACTED]` as the header predicate value, which you should update after import.

### Deselecting entries

Uncheck individual rows before confirming to exclude them from the import. Common use cases:

- Skip static assets (`.js`, `.css`, images) that accidentally ended up in the HAR
- Skip 4xx/5xx responses if you only want to mock happy paths
- Skip internal health-check or telemetry calls that are not part of your API contract

The **None** button clears all checkboxes. The **Import as draft** button stays disabled until at least one entry is checked.

### Example

Try [`docs/examples/har/mixed-traffic.har`](../../examples/har/mixed-traffic.har) — 6 raw entries that produce:
- 3 accepted requests with checkboxes
- 3 auto-filtered (OPTIONS preflight, Google Analytics tracking domain, exact duplicate)
- 4 redacted headers (`X-Api-Key` and `Authorization` on 3 requests)
