/** Lesson 9: SSE Studio — connect to an SSE endpoint, monitor events, and explore the console */
import type { DemoActionContext, DemoLesson } from '../../types';
import { APP, SSE } from '../../../../shared/selectors';


// ── Constants ──────────────────────────────────────────────────────
const SSE_TEST_URL = 'http://localhost:3001/api/sse-test';
const SSE_ENV_VAR_URL = '{{baseUrl}}/api/sse-test';

/** CSS selector for the connected-state indicator. Used by waitFor and replay guards. */
const SSE_CONNECTED_DOT = '.sse-state-dot.sse-state-connected';

// ── Helpers ────────────────────────────────────────────────────────

/**
 * Guard used by preActions of steps 3+ to ensure the SSE connection is
 * established before the spotlight tries to read elements that only render
 * when connected/events-tab is active.
 * Idempotent — returns immediately if already connected.
 */
async function ensureSseConnected(ctx: DemoActionContext): Promise<void> {
  if (document.querySelector(SSE_CONNECTED_DOT)) return;
  await ctx.fill(SSE.URL_INPUT, SSE_TEST_URL);
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

/** Cleanup: disconnect, clear events. */
async function sseCleanup(ctx: DemoActionContext): Promise<void> {
  // Disconnect
  const connectBtn = document.querySelector(SSE.CONNECT_BTN) as HTMLButtonElement | null;
  if (connectBtn?.textContent?.includes('Disconnect')) {
    connectBtn.click();
    await ctx.delay(500);
  }
  // Clear events
  const clearBtn = document.querySelector(SSE.CLEAR_BTN) as HTMLButtonElement | null;
  if (clearBtn && !clearBtn.disabled) {
    clearBtn.click();
    await ctx.delay(200);
  }
}

export const sseStudioLesson: DemoLesson = {
  id: 'sse-studio',
  domainId: 'protocols',
  category: 'sse',
  name: 'SSE Studio',
  description: 'Connect to a Server-Sent Events endpoint and monitor real-time event streams.',
  estimatedMinutes: 3,
  initialTab: 'sse-studio',

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
        'Welcome to SSE Studio — RedfireForge\'s dedicated workspace for Server-Sent Events. The layout mirrors WebSocket Studio: connection config on the left, live events on the right.',
      highlight: SSE.NAV_TAB,
      pauseAfter: true,
      preAction: async () => {
        document.querySelectorAll('.sse-row-selected').forEach((el) => {
          el.classList.remove('sse-row-selected');
        });
      },
    },

    // ── 2. Environment Variables in URLs ────────────────────────
    {
      id: 'sse-env-vars',
      title: 'Environment Variables in URLs',
      description:
        'Instead of hardcoding `http://localhost:3001/api/sse-test`, use `{{baseUrl}}/api/sse-test`. ' +
        'RedfireForge resolves `{{baseUrl}}` from the **Environment** and **Microservice** selected in the ' +
        'header dropdowns (top-right). Each microservice stores a Base URL per environment — switching from ' +
        '"local" to "staging" in the header instantly re-resolves the URL without touching the SSE config. ' +
        'A **↳ Resolved:** preview appears below the input so you always see the final URL before connecting.',
      highlight: SSE.URL_INPUT,
      pauseAfter: true,
      preAction: async (ctx: DemoActionContext) => {
        // Guard: navigate to SSE Studio if we landed here via skip-to-step
        if (!document.querySelector(SSE.URL_INPUT)) {
          await ctx.click(APP.AB_PROTOCOLS);
          await ctx.delay(300);
          await ctx.click(APP.NAV_TAB_SSE);
          await ctx.delay(400);
        }
      },
      action: async (ctx: DemoActionContext) => {
        await ctx.fill(SSE.URL_INPUT, SSE_ENV_VAR_URL);
        await ctx.delay(1000);
        // Reset to the real test URL so the connect step that follows works
        await ctx.fill(SSE.URL_INPUT, SSE_TEST_URL);
        await ctx.delay(400);
      },
    },

    // ── 3. Connect to SSE Endpoint ──────────────────────────────
    {
      id: 'sse-connect',
      title: 'Connect to an Endpoint',
      description:
        'Enter the SSE endpoint URL and click Connect. The backend includes a built-in test SSE server that sends events every second — perfect for learning.',
      highlight: SSE.URL_INPUT,
      action: async (ctx) => {
        // Replay guard: if already connected, disconnect first so the user
        // sees the full connect flow again from the beginning.
        if (document.querySelector(SSE_CONNECTED_DOT)) {
          await ctx.click(SSE.CONNECT_BTN); // disconnect
          await ctx.delay(400);
        }
        await ctx.fill(SSE.URL_INPUT, SSE_TEST_URL);
        await ctx.delay(300);
        await ctx.click(SSE.CONNECT_BTN);
        await ctx.waitFor(SSE_CONNECTED_DOT); // wait for green dot (Rule 5)
        await ctx.delay(600); // brief pause so first events visibly arrive
      },
      pauseAfter: true,
    },

    // ── 4. Live Event Stream ─────────────────────────────────────
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

    // ── 5. Event Detail ──────────────────────────────────────────
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

    // ── 6. Search & Filter ───────────────────────────────────────
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

    // ── 7. Console ───────────────────────────────────────────────
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

    // ── 8. Disconnect ────────────────────────────────────────────
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
