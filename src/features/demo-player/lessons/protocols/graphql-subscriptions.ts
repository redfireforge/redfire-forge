/** Lesson GQL-7: Subscriptions — Real-Time Data */
import type { DemoLesson } from '../../types';
import { GQL } from '../../../../shared/selectors';
import {
  GQL_CREATE_ORDER_MUTATION,
  GQL_CREATE_ORDER_VARS,
  GQL_DEMO_HTTP,
  GQL_DEMO_HEALTH,
  GQL_ORDER_STATUS_SUBSCRIPTION,
  configureDemoTabEndpointOverride,
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
    'Subscribe to live GraphQL events over WebSocket, choose the transport protocol, watch the message log, pause and filter streams, add real-time assertions, and disconnect cleanly.',
  estimatedMinutes: 5,
  initialTab: 'graphql-studio',
  allowedTabs: ['graphql-studio'],
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
  <rect x="0" y="0" width="700" height="430" rx="10" fill="var(--bg)" stroke="var(--border)" stroke-width="1.5"/>
  <!-- Title bar -->
  <rect x="0" y="0" width="700" height="32" rx="10" fill="var(--surface)"/>
  <rect x="0" y="22" width="700" height="10" fill="var(--surface)"/>
  <circle cx="18" cy="16" r="5" fill="#ff5f57"/>
  <circle cx="34" cy="16" r="5" fill="#febc2e"/>
  <circle cx="50" cy="16" r="5" fill="#28c840"/>
  <text x="350" y="21" text-anchor="middle" fill="var(--text-muted)" font-size="11" font-weight="500">GraphQL Studio — Subscriptions</text>

  <!-- ── Connection bar ────────────────────────────────────────────────────── -->
  <rect x="8" y="38" width="684" height="28" rx="5" fill="var(--surface)" stroke="var(--border)" stroke-width="1"/>
  <!-- Endpoint input -->
  <rect x="16" y="43" width="224" height="18" rx="3" fill="var(--bg)" stroke="var(--border)" stroke-width="1"/>
  <text x="24" y="55" fill="var(--text-muted)" font-size="9" font-family="monospace">localhost:4010/graphql</text>
  <!-- Schema badge -->
  <rect x="250" y="43" width="68" height="18" rx="9" fill="color-mix(in srgb, #28c840 15%, var(--surface))" stroke="#28c840" stroke-width="1"/>
  <text x="284" y="55" text-anchor="middle" font-size="8.5" fill="#28c840" font-weight="600">✓ Schema</text>
  <!-- Transport select -->
  <rect x="330" y="43" width="140" height="18" rx="3" fill="var(--bg)" stroke="var(--border)" stroke-width="1"/>
  <text x="340" y="55" fill="var(--text-muted)" font-size="8" font-family="monospace">graphql-transport-ws ▾</text>
  <!-- Subscribe button (purple) -->
  <rect x="560" y="43" width="80" height="18" rx="4" fill="#7c3aed"/>
  <text x="600" y="55" text-anchor="middle" font-size="9.5" font-weight="700" fill="white">⬡ Subscribe</text>
  <!-- Subscribe button callout -->
  <rect x="564" y="25" width="120" height="14" rx="3" fill="color-mix(in srgb, #7c3aed 20%, var(--surface))" stroke="#7c3aed" stroke-width="0.8"/>
  <text x="624" y="35" text-anchor="middle" fill="#a78bfa" font-size="7.5" font-weight="600">Execute → Subscribe when S mode</text>
  <line x1="600" y1="43" x2="624" y2="39" stroke="#7c3aed" stroke-width="0.8" stroke-dasharray="2 2"/>

  <!-- ── Tab bar ───────────────────────────────────────────────────────────── -->
  <rect x="8" y="72" width="684" height="24" fill="var(--bg)"/>
  <line x1="8" y1="96" x2="692" y2="96" stroke="var(--border)" stroke-width="1"/>
  <!-- OrderUpdates tab — active, purple S badge -->
  <rect x="12" y="74" width="136" height="20" rx="4" fill="var(--surface)" stroke="var(--border)" stroke-width="1"/>
  <rect x="110" y="77" width="15" height="14" rx="3" fill="#7c3aed"/>
  <text x="117.5" y="87.5" text-anchor="middle" font-size="7.5" font-weight="800" fill="white">S</text>
  <text x="60" y="88" text-anchor="middle" font-size="8.5" fill="var(--text)" font-weight="500">OrderUpdates</text>

  <!-- ── Editor pane (left 54%) ─────────────────────────────────────────────── -->
  <rect x="8" y="96" width="376" height="178" fill="var(--bg)"/>
  <line x1="384" y1="96" x2="384" y2="274" stroke="var(--border)" stroke-width="1"/>

  <!-- Line numbers -->
  <text x="16" y="120" fill="var(--text-muted)" font-size="8" opacity="0.4" font-family="monospace">1</text>
  <text x="16" y="133" fill="var(--text-muted)" font-size="8" opacity="0.4" font-family="monospace">2</text>
  <text x="16" y="146" fill="var(--text-muted)" font-size="8" opacity="0.4" font-family="monospace">3</text>
  <text x="16" y="159" fill="var(--text-muted)" font-size="8" opacity="0.4" font-family="monospace">4</text>
  <text x="16" y="172" fill="var(--text-muted)" font-size="8" opacity="0.4" font-family="monospace">5</text>
  <text x="16" y="185" fill="var(--text-muted)" font-size="8" opacity="0.4" font-family="monospace">6</text>
  <text x="16" y="198" fill="var(--text-muted)" font-size="8" opacity="0.4" font-family="monospace">7</text>
  <text x="16" y="211" fill="var(--text-muted)" font-size="8" opacity="0.4" font-family="monospace">8</text>

  <!-- Subscription code -->
  <text x="32" y="120" fill="#a78bfa" font-size="9" font-family="monospace">subscription</text>
  <text x="110" y="120" fill="var(--text)" font-size="9" font-family="monospace"> OrderUpdates(</text>
  <text x="40" y="133" fill="#c4b5fd" font-size="9" font-family="monospace">$orderId</text>
  <text x="88" y="133" fill="var(--text)" font-size="9" font-family="monospace">: </text>
  <text x="98" y="133" fill="#7dd3fc" font-size="9" font-family="monospace">ID!</text>
  <text x="120" y="133" fill="var(--text)" font-size="9" font-family="monospace">) {</text>
  <text x="40" y="146" fill="#a78bfa" font-size="9" font-family="monospace">  orderStatus</text>
  <text x="115" y="146" fill="var(--text)" font-size="9" font-family="monospace">(orderId: </text>
  <text x="169" y="146" fill="#c4b5fd" font-size="9" font-family="monospace">$orderId</text>
  <text x="210" y="146" fill="var(--text)" font-size="9" font-family="monospace">) {</text>
  <text x="48" y="159" fill="var(--text-muted)" font-size="9" font-family="monospace">  status</text>
  <text x="48" y="172" fill="var(--text-muted)" font-size="9" font-family="monospace">  updatedAt</text>
  <text x="40" y="185" fill="var(--text)" font-size="9" font-family="monospace">  }</text>
  <text x="32" y="198" fill="var(--text)" font-size="9" font-family="monospace">}</text>

  <!-- S badge callout next to subscription keyword -->
  <rect x="210" y="111" width="96" height="14" rx="3" fill="color-mix(in srgb, #7c3aed 15%, var(--surface))" stroke="#7c3aed" stroke-width="0.8"/>
  <text x="258" y="121" text-anchor="middle" fill="#a78bfa" font-size="7.5">S badge activates on parse</text>
  <line x1="210" y1="118" x2="108" y2="120" stroke="#7c3aed" stroke-width="0.8" stroke-dasharray="2 2"/>

  <!-- ── Subscription log (right 46%) ──────────────────────────────────────── -->
  <rect x="386" y="96" width="306" height="178" fill="var(--bg)"/>

  <!-- Log header -->
  <rect x="386" y="96" width="306" height="22" fill="var(--surface)"/>
  <line x1="386" y1="118" x2="692" y2="118" stroke="var(--border)" stroke-width="1"/>
  <text x="396" y="111" font-size="9" font-weight="600" fill="var(--text)">Subscription Log</text>
  <!-- WS status -->
  <rect x="498" y="99" width="44" height="14" rx="7" fill="color-mix(in srgb, #a78bfa 20%, var(--surface))" stroke="#7c3aed" stroke-width="0.8"/>
  <text x="520" y="110" text-anchor="middle" font-size="7.5" fill="#a78bfa" font-weight="600">● LIVE</text>
  <!-- Pause btn -->
  <rect x="550" y="99" width="36" height="14" rx="3" fill="var(--surface)" stroke="var(--border)" stroke-width="0.8"/>
  <text x="568" y="110" text-anchor="middle" font-size="7.5" fill="var(--text-muted)">⏸ Pause</text>
  <!-- Filter btn -->
  <rect x="593" y="99" width="36" height="14" rx="3" fill="var(--surface)" stroke="var(--border)" stroke-width="0.8"/>
  <text x="611" y="110" text-anchor="middle" font-size="7.5" fill="var(--text-muted)">≡ Filter</text>
  <!-- Stop btn -->
  <rect x="636" y="99" width="44" height="14" rx="3" fill="color-mix(in srgb, #ef4444 15%, var(--surface))" stroke="#ef4444" stroke-width="0.8"/>
  <text x="658" y="110" text-anchor="middle" font-size="7.5" fill="#ef4444" font-weight="600">■ Stop</text>

  <!-- Log row 1: PENDING -->
  <rect x="388" y="120" width="302" height="18" rx="2" fill="var(--surface)" stroke="var(--border)" stroke-width="0.5"/>
  <text x="396" y="132" fill="var(--text-muted)" font-size="8" font-family="monospace">#1</text>
  <text x="412" y="132" fill="var(--text-muted)" font-size="8">IN ↓</text>
  <text x="440" y="132" fill="var(--text-muted)" font-size="8">+0ms</text>
  <text x="470" y="132" fill="var(--text)" font-size="8" font-family="monospace">status: </text>
  <text x="510" y="132" fill="#f59e0b" font-size="8" font-family="monospace" font-weight="600">PENDING</text>

  <!-- Log row 2: PROCESSING -->
  <rect x="388" y="140" width="302" height="18" rx="2" fill="var(--bg)" stroke="var(--border)" stroke-width="0.5"/>
  <text x="396" y="152" fill="var(--text-muted)" font-size="8" font-family="monospace">#2</text>
  <text x="412" y="152" fill="var(--text-muted)" font-size="8">IN ↓</text>
  <text x="440" y="152" fill="var(--text-muted)" font-size="8">+311ms</text>
  <text x="470" y="152" fill="var(--text)" font-size="8" font-family="monospace">status: </text>
  <text x="510" y="152" fill="#3b82f6" font-size="8" font-family="monospace" font-weight="600">PROCESSING</text>

  <!-- Log row 3: COMPLETE (highlighted) -->
  <rect x="388" y="160" width="302" height="18" rx="2" fill="color-mix(in srgb, #28c840 8%, var(--surface))" stroke="#28c840" stroke-width="0.8"/>
  <text x="396" y="172" fill="var(--text-muted)" font-size="8" font-family="monospace">#3</text>
  <text x="412" y="172" fill="var(--text-muted)" font-size="8">IN ↓</text>
  <text x="440" y="172" fill="var(--text-muted)" font-size="8">+598ms</text>
  <text x="470" y="172" fill="var(--text)" font-size="8" font-family="monospace">status: </text>
  <text x="510" y="172" fill="#28c840" font-size="8" font-family="monospace" font-weight="600">COMPLETE</text>
  <!-- Assertion pass badge on COMPLETE row -->
  <rect x="628" y="162" width="40" height="14" rx="7" fill="color-mix(in srgb, #28c840 20%, var(--surface))" stroke="#28c840" stroke-width="0.8"/>
  <text x="648" y="172" text-anchor="middle" fill="#28c840" font-size="7.5" font-weight="700">✓ pass</text>

  <!-- Counter badge -->
  <rect x="388" y="180" width="302" height="16" fill="var(--surface)" rx="0"/>
  <text x="396" y="191" fill="var(--text-muted)" font-size="7.5">3 messages received · 1/1 assertion passing · stream ended</text>

  <!-- ── Variables panel ────────────────────────────────────────────────────── -->
  <rect x="8" y="274" width="684" height="60" fill="var(--surface)" stroke="var(--border)" stroke-width="1" rx="0"/>
  <line x1="8" y1="274" x2="692" y2="274" stroke="var(--border)" stroke-width="1"/>
  <rect x="16" y="278" width="62" height="16" rx="3" fill="color-mix(in srgb, var(--primary) 10%, var(--surface))" stroke="var(--border)" stroke-width="1"/>
  <text x="47" y="289" text-anchor="middle" font-size="8" fill="var(--text)" font-weight="600">Variables</text>
  <rect x="82" y="278" width="54" height="16" rx="3" fill="var(--bg)"/>
  <text x="109" y="289" text-anchor="middle" font-size="8" fill="var(--text-muted)">Headers</text>
  <text x="16" y="310" fill="var(--text)" font-size="8.5" font-family="monospace">{ </text>
  <text x="28" y="310" fill="#7dd3fc" font-size="8.5" font-family="monospace">"orderId"</text>
  <text x="79" y="310" fill="var(--text)" font-size="8.5" font-family="monospace">: </text>
  <text x="89" y="310" fill="#86efac" font-size="8.5" font-family="monospace">"ord-7"</text>
  <text x="121" y="310" fill="var(--text)" font-size="8.5" font-family="monospace"> }</text>
  <text x="16" y="326" fill="var(--text-muted)" font-size="7.5" opacity="0.7">$orderId variable — captured from createOrder response (step 4)</text>

  <!-- ── Subscription flow legend (bottom) ─────────────────────────────────── -->
  <line x1="8" y1="337" x2="692" y2="337" stroke="var(--border)" stroke-width="1"/>
  <rect x="8" y="337" width="684" height="88" fill="var(--bg)"/>
  <text x="350" y="354" text-anchor="middle" font-size="9.5" font-weight="600" fill="var(--text-muted)">Subscription Lifecycle</text>

  <!-- Step boxes -->
  <defs>
    <marker id="gql7-arr" markerWidth="6" markerHeight="6" refX="4" refY="3" orient="auto">
      <path d="M1,1 L5,3 L1,5 Z" fill="var(--primary)"/>
    </marker>
  </defs>

  <!-- createOrder -->
  <rect x="14" y="362" width="118" height="56" rx="5" fill="color-mix(in srgb, #28c840 10%, var(--surface))" stroke="#28c840" stroke-width="1"/>
  <text x="73" y="376" text-anchor="middle" font-size="8.5" font-weight="700" fill="#28c840">createOrder</text>
  <text x="73" y="389" text-anchor="middle" font-size="7.5" fill="var(--text-muted)">mutation → ord-N</text>
  <text x="73" y="401" text-anchor="middle" font-size="7" fill="var(--text-muted)" font-style="italic">(needed for $orderId)</text>
  <text x="73" y="412" text-anchor="middle" font-size="7" fill="var(--text-muted)">Step 4</text>

  <line x1="133" y1="390" x2="150" y2="390" stroke="var(--primary)" stroke-width="1.5" marker-end="url(#gql7-arr)"/>

  <!-- Write subscription -->
  <rect x="152" y="362" width="118" height="56" rx="5" fill="color-mix(in srgb, #a78bfa 10%, var(--surface))" stroke="#a78bfa" stroke-width="1"/>
  <text x="211" y="376" text-anchor="middle" font-size="8.5" font-weight="700" fill="#a78bfa">subscription {}</text>
  <text x="211" y="389" text-anchor="middle" font-size="7.5" fill="var(--text-muted)">badge S · transport WS</text>
  <text x="211" y="401" text-anchor="middle" font-size="7" fill="var(--text-muted)">Steps 5–6</text>

  <line x1="271" y1="390" x2="288" y2="390" stroke="var(--primary)" stroke-width="1.5" marker-end="url(#gql7-arr)"/>

  <!-- Subscribe → Live -->
  <rect x="290" y="362" width="118" height="56" rx="5" fill="color-mix(in srgb, #7c3aed 12%, var(--surface))" stroke="#7c3aed" stroke-width="1"/>
  <text x="349" y="376" text-anchor="middle" font-size="8.5" font-weight="700" fill="#a78bfa">Subscribe → LIVE</text>
  <text x="349" y="389" text-anchor="middle" font-size="7.5" fill="var(--text-muted)">WebSocket open</text>
  <text x="349" y="401" text-anchor="middle" font-size="7" fill="var(--text-muted)">log panel active</text>
  <text x="349" y="412" text-anchor="middle" font-size="7" fill="var(--text-muted)">Step 7</text>

  <line x1="409" y1="390" x2="426" y2="390" stroke="var(--primary)" stroke-width="1.5" marker-end="url(#gql7-arr)"/>

  <!-- Messages + assertions -->
  <rect x="428" y="362" width="118" height="56" rx="5" fill="color-mix(in srgb, var(--primary) 10%, var(--surface))" stroke="var(--primary)" stroke-width="1"/>
  <text x="487" y="376" text-anchor="middle" font-size="8.5" font-weight="700" fill="var(--primary)">Events + Assert</text>
  <text x="487" y="389" text-anchor="middle" font-size="7.5" fill="var(--text-muted)">PENDING → COMPLETE</text>
  <text x="487" y="401" text-anchor="middle" font-size="7" fill="var(--text-muted)">pass/fail per row</text>
  <text x="487" y="412" text-anchor="middle" font-size="7" fill="var(--text-muted)">Steps 8–11</text>

  <line x1="547" y1="390" x2="564" y2="390" stroke="#ef4444" stroke-width="1.5" marker-end="url(#gql7-stop)"/>

  <!-- Stop -->
  <rect x="566" y="362" width="118" height="56" rx="5" fill="color-mix(in srgb, #ef4444 10%, var(--surface))" stroke="#ef4444" stroke-width="1"/>
  <text x="625" y="376" text-anchor="middle" font-size="8.5" font-weight="700" fill="#ef4444">Stop</text>
  <text x="625" y="389" text-anchor="middle" font-size="7.5" fill="var(--text-muted)">WS closed · log kept</text>
  <text x="625" y="401" text-anchor="middle" font-size="7" fill="var(--text-muted)">review offline</text>
  <text x="625" y="412" text-anchor="middle" font-size="7" fill="var(--text-muted)">Step 12</text>

  <defs>
    <marker id="gql7-stop" markerWidth="6" markerHeight="6" refX="4" refY="3" orient="auto">
      <path d="M1,1 L5,3 L1,5 Z" fill="#ef4444"/>
    </marker>
  </defs>
</svg>`,
  },

  steps: [
    // ── Step 1: Overview ────────────────────────────────────────────────────
    {
      id: 'gql5-intro',
      title: 'Subscription Operations',
      description:
        '**Subscriptions** are the third GraphQL operation type — after queries (read once) and mutations (write once). ' +
        'They stream **server-pushed events** over a persistent connection, delivering each new event as a complete `{ data: { … } }` response.\n\n' +
        'Unlike polling (where your client sends a request every N seconds), subscriptions are event-driven: the server only sends data when something actually changes — more efficient, lower latency, and no wasted requests.\n\n' +
        'Watch the Studio tab as you type: the badge switches from **Q** (blue) or **M** (amber) to **S** (purple) the moment the editor parses the `subscription` keyword. ' +
        'The connection bar button transforms from **Execute** to **Subscribe** — the visual system prevents you from running a subscription as a regular HTTP POST, which would fail.',
      highlight: GQL.TAB_BAR,
      pauseAfter: true,
    },

    // ── Step 2: Connection bar tour ─────────────────────────────────────────
    {
      id: 'gql5-connection-bar',
      title: 'The Subscribe Button & Transport Select',
      description:
        'Look at the **connection bar** — in subscription mode it has two elements that don\'t appear for queries or mutations:\n\n' +
        '- **Transport dropdown** — selects the WebSocket sub-protocol. Choose `graphql-transport-ws` (modern RFC standard, recommended) or `graphql-ws` (legacy). Wrong transport = silent connection failure.\n' +
        '- **Subscribe button** (purple) — replaces Execute. Clicking it opens the WebSocket handshake, starts the subscription stream, and switches the right panel to the **message log**.\n\n' +
        'The **● LIVE** status badge next to the Subscribe button turns green once the WebSocket is connected and the server has acknowledged the subscription. ' +
        'Until the server sends `connection_ack`, you\'re still connecting.',
      highlight: GQL.CONNECTION_BAR,
      preAction: async (ctx) => {
        await ctx.waitFor(GQL.ENDPOINT_INPUT, 5000);
      },
      pauseAfter: true,
    },

    // ── Step 3: Connect & Introspect ────────────────────────────────────────
    {
      id: 'gql5-endpoint',
      title: 'Connect & Load the Schema',
      description:
        `Enter \`${GQL_DEMO_HTTP}\` in the endpoint field and click **Introspect**. ` +
        'The schema download confirms the server exposes a **Subscription** type with `orderStatus(orderId: ID!)` as a field.\n\n' +
        'WebSocket uses the same host with a protocol swap: `ws://localhost:4010/graphql` instead of `http://`. ' +
        'The Studio handles this automatically — you always enter the HTTP URL and it derives the WS endpoint.',
      highlight: GQL.CONNECTION_BAR,
      preAction: async (ctx) => {
        await ctx.waitFor(GQL.ENDPOINT_INPUT, 5000);
      },
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

    // ── Step 4: Create an order ─────────────────────────────────────────────
    {
      id: 'gql5-create-order',
      title: 'Create a Demo Order First',
      description:
        'The `orderStatus` subscription requires a real `orderId`. Run **createOrder** first:\n\n' +
        '`mutation CreateOrder($input: OrderInput!) { createOrder(input: $input) { id status } }`\n\n' +
        '**Why is this required?** The subscription filters its event stream by `$orderId` — without a valid id, the server has nothing to watch. ' +
        'This is a common real-world pattern: create a resource, then subscribe to its state changes. ' +
        'The lesson captures `data.createOrder.id` from this response and passes it automatically to `$orderId` in the next step.',
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

    // ── Step 5: Write the subscription ─────────────────────────────────────
    {
      id: 'gql5-write-sub',
      title: 'Write the Subscription Query',
      description:
        'Replace the mutation with the **orderStatus** subscription:\n\n' +
        '`subscription OrderUpdates($orderId: ID!) { orderStatus(orderId: $orderId) { status updatedAt } }`\n\n' +
        'As soon as the editor parses `subscription`, the tab badge switches to purple **S** and Execute becomes Subscribe. ' +
        'The `$orderId` variable slot appears in the Variables panel — the lesson fills it automatically with the id from step 4. ' +
        'Next, choose the **transport protocol** before subscribing.',
      highlight: GQL.EDITOR,
      preAction: ensureDemoOrderCreated,
      action: async (ctx) => {
        await fillGqlEditor(ctx, GQL_ORDER_STATUS_SUBSCRIPTION);
        await ctx.delay(500);
        const orderId = getLesson5OrderId() || parseCreatedOrderIdFromResponse() || '';
        if (orderId) {
          await ensureVariablesPanelOpen(ctx);
          await fillGqlVariables(ctx, JSON.stringify({ orderId }, null, 2));
        }
        await ctx.delay(600);
      },
      pauseAfter: true,
    },

    // ── Step 6: Transport selection ─────────────────────────────────────────
    {
      id: 'gql5-transport-select',
      title: 'Choose the WebSocket Transport',
      description:
        'Open the **Transport** dropdown in the connection bar and select `graphql-transport-ws` (the modern default).\n\n' +
        '**Why does transport matter?** Two WebSocket sub-protocols exist for GraphQL:\n' +
        '- `graphql-transport-ws` — RFC-aligned, supported by Apollo Server 3+, graphql-yoga, Hasura, AWS AppSync. Messages use `subscribe` / `next` / `complete`.\n' +
        '- `graphql-ws` — legacy protocol, found in older Apollo Server 2 setups. Messages use `start` / `data` / `stop`.\n\n' +
        'Choosing the wrong one causes the server to silently close the WebSocket after the handshake — no error, just no messages. ' +
        'Match the protocol to what your server advertises.',
      highlight: GQL.TRANSPORT_SELECT,
      preAction: ensureSubscriptionQueryWritten,
      action: async (ctx) => {
        await ensureWsTransport(ctx);
        await ctx.delay(1200);
      },
      pauseAfter: true,
    },

    // ── Step 7: Subscribe ───────────────────────────────────────────────────
    {
      id: 'gql5-subscribe',
      title: 'Open the Subscription',
      description:
        'Click **Subscribe** — the Studio opens a WebSocket connection to `ws://localhost:4010/graphql` and sends the subscription operation. ' +
        'Watch the status badge switch from **Connecting…** to **● LIVE**.\n\n' +
        'The right panel transforms into the **subscription log**. The test server emits three status updates ~300ms apart — **PENDING → PROCESSING → COMPLETE**. ' +
        'Each message arrives as a `{ data: { orderStatus: { status, updatedAt } } }` response and appears as a new log row.',
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

    // ── Step 8: Watch log ───────────────────────────────────────────────────
    {
      id: 'gql5-watch-log',
      title: 'Read the Live Message Log',
      description:
        'The **subscription log** shows three rows: **PENDING → PROCESSING → COMPLETE**, each ~300ms apart. ' +
        'Every row displays the message index, direction (`IN ↓`), time offset since subscribe, and a JSON preview.\n\n' +
        '**Click any row** to expand it and see the full `{ data: { orderStatus: { status, updatedAt } } }` payload. ' +
        'This row-level detail is how you diagnose unexpected payloads during development — you don\'t need to stop the subscription to inspect what arrived.',
      highlight: GQL.SUBSCRIPTION_MSG_LIST,
      preAction: ensureSubscribedWithMessages,
      action: async (ctx) => {
        await ctx.waitFor(GQL.SUBSCRIPTION_MSG_LIST, 5000);
        await ctx.delay(2000);
      },
      verify: GQL.SUBSCRIPTION_ROW,
      pauseAfter: true,
    },

    // ── Step 9: Pause & Resume ──────────────────────────────────────────────
    {
      id: 'gql5-pause',
      title: 'Pause & Resume the Stream',
      description:
        'Click **Re-subscribe**, then immediately click **Pause** while messages are arriving — incoming events buffer silently without scrolling the log. ' +
        'Click **Resume** to flush the buffer and scroll to the latest message.\n\n' +
        '**Why Pause exists:** Real systems can emit bursts of events (e.g., 50 status updates in a second). ' +
        'Pause lets you freeze the view at a particular moment without missing data — the buffer holds events in order and delivers them all on Resume.',
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

    // ── Step 10: Filter ─────────────────────────────────────────────────────
    {
      id: 'gql5-filter',
      title: 'Filter the Message Log',
      description:
        'Click the **Filter** button in the log toolbar and type `COMPLETE` — only rows whose JSON body contains that substring remain visible. ' +
        'The counter shows how many messages match (e.g. "Showing 1/3").\n\n' +
        '**Why filtering matters:** Long-running subscriptions accumulate hundreds of messages. ' +
        'Filter lets you isolate specific states (e.g., only `COMPLETE` rows, only `ERROR` payloads) without restarting the subscription. ' +
        'The full unfiltered log is preserved — clear the filter to return to all messages.',
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

    // ── Step 11: Assertions ─────────────────────────────────────────────────
    {
      id: 'gql5-assertions',
      title: 'Add a Real-Time Assertion',
      description:
        'Open the **Assertions** panel below the editor → click **Add**. ' +
        'Set JSONPath `$.orderStatus.status`, operator **equals**, expected value `COMPLETE`.\n\n' +
        '**How real-time assertions work:** On the next subscribe, each incoming message is evaluated against this rule. ' +
        'Rows where `orderStatus.status === "COMPLETE"` get a green ✓ pass badge; other rows get a red ✗ fail badge — without stopping the stream. ' +
        'The footer shows aggregate pass/fail counts. ' +
        'This is the integration testing pattern: subscribe, assert on each event, and verify the full state machine progression.',
      highlight: GQL.ASSERTION_PANEL,
      preAction: ensureSubscriptionQueryWritten,
      action: async (ctx) => {
        await ensureAssertionAdded(ctx);
        await ctx.delay(800);
      },
      verify: GQL.ASSERTION_ROW,
      pauseAfter: true,
    },

    // ── Step 12: Disconnect ─────────────────────────────────────────────────
    {
      id: 'gql5-disconnect',
      title: 'Stop the Subscription',
      description:
        'Click **Stop** on the connection bar (or the **■ Stop** button in the log toolbar) to close the WebSocket session. ' +
        'The subscription is terminated on the server side and the **● LIVE** badge disappears.\n\n' +
        '**The log stays visible after disconnect** — you can still scroll, expand rows, inspect payloads, and export the captured messages. ' +
        'This is intentional: in a CI test run, you subscribe during the test and inspect the log after the subscription ends to verify all expected events arrived in the correct order.',
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
