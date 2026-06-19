/**
 * Lesson 12: GraphQL Subscriptions
 *
 * Demonstrates GraphQL-WS subscriptions over WebSocket using a real
 * GraphQL server running in Docker:
 *  - The automatic connection_init / connection_ack handshake
 *  - Writing a subscription query (countdown from 5)
 *  - Watching next frames stream in real time
 *  - The full frame lifecycle: connection_init → connection_ack → subscribe → next × 6 → complete
 *  - Clean disconnect
 *
 * Requires: docker/websocket/graphql/docker-compose.yml
 */
import type { DemoActionContext, DemoLesson } from '../../types';
import { disconnectWebSocket, clearEvents } from '../setup-helpers';
import { WS } from '../../../../shared/selectors';

// ── Constants ──────────────────────────────────────────────────
const GQL_URL = 'ws://localhost:4100/graphql';
const GQL_SUBPROTOCOL = 'graphql-transport-ws';
const GQL_OP_NAME = 'CountdownSub';
const GQL_QUERY_PARAM = 'subscription CountdownSub($start: Int!) {\n  countdown(from: $start)\n}';
const GQL_VARIABLES_JSON = '{\n  "start": 5\n}';

// ── Setup / Cleanup ─────────────────────────────────────────────

async function gqlSetup(ctx: DemoActionContext): Promise<void> {
  await ctx.delay(300);
  await disconnectWebSocket(ctx);
  await ctx.delay(200);
  await clearEvents(ctx);
  await ctx.delay(200);
  // Ensure client mode
  await ctx.click(WS.MODE_CLIENT);
  await ctx.delay(300);
  // Navigate to Connect tab and pre-populate URL + subprotocol + protocol
  await ctx.click(WS.LEFT_TAB_CONNECT);
  await ctx.delay(200);
  await ctx.fill(WS.URL_INPUT, GQL_URL);
  await ctx.delay(200);
  // Fill subprotocol — required by the graphql-transport-ws server
  await ctx.fill(WS.SUBPROTOCOLS_INPUT, GQL_SUBPROTOCOL);
  await ctx.delay(200);
  await ctx.selectOption(WS.PROTOCOL_SELECT, 'graphql-ws');
  await ctx.delay(200);
}

async function gqlCleanup(ctx: DemoActionContext): Promise<void> {
  await disconnectWebSocket(ctx);
  await clearEvents(ctx);
  // Navigate to Connect tab to reset the protocol + subprotocol
  await ctx.click(WS.LEFT_TAB_CONNECT);
  await ctx.delay(200);
  await ctx.selectOption(WS.PROTOCOL_SELECT, 'raw');
  await ctx.delay(200);
  // Clear the subprotocol field
  await ctx.fill(WS.SUBPROTOCOLS_INPUT, '');
  await ctx.delay(100);
  await ctx.click(WS.MODE_CLIENT);
}

// ── Lesson ──────────────────────────────────────────────────────

export const wsGraphqlLesson: DemoLesson = {
  id: 'ws-graphql',
  domainId: 'protocols',
  category: 'websocket',
  name: 'GraphQL Subscriptions',
  description: 'Connect to a GraphQL-WS server, start a countdown subscription, and watch live next frames stream in.',
  estimatedMinutes: 3,
  initialTab: 'websocket-studio',
  tag: '🐳 Docker',
  dockerEndpoint: GQL_URL,
  dockerCommand: 'docker compose -f docker/websocket/graphql/docker-compose.yml up -d',

  setup: gqlSetup,
  cleanup: gqlCleanup,

  concept: {
    title: 'GraphQL Subscriptions over WebSocket',
    body: `**GraphQL-WS** is a protocol for running GraphQL subscriptions over WebSocket. It's used by Apollo Client, urql, and most modern GraphQL backends — and it's completely different from raw WebSocket or STOMP.

**The automatic handshake:**

When you click **Connect** with Protocol set to GraphQL-WS, RedfireForge automatically sends a \`connection_init\` frame. The server replies with \`connection_ack\`. You don't send this manually — it happens the moment the WebSocket transport opens.

**Starting a subscription:**

Instead of typing raw JSON, you fill three fields in the **Send** panel:

\`\`\`graphql
subscription CountdownSub($start: Int!) {
  countdown(from: $start)
}
\`\`\`

Set **Op. Name** to \`CountdownSub\`, pass \`{"start": 5}\` in the **Variables** tab, and RedfireForge bundles all three into a single \`subscribe\` frame — \`{"type":"subscribe","id":"1","payload":{"operationName":"CountdownSub","query":"...","variables":{"start":5}}}\` — sent to the server.

**What you'll see in the Events log:**

| Frame | Direction | What it means |
|---|---|---|
| \`connection_init\` | ◆ auto-sent | Client announces GraphQL-WS intent |
| \`connection_ack\` | ◆ received | Server ready — you can now subscribe |
| \`subscribe\` | ↑ sent | Start the countdown subscription |
| \`next\` × 6 | ↓ received | One result per tick: 5, 4, 3, 2, 1, 0 |
| \`complete\` | ↓ received | Server finished — no more data |

**Why two "protocol" fields?**

GraphQL-WS needs two settings:
1. **Protocol dropdown** → \`GraphQL-WS\` tells RedfireForge how to decode frames
2. **Subprotocols field** → \`graphql-transport-ws\` goes in the \`Sec-WebSocket-Protocol\` HTTP header — the server uses this to verify you speak the same wire protocol`,
    keyTerms: [
      {
        term: 'graphql-transport-ws',
        definition: 'The WebSocket subprotocol ID negotiated on connect. Goes in the Sec-WebSocket-Protocol header. Different from the Protocol dropdown, which tells RedfireForge how to decode messages.',
      },
      {
        term: 'connection_init / connection_ack',
        definition: 'The GraphQL-WS-level handshake. RedfireForge auto-sends connection_init when the WebSocket opens; the server replies with connection_ack before accepting subscriptions.',
      },
      {
        term: 'subscribe',
        definition: 'The operation start frame sent by the client. Contains an operation ID (for tracking), the GraphQL query string, and optional variables.',
      },
      {
        term: 'next',
        definition: 'A data delivery frame from the server. Each next carries one GraphQL result in payload.data. Subscriptions stream multiple next frames over time.',
      },
      {
        term: 'complete',
        definition: 'End-of-stream marker sent by the server. After complete, no more next frames arrive for that operation ID. The subscription is finished.',
      },
      {
        term: 'Operation ID',
        definition: 'A client-assigned string that tags every frame for a given subscription. RedfireForge shows "Op #N" and increments it after each send, so you can track multiple concurrent subscriptions.',
      },
    ],
    diagram: `<svg viewBox="0 0 590 322" xmlns="http://www.w3.org/2000/svg" style="font-family:system-ui,sans-serif">
  <defs>
    <marker id="gql-g" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="#4ade80"/></marker>
    <marker id="gql-a" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="#f59e0b"/></marker>
    <marker id="gql-b" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="#60a5fa"/></marker>
    <marker id="gql-p" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="#a78bfa"/></marker>
  </defs>
  <!-- Participants -->
  <rect x="15" y="10" width="120" height="32" rx="5" fill="#1e293b" stroke="#4ade80" stroke-width="1.5"/>
  <text x="75" y="31" text-anchor="middle" fill="#e2e8f0" font-size="12" font-weight="600">Browser</text>
  <rect x="404" y="10" width="176" height="32" rx="5" fill="#1e293b" stroke="#a78bfa" stroke-width="1.5"/>
  <text x="492" y="31" text-anchor="middle" fill="#e2e8f0" font-size="12" font-weight="600">GraphQL-WS (:4100)</text>
  <!-- Lifelines -->
  <line x1="75" y1="42" x2="75" y2="298" stroke="#334155" stroke-width="1.5" stroke-dasharray="4 3"/>
  <line x1="492" y1="42" x2="492" y2="298" stroke="#334155" stroke-width="1.5" stroke-dasharray="4 3"/>
  <!-- 1 · HTTP Upgrade + subprotocol — Browser→Server (green) -->
  <line x1="75" y1="70" x2="492" y2="70" stroke="#4ade80" stroke-width="1.5" marker-end="url(#gql-g)"/>
  <text x="283" y="65" text-anchor="middle" fill="#4ade80" font-size="10" font-family="'Fira Code',monospace">HTTP Upgrade + graphql-transport-ws</text>
  <!-- 2 · 101 — Server→Browser (green) -->
  <line x1="492" y1="100" x2="75" y2="100" stroke="#4ade80" stroke-width="1.5" marker-end="url(#gql-g)"/>
  <text x="283" y="95" text-anchor="middle" fill="#4ade80" font-size="10" font-family="'Fira Code',monospace">101 Switching Protocols</text>
  <!-- 3 · connection_init — Browser→Server (amber, auto-sent) -->
  <line x1="75" y1="130" x2="492" y2="130" stroke="#f59e0b" stroke-width="1.5" marker-end="url(#gql-a)"/>
  <text x="283" y="125" text-anchor="middle" fill="#f59e0b" font-size="10" font-family="'Fira Code',monospace">{"type":"connection_init"}</text>
  <text x="283" y="142" text-anchor="middle" fill="#475569" font-size="9" font-style="italic">auto-sent by RedfireForge</text>
  <!-- 4 · connection_ack — Server→Browser (amber) -->
  <line x1="492" y1="168" x2="75" y2="168" stroke="#f59e0b" stroke-width="1.5" marker-end="url(#gql-a)"/>
  <text x="283" y="163" text-anchor="middle" fill="#f59e0b" font-size="10" font-family="'Fira Code',monospace">{"type":"connection_ack"}</text>
  <!-- 5 · subscribe — Browser→Server (blue) -->
  <line x1="75" y1="200" x2="492" y2="200" stroke="#60a5fa" stroke-width="1.5" marker-end="url(#gql-b)"/>
  <text x="283" y="195" text-anchor="middle" fill="#60a5fa" font-size="10" font-family="'Fira Code',monospace">{"type":"subscribe","query":"subscription{…}"}</text>
  <!-- 6 · next (streaming ×6) — Server→Browser (purple) -->
  <line x1="492" y1="232" x2="75" y2="232" stroke="#a78bfa" stroke-width="1.5" marker-end="url(#gql-p)"/>
  <text x="283" y="227" text-anchor="middle" fill="#a78bfa" font-size="10" font-family="'Fira Code',monospace">{"type":"next","payload":{"countdown":5..0}}</text>
  <text x="283" y="244" text-anchor="middle" fill="#475569" font-size="9" font-style="italic">streamed × 6 events</text>
  <!-- 7 · complete — Server→Browser (amber) -->
  <line x1="492" y1="276" x2="75" y2="276" stroke="#f59e0b" stroke-width="1.5" marker-end="url(#gql-a)"/>
  <text x="283" y="271" text-anchor="middle" fill="#f59e0b" font-size="10" font-family="'Fira Code',monospace">{"type":"complete","id":"1"}</text>
  <!-- Legend -->
  <circle cx="20" cy="308" r="4" fill="#4ade80"/><text x="29" y="312" fill="#64748b" font-size="9">WS handshake</text>
  <circle cx="115" cy="308" r="4" fill="#f59e0b"/><text x="124" y="312" fill="#64748b" font-size="9">GQL-WS protocol</text>
  <circle cx="218" cy="308" r="4" fill="#60a5fa"/><text x="227" y="312" fill="#64748b" font-size="9">subscribe</text>
  <circle cx="278" cy="308" r="4" fill="#a78bfa"/><text x="287" y="312" fill="#64748b" font-size="9">streaming data</text>
</svg>`,
  },

  steps: [
    {
      id: 'gql-intro',
      title: 'Connect Panel — Pre-Configured',
      description: 'The Connect panel is ready: URL is `ws://localhost:4100/graphql` (the GraphQL-WS Docker server), **Subprotocols** is `graphql-transport-ws` (the wire protocol the server requires in the HTTP handshake header), and **Protocol** is `GraphQL-WS` (tells RedfireForge to decode frames as GraphQL-WS messages). Two fields — one for the wire header, one for the decoder.',
      highlight: WS.LEFT_TAB_CONNECT,
      pauseAfter: true,
      action: async (ctx: DemoActionContext) => {
        await ctx.click(WS.LEFT_TAB_CONNECT);
        await ctx.delay(400);
      },
    },
    {
      id: 'gql-protocol',
      title: 'What "Protocol: GraphQL-WS" Does',
      description: 'With **Protocol: GraphQL-WS** selected, RedfireForge handles the entire handshake automatically — sending `connection_init` the moment the WebSocket opens and labeling each message by its type: `connection_init`, `connection_ack`, `subscribe`, `next`, `error`, and `complete`. Instead of raw JSON blobs you see clean, labeled rows in the Events log.',
      highlight: WS.PROTOCOL_SELECT,
      pauseAfter: true,
      // preAction ensures Connect panel (which contains PROTOCOL_SELECT) is in the DOM before spotlight
      preAction: async (ctx: DemoActionContext) => {
        await ctx.click(WS.LEFT_TAB_CONNECT);
      },
      action: async (ctx: DemoActionContext) => {
        await ctx.delay(300);
      },
    },
    {
      id: 'gql-connect',
      title: 'Connect — Automatic Handshake',
      description: 'Click **Connect** to open the WebSocket transport. RedfireForge immediately sends `{"type":"connection_init"}` — you don\'t type it. The server replies with `{"type":"connection_ack"}`. Both frames appear in the Events tab as labeled system rows (◆). Only after **connection_ack** can you start subscriptions.',
      highlight: WS.RIGHT_TAB_EVENTS,
      pauseAfter: true,
      preAction: async (ctx: DemoActionContext) => {
        await ctx.click(WS.LEFT_TAB_CONNECT);
      },
      action: async (ctx: DemoActionContext) => {
        // Skip CONNECT_BTN if already connected (replay guard)
        if (!document.querySelector(WS.STATUS_CONNECTED)) {
          await ctx.click(WS.CONNECT_BTN);
        }
        // Wait for WS to open (more robust than fixed 1500ms delay)
        await ctx.waitFor(WS.STATUS_CONNECTED);
        await ctx.delay(500); // allow connection_init / connection_ack round-trip to complete
        // Show Events tab to reveal the handshake frames
        await ctx.click(WS.RIGHT_TAB_EVENTS);
        await ctx.delay(700);
      },
    },
    {
      id: 'gql-compose',
      title: 'Operation Name, Query & Variables',
      description:
        'The **Send** panel has three linked fields working together:\n\n' +
        '1. **Op. Name** — type `CountdownSub` to give this operation a human-readable label. It appears in the Events log and inside the `subscribe` frame payload.\n' +
        '2. **Query tab** — write the GraphQL operation using `$start` as a typed parameter: `subscription CountdownSub($start: Int!) { countdown(from: $start) }`. The `$start` variable references whatever JSON value you put in step 3.\n' +
        '3. **Variables tab** — paste `{"start": 5}` here. When you click Send, RedfireForge merges the query, the operation name, and these variables into a single `subscribe` frame sent to the server.\n\n' +
        'Watch the demo fill all three in sequence.',
      highlight: WS.GQL_COMPOSE_FIELDS,
      pauseAfter: true,
      preAction: async (ctx: DemoActionContext) => {
        await ctx.click(WS.LEFT_TAB_SEND);
        await ctx.delay(300);
      },
      action: async (ctx: DemoActionContext) => {
        // 1. Fill operation name
        await ctx.fill(WS.GQL_OPERATION_NAME, GQL_OP_NAME);
        await ctx.delay(600);
        // 2. Fill the parameterized query in the Query tab (default active tab)
        await ctx.fill(WS.MESSAGE_INPUT, GQL_QUERY_PARAM);
        await ctx.delay(700);
        // 3. Switch to Variables tab to show the JSON input
        await ctx.click(WS.GQL_TAB_VARIABLES);
        await ctx.delay(500);
        // 4. Fill the variables JSON
        await ctx.fill(WS.GQL_VARIABLES, GQL_VARIABLES_JSON);
        await ctx.delay(800);
        // 5. Return to Query tab so the viewer sees the full picture before Send
        await ctx.click(WS.GQL_TAB_QUERY);
        await ctx.delay(400);
      },
    },
    {
      id: 'gql-subscribe',
      title: 'Send — All Three Fields in One Frame',
      description:
        'The compose panel is fully configured: **Op. Name** `CountdownSub`, **Query** uses `$start`, and **Variables** `{"start": 5}`. ' +
        'Clicking **Send** bundles all three into a single `subscribe` frame:\n\n' +
        '```json\n{"type":"subscribe","id":"1","payload":{"operationName":"CountdownSub","query":"subscription CountdownSub($start: Int!) {...}","variables":{"start":5}}}\n```\n\n' +
        'The server runs `countdown(from: 5)` and streams back six **next** frames — `5, 4, 3, 2, 1, 0` — then **complete**. ' +
        'Every frame in the Events log is tagged with **Op #1** so you can track it even if you had multiple subscriptions running in parallel.',
      highlight: WS.SEND_BTN,
      pauseAfter: true,
      preAction: async (ctx: DemoActionContext) => {
        // Ensure WebSocket is connected before trying to send (skip-to-step guard)
        if (!document.querySelector(WS.STATUS_CONNECTED)) {
          await ctx.click(WS.LEFT_TAB_CONNECT);
          await ctx.delay(200);
          await ctx.click(WS.CONNECT_BTN);
          await ctx.waitFor(WS.STATUS_CONNECTED);
          await ctx.delay(300);
        }
        await ctx.click(WS.LEFT_TAB_SEND);
        await ctx.delay(200);
        // Re-establish all three fields silently in case this step was skipped to
        await ctx.fill(WS.GQL_OPERATION_NAME, GQL_OP_NAME);
        await ctx.delay(100);
        await ctx.fill(WS.MESSAGE_INPUT, GQL_QUERY_PARAM);
        await ctx.delay(100);
        // Switch to Variables tab to fill JSON, then back to Query tab
        await ctx.click(WS.GQL_TAB_VARIABLES);
        await ctx.delay(200);
        await ctx.fill(WS.GQL_VARIABLES, GQL_VARIABLES_JSON);
        await ctx.delay(100);
        await ctx.click(WS.GQL_TAB_QUERY);
        await ctx.delay(200);
      },
      action: async (ctx: DemoActionContext) => {
        await ctx.click(WS.SEND_BTN);
        await ctx.delay(500);
        // Switch to Events to show subscribe frame + incoming next frames
        await ctx.click(WS.RIGHT_TAB_EVENTS);
        await ctx.delay(500);
        // Wait for the full countdown: 6 values × 500ms + buffer = ~3.8s
        await ctx.delay(3800);
      },
    },
    {
      id: 'gql-frames',
      title: 'Full Lifecycle in the Events Log',
      description: 'The Events log shows the complete GraphQL-WS lifecycle: **connection_init ◆** and **connection_ack ◆** (the automatic handshake), **subscribe ↑** (the operation you started), six **next ↓** rows — `{"countdown":5}` through `{"countdown":0}` — arriving at 500ms intervals, then **complete ↓** (the server signaling end of stream). Each frame is labeled by type so you always know exactly what stage the subscription is at.',
      highlight: WS.RIGHT_TAB_EVENTS,
      pauseAfter: true,
      preAction: async (ctx: DemoActionContext) => {
        await ctx.click(WS.RIGHT_TAB_EVENTS);
      },
      action: async (ctx: DemoActionContext) => {
        await ctx.delay(600);
      },
    },
    {
      id: 'gql-disconnect',
      title: 'Disconnect',
      description: 'Clicking **Disconnect** closes the WebSocket transport — the status badge returns to grey and the protocol badge disappears. The countdown subscription already sent `complete`, so there is nothing left to cancel. In a real app, if subscriptions were still running at disconnect time, the `graphql-transport-ws` server would clean them up automatically — no explicit `complete_subscribe` needed from the client.',
      highlight: WS.DISCONNECT_BTN,
      pauseAfter: true,
      // preAction navigates to Connect tab so DISCONNECT_BTN is in the DOM for the spotlight
      preAction: async (ctx: DemoActionContext) => {
        await ctx.click(WS.LEFT_TAB_CONNECT);
      },
      action: async (ctx: DemoActionContext) => {
        await ctx.delay(400);
        // ctx.click shows the visual ripple on the Disconnect button
        await ctx.click(WS.DISCONNECT_BTN);
        await ctx.delay(800);
      },
    },
  ],
};
