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
 *   graphql-test-server → Apollo Server 4 GraphQL test server (port 4010)
 *   graphql-* (live)    → GraphQL Studio live E2E against port 4010
 *
 * GraphQL Studio live specs skip automatically when port 4010 is down.
 * Run with server up:
 *   cd docker/graphql && docker compose up -d
 *   E2E_GRAPHQL_SERVER=1 npx playwright test e2e/graphql-subscriptions.spec.ts
 *   cd docker/kafka/basic    && docker compose up -d   # kafka-live
 *   cd docker/kafka/secure   && docker compose up -d   # kafka-secure
 *   cd docker/kafka/tls      && docker compose up -d   # kafka-tls
 *   cd docker/websocket      && docker compose up -d   # ws-protocols-*
 *   cd docker/websocket/tls  && docker compose up -d   # ws-tls-local-demo
 *   cd docker/graphql        && docker compose up -d   # graphql-test-server (4010)
 *
 * Or let global-setup start the GraphQL server automatically:
 *   E2E_WITH_DOCKER=1 npx playwright test --project=docker
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
  '**/graphql-test-server.spec.ts',
];

/** GraphQL Studio live E2E — need port 4010 (skip in spec when server down). */
const GRAPHQL_LIVE_SPECS = [
  '**/graphql-subscriptions.spec.ts',
  '**/graphql-schema-explorer.spec.ts',
  '**/graphql-query-builder.spec.ts',
  '**/graphql-code-gen.spec.ts',
];

const ALL_DOCKER_SPECS = DOCKER_SPECS;

/**
 * Step-through demo specs — excluded from the default run.
 *
 * These specs walk through individual lesson steps to validate specific
 * bug fixes (e.g. node deselection before config modal opens). They are
 * too slow (~60 s per test) for the standard suite and are only run when
 * actively working on demo lessons.
 *
 * Run them directly:
 *   npx playwright test e2e/demo-ws-workflow-builder.spec.ts --reporter=html
 *   npx playwright test e2e/demo-stepthrough-*.spec.ts --reporter=html
 *
 * Naming convention: any new per-lesson step-through spec must be named
 *   demo-{protocol}-{lesson-slug}.spec.ts
 * so the glob below picks it up automatically.
 */
const DEMO_STEPTHROUGH_SPECS = [
  '**/demo-ws-workflow-builder.spec.ts',
  // Future per-lesson step-through specs follow the same naming pattern:
  // '**/demo-kafka-consume.spec.ts',
  // '**/demo-sse-advanced.spec.ts',
];

const withDocker = process.env.E2E_WITH_DOCKER === '1';
const withGraphqlServer = process.env.E2E_GRAPHQL_SERVER === '1';

export default defineConfig({
  testDir: './e2e',
  // Starts graphql-test-server (port 4010) when Docker E2E is enabled.
  globalSetup: withDocker || withGraphqlServer ? './e2e/global-setup.ts' : undefined,
  globalTeardown: withDocker || withGraphqlServer ? './e2e/global-teardown.ts' : undefined,
  fullyParallel: false,
  retries: 2,
  // Favor deterministic full-suite runs over maximal parallel throughput.
  // 2 local workers prevents dev-server overload that causes .app-header timeouts.
  workers: process.env.CI ? 12 : 2,
  // 45s default gives breathing room under parallel load.
  timeout: 45_000,
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
      testIgnore: ['**/ws-mock-server.spec.ts', ...ALL_DOCKER_SPECS, ...DEMO_STEPTHROUGH_SPECS],
      use: { browserName: 'chromium' },
    },

    // ── ws-mock-server: isolated because it depends on the chromium baseline ─
    {
      name: 'ws-mock-server',
      testMatch: '**/ws-mock-server.spec.ts',
      use: { browserName: 'chromium' },
      dependencies: ['chromium'],
    },

    // ── Docker project: active when E2E_WITH_DOCKER=1 or E2E_GRAPHQL_SERVER=1 ─
    // Run: E2E_WITH_DOCKER=1 npx playwright test --project=docker
    // Or:  E2E_GRAPHQL_SERVER=1 npx playwright test e2e/graphql-test-server.spec.ts
    ...(withDocker || withGraphqlServer
      ? [
          {
            name: 'docker',
            testMatch: withDocker ? ALL_DOCKER_SPECS : ['**/graphql-test-server.spec.ts', ...GRAPHQL_LIVE_SPECS],
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
