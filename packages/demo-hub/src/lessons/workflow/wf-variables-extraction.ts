/**
 * WF-2 — Variables & Data Flow
 *
 * 5 steps: define shared {{baseUrl}} in the Variables panel → configure extraction
 * on the existing POST node → add second HTTP node → configure GET URL with
 * {{baseUrl}}/users/{{userId}} → Quick Test the chain.
 *
 * Prerequisite: seeded workflow with Start → HTTP POST /posts already configured.
 */
import type { DemoActionContext, DemoLesson } from '../../types';
import { WF } from '@shared/selectors';
import { showSpotlightRing } from '../../demoRipple';
import {
  collapseWfDemoAppSidebar,
  openWfNodeConfigModal,
  fillWfConfigField,
  clickWfConfigTab,
  saveAndCloseWfConfigModal,
  closeWfConfigModalIfOpen,
  cleanupWorkflowDemoRunUi,
  resetWfPaletteToBlocks,
  revealPaletteBlock,
  ensureLessonWorkflowShown,
} from '../wf-demo-helpers';
import {
  deleteWorkflowByName,
  seedNamedWorkflow,
  waitForWorkflowBridge,
  addWorkflowNodeWithPreset,
  connectWorkflowNodes,
  triggerWorkflowQuickTest,
  fitWorkflowCanvasView,
  patchWorkflowByName,
  patchWorkflowNodeDataById,
  syncLiveWorkflowFromPatch,
} from '../../adapters';

// ─── Constants ──────────────────────────────────────────────────────

const WF_NAME = 'Variables Demo';
const BASE_URL = 'https://jsonplaceholder.typicode.com';
const SAVE_BTN = '.wf-pill-btn[title="Save current node layout"]';

// Stable id for the SECOND (GET) HTTP node added during the lesson. Both HTTP nodes
// share the `.wf-node-http` class, so `WF.NODE_HTTP` always matches the first one
// (Create Post). A fixed id lets steps 4/5 highlight + open exactly the GET node.
const SECOND_HTTP_ID = 'wf2-http-get';
const SECOND_HTTP_SEL = `[data-id="${SECOND_HTTP_ID}"]`;

const SEED_WORKFLOW = {
  name: WF_NAME,
  nodes: [
    { id: 'start-1', type: 'start', position: { x: 50, y: 200 }, data: { label: 'Start' } },
    {
      id: 'http-post',
      type: 'http',
      position: { x: 280, y: 200 },
      data: {
        label: 'Create Post',
        scenario: {
          id: 'wf2-post-scenario',
          name: 'Create Post',
          url: `${BASE_URL}/posts`,
          method: 'POST',
          headers: [{ key: 'Content-Type', value: 'application/json' }],
          body: '{"title":"Hello World","body":"This is a demo post.","userId":1}',
          auth: { type: 'none' },
          validation: { mode: 'none' },
          extractions: [],
        },
        timeoutSec: 0,
      },
    },
  ],
  edges: [{ id: 'e-start-post', source: 'start-1', target: 'http-post' }],
  variables: {},
};

// The POST to /posts returns { ..., userId: 1, id: 101 }.
// We extract $.userId (always 1) and GET /users/1 (always 200).
// We cannot use $.id (101) because JSONPlaceholder doesn't persist — GET /posts/101 → 404.

// ─── Helpers ────────────────────────────────────────────────────────

let activeCleanup: (() => void) | null = null;

function spotlight(el: HTMLElement, holdMs: number, ctx: DemoActionContext): Promise<void> {
  activeCleanup?.();
  activeCleanup = null;
  // Skip scrollIntoView for React Flow canvas nodes/edges — it scrolls an ancestor
  // and undoes the fitted viewport. Fit View already keeps them visible.
  if (!el.closest('.react-flow')) {
    el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  const remove = showSpotlightRing(el);
  activeCleanup = remove;
  return ctx.delay(holdMs).then(() => { remove(); if (activeCleanup === remove) activeCleanup = null; });
}

async function spotlightSel(ctx: DemoActionContext, sel: string, holdMs: number): Promise<void> {
  const el = document.querySelector<HTMLElement>(sel);
  if (el) await spotlight(el, holdMs, ctx);
}

/**
 * Fit the canvas using the REAL Fit View button (symmetric padding: 0.15 → nodes
 * centered), matching the manual control. The demo bridge fitWorkflowCanvasView()
 * uses asymmetric right:0.34 padding that shoves nodes to the left and looks
 * unfitted — never use it for a viewer-facing end state. Falls back to the bridge
 * only if the button isn't mounted yet.
 */
function fitCanvasCentered(): void {
  const btn = document.querySelector<HTMLElement>(WF.FIT_VIEW_BTN);
  if (btn) { btn.click(); return; }
  fitWorkflowCanvasView();
}

/**
 * Idempotently ensure the workflow-level `baseUrl` variable exists so the
 * `{{baseUrl}}` references in both node URLs resolve at runtime. Covers the
 * rapid-Next case where the viewer skips step 1 (the Variables panel) and jumps
 * straight to Quick Test — without this the POST/GET URLs would resolve to
 * host-less `/posts` and fail. Patches both the stored copy and the live canvas.
 * Also patches the first HTTP node's URL to `{{baseUrl}}/posts` if still hardcoded.
 */
function ensureBaseUrlVar(): void {
  patchWorkflowByName(WF_NAME, { variables: { baseUrl: BASE_URL } });
  syncLiveWorkflowFromPatch(WF_NAME, { variables: { baseUrl: BASE_URL } });

  // Patch the POST node URL + extraction if step 1/2 were skipped (rapid-Next)
  patchWorkflowNodeDataById('http-post', {
    scenario: {
      id: 'wf2-post-scenario',
      name: 'Create Post',
      url: '{{baseUrl}}/posts',
      method: 'POST',
      headers: [{ key: 'Content-Type', value: 'application/json' }],
      body: '{"title":"Hello World","body":"This is a demo post.","userId":1}',
      auth: { type: 'none' },
      validation: { mode: 'none' },
      extractions: [{ name: 'userId', source: 'body', expression: '$.userId' }],
    },
  });
}

async function ensureSeededWorkflow(ctx: DemoActionContext): Promise<void> {
  await waitForWorkflowBridge(ctx);

  // Make sure THIS lesson's workflow is on screen — a previous lesson's graph may
  // still be displayed, in which case we must switch to (or re-seed) ours instead
  // of piling this lesson's nodes onto the wrong workflow.
  const state = await ensureLessonWorkflowShown(ctx, WF_NAME);
  if (state !== 'missing') {
    // Only re-fit when we actually SWITCHED to this lesson's workflow from a
    // different one. When it's already shown ('ready'), the canvas is exactly where
    // the previous step left it — re-fitting on every single step start is what made
    // the nodes visibly jump around between steps.
    if (state === 'selected') {
      const fitBtn = document.querySelector<HTMLElement>(WF.FIT_VIEW_BTN);
      if (fitBtn) { fitBtn.click(); await ctx.delay(400); }
    }
    return;
  }

  // Not seeded yet — create it fresh (seedNamedWorkflow also selects it).
  ctx.navigateToTab('workflow');
  await ctx.delay(400);
  await seedNamedWorkflow(ctx, WF_NAME, SEED_WORKFLOW as Record<string, unknown>);
  await ctx.delay(600);
  const fitBtn = document.querySelector<HTMLElement>(WF.FIT_VIEW_BTN);
  if (fitBtn) { fitBtn.click(); await ctx.delay(600); }
  else { fitWorkflowCanvasView({ duration: 300 }); await ctx.delay(500); }
}

// ─── Lesson ─────────────────────────────────────────────────────────

export const wfVariablesExtractionLesson: DemoLesson = {
  id: 'wf-variables-extraction',
  domainId: 'workflow',
  category: 'fundamentals',
  name: 'Variables & Data Flow',
  description:
    'Extract data from one node\'s response and use it in the next — ' +
    'the foundation of powerful multi-step workflows.',
  estimatedMinutes: 5,
  initialTab: 'workflow',
  allowedTabs: ['workflow'],

  concept: {
    title: 'Data Flows Between Nodes',
    body:
      'Workflows become powerful when nodes share data. **Extraction** pulls values from a ' +
      'response (via JSONPath), stores them in variables, and makes them available to ' +
      'downstream nodes using `{{variableName}}` syntax.\n\n' +
      '**Key concepts:**\n' +
      '- **Extraction** — pull a value from a response body, header, or status code\n' +
      '- **Variable** — a named container: `userId`, `token`, `baseUrl`\n' +
      '- **Template expression** — `{{userId}}` in a URL or body resolves at runtime\n' +
      '- **Variables panel** — set workflow-level defaults available to all nodes\n\n' +
      '**In this lesson:** A POST creates a resource and returns its `userId`. You\'ll extract that ' +
      'and use it in a second GET request — plus a shared `{{baseUrl}}` variable so the host ' +
      'lives in one place instead of being hardcoded on every node.',
    keyTerms: [
      { term: 'Extraction', definition: 'A rule that pulls a value from a node\'s response (body JSONPath, header, or status) into a named variable.' },
      { term: 'Variable', definition: 'A named value shared between nodes — set via extraction, Variables panel, or per-step override.' },
      { term: '{{expression}}', definition: 'Template syntax in URLs, headers, or bodies that resolves to a variable value at runtime.' },
      { term: 'Variables Panel', definition: 'Workflow-level defaults — key/value pairs available to every node as {{name}}.' },
    ],
    diagram: `<svg viewBox="0 0 400 80" xmlns="http://www.w3.org/2000/svg">
      <rect x="5" y="25" width="80" height="35" rx="6" fill="#1e293b" stroke="#f59e0b" stroke-width="1.5"/>
      <text x="45" y="42" text-anchor="middle" fill="#f59e0b" font-size="8" font-weight="600">POST /posts</text>
      <text x="45" y="54" text-anchor="middle" fill="#94a3b8" font-size="6">→ $.userId = 1</text>
      <path d="M90 42 L140 42" stroke="#f59e0b" stroke-width="1.5" stroke-dasharray="4 2" marker-end="url(#wf2arr)"/>
      <text x="115" y="36" text-anchor="middle" fill="#f59e0b" font-size="6" font-weight="600">userId</text>
      <rect x="145" y="25" width="110" height="35" rx="6" fill="#1e293b" stroke="#3b82f6" stroke-width="1.5"/>
      <text x="200" y="42" text-anchor="middle" fill="#3b82f6" font-size="8" font-weight="600">GET /users/{{userId}}</text>
      <text x="200" y="54" text-anchor="middle" fill="#94a3b8" font-size="6">resolves → /users/1</text>
      <path d="M260 42 L295 42" stroke="#94a3b8" stroke-width="1.5" marker-end="url(#wf2arr)"/>
      <rect x="300" y="30" width="55" height="25" rx="10" fill="#10b981" stroke="none"/>
      <text x="327" y="46" text-anchor="middle" fill="#fff" font-size="7" font-weight="700">200 OK</text>
      <defs><marker id="wf2arr" markerWidth="7" markerHeight="5" refX="7" refY="2.5" orient="auto">
        <polygon points="0 0, 7 2.5, 0 5" fill="#94a3b8"/></marker></defs>
    </svg>`,
  },

  setup: async (ctx) => {
    ctx.navigateToTab('workflow');
    await ctx.delay(200);
    resetWfPaletteToBlocks();
    await waitForWorkflowBridge(ctx);
    deleteWorkflowByName(WF_NAME);
    await ctx.delay(300);
    await seedNamedWorkflow(ctx, WF_NAME, SEED_WORKFLOW as Record<string, unknown>);
    await ctx.delay(600);
    const fitBtn = document.querySelector<HTMLElement>(WF.FIT_VIEW_BTN);
    if (fitBtn) { fitBtn.click(); await ctx.delay(600); }
    else { fitWorkflowCanvasView({ duration: 300 }); await ctx.delay(500); }
    await collapseWfDemoAppSidebar(ctx);
  },

  cleanup: async (ctx) => {
    await closeWfConfigModalIfOpen(ctx);
    await cleanupWorkflowDemoRunUi(ctx);
    deleteWorkflowByName(WF_NAME);
    await collapseWfDemoAppSidebar(ctx);
    await ctx.delay(100);
  },

  steps: [
    // ── Step 1: The Variables Panel ───────────────────────────────────
    // Define the shared {{baseUrl}} variable FIRST, then update the existing
    // POST node URL to use it — demonstrating the full define → use flow.
    {
      id: 'wf2-variables-panel',
      title: 'The Variables Panel',
      description:
        'Start by defining a shared `baseUrl` variable so the host lives in one place. ' +
        'Click **Variables** in the toolbar, type key `baseUrl` with value ' +
        '`https://jsonplaceholder.typicode.com`, then click **+** to add it and **Save**. ' +
        'Workflow variables are available to every node as `{{baseUrl}}` — after saving, ' +
        'open the **Create Post** node and update its URL from the hardcoded address to ' +
        '`{{baseUrl}}/posts`. Now the host is centralized — change one variable, every node updates.',
      highlight: WF.VARIABLES_BTN,

      preAction: async (ctx) => {
        await ensureSeededWorkflow(ctx);
      },

      action: async (ctx) => {
        // Canvas is already fitted (setup / preAction) — go straight to the lesson
        // beat instead of re-fitting, which would just make the nodes jump.

        // Spotlight and click Variables button
        await spotlightSel(ctx, WF.VARIABLES_BTN, 1000);
        await ctx.click(WF.VARIABLES_BTN);
        await ctx.waitFor(WF.DEFAULTS_MODAL, 5000);
        await ctx.delay(800);

        // Fill key
        await ctx.fill(WF.DEFAULTS_NEW_KEY, 'baseUrl');
        await ctx.delay(600);

        // Spotlight the key input
        await spotlightSel(ctx, WF.DEFAULTS_NEW_KEY, 1000);

        // Fill value
        await ctx.fill(WF.DEFAULTS_NEW_VAL, BASE_URL);
        await ctx.delay(600);

        // Spotlight the value input
        await spotlightSel(ctx, WF.DEFAULTS_NEW_VAL, 1200);

        // Commit the new-row into the variables list
        await spotlightSel(ctx, WF.DEFAULTS_ADD_BTN, 1000);
        await ctx.click(WF.DEFAULTS_ADD_BTN);
        await ctx.delay(800);

        // Save
        await ctx.click(WF.DEFAULTS_SAVE_BTN);
        await ctx.delay(1000);

        // Spotlight the Variables badge (count=1)
        await spotlightSel(ctx, WF.VARIABLES_BTN, 1200);

        // Now open the HTTP node config to update its URL to use the variable
        await openWfNodeConfigModal(ctx, { nodeSelector: WF.NODE_HTTP });
        await ctx.delay(800);

        // Spotlight the current hardcoded URL
        const urlInput = document.querySelector<HTMLInputElement>(WF.CFG_HTTP_URL);
        if (urlInput) {
          await spotlight(urlInput, 1200, ctx);

          // Change the URL to use the variable
          await fillWfConfigField(ctx, WF.CFG_HTTP_URL, '{{baseUrl}}/posts');
          await ctx.delay(800);

          // Spotlight the updated URL showing the {{baseUrl}} expression
          await spotlight(urlInput, 1400, ctx);
        }

        // Spotlight the resolved URL preview if visible
        const resolvedPreview = document.querySelector<HTMLElement>('.wf-config-resolved-url');
        if (resolvedPreview) {
          await spotlight(resolvedPreview, 1200, ctx);
        }

        await saveAndCloseWfConfigModal(ctx);
        await ctx.delay(800);

        // Re-center once after the modal closes (opening a node config can pan the
        // canvas). Always the CENTERED button fit — never the asymmetric bridge fit,
        // which shoved nodes left and caused the left↔right jump between steps.
        fitCanvasCentered();
        await ctx.delay(600);
      },

      verify: WF.CANVAS,
    },

    // ── Step 2: Extract Data from a Response ──────────────────────────
    {
      id: 'wf2-extraction',
      title: 'Extract Data from a Response',
      description:
        'Open the **Create Post** node config and switch to the **Extract** tab. ' +
        'Add an extraction rule: JSONPath `$.userId` stores the response\'s `userId` field ' +
        'into a variable named `userId`. This variable is now available downstream.',
      highlight: WF.NODE_HTTP,

      preAction: async (ctx) => {
        await ensureSeededWorkflow(ctx);
      },

      action: async (ctx) => {
        // Canvas already fitted from the previous step — no re-fit here.

        // Open the first HTTP node config (Create Post)
        const firstHttp = document.querySelector<HTMLElement>(WF.NODE_HTTP);
        if (firstHttp) {
          await openWfNodeConfigModal(ctx, { nodeSelector: WF.NODE_HTTP });
          await ctx.delay(800);
        }

        // Highlight the Extract tab FIRST so the viewer sees where extractions live,
        // THEN switch to it and configure — the tab is the subject of this step.
        const extractTab = Array.from(
          document.querySelectorAll<HTMLElement>(
            `${WF.NODE_CONFIG} .wf-config-tab, ${WF.NODE_CONFIG} .gql-wf-subtab`,
          ),
        ).find((b) => b.textContent?.trim().startsWith('Extract'));
        if (extractTab) await spotlight(extractTab, 1200, ctx);

        // Switch to Extract tab
        await clickWfConfigTab(ctx, WF.NODE_CONFIG, 'Extract');
        await ctx.delay(800);

        // Click + Add Extraction
        await ctx.click(WF.CFG_EXT_ADD);
        await ctx.delay(600);

        // Fill variable name
        await ctx.fill(WF.CFG_EXT_VAR, 'userId');
        await ctx.delay(500);

        // Fill JSONPath expression
        await ctx.fill(WF.CFG_EXT_EXPR, '$.userId');
        await ctx.delay(500);

        // Spotlight the configured extraction row
        await spotlightSel(ctx, WF.CFG_EXT_ROW, 1400);

        // Save and close
        await saveAndCloseWfConfigModal(ctx);
        await ctx.delay(800);

        // Re-fit (centered) after the modal closes so the chain stays nicely displayed
        fitCanvasCentered();
        await ctx.delay(1000);
      },

      verify: WF.NODE_HTTP,
    },

    // ── Step 3: Add a Second HTTP Node ────────────────────────────────
    {
      id: 'wf2-second-node',
      title: 'Add a Second HTTP Node',
      description:
        'Add another **HTTP Request** from the palette. Then connect the first ' +
        'node\'s output to the second node\'s input — creating a sequential chain ' +
        'where data flows from POST to GET. Finally, click **Fit View** to center ' +
        'the chain and **Save** to persist the new layout.',
      highlight: WF.PAL_HTTP,

      preAction: async (ctx) => {
        await ensureSeededWorkflow(ctx);
      },

      action: async (ctx) => {
        // Spotlight HTTP in palette
        const httpBlock = await revealPaletteBlock(ctx, WF.PAL_HTTP);
        if (httpBlock) {
          await spotlight(httpBlock, 1200, ctx);
        }

        // Add the second HTTP node with a STABLE id so later steps highlight/open
        // exactly THIS node (the first HTTP node shares the same class).
        if (!document.querySelector(SECOND_HTTP_SEL)) {
          addWorkflowNodeWithPreset('http', SECOND_HTTP_ID, 'HTTP Request', { x: 520, y: 200 });
        }
        await ctx.delay(1200);

        // Connect first HTTP (Create Post) → second HTTP (GET)
        const firstHttp = document.querySelector<HTMLElement>(WF.NODE_HTTP);
        const firstId = firstHttp?.getAttribute('data-id') ?? firstHttp?.closest('.react-flow__node')?.getAttribute('data-id');
        if (firstId && firstId !== SECOND_HTTP_ID) {
          connectWorkflowNodes(firstId, SECOND_HTTP_ID);
        }
        await ctx.delay(1200);

        // Click Fit View to center the two-node chain nicely
        await spotlightSel(ctx, WF.FIT_VIEW_BTN, 800);
        const fitBtn = document.querySelector<HTMLElement>(WF.FIT_VIEW_BTN);
        if (fitBtn) fitBtn.click();
        await ctx.delay(1200);

        // Click Save to persist the new node + connection layout
        await spotlightSel(ctx, SAVE_BTN, 800);
        const saveBtn = document.querySelector<HTMLElement>(SAVE_BTN);
        if (saveBtn) saveBtn.click();
        await ctx.delay(1000);

        // Spotlight the second node (canvas nodes don't scroll the viewport, so this
        // leaves the fitted view from the Fit View click above untouched — no re-fit).
        const secondNode = document.querySelector<HTMLElement>(SECOND_HTTP_SEL);
        if (secondNode) await spotlight(secondNode, 1200, ctx);
      },

      verify: WF.NODE_HTTP,
    },

    // ── Step 4: Use the Extracted Variable ────────────────────────────
    {
      id: 'wf2-use-variable',
      title: 'Use the Extracted Variable',
      description:
        'Open the second HTTP node and set its URL to `{{baseUrl}}/users/{{userId}}`. ' +
        'This uses **two** variables: `{{baseUrl}}` (the shared host you just defined) and ' +
        '`{{userId}}` (extracted from the POST response). ' +
        'Watch the **Resolved URL (preview)** row at the top of the config — it echoes the ' +
        'full `{{baseUrl}}/users/{{userId}}` template so you can confirm the expressions are in place.',
      // Highlight the SECOND (GET) HTTP node specifically — not WF.NODE_HTTP, which
      // matches the first node (Create Post) and confused viewers into thinking this
      // step configures the POST node.
      highlight: SECOND_HTTP_SEL,

      preAction: async (ctx) => {
        await ensureSeededWorkflow(ctx);
        // baseUrl was defined in step 1 (Variables Panel) — guarantee it even on
        // rapid Next so the resolved-URL preview and later run resolve correctly.
        ensureBaseUrlVar();
        // Recreate the GET node with its STABLE id if the viewer skipped step 3, so
        // the highlight ring and the open-config below both hit the right node.
        if (!document.querySelector(SECOND_HTTP_SEL)) {
          addWorkflowNodeWithPreset('http', SECOND_HTTP_ID, 'HTTP Request', { x: 520, y: 200 });
          await ctx.delay(600);
          const firstHttp = document.querySelector<HTMLElement>(WF.NODE_HTTP);
          const firstId = firstHttp?.getAttribute('data-id') ?? firstHttp?.closest('.react-flow__node')?.getAttribute('data-id');
          if (firstId && firstId !== SECOND_HTTP_ID) connectWorkflowNodes(firstId, SECOND_HTTP_ID);
          await ctx.delay(300);
        }
      },

      action: async (ctx) => {
        // Open the second (GET) HTTP node config by its stable id
        if (document.querySelector(SECOND_HTTP_SEL)) {
          await openWfNodeConfigModal(ctx, { nodeSelector: SECOND_HTTP_SEL });
        }
        await ctx.delay(1000);

        // Fill URL with variable references — GET {{baseUrl}}/users/{{userId}}
        const varUrl = '{{baseUrl}}/users/{{userId}}';
        await fillWfConfigField(ctx, WF.CFG_HTTP_URL, varUrl);
        await ctx.delay(800);

        // The input auto-scrolls back to the start after filling, hiding the
        // `{{userId}}` tail. Scroll it to the end and park the caret there so the
        // viewer can actually read the variable expression in the field.
        const urlInput = document.querySelector<HTMLInputElement>(WF.CFG_HTTP_URL);
        if (urlInput) {
          urlInput.focus();
          const end = urlInput.value.length;
          try { urlInput.setSelectionRange(end, end); } catch { /* non-text input */ }
          urlInput.scrollLeft = urlInput.scrollWidth;
          await ctx.delay(600);
        }

        // Spotlight the URL field now showing the {{baseUrl}}/users/{{userId}} expression
        await spotlightSel(ctx, WF.CFG_HTTP_URL, 1500);

        // Spotlight the Resolved URL (preview) row — it shows the full
        // `{{baseUrl}}/users/{{userId}}` template so the viewer sees exactly what
        // will resolve at runtime, even if the input is still visually clipped.
        await spotlightSel(ctx, WF.CFG_HTTP_URL_PREVIEW, 1600);

        // Save and close
        await saveAndCloseWfConfigModal(ctx);
        await ctx.delay(800);

        // Re-fit the canvas (centered) after the modal closes so the three-node
        // chain is nicely displayed — closing the config modal leaves the viewport
        // shifted otherwise.
        await spotlightSel(ctx, WF.FIT_VIEW_BTN, 700);
        fitCanvasCentered();
        await ctx.delay(1200);
      },

      verify: WF.NODE_HTTP,
    },

    // ── Step 5: Run the Data Chain ────────────────────────────────────
    {
      id: 'wf2-run-chain',
      title: 'Run the Data Chain',
      description:
        'Open the **Console** first, then click **▶ Quick Test** to run the full chain. ' +
        'The POST creates a resource (gets back `userId: 1`), extraction stores it as ' +
        '`userId`, then the GET uses `{{userId}}` to fetch the user profile. Both nodes ' +
        'turn green — and the Console highlights every `userId` in the live execution log.',
      highlight: WF.QUICK_TEST_BTN,

      preAction: async (ctx) => {
        await ensureSeededWorkflow(ctx);
        // Guarantee the baseUrl variable is set even if the viewer skipped step 4 —
        // both node URLs reference {{baseUrl}} and would otherwise fail to resolve.
        ensureBaseUrlVar();
        // Ensure both nodes exist (GET keeps its stable id) and are connected
        if (!document.querySelector(SECOND_HTTP_SEL)) {
          addWorkflowNodeWithPreset('http', SECOND_HTTP_ID, 'HTTP Request', { x: 520, y: 200 });
          await ctx.delay(500);
        }
        const firstHttp = document.querySelector<HTMLElement>(WF.NODE_HTTP);
        const firstId = firstHttp?.getAttribute('data-id') ?? firstHttp?.closest('.react-flow__node')?.getAttribute('data-id');
        if (firstId && firstId !== SECOND_HTTP_ID && document.querySelectorAll('.react-flow__edge').length < 2) {
          connectWorkflowNodes(firstId, SECOND_HTTP_ID);
          await ctx.delay(300);
        }
      },

      action: async (ctx) => {
        // Open the Console FIRST so the viewer watches the log stream in during the run
        await spotlightSel(ctx, WF.CONSOLE_BADGE, 1000);
        if (!document.querySelector(WF.CONSOLE)) {
          await ctx.click(WF.CONSOLE_BADGE);
          await ctx.waitFor(WF.CONSOLE, 4000);
        }
        await ctx.delay(1000);

        // Spotlight Quick Test, then run the chain
        await spotlightSel(ctx, WF.QUICK_TEST_BTN, 1200);
        triggerWorkflowQuickTest();
        await ctx.delay(3500);

        // Spotlight pass badges (both nodes turn green)
        const badges = document.querySelectorAll<HTMLElement>('.wf-node-badge-pass, .wf-node-status-pass');
        if (badges.length > 0) {
          await spotlight(badges[badges.length - 1], 1500, ctx);
        } else {
          const secondNode = document.querySelectorAll<HTMLElement>(WF.NODE_HTTP)[1];
          if (secondNode) await spotlight(secondNode, 1500, ctx);
        }

        // Highlight every `userId` in the Console via the search bar — the viewer
        // sees the variable flow through the live execution log.
        const searchBtn = document.querySelector<HTMLElement>(WF.CONSOLE_SEARCH_BTN);
        if (searchBtn) {
          await spotlight(searchBtn, 800, ctx);
          searchBtn.click();
          await ctx.waitFor(WF.CONSOLE_SEARCH_INPUT, 3000);
          await ctx.delay(500);
        }
        await ctx.fill(WF.CONSOLE_SEARCH_INPUT, 'userId');
        await ctx.delay(1000);

        // Step through each match. The console marks the ACTIVE match line with
        // `.wf-cl-line-current-match` and moves it on every Next — so spotlight the
        // highlighted `userId` INSIDE the current line, not the first mark on the
        // panel (querying CONSOLE_MATCH always returns match #1, which made the ring
        // land on the first occurrence for every step).
        const nextBtn = document.querySelector<HTMLElement>(WF.CONSOLE_NEXT_MATCH_BTN);
        const matchCount = 3;
        for (let i = 0; i < matchCount; i++) {
          const match =
            document.querySelector<HTMLElement>(WF.CONSOLE_CURRENT_MATCH)
            ?? document.querySelector<HTMLElement>(WF.CONSOLE_CURRENT_LINE)
            ?? document.querySelector<HTMLElement>(WF.CONSOLE_MATCH);
          if (match) {
            await spotlight(match, 1200, ctx);
          }
          if (nextBtn && i < matchCount - 1) {
            nextBtn.click();
            // Let the console update currentMatchIdx, re-render the active line, and
            // finish its smooth scroll before we spotlight the next occurrence.
            await ctx.delay(900);
          }
        }
      },

      verify: WF.CONSOLE,
    },
  ],
};
