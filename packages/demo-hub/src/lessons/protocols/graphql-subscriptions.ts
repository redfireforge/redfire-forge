/** Lesson GQL-7: Subscriptions — Real-Time Data */
import type { DemoLesson } from '../../types';
import { GQL } from '@shared/selectors';
import {
  GQL_CREATE_ORDER_MUTATION,
  GQL_CREATE_ORDER_VARS,
  GQL_DEMO_HTTP,
  GQL_DEMO_HEALTH,
  GQL_STUDIO_LESSON_ALLOWED_TABS,
  GQL_ORDER_STATUS_SUBSCRIPTION,
  configureDemoTabEndpointOverride,
  ensureAssertionAdded,
  demonstrateAssertionStream,
  prepareGql5DisconnectReading,
  ensurePauseResumeDemo,
  ensureSubscriptionQueryWritten,
  ensureSubscribedWithMessages,
  clickResubscribeAndWaitForLive,
  ensureVariablesPanelOpen,
  ensureWsTransport,
  fillGqlEditor,
  fillGqlVariables,
  getLesson5OrderId,
  gqlSubscriptionsLessonCleanup,
  gqlSubscriptionsLessonSetup,
  markSubscriptionQueryWritten,
  parseCreatedOrderIdFromResponse,
  prepareGql5ConnectionBarReading,
  prepareGql5CreateOrderReading,
  prepareGql5EndpointReading,
  prepareGql5ExecCreateOrderReading,
  prepareGql5IntroReading,
  prepareGql5ObserveCreateOrderReading,
  prepareGql5PauseReading,
  prepareGql5SubscriptionAuthReading,
  prepareGql5WriteSubReading,
  demonstrateSubscriptionAuthHandshake,
  ensureSubscriptionAuthConfigured,
  storeCreatedOrderIdFromResponse,
} from './graphql-lesson-helpers';

export const gqlSubscriptionsLesson: DemoLesson = {
  id: 'gql-subscriptions',
  domainId: 'protocols',
  category: 'graphql',
  name: 'Subscriptions — Real-Time Data',
  description:
    'Create an order, subscribe to its status over WebSocket, watch PENDING → COMPLETE events, then pause, filter, assert, and disconnect.',
  estimatedMinutes: 9,
  initialTab: 'graphql-studio',
  allowedTabs: GQL_STUDIO_LESSON_ALLOWED_TABS,
  /** Reserved demo tab slot — user workspace must stay untouched (§11.0). */
  tabBudget: 1,

  dockerEndpoint: GQL_DEMO_HEALTH,
  dockerCommand: 'cd docker/graphql && docker compose up -d',
  tag: '🐳 Docker',

  setup: gqlSubscriptionsLessonSetup,
  cleanup: gqlSubscriptionsLessonCleanup,

  concept: {
    title: 'GraphQL Subscriptions — Server-Push Events',
    body: `**Subscriptions** are GraphQL operations where the *server* initiates each message — the opposite of queries and mutations where the *client* sends a request and waits for a single response. They are the right tool when you need **real-time, server-initiated updates**: order status changes, price ticks, live dashboards, collaborative editing cursors.

**How they work under the hood:** GraphQL Studio opens a **WebSocket** connection to the server when you click Subscribe. The server sends messages whenever an event fires — each message is a complete GraphQL response object containing \`{ data: { subscriptionField: { ... } } }\`. The Studio renders each message as a row in the **live log panel**, replacing the single-response viewer used for queries and mutations.

**Transport protocols:** GraphQL subscriptions run over WebSocket, but two sub-protocols exist:
- \`graphql-transport-ws\` — the **modern standard** (RFC-aligned, recommended). Messages use \`subscribe\`, \`next\`, \`complete\` types.
- \`graphql-ws\` — the **legacy protocol** (older servers). Messages use \`start\`, \`data\`, \`stop\` types.

Choosing the wrong protocol causes a silent handshake failure — the connection appears to open but no messages arrive. GraphQL Studio's **Transport** dropdown lets you switch without touching code.

**Why the S badge matters:** When the editor contains a \`subscription\` keyword, the tab badge switches from **Q** (blue) or **M** (amber) to **S** (purple), and the Execute button becomes **Subscribe**. This visual signal prevents accidentally running a subscription as a regular query — which would fail with a protocol error.

**Real-time assertions:** Every incoming message is validated against your configured assertions in real time, showing pass/fail badges on each log row without stopping the stream. This is why subscriptions are powerful for integration testing: you assert on event payloads as they arrive.`,
    keyTerms: [
      {
        term: 'Subscription',
        definition:
          'A GraphQL operation that opens a persistent connection and streams server-pushed events to the client. Declared with `subscription OperationName($var: Type!) { field { ... } }`. The Studio tab badge shows **S** in purple.',
      },
      {
        term: 'graphql-transport-ws',
        definition:
          'The modern WebSocket sub-protocol for GraphQL subscriptions (RFC-aligned). Handshake uses `connection_init` → `subscribe` → `next` → `complete` message types. The recommended default for servers built after 2021.',
      },
      {
        term: 'Message log',
        definition:
          'The live panel that replaces the Response viewer when a subscription is active. Each row shows message index, direction (IN ↓), time offset from subscribe, and a JSON snippet — click to expand the full payload.',
      },
      {
        term: 'Pause / Resume',
        definition:
          'Pause buffers incoming messages without scrolling the log. Resume flushes the buffer. Useful when inspecting a burst of events that arrive faster than you can read them.',
      },
      {
        term: 'Subscription assertion',
        definition:
          'A JSONPath rule evaluated against every incoming message. Pass/fail badges appear on each log row in real time without stopping the stream. Configure via the Assertions panel below the editor.',
      },
      {
        term: 'Subscribe button',
        definition:
          'Appears on the connection bar when the editor contains a `subscription` block (replacing Execute). Clicking it opens the WebSocket, starts the subscription, and switches the right panel to the message log.',
      },
    ],
    diagram: `<svg viewBox="0 0 700 430" xmlns="http://www.w3.org/2000/svg" font-family="system-ui, -apple-system, sans-serif">
  <!-- ── Window chrome ─────────────────────────────────────────────────────── -->
  <rect x="0" y="0" width="700" height="430" rx="10" fill="#0f172a" stroke="#3b4a60" stroke-width="1.5"/>
  <!-- Title bar -->
  <rect x="0" y="0" width="700" height="32" rx="10" fill="#1e293b"/>
  <rect x="0" y="22" width="700" height="10" fill="#1e293b"/>
  <circle cx="18" cy="16" r="5" fill="#ff5f57"/>
  <circle cx="34" cy="16" r="5" fill="#febc2e"/>
  <circle cx="50" cy="16" r="5" fill="#28c840"/>
  <text x="350" y="21" text-anchor="middle" fill="#a8b8cc" font-size="11" font-weight="500">GraphQL Studio — Subscriptions</text>

  <!-- ── Connection bar ────────────────────────────────────────────────────── -->
  <rect x="8" y="38" width="684" height="28" rx="5" fill="#1e293b" stroke="#3b4a60" stroke-width="1"/>
  <!-- Endpoint input -->
  <rect x="16" y="43" width="224" height="18" rx="3" fill="#0f172a" stroke="#3b4a60" stroke-width="1"/>
  <text x="24" y="55" fill="#a8b8cc" font-size="9" font-family="monospace">localhost:4010/graphql</text>
  <!-- Schema badge -->
  <rect x="250" y="43" width="68" height="18" rx="9" fill="#1a3324" stroke="#28c840" stroke-width="1"/>
  <text x="284" y="55" text-anchor="middle" font-size="8.5" fill="#28c840" font-weight="600">✓ Schema</text>
  <!-- Transport select -->
  <rect x="330" y="43" width="140" height="18" rx="3" fill="#0f172a" stroke="#3b4a60" stroke-width="1"/>
  <text x="340" y="55" fill="#a8b8cc" font-size="8" font-family="monospace">graphql-transport-ws ▾</text>
  <!-- Subscribe button (purple) -->
  <rect x="560" y="43" width="80" height="18" rx="4" fill="#7c3aed"/>
  <text x="600" y="55" text-anchor="middle" font-size="9.5" font-weight="700" fill="white">⬡ Subscribe</text>
  <!-- Subscribe button callout -->
  <rect x="564" y="25" width="120" height="14" rx="3" fill="#2a1f42" stroke="#7c3aed" stroke-width="0.8"/>
  <text x="624" y="35" text-anchor="middle" fill="#a78bfa" font-size="7.5" font-weight="600">Execute → Subscribe when S mode</text>
  <line x1="600" y1="43" x2="624" y2="39" stroke="#7c3aed" stroke-width="0.8" stroke-dasharray="2 2"/>

  <!-- ── Tab bar ───────────────────────────────────────────────────────────── -->
  <rect x="8" y="72" width="684" height="24" fill="#0f172a"/>
  <line x1="8" y1="96" x2="692" y2="96" stroke="#3b4a60" stroke-width="1"/>
  <!-- OrderUpdates tab — active, purple S badge -->
  <rect x="12" y="74" width="136" height="20" rx="4" fill="#1e293b" stroke="#3b4a60" stroke-width="1"/>
  <rect x="110" y="77" width="15" height="14" rx="3" fill="#7c3aed"/>
  <text x="117.5" y="87.5" text-anchor="middle" font-size="7.5" font-weight="800" fill="white">S</text>
  <text x="60" y="88" text-anchor="middle" font-size="8.5" fill="#f1f5f9" font-weight="500">OrderUpdates</text>

  <!-- ── Editor pane (left 54%) ─────────────────────────────────────────────── -->
  <rect x="8" y="96" width="376" height="178" fill="#0f172a"/>
  <line x1="384" y1="96" x2="384" y2="274" stroke="#3b4a60" stroke-width="1"/>

  <!-- Line numbers -->
  <text x="16" y="120" fill="#a8b8cc" font-size="8" opacity="0.4" font-family="monospace">1</text>
  <text x="16" y="133" fill="#a8b8cc" font-size="8" opacity="0.4" font-family="monospace">2</text>
  <text x="16" y="146" fill="#a8b8cc" font-size="8" opacity="0.4" font-family="monospace">3</text>
  <text x="16" y="159" fill="#a8b8cc" font-size="8" opacity="0.4" font-family="monospace">4</text>
  <text x="16" y="172" fill="#a8b8cc" font-size="8" opacity="0.4" font-family="monospace">5</text>
  <text x="16" y="185" fill="#a8b8cc" font-size="8" opacity="0.4" font-family="monospace">6</text>
  <text x="16" y="198" fill="#a8b8cc" font-size="8" opacity="0.4" font-family="monospace">7</text>
  <text x="16" y="211" fill="#a8b8cc" font-size="8" opacity="0.4" font-family="monospace">8</text>

  <!-- Subscription code -->
  <text x="32" y="120" fill="#a78bfa" font-size="9" font-family="monospace">subscription</text>
  <text x="110" y="120" fill="#f1f5f9" font-size="9" font-family="monospace"> OrderUpdates(</text>
  <text x="40" y="133" fill="#c4b5fd" font-size="9" font-family="monospace">$orderId</text>
  <text x="88" y="133" fill="#f1f5f9" font-size="9" font-family="monospace">: </text>
  <text x="98" y="133" fill="#7dd3fc" font-size="9" font-family="monospace">ID!</text>
  <text x="120" y="133" fill="#f1f5f9" font-size="9" font-family="monospace">) {</text>
  <text x="40" y="146" fill="#a78bfa" font-size="9" font-family="monospace">  orderStatus</text>
  <text x="115" y="146" fill="#f1f5f9" font-size="9" font-family="monospace">(orderId: </text>
  <text x="169" y="146" fill="#c4b5fd" font-size="9" font-family="monospace">$orderId</text>
  <text x="210" y="146" fill="#f1f5f9" font-size="9" font-family="monospace">) {</text>
  <text x="48" y="159" fill="#a8b8cc" font-size="9" font-family="monospace">  status</text>
  <text x="48" y="172" fill="#a8b8cc" font-size="9" font-family="monospace">  updatedAt</text>
  <text x="40" y="185" fill="#f1f5f9" font-size="9" font-family="monospace">  }</text>
  <text x="32" y="198" fill="#f1f5f9" font-size="9" font-family="monospace">}</text>

  <!-- S badge callout next to subscription keyword -->
  <rect x="210" y="111" width="96" height="14" rx="3" fill="#271e3d" stroke="#7c3aed" stroke-width="0.8"/>
  <text x="258" y="121" text-anchor="middle" fill="#a78bfa" font-size="7.5">S badge activates on parse</text>
  <line x1="210" y1="118" x2="108" y2="120" stroke="#7c3aed" stroke-width="0.8" stroke-dasharray="2 2"/>

  <!-- ── Subscription log (right 46%) ──────────────────────────────────────── -->
  <rect x="386" y="96" width="306" height="178" fill="#0f172a"/>

  <!-- Log header -->
  <rect x="386" y="96" width="306" height="22" fill="#1e293b"/>
  <line x1="386" y1="118" x2="692" y2="118" stroke="#3b4a60" stroke-width="1"/>
  <text x="396" y="111" font-size="9" font-weight="600" fill="#f1f5f9">Subscription Log</text>
  <!-- WS status -->
  <rect x="498" y="99" width="44" height="14" rx="7" fill="#2e2245" stroke="#7c3aed" stroke-width="0.8"/>
  <text x="520" y="110" text-anchor="middle" font-size="7.5" fill="#a78bfa" font-weight="600">● LIVE</text>
  <!-- Pause btn -->
  <rect x="550" y="99" width="36" height="14" rx="3" fill="#1e293b" stroke="#3b4a60" stroke-width="0.8"/>
  <text x="568" y="110" text-anchor="middle" font-size="7.5" fill="#a8b8cc">⏸ Pause</text>
  <!-- Filter btn -->
  <rect x="593" y="99" width="36" height="14" rx="3" fill="#1e293b" stroke="#3b4a60" stroke-width="0.8"/>
  <text x="611" y="110" text-anchor="middle" font-size="7.5" fill="#a8b8cc">≡ Filter</text>
  <!-- Stop btn -->
  <rect x="636" y="99" width="44" height="14" rx="3" fill="#3a1f1f" stroke="#ef4444" stroke-width="0.8"/>
  <text x="658" y="110" text-anchor="middle" font-size="7.5" fill="#ef4444" font-weight="600">■ Stop</text>

  <!-- Log row 1: PENDING -->
  <rect x="388" y="120" width="302" height="18" rx="2" fill="#1e293b" stroke="#3b4a60" stroke-width="0.5"/>
  <text x="396" y="132" fill="#a8b8cc" font-size="8" font-family="monospace">#1</text>
  <text x="412" y="132" fill="#a8b8cc" font-size="8">IN ↓</text>
  <text x="440" y="132" fill="#a8b8cc" font-size="8">+0ms</text>
  <text x="470" y="132" fill="#f1f5f9" font-size="8" font-family="monospace">status: </text>
  <text x="510" y="132" fill="#f59e0b" font-size="8" font-family="monospace" font-weight="600">PENDING</text>

  <!-- Log row 2: PROCESSING -->
  <rect x="388" y="140" width="302" height="18" rx="2" fill="#0f172a" stroke="#3b4a60" stroke-width="0.5"/>
  <text x="396" y="152" fill="#a8b8cc" font-size="8" font-family="monospace">#2</text>
  <text x="412" y="152" fill="#a8b8cc" font-size="8">IN ↓</text>
  <text x="440" y="152" fill="#a8b8cc" font-size="8">+311ms</text>
  <text x="470" y="152" fill="#f1f5f9" font-size="8" font-family="monospace">status: </text>
  <text x="510" y="152" fill="#3b82f6" font-size="8" font-family="monospace" font-weight="600">PROCESSING</text>

  <!-- Log row 3: COMPLETE (highlighted) -->
  <rect x="388" y="160" width="302" height="18" rx="2" fill="#192e26" stroke="#28c840" stroke-width="0.8"/>
  <text x="396" y="172" fill="#a8b8cc" font-size="8" font-family="monospace">#3</text>
  <text x="412" y="172" fill="#a8b8cc" font-size="8">IN ↓</text>
  <text x="440" y="172" fill="#a8b8cc" font-size="8">+598ms</text>
  <text x="470" y="172" fill="#f1f5f9" font-size="8" font-family="monospace">status: </text>
  <text x="510" y="172" fill="#28c840" font-size="8" font-family="monospace" font-weight="600">COMPLETE</text>
  <!-- Assertion pass badge on COMPLETE row -->
  <rect x="628" y="162" width="40" height="14" rx="7" fill="#1e3a2a" stroke="#28c840" stroke-width="0.8"/>
  <text x="648" y="172" text-anchor="middle" fill="#28c840" font-size="7.5" font-weight="700">✓ pass</text>

  <!-- Counter badge -->
  <rect x="388" y="180" width="302" height="16" fill="#1e293b" rx="0"/>
  <text x="396" y="191" fill="#a8b8cc" font-size="7.5">3 messages received · 1/1 assertion passing · stream ended</text>

  <!-- ── Variables panel ────────────────────────────────────────────────────── -->
  <rect x="8" y="274" width="684" height="60" fill="#1e293b" stroke="#3b4a60" stroke-width="1" rx="0"/>
  <line x1="8" y1="274" x2="692" y2="274" stroke="#3b4a60" stroke-width="1"/>
  <rect x="16" y="278" width="62" height="16" rx="3" fill="#1a2740" stroke="#3b4a60" stroke-width="1"/>
  <text x="47" y="289" text-anchor="middle" font-size="8" fill="#f1f5f9" font-weight="600">Variables</text>
  <rect x="82" y="278" width="54" height="16" rx="3" fill="#0f172a"/>
  <text x="109" y="289" text-anchor="middle" font-size="8" fill="#a8b8cc">Headers</text>
  <text x="16" y="310" fill="#f1f5f9" font-size="8.5" font-family="monospace">{ </text>
  <text x="28" y="310" fill="#7dd3fc" font-size="8.5" font-family="monospace">"orderId"</text>
  <text x="79" y="310" fill="#f1f5f9" font-size="8.5" font-family="monospace">: </text>
  <text x="89" y="310" fill="#86efac" font-size="8.5" font-family="monospace">"ord-7"</text>
  <text x="121" y="310" fill="#f1f5f9" font-size="8.5" font-family="monospace"> }</text>
  <text x="16" y="326" fill="#a8b8cc" font-size="7.5" opacity="0.7">$orderId variable — captured from createOrder response</text>

  <!-- ── Subscription flow legend (bottom) ─────────────────────────────────── -->
  <line x1="8" y1="337" x2="692" y2="337" stroke="#3b4a60" stroke-width="1"/>
  <rect x="8" y="337" width="684" height="88" fill="#0f172a"/>
  <text x="350" y="354" text-anchor="middle" font-size="9.5" font-weight="600" fill="#a8b8cc">Subscription Lifecycle</text>

  <!-- Step boxes -->
  <defs>
    <marker id="gql7-arr" markerWidth="6" markerHeight="6" refX="4" refY="3" orient="auto">
      <path d="M1,1 L5,3 L1,5 Z" fill="#3b82f6"/>
    </marker>
  </defs>

  <!-- createOrder -->
  <rect x="14" y="362" width="118" height="56" rx="5" fill="#1a3028" stroke="#28c840" stroke-width="1"/>
  <text x="73" y="376" text-anchor="middle" font-size="8.5" font-weight="700" fill="#28c840">createOrder</text>
  <text x="73" y="389" text-anchor="middle" font-size="7.5" fill="#a8b8cc">mutation → ord-N</text>
  <text x="73" y="401" text-anchor="middle" font-size="7" fill="#a8b8cc" font-style="italic">(needed for $orderId)</text>
  <text x="73" y="412" text-anchor="middle" font-size="7" fill="#a8b8cc">Steps 3–5</text>

  <line x1="133" y1="390" x2="150" y2="390" stroke="#3b82f6" stroke-width="1.5" marker-end="url(#gql7-arr)"/>

  <!-- Write subscription -->
  <rect x="152" y="362" width="118" height="56" rx="5" fill="#281f38" stroke="#a78bfa" stroke-width="1"/>
  <text x="211" y="376" text-anchor="middle" font-size="8.5" font-weight="700" fill="#a78bfa">subscription {}</text>
  <text x="211" y="389" text-anchor="middle" font-size="7.5" fill="#a8b8cc">badge S · transport</text>
  <text x="211" y="401" text-anchor="middle" font-size="7" fill="#a8b8cc">Steps 6–8</text>

  <line x1="271" y1="390" x2="288" y2="390" stroke="#3b82f6" stroke-width="1.5" marker-end="url(#gql7-arr)"/>

  <!-- Subscribe → Live -->
  <rect x="290" y="362" width="118" height="56" rx="5" fill="#251c38" stroke="#7c3aed" stroke-width="1"/>
  <text x="349" y="376" text-anchor="middle" font-size="8.5" font-weight="700" fill="#a78bfa">Subscribe → LIVE</text>
  <text x="349" y="389" text-anchor="middle" font-size="7.5" fill="#a8b8cc">WebSocket open</text>
  <text x="349" y="401" text-anchor="middle" font-size="7" fill="#a8b8cc">log panel active</text>
  <text x="349" y="412" text-anchor="middle" font-size="7" fill="#a8b8cc">Steps 9–10</text>

  <line x1="409" y1="390" x2="426" y2="390" stroke="#3b82f6" stroke-width="1.5" marker-end="url(#gql7-arr)"/>

  <!-- Messages + assertions -->
  <rect x="428" y="362" width="118" height="56" rx="5" fill="#1a2740" stroke="#3b82f6" stroke-width="1"/>
  <text x="487" y="376" text-anchor="middle" font-size="8.5" font-weight="700" fill="#3b82f6">Events + Assert</text>
  <text x="487" y="389" text-anchor="middle" font-size="7.5" fill="#a8b8cc">PENDING → COMPLETE</text>
  <text x="487" y="401" text-anchor="middle" font-size="7" fill="#a8b8cc">pass/fail per row</text>
  <text x="487" y="412" text-anchor="middle" font-size="7" fill="#a8b8cc">Steps 11–14</text>

  <line x1="547" y1="390" x2="564" y2="390" stroke="#ef4444" stroke-width="1.5" marker-end="url(#gql7-stop)"/>

  <!-- Stop -->
  <rect x="566" y="362" width="118" height="56" rx="5" fill="#321c1c" stroke="#ef4444" stroke-width="1"/>
  <text x="625" y="376" text-anchor="middle" font-size="8.5" font-weight="700" fill="#ef4444">Stop</text>
  <text x="625" y="389" text-anchor="middle" font-size="7.5" fill="#a8b8cc">WS closed · log kept</text>
  <text x="625" y="401" text-anchor="middle" font-size="7" fill="#a8b8cc">review offline</text>
  <text x="625" y="412" text-anchor="middle" font-size="7" fill="#a8b8cc">Step 15</text>

  <defs>
    <marker id="gql7-stop" markerWidth="6" markerHeight="6" refX="4" refY="3" orient="auto">
      <path d="M1,1 L5,3 L1,5 Z" fill="#ef4444"/>
    </marker>
  </defs>
</svg>`,
  },

  steps: [
    // ── 1. Roadmap ──────────────────────────────────────────────────────────
    {
      id: 'gql5-intro',
      title: 'Real-Time Order Status — The Plan',
      description:
        'This lesson walks **one complete subscription workflow** — not a random tour of buttons:\n\n' +
        '1. **Connect** to the demo server and load the schema\n' +
        '2. **Create an order** with a mutation (we need a real `orderId`)\n' +
        '3. **Write** an `orderStatus` subscription and choose the WebSocket transport\n' +
        '4. **Subscribe**, watch **PENDING → PROCESSING → COMPLETE**, then pause / filter / assert\n' +
        '5. **Stop** the stream — the log stays for review\n\n' +
        '**Why subscriptions?** Queries read once; mutations write once. Subscriptions stream **server-pushed** events over a persistent WebSocket — the server sends data only when something changes (no polling).\n\n' +
        'The editor starts with a stub `subscription { }`. When we paste a real subscription later, the tab badge turns purple **S** and **Execute** becomes **Subscribe**.',
      highlight: GQL.EDITOR,
      preAction: prepareGql5IntroReading,
      action: async (ctx) => {
        await ctx.waitFor(`${GQL.EDITOR} .monaco-editor`, 8000);
        await ctx.delay(1000);
      },
      pauseAfter: true,
    },

    // ── 2. Connect ──────────────────────────────────────────────────────────
    {
      id: 'gql5-endpoint',
      title: 'Connect & Load the Schema',
      description:
        `Enter \`${GQL_DEMO_HTTP}\` and click **Introspect**. ` +
        'The schema confirms a **Subscription** type with `orderStatus(orderId: ID!)` — the field we will subscribe to after creating an order.\n\n' +
        'WebSocket uses the same host with a protocol swap (`ws://` instead of `http://`). ' +
        'Studio derives that automatically from the HTTP URL you enter here.',
      highlight: GQL.ENDPOINT_INPUT,
      preAction: prepareGql5EndpointReading,
      action: async (ctx) => {
        await configureDemoTabEndpointOverride(ctx, GQL_DEMO_HTTP);
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

    // ── 3–5. Create order (resource first) ──────────────────────────────────
    {
      id: 'gql5-create-order',
      title: 'Create a Demo Order First',
      description:
        'Subscriptions often watch **something that already exists**. Load **createOrder** so we get a real `orderId`:\n\n' +
        '`mutation CreateOrder($input: OrderInput!) { createOrder(input: $input) { id status } }`\n\n' +
        'Without that id, `orderStatus(orderId: …)` has nothing to track — same pattern as production: create a resource, then subscribe to its state changes.',
      highlight: GQL.EDITOR,
      preAction: prepareGql5CreateOrderReading,
      action: async (ctx) => {
        await ctx.click(GQL.MODE_EDITOR);
        await ctx.waitFor(`${GQL.EDITOR} .monaco-editor`, 8000);
        await ctx.delay(400);
        await fillGqlEditor(ctx, GQL_CREATE_ORDER_MUTATION);
        await ctx.delay(500);
        await ensureVariablesPanelOpen(ctx);
        await fillGqlVariables(ctx, GQL_CREATE_ORDER_VARS);
        await ctx.delay(500);
      },
      verify: GQL.VARS_PANEL,
      pauseAfter: true,
    },

    {
      id: 'gql5-exec-create-order',
      title: 'Execute createOrder',
      description:
        'Click **Execute**. The server creates the order and returns `{ id, status }`.\n\n' +
        'The next step spotlights that **id** in the Response — the lesson captures it for the subscription `$orderId` variable.',
      highlight: GQL.EXECUTE_BTN,
      preAction: prepareGql5ExecCreateOrderReading,
      action: async (ctx) => {
        await ctx.click(GQL.RIGHT_TAB_RESPONSE);
        await ctx.delay(200);
        await ctx.click(GQL.EXECUTE_BTN);
        await ctx.waitFor(GQL.RESPONSE_VIEWER, 15000);
        storeCreatedOrderIdFromResponse();
        await ctx.delay(700);
      },
      verify: GQL.RESPONSE_VIEWER,
      pauseAfter: true,
    },

    {
      id: 'gql5-observe-create-order',
      title: 'Read the Order id',
      description:
        'Find `data.createOrder.id` in the **Response**. That value becomes `$orderId` for the subscription.\n\n' +
        'In production, your client stores the mutation id and passes it into the subscription variables — we do the same automatically in the next step.',
      highlight: GQL.RESPONSE_DATA_CREATE_ORDER,
      preAction: prepareGql5ObserveCreateOrderReading,
      action: async (ctx) => {
        await ctx.waitFor(GQL.RESPONSE_DATA_CREATE_ORDER, 5000);
        await ctx.delay(800);
      },
      verify: GQL.RESPONSE_DATA_CREATE_ORDER,
      pauseAfter: true,
    },

    // ── 6. Write subscription (S badge moment) ──────────────────────────────
    {
      id: 'gql5-write-sub',
      title: 'Write the Subscription Query',
      description:
        'Replace the mutation with the **orderStatus** subscription:\n\n' +
        '`subscription OrderUpdates($orderId: ID!) { orderStatus(orderId: $orderId) { status updatedAt } }`\n\n' +
        '**Watch for:** the tab badge flips to purple **S**, and the connection bar button becomes **Subscribe** (not Execute). ' +
        'Variables receive the `orderId` we just created. Next we orient on that new Subscribe UI, then pick transport.',
      highlight: GQL.EDITOR,
      preAction: prepareGql5WriteSubReading,
      action: async (ctx) => {
        await fillGqlEditor(ctx, GQL_ORDER_STATUS_SUBSCRIPTION);
        await ctx.delay(800);
        const orderId = getLesson5OrderId() || parseCreatedOrderIdFromResponse() || '';
        if (orderId) {
          await ensureVariablesPanelOpen(ctx);
          await fillGqlVariables(ctx, JSON.stringify({ orderId }, null, 2));
        }
        markSubscriptionQueryWritten();
        await ctx.waitFor(GQL.SUBSCRIBE_BTN, 8000);
        await ctx.delay(900);
      },
      verify: GQL.SUBSCRIBE_BTN,
      pauseAfter: true,
    },

    // ── 7. Connection bar (after S mode is real) ────────────────────────────
    {
      id: 'gql5-connection-bar',
      title: 'Subscribe Button & Transport Select',
      description:
        'Now that the editor is in subscription mode, the **connection bar** shows controls queries/mutations do not:\n\n' +
        '- **Transport** — WebSocket sub-protocol (`graphql-transport-ws` recommended)\n' +
        '- **Subscribe** (purple) — opens the WebSocket, starts the stream, switches the right panel to the **message log**\n\n' +
        'After you click Subscribe (two steps from now), **● LIVE** means the server acknowledged the subscription (`connection_ack`). ' +
        'Wrong transport often looks “connected” but delivers **no messages**.',
      highlight: GQL.SUBSCRIBE_BTN,
      preAction: prepareGql5ConnectionBarReading,
      action: async (ctx) => {
        await ctx.waitFor(GQL.TRANSPORT_SELECT, 5000);
        await ctx.delay(1400);
      },
      verify: GQL.SUBSCRIBE_BTN,
      pauseAfter: true,
    },

    // ── 8. Transport ────────────────────────────────────────────────────────
    {
      id: 'gql5-transport-select',
      title: 'Choose the WebSocket Transport',
      description:
        'Open **Transport** and select `graphql-transport-ws` (modern default).\n\n' +
        '- `graphql-transport-ws` — RFC-aligned (`subscribe` / `next` / `complete`) — Apollo Server 3+, Yoga, Hasura, AppSync\n' +
        '- `graphql-ws` — legacy (`start` / `data` / `stop`) — older Apollo Server 2\n\n' +
        'Mismatch → silent close after handshake: no error banner, just an empty log. Match what your server advertises.',
      highlight: GQL.TRANSPORT_SELECT,
      preAction: ensureSubscriptionQueryWritten,
      action: async (ctx) => {
        await ensureWsTransport(ctx);
        await ctx.delay(1200);
      },
      pauseAfter: true,
    },

    // ── 9. Auth for WS handshake ────────────────────────────────────────────
    {
      id: 'gql5-subscription-auth',
      title: 'Wire Auth Into the WebSocket Handshake',
      description:
        'Open **Auth**, choose **Bearer**, and paste the demo token (same credential shape as **GQL-4**).\n\n' +
        'Watch **Auth preview** show `Authorization: Bearer …` — that value goes on the WebSocket `connection_init` frame as **`connectionParams`** ' +
        '(browsers cannot send custom HTTP headers on the WS upgrade).\n\n' +
        '**What to watch:** Auth type → bearer field → preview. Then we click **Subscribe**.',
      highlight: GQL.AUTH_TYPE_SELECT,
      preAction: prepareGql5SubscriptionAuthReading,
      action: async (ctx) => {
        await demonstrateSubscriptionAuthHandshake(ctx);
      },
      verify: GQL.AUTH_PREVIEW,
      pauseAfter: true,
    },

    // ── 10. Subscribe ───────────────────────────────────────────────────────
    {
      id: 'gql5-subscribe',
      title: 'Open the Subscription',
      description:
        'Click **Subscribe**. Studio opens `ws://localhost:4010/graphql`, sends the operation, and includes your Bearer token in `connection_init`.\n\n' +
        'Watch **Connecting…** → **● LIVE**. The right panel becomes the **subscription log**. ' +
        'The demo server emits three updates ~2s apart: **PENDING → PROCESSING → COMPLETE** (~6s total), ' +
        'each as `{ data: { orderStatus: { status, updatedAt } } }`.',
      highlight: GQL.SUBSCRIBE_BTN,
      preAction: ensureSubscriptionAuthConfigured,
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

    // ── 11. Watch log ───────────────────────────────────────────────────────
    {
      id: 'gql5-watch-log',
      title: 'Read the Live Message Log',
      description:
        'The log should show **PENDING → PROCESSING → COMPLETE**. Each row has index, direction (`IN ↓`), time since subscribe, and a JSON preview.\n\n' +
        '**Click a row** to expand the full payload. You inspect events without stopping the stream — the core debugging loop for subscriptions.',
      highlight: GQL.SUBSCRIPTION_MSG_LIST,
      preAction: ensureSubscribedWithMessages,
      action: async (ctx) => {
        await ctx.waitFor(GQL.SUBSCRIPTION_MSG_LIST, 5000);
        await ctx.delay(2000);
      },
      verify: GQL.SUBSCRIPTION_ROW,
      pauseAfter: true,
    },

    // ── 12. Pause ───────────────────────────────────────────────────────────
    {
      id: 'gql5-pause',
      title: 'Pause & Resume the Stream',
      description:
        'When the stream shows **Completed**, click **Re-subscribe** in the stream toolbar. While **live** (~6s), click **Pause** to buffer events without scrolling, then **Resume** to flush.\n\n' +
        '**Why:** bursts of events are hard to read live. Pause freezes the view without dropping data.',
      highlight: GQL.SUBSCRIPTION_STREAM_CONTROLS,
      preAction: prepareGql5PauseReading,
      action: async (ctx) => {
        const live = await clickResubscribeAndWaitForLive(ctx);
        const pauseBtn = document.querySelector(GQL.SUBSCRIPTION_PAUSE_BTN);
        if (pauseBtn) {
          await ctx.click(GQL.SUBSCRIPTION_PAUSE_BTN);
          await ctx.delay(1200);
          const resumeBtn = document.querySelector(GQL.SUBSCRIPTION_RESUME_BTN);
          if (resumeBtn) {
            await ctx.click(GQL.SUBSCRIPTION_RESUME_BTN);
            await ctx.delay(1500);
          }
        } else if (!live) {
          await ensurePauseResumeDemo(ctx);
        }
      },
      verify: GQL.SUBSCRIPTION_STREAM_CONTROLS,
      pauseAfter: true,
    },

    // ── 13. Filter ──────────────────────────────────────────────────────────
    {
      id: 'gql5-filter',
      title: 'Filter the Message Log',
      description:
        'Click **Filter** and type `COMPLETE` — only matching rows stay visible (e.g. "Showing 1/3").\n\n' +
        'Long streams pile up; filter isolates states without restarting. Clear the filter to see everything again.',
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

    // ── 14. Assertions ──────────────────────────────────────────────────────
    {
      id: 'gql5-assertions',
      title: 'Add a Real-Time Assertion',
      description:
        'In **Assertions** below the editor → **Add**. Set JSONPath `$.orderStatus.status`, operator **equals**, expected `COMPLETE`.\n\n' +
        'Paths are relative to each message\'s `data` object. After the rule is set, the demo **Re-subscribes**: ' +
        '`PENDING` / `PROCESSING` show ✗, `COMPLETE` shows ✓ — without stopping the stream. ' +
        'That is the integration-test pattern: assert every event in the state machine.',
      highlight: GQL.ASSERTION_PANEL,
      preAction: ensureSubscriptionQueryWritten,
      action: async (ctx) => {
        await ensureAssertionAdded(ctx);
        await ctx.delay(700);
        await demonstrateAssertionStream(ctx);
      },
      verify: GQL.ASSERTION_BADGE,
      pauseAfter: true,
    },

    // ── 15. Disconnect ──────────────────────────────────────────────────────
    {
      id: 'gql5-disconnect',
      title: 'Stop the Subscription',
      description:
        'Click **Stop** on the connection bar (or **■ Stop** in the log toolbar) to close the WebSocket. **● LIVE** clears.\n\n' +
        '**The log stays** — scroll, expand, export. In CI you often subscribe during the test and assert on the captured log after the stream ends.',
      highlight: GQL.STOP_SUB_BTN,
      preAction: prepareGql5DisconnectReading,
      action: async (ctx) => {
        const stopBar = document.querySelector(GQL.STOP_SUB_BTN);
        const stopLog = document.querySelector(GQL.SUB_STOP_BTN);
        if (stopBar) {
          await ctx.click(GQL.STOP_SUB_BTN);
        } else if (stopLog) {
          await ctx.click(GQL.SUB_STOP_BTN);
        } else {
          await clickResubscribeAndWaitForLive(ctx);
          await ctx.waitFor(GQL.STOP_SUB_BTN, 8000);
          await ctx.click(GQL.STOP_SUB_BTN);
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
