/** Lesson GQL-19: GraphQL Subscription Node in Workflow */
import type { DemoLesson } from '../../types';
import { GQL, WF } from '@shared/selectors';
import {
  GQL_DEMO_HTTP,
  LESSON19_WF_NAME,
  LESSON19_ORDER_ID_VAR,
  LESSON19_FINAL_STATUS_VAR,
  LESSON19_STOP_AFTER_SECS,
  LESSON19_STOP_AFTER_MESSAGES,
  LESSON19_SUBSCRIPTION_VARS,
  ensureLesson19WorkflowLoaded,
  isLesson19SubOperationReady,
  isLesson19SubVariablesReady,
  ensureLesson19SubscriptionConfigured,
  ensureLesson19SubscriptionVariables,
  ensureLesson19SubscriptionTimeout,
  ensureLesson19SubscriptionCorrelation,
  ensureLesson19SubscriptionOutputBound,
  performLesson19CreateOrderTour,
  performLesson19SubscriptionConfigured,
  performLesson19SubscriptionVariables,
  performLesson19SubscriptionTimeout,
  performLesson19SubscriptionCorrelation,
  performLesson19SubscriptionOutputBound,
  performLesson19QuickTestRun,
  prepareLesson19CreateOrderSpotlight,
  prepareLesson19SubscriptionSpotlight,
  prepareLesson19VariablesSpotlight,
  prepareLesson19StopTimeoutSpotlight,
  prepareLesson19StopMessagesSpotlight,
  prepareLesson19OutputSpotlight,
  prepareLesson19QuickTestSpotlight,
  prepareLesson19SummarySpotlight,
  gqlWorkflowSubscriptionLessonSetup,
  gqlWorkflowSubscriptionLessonCleanup,
} from './graphql-lesson-helpers/lesson19-workflow-subscription';

export const gqlWorkflowSubscriptionLesson: DemoLesson = {
  id: 'gql-workflow-subscription',
  domainId: 'protocols',
  category: 'graphql',
  name: 'Subscription Node in Workflow',
  description:
    'Trigger createOrder, wait for live orderStatus events on a WebSocket, then assert COMPLETE — the event-driven workflow pattern (Kafka consume-wait for GraphQL).',
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
    body: `**Goal of this lesson:** build a workflow that **creates** an order, **waits for real status events** on a WebSocket, then **asserts** the final status is COMPLETE — without polling.

GQL-18 showed create → read-back → assert for **synchronous** APIs. Many systems are **event-driven**: you trigger an action, then the server pushes progress later. The **GraphQL Subscription node** is RedfireForge's workflow answer to Kafka's **consume-wait** pattern.

**Why a Subscription node instead of polling with a Query?**
A Query loop would hammer \`order(id)\` until status changes — wasteful and brittle. A Subscription opens **one WebSocket**, receives pushed events, and stops when a Stop rule matches.

**What you will configure on Watch Order Status**
1. **Subscription** — endpoint + \`orderStatus\` query (what to listen for)
2. **Variables** — \`{{orderId}}\` correlation (which order's events)
3. **Stop** — wall-clock timeout + message count (when to finish waiting)
4. **Output** — bind \`lastMessage\` → \`${LESSON19_FINAL_STATUS_VAR}\` for Assert

**Why bind orderId before subscribing?**
Create Order extracts \`$.createOrder.id\` → \`${LESSON19_ORDER_ID_VAR}\`. The subscription Variables JSON uses \`{{${LESSON19_ORDER_ID_VAR}}}\` **without extra quotes** (extraction stores JSON-serialized values) so each run listens only to **its** order.

**Why Stop tab controls?**
**After (seconds)** is the safety cap (like Kafka \`maxWaitMs\`). **After N messages** collects the full PENDING → PROCESSING → COMPLETE stream so \`lastMessage\` is the final COMPLETE payload.`,
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
  <text x="407" y="198" text-anchor="middle" fill="#94a3b8" font-size="6.5">Stop: 3 msgs · ${LESSON19_STOP_AFTER_SECS}s max</text>
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
  <text x="152" y="264" fill="#5eead4" font-size="9" font-weight="600">Intention: Create → Subscribe → Assert</text>
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
  <text x="372" y="303" text-anchor="middle" fill="#e2e8f0" font-size="8">${LESSON19_STOP_AFTER_SECS}</text>
  <text x="152" y="322" fill="#64748b" font-size="7.5">3 msgs = PENDING → PROCESSING → COMPLETE (~2s apart)</text>
  <text x="152" y="334" fill="#64748b" font-size="7.5">${LESSON19_STOP_AFTER_SECS}s wall-clock cap prevents hung workflows (like Kafka maxWaitMs)</text>
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
      title: 'What This Lesson Builds',
      description:
        `**Intention:** prove an **async** flow — Create → wait for pushed events → Assert — not just that a mutation returns 200.\n\n` +
        `1. **Create Order** (Mutation) — trigger work + extract \`${LESSON19_ORDER_ID_VAR}\`\n` +
        `2. **Watch Order Status** (Subscription) — WebSocket until COMPLETE\n` +
        `3. **Assert Complete** — verify the final event\n\n` +
        `Kafka **consume-wait** for GraphQL. Seeded workflow **${LESSON19_WF_NAME}** is on the canvas; you will inspect Create, then configure Watch.`,
      highlight: WF.PAL_GQL_SUBSCRIPTION,
      pauseAfter: true,
    },

    {
      id: 'gql19-create-order',
      title: 'Create Order — Trigger & Extract orderId',
      description:
        `Open **Create Order** (amber **M**). The demo walks the seeded config:\n\n` +
        `1. **Operation** — endpoint + \`createOrder\` mutation\n` +
        `2. **Variables** — \`customerId\` / items input\n` +
        `3. **Extraction** — \`$.createOrder.id\` → \`${LESSON19_ORDER_ID_VAR}\`\n\n` +
        `That \`${LESSON19_ORDER_ID_VAR}\` is what Watch will correlate on. Assert Complete is already wired to \`${LESSON19_FINAL_STATUS_VAR}\` — your remaining job is configuring the teal **S** Watch node.`,
      highlight: GQL.WF_QUERY_EDITOR,
      preAction: prepareLesson19CreateOrderSpotlight,
      action: async (ctx) => {
        await performLesson19CreateOrderTour(ctx);
        await ctx.delay(400);
      },
      verify: GQL.WF_CANVAS_MUTATION_NODE,
      pauseAfter: true,
    },

    {
      id: 'gql19-config-sub',
      title: 'Subscription Tab — Endpoint & Query',
      description:
        `Open **Watch Order Status**. On **Subscription**, set the listen fields:\n\n` +
        `- **Endpoint:** \`${GQL_DEMO_HTTP}\`\n` +
        `- **Query:** \`WatchOrder\` → \`orderStatus(orderId: $orderId) { status updatedAt }\`\n\n` +
        `This answers *what stream?* — \`$orderId\` is declared here; the next step binds the runtime value from Create Order.`,
      highlight: GQL.WF_SUBSCRIPTION_QUERY_EDITOR,
      preAction: prepareLesson19SubscriptionSpotlight,
      action: async (ctx) => {
        await performLesson19SubscriptionConfigured(ctx);
        await ctx.delay(400);
      },
      verify: GQL.WF_CANVAS_SUBSCRIPTION_NODE,
      pauseAfter: true,
    },

    {
      id: 'gql19-variables',
      title: 'Variables — Correlate to This Order',
      description:
        `Still on **Subscription**, set **Variables** to:\n\n` +
        `\`${LESSON19_SUBSCRIPTION_VARS.replace(/\n/g, ' ')}\`\n\n` +
        `Use \`{{${LESSON19_ORDER_ID_VAR}}}\` **without quotes** (extraction stores JSON-serialized scalars). ` +
        `That scopes the WebSocket to **this run's order** — the GraphQL equivalent of a Kafka correlation expression.`,
      highlight: GQL.WF_SUB_VARIABLES_EDITOR,
      preAction: async (ctx) => {
        await ensureLesson19WorkflowLoaded(ctx);
        if (!isLesson19SubOperationReady()) {
          await ensureLesson19SubscriptionConfigured(ctx);
        }
        await prepareLesson19VariablesSpotlight(ctx);
      },
      action: async (ctx) => {
        await performLesson19SubscriptionVariables(ctx);
        await ctx.delay(400);
      },
      verify: GQL.WF_CANVAS_SUBSCRIPTION_NODE,
      pauseAfter: true,
    },

    {
      id: 'gql19-timeout',
      title: 'Stop Tab — Wall-Clock Safety Cap',
      description:
        `Open **Stop**. Set **After (seconds)** to **${LESSON19_STOP_AFTER_SECS}** — the max wait before the node exits (like Kafka \`maxWaitMs\`).\n\n` +
        `Docker emits three events ~2 s apart (~6 s total); **${LESSON19_STOP_AFTER_SECS}s** leaves headroom so a hung WebSocket fails fast.`,
      highlight: GQL.WF_STOP_SECS_INPUT,
      preAction: async (ctx) => {
        await ensureLesson19WorkflowLoaded(ctx);
        if (!isLesson19SubVariablesReady()) {
          await ensureLesson19SubscriptionVariables(ctx);
        }
        await prepareLesson19StopTimeoutSpotlight(ctx);
      },
      action: async (ctx) => {
        await performLesson19SubscriptionTimeout(ctx);
        await ctx.delay(400);
      },
      verify: GQL.WF_CANVAS_SUBSCRIPTION_NODE,
      pauseAfter: true,
    },

    {
      id: 'gql19-correlation',
      title: 'Stop Tab — Collect All Three Status Events',
      description:
        `Still on **Stop**, set **After N messages** to **${LESSON19_STOP_AFTER_MESSAGES}**.\n\n` +
        `Docker emits **PENDING → PROCESSING → COMPLETE**. Collecting **3** makes \`lastMessage\` the final COMPLETE payload — not an intermediate PENDING.`,
      highlight: GQL.WF_STOP_MESSAGES_INPUT,
      preAction: async (ctx) => {
        await ensureLesson19WorkflowLoaded(ctx);
        if (!isLesson19SubVariablesReady()) {
          await ensureLesson19SubscriptionVariables(ctx);
        }
        await ensureLesson19SubscriptionTimeout(ctx);
        await prepareLesson19StopMessagesSpotlight(ctx);
      },
      action: async (ctx) => {
        await performLesson19SubscriptionCorrelation(ctx);
        await ctx.delay(400);
      },
      verify: GQL.WF_CANVAS_SUBSCRIPTION_NODE,
      pauseAfter: true,
    },

    {
      id: 'gql19-sample-payload',
      title: 'Output — Hand Final Event to Assert',
      description:
        `Open **Output**. **+ Add** a binding:\n\n` +
        `- **Field:** \`lastMessage\`\n` +
        `- **Variable:** \`${LESSON19_FINAL_STATUS_VAR}\`\n\n` +
        `Assert Complete already checks \`$.orderStatus.status\` = **COMPLETE** on that variable. Save closes the panel — next step runs Quick Test.`,
      highlight: GQL.WF_OUTPUT_ADD_BTN,
      preAction: async (ctx) => {
        await ensureLesson19WorkflowLoaded(ctx);
        if (!isLesson19SubVariablesReady()) {
          await ensureLesson19SubscriptionVariables(ctx);
        }
        await ensureLesson19SubscriptionTimeout(ctx);
        await ensureLesson19SubscriptionCorrelation(ctx);
        await prepareLesson19OutputSpotlight(ctx);
      },
      action: async (ctx) => {
        await performLesson19SubscriptionOutputBound(ctx);
        await ctx.delay(400);
      },
      verify: GQL.WF_CANVAS_SUBSCRIPTION_NODE,
      pauseAfter: true,
    },

    {
      id: 'gql19-quick-test',
      title: 'Quick Test — Prove the Event Chain',
      description:
        `Console open → **▶ Quick Test**:\n\n` +
        `1. **Create Order** → \`${LESSON19_ORDER_ID_VAR}\`\n` +
        `2. **Watch** — 3 WebSocket events\n` +
        `3. **Assert** — status **COMPLETE**\n\n` +
        `~7–8 s on local Docker. Watch the green strip and Console messages.`,
      highlight: WF.QUICK_TEST_BTN,
      preAction: async (ctx) => {
        await ensureLesson19SubscriptionOutputBound(ctx);
        await prepareLesson19QuickTestSpotlight(ctx);
      },
      action: async (ctx) => {
        await performLesson19QuickTestRun(ctx);
        await ctx.delay(400);
      },
      verify: WF.EXEC_SUMMARY,
      pauseAfter: true,
    },

    {
      id: 'gql19-load-behavior',
      title: 'Why Variables Matter Under Load',
      description:
        `Re-check **Stop → After N messages = ${LESSON19_STOP_AFTER_MESSAGES}**.\n\n` +
        `Under Runner concurrency, each iteration gets its own \`${LESSON19_ORDER_ID_VAR}\`. ` +
        `Variables \`{{${LESSON19_ORDER_ID_VAR}}}\` keeps each WebSocket on its own order so A never asserts on B's COMPLETE.`,
      highlight: GQL.WF_STOP_MESSAGES_INPUT,
      preAction: async (ctx) => {
        await ensureLesson19SubscriptionOutputBound(ctx);
        await prepareLesson19StopMessagesSpotlight(ctx);
      },
      pauseAfter: true,
    },

    {
      id: 'gql19-summary',
      title: 'Summary — Create → Subscribe → Assert',
      description:
        `Event-driven integration test pattern:\n\n` +
        `1. **Mutation** — trigger + extract correlation id\n` +
        `2. **Subscription** — query + Variables + Stop + Output\n` +
        `3. **Assert** — verify the final event\n\n` +
        `Split: **query** = what; **Variables** = which; **Stop** = when; **Output** = what Assert reads.`,
      highlight: WF.CANVAS,
      preAction: prepareLesson19SummarySpotlight,
      pauseAfter: true,
    },
  ],
};
