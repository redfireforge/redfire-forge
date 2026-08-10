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
import { WS } from '@shared/selectors';
import { firstVisibleElement } from '../../utils/domVisibility';
import { showSpotlightRing } from '../../demoRipple';

// ── Constants ──────────────────────────────────────────────────
const STOMP_URL = 'ws://localhost:15674/ws';

/** Spotlight a field, hold so the viewer can read the change, then clear. */
async function spotlightAndPause(
  ctx: DemoActionContext,
  selector: string,
  holdMs: number,
): Promise<void> {
  const el = firstVisibleElement<HTMLElement>(selector);
  if (!el) {
    await ctx.delay(holdMs);
    return;
  }
  const dispose = showSpotlightRing(el);
  try {
    await ctx.delay(holdMs);
  } finally {
    dispose();
  }
}

/** Quietly open Connect panel (no ripple) — for preAction / setup. */
async function ensureConnectPanel(ctx: DemoActionContext): Promise<void> {
  if (!firstVisibleElement(WS.URL_INPUT)) {
    document.querySelector<HTMLElement>(WS.MODE_CLIENT)?.click();
    await ctx.delay(150);
    document.querySelector<HTMLElement>(WS.LEFT_TAB_CONNECT)?.click();
    await ctx.delay(200);
  }
}

/**
 * Quietly apply Connect settings when a later step is reached via Next/skip
 * before the paced configure steps have run.
 */
async function ensureStompConnectConfig(ctx: DemoActionContext): Promise<void> {
  await ensureConnectPanel(ctx);
  await ctx.fill(WS.URL_INPUT, STOMP_URL);
  await ctx.fill(WS.SUBPROTOCOLS_INPUT, '');
  await ctx.selectOption(WS.PROTOCOL_SELECT, 'stomp');
  await ctx.delay(100);
}

/** Reset STOMP command select back to SEND. */
async function resetStompCommand(ctx: DemoActionContext) {
  const cmd = firstVisibleElement<HTMLSelectElement>(WS.STOMP_COMMAND);
  if (cmd) {
    cmd.value = 'SEND';
    cmd.dispatchEvent(new Event('change', { bubbles: true }));
  }
  await ctx.delay(100);
}

/**
 * Guard used by preActions of later steps to ensure WS transport is open AND
 * a STOMP CONNECT frame has been sent (so the broker accepts SUBSCRIBE/SEND).
 * Called only when the user skips directly to a late step.
 */
async function ensureStompSession(ctx: DemoActionContext): Promise<void> {
  if (firstVisibleElement(WS.STATUS_CONNECTED)) return;
  await ensureStompConnectConfig(ctx);
  // Establish WebSocket transport
  await ctx.click(WS.CONNECT_BTN);
  await ctx.waitFor(WS.STATUS_CONNECTED);
  await ctx.delay(300);
  // Send STOMP CONNECT frame so the broker accepts subsequent frames
  await ctx.click(WS.LEFT_TAB_SEND);
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
  // Ensure client mode FIRST — left-tab buttons only exist in client mode
  await ctx.click(WS.MODE_CLIENT);
  await ctx.delay(300);
  await disconnectWebSocket(ctx);
  await ctx.delay(200);
  await clearEvents(ctx);
  await ctx.delay(300);
  // Open Connect with a clean slate — URL / Subprotocols / Protocol are filled
  // visibly in the first lesson steps (not pre-configured here).
  await ctx.click(WS.LEFT_TAB_CONNECT);
  await ctx.delay(200);
  await ctx.fill(WS.URL_INPUT, '');
  await ctx.delay(100);
  await ctx.fill(WS.SUBPROTOCOLS_INPUT, '');
  await ctx.delay(100);
  await ctx.selectOption(WS.PROTOCOL_SELECT, 'raw');
  await ctx.delay(150);
}

async function stompCleanup(ctx: DemoActionContext): Promise<void> {
  await disconnectWebSocket(ctx);
  await clearEvents(ctx);
  // Reset STOMP command to SEND before resetting protocol to raw
  // (resetStompCommand needs protocol still set to stomp so compose fields are rendered)
  await ctx.click(WS.LEFT_TAB_SEND);
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
  estimatedMinutes: 5,
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
    diagram: `<svg viewBox="0 0 590 310" xmlns="http://www.w3.org/2000/svg" style="font-family:system-ui,sans-serif">
  <defs>
    <marker id="stm-g" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="#4ade80"/></marker>
    <marker id="stm-a" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="#f59e0b"/></marker>
    <marker id="stm-b" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="#60a5fa"/></marker>
  </defs>
  <!-- Participants -->
  <rect x="15" y="10" width="120" height="32" rx="5" fill="#1e293b" stroke="#4ade80" stroke-width="1.5"/>
  <text x="75" y="31" text-anchor="middle" fill="#e2e8f0" font-size="12" font-weight="600">Browser</text>
  <rect x="412" y="10" width="168" height="32" rx="5" fill="#1e293b" stroke="#f59e0b" stroke-width="1.5"/>
  <text x="496" y="31" text-anchor="middle" fill="#e2e8f0" font-size="12" font-weight="600">RabbitMQ (:15674)</text>
  <!-- Lifelines -->
  <line x1="75" y1="42" x2="75" y2="286" stroke="#334155" stroke-width="1.5" stroke-dasharray="4 3"/>
  <line x1="496" y1="42" x2="496" y2="286" stroke="#334155" stroke-width="1.5" stroke-dasharray="4 3"/>
  <!-- 1 · HTTP Upgrade — Browser→Server (green) -->
  <line x1="75" y1="70" x2="496" y2="70" stroke="#4ade80" stroke-width="1.5" marker-end="url(#stm-g)"/>
  <text x="285" y="65" text-anchor="middle" fill="#4ade80" font-size="10" font-family="'Fira Code',monospace">HTTP Upgrade (WS handshake)</text>
  <!-- 2 · 101 — Server→Browser (green) -->
  <line x1="496" y1="104" x2="75" y2="104" stroke="#4ade80" stroke-width="1.5" marker-end="url(#stm-g)"/>
  <text x="285" y="99" text-anchor="middle" fill="#4ade80" font-size="10" font-family="'Fira Code',monospace">101 Switching Protocols</text>
  <!-- 3 · CONNECT frame — Browser→Server (amber) -->
  <line x1="75" y1="138" x2="496" y2="138" stroke="#f59e0b" stroke-width="1.5" marker-end="url(#stm-a)"/>
  <text x="285" y="133" text-anchor="middle" fill="#f59e0b" font-size="10" font-family="'Fira Code',monospace">CONNECT (host, login, passcode)</text>
  <!-- 4 · CONNECTED — Server→Browser (amber) -->
  <line x1="496" y1="172" x2="75" y2="172" stroke="#f59e0b" stroke-width="1.5" marker-end="url(#stm-a)"/>
  <text x="285" y="167" text-anchor="middle" fill="#f59e0b" font-size="10" font-family="'Fira Code',monospace">CONNECTED version:1.2</text>
  <!-- 5 · SUBSCRIBE — Browser→Server (blue) -->
  <line x1="75" y1="206" x2="496" y2="206" stroke="#60a5fa" stroke-width="1.5" marker-end="url(#stm-b)"/>
  <text x="285" y="201" text-anchor="middle" fill="#60a5fa" font-size="10" font-family="'Fira Code',monospace">SUBSCRIBE /queue/demo</text>
  <!-- 6 · SEND — Browser→Server (blue) -->
  <line x1="75" y1="240" x2="496" y2="240" stroke="#60a5fa" stroke-width="1.5" marker-end="url(#stm-b)"/>
  <text x="285" y="235" text-anchor="middle" fill="#60a5fa" font-size="10" font-family="'Fira Code',monospace">SEND /queue/demo {"hello":"…"}</text>
  <!-- 7 · MESSAGE delivered — Server→Browser (blue) -->
  <line x1="496" y1="274" x2="75" y2="274" stroke="#60a5fa" stroke-width="1.5" marker-end="url(#stm-b)"/>
  <text x="285" y="269" text-anchor="middle" fill="#60a5fa" font-size="10" font-family="'Fira Code',monospace">MESSAGE /queue/demo {"hello":"…"}</text>
  <!-- Legend -->
  <circle cx="20" cy="297" r="4" fill="#4ade80"/><text x="29" y="301" fill="#64748b" font-size="9">handshake</text>
  <circle cx="104" cy="297" r="4" fill="#f59e0b"/><text x="113" y="301" fill="#64748b" font-size="9">STOMP frames</text>
  <circle cx="204" cy="297" r="4" fill="#60a5fa"/><text x="213" y="301" fill="#64748b" font-size="9">pub/sub messages</text>
</svg>`,
  },

  steps: [
    {
      id: 'stomp-url',
      title: 'Set the RabbitMQ Web-STOMP URL',
      description: 'Open **Connect** and enter `ws://localhost:15674/ws` — **RabbitMQ\'s web-STOMP port** (the management UI is on **15672**; this endpoint is the WebSocket STOMP path). Watch the URL field fill — this is only the transport address; a STOMP **CONNECT** frame still has to follow after we open the socket.',
      highlight: WS.URL_INPUT,
      pauseAfter: true,
      preAction: async (ctx: DemoActionContext) => {
        await ctx.click(WS.MODE_CLIENT);
        await ctx.delay(200);
        await ctx.click(WS.LEFT_TAB_CONNECT);
        await ctx.delay(200);
      },
      action: async (ctx: DemoActionContext) => {
        await ctx.waitFor(WS.URL_INPUT);
        await ctx.delay(500);
        await ctx.fill(WS.URL_INPUT, STOMP_URL);
        await spotlightAndPause(ctx, WS.URL_INPUT, 1200);
      },
    },
    {
      id: 'stomp-subprotocols',
      title: 'Clear Subprotocols',
      description: 'Leave **Subprotocols** empty for RabbitMQ. A leftover value like `graphql-transport-ws` from another lesson causes the broker to reject the handshake with *Sent non-empty Sec-WebSocket-Protocol header but no response was received*. Clearing the field keeps the WebSocket upgrade clean.',
      highlight: WS.SUBPROTOCOLS_INPUT,
      pauseAfter: true,
      preAction: async (ctx: DemoActionContext) => {
        await ensureConnectPanel(ctx);
        // Guard: URL must be set if the viewer skipped the previous step
        const url = firstVisibleElement<HTMLInputElement>(WS.URL_INPUT);
        if (!url?.value?.includes('15674')) {
          await ctx.fill(WS.URL_INPUT, STOMP_URL);
        }
      },
      action: async (ctx: DemoActionContext) => {
        await ctx.waitFor(WS.SUBPROTOCOLS_INPUT);
        await ctx.delay(400);
        await ctx.fill(WS.SUBPROTOCOLS_INPUT, '');
        await spotlightAndPause(ctx, WS.SUBPROTOCOLS_INPUT, 1000);
      },
    },
    {
      id: 'stomp-protocol',
      title: 'Select Protocol: STOMP',
      description: 'Set **Protocol** to **STOMP**. RedfireForge then decodes every frame in the Events tab — instead of raw null-byte text, you get labeled rows like **SEND → /queue/demo**, **MESSAGE ← /queue/demo**, plus **CONNECTED** and **HEARTBEAT (♥)**.',
      highlight: WS.PROTOCOL_SELECT,
      pauseAfter: true,
      preAction: async (ctx: DemoActionContext) => {
        await ensureConnectPanel(ctx);
        const url = firstVisibleElement<HTMLInputElement>(WS.URL_INPUT);
        if (!url?.value?.includes('15674')) {
          await ctx.fill(WS.URL_INPUT, STOMP_URL);
        }
        await ctx.fill(WS.SUBPROTOCOLS_INPUT, '');
      },
      action: async (ctx: DemoActionContext) => {
        await ctx.waitFor(WS.PROTOCOL_SELECT);
        await ctx.delay(400);
        await ctx.selectOption(WS.PROTOCOL_SELECT, 'stomp');
        await spotlightAndPause(ctx, WS.PROTOCOL_SELECT, 1200);
      },
    },
    {
      id: 'stomp-connect-ws',
      title: 'The Two-Step Handshake: Connect + STOMP CONNECT',
      description: `STOMP uses a **two-step handshake**:\n\n- **Step 1** — clicking **Connect** opens the WebSocket transport (status turns **green**).\n- **Step 2** — immediately a **STOMP CONNECT** frame is sent with virtual host \`/\`, login \`guest\`, passcode \`guest\`. The broker replies with a **CONNECTED** frame.\n\nBoth steps happen in sequence — watch the Events tab fill with three entries.`,
      highlight: WS.CONNECT_BTN,
      pauseAfter: true,
      preAction: async (ctx: DemoActionContext) => {
        await ensureStompConnectConfig(ctx);
      },
      action: async (ctx: DemoActionContext) => {
        // ── Step 1: Open the WebSocket transport ───────────────────
        // Replay guard: skip WS connect if already open from a prior pass.
        if (!firstVisibleElement(WS.STATUS_CONNECTED)) {
          await spotlightAndPause(ctx, WS.CONNECT_BTN, 700);
          await ctx.click(WS.CONNECT_BTN);
        }
        await ctx.waitFor(WS.STATUS_CONNECTED); // wait for green status dot (Rule 5)
        await ctx.delay(400); // brief pause to observe the green dot
        // Show Events — SYS entry for transport open should be visible
        await ctx.click(WS.RIGHT_TAB_EVENTS);
        await ctx.delay(600);
        // ── Step 2: Send STOMP CONNECT frame ───────────────────────
        await ctx.click(WS.LEFT_TAB_SEND);
        await ctx.delay(300);
        // Select CONNECT command — triggers React re-render showing login/passcode fields
        await spotlightAndPause(ctx, WS.STOMP_COMMAND, 700);
        await ctx.selectOption(WS.STOMP_COMMAND, 'CONNECT');
        await ctx.delay(300);
        // "host" in STOMP is the virtual host, not the TCP hostname.
        // RabbitMQ's default virtual host is "/".
        await spotlightAndPause(ctx, WS.STOMP_DESTINATION, 700);
        await ctx.fill(WS.STOMP_DESTINATION, '/');
        await spotlightAndPause(ctx, WS.STOMP_DESTINATION, 600);
        await spotlightAndPause(ctx, WS.STOMP_LOGIN, 700);
        await ctx.fill(WS.STOMP_LOGIN, 'guest');
        await spotlightAndPause(ctx, WS.STOMP_LOGIN, 600);
        await spotlightAndPause(ctx, WS.STOMP_PASSCODE, 700);
        await ctx.fill(WS.STOMP_PASSCODE, 'guest');
        await spotlightAndPause(ctx, WS.STOMP_PASSCODE, 600);
        await spotlightAndPause(ctx, WS.SEND_BTN, 700);
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
      description: `Look at the Events log — three entries appear in sequence:

- **SYS** — WebSocket transport opened
- **CONNECT → /** — the STOMP frame you sent (with credentials)
- **CONNECTED (v1.2)** — broker's reply confirming auth and protocol version

The STOMP session is now established. Only after receiving **CONNECTED** can you subscribe to queues or publish messages.`,
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
      // navigates to Send and pre-populates SUBSCRIBE + destination so the
      // user reads the description while already seeing the correct compose state.
      preAction: async (ctx: DemoActionContext) => {
        await ensureStompSession(ctx); // Rule 4: guard for skip-to-step
        await ctx.click(WS.LEFT_TAB_SEND);
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
      // navigates to Send and selects SEND command before the spotlight.
      preAction: async (ctx: DemoActionContext) => {
        await ensureStompSession(ctx); // Rule 4: guard for skip-to-step
        await ctx.click(WS.LEFT_TAB_SEND);
        await ctx.delay(200);
        await ctx.selectOption(WS.STOMP_COMMAND, 'SEND');
        await ctx.delay(300);
      },
      action: async (ctx: DemoActionContext) => {
        // Spotlight destination field → fill → pause so viewer reads it
        await spotlightAndPause(ctx, WS.STOMP_DESTINATION, 700);
        await ctx.fill(WS.STOMP_DESTINATION, '/queue/demo');
        await spotlightAndPause(ctx, WS.STOMP_DESTINATION, 800);
        // Spotlight message input → fill → pause so viewer reads the payload
        await spotlightAndPause(ctx, WS.MESSAGE_INPUT, 700);
        await ctx.fill(WS.MESSAGE_INPUT, '{"hello":"from RedfireForge!"}');
        await spotlightAndPause(ctx, WS.MESSAGE_INPUT, 1000);
        // Spotlight Send button → click
        await spotlightAndPause(ctx, WS.SEND_BTN, 700);
        await ctx.click(WS.SEND_BTN);
        await ctx.delay(1200);
        // Switch to Events so viewer sees SEND + MESSAGE rows appear
        await ctx.click(WS.RIGHT_TAB_EVENTS);
        await ctx.delay(1000);
      },
    },
    {
      id: 'stomp-frames',
      title: 'Events Tab — Decoded STOMP Frames',
      description: `Every STOMP frame type is labeled in the Events log — no raw null-byte text, just clean decoded rows:

- **CONNECTED** — broker accepted auth
- **SUBSCRIBE** — subscription registered
- **SEND → /queue/demo** — message published
- **MESSAGE ← /queue/demo** — delivery from queue
- **HEARTBEAT (♥)** — keep-alive pulses

Notice how each row's summary includes the destination path.`,
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
