/**
 * Lesson 19: Secure WebSocket — wss:// & TLS
 *
 * Viewer arc (one idea per step, one payoff highlight per action):
 *  1. Type wss:// → TLS bar appears
 *  2. Open Configure → info banner (Direct vs Proxy)
 *  3. Connect → Direct badge
 *  4. Send echo over TLS
 *  5. Paste CA certificate
 *  6. Paste client cert + key → mTLS badge
 *  7. Connect + Send with that config → Proxy badge
 *  8. Transport modes summary (Direct after quiet reset)
 *
 * Public echo: wss://ws.postman-echo.com/raw (works on Direct and Proxy).
 * Demo PEMs are valid format but not this server's CA — step 7 enables
 * skip-cert for the live Proxy round-trip. Real CA/mTLS: Local TLS Echo.
 */
import type { DemoActionContext, DemoLesson } from '../../types';
import { applyWsTlsConfig, prepareWsTlsLessonQuiet } from '../../adapters';
import { showSpotlightRing } from '../../demoRipple';
import {
  closeExtraConnectionTabs,
  disconnectWebSocket,
  clearEvents,
  resetAuth,
  clearCustomHeaders,
  switchToClientModeQuiet,
  fillControlledInput,
  firstVisibleEl,
} from '../setup-helpers';
import { WS } from '@shared/selectors';
import { firstVisibleElement } from '../../utils/domVisibility';
import {
  WS_TLS_DEMO_CA_CERT as DEMO_CA_CERT,
  WS_TLS_DEMO_CLIENT_CERT as DEMO_CLIENT_CERT,
  WS_TLS_DEMO_CLIENT_KEY as DEMO_CLIENT_KEY,
} from './ws-tls-demo-certs';

/** Public echo reachable via both Direct (browser) and Proxy (Node + TLS overrides). */
const WSS_ECHO_URL = 'wss://ws.postman-echo.com/raw';

const HOLD = {
  look: 1000,
  beat: 700,
  outcome: 1200,
};

/** One steady ring + pause. Do not stack with a second hold on the same target. */
async function spotlightHold(
  ctx: DemoActionContext,
  el: HTMLElement | null | undefined,
  holdMs: number = HOLD.look,
): Promise<void> {
  if (!el) return;
  el.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  const remove = showSpotlightRing(el, { steady: true });
  try {
    await ctx.delay(holdMs);
  } finally {
    remove();
  }
}

async function waitConnected(ctx: DemoActionContext, maxTicks = 40): Promise<boolean> {
  for (let i = 0; i < maxTicks; i++) {
    if (firstVisibleElement(WS.STATUS_CONNECTED)) return true;
    await ctx.delay(250);
  }
  return !!firstVisibleElement(WS.STATUS_CONNECTED);
}

// ── Quiet guards (no ripples — preAction / setup only) ─────────────

async function ensureTlsPanelReady(ctx: DemoActionContext): Promise<void> {
  firstVisibleEl<HTMLElement>(WS.MODE_CLIENT)?.click();
  await ctx.delay(120);
  firstVisibleEl<HTMLElement>(WS.LEFT_TAB_CONNECT)?.click();
  await ctx.delay(120);
  const urlInput = firstVisibleElement<HTMLInputElement>(WS.URL_INPUT);
  if (urlInput && !urlInput.value?.startsWith('wss://')) {
    fillControlledInput(urlInput, WSS_ECHO_URL);
    await ctx.delay(200);
  }
}

async function ensureTlsPanelExpanded(ctx: DemoActionContext): Promise<void> {
  await ctx.waitFor(WS.TLS_TOGGLE, 2000);
  if (firstVisibleElement(WS.TLS_BODY)) return;
  const toggle = firstVisibleElement<HTMLElement>(WS.TLS_TOGGLE);
  if (toggle) {
    toggle.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    await ctx.waitFor(WS.TLS_BODY, 2000);
  }
}

async function closeTlsModal(ctx: DemoActionContext): Promise<void> {
  const closeBtn = firstVisibleElement<HTMLElement>(WS.TLS_CLOSE);
  if (!closeBtn) return;
  closeBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  await ctx.delay(250);
}

async function setSkipCert(ctx: DemoActionContext, checked: boolean): Promise<void> {
  await ctx.waitFor(`${WS.TLS_SKIP_CERT} input[type="checkbox"]`, 2000);
  const checkbox = firstVisibleElement<HTMLInputElement>(`${WS.TLS_SKIP_CERT} input[type="checkbox"]`);
  if (!checkbox || checkbox.checked === checked) return;
  checkbox.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  await ctx.delay(150);
}

async function clearCertFields(ctx: DemoActionContext): Promise<void> {
  await ctx.waitFor(WS.TLS_CA_CERT, 2000);
  const ca = firstVisibleElement<HTMLTextAreaElement>(WS.TLS_CA_CERT);
  const cert = firstVisibleElement<HTMLTextAreaElement>(WS.TLS_CLIENT_CERT);
  const key = firstVisibleElement<HTMLTextAreaElement>(WS.TLS_CLIENT_KEY);
  if (ca) fillControlledInput(ca, '');
  if (cert) fillControlledInput(cert, '');
  if (key) fillControlledInput(key, '');
  await ctx.delay(100);
}

/** Disconnect + open TLS editor; does not toggle skip-cert (caller decides). */
async function openTlsEditorQuiet(ctx: DemoActionContext): Promise<void> {
  await ensureTlsPanelReady(ctx);
  await disconnectWebSocket(ctx);
  await ctx.delay(150);
  await ensureTlsPanelExpanded(ctx);
  await ctx.waitFor(WS.TLS_CA_CERT, 2000);
}

/**
 * Live PEM paste under a single visual focus.
 * Pass `ring: false` when step.highlight already rings this field — a second
 * manual ring swaps DemoSpotlight off/on and reads as a double flash.
 */
async function pastePemField(
  ctx: DemoActionContext,
  selector: string,
  pem: string,
  opts: { ring?: boolean } = {},
): Promise<void> {
  const withRing = opts.ring !== false;
  await ctx.waitFor(selector, 2000);
  const field = firstVisibleElement<HTMLTextAreaElement>(selector);
  if (!field) return;
  field.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  const remove = withRing ? showSpotlightRing(field, { steady: true }) : () => {};
  try {
    await ctx.delay(HOLD.beat);
    fillControlledInput(field, pem);
    await ctx.delay(HOLD.outcome);
  } finally {
    remove();
  }
}

async function quietClick(selector: string, ctx: DemoActionContext): Promise<void> {
  const el = firstVisibleElement<HTMLElement>(selector);
  if (!el) return;
  el.click();
  await ctx.delay(HOLD.beat);
}

/** Apply full demo mTLS + skip-cert for public-echo Proxy round-trip. */
async function applyDemoMtlsConfig(ctx: DemoActionContext): Promise<void> {
  const applied = applyWsTlsConfig({
    rejectUnauthorized: false,
    caCert: DEMO_CA_CERT,
    clientCert: DEMO_CLIENT_CERT,
    clientKey: DEMO_CLIENT_KEY,
  });
  if (applied) {
    await ctx.delay(100);
    return;
  }
  await openTlsEditorQuiet(ctx);
  await ctx.fill(WS.TLS_CA_CERT, DEMO_CA_CERT);
  await ctx.fill(WS.TLS_CLIENT_CERT, DEMO_CLIENT_CERT);
  await ctx.fill(WS.TLS_CLIENT_KEY, DEMO_CLIENT_KEY);
  await setSkipCert(ctx, true);
  const saveBtn = firstVisibleElement<HTMLButtonElement>(WS.TLS_SAVE);
  if (saveBtn && !saveBtn.disabled) saveBtn.click();
  await closeTlsModal(ctx);
  await ctx.delay(100);
}

async function clearTlsConfigQuiet(ctx: DemoActionContext): Promise<void> {
  const cleared = applyWsTlsConfig({
    rejectUnauthorized: true,
    caCert: '',
    clientCert: '',
    clientKey: '',
  });
  if (cleared) return;
  await ensureTlsPanelExpanded(ctx);
  await setSkipCert(ctx, false);
  await clearCertFields(ctx);
  const saveBtn = firstVisibleElement<HTMLButtonElement>(WS.TLS_SAVE);
  if (saveBtn && !saveBtn.disabled) saveBtn.click();
  await closeTlsModal(ctx);
}

// ── Setup / Cleanup ────────────────────────────────────────────────

async function tlsSetupDomFallback(ctx: DemoActionContext): Promise<void> {
  await switchToClientModeQuiet(ctx);
  await disconnectWebSocket(ctx);
  await closeExtraConnectionTabs(ctx);
  await clearEvents(ctx);
  await resetAuth(ctx);
  await clearCustomHeaders(ctx);

  const sub = firstVisibleEl<HTMLInputElement>(WS.SUBPROTOCOLS_INPUT);
  if (sub) fillControlledInput(sub, '');
  const proto = firstVisibleEl<HTMLSelectElement>(`${WS.PROTOCOL_SELECT} select, ${WS.PROTOCOL_SELECT}`);
  if (proto && 'value' in proto) {
    await ctx.selectOption(WS.PROTOCOL_SELECT, 'raw');
  }
  firstVisibleEl<HTMLElement>(WS.LEFT_TAB_CONNECT)?.click();
  await ctx.delay(60);
  firstVisibleEl<HTMLElement>(WS.RIGHT_TAB_EVENTS)?.click();
  await ctx.delay(60);

  const url = firstVisibleEl<HTMLInputElement>(WS.URL_INPUT);
  if (url) fillControlledInput(url, '');
  await ctx.delay(60);
}

async function tlsSetup(ctx: DemoActionContext): Promise<void> {
  if (prepareWsTlsLessonQuiet()) {
    await ctx.delay(120);
    return;
  }
  await tlsSetupDomFallback(ctx);
}

async function tlsCleanup(ctx: DemoActionContext): Promise<void> {
  if (prepareWsTlsLessonQuiet()) {
    await ctx.delay(80);
    return;
  }
  await switchToClientModeQuiet(ctx);
  firstVisibleEl<HTMLElement>(WS.LEFT_TAB_CONNECT)?.click();
  await ctx.delay(60);
  await disconnectWebSocket(ctx);
  await clearEvents(ctx);
  const url = firstVisibleEl<HTMLInputElement>(WS.URL_INPUT);
  if (url) fillControlledInput(url, '');
  await closeExtraConnectionTabs(ctx);
}

// ── Lesson Definition ──────────────────────────────────────────────

export const wsTlsLesson: DemoLesson = {
  id: 'ws-tls',
  domainId: 'protocols',
  category: 'websocket',
  name: 'Secure WebSocket — wss:// & TLS',
  description: 'Connect over wss://, explore TLS configuration, certificate validation, and transport modes.',
  estimatedMinutes: 6,
  initialTab: 'websocket-studio',
  skipStudioTabIsolation: true,

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
  <rect width="720" height="460" rx="12" fill="url(#tls-bg)"/>
  <rect width="720" height="460" rx="12" fill="none" stroke="#1e3a5f" stroke-width="1"/>
  <text x="360" y="30" text-anchor="middle" fill="#cbd5e1" font-size="12" font-weight="600" letter-spacing="0.08em">TRANSPORT MODES &amp; TLS ARCHITECTURE</text>
  <rect x="30" y="50" width="300" height="75" rx="8" fill="#1e293b" stroke="#475569" stroke-width="1"/>
  <rect x="30" y="50" width="300" height="28" rx="8" fill="#374151"/>
  <rect x="30" y="66" width="300" height="12" fill="#374151"/>
  <text x="180" y="70" text-anchor="middle" fill="#cbd5e1" font-size="11" font-weight="600" letter-spacing="0.05em">ws://  —  PLAIN TEXT</text>
  <text x="70" y="94" fill="#cbd5e1" font-size="10">Data sent unencrypted</text>
  <text x="70" y="112" fill="#94a3b8" font-size="10">⚠ Not suitable for production</text>
  <rect x="390" y="50" width="300" height="75" rx="8" fill="#1e293b" stroke="#4ade80" stroke-width="1.5"/>
  <rect x="390" y="50" width="300" height="28" rx="8" fill="#064e3b"/>
  <rect x="390" y="66" width="300" height="12" fill="#064e3b"/>
  <text x="540" y="70" text-anchor="middle" fill="#4ade80" font-size="11" font-weight="600" letter-spacing="0.05em">wss://  —  TLS ENCRYPTED</text>
  <text x="430" y="94" fill="#a7f3d0" font-size="10">Data encrypted in transit</text>
  <text x="430" y="112" fill="#86efac" font-size="10">✓ Required for production</text>
  <rect x="335" y="70" width="50" height="24" rx="12" fill="#1e3a5f" stroke="#334155" stroke-width="1"/>
  <text x="360" y="87" text-anchor="middle" fill="#60a5fa" font-size="11" font-weight="700">vs</text>
  <text x="360" y="155" text-anchor="middle" fill="#94a3b8" font-size="10" font-weight="500" letter-spacing="0.06em">TRANSPORT MODES (auto-selected)</text>
  <line x1="30" y1="162" x2="690" y2="162" stroke="#1e3a5f" stroke-width="1"/>
  <rect x="30" y="174" width="205" height="125" rx="8" fill="#1e293b" stroke="#3b82f6" stroke-width="1.5"/>
  <rect x="30" y="174" width="205" height="28" rx="8" fill="#1d3a6e"/>
  <rect x="30" y="190" width="205" height="12" fill="#1d3a6e"/>
  <text x="132" y="193" text-anchor="middle" fill="#93c5fd" font-size="11" font-weight="700">Direct (Browser)</text>
  <text x="50" y="218" fill="#cbd5e1" font-size="10">Browser WebSocket API</text>
  <text x="50" y="235" fill="#cbd5e1" font-size="10">Browser cert store handles TLS</text>
  <text x="50" y="252" fill="#cbd5e1" font-size="10">No custom CA / skip-cert</text>
  <rect x="257" y="174" width="205" height="125" rx="8" fill="#1e293b" stroke="#f59e0b" stroke-width="1.5"/>
  <rect x="257" y="174" width="205" height="28" rx="8" fill="#451a03"/>
  <rect x="257" y="190" width="205" height="12" fill="#451a03"/>
  <text x="359" y="193" text-anchor="middle" fill="#fcd34d" font-size="11" font-weight="700">Proxy (Node.js)</text>
  <text x="277" y="218" fill="#cbd5e1" font-size="10">Node.js backend relays conn.</text>
  <text x="277" y="235" fill="#cbd5e1" font-size="10">Applies skip-cert, custom CA</text>
  <text x="277" y="252" fill="#cbd5e1" font-size="10">Supports mTLS client certs</text>
  <rect x="484" y="174" width="206" height="125" rx="8" fill="#1e293b" stroke="#a78bfa" stroke-width="1.5"/>
  <rect x="484" y="174" width="206" height="28" rx="8" fill="#2e1065"/>
  <rect x="484" y="190" width="206" height="12" fill="#2e1065"/>
  <text x="587" y="193" text-anchor="middle" fill="#c4b5fd" font-size="11" font-weight="700">Native (Tauri Desktop)</text>
  <text x="504" y="218" fill="#cbd5e1" font-size="10">rustls full TLS stack</text>
  <text x="504" y="235" fill="#cbd5e1" font-size="10">Skip-cert, custom CA, mTLS</text>
  <text x="504" y="252" fill="#cbd5e1" font-size="10">No proxy needed</text>
  <line x1="30" y1="316" x2="690" y2="316" stroke="#1e3a5f" stroke-width="1"/>
  <text x="360" y="334" text-anchor="middle" fill="#94a3b8" font-size="10" font-weight="500" letter-spacing="0.06em">TLS CONFIGURATION PANEL  (Connect tab → Configure)</text>
  <rect x="30" y="348" width="155" height="90" rx="6" fill="#1e293b" stroke="#ef4444" stroke-width="1" stroke-dasharray="4,3"/>
  <text x="107" y="366" text-anchor="middle" fill="#fca5a5" font-size="10" font-weight="600">Skip Certificate</text>
  <text x="107" y="380" text-anchor="middle" fill="#fca5a5" font-size="10" font-weight="600">Validation</text>
  <text x="45" y="399" fill="#cbd5e1" font-size="9.5">rejectUnauthorized = false</text>
  <text x="45" y="415" fill="#b0b8c8" font-size="9.5">Dev/staging self-signed certs</text>
  <rect x="202" y="348" width="155" height="90" rx="6" fill="#1e293b" stroke="#f59e0b" stroke-width="1"/>
  <text x="279" y="370" text-anchor="middle" fill="#fcd34d" font-size="10" font-weight="600">CA Certificate</text>
  <text x="217" y="392" fill="#cbd5e1" font-size="9.5">Custom CA PEM</text>
  <text x="217" y="408" fill="#cbd5e1" font-size="9.5">Internal PKI / private CA</text>
  <rect x="374" y="348" width="155" height="90" rx="6" fill="#1e293b" stroke="#4ade80" stroke-width="1"/>
  <text x="451" y="370" text-anchor="middle" fill="#a7f3d0" font-size="10" font-weight="600">mTLS Client Certs</text>
  <text x="389" y="392" fill="#cbd5e1" font-size="9.5">Client Cert + Private Key</text>
  <text x="389" y="408" fill="#cbd5e1" font-size="9.5">Server verifies client identity</text>
  <rect x="546" y="348" width="144" height="90" rx="6" fill="url(#tls-tunnel)" stroke="#4ade80" stroke-width="1.5" stroke-dasharray="5,4"/>
  <text x="618" y="372" text-anchor="middle" fill="#4ade80" font-size="11" font-weight="600">TLS Tunnel</text>
  <text x="618" y="394" text-anchor="middle" fill="#86efac" font-size="10">Encrypted</text>
  <text x="618" y="412" text-anchor="middle" fill="#86efac" font-size="10">ws:// inside</text>
</svg>`,
  },

  steps: [
    // 1 ── wss:// → TLS bar ─────────────────────────────────────
    {
      id: 'tls-intro',
      title: 'wss:// vs ws://',
      description:
        'The difference between ws:// and wss:// is just like http:// vs https:// — the **s** means TLS encryption. We fill a **wss://** URL; watch the **TLS / mTLS** bar appear at the bottom of the Connect tab. It only shows for secure URLs.',
      highlight: WS.URL_INPUT,
      preAction: async (ctx) => {
        firstVisibleEl<HTMLElement>(WS.LEFT_TAB_CONNECT)?.click();
        await closeTlsModal(ctx);
        const url = firstVisibleEl<HTMLInputElement>(WS.URL_INPUT);
        if (url?.value) fillControlledInput(url, '');
      },
      action: async (ctx) => {
        // Reading already rings the URL — fill under a single action hold, then show the bar.
        const url = firstVisibleElement<HTMLInputElement>(WS.URL_INPUT);
        if (url) {
          fillControlledInput(url, WSS_ECHO_URL);
          await ctx.delay(HOLD.look);
        }
        await spotlightHold(ctx, firstVisibleElement<HTMLElement>(WS.TLS_PANEL), HOLD.outcome);
      },
      verify: WS.TLS_PANEL,
      pauseAfter: true,
    },

    // 2 ── Open panel / info banner ─────────────────────────────
    {
      id: 'tls-panel',
      title: 'TLS Configuration Panel',
      description:
        'Click **Configure** on the TLS bar (Connect tab — not Auth). The blue **ℹ** banner explains the rule: in the browser, plain wss:// uses **Direct** TLS; custom options (skip-cert, CA, mTLS) need the **Proxy** transport. We close the panel before connecting.',
      highlight: WS.TLS_PANEL,
      preAction: async (ctx) => {
        await ensureTlsPanelReady(ctx);
        await closeTlsModal(ctx);
      },
      action: async (ctx) => {
        await ctx.click(WS.TLS_TOGGLE);
        await ctx.waitFor(WS.TLS_BODY, 2000);
        await ctx.delay(HOLD.beat);
        const notice = firstVisibleElement<HTMLElement>(WS.TLS_PROXY_NOTICE)
          ?? firstVisibleElement<HTMLElement>(WS.TLS_BODY);
        await spotlightHold(ctx, notice, 2200);
        await quietClick(WS.TLS_CLOSE, ctx);
      },
      pauseAfter: true,
    },

    // 3 ── Direct connect ───────────────────────────────────────
    {
      id: 'tls-connect',
      title: 'Connect Over TLS',
      description:
        'Click **Connect**. With no custom TLS options, the browser handles the handshake — status becomes **Connected** and the transport badge shows **Direct**.',
      highlight: WS.CONNECT_BTN,
      preAction: async (ctx) => {
        await closeTlsModal(ctx);
        await ensureTlsPanelReady(ctx);
        await disconnectWebSocket(ctx);
      },
      action: async (ctx) => {
        await ctx.click(WS.CONNECT_BTN);
        await waitConnected(ctx);
        await spotlightHold(ctx, firstVisibleElement<HTMLElement>(WS.TRANSPORT_BADGE), HOLD.outcome);
      },
      verify: WS.STATUS_CONNECTED,
      pauseAfter: true,
    },

    // 4 ── Send over Direct TLS ─────────────────────────────────
    {
      id: 'tls-send',
      title: 'Send & Receive Over TLS',
      description:
        'On the **Send** tab, send a message. The echo comes back through the TLS tunnel — same app experience as ws://, but encrypted in transit.',
      highlight: WS.MESSAGE_INPUT,
      preAction: async (ctx) => {
        if (!firstVisibleElement(WS.STATUS_CONNECTED)) {
          await ensureTlsPanelReady(ctx);
          firstVisibleElement<HTMLElement>(WS.CONNECT_BTN)?.click();
          await waitConnected(ctx);
        }
        firstVisibleEl<HTMLElement>(WS.LEFT_TAB_SEND)?.click();
        await ctx.delay(250);
      },
      action: async (ctx) => {
        // Fill under the reading ring — no second action ring on the same input.
        const msgInput = firstVisibleElement<HTMLTextAreaElement | HTMLInputElement>(WS.MESSAGE_INPUT);
        if (msgInput) {
          fillControlledInput(msgInput, '{"secure":true,"message":"Hello over TLS!"}');
          await ctx.delay(HOLD.look);
        }
        await ctx.click(WS.SEND_BTN);
        await ctx.delay(1400);
        await spotlightHold(ctx, firstVisibleElement<HTMLElement>(WS.MESSAGE_ROW), HOLD.outcome);
      },
      verify: WS.MESSAGE_ROW,
      pauseAfter: true,
    },

    // 5 ── CA certificate ───────────────────────────────────────
    {
      id: 'tls-ca-cert',
      title: 'CA Certificate — Trust Your Own CA',
      description:
        'Open TLS configuration and paste a **Root CA** PEM. This is the production-grade alternative to skipping validation: the proxy trusts only servers that chain to this CA (internal PKI). The modal stays open for the next step.',
      highlight: WS.TLS_CA_CERT,
      preAction: async (ctx) => {
        await ensureTlsPanelReady(ctx);
        await disconnectWebSocket(ctx);
        await ctx.delay(150);
        await closeTlsModal(ctx);
        // Spotlight the full TLS/mTLS bar, then visibly click Configure to open the modal
        await spotlightHold(ctx, firstVisibleElement<HTMLElement>(WS.TLS_PANEL), 1600);
        await ctx.click(WS.TLS_TOGGLE);
        await ctx.delay(1200);
        await ctx.waitFor(WS.TLS_BODY, 2000);
        await setSkipCert(ctx, false);
        const ca = firstVisibleElement<HTMLTextAreaElement>(WS.TLS_CA_CERT);
        if (ca?.value?.trim()) fillControlledInput(ca, '');
        const cert = firstVisibleElement<HTMLTextAreaElement>(WS.TLS_CLIENT_CERT);
        if (cert?.value?.trim()) fillControlledInput(cert, '');
        const key = firstVisibleElement<HTMLTextAreaElement>(WS.TLS_CLIENT_KEY);
        if (key?.value?.trim()) fillControlledInput(key, '');
      },
      action: async (ctx) => {
        // Modal already open; reading ring stays on CA — paste without a second ring.
        if (!firstVisibleElement(WS.TLS_BODY)) await openTlsEditorQuiet(ctx);
        await pastePemField(ctx, WS.TLS_CA_CERT, DEMO_CA_CERT, { ring: false });
        applyWsTlsConfig({ rejectUnauthorized: true, caCert: DEMO_CA_CERT });
        const saveBtn = firstVisibleElement<HTMLButtonElement>(WS.TLS_SAVE);
        if (saveBtn && !saveBtn.disabled) await quietClick(WS.TLS_SAVE, ctx);
      },
      verify: WS.TLS_CA_CERT,
      pauseAfter: true,
    },

    // 6 ── mTLS client identity ─────────────────────────────────
    {
      id: 'tls-mtls',
      title: 'Client Certificate & Key — mTLS',
      description:
        'Paste a **Client Certificate** and matching **Client Key**. The server can verify your identity at the TLS handshake — before any WebSocket frames. **Save** and **Close**; the TLS bar badge switches to **mTLS**.',
      highlight: WS.TLS_CLIENT_CERT,
      preAction: async (ctx) => {
        await ensureTlsPanelReady(ctx);
        await disconnectWebSocket(ctx);
        await ctx.delay(150);
        await closeTlsModal(ctx);
        // Spotlight the TLS bar then visibly click Configure
        await spotlightHold(ctx, firstVisibleElement<HTMLElement>(WS.TLS_PANEL), 1600);
        await ctx.click(WS.TLS_TOGGLE);
        await ctx.delay(1200);
        await ctx.waitFor(WS.TLS_BODY, 2000);
        const ca = firstVisibleElement<HTMLTextAreaElement>(WS.TLS_CA_CERT);
        if (ca && !ca.value?.trim()) fillControlledInput(ca, DEMO_CA_CERT);
        const cert = firstVisibleElement<HTMLTextAreaElement>(WS.TLS_CLIENT_CERT);
        if (cert?.value?.trim()) fillControlledInput(cert, '');
        const key = firstVisibleElement<HTMLTextAreaElement>(WS.TLS_CLIENT_KEY);
        if (key?.value?.trim()) fillControlledInput(key, '');
      },
      action: async (ctx) => {
        if (!firstVisibleElement(WS.TLS_BODY)) await openTlsEditorQuiet(ctx);
        // Cert field already has the reading ring — no second ring.
        await pastePemField(ctx, WS.TLS_CLIENT_CERT, DEMO_CLIENT_CERT, { ring: false });
        // Key is a new target — one steady move of the spotlight.
        await pastePemField(ctx, WS.TLS_CLIENT_KEY, DEMO_CLIENT_KEY, { ring: true });
        // Extra hold so viewers can read the filled key value before moving on
        await spotlightHold(ctx, firstVisibleElement<HTMLElement>(WS.TLS_CLIENT_KEY), 1800);
        applyWsTlsConfig({
          rejectUnauthorized: true,
          caCert: DEMO_CA_CERT,
          clientCert: DEMO_CLIENT_CERT,
          clientKey: DEMO_CLIENT_KEY,
        });
        const saveBtn = firstVisibleElement<HTMLButtonElement>(WS.TLS_SAVE);
        if (saveBtn && !saveBtn.disabled) await quietClick(WS.TLS_SAVE, ctx);
        await quietClick(WS.TLS_CLOSE, ctx);
        await spotlightHold(
          ctx,
          firstVisibleElement<HTMLElement>(WS.TLS_INDICATOR)
            ?? firstVisibleElement<HTMLElement>(WS.TLS_TOGGLE),
          HOLD.outcome,
        );
      },
      verify: WS.TLS_INDICATOR,
      pauseAfter: true,
    },

    // 7 ── Proxy round-trip with config applied ─────────────────
    {
      id: 'tls-proxy-roundtrip',
      title: 'Connect & Send with TLS Config Applied',
      description:
        'Connect with CA + client cert + key still applied. Transport switches to **Proxy** so Node can use those options; then we **Send** an echo. ' +
        'These demo PEMs are not this public server\'s CA, so **skip certificate validation** is on for this live call. For a real CA-validated / mTLS handshake, use **Local TLS Echo**.',
      highlight: WS.CONNECT_BTN,
      preAction: async (ctx) => {
        await closeTlsModal(ctx);
        await ensureTlsPanelReady(ctx);
        await disconnectWebSocket(ctx);
        // Keep PEMs; enable skip-cert so Proxy can reach the public echo.
        await applyDemoMtlsConfig(ctx);
        await closeTlsModal(ctx);
      },
      action: async (ctx) => {
        await ctx.click(WS.CONNECT_BTN);
        const ok = await waitConnected(ctx);
        if (ok) {
          firstVisibleEl<HTMLElement>(WS.LEFT_TAB_SEND)?.click();
          await ctx.delay(HOLD.beat);
          const msgInput = firstVisibleElement<HTMLTextAreaElement | HTMLInputElement>(WS.MESSAGE_INPUT);
          if (msgInput) {
            fillControlledInput(
              msgInput,
              '{"secure":true,"tlsConfig":"ca+mtls","message":"Hello with TLS config applied!"}',
            );
            await ctx.delay(HOLD.look);
          }
          await ctx.click(WS.SEND_BTN);
          await ctx.delay(1400);
          firstVisibleEl<HTMLElement>(WS.LEFT_TAB_CONNECT)?.click();
          await ctx.delay(HOLD.beat);
        }
        // Single payoff: Proxy proves custom TLS options were used.
        await spotlightHold(ctx, firstVisibleElement<HTMLElement>(WS.TRANSPORT_BADGE), HOLD.outcome);
      },
      verify: WS.STATUS_CONNECTED,
      pauseAfter: true,
    },

    // 8 ── Transport summary ────────────────────────────────────
    {
      id: 'tls-transport',
      title: 'Transport Modes & Desktop TLS',
      description:
        'Transport is selected automatically based on context:\n\n' +
        '- **Direct** — plain `wss://` with no custom TLS options; the browser handles TLS natively\n' +
        '- **Proxy** — when you set custom TLS options (skip-cert, CA cert, or mTLS); RedfireForge routes through the Node.js proxy so it can apply the options server-side\n' +
        '- **Native** — on Tauri desktop, rustls handles TLS directly with full certificate support and no proxy needed\n\n' +
        'The transport badge below shows **Direct** again now that demo TLS overrides have been cleared.',
      highlight: WS.TRANSPORT_BADGE,
      preAction: async (ctx) => {
        await closeTlsModal(ctx);
        await ensureTlsPanelReady(ctx);
        await disconnectWebSocket(ctx);
        await clearTlsConfigQuiet(ctx);
        await closeTlsModal(ctx);
        if (!firstVisibleElement(WS.STATUS_CONNECTED)) {
          firstVisibleElement<HTMLElement>(WS.CONNECT_BTN)?.click();
          await waitConnected(ctx);
        }
        firstVisibleEl<HTMLElement>(WS.LEFT_TAB_CONNECT)?.click();
        await ctx.delay(150);
      },
      // Reading already holds Direct — no second action spotlight.
      action: async (ctx) => {
        await ctx.delay(HOLD.beat);
      },
      pauseAfter: true,
    },
  ],
};
