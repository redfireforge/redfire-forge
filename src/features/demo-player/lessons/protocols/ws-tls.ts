/**
 * Lesson 19: Secure WebSocket — wss:// & TLS
 *
 * Demonstrates secure WebSocket connections:
 *  - wss:// vs ws:// — how the URL scheme triggers TLS
 *  - TLS configuration panel (Connect tab, not Auth)
 *  - Skip certificate validation for dev/staging
 *  - CA certificate and mTLS PEM fields
 *  - Transport modes: Direct vs Proxy vs Native
 *
 * Uses public wss://echo.websocket.org for live demo — no Docker required.
 */
import type { DemoActionContext, DemoLesson } from '../../types';
import { closeExtraConnectionTabs, disconnectWebSocket, clearEvents, resetAuth, clearCustomHeaders } from '../setup-helpers';
import { WS } from '../../../../shared/selectors';

const WSS_ECHO_URL = 'wss://echo.websocket.org';

// ── Guard helpers ──────────────────────────────────────────────────

/**
 * Silently ensures the studio is in client mode, the Connect tab is active,
 * and a wss:// URL is filled so the TLS configuration panel renders in the DOM.
 *
 * Without switching to client mode first, the left-tab buttons and Connect
 * panel are not in the DOM (they only render in client mode), so all
 * subsequent clicks and fills would silently do nothing.
 */
async function ensureTlsPanelReady(ctx: DemoActionContext): Promise<void> {
  await ctx.click(WS.MODE_CLIENT);
  await ctx.delay(200);
  await ctx.click(WS.LEFT_TAB_CONNECT);
  await ctx.delay(200);
  const urlInput = document.querySelector(WS.URL_INPUT) as HTMLInputElement | null;
  if (!urlInput?.value?.startsWith('wss://')) {
    await ctx.fill(WS.URL_INPUT, WSS_ECHO_URL);
    await ctx.delay(300);
  }
}

/**
 * Silently ensures the TLS accordion panel is expanded (aria-expanded="true").
 * Waits for the toggle to appear in the DOM first (it only renders when the
 * URL starts with wss://), so it is safe to call immediately after a URL fill.
 */
async function ensureTlsPanelExpanded(ctx: DemoActionContext): Promise<void> {
  await ctx.waitFor(WS.TLS_TOGGLE, 2000);
  const toggle = document.querySelector(WS.TLS_TOGGLE) as HTMLElement | null;
  if (toggle && toggle.getAttribute('aria-expanded') !== 'true') {
    toggle.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    await ctx.delay(300);
  }
}

/**
 * Set the skip-cert checkbox to the desired state via a click dispatch.
 *
 * React controlled checkboxes respond to click events: the click toggles the
 * DOM checked property and React's onClick/onChange handlers fire, calling
 * onTlsChange({ rejectUnauthorized: !e.target.checked }) and updating state.
 *
 * We waitFor the checkbox (not just assume the TLS panel is expanded) so this
 * is safe to call even when React hasn't flushed the TLS panel render yet.
 */
async function setSkipCert(ctx: DemoActionContext, checked: boolean): Promise<void> {
  await ctx.waitFor(`${WS.TLS_SKIP_CERT} input[type="checkbox"]`, 2000);
  const checkbox = document.querySelector(`${WS.TLS_SKIP_CERT} input[type="checkbox"]`) as HTMLInputElement | null;
  if (!checkbox || checkbox.checked === checked) return;
  checkbox.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  await ctx.delay(200);
}

// ── Setup / Cleanup ────────────────────────────────────────────────

async function tlsSetup(ctx: DemoActionContext): Promise<void> {
  await ctx.delay(500);

  // Switch to client mode first — left-tab buttons and Connect panel only exist
  // in client mode; in mock/saved mode all subsequent clicks fail silently.
  await ctx.click(WS.MODE_CLIENT);
  await ctx.delay(300);

  await disconnectWebSocket(ctx);
  await closeExtraConnectionTabs(ctx);
  await clearEvents(ctx);

  // Clear any auth and custom headers that would force proxy mode.
  //
  // The browser WebSocket transport cannot set custom headers, and any auth that
  // resolves to headers (Bearer token, API key, etc.) also forces proxy mode.
  // In web mode the proxy backend is not running → 504 Gateway Timeout.
  // We must clear both before connecting so the demo uses Direct transport.
  await resetAuth(ctx);         // sets auth type → "none"
  await clearCustomHeaders(ctx); // removes all header rows, returns to Connect tab

  // Ensure Connect tab is active (clearCustomHeaders returns to Connect but be explicit)
  await ctx.click(WS.LEFT_TAB_CONNECT);
  await ctx.delay(200);

  // Ensure Events tab is active on the right
  await ctx.click(WS.RIGHT_TAB_EVENTS);
  await ctx.delay(200);

  // Reset TLS skip-cert BEFORE clearing the URL.
  //
  // Critical ordering: the TLS panel only renders when the URL starts with wss://.
  // If we clear the URL first, isWss becomes false, the TLS panel unmounts, and
  // setSkipCert finds no checkbox — the reset silently does nothing.
  //
  // When skip-cert is left enabled (rejectUnauthorized === false), hasTlsOverrides()
  // returns true and the studio routes the next connection through the proxy backend
  // (/api/ws/connect). In web mode the proxy backend is not running → 504.
  //
  // We use waitFor (not delay) so the TLS panel + checkbox are guaranteed to be
  // in the DOM before we try to interact with them. A fixed delay is a race
  // condition when React's scheduler is under load.
  await ctx.fill(WS.URL_INPUT, WSS_ECHO_URL);
  await ensureTlsPanelExpanded(ctx); // waitFor(TLS_TOGGLE) is inside this
  await setSkipCert(ctx, false);     // waitFor(TLS_SKIP_CERT) is inside this

  // Now clear the URL to leave a blank slate for step 1
  await ctx.fill(WS.URL_INPUT, '');
  await ctx.delay(200);
}

async function tlsCleanup(ctx: DemoActionContext): Promise<void> {
  // Ensure client mode so DISCONNECT_BTN, URL input, and TLS panel are in DOM.
  await ctx.click(WS.MODE_CLIENT);
  await ctx.delay(300);

  // Switch to Connect tab — the studio may have auto-navigated to Compose after
  // the last step's connection, leaving the URL input and TLS panel out of the DOM.
  await ctx.click(WS.LEFT_TAB_CONNECT);
  await ctx.delay(200);

  await disconnectWebSocket(ctx);
  await clearEvents(ctx);

  // CRITICAL: Ensure a wss:// URL is filled BEFORE trying to expand the TLS panel.
  // The TLS toggle only renders when isWss=true (URL starts with wss://).
  // If a demo step left the URL empty or ws://, the TLS panel never mounts,
  // ensureTlsPanelExpanded times out silently, setSkipCert never fires,
  // and skip-cert=true is left in React state — causing 504 on the next connect.
  await ctx.fill(WS.URL_INPUT, WSS_ECHO_URL);
  await ensureTlsPanelExpanded(ctx); // waitFor(TLS_TOGGLE) is inside this
  await setSkipCert(ctx, false);     // waitFor(TLS_SKIP_CERT) is inside this

  await ctx.fill(WS.URL_INPUT, '');
  await ctx.delay(200);
  await closeExtraConnectionTabs(ctx);
}

// ── Lesson Definition ──────────────────────────────────────────────

export const wsTlsLesson: DemoLesson = {
  id: 'ws-tls',
  domainId: 'protocols',
  category: 'websocket',
  name: 'Secure WebSocket — wss:// & TLS',
  description: 'Connect over wss://, explore TLS configuration, certificate validation, and transport modes.',
  estimatedMinutes: 4,
  initialTab: 'websocket-studio',

  setup: tlsSetup,
  cleanup: tlsCleanup,

  concept: {
    title: 'Secure WebSocket — wss:// & TLS',
    body: `Production WebSocket APIs use **wss://** — the encrypted version of the WebSocket protocol. Just like HTTPS wraps HTTP in TLS, wss:// wraps ws:// in TLS to protect data in transit.

**wss:// vs ws://**
- \`ws://\` — plain text, no encryption. Fine for local development.
- \`wss://\` — encrypted with TLS. Required for production and any data that needs privacy.

**TLS Configuration in RedfireForge**
When you enter a \`wss://\` URL, the TLS configuration panel appears on the Connect tab:
- **Skip certificate validation** — Accept self-signed or expired certificates (dev/staging only)
- **CA Certificate** — Paste a custom Certificate Authority PEM for internal PKI
- **Client Certificate & Key** — For mutual TLS (mTLS) where the server verifies the client

**Transport & TLS**
- **Direct** (browser): The browser handles TLS natively. Custom CA/skip-cert options don't apply — the browser uses its own certificate store.
- **Proxy**: Node.js relays the connection and applies your TLS settings (skip-cert, custom CA, mTLS).
- **Native** (Tauri desktop): Full TLS control via rustls — all settings work without a proxy.

Setting any TLS override in the browser automatically routes through the Proxy transport.`,
    keyTerms: [
      { term: 'wss://', definition: 'WebSocket Secure — the encrypted WebSocket protocol, analogous to HTTPS for HTTP.' },
      { term: 'TLS', definition: 'Transport Layer Security — the cryptographic protocol that encrypts wss:// connections.' },
      { term: 'mTLS', definition: 'Mutual TLS — both server and client present certificates to authenticate each other.' },
      { term: 'rejectUnauthorized', definition: 'When false, accepts self-signed or invalid certificates. Use only in dev/staging.' },
    ],
    diagram: `<svg viewBox="0 0 400 130" xmlns="http://www.w3.org/2000/svg" style="font-family:system-ui,sans-serif">
  <rect x="0" y="0" width="400" height="130" rx="8" fill="#1e1e2e" />

  <!-- Client -->
  <rect x="15" y="20" width="100" height="90" rx="4" fill="#2a2a3a" />
  <text x="65" y="40" text-anchor="middle" fill="#60a5fa" font-size="10" font-weight="bold">Client</text>
  <text x="65" y="56" text-anchor="middle" fill="#888" font-size="7">wss:// URL</text>
  <text x="65" y="69" text-anchor="middle" fill="#888" font-size="7">TLS handshake</text>
  <text x="65" y="82" text-anchor="middle" fill="#888" font-size="7">CA / mTLS certs</text>
  <text x="65" y="95" text-anchor="middle" fill="#888" font-size="7">Skip validation</text>

  <!-- TLS Layer -->
  <rect x="140" y="30" width="120" height="70" rx="4" fill="#2a2a3a" stroke="#4ade80" stroke-width="1.5" stroke-dasharray="4,3" />
  <text x="200" y="50" text-anchor="middle" fill="#4ade80" font-size="10" font-weight="bold">TLS Layer</text>
  <text x="200" y="66" text-anchor="middle" fill="#888" font-size="7">Encrypted tunnel</text>
  <text x="200" y="79" text-anchor="middle" fill="#888" font-size="7">Certificate verification</text>
  <text x="200" y="92" text-anchor="middle" fill="#888" font-size="7">ws:// data inside</text>

  <!-- Arrow in -->
  <path d="M118,65 L138,65" stroke="#60a5fa" stroke-width="2" marker-end="url(#arr19)" />
  <!-- Arrow out -->
  <path d="M262,65 L290,65" stroke="#f59e0b" stroke-width="2" marker-end="url(#arr19)" />

  <!-- Server -->
  <rect x="295" y="25" width="95" height="80" rx="4" fill="#2a2a3a" />
  <text x="342" y="45" text-anchor="middle" fill="#f59e0b" font-size="10" font-weight="bold">Server</text>
  <text x="342" y="61" text-anchor="middle" fill="#888" font-size="7">TLS termination</text>
  <text x="342" y="74" text-anchor="middle" fill="#888" font-size="7">Valid certificate</text>
  <text x="342" y="87" text-anchor="middle" fill="#888" font-size="7">Echo response</text>

  <defs><marker id="arr19" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="#4ade80"/></marker></defs>
</svg>`,
  },

  steps: [
    // ── 1. wss:// vs ws:// ─────────────────────────────────────
    {
      id: 'tls-intro',
      title: 'wss:// vs ws://',
      description:
        'The difference between ws:// and wss:// is just like http:// vs https:// — the "s" means TLS encryption. Type a wss:// URL and watch the TLS configuration panel appear below the connection settings. It only shows when the URL scheme is wss://.',
      highlight: WS.URL_INPUT,
      preAction: async (ctx) => {
        await ctx.click(WS.LEFT_TAB_CONNECT);
        await ctx.delay(200);
      },
      action: async (ctx) => {
        await ctx.fill(WS.URL_INPUT, WSS_ECHO_URL);
        await ctx.delay(800);
      },
      pauseAfter: true,
    },

    // ── 2. TLS Configuration Panel ─────────────────────────────
    {
      id: 'tls-panel',
      title: 'TLS Configuration Panel',
      description:
        'The TLS / mTLS Configuration panel appears on the Connect tab (not Auth) whenever you use a wss:// URL. Expand it to see the available options. Notice the info banner: in browser Direct mode, TLS options are handled by the browser itself. Custom options (skip-cert, CA) require the Proxy transport.',
      highlight: WS.TLS_TOGGLE,
      preAction: async (ctx) => {
        await ensureTlsPanelReady(ctx);
      },
      action: async (ctx) => {
        const toggle = document.querySelector(WS.TLS_TOGGLE) as HTMLElement | null;
        if (toggle && toggle.getAttribute('aria-expanded') !== 'true') {
          toggle.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
          await ctx.delay(800);
        }
      },
      pauseAfter: true,
    },

    // ── 3. Connect Over TLS ────────────────────────────────────
    {
      id: 'tls-connect',
      title: 'Connect Over TLS',
      description:
        'Click Connect to establish an encrypted WebSocket connection to the public echo server. The browser handles the TLS handshake using its built-in certificate store — no custom configuration needed for servers with valid certificates. Watch the status change to Connected.',
      highlight: WS.CONNECT_BTN,
      preAction: async (ctx) => {
        await ensureTlsPanelReady(ctx);
        // Ensure disconnected so the Connect button is active
        await disconnectWebSocket(ctx);
      },
      action: async (ctx) => {
        await ctx.click(WS.CONNECT_BTN);
        await ctx.delay(2500);
      },
      verify: WS.STATUS_CONNECTED,
      pauseAfter: true,
    },

    // ── 4. Send & Receive Over TLS ─────────────────────────────
    {
      id: 'tls-send',
      title: 'Send & Receive Over TLS',
      description:
        'Switch to Compose and send a message. The echo server mirrors it back — proving the encrypted round-trip works. The data travels through the TLS tunnel: encrypted in transit, decrypted at each end. This is identical to a plain ws:// connection from the application\'s perspective.',
      highlight: WS.SEND_BTN,
      preAction: async (ctx) => {
        const isConnected = !!document.querySelector(WS.STATUS_CONNECTED);
        if (!isConnected) {
          await ensureTlsPanelReady(ctx);
          await ctx.click(WS.CONNECT_BTN);
          await ctx.delay(2500);
        }
        await ctx.click(WS.LEFT_TAB_SEND);
        await ctx.delay(300);
      },
      action: async (ctx) => {
        await ctx.fill(WS.MESSAGE_INPUT, '{"secure": true, "message": "Hello over TLS!"}');
        await ctx.delay(500);
        await ctx.click(WS.SEND_BTN);
        await ctx.delay(1500);
      },
      verify: WS.MESSAGE_ROW,
      pauseAfter: true,
    },

    // ── 5. Skip Certificate Validation ─────────────────────────
    {
      id: 'tls-skip-cert',
      title: 'Skip Certificate Validation',
      description:
        'For development servers with self-signed certificates, check "Skip certificate validation." This sets rejectUnauthorized to false, accepting any certificate. It\'s essential for internal staging environments but should never be used in production. Note: in the browser, this requires the Proxy transport — the browser\'s own TLS stack always validates.',
      highlight: WS.TLS_SKIP_CERT,
      preAction: async (ctx) => {
        // Navigate to Connect tab FIRST — DISCONNECT_BTN is only in the DOM when the
        // Connect panel is rendered. After the previous step (tls-send), the studio
        // auto-switches to Send tab on connection, so we must switch back before
        // trying to disconnect. ensureTlsPanelReady handles mode + tab + URL.
        await ensureTlsPanelReady(ctx);
        // Now disconnect while the Connect panel (and its DISCONNECT_BTN) is visible.
        // The skip-cert checkbox is disabled while connected; we must disconnect first.
        await disconnectWebSocket(ctx);
        await ctx.delay(300);
        // Ensure TLS panel is expanded so the checkbox is in the DOM
        await ensureTlsPanelExpanded(ctx);
      },
      action: async (ctx) => {
        await setSkipCert(ctx, true);
        await ctx.delay(800);
      },
      pauseAfter: true,
    },

    // ── 6. CA Certificate & mTLS ───────────────────────────────
    {
      id: 'tls-certs',
      title: 'CA Certificate & mTLS',
      description:
        'Below the skip-cert toggle, you\'ll find three PEM fields: CA Certificate for custom certificate authorities (internal PKI), Client Certificate and Client Key for mutual TLS (mTLS) where the server verifies your identity. Paste PEM-encoded content into these fields for enterprise or zero-trust environments.',
      highlight: WS.TLS_BODY,
      preAction: async (ctx) => {
        await ensureTlsPanelReady(ctx);
        await ensureTlsPanelExpanded(ctx);
      },
      action: async (ctx) => {
        // Briefly focus the CA cert textarea to draw attention
        const caCert = document.querySelector(WS.TLS_CA_CERT) as HTMLTextAreaElement | null;
        if (caCert) {
          caCert.focus();
          await ctx.delay(800);
          caCert.blur();
        }
      },
      pauseAfter: true,
    },

    // ── 7. Transport Modes & Desktop TLS ───────────────────────
    {
      id: 'tls-transport',
      title: 'Transport Modes & Desktop TLS',
      description:
        'RedfireForge selects the transport automatically. In the browser: Direct mode for standard wss:// (browser handles TLS), Proxy mode when you set custom TLS options (Node.js applies them). On Tauri desktop: Native mode always — rustls handles TLS directly with full support for skip-cert, custom CA, and mTLS without needing a proxy.',
      highlight: WS.TRANSPORT_BADGE,
      preAction: async (ctx) => {
        // The transport badge lives inside the Connect panel — it only renders in the
        // DOM when the Connect tab is active. Switch there first so setSkipCert and
        // the subsequent highlight can find their targets.
        await ensureTlsPanelReady(ctx);
        // Ensure TLS panel is expanded so the skip-cert checkbox is in the DOM
        await ensureTlsPanelExpanded(ctx);
        // Reset skip-cert so the connection uses Direct (not Proxy) transport
        await setSkipCert(ctx, false);
        await ctx.delay(300);
        // Ensure connected so the transport badge is visible and showing "Direct"
        const isConnected = !!document.querySelector(WS.STATUS_CONNECTED);
        if (!isConnected) {
          await ctx.click(WS.CONNECT_BTN);
          await ctx.delay(2500);
        }
        // After connecting the studio auto-switches to Send tab. Switch back to the
        // Connect tab so the transport badge (inside the Connect panel) is in the DOM
        // for the spotlight and action.
        await ctx.click(WS.LEFT_TAB_CONNECT);
        await ctx.delay(300);
      },
      action: async (ctx) => {
        // Draw the viewer's eye to the transport badge showing "Direct"
        const badge = document.querySelector(WS.TRANSPORT_BADGE) as HTMLElement | null;
        if (badge) {
          badge.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        }
        await ctx.delay(1500);
      },
      pauseAfter: true,
    },
  ],
};
