/**
 * Lesson 10: Socket.IO Protocol
 *
 * Demonstrates how RedfireForge handles Socket.IO v4 sessions:
 *  - Selecting the Socket.IO protocol
 *  - Connecting to a real Socket.IO echo server (Docker)
 *  - Event-name vs raw-message distinction
 *  - Namespaces
 *  - Reading SID / ping-interval metrics
 *  - Disconnecting cleanly
 *
 * Requires: docker/websocket/socketio/docker-compose.yml
 */
import type { DemoActionContext, DemoLesson } from '../../types';
import { disconnectWebSocket, clearEvents } from '../setup-helpers';
import { WS } from '@shared/selectors';
import { firstVisibleElement } from '../../utils/domVisibility';

// ── Selectors (Socket.IO specific) ────────────────────────────
const SIO_URL = 'ws://localhost:3100/socket.io/?EIO=4&transport=websocket';

/** Reset protocol selection back to 'raw'. */
async function resetProtocol(ctx: DemoActionContext) {
  await ctx.click(WS.LEFT_TAB_CONNECT);
  await ctx.delay(200);
  await ctx.selectOption(WS.PROTOCOL_SELECT, 'raw');
  await ctx.delay(200);
}

/**
 * Guard used by preActions of steps 5+ to ensure the Socket.IO connection is
 * established before the spotlight/action tries to read SIO-specific UI elements
 * (SIO_SERVER_PARAMS, compose fields, etc.) that only render when connected.
 */
async function ensureSioConnected(ctx: DemoActionContext): Promise<void> {
  if (firstVisibleElement(WS.STATUS_CONNECTED)) return;
  await ctx.click(WS.LEFT_TAB_CONNECT);
  await ctx.delay(200);
  await ctx.click(WS.CONNECT_BTN);
  await ctx.waitFor(WS.STATUS_CONNECTED);
  await ctx.delay(300);
}

// ── Setup / Cleanup ────────────────────────────────────────────

async function sioSetup(ctx: DemoActionContext): Promise<void> {
  // Ensure client mode FIRST — left-tab buttons only exist in client mode
  const isClient = !!document.querySelector('[data-testid="mode-client"].active, [data-testid="mode-client"][aria-selected="true"]');
  if (!isClient) {
    await ctx.click(WS.MODE_CLIENT);
    await ctx.delay(120);
  }
  await disconnectWebSocket(ctx);
  await clearEvents(ctx);
  // Navigate to Connect tab and pre-populate URL + protocol
  // so the user sees a complete, ready configuration from Step 1.
  // Clear Subprotocols — stale values from other lessons confuse the UI.
  const connectTab = document.querySelector<HTMLElement>(WS.LEFT_TAB_CONNECT);
  if (connectTab?.getAttribute('aria-selected') !== 'true') {
    connectTab?.click();
    await ctx.delay(120);
  }
  await ctx.fill(WS.URL_INPUT, SIO_URL);
  await ctx.delay(120);
  await ctx.fill(WS.SUBPROTOCOLS_INPUT, '');
  await ctx.delay(100);
  await ctx.selectOption(WS.PROTOCOL_SELECT, 'socket-io');
  await ctx.delay(120);
}

async function sioCleanup(ctx: DemoActionContext): Promise<void> {
  await disconnectWebSocket(ctx);
  await clearEvents(ctx);
  await resetProtocol(ctx);
  await ctx.click(WS.MODE_CLIENT);
}

// ── Lesson ─────────────────────────────────────────────────────

export const wsSocketIoLesson: DemoLesson = {
  id: 'ws-socketio',
  domainId: 'protocols',
  category: 'websocket',
  name: 'Socket.IO Protocol',
  description: 'Connect to a real Socket.IO v4 server, send named events, and explore namespace support.',
  estimatedMinutes: 4,
  initialTab: 'websocket-studio',
  tag: '🐳 Docker',
  dockerEndpoint: 'ws://localhost:3100/socket.io/?EIO=4&transport=websocket',
  dockerCommand: 'docker compose -f docker/websocket/socketio/docker-compose.yml up -d',

  setup: sioSetup,
  cleanup: sioCleanup,

  concept: {
    title: 'Socket.IO Protocol',
    body: `**Socket.IO** is a higher-level protocol built on top of WebSocket (and HTTP long-polling as a fallback). It adds structured messaging on top of the raw transport.

**Key differences from raw WebSocket:**

- Messages are wrapped in an **EIO** (Engine.IO) envelope: e.g. \`42["eventName", ...data]\`
- Every message has an **event name** — like HTTP method names for WebSocket
- Events can target specific **namespaces** (logical sub-channels, e.g. \`/admin\`, \`/chat\`)
- The server automatically sends **ping/pong** heartbeats to keep the connection alive
- On connect, the server returns a **session ID (SID)** and negotiates heartbeat timing

**Why this matters for testing:**

When testing a Socket.IO API, you don't just send raw JSON — you send \`42["eventName", {...payload}]\`. RedfireForge's Socket.IO mode handles the framing automatically, so you just type the event name and payload naturally.

**What this demo shows:**

1. How the Connect panel looks when configured for Socket.IO
2. What the handshake produces — SID, ping/pong heartbeats visible in the event log
3. How to send a named event and see the decoded echo (not raw EIO bytes)
4. What the namespace field does and why it matters for real-world APIs`,
    keyTerms: [
      { term: 'Engine.IO (EIO)', definition: 'The transport layer underneath Socket.IO. Handles connection negotiation, heartbeats, and packet framing.' },
      { term: 'Event Name', definition: 'A string label on every Socket.IO message — like a function call name. The server routes messages by event name.' },
      { term: 'Namespace', definition: 'A logical channel within a Socket.IO connection (e.g. /admin). Allows multiplexing multiple event streams on one WebSocket.' },
      { term: 'SID', definition: 'Session ID assigned by the server on connect. Unique per connection, useful for debugging reconnect issues.' },
      { term: 'Ping Interval', definition: 'How often the server sends a heartbeat ping to confirm the connection is alive. Typically 25 seconds.' },
    ],
    diagram: `<svg viewBox="0 0 580 348" xmlns="http://www.w3.org/2000/svg" style="font-family:system-ui,sans-serif">
  <defs>
    <marker id="sio-g" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="#4ade80"/></marker>
    <marker id="sio-a" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="#f59e0b"/></marker>
    <marker id="sio-b" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="#60a5fa"/></marker>
    <marker id="sio-p" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="#a78bfa"/></marker>
  </defs>
  <!-- Participants -->
  <rect x="15" y="10" width="130" height="32" rx="5" fill="#1e293b" stroke="#4ade80" stroke-width="1.5"/>
  <text x="80" y="31" text-anchor="middle" fill="#e2e8f0" font-size="12" font-weight="600">Browser</text>
  <rect x="418" y="10" width="152" height="32" rx="5" fill="#1e293b" stroke="#60a5fa" stroke-width="1.5"/>
  <text x="494" y="31" text-anchor="middle" fill="#e2e8f0" font-size="12" font-weight="600">Socket.IO Server</text>
  <!-- Lifelines -->
  <line x1="80" y1="42" x2="80" y2="316" stroke="#334155" stroke-width="1.5" stroke-dasharray="4 3"/>
  <line x1="494" y1="42" x2="494" y2="316" stroke="#334155" stroke-width="1.5" stroke-dasharray="4 3"/>
  <!-- 1 · HTTP Upgrade — Browser→Server (green) -->
  <line x1="80" y1="74" x2="494" y2="74" stroke="#4ade80" stroke-width="1.5" marker-end="url(#sio-g)"/>
  <text x="287" y="69" text-anchor="middle" fill="#4ade80" font-size="10" font-family="'Fira Code',monospace">HTTP Upgrade (WS handshake)</text>
  <!-- 2 · EIO server-open — Server→Browser (amber) -->
  <line x1="494" y1="110" x2="80" y2="110" stroke="#f59e0b" stroke-width="1.5" marker-end="url(#sio-a)"/>
  <text x="287" y="105" text-anchor="middle" fill="#f59e0b" font-size="10" font-family="'Fira Code',monospace">0{sid, pingInterval:25000}</text>
  <!-- 3 · Namespace connect — Server→Browser (amber) -->
  <line x1="494" y1="146" x2="80" y2="146" stroke="#f59e0b" stroke-width="1.5" marker-end="url(#sio-a)"/>
  <text x="287" y="141" text-anchor="middle" fill="#f59e0b" font-size="10" font-family="'Fira Code',monospace">40 (namespace connect /)</text>
  <!-- 4 · Send event — Browser→Server (blue) -->
  <line x1="80" y1="188" x2="494" y2="188" stroke="#60a5fa" stroke-width="1.5" marker-end="url(#sio-b)"/>
  <text x="287" y="183" text-anchor="middle" fill="#60a5fa" font-size="10" font-family="'Fira Code',monospace">42["message","Hello!"]</text>
  <text x="287" y="200" text-anchor="middle" fill="#475569" font-size="9" font-style="italic">send event "message"</text>
  <!-- 5 · Echo — Server→Browser (blue) -->
  <line x1="494" y1="232" x2="80" y2="232" stroke="#60a5fa" stroke-width="1.5" marker-end="url(#sio-b)"/>
  <text x="287" y="227" text-anchor="middle" fill="#60a5fa" font-size="10" font-family="'Fira Code',monospace">42["message","Hello!"]</text>
  <text x="287" y="244" text-anchor="middle" fill="#475569" font-size="9" font-style="italic">echo back</text>
  <!-- 6 · Ping — Server→Browser (purple) -->
  <line x1="494" y1="272" x2="80" y2="272" stroke="#a78bfa" stroke-width="1.5" marker-end="url(#sio-p)"/>
  <text x="287" y="267" text-anchor="middle" fill="#a78bfa" font-size="10" font-family="'Fira Code',monospace">2 (ping)</text>
  <!-- 7 · Pong — Browser→Server (purple) -->
  <line x1="80" y1="308" x2="494" y2="308" stroke="#a78bfa" stroke-width="1.5" marker-end="url(#sio-p)"/>
  <text x="287" y="303" text-anchor="middle" fill="#a78bfa" font-size="10" font-family="'Fira Code',monospace">3 (pong)</text>
  <!-- Legend -->
  <circle cx="20" cy="334" r="4" fill="#4ade80"/><text x="29" y="338" fill="#64748b" font-size="9">connect</text>
  <circle cx="88" cy="334" r="4" fill="#f59e0b"/><text x="97" y="338" fill="#64748b" font-size="9">EIO control</text>
  <circle cx="176" cy="334" r="4" fill="#60a5fa"/><text x="185" y="338" fill="#64748b" font-size="9">data</text>
  <circle cx="214" cy="334" r="4" fill="#a78bfa"/><text x="223" y="338" fill="#64748b" font-size="9">heartbeat</text>
</svg>`,
  },

  steps: [
    {
      id: 'sio-intro',
      title: 'Connect Panel — Pre-Configured',
      description: 'The Connect panel is ready to go. Two settings work together here: the **URL** points to our local Docker echo server on port 3100, and the **Protocol** is set to Socket.IO. Those two fields are all you need — RedfireForge handles the Engine.IO framing automatically from here.',
      highlight: WS.LEFT_TAB_CONNECT,
      pauseAfter: true,
      action: async (ctx: DemoActionContext) => {
        await ctx.waitFor(WS.LEFT_TAB_CONNECT, 3000);
        await ctx.delay(500);
      },
    },
    {
      id: 'sio-select-protocol',
      title: 'What "Protocol: Socket.IO" Does',
      description: 'The **Protocol** dropdown is set to **Socket.IO**. This mode wraps every outgoing message in Engine.IO framing — `42["eventName", data]` — and decodes incoming packets back into clean event names. Without this mode, you\'d see raw framing like `42["message",{"text":"..."}]` in the event log instead of just `EVENT: message`.',
      highlight: WS.PROTOCOL_SELECT,
      pauseAfter: true,
      // preAction ensures Connect tab is active so PROTOCOL_SELECT is in the DOM
      // before the spotlight renders (it lives inside the conditionally-rendered Connect panel).
      preAction: async (ctx: DemoActionContext) => {
        const connectTab = document.querySelector<HTMLElement>(WS.LEFT_TAB_CONNECT);
        if (connectTab?.getAttribute('aria-selected') !== 'true') {
          connectTab?.click();
          await ctx.delay(120);
        }
      },
      action: async (ctx: DemoActionContext) => {
        await ctx.delay(300);
      },
    },
    {
      id: 'sio-enter-url',
      title: 'The URL Parameters',
      description: `The URL ends with two query parameters. **EIO=4** selects Engine.IO version 4 — required by Socket.IO v4. **transport=websocket** skips HTTP long-polling and opens a direct WebSocket connection. This is the correct mode for testing: our echo server has polling disabled anyway, so this forces the fastest path.`,
      highlight: WS.URL_INPUT,
      pauseAfter: true,
      // preAction ensures Connect tab is active so URL_INPUT is in the DOM
      // before the spotlight renders (it lives inside the conditionally-rendered Connect panel).
      preAction: async (ctx: DemoActionContext) => {
        const connectTab = document.querySelector<HTMLElement>(WS.LEFT_TAB_CONNECT);
        if (connectTab?.getAttribute('aria-selected') !== 'true') {
          connectTab?.click();
          await ctx.delay(120);
        }
      },
      action: async (ctx: DemoActionContext) => {
        await ctx.delay(300);
      },
    },
    {
      id: 'sio-connect',
      title: 'Connecting — Watch the Handshake',
      // Short description so the reading phase ends quickly and the action (connection) fires fast.
      // The real "lesson" is watching the events appear in real time.
      description: 'Watch the **Events** panel as the connection opens. The handshake produces four entries: `SYS` (transport connected), `OPEN` (contains the **SID**), then two `CONNECT` packets (namespace negotiation). The status badge turns **green**.',
      // Highlight the Events panel tab — that's where the user should look, and it stays
      // valid both before (empty) and after (showing handshake) the connection fires.
      highlight: WS.RIGHT_TAB_EVENTS,
      pauseAfter: true,
      // preAction navigates to Connect tab so CONNECT_BTN is in the DOM when the action fires.
      preAction: async (ctx: DemoActionContext) => {
        const connectTab = document.querySelector<HTMLElement>(WS.LEFT_TAB_CONNECT);
        if (connectTab?.getAttribute('aria-selected') !== 'true') {
          connectTab?.click();
          await ctx.delay(120);
        }
      },
      action: async (ctx: DemoActionContext) => {
        // Replay guard: skip WS connect if already open from a prior pass.
        if (!firstVisibleElement(WS.STATUS_CONNECTED)) {
          await ctx.click(WS.CONNECT_BTN);
        }
        await ctx.waitFor(WS.STATUS_CONNECTED); // wait for green dot (Rule 5)
        await ctx.delay(400);
        // Show Events so the user sees the handshake packets
        await ctx.click(WS.RIGHT_TAB_EVENTS);
        await ctx.delay(800);
        // Return to Connect tab so the green badge + SIO metrics are visible
        await ctx.click(WS.LEFT_TAB_CONNECT);
        await ctx.delay(500);
      },
    },
    {
      id: 'sio-inspect-params',
      title: 'Session ID & Ping Interval',
      description: 'Look at the **status line** at the bottom of the Connect panel — there\'s a `ping Xs / timeout Ys` widget. That is the heartbeat schedule the server negotiated on connect. Hover it to see the full **SID** (session identifier). Every Socket.IO connection gets a unique SID — useful when debugging reconnects or tracing server logs.',
      highlight: WS.SIO_SERVER_PARAMS,
      pauseAfter: true,
      // preAction ensures the connection is established AND the Connect tab is visible.
      // SIO_SERVER_PARAMS renders only when isConnected && sioServerParams — both require
      // a successful Socket.IO handshake (Rule 4: guard for skip-to-step).
      preAction: async (ctx: DemoActionContext) => {
        await ensureSioConnected(ctx);
        await ctx.click(WS.LEFT_TAB_CONNECT);
        await ctx.delay(200);
      },
      action: async (ctx: DemoActionContext) => {
        await ctx.delay(600);
      },
    },
    {
      id: 'sio-compose-event',
      title: 'Composing a Named Event',
      description: 'In the **Send** tab, notice two Socket.IO-specific fields above the message area: **Event Name** and **Namespace**. The demo fills in `message` as the event name and `{"text": "Hello Socket.IO!"}` as the payload. RedfireForge will encode this as `42["message",{"text":"Hello Socket.IO!"}]` on the wire — you never type the raw framing.',
      highlight: WS.SIO_COMPOSE_FIELDS,
      pauseAfter: true,
      // preAction ensures connection is active (SIO fields are disabled when not connected),
      // then navigates to Send so SIO_COMPOSE_FIELDS is in the DOM for the spotlight.
      preAction: async (ctx: DemoActionContext) => {
        await ensureSioConnected(ctx); // Rule 4: guard for skip-to-step
        await ctx.click(WS.LEFT_TAB_SEND);
      },
      action: async (ctx: DemoActionContext) => {
        await ctx.delay(400);
        await ctx.fill(WS.SIO_EVENT_NAME, 'message');
        await ctx.delay(500);
        await ctx.fill(WS.MESSAGE_INPUT, '{"text": "Hello Socket.IO!"}');
        await ctx.delay(600);
      },
    },
    {
      id: 'sio-send',
      title: 'Send & Watch the Echo',
      // Kept concise — the real lesson is watching the two EVENT rows appear.
      description: 'The demo clicks **Send**. Watch the Events log — two `EVENT: message` rows appear: one **outgoing** (↑) and one **incoming echo** (↓). The echo server reflects the event back with the same name and payload. That\'s Socket.IO in action — no raw EIO bytes, just clean event names.',
      highlight: WS.SEND_BTN,
      pauseAfter: true,
      // preAction ensures connection is active — SEND_BTN does nothing when disconnected.
      // Also re-fills event name so the message is ready if user skipped step 6 (Rule 4).
      preAction: async (ctx: DemoActionContext) => {
        await ensureSioConnected(ctx);
        await ctx.click(WS.LEFT_TAB_SEND);
        await ctx.delay(150);
        await ctx.fill(WS.SIO_EVENT_NAME, 'message');
        await ctx.delay(150);
        await ctx.fill(WS.MESSAGE_INPUT, '{"text": "Hello Socket.IO!"}');
        await ctx.delay(150);
      },
      action: async (ctx: DemoActionContext) => {
        await ctx.click(WS.SEND_BTN);
        await ctx.delay(1200);
        await ctx.click(WS.RIGHT_TAB_EVENTS);
        await ctx.delay(1000);
      },
    },
    {
      id: 'sio-namespace',
      title: 'Namespaces — Logical Sub-channels',
      description: 'Back in the **Send** tab, see the **Namespace** field — currently `/` (the root). In production Socket.IO APIs, namespaces partition event streams on one connection: `/admin`, `/chat`, `/metrics`. Each is independent — a message sent to `/chat` never reaches a listener on `/admin`. Our echo server only handles root `/`, but the field is always here waiting when your server supports named namespaces.',
      highlight: WS.SIO_NAMESPACE,
      pauseAfter: true,
      // preAction navigates to Send BEFORE the spotlight so SIO_NAMESPACE is in the DOM
      // when the highlight box renders (it lives inside the Socket.IO send panel).
      preAction: async (ctx: DemoActionContext) => {
        await ctx.click(WS.LEFT_TAB_SEND);
      },
      action: async (ctx: DemoActionContext) => {
        await ctx.delay(500);
        // Scroll the namespace field into view so the highlight box is visible.
        // Do NOT focus() it — an INPUT with focus blocks ArrowRight keyboard navigation.
        const ns = firstVisibleElement<HTMLElement>(WS.SIO_NAMESPACE);
        if (ns) ns.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        await ctx.delay(800);
      },
    },
    {
      id: 'sio-disconnect',
      title: 'Clean Disconnect',
      description: 'The demo clicks **Disconnect**. Notice the status badge returns to **grey** immediately — Socket.IO sends a proper transport close frame rather than just dropping the TCP connection. The server logs `client namespace disconnect`. This graceful close matters: it lets the server instantly clean up room memberships and fire `disconnect` event handlers.',
      highlight: WS.DISCONNECT_BTN,
      pauseAfter: true,
      // preAction navigates to Connect tab BEFORE the spotlight so DISCONNECT_BTN
      // is in DOM when the highlight box is drawn (it lives in the Connect tab).
      preAction: async (ctx: DemoActionContext) => {
        await ctx.click(WS.LEFT_TAB_CONNECT);
      },
      action: async (ctx: DemoActionContext) => {
        await ctx.delay(400);
        // ctx.click shows the visual ripple on the Disconnect button
        await ctx.click(WS.DISCONNECT_BTN);
        await ctx.delay(1000);
      },
    },
  ],
};
