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
import { wsSetup, wsCleanup } from '../setup-helpers';
import {
  cleanupDemoEnvironment,
  cleanupDemoMicroservice,
  ensureWsDemoEndpointConfigured,
  ensureWsDemoHeaderContext,
  navigateToWebSocketStudio,
  WS_DEMO_ENV_NAME,
  WS_DEMO_SVC_NAME,
} from '../env-manager-lesson-helpers';

// ── Constants ──────────────────────────────────────────────────
const DEMO_URL = 'ws://localhost:9876';
const DEMO_PROFILE_NAME = 'Demo Echo Server';
const DEMO_TEMPLATE_NAME = 'greeting';
const DEMO_TEMPLATE_BODY = '{"action":"greet","name":"RedfireForge"}';
const RESOLVED_WS_URL = '{{wsBaseUrl}}/ws';
const UNRESOLVED_URL = '{{unknownHost}}/ws';

// ── Helpers ─────────────────────────────────────────────────────

/** Delete all saved profiles to ensure clean demo state. */
async function clearSavedProfiles(ctx: DemoActionContext): Promise<void> {
  await ctx.click(WS.MODE_SAVED);
  await ctx.delay(400);
  // Delete profiles one by one via the detail pane's delete flow
  for (let i = 0; i < 10; i++) {
    const card = document.querySelector('[data-testid^="profile-card-"]') as HTMLElement | null;
    if (!card) break;
    card.click();
    await ctx.delay(300);
    const id = card.getAttribute('data-testid')!.replace('profile-card-', '');
    const deleteBtn = document.querySelector(`[data-testid="delete-btn-${id}"]`) as HTMLElement | null;
    if (deleteBtn) {
      deleteBtn.click();
      await ctx.delay(200);
      const confirm = document.querySelector(`[data-testid="confirm-delete-${id}"]`) as HTMLElement | null;
      confirm?.click();
      await ctx.delay(300);
    }
  }
}

/** Delete all saved templates via the templates modal. */
async function clearTemplates(ctx: DemoActionContext): Promise<void> {
  await ctx.click(WS.MODE_CLIENT);
  await ctx.delay(300);
  await ctx.click(WS.LEFT_TAB_SEND);
  await ctx.delay(500);
  await ctx.waitFor(WS.TEMPLATE_TRIGGER);
  const trigger = document.querySelector(WS.TEMPLATE_TRIGGER) as HTMLElement | null;
  if (!trigger) return;
  trigger.click();
  await ctx.delay(400);
  for (let i = 0; i < 10; i++) {
    const delBtn = document.querySelector('[data-testid^="template-delete-"]') as HTMLElement | null;
    if (!delBtn) break;
    const btnTestId = delBtn.getAttribute('data-testid')!;
    delBtn.click();
    for (let w = 0; w < 30; w++) {
      await ctx.delay(100);
      if (!document.querySelector(`[data-testid="${btnTestId}"]`)) break;
    }
  }
  if (document.querySelector(WS.TEMPLATE_DROPDOWN)) {
    trigger.click();
    await ctx.delay(200);
  }
}

// ── Setup / Cleanup ─────────────────────────────────────────────

async function workspaceSetup(ctx: DemoActionContext): Promise<void> {
  await ctx.delay(400);
  // Start mock server + switch to client mode
  await wsSetup(ctx);
  await ctx.delay(200);
  // Clear any existing profiles and templates for a clean demo
  await clearSavedProfiles(ctx);
  await ctx.delay(200);
  await clearTemplates(ctx);
  await ctx.delay(200);
  // Return to Client mode on Connect tab
  await ctx.click(WS.MODE_CLIENT);
  await ctx.delay(200);
  await ctx.click(WS.LEFT_TAB_CONNECT);
  await ctx.delay(200);
}

async function workspaceCleanup(ctx: DemoActionContext): Promise<void> {
  await clearSavedProfiles(ctx);
  await ctx.delay(200);
  await clearTemplates(ctx);
  await ctx.delay(200);
  await cleanupDemoMicroservice(ctx, WS_DEMO_SVC_NAME);
  await cleanupDemoEnvironment(ctx, WS_DEMO_ENV_NAME);
  await wsCleanup(ctx);
}

// ── Lesson ──────────────────────────────────────────────────────

export const wsWorkspaceLesson: DemoLesson = {
  id: 'ws-workspace',
  domainId: 'protocols',
  category: 'websocket',
  name: 'Profiles, Templates & Env Vars',
  description: 'Save connection profiles, reuse message templates, and use environment variables in URLs.',
  estimatedMinutes: 5,
  initialTab: 'websocket-studio',
  allowedTabs: ['environments', 'websocket-studio'],

  setup: workspaceSetup,
  cleanup: workspaceCleanup,

  concept: {
    title: 'Workspace: Your Saved Work',
    body: `RedfireForge has three features that turn one-off testing into a **repeatable workflow**: saved profiles, message templates, and environment variables.

**Saved Connection Profiles**

The **Saved** mode tab stores named connection configurations — URL, auth, headers, query params — so you can switch between servers with one click. Every profile you save appears in a searchable rail with "Load & Connect" to instantly apply it.

**Message Templates**

In the **Send** panel, the **Templates** button opens a modal where you can save the current message payload with a name (like "auth-handshake" or "order-create"). Next time, one click loads it back — no re-typing JSON. Templates persist across sessions.

**Environment Variables**

Type \`{{wsBaseUrl}}/ws\` in the URL field and RedfireForge resolves it from the **WebSocket** tab you configured per microservice × environment in the Environment Manager. Each protocol has its own endpoint table — WebSocket addresses are explicit \`ws://\` or \`wss://\` URLs, not derived from HTTP unless you leave them blank (fallback). A **→ Resolved:** preview appears below the input with ✓ (explicit), ⚠ (HTTP fallback), or ✗ (unresolved). If a variable can't be resolved, a warning badge appears immediately — you'll know before you click Connect.

| Feature | Access | What it saves |
|---|---|---|
| Profiles | **Saved** mode tab (top bar) or **Save as Profile** button | URL + auth + headers + params |
| Templates | **Templates** button in **Send** panel (opens modal) | Message body text |
| Env Vars | \`{{varName}}\` in URL/headers/params | Auto-resolved from selected environment |`,
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
    // ── 1. Saved Mode ────────────────────────────────────────
    {
      id: 'ws-profile-intro',
      title: 'The Saved Mode',
      description:
        'The **Saved** tab in the top mode bar opens the profiles panel — a searchable library of named connection configurations. Each profile stores URL, auth, headers, and query params. Right now it\'s empty because the demo started with a clean slate. Let\'s create our first profile.',
      highlight: WS.MODE_SAVED,
      pauseAfter: true,
      preAction: async (ctx: DemoActionContext) => {
        await ctx.click(WS.MODE_SAVED);
        await ctx.delay(300);
        document.querySelectorAll('.ws-saved-rail-item.selected, .ws-saved-card.selected').forEach((el) => {
          el.classList.remove('selected');
        });
      },
      action: async (ctx: DemoActionContext) => {
        await ctx.delay(400);
      },
    },

    // ── 2. Save a Profile ──────────────────────────────────
    {
      id: 'ws-profile-save',
      title: 'Save a Connection Profile',
      description:
        'Back in Client mode, the Connect panel shows a **Save as Profile** button below the URL field. The mock server URL is already filled in. Watch the demo click **Save as Profile** — a modal opens where you name the profile and confirm. The profile is now saved and appears in the Saved tab.',
      highlight: WS.SAVE_AS_PROFILE_BTN,
      pauseAfter: true,
      preAction: async (ctx: DemoActionContext) => {
        await ctx.click(WS.MODE_CLIENT);
        await ctx.delay(300);
        await ctx.click(WS.LEFT_TAB_CONNECT);
        await ctx.delay(200);
        await ctx.fill(WS.URL_INPUT, DEMO_URL);
        await ctx.delay(200);
      },
      action: async (ctx: DemoActionContext) => {
        await ctx.click(WS.SAVE_AS_PROFILE_BTN);
        // Rule 5: ProfileEditorModal is conditionally rendered — wait for it to mount.
        // Clicking the button switches to Saved mode, sets prefillDraft, which triggers
        // a useEffect that sets editorOpen = true, then the modal mounts.
        await ctx.waitFor(WS.PROFILE_NAME_INPUT);
        await ctx.delay(400);
        // The profile editor modal is now open — fill name and save
        await ctx.fill(WS.PROFILE_NAME_INPUT, DEMO_PROFILE_NAME);
        await ctx.delay(400);
        await ctx.click(WS.PROFILE_SAVE_BTN);
        await ctx.delay(600);
      },
    },

    // ── 3. Load a Profile ──────────────────────────────────
    {
      id: 'ws-profile-load',
      title: 'Load a Saved Profile',
      description:
        'Switch to Saved mode and the profile we just created appears in the rail. Selecting it shows a detail pane with URL, auth badges, and action buttons. Clicking **Load & Connect** applies the profile to the Client connect form and switches you back — ready to connect in one click.',
      highlight: WS.SAVED_CONNECTIONS,
      pauseAfter: true,
      preAction: async (ctx: DemoActionContext) => {
        await ctx.click(WS.MODE_SAVED);
        await ctx.delay(400);
      },
      action: async (ctx: DemoActionContext) => {
        // Click the first profile card to select it (with visual ripple)
        const card = document.querySelector('[data-testid^="profile-card-"]') as HTMLElement | null;
        if (!card) return;
        const id = card.getAttribute('data-testid')!.replace('profile-card-', '');
        await ctx.click(`[data-testid="profile-card-${id}"]`);
        await ctx.delay(500);
        // Click "Load & Connect" (with visual ripple)
        await ctx.click(`[data-testid="load-btn-${id}"]`);
        await ctx.delay(600);
      },
    },

    // ── 4. Templates Introduction ──────────────────────────
    {
      id: 'ws-template-intro',
      title: 'Message Templates',
      description:
        'The **Send** panel has a **Templates** button in the compose controls. Clicking it opens a centered modal — a dedicated panel for managing your saved message templates. Templates store the raw message body and persist across sessions. Watch as the modal opens showing the empty state — no templates yet.',
      highlight: WS.TEMPLATE_TRIGGER,
      pauseAfter: true,
      preAction: async (ctx: DemoActionContext) => {
        await ctx.click(WS.LEFT_TAB_SEND);
        await ctx.delay(300);
      },
      action: async (ctx: DemoActionContext) => {
        await ctx.click(WS.TEMPLATE_TRIGGER);
        await ctx.waitFor(WS.TEMPLATE_DROPDOWN);
        await ctx.delay(1500);
        await ctx.click(WS.TEMPLATE_TRIGGER);
        await ctx.delay(300);
      },
    },

    // ── 5. Save a Template ─────────────────────────────────
    {
      id: 'ws-template-save',
      title: 'Save a Template',
      description:
        'Watch the demo type a JSON payload into the compose textarea, then open the Templates modal and enter a name in the **Save current message as** section at the bottom. Clicking **Save** stores the template — it\'s now available for instant reuse anytime.',
      highlight: WS.TEMPLATE_SAVE_BTN,
      pauseAfter: true,
      preAction: async (ctx: DemoActionContext) => {
        await ctx.click(WS.LEFT_TAB_SEND);
        await ctx.delay(200);
        // Close modal if still open from previous step
        if (document.querySelector(WS.TEMPLATE_DROPDOWN)) {
          const trigger = document.querySelector(WS.TEMPLATE_TRIGGER) as HTMLElement | null;
          if (trigger) trigger.click();
          await ctx.delay(200);
        }
      },
      action: async (ctx: DemoActionContext) => {
        await ctx.fill(WS.MESSAGE_INPUT, DEMO_TEMPLATE_BODY);
        await ctx.delay(500);
        await ctx.click(WS.TEMPLATE_TRIGGER);
        await ctx.waitFor(WS.TEMPLATE_SAVE_NAME);
        await ctx.delay(600);
        await ctx.fill(WS.TEMPLATE_SAVE_NAME, DEMO_TEMPLATE_NAME);
        await ctx.delay(400);
        await ctx.click(WS.TEMPLATE_SAVE_BTN);
        await ctx.delay(700);
      },
    },

    // ── 6. Load a Template ─────────────────────────────────
    {
      id: 'ws-template-load',
      title: 'Load a Template',
      description:
        'The compose textarea is now empty. Watch the demo open the Templates modal — the saved **greeting** template appears in the list with its full payload preview. Clicking it loads the payload `{"action":"greet","name":"RedfireForge"}` back into the compose area instantly. Templates are great for complex JSON bodies you use repeatedly.',
      highlight: WS.TEMPLATE_TRIGGER,
      pauseAfter: true,
      preAction: async (ctx: DemoActionContext) => {
        await ctx.click(WS.LEFT_TAB_SEND);
        await ctx.delay(200);
        await ctx.fill(WS.MESSAGE_INPUT, '');
        await ctx.delay(200);
        // Close modal if still open from previous step
        if (document.querySelector(WS.TEMPLATE_DROPDOWN)) {
          const trigger = document.querySelector(WS.TEMPLATE_TRIGGER) as HTMLElement | null;
          if (trigger) trigger.click();
          await ctx.delay(200);
        }
      },
      action: async (ctx: DemoActionContext) => {
        await ctx.click(WS.TEMPLATE_TRIGGER);
        await ctx.waitFor('.ws-template-item-load');
        await ctx.delay(600);
        await ctx.click('.ws-template-item-load');
        await ctx.delay(600);
      },
    },

    // ── 7. Configure WebSocket Endpoint ─────────────────────────
    {
      id: 'ws-env-config',
      title: 'Configure WebSocket Endpoint',
      description:
        'Open **Settings → Environments** and create **"WebSocket Demo"** and **"ws-demo"**. Expand the microservice — it starts with **no protocol tabs**. ' +
        'Click **+ Add protocol** and choose **WebSocket**, deploy the **WebSocket Demo** row, then **Edit** and enter `ws://localhost:9876`. ' +
        'After **Save**, the derived-variables panel shows `{{wsBaseUrl}}` resolved for this microservice.',
      highlight: EM.PROTOCOL_TAB_WS,
      pauseAfter: true,
      preAction: async (ctx: DemoActionContext) => {
        if (!document.querySelector(EM.MANAGER)) {
          if (!document.querySelector('[data-testid="ws-studio"]')) {
            await navigateToWebSocketStudio(ctx);
            await ctx.click(WS.MODE_CLIENT);
            await ctx.delay(200);
          }
        }
      },
      action: async (ctx: DemoActionContext) => {
        await ensureWsDemoEndpointConfigured(ctx);
        await ctx.delay(1500);
      },
    },

    // ── 8. Select Environment & Service in Header ───────────────
    {
      id: 'ws-header-select',
      title: 'Select Environment & Service',
      description:
        'Back in WebSocket Studio, choose **"WebSocket Demo"** in the **Environment** header dropdown and **"ws-demo"** in the **Service** dropdown. ' +
        'The protocol indicator beside them confirms `{{wsBaseUrl}}` is resolved before you type a URL template.',
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
        await ensureWsDemoHeaderContext(ctx);
        await ctx.delay(1500);
      },
    },

    // ── 9. Resolved {{wsBaseUrl}} preview ────────────────────────
    {
      id: 'ws-env-resolve',
      title: 'Resolved WebSocket URL',
      description:
        'Type `{{wsBaseUrl}}/ws` in the URL field. Watch the **→ Resolved:** preview update to `ws://localhost:9876/ws` with a green ✓ — using the endpoint and header selections you just configured.',
      highlight: WS.URL_INPUT,
      pauseAfter: true,
      preAction: async (ctx: DemoActionContext) => {
        await navigateToWebSocketStudio(ctx);
        await ensureWsDemoHeaderContext(ctx);
        await ctx.click(WS.MODE_CLIENT);
        await ctx.delay(300);
        await ctx.click(WS.LEFT_TAB_CONNECT);
        await ctx.delay(200);
      },
      action: async (ctx: DemoActionContext) => {
        await ctx.fill(WS.URL_INPUT, RESOLVED_WS_URL);
        await ctx.delay(1500);
      },
    },

    // ── 10. Variable Placeholders & Warning ─────────────────────
    {
      id: 'ws-env-warn',
      title: 'Variable Placeholders in URLs',
      description:
        'The URL field supports `{{varName}}` placeholders — type `{{unknownHost}}/ws` and RedfireForge immediately shows a **warning** below the field: the variable doesn\'t match any known variable. This instant feedback catches typos, missing environment config, or an unselected environment before you ever click Connect.',
      highlight: WS.URL_INPUT,
      pauseAfter: true,
      preAction: async (ctx: DemoActionContext) => {
        // Guard for skip-to-step: only navigate if URL input is not already visible.
        // Do NOT click MODE_CLIENT or LEFT_TAB_CONNECT when already on Connect tab —
        // those clicks trigger React re-renders that interfere with the fill in the action.
        if (!document.querySelector(WS.URL_INPUT)) {
          ctx.navigateToTab('websocket-studio');
          await ctx.delay(500);
          await ctx.click(WS.MODE_CLIENT);
          await ctx.delay(200);
          await ctx.click(WS.LEFT_TAB_CONNECT);
          await ctx.delay(200);
        }
      },
      action: async (ctx: DemoActionContext) => {
        await ctx.fill(WS.URL_INPUT, UNRESOLVED_URL);
        await ctx.delay(800);
      },
    },
  ],
};
