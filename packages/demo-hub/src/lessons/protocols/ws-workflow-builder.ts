/**
 * Lesson 8: Workflow Builder — build a real WebSocket workflow from scratch.
 *
 * Interactive lesson that creates a new workflow, adds WS Connect + WS Send +
 * WS Receive nodes from the palette, connects them with edges, configures
 * each node, and runs Quick Test.
 */
import type { DemoActionContext, DemoLesson } from '../../types';
import { WF, WFR } from '@shared/selectors';
import { showSpotlightRing } from '../../demoRipple';
import {
  collapseWfDemoAppSidebar,
  closeWfConfigModalIfOpen,
  createBlankWorkflowFromSidebar,
  ensureLessonBlankWorkflow,
  expandWfDemoAppSidebar,
  fillWfConfigField,
  isLessonWorkflowDisplayed,
  openWfNodeConfigModal,
  revealPaletteBlock,
  saveAndCloseWfConfigModal,
  waitForLessonWorkflowSelected,
  waitForWfConfigPanel,
} from '../wf-demo-helpers';
import { connectWorkflowNodes, deleteWorkflowByName } from '../../adapters';

const WF_NAME = 'WS Echo Demo';
/** Hold on an outcome so the step highlight / result can be read (no flash rings). */
const OUTCOME_PAUSE_MS = 1200;

// ── Helpers ────────────────────────────────────────────────────────

/** Dismiss onboarding tips when present. */
async function dismissWorkflowOnboarding(ctx: DemoActionContext): Promise<void> {
  const skipBtn = document.querySelector('.onboarding-tooltip-skip') as HTMLElement | null;
  if (skipBtn) { skipBtn.click(); await ctx.delay(300); }
}

/** Quietly ensure "WS Echo Demo" is the displayed workflow (Rule 4 skip guard). */
async function ensureWsEchoDemoWorkflow(ctx: DemoActionContext): Promise<void> {
  await ensureLessonBlankWorkflow(ctx, WF_NAME, { dismissOnboarding: dismissWorkflowOnboarding });
}

/** Start mock server via REST API (no tab navigation needed). */
async function workflowSetup(_ctx: DemoActionContext): Promise<void> {
  // Remove any existing "WS Echo Demo" workflow so each run starts clean.
  deleteWorkflowByName(WF_NAME);
  // Fire-and-forget mock server start — the server is usually already running;
  // if it needs to start, the readingSync + later steps will wait as needed.
  fetch('/api/ws/mock/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ port: 9876 }) }).catch(() => {});
}

/** Clean up: close any open config modals, stop mock server, remove demo workflow. */
async function workflowCleanup(ctx: DemoActionContext): Promise<void> {
  await closeWfConfigModalIfOpen(ctx);
  // Close Variables modal if still open
  const defaultsCancel = document.querySelector<HTMLElement>('.wf-defaults-modal .btn-ghost');
  if (defaultsCancel) { defaultsCancel.click(); await ctx.delay(200); }
  try { await fetch('/api/ws/mock/stop', { method: 'POST' }); } catch { /* ignore */ }
  deleteWorkflowByName(WF_NAME);
  await collapseWfDemoAppSidebar(ctx);
}

/** Scroll an element into its scrollable parent, then return it. */
function scrollIntoParent(selector: string): HTMLElement | null {
  const el = document.querySelector(selector) as HTMLElement | null;
  if (el) el.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
  return el;
}

/** Spotlight a DOM element for `ms` ms so the viewer can see it before the next action. */
async function spotlightEl(ctx: DemoActionContext, elOrSelector: HTMLElement | string, ms = 900): Promise<void> {
  const el = typeof elOrSelector === 'string'
    ? document.querySelector<HTMLElement>(elOrSelector)
    : elOrSelector;
  if (!el) return;
  const dispose = showSpotlightRing(el);
  await ctx.delay(ms);
  dispose();
}

/** Click "Fit view" to auto-layout all nodes nicely on the canvas. */
async function clickFitView(ctx: DemoActionContext): Promise<void> {
  const btn = document.querySelector('button[title="Fit view"]') as HTMLElement | null;
  if (btn) { btn.click(); await ctx.delay(500); }
}

/** Connect two nodes via the workflow designer adapter. */
function connectNodes(sourceSelector: string, targetSelector: string, sourceHandle: string | null = null): boolean {
  const node = document.querySelector(sourceSelector);
  const sourceId = node?.getAttribute('data-id') ?? node?.closest('.react-flow__node')?.getAttribute('data-id') ?? null;
  const targetEl = document.querySelector(targetSelector);
  const targetId = targetEl?.getAttribute('data-id') ?? targetEl?.closest('.react-flow__node')?.getAttribute('data-id') ?? null;
  if (sourceId && targetId) {
    return connectWorkflowNodes(sourceId, targetId, sourceHandle, null);
  }
  return false;
}

/** Quiet guard: ensure workflow + close stray overlays before canvas/palette steps. */
async function ensureCanvasReady(ctx: DemoActionContext): Promise<void> {
  ctx.navigateToTab('workflow');
  await ctx.delay(80);
  await closeWfConfigModalIfOpen(ctx);
  await ensureWsEchoDemoWorkflow(ctx);
  await dismissWorkflowOnboarding(ctx);
  await collapseWfDemoAppSidebar(ctx);
}

export const wsWorkflowBuilderLesson: DemoLesson = {
  id: 'ws-workflow-builder',
  domainId: 'protocols',
  category: 'websocket',
  name: 'Workflow Builder',
  description: 'Build visual WebSocket automation workflows with drag-and-drop nodes, then run them instantly.',
  estimatedMinutes: 5,
  initialTab: 'workflow',
  allowedTabs: ['workflow', 'workflow-runner'],
  // Designer-only — do not wait for WebSocket Studio tab chrome during Preparing.
  skipStudioTabIsolation: true,

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
        'Click **+ New** in the sidebar, choose **Blank Workflow**, and name it **WS Echo Demo**. ' +
        'The canvas opens with **Start** and **End** nodes ready for your WebSocket steps.',
      highlight: WF.SIDEBAR_NEW_BTN,
      preAction: async (ctx) => {
        ctx.navigateToTab('workflow');
        await ctx.delay(150);
      },
      readingSync: async (ctx) => {
        // Run quietly in parallel with reading so "Reading…" shows immediately.
        await dismissWorkflowOnboarding(ctx);
        await expandWfDemoAppSidebar(ctx);
        // Pre-delete any leftover workflow so + New opens a clean form.
        deleteWorkflowByName(WF_NAME);
        await ctx.delay(150);
      },
      action: async (ctx) => {
        await dismissWorkflowOnboarding(ctx);
        await ctx.delay(300);

        // Visible create tour — helper refuses to treat a foreign open canvas as success.
        const created = await createBlankWorkflowFromSidebar(ctx, WF_NAME);
        if (!created && !isLessonWorkflowDisplayed(WF_NAME)) {
          // Sidebar UI failed (common when + New is collapsed/missing) — seed + select.
          await ensureWsEchoDemoWorkflow(ctx);
        }
        await waitForLessonWorkflowSelected(ctx, WF_NAME, 5000);
        await ctx.delay(OUTCOME_PAUSE_MS);
      },
      verify: WF.CANVAS,
      pauseAfter: true,
    },

    // ── 2. Explore the Palette ───────────────────────────────────
    {
      id: 'wf-palette',
      title: 'Node Palette',
      description:
        'Type **WS** in the palette search bar. Matching WebSocket blocks — **WS Trigger**, **WS Connect**, ' +
        '**WS Send**, and **WS Receive** — appear together so you can grab the ones you need.',
      highlight: `${WF.PAL_SEARCH}, .wf-palette-blocks`,
      preAction: async (ctx) => {
        await ensureCanvasReady(ctx);
      },
      action: async (ctx) => {
        await ctx.waitFor(WF.PAL_SEARCH, 5000);
        // Spotlight the search bar, type WS, then hold so the typed filter is readable.
        await spotlightEl(ctx, WF.PAL_SEARCH, 800);
        await ctx.fill(WF.PAL_SEARCH, 'WS');
        await spotlightEl(ctx, WF.PAL_SEARCH, 1200);
        // Then highlight the filtered blocks as one group.
        await ctx.delay(400);
        const blocks = document.querySelector<HTMLElement>('.wf-palette-blocks');
        if (blocks) {
          blocks.classList.add('demo-palette-block-highlight');
          await spotlightEl(ctx, blocks, 1200);
        } else {
          await ctx.delay(1200);
        }
      },
      pauseAfter: true,
    },

    // ── 3. Add WS Connect Node + Edge ────────────────────────────
    {
      id: 'wf-add-connect',
      title: 'Add a WS Connect Node',
      description:
        'Click **WS Connect** in the palette to place a connection node, then wire **Start → WS Connect**. ' +
        'This node opens the WebSocket when the workflow runs.',
      highlight: WF.PAL_WS_CONNECT,
      preAction: async (ctx) => {
        // Clear palette block highlight from the previous step.
        document.querySelectorAll('.demo-palette-block-highlight').forEach((el) => {
          el.classList.remove('demo-palette-block-highlight');
        });
        await ensureCanvasReady(ctx);
        await revealPaletteBlock(ctx, WF.PAL_WS_CONNECT, { quiet: true });
      },
      action: async (ctx) => {
        // 1. Reveal palette block — spotlight chip badge then the block itself.
        const block = await revealPaletteBlock(ctx, WF.PAL_WS_CONNECT, { showNav: true, spotlightChip: true });
        await spotlightEl(ctx, block ?? WF.PAL_WS_CONNECT, 900);
        await ctx.click(WF.PAL_WS_CONNECT);
        // 2. Node lands on canvas — spotlight it before wiring.
        await ctx.waitFor(WF.NODE_WS_CONNECT, 8000);
        await spotlightEl(ctx, WF.NODE_WS_CONNECT, OUTCOME_PAUSE_MS);
        // 3. Spotlight the Start node to show what we're connecting from.
        await spotlightEl(ctx, '.react-flow__node-start', 700);
        // 4. Draw the edge — pause so viewer sees it appear.
        connectNodes('.react-flow__node-start', WF.NODE_WS_CONNECT, 'out');
        await ctx.delay(800);
        // 5. Fit view and pause on the final layout.
        await clickFitView(ctx);
        await ctx.delay(OUTCOME_PAUSE_MS);
      },
      verify: WF.NODE_WS_CONNECT,
      pauseAfter: true,
    },

    // ── 4. Define the wsUrl Variable ─────────────────────────────
    {
      id: 'wf-define-variable',
      title: 'Define the wsUrl Variable',
      description:
        'Open **Variables** from the toolbar. Add `wsUrl = ws://localhost:9876` as the default. ' +
        'Later steps (and Workflow Runner) can override this without editing the workflow.',
      highlight: WF.VARIABLES_BTN,
      preAction: async (ctx) => {
        ctx.navigateToTab('workflow');
        await ctx.delay(400);
        await closeWfConfigModalIfOpen(ctx);
        await dismissWorkflowOnboarding(ctx);
      },
      action: async (ctx) => {
        // 1. Click Variables toolbar button to open the modal.
        await ctx.click(WF.VARIABLES_BTN);
        await ctx.waitFor(WF.DEFAULTS_MODAL, 5000);
        await ctx.delay(600);

        // 2. Spotlight the Name field → fill it.
        await spotlightEl(ctx, WF.DEFAULTS_NEW_KEY, 800);
        await ctx.fill(WF.DEFAULTS_NEW_KEY, 'wsUrl');
        await ctx.delay(400);

        // 3. Spotlight the Value field → fill it.
        await spotlightEl(ctx, WF.DEFAULTS_NEW_VAL, 800);
        await ctx.fill(WF.DEFAULTS_NEW_VAL, 'ws://localhost:9876');
        await ctx.delay(400);

        // 4. Spotlight the Add button → click it.
        await spotlightEl(ctx, WF.DEFAULTS_ADD_BTN, 700);
        await ctx.click(WF.DEFAULTS_ADD_BTN);
        await ctx.delay(OUTCOME_PAUSE_MS);

        // 5. Spotlight the saved row to confirm the variable was added.
        const savedRow = document.querySelector<HTMLElement>('.wf-defaults-modal .wf-var-row');
        if (savedRow) await spotlightEl(ctx, savedRow, OUTCOME_PAUSE_MS);

        // 6. Spotlight Save → click it.
        await spotlightEl(ctx, WF.DEFAULTS_SAVE_BTN, 700);
        await ctx.click(WF.DEFAULTS_SAVE_BTN);
        await ctx.delay(700);
      },
      pauseAfter: true,
    },

    // ── 5. Configure the Connection ──────────────────────────────
    {
      id: 'wf-config-connect',
      title: 'Configure the Connection',
      description:
        'Double-click the **WS Connect** node. In the URL field, type `{{wsUrl}}` to use the variable you just defined. ' +
        'This lets Workflow Runner override the endpoint without editing the workflow.',
      // Field-level highlight (modal is opened in preAction so this is visible while reading).
      highlight: WF.CFG_WS_URL,
      preAction: async (ctx) => {
        ctx.navigateToTab('workflow');
        await ctx.delay(300);
        await closeWfConfigModalIfOpen(ctx);
        if (!document.querySelector(WF.NODE_WS_CONNECT)) return;
        scrollIntoParent(WF.NODE_WS_CONNECT);
        await openWfNodeConfigModal(ctx, { nodeSelector: WF.NODE_WS_CONNECT });
        await ctx.waitFor(WF.CFG_WS_URL, 8000);
      },
      action: async (ctx) => {
        await waitForWfConfigPanel(ctx, WF.CFG_WS_URL);
        // fillWfConfigField applies a persistent field highlight + pause.
        await fillWfConfigField(ctx, WF.CFG_WS_URL, '{{wsUrl}}');
        await ctx.delay(OUTCOME_PAUSE_MS);
        await saveAndCloseWfConfigModal(ctx);
        await clickFitView(ctx);
        await ctx.delay(OUTCOME_PAUSE_MS);
      },
      pauseAfter: true,
    },

    // ── 6. Add WS Send Node + Edge ───────────────────────────────
    {
      id: 'wf-add-send',
      title: 'Add a WS Send Node',
      description:
        'Click **WS Send** in the palette and connect it after **WS Connect**. ' +
        'This node sends a message over the established connection.',
      highlight: WF.PAL_WS_SEND,
      preAction: async (ctx) => {
        await ensureCanvasReady(ctx);
        await revealPaletteBlock(ctx, WF.PAL_WS_SEND, { quiet: true });
      },
      action: async (ctx) => {
        // 1. Reveal palette block — spotlight chip badge then the block itself.
        const block = await revealPaletteBlock(ctx, WF.PAL_WS_SEND, { showNav: true, spotlightChip: true });
        await spotlightEl(ctx, block ?? WF.PAL_WS_SEND, 900);
        await ctx.click(WF.PAL_WS_SEND);
        // 2. Node lands on canvas — spotlight it before wiring.
        await ctx.waitFor(WF.NODE_WS_SEND, 8000);
        await spotlightEl(ctx, WF.NODE_WS_SEND, OUTCOME_PAUSE_MS);
        // 3. Spotlight WS Connect to show what we're connecting from.
        await spotlightEl(ctx, WF.NODE_WS_CONNECT, 700);
        // 4. Draw the edge — pause so viewer sees it appear.
        connectNodes(WF.NODE_WS_CONNECT, WF.NODE_WS_SEND);
        await ctx.delay(800);
        // 5. Fit view and pause on the final layout.
        await clickFitView(ctx);
        await ctx.delay(OUTCOME_PAUSE_MS);
      },
      verify: WF.NODE_WS_SEND,
      pauseAfter: true,
    },

    // ── 7. Configure the Message ─────────────────────────────────
    {
      id: 'wf-config-send',
      title: 'Configure the Message',
      description:
        'Double-click the **WS Send** node and enter a JSON message — the echo server will bounce it right back.',
      highlight: WF.CFG_WS_MSG,
      preAction: async (ctx) => {
        ctx.navigateToTab('workflow');
        await ctx.delay(300);
        await closeWfConfigModalIfOpen(ctx);
        if (!document.querySelector(WF.NODE_WS_SEND)) return;
        scrollIntoParent(WF.NODE_WS_SEND);
        await openWfNodeConfigModal(ctx, { nodeSelector: WF.NODE_WS_SEND });
        await ctx.waitFor(WF.CFG_WS_MSG, 8000);
      },
      action: async (ctx) => {
        await waitForWfConfigPanel(ctx, WF.CFG_WS_MSG);
        await fillWfConfigField(ctx, WF.CFG_WS_MSG, '{"action": "hello", "from": "workflow"}');
        await ctx.delay(OUTCOME_PAUSE_MS);
        await saveAndCloseWfConfigModal(ctx);
        await clickFitView(ctx);
        await ctx.delay(OUTCOME_PAUSE_MS);
      },
      pauseAfter: true,
    },

    // ── 8. Add WS Receive Node + Edge ────────────────────────────
    {
      id: 'wf-add-receive',
      title: 'Add a WS Receive Node',
      description:
        'Click **WS Receive** in the palette and connect it after **WS Send**. ' +
        'This node waits for the echo server\'s response message.',
      highlight: WF.PAL_WS_RECEIVE,
      preAction: async (ctx) => {
        await ensureCanvasReady(ctx);
        await revealPaletteBlock(ctx, WF.PAL_WS_RECEIVE, { quiet: true });
      },
      action: async (ctx) => {
        // 1. Reveal palette block — spotlight chip badge then the block itself.
        const block = await revealPaletteBlock(ctx, WF.PAL_WS_RECEIVE, { showNav: true, spotlightChip: true });
        await spotlightEl(ctx, block ?? WF.PAL_WS_RECEIVE, 900);
        await ctx.click(WF.PAL_WS_RECEIVE);
        // 2. Node lands on canvas — spotlight it before wiring.
        await ctx.waitFor(WF.NODE_WS_RECEIVE, 8000);
        await spotlightEl(ctx, WF.NODE_WS_RECEIVE, OUTCOME_PAUSE_MS);
        // 3. Wire from WS Send (no Send spotlight — focus stays on the new Receive node).
        connectNodes(WF.NODE_WS_SEND, WF.NODE_WS_RECEIVE);
        await ctx.delay(800);
        // 4. Fit view and pause on the final layout.
        await clickFitView(ctx);
        await ctx.delay(OUTCOME_PAUSE_MS);
      },
      verify: WF.NODE_WS_RECEIVE,
      pauseAfter: true,
    },

    // ── 9. Configure the Receive ─────────────────────────────────
    {
      id: 'wf-config-receive',
      title: 'Configure the Receive',
      description:
        'Double-click the **WS Receive** node. Set the timeout to **5000** ms so it waits up to 5 seconds for the echo. ' +
        'The echo server mirrors everything back.',
      highlight: `${WF.WS_RECEIVE_CFG} input[type="number"]`,
      preAction: async (ctx) => {
        ctx.navigateToTab('workflow');
        await ctx.delay(300);
        await closeWfConfigModalIfOpen(ctx);
        if (!document.querySelector(WF.NODE_WS_RECEIVE)) return;
        scrollIntoParent(WF.NODE_WS_RECEIVE);
        await openWfNodeConfigModal(ctx, { nodeSelector: WF.NODE_WS_RECEIVE });
        await ctx.waitFor(`${WF.WS_RECEIVE_CFG} input[type="number"]`, 8000);
      },
      action: async (ctx) => {
        const timeoutSel = `${WF.WS_RECEIVE_CFG} input[type="number"]`;
        await waitForWfConfigPanel(ctx, timeoutSel);
        await fillWfConfigField(ctx, timeoutSel, '5000');
        await ctx.delay(OUTCOME_PAUSE_MS);
        await saveAndCloseWfConfigModal(ctx);
        await clickFitView(ctx);
        await ctx.delay(OUTCOME_PAUSE_MS);
      },
      pauseAfter: true,
    },

    // ── 10. Run Quick Test ───────────────────────────────────────
    {
      id: 'wf-quick-test',
      title: 'Quick Test',
      description:
        'Click **Quick Test** to run the workflow. Watch the nodes light up — Connect opens the socket, ' +
        'Send delivers your message, and Receive captures the echo response.',
      highlight: WF.QUICK_TEST_BTN,
      preAction: async (ctx) => {
        ctx.navigateToTab('workflow');
        await ctx.delay(400);
        await closeWfConfigModalIfOpen(ctx);
        await dismissWorkflowOnboarding(ctx);
      },
      action: async (ctx) => {
        await clickFitView(ctx);
        const saveBtn = document.querySelector('.wf-toolbar-save-wrap button') as HTMLElement | null;
        if (saveBtn) { saveBtn.click(); await ctx.delay(400); }
        await ctx.click(WF.QUICK_TEST_BTN);
        await ctx.waitFor(WF.EXEC_SUMMARY, 30000);
        await ctx.delay(OUTCOME_PAUSE_MS);
      },
      verify: WF.EXEC_SUMMARY,
      pauseAfter: true,
    },

    // ── 11. Workflow Runner — override the URL at runtime ────────
    {
      id: 'wf-runner-variable',
      title: 'Override the URL in Workflow Runner',
      description:
        'Open **Workflow Runner** and select **WS Echo Demo**. The `wsUrl` variable appears under **Initial Variables**. ' +
        'Change it to any WebSocket endpoint — the workflow runs against that server without modifying the definition.',
      highlight: WFR.VAR_INPUT,
      preAction: async (ctx) => {
        await closeWfConfigModalIfOpen(ctx);
        ctx.navigateToTab('workflow-runner');
        await ctx.delay(800);
        const picker = document.querySelector('[data-testid="workflow-select"]') as HTMLElement | null;
        if (picker) { picker.click(); await ctx.delay(400); }
        const items = Array.from(document.querySelectorAll('.wfp-dropdown-item'));
        const demoItem = items.find((el) => el.textContent?.includes(WF_NAME)) as HTMLElement | undefined;
        if (demoItem) {
          demoItem.click();
          await ctx.delay(800);
        } else if (picker) {
          picker.click();
          await ctx.delay(200);
        }
        await ctx.waitFor(WFR.VAR_INPUT, 5000);
      },
      action: async (ctx) => {
        await ctx.waitFor(WFR.VAR_INPUT, 5000);
        await ctx.delay(500);
        await ctx.fill(WFR.VAR_INPUT, 'ws://staging.example.com/ws');
        await ctx.delay(OUTCOME_PAUSE_MS);
        await ctx.fill(WFR.VAR_INPUT, 'ws://localhost:9876');
        await ctx.delay(OUTCOME_PAUSE_MS);
      },
      pauseAfter: true,
    },
  ],
};
