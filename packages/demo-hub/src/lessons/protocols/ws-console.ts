/** Lesson 3: Console & Debugging — slash commands, filters, structured logs */
import type { DemoActionContext, DemoLesson } from '../../types';
import { wsSetup, wsCleanup } from '../setup-helpers';
import { WS } from '@shared/selectors';

const COMMAND_TYPE_INITIAL_PAUSE_MS = 220;
const COMMAND_READ_PAUSE_MIN_MS = 1800;
const COMMAND_READ_PAUSE_MAX_MS = 3200;
const COMMAND_READ_MS_PER_CHAR = 36;

/**
 * Tracks whether the lesson's /connect command has already been run in the
 * current demo session. Reset by setup() so repeat runs start clean.
 *
 * DOM-based guards (checking for CONSOLE_ENTRY) are unreliable here because
 * the ConsolePanel may be unmounted/remounted when right-tab switches happen,
 * causing the console state to be reset. A module-level flag is the only
 * reliable way to prevent duplicate /connect commands across preActions.
 */
let _consoleConnected = false;

const DEFAULT_WS_DEMO_URL = 'ws://localhost:9876';
const WS_CONSOLE_DEMO_PORT = 9876;

function isAriaSelected(selector: string): boolean {
  const el = document.querySelector<HTMLElement>(selector);
  return el?.getAttribute('aria-selected') === 'true';
}

async function clickIfNotSelected(ctx: DemoActionContext, selector: string, settleMs = 150): Promise<void> {
  if (isAriaSelected(selector)) return;
  await ctx.click(selector);
  if (settleMs > 0) await ctx.delay(settleMs);
}

async function ensureWsConsoleDemoPort(ctx: DemoActionContext): Promise<void> {
  const targetUrl = `ws://localhost:${WS_CONSOLE_DEMO_PORT}`;
  // Only switch to Mock mode if not already there — avoids visible flash
  const alreadyMock = !!document.querySelector('[data-testid="mode-mock"].active, [data-testid="mode-mock"][aria-selected="true"]');
  if (!alreadyMock) {
    await ctx.click(WS.MODE_MOCK);
    await ctx.delay(200);
  }

  const statusLabel = document.querySelector<HTMLElement>(WS.MOCK_STATUS_LABEL)?.textContent ?? '';
  const alreadyOnTargetPort = statusLabel.includes(`:${WS_CONSOLE_DEMO_PORT}`);

  if (!alreadyOnTargetPort) {
    const stopBtn = document.querySelector<HTMLButtonElement>(WS.MOCK_STOP_BTN);
    if (stopBtn && !stopBtn.disabled) {
      stopBtn.click();
      await ctx.delay(350);
    }

    const portInput = document.querySelector<HTMLInputElement>('[data-testid="mock-port-input"]');
    if (portInput) {
      const nativeSet = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      nativeSet?.call(portInput, String(WS_CONSOLE_DEMO_PORT));
      portInput.dispatchEvent(new Event('input', { bubbles: true }));
      portInput.dispatchEvent(new Event('change', { bubbles: true }));
      portInput.blur();
      await ctx.delay(180);
    }

    const startBtn = document.querySelector<HTMLButtonElement>(WS.MOCK_START_BTN);
    if (startBtn && !startBtn.disabled) {
      startBtn.click();
      await ctx.delay(450);
    }
  }

  await ctx.click(WS.MODE_CLIENT);
  await ctx.delay(250);
  await ctx.fill(WS.URL_INPUT, targetUrl);
  await ctx.delay(150);
}

function resolveConnectUrlFromUi(): string {
  const urlInput = document.querySelector<HTMLInputElement>(WS.URL_INPUT);
  const rawUrl = urlInput?.value?.trim();
  if (rawUrl && /^wss?:\/\//i.test(rawUrl)) return rawUrl;

  const portInput = document.querySelector<HTMLInputElement>('[data-testid="mock-port-input"]');
  const port = portInput?.value?.trim();
  if (port && /^\d+$/.test(port)) return `ws://localhost:${port}`;

  return DEFAULT_WS_DEMO_URL;
}

/**
 * Render command text in the console input long enough for viewers to read it
 * before Enter submits and the input clears.
 */
async function typeAndSubmitConsoleCommand(ctx: DemoActionContext, command: string): Promise<void> {
  // Keep command rendering simple (single fill) and pause for readability
  // before submission so users can see what is being sent.
  await ctx.delay(COMMAND_TYPE_INITIAL_PAUSE_MS);
  await ctx.fill(WS.CONSOLE_CMD_INPUT, command);
  const readPause = Math.min(
    COMMAND_READ_PAUSE_MAX_MS,
    Math.max(COMMAND_READ_PAUSE_MIN_MS, command.length * COMMAND_READ_MS_PER_CHAR),
  );
  await ctx.delay(readPause);
  const input = document.querySelector(WS.CONSOLE_CMD_INPUT);
  if (input) {
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  }
}

/**
 * Ensure the Console tab is active (in Structured view) and a connection exists.
 * No-op for all steps after the first successful connect in this lesson session.
 */
async function ensureConnectedWithConsole(ctx: DemoActionContext): Promise<void> {
  await clickIfNotSelected(ctx, WS.MODE_CLIENT, 120);
  await clickIfNotSelected(ctx, WS.RIGHT_TAB_CONSOLE, 120);
  await clickIfNotSelected(ctx, WS.CONSOLE_VIEW_STRUCTURED, 150);
  if (_consoleConnected) return;
  // Connect via console command — stays on Console tab and
  // populates it with lifecycle entries for subsequent demo steps.
  await typeAndSubmitConsoleCommand(ctx, `/connect ${resolveConnectUrlFromUi()}`);
  await ctx.waitFor(WS.CONSOLE_ENTRY, 3000);
  _consoleConnected = true;
  await ctx.delay(200);
}

export const wsConsoleLesson: DemoLesson = {
  id: 'ws-console',
  domainId: 'protocols',
  category: 'websocket',
  name: 'Console & Debugging',
  description: 'Use the console for slash commands, live event logs, and powerful filtering.',
  estimatedMinutes: 3,
  initialTab: 'websocket-studio',

  setup: async (ctx) => {
    _consoleConnected = false;
    await wsSetup(ctx);
    await ensureWsConsoleDemoPort(ctx);
  },
  cleanup: async (ctx) => {
    _consoleConnected = false;
    await wsCleanup(ctx);
  },

  concept: {
    title: 'The Developer Console',
    body: `Every WebSocket connection generates a stream of lifecycle events — opens, closes, errors, handshake details. The **Console** tab captures all of these in a structured, filterable log.

**What it does:**
- **Structured view**: Severity-badged log entries grouped by category (lifecycle, command, system, handshake)
- **Raw view**: Curl-verbose style timeline for copy-paste debugging
- **Slash commands**: Type commands like \`/send\`, \`/help\`, \`/connect\`, \`/clear\` directly in the console
- **Filtering**: Filter by category, severity level (Info/Warn/Error), or free-text search

**Why it matters:**
When debugging WebSocket issues, you need more than just message payloads. The Console shows you the full story — connection lifecycle, protocol negotiation, error details, and timing. It's the first place to look when something goes wrong.

**Console vs Events:**
- **Events** tab: Shows WebSocket message frames (the data you send and receive)
- **Console** tab: Shows connection lifecycle, system events, and command output`,
    keyTerms: [
      { term: 'Lifecycle Event', definition: 'Connection state changes — open, close, error — logged automatically by the console.' },
      { term: 'Slash Command', definition: 'A console command prefixed with / (e.g. /send, /help, /clear) that triggers studio actions.' },
      { term: 'Category Filter', definition: 'Filter console entries by type: lifecycle, command, system, or handshake.' },
    ],
    diagram: `<svg viewBox="0 0 400 140" xmlns="http://www.w3.org/2000/svg">
  <rect x="20" y="10" width="360" height="120" rx="8" fill="var(--surface)" stroke="var(--border)" stroke-width="1"/>
  <text x="30" y="30" fill="var(--text-muted)" font-size="10" font-family="monospace">Console</text>
  <text x="30" y="50" fill="var(--info)" font-size="11" font-family="monospace">INFO  lifecycle  Connected to ws://localhost:9876</text>
  <text x="30" y="66" fill="var(--info)" font-size="11" font-family="monospace">INFO  handshake  Upgrade 101 Switching Protocols</text>
  <text x="30" y="82" fill="var(--text-muted)" font-size="11" font-family="monospace">DBG   command    /send {"hello":"world"}</text>
  <text x="30" y="98" fill="var(--warning)" font-size="11" font-family="monospace">WARN  lifecycle  Connection closed (1000)</text>
  <line x1="20" y1="108" x2="380" y2="108" stroke="var(--border)" stroke-width="1"/>
  <text x="30" y="122" fill="var(--text-muted)" font-size="11" font-family="monospace">› /help</text>
</svg>`,
  },

  steps: [
    // ── 1. Console Tab Overview ──────────────────────────────────
    {
      id: 'console-intro',
      title: 'The Console Tab',
      description: 'This is the Console tab on the right pane. It is your debugging command center — it logs connection events and lets you type slash commands.',
      highlight: WS.RIGHT_TAB_CONSOLE,
      action: async (ctx) => {
        await clickIfNotSelected(ctx, WS.MODE_CLIENT, 700);
        await clickIfNotSelected(ctx, WS.RIGHT_TAB_CONSOLE, 800);
        await clickIfNotSelected(ctx, WS.CONSOLE_VIEW_STRUCTURED, 600);
      },
    },

    // ── 2. /connect Command ──────────────────────────────────────
    {
      id: 'console-connect',
      title: '/connect Command',
      description: 'Type /connect with the current connection URL and port from the URL field (for example ws://localhost:9876 when that tab uses 9876) to connect directly from the console. Watch lifecycle events appear: connection opened, handshake details, and protocol info.',
      highlight: WS.CONSOLE_CMD_INPUT,
      preAction: async (ctx) => {
        // Guard: ensure Console tab + Structured view so lifecycle entries
        // are rendered with data-testid attributes and the command input is in DOM.
        await clickIfNotSelected(ctx, WS.MODE_CLIENT, 120);
        await clickIfNotSelected(ctx, WS.RIGHT_TAB_CONSOLE, 120);
        await clickIfNotSelected(ctx, WS.CONSOLE_VIEW_STRUCTURED, 120);
      },
      action: async (ctx) => {
        await typeAndSubmitConsoleCommand(ctx, `/connect ${resolveConnectUrlFromUi()}`);
        // Wait for a console entry to confirm the command was processed.
        // STATUS_CONNECTED is inside the Connect panel which may be unmounted
        // when the Send tab activates after a successful connection, so use
        // CONSOLE_ENTRY instead — it's always present in this tab's DOM.
        await ctx.waitFor(WS.CONSOLE_ENTRY, 3000);
        // Mark as connected so subsequent preActions skip the /connect command.
        // This step performs the visible demo connection — all later steps must
        // NOT repeat it via ensureConnectedWithConsole.
        _consoleConnected = true;
        await ctx.delay(800); // Pause so the user can read the lifecycle entries
      },
    },

    // ── 3. Lifecycle Events ──────────────────────────────────────
    {
      id: 'console-lifecycle',
      title: 'Lifecycle Events',
      description: 'The console captured the entire connection flow — open event, handshake headers, protocol negotiation. These lifecycle entries are invaluable for debugging connection issues.',
      highlight: WS.CONSOLE_ENTRY,
      preAction: async (ctx) => {
        // Guard: ensure Console tab is active and entries exist.
        // Connects silently via /connect if no connection is active (skip-to-step guard).
        await ensureConnectedWithConsole(ctx);
      },
    },

    // ── 4. Category Filter ───────────────────────────────────────
    {
      id: 'console-categories',
      title: 'Category Filter',
      description: 'Use the category dropdown to filter by event type. Try selecting "Lifecycle" to see only connection open/close events, or "Handshake" to see protocol negotiation details.',
      highlight: WS.CONSOLE_CATEGORY,
      preAction: async (ctx) => {
        // Guard: ensure Console tab is active with entries to filter
        await ensureConnectedWithConsole(ctx);
      },
      action: async (ctx) => {
        await ctx.click(WS.CONSOLE_CATEGORY);
        await ctx.delay(120);
        await ctx.click(WS.CONSOLE_CATEGORY_OPT_LIFECYCLE);
      },
    },

    // ── 5. /send Command ─────────────────────────────────────────
    {
      id: 'console-send',
      title: '/send Command',
      description: 'Type /send followed by a message to send data through the WebSocket — right from the console. The command is echoed, and you can see the result in both Console and Events tabs.',
      highlight: WS.CONSOLE_CMD_INPUT,
      preAction: async (ctx) => {
        // Guard: ensure connected so /send succeeds; reset category filter to show all
        await ensureConnectedWithConsole(ctx);
        await ctx.click(WS.CONSOLE_CATEGORY);
        await ctx.delay(120);
        await ctx.click(WS.CONSOLE_CATEGORY_OPT_ALL);
        await ctx.delay(150);
      },
      action: async (ctx) => {
        await typeAndSubmitConsoleCommand(ctx, '/send {"demo": "console command"}');
      },
    },

    // ── 6. /help Command ─────────────────────────────────────────
    {
      id: 'console-help',
      title: '/help Command',
      description: 'Type /help to see all available slash commands. Each command shows its usage and description — /send, /connect, /disconnect, /ping, /close, /clear, and /template.',
      highlight: WS.CONSOLE_CMD_INPUT,
      preAction: async (ctx) => {
        // Guard: ensure Console tab active with entries visible.
        // Reset category filter (step 4 may have set it to 'lifecycle') so /help output is visible.
        await ensureConnectedWithConsole(ctx);
        await ctx.click(WS.CONSOLE_CATEGORY);
        await ctx.delay(120);
        await ctx.click(WS.CONSOLE_CATEGORY_OPT_ALL);
        await ctx.delay(150);
      },
      action: async (ctx) => {
        await typeAndSubmitConsoleCommand(ctx, '/help');
      },
    },

    // ── 7. /clear Command ────────────────────────────────────────
    {
      id: 'console-clear',
      title: '/clear Command',
      description: 'Type /clear or click the Clear button to wipe the console log. This is useful when you want a clean slate before testing a specific scenario.',
      highlight: WS.CONSOLE_CLEAR,
      preAction: async (ctx) => {
        // Guard: ensure Console tab is active with visible entries for context
        await ensureConnectedWithConsole(ctx);
      },
    },

    // ── 8. Search ────────────────────────────────────────────────
    {
      id: 'console-search',
      title: 'Search Console',
      description: 'The console has its own search bar, independent from the Events search. Type a keyword to instantly filter the log entries. The counter shows how many entries match.',
      highlight: WS.CONSOLE_SEARCH,
      preAction: async (ctx) => {
        // Guard: ensure Console tab active with entries to search; reset category filter
        await ensureConnectedWithConsole(ctx);
        await ctx.click(WS.CONSOLE_CATEGORY);
        await ctx.delay(120);
        await ctx.click(WS.CONSOLE_CATEGORY_OPT_ALL);
        await ctx.delay(150);
      },
      action: async (ctx) => {
        await ctx.fill(WS.CONSOLE_SEARCH, 'connect');
      },
    },

    // ── 9. Structured vs Raw View ────────────────────────────────
    {
      id: 'console-views',
      title: 'Structured vs Raw View',
      description: 'Toggle between Structured view (severity badges, categories, expandable details) and Raw view (plain text timeline, ideal for copy-paste). Try clicking Raw to see the difference.',
      highlight: WS.CONSOLE_VIEW_RAW,
      preAction: async (ctx) => {
        // Guard: ensure Console tab active with entries; clear the search from step 8
        await ensureConnectedWithConsole(ctx);
        await ctx.fill(WS.CONSOLE_SEARCH, '');
        await ctx.delay(150);
      },
      action: async (ctx) => {
        await ctx.click(WS.CONSOLE_VIEW_RAW);
      },
    },
  ],
};
