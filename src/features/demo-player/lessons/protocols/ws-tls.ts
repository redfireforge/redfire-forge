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
 * Silently ensures the TLS configuration modal is open.
 * Waits for the toggle button to appear in the DOM first (it only renders
 * when the URL starts with wss://), then checks whether the modal body is
 * already in the DOM before clicking. The TLS button uses aria-haspopup="dialog"
 * (not aria-expanded), so we detect open state by checking for the modal body.
 */
async function ensureTlsPanelExpanded(ctx: DemoActionContext): Promise<void> {
  await ctx.waitFor(WS.TLS_TOGGLE, 2000);
  const toggle = document.querySelector(WS.TLS_TOGGLE) as HTMLElement | null;
  // Use aria-expanded as the canonical "is open" check — it's always in sync
  // with the component state regardless of animation or lazy rendering.
  const isOpen = toggle?.getAttribute('aria-expanded') === 'true';
  if (!isOpen && toggle) {
    toggle.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    await ctx.delay(400);
  }
}

/**
 * Silently closes the TLS configuration modal if it is open.
 * Uses the Close button (not Cancel) to avoid reverting unsaved changes.
 */
async function closeTlsModal(ctx: DemoActionContext): Promise<void> {
  const closeBtn = document.querySelector(WS.TLS_CLOSE) as HTMLElement | null;
  if (closeBtn) {
    closeBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
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

  // Clear subprotocol and reset protocol to raw — the GraphQL-WS demo leaves
  // "graphql-transport-ws" in the subprotocols field and "graphql-ws" in the
  // protocol select. This causes auto-detect to identify the connection as
  // GraphQL-WS, which can route through the proxy backend. Since the backend
  // is not running in web mode, the next connect → 504/TLS error.
  await ctx.fill(WS.SUBPROTOCOLS_INPUT, '');
  await ctx.delay(100);
  await ctx.selectOption(WS.PROTOCOL_SELECT, 'raw');
  await ctx.delay(100);

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

  // CRITICAL: Close the TLS modal BEFORE clearing the URL.
  //
  // The "is modal open" state lives in the parent React component, not inside the
  // TLS panel. Clearing the URL unmounts the TLS panel (isWss → false) while the
  // modal state is still true. When step 1 re-fills the URL (wss://), the panel
  // remounts and the modal immediately shows as open — startling the viewer.
  // Closing here resets the state to false before the unmount.
  await closeTlsModal(ctx);
  await ctx.delay(200);

  // Now clear the URL to leave a blank slate for step 1
  await ctx.fill(WS.URL_INPUT, '');
  await ctx.delay(200);
}

async function tlsCleanup(ctx: DemoActionContext): Promise<void> {
  // Ensure client mode so DISCONNECT_BTN, URL input, and TLS panel are in DOM.
  await ctx.click(WS.MODE_CLIENT);
  await ctx.delay(300);

  // Switch to Connect tab — the studio may have auto-navigated to Send after
  // the last step's connection, leaving the URL input and TLS panel out of the DOM.
  await ctx.click(WS.LEFT_TAB_CONNECT);
  await ctx.delay(200);

  await disconnectWebSocket(ctx);
  await clearEvents(ctx);

  // Reset subprotocol and protocol to raw so the next lesson starts clean.
  await ctx.fill(WS.SUBPROTOCOLS_INPUT, '');
  await ctx.delay(100);
  await ctx.selectOption(WS.PROTOCOL_SELECT, 'raw');
  await ctx.delay(100);

  // CRITICAL: Ensure a wss:// URL is filled BEFORE trying to expand the TLS panel.
  // The TLS toggle only renders when isWss=true (URL starts with wss://).
  // If a demo step left the URL empty or ws://, the TLS panel never mounts,
  // ensureTlsPanelExpanded times out silently, setSkipCert never fires,
  // and skip-cert=true is left in React state — causing 504 on the next connect.
  await ctx.fill(WS.URL_INPUT, WSS_ECHO_URL);
  await ensureTlsPanelExpanded(ctx); // waitFor(TLS_TOGGLE) is inside this
  await setSkipCert(ctx, false);     // waitFor(TLS_SKIP_CERT) is inside this

  // Close the modal BEFORE clearing the URL — same reason as in setup:
  // the open state is in the parent component and persists across URL changes.
  await closeTlsModal(ctx);
  await ctx.delay(200);

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
    diagram: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 460" style="display:block;width:100%;height:auto;font-family:'SF Pro Display','Segoe UI',system-ui,sans-serif">
  <defs>
    <linearGradient id="tls-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#0f172a"/><stop offset="100%" stop-color="#1a2540"/></linearGradient>
    <linearGradient id="tls-tunnel" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#4ade80" stop-opacity="0.15"/><stop offset="50%" stop-color="#4ade80" stop-opacity="0.08"/><stop offset="100%" stop-color="#4ade80" stop-opacity="0.15"/></linearGradient>
    <filter id="tls-glow"><feGaussianBlur stdDeviation="2" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>

  <!-- Background -->
  <rect width="720" height="460" rx="12" fill="url(#tls-bg)"/>
  <rect width="720" height="460" rx="12" fill="none" stroke="#1e3a5f" stroke-width="1"/>

  <!-- Title -->
  <text x="360" y="30" text-anchor="middle" fill="#cbd5e1" font-size="12" font-weight="600" letter-spacing="0.08em">TRANSPORT MODES &amp; TLS ARCHITECTURE</text>

  <!-- ── ws:// vs wss:// comparison row ── -->
  <!-- ws:// box -->
  <rect x="30" y="50" width="300" height="75" rx="8" fill="#1e293b" stroke="#475569" stroke-width="1"/>
  <rect x="30" y="50" width="300" height="28" rx="8" fill="#374151"/>
  <rect x="30" y="66" width="300" height="12" fill="#374151"/>
  <text x="180" y="70" text-anchor="middle" fill="#cbd5e1" font-size="11" font-weight="600" letter-spacing="0.05em">ws://  —  PLAIN TEXT</text>
  <text x="70" y="94" fill="#cbd5e1" font-size="10">Data sent unencrypted</text>
  <text x="70" y="112" fill="#94a3b8" font-size="10">⚠ Not suitable for production</text>
  <circle cx="50" cy="102" r="8" fill="#ef444420" stroke="#ef4444" stroke-width="1.2"/>
  <text x="50" y="106" text-anchor="middle" fill="#ef4444" font-size="10" font-weight="700">!</text>

  <!-- wss:// box -->
  <rect x="390" y="50" width="300" height="75" rx="8" fill="#1e293b" stroke="#4ade80" stroke-width="1.5"/>
  <rect x="390" y="50" width="300" height="28" rx="8" fill="#064e3b"/>
  <rect x="390" y="66" width="300" height="12" fill="#064e3b"/>
  <text x="540" y="70" text-anchor="middle" fill="#4ade80" font-size="11" font-weight="600" letter-spacing="0.05em">wss://  —  TLS ENCRYPTED</text>
  <text x="430" y="94" fill="#a7f3d0" font-size="10">Data encrypted in transit</text>
  <text x="430" y="112" fill="#86efac" font-size="10">✓ Required for production</text>
  <circle cx="413" cy="102" r="8" fill="#4ade8020" stroke="#4ade80" stroke-width="1.2"/>
  <text x="413" y="106" text-anchor="middle" fill="#4ade80" font-size="10" font-weight="700">🔒</text>

  <!-- VS divider -->
  <rect x="335" y="70" width="50" height="24" rx="12" fill="#1e3a5f" stroke="#334155" stroke-width="1"/>
  <text x="360" y="87" text-anchor="middle" fill="#60a5fa" font-size="11" font-weight="700">vs</text>

  <!-- ── Transport modes section ── -->
  <text x="360" y="155" text-anchor="middle" fill="#94a3b8" font-size="10" font-weight="500" letter-spacing="0.06em">TRANSPORT MODES (auto-selected)</text>
  <line x1="30" y1="162" x2="690" y2="162" stroke="#1e3a5f" stroke-width="1"/>

  <!-- Direct transport -->
  <rect x="30" y="174" width="205" height="125" rx="8" fill="#1e293b" stroke="#3b82f6" stroke-width="1.5"/>
  <rect x="30" y="174" width="205" height="28" rx="8" fill="#1d3a6e"/>
  <rect x="30" y="190" width="205" height="12" fill="#1d3a6e"/>
  <text x="132" y="193" text-anchor="middle" fill="#93c5fd" font-size="11" font-weight="700">Direct (Browser)</text>
  <text x="50" y="218" fill="#cbd5e1" font-size="10">Browser WebSocket API</text>
  <text x="50" y="235" fill="#cbd5e1" font-size="10">Browser cert store handles TLS</text>
  <text x="50" y="252" fill="#cbd5e1" font-size="10">No custom CA / skip-cert</text>
  <rect x="40" y="264" width="180" height="20" rx="4" fill="#1d4ed815"/>
  <text x="130" y="278" text-anchor="middle" fill="#93c5fd" font-size="9.5" font-weight="500">auto:  wss:// → Direct</text>

  <!-- Proxy transport -->
  <rect x="257" y="174" width="205" height="125" rx="8" fill="#1e293b" stroke="#f59e0b" stroke-width="1.5"/>
  <rect x="257" y="174" width="205" height="28" rx="8" fill="#451a03"/>
  <rect x="257" y="190" width="205" height="12" fill="#451a03"/>
  <text x="359" y="193" text-anchor="middle" fill="#fcd34d" font-size="11" font-weight="700">Proxy (Node.js)</text>
  <text x="277" y="218" fill="#cbd5e1" font-size="10">Node.js backend relays conn.</text>
  <text x="277" y="235" fill="#cbd5e1" font-size="10">Applies skip-cert, custom CA</text>
  <text x="277" y="252" fill="#cbd5e1" font-size="10">Supports mTLS client certs</text>
  <rect x="267" y="264" width="180" height="20" rx="4" fill="#92400e15"/>
  <text x="357" y="278" text-anchor="middle" fill="#fbbf24" font-size="9.5" font-weight="500">auto:  TLS overrides → Proxy</text>

  <!-- Native transport -->
  <rect x="484" y="174" width="206" height="125" rx="8" fill="#1e293b" stroke="#a78bfa" stroke-width="1.5"/>
  <rect x="484" y="174" width="206" height="28" rx="8" fill="#2e1065"/>
  <rect x="484" y="190" width="206" height="12" fill="#2e1065"/>
  <text x="587" y="193" text-anchor="middle" fill="#c4b5fd" font-size="11" font-weight="700">Native (Tauri Desktop)</text>
  <text x="504" y="218" fill="#cbd5e1" font-size="10">rustls full TLS stack</text>
  <text x="504" y="235" fill="#cbd5e1" font-size="10">Skip-cert, custom CA, mTLS</text>
  <text x="504" y="252" fill="#cbd5e1" font-size="10">No proxy needed</text>
  <rect x="494" y="264" width="180" height="20" rx="4" fill="#4c1d9515"/>
  <text x="584" y="278" text-anchor="middle" fill="#c4b5fd" font-size="9.5" font-weight="500">desktop → Native</text>

  <!-- ── TLS Config panel section ── -->
  <line x1="30" y1="316" x2="690" y2="316" stroke="#1e3a5f" stroke-width="1"/>
  <text x="360" y="334" text-anchor="middle" fill="#94a3b8" font-size="10" font-weight="500" letter-spacing="0.06em">TLS CONFIGURATION PANEL  (Connect tab → Configure)</text>

  <!-- Config options row -->
  <!-- Skip cert option -->
  <rect x="30" y="348" width="155" height="90" rx="6" fill="#1e293b" stroke="#ef4444" stroke-width="1" stroke-dasharray="4,3"/>
  <text x="107" y="366" text-anchor="middle" fill="#fca5a5" font-size="10" font-weight="600">Skip Certificate</text>
  <text x="107" y="380" text-anchor="middle" fill="#fca5a5" font-size="10" font-weight="600">Validation</text>
  <text x="45" y="399" fill="#cbd5e1" font-size="9.5">rejectUnauthorized = false</text>
  <text x="45" y="415" fill="#b0b8c8" font-size="9.5">Dev/staging self-signed certs</text>
  <text x="45" y="430" fill="#f87171" font-size="9">⚠ Never use in production</text>

  <!-- CA Cert option -->
  <rect x="202" y="348" width="155" height="90" rx="6" fill="#1e293b" stroke="#f59e0b" stroke-width="1"/>
  <text x="279" y="370" text-anchor="middle" fill="#fcd34d" font-size="10" font-weight="600">CA Certificate</text>
  <text x="217" y="392" fill="#cbd5e1" font-size="9.5">Custom CA PEM</text>
  <text x="217" y="408" fill="#cbd5e1" font-size="9.5">Internal PKI / private CA</text>
  <text x="217" y="424" fill="#fbbf24" font-size="9">Optional</text>

  <!-- mTLS option -->
  <rect x="374" y="348" width="155" height="90" rx="6" fill="#1e293b" stroke="#4ade80" stroke-width="1"/>
  <text x="451" y="370" text-anchor="middle" fill="#a7f3d0" font-size="10" font-weight="600">mTLS Client Certs</text>
  <text x="389" y="392" fill="#cbd5e1" font-size="9.5">Client Cert + Private Key</text>
  <text x="389" y="408" fill="#cbd5e1" font-size="9.5">Server verifies client identity</text>
  <text x="389" y="424" fill="#86efac" font-size="9">Zero-trust / enterprise</text>

  <!-- Encrypted tunnel visual -->
  <rect x="546" y="348" width="144" height="90" rx="6" fill="url(#tls-tunnel)" stroke="#4ade80" stroke-width="1.5" stroke-dasharray="5,4"/>
  <text x="618" y="372" text-anchor="middle" fill="#4ade80" font-size="11" font-weight="600">TLS Tunnel</text>
  <text x="618" y="394" text-anchor="middle" fill="#86efac" font-size="10">Encrypted</text>
  <text x="618" y="412" text-anchor="middle" fill="#86efac" font-size="10">ws:// inside</text>
  <text x="618" y="432" text-anchor="middle" fill="#4ade80" font-size="14" font-weight="700">→</text>
</svg>`,
  },

  steps: [
    // ── 1. wss:// vs ws:// ─────────────────────────────────────
    {
      id: 'tls-intro',
      title: 'wss:// vs ws://',
      description:
        'The difference between ws:// and wss:// is just like http:// vs https:// — the "s" means TLS encryption. Type a wss:// URL and the **TLS / mTLS** configuration bar instantly appears at the bottom of the Connect tab. It only shows when the URL scheme is wss://, and stays collapsed until you choose to configure it.',
      highlight: WS.TLS_TOGGLE,
      preAction: async (ctx) => {
        await ctx.click(WS.LEFT_TAB_CONNECT);
        await ctx.delay(200);
        // Pre-fill the wss:// URL silently so the TLS bar is visible during the
        // reading phase (the viewer reads the description while seeing the result).
        // If already set correctly, leave it alone.
        const urlInput = document.querySelector(WS.URL_INPUT) as HTMLInputElement | null;
        if (!urlInput?.value?.startsWith('wss://')) {
          await ctx.fill(WS.URL_INPUT, WSS_ECHO_URL);
          await ctx.delay(300);
        }
        // Ensure TLS modal is closed — never open at the start of this step.
        await closeTlsModal(ctx);
      },
      action: async (ctx) => {
        // Clear then re-type the URL to give the viewer the visual of typing wss://.
        await ctx.fill(WS.URL_INPUT, '');
        await ctx.delay(400);
        await ctx.fill(WS.URL_INPUT, WSS_ECHO_URL);
        await ctx.delay(1000);
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
        // Close TLS modal if left open from the previous step
        await closeTlsModal(ctx);
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
        'Switch to **Send** and send a message. The echo server mirrors it back — proving the encrypted round-trip works. The data travels through the TLS tunnel: encrypted in transit, decrypted at each end. This is identical to a plain ws:// connection from the application\'s perspective.',
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
        // Open TLS modal to reset skip-cert (ensures Direct transport, not Proxy)
        await ensureTlsPanelExpanded(ctx);
        await setSkipCert(ctx, false);
        // Close TLS modal — this step highlights the transport badge, not the TLS panel
        await closeTlsModal(ctx);
        await ctx.delay(200);
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
