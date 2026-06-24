/** Lesson GQL-19: GraphQL Subscription Node in Workflow */
import type { DemoLesson } from '../../types';
import { GQL, WF } from '../../../../shared/selectors';
import {
  GQL_DEMO_HTTP,
  LESSON19_WF_NAME,
  LESSON19_ORDER_ID_VAR,
  LESSON19_FINAL_STATUS_VAR,
  LESSON19_STOP_AFTER_SECS,
  LESSON19_STOP_AFTER_MESSAGES,
  ensureLesson19WorkflowLoaded,
  ensureLesson19SubscriptionConfigured,
  ensureLesson19SubscriptionTimeout,
  ensureLesson19SubscriptionCorrelation,
  ensureLesson19SubscriptionOutputBound,
  ensureLesson19QuickTestRun,
  gqlWorkflowSubscriptionLessonSetup,
  gqlWorkflowSubscriptionLessonCleanup,
} from './graphql-lesson-helpers';

export const gqlWorkflowSubscriptionLesson: DemoLesson = {
  id: 'gql-workflow-subscription',
  domainId: 'protocols',
  category: 'graphql',
  name: 'Subscription Node in Workflow',
  description:
    'Chain createOrder → orderStatus subscription → assert COMPLETE in the Workflow Designer — the event-driven integration-test pattern, analogous to Kafka consume-wait.',
  estimatedMinutes: 5,
  initialTab: 'workflow',
  allowedTabs: ['workflow', 'workflow-runner'],

  dockerEndpoint: GQL_DEMO_HTTP.replace('/graphql', '/health'),
  dockerCommand: 'cd docker/graphql && docker compose up -d',
  tag: '🐳 Docker',

  setup: gqlWorkflowSubscriptionLessonSetup,
  cleanup: gqlWorkflowSubscriptionLessonCleanup,

  concept: {
    title: 'GraphQL Subscription Node — Event-Driven Workflow Testing',
    body: `GQL-18 showed the create → read-back → assert pattern for **synchronous** APIs. Many real systems are **event-driven**: you trigger an action, then wait for the system to emit a corresponding event before asserting the outcome. The **GraphQL Subscription node** is RedfireForge's workflow answer to Kafka's **consume-wait** pattern.

**Why a Subscription node instead of polling with a Query node?**
A Query node in a loop would hammer the server with repeated \`user(id)\` requests until status changes — wasteful, slow, and brittle. A Subscription node opens a **single WebSocket connection**, receives server-pushed events as they happen, and stops when a configured condition is met. One connection, zero polling overhead.

**Why bind orderId before subscribing?**
The subscription query \`orderStatus(orderId: $orderId)\` must receive the ID from the upstream createOrder mutation. Binding \`$.createOrder.id\` → \`${LESSON19_ORDER_ID_VAR}\` in the mutation's Extraction tab makes the ID a workflow variable. The subscription's Variables JSON references \`{{${LESSON19_ORDER_ID_VAR}}}\` **without extra quotes** (extraction stores JSON-serialized values) — so each workflow iteration subscribes only to **its own** order's events, not every order on the server.

**Why Stop tab controls (timeout + message count)?**
The **After (seconds)** field is the wall-clock safety cap — analogous to Kafka's \`maxWaitMs\`. If no event arrives within the limit, the node exits instead of hanging forever. **After N messages** collects exactly N subscription events before proceeding — here, 3 messages capture the full PENDING → PROCESSING → COMPLETE progression so the \`lastMessage\` binding holds the final COMPLETE status.

**Why Output binding on lastMessage?**
Binding \`lastMessage\` → \`${LESSON19_FINAL_STATUS_VAR}\` gives the Assert node a named variable to evaluate. Unlike Kafka's sample-payload field (which injects a mock message during Quick Test), GraphQL subscription in this demo uses **live WebSocket events** from the Docker server — createOrder automatically triggers the orderStatus stream. The stop rules ensure the node captures the final event without waiting indefinitely.`,
    keyTerms: [
      {
        term: 'GraphQL Subscription node',
        definition:
          'Workflow node (teal S badge) that opens a WebSocket subscription, collects server-pushed events until a stop condition is met, and binds output fields for downstream nodes.',
      },
      {
        term: 'Correlation via Variables',
        definition:
          'The subscription Variables JSON references {{orderId}} without extra quotes — scoping events to the specific order created in this workflow run, not all orders on the server.',
      },
      {
        term: 'Stop after N messages',
        definition:
          'Collect exactly N subscription events before the node completes. With the Docker test server, 3 messages capture PENDING → PROCESSING → COMPLETE.',
      },
      {
        term: 'Wall-clock timeout',
        definition:
          'The After (seconds) field on the Stop tab — maximum time the node waits for events before exiting. Prevents hung workflows when the WebSocket stream never delivers.',
      },
      {
        term: 'lastMessage binding',
        definition:
          'Output binding that stores the final subscription event payload as a named workflow variable — typically the last status update before the node stops.',
      },
    ],
    diagram: `<svg viewBox="0 0 700 430" xmlns="http://www.w3.org/2000/svg" font-family="system-ui, -apple-system, sans-serif">
  <!-- Window chrome -->
  <rect width="700" height="430" rx="10" fill="#0f172a" stroke="#334155" stroke-width="1.5"/>
  <rect width="700" height="32" rx="10" fill="#1e293b"/>
  <rect y="22" width="700" height="10" fill="#1e293b"/>
  <circle cx="20" cy="16" r="5" fill="#ef4444" opacity="0.8"/>
  <circle cx="38" cy="16" r="5" fill="#f59e0b" opacity="0.8"/>
  <circle cx="56" cy="16" r="5" fill="#22c55e" opacity="0.8"/>
  <text x="350" y="21" text-anchor="middle" fill="#94a3b8" font-size="11" font-weight="500">Workflow Designer — GraphQL Order Flow Demo</text>

  <!-- Toolbar -->
  <rect y="32" width="700" height="34" fill="#1e293b" stroke="#334155" stroke-width="0.5"/>
  <rect x="12" y="40" width="148" height="18" rx="4" fill="#0f172a" stroke="#3b4a60" stroke-width="1"/>
  <text x="86" y="53" text-anchor="middle" fill="#94a3b8" font-size="9.5">GraphQL Order Flow Demo</text>
  <rect x="542" y="39" width="84" height="20" rx="5" fill="#3b82f6"/>
  <text x="556" y="53" fill="#fff" font-size="9">▶ Quick Test</text>

  <!-- Left palette -->
  <rect x="0" y="66" width="130" height="330" fill="#1e293b" stroke="#334155" stroke-width="0.5"/>
  <text x="65" y="85" text-anchor="middle" fill="#94a3b8" font-size="9" font-weight="600" letter-spacing="0.5">ACTIONS</text>
  <!-- GraphQL Subscription (highlighted teal) -->
  <rect x="10" y="92" width="110" height="32" rx="5" fill="#042f2e" stroke="#14b8a6" stroke-width="1.5"/>
  <text x="65" y="108" text-anchor="middle" fill="#5eead4" font-size="9" font-weight="600">GraphQL Subscription</text>
  <text x="65" y="119" text-anchor="middle" fill="#2dd4bf" font-size="8">Event streams</text>
  <!-- GraphQL Mutation -->
  <rect x="10" y="130" width="110" height="32" rx="5" fill="#451a03" stroke="#f59e0b" stroke-width="1"/>
  <text x="65" y="146" text-anchor="middle" fill="#fcd34d" font-size="9" font-weight="600">GraphQL Mutation</text>
  <text x="65" y="157" text-anchor="middle" fill="#fbbf24" font-size="8">Write operations</text>
  <!-- GraphQL Assert -->
  <text x="65" y="178" text-anchor="middle" fill="#94a3b8" font-size="9" font-weight="600" letter-spacing="0.5">LOGIC</text>
  <rect x="10" y="185" width="110" height="32" rx="5" fill="#14532d" stroke="#22c55e" stroke-width="1"/>
  <text x="65" y="201" text-anchor="middle" fill="#86efac" font-size="9" font-weight="600">GraphQL Assert</text>

  <!-- Canvas -->
  <rect x="130" y="66" width="570" height="330" fill="#0f172a"/>

  <!-- Start -->
  <rect x="148" y="175" width="64" height="36" rx="6" fill="#1e293b" stroke="#64748b" stroke-width="1.2"/>
  <text x="180" y="197" text-anchor="middle" fill="#94a3b8" font-size="9" font-weight="600">Start</text>

  <!-- Create Order mutation (amber) -->
  <rect x="232" y="163" width="96" height="60" rx="6" fill="#451a03" stroke="#f59e0b" stroke-width="1.5"/>
  <text x="280" y="180" text-anchor="middle" fill="#fcd34d" font-size="8" font-weight="700">M Create Order</text>
  <text x="280" y="193" text-anchor="middle" fill="#fbbf24" font-size="7">createOrder(...)</text>
  <text x="280" y="206" text-anchor="middle" fill="#86efac" font-size="7">→ orderId</text>

  <!-- Watch Status subscription (teal, highlighted) -->
  <rect x="352" y="155" width="110" height="76" rx="6" fill="#042f2e" stroke="#14b8a6" stroke-width="2"/>
  <text x="407" y="172" text-anchor="middle" fill="#5eead4" font-size="8" font-weight="700">S Watch Status</text>
  <text x="407" y="185" text-anchor="middle" fill="#2dd4bf" font-size="7">orderStatus(id)</text>
  <text x="407" y="198" text-anchor="middle" fill="#94a3b8" font-size="6.5">Stop: 3 msgs · 5s max</text>
  <!-- Mini event stream -->
  <rect x="362" y="204" width="28" height="10" rx="2" fill="#1e293b" stroke="#64748b" stroke-width="0.6"/>
  <text x="376" y="212" text-anchor="middle" fill="#f59e0b" font-size="5.5">PEND</text>
  <rect x="394" y="204" width="28" height="10" rx="2" fill="#1e293b" stroke="#64748b" stroke-width="0.6"/>
  <text x="408" y="212" text-anchor="middle" fill="#60a5fa" font-size="5.5">PROC</text>
  <rect x="426" y="204" width="28" height="10" rx="2" fill="#14532d" stroke="#22c55e" stroke-width="0.8"/>
  <text x="440" y="212" text-anchor="middle" fill="#86efac" font-size="5.5">DONE</text>
  <text x="407" y="224" text-anchor="middle" fill="#86efac" font-size="6.5">→ finalStatus</text>

  <!-- Assert node -->
  <rect x="482" y="163" width="96" height="60" rx="6" fill="#14532d" stroke="#22c55e" stroke-width="1.5"/>
  <text x="530" y="180" text-anchor="middle" fill="#86efac" font-size="8" font-weight="700">✓ Assert Complete</text>
  <text x="530" y="193" text-anchor="middle" fill="#6ee7b7" font-size="7">status = COMPLETE</text>
  <rect x="492" y="204" width="76" height="10" rx="2" fill="#14532d"/>
  <text x="530" y="212" text-anchor="middle" fill="#86efac" font-size="6.5">✓ pass</text>

  <!-- End -->
  <rect x="602" y="175" width="56" height="36" rx="6" fill="#1e293b" stroke="#64748b" stroke-width="1.2"/>
  <text x="630" y="197" text-anchor="middle" fill="#94a3b8" font-size="9" font-weight="600">End</text>

  <!-- Edges -->
  <line x1="212" y1="193" x2="230" y2="193" stroke="#3b82f6" stroke-width="1.5" marker-end="url(#arr19)"/>
  <line x1="328" y1="193" x2="350" y2="193" stroke="#3b82f6" stroke-width="1.5" marker-end="url(#arr19)"/>
  <line x1="462" y1="193" x2="480" y2="193" stroke="#3b82f6" stroke-width="1.5" marker-end="url(#arr19)"/>
  <line x1="578" y1="193" x2="600" y2="193" stroke="#3b82f6" stroke-width="1.5" marker-end="url(#arr19)"/>

  <!-- Subscription config panel preview (right side overlay) -->
  <rect x="140" y="248" width="420" height="130" rx="6" fill="#1e293b" stroke="#14b8a6" stroke-width="1.2"/>
  <text x="152" y="264" fill="#5eead4" font-size="9" font-weight="600">Subscription Node Config — Stop Tab</text>
  <!-- Tab bar -->
  <rect x="148" y="270" width="68" height="16" rx="3" fill="#0f172a"/>
  <text x="182" y="281" text-anchor="middle" fill="#64748b" font-size="7">Subscription</text>
  <rect x="220" y="270" width="36" height="16" rx="3" fill="#042f2e" stroke="#14b8a6" stroke-width="1"/>
  <text x="238" y="281" text-anchor="middle" fill="#5eead4" font-size="7" font-weight="600">Stop</text>
  <rect x="260" y="270" width="52" height="16" rx="3" fill="#0f172a"/>
  <text x="286" y="281" text-anchor="middle" fill="#64748b" font-size="7">Output</text>
  <!-- Stop fields -->
  <text x="152" y="302" fill="#94a3b8" font-size="8">After N messages</text>
  <rect x="230" y="293" width="28" height="14" rx="3" fill="#0f172a" stroke="#3b4a60" stroke-width="1"/>
  <text x="244" y="303" text-anchor="middle" fill="#e2e8f0" font-size="8">3</text>
  <text x="280" y="302" fill="#94a3b8" font-size="8">After (seconds)</text>
  <rect x="358" y="293" width="28" height="14" rx="3" fill="#0f172a" stroke="#3b4a60" stroke-width="1"/>
  <text x="372" y="303" text-anchor="middle" fill="#e2e8f0" font-size="8">5</text>
  <text x="152" y="322" fill="#64748b" font-size="7.5">3 msgs = PENDING → PROCESSING → COMPLETE progression</text>
  <text x="152" y="334" fill="#64748b" font-size="7.5">5s wall-clock cap prevents hung workflows (like Kafka maxWaitMs)</text>
  <!-- Output binding row -->
  <text x="152" y="356" fill="#94a3b8" font-size="8">Output: lastMessage → finalStatus</text>
  <text x="152" y="368" fill="#64748b" font-size="7.5">Variables: { "orderId": {{orderId}} } — correlation scoped to this run</text>

  <!-- Console -->
  <rect x="130" y="392" width="570" height="28" fill="#1e293b" stroke="#334155" stroke-width="0.5"/>
  <text x="148" y="410" fill="#64748b" font-size="8">Console</text>
  <circle cx="178" cy="406" r="4" fill="#22c55e"/>
  <text x="190" y="410" fill="#86efac" font-size="7.5">M createOrder 200 · S orderStatus ×3 · ✓ COMPLETE · assert pass</text>

  <defs>
    <marker id="arr19" markerWidth="5" markerHeight="5" refX="2.5" refY="2.5" orient="auto">
      <path d="M0,0 L5,2.5 L0,5 Z" fill="#3b82f6"/>
    </marker>
  </defs>
</svg>`,
  },

  steps: [
    {
      id: 'gql19-intro',
      title: 'GraphQL Subscription Node — Event-Driven Testing',
      description:
        `The **GraphQL Subscription node** (teal **S** badge) is the workflow equivalent of Kafka's **consume-wait** pattern: trigger an action, then wait for the system to emit the corresponding event before asserting the outcome.\n\nUnlike GQL-18's synchronous read-back query, subscriptions use a **persistent WebSocket connection**. The server pushes events as they happen — no polling loop, no repeated HTTP requests. This is the most powerful real-time testing pattern and the natural next step after GQL-18's mutation chain.\n\nPrerequisite: **GQL-18** showed create → verify with a Query node. Here, the Query is replaced by a **Subscription** that waits for status events.\n\nThe seeded **${LESSON19_WF_NAME}** workflow is loaded: Start → Create Order → Watch Order Status → Assert Complete → End.`,
      highlight: WF.PAL_GQL_SUBSCRIPTION,
      preAction: gqlWorkflowSubscriptionLessonSetup,
      pauseAfter: true,
    },

    {
      id: 'gql19-canvas-tour',
      title: 'Seeded Canvas — The Order Flow Chain',
      description:
        `The canvas shows the complete event-driven test chain:\n\n**Start** → **Create Order** (Mutation) → **Watch Order Status** (Subscription) → **Assert Complete** (Assert) → **End**\n\nThe Mutation node writes an order and binds \`${LESSON19_ORDER_ID_VAR}\`. The Subscription node opens a WebSocket, listens for \`orderStatus\` events scoped to that ID, and binds the final event to \`${LESSON19_FINAL_STATUS_VAR}\`. The Assert node verifies the status equals **COMPLETE**.\n\nNotice the teal **S** badge on Watch Order Status — it distinguishes event-stream nodes from the amber **M** (write) and purple **Q** (read) nodes you saw in earlier lessons.`,
      highlight: WF.CANVAS,
      preAction: ensureLesson19WorkflowLoaded,
      action: async (ctx) => {
        await ensureLesson19WorkflowLoaded(ctx);
        await ctx.delay(800);
      },
      verify: GQL.WF_CANVAS_SUBSCRIPTION_NODE,
      pauseAfter: true,
    },

    {
      id: 'gql19-config-sub',
      title: 'Configure the Subscription Node',
      description:
        `Double-click **Watch Order Status** to open its config panel. On the **Subscription** tab:\n\n- **Endpoint:** \`${GQL_DEMO_HTTP}\`\n- **Subscription query:** \`orderStatus(orderId: $orderId) { status updatedAt }\`\n- **Variables:** \`{ "orderId": {{${LESSON19_ORDER_ID_VAR}}} }\` — **no quotes** around \`{{${LESSON19_ORDER_ID_VAR}}}\`; extraction stores JSON-serialized values.\n\nThe \`{{${LESSON19_ORDER_ID_VAR}}}\` token resolves from the upstream **Create Order** mutation's Extraction rule (\`$.createOrder.id\`). This is the subscription equivalent of Kafka's correlation expression — the node listens only for events belonging to **this workflow run's order**, not every order on the server.\n\nSave when done.`,
      highlight: GQL.WF_SUBSCRIPTION_PANEL,
      preAction: ensureLesson19WorkflowLoaded,
      action: async (ctx) => {
        await ensureLesson19SubscriptionConfigured(ctx);
        await ctx.delay(800);
      },
      verify: GQL.WF_CANVAS_SUBSCRIPTION_NODE,
      pauseAfter: true,
    },

    {
      id: 'gql19-timeout',
      title: 'Subscription Timeout — Wall-Clock Safety Cap',
      description:
        `Switch to the **Stop** tab. Set **After (seconds)** to **${LESSON19_STOP_AFTER_SECS}**.\n\nThis is the maximum wall-clock time the subscription node waits before exiting — directly analogous to Kafka Wait's \`maxWaitMs\`. If the WebSocket stream delivers no events within 5 seconds, the node completes anyway instead of hanging the workflow indefinitely.\n\nIn production, set this generously above your expected event latency (e.g. 30–60 s for slow pipelines). For the Docker demo server, events arrive within ~1 s, so 5 s is a comfortable safety margin with room to spare.`,
      highlight: GQL.WF_STOP_SECS_INPUT,
      preAction: ensureLesson19SubscriptionConfigured,
      action: async (ctx) => {
        await ensureLesson19SubscriptionTimeout(ctx);
        await ctx.delay(800);
      },
      verify: GQL.WF_CANVAS_SUBSCRIPTION_NODE,
      pauseAfter: true,
    },

    {
      id: 'gql19-correlation',
      title: 'Correlation — Scoped to This Order',
      description:
        `Still on the **Stop** tab, set **After N messages** to **${LESSON19_STOP_AFTER_MESSAGES}**.\n\nThe Docker test server emits exactly three \`orderStatus\` events per order: **PENDING** → **PROCESSING** → **COMPLETE** (300 ms apart). Collecting 3 messages ensures the node captures the full progression and the \`lastMessage\` binding holds the final **COMPLETE** status.\n\nCombined with the Variables JSON \`"orderId": {{${LESSON19_ORDER_ID_VAR}}}\`, this is full **correlation**: each concurrent workflow iteration creates its own order, subscribes to its own ID, and collects its own three events — no cross-contamination between parallel runs.`,
      highlight: GQL.WF_STOP_MESSAGES_INPUT,
      preAction: ensureLesson19SubscriptionTimeout,
      action: async (ctx) => {
        await ensureLesson19SubscriptionCorrelation(ctx);
        await ctx.delay(800);
      },
      verify: GQL.WF_CANVAS_SUBSCRIPTION_NODE,
      pauseAfter: true,
    },

    {
      id: 'gql19-sample-payload',
      title: 'Output Binding — Capture the Final Event',
      description:
        `Switch to the **Output** tab. Click **+ Add** and configure:\n\n- **Field:** \`lastMessage\`\n- **Variable name:** \`${LESSON19_FINAL_STATUS_VAR}\`\n\nSave.\n\nKafka's Wait node has a **Sample Payload** field for Quick Test without a live broker. GraphQL Subscription has no equivalent — instead, this demo relies on **live WebSocket events** from the Docker server: when Create Order runs, the server automatically emits the three status events on the subscription stream.\n\nThe **Stop** rules (3 messages + 5 s cap) are the anti-hang safeguard: they ensure Quick Test always completes even if the WebSocket connection is slow to establish.`,
      highlight: GQL.WF_OUTPUT_TABLE,
      preAction: ensureLesson19SubscriptionCorrelation,
      action: async (ctx) => {
        await ensureLesson19SubscriptionOutputBound(ctx);
        await ctx.delay(800);
      },
      verify: GQL.WF_CANVAS_SUBSCRIPTION_NODE,
      pauseAfter: true,
    },

    {
      id: 'gql19-quick-test',
      title: 'Quick Test — Live Event Chain',
      description:
        `Open the **Console** (status bar badge), then click **▶ Quick Test**. Watch the canvas execute in sequence:\n\n1. **Create Order** turns green — mutation returns an \`orderId\`, bound via Extraction\n2. **Watch Order Status** turns green — WebSocket receives 3 events (PENDING → PROCESSING → COMPLETE)\n3. **Assert Complete** turns green — \`$.orderStatus.status\` equals **COMPLETE**\n\nThe Console shows the full chain: mutation request, subscription messages with timestamps, extracted \`${LESSON19_ORDER_ID_VAR}\` and \`${LESSON19_FINAL_STATUS_VAR}\` values, and the assertion result. Total wall time is typically under 2 seconds against the local Docker server.`,
      highlight: WF.QUICK_TEST_BTN,
      preAction: ensureLesson19SubscriptionOutputBound,
      action: async (ctx) => {
        await ensureLesson19QuickTestRun(ctx);
        await ctx.delay(800);
      },
      verify: WF.EXEC_SUMMARY,
      pauseAfter: true,
    },

    {
      id: 'gql19-load-behavior',
      title: 'Load Test Behavior — Per-Iteration Isolation',
      description:
        `When this workflow runs in the **Workflow Runner** with concurrency > 1, each parallel iteration executes its own Create Order mutation — producing a **unique \`${LESSON19_ORDER_ID_VAR}\`**. The subscription Variables JSON scopes each WebSocket to that ID, so concurrent iterations never receive each other's events.\n\nContrast with Kafka's \`auto-resume\` vs \`wait-for-real\` modes: GraphQL subscriptions always wait for **real WebSocket events**. The per-iteration \`${LESSON19_ORDER_ID_VAR}\` correlation is what makes load testing safe — without it, iteration A's subscription could receive iteration B's COMPLETE event and produce a false pass.\n\n**After N messages = 3** ensures each iteration collects its full status progression before asserting, regardless of concurrency level.`,
      highlight: GQL.WF_STOP_MESSAGES_INPUT,
      preAction: ensureLesson19QuickTestRun,
      pauseAfter: true,
    },

    {
      id: 'gql19-summary',
      title: 'Summary — Create → Subscribe → Assert',
      description:
        `You have built the complete **event-driven integration test** pattern in the Workflow Designer:\n\n1. **Mutation** — trigger the action (createOrder), bind the returned ID\n2. **Subscription** — wait for the system's response event (orderStatus), scoped by correlation\n3. **Assert** — verify the final event payload matches expectations\n\nThis pattern generalizes beyond GraphQL: an HTTP webhook trigger + GraphQL subscription wait, or a Kafka produce + GraphQL subscription assert, are all valid cross-protocol workflows in RedfireForge. The Subscription node is the real-time bridge between write operations and event verification.`,
      highlight: WF.CANVAS,
      preAction: ensureLesson19QuickTestRun,
      pauseAfter: true,
    },
  ],
};
