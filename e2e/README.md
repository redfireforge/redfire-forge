# E2E Tests

## Two categories

| Category | Description | When to run |
|---|---|---|
| **Standard** | UI-only tests, no external services beyond the dev server | Every PR / local dev |
| **Docker** | Require live Docker infrastructure (Kafka, WebSocket servers) | On demand / Docker CI job |

## Commands

### Standard (default) — no Docker needed

```bash
# Run all standard E2E tests
npm run test:e2e

# With headed browser (useful for debugging)
npm run test:e2e:headed

# Target a single spec
npx playwright test e2e/workflow.spec.ts --reporter=list
```

### Docker — requires live infrastructure

```bash
# Run only Docker-dependent tests
npm run test:e2e:docker

# With headed browser
npm run test:e2e:docker:headed

# Run everything (standard + Docker)
npm run test:e2e:all
```

### One-off with custom options

```bash
# Docker tests with higher timeout (useful when containers are slow to warm up)
E2E_WITH_DOCKER=1 npx playwright test --project=docker --timeout=60000 --reporter=list

# Single Docker spec
E2E_WITH_DOCKER=1 npx playwright test e2e/kafka-live.spec.ts --reporter=list
```

## Docker stacks

Each Docker test group documents its required compose file in the spec's header comment.
Quick reference:

| Spec file | Docker compose path | Key port |
|---|---|---|
| `kafka-live.spec.ts` | `docker/kafka/basic/docker-compose.yml` | 19093 |
| `kafka-secure.spec.ts` | `docker/kafka/secure/docker-compose.yml` | 19645 |
| `kafka-tls.spec.ts` | `docker/kafka/tls/docker-compose.yml` | 19648 |
| `ws-protocols-console.spec.ts` | `docker/websocket/docker-compose.all.yml` | 3100 |
| `ws-protocols-socketio.spec.ts` | `docker/websocket/socketio/docker-compose.yml` | 3100 |
| `ws-protocols-graphql.spec.ts` | `docker/websocket/graphql/docker-compose.yml` | 4100 |
| `ws-protocols-stomp.spec.ts` | `docker/websocket/stomp/docker-compose.yml` | 15674 |
| `ws-tls-local-demo.spec.ts` | `docker/websocket/tls/docker-compose.yml` | — |

## How it works

`playwright.config.ts` reads the `E2E_WITH_DOCKER` environment variable:

- **Not set (default)**: the `docker` project is not registered; all Docker specs are excluded
  from the `chromium` project via `testIgnore`.
- **`E2E_WITH_DOCKER=1`**: a `docker` project is registered and only Docker specs are matched.
  The `chromium` project still ignores them, so the two projects never overlap.

Individual test files also have runtime skip guards (`test.skip(!up, ...)`) that probe
infrastructure ports. These act as a safety net but are now secondary to the project-level
gating — you should never see unexpected skips in a normal run.
