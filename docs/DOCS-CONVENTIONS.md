# Documentation Conventions

This document defines the organization and naming conventions for all documentation in the `docs/` folder.

## Folder Structure

```
docs/
├── guides/                    # User guides and how-to documents
│   ├── getting-started.md
│   ├── runners-comparison.md
│   ├── workflow-runner-guide.md
│   ├── cli-reference.md
│   └── cli-ci-cd.md
│
├── design/                    # Technical design documents
│   ├── api-catalog/
│   │   ├── DATA-MODEL.md
│   │   ├── DESIGN.md
│   │   └── PHASES.md
│   ├── workflow/
│   │   ├── DESIGN.md
│   │   ├── PHASES.md
│   │   └── ...
│   └── CROSS-PLATFORM.md
│
├── plan/                      # Implementation plans (in-progress)
│   ├── workflow-harness-integration-plan.md
│   ├── runner-split-plan.md
│   └── finished/              # Completed plans (archive)
│       ├── parameterized-test-plan.md
│       └── ...
│
├── mockups/                   # UI mockups and prototypes (HTML)
│   ├── qa-handoff-workflow-v3.html
│   ├── shared-data-sources-modal.html
│   ├── verify-modal-v2.html
│   ├── training-tracks.html
│   ├── theme-comparison.html
│   └── workflow-version.html
│
└── training-manuals/          # Interactive training content (HTML)
    ├── CONVENTIONS.md
    ├── requests/
    ├── tests/
    ├── workflow/
    ├── catalog/
    └── ...
```

## Naming Conventions

### General Rules

1. **Use lowercase with hyphens** (kebab-case) for file names
2. **No spaces** in file names
3. **Use descriptive names** that indicate content
4. **Include category prefix** when helpful for sorting

### By Document Type

#### Guides (`docs/guides/`)
User-facing documentation for how to use features.

```
Pattern: <feature>-<topic>.md
Examples:
  - runners-comparison.md
  - workflow-runner-guide.md
  - cli-reference.md
  - getting-started.md
```

#### Design Documents (`docs/design/`)
Technical specifications and architecture documents.

```
Pattern: <FEATURE>-<ASPECT>.md (UPPERCASE for visibility)
Examples:
  - DESIGN.md
  - PHASES.md
  - DATA-MODEL.md
  - ASYNC_CORRELATION_DESIGN.md
```

#### Plans (`docs/plan/`)
Implementation plans with phases and tasks.

```
Pattern: <feature>-plan.md
Examples:
  - workflow-harness-integration-plan.md
  - runner-split-plan.md
  - parameterized-test-plan.md
```

#### Mockups (`docs/mockups/`)
UI mockups and visual prototypes.

```
Pattern: <feature>-mockup.html or <feature>-<variant>.html
Examples:
  - verify-modal-mockup.html
  - verify-modal-v2.html
  - theme-comparison.html
  - shared-data-sources-modal.html
```

**Do NOT use:**
- `-mockup` suffix redundantly (folder implies mockup)
- Version numbers like `v3` unless comparing versions

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

## Migration Status

All files have been reorganized according to these conventions.

### Completed Migrations

#### Guides (`docs/guides/`)
- ✅ `runners-comparison.md`
- ✅ `workflow-runner-guide.md`
- ✅ `cross-platform.md`

#### Design (`docs/design/`)
- ✅ `api-catalog/` (DATA-MODEL.md, DESIGN.md, PHASES.md, UI-WIREFRAMES.md)
- ✅ `workflow/` (DESIGN.md, PHASES.md, ASYNC_CORRELATION_DESIGN.md, etc.)

#### Mockups (`docs/mockups/`)
- ✅ `qa-handoff-workflow.html`
- ✅ `shared-data-sources-modal.html`
- ✅ `training-tracks.html`
- ✅ `verify-modal-redesign.html`
- ✅ `verify-modal-v2.html`
- ✅ `versioning-gallery-a.html`, `versioning-gallery-b.html`, `versioning-gallery-c.html`
- ✅ `workflow-version.html`
- ✅ `theme-comparison-11.html`, `theme-comparison-expanded.html`

#### Already Organized
- ✅ `docs/plan/*`
- ✅ `docs/training-manuals/*`
