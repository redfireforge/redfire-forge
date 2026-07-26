/** GRPC-24 Workflow Runner lesson — step definitions */
import { GRPC, WF } from '@shared/selectors';
import { RES } from '@shared/selectors/res';
import {
  addWorkflowNodeWithPreset,
  deleteWorkflowByName,
  fitWorkflowCanvasView,
  getWorkflowByName,
  patchWorkflowByName,
  patchWorkflowNodeDataById,
} from '../../adapters';
import {
  cleanupWorkflowDemoRunUi,
  closeWfConsoleIfOpen,
  closeWfConfigModalIfOpen,
  collapseWfDemoAppSidebar,
  expandWfDemoAppSidebar,
  fillWfConfigField,
  openWfConsoleIfClosed,
  openWfNodeConfigModal,
  pauseWfConfigSection,
  saveAndCloseWfConfigModal,
  scrollWfConfigFieldIntoView,
  revealPaletteBlock,
  waitForWfConfigPanel,
} from '../wf-demo-helpers';
import {
  WF14_NAME,
  WF14_NODE_GRPC,
  WF14_NODE_GRPC_SEL,
  WF14_NODE_ASSERT,
  WF14_NODE_ASSERT_SEL,
  ECHO_BODY_JSON,
  ECHO_ASSERTIONS_JSON,
  clickWfFitView,
  isNodeOnCanvas,
  isWorkflowPresent,
  selectGrpcUnaryServiceAndMethod,
  spotlightWfCanvasNode,
} from './grpc-workflow-integration-helpers';
import { spotlightAndPause, spotlightElementAndPause, GRPC_DEMO_DOCKER_COMMAND } from './grpc-lesson-helpers';
import type { DemoLesson } from '../../types';
import {
  GRPCWR_TARGET_VAR,
  GRPCWR_TARGET_DEFAULT,
  GRPCWR_TARGET_EXPR,
  GRPCWR_ITERATIONS,
  GRPCWR_CONCURRENCY,
  WF_RUNNER_SELECT,
  GRPCWR_EXPLORER_BTN,
  GRPCWR_VARS_SECTION,
  GRPCWR_CONFIG_SECTION,
  GRPCWR_COMPLETION,
  grpcWRSession,
  resolveDescriptorKey,
  ensureChainConnected,
  seedGrpcWRWorkflowQuiet,
  ensureOnWorkflowTab,
  ensureGrpcWRNodesPresent,
  ensureWorkflowSeededForRunner,
  selectGrpcEchoWorkflow,
  applyGrpcWRConfigVisible,
  runGrpcEchoWorkflow,
  ensureRunnerReady,
  openResultsFromCompletionBanner,
  ensureOnResultsTab,
  tourRequestDetailsRow,
  openResultsOverviewTab,
  ensureFullResultsMetricsCards,
  scrollResultsMetricsCardsIntoView,
  tourResultsExplorerPanels,
  closeResultsExplorerIfOpen,
  spotlightGrpcTargetVarRow,
} from './grpc-workflow-runner-helpers';

/**
 * Numeric pauseAfter overrides calcReadingTime (4.5s floor + ~160 wpm), which
 * was producing 25–40s "Reading — click to skip" holds on longer GRPC-24 steps.
 */
const READ_BRIEF_MS = 2_500;
const READ_STD_MS = 4_000;
const READ_TEACH_MS = 5_500;

export const grpcWorkflowRunnerSteps: DemoLesson['steps'] = [
    // ── Step 1: Create blank workflow ─────────────────────────────────────
    {
      id: 'grpc24-create',
      title: 'Create a Blank Workflow',
      description:
        `Click **+ New** → **Blank Workflow**, name it **${WF14_NAME}**, and confirm.\n\n` +
        `You get a canvas with **Start** / **End** and the gRPC palette blocks (**Unary**, **Assert**, **Server-Stream**). The demo collapses the sidebar so the canvas has full width.`,
      // Short Reading — default calc was ~30s for the longer copy; action does the teaching.
      pauseAfter: READ_BRIEF_MS,
      highlight: WF.SIDEBAR_NEW_BTN,
      preAction: async (ctx) => {
        await closeWfConfigModalIfOpen(ctx);
        if (getWorkflowByName(WF14_NAME)) {
          deleteWorkflowByName(WF14_NAME);
          await ctx.delay(100);
        }
        // Only navigate + expand when setup's state is missing (rapid-Next / restart).
        if (!document.querySelector(WF.SIDEBAR_NEW_BTN)) {
          ctx.navigateToTab('workflow');
          await ctx.delay(250);
          const skipBtn = document.querySelector<HTMLElement>('.onboarding-tooltip-skip');
          if (skipBtn) { skipBtn.click(); await ctx.delay(60); }
          await expandWfDemoAppSidebar(ctx);
          grpcWRSession.sidebarCollapsed = false;
        }
      },
      action: async (ctx) => {
        await spotlightAndPause(ctx, WF.SIDEBAR_NEW_BTN, 600);
        await ctx.click(WF.SIDEBAR_NEW_BTN);
        await ctx.delay(300);

        await spotlightAndPause(ctx, WF.NEW_BLANK_ITEM, 550);
        await ctx.click(WF.NEW_BLANK_ITEM);
        await ctx.delay(300);

        await spotlightAndPause(ctx, WF.CREATE_INPUT, 450);
        await ctx.fill(WF.CREATE_INPUT, WF14_NAME);
        await ctx.delay(400);

        await spotlightAndPause(ctx, WF.CREATE_OK, 450);
        await ctx.click(WF.CREATE_OK);
        await ctx.waitFor(WF.CANVAS, 5000);
        await ctx.delay(350);

        await collapseWfDemoAppSidebar(ctx);
        grpcWRSession.workflowCreated = true;
        grpcWRSession.sidebarCollapsed = true;

        // Payoff: ring the Start node only — not the whole canvas/design box.
        fitWorkflowCanvasView();
        await ctx.delay(300);
        await ctx.waitFor(WF.NODE_START, 3000);
        await spotlightAndPause(ctx, WF.NODE_START, 900);
        // Narration mentions the three gRPC palette blocks — show Unary as the entry point.
        await revealPaletteBlock(ctx, WF.PAL_GRPC_UNARY);
        await spotlightAndPause(ctx, WF.PAL_GRPC_UNARY, 700);
      },
      verify: WF.NODE_START,
    },

    // ── Step 2: Define grpcTarget variable ─────────────────────────────────
    {
      id: 'grpc24-variables',
      title: `Define the ${GRPCWR_TARGET_VAR} Variable`,
      description:
        `Click **Variables**. Add \`${GRPCWR_TARGET_VAR}\` = \`${GRPCWR_TARGET_DEFAULT}\`, then **Save**.\n\n` +
        `Nodes that use \`${GRPCWR_TARGET_EXPR}\` resolve this at runtime — and you can override it in the Runner's **Initial Variables** without editing the canvas.\n\n` +
        `The default also drives **design-time reflection**: Service/Method stay as dropdowns while Target keeps the portable template.`,
      pauseAfter: READ_TEACH_MS,
      highlight: GRPC.LESSON24_WF_VARIABLES_BTN,
      preAction: async (ctx) => {
        if (!grpcWRSession.workflowCreated) {
          await ensureOnWorkflowTab(ctx);
          if (!isWorkflowPresent()) {
            await seedGrpcWRWorkflowQuiet(ctx);
            return;
          }
        }
        await closeWfConfigModalIfOpen(ctx);
      },
      action: async (ctx) => {
        await spotlightAndPause(ctx, WF.VARIABLES_BTN, 650);
        await ctx.click(WF.VARIABLES_BTN);
        await ctx.waitFor(WF.DEFAULTS_MODAL, 5000);
        await ctx.delay(700);
        await spotlightAndPause(ctx, WF.DEFAULTS_MODAL, 600);

        const existingRows = document.querySelectorAll(`${WF.DEFAULTS_MODAL} .wf-config-kv-row-vars:not(:last-child)`);
        const alreadyDefined = Array.from(existingRows).some(
          (row) => (row.querySelector('.wf-var-key-input') as HTMLInputElement)?.value === GRPCWR_TARGET_VAR,
        );

        if (!alreadyDefined) {
          await spotlightAndPause(ctx, WF.DEFAULTS_NEW_KEY, 500);
          await ctx.fill(WF.DEFAULTS_NEW_KEY, GRPCWR_TARGET_VAR);
          await ctx.delay(450);

          await spotlightAndPause(ctx, WF.DEFAULTS_NEW_VAL, 500);
          await ctx.fill(WF.DEFAULTS_NEW_VAL, GRPCWR_TARGET_DEFAULT);
          await ctx.delay(450);

          await spotlightAndPause(ctx, WF.DEFAULTS_ADD_BTN, 450);
          await ctx.click(WF.DEFAULTS_ADD_BTN);
          await ctx.delay(600);
        }

        // Payoff: spotlight the actual grpcTarget row (not the header).
        const savedRow = Array.from(
          document.querySelectorAll<HTMLElement>(`${WF.DEFAULTS_MODAL} .wf-config-kv-row-vars:not(:last-child)`),
        ).find((row) => (row.querySelector('.wf-var-key-input') as HTMLInputElement)?.value === GRPCWR_TARGET_VAR);
        if (savedRow) {
          await spotlightElementAndPause(ctx, savedRow, 700);
        } else {
          await spotlightAndPause(ctx, WF.DEFAULTS_MODAL, 500);
        }

        await spotlightAndPause(ctx, WF.DEFAULTS_SAVE_BTN, 500);
        await ctx.click(WF.DEFAULTS_SAVE_BTN);
        await ctx.delay(800);

        if (!getWorkflowByName<{ variables?: Record<string, unknown> }>(WF14_NAME)?.variables?.[GRPCWR_TARGET_VAR]) {
          patchWorkflowByName(WF14_NAME, { variables: { [GRPCWR_TARGET_VAR]: GRPCWR_TARGET_DEFAULT } });
          await ctx.delay(200);
        }
        grpcWRSession.variablesDefined = true;
        await spotlightAndPause(ctx, WF.CANVAS, 450);
      },
      verify: WF.CANVAS,
    },

    // ── Step 3: Add gRPC Unary node ─────────────────────────────────────────
    {
      id: 'grpc24-unary',
      title: 'Add a gRPC Unary Node',
      description:
        `Click **gRPC Unary** in the palette. The demo wires **Start → Echo Call** and fits the view.\n\n` +
        `Unary = one request → one response. At runtime it publishes response fields under the \`saveAs\` namespace for downstream nodes.`,
      pauseAfter: READ_STD_MS,
      highlight: WF.PAL_GRPC_UNARY,
      preAction: async (ctx) => {
        if (!grpcWRSession.workflowCreated || !isWorkflowPresent()) {
          await ensureOnWorkflowTab(ctx);
          if (!isWorkflowPresent()) {
            await seedGrpcWRWorkflowQuiet(ctx);
            return;
          }
        }
        if (!grpcWRSession.variablesDefined) {
          patchWorkflowByName(WF14_NAME, { variables: { [GRPCWR_TARGET_VAR]: GRPCWR_TARGET_DEFAULT } });
          grpcWRSession.variablesDefined = true;
        }
        await closeWfConfigModalIfOpen(ctx);
        await ensureOnWorkflowTab(ctx);
        if (grpcWRSession.unaryAdded && !isNodeOnCanvas(WF14_NODE_GRPC)) {
          grpcWRSession.unaryAdded = false;
        }
      },
      action: async (ctx) => {
        await revealPaletteBlock(ctx, WF.PAL_GRPC_UNARY);
        await spotlightAndPause(ctx, WF.PAL_GRPC_UNARY, 800);
        if (!isNodeOnCanvas(WF14_NODE_GRPC)) {
          addWorkflowNodeWithPreset('grpcUnary', WF14_NODE_GRPC, 'Echo Call', { x: 320, y: 200 });
          await ctx.delay(500);
          grpcWRSession.unaryAdded = true;
        }
        ensureChainConnected();
        await ctx.delay(350);
        await clickWfFitView(ctx);
        await spotlightWfCanvasNode(ctx, WF14_NODE_GRPC, 900);
      },
      verify: GRPC.CANVAS_UNARY_NODE,
    },

    // ── Step 4: Configure gRPC Unary ───────────────────────────────────────
    {
      id: 'grpc24-config-unary',
      title: 'Configure Echo Call — target={{grpcTarget}}',
      description:
        `Open **Echo Call** and set:\n\n` +
        `- **Target:** \`${GRPCWR_TARGET_EXPR}\` — Schema still reflects via \`${GRPCWR_TARGET_DEFAULT}\`\n` +
        `- **Service** / **Method:** \`echo.EchoService\` → \`Echo\` from the dropdowns\n` +
        `- **Body:** \`${ECHO_BODY_JSON}\` · **Save As:** \`echoReply\`\n\n` +
        `Click **Save**.`,
      pauseAfter: READ_TEACH_MS,
      highlight: WF14_NODE_GRPC_SEL,
      preAction: async (ctx) => {
        await ensureOnWorkflowTab(ctx);
        if (!isWorkflowPresent() || !isNodeOnCanvas(WF14_NODE_GRPC)) {
          await seedGrpcWRWorkflowQuiet(ctx);
          return;
        }
        // Reflection needs the workflow default before the config modal opens.
        if (!getWorkflowByName<{ variables?: Record<string, unknown> }>(WF14_NAME)?.variables?.[GRPCWR_TARGET_VAR]) {
          patchWorkflowByName(WF14_NAME, { variables: { [GRPCWR_TARGET_VAR]: GRPCWR_TARGET_DEFAULT } });
        }
        await closeWfConfigModalIfOpen(ctx);
        fitWorkflowCanvasView();
        await ctx.delay(200);
      },
      action: async (ctx) => {
        await spotlightWfCanvasNode(ctx, WF14_NODE_GRPC, 600);
        await openWfNodeConfigModal(ctx, { nodeId: WF14_NODE_GRPC });
        await waitForWfConfigPanel(ctx, GRPC.WF_UNARY_CONFIG);
        await spotlightAndPause(ctx, GRPC.WF_UNARY_CONFIG, 550);

        // Target is the teaching beat — hold longer after fill.
        await scrollWfConfigFieldIntoView(ctx, GRPC.WF_UNARY_CFG_TARGET);
        await spotlightAndPause(ctx, GRPC.WF_UNARY_CFG_TARGET, 700);
        await fillWfConfigField(ctx, GRPC.WF_UNARY_CFG_TARGET, GRPCWR_TARGET_EXPR);
        await spotlightAndPause(ctx, GRPC.WF_UNARY_CFG_TARGET, 700);

        // Schema status shows "(via localhost:50051)" while Target stays templated.
        await scrollWfConfigFieldIntoView(ctx, GRPC.WF_UNARY_CFG_REFLECT_STATUS);
        await spotlightAndPause(ctx, GRPC.WF_UNARY_CFG_REFLECT_STATUS, 900);

        await pauseWfConfigSection(ctx);
        await selectGrpcUnaryServiceAndMethod(ctx, 'echo.EchoService', 'Echo', { paced: true });

        await pauseWfConfigSection(ctx);
        await scrollWfConfigFieldIntoView(ctx, GRPC.WF_UNARY_CFG_SAVE_AS);
        await spotlightAndPause(ctx, GRPC.WF_UNARY_CFG_SAVE_AS, 550);
        await fillWfConfigField(ctx, GRPC.WF_UNARY_CFG_SAVE_AS, 'echoReply');
        await ctx.delay(350);

        await scrollWfConfigFieldIntoView(ctx, GRPC.WF_UNARY_CFG_BODY);
        await spotlightAndPause(ctx, GRPC.WF_UNARY_CFG_BODY, 550);
        await fillWfConfigField(ctx, GRPC.WF_UNARY_CFG_BODY, ECHO_BODY_JSON);
        await spotlightAndPause(ctx, GRPC.WF_UNARY_CFG_BODY, 700);

        await ctx.waitFor(WF.CFG_SAVE, 3000);
        await spotlightAndPause(ctx, WF.CFG_SAVE, 500);
        await ctx.click(WF.CFG_SAVE);
        grpcWRSession.unaryConfigured = true;
        await ctx.delay(400);

        patchWorkflowNodeDataById(WF14_NODE_GRPC, {
          target: GRPCWR_TARGET_EXPR,
          descriptorKey: resolveDescriptorKey(),
          service: 'echo.EchoService',
          method: 'Echo',
          body: { message: 'workflow-test' },
          saveAs: 'echoReply',
        });
        await clickWfFitView(ctx);
        await spotlightWfCanvasNode(ctx, WF14_NODE_GRPC, 700);
      },
      verify: GRPC.CANVAS_UNARY_NODE,
    },

    // ── Step 5: Add gRPC Assert node ────────────────────────────────────────
    {
      id: 'grpc24-assert',
      title: 'Add a gRPC Assert Node',
      description:
        `Click **gRPC Assert**. The demo wires **Echo Call → Assert Echo → End**.\n\n` +
        `Assert reads an upstream result (no network). We'll check \`grpcStatus: 0\` and the \`message\` field. A failing assert blocks downstream unless \`onError: "continue"\`.`,
      pauseAfter: READ_STD_MS,
      highlight: WF.PAL_GRPC_ASSERT,
      preAction: async (ctx) => {
        await ensureOnWorkflowTab(ctx);
        if (!isWorkflowPresent() || !isNodeOnCanvas(WF14_NODE_GRPC)) {
          await seedGrpcWRWorkflowQuiet(ctx);
          return;
        }
        if (!grpcWRSession.unaryConfigured) {
          patchWorkflowNodeDataById(WF14_NODE_GRPC, {
            target: GRPCWR_TARGET_EXPR,
            descriptorKey: resolveDescriptorKey(),
            service: 'echo.EchoService',
            method: 'Echo',
            body: { message: 'workflow-test' },
            saveAs: 'echoReply',
          });
          grpcWRSession.unaryConfigured = true;
        }
        await closeWfConfigModalIfOpen(ctx);
        if (grpcWRSession.assertAdded && !isNodeOnCanvas(WF14_NODE_ASSERT)) {
          grpcWRSession.assertAdded = false;
        }
      },
      action: async (ctx) => {
        await revealPaletteBlock(ctx, WF.PAL_GRPC_ASSERT);
        await spotlightAndPause(ctx, WF.PAL_GRPC_ASSERT, 800);
        if (!isNodeOnCanvas(WF14_NODE_ASSERT)) {
          addWorkflowNodeWithPreset('grpcAssert', WF14_NODE_ASSERT, 'Assert Echo', { x: 580, y: 200 });
          await ctx.delay(450);
          grpcWRSession.assertAdded = true;
        }
        ensureChainConnected();
        await ctx.delay(350);
        await clickWfFitView(ctx);
        await spotlightWfCanvasNode(ctx, WF14_NODE_ASSERT, 900);
      },
      verify: GRPC.CANVAS_ASSERT_NODE,
    },

    // ── Step 6: Configure Assert ────────────────────────────────────────────
    {
      id: 'grpc24-config-assert',
      title: 'Configure Assert Echo',
      description:
        `Open **Assert Echo**. Set **Source** to \`echoReply\`, then assertions:\n\n` +
        `\`\`\`json\n${ECHO_ASSERTIONS_JSON}\n\`\`\`\n\n` +
        `\`grpcStatus: 0\` = OK; \`grpcField\` checks the echoed message. Click **Save**.`,
      pauseAfter: READ_STD_MS,
      highlight: WF14_NODE_ASSERT_SEL,
      preAction: async (ctx) => {
        await ensureOnWorkflowTab(ctx);
        if (
          !isWorkflowPresent() ||
          !isNodeOnCanvas(WF14_NODE_GRPC) ||
          !isNodeOnCanvas(WF14_NODE_ASSERT)
        ) {
          await seedGrpcWRWorkflowQuiet(ctx);
          return;
        }
        ensureChainConnected();
        await closeWfConfigModalIfOpen(ctx);
        fitWorkflowCanvasView();
        await ctx.delay(150);
      },
      action: async (ctx) => {
        await spotlightWfCanvasNode(ctx, WF14_NODE_ASSERT, 550);
        await openWfNodeConfigModal(ctx, { nodeId: WF14_NODE_ASSERT });
        await waitForWfConfigPanel(ctx, GRPC.WF_ASSERT_CONFIG);
        await spotlightAndPause(ctx, GRPC.WF_ASSERT_CONFIG, 600);

        await scrollWfConfigFieldIntoView(ctx, GRPC.WF_ASSERT_CFG_SOURCE);
        await spotlightAndPause(ctx, GRPC.WF_ASSERT_CFG_SOURCE, 600);
        await fillWfConfigField(ctx, GRPC.WF_ASSERT_CFG_SOURCE, 'echoReply');
        await spotlightAndPause(ctx, GRPC.WF_ASSERT_CFG_SOURCE, 550);
        await pauseWfConfigSection(ctx);

        await scrollWfConfigFieldIntoView(ctx, GRPC.WF_ASSERT_CFG_ASSERTIONS);
        await spotlightAndPause(ctx, GRPC.WF_ASSERT_CFG_ASSERTIONS, 650);
        await fillWfConfigField(ctx, GRPC.WF_ASSERT_CFG_ASSERTIONS, ECHO_ASSERTIONS_JSON);
        await spotlightAndPause(ctx, GRPC.WF_ASSERT_CFG_ASSERTIONS, 800);

        await spotlightAndPause(ctx, WF.CFG_SAVE, 450);
        await saveAndCloseWfConfigModal(ctx);
        grpcWRSession.assertConfigured = true;
        await ctx.delay(350);

        patchWorkflowNodeDataById(WF14_NODE_ASSERT, {
          source: 'echoReply',
          assertions: [
            { grpcStatus: 0 },
            { grpcField: 'message', equals: 'workflow-test' },
          ],
        });
        await clickWfFitView(ctx);
        await spotlightWfCanvasNode(ctx, WF14_NODE_ASSERT, 700);
      },
      verify: GRPC.CANVAS_ASSERT_NODE,
    },

    // ── Step 7: Quick Test ──────────────────────────────────────────────────
    {
      id: 'grpc24-quick-test',
      title: 'Quick Test — Verify the Workflow',
      description:
        `Open the **Console**, then click **▶ Quick Test**.\n\n` +
        `Watch **Start → Echo Call → Assert Echo → End** light up (**green** = pass). Quick Test validates only — it does **not** save a run. Harness (next) persists iterations.`,
      pauseAfter: READ_STD_MS,
      highlight: WF.QUICK_TEST_BTN,
      preAction: async (ctx) => {
        await ensureGrpcWRNodesPresent(ctx);
        if (!grpcWRSession.unaryConfigured) {
          patchWorkflowNodeDataById(WF14_NODE_GRPC, {
            target: GRPCWR_TARGET_EXPR,
            descriptorKey: resolveDescriptorKey(),
            service: 'echo.EchoService',
            method: 'Echo',
            body: { message: 'workflow-test' },
            saveAs: 'echoReply',
          });
          grpcWRSession.unaryConfigured = true;
        }
        if (!grpcWRSession.assertConfigured) {
          patchWorkflowNodeDataById(WF14_NODE_ASSERT, {
            source: 'echoReply',
            assertions: [
              { grpcStatus: 0 },
              { grpcField: 'message', equals: 'workflow-test' },
            ],
          });
          grpcWRSession.assertConfigured = true;
        }
        if (!grpcWRSession.variablesDefined) {
          patchWorkflowByName(WF14_NAME, { variables: { [GRPCWR_TARGET_VAR]: GRPCWR_TARGET_DEFAULT } });
          grpcWRSession.variablesDefined = true;
        }
        ensureChainConnected();
        await closeWfConfigModalIfOpen(ctx);
        await cleanupWorkflowDemoRunUi(ctx);
        await openWfConsoleIfClosed(ctx);
        await ctx.delay(300);
      },
      action: async (ctx) => {
        await openWfConsoleIfClosed(ctx);
        await spotlightAndPause(ctx, WF.CONSOLE, 700);
        await spotlightAndPause(ctx, WF.QUICK_TEST_BTN, 700);
        await ctx.click(WF.QUICK_TEST_BTN);
        await ctx.delay(200);
        try { await ctx.waitFor('.wf-node-run-status', 4000); } catch { /* server may not be running */ }
        await ctx.delay(350);
        await spotlightAndPause(ctx, WF.CANVAS, 800);
        await spotlightWfCanvasNode(ctx, WF14_NODE_GRPC, 600);
        await spotlightWfCanvasNode(ctx, WF14_NODE_ASSERT, 600);
        await spotlightAndPause(ctx, WF.CONSOLE, 800);
        grpcWRSession.quickTestRun = true;
      },
      verify: GRPC.LESSON24_QUICK_TEST_VERIFY,
    },

    // ── Step 8: Run in Harness from Designer toolbar ────────────────────────
    {
      id: 'grpc24-runner',
      title: 'Run in Harness (Designer → Workflow Runner)',
      description:
        `Click **Run in Harness** in the Designer toolbar. The app opens **Workflow Runner** with **${WF14_NAME}** selected.\n\n` +
        `You'll see **Initial Variables** (\`${GRPCWR_TARGET_VAR}\`), **Execution Config**, and **Run**. Unlike Quick Test, Harness runs are saved to Results.`,
      pauseAfter: READ_STD_MS,
      highlight: WF.RUN_IN_HARNESS_BTN,
      preAction: async (ctx) => {
        await ensureOnWorkflowTab(ctx);
        await closeWfConfigModalIfOpen(ctx);
        await closeWfConsoleIfOpen(ctx);
        if (!getWorkflowByName(WF14_NAME)) {
          await seedGrpcWRWorkflowQuiet(ctx);
        } else {
          const wf = getWorkflowByName<{ variables?: Record<string, unknown> }>(WF14_NAME);
          if (!wf?.variables?.[GRPCWR_TARGET_VAR]) {
            patchWorkflowByName(WF14_NAME, { variables: { [GRPCWR_TARGET_VAR]: GRPCWR_TARGET_DEFAULT } });
          }
        }
      },
      action: async (ctx) => {
        await closeWfConsoleIfOpen(ctx);
        await spotlightAndPause(ctx, WF.RUN_IN_HARNESS_BTN, 700);
        await ctx.click(WF.RUN_IN_HARNESS_BTN);
        await ctx.delay(900);
        if (!document.querySelector(WF_RUNNER_SELECT)) {
          ctx.navigateToTab('workflow-runner');
          await ctx.delay(700);
        }
        await selectGrpcEchoWorkflow(ctx);
        await ctx.delay(400);

        // Tour the three surfaces the narration promises.
        await spotlightAndPause(ctx, GRPCWR_VARS_SECTION, 800);
        await spotlightGrpcTargetVarRow(ctx, 700);
        await spotlightAndPause(ctx, GRPCWR_CONFIG_SECTION, 700);
        await spotlightAndPause(ctx, GRPC.LESSON24_RUNNER_RUN_BTN, 650);
      },
      verify: GRPCWR_VARS_SECTION,
    },

    // ── Step 9: INITIAL VARIABLES panel ────────────────────────────────────
    {
      id: 'grpc24-initial-vars',
      title: 'Initial Variables — Override grpcTarget Per Run',
      description:
        `**Initial Variables** shows \`${GRPCWR_TARGET_VAR} = ${GRPCWR_TARGET_DEFAULT}\`.\n\n` +
        `Change this per run (local / TLS / staging) without editing the canvas — the Unary target still reads \`${GRPCWR_TARGET_EXPR}\`. Leave the default for this demo.`,
      pauseAfter: READ_TEACH_MS,
      highlight: GRPCWR_VARS_SECTION,
      preAction: async (ctx) => {
        if (!grpcWRSession.workflowSelected) {
          if (!document.querySelector(WF_RUNNER_SELECT)) {
            ctx.navigateToTab('workflow-runner');
            await ctx.delay(700);
          }
          await ensureWorkflowSeededForRunner(ctx);
          await selectGrpcEchoWorkflow(ctx);
        }
      },
      action: async (ctx) => {
        await spotlightAndPause(ctx, GRPCWR_VARS_SECTION, 700);
        await spotlightGrpcTargetVarRow(ctx, 1200);
      },
      verify: GRPCWR_VARS_SECTION,
    },

    // ── Step 10: Execution Config ───────────────────────────────────────────
    {
      id: 'grpc24-config',
      title: 'Set Iterations & Concurrency',
      description:
        `Set **Iterations** to **${GRPCWR_ITERATIONS}** and **Concurrency** to **${GRPCWR_CONCURRENCY}**.\n\n` +
        `Each iteration produces one Echo Call + Assert row. Concurrency \`1\` keeps the progress bar easy to follow.`,
      pauseAfter: READ_STD_MS,
      highlight: GRPCWR_CONFIG_SECTION,
      preAction: async (ctx) => {
        if (!grpcWRSession.workflowSelected) {
          if (!document.querySelector(WF_RUNNER_SELECT)) {
            ctx.navigateToTab('workflow-runner');
            await ctx.delay(700);
          }
          await ensureWorkflowSeededForRunner(ctx);
          await selectGrpcEchoWorkflow(ctx);
        }
      },
      action: async (ctx) => {
        await applyGrpcWRConfigVisible(ctx);
        await ctx.delay(400);
      },
      verify: GRPCWR_CONFIG_SECTION,
    },

    // ── Step 11: Run ────────────────────────────────────────────────────────
    {
      id: 'grpc24-run',
      title: 'Run the Workflow',
      description:
        `Click **▶ Run Workflow**. Watch the progress bar through ${GRPCWR_ITERATIONS} iterations (` +
        `\`${GRPCWR_TARGET_EXPR}\` → \`${GRPCWR_TARGET_DEFAULT}\`). The green **Completion Banner** means the run is saved to Results.`,
      pauseAfter: READ_STD_MS,
      highlight: GRPC.LESSON24_RUNNER_RUN_BTN,
      preAction: async (ctx) => {
        await ensureRunnerReady(ctx);
      },
      action: async (ctx) => {
        await runGrpcEchoWorkflow(ctx);
      },
      verify: GRPCWR_COMPLETION,
    },

    // ── Step 12: Navigate to Results ────────────────────────────────────────
    {
      id: 'grpc24-completion',
      title: 'Open the Results Dashboard',
      description:
        `The **Completion Banner** summarizes the run. **0% errors** means all ${GRPCWR_ITERATIONS} iterations passed.\n\n` +
        `If errors appear, confirm Docker (\`${GRPC_DEMO_DOCKER_COMMAND}\`) and Quick Test against \`${GRPCWR_TARGET_DEFAULT}\`.\n\n` +
        `Click **View Full Results →**.`,
      pauseAfter: READ_STD_MS,
      highlight: GRPC.WF_VIEW_RESULTS_BTN,
      preAction: async (ctx) => {
        if (!document.querySelector(GRPCWR_COMPLETION)) {
          await ensureRunnerReady(ctx);
          await runGrpcEchoWorkflow(ctx);
        }
      },
      action: async (ctx) => {
        await openResultsFromCompletionBanner(ctx);
      },
      verify: '.results-run-filter-tabs',
    },

    // ── Step 13: Metrics cards ───────────────────────────────────────────────
    {
      id: 'grpc24-metrics',
      title: 'Throughput & Latency Cards',
      description:
        `Headline cards: **Req/s**, **p50/p95 latency**, and **Error rate**. Local Echo is typically 5–30ms.\n\n` +
        `Below: **Workflow Execution Summary** — per-step timing for Echo Call vs Assert Echo.`,
      pauseAfter: READ_STD_MS,
      highlight: GRPC.LESSON24_RESULTS_METRICS,
      preAction: async (ctx) => {
        await openResultsOverviewTab(ctx);
        await ensureFullResultsMetricsCards(ctx);
        await scrollResultsMetricsCardsIntoView(ctx);
      },
      action: async (ctx) => {
        await scrollResultsMetricsCardsIntoView(ctx);
        await spotlightAndPause(ctx, RES.METRICS_CARDS, 900);
        const latencyRow = document.querySelector<HTMLElement>(RES.METRICS_LATENCY_ROW);
        if (latencyRow) {
          latencyRow.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
          await ctx.delay(200);
          await spotlightAndPause(ctx, RES.METRICS_LATENCY_ROW, 800);
        }
      },
      verify: RES.METRICS_CARDS,
    },

    // ── Step 14: Request Details tab ─────────────────────────────────────────
    {
      id: 'grpc24-request-detail',
      title: 'Request Details — GRPC Badge Rows',
      description:
        `Open **Request Details**. Each Echo Call row has a **GRPC** badge. Click a row for request/response bodies and status 0 — the per-iteration audit trail against \`${GRPCWR_TARGET_DEFAULT}\`.`,
      pauseAfter: READ_STD_MS,
      highlight: GRPC.LESSON24_REQUEST_DETAILS_TAB,
      preAction: ensureOnResultsTab,
      action: async (ctx) => {
        await tourRequestDetailsRow(ctx);
      },
      verify: '.clickable-row',
    },

    // ── Step 15: Results Explorer ─────────────────────────────────────────────
    {
      id: 'grpc24-explorer',
      title: 'Results Explorer — Canvas, Detail & Matrix',
      description:
        `Open **Results Explorer**: **Canvas** (pass/fail + timing), **Detail** (\`echoReply\` snapshot), and **Iteration matrix**.\n\n` +
        `For this chain the network bottleneck is always **Echo Call**.`,
      pauseAfter: READ_TEACH_MS,
      highlight: GRPCWR_EXPLORER_BTN,
      preAction: async (ctx) => {
        await closeResultsExplorerIfOpen(ctx);
        await ensureOnResultsTab(ctx);
      },
      action: async (ctx) => {
        await tourResultsExplorerPanels(ctx);
      },
      verify: GRPC.LESSON24_RESULTS_EXPLORER_DIAGRAM,
    },

    // ── Step 16: Export JSON ──────────────────────────────────────────────────
    {
      id: 'grpc24-export',
      title: 'Export JSON for CI',
      description:
        `**Export JSON** includes run metadata (\`${GRPCWR_TARGET_VAR}\` override, iterations), Echo Call p50/p95/p99, and per-iteration request/response pairs — useful for CI latency gates and archival.`,
      pauseAfter: READ_STD_MS,
      highlight: GRPC.LESSON24_EXPORT_JSON_BTN,
      preAction: async (ctx) => {
        await closeResultsExplorerIfOpen(ctx);
        await ensureOnResultsTab(ctx);
      },
      action: async (ctx) => {
        await closeResultsExplorerIfOpen(ctx);
        await spotlightAndPause(ctx, RES.EXPORT_JSON_BTN, 1000);
        // Do not click Export — avoids a download during demos; the ring is the teaching beat.
      },
      verify: GRPC.LESSON24_EXPORT_JSON_BTN,
    },
];
