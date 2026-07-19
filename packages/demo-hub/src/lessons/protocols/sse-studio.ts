/** Lesson 9: SSE Studio — connect to an SSE endpoint, monitor events, and explore the console */
import type { DemoActionContext, DemoLesson } from '../../types';
import { APP, EM, SSE } from '@shared/selectors';
import {
  cleanupDemoEnvironment,
  cleanupDemoMicroservice,
  ensureDemoEnvironment,
  ensureDemoMicroservice,
  ensureNamedEnvDeployedOnProtocol,
  ensureProtocolEnabled,
  editNamedProtocolEndpoint,
  expandNamedMicroservice,
  navigateToEnvironmentManager,
  navigateToSseStudio,
  selectEnvInHeader,
  selectProtocolTab,
  selectSvcInHeader,
  ensureSseDemoHeaderContext,
} from '../env-manager-lesson-helpers';
import { closeExtraSseConnectionTabs } from '../setup-helpers';


// ── Constants ──────────────────────────────────────────────────────
const SSE_BASE_URL = 'http://localhost:3001';
const SSE_ENV_VAR_URL = '{{sseUrl}}/api/sse-test';

/** Dedicated environment and microservice used only by this demo lesson. */
const DEMO_ENV_NAME = 'SSE Demo';
const DEMO_SVC_NAME = 'sse-demo';

/** CSS selector for the connected-state indicator. Used by waitFor and replay guards. */
const SSE_CONNECTED_DOT = '.sse-state-dot.sse-state-connected';

// ── Helpers ────────────────────────────────────────────────────────

/**
 * Guard used by preActions of steps 5+ to ensure the SSE connection is
 * established before the spotlight tries to read elements that only render
 * when connected/events-tab is active.
 * Uses {{sseUrl}} so the demo stays consistent with the env-var step.
 * Idempotent — returns immediately if already connected.
 */
async function ensureSseConnected(ctx: DemoActionContext): Promise<void> {
  if (document.querySelector(SSE_CONNECTED_DOT)) return;
  await navigateToSseStudio(ctx);
  await ensureSseDemoHeaderContext(ctx);
  await ctx.fill(SSE.URL_INPUT, SSE_ENV_VAR_URL);
  await ctx.delay(200);
  await ctx.click(SSE.CONNECT_BTN);
  await ctx.waitFor(SSE_CONNECTED_DOT);
  await ctx.delay(500); // brief pause for first events to arrive
}

// ── Setup / Cleanup ────────────────────────────────────────────────

/** Setup: navigate to SSE Studio and ensure clean state. */
async function sseSetup(ctx: DemoActionContext): Promise<void> {
  await ctx.delay(500);
  // Disconnect if already connected
  const connectBtn = document.querySelector(SSE.CONNECT_BTN) as HTMLButtonElement | null;
  if (connectBtn?.textContent?.includes('Disconnect')) {
    connectBtn.click();
    await ctx.delay(500);
  }
  await closeExtraSseConnectionTabs(ctx);
  // Clear any existing events
  const clearBtn = document.querySelector(SSE.CLEAR_BTN) as HTMLButtonElement | null;
  if (clearBtn && !clearBtn.disabled) {
    clearBtn.click();
    await ctx.delay(200);
  }
  // Switch to events tab
  const eventsTab = document.querySelector(SSE.RIGHT_TAB_EVENTS) as HTMLButtonElement | null;
  if (eventsTab) {
    eventsTab.click();
    await ctx.delay(200);
  }
  // Switch to connect tab
  const connectTab = document.querySelector(SSE.LEFT_TAB_CONNECT) as HTMLButtonElement | null;
  if (connectTab) {
    connectTab.click();
    await ctx.delay(200);
  }
}

/** Cleanup: disconnect, clear events, then remove the demo environment and microservice. */
async function sseCleanup(ctx: DemoActionContext): Promise<void> {
  // Disconnect any live SSE connection first so the studio is in a clean state.
  const connectBtn = document.querySelector(SSE.CONNECT_BTN) as HTMLButtonElement | null;
  if (connectBtn?.textContent?.includes('Disconnect')) {
    connectBtn.click();
    await ctx.delay(500);
  }
  await closeExtraSseConnectionTabs(ctx);
  // Clear events panel.
  const clearBtn = document.querySelector(SSE.CLEAR_BTN) as HTMLButtonElement | null;
  if (clearBtn && !clearBtn.disabled) {
    clearBtn.click();
    await ctx.delay(200);
  }
  // Remove the demo microservice and environment created during the lesson.
  // The microservice must be deleted first (otherwise EM counts it as "associated").
  await cleanupDemoMicroservice(ctx, DEMO_SVC_NAME);
  await cleanupDemoEnvironment(ctx, DEMO_ENV_NAME);
  // Navigate back to SSE Studio so the lesson page is clean for replay.
  await navigateToSseStudio(ctx);
}

export const sseStudioLesson: DemoLesson = {
  id: 'sse-studio',
  domainId: 'protocols',
  category: 'sse',
  name: 'SSE Studio',
  description: 'Connect to a Server-Sent Events endpoint and monitor real-time event streams.',
  estimatedMinutes: 6,
  initialTab: 'sse-studio',
  allowedTabs: ['environments', 'sse-studio'],

  setup: sseSetup,
  cleanup: sseCleanup,

  concept: {
    title: 'Server-Sent Events (SSE)',
    body: `**Server-Sent Events** is a lightweight protocol for one-way real-time streaming from server to client. Unlike WebSocket (bidirectional), SSE only flows from server to browser — making it perfect for live feeds, notifications, and dashboards.

**How SSE Works**
- Client opens a persistent HTTP GET request to an endpoint
- Server responds with \`Content-Type: text/event-stream\`
- Server pushes text events, each with an optional \`id\`, \`event\` type, and \`data\` field
- Browser auto-reconnects if the connection drops, using \`Last-Event-ID\`

**RedfireForge SSE Studio**
- **Connect** to any SSE endpoint — just paste a URL
- **Live event stream** — events appear in real-time with type badges (message, update, status)
- **Event detail** — click any event to see its full payload, ID, and timestamp
- **Search & filter** — search event data, filter by event type, or show only bookmarked events
- **Console** — lifecycle logging, /connect, /disconnect, /clear, /help commands
- **Auth support** — Bearer, API Key, or Basic auth sent via headers

**SSE vs WebSocket**

| | SSE | WebSocket |
|---|---|---|
| Direction | Server → Client only | Bidirectional |
| Protocol | HTTP | ws:// / wss:// |
| Auto-reconnect | Built-in | Manual |
| Best for | Live feeds, notifications | Chat, gaming, real-time collab |`,
    keyTerms: [
      { term: 'SSE', definition: 'Server-Sent Events — a one-way real-time protocol from server to client over HTTP.' },
      { term: 'Event Type', definition: 'An optional label on each SSE event (e.g., "message", "update", "status").' },
      { term: 'Last-Event-ID', definition: 'The browser sends this header on reconnect so the server can resume from where it left off.' },
      { term: 'EventSource', definition: 'The browser API used to connect to an SSE endpoint.' },
    ],
    diagram: `<svg viewBox="0 0 400 120" xmlns="http://www.w3.org/2000/svg" style="font-family:system-ui,sans-serif">
  <rect x="0" y="0" width="400" height="120" rx="8" fill="#1e1e2e" />

  <!-- Server -->
  <rect x="15" y="25" width="100" height="70" rx="4" fill="#2a2a3a" />
  <text x="65" y="45" text-anchor="middle" fill="#f59e0b" font-size="10" font-weight="bold">Server</text>
  <text x="65" y="60" text-anchor="middle" fill="#888" font-size="8">text/event-stream</text>
  <text x="65" y="75" text-anchor="middle" fill="#888" font-size="8">id: 1</text>
  <text x="65" y="85" text-anchor="middle" fill="#888" font-size="8">data: {...}</text>

  <!-- Arrow -->
  <path d="M120,60 L190,60" stroke="#4ade80" stroke-width="2" marker-end="url(#arr)" />
  <path d="M120,60 L190,60" stroke="#4ade80" stroke-width="8" opacity="0.1" />
  <text x="155" y="52" text-anchor="middle" fill="#4ade80" font-size="8">push events</text>

  <!-- Client -->
  <rect x="195" y="25" width="100" height="70" rx="4" fill="#2a2a3a" />
  <text x="245" y="45" text-anchor="middle" fill="#60a5fa" font-size="10" font-weight="bold">Browser</text>
  <text x="245" y="60" text-anchor="middle" fill="#888" font-size="8">EventSource API</text>
  <text x="245" y="75" text-anchor="middle" fill="#888" font-size="8">auto-reconnect</text>
  <text x="245" y="85" text-anchor="middle" fill="#888" font-size="8">Last-Event-ID</text>

  <!-- Features -->
  <rect x="310" y="15" width="80" height="90" rx="4" fill="#2a2a3a" />
  <text x="350" y="32" text-anchor="middle" fill="#c4b5fd" font-size="8" font-weight="bold">Features</text>
  <text x="350" y="48" text-anchor="middle" fill="#888" font-size="7">📡 Live stream</text>
  <text x="350" y="62" text-anchor="middle" fill="#888" font-size="7">🔍 Search</text>
  <text x="350" y="76" text-anchor="middle" fill="#888" font-size="7">⭐ Bookmark</text>
  <text x="350" y="90" text-anchor="middle" fill="#888" font-size="7">📋 Export</text>

  <defs><marker id="arr" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="#4ade80"/></marker></defs>
</svg>`,
  },

  steps: [
    // ── 1. SSE Studio Overview ───────────────────────────────────
    {
      id: 'sse-nav',
      title: 'SSE Studio',
      description:
        'Welcome to SSE Studio — RedfireForge\'s dedicated workspace for Server-Sent Events. The layout mirrors WebSocket Studio: connection config on the left, live events on the right. ' +
        'Notice the **connection tab bar** at the top — each tab is an independent SSE workspace with its own URL and event buffer.',
      highlight: SSE.NAV_TAB,
      pauseAfter: true,
      preAction: async () => {
        document.querySelectorAll('.sse-row-selected').forEach((el) => {
          el.classList.remove('sse-row-selected');
        });
      },
    },

    // ── 2. Add SSE Protocol in Environment Manager ──────────────
    {
      id: 'sse-add-protocol',
      title: 'Add SSE Protocol',
      description:
        'Open **Settings → Environments**, add an environment called **"SSE Demo"** and a microservice ' +
        'called **"sse-demo"**. Expand the microservice — it starts with **no protocol tabs**. ' +
        'Click **+ Add protocol** and choose **SSE**. Only the **SSE** tab appears (HTTP is not added ' +
        'by default). Check the deploy box for **SSE Demo** so the environment is active on this service.',
      highlight: EM.ADD_PROTOCOL_BTN,
      pauseAfter: true,
      preAction: async (ctx: DemoActionContext) => {
        if (!document.querySelector(SSE.URL_INPUT)) {
          await navigateToSseStudio(ctx);
        }
      },
      action: async (ctx: DemoActionContext) => {
        await ensureDemoEnvironment(ctx, DEMO_ENV_NAME);
        await ensureDemoMicroservice(ctx, DEMO_SVC_NAME);
        await navigateToEnvironmentManager(ctx);
        await ctx.delay(400);
        await expandNamedMicroservice(ctx, DEMO_SVC_NAME);
        // Add SSE only — no HTTP tab (matches new default microservice behavior).
        await ensureProtocolEnabled(ctx, 'sse');
        // Deploy the SSE Demo environment on the SSE tab (checkbox only — URL comes in step 3).
        await ensureNamedEnvDeployedOnProtocol(ctx, 'sse', DEMO_ENV_NAME);
        await selectProtocolTab(ctx, 'sse');
        await ctx.delay(800);
      },
    },

    // ── 3. Configure SSE Endpoint ────────────────────────────────
    {
      id: 'sse-env-config',
      title: 'Configure SSE Endpoint',
      description:
        'On the **SSE** tab, click **Edit** on the **SSE Demo** row and enter `http://localhost:3001`. ' +
        'Click **Save** — the status changes to **✓ set** and the derived-variables panel shows ' +
        '`{{sseUrl}}` resolved to your endpoint for this microservice.',
      highlight: EM.PROTOCOL_TAB_SSE,
      pauseAfter: true,
      preAction: async (ctx: DemoActionContext) => {
        await ensureDemoEnvironment(ctx, DEMO_ENV_NAME);
        await ensureDemoMicroservice(ctx, DEMO_SVC_NAME);
        await navigateToEnvironmentManager(ctx);
        await expandNamedMicroservice(ctx, DEMO_SVC_NAME);
        await ensureProtocolEnabled(ctx, 'sse');
        await ensureNamedEnvDeployedOnProtocol(ctx, 'sse', DEMO_ENV_NAME);
        await selectProtocolTab(ctx, 'sse');
      },
      action: async (ctx: DemoActionContext) => {
        // Select SSE tab (spotlight is on PROTOCOL_TAB_SSE) and configure the endpoint URL.
        await selectProtocolTab(ctx, 'sse');
        await ctx.delay(600);
        // Edit and save the SSE endpoint URL for the demo environment.
        await editNamedProtocolEndpoint(ctx, DEMO_ENV_NAME, SSE_BASE_URL);
        await ctx.delay(1000);
      },
    },

    // ── 4. Select Environment & Service in Header ───────────────
    {
      id: 'sse-header-select',
      title: 'Select Environment & Service',
      description:
        'Endpoints live on a microservice, but **SSE Studio** resolves `{{sseUrl}}` from the **Environment** ' +
        'and **Service** dropdowns in the app header. Choose **"SSE Demo"** for Environment and **"sse-demo"** ' +
        'for Service — the protocol indicator beside them confirms the resolved base URL.',
      highlight: APP.HEADER_SELECTORS,
      pauseAfter: true,
      preAction: async (ctx: DemoActionContext) => {
        await ensureDemoEnvironment(ctx, DEMO_ENV_NAME);
        await ensureDemoMicroservice(ctx, DEMO_SVC_NAME);
        await navigateToSseStudio(ctx);
      },
      action: async (ctx: DemoActionContext) => {
        await selectEnvInHeader(ctx, DEMO_ENV_NAME);
        await ctx.delay(800);
        await selectSvcInHeader(ctx, DEMO_SVC_NAME);
        await ctx.delay(1500); // pause so the resolved URL indicator updates visibly
      },
    },

    // ── 5. Environment Variables in URLs ────────────────────────
    {
      id: 'sse-env-vars',
      title: 'Environment Variables in URLs',
      description:
        'Instead of hardcoding `http://localhost:3001/api/sse-test`, type `{{sseUrl}}/api/sse-test`. ' +
        'Watch **→ Resolved:** appear below the input — RedfireForge resolves `{{sseUrl}}` from the ' +
        '**SSE tab** endpoint using the **SSE Demo** environment and **sse-demo** service you selected. ' +
        'Change the **Environment** dropdown in the header and the URL instantly re-resolves.',
      highlight: SSE.URL_INPUT,
      pauseAfter: true,
      preAction: async (ctx: DemoActionContext) => {
        await navigateToSseStudio(ctx);
        // Re-select the demo env/svc in the header in case user navigated away.
        await selectEnvInHeader(ctx, DEMO_ENV_NAME);
        await selectSvcInHeader(ctx, DEMO_SVC_NAME);
      },
      action: async (ctx: DemoActionContext) => {
        // Type the env-var URL — keep it for all subsequent connect steps.
        await ctx.fill(SSE.URL_INPUT, SSE_ENV_VAR_URL);
        await ctx.delay(2000); // let the resolved preview render and be visible
      },
    },

    // ── 5. Connect to SSE Endpoint ──────────────────────────────
    {
      id: 'sse-connect',
      title: 'Connect to an Endpoint',
      description:
        'The URL field still shows `{{sseUrl}}/api/sse-test` — RedfireForge resolves it using the ' +
        '**SSE Demo** environment and **sse-demo** service before connecting. Click **Connect**. ' +
        'The built-in test server sends events every second — perfect for learning.',
      highlight: SSE.URL_INPUT,
      preAction: async (ctx: DemoActionContext) => {
        await navigateToSseStudio(ctx);
        await selectEnvInHeader(ctx, DEMO_ENV_NAME);
        await selectSvcInHeader(ctx, DEMO_SVC_NAME);
      },
      action: async (ctx) => {
        // Replay guard: if already connected, disconnect first so the user
        // sees the full connect flow again from the beginning.
        if (document.querySelector(SSE_CONNECTED_DOT)) {
          await ctx.click(SSE.CONNECT_BTN); // disconnect
          await ctx.delay(400);
        }
        await ctx.fill(SSE.URL_INPUT, SSE_ENV_VAR_URL);
        await ctx.delay(300);
        await ctx.click(SSE.CONNECT_BTN);
        await ctx.waitFor(SSE_CONNECTED_DOT); // wait for green dot (Rule 5)
        await ctx.delay(600); // brief pause so first events visibly arrive
      },
      pauseAfter: true,
    },

    // ── 6. Live Event Stream ─────────────────────────────────────
    {
      id: 'sse-events',
      title: 'Live Event Stream',
      description:
        'Events appear in real-time as they arrive. Each event shows its type badge (message, update, status), timestamp, and a preview of the data payload. The status bar shows connection state and event count.',
      highlight: SSE.MESSAGE_LOG,
      // preAction ensures we are connected AND on the Events tab, since MESSAGE_LOG is
      // only rendered inside the right-panel Events view (Rule 4: guard for skip-to-step).
      preAction: async (ctx) => {
        await ensureSseConnected(ctx);
        await ctx.click(SSE.RIGHT_TAB_EVENTS);
        await ctx.delay(1500); // let a few events arrive so the log looks lively
      },
      pauseAfter: true,
    },

    // ── 7. Event Detail ──────────────────────────────────────────
    {
      id: 'sse-detail',
      title: 'Event Detail',
      description:
        'Click any event to see its full payload — the detail panel shows the event ID, type, timestamp, and complete JSON data. Use ↑↓ arrow keys to navigate between events.',
      highlight: SSE.EVENT_ROW,
      // preAction ensures we are connected AND on the Events tab so EVENT_ROW is in the DOM
      // for the spotlight (Rule 4: guard for skip-to-step).
      preAction: async (ctx) => {
        await ensureSseConnected(ctx);
        await ctx.click(SSE.RIGHT_TAB_EVENTS);
        await ctx.delay(300);
      },
      action: async (ctx) => {
        // Click the first event row — ctx.click shows the visual ripple
        await ctx.click(SSE.EVENT_ROW);
        await ctx.delay(500);
      },
      pauseAfter: true,
    },

    // ── 8. Search & Filter ───────────────────────────────────────
    {
      id: 'sse-filter',
      title: 'Search & Type Filter',
      description:
        'Search across event data with the search bar. Use the type filter dropdown to show only specific event types (message, update, status). Filters compose — search text AND event type.',
      highlight: SSE.SEARCH_INPUT,
      // preAction ensures we are connected AND on the Events tab so SEARCH_INPUT is in the
      // DOM for the spotlight (Rule 4: guard for skip-to-step).
      preAction: async (ctx) => {
        await ensureSseConnected(ctx);
        await ctx.click(SSE.RIGHT_TAB_EVENTS);
        await ctx.delay(300);
      },
      action: async (ctx) => {
        await ctx.fill(SSE.SEARCH_INPUT, 'greeting');
        await ctx.delay(800);
      },
      pauseAfter: true,
    },

    // ── 9. Console ───────────────────────────────────────────────
    {
      id: 'sse-console',
      title: 'SSE Console',
      description:
        'The Console tab shows connection lifecycle events and supports commands: /connect, /disconnect, /clear, and /help. Since SSE is one-way, there\'s no /send command.',
      highlight: SSE.RIGHT_TAB_CONSOLE,
      preAction: async (ctx) => {
        // Ensure we are connected so the console has lifecycle entries to show (Rule 4).
        await ensureSseConnected(ctx);
        // Clear any stale search text — SEARCH_INPUT is only in DOM on Events tab, so this
        // is silently idempotent when already on Console tab (ctx.fill does nothing gracefully).
        await ctx.fill(SSE.SEARCH_INPUT, '');
        await ctx.delay(200);
      },
      action: async (ctx) => {
        await ctx.click(SSE.RIGHT_TAB_CONSOLE);
        await ctx.delay(500);
      },
      pauseAfter: true,
    },

    // ── 10. Disconnect ───────────────────────────────────────────
    {
      id: 'sse-disconnect',
      title: 'Disconnect',
      description:
        'Click the Disconnect button (or type /disconnect in the console) to close the SSE connection. The browser\'s EventSource handles reconnection automatically — but here we\'re closing intentionally.',
      highlight: SSE.CONNECT_BTN,
      // preAction ensures we are connected so the action will always show a Disconnect click,
      // not accidentally re-connect (Rule 4: guard for skip-to-step).
      preAction: async (ctx) => {
        await ensureSseConnected(ctx);
        // Navigate to Events tab so the user sees the final event list before disconnecting.
        await ctx.click(SSE.RIGHT_TAB_EVENTS);
        await ctx.delay(300);
      },
      action: async (ctx) => {
        // Disconnect — ctx.click shows the visual ripple
        await ctx.click(SSE.CONNECT_BTN);
        await ctx.delay(800);
      },
      pauseAfter: true,
    },
  ],
};
