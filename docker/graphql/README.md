# GraphQL Test Server (port 4010)

Apollo Server 4 test server for GraphQL Studio E2E tests and manual workflow scenarios (task 4F-11).

## Quick start

```bash
docker compose up -d
curl http://localhost:4010/health
```

## Endpoints

| Endpoint | URL |
|---|---|
| GraphQL HTTP | `http://localhost:4010/graphql` |
| GraphQL WS | `ws://localhost:4010/graphql` |
| Health | `http://localhost:4010/health` |

## Schema

- `Query.user(id)` / `Query.health`
- `Mutation.createUser` / `Mutation.createOrder` / `Mutation.deleteUser`
- `Subscription.orderStatus(orderId)` — emits PENDING → PROCESSING → COMPLETE (~2s apart; set `ORDER_STATUS_STEP_MS=300` for faster streams)

## Features

- Apollo Tracing v1 (`extensions.tracing`)
- APQ (Automatic Persisted Queries)
- CORS enabled
- `@faker-js/faker` for generated user defaults

## E2E integration

Playwright `global-setup` starts this server automatically when `E2E_WITH_DOCKER=1` or `E2E_GRAPHQL_SERVER=1`:

```bash
E2E_GRAPHQL_SERVER=1 npx playwright test e2e/graphql-test-server.spec.ts --reporter=list
```

## Local dev (without Docker)

```bash
npm install --omit=dev
PORT=4010 node server.js
```
