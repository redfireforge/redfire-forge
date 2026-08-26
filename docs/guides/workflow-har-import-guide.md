# HAR Import — Workflow Designer

Import browser-recorded traffic directly into the Workflow Designer. A HAR file captured from Chrome, Firefox, or Safari DevTools becomes a fully connected, parameterized workflow in seconds — no manual URL typing required.

## What is a HAR file?

A **HAR** (HTTP Archive) file is a standard JSON format that browsers use to record network traffic. Every request your browser makes — URL, method, headers, body, and response — is stored in the file.

```
Browser DevTools (Network tab)
  └── Record traffic while using an app
  └── Export → Save all as HAR with content
          ↓
  petstore-session.har  (JSON, ~50 KB)
          ↓
  RedfireForge → Import HAR → Workflow
```

**Why import to workflow instead of building manually?**

- Skip typing 10–50 URLs and headers by hand
- Preserve the exact sequence and parameters from a real session
- Auto-detect chained IDs (order ID from a POST response → reused in downstream GET URL path segments)
- Redacted headers become `{{variable}}` placeholders automatically

---

## Exporting a HAR from your browser

### Chrome / Edge

1. Open **DevTools** → `F12` (Windows/Linux) or `⌘⌥I` (Mac)
2. Go to the **Network** tab
3. Reload the page or perform the actions you want to capture
4. Right-click any request → **Save all as HAR with content**
5. Save the `.har` file to your machine

### Firefox

1. Open **DevTools** → `F12`
2. Go to the **Network** tab
3. Perform the actions to capture
4. Click the **gear icon** (⚙) → **Save All As HAR**

### Safari

1. Enable developer tools: **Safari → Settings → Advanced → Show features for web developers**
2. Open **Web Inspector** → `⌘⌥I`
3. Go to the **Network** tab
4. Perform the actions to capture
5. Click **Export** (share icon, top right of Network panel)

> **Tip:** Stop recording before exporting. A long recording produces large files with many filtered entries.

---

## Importing into the Workflow Designer

1. Open the **Workflow** tab
2. Click **Import HAR** in the toolbar (↓ arrow icon, right side of toolbar)
3. A native file picker opens — select your `.har` or `.json` file
4. The **preview modal** opens

### Limits

| Limit | Value |
|-------|-------|
| Maximum entries processed | 500 (first 500 kept if HAR has more) |

> There is no file size limit — very large HAR files are processed up to the 500-entry cap.

---

## The preview modal

The preview modal shows every request from your HAR file before anything is created.

```
┌─────────────────────────────────────────────────────────────┐
│  petstore-session.har — 3 requests found                    │
│                                                             │
│  ☑  POST  /auth/login           200                         │
│  ☑  GET   /users/usr-42         200                         │
│  ☑  GET   /users/usr-42/pets    200                         │
│                                                             │
│  ⚠ Redacted headers (1): Authorization → {{authToken}}      │
│                                                             │
│  ⚡ 2 variable chains detected automatically:                │
│  Step 1 → Step 2: $.userId → {{userId}}                      │
│  Step 2 → Step 3: $.id     → {{id}}                          │
│                                                             │
│  [Workflow name: api.petstore.example.com import]           │
│                                    [Cancel]  [Confirm]      │
└─────────────────────────────────────────────────────────────┘
```

### Checkboxes

Each request has a checkbox. **Uncheck** entries you don't want in the workflow:

- Static assets (`.js`, `.css`, images)
- 4xx/5xx error responses you don't want to model
- Requests to internal services not relevant to your test

> Automatically filtered entries (tracking pixels, OPTIONS/HEAD requests, duplicates, non-HTTP URLs) are removed before the modal opens — they do not appear in the list.

### Redacted headers

Sensitive header values are **never stored** in workflow definitions. The following headers are replaced with `{{variable}}` placeholders:

| Header | Replaced with |
|--------|---------------|
| `Authorization` | `{{authToken}}` |
| `Cookie` / `Set-Cookie` | `{{cookieSession}}` |
| `X-Api-Key` / `Api-Key` | `{{apiKey}}` |
| `X-Auth-Token` | `{{authToken}}` |
| `X-Access-Token` | `{{accessToken}}` |
| `X-Csrf-Token` | `{{csrfToken}}` |
| `Proxy-Authorization` | `{{proxyAuth}}` |

The warning box lists which headers were redacted. After import, open the **Variables** panel and paste real values into the empty rows (`authToken`, `apiKey`, …). Do not put secrets in **Initial Variables (this step)** — those are per-node overrides.

### Chain detection summary

When RedfireForge detects that a value from one response appears in a later request's URL path, it shows:

```
⚡ 2 variable chains detected automatically:
Step 1 → Step 2: $.userId → {{userId}}
Step 2 → Step 3: $.id → {{id}}
```

Each chain line shows: which step's response the value came from, the JSON path of the field, and the variable name it becomes. The value is **replaced with a variable** in downstream node URLs. This is a heuristic — verify the generated variables before running the workflow.

---

## What gets generated

After confirming, RedfireForge creates a **new workflow**. The name defaults to `{api-host} import` (e.g. `api.petstore.example.com import`) — you can edit it in the name field before clicking Confirm.

### Nodes

One **HTTP Request node** per checked entry, connected in sequence:

```
[Start] → [POST /auth/login] → [GET /users/{{userId}}] → [GET /users/{{id}}/pets]
```

### Variables

Open the **Variables panel** (toolbar → Variables button) to see auto-created variables:

| Variable | Where it appears |
|----------|-----------------|
| `{{baseUrl}}` | Variables panel **and** all node URLs (e.g. `{{baseUrl}}/users/{{userId}}`) |
| `{{authToken}}`, `{{apiKey}}`, `{{cookieSession}}`, … | Variables panel (empty) **and** redacted node headers |

Chain variables (`{{userId}}`, `{{id}}`) are extracted at runtime from upstream responses — they are **not** pre-declared in the Variables panel.

All node URLs are parameterized: `{{baseUrl}}/users/{{userId}}` (step 2) and `{{baseUrl}}/users/{{id}}/pets` (step 3).

### Node configuration

Each node is pre-configured with:
- **Method** — from the HAR entry
- **URL** — `{{baseUrl}}/path` (with chained variables substituted)
- **Headers** — from the HAR (with sensitive values replaced)
- **Body** — from the HAR request body (if present)

---

## Automatically filtered entries

The following entry types are silently removed before the preview appears:

| Filter | What is removed |
|--------|-----------------|
| OPTIONS / HEAD | OPTIONS preflight (CORS) and HEAD requests — not in the supported method set |
| Tracking domains | Google Analytics, Hotjar, Mixpanel, Segment, and 14 others |
| Non-HTTP URLs | `chrome-extension://`, `data:`, `blob:`, etc. |
| Exact duplicates | Identical method + path + body combinations |
| Private/localhost | Entries for `localhost`, `127.0.0.1`, `[::1]`, `192.168.*`, `10.*`, `172.16–31.*` produce a warning but are included |

---

## Post-import customization

After the workflow is created:

### 1. Rename the workflow
Click the workflow name in the header → edit in place.

### 2. Remove unwanted nodes
Select a node → `Delete` or `Backspace` key. Connected edges are also removed — re-draw them manually if needed.

### 3. Review chain variables
Open each HTTP node (double-click) and inspect the URL — chain variables like `{{userId}}` or `{{orderId}}` appear inline. Verify each makes sense; if the detector linked the wrong field, edit the URL to restore the original segment or replace with a different variable.

### 4. Fill in real values
- **`{{baseUrl}}`** — open the **Variables panel**, click the `baseUrl` row, set the real base URL (e.g. `https://api.example.com`)
- **`{{authToken}}` and similar** — same Variables panel. Paste the **full original header value** (including `Bearer `). HAR import never stores the captured secret.

### 5. Add assertions
Double-click an HTTP node → **Validations** tab → add status code or body assertions.

### 6. Run Quick Test
Toolbar → **Quick Test** — runs the workflow against real endpoints and shows pass/fail per node.

---

## Limitations

| Limitation | Detail |
|------------|--------|
| WebSocket / SSE / gRPC | Imported as plain HTTP Request nodes — protocol-specific features (streaming, binary framing) are not preserved and won't work correctly when executed |
| Cookies | Redacted to `{{cookieSession}}` placeholder |
| Timings | Browser timing data is not preserved |
| Chain detection | Heuristic — short values (< 3 characters) are not linked; common English words may produce false positives |
| Browser verification | Tested against HAR 1.2 spec (Chrome, Firefox, Safari all produce compliant files) |

---

## Examples

Try the provided example HAR files to see the import in action:

- [`docs/examples/har/petstore-session.har`](../../examples/har/petstore-session.har) — Login → Get user → List pets
- [`docs/examples/har/ecommerce-checkout.har`](../../examples/har/ecommerce-checkout.har) — Add to cart → Checkout → Get order → Tracking
- [`docs/examples/har/github-search.har`](../../examples/har/github-search.har) — Search repos → Get details → List issues

See [`docs/examples/har/README.md`](../../examples/har/README.md) for expected outputs.

---

## Related guides

- [Workflow Designer Guide](./workflow-designer-guide.md) — Canvas, nodes, edges overview
- [Workflow Variables Guide](./workflow-variables-guide.md) — Working with `{{variables}}`
- [Workflow Nodes Reference](./workflow-nodes-reference.md) — HTTP node configuration reference
- [API Mock Import Guide](./api-mock/import-export.md) — Import HAR into API Mock Studio instead
