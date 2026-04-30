# Training Manuals — Naming Conventions

## File Naming Rules

### Main Feature Manuals
- Named after the feature: `<feature-name>.html`
- Examples: `async-correlation.html`, `script-node.html`

### Sample / Tutorial Files
- **Do NOT use `-sample` in the filename.**
- Use a difficulty suffix: `-easy`, `-medium`, `-advanced`
- Format: `<topic>-<difficulty>.html`

| Difficulty | Suffix       | Example                              |
|------------|--------------|--------------------------------------|
| Easy       | `-easy`      | `payment-callback-easy.html`         |
| Medium     | `-medium`    | `approval-workflow-medium.html`      |
| Advanced   | `-advanced`  | `parallel-payment-advanced.html`     |

### Folder Structure
Each gallery domain gets its own subfolder under `docs/training-manuals/`.
Workflow manuals are further grouped by category subdirectories.

```
docs/training-manuals/
  requests/                           ← Request gallery (13 files)
    requests.html                     ← domain overview
    get-all-users-easy.html
    ...
  tests/                              ← Test gallery (9 files)
    tests.html                        ← domain overview
    user-api-smoke-easy.html
    ...
  catalog/                            ← API Catalog gallery (7 files)
    catalog.html                      ← domain overview
    jsonplaceholder-easy.html
    ...
  assertions/                         ← Assertion Presets gallery (6 files)
    assertions.html                   ← domain overview
    api-healthcheck-easy.html
    ...
  workflow/                           ← Workflow gallery (36 files)
    workflow.html                     ← master overview
    api-patterns/
      api-patterns.html               ← category overview
      create-extract-verify-easy.html
      ...
    flow-control/
      flow-control.html               ← category overview
      conditional-branching-easy.html
      ...
    event-driven/
      event-driven.html               ← category overview
      webhook-trigger-easy.html
      ...
    orchestration/
      orchestration.html              ← category overview
      batch-provisioning-advanced.html
      ...
    script-node/
      script-node.html                ← category overview
      json-formatter-easy.html
      ...
    async-correlation/
      async-correlation.html          ← category overview
      payment-callback-easy.html
      ...
    diverse-apis/
      pokemon-evolution-easy.html
      ...
    node-reference/
      node-reference.html             ← reference guide
```

### Directory Mapping (Gallery → Manuals)
| Gallery Data Dir | Training Manual Dir |
|---|---|
| `src/data/galleries/requests/` | `docs/training-manuals/requests/` |
| `src/data/galleries/tests/` | `docs/training-manuals/tests/` |
| `src/data/galleries/catalog-specs/` | `docs/training-manuals/catalog/` |
| `src/data/galleries/assertion-presets/` | `docs/training-manuals/assertions/` |
| `src/data/galleries/workflows/` | `docs/training-manuals/workflow/` |
