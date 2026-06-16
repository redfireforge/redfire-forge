/** Lesson: Auth & Transport — authentication and connection modes */
import type { DemoActionContext, DemoLesson } from '../../types';
import { wsSetup, wsAuthCleanup, resetAuth, disconnectWebSocket, clearEvents } from '../setup-helpers';
import { WS } from '../../../../shared/selectors';

/** Setup: reset auth state, disconnect, clear events, then start mock + switch to client. */
async function authSetup(ctx: DemoActionContext): Promise<void> {
  // Wait for UI to render
  await ctx.delay(500);
  // Disconnect any active connection first
  await disconnectWebSocket(ctx);
  await ctx.delay(200);
  // Clear events from previous runs
  await clearEvents(ctx);
  await ctx.delay(200);
  // Reset auth to "No Auth" so Bearer selection is visible on replay
  await resetAuth(ctx);
  await ctx.delay(200);
  // Standard setup: start mock + switch to client
  await wsSetup(ctx);
}

/**
 * Ensure Auth tab is active and bearer auth is selected.
 * Used as a preAction guard for steps that require the auth panel to be visible.
 */
async function ensureBearerAuth(ctx: DemoActionContext): Promise<void> {
  await ctx.click(WS.LEFT_TAB_AUTH);
  await ctx.delay(200);
  const sel = document.querySelector(WS.AUTH_TYPE_DROPDOWN) as HTMLSelectElement | null;
  if (!sel || sel.value !== 'bearer') {
    await ctx.selectOption(WS.AUTH_TYPE_DROPDOWN, 'bearer');
    await ctx.delay(200);
  }
}

/**
 * Ensure the WebSocket is connected to the mock server.
 * Called silently in preActions for steps that require an active connection.
 * If already connected, this is a fast no-op.
 */
async function ensureConnected(ctx: DemoActionContext): Promise<void> {
  if (document.querySelector(WS.STATUS_CONNECTED)) return;

  // Silently set up bearer auth if not already configured
  await ctx.click(WS.LEFT_TAB_AUTH);
  await ctx.delay(150);
  const sel = document.querySelector(WS.AUTH_TYPE_DROPDOWN) as HTMLSelectElement | null;
  if (!sel || sel.value !== 'bearer') {
    await ctx.selectOption(WS.AUTH_TYPE_DROPDOWN, 'bearer');
    await ctx.delay(150);
  }
  // Fill bearer token if the field is empty
  const tokenInput = document.querySelector(WS.AUTH_PANE_INPUTS) as HTMLInputElement | null;
  if (tokenInput && !tokenInput.value) {
    const nativeSet = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    nativeSet?.call(tokenInput, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.demo-token');
    tokenInput.dispatchEvent(new Event('input', { bubbles: true }));
    tokenInput.dispatchEvent(new Event('change', { bubbles: true }));
    await ctx.delay(150);
  }

  // Navigate to Connect tab, fill URL, and connect
  await ctx.click(WS.LEFT_TAB_CONNECT);
  await ctx.delay(150);
  await ctx.fill(WS.URL_INPUT, 'ws://localhost:9876');
  await ctx.delay(150);
  const connectBtn = document.querySelector(WS.CONNECT_BTN) as HTMLButtonElement | null;
  if (connectBtn && !connectBtn.disabled) {
    connectBtn.click();
    await ctx.waitFor(WS.STATUS_CONNECTED, 3000);
  }
}

export const wsAuthTransportLesson: DemoLesson = {
  id: 'ws-auth-transport',
  domainId: 'protocols',
  category: 'websocket',
  name: 'Auth & Transport',
  description: 'Learn how authentication works with WebSocket connections and transport modes.',
  estimatedMinutes: 4,
  initialTab: 'websocket-studio',

  setup: authSetup,
  cleanup: wsAuthCleanup,
  concept: {
    title: 'Authentication & Transport Modes',
    body: `Browsers **cannot** set custom HTTP headers on WebSocket handshake requests. This is a fundamental limitation that affects authentication strategies.

**The Problem:**
- REST APIs use \`Authorization: Bearer <token>\` headers
- WebSocket's \`new WebSocket(url)\` API has no header parameter
- Cookies work but aren't always available (CORS, mobile apps)

**RedfireForge's Solution — Transport Modes:**

1. **Direct** (browser-native): The browser opens the WebSocket directly. Only query-string auth works here (e.g., \`?token=abc\`).

2. **Proxy** (via backend): Your server relays the connection and injects HTTP headers. This enables Bearer, Basic, API Key, and OAuth2 authentication.

3. **Native** (Tauri desktop): The desktop app has full network access — all auth types work natively without a proxy.

**How the app decides:**
- If you select header-based auth → automatically switches to Proxy
- If you use query-based auth (API Key in query) → stays on Direct
- If running in Tauri → uses Native for all auth types`,
    keyTerms: [
      { term: 'Direct', definition: 'Browser-native WebSocket connection. Fast but limited to query-string authentication.' },
      { term: 'Proxy', definition: 'Backend-relayed connection that can inject custom HTTP headers during handshake.' },
      { term: 'Native', definition: 'Tauri desktop transport with full network access. Supports all auth types natively.' },
      { term: 'TLS', definition: 'Transport Layer Security. Required for wss:// connections. Proxy/Native allow custom CA certificates.' },
    ],
    diagram: `<svg viewBox="0 0 400 160" xmlns="http://www.w3.org/2000/svg">
  <rect x="10" y="60" width="80" height="36" rx="6" fill="var(--primary)" opacity="0.2" stroke="var(--primary)" stroke-width="1.5"/>
  <text x="50" y="83" text-anchor="middle" fill="var(--text)" font-size="11" font-family="system-ui">Client</text>
  <rect x="310" y="60" width="80" height="36" rx="6" fill="var(--accent)" opacity="0.2" stroke="var(--accent)" stroke-width="1.5"/>
  <text x="350" y="83" text-anchor="middle" fill="var(--text)" font-size="11" font-family="system-ui">Server</text>
  <!-- Direct -->
  <path d="M90,70 L310,70" stroke="var(--text-muted)" stroke-width="1" stroke-dasharray="4,3" marker-end="url(#arr)"/>
  <text x="200" y="64" text-anchor="middle" fill="var(--text-muted)" font-size="9">Direct (query auth only)</text>
  <!-- Proxy -->
  <rect x="160" y="100" width="80" height="28" rx="4" fill="var(--surface-hover)" stroke="var(--border)" stroke-width="1"/>
  <text x="200" y="118" text-anchor="middle" fill="var(--text)" font-size="10" font-family="system-ui">Proxy</text>
  <path d="M90,86 L160,114" stroke="var(--primary)" stroke-width="1.5" marker-end="url(#arr)"/>
  <path d="M240,114 L310,86" stroke="var(--primary)" stroke-width="1.5" marker-end="url(#arr)"/>
  <text x="115" y="108" fill="var(--primary)" font-size="9">+ headers</text>
  <!-- Legend -->
  <text x="10" y="150" fill="var(--text-muted)" font-size="9">Header auth → Proxy | Query auth → Direct | Desktop → Native</text>
  <defs>
    <marker id="arr" markerWidth="6" markerHeight="6" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6" fill="none" stroke="var(--text-muted)" stroke-width="1"/></marker>
  </defs>
</svg>`,
  },
  steps: [
    // ── 1. Auth Tab Introduction ─────────────────────────────────
    {
      id: 'auth-intro',
      title: 'Authentication Overview',
      description: 'WebSocket auth is tricky — browsers can\'t set custom HTTP headers on WebSocket handshakes. RedfireForge solves this with a proxy transport that relays your auth headers. Let\'s set it up.',
      highlight: WS.LEFT_TAB_AUTH,
      preAction: async (ctx) => {
        // Ensure Auth tab is active so the spotlight lands correctly
        await ctx.click(WS.LEFT_TAB_AUTH);
        await ctx.delay(200);
      },
      action: async (ctx) => {
        await ctx.click(WS.LEFT_TAB_AUTH);
        await ctx.delay(300);
      },
      pauseAfter: true,
    },

    // ── 2. Select Bearer Token ───────────────────────────────────
    {
      id: 'auth-type-selector',
      title: 'Choose an Auth Type',
      description: 'The type dropdown controls which credentials are sent. Let\'s select "Bearer Token" — the most common auth type for APIs and WebSocket connections.',
      highlight: WS.AUTH_TYPE_SELECT,
      preAction: async (ctx) => {
        await ctx.click(WS.LEFT_TAB_AUTH);
        await ctx.delay(200);
      },
      action: async (ctx) => {
        await ctx.selectOption(WS.AUTH_TYPE_DROPDOWN, 'bearer');
        await ctx.delay(500);
      },
      pauseAfter: true,
    },

    // ── 3. Fill Bearer Token ─────────────────────────────────────
    {
      id: 'auth-bearer',
      title: 'Enter a Bearer Token',
      description: 'Fill in the token field with your JWT or API token. This gets sent as "Authorization: Bearer <token>" in the handshake headers. We\'ll use a demo token here.',
      highlight: WS.AUTH_PANEL,
      preAction: async (ctx) => {
        // Ensure Auth tab is active and bearer is selected before the action fills the input
        await ensureBearerAuth(ctx);
      },
      action: async (ctx) => {
        // Use ctx.fill for the visual ripple effect on the first auth input
        await ctx.fill(WS.AUTH_PANE_INPUTS, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.demo-token');
        await ctx.delay(500);
      },
      pauseAfter: true,
    },

    // ── 4. Proxy Callout ─────────────────────────────────────────
    {
      id: 'auth-callout',
      title: 'Browser Transport Callout',
      description: 'See the info callout? Because Bearer auth requires custom HTTP headers, the app automatically routes through a Proxy transport. This is transparent — you don\'t need to configure anything extra.',
      highlight: WS.AUTH_CALLOUT,
      preAction: async (ctx) => {
        // .ws-auth-callout only appears when header-based auth (e.g. bearer) is active
        await ensureBearerAuth(ctx);
      },
      pauseAfter: true,
    },

    // ── 5. Fill URL ──────────────────────────────────────────────
    {
      id: 'auth-connect-setup',
      title: 'Set Up the Connection',
      description: 'Switch to the Connect tab and set the URL to the Mock Server address (ws://localhost:9876). The mock server accepts any auth — perfect for testing.',
      highlight: WS.URL_INPUT,
      preAction: async (ctx) => {
        await ctx.click(WS.LEFT_TAB_CONNECT);
        await ctx.delay(200);
      },
      action: async (ctx) => {
        await ctx.fill(WS.URL_INPUT, 'ws://localhost:9876');
        await ctx.delay(300);
      },
      pauseAfter: true,
    },

    // ── 6. Connect ───────────────────────────────────────────────
    {
      id: 'auth-connect',
      title: 'Connect with Auth',
      description: 'Click Connect. The proxy transport injects the Bearer token into the handshake headers. Watch the status change to "Connected" — your authenticated WebSocket is live.',
      highlight: WS.CONNECT_BTN,
      preAction: async (ctx) => {
        await ctx.click(WS.LEFT_TAB_CONNECT);
        await ctx.delay(200);
      },
      action: async (ctx) => {
        // Guard: skip click if already connected to avoid toggling disconnect
        if (!document.querySelector(WS.STATUS_CONNECTED)) {
          await ctx.click(WS.CONNECT_BTN);
          // Wait for the status dot to appear rather than using a fixed delay
          await ctx.waitFor(WS.STATUS_CONNECTED, 3000);
        }
        await ctx.delay(300);
      },
      verify: WS.STATUS_CONNECTED,
      pauseAfter: true,
    },

    // ── 7. Send a Message ────────────────────────────────────────
    {
      id: 'auth-compose-send',
      title: 'Send an Authenticated Message',
      description: 'Switch to Compose, write a message, and send it. The echo server mirrors it back — proving the authenticated connection works end-to-end.',
      highlight: WS.LEFT_TAB_COMPOSE,
      preAction: async (ctx) => {
        // Ensure connection is live before attempting to send (handles skip-to-step)
        await ensureConnected(ctx);
        await ctx.click(WS.LEFT_TAB_COMPOSE);
        await ctx.delay(300);
      },
      action: async (ctx) => {
        await ctx.fill(WS.MESSAGE_INPUT, '{"action": "greet", "user": "demo-admin"}');
        await ctx.delay(500);
        await ctx.click(WS.SEND_BTN);
        await ctx.delay(1000);
      },
      verify: WS.MESSAGE_ROW,
      pauseAfter: true,
    },

    // ── 8. Check Events ──────────────────────────────────────────
    {
      id: 'auth-events',
      title: 'Verify in Events',
      description: 'Check the Events panel — you\'ll see both the sent (↑) and received (↓) messages. The connection is fully authenticated with your Bearer token.',
      highlight: WS.RIGHT_TAB_EVENTS,
      action: async (ctx) => {
        await ctx.click(WS.RIGHT_TAB_EVENTS);
        await ctx.delay(500);
      },
      pauseAfter: true,
    },

    // ── 9. Protocol Selector ─────────────────────────────────────
    {
      id: 'auth-protocol',
      title: 'Protocol Selector',
      description: 'The protocol dropdown tells RedfireForge how to frame messages. "Auto-detect" inspects the URL and first message. Other options: Socket.IO, STOMP, and GraphQL-WS each use their own framing.',
      highlight: WS.PROTOCOL_SELECT,
      preAction: async (ctx) => {
        await ctx.click(WS.LEFT_TAB_CONNECT);
        await ctx.delay(200);
      },
      pauseAfter: true,
    },
  ],
};
