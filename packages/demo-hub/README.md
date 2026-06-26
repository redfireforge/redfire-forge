# @redfireforge/demo-hub

Learning Hub package — demo lessons, hub UI, and product adapters.

## Layout

```
packages/demo-hub/src/
  adapters/     # Stable bridge API into GraphQL Studio, Workflow, Environment Manager
  lessons/      # Protocol lesson definitions (GraphQL, WS, Kafka, SSE, …)
  DemoHub.tsx   # Hub shell UI
  useDemoHub.ts # Lesson state machine
```

## Imports (app shell)

```typescript
import DemoHub from '@redfireforge/demo-hub/DemoHub';
import { useDemoHub } from '@redfireforge/demo-hub/useDemoHub';
```

## Cross-package aliases (demo-hub → app)

| Alias | Target |
|-------|--------|
| `@shared/*` | `src/shared/*` |
| `@graphql/*` | `src/features/graphql/*` |
| `@workflow/*` | `src/features/workflow/*` |

Configured in root `tsconfig.app.json`, `vite.config.ts`, and `vitest.config.ts`.

## Tests

```bash
npm run test:demo
```

Demo Vitest project globs: `packages/demo-hub/**/*.test.{ts,tsx}`.
