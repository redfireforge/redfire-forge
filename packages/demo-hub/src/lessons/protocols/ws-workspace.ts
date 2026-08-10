/**
 * Lesson 14: Workspace — Profiles, Templates & Env Vars
 *
 * Demonstrates the three "remember my work" features that make
 * RedfireForge a daily driver:
 *  - Saved connection profiles (save, load, manage)
 *  - Message templates (save & reuse payloads)
 *  - Environment variable interpolation in URLs
 *
 * No Docker required — uses the built-in mock server.
 */
import type { DemoActionContext, DemoLesson } from '../../types';
import { EM, WS, APP } from '@shared/selectors';
import {
  closeExtraConnectionTabs,
  disconnectWebSocket,
  clearEvents,
  firstVisibleEl,
  getLastMockPort,
  startMockServerQuiet,
  stopMockServerQuiet,
  switchToClientModeQuiet,
} from '../setup-helpers';
import { firstVisibleElement, visibleElements } from '../../utils/domVisibility';
import { showSpotlightRing } from '../../demoRipple';
import { clearWsProfilesQuiet, clearWsTemplatesQuiet } from '../../adapters';
import {
  cleanupDemoEnvironment,
  cleanupDemoMicroservice,
  ensureWsDemoEndpointConfigured,
  ensureWsDemoHeaderContext,
  navigateToWebSocketStudio,
  WS_DEMO_ENV_NAME,
  WS_DEMO_SVC_NAME,
} from '../env-manager-lesson-helpers';

// ── Constants ──────────────────────────────────────
const DEMO_PROFILE_NAME = 'Demo Echo Server';
const DEMO_TEMPLATE_NAME = 'greeting';
const DEMO_TEMPLATE_BODY = '{"action":"greet","name":"RedfireForge"}';
const RESOLVED_WS_URL = '{{wsBaseUrl}}/ws';
const UNRESOLVED_URL = '{{unknownHost}}/ws';

/** Spotlight a field so the viewer can read the change. */
async function spotlightAndPause(
  ctx: DemoActionContext,
  selector: string,
  holdMs: number,
): Promise<void> {
  const el = firstVisibleElement<HTMLElement>(selector);
  if (!el) {
    await ctx.delay(holdMs);
    return;
  }
  el.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
  const dispose = showSpotlightRing(el);
  try {
    await ctx.delay(holdMs);
  } finally {
    dispose();
  }
}

async function ensureClientConnect(ctx: DemoActionContext): Promise<void> {
  await ctx.click(WS.MODE_CLIENT);
  await ctx.delay(200);
  await ctx.click(WS.LEFT_TAB_CONNECT);
  await ctx.delay(200);
}

async function ensureMockUrlFilled(ctx: DemoActionContext): Promise<void> {
  await ensureClientConnect(ctx);
  await ctx.fill(WS.URL_INPUT, `ws://localhost:${getLastMockPort()}`);
  await ctx.delay(100);
}

async function closeTemplateModalIfOpen(ctx: DemoActionContext): Promise<void> {
  if (!firstVisibleElement(WS.TEMPLATE_DROPDOWN)) return;
  const trigger = firstVisibleElement<HTMLElement>(WS.TEMPLATE_TRIGGER);
  trigger?.click();
  await ctx.delay(200);
}

// ── Setup / Cleanup ─────────────────────────────────────────────

/**
 * Quiet setup — REST mock + clear profiles/templates via bridge.
 * Must not switch Mock/Saved/Send during setup: Live view is already visible
 * and those tours flash step 1 for the viewer.
 */
async function workspaceSetup(ctx: DemoActionContext): Promise<void> {
  const disconnectBtn = firstVisibleEl<HTMLButtonElement>(WS.DISCONNECT_BTN);
  if (disconnectBtn && !disconnectBtn.disabled) {
    disconnectBtn.click();
    await ctx.delay(40);
  }
  await closeExtraConnectionTabs(ctx);
  await startMockServerQuiet(ctx, 9876);
  await clearWsProfilesQuiet();
  await clearWsTemplatesQuiet();
  await switchToClientModeQuiet(ctx);
  const connectTab = firstVisibleEl<HTMLElement>(WS.LEFT_TAB_CONNECT);
  if (connectTab?.getAttribute('aria-selected') !== 'true') {
    connectTab?.click();
    await ctx.delay(60);
  }
  // Always start on Events tab so persisted Stats/Console/etc. doesn't bleed in
  const eventsTab = firstVisibleEl<HTMLElement>(WS.RIGHT_TAB_EVENTS);
  if (eventsTab?.getAttribute('aria-selected') !== 'true') {
    eventsTab?.click();
    await ctx.delay(40);
  }
}

async function workspaceCleanup(ctx: DemoActionContext): Promise<void> {
  await clearWsProfilesQuiet();
  await clearWsTemplatesQuiet();
  await cleanupDemoMicroservice(ctx, WS_DEMO_SVC_NAME);
  await cleanupDemoEnvironment(ctx, WS_DEMO_ENV_NAME);
  await disconnectWebSocket(ctx);
  await clearEvents(ctx);
  await stopMockServerQuiet(ctx, 9876);
  await switchToClientModeQuiet(ctx);
}

// ── Lesson ──────────────────────────────────────────────────────

export const wsWorkspaceLesson: DemoLesson = {
  id: 'ws-workspace',
  domainId: 'protocols',
  category: 'websocket',
  name: 'Profiles, Templates & Env Vars',
  description: 'Save a connection profile, reuse message templates, then resolve {{wsBaseUrl}} from Environment Manager.',
  estimatedMinutes: 5,
  initialTab: 'websocket-studio',
  allowedTabs: ['environments', 'websocket-studio'],

  setup: workspaceSetup,
  cleanup: workspaceCleanup,

  concept: {
    title: 'Workspace: Your Saved Work',
    body: `This lesson teaches three "remember my work" features **in the order you'll use them**:

1. **Connection profiles** — save the Connect form, then reload it from **Saved**
2. **Message templates** — save a JSON body from **Send → Templates**, then load it back
3. **Environment variables** — configure \`{{wsBaseUrl}}\` in Environment Manager and resolve it in the URL field

**Profiles** live under **Saved** (or **Save as Profile** on Connect). **Templates** live in the Send panel modal. **Env vars** resolve from the selected Environment × Service — with a live **→ Resolved:** preview (✓ / ⚠ / ✗) before you click Connect.

| Feature | Where | What it stores |
|---|---|---|
| Profiles | **Saved** / **Save as Profile** | URL + auth + headers + params |
| Templates | **Send → Templates** | Message body text |
| Env Vars | \`{{varName}}\` + Environment Manager | Values resolved at connect time |`,
    keyTerms: [
      {
        term: 'Connection Profile',
        definition: 'A named snapshot of URL, auth config, headers, and query params. Saved to localStorage and available across sessions.',
      },
      {
        term: 'Message Template',
        definition: 'A named, reusable message body stored in the **Send** panel. Templates persist across sessions and can be loaded with one click.',
      },
      {
        term: 'Environment Variable',
        definition: 'A {{varName}} placeholder in URL, headers, or params. Resolved at connection time from the selected environment\'s key-value map.',
      },
      {
        term: 'Save as Profile',
        definition: 'Button in the Connect panel that captures the current connection config and opens the profile editor modal.',
      },
    ],
    diagram: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 430" style="display:block;width:100%;height:auto;font-family:'SF Mono','Fira Code','Consolas',monospace">
  <defs>
    <marker id="ww-arr-blue" markerWidth="7" markerHeight="7" refX="4" refY="3.5" orient="auto">
      <path d="M1,1 L6,3.5 L1,6 Z" fill="#3b82f6"/>
    </marker>
    <marker id="ww-arr-amber" markerWidth="7" markerHeight="7" refX="4" refY="3.5" orient="auto">
      <path d="M1,1 L6,3.5 L1,6 Z" fill="#f59e0b"/>
    </marker>
    <marker id="ww-arr-violet" markerWidth="7" markerHeight="7" refX="4" refY="3.5" orient="auto">
      <path d="M1,1 L6,3.5 L1,6 Z" fill="#8b5cf6"/>
    </marker>
    <linearGradient id="ww-tab-active" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#2d3a4d"/>
      <stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>
    <filter id="ww-shadow" x="-5%" y="-5%" width="110%" height="110%">
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000" flood-opacity="0.4"/>
    </filter>
  </defs>

  <!-- ═══════════════════════════════════════════
       STUDIO FRAME
  ═══════════════════════════════════════════ -->
  <rect x="1" y="1" width="698" height="242" rx="8" fill="#0d1520" stroke="#3b4a60" stroke-width="1.5" filter="url(#ww-shadow)"/>

  <!-- title bar chrome -->
  <rect x="1" y="1" width="698" height="30" rx="8" fill="#0a1118"/>
  <rect x="1" y="20" width="698" height="11" fill="#0a1118"/>
  <!-- traffic lights -->
  <circle cx="18" cy="15" r="4.5" fill="#ef4444" opacity="0.8"/>
  <circle cx="34" cy="15" r="4.5" fill="#f59e0b" opacity="0.8"/>
  <circle cx="50" cy="15" r="4.5" fill="#22c55e" opacity="0.8"/>
  <!-- window title -->
  <text x="350" y="19" text-anchor="middle" font-family="system-ui,sans-serif" font-size="11" fill="#a8b8cc">WebSocket Studio — RedfireForge</text>

  <!-- mode tab bar -->
  <rect x="1" y="31" width="698" height="32" fill="#0f172a"/>

  <!-- Client tab (active) -->
  <rect x="8" y="34" width="70" height="26" rx="5" fill="url(#ww-tab-active)" stroke="#3b4a60" stroke-width="1"/>
  <rect x="8" y="55" width="70" height="5" fill="#1e293b"/>
  <rect x="8" y="54" width="70" height="2" fill="#3b82f6"/>
  <text x="43" y="51" text-anchor="middle" font-family="system-ui,sans-serif" font-size="11" font-weight="600" fill="#f1f5f9">Client</text>

  <!-- Mock Server tab -->
  <rect x="84" y="36" width="94" height="22" rx="4" fill="none"/>
  <text x="131" y="51" text-anchor="middle" font-family="system-ui,sans-serif" font-size="11" fill="#a8b8cc">Mock Server</text>

  <!-- Saved tab -->
  <rect x="184" y="36" width="114" height="22" rx="4" fill="none"/>
  <text x="241" y="51" text-anchor="middle" font-family="system-ui,sans-serif" font-size="11" fill="#a8b8cc">Saved (profiles)</text>

  <!-- mode tabs label -->
  <text x="310" y="51" font-family="system-ui,sans-serif" font-size="10" fill="#3b82f6" opacity="0.85">← mode tabs</text>

  <!-- ═══════════════════════════════════════════
       CONNECT PANEL (left half, y 63-152)
  ═══════════════════════════════════════════ -->
  <rect x="1" y="63" width="349" height="179" fill="#0d1520"/>
  <rect x="349" y="63" width="1" height="179" fill="#3b4a60"/>

  <!-- Sub-tab: Connect -->
  <rect x="8" y="68" width="66" height="22" rx="3" fill="#1e293b" stroke="#3b4a60" stroke-width="1"/>
  <text x="41" y="83" text-anchor="middle" font-family="system-ui,sans-serif" font-size="10" font-weight="600" fill="#f1f5f9">Connect</text>

  <!-- URL label -->
  <text x="16" y="108" font-family="system-ui,sans-serif" font-size="9.5" fill="#a8b8cc">URL</text>

  <!-- URL input -->
  <rect x="36" y="97" width="300" height="24" rx="4" fill="#0f172a" stroke="#3b82f6" stroke-width="1.2"/>
  <text x="46" y="113" font-family="'SF Mono','Fira Code',monospace" font-size="11" fill="#c084fc">{{</text>
  <text x="63" y="113" font-family="'SF Mono','Fira Code',monospace" font-size="11" fill="#f59e0b">wsBaseUrl</text>
  <text x="118" y="113" font-family="'SF Mono','Fira Code',monospace" font-size="11" fill="#c084fc">}}</text>
  <text x="131" y="113" font-family="'SF Mono','Fira Code',monospace" font-size="11" fill="#f1f5f9">/ws</text>

  <!-- Resolved URL preview -->
  <text x="36" y="133" font-family="system-ui,sans-serif" font-size="9.5" fill="#a8b8cc">↳ Resolved:</text>
  <text x="104" y="133" font-family="'SF Mono','Fira Code',monospace" font-size="9.5" fill="#22c55e">ws://localhost:9876/ws</text>
  <text x="280" y="133" font-family="system-ui,sans-serif" font-size="11" fill="#22c55e">✓</text>

  <!-- Connect button -->
  <rect x="36" y="145" width="72" height="24" rx="4" fill="#3b82f6"/>
  <text x="72" y="161" text-anchor="middle" font-family="system-ui,sans-serif" font-size="11" font-weight="600" fill="#fff">Connect</text>

  <!-- Save as Profile button (blue-outlined = key action) -->
  <rect x="116" y="145" width="116" height="24" rx="4" fill="#1e293b" stroke="#3b82f6" stroke-width="1.2"/>
  <text x="174" y="161" text-anchor="middle" font-family="system-ui,sans-serif" font-size="10.5" font-weight="500" fill="#3b82f6">Save as Profile</text>

  <!-- Right panel: events/console dimmed label -->
  <text x="524" y="95" text-anchor="middle" font-family="system-ui,sans-serif" font-size="10" fill="#3b4a60">Events / Console / Stats</text>
  <text x="524" y="110" text-anchor="middle" font-family="system-ui,sans-serif" font-size="10" fill="#3b4a60">/ Load Test…</text>

  <!-- ═══════════════════════════════════════════
       SEND PANEL (left half, y 152-242)
  ═══════════════════════════════════════════ -->
  <rect x="1" y="180" width="349" height="62" fill="#0d1520"/>
  <line x1="1" y1="180" x2="698" y2="180" stroke="#3b4a60" stroke-width="1"/>

  <!-- Sub-tab: Send -->
  <rect x="8" y="185" width="66" height="22" rx="3" fill="#1e293b" stroke="#3b4a60" stroke-width="1"/>
  <text x="41" y="200" text-anchor="middle" font-family="system-ui,sans-serif" font-size="10" font-weight="600" fill="#f1f5f9">Send</text>

  <!-- Templates dropdown -->
  <rect x="84" y="185" width="100" height="22" rx="4" fill="#1e293b" stroke="#f59e0b" stroke-width="1.2"/>
  <text x="134" y="200" text-anchor="middle" font-family="system-ui,sans-serif" font-size="10.5" font-weight="500" fill="#f59e0b">Templates ▾</text>

  <!-- Compose textarea -->
  <rect x="84" y="213" width="260" height="22" rx="3" fill="#0f172a" stroke="#3b4a60" stroke-width="1"/>
  <text x="94" y="228" font-family="'SF Mono','Fira Code',monospace" font-size="9.5" fill="#94a3b8">{"action":"greet","name":"RedfireForge"}</text>

  <!-- Send button -->
  <rect x="350" y="185" width="349" height="57" fill="#0d1520"/>
  <rect x="36" y="241" width="68" height="0" rx="4" fill="none"/>

  <!-- ═══════════════════════════════════════════
       CONNECTING ARROWS  (studio → stores)
  ═══════════════════════════════════════════ -->
  <!-- Blue: Save as Profile → Profile Store -->
  <path d="M174,169 L174,252 L105,252 L105,284" stroke="#3b82f6" stroke-width="1.5" fill="none" stroke-dasharray="5,3" stroke-opacity="0.7" marker-end="url(#ww-arr-blue)"/>

  <!-- Amber: Templates → Template Store -->
  <path d="M134,207 L134,260 L350,260 L350,284" stroke="#f59e0b" stroke-width="1.5" fill="none" stroke-dasharray="5,3" stroke-opacity="0.7" marker-end="url(#ww-arr-amber)"/>

  <!-- Violet: {{wsBaseUrl}} → Env Map -->
  <path d="M91,108 Q91,268 595,268 L595,284" stroke="#8b5cf6" stroke-width="1.5" fill="none" stroke-dasharray="5,3" stroke-opacity="0.7" marker-end="url(#ww-arr-violet)"/>

  <!-- ═══════════════════════════════════════════
       PROFILE STORE CARD
  ═══════════════════════════════════════════ -->
  <rect x="10" y="285" width="190" height="132" rx="7" fill="#111b28" stroke="#3b82f6" stroke-width="1.5" filter="url(#ww-shadow)"/>
  <!-- card header -->
  <rect x="10" y="285" width="190" height="30" rx="7" fill="#1a2e4a"/>
  <rect x="10" y="300" width="190" height="15" fill="#1a2e4a"/>
  <circle cx="27" cy="300" r="5" fill="#3b82f6" opacity="0.8"/>
  <text x="40" y="304" font-family="system-ui,sans-serif" font-size="10" font-weight="700" fill="#3b82f6" letter-spacing="0.5">PROFILE STORE</text>
  <!-- card body -->
  <text x="105" y="330" text-anchor="middle" font-family="system-ui,sans-serif" font-size="11" font-weight="600" fill="#f1f5f9">Demo Echo Server</text>
  <text x="105" y="347" text-anchor="middle" font-family="'SF Mono','Fira Code',monospace" font-size="9.5" fill="#94a3b8">ws://localhost:9876</text>
  <text x="105" y="362" text-anchor="middle" font-family="system-ui,sans-serif" font-size="9" fill="#3b4a60">url · auth · headers · params</text>
  <!-- Load & Connect btn -->
  <rect x="28" y="372" width="154" height="22" rx="4" fill="#3b82f6"/>
  <text x="105" y="387" text-anchor="middle" font-family="system-ui,sans-serif" font-size="10.5" font-weight="600" fill="#fff">Load &amp; Connect</text>
  <text x="105" y="410" text-anchor="middle" font-family="system-ui,sans-serif" font-size="8.5" fill="#3b4a60">persists across sessions</text>

  <!-- ═══════════════════════════════════════════
       TEMPLATE STORE CARD
  ═══════════════════════════════════════════ -->
  <rect x="255" y="285" width="190" height="132" rx="7" fill="#111b28" stroke="#f59e0b" stroke-width="1.5" filter="url(#ww-shadow)"/>
  <!-- card header -->
  <rect x="255" y="285" width="190" height="30" rx="7" fill="#2a1f0a"/>
  <rect x="255" y="300" width="190" height="15" fill="#2a1f0a"/>
  <circle cx="272" cy="300" r="5" fill="#f59e0b" opacity="0.8"/>
  <text x="285" y="304" font-family="system-ui,sans-serif" font-size="10" font-weight="700" fill="#f59e0b" letter-spacing="0.5">TEMPLATE STORE</text>
  <!-- card body -->
  <text x="350" y="330" text-anchor="middle" font-family="system-ui,sans-serif" font-size="11" font-weight="600" fill="#f1f5f9">greeting</text>
  <text x="350" y="346" text-anchor="middle" font-family="'SF Mono','Fira Code',monospace" font-size="9" fill="#94a3b8">{"action":"greet",</text>
  <text x="350" y="360" text-anchor="middle" font-family="'SF Mono','Fira Code',monospace" font-size="9" fill="#94a3b8"> "name":"RedfireForge"}</text>
  <!-- Load / Delete btns -->
  <rect x="272" y="372" width="72" height="22" rx="4" fill="#1e293b" stroke="#f59e0b" stroke-width="1"/>
  <text x="308" y="387" text-anchor="middle" font-family="system-ui,sans-serif" font-size="10.5" fill="#f59e0b">Load</text>
  <rect x="352" y="372" width="72" height="22" rx="4" fill="#1e293b" stroke="#3b4a60" stroke-width="1"/>
  <text x="388" y="387" text-anchor="middle" font-family="system-ui,sans-serif" font-size="10.5" fill="#a8b8cc">Delete</text>
  <text x="350" y="410" text-anchor="middle" font-family="system-ui,sans-serif" font-size="8.5" fill="#3b4a60">message body text</text>

  <!-- ═══════════════════════════════════════════
       ENV MAP CARD
  ═══════════════════════════════════════════ -->
  <rect x="500" y="285" width="190" height="132" rx="7" fill="#111b28" stroke="#8b5cf6" stroke-width="1.5" filter="url(#ww-shadow)"/>
  <!-- card header -->
  <rect x="500" y="285" width="190" height="30" rx="7" fill="#1a1030"/>
  <rect x="500" y="300" width="190" height="15" fill="#1a1030"/>
  <circle cx="517" cy="300" r="5" fill="#8b5cf6" opacity="0.8"/>
  <text x="530" y="304" font-family="system-ui,sans-serif" font-size="10" font-weight="700" fill="#8b5cf6" letter-spacing="0.5">ENV MAP</text>
  <!-- key-value rows -->
  <rect x="514" y="316" width="168" height="18" rx="3" fill="#0f172a" stroke="#3b4a60" stroke-width="0.5"/>
  <text x="520" y="329" font-family="'SF Mono','Fira Code',monospace" font-size="9" fill="#c084fc">wsBaseUrl</text>
  <text x="586" y="329" font-family="system-ui,sans-serif" font-size="9" fill="#a8b8cc">→</text>
  <text x="596" y="329" font-family="'SF Mono','Fira Code',monospace" font-size="9" fill="#22c55e">localhost:9876</text>

  <rect x="514" y="338" width="168" height="18" rx="3" fill="#0f172a" stroke="#3b4a60" stroke-width="0.5"/>
  <text x="520" y="351" font-family="'SF Mono','Fira Code',monospace" font-size="9" fill="#c084fc">host</text>
  <text x="586" y="351" font-family="system-ui,sans-serif" font-size="9" fill="#a8b8cc">→</text>
  <text x="596" y="351" font-family="'SF Mono','Fira Code',monospace" font-size="9" fill="#22c55e">localhost</text>

  <rect x="514" y="360" width="168" height="18" rx="3" fill="#0f172a" stroke="#3b4a60" stroke-width="0.5"/>
  <text x="520" y="373" font-family="'SF Mono','Fira Code',monospace" font-size="9" fill="#c084fc">envName</text>
  <text x="586" y="373" font-family="system-ui,sans-serif" font-size="9" fill="#a8b8cc">→</text>
  <text x="596" y="373" font-family="'SF Mono','Fira Code',monospace" font-size="9" fill="#22c55e">local</text>

  <text x="595" y="410" text-anchor="middle" font-family="system-ui,sans-serif" font-size="8.5" fill="#3b4a60">resolved at connect time</text>
</svg>`,
  },

  steps: [
    // ── Act I: Connection Profiles ─────────────────────────────
    {
      id: 'ws-url-ready',
      title: 'Start with a Connection URL',
      description:
        'Open **Client → Connect** and set the URL to this tab\'s mock server ' +
        '(`ws://localhost:9876` in a fresh session). Everything we save next — profiles and env vars — builds on a real address you can reload later.',
      highlight: WS.URL_INPUT,
      pauseAfter: true,
      preAction: async (ctx: DemoActionContext) => {
        await ensureClientConnect(ctx);
      },
      action: async (ctx: DemoActionContext) => {
        await ctx.waitFor(WS.URL_INPUT);
        await ctx.delay(400);
        await ctx.fill(WS.URL_INPUT, `ws://localhost:${getLastMockPort()}`);
        await spotlightAndPause(ctx, WS.URL_INPUT, 1200);
      },
    },
    {
      id: 'ws-profile-save',
      title: 'Save as Profile',
      description:
        'Click **Save as Profile** under the URL field. Name it **Demo Echo Server** and save. ' +
        'RedfireForge stores URL, auth, headers, and params as a named snapshot you can reload anytime.',
      highlight: WS.SAVE_AS_PROFILE_BTN,
      pauseAfter: true,
      preAction: async (ctx: DemoActionContext) => {
        await ensureMockUrlFilled(ctx);
      },
      action: async (ctx: DemoActionContext) => {
        await spotlightAndPause(ctx, WS.SAVE_AS_PROFILE_BTN, 900);
        await ctx.click(WS.SAVE_AS_PROFILE_BTN);
        await ctx.waitFor(WS.PROFILE_NAME_INPUT);
        // Spotlight the whole modal so the viewer can read the pre-filled fields
        await spotlightAndPause(ctx, WS.PROFILE_EDITOR_MODAL, 1400);
        await ctx.fill(WS.PROFILE_NAME_INPUT, DEMO_PROFILE_NAME);
        // Hold on the filled name so the viewer sees what was typed
        await spotlightAndPause(ctx, WS.PROFILE_NAME_INPUT, 1400);
        // Spotlight the URL field so the viewer sees it was captured too
        await spotlightAndPause(ctx, WS.PROFILE_URL_INPUT, 1200);
        await spotlightAndPause(ctx, WS.PROFILE_SAVE_BTN, 900);
        await ctx.click(WS.PROFILE_SAVE_BTN);
        await ctx.delay(800);
      },
    },
    {
      id: 'ws-profile-browse',
      title: 'Browse Saved Profiles',
      description:
        'Open the **Saved** mode tab. Your **Demo Echo Server** profile appears in the rail — a searchable library of connection configs. ' +
        'Select the card to open the detail pane (URL, badges, actions).',
      highlight: WS.MODE_SAVED,
      pauseAfter: true,
      preAction: async () => {
        visibleElements('.ws-saved-rail-item.selected, .ws-saved-card.selected').forEach((el) => {
          el.classList.remove('selected');
        });
      },
      action: async (ctx: DemoActionContext) => {
        await spotlightAndPause(ctx, WS.MODE_SAVED, 800);
        await ctx.click(WS.MODE_SAVED);
        await ctx.delay(700);
        const card = firstVisibleElement<HTMLElement>('[data-testid^="profile-card-"]');
        if (!card) return;
        const id = card.getAttribute('data-testid')!.replace('profile-card-', '');
        await ctx.click(`[data-testid="profile-card-${id}"]`);
        await spotlightAndPause(ctx, `[data-testid="profile-card-${id}"]`, 1000);
      },
    },
    {
      id: 'ws-profile-load',
      title: 'Load & Connect',
      description:
        'With the profile selected, click **Load & Connect**. RedfireForge applies the saved URL (and other fields) to the Client Connect form and switches you back — ready to connect in one click.',
      highlight: WS.SAVED_CONNECTIONS,
      pauseAfter: true,
      preAction: async (ctx: DemoActionContext) => {
        await ctx.click(WS.MODE_SAVED);
        await ctx.delay(300);
        const card = firstVisibleElement<HTMLElement>('[data-testid^="profile-card-"]');
        if (card && !card.classList.contains('selected')) {
          card.click();
          await ctx.delay(200);
        }
      },
      action: async (ctx: DemoActionContext) => {
        const card = firstVisibleElement<HTMLElement>('[data-testid^="profile-card-"]');
        if (!card) return;
        const id = card.getAttribute('data-testid')!.replace('profile-card-', '');
        await ctx.click(`[data-testid="profile-card-${id}"]`);
        await ctx.delay(400);
        await spotlightAndPause(ctx, `[data-testid="load-btn-${id}"]`, 900);
        await ctx.click(`[data-testid="load-btn-${id}"]`);
        await ctx.delay(800);
        await spotlightAndPause(ctx, WS.URL_INPUT, 1000);
      },
    },

    // ── Act II: Message Templates ──────────────────────────────
    {
      id: 'ws-template-save',
      title: 'Save a Message Template',
      description:
        'Switch to **Send**, type a JSON payload, then open **Templates**. Name it **greeting** and click **Save**. ' +
        'Templates store the message body only — perfect for complex JSON you reuse across sessions.',
      highlight: WS.TEMPLATE_TRIGGER,
      pauseAfter: true,
      preAction: async (ctx: DemoActionContext) => {
        await ctx.click(WS.MODE_CLIENT);
        await ctx.delay(200);
        await ctx.click(WS.LEFT_TAB_SEND);
        await ctx.delay(200);
        await closeTemplateModalIfOpen(ctx);
      },
      action: async (ctx: DemoActionContext) => {
        await ctx.fill(WS.MESSAGE_INPUT, DEMO_TEMPLATE_BODY);
        await spotlightAndPause(ctx, WS.MESSAGE_INPUT, 1100);
        await spotlightAndPause(ctx, WS.TEMPLATE_TRIGGER, 800);
        await ctx.click(WS.TEMPLATE_TRIGGER);
        await ctx.waitFor(WS.TEMPLATE_SAVE_NAME);
        await ctx.delay(600);
        await ctx.fill(WS.TEMPLATE_SAVE_NAME, DEMO_TEMPLATE_NAME);
        await spotlightAndPause(ctx, WS.TEMPLATE_SAVE_NAME, 800);
        await ctx.click(WS.TEMPLATE_SAVE_BTN);
        await ctx.delay(800);
      },
    },
    {
      id: 'ws-template-load',
      title: 'Load a Template',
      description:
        'Clear the compose area, reopen **Templates**, and click **greeting**. ' +
        'The payload `{"action":"greet","name":"RedfireForge"}` returns instantly — no retyping.',
      highlight: WS.TEMPLATE_TRIGGER,
      pauseAfter: true,
      preAction: async (ctx: DemoActionContext) => {
        await ctx.click(WS.LEFT_TAB_SEND);
        await ctx.delay(200);
        await ctx.fill(WS.MESSAGE_INPUT, '');
        await ctx.delay(150);
        await closeTemplateModalIfOpen(ctx);
      },
      action: async (ctx: DemoActionContext) => {
        await spotlightAndPause(ctx, WS.TEMPLATE_TRIGGER, 800);
        await ctx.click(WS.TEMPLATE_TRIGGER);
        await ctx.waitFor('.ws-template-item-load');
        await ctx.delay(700);
        await ctx.click('.ws-template-item-load');
        await spotlightAndPause(ctx, WS.MESSAGE_INPUT, 1200);
      },
    },

    // ── Act III: Environment Variables ─────────────────────────
    {
      id: 'ws-env-config',
      title: 'Configure WebSocket Endpoint',
      description:
        'Profiles remember a fixed URL. For multi-environment work, store the host in Environment Manager instead. ' +
        'Open **Settings → Environments**, create **"WebSocket Demo"** / **"ws-demo"**, add the **WebSocket** protocol, ' +
        'and set the mock URL (e.g. `ws://localhost:9876`). After Save, `{{wsBaseUrl}}` appears in derived variables.',
      highlight: EM.PROTOCOL_TAB_WS,
      pauseAfter: true,
      preAction: async (ctx: DemoActionContext) => {
        if (!firstVisibleElement(EM.MANAGER)) {
          if (!firstVisibleElement('[data-testid="ws-studio"]')) {
            await navigateToWebSocketStudio(ctx);
            await ctx.click(WS.MODE_CLIENT);
            await ctx.delay(200);
          }
        }
      },
      action: async (ctx: DemoActionContext) => {
        await ensureWsDemoEndpointConfigured(ctx, `ws://localhost:${getLastMockPort()}`);
        await ctx.delay(1500);
      },
    },
    {
      id: 'ws-env-resolve',
      title: 'Resolve {{wsBaseUrl}} in the URL',
      description:
        'Back in WebSocket Studio, select **"WebSocket Demo"** and **"ws-demo"** in the header. ' +
        'Type `{{wsBaseUrl}}/ws` in the URL field — the **→ Resolved:** preview shows your mock URL with a green ✓.',
      highlight: WS.URL_INPUT,
      pauseAfter: true,
      preAction: async (ctx: DemoActionContext) => {
        await ensureWsDemoHeaderContext(ctx, `ws://localhost:${getLastMockPort()}`);
        // ensureWsDemoHeaderContext may have navigated to Env Manager — go back
        await navigateToWebSocketStudio(ctx);
        await ensureClientConnect(ctx);
      },
      action: async (ctx: DemoActionContext) => {
        await spotlightAndPause(ctx, APP.HEADER_SELECTORS, 1000);
        await ctx.fill(WS.URL_INPUT, RESOLVED_WS_URL);
        await spotlightAndPause(ctx, WS.URL_INPUT, 1400);
      },
    },
    {
      id: 'ws-env-warn',
      title: 'Catch Unresolved Variables',
      description:
        'Type `{{unknownHost}}/ws` instead. RedfireForge immediately shows a **warning** under the field — ' +
        'typos and missing env config are caught before you click Connect.',
      highlight: WS.URL_INPUT,
      pauseAfter: true,
      preAction: async (ctx: DemoActionContext) => {
        if (!firstVisibleElement(WS.URL_INPUT)) {
          ctx.navigateToTab('websocket-studio');
          await ctx.delay(400);
          await ensureClientConnect(ctx);
        }
      },
      action: async (ctx: DemoActionContext) => {
        await ctx.fill(WS.URL_INPUT, UNRESOLVED_URL);
        await spotlightAndPause(ctx, WS.URL_INPUT, 1200);
      },
    },
  ],
};
