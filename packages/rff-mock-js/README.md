# @redfireforge/mock-jest

Jest / Vitest global setup helpers for [RedfireForge](https://redfireforge.io) API Mock.
Start a mock server on a dynamic port before your test suite, inject its URL, stop it after.

## Installation

```bash
npm install --save-dev @redfireforge/mock-jest
```

Requires the `rff` CLI to be on `PATH` (or set `RFF_BINARY` env var).

## Usage — Jest

```ts
// jest.config.ts
export default {
  globalSetup:    './test/mock-setup.ts',
  globalTeardown: './test/mock-teardown.ts',
};

// test/mock-setup.ts
import { setup } from '@redfireforge/mock-jest';
export default () => setup({ definitionFile: 'mocks/orders.json' });

// test/mock-teardown.ts
import { teardown } from '@redfireforge/mock-jest';
export default teardown;
```

```ts
// orders.test.ts
test('returns orders', async () => {
  const res = await fetch(`${process.env.MOCK_BASE_URL}/orders`);
  expect(res.status).toBe(200);
});
```

## Usage — Vitest

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import { vitestSetup } from '@redfireforge/mock-jest/vitest';

const { setup } = vitestSetup({ definitionFile: 'mocks/orders.json' });

export default defineConfig({
  test: { globalSetup: [setup] },
});
```

## Direct usage

```ts
import { RffMockServer } from '@redfireforge/mock-jest';

const mock = await RffMockServer.start('mocks/orders.json');
console.log(mock.baseUrl);   // http://localhost:51432
console.log(mock.readyUrl);  // http://localhost:51432/__rff/health/ready
await mock.stop();
```

## Configuration options

```ts
await RffMockServer.start('mocks/orders.json', {
  rffBinary:      '/opt/rff/bin/rff',  // default: RFF_BINARY env var or 'rff'
  serverId:       'srv-orders',         // default: first/active server
  timeoutMs:      60_000,               // default: 30 000
  pollIntervalMs: 100,                  // default: 250
});
```

## Environment variables set by setup()

| Variable | Content |
|---|---|
| `MOCK_BASE_URL` | `http://localhost:<port>` |
| `MOCK_PORT` | The port number as a string |

Override the variable names via `baseUrlEnvVar` / `portEnvVar` options.

## Health probes

Every mock server exposes Kubernetes-compatible endpoints:

| Endpoint | Status | Meaning |
|---|---|---|
| `GET /__rff/health/live` | 200 | Server process is alive |
| `GET /__rff/health/ready` | 200 / 503 | Routes committed and ready to serve |
