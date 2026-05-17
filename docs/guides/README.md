# RedfireForge User Guides

Welcome to the RedfireForge documentation. These guides cover all features of the application.

## Quick Links

- **New to RedfireForge?** Start with [Getting Started](./getting-started.md)
- **Running tests?** See [Test Runner Guide](./test-runner-guide.md)
- **Building workflows?** Check [Workflow Designer Guide](./workflow-designer-guide.md)
- **Using CLI?** Read [CLI Reference](./cli-reference.md)

---

## Core Guides (Essential)

### Getting Started

| Guide | Description |
|-------|-------------|
| [Getting Started](./getting-started.md) | First-time setup, UI tour, your first test in 5 minutes |
| [Concepts Overview](./concepts-overview.md) | Key concepts: environments, microservices, scenarios, workflows |

### Requests & Collections

| Guide | Description |
|-------|-------------|
| [Requests Guide](./requests-guide.md) | Creating requests, organizing collections, folders |
| [Request Editor Guide](./request-editor-guide.md) | Headers, body types, query params, path variables |
| [Request Auth Guide](./request-auth-guide.md) | Auth types (Basic, Bearer, API Key, OAuth2), global profiles |
| [Request Variables Guide](./request-variables-guide.md) | Variable syntax, environment variables, extraction |

### Scenarios & Testing

| Guide | Description |
|-------|-------------|
| [Scenarios Guide](./scenarios-guide.md) | Creating feature groups, scenarios, tests |
| [Test Runner Guide](./test-runner-guide.md) | Running tests, execution modes, concurrency |
| [Parameterized Testing Guide](./parameterized-testing-guide.md) | Data sources, CSV/JSON import, variable substitution |
| [Assertions Guide](./assertions-guide.md) | Assertion types, JSONPath, regex, custom assertions |
| [Validation Modes Guide](./validation-modes-guide.md) | None, selective, full validation modes |
| [Data Mapper Validation Guide](./data-mapper-validation-guide.md) | Visual validation with 24 operators, array assertions, DSL rules, live verification, ASSERT expressions |
| [Shared Data Sources Guide](./shared-data-sources-guide.md) | Creating and using shared data sources |

### Workflow Designer

| Guide | Description |
|-------|-------------|
| [Workflow Designer Guide](./workflow-designer-guide.md) | Canvas basics, adding nodes, connecting edges |
| [Workflow Nodes Reference](./workflow-nodes-reference.md) | All node types: HTTP, Condition, Delay, Fork, Join, Loop, etc. |
| [Workflow Variables Guide](./workflow-variables-guide.md) | Workflow variables, extraction, chaining |
| [Workflow Services Guide](./workflow-services-guide.md) | Service registry, multi-environment URLs, auth |
| [Workflow Debugging Guide](./workflow-debugging-guide.md) | Debug mode, step-through, console |
| [Workflow Triggers Guide](./workflow-triggers-guide.md) | Webhook triggers, schedule triggers |
| [Workflow Runner Guide](./workflow-runner-guide.md) | Running workflows as performance tests |

### Results & Analysis

| Guide | Description |
|-------|-------------|
| [Results Guide](./results-guide.md) | Results dashboard, metrics, filtering, export |
| [Results Explorer Guide](./results-explorer-guide.md) | Visual workflow execution analysis: diagram, detail panel, iteration matrix, search/filter, bottleneck analysis |
| [Results Comparison Guide](./results-comparison-guide.md) | Baseline comparison, trend analysis |
| [Results Export Guide](./results-export-guide.md) | JSON, CSV, Markdown, JUnit export formats |
| [Runners Comparison](./runners-comparison.md) | Test Runner vs Parameterized Runner vs Workflow Runner comparison |

### Configuration

| Guide | Description |
|-------|-------------|
| [Environments Guide](./environments-guide.md) | Creating environments, microservices, base URLs |
| [Global Auth Guide](./global-auth-guide.md) | Global auth profiles, inheritance |
| [Cross-Platform Guide](./cross-platform.md) | Desktop vs Web platform differences |

### API Catalog

| Guide | Description |
|-------|-------------|
| [Catalog Guide](./catalog-guide.md) | Importing OpenAPI specs, browsing endpoints |
| [Catalog Import Guide](./catalog-import-guide.md) | Import from URL, file, Swagger 2.0 vs OpenAPI 3.x |

### Gallery & Training

| Guide | Description |
|-------|-------------|
| [Gallery Guide](./gallery-guide.md) | Browsing samples, importing, try-it |
| [Training Tracks Guide](./training-tracks-guide.md) | Using training tracks, progress tracking |

---

## Advanced & Reference Guides

### Versioning

| Guide | Description |
|-------|-------------|
| [Request Versioning Guide](./request-versioning-guide.md) | Request version history, diff view, restoring |
| [Test Versioning Guide](./test-versioning-guide.md) | Test definition history, diff, restore |
| [Workflow Versioning Guide](./workflow-versioning-guide.md) | Workflow version history, diff, restore |

### Advanced Workflow

| Guide | Description |
|-------|-------------|
| [Workflow Correlation Guide](./workflow-correlation-guide.md) | CorrelationWait, async patterns |
| [Workflow Scripts Guide](./workflow-scripts-guide.md) | Script nodes, JavaScript execution |
| [Workflow Sub-Workflows Guide](./workflow-sub-workflows-guide.md) | Sub-workflow nodes, composition |

### Reference

| Guide | Description |
|-------|-------------|
| [Keyboard Shortcuts](./keyboard-shortcuts.md) | Complete keyboard shortcut reference |
| [Preferences Guide](./preferences-guide.md) | Theme, settings, customization |

---

## CLI & Integration

| Guide | Description |
|-------|-------------|
| [CLI Reference](./cli-reference.md) | Complete command-line reference |
| [CLI CI/CD Guide](./cli-ci-cd.md) | Integrating with CI/CD pipelines |

---

## Guide Index by Topic

### For API Testing

1. [Getting Started](./getting-started.md) — First steps
2. [Requests Guide](./requests-guide.md) — Build requests
3. [Request Auth Guide](./request-auth-guide.md) — Configure auth
4. [Scenarios Guide](./scenarios-guide.md) — Organize tests
5. [Assertions Guide](./assertions-guide.md) — Validate responses
6. [Data Mapper Validation Guide](./data-mapper-validation-guide.md) — Visual validation with operators, DSL, and live verification
7. [Test Runner Guide](./test-runner-guide.md) — Run tests
8. [Results Guide](./results-guide.md) — Analyze results

### For Performance Testing

1. [Concepts Overview](./concepts-overview.md) — Understand concepts
2. [Test Runner Guide](./test-runner-guide.md) — Execution modes
3. [Parameterized Testing Guide](./parameterized-testing-guide.md) — Data-driven tests
4. [Results Guide](./results-guide.md) — Metrics and analysis
5. [Results Explorer Guide](./results-explorer-guide.md) — Visual execution analysis
6. [CLI Reference](./cli-reference.md) — Automated testing

### For Workflow Testing

1. [Workflow Designer Guide](./workflow-designer-guide.md) — Build workflows
2. [Workflow Nodes Reference](./workflow-nodes-reference.md) — Node types
3. [Workflow Runner Guide](./workflow-runner-guide.md) — Performance test workflows
4. [Results Explorer Guide](./results-explorer-guide.md) — Visual execution analysis
5. [Runners Comparison](./runners-comparison.md) — When to use which

### For CI/CD Integration

1. [CLI Reference](./cli-reference.md) — Command reference
2. [CLI CI/CD Guide](./cli-ci-cd.md) — Pipeline integration
3. [Cross-Platform Guide](./cross-platform.md) — Platform options

---

## Additional Resources

### Training

- **Gallery → Training Tracks** — Step-by-step tutorials in the app
- **Gallery → Samples** — Pre-built examples to import

### Support

- **GitHub Issues** — Report bugs and request features
- **Documentation Source** — `docs/guides/` in the repository

---

## Contributing to Guides

Found an issue or want to improve a guide?

1. Edit the markdown file in `docs/guides/`
2. Follow the template structure
3. Submit a pull request

### Guide Template

```markdown
# [Feature] Guide

Brief description of what this guide covers.

## Overview
- What is [Feature]?
- When to use it
- Key concepts

## Getting Started
- Prerequisites
- Step-by-step first use

## [Main Topic 1]
### Subtopic
### Subtopic

## [Main Topic 2]
...

## Tips & Best Practices
- Common patterns
- Performance considerations
- Gotchas to avoid

## Related Guides
- Link to related guides
```
