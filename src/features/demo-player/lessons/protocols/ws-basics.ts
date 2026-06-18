/** Lesson: WebSocket Basics — connect, send, receive */
import type { DemoActionContext, DemoLesson } from '../../types';
import { wsCleanup } from '../setup-helpers';
import { WS } from '../../../../shared/selectors';

/**
 * Tracks whether the built-in mock echo server has been started in the current
 * demo session. Reset by setup() so repeat runs start fresh.
 *
 * Using a flag is more reliable than DOM-based checks because the Mock tab
 * panel may be unmounted when we're in Client mode.
 */
let _mockRunning = false;

/**
 * Tracks whether a WebSocket connection is open in the current demo session.
 * Reset by setup() so repeat runs start fresh.
 */
let _wsConnected = false;

/**
 * Ensure the built-in mock echo server is running.
 * No-op if already started in this lesson session.
 * Always returns with Client mode active.
 */
async function ensureMockRunning(ctx: DemoActionContext): Promise<void> {
  if (_mockRunning) return;
  await ctx.click(WS.MODE_MOCK);
  await ctx.delay(200);
  const startBtn = document.querySelector(WS.MOCK_START_BTN) as HTMLButtonElement | null;
  if (startBtn && !startBtn.disabled) {
    await ctx.click(WS.MOCK_START_BTN);
    await ctx.waitFor(WS.MOCK_STOP_BTN, 3000);
  }
  _mockRunning = true;
  await ctx.click(WS.MODE_CLIENT);
  await ctx.delay(200);
}

/**
 * Ensure a WebSocket connection is open to ws://localhost:9876.
 * Also ensures the mock server is running. No-op if already connected.
 */
async function ensureConnected(ctx: DemoActionContext): Promise<void> {
  await ensureMockRunning(ctx);
  if (_wsConnected) return;
  await ctx.click(WS.LEFT_TAB_CONNECT);
  await ctx.delay(100);
  await ctx.fill(WS.URL_INPUT, 'ws://localhost:9876');
  await ctx.click(WS.CONNECT_BTN);
  await ctx.waitFor(WS.STATUS_CONNECTED, 3000);
  _wsConnected = true;
  await ctx.delay(200);
}

export const wsBasicsLesson: DemoLesson = {
  id: 'ws-basics',
  domainId: 'protocols',
  category: 'websocket',
  name: 'WebSocket Basics',
  description: 'Connect to a WebSocket server, send messages, and see live responses.',
  estimatedMinutes: 3,
  initialTab: 'websocket-studio',

  setup: async (ctx) => {
    _mockRunning = false;
    _wsConnected = false;
    // Disconnect any active session so step 4 can demo connecting from scratch
    const disconnectBtn = document.querySelector(WS.DISCONNECT_BTN) as HTMLButtonElement | null;
    if (disconnectBtn && !disconnectBtn.disabled) {
      disconnectBtn.click();
      await ctx.delay(400);
    }
    // Stop mock server if running so step 2 can demo starting it
    await ctx.click(WS.MODE_MOCK);
    await ctx.delay(300);
    const stopBtn = document.querySelector(WS.MOCK_STOP_BTN) as HTMLButtonElement | null;
    if (stopBtn && !stopBtn.disabled) {
      stopBtn.click();
      await ctx.delay(500);
    }
    // Return to Client mode on the Connect tab, Events right tab visible
    await ctx.click(WS.MODE_CLIENT);
    await ctx.delay(200);
    await ctx.click(WS.RIGHT_TAB_EVENTS);
    await ctx.delay(100);
    await ctx.click(WS.LEFT_TAB_CONNECT);
    await ctx.delay(100);
  },
  cleanup: async (ctx) => {
    _mockRunning = false;
    _wsConnected = false;
    await wsCleanup(ctx);
  },

  concept: {
    title: 'Understanding WebSocket',
    body: `WebSocket is a full-duplex communication protocol that enables real-time data exchange between client and server over a single, persistent TCP connection.

**How it works:**
1. The client sends an HTTP Upgrade request (the "handshake")
2. The server agrees and upgrades the connection
3. Both sides can now send messages at any time — no polling needed

**Key characteristics:**
- **Full-duplex**: Both sides send simultaneously
- **Low overhead**: After handshake, frames are tiny (2-14 bytes header)
- **Event-driven**: Open, Message, Error, Close events
- **Persistent**: Connection stays open until explicitly closed

**When to use WebSocket:**
- Chat applications
- Live dashboards & notifications
- Collaborative editing
- Game state synchronization
- IoT device communication`,
    keyTerms: [
      { term: 'Frame', definition: 'The smallest unit of data in WebSocket. Each message is one or more frames.' },
      { term: 'Handshake', definition: 'The HTTP Upgrade request/response that establishes the WebSocket connection.' },
      { term: 'Subprotocol', definition: 'An application-level protocol negotiated during handshake (e.g., graphql-ws, stomp).' },
      { term: 'Close Code', definition: 'A numeric code (1000-4999) indicating why the connection was closed.' },
    ],
    diagram: `<svg viewBox="0 0 400 120" xmlns="http://www.w3.org/2000/svg">
  <rect x="20" y="40" width="100" height="40" rx="6" fill="var(--primary)" opacity="0.2" stroke="var(--primary)" stroke-width="1.5"/>
  <text x="70" y="65" text-anchor="middle" fill="var(--text)" font-size="13" font-family="system-ui">Client</text>
  <rect x="280" y="40" width="100" height="40" rx="6" fill="var(--accent)" opacity="0.2" stroke="var(--accent)" stroke-width="1.5"/>
  <text x="330" y="65" text-anchor="middle" fill="var(--text)" font-size="13" font-family="system-ui">Server</text>
  <line x1="120" y1="50" x2="280" y2="50" stroke="var(--primary)" stroke-width="1.5" marker-end="url(#arrow)"/>
  <line x1="280" y1="70" x2="120" y2="70" stroke="var(--accent)" stroke-width="1.5" marker-end="url(#arrow2)"/>
  <text x="200" y="44" text-anchor="middle" fill="var(--text-muted)" font-size="10">send messages</text>
  <text x="200" y="88" text-anchor="middle" fill="var(--text-muted)" font-size="10">receive messages</text>
  <defs>
    <marker id="arrow" markerWidth="8" markerHeight="8" refX="8" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8" fill="none" stroke="var(--primary)" stroke-width="1.5"/></marker>
    <marker id="arrow2" markerWidth="8" markerHeight="8" refX="8" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8" fill="none" stroke="var(--accent)" stroke-width="1.5"/></marker>
  </defs>
</svg>`,
  },
  steps: [
    // ── 1. Welcome ───────────────────────────────────────────────
    {
      id: 'ws-nav',
      title: 'Welcome to WebSocket Studio',
      description: 'This is the WebSocket Studio — your workspace for real-time WebSocket testing. It has a split-pane layout: setup tabs on the left, and live event monitoring on the right.',
      highlight: WS.MODE_CLIENT,
    },

    // ── 2. Start Mock Server ─────────────────────────────────────
    {
      id: 'ws-mock',
      title: 'Start the Mock Server',
      description: 'Let\'s start the built-in Mock Server so we have an echo server to connect to. It mirrors back every message you send — perfect for testing.',
      highlight: WS.MOCK_BTN_ANY,
      preAction: async (ctx) => {
        // Switch to Mock tab so the Start/Stop button is in the DOM
        await ctx.click(WS.MODE_MOCK);
        await ctx.delay(200);
      },
      action: async (ctx) => {
        const btn = document.querySelector(WS.MOCK_START_BTN) as HTMLButtonElement | null;
        if (btn && !btn.disabled) {
          await ctx.click(WS.MOCK_START_BTN);
          // Wait for the Stop button to appear — confirms the server is running
          await ctx.waitFor(WS.MOCK_STOP_BTN, 3000);
          _mockRunning = true;
        } else {
          // Server was already running (e.g., resume after restart)
          _mockRunning = true;
        }
      },
      verify: WS.MOCK_STOP_BTN,
    },

    // ── 3. Set the URL ───────────────────────────────────────────
    {
      id: 'ws-url',
      title: 'Switch to Client Mode',
      description: 'Now switch back to Client mode. We\'ll set the URL to ws://localhost:9876 to match the Mock Server port. This is where you\'ll connect and send messages.',
      highlight: WS.URL_INPUT,
      preAction: async (ctx) => {
        await ctx.click(WS.MODE_CLIENT);
        await ctx.click(WS.LEFT_TAB_CONNECT);
      },
      action: async (ctx) => {
        await ctx.fill(WS.URL_INPUT, 'ws://localhost:9876');
      },
    },

    // ── 4. Connect ───────────────────────────────────────────────
    {
      id: 'ws-connect',
      title: 'Connect to the Server',
      description: 'Click Connect to open the WebSocket connection. Watch the status indicator change from "Disconnected" (grey dot) to "Connected" (green dot). The app auto-switches to Send once connected.',
      highlight: WS.CONNECT_BTN,
      preAction: async (ctx) => {
        // Guard: ensure mock server is running before attempting to connect
        await ensureMockRunning(ctx);
        await ctx.click(WS.LEFT_TAB_CONNECT);
      },
      action: async (ctx) => {
        await ctx.click(WS.CONNECT_BTN);
        // Wait for the status dot to confirm connection — more reliable than a fixed delay.
        // STATUS_CONNECTED lives in ConnectPanel (still mounted here) and in the Events
        // MessageLog status bar (right tab = Events by default).
        await ctx.waitFor(WS.STATUS_CONNECTED, 3000);
        _wsConnected = true;
      },
      verify: WS.STATUS_CONNECTED,
    },

    // ── 5. Send ──────────────────────────────────────────────────
    {
      id: 'ws-compose',
      title: 'Send a Message',
      description: 'Switch to the **Send** tab to write messages. You can send plain text, JSON, or binary data. The format pills let you switch between Text, JSON, and Base64 encoding.',
      highlight: WS.COMPOSE_INPUT,
      preAction: async (ctx) => {
        // Guard: ensure connected so the Send panel is in its active send-ready state
        await ensureConnected(ctx);
        await ctx.click(WS.LEFT_TAB_SEND);
      },
      action: async (ctx) => {
        await ctx.fill(WS.MESSAGE_INPUT, '{"hello": "world", "demo": true}');
      },
    },

    // ── 6. Send ──────────────────────────────────────────────────
    {
      id: 'ws-send',
      title: 'Send Your Message',
      description: 'Click Send to transmit the message. The mock server echoes it right back. Look at the Events panel on the right — you\'ll see both the sent (↑) and received (↓) entries appear.',
      highlight: WS.SEND_BTN,
      preAction: async (ctx) => {
        // Guard: ensure connected + message pre-filled so Send is not a no-op on skip-to
        await ensureConnected(ctx);
        await ctx.click(WS.LEFT_TAB_SEND);
        await ctx.delay(100);
        await ctx.fill(WS.MESSAGE_INPUT, '{"hello": "world", "demo": true}');
        await ctx.delay(100);
      },
      action: async (ctx) => {
        await ctx.click(WS.SEND_BTN);
      },
      verify: WS.MESSAGE_ROW,
    },

    // ── 7. Monitor Events ────────────────────────────────────────
    {
      id: 'ws-events',
      title: 'Monitor Live Events',
      description: 'The Events tab shows all WebSocket frames in real-time. Each row has a direction indicator (↑ sent / ↓ received), timestamp, size badge, and message preview. Click any row to see the full payload.',
      highlight: WS.RIGHT_TAB_EVENTS,
      preAction: async (ctx) => {
        // Guard: ensure connected so the Events tab has message rows to show
        await ensureConnected(ctx);
      },
      action: async (ctx) => {
        await ctx.click(WS.RIGHT_TAB_EVENTS);
      },
    },

    // ── 8. Multiple Connections ──────────────────────────────────
    {
      id: 'ws-tabs',
      title: 'Multiple Connections',
      description: 'You can open up to 8 connection tabs, each with its own URL, state, and message history. Click the [+] button to add a new connection. Each tab operates independently.',
      highlight: WS.CONN_TAB_ADD,
    },

    // ── 9. Disconnect ────────────────────────────────────────────
    {
      id: 'ws-disconnect',
      title: 'Disconnect',
      description: 'Click Disconnect to close the connection gracefully. Your message history is preserved. You can reconnect anytime without losing your setup.',
      highlight: WS.DISCONNECT_BTN,
      preAction: async (ctx) => {
        // Guard: ensure connected so Disconnect actually does something visible
        await ensureConnected(ctx);
        await ctx.click(WS.LEFT_TAB_CONNECT);
      },
      action: async (ctx) => {
        await ctx.click(WS.DISCONNECT_BTN);
      },
    },
  ],
};
