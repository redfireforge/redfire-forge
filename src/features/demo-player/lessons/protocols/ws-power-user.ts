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

/** Get the currently active tab element */
function getActiveTab(): HTMLElement | null {
  return document.querySelector(`${WS.CONN_TAB_BAR} [role="tab"][aria-selected="true"]`) as HTMLElement | null;
}

/** Focus a tab and dispatch a keyboard event on it */
async function pressKeyOnTab(ctx: DemoActionContext, key: string, tab?: HTMLElement | null): Promise<void> {
  const target = tab ?? getActiveTab();
  if (!target) return;
  target.click();
  await ctx.delay(200);
  target.focus();
  await ctx.delay(100);
  // Mark as demo-synthetic so useDemoShortcuts ignores it and does not
  // accidentally advance/reverse the lesson step.
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  (event as KeyboardEvent & { __demoAction?: boolean }).__demoAction = true;
  target.dispatchEvent(event);
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
    diagram: `<pre>┌─────────────────────────────────────────────────┐
│  Tab Bar                                        │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐  +  ▾  │
│  │● Server A│ │● Server B│ │  Staging  │        │
│  └──────────┘ └──────────┘ └──────────┘        │
│       ↑             ↑                           │
│   ← / → arrow keys move focus                  │
│   F2 = rename  Delete = close                   │
│   Drag to reorder (native DnD)                  │
│                                                 │
│  Per-Tab State:                                 │
│  ┌─────────┬─────────────┬────────────┐         │
│  │ Tab     │ Auth        │ Shell Tab  │         │
│  ├─────────┼─────────────┼────────────┤         │
│  │ Server A│ Bearer xxx  │ Console    │         │
│  │ Server B│ None        │ Events     │         │
│  │ Staging │ API Key yyy │ Connect    │         │
│  └─────────┴─────────────┴────────────┘         │
└─────────────────────────────────────────────────┘</pre>`,
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
        // Set tab 1's right pane to Console (preload state for the demonstration)
        await ctx.click(WS.CONN_TAB_FIRST);
        await ctx.delay(300);
        await ctx.click(WS.RIGHT_TAB_CONSOLE);
        await ctx.delay(300);
      },
      action: async (ctx: DemoActionContext) => {
        // Switch to last tab and set Events
        const tabs = document.querySelectorAll(`${WS.CONN_TAB_BAR} [role="tab"]`);
        if (tabs.length >= 2) {
          const lastTab = tabs[tabs.length - 1] as HTMLElement;
          lastTab.click();
          await ctx.delay(800);
        }
        await ctx.click(WS.RIGHT_TAB_EVENTS);
        await ctx.delay(800);
        // Switch back to first tab — Console should still be active
        await ctx.click(WS.CONN_TAB_FIRST);
        await ctx.delay(800);
        // Switch to last tab again — Events should still be active
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
