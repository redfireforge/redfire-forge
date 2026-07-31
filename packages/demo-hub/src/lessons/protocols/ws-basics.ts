/** Lesson: WebSocket Basics — connect, send, receive */
import type { DemoActionContext, DemoLesson } from '../../types';
import { wsCleanup, closeExtraConnectionTabs } from '../setup-helpers';
import { APP, EM, WS } from '@shared/selectors';
import { showSpotlightRing } from '../../demoRipple';
import { firstVisibleElement } from '../../utils/domVisibility';
import {
  cleanupDemoEnvironment,
  cleanupDemoMicroservice,
  ensureWsDemoEndpointConfigured,
  ensureWsDemoHeaderContext,
  ensureWsDemoProtocolReady,
  navigateToWebSocketStudio,
  selectEnvInHeader,
  selectSvcInHeader,
  WS_DEMO_ENV_NAME,
  WS_DEMO_SVC_NAME,
} from '../env-manager-lesson-helpers';

// ── Constants ──────────────────────────────────────────────────────
const WS_ENV_VAR_URL = '{{wsBaseUrl}}';

/** Dedicated environment and microservice used only by this demo lesson. */
const DEMO_ENV_NAME = WS_DEMO_ENV_NAME;
const DEMO_SVC_NAME = WS_DEMO_SVC_NAME;

/**
 * Tracks whether the built-in mock echo server has been started in the current
 * demo session. Reset by setup() so repeat runs start fresh.
 */
let _mockRunning = false;

/**
 * Tracks whether a WebSocket connection is open in the current demo session.
 * Reset by setup() so repeat runs start fresh.
 */
let _wsConnected = false;

/**
 * The tab's actual assigned mock port, read from the Mock Server panel at runtime.
 * A tab is NOT guaranteed to land on 9876 — `closeExtraConnectionTabs()` reduces the
 * tab count to 1 but doesn't renumber a surviving tab's already-assigned port — so
 * this is captured live rather than assumed. Falls back to '9876' until captured.
 */
let _mockPort = '9876';

/** Reads the tab's actual assigned mock port from the DOM, if the Mock panel is visible. */
function captureMockPort(): void {
  const portInput = firstVisibleElement<HTMLInputElement>(WS.MOCK_PORT_INPUT);
  if (portInput?.value?.trim()) _mockPort = portInput.value.trim();
}

/**
 * Ensure the built-in mock echo server is running.
 * No-op if already started in this lesson session.
 * Always returns with Client mode active.
 */
async function ensureMockRunning(ctx: DemoActionContext): Promise<void> {
  if (_mockRunning) {
    captureMockPort();
    return;
  }
  await ctx.click(WS.MODE_MOCK);
  await ctx.delay(200);
  captureMockPort();
  const startBtn = firstVisibleElement<HTMLButtonElement>(WS.MOCK_START_BTN);
  if (startBtn && !startBtn.disabled) {
    await ctx.click(WS.MOCK_START_BTN);
    await ctx.waitFor(WS.MOCK_STOP_BTN, 3000);
  }
  _mockRunning = true;
  await ctx.click(WS.MODE_CLIENT);
  await ctx.delay(200);
}

/**
 * Ensure Client → Connect is active and the URL field shows {{wsBaseUrl}}.
 * Idempotent — skips fill when the template is already present.
 */
async function ensureWsUrlTemplate(ctx: DemoActionContext): Promise<void> {
  await navigateToWebSocketStudio(ctx);
  await ensureWsDemoHeaderContext(ctx, `ws://localhost:${_mockPort}`);
  await ctx.click(WS.MODE_CLIENT);
  await ctx.delay(200);
  await ctx.click(WS.LEFT_TAB_CONNECT);
  await ctx.delay(200);
  const input = firstVisibleElement<HTMLInputElement>(WS.URL_INPUT);
  if (input && input.value.trim() !== WS_ENV_VAR_URL) {
    await ctx.fill(WS.URL_INPUT, WS_ENV_VAR_URL);
    await ctx.delay(400);
  }
}

/**
 * Guard used by preActions of connect/send steps to ensure the WebSocket
 * connection is open using {{wsBaseUrl}} from the Environment Manager.
 * Idempotent — returns immediately if already connected.
 */
async function ensureConnected(ctx: DemoActionContext): Promise<void> {
  if (_wsConnected) return;
  if (firstVisibleElement(WS.STATUS_CONNECTED)) {
    _wsConnected = true;
    return;
  }
  await ensureMockRunning(ctx);
  await ensureWsUrlTemplate(ctx);
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
  estimatedMinutes: 5,
  initialTab: 'websocket-studio',
  allowedTabs: ['environments', 'websocket-studio'],

  setup: async (ctx) => {
    _mockRunning = false;
    _wsConnected = false;
    _mockPort = '9876';
    // Remove stale ws-demo from prior runs (HTTP tab, d01 deploy, old step order).
    await cleanupDemoMicroservice(ctx, WS_DEMO_SVC_NAME);
    await cleanupDemoEnvironment(ctx, WS_DEMO_ENV_NAME);
    await navigateToWebSocketStudio(ctx);
    await ctx.delay(300);
    // Close extra tabs so only this tab's mock server is in play. This does NOT
    // guarantee port 9876 — the surviving tab keeps whatever port it was already
    // assigned — so the real port is captured below and used for the endpoint
    // config instead of assuming 9876.
    await closeExtraConnectionTabs(ctx);
    await ctx.delay(200);
    // Disconnect any active session so the connect step can demo from scratch
    const disconnectBtn = firstVisibleElement<HTMLButtonElement>(WS.DISCONNECT_BTN);
    if (disconnectBtn && !disconnectBtn.disabled) {
      disconnectBtn.click();
      await ctx.delay(400);
    }
    // Stop mock server if running so the mock step can demo starting it
    await ctx.click(WS.MODE_MOCK);
    await ctx.delay(300);
    // Capture this tab's real assigned mock port while the Mock panel is visible.
    captureMockPort();
    const stopBtn = firstVisibleElement<HTMLButtonElement>(WS.MOCK_STOP_BTN);
    if (stopBtn && !stopBtn.disabled) {
      stopBtn.click();
      await ctx.delay(500);
    }
    // Return to Mock mode with server stopped so step 1 introduces the mock-first flow
    await ctx.click(WS.MODE_MOCK);
    await ctx.delay(200);
  },
  cleanup: async (ctx) => {
    _mockRunning = false;
    _wsConnected = false;
    await cleanupDemoMicroservice(ctx, WS_DEMO_SVC_NAME);
    await cleanupDemoEnvironment(ctx, WS_DEMO_ENV_NAME);
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
      description:
        'WebSocket Studio has two modes: **Mock Server** (built-in echo server for learning) and **Client** ' +
        '(connect, send, and monitor live traffic). We start with the **Mock Server** tab — start the server first, ' +
        'then switch to **Client** mode to connect and send messages.',
      highlight: WS.MODE_MOCK,
      pauseAfter: true,
    },

    // ── 2. Add WebSocket Protocol in Environment Manager ─────────
    {
      id: 'ws-add-protocol',
      title: 'Add WebSocket Protocol',
      description:
        'Open **Settings → Environments**, add an environment called **"WebSocket Demo"** and a microservice ' +
        'called **"ws-demo"**. Expand the microservice — it starts with **no protocol tabs**. ' +
        'Click **+ Add protocol** and choose **WebSocket**. Only the **WebSocket** tab appears (HTTP is not added ' +
        'by default). Check the deploy box for **WebSocket Demo** so the environment is active on this service.',
      highlight: EM.ADD_PROTOCOL_BTN,
      pauseAfter: true,
      preAction: async (ctx: DemoActionContext) => {
        if (!firstVisibleElement(WS.URL_INPUT)) {
          await navigateToWebSocketStudio(ctx);
        }
      },
      action: async (ctx: DemoActionContext) => {
        await ensureWsDemoProtocolReady(ctx);
        await ctx.delay(800);
      },
    },

    // ── 3. Configure WebSocket Endpoint ──────────────────────────
    {
      id: 'ws-env-config',
      title: 'Configure WebSocket Endpoint',
      description:
        'On the **WebSocket** tab, click **Edit** on the **WebSocket Demo** row and enter your mock server\'s ' +
        'URL (e.g. `ws://localhost:9876` — the exact port depends on how many connection tabs you have open). ' +
        'Click **Save** — the status changes to **✓ set** and the derived-variables panel shows ' +
        '`{{wsBaseUrl}}` resolved to your endpoint. Only the **WebSocket** tab is present — no HTTP tab.',
      highlight: EM.PROTOCOL_TAB_WS,
      pauseAfter: true,
      preAction: async (ctx: DemoActionContext) => {
        await ensureWsDemoProtocolReady(ctx);
      },
      action: async (ctx: DemoActionContext) => {
        await ensureWsDemoEndpointConfigured(ctx, `ws://localhost:${_mockPort}`);
        await ctx.delay(1000);
      },
    },

    // ── 4. Start Mock Server ─────────────────────────────────────
    {
      id: 'ws-mock',
      title: 'Start the Mock Server',
      description:
        'The built-in **Mock Server** echoes every message you send — perfect for learning. ' +
        'Switch to the **Mock Server** tab and click **Start Server**. The listen address shown (e.g. ' +
        '`ws://localhost:9876`) matches the endpoint you saved in the Environment Manager. After the server is ' +
        'running, we switch to **Client** mode to connect using `{{wsBaseUrl}}` instead of typing that address by hand.',
      highlight: WS.MOCK_BTN_ANY,
      pauseAfter: true,
      preAction: async (ctx) => {
        await navigateToWebSocketStudio(ctx);
        await ctx.click(WS.MODE_MOCK);
        await ctx.delay(200);
        captureMockPort();
      },
      action: async (ctx) => {
        const btn = firstVisibleElement<HTMLButtonElement>(WS.MOCK_START_BTN);
        if (btn && !btn.disabled) {
          await ctx.click(WS.MOCK_START_BTN);
          await ctx.waitFor(WS.MOCK_STOP_BTN, 3000);
          _mockRunning = true;
        } else {
          _mockRunning = true;
        }
      },
      verify: WS.MOCK_STOP_BTN,
    },

    // ── 5. Select Environment & Service in Header ────────────────
    {
      id: 'ws-header-select',
      title: 'Select Environment & Service',
      description:
        'With the mock server running, switch to **Client** mode. Endpoints live on a microservice, but ' +
        '**WebSocket Studio** resolves `{{wsBaseUrl}}` from the **Environment** and **Service** dropdowns in the app header. ' +
        'Choose **"WebSocket Demo"** for Environment and **"ws-demo"** for Service — the protocol indicator beside them ' +
        'confirms the resolved WebSocket address.',
      highlight: APP.HEADER_SELECTORS,
      pauseAfter: true,
      preAction: async (ctx: DemoActionContext) => {
        await navigateToWebSocketStudio(ctx);
        await ctx.click(WS.MODE_CLIENT);
        await ctx.delay(200);
        await ctx.click(WS.LEFT_TAB_CONNECT);
        await ctx.delay(200);
      },
      action: async (ctx: DemoActionContext) => {
        await selectEnvInHeader(ctx, DEMO_ENV_NAME);
        await ctx.delay(800);
        await selectSvcInHeader(ctx, DEMO_SVC_NAME);
        await ctx.delay(600);
        // Payoff: leave the ring on Environment + Service so the viewer confirms
        // the header context (and resolved protocol indicator) before Next.
        const envEl = document.querySelector<HTMLElement>(APP.HEADER_ENV_SELECT);
        if (envEl) {
          const remove = showSpotlightRing(envEl);
          await ctx.delay(900);
          remove();
        }
        const svcEl = document.querySelector<HTMLElement>(APP.HEADER_SVC_SELECT);
        if (svcEl) {
          const remove = showSpotlightRing(svcEl);
          await ctx.delay(1100);
          remove();
        }
      },
    },

    // ── 6. Environment Variables in URLs ─────────────────────────
    {
      id: 'ws-env-vars',
      title: 'Environment Variables in URLs',
      description:
        'On the **Connect** tab in **Client** mode, type `{{wsBaseUrl}}` instead of hardcoding a literal address ' +
        'like `ws://localhost:9876`. ' +
        'Watch **→ Resolved:** appear below the input — RedfireForge resolves `{{wsBaseUrl}}` from the **WebSocket** ' +
        'tab endpoint using the **WebSocket Demo** environment and **ws-demo** service you selected.',
      highlight: WS.URL_INPUT,
      pauseAfter: true,
      preAction: async (ctx: DemoActionContext) => {
        await ensureWsUrlTemplate(ctx);
      },
      action: async (ctx: DemoActionContext) => {
        await ensureWsUrlTemplate(ctx);
        await ctx.fill(WS.URL_INPUT, WS_ENV_VAR_URL);
        await ctx.delay(2000);
      },
    },

    // ── 7. Connect ───────────────────────────────────────────────
    {
      id: 'ws-connect',
      title: 'Connect to the Server',
      description:
        'The URL field still shows `{{wsBaseUrl}}` — RedfireForge resolves it using the **WebSocket Demo** ' +
        'environment and **ws-demo** service before connecting. Click **Connect**. Watch the status indicator change ' +
        'from "Disconnected" (grey dot) to "Connected" (green dot). The app auto-switches to Send once connected.',
      highlight: WS.CONNECT_BTN,
      pauseAfter: true,
      preAction: async (ctx) => {
        await ensureMockRunning(ctx);
        await ensureWsUrlTemplate(ctx);
      },
      action: async (ctx) => {
        const disconnectBtn = firstVisibleElement<HTMLButtonElement>(WS.DISCONNECT_BTN);
        if (disconnectBtn && !disconnectBtn.disabled) {
          await ctx.click(WS.DISCONNECT_BTN);
          await ctx.delay(400);
          _wsConnected = false;
        }
        await ensureWsUrlTemplate(ctx);
        await ctx.fill(WS.URL_INPUT, WS_ENV_VAR_URL);
        await ctx.delay(300);
        await ctx.click(WS.CONNECT_BTN);
        await ctx.waitFor(WS.STATUS_CONNECTED, 3000);
        _wsConnected = true;
      },
      verify: WS.STATUS_CONNECTED,
    },

    // ── 8. Compose + send ────────────────────────────────────────
    {
      id: 'ws-send',
      title: 'Send a Message',
      description:
        'Open the **Send** tab and type a JSON payload — plain text, JSON, or Base64 via the format pills. ' +
        'Click **Send** to transmit it. The mock server echoes it right back. Watch the **Events** panel — ' +
        'you\'ll see both the sent (↑) and received (↓) entries appear.',
      highlight: WS.SEND_BTN,
      pauseAfter: true,
      preAction: async (ctx) => {
        await ensureConnected(ctx);
        await ctx.click(WS.LEFT_TAB_SEND);
        // Quiet pre-fill so rapid Next still has a payload ready to send
        await ctx.fill(WS.MESSAGE_INPUT, '{"hello": "world", "demo": true}');
      },
      action: async (ctx) => {
        await ctx.click(WS.LEFT_TAB_SEND);
        await ctx.delay(500);
        await ctx.fill(WS.MESSAGE_INPUT, '{"hello": "world", "demo": true}');
        await ctx.delay(900); // viewer reads the composed message
        await ctx.click(WS.SEND_BTN);
        await ctx.waitFor(WS.MESSAGE_ROW, 5000);
        await ctx.delay(500);
        // Show the Events payoff in the same step so compose+send aren't split from the result
        await ctx.click(WS.RIGHT_TAB_EVENTS);
        await ctx.delay(1200);
      },
      verify: WS.MESSAGE_ROW,
    },

    // ── 9. Monitor Events ───────────────────────────────────────
    {
      id: 'ws-events',
      title: 'Monitor Live Events',
      description:
        'The Events tab shows all WebSocket frames in real-time. Each row has a direction indicator (↑ sent / ↓ received), ' +
        'timestamp, size badge, and message preview. Click any row to see the full payload.',
      highlight: WS.RIGHT_TAB_EVENTS,
      pauseAfter: true,
      preAction: async (ctx) => {
        await ensureConnected(ctx);
        // Belts for rapid Next: ensure a message exists and Events is open
        await ctx.click(WS.LEFT_TAB_SEND);
        await ctx.delay(100);
        await ctx.fill(WS.MESSAGE_INPUT, '{"hello": "world", "demo": true}');
        await ctx.delay(100);
        if (!document.querySelector(WS.MESSAGE_ROW)) {
          await ctx.click(WS.SEND_BTN);
          await ctx.waitFor(WS.MESSAGE_ROW, 5000);
        }
        await ctx.click(WS.RIGHT_TAB_EVENTS);
      },
      action: async (ctx) => {
        await ctx.click(WS.RIGHT_TAB_EVENTS);
        await ctx.delay(800);
      },
    },

    // ── 10. Multiple Connections ─────────────────────────────────
    {
      id: 'ws-tabs',
      title: 'Multiple Connections',
      description:
        'You can open up to 8 connection tabs, each with its own URL, state, and message history. ' +
        'Click the [+] button to add a new connection. Each tab operates independently.',
      highlight: WS.CONN_TAB_ADD,
      pauseAfter: true,
    },

    // ── 11. Disconnect ───────────────────────────────────────────
    {
      id: 'ws-disconnect',
      title: 'Disconnect',
      description:
        'Click Disconnect to close the connection gracefully. Your message history is preserved. ' +
        'You can reconnect anytime — the URL field keeps `{{wsBaseUrl}}` so the endpoint stays in sync with the Environment Manager.',
      highlight: WS.DISCONNECT_BTN,
      pauseAfter: true,
      preAction: async (ctx) => {
        await ensureConnected(ctx);
        await ctx.click(WS.LEFT_TAB_CONNECT);
      },
      action: async (ctx) => {
        await ctx.click(WS.DISCONNECT_BTN);
        _wsConnected = false;
      },
    },
  ],
};
