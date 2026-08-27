# Documentation Conventions

This document defines the organization and naming conventions for documentation published in this repository under `docs/`.

## Folder Structure

```
docs/
├── guides/                    # User and contributor guides
│   ├── getting-started.md
│   ├── cli-reference.md
│   ├── cli-ci-cd.md
│   ├── kafka-local-dev.md
│   ├── grpc-dev-loop.md
│   ├── demo-lesson-done-checklist.md
│   ├── api-mock/
│   └── …
│
├── test-data/                 # Importable JSON fixtures for manual / E2E scenarios
│
└── training-manuals/          # Interactive training content (HTML)
    ├── CONVENTIONS.md
    ├── requests/
    ├── tests/
    ├── workflow/
    ├── catalog/
    └── …
```

## Naming Conventions

### General Rules

1. **Use lowercase with hyphens** (kebab-case) for file names
2. **No spaces** in file names
3. **Use descriptive names** that indicate content
4. **Include category prefix** when helpful for sorting

### By Document Type

#### Guides (`docs/guides/`)
User-facing and contributor how-to documentation.

```
Pattern: <feature>-<topic>.md
Examples:
  - runners-comparison.md
  - workflow-runner-guide.md
  - cli-reference.md
  - cli-ci-cd.md
  - getting-started.md
```

#### Training Manuals (`docs/training-manuals/`)
Interactive learning content organized by topic and difficulty.

```
Pattern: <topic>-<difficulty>.html
Difficulties: easy, medium, advanced

Examples:
  - get-all-users-easy.html
  - auth-flow-medium.html
  - ecommerce-full-advanced.html
```

See `docs/training-manuals/CONVENTIONS.md` for detailed training manual conventions.

#### Test data (`docs/test-data/`)
JSON exports used for import/re-test workflows. Prefer the `wrapExport` shape documented in project testing guides.
