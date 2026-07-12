/** GRPC-24 Workflow Runner lesson — step definitions */
import { GRPC, WF } from '@shared/selectors';
import {
  addWorkflowNodeWithPreset,
  deleteWorkflowByName,
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
  waitForWfConfigPanel,
} from '../wf-demo-helpers';
import {
  WF14_NAME,
  WF14_NODE_GRPC,
  WF14_NODE_ASSERT,
  ECHO_BODY_JSON,
  ECHO_ASSERTIONS_JSON,
  clickWfFitView,
  isNodeOnCanvas,
  isWorkflowPresent,
} from './grpc-workflow-integration-helpers';
import { spotlightAndPause, GRPC_DEMO_DOCKER_COMMAND } from './grpc-lesson-helpers';
import type { DemoLesson } from '../../types';
import {
  GRPCWR_TARGET_VAR,
  GRPCWR_TARGET_DEFAULT,
  GRPCWR_TARGET_EXPR,
  GRPCWR_ITERATIONS,
  GRPCWR_CONCURRENCY,
  GRPCWR_TRACE_LEVEL,
  WF_RUNNER_SELECT,
  GRPCWR_EXPLORER_BTN,
  grpcWRSession,
  resetGrpcWRSession,
  resolveDescriptorKey,
  ensureChainConnected,
  seedGrpcWRWorkflowQuiet,
  ensureOnWorkflowTab,
  ensureGrpcWRNodesPresent,
  ensureWorkflowSeededForRunner,
  selectGrpcEchoWorkflow,
  applyGrpcWRConfig,
  runGrpcEchoWorkflow,
  ensureRunnerReady,
  openResultsFromCompletionBanner,
  ensureOnResultsTab,
  openRequestDetailsTab,
  openResultsOverviewTab,
  ensureFullResultsMetricsCards,
  scrollResultsMetricsCardsIntoView,
  openAndFitResultsExplorer,
  closeResultsExplorerIfOpen,
} from './grpc-workflow-runner-helpers';

export const grpcWorkflowRunnerSteps: DemoLesson['steps'] = [
    // ── Step 1: Create blank workflow ─────────────────────────────────────
    {
      id: 'grpc24-create',
      title: 'Create a Blank Workflow',
      description:
        `Open the **Workflow Designer** tab. Click **+ New** in the sidebar → **Blank Workflow**, then name it **${WF14_NAME}** and confirm.\n\n` +
        `A blank canvas appears with **Start** and **End** nodes. The palette on the left shows three gRPC node types: **gRPC Unary**, **gRPC Assert**, and **gRPC Server-Stream**.\n\n` +
        `Every workflow starts the same way — canvas + node palette. The demo collapses the sidebar after creation so the canvas has full width.`,
      highlight: WF.SIDEBAR_NEW_BTN,
      preAction: async (ctx) => {
        resetGrpcWRSession();
        await cleanupWorkflowDemoRunUi(ctx);
        await closeWfConfigModalIfOpen(ctx);
        if (getWorkflowByName(WF14_NAME)) {
          deleteWorkflowByName(WF14_NAME);
          await ctx.delay(200);
        }
        ctx.navigateToTab('workflow');
        await ctx.delay(500);
        const skipBtn = document.querySelector<HTMLElement>('.onboarding-tooltip-skip');
        if (skipBtn) { skipBtn.click(); await ctx.delay(200); }
      },
      action: async (ctx) => {
        await expandWfDemoAppSidebar(ctx);
        await spotlightAndPause(ctx, WF.SIDEBAR, 500);
        await spotlightAndPause(ctx, WF.SIDEBAR_NEW_BTN, 500);
        await ctx.click(WF.SIDEBAR_NEW_BTN);
        await ctx.delay(250);
        await ctx.click(WF.NEW_BLANK_ITEM);
        await ctx.delay(250);
        await ctx.fill(WF.CREATE_INPUT, WF14_NAME);
        await ctx.delay(200);
        await ctx.click(WF.CREATE_OK);
        await ctx.waitFor(WF.CANVAS, 5000);
        await ctx.delay(400);
        await collapseWfDemoAppSidebar(ctx);
        grpcWRSession.workflowCreated = true;
        grpcWRSession.sidebarCollapsed = true;
        await spotlightAndPause(ctx, WF.CANVAS, 600);
      },
      verify: WF.CANVAS,
      pauseAfter: true,
    },

    // ── Step 2: Define grpcTarget variable ─────────────────────────────────
    {
      id: 'grpc24-variables',
      title: `Define the ${GRPCWR_TARGET_VAR} Variable`,
      description:
        `Click **Variables** in the Designer toolbar. In the **Workflow Variables** modal, add:\n\n` +
        `- **Name:** \`${GRPCWR_TARGET_VAR}\`\n` +
        `- **Value:** \`${GRPCWR_TARGET_DEFAULT}\`\n\n` +
        `Click **Save**.\n\n` +
        `This variable is the key feature for the Workflow Runner — any node that references \`${GRPCWR_TARGET_EXPR}\` will have its value replaced at runtime. In the Workflow Runner's **Initial Variables** panel, this row appears as an overridable field. Without editing the canvas, a user can point the same workflow at \`staging-grpc.acme.com:443\` just by changing this one field before clicking Run.`,
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
        await spotlightAndPause(ctx, WF.VARIABLES_BTN, 500);
        await ctx.click(WF.VARIABLES_BTN);
        await ctx.waitFor(WF.DEFAULTS_MODAL, 5000);
        await ctx.delay(600);

        // Check if the row already exists (rapid-next guard)
        const existingRows = document.querySelectorAll(`${WF.DEFAULTS_MODAL} .wf-config-kv-row-vars:not(:last-child)`);
        const alreadyDefined = Array.from(existingRows).some(
          (row) => (row.querySelector('.wf-var-key-input') as HTMLInputElement)?.value === GRPCWR_TARGET_VAR,
        );

        if (!alreadyDefined) {
          await ctx.fill(WF.DEFAULTS_NEW_KEY, GRPCWR_TARGET_VAR);
          await ctx.delay(350);
          await ctx.fill(WF.DEFAULTS_NEW_VAL, GRPCWR_TARGET_DEFAULT);
          await ctx.delay(350);
          await ctx.click(WF.DEFAULTS_ADD_BTN);
          await ctx.delay(500);
        }

        await spotlightAndPause(ctx, WF.DEFAULTS_MODAL, 500);
        await ctx.click(WF.DEFAULTS_SAVE_BTN);
        await ctx.delay(700);

        // Bridge fallback if modal interaction didn't persist
        if (!getWorkflowByName<{ variables?: Record<string, unknown> }>(WF14_NAME)?.variables?.[GRPCWR_TARGET_VAR]) {
          patchWorkflowByName(WF14_NAME, { variables: { [GRPCWR_TARGET_VAR]: GRPCWR_TARGET_DEFAULT } });
          await ctx.delay(200);
        }
        grpcWRSession.variablesDefined = true;
      },
      verify: WF.CANVAS,
      pauseAfter: true,
    },

    // ── Step 3: Add gRPC Unary node ─────────────────────────────────────────
    {
      id: 'grpc24-unary',
      title: 'Add a gRPC Unary Node',
      description:
        `Click **gRPC Unary** in the palette (**Actions** section). The node drops onto the canvas. The demo wires **Start → Echo Call** and clicks **Fit view** to center the graph.\n\n` +
        `**gRPC Unary** is for single request → single response calls (the most common gRPC pattern). At runtime it opens a channel to the configured target, sends the body, receives the unary response, and publishes all response fields under the \`saveAs\` namespace so downstream nodes can reference them.`,
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
        const palBlock = document.querySelector<HTMLElement>(WF.PAL_GRPC_UNARY);
        palBlock?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
        await ctx.delay(200);
        await spotlightAndPause(ctx, WF.PAL_GRPC_UNARY, 700);
        if (!isNodeOnCanvas(WF14_NODE_GRPC)) {
          addWorkflowNodeWithPreset('grpcUnary', WF14_NODE_GRPC, 'Echo Call', { x: 320, y: 200 });
          await ctx.delay(400);
          grpcWRSession.unaryAdded = true;
        }
        ensureChainConnected();
        await ctx.delay(300);
        await clickWfFitView(ctx);
        await spotlightAndPause(ctx, WF.NODE_GRPC_UNARY, 600);
      },
      verify: WF.NODE_GRPC_UNARY,
      pauseAfter: true,
    },

    // ── Step 4: Configure gRPC Unary ───────────────────────────────────────
    {
      id: 'grpc24-config-unary',
      title: 'Configure Echo Call — target={{grpcTarget}}',
      description:
        `Double-click **Echo Call** to open its config panel. Set:\n\n` +
        `- **Target:** \`${GRPCWR_TARGET_EXPR}\` — references the workflow variable; the runner resolves it to \`${GRPCWR_TARGET_DEFAULT}\` (or whatever override the user provides)\n` +
        `- **Service:** \`echo.EchoService\`\n` +
        `- **Method:** \`Echo\`\n` +
        `- **Body:** \`${ECHO_BODY_JSON}\`\n` +
        `- **Save As:** \`echoReply\` — makes response fields available as \`echoReply.message\`, \`echoReply.grpcStatus\`, etc.\n\n` +
        `Click **Save**. The \`{{grpcTarget}}\` syntax is the same template syntax used by GQL nodes for endpoints — it works across all workflow node types.`,
      highlight: GRPC.WF_UNARY_CONFIG,
      preAction: async (ctx) => {
        await ensureOnWorkflowTab(ctx);
        if (!isWorkflowPresent() || !isNodeOnCanvas(WF14_NODE_GRPC)) {
          await seedGrpcWRWorkflowQuiet(ctx);
          return;
        }
        await closeWfConfigModalIfOpen(ctx);
      },
      action: async (ctx) => {
        await openWfNodeConfigModal(ctx, { nodeId: WF14_NODE_GRPC });
        await waitForWfConfigPanel(ctx, GRPC.WF_UNARY_CONFIG);

        await spotlightAndPause(ctx, GRPC.WF_UNARY_CFG_TARGET, 600);
        await ctx.waitFor(GRPC.WF_UNARY_CFG_TARGET, 3000);
        await fillWfConfigField(ctx, GRPC.WF_UNARY_CFG_TARGET, GRPCWR_TARGET_EXPR);

        await pauseWfConfigSection(ctx);
        await spotlightAndPause(ctx, GRPC.WF_UNARY_CFG_SERVICE, 500);
        await fillWfConfigField(ctx, GRPC.WF_UNARY_CFG_SERVICE, 'echo.EchoService');

        await spotlightAndPause(ctx, GRPC.WF_UNARY_CFG_METHOD, 500);
        await fillWfConfigField(ctx, GRPC.WF_UNARY_CFG_METHOD, 'Echo');

        await pauseWfConfigSection(ctx);
        await spotlightAndPause(ctx, GRPC.WF_UNARY_CFG_BODY, 500);
        await ctx.waitFor(GRPC.WF_UNARY_CFG_BODY, 3000);
        await fillWfConfigField(ctx, GRPC.WF_UNARY_CFG_BODY, ECHO_BODY_JSON);

        await spotlightAndPause(ctx, GRPC.WF_UNARY_CFG_SAVE_AS, 500);
        await ctx.waitFor(GRPC.WF_UNARY_CFG_SAVE_AS, 3000);
        await fillWfConfigField(ctx, GRPC.WF_UNARY_CFG_SAVE_AS, 'echoReply');

        await ctx.waitFor(WF.CFG_SAVE, 3000);
        await ctx.click(WF.CFG_SAVE);
        grpcWRSession.unaryConfigured = true;
        await ctx.delay(250);

        // Fallback: ensure node data is set via bridge
        patchWorkflowNodeDataById(WF14_NODE_GRPC, {
          target: GRPCWR_TARGET_EXPR,
          descriptorKey: resolveDescriptorKey(),
          service: 'echo.EchoService',
          method: 'Echo',
          body: { message: 'workflow-test' },
          saveAs: 'echoReply',
        });
        await spotlightAndPause(ctx, WF.NODE_GRPC_UNARY, 500);
      },
      verify: WF.NODE_GRPC_UNARY,
      pauseAfter: true,
    },

    // ── Step 5: Add gRPC Assert node ────────────────────────────────────────
    {
      id: 'grpc24-assert',
      title: 'Add a gRPC Assert Node',
      description:
        `Click **gRPC Assert** in the palette (**Logic** section). The demo wires **Echo Call → Assert Echo → End** and fits the view.\n\n` +
        `**gRPC Assert** makes no network calls — it reads the result stored by an upstream call node and evaluates your assertions. Two assertion types are relevant here:\n\n` +
        `- \`grpcStatus: 0\` — passes when the gRPC status is OK (0 = success)\n` +
        `- \`grpcField: "message"\` — checks a field in the response body by dot-notation path\n\n` +
        `A failing assert node **blocks downstream execution** unless you set \`onError: "continue"\`.`,
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
        const assertBlock = document.querySelector<HTMLElement>(WF.PAL_GRPC_ASSERT);
        assertBlock?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
        await ctx.delay(200);
        await spotlightAndPause(ctx, WF.PAL_GRPC_ASSERT, 700);
        if (!isNodeOnCanvas(WF14_NODE_ASSERT)) {
          addWorkflowNodeWithPreset('grpcAssert', WF14_NODE_ASSERT, 'Assert Echo', { x: 580, y: 200 });
          await ctx.delay(350);
          grpcWRSession.assertAdded = true;
        }
        ensureChainConnected();
        await ctx.delay(300);
        await clickWfFitView(ctx);
        await spotlightAndPause(ctx, WF.NODE_GRPC_ASSERT, 600);
      },
      verify: WF.NODE_GRPC_ASSERT,
      pauseAfter: true,
    },

    // ── Step 6: Configure Assert ────────────────────────────────────────────
    {
      id: 'grpc24-config-assert',
      title: 'Configure Assert Echo',
      description:
        `Double-click **Assert Echo**. Set:\n\n` +
        `- **Source:** \`echoReply\` — the \`saveAs\` alias from the Unary node\n` +
        `- **Assertions (JSON):**\n` +
        `\`\`\`json\n${ECHO_ASSERTIONS_JSON}\n\`\`\`\n\n` +
        `**grpcStatus: 0** checks the gRPC status code (0 = OK). **grpcField** uses dot-notation to check a field in the response body — \`"message"\` with \`"equals": "workflow-test"\` confirms the echo server returned exactly what was sent.\n\n` +
        `Click **Save**. The workflow is now complete.`,
      highlight: GRPC.WF_ASSERT_CONFIG,
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
      },
      action: async (ctx) => {
        await openWfNodeConfigModal(ctx, { nodeId: WF14_NODE_ASSERT });
        await waitForWfConfigPanel(ctx, GRPC.WF_ASSERT_CONFIG);
        await spotlightAndPause(ctx, GRPC.WF_ASSERT_CONFIG, 550);

        await spotlightAndPause(ctx, GRPC.WF_ASSERT_CFG_SOURCE, 550);
        await fillWfConfigField(ctx, GRPC.WF_ASSERT_CFG_SOURCE, 'echoReply');
        await pauseWfConfigSection(ctx);

        await spotlightAndPause(ctx, GRPC.WF_ASSERT_CFG_ASSERTIONS, 600);
        await fillWfConfigField(ctx, GRPC.WF_ASSERT_CFG_ASSERTIONS, ECHO_ASSERTIONS_JSON);

        await saveAndCloseWfConfigModal(ctx);
        grpcWRSession.assertConfigured = true;
        await ctx.delay(250);

        patchWorkflowNodeDataById(WF14_NODE_ASSERT, {
          source: 'echoReply',
          assertions: [
            { grpcStatus: 0 },
            { grpcField: 'message', equals: 'workflow-test' },
          ],
        });
        await spotlightAndPause(ctx, WF.NODE_GRPC_ASSERT, 500);
      },
      verify: WF.NODE_GRPC_ASSERT,
      pauseAfter: true,
    },

    // ── Step 7: Quick Test ──────────────────────────────────────────────────
    {
      id: 'grpc24-quick-test',
      title: 'Quick Test — Verify the Workflow',
      description:
        `Open the **Console** (badge in the status bar), then click **▶ Quick Test**.\n\n` +
        `The workflow executes: **Start → Echo Call → Assert Echo → End**. The canvas shows live status as each node runs — **green** = pass, **red** = fail. The Console streams per-node logs including:\n\n` +
        `- Echo Call: target resolved from \`${GRPCWR_TARGET_EXPR}\` → \`${GRPCWR_TARGET_DEFAULT}\`, request body, gRPC status, response body, latency\n` +
        `- Assert Echo: assertion results — \`grpcStatus==0 ✓\`, \`message==workflow-test ✓\`\n\n` +
        `**Quick Test does not save a run record** — it is for validation only. The Workflow Runner (next) runs with iterations and saves results.`,
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
        await spotlightAndPause(ctx, WF.CONSOLE, 450);
        await spotlightAndPause(ctx, WF.QUICK_TEST_BTN, 600);
        await ctx.click(WF.QUICK_TEST_BTN);
        await ctx.delay(150);
        try { await ctx.waitFor('.wf-node-run-status', 3000); } catch { /* server may not be running */ }
        await ctx.delay(200);
        await spotlightAndPause(ctx, WF.CANVAS, 600);
        await spotlightAndPause(ctx, WF.CONSOLE, 600);
        grpcWRSession.quickTestRun = true;
      },
      verify: GRPC.LESSON24_QUICK_TEST_VERIFY,
      pauseAfter: true,
    },

    // ── Step 8: Run in Harness from Designer toolbar ────────────────────────
    {
      id: 'grpc24-runner',
      title: 'Run in Harness (Designer → Workflow Runner)',
      description:
        `In the Designer toolbar, click **Run in Harness** (next to Variables/Versions). This is the handoff from canvas editing to tracked test execution.\n\n` +
        `The app navigates to **Workflow Runner** and carries your workflow context forward. If the picker is not already set, select **${WF14_NAME}** in the Workflow dropdown.\n\n` +
        `Once selected, you will see:\n` +
        `1. **Initial Variables** — including \`${GRPCWR_TARGET_VAR}\`\n` +
        `2. **Execution Config** — Iterations and Concurrency\n` +
        `3. **Run** button\n\n` +
        `Unlike Quick Test, Harness runs are persisted and visible in Results history.`,
      highlight: WF.RUN_IN_HARNESS_BTN,
      preAction: async (ctx) => {
        await ensureOnWorkflowTab(ctx);
        await closeWfConfigModalIfOpen(ctx);
        await closeWfConsoleIfOpen(ctx);
        // Ensure workflow has grpcTarget variable (if user rapid-clicked through build steps)
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
        await spotlightAndPause(ctx, WF.RUN_IN_HARNESS_BTN, 600);
        await ctx.click(WF.RUN_IN_HARNESS_BTN);
        await ctx.delay(800);
        if (!document.querySelector(WF_RUNNER_SELECT)) {
          ctx.navigateToTab('workflow-runner');
          await ctx.delay(700);
        }
        await selectGrpcEchoWorkflow(ctx);
        await ctx.delay(500);
      },
      verify: '.workflow-vars-section',
      pauseAfter: true,
    },

    // ── Step 9: INITIAL VARIABLES panel ────────────────────────────────────
    {
      id: 'grpc24-initial-vars',
      title: 'Initial Variables — Override grpcTarget Per Run',
      description:
        `The **Initial Variables** panel shows \`${GRPCWR_TARGET_VAR} = ${GRPCWR_TARGET_DEFAULT}\` — the default you defined in step 2.\n\n` +
        `**This is the value you can change per run, without editing the workflow.** Examples:\n\n` +
        `- \`localhost:50051\` — local Docker Echo server (default)\n` +
        `- \`localhost:50443\` — local TLS fixture\n` +
        `- \`staging-grpc.acme.com:443\` — staging environment\n\n` +
        `The Unary node's target field reads \`${GRPCWR_TARGET_EXPR}\` and the runtime substitutes whatever value is in this row at execution time. Change it here, click Run, and you've just run the exact same workflow against a different server — no canvas edits, no re-deployment.\n\n` +
        `Leave the default \`${GRPCWR_TARGET_DEFAULT}\` for this demo run.`,
      highlight: '.workflow-vars-section',
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
      // No action — reading step; highlight the variables panel
      pauseAfter: true,
    },

    // ── Step 10: Execution Config ───────────────────────────────────────────
    {
      id: 'grpc24-config',
      title: 'Set Iterations & Concurrency',
      description:
        `In **Execution Config**, set **Iterations** to **${GRPCWR_ITERATIONS}** and **Concurrency** to **${GRPCWR_CONCURRENCY}**.\n\n` +
        `- **Iterations** — how many times the full workflow runs. Each iteration is independent: one Echo Call + one Assert result row in the Dashboard\n` +
        `- **Concurrency** — how many instances run in parallel (\`1\` = sequential, easy to follow in the progress bar)\n\n` +
        `For load testing against a production gRPC server you might use 50 iterations at concurrency 4. Here we keep it to ${GRPCWR_ITERATIONS} so the demo is quick.`,
      highlight: '.workflow-runner-config-section .resilience-field:nth-child(2)',
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
        await applyGrpcWRConfig(ctx);
        await ctx.delay(500);
      },
      // No verify — config is applied via bridge; Run button was already visible
      pauseAfter: true,
    },

    // ── Step 11: Run ────────────────────────────────────────────────────────
    {
      id: 'grpc24-run',
      title: 'Run the Workflow',
      description:
        `Click **▶ Run Workflow**. The progress bar advances as each iteration completes.\n\n` +
        `Each iteration executes: **Start → Echo Call (target=${GRPCWR_TARGET_EXPR} → ${GRPCWR_TARGET_DEFAULT}) → Assert Echo → End**. The run uses \`${GRPCWR_TRACE_LEVEL}\` trace level so the Results Explorer Console will have per-node detail for every iteration.\n\n` +
        `When finished, the green **Completion Banner** shows total requests and wall-clock time. The run is **automatically saved** — it appears in the Results tab's run list immediately.`,
      highlight: GRPC.LESSON24_RUNNER_RUN_BTN,
      preAction: async (ctx) => {
        await ensureRunnerReady(ctx);
      },
      action: async (ctx) => {
        await runGrpcEchoWorkflow(ctx);
      },
      verify: '.completion-section',
      pauseAfter: true,
    },

    // ── Step 12: Navigate to Results ────────────────────────────────────────
    {
      id: 'grpc24-completion',
      title: 'Open the Results Dashboard',
      description:
        `The **Completion Banner** shows total requests, overall status, and wall-clock time.\n\n` +
        `**If 0% error rate:** All ${GRPCWR_ITERATIONS} iterations passed — gRPC status 0 and the message assertion matched.\n\n` +
        `**If error rate > 0%:** The Echo server is unreachable or the assertion failed. Check:\n` +
        `1. Docker running: \`${GRPC_DEMO_DOCKER_COMMAND}\`\n` +
        `2. Back to **Lesson 14** and confirm Quick Test passes with \`${GRPCWR_TARGET_DEFAULT}\`\n\n` +
        `Click **View Full Results →** to open the Results Dashboard.`,
      highlight: '.completion-section .btn-primary',
      preAction: async (ctx) => {
        if (!document.querySelector('.completion-section')) {
          await ensureRunnerReady(ctx);
          await runGrpcEchoWorkflow(ctx);
        }
      },
      action: async (ctx) => {
        await openResultsFromCompletionBanner(ctx);
      },
      verify: '.results-run-filter-tabs',
      pauseAfter: true,
    },

    // ── Step 13: Metrics cards ───────────────────────────────────────────────
    {
      id: 'grpc24-metrics',
      title: 'Throughput & Latency Cards',
      description:
        `The **headline metric cards** summarize the run:\n\n` +
        `- **Req/s** — gRPC Echo calls per second\n` +
        `- **p50 latency** — median round-trip (Echo Call on localhost is typically 5–30ms)\n` +
        `- **p95 latency** — tail latency; should stay close to p50 on a healthy local server\n` +
        `- **Error rate** — 0% when all Assert nodes pass\n\n` +
        `Scroll down for the **Workflow Execution Summary** — iteration chart, per-step breakdown (**Echo Call** vs **Assert Echo** timing).`,
      highlight: GRPC.LESSON24_RESULTS_METRICS,
      preAction: async (ctx) => {
        await openResultsOverviewTab(ctx);
        await ensureFullResultsMetricsCards(ctx);
        await scrollResultsMetricsCardsIntoView(ctx);
      },
      pauseAfter: true,
    },

    // ── Step 14: Request Details tab ─────────────────────────────────────────
    {
      id: 'grpc24-request-detail',
      title: 'Request Details — GRPC Badge Rows',
      description:
        `Click the **Request Details** tab. Each row is one gRPC call from one iteration — **Echo Call** rows show a **GRPC** method badge (analogous to HTTP's GET/POST badge).\n\n` +
        `Click any row to open **Response Detail**: the proto message sent (\`{"message":"workflow-test"}\`), the response body, and gRPC status 0. This is the per-call audit trail — exactly what was sent to \`${GRPCWR_TARGET_DEFAULT}\` and what came back for each of the ${GRPCWR_ITERATIONS} iterations.`,
      highlight: GRPC.LESSON24_REQUEST_DETAILS_TAB,
      preAction: ensureOnResultsTab,
      action: async (ctx) => {
        await openRequestDetailsTab(ctx);
        await ctx.delay(300);
      },
      verify: '.clickable-row',
      pauseAfter: true,
    },

    // ── Step 15: Results Explorer ─────────────────────────────────────────────
    {
      id: 'grpc24-explorer',
      title: 'Results Explorer — Canvas, Detail & Matrix',
      description:
        `Click **📊 Results Explorer** in the dashboard header. The modal has three panels:\n\n` +
        `1. **Canvas** — the workflow diagram with pass/fail badges and per-node timing. **Echo Call** shows average latency; **Assert Echo** shows pass/fail count\n` +
        `2. **Detail panel** — click a node to see the variable snapshot (\`echoReply\`) and assertion results for the selected iteration\n` +
        `3. **Iteration matrix** — grid of iteration × node: Echo Call rows show latency, Assert Echo rows show pass/fail\n\n` +
        `For this two-node chain the bottleneck is always **Echo Call** (the only network step). In more complex workflows the matrix compares multiple node timings side by side.`,
      highlight: GRPCWR_EXPLORER_BTN,
      preAction: async (ctx) => {
        await closeResultsExplorerIfOpen(ctx);
        await ensureOnResultsTab(ctx);
      },
      action: async (ctx) => {
        await openAndFitResultsExplorer(ctx);
        await ctx.delay(500);
      },
      verify: GRPC.LESSON24_RESULTS_EXPLORER_DIAGRAM,
      pauseAfter: true,
    },

    // ── Step 16: Export JSON ──────────────────────────────────────────────────
    {
      id: 'grpc24-export',
      title: 'Export JSON for CI',
      description:
        `Click **Export JSON** in the dashboard header. The file contains:\n\n` +
        `- Run metadata: workflow name, \`${GRPCWR_TARGET_VAR}\` override used, iterations, concurrency, timestamp\n` +
        `- Per-node latency aggregates: p50, p95, p99 for **Echo Call**\n` +
        `- Per-iteration request/response pairs with gRPC status and response body\n\n` +
        `Use this in CI to fail a build when \`p95Latency\` exceeds a threshold, or archive by build SHA to track latency regressions across gRPC service versions. The variable override is recorded in the metadata — so exported results from a staging run are clearly distinguishable from local runs.`,
      highlight: GRPC.LESSON24_EXPORT_JSON_BTN,
      preAction: async (ctx) => {
        await closeResultsExplorerIfOpen(ctx);
        await ensureOnResultsTab(ctx);
      },
      verify: GRPC.LESSON24_EXPORT_JSON_BTN,
      pauseAfter: true,
    },
];
