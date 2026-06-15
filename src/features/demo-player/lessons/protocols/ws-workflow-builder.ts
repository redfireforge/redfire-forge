/**
 * Lesson 9: Workflow Builder — build a real WebSocket workflow from scratch.
 *
 * Interactive lesson that creates a new workflow, adds WS Connect + WS Send +
 * WS Receive nodes from the palette, connects them with edges, configures
 * each node, and runs Quick Test.
 */
import type { DemoActionContext, DemoLesson } from '../../types';
import { WF, WFR } from '../../../../shared/selectors';

// ── Helpers ────────────────────────────────────────────────────────

/** Start mock server via REST API (no tab navigation needed). */
async function workflowSetup(ctx: DemoActionContext): Promise<void> {
  // Remove any existing "WS Echo Demo" workflow so each run starts with a clean canvas
  const wfDelete = (window as unknown as Record<string, unknown>).__wfDeleteByName as ((name: string) => void) | undefined;
  if (wfDelete) { wfDelete('WS Echo Demo'); await ctx.delay(300); }

  try {
    await fetch('/api/ws/mock/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ port: 9876 }) });
  } catch { /* server may already be running */ }
  await ctx.delay(500);
}

/** Clean up: close any open config modals, stop mock server, remove demo workflow. */
async function workflowCleanup(ctx: DemoActionContext): Promise<void> {
  // Close any open config modals
  const cfgSave = document.querySelector(WF.CFG_SAVE) as HTMLElement | null;
  if (cfgSave) { cfgSave.click(); await ctx.delay(300); }
  const cfgClose = document.querySelector(WF.CFG_CLOSE) as HTMLElement | null;
  if (cfgClose) { cfgClose.click(); await ctx.delay(300); }
  // Stop mock server via API
  try { await fetch('/api/ws/mock/stop', { method: 'POST' }); } catch { /* ignore */ }
  // Remove the demo workflow so next run starts fresh
  const wfDelete = (window as unknown as Record<string, unknown>).__wfDeleteByName as ((name: string) => void) | undefined;
  if (wfDelete) wfDelete('WS Echo Demo');
}

/** Scroll an element into its scrollable parent, then return it. */
function scrollIntoParent(selector: string): HTMLElement | null {
  const el = document.querySelector(selector) as HTMLElement | null;
  if (el) el.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
  return el;
}

/** Double-click a node on the canvas to open its config modal. */
async function doubleClickNode(selector: string): Promise<void> {
  const node = scrollIntoParent(selector);
  if (node) {
    node.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
  }
}

/** Get node ID by React Flow node type class. */
function getNodeId(typeSelector: string): string | null {
  const node = document.querySelector(typeSelector);
  return node?.getAttribute('data-id') ?? null;
}

/** Click "Fit view" to auto-layout all nodes nicely on the canvas. */
async function clickFitView(ctx: DemoActionContext): Promise<void> {
  const btn = document.querySelector('button[title="Fit view"]') as HTMLElement | null;
  if (btn) { btn.click(); await ctx.delay(500); }
}

/** Connect two nodes via the exposed __wfConnect helper. */
function connectNodes(sourceSelector: string, targetSelector: string, sourceHandle: string | null = null): boolean {
  const sourceId = getNodeId(sourceSelector);
  const targetId = getNodeId(targetSelector);
  const wfConnect = (window as unknown as Record<string, unknown>).__wfConnect as
    ((s: string, t: string, sh: string | null, th: string | null) => void) | undefined;
  if (sourceId && targetId && wfConnect) {
    wfConnect(sourceId, targetId, sourceHandle, null);
    return true;
  }
  return false;
}

export const wsWorkflowBuilderLesson: DemoLesson = {
  id: 'ws-workflow-builder',
  domainId: 'protocols',
  category: 'websocket',
  name: 'Workflow Builder',
  description: 'Build visual WebSocket automation workflows with drag-and-drop nodes, then run them instantly.',
  estimatedMinutes: 3,
  initialTab: 'workflow',

  setup: workflowSetup,
  cleanup: workflowCleanup,

  concept: {
    title: 'Visual Workflow Automation',
    body: `The Workflow Designer lets you build multi-step WebSocket automation without writing code. Drag nodes from the palette, connect them with edges, and run with one click.

**WebSocket Nodes**

- **WS Connect** — Establish a connection to a WebSocket server (URL, headers, subprotocols)
- **WS Send** — Send a message (text/binary) over an existing connection
- **WS Receive** — Wait for a message matching criteria (timeout, JSONPath extraction)
- **WS Trigger** — Start a workflow when a WebSocket message arrives

**Building Workflows**

- Drag nodes from the palette onto the canvas
- Connect outputs → inputs by dragging edges between nodes
- Double-click any node to configure it (URL, message, extraction rules)
- Use \`{{variable}}\` syntax for dynamic values

**Running & Debugging**

- **Quick Test** — Run the entire workflow instantly against real servers
- **Debug Mode** (Cmd+Shift+Enter) — Step through nodes one by one
- **Console** — See execution logs, errors, and timing for each node
- **Harness** — Run the workflow as a load test with configurable concurrency`,
    keyTerms: [
      { term: 'Node', definition: 'A single step in a workflow — each node performs one action (connect, send, receive, etc.).' },
      { term: 'Edge', definition: 'A connection between two nodes that defines execution order.' },
      { term: 'Quick Test', definition: 'One-click execution of the entire workflow against real endpoints.' },
      { term: 'Variable', definition: 'A dynamic value extracted from one node and used in another, e.g. {{response.body}}.' },
    ],
    diagram: `<svg viewBox="0 0 400 130" xmlns="http://www.w3.org/2000/svg" style="font-family:system-ui,sans-serif">
  <rect x="0" y="0" width="400" height="130" rx="8" fill="#1e1e2e" />
  <rect x="10" y="10" width="70" height="110" rx="4" fill="#2a2a3a" />
  <text x="45" y="28" text-anchor="middle" fill="#888" font-size="8">Palette</text>
  <rect x="16" y="34" width="58" height="16" rx="2" fill="#1e3a5f" />
  <text x="45" y="45" text-anchor="middle" fill="#60a5fa" font-size="7">WS Connect</text>
  <rect x="16" y="54" width="58" height="16" rx="2" fill="#1e3a5f" />
  <text x="45" y="65" text-anchor="middle" fill="#60a5fa" font-size="7">WS Send</text>
  <rect x="16" y="74" width="58" height="16" rx="2" fill="#1e3a5f" />
  <text x="45" y="85" text-anchor="middle" fill="#60a5fa" font-size="7">WS Receive</text>
  <rect x="16" y="94" width="58" height="16" rx="2" fill="#2a2a3a" stroke="#555" stroke-width="0.5" />
  <text x="45" y="105" text-anchor="middle" fill="#888" font-size="7">+ more…</text>
  <rect x="90" y="10" width="220" height="110" rx="4" fill="#252535" stroke="#333" stroke-width="0.5" />
  <rect x="105" y="30" width="60" height="28" rx="4" fill="#1e3a5f" stroke="#60a5fa" stroke-width="1" />
  <text x="135" y="48" text-anchor="middle" fill="#60a5fa" font-size="8">Connect</text>
  <line x1="165" y1="44" x2="195" y2="44" stroke="#60a5fa" stroke-width="1.5" marker-end="url(#arrowBlue)" />
  <rect x="195" y="30" width="50" height="28" rx="4" fill="#1e3a5f" stroke="#60a5fa" stroke-width="1" />
  <text x="220" y="48" text-anchor="middle" fill="#60a5fa" font-size="8">Send</text>
  <line x1="245" y1="44" x2="255" y2="44" stroke="#60a5fa" stroke-width="1.5" />
  <line x1="255" y1="44" x2="255" y2="80" stroke="#60a5fa" stroke-width="1.5" />
  <line x1="255" y1="80" x2="235" y2="80" stroke="#60a5fa" stroke-width="1.5" marker-end="url(#arrowBlue)" />
  <rect x="175" y="66" width="60" height="28" rx="4" fill="#1e3a5f" stroke="#22c55e" stroke-width="1" />
  <text x="205" y="84" text-anchor="middle" fill="#22c55e" font-size="8">Receive</text>
  <rect x="320" y="10" width="70" height="110" rx="4" fill="#2a2a3a" />
  <text x="355" y="30" text-anchor="middle" fill="#888" font-size="8">Run</text>
  <rect x="330" y="38" width="50" height="22" rx="4" fill="#2563eb" />
  <text x="355" y="53" text-anchor="middle" fill="#fff" font-size="8">▶ Quick</text>
  <rect x="330" y="66" width="50" height="22" rx="4" fill="#2a2a3a" stroke="#555" stroke-width="0.5" />
  <text x="355" y="81" text-anchor="middle" fill="#888" font-size="8">🐛 Debug</text>
  <rect x="330" y="94" width="50" height="18" rx="3" fill="#2a2a3a" stroke="#555" stroke-width="0.5" />
  <text x="355" y="107" text-anchor="middle" fill="#666" font-size="7">Console</text>
  <defs>
    <marker id="arrowBlue" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
      <path d="M0,0 L6,3 L0,6 Z" fill="#60a5fa" />
    </marker>
  </defs>
</svg>`,
  },

  steps: [
    // ── 1. Create a New Workflow ──────────────────────────────────
    {
      id: 'wf-create',
      title: 'Create a New Workflow',
      description:
        'Click "+ New" in the sidebar to create a blank workflow. We\'ll name it "WS Echo Demo".',
      highlight: WF.SIDEBAR_NEW_BTN,
      action: async (ctx) => {
        // Click "+ New" button
        await ctx.click(WF.SIDEBAR_NEW_BTN);
        await ctx.delay(400);
        // Click "Blank Workflow" in the dropdown
        await ctx.click(WF.NEW_BLANK_ITEM);
        await ctx.delay(400);
        // Fill the workflow name and create
        await ctx.fill(WF.CREATE_INPUT, 'WS Echo Demo');
        await ctx.delay(200);
        await ctx.click(WF.CREATE_OK);
        await ctx.delay(800);
      },
      verify: WF.CANVAS,
      pauseAfter: true,
    },

    // ── 2. Explore the Palette ───────────────────────────────────
    {
      id: 'wf-palette',
      title: 'Node Palette',
      description:
        'The palette shows all available node types. Scroll down to the Actions category — you\'ll see WS Connect, WS Send, and WS Receive. Click any node to add it to the canvas.',
      highlight: WF.PALETTE,
      preAction: async (ctx) => {
        // Dismiss onboarding tips if present
        const skipBtn = document.querySelector('.onboarding-tooltip-skip') as HTMLElement | null;
        if (skipBtn) { skipBtn.click(); await ctx.delay(300); }
      },
      pauseAfter: true,
    },

    // ── 3. Add WS Connect Node + Edge ────────────────────────────
    {
      id: 'wf-add-connect',
      title: 'Add a WS Connect Node',
      description:
        'Click "WS Connect" in the palette to add a connection node, then connect it to Start. This node establishes a WebSocket connection when the workflow runs.',
      highlight: WF.PAL_WS_CONNECT,
      preAction: async () => { scrollIntoParent(WF.PAL_WS_CONNECT); },
      action: async (ctx) => {
        scrollIntoParent(WF.PAL_WS_CONNECT);
        await ctx.click(WF.PAL_WS_CONNECT);
        await ctx.delay(600);
        // Connect Start → WS Connect
        connectNodes('.react-flow__node-start', WF.NODE_WS_CONNECT, 'out');
        await ctx.delay(400);
        await clickFitView(ctx);
      },
      verify: WF.NODE_WS_CONNECT,
      pauseAfter: true,
    },

    // ── 4. Configure the Connection ──────────────────────────────
    {
      id: 'wf-config-connect',
      title: 'Configure the Connection',
      description:
        'Double-click the WS Connect node to open its config. Instead of a hard-coded URL, type `{{wsUrl}}` — a variable placeholder. This lets you override the endpoint from Workflow Runner without editing the workflow.',
      highlight: WF.NODE_WS_CONNECT,
      action: async (ctx) => {
        // Double-click to open config
        await doubleClickNode(WF.NODE_WS_CONNECT);
        await ctx.delay(600);
        // Fill URL with a variable placeholder
        await ctx.fill(WF.CFG_WS_URL, '{{wsUrl}}');
        await ctx.delay(300);
        // Save config
        await ctx.click(WF.CFG_SAVE);
        await ctx.delay(400);
      },
      pauseAfter: true,
    },

    // ── 4b. Define the wsUrl variable ────────────────────────────
    {
      id: 'wf-define-variable',
      title: 'Define the wsUrl Variable',
      description:
        'Open the Variables panel from the toolbar. Add `wsUrl = ws://localhost:9876` as the default value. This tells the workflow which server to use unless the runner overrides it.',
      highlight: WF.VARIABLES_BTN,
      action: async (ctx) => {
        // Open Variables modal
        await ctx.click(WF.VARIABLES_BTN);
        await ctx.delay(600);
        // Fill name input in the new-var row
        await ctx.fill(WF.DEFAULTS_NEW_KEY, 'wsUrl');
        await ctx.delay(200);
        // Fill value input
        await ctx.fill(WF.DEFAULTS_NEW_VAL, 'ws://localhost:9876');
        await ctx.delay(200);
        // Click + to add the variable
        await ctx.click(WF.DEFAULTS_ADD_BTN);
        await ctx.delay(300);
        // Save the modal
        await ctx.click(WF.DEFAULTS_SAVE_BTN);
        await ctx.delay(400);
      },
      pauseAfter: true,
    },

    // ── 5. Add WS Send Node + Edge ───────────────────────────────
    {
      id: 'wf-add-send',
      title: 'Add a WS Send Node',
      description:
        'Click "WS Send" in the palette to add a send node and connect it after WS Connect. This node sends a message over the established connection.',
      highlight: WF.PAL_WS_SEND,
      preAction: async () => { scrollIntoParent(WF.PAL_WS_SEND); },
      action: async (ctx) => {
        scrollIntoParent(WF.PAL_WS_SEND);
        await ctx.click(WF.PAL_WS_SEND);
        await ctx.delay(600);
        // Connect WS Connect → WS Send
        connectNodes(WF.NODE_WS_CONNECT, WF.NODE_WS_SEND);
        await ctx.delay(400);
        await clickFitView(ctx);
      },
      verify: WF.NODE_WS_SEND,
      pauseAfter: true,
    },

    // ── 6. Configure the Message ─────────────────────────────────
    {
      id: 'wf-config-send',
      title: 'Configure the Message',
      description:
        'Double-click the WS Send node to configure it. Enter a JSON message — the echo server will bounce it right back.',
      highlight: WF.NODE_WS_SEND,
      action: async (ctx) => {
        // Double-click to open config
        await doubleClickNode(WF.NODE_WS_SEND);
        await ctx.delay(600);
        // Fill message
        await ctx.fill(WF.CFG_WS_MSG, '{"action": "hello", "from": "workflow"}');
        await ctx.delay(300);
        // Save config
        await ctx.click(WF.CFG_SAVE);
        await ctx.delay(400);
      },
      pauseAfter: true,
    },

    // ── 7. Add WS Receive Node + Edge ────────────────────────────
    {
      id: 'wf-add-receive',
      title: 'Add a WS Receive Node',
      description:
        'Click "WS Receive" in the palette to add a receive node and connect it after WS Send. This node waits for the echo server\'s response message.',
      highlight: WF.PAL_WS_RECEIVE,
      preAction: async () => { scrollIntoParent(WF.PAL_WS_RECEIVE); },
      action: async (ctx) => {
        scrollIntoParent(WF.PAL_WS_RECEIVE);
        await ctx.click(WF.PAL_WS_RECEIVE);
        await ctx.delay(600);
        // Connect WS Send → WS Receive
        connectNodes(WF.NODE_WS_SEND, WF.NODE_WS_RECEIVE);
        await ctx.delay(400);
        await clickFitView(ctx);
      },
      verify: WF.NODE_WS_RECEIVE,
      pauseAfter: true,
    },

    // ── 8. Configure the Receive ─────────────────────────────────
    {
      id: 'wf-config-receive',
      title: 'Configure the Receive',
      description:
        'Double-click the WS Receive node. It will wait up to 5 seconds for a response containing our message. The echo server mirrors everything back.',
      highlight: WF.NODE_WS_RECEIVE,
      action: async (ctx) => {
        // Double-click to open config
        await doubleClickNode(WF.NODE_WS_RECEIVE);
        await ctx.delay(600);
        // Set a short timeout — use ctx.fill so React controlled input updates properly
        await ctx.fill(WF.WS_RECEIVE_CFG + ' input[type="number"]', '5000');
        await ctx.delay(300);
        // Save config
        await ctx.click(WF.CFG_SAVE);
        await ctx.delay(400);
      },
      pauseAfter: true,
    },

    // ── 9. Run Quick Test ────────────────────────────────────────
    {
      id: 'wf-quick-test',
      title: 'Quick Test',
      description:
        'Click Quick Test to run the workflow. Watch the nodes light up as each step executes — Connect opens the WebSocket, Send delivers your message, and Receive captures the echo response.',
      highlight: WF.QUICK_TEST_BTN,
      action: async (ctx) => {
        // Fit view and save before running
        await clickFitView(ctx);
        const saveBtn = document.querySelector('.wf-toolbar-save-wrap button') as HTMLElement | null;
        if (saveBtn) { saveBtn.click(); await ctx.delay(400); }
        await ctx.click(WF.QUICK_TEST_BTN);
        await ctx.delay(3000);
      },
      verify: WF.EXEC_SUMMARY,
      pauseAfter: true,
    },

    // ── 10. Workflow Runner — override the URL at runtime ────────
    {
      id: 'wf-runner-variable',
      title: 'Override the URL in Workflow Runner',
      description:
        'Navigate to Workflow Runner and select "WS Echo Demo". The `wsUrl` variable appears in the **Initial Variables** panel. Change it to any WebSocket endpoint — the workflow runs against that server without modifying the definition.',
      preAction: async (ctx) => {
        ctx.navigateToTab('workflow-runner');
        await ctx.delay(800);
      },
      action: async (ctx) => {
        // Select the WS Echo Demo workflow in the runner picker
        const picker = document.querySelector('[data-testid="workflow-select"]') as HTMLElement | null;
        if (picker) { picker.click(); await ctx.delay(400); }
        const items = Array.from(document.querySelectorAll('.wft-dropdown-item'));
        const demoItem = items.find((el) => el.textContent?.includes('WS Echo Demo')) as HTMLElement | undefined;
        if (demoItem) { demoItem.click(); await ctx.delay(600); }
        // Highlight the wsUrl variable input
        const varInputs = Array.from(document.querySelectorAll(WFR.VAR_INPUT)) as HTMLInputElement[];
        const wsUrlInput = varInputs[0];
        if (wsUrlInput) wsUrlInput.focus();
        await ctx.delay(500);
      },
      highlight: WFR.VAR_ROW,
      pauseAfter: true,
    },
  ],
};
