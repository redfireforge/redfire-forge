/**
 * Lesson 17: Power User — Tabs & Keyboard
 *
 * Builds on Lesson 4 (ws-tabs) with advanced tab features:
 *  - Drag-and-drop reorder
 *  - Keyboard navigation (Arrow, F2, Delete)
 *  - Per-tab auth and shell tab persistence
 *
 * No Docker required — uses the built-in mock echo server.
 */
import type { DemoActionContext, DemoLesson } from '../../types';
import { wsSetup, wsCleanup, closeExtraConnectionTabs, fillControlledInput } from '../setup-helpers';
import { WS } from '../../../../shared/selectors';

/**
 * Rename a specific tab by index (0-based).
 * click → focus → F2 → fill → Enter
 */
async function renameTabByIndex(ctx: DemoActionContext, index: number, name: string): Promise<void> {
  const tabs = document.querySelectorAll(`${WS.CONN_TAB_BAR} [role="tab"]`);
  const tab = tabs[index] as HTMLElement | null;
  if (!tab) return;

  tab.click();
  await ctx.delay(500);
  tab.focus();
  await ctx.delay(200);
  const f2Event = new KeyboardEvent('keydown', { key: 'F2', bubbles: true, cancelable: true });
  (f2Event as KeyboardEvent & { __demoAction?: boolean }).__demoAction = true;
  tab.dispatchEvent(f2Event);
  await ctx.delay(500);

  let input = document.querySelector(WS.CONN_TAB_RENAME) as HTMLInputElement | null;
  if (!input) {
    tab.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    await ctx.delay(400);
    input = document.querySelector(WS.CONN_TAB_RENAME) as HTMLInputElement | null;
  }
  if (!input) return;

  fillControlledInput(input, name);
  await ctx.delay(300);
  const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
  (enterEvent as KeyboardEvent & { __demoAction?: boolean }).__demoAction = true;
  input.dispatchEvent(enterEvent);
  await ctx.delay(300);
}

/** Get a tab by index (0-based) from the connection tab bar */
function getTabByIndex(index: number): HTMLElement | null {
  const tabs = document.querySelectorAll(`${WS.CONN_TAB_BAR} [role="tab"]`);
  return (tabs[index] as HTMLElement) ?? null;
}

/** Focus a tab and dispatch a keyboard event on it */
async function pressKeyOnTab(ctx: DemoActionContext, key: string, tab: HTMLElement | null): Promise<void> {
  if (!tab) return;
  tab.click();
  await ctx.delay(200);
  tab.focus();
  await ctx.delay(100);
  // Mark as demo-synthetic so useDemoShortcuts ignores it and does not
  // accidentally advance/reverse the lesson step.
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  (event as KeyboardEvent & { __demoAction?: boolean }).__demoAction = true;
  tab.dispatchEvent(event);
  await ctx.delay(300);
}

/**
 * Ensure exactly 3 named tabs exist: Server A, Server B, Staging.
 * Idempotent — closes extras first, adds if fewer than 3, then renames all.
 */
async function ensureThreeNamedTabs(ctx: DemoActionContext): Promise<void> {
  await closeExtraConnectionTabs(ctx);
  await ctx.delay(200);
  const count = document.querySelectorAll(`${WS.CONN_TAB_BAR} [role="tab"]`).length;
  for (let i = count; i < 3; i++) {
    await ctx.click(WS.CONN_TAB_ADD);
    await ctx.delay(400);
  }
  await renameTabByIndex(ctx, 0, 'Server A');
  await renameTabByIndex(ctx, 1, 'Server B');
  await renameTabByIndex(ctx, 2, 'Staging');
  await ctx.click(WS.CONN_TAB_FIRST);
  await ctx.delay(200);
}

// ── Setup / Cleanup ─────────────────────────────────────────────

async function powerUserSetup(ctx: DemoActionContext): Promise<void> {
  await ctx.delay(400);
  // Disconnect if connected
  const dcBtn = document.querySelector(WS.DISCONNECT_BTN) as HTMLButtonElement | null;
  if (dcBtn && !dcBtn.disabled) {
    dcBtn.click();
    await ctx.delay(300);
  }
  // Close extra tabs so we start with exactly 1
  await closeExtraConnectionTabs(ctx);
  await ctx.delay(200);
  // Start mock server
  await wsSetup(ctx);
  await ctx.delay(200);
}

async function powerUserCleanup(ctx: DemoActionContext): Promise<void> {
  await closeExtraConnectionTabs(ctx);
  await ctx.delay(200);
  await wsCleanup(ctx);
}

// ── Lesson ──────────────────────────────────────────────────────

export const wsPowerUserLesson: DemoLesson = {
  id: 'ws-power-user',
  domainId: 'protocols',
  category: 'websocket',
  name: 'Power User: Tabs & Keyboard',
  description: 'Master tab drag-reorder, keyboard shortcuts, and per-tab persistence for a keyboard-first workflow.',
  estimatedMinutes: 4,
  initialTab: 'websocket-studio',

  setup: powerUserSetup,
  cleanup: powerUserCleanup,

  concept: {
    title: 'Power User: Tabs & Keyboard',
    body: `Lesson 4 covered the basics — add, switch, rename, close. This lesson goes deeper into the features that make tab management fast and keyboard-first.

**Drag to Reorder**

Grab any connection tab and drag it to a new position. While dragging, the source tab fades and drop indicators appear to show where the tab will land. Tab order is saved automatically.

**Keyboard Shortcuts**

| Shortcut | Action |
|---|---|
| **← / →** | Move focus between tabs (wraps around) |
| **Home / End** | Jump to first / last tab |
| **Enter / Space** | Activate focused tab |
| **F2** | Start inline rename |
| **Delete** | Close focused tab |
| **Double-click** | Start rename |
| **Middle-click** | Close tab |

**Per-Tab Persistence**

Each connection tab remembers its own state independently:
- **Auth settings** — Bearer tokens, API keys, etc. stay with their tab
- **Shell tabs** — Tab 1 can be on Console while Tab 2 is on Events
- **URL & draft** — each tab has its own URL field and connection draft

The split pane width is shared across all tabs (resizing affects all). Shell tab selection (Connect/Auth/Events/Console) is per-tab.`,
    keyTerms: [
      { term: 'Roving Tabindex', definition: 'Only the active tab has tabIndex=0; arrow keys move focus between tabs without activating them.' },
      { term: 'Native DnD', definition: 'Tab reordering uses HTML5 drag-and-drop. The dragged tab fades (opacity) and drop indicators show before/after positions.' },
      { term: 'Per-Tab State', definition: 'Auth, URL draft, and shell tab selection (left/right pane) are stored independently for each connection tab.' },
    ],
    diagram: `<svg viewBox="0 0 480 248" xmlns="http://www.w3.org/2000/svg" style="font-family:system-ui,sans-serif;display:block">
  <defs>
    <linearGradient id="activeTabGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#4c3d8f"/>
      <stop offset="100%" stop-color="#312b5c"/>
    </linearGradient>
    <linearGradient id="keyGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#38365a"/>
      <stop offset="100%" stop-color="#26243e"/>
    </linearGradient>
    <filter id="keyShadow" x="-10%" y="-10%" width="120%" height="140%">
      <feDropShadow dx="0" dy="2" stdDeviation="1" flood-color="#0008"/>
    </filter>
  </defs>

  <!-- Background -->
  <rect width="480" height="248" rx="10" fill="#181825"/>

  <!-- ══ Section 1: Tab Bar ══════════════════════════════════════ -->
  <rect x="12" y="12" width="456" height="44" rx="6" fill="#1e1e2e" stroke="#2e2e4a" stroke-width="1"/>

  <!-- Active tab: Server A -->
  <rect x="18" y="17" width="112" height="34" rx="5" fill="url(#activeTabGrad)" stroke="#7c3aed" stroke-width="1.5"/>
  <!-- Bottom accent line -->
  <rect x="18" y="48" width="112" height="3" rx="1" fill="#7c3aed"/>
  <circle cx="30" cy="34" r="4.5" fill="#22c55e"/>
  <text x="40" y="38" fill="#e2e0f0" font-size="11.5" font-weight="600">Server A</text>
  <!-- Keyboard focus ring -->
  <rect x="17" y="16" width="114" height="36" rx="6" fill="none" stroke="#a78bfa" stroke-width="1" stroke-dasharray="3,3" opacity="0.6"/>

  <!-- Tab: Server B -->
  <rect x="136" y="17" width="112" height="34" rx="5" fill="#242438" stroke="#35354f" stroke-width="1"/>
  <circle cx="148" cy="34" r="4.5" fill="#6b7280"/>
  <text x="158" y="38" fill="#7d7d9e" font-size="11.5">Server B</text>

  <!-- Tab: Staging -->
  <rect x="254" y="17" width="100" height="34" rx="5" fill="#242438" stroke="#35354f" stroke-width="1"/>
  <circle cx="266" cy="34" r="4.5" fill="#6b7280"/>
  <text x="276" y="38" fill="#7d7d9e" font-size="11.5">Staging</text>

  <!-- Add button -->
  <rect x="362" y="20" width="28" height="28" rx="5" fill="#2e2e48" stroke="#45455f" stroke-width="1"/>
  <text x="369" y="38" fill="#a78bfa" font-size="17" font-weight="200">+</text>

  <!-- Focus annotation -->
  <text x="400" y="31" fill="#6d5fe6" font-size="9" font-weight="600">FOCUSED</text>
  <text x="400" y="43" fill="#6d5fe6" font-size="9" opacity="0.7">tabIndex=0</text>

  <!-- ══ Section 2: Keyboard shortcuts (left) + Per-tab state (right) ══ -->

  <!-- Left panel: Keyboard shortcuts -->
  <rect x="12" y="64" width="222" height="116" rx="6" fill="#1e1e2e" stroke="#2e2e4a" stroke-width="1"/>
  <text x="20" y="80" fill="#6d5fe6" font-size="9" font-weight="700" letter-spacing="1">KEYBOARD SHORTCUTS</text>

  <!-- Row: ← → -->
  <!-- Left key -->
  <rect x="20" y="87" width="26" height="22" rx="4" fill="url(#keyGrad)" stroke="#4a4a6a" stroke-width="1" filter="url(#keyShadow)"/>
  <rect x="20" y="87" width="26" height="20" rx="4" fill="#38365a"/>
  <text x="28" y="103" fill="#c4b5fd" font-size="13">←</text>
  <!-- Right key -->
  <rect x="50" y="87" width="26" height="22" rx="4" fill="url(#keyGrad)" stroke="#4a4a6a" stroke-width="1" filter="url(#keyShadow)"/>
  <rect x="50" y="87" width="26" height="20" rx="4" fill="#38365a"/>
  <text x="58" y="103" fill="#c4b5fd" font-size="13">→</text>
  <text x="82" y="101" fill="#9ca3af" font-size="10">Move focus between tabs</text>

  <!-- Row: Home / End -->
  <rect x="20" y="115" width="40" height="22" rx="4" fill="url(#keyGrad)" stroke="#4a4a6a" stroke-width="1" filter="url(#keyShadow)"/>
  <rect x="20" y="115" width="40" height="20" rx="4" fill="#38365a"/>
  <text x="27" y="130" fill="#c4b5fd" font-size="9.5" font-weight="600">Home</text>
  <text x="82" y="129" fill="#9ca3af" font-size="10">Jump to first / last tab</text>

  <!-- Row: F2 -->
  <rect x="20" y="143" width="30" height="22" rx="4" fill="url(#keyGrad)" stroke="#4a4a6a" stroke-width="1" filter="url(#keyShadow)"/>
  <rect x="20" y="143" width="30" height="20" rx="4" fill="#1e3a4a"/>
  <text x="27" y="158" fill="#7dd3fc" font-size="10" font-weight="700">F2</text>
  <text x="56" y="157" fill="#9ca3af" font-size="10">Inline rename</text>

  <!-- Row: Delete -->
  <rect x="20" y="164" width="42" height="22" rx="4" fill="url(#keyGrad)" stroke="#4a4a6a" stroke-width="1" filter="url(#keyShadow)"/>
  <rect x="20" y="164" width="42" height="20" rx="4" fill="#3a1e2a"/>
  <text x="25" y="179" fill="#fca5a5" font-size="9.5" font-weight="600">Delete</text>
  <text x="68" y="178" fill="#9ca3af" font-size="10">Close focused tab</text>

  <!-- Right panel: Per-tab state -->
  <rect x="242" y="64" width="226" height="116" rx="6" fill="#1e1e2e" stroke="#2e2e4a" stroke-width="1"/>
  <text x="250" y="80" fill="#6d5fe6" font-size="9" font-weight="700" letter-spacing="1">PER-TAB STATE</text>

  <!-- Table header -->
  <rect x="250" y="84" width="210" height="18" rx="3" fill="#252540"/>
  <text x="258" y="96" fill="#6b7280" font-size="9" font-weight="600">TAB</text>
  <text x="315" y="96" fill="#6b7280" font-size="9" font-weight="600">AUTH</text>
  <text x="393" y="96" fill="#6b7280" font-size="9" font-weight="600">SHELL</text>

  <!-- Row: Server A -->
  <rect x="250" y="104" width="210" height="20" rx="2" fill="#252545"/>
  <text x="258" y="118" fill="#a78bfa" font-size="10" font-weight="600">Server A</text>
  <rect x="307" y="107" width="60" height="14" rx="3" fill="#1a3a2a"/>
  <text x="312" y="118" fill="#4ade80" font-size="9">Bearer •••</text>
  <rect x="385" y="107" width="48" height="14" rx="3" fill="#1a2535"/>
  <text x="390" y="118" fill="#7dd3fc" font-size="9">Console</text>

  <!-- Row: Server B -->
  <rect x="250" y="126" width="210" height="20" rx="2" fill="#1e1e2e"/>
  <text x="258" y="140" fill="#a78bfa" font-size="10">Server B</text>
  <text x="315" y="140" fill="#6b7280" font-size="9">None</text>
  <rect x="385" y="129" width="44" height="14" rx="3" fill="#1a2535"/>
  <text x="390" y="140" fill="#7dd3fc" font-size="9">Events</text>

  <!-- Row: Staging -->
  <rect x="250" y="148" width="210" height="20" rx="2" fill="#252545"/>
  <text x="258" y="162" fill="#a78bfa" font-size="10">Staging</text>
  <rect x="307" y="151" width="54" height="14" rx="3" fill="#1a3530"/>
  <text x="312" y="162" fill="#34d399" font-size="9">API Key</text>
  <rect x="385" y="151" width="48" height="14" rx="3" fill="#1a2535"/>
  <text x="390" y="162" fill="#7dd3fc" font-size="9">Connect</text>

  <!-- Isolation icon -->
  <text x="250" y="176" fill="#6b7280" font-size="9" font-style="italic">Each tab stores state independently</text>

  <!-- ══ Section 3: Drag to Reorder ════════════════════════════ -->
  <rect x="12" y="188" width="456" height="50" rx="6" fill="#1e1e2e" stroke="#2e2e4a" stroke-width="1"/>
  <text x="20" y="203" fill="#6d5fe6" font-size="9" font-weight="700" letter-spacing="1">DRAG TO REORDER</text>

  <!-- Source tab (being dragged — faded) -->
  <rect x="20" y="208" width="96" height="24" rx="4" fill="#312b5c" stroke="#7c3aed" stroke-width="1.5" opacity="0.4"/>
  <circle cx="31" cy="220" r="3.5" fill="#22c55e" opacity="0.4"/>
  <text x="40" y="224" fill="#c4b5fd" font-size="10" opacity="0.45">Server A</text>
  <!-- Drag arrow -->
  <text x="122" y="224" fill="#7c3aed" font-size="16">›</text>
  <text x="134" y="224" fill="#7c3aed" font-size="16">›</text>

  <!-- Target tab (drop zone with left-edge indicator) -->
  <rect x="152" y="208" width="96" height="24" rx="4" fill="#242438" stroke="#45456a" stroke-width="1"/>
  <rect x="152" y="208" width="3" height="24" rx="1" fill="#a78bfa"/>
  <circle cx="163" cy="220" r="3.5" fill="#6b7280"/>
  <text x="172" y="224" fill="#7d7d9e" font-size="10">Server B</text>

  <!-- After-drop result -->
  <text x="258" y="218" fill="#3a3a5a" font-size="18">→</text>
  <rect x="276" y="208" width="96" height="24" rx="4" fill="#312b5c" stroke="#7c3aed" stroke-width="1.5"/>
  <circle cx="287" cy="220" r="3.5" fill="#22c55e"/>
  <text x="296" y="224" fill="#e2e0f0" font-size="10">Server A</text>
  <rect x="378" y="208" width="80" height="24" rx="4" fill="#242438" stroke="#45456a" stroke-width="1"/>
  <circle cx="389" cy="220" r="3.5" fill="#6b7280"/>
  <text x="398" y="224" fill="#7d7d9e" font-size="10">Server B</text>

  <!-- Saved badge -->
  <rect x="380" y="189" width="80" height="16" rx="3" fill="#14532d" opacity="0.8"/>
  <text x="388" y="200" fill="#4ade80" font-size="9">✓ Order saved</text>
</svg>`,
  },

  steps: [
    // ── 1. Three Tabs Ready ─────────────────────────────────
    {
      id: 'pu-setup-tabs',
      title: 'Three Tabs Ready',
      description:
        'We start with three named tabs: **Server A**, **Server B**, and **Staging**. Each is an independent workspace. The active tab has a highlighted border and `tabIndex=0` — it\'s the keyboard focus anchor.',
      highlight: WS.CONN_TAB_BAR,
      pauseAfter: true,
      preAction: async (ctx: DemoActionContext) => {
        // Close extra tabs first — guards against step-back adding duplicates
        await closeExtraConnectionTabs(ctx);
        await ctx.delay(200);
        // Add tab 2 and tab 3
        await ctx.click(WS.CONN_TAB_ADD);
        await ctx.delay(600);
        await ctx.click(WS.CONN_TAB_ADD);
        await ctx.delay(600);
        // Rename each tab by index: 0=Server A, 1=Server B, 2=Staging
        await renameTabByIndex(ctx, 0, 'Server A');
        await renameTabByIndex(ctx, 1, 'Server B');
        await renameTabByIndex(ctx, 2, 'Staging');
        // Switch back to first tab
        await ctx.click(WS.CONN_TAB_FIRST);
        await ctx.delay(400);
      },
    },

    // ── 2. Drag to Reorder ──────────────────────────────────
    {
      id: 'pu-drag-reorder',
      title: 'Drag to Reorder',
      description:
        '**Try it yourself right now!** Grab any tab and drag it to a new position. The source tab fades to 40% opacity while dragging, and a colored inset line appears on the target tab showing where the drop will land (left edge = before, right edge = after). Release to finalize — the new order is saved automatically.',
      highlight: WS.CONN_TAB_BAR,
      pauseAfter: true,
      preAction: async (ctx: DemoActionContext) => {
        // Guard: ensure 3 named tabs exist if user jumped directly to this step
        const tabs = document.querySelectorAll(`${WS.CONN_TAB_BAR} [role="tab"]`);
        if (tabs.length < 3) {
          await ensureThreeNamedTabs(ctx);
        }
      },
      action: async (ctx: DemoActionContext) => {
        // Drag can't be reliably automated; show the tabs and let user read
        await ctx.delay(600);
      },
    },

    // ── 3. Arrow Key Navigation ─────────────────────────────
    {
      id: 'pu-kbd-arrow',
      title: 'Arrow Key Navigation',
      description:
        'With a tab focused, press **→** to move focus to the next tab and **←** for the previous. Focus wraps around — pressing → on the last tab moves to the first. Note: arrow keys only move **focus**, not activation. Press **Enter** or **Space** to activate the focused tab.',
      highlight: WS.CONN_TAB_BAR,
      pauseAfter: true,
      preAction: async (ctx: DemoActionContext) => {
        // Guard: ensure at least 2 tabs exist for meaningful arrow key demo
        const tabs = document.querySelectorAll(`${WS.CONN_TAB_BAR} [role="tab"]`);
        if (tabs.length < 2) {
          await ensureThreeNamedTabs(ctx);
        }
      },
      action: async (ctx: DemoActionContext) => {
        const tab1 = getTabByIndex(0);
        // Use index-based targeting: ArrowRight moves focus, not activation,
        // so getActiveTab() would still return tab1 — target tab2 by index directly.
        const tab2 = getTabByIndex(1) ?? tab1;
        if (tab1) {
          await pressKeyOnTab(ctx, 'ArrowRight', tab1);
          await ctx.delay(600);
          await pressKeyOnTab(ctx, 'ArrowRight', tab2);
          await ctx.delay(600);
        }
      },
    },

    // ── 4. F2 to Rename ─────────────────────────────────────
    {
      id: 'pu-kbd-rename',
      title: 'F2 to Rename',
      description:
        'Press **F2** on the focused tab to enter inline rename mode. Type a new name and press **Enter** to commit, or **Escape** to cancel. You can also **double-click** a tab label to start renaming. Watch as we rename the last tab to **Production**.',
      highlight: WS.CONN_TAB_BAR,
      pauseAfter: true,
      preAction: async (ctx: DemoActionContext) => {
        // Guard: ensure tabs exist (if user jumped here directly)
        const tabs = document.querySelectorAll(`${WS.CONN_TAB_BAR} [role="tab"]`);
        if (tabs.length < 1) {
          await ensureThreeNamedTabs(ctx);
        }
      },
      action: async (ctx: DemoActionContext) => {
        // Rename the last tab to "Production" — viewer watches F2 → type → Enter
        const tabs = document.querySelectorAll(`${WS.CONN_TAB_BAR} [role="tab"]`);
        if (tabs.length > 0) {
          await renameTabByIndex(ctx, tabs.length - 1, 'Production');
        }
      },
    },

    // ── 5. Delete to Close ──────────────────────────────────
    {
      id: 'pu-kbd-delete',
      title: 'Delete to Close',
      description:
        'Press **Delete** on the focused tab to close it. If it has an active connection, a confirmation dialog appears first. Focus moves automatically to the nearest remaining tab. Watch as we close **Server B** with the Delete key.',
      highlight: WS.CONN_TAB_BAR,
      pauseAfter: true,
      preAction: async (ctx: DemoActionContext) => {
        // Ensure "Server B" exists — if it was already closed (step replay),
        // add a fresh tab and rename it so the Delete demo is always meaningful.
        const tabs = document.querySelectorAll(`${WS.CONN_TAB_BAR} [role="tab"]`);
        const hasSvrB = Array.from(tabs).some(t =>
          t.querySelector('.ws-conn-tab-label')?.textContent === 'Server B'
        );
        if (!hasSvrB) {
          await ctx.click(WS.CONN_TAB_ADD);
          await ctx.delay(300);
          const newTabs = document.querySelectorAll(`${WS.CONN_TAB_BAR} [role="tab"]`);
          await renameTabByIndex(ctx, newTabs.length - 1, 'Server B');
        }
      },
      action: async (ctx: DemoActionContext) => {
        // Find "Server B" and close it with the Delete keyboard shortcut
        const tabs = document.querySelectorAll(`${WS.CONN_TAB_BAR} [role="tab"]`);
        let svrBTab: HTMLElement | null = null;
        for (const t of tabs) {
          if (t.querySelector('.ws-conn-tab-label')?.textContent === 'Server B') {
            svrBTab = t as HTMLElement;
            break;
          }
        }
        if (svrBTab) {
          await pressKeyOnTab(ctx, 'Delete', svrBTab);
          await ctx.delay(600);
        }
      },
    },

    // ── 6. Auth Persists per Tab ─────────────────────────────
    {
      id: 'pu-auth-persist',
      title: 'Auth Persists per Tab',
      description:
        'Each tab remembers its own auth settings. Switch to the **Auth** tab — it shows the connection authentication config for this tab only. Switch to another connection tab, then come back — the auth draft is unchanged. This means you can configure different credentials per connection.',
      highlight: WS.LEFT_TAB_AUTH,
      pauseAfter: true,
      preAction: async (ctx: DemoActionContext) => {
        // Guard: need at least 2 connection tabs for a meaningful cross-tab demo
        const tabs = document.querySelectorAll(`${WS.CONN_TAB_BAR} [role="tab"]`);
        if (tabs.length < 2) {
          await ctx.click(WS.CONN_TAB_ADD);
          await ctx.delay(400);
        }
        // Reset left pane to Connect so the action visibly switches to Auth
        await ctx.click(WS.CONN_TAB_FIRST);
        await ctx.delay(200);
        await ctx.click(WS.LEFT_TAB_CONNECT);
        await ctx.delay(200);
      },
      action: async (ctx: DemoActionContext) => {
        // Switch to Auth tab in current connection tab
        await ctx.click(WS.LEFT_TAB_AUTH);
        await ctx.delay(800);
        // Switch to the other connection tab
        const tabs = document.querySelectorAll(`${WS.CONN_TAB_BAR} [role="tab"]`);
        if (tabs.length >= 2) {
          const otherTab = tabs[tabs.length - 1] as HTMLElement;
          otherTab.click();
          await ctx.delay(800);
        }
        // Switch back to first tab to show auth is preserved
        await ctx.click(WS.CONN_TAB_FIRST);
        await ctx.delay(800);
      },
    },

    // ── 7. Shell Tabs Persist per Tab ────────────────────────
    {
      id: 'pu-pane-persist',
      title: 'Shell Tabs Persist per Tab',
      description:
        'The left and right pane tabs (Connect/Auth/Events/Console) are remembered **per connection tab**. Tab 1 can be on Console while Tab 2 shows Events. Switch between connection tabs — each returns to its last-used shell tab. This makes multi-environment comparison workflows natural.',
      highlight: WS.CONN_TAB_BAR,
      pauseAfter: true,
      preAction: async (ctx: DemoActionContext) => {
        // Guard: need at least 2 tabs to demonstrate cross-tab state persistence
        const tabs = document.querySelectorAll(`${WS.CONN_TAB_BAR} [role="tab"]`);
        if (tabs.length < 2) {
          await ctx.click(WS.CONN_TAB_ADD);
          await ctx.delay(400);
        }
        // Pre-load independent state on both tabs so the viewer sees distinct
        // left+right panes during the reading phase, matching the description.
        // Last tab: Auth (left) + Events (right)
        const allTabs = document.querySelectorAll(`${WS.CONN_TAB_BAR} [role="tab"]`);
        const lastTab = allTabs[allTabs.length - 1] as HTMLElement | null;
        if (lastTab) {
          lastTab.click();
          await ctx.delay(300);
          await ctx.click(WS.LEFT_TAB_AUTH);
          await ctx.delay(200);
          await ctx.click(WS.RIGHT_TAB_EVENTS);
          await ctx.delay(200);
        }
        // First tab: Connect (left) + Console (right) — shown during reading
        await ctx.click(WS.CONN_TAB_FIRST);
        await ctx.delay(300);
        await ctx.click(WS.LEFT_TAB_CONNECT);
        await ctx.delay(200);
        await ctx.click(WS.RIGHT_TAB_CONSOLE);
        await ctx.delay(300);
      },
      action: async (ctx: DemoActionContext) => {
        // Switch to last tab — Auth (left) + Events (right) prove per-tab memory
        const tabs = document.querySelectorAll(`${WS.CONN_TAB_BAR} [role="tab"]`);
        if (tabs.length >= 2) {
          const lastTab = tabs[tabs.length - 1] as HTMLElement;
          lastTab.click();
          await ctx.delay(1000);
        }
        // Switch back to first tab — Connect (left) + Console (right) are restored
        await ctx.click(WS.CONN_TAB_FIRST);
        await ctx.delay(1000);
        // One final switch to last tab — Events is still active, proving persistence
        const tabsAgain = document.querySelectorAll(`${WS.CONN_TAB_BAR} [role="tab"]`);
        if (tabsAgain.length >= 2) {
          const lastTab = tabsAgain[tabsAgain.length - 1] as HTMLElement;
          lastTab.click();
          await ctx.delay(800);
        }
      },
    },
  ],
};
