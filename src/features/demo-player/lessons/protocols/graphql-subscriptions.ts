/** Lesson GQL-5: Subscriptions — Real-Time Data */
import type { DemoLesson } from '../../types';
import { GQL } from '../../../../shared/selectors';
import {
  GQL_CREATE_ORDER_MUTATION,
  GQL_CREATE_ORDER_VARS,
  GQL_DEMO_HTTP,
  GQL_DEMO_HEALTH,
  GQL_ORDER_STATUS_SUBSCRIPTION,
  ensureAssertionAdded,
  ensureDemoEndpoint,
  ensureDemoOrderCreated,
  ensureIntrospected,
  ensurePauseResumeDemo,
  ensureSubscriptionQueryWritten,
  ensureSubscriptionVars,
  ensureSubscribedWithMessages,
  ensureVariablesPanelOpen,
  ensureWsTransport,
  fillGqlEditor,
  fillGqlVariables,
  getLesson5OrderId,
  gqlSubscriptionsLessonCleanup,
  gqlSubscriptionsLessonSetup,
  parseCreatedOrderIdFromResponse,
  storeCreatedOrderIdFromResponse,
} from './graphql-lesson-helpers';

export const gqlSubscriptionsLesson: DemoLesson = {
  id: 'gql-subscriptions',
  domainId: 'protocols',
  category: 'graphql',
  name: 'Subscriptions — Real-Time Data',
  description:
    'Subscribe to live GraphQL events over WebSocket, watch the message log, pause and filter streams, add assertions, and disconnect.',
  estimatedMinutes: 4,
  initialTab: 'graphql-studio',
  allowedTabs: ['graphql-studio'],

  dockerEndpoint: GQL_DEMO_HEALTH,
  dockerCommand: 'cd docker/graphql && docker compose up -d',
  tag: '🐳 Docker',

  setup: gqlSubscriptionsLessonSetup,
  cleanup: gqlSubscriptionsLessonCleanup,

  concept: {
    title: 'GraphQL Subscriptions',
    body: `**Subscriptions** let the server push data to the client over a persistent connection — usually **WebSocket** — instead of polling with queries.

In GraphQL Studio:
1. Write a \`subscription { … }\` operation — the tab badge shows **S** and **Execute** becomes **Subscribe**
2. Click **Subscribe** — the right panel switches to a **live message log**
3. **Pause** buffers incoming events; **Filter** narrows the log; **Assertions** validate each message in real time
4. **Stop** ends the session — the log stays visible for review

This lesson uses \`orderStatus(orderId: ID!)\` on the Docker test server (port **4010**). You need a real order id from \`createOrder\` first. This is **GraphQL Studio** UI — not the separate \`ws-graphql\` protocol lesson on port 4100.`,
    keyTerms: [
      {
        term: 'Subscription',
        definition:
          'A GraphQL operation that streams events from server to client. Declared with `subscription OperationName { … }`.',
      },
      {
        term: 'WebSocket transport',
        definition:
          'Persistent bidirectional connection. GraphQL Studio uses `graphql-transport-ws` (modern) by default on `ws://host/graphql`.',
      },
      {
        term: 'Message log',
        definition:
          'Live panel listing each subscription payload with index, direction, offset, and expandable JSON body.',
      },
      {
        term: 'Subscription assertion',
        definition:
          'JSONPath rule evaluated against every incoming message — pass/fail badges appear on each log row.',
      },
    ],
    diagram: `<svg viewBox="0 0 420 120" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <marker id="gql5-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
      <path d="M0,0 L0,6 L8,3 z" fill="var(--primary)"/>
    </marker>
  </defs>
  <rect x="10" y="35" width="80" height="50" rx="6" fill="var(--primary)" opacity="0.15" stroke="var(--primary)" stroke-width="1.5"/>
  <text x="50" y="55" text-anchor="middle" fill="var(--text)" font-size="9" font-weight="600">createOrder</text>
  <text x="50" y="70" text-anchor="middle" fill="var(--text-muted)" font-size="8">ord-N</text>
  <line x1="90" y1="60" x2="115" y2="60" stroke="var(--primary)" stroke-width="1.5" marker-end="url(#gql5-arrow)"/>
  <rect x="115" y="35" width="80" height="50" rx="6" fill="var(--accent)" opacity="0.2" stroke="var(--accent)" stroke-width="1.5"/>
  <text x="155" y="55" text-anchor="middle" fill="var(--text)" font-size="9" font-weight="600">Subscribe</text>
  <text x="155" y="70" text-anchor="middle" fill="var(--text-muted)" font-size="8">WebSocket</text>
  <line x1="195" y1="60" x2="220" y2="60" stroke="var(--primary)" stroke-width="1.5" marker-end="url(#gql5-arrow)"/>
  <rect x="220" y="25" width="95" height="70" rx="6" fill="var(--surface)" stroke="var(--border)" stroke-width="1.5"/>
  <text x="267" y="48" text-anchor="middle" fill="var(--text)" font-size="8">PENDING</text>
  <text x="267" y="62" text-anchor="middle" fill="var(--text)" font-size="8">PROCESSING</text>
  <text x="267" y="76" text-anchor="middle" fill="var(--success)" font-size="8">COMPLETE</text>
  <line x1="315" y1="60" x2="340" y2="60" stroke="var(--primary)" stroke-width="1.5" marker-end="url(#gql5-arrow)"/>
  <rect x="340" y="35" width="70" height="50" rx="6" fill="var(--primary)" opacity="0.1" stroke="var(--primary)" stroke-width="1.5"/>
  <text x="375" y="58" text-anchor="middle" fill="var(--text)" font-size="9" font-weight="600">Stop</text>
  <text x="375" y="72" text-anchor="middle" fill="var(--text-muted)" font-size="8">log kept</text>
  <text x="210" y="108" text-anchor="middle" fill="var(--text-muted)" font-size="9">Protocols → GraphQL → Subscriptions</text>
</svg>`,
  },

  steps: [
    {
      id: 'gql5-intro',
      title: 'Subscription Operations',
      description:
        '**Subscriptions** stream server events to your browser over WebSocket. When the editor contains a `subscription` block, the operation badge shows **S** (purple) and the connection bar offers **Subscribe** instead of Execute. The right panel becomes a live message log while a session is active.',
      highlight: GQL.TAB_BAR,
      pauseAfter: true,
    },

    {
      id: 'gql5-endpoint',
      title: 'Connect & Introspect',
      description:
        `Point at \`${GQL_DEMO_HTTP}\` and click **Introspect** so the \`Subscription\` type (\`orderStatus\`) appears in the schema. WebSocket uses the same host — \`ws://localhost:4010/graphql\`.`,
      highlight: GQL.CONNECTION_BAR,
      preAction: async (ctx) => {
        await ctx.waitFor(GQL.ENDPOINT_INPUT, 5000);
      },
      action: async (ctx) => {
        await ctx.fill(GQL.ENDPOINT_INPUT, GQL_DEMO_HTTP);
        await ctx.delay(500);
        if (!document.querySelector(GQL.SCHEMA_BADGE_OK)) {
          await ctx.click(GQL.INTROSPECT_BTN);
          await ctx.waitFor(GQL.SCHEMA_BADGE_OK, 25000);
        }
        await ctx.delay(1500);
      },
      verify: GQL.SCHEMA_BADGE_OK,
      pauseAfter: true,
    },

    {
      id: 'gql5-create-order',
      title: 'Create an Order First',
      description:
        'The `orderStatus` subscription requires a real `orderId`. Run **createOrder** (same pattern as Lesson 3):\n\n`mutation CreateOrder($input: OrderInput!) { createOrder(input: $input) { id status } }`\n\nCapture `data.createOrder.id` — you will pass it as the `$orderId` variable.',
      highlight: GQL.EDITOR,
      preAction: async (ctx) => {
        await ensureDemoEndpoint(ctx);
        await ensureIntrospected(ctx);
      },
      action: async (ctx) => {
        await ctx.click(GQL.MODE_EDITOR);
        await ctx.waitFor(`${GQL.EDITOR} .monaco-editor`, 8000);
        await ctx.delay(600);
        await fillGqlEditor(ctx, GQL_CREATE_ORDER_MUTATION);
        await ctx.delay(500);
        await ensureVariablesPanelOpen(ctx);
        await fillGqlVariables(ctx, GQL_CREATE_ORDER_VARS);
        await ctx.delay(400);
        await ctx.click(GQL.RIGHT_TAB_RESPONSE);
        await ctx.delay(200);
        await ctx.click(GQL.EXECUTE_BTN);
        await ctx.waitFor(GQL.RESPONSE_VIEWER, 15000);
        storeCreatedOrderIdFromResponse();
        await ctx.delay(700);
      },
      verify: GQL.RESPONSE_BODY,
      pauseAfter: true,
    },

    {
      id: 'gql5-write-sub',
      title: 'Write the Subscription',
      description:
        'Replace the mutation with an **orderStatus** subscription:\n\n`subscription OrderUpdates($orderId: ID!) { orderStatus(orderId: $orderId) { status updatedAt } }`\n\nWatch the tab badge switch to **S**. Set transport to **WS (modern)** if needed.',
      highlight: GQL.EDITOR,
      preAction: ensureDemoOrderCreated,
      action: async (ctx) => {
        await fillGqlEditor(ctx, GQL_ORDER_STATUS_SUBSCRIPTION);
        await ctx.delay(500);
        await ensureWsTransport(ctx);
        const orderId = getLesson5OrderId() || parseCreatedOrderIdFromResponse() || '';
        if (orderId) {
          await ensureVariablesPanelOpen(ctx);
          await fillGqlVariables(ctx, JSON.stringify({ orderId }, null, 2));
        }
        await ctx.delay(600);
      },
      pauseAfter: true,
    },

    {
      id: 'gql5-subscribe',
      title: 'Subscribe',
      description:
        'Click **Subscribe** — status moves from Connecting to **Live**. The right panel shows the subscription log with transport badge (WS) and a running message counter.',
      highlight: GQL.SUBSCRIBE_BTN,
      preAction: ensureSubscriptionVars,
      action: async (ctx) => {
        await ctx.click(GQL.RIGHT_TAB_RESPONSE);
        await ctx.delay(200);
        await ctx.click(GQL.SUBSCRIBE_BTN);
        await ctx.waitFor(GQL.SUBSCRIPTION_LOG, 15000);
        await ctx.waitFor(GQL.WS_STATUS, 10000);
        await ctx.delay(1500);
      },
      verify: GQL.SUBSCRIPTION_LOG,
      pauseAfter: true,
    },

    {
      id: 'gql5-watch-log',
      title: 'Watch the Live Log',
      description:
        'The test server emits three status updates about **300ms** apart: **PENDING** → **PROCESSING** → **COMPLETE**. Each row shows message index, direction (IN), offset, and a JSON snippet — click a row to expand the full payload.',
      highlight: GQL.SUBSCRIPTION_MSG_LIST,
      preAction: ensureSubscribedWithMessages,
      action: async (ctx) => {
        await ctx.waitFor(GQL.SUBSCRIPTION_MSG_LIST, 5000);
        await ctx.delay(2000);
      },
      verify: GQL.SUBSCRIPTION_ROW,
      pauseAfter: true,
    },

    {
      id: 'gql5-pause',
      title: 'Pause & Resume',
      description:
        'Click **Re-subscribe**, then immediately **Pause** — incoming messages buffer without scrolling the log. Click **Resume** to flush buffered events. Useful when inspecting a burst of events without losing data.',
      highlight: GQL.SUBSCRIPTION_PAUSE_BTN,
      preAction: ensureSubscribedWithMessages,
      action: async (ctx) => {
        const subscribeBtn = document.querySelector<HTMLButtonElement>(GQL.SUBSCRIBE_BTN);
        if (subscribeBtn && !subscribeBtn.disabled) {
          await ctx.click(GQL.SUBSCRIBE_BTN);
          await ctx.waitFor(GQL.SUBSCRIPTION_LOG, 15000);
          await ctx.delay(200);
        }
        const pauseBtn = document.querySelector(GQL.SUBSCRIPTION_PAUSE_BTN);
        if (pauseBtn) {
          await ctx.click(GQL.SUBSCRIPTION_PAUSE_BTN);
          await ctx.delay(1200);
          const resumeBtn = document.querySelector(GQL.SUBSCRIPTION_RESUME_BTN);
          if (resumeBtn) {
            await ctx.click(GQL.SUBSCRIPTION_RESUME_BTN);
            await ctx.delay(1500);
          }
        } else {
          await ensurePauseResumeDemo(ctx);
        }
      },
      pauseAfter: true,
    },

    {
      id: 'gql5-filter',
      title: 'Filter the Log',
      description:
        'Open the **Filter** toolbar button and type `COMPLETE` in text mode — only rows whose JSON body contains that substring remain visible. The counter shows how many messages match (e.g. "Showing 1/N").',
      highlight: GQL.SUBSCRIPTION_FILTER_BTN,
      preAction: ensureSubscribedWithMessages,
      action: async (ctx) => {
        if (!document.querySelector(GQL.SUBSCRIPTION_FILTER_BAR)) {
          await ctx.click(GQL.SUBSCRIPTION_FILTER_BTN);
          await ctx.waitFor(GQL.SUBSCRIPTION_FILTER_BAR, 5000);
          await ctx.delay(600);
        }
        await ctx.fill(GQL.SUBSCRIPTION_FILTER_INPUT, 'COMPLETE');
        await ctx.delay(800);
      },
      verify: GQL.SUBSCRIPTION_FILTER_BAR,
      pauseAfter: true,
    },

    {
      id: 'gql5-assertions',
      title: 'Subscription Assertions',
      description:
        'Below the editor, open the **Assertions** panel → **Add**. Set JSONPath `$.orderStatus.status`, operator **equals**, expected value `COMPLETE`. On the next subscribe, each message row shows a pass/fail badge.',
      highlight: GQL.ASSERTION_PANEL,
      preAction: ensureSubscriptionQueryWritten,
      action: async (ctx) => {
        await ensureAssertionAdded(ctx);
        await ctx.delay(800);
      },
      verify: GQL.ASSERTION_ROW,
      pauseAfter: true,
    },

    {
      id: 'gql5-disconnect',
      title: 'Stop the Subscription',
      description:
        'Click **Stop** on the connection bar (or **Stop** in the log toolbar) to end the WebSocket session. The message log **stays visible** so you can review captured events after disconnect.',
      highlight: GQL.STOP_SUB_BTN,
      preAction: ensureAssertionAdded,
      action: async (ctx) => {
        const subscribeBtn = document.querySelector<HTMLButtonElement>(GQL.SUBSCRIBE_BTN);
        if (subscribeBtn && !subscribeBtn.disabled) {
          await ctx.click(GQL.SUBSCRIBE_BTN);
          await ctx.waitFor(GQL.SUBSCRIPTION_LOG, 15000);
          await ctx.delay(400);
        }
        const stopBar = document.querySelector(GQL.STOP_SUB_BTN);
        const stopLog = document.querySelector(GQL.SUB_STOP_BTN);
        if (stopBar) {
          await ctx.click(GQL.STOP_SUB_BTN);
        } else if (stopLog) {
          await ctx.click(GQL.SUB_STOP_BTN);
        }
        await ctx.delay(800);
        await ctx.waitFor(GQL.SUBSCRIPTION_LOG, 5000);
        await ctx.delay(700);
      },
      verify: GQL.SUBSCRIPTION_LOG,
      pauseAfter: true,
    },
  ],
};
