import { defineConfig } from '@playwright/test';

/**
 * Spec files that require Docker infrastructure to run.
 *
 * These are excluded from the default `chromium` project and only run when
 * the `E2E_WITH_DOCKER=1` environment variable is set (via the `docker`
 * project below).
 *
 * Docker stacks and the port they probe:
 *   kafka-live       → Redpanda plain (port 19093)
 *   kafka-secure     → Redpanda SASL/SCRAM-256 (port 19645)
 *   kafka-tls        → Redpanda TLS+SASL (port 19648)
 *   ws-protocols-*   → WebSocket echo servers (Socket.IO :3100, GraphQL :4100,
 *                        RabbitMQ STOMP :15674)
 *   ws-tls-local-demo → local TLS WebSocket stack
 *
 * To bring them up:
 *   cd docker/kafka/basic    && docker compose up -d   # kafka-live
 *   cd docker/kafka/secure   && docker compose up -d   # kafka-secure
 *   cd docker/kafka/tls      && docker compose up -d   # kafka-tls
 *   cd docker/websocket      && docker compose up -d   # ws-protocols-*
 *   cd docker/websocket/tls  && docker compose up -d   # ws-tls-local-demo
 */
const DOCKER_SPECS = [
  '**/kafka-live.spec.ts',
  '**/kafka-secure.spec.ts',
  '**/kafka-tls.spec.ts',
  '**/ws-protocols-console.spec.ts',
  '**/ws-protocols-graphql.spec.ts',
  '**/ws-protocols-socketio.spec.ts',
  '**/ws-protocols-stomp.spec.ts',
  '**/ws-tls-local-demo.spec.ts',
];

const withDocker = process.env.E2E_WITH_DOCKER === '1';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: 1,
  // Favor deterministic full-suite runs over maximal parallel throughput.
  workers: process.env.CI ? 12 : 4,
  // 30s default handles page reloads under high parallelism.
  timeout: 30_000,
  reporter: [
    ['html', { open: 'never' }],
    ['list'],
  ],
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
    screenshot: 'only-on-failure',
  },
  projects: [
    // ── Default project: standard UI tests, no Docker required ─────────────
    {
      name: 'chromium',
      // Exclude the dedicated ws-mock-server spec (has its own project below)
      // and all Docker-dependent specs.
      testIgnore: ['**/ws-mock-server.spec.ts', ...DOCKER_SPECS],
      use: { browserName: 'chromium' },
    },

    // ── ws-mock-server: isolated because it depends on the chromium baseline ─
    {
      name: 'ws-mock-server',
      testMatch: '**/ws-mock-server.spec.ts',
      use: { browserName: 'chromium' },
      dependencies: ['chromium'],
    },

    // ── Docker project: only active when E2E_WITH_DOCKER=1 ──────────────────
    // Run: E2E_WITH_DOCKER=1 npx playwright test --project=docker
    ...(withDocker
      ? [
          {
            name: 'docker',
            testMatch: DOCKER_SPECS,
            use: { browserName: 'chromium' as const },
          },
        ]
      : []),
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 15_000,
  },
});
