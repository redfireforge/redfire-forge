/** GRPC-WF Workflow integration — lesson steps */
import { GRPC, WF } from '@shared/selectors';
import {
  addWorkflowNodeWithPreset,
  deleteWorkflowByName,
  fitWorkflowCanvasView,
  getWorkflowByName,
  patchWorkflowNodeDataById,
} from '../../adapters';
import { fillControlledInput } from '../setup-helpers';
import {
  cleanupWorkflowDemoRunUi,
  closeWfConfigModalIfOpen,
  expandWfDemoAppSidebar,
  fillWfConfigField,
  holdWfSpotlight,
  openWfConsoleIfClosed,
  openWfNodeConfigModal,
  resetWfPaletteToBlocks,
  saveAndCloseWfConfigModal,
  scrollWfConfigFieldIntoView,
  scrollWfConfigModalToTop,
  selectWfConfigOption,
  revealPaletteBlock,
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
  clearPaletteScratchQuiet,
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
  isUnaryNodeOnCanvas,
  isWorkflowPresent,
  quietWfFitView,
  resetWf14Session,
  resolveWf14UnaryNodeId,
  seedCompleteWorkflowQuiet,
  selectGrpcUnaryServiceAndMethod,
  spotlightWfCanvasNode,
  waitForGrpcUnaryReflectionReady,
  wf14Session,
} from './grpc-workflow-integration-helpers';

/** Reading highlight for Echo Call — works for preset id or palette-minted UUID. */
const ECHO_CALL_HIGHLIGHT = `${WF.NODE_GRPC_UNARY}, ${WF14_NODE_GRPC_SEL}`;

/** Open the Unary config modal if needed; avoid re-scrolling to top when already open. */
async function ensureUnaryConfigModalOpen(ctx: Parameters<typeof openWfNodeConfigModal>[0]): Promise<void> {
  if (document.querySelector(GRPC.WF_UNARY_CONFIG)) {
    await ctx.waitFor(GRPC.WF_UNARY_CONFIG, 3000);
    return;
  }
  await openWfNodeConfigModal(ctx, { nodeId: resolveWf14UnaryNodeId() });
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
  // Step 1 — Create blank workflow (palette search is taught when adding Unary)
  // =========================================================================
  {
    id: 'grpc11-create',
    title: 'Create a New Workflow',
    pauseAfter: READ_BRIEF_MS,
    description: `Click **+ New** → blank workflow, name it **gRPC Echo Demo**. Every workflow starts with **Start** and **End** — gRPC nodes go between them.`,
    highlight: WF.SIDEBAR_NEW_BTN,
    preAction: async (ctx) => {
      await cleanupWorkflowDemoRunUi(ctx);
      await closeWfConfigModalIfOpen(ctx);
      ctx.navigateToTab('workflow');
      await ctx.delay(400);
      // Remove lesson leftovers only — never seed a scratch canvas before Create.
      await clearPaletteScratchQuiet(ctx);
      if (getWorkflowByName(WF14_NAME)) {
        deleteWorkflowByName(WF14_NAME);
        await ctx.delay(300);
      }
      resetWf14Session();
      await expandWfDemoAppSidebar(ctx);
      wf14Session.sidebarCollapsed = false;
      // Dismiss onboarding if present.
      const skipBtn = document.querySelector<HTMLElement>('.onboarding-tooltip-skip');
      if (skipBtn) { skipBtn.click(); await ctx.delay(200); }
    },
    action: async (ctx) => {
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
  // Step 2 — Search palette → highlight matches → click gRPC Unary
  // =========================================================================
  {
    id: 'grpc11-add-unary',
    title: 'Add a gRPC Unary Node',
    pauseAfter: READ_STD_MS,
    description:
      `Type **gRPC** in the Blocks search so the palette filters to the gRPC blocks. ` +
      `Watch **gRPC Unary**, **gRPC Server Stream**, and **gRPC Assert** appear.\n\n` +
      `Then click **gRPC Unary** to place **Echo Call**. The demo wires **Start → Echo Call** and fits the view.\n\n` +
      `At runtime it sends the request, waits for the response, and publishes fields under \`steps.{nodeId}.*\` for downstream nodes.`,
    // Reading starts on the search box — action types, then clicks Unary.
    highlight: WF.PAL_SEARCH,
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
      if (wf14Session.unaryAdded && !isUnaryNodeOnCanvas()) {
        wf14Session.unaryAdded = false;
      }
      // Clear search so the typed "gRPC" beat is visible (not already filtered).
      resetWfPaletteToBlocks();
      const palInput = document.querySelector<HTMLInputElement>(WF.PAL_SEARCH);
      if (palInput?.value) {
        fillControlledInput(palInput, '');
        await ctx.delay(120);
      }
    },
    action: async (ctx) => {
      resetWfPaletteToBlocks();

      // 1. Type gRPC in search and hold so the viewer reads the filter.
      await spotlightAndPause(ctx, WF.PAL_SEARCH, 800);
      await ctx.fill(WF.PAL_SEARCH, 'gRPC');
      await ctx.delay(500);
      await spotlightAndPause(ctx, WF.PAL_SEARCH, 1_100);

      try {
        await ctx.waitFor(WF.PAL_GRPC_UNARY, 3_000);
      } catch { /* palette may already show the block */ }

      // Highlight the filtered gRPC matches as a group.
      const blocksEl = document.querySelector<HTMLElement>('.wf-palette-blocks');
      if (blocksEl) {
        await spotlightAndPause(ctx, '.wf-palette-blocks', 1_300);
      } else {
        for (const sel of [WF.PAL_GRPC_UNARY, WF.PAL_GRPC_SERVER_STREAM, WF.PAL_GRPC_ASSERT]) {
          if (document.querySelector(sel)) await spotlightAndPause(ctx, sel, 550);
        }
      }

      // 2. Highlight gRPC Unary, then click it in the palette.
      await spotlightAndPause(ctx, WF.PAL_GRPC_UNARY, 1_100);
      if (!isUnaryNodeOnCanvas()) {
        await ctx.click(WF.PAL_GRPC_UNARY);
        await ctx.delay(600);
        try {
          await ctx.waitFor(`${WF.NODE_GRPC_UNARY}, .react-flow__node-grpcUnary`, 5_000);
        } catch { /* fall through to preset */ }

        if (!isUnaryNodeOnCanvas()) {
          // Palette click missed (palette closed / bridge lag) — stable fallback.
          addWorkflowNodeWithPreset('grpcUnary', WF14_NODE_GRPC, 'Echo Call', {
            x: 320,
            y: 200,
          });
          await ctx.delay(400);
        } else {
          // Palette mint UUID — rename the label so the canvas reads "Echo Call".
          patchWorkflowNodeDataById(resolveWf14UnaryNodeId(), { label: 'Echo Call' });
          await ctx.delay(250);
        }
        wf14Session.unaryAdded = true;
      }

      // Clear search so the canvas outcome is the focus after the add.
      const palInput = document.querySelector<HTMLInputElement>(WF.PAL_SEARCH);
      if (palInput?.value) fillControlledInput(palInput, '');

      // Wire Start → Echo Call immediately (resolve real canvas node ids).
      connectCanvasNodes('.react-flow__node-start', WF.NODE_GRPC_UNARY, 'out');
      await ctx.delay(300);

      // Center the connected graph on screen, then ring the node where it landed.
      await clickWfFitView(ctx);
      await spotlightWfCanvasNode(ctx, resolveWf14UnaryNodeId(), 700);
    },
    verify: GRPC.CANVAS_UNARY_NODE,
  },

  // =========================================================================
  // Step 4 — Configure gRPC Unary: Target, Service, Method
  // =========================================================================
  {
    id: 'grpc11-config-conn',
    title: 'Configure: Target, Service & Method',
    pauseAfter: READ_TEACH_MS,
    description: `Open **Echo Call**. Watch four beats in order:\n\n` +
      `1. **Target** → \`localhost:50051\`\n` +
      `2. **Schema** turns **Ready** (reflection loads services)\n` +
      `3. **Service** → \`echo.EchoService\`\n` +
      `4. **Method** → \`Echo\`\n\n` +
      'Descriptor is filled automatically. Tip: `{{grpcTarget}}` still reflects (see **GRPC-24**).',
    // Reading: ring Echo Call on the canvas (config panel is not open yet).
    highlight: ECHO_CALL_HIGHLIGHT,
    preAction: async (ctx) => {
      await ensureOnWorkflowTab(ctx);
      if (!isWorkflowPresent() || !isUnaryNodeOnCanvas()) {
        await seedCompleteWorkflowQuiet(ctx);
        return;
      }
      await closeWfConfigModalIfOpen(ctx);
      fitWorkflowCanvasView();
      await ctx.delay(150);
    },
    action: async (ctx) => {
      // Reading already ringed the node — open without a second canvas tour.
      await openWfNodeConfigModal(ctx, {
        nodeId: resolveWf14UnaryNodeId(),
        skipCanvasSpotlight: true,
      });
      await waitForWfConfigPanel(ctx, GRPC.WF_UNARY_CONFIG);

      // Beat 1 — Target
      await fillWfConfigField(ctx, GRPC.WF_UNARY_CFG_TARGET, 'localhost:50051');
      await holdWfSpotlight(ctx, GRPC.WF_UNARY_CFG_TARGET, 1100);

      // Beat 2 — Schema Ready (payoff before touching dropdowns)
      const ready = await waitForGrpcUnaryReflectionReady(ctx, 10_000);
      await scrollWfConfigFieldIntoView(ctx, GRPC.WF_UNARY_CFG_REFLECT_STATUS);
      await holdWfSpotlight(
        ctx,
        ready ? GRPC.WF_UNARY_CFG_REFLECT_READY : GRPC.WF_UNARY_CFG_REFLECT_STATUS,
        1400,
      );

      // Beats 3–4 — Service, then Method (CustomSelect; hold each landed value)
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
      if (!isWorkflowPresent() || !isUnaryNodeOnCanvas()) {
        await seedCompleteWorkflowQuiet(ctx);
        return;
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

      await fillWfConfigField(ctx, GRPC.WF_UNARY_CFG_SAVE_AS, 'echoReply');
      await holdWfSpotlight(ctx, GRPC.WF_UNARY_CFG_SAVE_AS, 900);

      await fillWfConfigField(ctx, GRPC.WF_UNARY_CFG_BODY, ECHO_BODY_JSON);
      await holdWfSpotlight(ctx, GRPC.WF_UNARY_CFG_BODY, 1100);

      await saveAndCloseWfConfigModal(ctx);
      wf14Session.unaryConfigured = true;
      await quietWfFitView(ctx);
      await spotlightWfCanvasNode(ctx, resolveWf14UnaryNodeId(), 700);
    },
    verify: GRPC.CANVAS_UNARY_NODE,
  },

  // =========================================================================
  // Step 6 — Configure metadata, auth, and TLS options
  // =========================================================================
  {
    id: 'grpc11-config-security',
    title: 'Configure: Auth & Metadata',
    pauseAfter: READ_TEACH_MS,
    description: `Same auth options as gRPC Studio. This demo sets:\n\n` +
      `1. **Auth type** → Bearer\n` +
      `2. **Token** → demo bearer token\n` +
      `3. **Metadata** → \`x-demo-run-id\` correlation header\n\n` +
      `TLS stays **Plaintext** for local Echo (no change needed).`,
    // Modal is closed — ring the canvas node for Reading, then open in action.
    highlight: ECHO_CALL_HIGHLIGHT,
    preAction: async (ctx) => {
      await ensureOnWorkflowTab(ctx);
      if (!isWorkflowPresent() || !isUnaryNodeOnCanvas()) {
        await seedCompleteWorkflowQuiet(ctx);
        return;
      }
      ensureUnaryConnectionConfig();
      await closeWfConfigModalIfOpen(ctx);
      fitWorkflowCanvasView();
      await ctx.delay(150);
    },
    action: async (ctx) => {
      await openWfNodeConfigModal(ctx, {
        nodeId: resolveWf14UnaryNodeId(),
        skipCanvasSpotlight: true,
      });
      await waitForWfConfigPanel(ctx, GRPC.WF_UNARY_CONFIG);

      await selectWfConfigOption(ctx, GRPC.AUTH_TYPE_SELECT, 'bearer');
      await holdWfSpotlight(ctx, GRPC.AUTH_TYPE_SELECT, 900);

      await fillWfConfigField(ctx, GRPC.AUTH_BEARER_TOKEN, ECHO_BEARER_TOKEN);
      await holdWfSpotlight(ctx, GRPC.AUTH_BEARER_TOKEN, 1000);

      await fillWfConfigField(ctx, GRPC.WF_UNARY_CFG_METADATA, ECHO_METADATA_JSON);
      await holdWfSpotlight(ctx, GRPC.WF_UNARY_CFG_METADATA, 1100);

      await saveAndCloseWfConfigModal(ctx);
      wf14Session.unarySecurityConfigured = true;
      await quietWfFitView(ctx);
      await spotlightWfCanvasNode(ctx, resolveWf14UnaryNodeId(), 700);
    },
    verify: GRPC.CANVAS_UNARY_NODE,
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
      if (!isWorkflowPresent() || !isUnaryNodeOnCanvas()) {
        await seedCompleteWorkflowQuiet(ctx);
        return;
      }
      ensureUnaryConnectionConfig();
      if (wf14Session.assertAdded && !isNodeOnCanvas(WF14_NODE_ASSERT)) {
        wf14Session.assertAdded = false;
      }
      if (isUnaryNodeOnCanvas() && isNodeOnCanvas(WF14_NODE_ASSERT)) {
        ensureGrpcEchoChainConnected();
      }
    },
    action: async (ctx) => {
      await revealPaletteBlock(ctx, WF.PAL_GRPC_ASSERT);
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
    verify: GRPC.CANVAS_ASSERT_NODE,
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
        !isUnaryNodeOnCanvas() ||
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
        await openWfNodeConfigModal(ctx, {
          nodeId: WF14_NODE_ASSERT,
          skipCanvasSpotlight: true,
        });
        await waitForWfConfigPanel(ctx, GRPC.WF_ASSERT_CONFIG);
      }

      await fillWfConfigField(ctx, GRPC.WF_ASSERT_CFG_SOURCE, 'echoReply');
      await holdWfSpotlight(ctx, GRPC.WF_ASSERT_CFG_SOURCE, 900);

      await fillWfConfigField(ctx, GRPC.WF_ASSERT_CFG_ASSERTIONS, ECHO_ASSERTIONS_JSON);
      await holdWfSpotlight(ctx, GRPC.WF_ASSERT_CFG_ASSERTIONS, 1100);

      await saveAndCloseWfConfigModal(ctx);
      wf14Session.assertConfigured = true;
      await quietWfFitView(ctx);
      await spotlightWfCanvasNode(ctx, WF14_NODE_ASSERT, 700);
    },
    verify: GRPC.CANVAS_ASSERT_NODE,
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
