/**
 * Lesson 11: STOMP / RabbitMQ
 *
 * Demonstrates STOMP (Simple Text Oriented Messaging Protocol) over WebSocket
 * using a real RabbitMQ broker running in Docker:
 *  - The two-step handshake: WebSocket transport first, STOMP CONNECT frame second
 *  - Destination-based routing: SUBSCRIBE to /queue/demo, then SEND to it
 *  - How every frame type is decoded in the Events tab
 *  - Graceful disconnect
 *
 * Requires: docker/websocket/stomp/docker-compose.yml
 */
import type { DemoActionContext, DemoLesson } from '../../types';
import { disconnectWebSocket, clearEvents } from '../setup-helpers';
import { WS } from '../../../../shared/selectors';

// ── Constants ──────────────────────────────────────────────────
const STOMP_URL = 'ws://localhost:15674/ws';

/** Reset STOMP command select back to SEND. */
async function resetStompCommand(ctx: DemoActionContext) {
  const cmd = document.querySelector(WS.STOMP_COMMAND) as HTMLSelectElement | null;
  if (cmd) {
    cmd.value = 'SEND';
    cmd.dispatchEvent(new Event('change', { bubbles: true }));
  }
  await ctx.delay(100);
}

/**
 * Guard used by preActions of steps 5+ to ensure WS transport is open AND
 * a STOMP CONNECT frame has been sent (so the broker accepts SUBSCRIBE/SEND).
 * Called only when the user skips directly to a late step.
 */
async function ensureStompSession(ctx: DemoActionContext): Promise<void> {
  if (document.querySelector(WS.STATUS_CONNECTED)) return;
  // Establish WebSocket transport
  await ctx.click(WS.LEFT_TAB_CONNECT);
  await ctx.delay(200);
  await ctx.click(WS.CONNECT_BTN);
  await ctx.waitFor(WS.STATUS_CONNECTED);
  await ctx.delay(300);
  // Send STOMP CONNECT frame so the broker accepts subsequent frames
  await ctx.click(WS.LEFT_TAB_COMPOSE);
  await ctx.delay(200);
  await ctx.selectOption(WS.STOMP_COMMAND, 'CONNECT');
  await ctx.delay(200);
  await ctx.fill(WS.STOMP_DESTINATION, '/');
  await ctx.delay(150);
  await ctx.fill(WS.STOMP_LOGIN, 'guest');
  await ctx.delay(150);
  await ctx.fill(WS.STOMP_PASSCODE, 'guest');
  await ctx.delay(150);
  await ctx.click(WS.SEND_BTN);
  await ctx.delay(600); // allow CONNECTED reply from broker
}

// ── Setup / Cleanup ─────────────────────────────────────────────

async function stompSetup(ctx: DemoActionContext): Promise<void> {
  await ctx.delay(400);
  await disconnectWebSocket(ctx);
  await ctx.delay(200);
  await clearEvents(ctx);
  await ctx.delay(200);
  // Ensure client mode
  await ctx.click(WS.MODE_CLIENT);
  await ctx.delay(300);
  // Navigate to Connect tab and pre-populate URL + protocol.
  // Always clear the Subprotocols field — a previous lesson (e.g. GraphQL) may have
  // left "graphql-transport-ws" in it, which causes RabbitMQ to reject the connection
  // with "Sent non-empty Sec-WebSocket-Protocol header but no response was received".
  await ctx.click(WS.LEFT_TAB_CONNECT);
  await ctx.delay(200);
  await ctx.fill(WS.URL_INPUT, STOMP_URL);
  await ctx.delay(200);
  await ctx.fill(WS.SUBPROTOCOLS_INPUT, '');
  await ctx.delay(150);
  await ctx.selectOption(WS.PROTOCOL_SELECT, 'stomp');
  await ctx.delay(200);
}

async function stompCleanup(ctx: DemoActionContext): Promise<void> {
  await disconnectWebSocket(ctx);
  await clearEvents(ctx);
  // Reset STOMP command to SEND before resetting protocol to raw
  // (resetStompCommand needs protocol still set to stomp so compose fields are rendered)
  await ctx.click(WS.LEFT_TAB_COMPOSE);
  await ctx.delay(200);
  await resetStompCommand(ctx);
  await ctx.delay(100);
  // Reset protocol
  await ctx.click(WS.LEFT_TAB_CONNECT);
  await ctx.delay(200);
  await ctx.selectOption(WS.PROTOCOL_SELECT, 'raw');
  await ctx.delay(200);
  await ctx.click(WS.MODE_CLIENT);
}

// ── Lesson ──────────────────────────────────────────────────────

export const wsStompLesson: DemoLesson = {
  id: 'ws-stomp',
  domainId: 'protocols',
  category: 'websocket',
  name: 'STOMP / RabbitMQ',
  description: 'Connect to RabbitMQ over STOMP, subscribe to a queue, publish a message, and watch the decoded frame log.',
  estimatedMinutes: 4,
  initialTab: 'websocket-studio',
  tag: '🐳 Docker',
  dockerEndpoint: STOMP_URL,
  dockerCommand: 'docker compose -f docker/websocket/stomp/docker-compose.yml up -d',

  setup: stompSetup,
  cleanup: stompCleanup,

  concept: {
    title: 'STOMP over WebSocket',
    body: `**STOMP** (Simple Text Oriented Messaging Protocol) is a text-based messaging protocol that runs on top of WebSocket — and inside message brokers like **RabbitMQ**, ActiveMQ, and Artemis.

**The two-step handshake:**

Unlike raw WebSocket or Socket.IO, connecting to a STOMP broker is a two-step process:
1. The **WebSocket transport** opens first (just the TCP/WS layer)
2. Then you send a **STOMP CONNECT** frame with your credentials — and wait for the broker's **CONNECTED** reply

Only after step 2 can you subscribe or publish.

**What makes STOMP different:**

- Every message is a **frame** — structured text with a command, headers, and body
- Messages route by **destination** (e.g. \`/queue/demo\` or \`/topic/news\`) — not by event name
- **Queues** deliver each message to exactly one subscriber; **Topics** broadcast to all
- A **SUBSCRIBE** frame registers interest — after that, the broker pushes matching messages automatically

**Frame anatomy:**

\`\`\`
SEND
destination:/queue/demo
content-type:application/json
content-length:28

{"hello":"from RedfireForge!"}
\`\`\`

**Why this matters for testing:**

When testing a STOMP API (RabbitMQ, ActiveMQ, etc.), you need to verify the full publish/subscribe round trip — not just that the WS connection opens. RedfireForge decodes every STOMP frame type so you see \`CONNECTED\`, \`SUBSCRIBE\`, \`SEND\`, \`MESSAGE\`, and \`HEARTBEAT\` in clean, labeled rows instead of raw null-byte-terminated text.`,
    keyTerms: [
      {
        term: 'STOMP Frame',
        definition: 'The message unit in STOMP: COMMAND\\nheader1:value1\\n\\nbody\\0. Null-byte terminated, headers separated by newlines.',
      },
      {
        term: 'CONNECT / CONNECTED',
        definition: 'The STOMP-level handshake after the WebSocket transport opens. CONNECT carries credentials and heartbeat settings; CONNECTED confirms authentication and negotiates heartbeat intervals.',
      },
      {
        term: 'Destination',
        definition: 'A routing address like /queue/demo or /topic/news. Queues deliver each message once to one subscriber; topics fan out to all subscribers.',
      },
      {
        term: 'SUBSCRIBE',
        definition: 'A frame sent by the client to register interest in a destination. The broker will push a MESSAGE frame for every new message on that destination.',
      },
      {
        term: 'Heartbeat (♥)',
        definition: 'A single \\n character sent periodically to keep the connection alive. The heart-beat header in CONNECT negotiates the send/receive intervals.',
      },
    ],
    diagram: `<pre>Browser                  RabbitMQ (web-stomp :15674)
  |                               |
  |  HTTP Upgrade → WebSocket     |
  |------------------------------>|
  |  101 Switching Protocols      |
  |&lt;------------------------------|
  |                               |
  |  CONNECT               |  ← STOMP frame (step 2 of 2)
  |  host:localhost        |
  |  login:guest           |
  |  passcode:guest        |
  |------------------------------>|
  |  CONNECTED             |
  |  version:1.2           |
  |&lt;------------------------------|
  |                               |
  |  SUBSCRIBE             |  ← subscribe (step 3)
  |  dest:/queue/demo      |
  |------------------------------>|
  |                               |
  |  SEND                  |  ← publish (step 4)
  |  destination:/queue/   |
  |  {"hello":"from Redfire!"}    |
  |------------------------------>|
  |  MESSAGE               |  ← delivered back
  |  ←/queue/demo          |
  |  {"hello":"from Redfire!"}    |
  |&lt;------------------------------|</pre>`,
  },

  steps: [
    {
      id: 'stomp-intro',
      title: 'Connect Panel — Pre-Configured',
      description: 'The Connect panel shows `ws://localhost:15674/ws` — **RabbitMQ\'s web-STOMP port** (the management UI is on 15672; this is the WebSocket STOMP endpoint). Protocol is set to **STOMP**, which tells RedfireForge to decode every message as a STOMP frame. Connecting here opens only the WebSocket transport — a STOMP CONNECT frame must follow.',
      highlight: WS.LEFT_TAB_CONNECT,
      pauseAfter: true,
      action: async (ctx: DemoActionContext) => {
        await ctx.click(WS.LEFT_TAB_CONNECT);
        await ctx.delay(400);
      },
    },
    {
      id: 'stomp-protocol',
      title: 'What "Protocol: STOMP" Does',
      description: 'With **Protocol: STOMP** selected, RedfireForge decodes every frame in the Events tab. Instead of seeing raw null-byte-terminated text like `SEND↵destination:/queue/demo↵↵{"hello":"world"}↵\\0`, you see a clean row labeled **SEND → /queue/demo**. Incoming broker messages show as **MESSAGE ← /queue/demo**. System frames like **CONNECTED** and **HEARTBEAT (♥)** are visually distinguished.',
      highlight: WS.PROTOCOL_SELECT,
      pauseAfter: true,
      // preAction ensures Connect tab is visible so PROTOCOL_SELECT is in the DOM
      // before the spotlight renders (PROTOCOL_SELECT only exists inside the Connect panel).
      preAction: async (ctx: DemoActionContext) => {
        await ctx.click(WS.LEFT_TAB_CONNECT);
      },
      action: async (ctx: DemoActionContext) => {
        await ctx.delay(300);
      },
    },
    {
      id: 'stomp-connect-ws',
      title: 'The Two-Step Handshake: Connect + STOMP CONNECT',
      description: 'STOMP uses a **two-step handshake**. Step 1 — clicking **Connect** opens the WebSocket transport (status turns **green**). Step 2 — immediately a **STOMP CONNECT** frame is sent with virtual host `/`, login `guest`, passcode `guest`. The broker replies with a **CONNECTED** frame. Both steps happen in sequence — watch the Events tab fill with three entries.',
      highlight: WS.RIGHT_TAB_EVENTS,
      pauseAfter: true,
      // preAction ensures Connect tab is visible (for the highlight to make sense)
      preAction: async (ctx: DemoActionContext) => {
        await ctx.click(WS.LEFT_TAB_CONNECT);
      },
      action: async (ctx: DemoActionContext) => {
        // ── Step 1: Open the WebSocket transport ───────────────────
        // Replay guard: skip WS connect if already open from a prior pass.
        if (!document.querySelector(WS.STATUS_CONNECTED)) {
          await ctx.click(WS.CONNECT_BTN);
        }
        await ctx.waitFor(WS.STATUS_CONNECTED); // wait for green status dot (Rule 5)
        await ctx.delay(400); // brief pause to observe the green dot
        // Show Events — SYS entry for transport open should be visible
        await ctx.click(WS.RIGHT_TAB_EVENTS);
        await ctx.delay(600);
        // ── Step 2: Send STOMP CONNECT frame ───────────────────────
        await ctx.click(WS.LEFT_TAB_COMPOSE);
        await ctx.delay(300);
        // Select CONNECT command — triggers React re-render showing login/passcode fields
        await ctx.selectOption(WS.STOMP_COMMAND, 'CONNECT');
        await ctx.delay(400);
        // "host" in STOMP is the virtual host, not the TCP hostname.
        // RabbitMQ's default virtual host is "/".
        await ctx.fill(WS.STOMP_DESTINATION, '/');
        await ctx.delay(300);
        await ctx.fill(WS.STOMP_LOGIN, 'guest');
        await ctx.delay(300);
        await ctx.fill(WS.STOMP_PASSCODE, 'guest');
        await ctx.delay(300);
        await ctx.click(WS.SEND_BTN);
        await ctx.delay(800); // allow CONNECTED reply from broker
        // Show Events to reveal CONNECTED frame
        await ctx.click(WS.RIGHT_TAB_EVENTS);
        await ctx.delay(700);
      },
    },
    {
      id: 'stomp-handshake',
      title: 'Handshake in the Events Tab',
      description: 'Look at the Events log: **SYS** (WebSocket transport opened), **CONNECT → /** (the STOMP frame you sent), and **CONNECTED (v1.2)** (broker\'s reply confirming auth and protocol version). The STOMP session is established. Only after receiving **CONNECTED** can you subscribe to queues or publish messages.',
      highlight: WS.RIGHT_TAB_EVENTS,
      pauseAfter: true,
      preAction: async (ctx: DemoActionContext) => {
        await ctx.click(WS.RIGHT_TAB_EVENTS);
      },
      action: async (ctx: DemoActionContext) => {
        // Observation step — just a brief pause so the user can study the Events log
        await ctx.delay(600);
      },
    },
    {
      id: 'stomp-subscribe',
      title: 'Subscribe to /queue/demo',
      description: 'The compose panel is set to **SUBSCRIBE** targeting `/queue/demo`. Sending this frame tells RabbitMQ to deliver every message on that queue directly to this client. The auto-generated `id: sub-NNN` header lets the broker track which subscription each delivery belongs to — watch the **SUBSCRIBE** row appear in the Events log when the demo sends it.',
      highlight: WS.STOMP_COMPOSE_FIELDS,
      pauseAfter: true,
      // preAction ensures WS+STOMP session is active (connection guard), then
      // navigates to Compose and pre-populates SUBSCRIBE + destination so the
      // user reads the description while already seeing the correct compose state.
      preAction: async (ctx: DemoActionContext) => {
        await ensureStompSession(ctx); // Rule 4: guard for skip-to-step
        await ctx.click(WS.LEFT_TAB_COMPOSE);
        await ctx.delay(200);
        await ctx.selectOption(WS.STOMP_COMMAND, 'SUBSCRIBE');
        await ctx.delay(300);
        await ctx.fill(WS.STOMP_DESTINATION, '/queue/demo');
        await ctx.delay(200);
      },
      action: async (ctx: DemoActionContext) => {
        // Brief pause so the user sees the filled state, then send
        await ctx.delay(500);
        await ctx.click(WS.SEND_BTN);
        await ctx.delay(800);
      },
    },
    {
      id: 'stomp-send',
      title: 'Send a Message — Watch the Echo',
      description: 'Command is **SEND**, destination is `/queue/demo` — same queue we subscribed to. When we send `{"hello":"from RedfireForge!"}`, the broker delivers it back immediately as a **MESSAGE** frame. Two rows appear in the Events log: **SEND → /queue/demo** (↑) and **MESSAGE ← /queue/demo** (↓). That\'s destination-based pub/sub in action: publish once, receive once.',
      highlight: WS.SEND_BTN,
      pauseAfter: true,
      // preAction ensures WS+STOMP session is active (connection guard), then
      // navigates to Compose and selects SEND command before the spotlight.
      preAction: async (ctx: DemoActionContext) => {
        await ensureStompSession(ctx); // Rule 4: guard for skip-to-step
        await ctx.click(WS.LEFT_TAB_COMPOSE);
        await ctx.delay(200);
        await ctx.selectOption(WS.STOMP_COMMAND, 'SEND');
        await ctx.delay(300);
      },
      action: async (ctx: DemoActionContext) => {
        await ctx.fill(WS.STOMP_DESTINATION, '/queue/demo');
        await ctx.delay(400);
        await ctx.fill(WS.MESSAGE_INPUT, '{"hello":"from RedfireForge!"}');
        await ctx.delay(500);
        await ctx.click(WS.SEND_BTN);
        await ctx.delay(1400);
        // Show Events so user sees SEND + MESSAGE rows
        await ctx.click(WS.RIGHT_TAB_EVENTS);
        await ctx.delay(900);
      },
    },
    {
      id: 'stomp-frames',
      title: 'Events Tab — Decoded STOMP Frames',
      description: 'Every STOMP frame type is labeled in the Events log: **CONNECTED** (broker accepted auth), **SUBSCRIBE** (subscription registered), **SEND → /queue/demo** (message published), **MESSAGE ← /queue/demo** (delivery from queue), and **HEARTBEAT (♥)** rows for the keep-alive pulses. Notice how each row\'s summary includes the destination path — no raw null-byte text.',
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
      id: 'stomp-disconnect',
      title: 'Clean Disconnect',
      description: 'The demo clicks **Disconnect** to close the transport. The status badge returns to **grey**. In production STOMP clients, you\'d first send a **DISCONNECT** frame to let the broker clean up subscriptions and receipt tracking — but for demos, closing the WebSocket transport is sufficient. The broker will detect the close and release all subscriptions on this session.',
      highlight: WS.DISCONNECT_BTN,
      pauseAfter: true,
      // preAction navigates to Connect tab BEFORE the spotlight so DISCONNECT_BTN
      // is in the DOM when the highlight box is drawn.
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
