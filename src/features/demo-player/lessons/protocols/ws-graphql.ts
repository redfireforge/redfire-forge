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

Instead of typing raw JSON, you write a **GraphQL query** in the Compose panel:

\`\`\`graphql
subscription {
  countdown(from: 5)
}
\`\`\`

RedfireForge wraps this into a \`subscribe\` frame with an auto-assigned operation ID and sends it to the server.

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
    diagram: `<pre>Browser                      GraphQL-WS Server (:4100)
  |                                   |
  |  HTTP Upgrade → WebSocket         |
  |  Sec-WebSocket-Protocol:          |
  |  graphql-transport-ws             |
  |----------------------------------&gt;|
  |  101 Switching Protocols          |
  |&lt;----------------------------------|
  |                                   |
  |  {"type":"connection_init"}       |  ← auto-sent by RedfireForge
  |----------------------------------&gt;|
  |  {"type":"connection_ack"}        |
  |&lt;----------------------------------|
  |                                   |
  |  {"type":"subscribe","id":"1",    |  ← Compose → Send
  |   "payload":{"query":             |
  |   "subscription{countdown(5)}"}}  |
  |----------------------------------&gt;|
  |  {"type":"next","id":"1",         |  ← streamed data (×6)
  |   "payload":{"data":              |
  |   {"countdown":5}}}               |
  |&lt;----------------------------------|
  |  (4, 3, 2, 1, 0 follow…)          |
  |  {"type":"complete","id":"1"}     |  ← server-sent end of stream
  |&lt;----------------------------------|</pre>`,
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
      title: 'GraphQL-WS Compose Fields',
      description: 'The Compose panel has three GraphQL-specific fields: **Operation Name** (optional label for the operation, e.g. `CountdownSub`), **Variables** (a JSON textarea for `$variables` in parameterized queries), and the **Op # counter** — an auto-incrementing ID that RedfireForge assigns to each subscription so the Events log can track which `next` frames belong to which operation.',
      highlight: WS.GQL_COMPOSE_FIELDS,
      pauseAfter: true,
      // preAction navigates to Compose before the spotlight so gql-compose-fields is in the DOM
      preAction: async (ctx: DemoActionContext) => {
        await ctx.click(WS.LEFT_TAB_COMPOSE);
      },
      action: async (ctx: DemoActionContext) => {
        await ctx.delay(500);
      },
    },
    {
      id: 'gql-subscribe',
      title: 'Start a Countdown Subscription',
      description: 'The query `subscription { countdown(from: 5) }` is pre-filled and ready in the Compose panel. Clicking **Send** wraps it in a `subscribe` frame with the current Op ID, sends it to the server, then switches to the Events tab to watch the countdown arrive. The server streams back six **next** frames — `5, 4, 3, 2, 1, 0` — one every 500ms, then a **complete** to signal end of stream.',
      highlight: WS.SEND_BTN,
      pauseAfter: true,
      // preAction ensures connection + sets up the Compose panel with the subscription query
      preAction: async (ctx: DemoActionContext) => {
        // Ensure WebSocket is connected before trying to send (skip-to-step guard)
        if (!document.querySelector(WS.STATUS_CONNECTED)) {
          await ctx.click(WS.LEFT_TAB_CONNECT);
          await ctx.delay(200);
          await ctx.click(WS.CONNECT_BTN);
          await ctx.waitFor(WS.STATUS_CONNECTED);
          await ctx.delay(300);
        }
        await ctx.click(WS.LEFT_TAB_COMPOSE);
        await ctx.delay(200);
        await ctx.fill(WS.MESSAGE_INPUT, 'subscription { countdown(from: 5) }');
        await ctx.delay(300);
      },
      action: async (ctx: DemoActionContext) => {
        // Send the subscription — op ID increments to 2 after this
        await ctx.click(WS.SEND_BTN);
        await ctx.delay(500);
        // Switch to Events to show subscribe frame + incoming next frames
        await ctx.click(WS.RIGHT_TAB_EVENTS);
        await ctx.delay(500);
        // Wait for the full countdown: 6 values × 500ms + buffer = ~3.8s
        // By the time pauseAfter kicks in, ALL data (including complete) is visible.
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
