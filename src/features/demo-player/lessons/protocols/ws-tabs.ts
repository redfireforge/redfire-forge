/** Lesson 4: Tabs & Multi-Connection — tab bar, independent connections, rename, history */
import type { DemoActionContext, DemoLesson } from '../../types';
import { wsSetup, closeExtraConnectionTabs, disconnectWebSocket, clearEvents, stopMockServer, switchToClientMode, fillControlledInput } from '../setup-helpers';
import { WS } from '../../../../shared/selectors';

/** Setup: clean leftover tabs, disconnect, reset tab label, then start mock + switch to client. */
async function tabsSetup(ctx: DemoActionContext): Promise<void> {
  await ctx.delay(500);
  await disconnectWebSocket(ctx);
  await closeExtraConnectionTabs(ctx);
  await ctx.delay(200);
  const tab = document.querySelector(WS.CONN_TAB_FIRST) as HTMLElement | null;
  if (tab) {
    const label = tab.querySelector('.ws-conn-tab-label');
    if (label && label.textContent !== 'New Connection') {
      tab.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      await ctx.delay(300);
      const renameInput = document.querySelector(WS.CONN_TAB_RENAME) as HTMLInputElement | null;
      if (renameInput) {
        fillControlledInput(renameInput, 'New Connection');
        await ctx.delay(200);
        renameInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        await ctx.delay(200);
      }
    }
  }
  await wsSetup(ctx);
}

/** Cleanup: close extra tabs, disconnect, clear, stop mock, switch to client. */
async function tabsCleanup(ctx: DemoActionContext): Promise<void> {
  await closeExtraConnectionTabs(ctx);
  await disconnectWebSocket(ctx);
  await clearEvents(ctx);
  await stopMockServer(ctx);
  await switchToClientMode(ctx);
}

/**
 * Ensure at least two connection tabs exist.
 * If only one tab is present, silently adds a second.
 * Used as a preAction guard for steps that depend on Tab 2 existing.
 */
async function ensureTwoTabs(ctx: DemoActionContext): Promise<void> {
  const tabs = document.querySelectorAll(`${WS.CONN_TAB_BAR} [role="tab"]`);
  if (tabs.length < 2) {
    const addBtn = document.querySelector(WS.CONN_TAB_ADD) as HTMLElement | null;
    if (addBtn) {
      addBtn.click();
      await ctx.delay(400);
    }
  }
}

export const wsTabsLesson: DemoLesson = {
  id: 'ws-tabs',
  domainId: 'protocols',
  category: 'websocket',
  name: 'Tabs & Multi-Connection',
  description: 'Manage multiple independent connections with tabs — add, rename, switch, and close.',
  estimatedMinutes: 3,
  initialTab: 'websocket-studio',

  setup: tabsSetup,
  cleanup: tabsCleanup,

  concept: {
    title: 'Connection Tabs',
    body: `RedfireForge lets you work with **multiple WebSocket connections** simultaneously — each in its own tab, fully independent.

**What tabs give you:**
- **Independent state**: Each tab has its own URL, connection status, auth settings, and message log
- **Side-by-side testing**: Connect to different servers or the same server with different configs
- **Rename & organize**: Double-click a tab to give it a meaningful name like "Production" or "Staging"
- **URL history**: The ▾ dropdown remembers your recent connections for quick access

**Why it matters:**
Real-world debugging often involves comparing traffic across environments — production vs staging, different auth tokens, or multiple endpoints. Tabs make this workflow natural: open a tab for each scenario and switch freely without losing state.

**Tab limits & shortcuts:**
- Up to **8 tabs** open at once
- **Arrow keys** navigate between tabs, **F2** renames, **Delete** closes
- Connected tabs show a confirmation before closing`,
    keyTerms: [
      { term: 'Connection Tab', definition: 'An independent workspace with its own URL, connection state, and message log.' },
      { term: 'Tab History', definition: 'The ▾ dropdown that remembers recently connected URLs for quick reconnection.' },
      { term: 'Tab Rename', definition: 'Double-click a tab label (or press F2) to give it a custom name.' },
    ],
    diagram: `<svg viewBox="0 0 400 140" xmlns="http://www.w3.org/2000/svg" style="font-family:system-ui,sans-serif">
  <rect x="0" y="0" width="400" height="140" rx="8" fill="#1e1e2e" />

  <!-- Tab bar -->
  <rect x="10" y="15" width="380" height="32" rx="4" fill="#2a2a3a" />

  <!-- Tab 1 (active, connected) -->
  <rect x="14" y="18" width="120" height="26" rx="3" fill="#3a3a5a" stroke="#7c3aed" stroke-width="1.5" />
  <circle cx="24" cy="31" r="4" fill="#22c55e" />
  <text x="34" y="35" fill="#e0e0e0" font-size="11">Echo Server</text>
  <text x="122" y="35" fill="#888" font-size="10">×</text>

  <!-- Tab 2 (inactive, disconnected) -->
  <rect x="140" y="18" width="120" height="26" rx="3" fill="#2a2a3a" />
  <circle cx="150" cy="31" r="4" fill="#ef4444" />
  <text x="160" y="35" fill="#aaa" font-size="11">Staging API</text>
  <text x="248" y="35" fill="#888" font-size="10">×</text>

  <!-- Add button -->
  <rect x="266" y="20" width="22" height="22" rx="3" fill="#3a3a5a" />
  <text x="272" y="36" fill="#aaa" font-size="14">+</text>

  <!-- History dropdown -->
  <rect x="292" y="20" width="22" height="22" rx="3" fill="#3a3a5a" />
  <text x="297" y="35" fill="#aaa" font-size="11">▾</text>

  <!-- Labels -->
  <text x="30" y="70" fill="#7c3aed" font-size="10" font-weight="bold">● connected</text>
  <text x="155" y="70" fill="#ef4444" font-size="10" font-weight="bold">● disconnected</text>
  <text x="280" y="70" fill="#888" font-size="10">+ add  ▾ history</text>

  <!-- Note -->
  <text x="20" y="100" fill="#999" font-size="10">Each tab = independent connection, URL, auth, and message log</text>
  <text x="20" y="118" fill="#999" font-size="10">Arrow keys navigate · F2 rename · Delete close · Max 8 tabs</text>
</svg>`,
  },

  steps: [
    // ── 1. Tab Bar Overview ──────────────────────────────────────
    {
      id: 'tabs-intro',
      title: 'Your Connection Tab Bar',
      description:
        'The tab bar at the top manages your WebSocket connections. Each tab is an independent workspace with its own URL, auth, and message log.',
      highlight: WS.CONN_TAB_BAR,
      pauseAfter: true,
    },

    // ── 2. Add a New Tab ─────────────────────────────────────────
    {
      id: 'tabs-add',
      title: 'Add a New Tab',
      description:
        'Click the + button to create a new connection tab. You can have up to 8 tabs open at once. Each starts disconnected with a clean slate.',
      highlight: WS.CONN_TAB_ADD,
      action: async (ctx) => {
        await ctx.click(WS.CONN_TAB_ADD);
        await ctx.delay(500);
      },
      verify: WS.CONN_TAB_LAST,
      pauseAfter: true,
    },

    // ── 3. Switch Between Tabs ───────────────────────────────────
    {
      id: 'tabs-switch',
      title: 'Switch Between Tabs',
      description:
        'Click any tab to switch to its workspace. Notice how each tab has its own connection indicator — a colored dot showing connected (green) or disconnected (red).',
      highlight: WS.CONN_TAB_FIRST,
      action: async (ctx) => {
        await ctx.click(WS.CONN_TAB_FIRST);
        await ctx.delay(400);
      },
      pauseAfter: true,
    },

    // ── 4. Connect in Tab 1 ──────────────────────────────────────
    {
      id: 'tabs-connect',
      title: 'Connect in This Tab',
      description:
        'Let\'s connect this tab to the mock server. Type /connect in the console to establish a WebSocket connection. Watch the tab indicator turn green.',
      highlight: WS.CONSOLE_CMD_INPUT,
      preAction: async (ctx) => {
        // Ensure we're on Tab 1 before connecting (not Tab 2)
        await ctx.click(WS.CONN_TAB_FIRST);
        await ctx.delay(200);
        // Switch to Console tab so the input is visible
        await ctx.click(WS.RIGHT_TAB_CONSOLE);
        await ctx.delay(200);
      },
      action: async (ctx) => {
        await ctx.fill(WS.CONSOLE_CMD_INPUT, '/connect ws://localhost:9876');
        await ctx.delay(200);
        const input = document.querySelector(WS.CONSOLE_CMD_INPUT);
        if (input) {
          input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        }
        // Wait for connected status rather than a fixed delay (Rule 5)
        await ctx.waitFor(WS.STATUS_CONNECTED, 3000);
        await ctx.delay(300);
      },
      verify: WS.STATUS_CONNECTED,
      pauseAfter: true,
    },

    // ── 5. Independent Connections ───────────────────────────────
    {
      id: 'tabs-independent',
      title: 'Tabs Are Independent',
      description:
        'Switch to Tab 2 — it\'s still disconnected! Each tab maintains its own connection state. You can connect them to different servers or the same server with different settings.',
      highlight: WS.CONN_TAB_LAST,
      preAction: async (ctx) => {
        // Ensure Tab 2 exists (handles skip-to-step when only Tab 1 is present)
        await ensureTwoTabs(ctx);
        // Silently connect Tab 1 if not already (so the independence contrast is visible)
        await ctx.click(WS.CONN_TAB_FIRST);
        await ctx.delay(150);
        if (!document.querySelector(WS.STATUS_CONNECTED)) {
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
        // End on Tab 1 so the visible action of "switching to Tab 2" is meaningful
        await ctx.click(WS.CONN_TAB_FIRST);
        await ctx.delay(150);
      },
      action: async (ctx) => {
        // Use querySelectorAll to reliably find the last tab
        const tabs = document.querySelectorAll(`${WS.CONN_TAB_BAR} [role="tab"]`);
        const lastTab = tabs[tabs.length - 1] as HTMLElement | null;
        if (lastTab) lastTab.click();
        await ctx.delay(500);
      },
      pauseAfter: true,
    },

    // ── 6. Rename a Tab ──────────────────────────────────────────
    {
      id: 'tabs-rename',
      title: 'Rename a Tab',
      description:
        'Double-click a tab label to rename it. Give your tabs meaningful names like "Production" or "Echo Test" to stay organized when working with multiple connections.',
      highlight: WS.CONN_TAB_FIRST,
      preAction: async (ctx) => {
        // Switch back to tab 1 first
        await ctx.click(WS.CONN_TAB_FIRST);
        await ctx.delay(300);
      },
      action: async (ctx) => {
        // Double-click the first tab to trigger rename
        const tab = document.querySelector(WS.CONN_TAB_FIRST) as HTMLElement | null;
        if (tab) {
          tab.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
          await ctx.delay(400);
          // Fill the rename input
          const renameInput = document.querySelector(WS.CONN_TAB_RENAME) as HTMLInputElement | null;
          if (renameInput) {
            const nativeSet = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
            nativeSet?.call(renameInput, 'Echo Server');
            renameInput.dispatchEvent(new Event('input', { bubbles: true }));
            renameInput.dispatchEvent(new Event('change', { bubbles: true }));
            await ctx.delay(400);
            // Commit with Enter
            renameInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
            await ctx.delay(300);
          }
        }
      },
      pauseAfter: true,
    },

    // ── 7. URL History Dropdown ──────────────────────────────────
    {
      id: 'tabs-history',
      title: 'URL History',
      description:
        'The ▾ dropdown shows your recently connected URLs. Click any entry to open a new tab with that URL pre-filled — great for quickly reconnecting to familiar servers.',
      highlight: WS.CONN_TAB_HISTORY,
      preAction: async (ctx) => {
        // Ensure we're on Tab 1 — the connected tab that has URL history entries
        await ctx.click(WS.CONN_TAB_FIRST);
        await ctx.delay(200);
      },
      action: async (ctx) => {
        await ctx.click(WS.CONN_TAB_HISTORY);
        // Give end users 2 seconds to read the history entries (was 1s — too fast)
        await ctx.delay(2000);
        // Close the dropdown
        await ctx.click(WS.CONN_TAB_HISTORY);
        await ctx.delay(300);
      },
      pauseAfter: true,
    },

    // ── 8. Close a Tab ───────────────────────────────────────────
    {
      id: 'tabs-close',
      title: 'Close a Tab',
      description:
        'Click the × on any tab to close it. If the tab has an active connection, you\'ll see a confirmation dialog first. Keyboard shortcut: select a tab and press Delete.',
      highlight: WS.CONN_TAB_LAST,
      preAction: async (ctx) => {
        // Ensure Tab 2 exists so there is something to close
        await ensureTwoTabs(ctx);
      },
      action: async (ctx) => {
        // Find the close button on the last (disconnected) tab via querySelectorAll
        const tabs = document.querySelectorAll(`${WS.CONN_TAB_BAR} [role="tab"]`);
        const lastTab = tabs[tabs.length - 1] as HTMLElement | null;
        if (lastTab) {
          const tabTestId = lastTab.getAttribute('data-testid') ?? '';
          const tabId = tabTestId.replace('conn-tab-', '');
          const closeBtn = document.querySelector(`[data-testid="conn-tab-close-${tabId}"]`) as HTMLElement | null;
          if (closeBtn) {
            closeBtn.click();
            await ctx.delay(500);
          }
        }
      },
      pauseAfter: true,
    },
  ],
};
