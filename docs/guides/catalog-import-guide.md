# Catalog Import Guide

Import OpenAPI and Swagger specifications into the API Catalog — URLs, files, and format compatibility.

## Overview

The Catalog supports importing API specifications in multiple formats and from various sources.

## Supported Formats

### OpenAPI 3.x

Versions supported:
- OpenAPI 3.0.0 - 3.0.3
- OpenAPI 3.1.0 - 3.1.x

File extensions: `.json`, `.yaml`, `.yml`

### Swagger 2.0

Legacy Swagger 2.0 specifications are **normalized into the Catalog's internal data
model** on import — the parser maps Swagger 2.0 constructs (`host`/`basePath`,
`definitions`, body parameters, `securityDefinitions`) into the same `CatalogEntry`
shape used for OpenAPI 3.x, so browsing and testing work identically.

This is a **model normalization, not a file conversion**: the original spec text is
stored unchanged (a Swagger 2.0 import stays Swagger 2.0 on disk and re-exports as
Swagger 2.0). To produce an actual **OpenAPI 3 YAML file** — for example to feed
OpenAPI Generator / Maven / Spring Boot codegen — use the
[Convert / Upgrade to OpenAPI](#convert--upgrade-to-openapi) action described below.

### Format Detection

Format is auto-detected from content:
- `openapi: "3.x.x"` → OpenAPI 3.x
- `swagger: "2.0"` → Swagger 2.0

## Import Methods

### From URL

Import directly from a hosted specification:

1. Click **+ Import Spec**
2. Select **URL**
3. Enter the specification URL
4. Click **Import**

**Example URLs:**
```
https://petstore.swagger.io/v2/swagger.json
https://api.example.com/docs/openapi.yaml
https://raw.githubusercontent.com/org/repo/main/api.yaml
```

**Benefits:**
- Easy to refresh when spec updates
- Always current version
- Works with public and accessible private URLs

### From File

Upload a local specification file:

1. Click **+ Import Spec**
2. Select **File**
3. Choose file (`.json`, `.yaml`, or `.yml`)
4. Click **Import**

**Benefits:**
- Works offline
- Import private/local specs
- Import modified versions

### From Clipboard

Paste specification content directly:

1. Click **+ Import Spec**
2. Select **Paste**
3. Paste JSON or YAML content
4. Click **Import**

**Benefits:**
- Quick for snippets
- No file needed
- Easy for testing partial specs

## Import Options

### Spec Name

Override the auto-detected name:

```
Spec Name: [My API v2_________]
```

If left blank, uses `info.title` from the spec.

### Server Selection

When spec has multiple servers, select default:

```
Servers:
  ○ https://api.example.com (Production)
  ● https://staging.api.example.com (Staging)
  ○ https://dev.api.example.com (Development)
```

### Base Path Override

Override the base path for all endpoints:

```
Base Path Override: [/api/v2________]
```

Useful when the spec's `servers` don't match your environment.

## Handling Common Issues

### CORS Errors (URL Import)

If importing from URL fails with CORS:

**Option 1:** Use the desktop app (no CORS restrictions)

**Option 2:** Download the spec and import as file

**Option 3:** Use a CORS proxy (for development only)

### Invalid JSON/YAML

If the spec has syntax errors:

1. Validate the spec using an online validator
2. Fix syntax errors in the source
3. Re-import

**Validators:**
- [Swagger Editor](https://editor.swagger.io/)
- [OpenAPI Generator](https://openapi-generator.tech/)

### Missing Required Fields

OpenAPI specs require certain fields:

```yaml
openapi: "3.0.0"
info:
  title: "My API"  # Required
  version: "1.0.0"  # Required
paths: {}
```

Ensure these are present before importing.

### Unsupported Features

Some advanced OpenAPI features have limited support:

| Feature | Support |
|---------|---------|
| `$ref` to external files / URLs | ❌ Not resolved (internal `#/` refs only) |
| `discriminator` | ⚠️ Limited |
| `callbacks` | ❌ Not displayed |
| `links` | ❌ Not displayed |
| `webhooks` (3.1) | ❌ Not displayed |

Referenced definitions within the same file work correctly.

## Swagger 2.0 Normalization (on import)

On import, Swagger 2.0 constructs are **normalized into the Catalog's internal model**
(they are *not* written back out as an OpenAPI 3 file — the stored raw spec stays
Swagger 2.0). This is what lets the endpoint browser, Try It, and export features treat
every spec uniformly:

### Model Normalization Mapping

| Swagger 2.0 | Internal model (OpenAPI 3-shaped) |
|-------------|-----------------------------------|
| `host` + `basePath` | `servers[0].url` |
| `produces`/`consumes` | Content-Type in `requestBody`/`responses` |
| `definitions` | `components.schemas` |
| `parameters` definitions | `components.parameters` |
| Body parameter | `requestBody` |
| `securityDefinitions` | `components.securitySchemes` |

### Known Limitations

- Form data parameters may need adjustment
- Some auth types map differently
- References in `responses` need manual review
- Only internal `$ref` (`#/...`) is resolved — external-file / URL refs are not (see [Multi-File Specs](#multi-file-specs))

## Convert / Upgrade to OpenAPI

To export a spec as a real **OpenAPI YAML file** (for OpenAPI Generator, Maven, Spring Boot,
or any tool that requires OpenAPI 3.x input), use the **Convert / Upgrade OpenAPI** action.
The same modal handles two flows, chosen automatically from the source format:

- **Convert** — Swagger 2.0 → OpenAPI **3.0** or **3.1**
- **Upgrade** — OpenAPI **3.0** → 3.1 / 3.2, or OpenAPI **3.1** → 3.2

The action only appears when a forward target exists (a spec already at OpenAPI 3.2, or an
unsupported format, shows a "Nothing to convert" toast instead):

- **Sidebar:** right-click an API → **Convert / Upgrade OpenAPI YAML…**
- **Overview:** the **Convert / Upgrade OpenAPI** button next to **Export Spec**

The action opens a preview modal:

| Control | What it does |
|---|---|
| **Engine** | *Convert flow:* `swagger2openapi` (**default** — battle-tested, correctness-proven, emits 3.0.x) or `Scalar` (`@scalar/openapi-upgrader` — the engine that can target 3.1). *Upgrade flow:* Scalar only (the only engine that emits 3.1 / 3.2) |
| **Target** | *Convert:* `OpenAPI 3.0` (both engines) or `OpenAPI 3.1` (Scalar only; disabled for swagger2openapi). *Upgrade:* only the forward versions your source can reach (3.0 source → 3.1 / 3.2; 3.1 source → 3.2) |
| **Validation badge** | Every result is repaired then run through a structural validation gate; a ✅/❌ badge and an error list show whether the output is a well-formed OpenAPI document. Download / Save are enabled only when valid |
| **Auto-fallback** | *Convert flow:* if the chosen engine throws **or** produces invalid output, the converter automatically falls back to the other engine; a chip records that it fell back and why. (Upgrades are Scalar-only and do not fall back) |
| **Deep lint** | Optional **Deep lint** button runs `oas-validator` (schema + best-practice rules) — advisory only, **never blocks** Download / Save. Targets OpenAPI 3.0.x; for 3.1 / 3.2 output only the structural checks above apply |
| **Compare engines** | *Convert flow:* runs both engines at OpenAPI 3.0 (no fallback) and reports each engine's validity, version, warning count, and whether the two YAML outputs are identical |
| **Prettify** | On by default (and remembered): sorts the converted document into a canonical, diff-friendly key order (openapi → info → servers → … → components) via `openapi-format` before emitting YAML. Applies to preview, Copy, Download, and Save; turn it off to keep the engine's raw output. Purely cosmetic — never changes semantics and never blocks Download / Save |
| **Warnings** | Conversion warnings (e.g. `x-s2o-warning` notes) are listed but do not block |
| **Search** | The YAML preview has a **Copy YAML** button and a search bar (Cmd+F, Enter / Shift+Enter to navigate) |

Two ways to use the result (both enabled only when the output is valid):

- **Download YAML** — saves `{name}-openapi-{target}.yaml` to disk.
- **Save as new version** — adds the converted / upgraded spec as a **new version** of the
  same Catalog entry (see [Re-importing & Updating](#re-importing--updating)). The new
  version is tagged in Version History with a changelog line such as *"Converted Swagger
  2.0 → OpenAPI 3.0.4 (swagger2openapi)"* or *"Upgraded to OpenAPI 3.2.0 (scalar)"* so it is
  easy to tell apart from the original. The Catalog keeps up to 10 versions per entry; saving
  when already at 10 prunes the oldest.

> **Which engine?** For Maven / Spring Boot codegen, keep the default **swagger2openapi**
> targeting **OpenAPI 3.0** — it has been verified to correctly move `body` parameters to
> operation-level `requestBody`, drop `schemes`, and rewrite `#/definitions/*` refs. Use
> **Scalar** only when you specifically need OpenAPI 3.1 / 3.2 output (or when upgrading an
> existing OpenAPI 3.x spec).

## Multi-File Specs

### Bundled Specs

If your spec references external files (`$ref`):

**Option 1:** Bundle before import
```bash
# Using swagger-cli
npx swagger-cli bundle api.yaml -o bundled.yaml

# Using redocly
npx redocly bundle api.yaml -o bundled.yaml
```

**Option 2:** Use a spec that's already bundled for distribution

### Referenced Files

External `$ref` examples that may not work:

```yaml
# This may not resolve
$ref: './schemas/User.yaml'
$ref: 'https://api.example.com/schemas/common.yaml#/Address'
```

**Solution:** Bundle the spec into a single file before importing.

## Re-importing & Updating

### Refresh from URL

If you imported from URL:

1. Right-click the API
2. Select **Refresh**
3. Spec is re-fetched and updated

Endpoints are matched by `operationId` or method+path.

### Manual Update

Replace with a different spec:

1. Right-click the API
2. Select **Update Spec**
3. Import new file/URL
4. Previous endpoints are replaced

### Preserving Customizations

Note: Refreshing/updating replaces the spec content. Any Try It customizations are lost. Export to Requests first if you want to keep them.

## Best Practices

### 1. Keep Specs Updated

For URL imports, refresh regularly to stay current:
```
Last refreshed: 2 days ago [Refresh]
```

### 2. Use Version Tags in URLs

```
https://api.example.com/docs/v2/openapi.yaml
```

Not:
```
https://api.example.com/docs/openapi.yaml
```

### 3. Validate Before Importing

Run specs through a validator first to catch issues:
- Swagger Editor
- Spectral linting
- OpenAPI Generator validation

### 4. Bundle Multi-File Specs

Always bundle to a single file for reliable import.

### 5. Document Your Imports

Keep track of where specs came from:
```markdown
## API Catalog Sources

- PetStore: https://petstore.swagger.io/v2/swagger.json
- UserAPI: ./specs/user-api.yaml (internal)
- PaymentAPI: https://payments.example.com/openapi.json
```

## Troubleshooting

### "Failed to parse specification"

- Check JSON/YAML syntax
- Validate using an online tool
- Ensure required fields exist

### "No endpoints found"

- Check `paths` object isn't empty
- Ensure HTTP methods are valid (get, post, put, etc.)
- Look for typos in path definitions

### "Authentication not detected"

- Check `securitySchemes` is under `components`
- Ensure `security` is applied globally or per-operation

### "Servers not loading"

- Verify URLs are valid
- Check for trailing slashes consistency
- Try adding a base path override

## Related Guides

- [Catalog Guide](./catalog-guide.md) — Using the catalog
- [Requests Guide](./requests-guide.md) — Working with requests
