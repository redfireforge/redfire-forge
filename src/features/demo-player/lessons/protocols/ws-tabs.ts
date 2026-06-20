/** Lesson 4: Tabs & Multi-Connection — independent mock servers, send/receive, per-server logs */
import type { DemoActionContext, DemoLesson } from '../../types';
import { wsSetup, closeExtraConnectionTabs, disconnectWebSocket, clearEvents, stopMockServer, switchToClientMode, fillControlledInput, firstVisibleEl } from '../setup-helpers';
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

/** Switch to the last tab in the tab bar. */
async function switchToLastTab(ctx: DemoActionContext): Promise<void> {
  const tabs = document.querySelectorAll(`${WS.CONN_TAB_BAR} [role="tab"]`);
  const lastTab = tabs[tabs.length - 1] as HTMLElement | null;
  if (lastTab) {
    lastTab.click();
    await ctx.delay(250);
  }
}

export const wsTabsLesson: DemoLesson = {
  id: 'ws-tabs',
  domainId: 'protocols',
  category: 'websocket',
  name: 'Tabs & Multi-Connection',
  description: 'Run two independent mock servers simultaneously, send messages in each tab, and inspect their isolated server logs.',
  estimatedMinutes: 4,
  initialTab: 'websocket-studio',

  setup: tabsSetup,
  cleanup: tabsCleanup,

  concept: {
    title: 'Multi-Tab, Multi-Server',
    body: `RedfireForge lets you work with **multiple WebSocket connections** simultaneously — each in its own tab with a **fully independent mock server**.

**What you'll see in this lesson:**
- **Tab 1** runs a mock echo server on **:9876** — started automatically for you
- **Tab 2** gets its own mock server on **:9877** — a completely separate process
- Both servers run simultaneously with **different ports, different logs, different rules**
- You'll send messages from each tab and watch the **echoes and server logs** stay completely isolated

**Why it matters:**
Real-world debugging often requires running multiple WebSocket scenarios side-by-side — production vs staging, different auth tokens, or testing how two concurrent clients interact. Per-tab mock servers give you that isolation without any configuration.

**Key facts:**
- Up to **8 tabs** open at once
- Closing a tab **automatically stops its mock server** — no orphaned processes
- Each tab persists its URL, auth settings, and message history`,
    keyTerms: [
      { term: 'Per-Tab Mock Server', definition: 'Each tab gets its own unique port (9876, 9877, …) for an isolated echo/rules server.' },
      { term: 'Port Isolation', definition: 'Servers on different ports cannot share state — logs, rules, and connections are completely separate.' },
      { term: 'Echo Fallback', definition: 'The default mock server behavior: any message received is reflected straight back to the sender.' },
      { term: 'Server Log', definition: 'The Mock Server Log tab records every connection, message received, and response sent by that server.' },
    ],
    diagram: `<svg viewBox="0 0 440 200" xmlns="http://www.w3.org/2000/svg" style="font-family:system-ui,sans-serif">
  <rect x="0" y="0" width="440" height="200" rx="8" fill="#1e1e2e" />

  <!-- Tab bar -->
  <rect x="10" y="10" width="420" height="32" rx="4" fill="#2a2a3a" />

  <!-- Tab 1 (active, connected) -->
  <rect x="14" y="13" width="130" height="26" rx="3" fill="#3a3a5a" stroke="#7c3aed" stroke-width="1.5" />
  <circle cx="24" cy="26" r="4" fill="#22c55e" />
  <text x="34" y="30" fill="#e0e0e0" font-size="11">Tab 1</text>
  <text x="132" y="30" fill="#888" font-size="10">×</text>

  <!-- Tab 2 (active, connected) -->
  <rect x="148" y="13" width="130" height="26" rx="3" fill="#2a2a3a" stroke="#444" stroke-width="1" />
  <circle cx="158" cy="26" r="4" fill="#22c55e" />
  <text x="168" y="30" fill="#bbb" font-size="11">Tab 2</text>
  <text x="266" y="30" fill="#888" font-size="10">×</text>

  <!-- Add button -->
  <rect x="282" y="15" width="22" height="22" rx="3" fill="#3a3a5a" />
  <text x="288" y="31" fill="#aaa" font-size="14">+</text>

  <!-- Tab 1 area -->
  <rect x="10" y="52" width="200" height="130" rx="4" fill="#1a1a2e" stroke="#7c3aed" stroke-width="1" />
  <text x="18" y="68" fill="#a78bfa" font-size="10" font-weight="bold">TAB 1 — Client</text>

  <!-- Tab 1 message flow -->
  <text x="18" y="86" fill="#888" font-size="9">Send: "Hello from Tab 1!"</text>
  <text x="18" y="102" fill="#22c55e" font-size="9">← Echo: "Hello from Tab 1!"</text>

  <!-- Tab 1 mock server -->
  <rect x="18" y="112" width="185" height="60" rx="3" fill="#1a2a1a" stroke="#22c55e" stroke-width="1" stroke-dasharray="3,2" />
  <text x="26" y="127" fill="#22c55e" font-size="9" font-weight="bold">⬤ Mock Server :9876</text>
  <text x="26" y="143" fill="#4ade80" font-size="9">Log: message-in "Hello from Tab 1!"</text>
  <text x="26" y="157" fill="#4ade80" font-size="9">Log: response-out (echo fallback)</text>
  <text x="26" y="170" fill="#666" font-size="8">Rules: 0 active · Fallback: echo</text>

  <!-- Tab 2 area -->
  <rect x="230" y="52" width="200" height="130" rx="4" fill="#1a1a2e" stroke="#0ea5e9" stroke-width="1" />
  <text x="238" y="68" fill="#7dd3fc" font-size="10" font-weight="bold">TAB 2 — Client</text>

  <!-- Tab 2 message flow -->
  <text x="238" y="86" fill="#888" font-size="9">Send: "Hello from Tab 2!"</text>
  <text x="238" y="102" fill="#22c55e" font-size="9">← Echo: "Hello from Tab 2!"</text>

  <!-- Tab 2 mock server -->
  <rect x="238" y="112" width="185" height="60" rx="3" fill="#1a2030" stroke="#0ea5e9" stroke-width="1" stroke-dasharray="3,2" />
  <text x="246" y="127" fill="#38bdf8" font-size="9" font-weight="bold">⬤ Mock Server :9877</text>
  <text x="246" y="143" fill="#7dd3fc" font-size="9">Log: message-in "Hello from Tab 2!"</text>
  <text x="246" y="157" fill="#7dd3fc" font-size="9">Log: response-out (echo fallback)</text>
  <text x="246" y="170" fill="#666" font-size="8">Rules: 0 active · Fallback: echo</text>
</svg>`,
  },

  steps: [
    // ── 1. Tab Bar Overview ──────────────────────────────────────
    {
      id: 'tabs-intro',
      title: 'Your Connection Tab Bar',
      description:
        'Each tab is a fully independent workspace — its own URL, connection state, message log, and built-in mock server. Tab 1 is already running a mock echo server on **:9876**. Let\'s add a second tab and explore the power of per-tab isolation.',
      highlight: WS.CONN_TAB_BAR,
      // Switch to Mock Server mode so the "already running on :9876" claim in the
      // description is visually confirmed — viewer sees the green "Running on :9876"
      // status during the reading pause instead of just the Client connect form.
      preAction: async (ctx) => {
        await ctx.click(WS.CONN_TAB_FIRST);
        await ctx.delay(150);
        await ctx.click(WS.MODE_MOCK);
        await ctx.delay(300);
      },
      pauseAfter: true,
    },

    // ── 2. Add a New Tab ─────────────────────────────────────────
    {
      id: 'tabs-add',
      title: 'Add Tab 2 — Gets Port 9877',
      description:
        'Click **+** to create Tab 2. Notice it automatically gets its own dedicated port — **9877** — completely separate from Tab 1\'s **9876**. You can have up to 8 tabs, each with its own server.',
      highlight: WS.CONN_TAB_ADD,
      action: async (ctx) => {
        await ctx.click(WS.CONN_TAB_ADD);
        await ctx.delay(500);
        // Switch to Tab 2's Mock mode briefly to show port 9877
        await ctx.click(WS.MODE_MOCK);
        await ctx.delay(400);
      },
      verify: WS.MOCK_SERVER_PANEL,
      pauseAfter: true,
    },

    // ── 3. Start Tab 2's Mock Server ─────────────────────────────
    {
      id: 'tabs-mock-start-tab2',
      title: 'Start Tab 2\'s Mock Server on :9877',
      description:
        'Tab 2\'s mock server shows **port 9877**. Click **Start Server** to launch it. Tab 1\'s server on **:9876** is already running in the background — both will operate simultaneously, completely independent.',
      highlight: WS.MOCK_START_BTN,
      preAction: async (ctx) => {
        await ensureTwoTabs(ctx);
        await switchToLastTab(ctx);
        await ctx.click(WS.MODE_MOCK);
        await ctx.delay(300);
      },
      action: async (ctx) => {
        // Start Tab 2's mock server (9877) — stay on Tab 2 the whole time so
        // the spotlight never jumps to Tab 1's panel.
        if (!firstVisibleEl(WS.MOCK_STOP_BTN)) {
          await ctx.click(WS.MOCK_START_BTN);
          await ctx.waitFor(WS.MOCK_STOP_BTN, 6000);
        }
        await ctx.delay(600);
      },
      verify: WS.MOCK_STOP_BTN,
      pauseAfter: true,
    },

    // ── 4. Connect Tab 1 to :9876 ─────────────────────────────────
    {
      id: 'tabs-connect-tab1',
      title: 'Connect Tab 1 → ws://localhost:9876',
      description:
        'Switch to Tab 1 and connect to **ws://localhost:9876** — its dedicated echo server. The green dot confirms the connection. Tab 2 stays disconnected for now.',
      highlight: WS.CONN_TAB_FIRST,
      preAction: async (ctx) => {
        // Switch Tab 2 back to Client mode, then go to Tab 1
        await switchToLastTab(ctx);
        await ctx.click(WS.MODE_CLIENT);
        await ctx.delay(150);
        await ctx.click(WS.CONN_TAB_FIRST);
        await ctx.delay(150);
      },
      action: async (ctx) => {
        await ctx.click(WS.MODE_CLIENT);
        await ctx.delay(150);
        await ctx.click(WS.LEFT_TAB_CONNECT);
        await ctx.delay(200);
        await ctx.fill(WS.URL_INPUT, 'ws://localhost:9876');
        await ctx.delay(200);
        await ctx.click(WS.CONNECT_BTN);
        await ctx.waitFor(WS.STATUS_CONNECTED, 5000);
        await ctx.delay(400);
      },
      verify: WS.STATUS_CONNECTED,
      pauseAfter: true,
    },

    // ── 5. Connect Tab 2 to :9877 ─────────────────────────────────
    {
      id: 'tabs-connect-tab2',
      title: 'Connect Tab 2 → ws://localhost:9877',
      description:
        'Switch to Tab 2 and connect to **ws://localhost:9877** — its own server. Now **both tabs are green** but they\'re talking to **completely different servers**. Total isolation.',
      highlight: WS.CONN_TAB_LAST,
      preAction: async (ctx) => {
        await ensureTwoTabs(ctx);
        await switchToLastTab(ctx);
        await ctx.delay(150);
      },
      action: async (ctx) => {
        await ctx.click(WS.MODE_CLIENT);
        await ctx.delay(150);
        await ctx.click(WS.LEFT_TAB_CONNECT);
        await ctx.delay(200);
        await ctx.fill(WS.URL_INPUT, 'ws://localhost:9877');
        await ctx.delay(200);
        await ctx.click(WS.CONNECT_BTN);
        await ctx.waitFor(WS.STATUS_CONNECTED, 5000);
        await ctx.delay(400);
      },
      verify: WS.STATUS_CONNECTED,
      pauseAfter: true,
    },

    // ── 6. Send from Tab 1, See Echo ──────────────────────────────
    {
      id: 'tabs-send-tab1',
      title: 'Send from Tab 1 — Echo from :9876',
      description:
        'Switch to Tab 1\'s **Send** tab, type a message and hit Send. Switch to **Events** to see the echo response come back from mock server **:9876**.',
      highlight: WS.LEFT_TAB_SEND,
      preAction: async (ctx) => {
        // Ensure Tab 1 is connected (guard for skip-to-step)
        await ctx.click(WS.CONN_TAB_FIRST);
        await ctx.delay(150);
        await ctx.click(WS.MODE_CLIENT);
        await ctx.delay(150);
        if (!firstVisibleEl(WS.STATUS_CONNECTED)) {
          await ctx.click(WS.LEFT_TAB_CONNECT);
          await ctx.delay(150);
          await ctx.fill(WS.URL_INPUT, 'ws://localhost:9876');
          await ctx.delay(150);
          const connectBtn = firstVisibleEl<HTMLButtonElement>(WS.CONNECT_BTN);
          if (connectBtn && !connectBtn.disabled) {
            connectBtn.click();
            await ctx.waitFor(WS.STATUS_CONNECTED, 4000);
          }
        }
        await ctx.click(WS.LEFT_TAB_SEND);
        await ctx.delay(200);
      },
      action: async (ctx) => {
        await ctx.fill(WS.MESSAGE_INPUT, 'Hello from Tab 1!');
        await ctx.delay(300);
        await ctx.click(WS.SEND_BTN);
        await ctx.delay(600);
        // Switch to Events to show the echo response
        await ctx.click(WS.RIGHT_TAB_EVENTS);
        await ctx.delay(600);
      },
      verify: WS.MESSAGE_ROW,
      pauseAfter: true,
    },

    // ── 7. Tab 1 Mock Server Log ───────────────────────────────────
    {
      id: 'tabs-mock-log-tab1',
      title: 'Tab 1 Mock Server Log — :9876 Recorded It',
      description:
        'Switch to Tab 1\'s **Mock Server** mode and open the **Log** tab. The server recorded every detail: **message-in**, **response-out**, client ID, and timestamp. This is :9876\'s log — Tab 2\'s :9877 log has nothing yet.',
      // Highlight the "Server Log" TAB BUTTON — it is always visible in Mock Server
      // mode (even before the log is opened). WS.MOCK_LOG points to the log content
      // area which only exists once the tab has been clicked, so using that selector
      // here would leave the spotlight unable to find an element (📖 Guide badge).
      highlight: WS.MOCK_TAB_LOG,
      preAction: async (ctx) => {
        await ctx.click(WS.CONN_TAB_FIRST);
        await ctx.delay(150);
        await ctx.click(WS.MODE_MOCK);
        await ctx.delay(300);
      },
      action: async (ctx) => {
        await ctx.click(WS.MOCK_TAB_LOG);
        await ctx.delay(400);
      },
      verify: WS.MOCK_LOG,
      pauseAfter: true,
    },

    // ── 8. Send from Tab 2, See Its Separate Log ──────────────────
    {
      id: 'tabs-send-tab2',
      title: 'Tab 2: Send, Echo & Separate :9877 Log',
      description:
        'Switch to Tab 2, send a different message, and check **its** Mock Server Log. Notice it shows **:9877\'s** activity — completely separate from Tab 1\'s **:9876** log. Two servers, two isolated logs, zero cross-contamination.',
      highlight: WS.CONN_TAB_LAST,
      preAction: async (ctx) => {
        // Return Tab 1 to Client mode (was on Mock/Log)
        await ctx.click(WS.CONN_TAB_FIRST);
        await ctx.delay(150);
        await ctx.click(WS.MODE_CLIENT);
        await ctx.delay(150);
        // Switch to Tab 2, ensure connected
        await ensureTwoTabs(ctx);
        await switchToLastTab(ctx);
        await ctx.click(WS.MODE_CLIENT);
        await ctx.delay(150);
        if (!firstVisibleEl(WS.STATUS_CONNECTED)) {
          await ctx.click(WS.LEFT_TAB_CONNECT);
          await ctx.delay(150);
          await ctx.fill(WS.URL_INPUT, 'ws://localhost:9877');
          await ctx.delay(150);
          const connectBtn = firstVisibleEl<HTMLButtonElement>(WS.CONNECT_BTN);
          if (connectBtn && !connectBtn.disabled) {
            connectBtn.click();
            await ctx.waitFor(WS.STATUS_CONNECTED, 4000);
          }
        }
        await ctx.click(WS.LEFT_TAB_SEND);
        await ctx.delay(200);
      },
      action: async (ctx) => {
        await ctx.fill(WS.MESSAGE_INPUT, 'Hello from Tab 2!');
        await ctx.delay(300);
        await ctx.click(WS.SEND_BTN);
        await ctx.delay(600);
        // Events — echo from :9877
        await ctx.click(WS.RIGHT_TAB_EVENTS);
        await ctx.delay(600);
        // Mock Server → Log tab — :9877's log
        await ctx.click(WS.MODE_MOCK);
        await ctx.delay(300);
        await ctx.click(WS.MOCK_TAB_LOG);
        await ctx.delay(400);
      },
      verify: WS.MOCK_LOG,
      pauseAfter: true,
    },

    // ── 9. Close a Tab — Server Stops Automatically ───────────────
    {
      id: 'tabs-close',
      title: 'Close a Tab — Server Stops Automatically',
      description:
        'Click **×** on Tab 2 to close it. Its mock server on **:9877** stops automatically — no orphaned processes. Tab 1 and its **:9876** server are completely unaffected. Connected tabs show a confirmation before closing.',
      highlight: WS.CONN_TAB_LAST,
      preAction: async (ctx) => {
        // Disconnect Tab 2 first to avoid the confirmation modal blocking the demo.
        // We must navigate to the Connect sub-tab explicitly because the Disconnect
        // button only appears there (step 8 left Tab 2 on the Send sub-tab).
        await ensureTwoTabs(ctx);
        await switchToLastTab(ctx);
        await ctx.click(WS.MODE_CLIENT);
        await ctx.delay(150);
        await ctx.click(WS.LEFT_TAB_CONNECT); // ensure Disconnect btn is visible
        await ctx.delay(150);
        const disconnectBtn = firstVisibleEl<HTMLButtonElement>(WS.DISCONNECT_BTN);
        if (disconnectBtn && !disconnectBtn.disabled) {
          disconnectBtn.click();
          await ctx.delay(400);
        }
        // Switch to Tab 1 so the close button on Tab 2 is visible in the tab bar
        await ctx.click(WS.CONN_TAB_FIRST);
        await ctx.delay(200);
      },
      action: async (ctx) => {
        const tabs = document.querySelectorAll(`${WS.CONN_TAB_BAR} [role="tab"]`);
        const lastTab = tabs[tabs.length - 1] as HTMLElement | null;
        if (lastTab) {
          const tabTestId = lastTab.getAttribute('data-testid') ?? '';
          const tabId = tabTestId.replace('conn-tab-', '');
          const closeBtn = document.querySelector(`[data-testid="conn-tab-close-${tabId}"]`) as HTMLElement | null;
          if (closeBtn) {
            closeBtn.click();
            await ctx.delay(600);
          }
        }
      },
      pauseAfter: true,
    },
  ],
};
