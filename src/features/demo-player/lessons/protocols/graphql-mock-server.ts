/** Lesson GQL-13: Mock Server */
import type { DemoLesson } from '../../types';
import { GQL } from '../../../../shared/selectors';
import {
  GQL_DEMO_HEALTH,
  GQL_DEMO_HTTP,
  GQL_MOCK_HTTP,
  LESSON13_HEALTH_OVERRIDE,
  ensureLesson13HealthOverrideConfigured,
  ensureLesson13LatencyDemo,
  ensureLesson13MockDisabledAndRestored,
  ensureLesson13MockEnabled,
  ensureLesson13MockEndpointIntrospected,
  ensureLesson13MockExecuted,
  ensureLesson13MockPanelOpen,
  gqlMockServerLessonCleanup,
  gqlMockServerLessonSetup,
} from './graphql-lesson-helpers';

export const gqlMockServerLesson: DemoLesson = {
  id: 'gql-mock-server',
  domainId: 'protocols',
  category: 'graphql',
  name: 'Mock Server',
  description:
    'Enable the desktop GraphQL mock proxy, override `Query.health`, simulate latency, and restore the live Docker endpoint.',
  estimatedMinutes: 3,
  initialTab: 'graphql-studio',
  allowedTabs: ['graphql-studio'],

  dockerEndpoint: GQL_DEMO_HEALTH,
  dockerCommand: 'cd docker/graphql && docker compose up -d',
  tag: '🐳 Docker',

  setup: gqlMockServerLessonSetup,
  cleanup: gqlMockServerLessonCleanup,

  concept: {
    title: 'Desktop Mock Proxy',
    body: `GraphQL Studio includes a **desktop-only mock proxy** that can stand in for a live server while preserving the same GraphQL workflow:

1. **Introspect** a real schema first so the mock knows the contract
2. **Enable Mock mode** in the Mock activity panel
3. **Point the editor** at \`${GQL_MOCK_HTTP}\`
4. **Override resolvers** such as \`Query.health\` with fixed values, scripts, or errors
5. **Add latency** to simulate slow upstream services
6. **Disable Mock mode** and switch back to the live endpoint (\`${GQL_DEMO_HTTP}\`)

Because the proxy runs inside the Tauri desktop app, the web build shows a guard instead of the interactive mock controls. This lesson is meant to be played in the desktop app.`,
    keyTerms: [
      {
        term: 'Mock mode',
        definition:
          'Desktop proxy mode that serves GraphQL responses from your configured SDL + resolver overrides instead of a live upstream.',
      },
      {
        term: 'Resolver override',
        definition:
          'Per-field behavior override such as Random, Fixed, Script, or Error. This lesson sets `Query.health` to a fixed string.',
      },
      {
        term: 'Schema source',
        definition:
          'The SDL the mock server uses to build its schema. The default is the latest introspected schema from the live server.',
      },
      {
        term: 'Latency simulation',
        definition:
          'Global delay added by the mock proxy so you can test slow responses and UI timing without changing a real backend.',
      },
    ],
    diagram: `<svg viewBox="0 0 420 120" xmlns="http://www.w3.org/2000/svg">
  <rect x="15" y="28" width="70" height="64" rx="6" fill="var(--surface)" stroke="var(--border)" stroke-width="1.5"/>
  <text x="50" y="52" text-anchor="middle" fill="var(--text)" font-size="9" font-weight="600">Mock</text>
  <text x="50" y="68" text-anchor="middle" fill="var(--text-muted)" font-size="8">enable</text>
  <rect x="95" y="28" width="75" height="64" rx="6" fill="var(--primary)" opacity="0.15" stroke="var(--primary)" stroke-width="1.5"/>
  <text x="132" y="52" text-anchor="middle" fill="var(--text)" font-size="9" font-weight="600">Endpoint</text>
  <text x="132" y="68" text-anchor="middle" fill="var(--text-muted)" font-size="8">:3001/mock</text>
  <rect x="180" y="28" width="70" height="64" rx="6" fill="var(--accent)" opacity="0.15" stroke="var(--accent)" stroke-width="1.5"/>
  <text x="215" y="52" text-anchor="middle" fill="var(--text)" font-size="9" font-weight="600">Resolver</text>
  <text x="215" y="68" text-anchor="middle" fill="var(--text-muted)" font-size="8">Fixed value</text>
  <rect x="260" y="28" width="65" height="64" rx="6" fill="var(--warning)" opacity="0.15" stroke="var(--warning)" stroke-width="1.5"/>
  <text x="292" y="52" text-anchor="middle" fill="var(--text)" font-size="9" font-weight="600">Latency</text>
  <text x="292" y="68" text-anchor="middle" fill="var(--text-muted)" font-size="8">650 ms</text>
  <rect x="335" y="28" width="70" height="64" rx="6" fill="var(--success)" opacity="0.15" stroke="var(--success)" stroke-width="1.5"/>
  <text x="370" y="52" text-anchor="middle" fill="var(--text)" font-size="8">Restore</text>
  <text x="370" y="66" text-anchor="middle" fill="var(--text-muted)" font-size="7">live API</text>
  <text x="210" y="108" text-anchor="middle" fill="var(--text-muted)" font-size="9">Protocols → GraphQL → Mock Server</text>
</svg>`,
  },

  steps: [
    {
      id: 'gql13-open-mock',
      title: 'Open the Mock Panel',
      description:
        'Click the **Mock** activity icon on the left. In the desktop app this opens the GraphQL mock proxy controls; in the web build the panel shows a desktop-only guard instead.',
      highlight: GQL.ACTIVITY_MOCK,
      preAction: async (ctx) => {
        await ctx.waitFor(GQL.ACTIVITY_MOCK, 5000);
      },
      action: async (ctx) => {
        await ensureLesson13MockPanelOpen(ctx);
      },
      verify: GQL.MOCK_PANEL,
      pauseAfter: true,
    },

    {
      id: 'gql13-enable-mock',
      title: 'Enable Mock Mode',
      description:
        'Toggle **Mock mode ON**. The mock proxy now uses the currently introspected schema as its contract, and the status row appears with a **MOCK** badge.',
      highlight: GQL.MOCK_TOGGLE,
      preAction: ensureLesson13MockPanelOpen,
      action: async (ctx) => {
        await ensureLesson13MockEnabled(ctx);
      },
      verify: GQL.MOCK_STATUS_ROW,
      pauseAfter: true,
    },

    {
      id: 'gql13-switch-endpoint',
      title: 'Point the Editor at the Mock URL',
      description:
        `Set the connection bar endpoint to \`${GQL_MOCK_HTTP}\`, then click **Introspect**. The mock proxy now becomes the active GraphQL server for editor execution and schema browsing.`,
      highlight: GQL.ENDPOINT_INPUT,
      preAction: ensureLesson13MockEnabled,
      action: async (ctx) => {
        await ensureLesson13MockEndpointIntrospected(ctx);
      },
      verify: GQL.SCHEMA_BADGE_OK,
      pauseAfter: true,
    },

    {
      id: 'gql13-override-health',
      title: 'Override Query.health',
      description:
        `The **Resolvers** tab is already the default view. Expand **Query**, change the health field from **Random** to **Fixed**, and store the JSON string \`"${LESSON13_HEALTH_OVERRIDE}"\` so the proxy always returns the same value.`,
      highlight: GQL.MOCK_RESOLVERS_LIST,
      preAction: ensureLesson13MockEnabled,
      action: async (ctx) => {
        await ensureLesson13HealthOverrideConfigured(ctx);
      },
      verify: GQL.MOCK_FIXED_INPUT,
      pauseAfter: true,
    },

    {
      id: 'gql13-execute-mock',
      title: 'Execute Against the Mock',
      description:
        'Run `query { health }` against the mock endpoint. The response body now comes from your override, so you should see `mock-ok` instead of the live server’s default `ok`.',
      highlight: GQL.EXECUTE_BTN,
      preAction: ensureLesson13HealthOverrideConfigured,
      action: async (ctx) => {
        await ensureLesson13MockExecuted(ctx);
      },
      verify: GQL.RESPONSE_BODY,
      pauseAfter: true,
    },

    {
      id: 'gql13-latency',
      title: 'Simulate Slow Responses',
      description:
        'Drag the **Latency (ms)** slider in the Mock panel to about **650 ms**, then execute again. The response still returns `mock-ok`, but the response latency indicator rises to reflect the artificial delay.',
      highlight: GQL.MOCK_LATENCY_SLIDER,
      preAction: ensureLesson13MockExecuted,
      action: async (ctx) => {
        await ensureLesson13LatencyDemo(ctx);
      },
      verify: GQL.RESPONSE_LATENCY,
      pauseAfter: true,
    },

    {
      id: 'gql13-restore-live',
      title: 'Restore the Live Server',
      description:
        `Turn **Mock mode OFF**, switch the endpoint back to \`${GQL_DEMO_HTTP}\`, re-introspect, and execute one more time. The response returns to the live Docker server value: \`ok\`.`,
      highlight: GQL.MOCK_TOGGLE,
      preAction: ensureLesson13LatencyDemo,
      action: async (ctx) => {
        await ensureLesson13MockDisabledAndRestored(ctx);
      },
      verify: GQL.RESPONSE_BODY,
      pauseAfter: true,
    },
  ],
};
