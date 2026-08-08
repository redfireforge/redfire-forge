/**
 * Lesson 15: Reliability — Auto-Reconnect & Stats
 *
 * Demonstrates the features that keep WebSocket connections healthy:
 *  - Stats tab with live msg/s sparkline, bytes, and frame types
 *  - Auto-reconnect settings (max attempts, interval, backoff)
 *  - Close with code/reason for controlled disconnects
 *  - URL history for quick reconnection
 *
 * No Docker required — uses the built-in mock echo server.
 */
import type { DemoActionContext, DemoLesson } from '../../types';
import { WS } from '@shared/selectors';
import {
  clearEvents,
  connectToMockServer,
  disconnectWebSocket,
  fillControlledInput,
  firstVisibleEl,
  getLastMockPort,
  startMockServerQuiet,
  stopMockServerQuiet,
  switchToClientModeQuiet,
} from '../setup-helpers';
import { firstVisibleElement } from '../../utils/domVisibility';
import { showSpotlightRing } from '../../demoRipple';

// ── Constants ──────────────────────────────────────────────────
// NOTE: this is only a fallback description string; the actual connect URL
// is resolved dynamically via getLastMockPort() (each tab gets its own port).

/** Park on Client → Connect and pre-fill the mock URL with no ripples / menus. */
async function prepareConnectPanelQuiet(ctx: DemoActionContext): Promise<void> {
  await switchToClientModeQuiet(ctx);
  const connectTab = firstVisibleEl<HTMLElement>(WS.LEFT_TAB_CONNECT);
  if (connectTab && !connectTab.classList.contains('active') && connectTab.getAttribute('aria-selected') !== 'true') {
    connectTab.click();
    await ctx.delay(60);
  }
  const url = `ws://localhost:${getLastMockPort()}`;
  const urlInput = firstVisibleEl<HTMLInputElement>(WS.URL_INPUT);
  if (urlInput && urlInput.value !== url) {
    fillControlledInput(urlInput, url);
  }
  const sub = firstVisibleEl<HTMLInputElement>(WS.SUBPROTOCOLS_INPUT);
  if (sub && sub.value !== '') fillControlledInput(sub, '');
  // Do NOT open the Protocol CustomSelect during setup — Live is already visible
  // and the dropdown flash is what viewers report as "moving parts" on step 1.
  await ctx.delay(40);
}

// ── Setup / Cleanup ─────────────────────────────────────────────

/**
 * Quiet setup — REST mock + Connect panel ready (URL filled).
 * Live view is already on screen during setup, so no Mock tour, no demo-tab
 * add/rename, no protocol dropdown, no multi-spotlight hops.
 */
async function reliabilitySetup(ctx: DemoActionContext): Promise<void> {
  const disconnectBtn = firstVisibleEl<HTMLButtonElement>(WS.DISCONNECT_BTN);
  if (disconnectBtn && !disconnectBtn.disabled) {
    disconnectBtn.click();
    await ctx.delay(40);
  }
  await startMockServerQuiet(ctx, 9876);
  await prepareConnectPanelQuiet(ctx);
  (document.activeElement as HTMLElement | null)?.blur?.();
  // Always start on Events tab so persisted Stats doesn't bleed in before the step that teaches it
  const eventsTab = firstVisibleEl<HTMLElement>(WS.RIGHT_TAB_EVENTS);
  if (eventsTab?.getAttribute('aria-selected') !== 'true') {
    eventsTab?.click();
    await ctx.delay(40);
  }
}

async function reliabilityCleanup(ctx: DemoActionContext): Promise<void> {
  await prepareConnectPanelQuiet(ctx);
  await disconnectWebSocket(ctx);
  await clearEvents(ctx);
  await stopMockServerQuiet(ctx, 9876);
  await switchToClientModeQuiet(ctx);
}

// ── Lesson ──────────────────────────────────────────────────────

export const wsReliabilityLesson: DemoLesson = {
  id: 'ws-reliability',
  domainId: 'protocols',
  category: 'websocket',
  name: 'Auto-Reconnect & Stats',
  description: 'Monitor connection health with live stats, configure auto-reconnect, and use close-with-code for controlled disconnects.',
  estimatedMinutes: 3,
  initialTab: 'websocket-studio',
  // Avoid add→rename "demo" connection tab flash at live start
  skipStudioTabIsolation: true,

  setup: reliabilitySetup,
  cleanup: reliabilityCleanup,

  concept: {
    title: 'Reliability: Keeping Connections Healthy',
    body: `Production WebSocket connections drop — servers restart, networks hiccup, load balancers time out. RedfireForge has three features that help you stay resilient and informed.

**Stats Tab**

The **Stats** tab in the right panel shows live connection metrics:
- **Msg/s** with a 60-point sparkline that updates every second
- **Bytes In / Out** with per-second rates
- **Frame Types** — a segmented bar showing the mix of text, binary, and control frames

When the connection drops, rates go to zero and the sparkline flattens — instant visual feedback.

**Auto-Reconnect**

In the Connect panel, the **Auto-Reconnect Settings** section lets you configure what happens when a connection drops unexpectedly (close code ≠ 1000):
- **Max Attempts** — how many times to retry (1–50)
- **Retry Interval** — base delay between retries (500ms–60s)
- **Backoff Multiplier** — exponential backoff (1×, 1.5×, or 2×)

When active, a progress banner shows retry status with a cancel button.

**Close with Code**

The caret (▾) next to Disconnect opens a dropdown for sending a custom close frame. You pick a **close code** (1000 Normal, 1001 Going Away, etc.) and optional **reason string**. This is essential for testing how your server handles different disconnect scenarios.`,
    keyTerms: [
      {
        term: 'Close Code',
        definition: 'A numeric status code sent in the WebSocket close frame. 1000 = normal closure, 1001 = going away, 1006 = abnormal (no close frame). Only codes 1000 and 1001 are considered "clean" disconnects.',
      },
      {
        term: 'Auto-Reconnect',
        definition: 'Automatic retry logic that fires when a connection drops with a non-1000 close code. Configurable max attempts, retry interval, and exponential backoff.',
      },
      {
        term: 'Backoff Multiplier',
        definition: 'Each retry waits longer than the last: interval × multiplier^attempt. A 2× backoff with 3s base means retries at 3s, 6s, 12s, 24s — preventing thundering-herd reconnection storms.',
      },
      {
        term: 'Sparkline',
        definition: 'A small inline chart in the Stats tab that plots message throughput over the last 60 seconds. Useful for spotting traffic patterns and connection drops at a glance.',
      },
    ],
    diagram: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 470" style="display:block;width:100%;height:auto;font-family:'SF Mono','Fira Code','Consolas',monospace">
  <defs>
    <marker id="ar-arr-green" markerWidth="7" markerHeight="7" refX="4" refY="3.5" orient="auto">
      <path d="M1,1 L6,3.5 L1,6 Z" fill="#22c55e"/>
    </marker>
    <marker id="ar-arr-amber" markerWidth="7" markerHeight="7" refX="4" refY="3.5" orient="auto">
      <path d="M1,1 L6,3.5 L1,6 Z" fill="#f59e0b"/>
    </marker>
    <linearGradient id="ar-sparkline-fill" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#06b6d4" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#06b6d4" stop-opacity="0.02"/>
    </linearGradient>
    <linearGradient id="ar-tab-active" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#2d3a4d"/>
      <stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>
    <filter id="ar-glow-green" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="2.5" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="ar-shadow">
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000" flood-opacity="0.4"/>
    </filter>
    <clipPath id="ar-sparkline-clip">
      <rect x="0" y="0" width="106" height="48"/>
    </clipPath>
  </defs>

  <!-- ═══════════════════════════════════════════
       STUDIO WINDOW FRAME
  ═══════════════════════════════════════════ -->
  <rect x="1" y="1" width="698" height="270" rx="8" fill="#0d1520" stroke="#3b4a60" stroke-width="1.5" filter="url(#ar-shadow)"/>

  <!-- Title bar chrome -->
  <rect x="1" y="1" width="698" height="30" rx="8" fill="#0a1118"/>
  <rect x="1" y="20" width="698" height="11" fill="#0a1118"/>
  <circle cx="18" cy="15" r="4.5" fill="#ef4444" opacity="0.8"/>
  <circle cx="34" cy="15" r="4.5" fill="#f59e0b" opacity="0.8"/>
  <circle cx="50" cy="15" r="4.5" fill="#22c55e" opacity="0.8"/>
  <text x="350" y="19" text-anchor="middle" font-family="system-ui,sans-serif" font-size="11" fill="#a8b8cc">WebSocket Studio — RedfireForge</text>

  <!-- Mode tab bar -->
  <rect x="1" y="31" width="698" height="32" fill="#0f172a"/>

  <!-- Client tab (active) -->
  <rect x="8" y="34" width="70" height="26" rx="5" fill="url(#ar-tab-active)" stroke="#3b4a60" stroke-width="1"/>
  <rect x="8" y="54" width="70" height="5" fill="#1e293b"/>
  <rect x="8" y="53" width="70" height="2" fill="#3b82f6"/>
  <text x="43" y="51" text-anchor="middle" font-family="system-ui,sans-serif" font-size="11" font-weight="600" fill="#f1f5f9">Client</text>

  <!-- Other mode tabs -->
  <text x="118" y="51" text-anchor="middle" font-family="system-ui,sans-serif" font-size="11" fill="#a8b8cc">Mock Server</text>
  <text x="222" y="51" text-anchor="middle" font-family="system-ui,sans-serif" font-size="11" fill="#a8b8cc">Saved</text>

  <!-- ═══════════════════════════════════════════
       LEFT SUB-NAV
  ═══════════════════════════════════════════ -->
  <rect x="1" y="63" width="86" height="207" fill="#0a1118"/>
  <rect x="86" y="63" width="1" height="207" fill="#3b4a60"/>

  <!-- Connect sub-tab (active) -->
  <rect x="1" y="63" width="86" height="34" fill="#1e293b"/>
  <rect x="1" y="63" width="3" height="34" fill="#3b82f6"/>
  <text x="45" y="84" text-anchor="middle" font-family="system-ui,sans-serif" font-size="10.5" font-weight="600" fill="#f1f5f9">Connect</text>

  <!-- Events sub-tab -->
  <text x="45" y="117" text-anchor="middle" font-family="system-ui,sans-serif" font-size="10.5" fill="#a8b8cc">Events</text>

  <!-- Console sub-tab -->
  <text x="45" y="143" text-anchor="middle" font-family="system-ui,sans-serif" font-size="10.5" fill="#a8b8cc">Console</text>

  <!-- Stats sub-tab — highlighted teal -->
  <rect x="1" y="153" width="86" height="28" fill="#0a1f26"/>
  <rect x="1" y="153" width="3" height="28" fill="#06b6d4" opacity="0.6"/>
  <text x="45" y="172" text-anchor="middle" font-family="system-ui,sans-serif" font-size="10.5" font-weight="500" fill="#06b6d4">Stats</text>

  <!-- Load Test sub-tab -->
  <text x="45" y="208" text-anchor="middle" font-family="system-ui,sans-serif" font-size="10.5" fill="#a8b8cc">Load Test</text>

  <text x="45" y="234" text-anchor="middle" font-family="system-ui,sans-serif" font-size="10.5" fill="#a8b8cc">History</text>

  <!-- ═══════════════════════════════════════════
       CONNECT PANEL CONTENT
  ═══════════════════════════════════════════ -->

  <!-- URL label + input -->
  <text x="100" y="82" font-family="system-ui,sans-serif" font-size="9.5" fill="#a8b8cc">URL</text>
  <rect x="118" y="70" width="278" height="24" rx="4" fill="#0f172a" stroke="#3b4a60" stroke-width="1"/>
  <text x="128" y="86" font-family="'SF Mono','Fira Code',monospace" font-size="10.5" fill="#f1f5f9">ws://localhost:9876</text>

  <!-- Connect button -->
  <rect x="118" y="102" width="70" height="24" rx="4" fill="#3b82f6"/>
  <text x="153" y="118" text-anchor="middle" font-family="system-ui,sans-serif" font-size="11" font-weight="600" fill="#fff">Connect</text>

  <!-- Disconnect ▾ button (split button) -->
  <rect x="196" y="102" width="88" height="24" rx="4" fill="#1e293b" stroke="#3b4a60" stroke-width="1"/>
  <text x="232" y="118" text-anchor="middle" font-family="system-ui,sans-serif" font-size="10.5" fill="#a8b8cc">Disconnect</text>
  <rect x="274" y="102" width="10" height="24" rx="0" fill="#3b4a60" opacity="0.4"/>
  <text x="279" y="118" text-anchor="middle" font-family="system-ui,sans-serif" font-size="10" fill="#a8b8cc">▾</text>

  <!-- Save as Profile button -->
  <rect x="292" y="102" width="104" height="24" rx="4" fill="#1e293b" stroke="#3b4a60" stroke-width="1"/>
  <text x="344" y="118" text-anchor="middle" font-family="system-ui,sans-serif" font-size="10.5" fill="#a8b8cc">Save as Profile</text>

  <!-- Status bar (connected, green) -->
  <rect x="118" y="136" width="448" height="22" rx="4" fill="#0a1f12" stroke="#22c55e" stroke-width="1" stroke-opacity="0.6"/>
  <!-- Green dot pulse indicator -->
  <circle cx="132" cy="147" r="5" fill="#22c55e" opacity="0.25" filter="url(#ar-glow-green)"/>
  <circle cx="132" cy="147" r="3.5" fill="#22c55e"/>
  <text x="143" y="151" font-family="system-ui,sans-serif" font-size="10" font-weight="600" fill="#22c55e">Connected</text>
  <text x="208" y="151" font-family="'SF Mono','Fira Code',monospace" font-size="9.5" fill="#a8b8cc">ws://localhost:9876</text>
  <rect x="354" y="139" width="1" height="16" fill="#3b4a60"/>
  <text x="364" y="148" font-family="system-ui,sans-serif" font-size="9" fill="#a8b8cc">↑ sent</text>
  <text x="364" y="158" font-family="'SF Mono','Fira Code',monospace" font-size="9" fill="#22c55e">3</text>
  <rect x="395" y="139" width="1" height="16" fill="#3b4a60"/>
  <text x="405" y="148" font-family="system-ui,sans-serif" font-size="9" fill="#a8b8cc">↓ recv</text>
  <text x="405" y="158" font-family="'SF Mono','Fira Code',monospace" font-size="9" fill="#22c55e">5</text>
  <rect x="436" y="139" width="1" height="16" fill="#3b4a60"/>
  <text x="446" y="148" font-family="system-ui,sans-serif" font-size="9" fill="#a8b8cc">latency</text>
  <text x="446" y="158" font-family="'SF Mono','Fira Code',monospace" font-size="9" fill="#22c55e">12 ms</text>
  <rect x="490" y="139" width="1" height="16" fill="#3b4a60"/>
  <text x="500" y="148" font-family="system-ui,sans-serif" font-size="9" fill="#a8b8cc">uptime</text>
  <text x="500" y="158" font-family="'SF Mono','Fira Code',monospace" font-size="9" fill="#22c55e">4m 32s</text>

  <!-- ═══════════════════════════════════════════
       AUTO-RECONNECT SETTINGS
  ═══════════════════════════════════════════ -->
  <line x1="88" y1="170" x2="699" y2="170" stroke="#3b4a60" stroke-width="1" stroke-dasharray="4,3"/>

  <!-- Section header -->
  <rect x="88" y="175" width="8" height="8" rx="1" fill="#f59e0b" opacity="0.9"/>
  <text x="102" y="184" font-family="system-ui,sans-serif" font-size="10.5" font-weight="700" fill="#f59e0b" letter-spacing="0.3">AUTO-RECONNECT SETTINGS</text>

  <!-- Toggle checkbox row -->
  <rect x="118" y="195" width="12" height="12" rx="2" fill="#f59e0b" opacity="0.9"/>
  <text x="121" y="205" font-family="system-ui,sans-serif" font-size="9.5" font-weight="700" fill="#0a1118">✓</text>
  <text x="135" y="205" font-family="system-ui,sans-serif" font-size="10.5" fill="#f1f5f9">Auto-reconnect on unexpected disconnect</text>
  <text x="370" y="205" font-family="system-ui,sans-serif" font-size="9" fill="#a8b8cc" font-style="italic">(close code ≠ 1000)</text>

  <!-- Config pills row -->
  <!-- Max Attempts -->
  <rect x="118" y="216" width="116" height="30" rx="5" fill="#1a1f0a" stroke="#f59e0b" stroke-width="1" stroke-opacity="0.5"/>
  <text x="176" y="228" text-anchor="middle" font-family="system-ui,sans-serif" font-size="8.5" fill="#a8b8cc">Max Attempts</text>
  <text x="176" y="241" text-anchor="middle" font-family="'SF Mono','Fira Code',monospace" font-size="13" font-weight="700" fill="#f59e0b">5</text>

  <!-- Retry Interval -->
  <rect x="242" y="216" width="116" height="30" rx="5" fill="#1a1f0a" stroke="#f59e0b" stroke-width="1" stroke-opacity="0.5"/>
  <text x="300" y="228" text-anchor="middle" font-family="system-ui,sans-serif" font-size="8.5" fill="#a8b8cc">Retry Interval</text>
  <text x="300" y="241" text-anchor="middle" font-family="'SF Mono','Fira Code',monospace" font-size="13" font-weight="700" fill="#f59e0b">3 000 ms</text>

  <!-- Backoff Multiplier -->
  <rect x="366" y="216" width="116" height="30" rx="5" fill="#1a1f0a" stroke="#f59e0b" stroke-width="1" stroke-opacity="0.5"/>
  <text x="424" y="228" text-anchor="middle" font-family="system-ui,sans-serif" font-size="8.5" fill="#a8b8cc">Backoff Multiplier</text>
  <text x="424" y="241" text-anchor="middle" font-family="'SF Mono','Fira Code',monospace" font-size="13" font-weight="700" fill="#f59e0b">2×</text>

  <!-- Retry timeline (right side) -->
  <text x="510" y="228" font-family="system-ui,sans-serif" font-size="9" fill="#a8b8cc">exponential backoff:</text>
  <!-- Timeline dots and labels -->
  <circle cx="508" cy="240" r="3" fill="#f59e0b" opacity="0.8"/>
  <text x="516" y="244" font-family="'SF Mono','Fira Code',monospace" font-size="8.5" fill="#f59e0b">3s</text>
  <line x1="532" y1="240" x2="546" y2="240" stroke="#f59e0b" stroke-width="1" stroke-opacity="0.4" stroke-dasharray="2,2"/>
  <circle cx="550" cy="240" r="3" fill="#f59e0b" opacity="0.65"/>
  <text x="558" y="244" font-family="'SF Mono','Fira Code',monospace" font-size="8.5" fill="#f59e0b">6s</text>
  <line x1="574" y1="240" x2="588" y2="240" stroke="#f59e0b" stroke-width="1" stroke-opacity="0.4" stroke-dasharray="2,2"/>
  <circle cx="592" cy="240" r="3" fill="#f59e0b" opacity="0.5"/>
  <text x="600" y="244" font-family="'SF Mono','Fira Code',monospace" font-size="8.5" fill="#f59e0b">12s</text>
  <line x1="618" y1="240" x2="632" y2="240" stroke="#f59e0b" stroke-width="1" stroke-opacity="0.4" stroke-dasharray="2,2"/>
  <circle cx="636" cy="240" r="3" fill="#f59e0b" opacity="0.35"/>
  <text x="644" y="244" font-family="'SF Mono','Fira Code',monospace" font-size="8.5" fill="#f59e0b">24s</text>

  <!-- ═══════════════════════════════════════════
       STATS TAB SECTION
  ═══════════════════════════════════════════ -->
  <rect x="1" y="281" width="698" height="180" rx="8" fill="#0d1520" stroke="#06b6d4" stroke-width="1.2" filter="url(#ar-shadow)"/>

  <!-- Stats tab header -->
  <rect x="1" y="281" width="698" height="30" rx="8" fill="#071820"/>
  <rect x="1" y="295" width="698" height="16" fill="#071820"/>
  <rect x="1" y="293" width="698" height="2" fill="#06b6d4" opacity="0.25"/>
  <!-- Tab indicator -->
  <rect x="10" y="284" width="50" height="22" rx="4" fill="#0a1f26" stroke="#06b6d4" stroke-width="1"/>
  <rect x="10" y="298" width="50" height="8" fill="#0a1f26"/>
  <rect x="10" y="296" width="50" height="2" fill="#06b6d4"/>
  <text x="35" y="299" text-anchor="middle" font-family="system-ui,sans-serif" font-size="10.5" font-weight="700" fill="#06b6d4">Stats</text>

  <text x="66" y="299" font-family="system-ui,sans-serif" font-size="10" fill="#3b4a60">Events</text>
  <text x="105" y="299" font-family="system-ui,sans-serif" font-size="10" fill="#3b4a60">Console</text>
  <text x="150" y="299" font-family="system-ui,sans-serif" font-size="10" fill="#3b4a60">Load Test</text>

  <!-- Live badge -->
  <rect x="648" y="285" width="40" height="18" rx="9" fill="#0a1f12" stroke="#22c55e" stroke-width="1"/>
  <circle cx="657" cy="294" r="3" fill="#22c55e"/>
  <text x="663" y="298" font-family="system-ui,sans-serif" font-size="9" font-weight="700" fill="#22c55e">LIVE</text>

  <!-- ═══ CARD 1: Msg/s with Sparkline ═══ -->
  <rect x="10" y="316" width="158" height="138" rx="7" fill="#0a1520" stroke="#06b6d4" stroke-width="1.2"/>
  <!-- Card header -->
  <rect x="10" y="316" width="158" height="26" rx="7" fill="#071e2a"/>
  <rect x="10" y="330" width="158" height="12" fill="#071e2a"/>
  <text x="22" y="333" font-family="system-ui,sans-serif" font-size="10" font-weight="700" fill="#06b6d4" letter-spacing="0.5">MSG / S</text>
  <text x="152" y="333" text-anchor="end" font-family="system-ui,sans-serif" font-size="9" fill="#a8b8cc">last 60s</text>

  <!-- Big metric value -->
  <text x="22" y="362" font-family="'SF Mono','Fira Code',monospace" font-size="22" font-weight="700" fill="#06b6d4">12.5</text>
  <text x="87" y="362" font-family="system-ui,sans-serif" font-size="11" fill="#a8b8cc">/s</text>

  <!-- Sparkline area chart -->
  <g transform="translate(12, 372)" clip-path="url(#ar-sparkline-clip)">
    <!-- Fill area under sparkline -->
    <path d="M0,35 L0,28 L8,25 L16,30 L24,20 L32,26 L40,16 L48,22 L56,18 L64,24 L72,14 L80,20 L88,17 L96,22 L104,18 L106,18 L106,35 Z" fill="url(#ar-sparkline-fill)"/>
    <!-- Sparkline line -->
    <polyline points="0,28 8,25 16,30 24,20 32,26 40,16 48,22 56,18 64,24 72,14 80,20 88,17 96,22 104,18" fill="none" stroke="#06b6d4" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>
    <!-- Current value dot -->
    <circle cx="104" cy="18" r="3" fill="#06b6d4"/>
  </g>
  <text x="22" y="450" font-family="system-ui,sans-serif" font-size="8.5" fill="#3b4a60">avg throughput (60s window)</text>

  <!-- ═══ CARD 2: Bytes In ═══ -->
  <rect x="178" y="316" width="158" height="138" rx="7" fill="#0a1520" stroke="#22c55e" stroke-width="1.2"/>
  <rect x="178" y="316" width="158" height="26" rx="7" fill="#071e12"/>
  <rect x="178" y="330" width="158" height="12" fill="#071e12"/>
  <text x="190" y="333" font-family="system-ui,sans-serif" font-size="10" font-weight="700" fill="#22c55e" letter-spacing="0.5">BYTES IN</text>

  <!-- Total -->
  <text x="190" y="358" font-family="'SF Mono','Fira Code',monospace" font-size="18" font-weight="700" fill="#22c55e">4.2</text>
  <text x="226" y="358" font-family="system-ui,sans-serif" font-size="11" fill="#a8b8cc">KB total</text>

  <!-- Rate -->
  <text x="190" y="378" font-family="system-ui,sans-serif" font-size="9" fill="#a8b8cc">current rate</text>
  <text x="190" y="395" font-family="'SF Mono','Fira Code',monospace" font-size="16" font-weight="600" fill="#22c55e">420</text>
  <text x="224" y="395" font-family="system-ui,sans-serif" font-size="10" fill="#a8b8cc">B/s</text>

  <!-- Mini rate bars -->
  <rect x="190" y="404" width="120" height="3" rx="1.5" fill="#3b4a60"/>
  <rect x="190" y="404" width="84" height="3" rx="1.5" fill="#22c55e" opacity="0.7"/>

  <text x="190" y="450" font-family="system-ui,sans-serif" font-size="8.5" fill="#3b4a60">inbound traffic this session</text>

  <!-- ═══ CARD 3: Bytes Out ═══ -->
  <rect x="346" y="316" width="158" height="138" rx="7" fill="#0a1520" stroke="#3b82f6" stroke-width="1.2"/>
  <rect x="346" y="316" width="158" height="26" rx="7" fill="#07101e"/>
  <rect x="346" y="330" width="158" height="12" fill="#07101e"/>
  <text x="358" y="333" font-family="system-ui,sans-serif" font-size="10" font-weight="700" fill="#3b82f6" letter-spacing="0.5">BYTES OUT</text>

  <!-- Total -->
  <text x="358" y="358" font-family="'SF Mono','Fira Code',monospace" font-size="18" font-weight="700" fill="#3b82f6">1.1</text>
  <text x="390" y="358" font-family="system-ui,sans-serif" font-size="11" fill="#a8b8cc">KB total</text>

  <!-- Rate -->
  <text x="358" y="378" font-family="system-ui,sans-serif" font-size="9" fill="#a8b8cc">current rate</text>
  <text x="358" y="395" font-family="'SF Mono','Fira Code',monospace" font-size="16" font-weight="600" fill="#3b82f6">112</text>
  <text x="392" y="395" font-family="system-ui,sans-serif" font-size="10" fill="#a8b8cc">B/s</text>

  <!-- Mini rate bars -->
  <rect x="358" y="404" width="120" height="3" rx="1.5" fill="#3b4a60"/>
  <rect x="358" y="404" width="34" height="3" rx="1.5" fill="#3b82f6" opacity="0.7"/>

  <text x="358" y="450" font-family="system-ui,sans-serif" font-size="8.5" fill="#3b4a60">outbound traffic this session</text>

  <!-- ═══ CARD 4: Frame Types ═══ -->
  <rect x="514" y="316" width="176" height="138" rx="7" fill="#0a1520" stroke="#8b5cf6" stroke-width="1.2"/>
  <rect x="514" y="316" width="176" height="26" rx="7" fill="#110a2a"/>
  <rect x="514" y="330" width="176" height="12" fill="#110a2a"/>
  <text x="526" y="333" font-family="system-ui,sans-serif" font-size="10" font-weight="700" fill="#8b5cf6" letter-spacing="0.5">FRAME TYPES</text>

  <!-- Segmented progress bar -->
  <rect x="526" y="346" width="152" height="18" rx="4" fill="#1e293b"/>
  <!-- text 80% -->
  <rect x="526" y="346" width="122" height="18" rx="4" fill="#8b5cf6" opacity="0.85"/>
  <!-- bin 20% -->
  <rect x="648" y="346" width="30" height="18" rx="0" fill="#06b6d4" opacity="0.7"/>
  <rect x="645" y="346" width="33" height="18" rx="0"/>
  <rect x="645" y="346" width="35" height="18" rx="4" fill="#06b6d4" opacity="0.7"/>

  <!-- Legend -->
  <rect x="526" y="374" width="10" height="10" rx="2" fill="#8b5cf6"/>
  <text x="540" y="383" font-family="system-ui,sans-serif" font-size="10" fill="#f1f5f9">text</text>
  <text x="568" y="383" font-family="'SF Mono','Fira Code',monospace" font-size="11" font-weight="700" fill="#8b5cf6">80%</text>

  <rect x="526" y="394" width="10" height="10" rx="2" fill="#06b6d4"/>
  <text x="540" y="403" font-family="system-ui,sans-serif" font-size="10" fill="#f1f5f9">binary</text>
  <text x="578" y="403" font-family="'SF Mono','Fira Code',monospace" font-size="11" font-weight="700" fill="#06b6d4">20%</text>

  <!-- Total frames -->
  <text x="526" y="424" font-family="system-ui,sans-serif" font-size="9" fill="#a8b8cc">total frames received:</text>
  <text x="651" y="424" font-family="'SF Mono','Fira Code',monospace" font-size="11" font-weight="700" fill="#8b5cf6">5</text>

  <text x="526" y="450" font-family="system-ui,sans-serif" font-size="8.5" fill="#3b4a60">frame composition this session</text>
</svg>`,
  },

  steps: [
    // ── 1. Connect ────────────────────────────────────────
    {
      id: 'rel-connect',
      title: 'Connect to the Mock Server',
      description:
        'The Connect panel is ready with this tab\'s mock server URL (`ws://localhost:9876`). ' +
        'Click **Connect** and watch the status bar turn green with a latency measurement and uptime counter.',
      highlight: WS.CONNECT_BTN,
      pauseAfter: true,
      preAction: async (ctx: DemoActionContext) => {
        // Guard only — URL/panel already prepared in setup (or recover after rapid Next).
        await prepareConnectPanelQuiet(ctx);
      },
      action: async (ctx: DemoActionContext) => {
        // Reading ring is already on Connect — one visible beat, no URL/tab thrash.
        await ctx.delay(200);
        if (!firstVisibleElement(WS.STATUS_CONNECTED)) {
          await ctx.click(WS.CONNECT_BTN);
          await ctx.waitFor(WS.STATUS_CONNECTED, 5000);
        }
        await ctx.delay(400);
        await ctx.click(WS.RIGHT_TAB_EVENTS);
        await ctx.delay(300);
      },
      verify: WS.STATUS_CONNECTED,
    },

    // ── 2. Stats Tab ──────────────────────────────────────
    {
      id: 'rel-stats-tab',
      title: 'The Stats Tab',
      description:
        'The **Stats** tab in the right panel shows live connection metrics: **Msg/s** with a sparkline chart, **Bytes In** and **Bytes Out** with per-second rates, and a **Frame Types** bar showing the mix of text, binary, and control frames. Right now the per-second rates are at zero — we haven\'t sent any messages yet.',
      highlight: WS.RIGHT_TAB_STATS,
      pauseAfter: true,
      preAction: async (ctx: DemoActionContext) => {
        await ctx.click(WS.RIGHT_TAB_STATS);
        await ctx.delay(150);
      },
      action: async (ctx: DemoActionContext) => {
        await ctx.delay(400);
      },
    },

    // ── 3. Live Sparkline ─────────────────────────────────
    {
      id: 'rel-stats-live',
      title: 'Live Metrics & Sparkline',
      description:
        'The demo sends a burst of five messages — watch the **Msg/s** sparkline jump as the echo server bounces them back. The bytes counters climb and the frame types bar fills in. Every second the sparkline updates, plotting throughput over the last 60 seconds.',
      highlight: WS.STATS_MSG_RATE,
      pauseAfter: true,
      preAction: async (ctx: DemoActionContext) => {
        // Guard: must be connected to show the spike; reconnect silently if needed.
        if (!firstVisibleElement(WS.STATUS_CONNECTED)) {
          await connectToMockServer(ctx);
        }
        // Switch to Send, send a burst, then back to Stats
        await ctx.click(WS.LEFT_TAB_SEND);
        await ctx.delay(100);
        await ctx.fill(WS.MESSAGE_INPUT, '{"ping":1}');
        await ctx.delay(100);
      },
      action: async (ctx: DemoActionContext) => {
        // Send 5 messages — re-fill each time because Send clears the input
        for (let i = 0; i < 5; i++) {
          await ctx.fill(WS.MESSAGE_INPUT, `{"ping":${i + 1}}`);
          await ctx.delay(100);
          await ctx.click(WS.SEND_BTN);
          await ctx.delay(180);
        }
        await ctx.delay(300);
        // Switch to Stats to observe the spike
        await ctx.click(WS.RIGHT_TAB_STATS);
        await ctx.delay(800);
      },
    },

    // ── 4. Auto-Reconnect Settings ────────────────────────
    {
      id: 'rel-reconnect-settings',
      title: 'Auto-Reconnect Settings',
      description:
        'Auto-reconnect can only be changed while **disconnected** — the Connect panel locks these controls while a session is active. ' +
        'This step disconnects first, then enables **Enable auto-reconnect**. ' +
        'That turns on automatic retries when a connection drops unexpectedly (close code ≠ 1000). ' +
        'Configure **Max Attempts** (default 5), **Retry Interval** (default 3000ms), and **Backoff** (1×, 1.5×, or 2×). ' +
        'These settings are saved with connection profiles.',
      highlight: WS.RECONNECT_SETTINGS,
      pauseAfter: true,
      preAction: async (ctx: DemoActionContext) => {
        // Toggle is locked while connected — must fully disconnect before reading/action.
        await ctx.click(WS.LEFT_TAB_CONNECT);
        await ctx.delay(100);
        if (firstVisibleElement(WS.STATUS_CONNECTED)) {
          await disconnectWebSocket(ctx);
          await ctx.waitFor(WS.STATUS_DISCONNECTED, 5000);
        }
        await ctx.delay(100);
      },
      action: async (ctx: DemoActionContext) => {
        const spotPause = async (selector: string, holdMs: number) => {
          const el = firstVisibleElement<HTMLElement>(selector);
          if (!el) { await ctx.delay(holdMs); return; }
          const dispose = showSpotlightRing(el);
          await ctx.delay(holdMs);
          dispose();
        };
        // Belt: still connected → disconnect again before enabling
        if (firstVisibleElement(WS.STATUS_CONNECTED)) {
          await disconnectWebSocket(ctx);
          await ctx.waitFor(WS.STATUS_DISCONNECTED, 5000);
          await ctx.delay(200);
        }
        firstVisibleElement(WS.RECONNECT_SETTINGS)
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await ctx.delay(300);
        // Visible enable — this is the payoff of the step
        await spotPause(WS.RECONNECT_TOGGLE, 1400);
        const toggle = firstVisibleElement<HTMLInputElement>(WS.RECONNECT_TOGGLE);
        if (toggle && !toggle.checked && !toggle.disabled) {
          await ctx.click(WS.RECONNECT_TOGGLE);
          await ctx.delay(500);
        } else if (toggle && !toggle.checked) {
          // Last resort: force enable via native click after another disconnect
          await disconnectWebSocket(ctx);
          await ctx.waitFor(WS.STATUS_DISCONNECTED, 5000);
          await ctx.delay(100);
          const unlocked = firstVisibleElement<HTMLInputElement>(WS.RECONNECT_TOGGLE);
          if (unlocked && !unlocked.disabled) {
            await ctx.click(WS.RECONNECT_TOGGLE);
            await ctx.delay(500);
          }
        }
        await spotPause(WS.RECONNECT_MAX, 1200);
        await spotPause(WS.RECONNECT_INTERVAL, 1200);
        await spotPause(WS.RECONNECT_BACKOFF, 1200);
        // Leave toggle enabled; step 5 turns it off before close-with-code
      },
      verify: WS.RECONNECT_TOGGLE,
    },

    // ── 5. Close with Code ────────────────────────────────
    {
      id: 'rel-close-code',
      title: 'Close with Code / Reason',
      description:
        'The **▾ caret** next to the Disconnect button opens the close-with-code panel. Choose a preset close code (1000 Normal, 1001 Going Away, 1008 Policy Violation, etc.), add an optional reason string, and click **Close with Code**. The demo sends close code **1001** with reason "Demo lesson complete" — this tells the server the client is intentionally going away.',
      highlight: WS.DISCONNECT_CARET,
      pauseAfter: true,
      preAction: async (ctx: DemoActionContext) => {
        await ctx.click(WS.LEFT_TAB_CONNECT);
        await ctx.delay(100);
        // Turn off auto-reconnect while disconnected (locked when connected).
        if (firstVisibleElement(WS.STATUS_CONNECTED)) {
          await disconnectWebSocket(ctx);
          await ctx.waitFor(WS.STATUS_DISCONNECTED, 5000);
        }
        const toggle = firstVisibleElement<HTMLInputElement>(WS.RECONNECT_TOGGLE);
        if (toggle?.checked && !toggle.disabled) {
          toggle.click();
          await ctx.delay(100);
        }
        // Caret needs an active session
        if (!firstVisibleElement(WS.STATUS_CONNECTED)) {
          await connectToMockServer(ctx);
        }
        await ctx.delay(200);
      },
      action: async (ctx: DemoActionContext) => {
        // Open the close-with-code dropdown
        await ctx.click(WS.DISCONNECT_CARET);
        // Rule 5: the close panel is conditionally rendered — wait for it to appear.
        await ctx.waitFor(WS.CLOSE_CODE_INPUT);
        await ctx.delay(200);
        // Fill close code and reason
        await ctx.fill(WS.CLOSE_CODE_INPUT, '1001');
        await ctx.delay(300);
        await ctx.fill(WS.CLOSE_REASON_INPUT, 'Demo lesson complete');
        await ctx.delay(300);
        // Send the close frame
        await ctx.click(WS.CLOSE_WITH_CODE_BTN);
        await ctx.delay(600);
      },
    },

    // ── 6. Stats After Disconnect ─────────────────────────
    {
      id: 'rel-stats-zero',
      title: 'Stats After Disconnect',
      description:
        'After disconnecting, the Stats tab shows what happened: per-second rates drop to **zero**, the sparkline flatlines, and bytes/frame totals freeze at their final values. This gives you a clear before-and-after picture of when the connection was lost.',
      highlight: WS.RIGHT_TAB_STATS,
      pauseAfter: true,
      preAction: async (ctx: DemoActionContext) => {
        // Guard: must be disconnected so rates show zero flatline; disconnect silently if still active.
        await disconnectWebSocket(ctx);
      },
      action: async (ctx: DemoActionContext) => {
        await ctx.click(WS.RIGHT_TAB_STATS);
        await ctx.delay(600);
      },
    },

    // ── 7. URL History ────────────────────────────────────
    {
      id: 'rel-history',
      title: 'URL History',
      description:
        'Back on the Connect tab, the URL field has a **history dropdown** (▾) showing recently connected URLs. After connecting to this tab\'s mock server, it appears in the list with its protocol badge. Click any history entry to instantly fill the URL field — great for reconnecting to servers you use frequently.',
      highlight: WS.URL_HISTORY_TRIGGER,
      pauseAfter: true,
      preAction: async (ctx: DemoActionContext) => {
        await ctx.click(WS.LEFT_TAB_CONNECT);
        await ctx.delay(150);
      },
      action: async (ctx: DemoActionContext) => {
        await ctx.click(WS.URL_HISTORY_TRIGGER);
        await ctx.delay(900);
        await ctx.click(WS.URL_HISTORY_TRIGGER);
        await ctx.delay(300);
      },
    },
  ],
};
