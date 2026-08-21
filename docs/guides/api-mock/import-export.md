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
