/** Lesson 1: Mock Server — zero-friction start, instant WebSocket success */
import type { DemoLesson, DemoActionContext } from '../../types';
import { switchToClientMode, disconnectWebSocket, stopMockServer, closeExtraConnectionTabs } from '../setup-helpers';
import { WS } from '@shared/selectors';
import { showSpotlightRing } from '../../demoRipple';
import { firstVisibleElement } from '../../utils/domVisibility';

// ─── Module-level state flags ────────────────────────────────────────────────
// Reset in setup so each lesson run starts clean and skip-to-step works reliably.
let _mockRunning = false;
let _clientConnected = false;
let _mockPort = '9876'; // actual port read from the Mock Server panel at runtime
const BROADCAST_MESSAGE = 'Server broadcast: welcome everyone!';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Reads the tab's actual assigned mock port from the DOM, if the Mock panel is visible. */
function captureMockPort(): void {
  // Other open WS Studio tabs may also have a Mock panel mounted (hidden) in the DOM,
  // so a plain querySelector can grab a different tab's port input. Scope to the
  // currently VISIBLE one so we always capture the active tab's real port.
  const portInput = firstVisibleElement<HTMLInputElement>(WS.MOCK_PORT_INPUT);
  if (portInput?.value?.trim()) _mockPort = portInput.value.trim();
}

/** Silently ensures the mock server is running. Leaves UI in Mock mode. */
async function ensureMockRunning(ctx: DemoActionContext): Promise<void> {
  if (_mockRunning) {
    // Server already running from a previous step — still refresh the port in case
    // the Mock panel is visible (it may have gone stale since it was first captured).
    captureMockPort();
    return;
  }
  await ctx.click(WS.MODE_MOCK);
  // Wait for mock panel to render (start OR stop button visible)
  await ctx.waitFor(WS.MOCK_BTN_ANY, 2000);
  // Capture the actual running port while the Mock panel is in the DOM
  captureMockPort();
  const startBtn = firstVisibleElement<HTMLButtonElement>(WS.MOCK_START_BTN);
  if (startBtn && !startBtn.disabled) {
    await ctx.click(WS.MOCK_START_BTN);
    await ctx.waitFor(WS.MOCK_STOP_BTN, 3000);
  }
  // If MOCK_START_BTN is absent the server was already running
  _mockRunning = true;
}

function isClientActuallyConnected(): boolean {
  // Client mode signal
  if (firstVisibleElement(WS.STATUS_CONNECTED)) return true;

  // Mock mode signal ("N clients")
  const countNode = firstVisibleElement<HTMLElement>(WS.MOCK_CLIENT_COUNT);
  const raw = countNode?.textContent ?? '';
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0;
}

/** Silently ensures mock server is running AND client is connected. */
async function ensureClientConnected(ctx: DemoActionContext): Promise<void> {
  await ensureMockRunning(ctx);
  if (_clientConnected && isClientActuallyConnected()) return;
  _clientConnected = false;
  await ctx.click(WS.MODE_CLIENT);
  await ctx.waitFor(WS.CONNECT_BTN, 2000);
  await ctx.click(WS.LEFT_TAB_CONNECT);
  await ctx.fill(WS.URL_INPUT, `ws://localhost:${_mockPort}`);
  await ctx.click(WS.CONNECT_BTN);
  await ctx.waitFor(WS.STATUS_CONNECTED, 3000);
  _clientConnected = true;
}

function hasBroadcastMessageReceived(): boolean {
  // Scope to visible rows only — an inactive tab's message log may also be mounted
  // (hidden) in the DOM and shouldn't count toward the active tab's broadcast check.
  const rows = Array.from(document.querySelectorAll<HTMLElement>('.ws-message-received')).filter((row) => {
    const rect = row.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  });
  return rows.some((row) => row.textContent?.includes(BROADCAST_MESSAGE));
}

// ─── Lesson definition ───────────────────────────────────────────────────────

export const wsMockServerLesson: DemoLesson = {
  id: 'ws-mock-server',
  domainId: 'protocols',
  category: 'websocket',
  name: 'Mock Server',
  description: 'Start a built-in echo server in seconds — no setup, no Docker, just instant WebSocket.',
  estimatedMinutes: 3,
  initialTab: 'websocket-studio',

  /** Ensure a clean slate so step 1 can visibly demonstrate switching to Mock mode. */
  setup: async (ctx) => {
    _mockRunning = false;
    _clientConnected = false;
    _mockPort = '9876';
    // Close any extra WS Studio tabs left behind by other lessons/manual testing so this
    // tab's Mock Server panel is the only one mounted — avoids querySelector ambiguity
    // (an inactive tab's hidden panel can otherwise be mistaken for the active one).
    await closeExtraConnectionTabs(ctx);
    await ctx.delay(200);
    // Disconnect any active client session
    const disconnectBtn = firstVisibleElement<HTMLButtonElement>(WS.DISCONNECT_BTN);
    if (disconnectBtn && !disconnectBtn.disabled) {
      disconnectBtn.click();
      await ctx.delay(300);
    }
    // Navigate to Mock mode and stop the server if it's already running
    await ctx.click(WS.MODE_MOCK);
    await ctx.delay(200);
    // Capture this tab's real assigned port (may be 9877/9878 if other tabs existed)
    // BEFORE returning to Client — so the Connect URL matches from the first screen.
    captureMockPort();
    const stopBtn = firstVisibleElement<HTMLButtonElement>(WS.MOCK_STOP_BTN);
    if (stopBtn && !stopBtn.disabled) {
      stopBtn.click();
      await ctx.delay(400);
    }
    // Return to Client mode with the correct mock port already in the URL field
    await ctx.click(WS.MODE_CLIENT);
    await ctx.waitFor(WS.CONNECT_BTN, 2000);
    await ctx.click(WS.LEFT_TAB_CONNECT);
    await ctx.fill(WS.URL_INPUT, `ws://localhost:${_mockPort}`);
    await ctx.delay(200);
  },

  cleanup: async (ctx) => {
    _mockRunning = false;
    _clientConnected = false;
    await disconnectWebSocket(ctx);
    await stopMockServer(ctx);
    await switchToClientMode(ctx);
  },

  concept: {
    title: 'Your Built-in WebSocket Server',
    body: `Most WebSocket tools require you to connect to an external server to test anything. RedFire Forge includes a **built-in Mock Server** — a local echo server that runs entirely in your browser.

**What it does:**
- **Echo mode**: Mirrors every message back to the sender
- **Broadcast mode**: Sends a message to all connected clients
- **Custom rules**: Define response patterns (coming soon)

**Why start here:**
The Mock Server is the fastest path to seeing WebSocket in action. No Docker, no terminal, no external dependencies — start it, connect, send a message, see it echoed. Done.

**Key concept — Client vs Mock mode:**
WebSocket Studio has two modes accessible via toggle buttons at the top:
- **Client mode**: Connect to any WebSocket server
- **Mock mode**: Start/stop the built-in echo server

You'll switch between them during this lesson.

**Port isolation:** every connection tab gets its own Mock Server port (9876, 9877, 9878, …) so tabs never interfere with each other. Always connect the Client to the exact port shown in this tab's Mock Server panel — if you connect to a different port, your messages will go to a different server instance, and this tab's Activity Log will stay empty even though your client works fine. RedFire Forge shows a warning banner in the Mock Server panel whenever it detects that mismatch.`,
    keyTerms: [
      { term: 'Echo', definition: 'The server sends back exactly what it received. Perfect for verifying your client is working.' },
      { term: 'Broadcast', definition: 'The server sends a message to ALL connected clients simultaneously.' },
      { term: 'Mock Server', definition: 'A lightweight WebSocket server running in your browser — no external processes needed.' },
      { term: 'Port Isolation', definition: 'Each tab\'s Mock Server runs on its own port. Connecting the Client to the wrong port means you\'re talking to a different server instance — that tab\'s Activity Log won\'t show your traffic.' },
    ],
    diagram: `<svg viewBox="0 0 400 140" xmlns="http://www.w3.org/2000/svg">
  <rect x="20" y="50" width="100" height="40" rx="6" fill="var(--primary)" opacity="0.2" stroke="var(--primary)" stroke-width="1.5"/>
  <text x="70" y="75" text-anchor="middle" fill="var(--text)" font-size="13" font-family="system-ui">Client</text>
  <rect x="280" y="50" width="100" height="40" rx="6" fill="var(--accent)" opacity="0.2" stroke="var(--accent)" stroke-width="1.5"/>
  <text x="330" y="75" text-anchor="middle" fill="var(--text)" font-size="13" font-family="system-ui">Mock Server</text>
  <line x1="120" y1="60" x2="280" y2="60" stroke="var(--primary)" stroke-width="1.5" marker-end="url(#ms-arrow)"/>
  <text x="200" y="55" text-anchor="middle" fill="var(--text-muted)" font-size="10">send "hello"</text>
  <line x1="280" y1="80" x2="120" y2="80" stroke="var(--accent)" stroke-width="1.5" marker-end="url(#ms-arrow2)"/>
  <text x="200" y="98" text-anchor="middle" fill="var(--text-muted)" font-size="10">echo "hello"</text>
  <text x="330" y="35" text-anchor="middle" fill="var(--text-muted)" font-size="10" font-style="italic">localhost:9876</text>
  <defs>
    <marker id="ms-arrow" markerWidth="8" markerHeight="8" refX="8" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8" fill="none" stroke="var(--primary)" stroke-width="1.5"/></marker>
    <marker id="ms-arrow2" markerWidth="8" markerHeight="8" refX="8" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8" fill="none" stroke="var(--accent)" stroke-width="1.5"/></marker>
  </defs>
</svg>`,
  },

  steps: [
    {
      id: 'mock-intro',
      title: 'Welcome — Meet Mock Mode',
      description: 'WebSocket Studio has two modes: Client (connect to servers) and Mock (run your own server). Click the Mock toggle to switch to Mock mode — this is where you\'ll start your server.',
      highlight: WS.MODE_MOCK,
      action: async (ctx) => {
        await ctx.click(WS.MODE_MOCK);
        // Wait for the mock panel to confirm the mode switch — Rule 5
        await ctx.waitFor(WS.MOCK_BTN_ANY, 2000);
      },
    },
    {
      id: 'mock-start',
      title: 'Start the Mock Server',
      description: 'Click Start to launch the echo server on the port shown above. It starts instantly — no Docker, no terminal, no waiting. Watch the status indicator change to "Listening".',
      highlight: WS.MOCK_START_BTN,
      action: async (ctx) => {
        const btn = firstVisibleElement<HTMLButtonElement>(WS.MOCK_START_BTN);
        if (btn && !btn.disabled) {
          await ctx.click(WS.MOCK_START_BTN);
          await ctx.waitFor(WS.MOCK_STOP_BTN, 3000);
        }
        // Capture the tab's actual assigned port now that the server is confirmed running —
        // this step bypasses ensureMockRunning(), so it must capture the port itself.
        captureMockPort();
        // Server is now running (started or was already running)
        _mockRunning = true;
      },
      verify: WS.MOCK_STOP_BTN,
    },
    {
      id: 'mock-status',
      title: 'Server Status',
      description: 'The status indicator shows the server is Listening on this tab\'s assigned port with 0 connected clients. The client count updates in real-time as connections come and go. Remember this port — you\'ll need it in the next step.',
      highlight: WS.MOCK_STATUS_LABEL,
      // Rule 4: ensure mock server is running and we're in Mock mode if this step is skipped to
      preAction: async (ctx) => {
        await ensureMockRunning(ctx);
        // ensureMockRunning leaves in Mock mode; re-click to handle the case where
        // _mockRunning was already true and we came from Client mode
        await ctx.click(WS.MODE_MOCK);
      },
    },
    {
      id: 'mock-connect',
      title: 'Connect to Your Server',
      description: 'Now switch to Client mode and connect to your mock server. The URL is pre-filled with this tab\'s own mock port. Click Connect — the status dot turns green and your mock server shows "1 client".',
      highlight: WS.CONNECT_BTN,
      preAction: async (ctx) => {
        // Rule 4: ensure mock server is running before we try to connect
        await ensureMockRunning(ctx);
        await ctx.click(WS.MODE_CLIENT);
        // Rule 5: wait for connect button instead of fixed delay
        await ctx.waitFor(WS.CONNECT_BTN, 2000);
        await ctx.click(WS.LEFT_TAB_CONNECT);
        await ctx.fill(WS.URL_INPUT, `ws://localhost:${_mockPort}`);
      },
      action: async (ctx) => {
        await ctx.click(WS.CONNECT_BTN);
        // Rule 5: wait for confirmed connection instead of relying solely on verify
        await ctx.waitFor(WS.STATUS_CONNECTED, 3000);
        _clientConnected = true;
      },
      verify: WS.STATUS_CONNECTED,
    },
    {
      id: 'mock-echo',
      title: 'Echo — Messages Bounce Back',
      description: 'Send any message and watch it appear twice in the Events panel: once as sent (↑) and once as received (↓). The mock server echoes every message right back — instant verification that your connection works.',
      highlight: WS.SEND_BTN,
      preAction: async (ctx) => {
        // Rule 4: ensure mock server running AND client connected before trying to send
        await ensureClientConnected(ctx);
        // Always switch to Client mode explicitly — we may be coming from Mock-mode steps
        // (e.g. steps 3/6 click MODE_MOCK) and ensureClientConnected exits early when
        // _clientConnected is already true, skipping the MODE_CLIENT click.
        await ctx.click(WS.MODE_CLIENT);
        await ctx.waitFor(WS.LEFT_TAB_SEND, 1500);
        await ctx.click(WS.LEFT_TAB_SEND);
        await ctx.fill(WS.MESSAGE_INPUT, '{"greeting": "Hello from Mock Server demo!"}');
      },
      action: async (ctx) => {
        await ctx.click(WS.SEND_BTN);
      },
      verify: WS.MESSAGE_ROW,
    },
    {
      id: 'mock-broadcast',
      title: 'Broadcast Mode — Send from Server',
      description: 'Switch to **Mock** mode to reach the broadcast panel. Watch the demo open the **Server Log** tab, type a server-push message, and click **Broadcast** — it\'s sent simultaneously to every connected client. The new entry lights up at the top of the log. This simulates real-world server-push patterns: live score updates, chat messages, notification bursts.',
      highlight: WS.MOCK_BROADCAST_BTN,
      preAction: async (ctx) => {
        // Rule 4: ensure both server and at least one client are connected
        // so the broadcast can be observed in the next step.
        await ensureClientConnected(ctx);
        // Ensure we're in Mock mode even if _mockRunning was already true
        await ctx.click(WS.MODE_MOCK);
        // Switch to the Server Log tab before broadcasting so the viewer already
        // sees the log panel when the new entry appears.
        await ctx.waitFor(WS.MOCK_TAB_LOG, 2000);
        await ctx.click(WS.MOCK_TAB_LOG);
        await ctx.delay(300);
        // Rule 5: wait for broadcast input to appear instead of fixed delay
        await ctx.waitFor(WS.MOCK_BROADCAST_INPUT, 2000);
        await ctx.delay(500);
        await ctx.fill(WS.MOCK_BROADCAST_INPUT, BROADCAST_MESSAGE);
        await ctx.delay(600);
      },
      action: async (ctx) => {
        // Click Broadcast so the message actually goes out — this is what the viewer sees
        await ctx.click(WS.MOCK_BROADCAST_BTN);
        await ctx.delay(500);
        // The Activity Log renders newest-first (reversedLogs), so the entry that
        // just appeared is always the first child — spotlight it for the viewer.
        await ctx.waitFor(`${WS.MOCK_LOG} .ws-mock-log-entry`, 1500);
        const entry = firstVisibleElement<HTMLElement>(`${WS.MOCK_LOG} .ws-mock-log-entry:first-child`);
        if (entry) {
          const removeRing = showSpotlightRing(entry);
          await ctx.delay(900);
          removeRing();
        }
      },
      verify: WS.MOCK_BROADCAST_BTN,
    },
    {
      id: 'mock-broadcast-receive',
      title: 'Client Receives the Broadcast',
      description: 'Switch back to **Client** mode — you\'ll see the broadcast message arrive in the Events log as a received (↓) frame. Every connected client receives the same message at the same time. This is exactly how push notifications, live sports scores, and chat rooms work over WebSocket.',
      // Rows are virtualized: each MessageRow is the sole child of its own absolutely-
      // positioned wrapper div, so a plain `.ws-message-received` selector grabs the
      // FIRST matching row in DOM order (an earlier echoed reply), not the broadcast
      // that just arrived. Scope to the last rendered wrapper so we highlight the
      // newest received frame instead.
      highlight: '.ws-message-list-inner > div:last-child .ws-message-received',
      preAction: async (ctx) => {
        // Rule 4: must have a connected client and a running server
        await ensureClientConnected(ctx);
        // Switch to Mock mode and broadcast silently if this step's broadcast
        // payload is not visible yet (ignore older echo/received frames).
        if (!hasBroadcastMessageReceived()) {
          await ctx.click(WS.MODE_MOCK);
          await ctx.waitFor(WS.MOCK_BROADCAST_INPUT, 2000);
          const input = firstVisibleElement<HTMLInputElement>(WS.MOCK_BROADCAST_INPUT);
          if (input && !input.value.trim()) {
            input.value = BROADCAST_MESSAGE;
            input.dispatchEvent(new Event('input', { bubbles: true }));
          }
          const broadcastBtn = firstVisibleElement<HTMLButtonElement>(WS.MOCK_BROADCAST_BTN);
          if (broadcastBtn && !broadcastBtn.disabled) broadcastBtn.click();
          await ctx.delay(600);
        }
        // Switch to Client mode so the viewer sees the Events log
        await ctx.click(WS.MODE_CLIENT);
        await ctx.waitFor(WS.RIGHT_TAB_EVENTS, 2000);
        await ctx.click(WS.RIGHT_TAB_EVENTS);
        await ctx.delay(400);
      },
      action: async (ctx) => {
        // Navigate to Client mode and open the Events tab to show the received broadcast
        await ctx.click(WS.MODE_CLIENT);
        await ctx.delay(500);
        await ctx.waitFor(WS.RIGHT_TAB_EVENTS, 2000);
        await ctx.click(WS.RIGHT_TAB_EVENTS);
        await ctx.delay(700);
      },
      verify: '.ws-message-list-inner > div:last-child .ws-message-received',
    },
    {
      id: 'mock-stop',
      title: 'Stop the Server',
      description: 'Click Stop to shut down the mock server. Any connected client is automatically disconnected. Your message history is preserved — you can restart and reconnect anytime.',
      highlight: WS.MOCK_STOP_BTN,
      // Rule 4: server must be running to demo stopping it
      preAction: async (ctx) => {
        await ensureMockRunning(ctx);
        // Ensure we're in Mock mode so the stop button is visible
        await ctx.click(WS.MODE_MOCK);
        await ctx.waitFor(WS.MOCK_STOP_BTN, 2000);
      },
      action: async (ctx) => {
        const btn = firstVisibleElement<HTMLButtonElement>(WS.MOCK_STOP_BTN);
        if (btn && !btn.disabled) {
          await ctx.click(WS.MOCK_STOP_BTN);
          _mockRunning = false;
          _clientConnected = false;
        }
      },
      verify: WS.MOCK_START_BTN,
    },
  ],
};
