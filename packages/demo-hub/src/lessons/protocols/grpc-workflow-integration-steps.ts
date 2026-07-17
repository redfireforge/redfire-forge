/** GRPC-WF Workflow integration — lesson steps */
import { GRPC, WF } from '@shared/selectors';
import {
  addWorkflowNodeWithPreset,
  deleteWorkflowByName,
  fitWorkflowCanvasView,
  getWorkflowByName,
  patchWorkflowNodeDataById,
} from '../../adapters';
import {
  cleanupWorkflowDemoRunUi,
  closeWfConfigModalIfOpen,
  expandWfDemoAppSidebar,
  fillWfConfigField,
  openWfConsoleIfClosed,
  openWfNodeConfigModal,
  pauseWfConfigSection,
  saveAndCloseWfConfigModal,
  scrollWfConfigFieldIntoView,
  scrollWfConfigModalToTop,
  selectWfConfigOption,
  waitForWfConfigPanel,
} from '../wf-demo-helpers';
import type { GrpcDemoLesson } from './grpc-lesson-contract';
import { spotlightAndPause } from './grpc-lesson-helpers';
import {
  ECHO_ASSERTIONS_JSON,
  ECHO_BODY_JSON,
  ECHO_BEARER_TOKEN,
  ECHO_METADATA_JSON,
  WF14_NAME,
  WF14_NODE_ASSERT,
  WF14_NODE_ASSERT_SEL,
  WF14_NODE_GRPC,
  WF14_NODE_GRPC_SEL,
  WRONG_ASSERTIONS_JSON,
  clickWfFitView,
  collapseOnce,
  connectCanvasNodes,
  ensureAssertConfig,
  ensureFullWorkflowQuiet,
  ensureGrpcEchoChainConnected,
  ensureOnWorkflowTab,
  ensureUnaryConnectionConfig,
  ensureUnarySecurityConfig,
  isNodeOnCanvas,
  isWorkflowPresent,
  resetWf14Session,
  seedCompleteWorkflowQuiet,
  selectGrpcUnaryServiceAndMethod,
  spotlightWfCanvasNode,
  wf14Session,
} from './grpc-workflow-integration-helpers';

/** Open the Unary config modal if needed; avoid re-scrolling to top when already open. */
async function ensureUnaryConfigModalOpen(ctx: Parameters<typeof openWfNodeConfigModal>[0]): Promise<void> {
  if (document.querySelector(GRPC.WF_UNARY_CONFIG)) {
    await ctx.waitFor(GRPC.WF_UNARY_CONFIG, 3000);
    return;
  }
  await openWfNodeConfigModal(ctx, { nodeId: WF14_NODE_GRPC });
  await waitForWfConfigPanel(ctx, GRPC.WF_UNARY_CONFIG);
}

/**
 * Numeric pauseAfter overrides calcReadingTime (4.5s floor + ~160 wpm), which
 * was producing long "Reading — click to skip" holds on denser steps.
 */
const READ_BRIEF_MS = 2_500;
const READ_STD_MS = 4_000;
const READ_TEACH_MS = 5_500;

export const grpcWorkflowIntegrationSteps: GrpcDemoLesson['steps'] = [
  // =========================================================================
  // Step 1 — Intro: tour Workflow Designer + gRPC palette blocks
  // =========================================================================
  {
    id: 'grpc11-intro',
    title: 'Find gRPC Nodes with Search',
    pauseAfter: READ_BRIEF_MS,
    description: `Type **grpc** in the palette search to filter to **gRPC Unary**, **gRPC Server Stream**, and **gRPC Assert**.`,
    // Keep the step-level highlight on the palette while action() performs the
    // explicit full-list -> search-filter transition.
    highlight: WF.PALETTE,
    preAction: async (ctx) => {
      // Setup already seeds Echo Demo + opens sidebar/palette. Recover quietly
      // only when rapid-Next / restart left the canvas empty.
      await closeWfConfigModalIfOpen(ctx);
      if (!document.querySelector(WF.PAL_SEARCH) || !isWorkflowPresent()) {
        ctx.navigateToTab('workflow');
        await ctx.delay(150);
        if (!isWorkflowPresent()) await seedCompleteWorkflowQuiet(ctx);
        await expandWfDemoAppSidebar(ctx);
        wf14Session.sidebarCollapsed = false;
        await ctx.waitFor(WF.PAL_SEARCH, 5000);
      }
      if (document.querySelector<HTMLInputElement>(WF.PAL_SEARCH)?.value) {
        await ctx.fill(WF.PAL_SEARCH, '');
      }
      // Silent Fit View — setup already fitted; just reapply padding for LiveDemo card.
      fitWorkflowCanvasView();
      document.querySelector<HTMLElement>(WF.FIT_VIEW_BTN)?.click();
      await ctx.delay(120);
    },
    action: async (ctx) => {
      // Reading already rings the Blocks palette — type grpc and hold the filter.
      await spotlightAndPause(ctx, WF.PAL_SEARCH, 450);
      await ctx.fill(WF.PAL_SEARCH, 'grpc');
      await ctx.delay(300);
      await ctx.waitFor(WF.PAL_GRPC_UNARY, 2000);
      await ctx.waitFor(WF.PAL_GRPC_SERVER_STREAM, 2000);
      await ctx.waitFor(WF.PAL_GRPC_ASSERT, 2000);
      await spotlightAndPause(ctx, WF.PALETTE, 700);
    },
    verify: WF.DESIGNER,
  },

  // =========================================================================
  // Step 2 — Create blank workflow
  // =========================================================================
  {
    id: 'grpc11-create',
    title: 'Create a New Workflow',
    pauseAfter: READ_BRIEF_MS,
    description: `Click **+ New** → blank workflow, name it **gRPC Echo Demo**. Every workflow starts with **Start** and **End** — gRPC nodes go between them.`,
    highlight: WF.SIDEBAR,
    preAction: async (ctx) => {
      await cleanupWorkflowDemoRunUi(ctx);
      await closeWfConfigModalIfOpen(ctx);
      ctx.navigateToTab('workflow');
      await ctx.delay(400);
      // If a previous demo run left the workflow behind, remove it.
      if (getWorkflowByName(WF14_NAME)) {
        deleteWorkflowByName(WF14_NAME);
        await ctx.delay(300);
      }
      resetWf14Session();
      // Dismiss onboarding if present.
      const skipBtn = document.querySelector<HTMLElement>('.onboarding-tooltip-skip');
      if (skipBtn) { skipBtn.click(); await ctx.delay(200); }
    },
    action: async (ctx) => {
      // Expand the sidebar and spotlight it.
      await expandWfDemoAppSidebar(ctx);
      await spotlightAndPause(ctx, WF.SIDEBAR, 650);

      // Click + New.
      await spotlightAndPause(ctx, WF.SIDEBAR_NEW_BTN, 600);
      await ctx.click(WF.SIDEBAR_NEW_BTN);
      await ctx.delay(250);

      // Pick "Blank" from the dropdown.
      await ctx.click(WF.NEW_BLANK_ITEM);
      await ctx.delay(250);

      // Fill the workflow name.
      await ctx.fill(WF.CREATE_INPUT, WF14_NAME);
      await ctx.delay(200);

      // Confirm create.
      await ctx.click(WF.CREATE_OK);
      await ctx.waitFor(WF.CANVAS, 5000);
      await ctx.delay(250);

      // Collapse sidebar — canvas gets full width.
      await collapseOnce(ctx);
      wf14Session.workflowCreated = true;

      // Spotlight the empty canvas.
      await spotlightAndPause(ctx, WF.CANVAS, 700);
    },
    // Sidebar is collapsed after create — verify the canvas, not the hidden list.
    verify: WF.CANVAS,
  },

  // =========================================================================
  // Step 3 — Add gRPC Unary node from palette
  // =========================================================================
  {
    id: 'grpc11-add-unary',
    title: 'Add a gRPC Unary Node',
    pauseAfter: READ_STD_MS,
    description: `Click **gRPC Unary** to add a unary call node. The demo wires **Start → Echo Call** and fits the view.\n\n` +
      `At runtime it sends the request, waits for the response, and publishes fields under \`steps.{nodeId}.*\` for downstream nodes.`,
    highlight: WF.PAL_GRPC_UNARY,
    preAction: async (ctx) => {
      // Ensure workflow exists and is selected.
      if (!isWorkflowPresent()) {
        await cleanupWorkflowDemoRunUi(ctx);
        ctx.navigateToTab('workflow');
        await ctx.delay(400);
        await seedCompleteWorkflowQuiet(ctx);
        return;
      }
      await ensureOnWorkflowTab(ctx);
      // Remove the grpc node if it somehow already exists so the demo action adds it fresh.
      // Only if session says it hasn't been added yet.
      if (wf14Session.unaryAdded && !isNodeOnCanvas(WF14_NODE_GRPC)) {
        wf14Session.unaryAdded = false;
      }
    },
    action: async (ctx) => {
      // Spotlight the palette gRPC Unary block.
      const unaryBlock = document.querySelector<HTMLElement>(WF.PAL_GRPC_UNARY);
      if (unaryBlock) {
        unaryBlock.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
        await ctx.delay(200);
      }
      await spotlightAndPause(ctx, WF.PAL_GRPC_UNARY, 700);

      // Add node via bridge (same as clicking in palette).
      if (!isNodeOnCanvas(WF14_NODE_GRPC)) {
        addWorkflowNodeWithPreset('grpcUnary', WF14_NODE_GRPC, 'Echo Call', {
          x: 320,
          y: 200,
        });
        await ctx.delay(300);
        wf14Session.unaryAdded = true;
      }

      // Wire Start → Echo Call immediately (resolve real canvas node ids).
      connectCanvasNodes('.react-flow__node-start', WF.NODE_GRPC_UNARY, 'out');
      await ctx.delay(300);

      // Center the connected graph on screen, then ring the node where it landed.
      await clickWfFitView(ctx);
      await spotlightWfCanvasNode(ctx, WF14_NODE_GRPC, 700);
    },
    verify: WF.NODE_GRPC_UNARY,
  },

  // =========================================================================
  // Step 4 — Configure gRPC Unary: Target, Service, Method
  // =========================================================================
  {
    id: 'grpc11-config-conn',
    title: 'Configure: Target, Service & Method',
    pauseAfter: READ_TEACH_MS,
    description: `Open the config panel. Set **Target** to \`localhost:50051\` — Schema reflects automatically.\n\n` +
      `Pick **Service** / **Method** from the reflection dropdowns (\`echo.EchoService\` → \`Echo\`). Descriptor key is managed for you.\n\n` +
      'Portable tip: `{{grpcTarget}}` with a Variables default still gets dropdowns (see **GRPC-24**).',
    // Reading: ring Echo Call on the canvas (config panel is not open yet).
    highlight: WF14_NODE_GRPC_SEL,
    preAction: async (ctx) => {
      await ensureOnWorkflowTab(ctx);
      if (!isWorkflowPresent() || !isNodeOnCanvas(WF14_NODE_GRPC)) {
        await seedCompleteWorkflowQuiet(ctx);
        return;
      }
      await closeWfConfigModalIfOpen(ctx);
      fitWorkflowCanvasView();
      await ctx.delay(150);
    },
    action: async (ctx) => {
      await openWfNodeConfigModal(ctx, { nodeId: WF14_NODE_GRPC });
      await waitForWfConfigPanel(ctx, GRPC.WF_UNARY_CONFIG);
      await spotlightAndPause(ctx, GRPC.WF_UNARY_CONFIG, 650);

      // Target — look → fill → hold so the viewer sees localhost:50051 land.
      await scrollWfConfigFieldIntoView(ctx, GRPC.WF_UNARY_CFG_TARGET);
      await spotlightAndPause(ctx, GRPC.WF_UNARY_CFG_TARGET, 750);
      await fillWfConfigField(ctx, GRPC.WF_UNARY_CFG_TARGET, 'localhost:50051');
      await spotlightAndPause(ctx, GRPC.WF_UNARY_CFG_TARGET, 900);

      // Schema — hold while reflection populates Service/Method dropdowns.
      await scrollWfConfigFieldIntoView(ctx, GRPC.WF_UNARY_CFG_REFLECT_STATUS);
      await spotlightAndPause(ctx, GRPC.WF_UNARY_CFG_REFLECT_STATUS, 1100);

      await pauseWfConfigSection(ctx);

      // Service then Method — paced selects with spotlight before/after each.
      await selectGrpcUnaryServiceAndMethod(ctx, 'echo.EchoService', 'Echo', { paced: true });
    },
    verify: GRPC.WF_UNARY_CONFIG,
  },

  // =========================================================================
  // Step 5 — Configure body + Save As; save and close
  // =========================================================================
  {
    id: 'grpc11-config-body',
    title: 'Configure: Request Body & Save As',
    pauseAfter: READ_STD_MS,
    description: `Set **Save As** to \`echoReply\` and **Body** to \`{ "message": "workflow-test" }\`.\n\n` +
      `Downstream nodes can then use \`{{steps.echoReply.grpc.response.message}}\`. Click **Save**.`,
    highlight: GRPC.WF_UNARY_CFG_BODY,
    preAction: async (ctx) => {
      await ensureOnWorkflowTab(ctx);
      if (!isWorkflowPresent() || !isNodeOnCanvas(WF14_NODE_GRPC)) {
        await seedCompleteWorkflowQuiet(ctx);
        return;
      }
      const fitBtn = document.querySelector<HTMLElement>(WF.FIT_VIEW_BTN);
      if (fitBtn) {
        await ctx.click(WF.FIT_VIEW_BTN);
        await ctx.delay(220);
      }
      // Ensure connection config is set if step 4 was skipped.
      ensureUnaryConnectionConfig();
      // Modal is usually still open from step 4 — scroll Body into view before
      // Reading highlight so the label/field aren't clipped under the header.
      await ensureUnaryConfigModalOpen(ctx);
      await scrollWfConfigFieldIntoView(ctx, GRPC.WF_UNARY_CFG_BODY);
    },
    action: async (ctx) => {
      await ensureUnaryConfigModalOpen(ctx);

      // fill scrolls each field — skip redundant scroll + long pre-spotlight.
      await fillWfConfigField(ctx, GRPC.WF_UNARY_CFG_SAVE_AS, 'echoReply');
      await fillWfConfigField(ctx, GRPC.WF_UNARY_CFG_BODY, ECHO_BODY_JSON);
      await spotlightAndPause(ctx, GRPC.WF_UNARY_CFG_BODY, 450);

      await saveAndCloseWfConfigModal(ctx);
      wf14Session.unaryConfigured = true;
      await clickWfFitView(ctx);
      await spotlightWfCanvasNode(ctx, WF14_NODE_GRPC, 500);
    },
    verify: WF.NODE_GRPC_UNARY,
  },

  // =========================================================================
  // Step 6 — Configure metadata, auth, and TLS options
  // =========================================================================
  {
    id: 'grpc11-config-security',
    title: 'Configure: Metadata, Auth & TLS',
    pauseAfter: READ_TEACH_MS,
    description: `Same transport options as gRPC Studio: **Metadata** (e.g. \`x-demo-run-id\`), **Auth** (Bearer / Basic / API Key), **TLS** (Plaintext for local Echo), and optional **connection profile**.\n\n` +
      `This demo sets Bearer + a correlation header, then saves.`,
    highlight: GRPC.WF_UNARY_CFG_AUTH_SECTION,
    preAction: async (ctx) => {
      await ensureOnWorkflowTab(ctx);
      if (!isWorkflowPresent() || !isNodeOnCanvas(WF14_NODE_GRPC)) {
        await seedCompleteWorkflowQuiet(ctx);
        return;
      }
      ensureUnaryConnectionConfig();
      await closeWfConfigModalIfOpen(ctx);
    },
    action: async (ctx) => {
      await openWfNodeConfigModal(ctx, { nodeId: WF14_NODE_GRPC });
      await waitForWfConfigPanel(ctx, GRPC.WF_UNARY_CONFIG);

      // Brief TLS glance (plaintext for local Echo) — don't linger before auth.
      await scrollWfConfigFieldIntoView(ctx, GRPC.WF_UNARY_CFG_TLS_MODE);
      await spotlightAndPause(ctx, GRPC.WF_UNARY_CFG_TLS_MODE, 350);

      await selectWfConfigOption(ctx, GRPC.AUTH_TYPE_SELECT, 'bearer');
      await fillWfConfigField(ctx, GRPC.AUTH_BEARER_TOKEN, ECHO_BEARER_TOKEN);
      await fillWfConfigField(ctx, GRPC.WF_UNARY_CFG_METADATA, ECHO_METADATA_JSON);
      await spotlightAndPause(ctx, GRPC.WF_UNARY_CFG_METADATA, 400);

      await saveAndCloseWfConfigModal(ctx);
      wf14Session.unarySecurityConfigured = true;
      await clickWfFitView(ctx);
      await spotlightWfCanvasNode(ctx, WF14_NODE_GRPC, 500);
    },
    verify: WF.NODE_GRPC_UNARY,
  },

  // =========================================================================
  // Step 7 — Add gRPC Assert node; connect after unary
  // =========================================================================
  {
    id: 'grpc11-add-assert',
    title: 'Add a gRPC Assert Node',
    pauseAfter: READ_STD_MS,
    description: `Click **gRPC Assert** — it evaluates an upstream result (no network). Common checks: \`grpcStatus\`, \`grpcField\`, \`grpcTrailer\`, \`grpcDuration\`.\n\n` +
      `The demo wires **Echo Call → Assert Echo → End** and fits the view.`,
    highlight: WF.PAL_GRPC_ASSERT,
    preAction: async (ctx) => {
      await ensureOnWorkflowTab(ctx);
      if (!isWorkflowPresent() || !isNodeOnCanvas(WF14_NODE_GRPC)) {
        await seedCompleteWorkflowQuiet(ctx);
        return;
      }
      ensureUnaryConnectionConfig();
      if (wf14Session.assertAdded && !isNodeOnCanvas(WF14_NODE_ASSERT)) {
        wf14Session.assertAdded = false;
      }
      if (isNodeOnCanvas(WF14_NODE_GRPC) && isNodeOnCanvas(WF14_NODE_ASSERT)) {
        ensureGrpcEchoChainConnected();
      }
    },
    action: async (ctx) => {
      const assertBlock = document.querySelector<HTMLElement>(WF.PAL_GRPC_ASSERT);
      if (assertBlock) {
        assertBlock.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
        await ctx.delay(150);
      }
      await spotlightAndPause(ctx, WF.PAL_GRPC_ASSERT, 450);

      if (!isNodeOnCanvas(WF14_NODE_ASSERT)) {
        addWorkflowNodeWithPreset('grpcAssert', WF14_NODE_ASSERT, 'Assert Echo', {
          x: 580,
          y: 200,
        });
        await ctx.delay(200);
        wf14Session.assertAdded = true;
      }

      ensureGrpcEchoChainConnected();
      await clickWfFitView(ctx);
      await spotlightWfCanvasNode(ctx, WF14_NODE_ASSERT, 700);
    },
    verify: WF.NODE_GRPC_ASSERT,
  },

  // =========================================================================
  // Step 7 — Configure gRPC Assert
  // =========================================================================
  {
    id: 'grpc11-config-assert',
    title: 'Configure the Assert Node',
    pauseAfter: READ_STD_MS,
    description: `Set **Source** to \`echoReply\`, then assertions \`[{ "grpcStatus": 0 }, { "grpcField": "message", "equals": "workflow-test" }]\`. Click **Save**.`,
    // Highlight Source (top of the form) — whole-panel highlight rings get clipped
    // under the app header, and the tall Assertions textarea pulls scroll too far down.
    highlight: GRPC.WF_ASSERT_CFG_SOURCE,
    preAction: async (ctx) => {
      await ensureOnWorkflowTab(ctx);
      if (
        !isWorkflowPresent() ||
        !isNodeOnCanvas(WF14_NODE_GRPC) ||
        !isNodeOnCanvas(WF14_NODE_ASSERT)
      ) {
        await seedCompleteWorkflowQuiet(ctx);
        return;
      }
      ensureUnaryConnectionConfig();
      ensureGrpcEchoChainConnected();
      // Keep modal open at the top for Reading — closing it left the spotlight
      // on a missing panel / canvas remnant clipped by the app nav.
      if (!document.querySelector(GRPC.WF_ASSERT_CONFIG)) {
        await openWfNodeConfigModal(ctx, { nodeId: WF14_NODE_ASSERT });
        await waitForWfConfigPanel(ctx, GRPC.WF_ASSERT_CONFIG);
      } else {
        await scrollWfConfigModalToTop(ctx);
      }
      await scrollWfConfigFieldIntoView(ctx, GRPC.WF_ASSERT_CFG_SOURCE);
    },
    action: async (ctx) => {
      if (!document.querySelector(GRPC.WF_ASSERT_CONFIG)) {
        await openWfNodeConfigModal(ctx, { nodeId: WF14_NODE_ASSERT });
        await waitForWfConfigPanel(ctx, GRPC.WF_ASSERT_CONFIG);
      }

      await fillWfConfigField(ctx, GRPC.WF_ASSERT_CFG_SOURCE, 'echoReply');
      await fillWfConfigField(ctx, GRPC.WF_ASSERT_CFG_ASSERTIONS, ECHO_ASSERTIONS_JSON);
      await spotlightAndPause(ctx, GRPC.WF_ASSERT_CFG_ASSERTIONS, 450);

      await saveAndCloseWfConfigModal(ctx);
      wf14Session.assertConfigured = true;
      await clickWfFitView(ctx);
      await spotlightWfCanvasNode(ctx, WF14_NODE_ASSERT, 500);
    },
    verify: WF.NODE_GRPC_ASSERT,
  },

  // =========================================================================
  // Step 8 — Run Quick Test; all nodes green
  // =========================================================================
  {
    id: 'grpc11-quick-test',
    title: 'Run Quick Test — All Green',
    pauseAfter: READ_STD_MS,
    description: `Click **Quick Test** — canvas nodes go **green** (pass) / **red** (fail). Console shows request/response and assertion details.\n\n` +
      `Echo must be running at \`localhost:50051\`. Quick Test does not save a run record.`,
    highlight: WF.QUICK_TEST_BTN,
    preAction: async (ctx) => {
      await ensureFullWorkflowQuiet(ctx);
      ensureUnaryConnectionConfig();
      ensureUnarySecurityConfig();
      ensureAssertConfig();
      ensureGrpcEchoChainConnected();
      await closeWfConfigModalIfOpen(ctx);
      await cleanupWorkflowDemoRunUi(ctx);
      await openWfConsoleIfClosed(ctx);
      await ctx.delay(300);
    },
    action: async (ctx) => {
      await spotlightAndPause(ctx, WF.QUICK_TEST_BTN, 450);
      await ctx.click(WF.QUICK_TEST_BTN);

      try {
        await ctx.waitFor('.wf-node-run-status', 3_000);
      } catch { /* server may not be running; continue demo */ }
      await ctx.delay(200);

      // Outcome: green node overlays, then console logs.
      await spotlightAndPause(ctx, WF.CANVAS, 500);
      await spotlightAndPause(ctx, WF.CONSOLE, 500);

      wf14Session.quickTestRun = true;
    },
    verify: WF.QUICK_TEST_BTN,
  },

  // =========================================================================
  // Step 9 — Deliberately fail the assertion; re-run; node turns red
  // =========================================================================
  {
    id: 'grpc11-failure',
    title: 'Make an Assertion Fail',
    pauseAfter: READ_TEACH_MS,
    description: `Change the assert to \`"equals": "wrong-value"\` and re-run Quick Test.\n\n` +
      `Echo Call stays green; Assert turns **red**. The console shows which assertion failed and the actual value — so you see **which step** broke.`,
    highlight: WF14_NODE_ASSERT_SEL,
    preAction: async (ctx) => {
      await ensureFullWorkflowQuiet(ctx);
      ensureUnaryConnectionConfig();
      // Restore correct assertions before this step runs (reset from any previous failure).
      patchWorkflowNodeDataById(WF14_NODE_ASSERT, {
        source: 'echoReply',
        assertions: [
          { grpcStatus: 0 },
          { grpcField: 'message', equals: 'workflow-test' },
        ],
      });
      ensureGrpcEchoChainConnected();
      await closeWfConfigModalIfOpen(ctx);
      await cleanupWorkflowDemoRunUi(ctx);
      await openWfConsoleIfClosed(ctx);
      await ctx.delay(300);
    },
    action: async (ctx) => {
      await openWfNodeConfigModal(ctx, { nodeId: WF14_NODE_ASSERT });
      await waitForWfConfigPanel(ctx, GRPC.WF_ASSERT_CONFIG);

      await fillWfConfigField(ctx, GRPC.WF_ASSERT_CFG_ASSERTIONS, WRONG_ASSERTIONS_JSON);
      await spotlightAndPause(ctx, GRPC.WF_ASSERT_CFG_ASSERTIONS, 400);
      await saveAndCloseWfConfigModal(ctx);

      await spotlightAndPause(ctx, WF.QUICK_TEST_BTN, 400);
      await ctx.click(WF.QUICK_TEST_BTN);

      try {
        await ctx.waitFor('.wf-node-run-status', 3_000);
      } catch { /* server may not be running */ }
      await ctx.delay(200);

      // Payoff: red assert node, then failure detail in the console.
      await spotlightWfCanvasNode(ctx, WF14_NODE_ASSERT, 600);
      await openWfConsoleIfClosed(ctx);
      await spotlightAndPause(ctx, WF.CONSOLE, 500);
    },
    // Action already showed the red assert + console — skip a long Verifying poll.
    verify: WF.CONSOLE,
  },
];
