/** GRPC-WF Workflow integration — lesson steps */
import { GRPC, WF } from '@shared/selectors';
import {
  addWorkflowNodeWithPreset,
  deleteWorkflowByName,
  getWorkflowByName,
  patchWorkflowNodeDataById,
} from '../../adapters';
import { spotlightAndPause } from './grpc-lesson-helpers';
import {
  cleanupWorkflowDemoRunUi,
  closeWfConfigModalIfOpen,
  expandWfDemoAppSidebar,
  fillWfConfigField,
  openWfConsoleIfClosed,
  openWfNodeConfigModal,
  pauseWfConfigSection,
  saveAndCloseWfConfigModal,
  selectWfConfigOption,
  waitForWfConfigPanel,
} from '../wf-demo-helpers';
import type { GrpcDemoLesson } from './grpc-lesson-contract';
import {
  ECHO_ASSERTIONS_JSON,
  ECHO_BODY_JSON,
  ECHO_BEARER_TOKEN,
  ECHO_METADATA_JSON,
  WF14_NAME,
  WF14_NODE_ASSERT,
  WF14_NODE_GRPC,
  WRONG_ASSERTIONS_JSON,
  clickFitViewIfCanvasLoaded,
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
  wf14Session,
} from './grpc-workflow-integration-helpers';

export const grpcWorkflowIntegrationSteps: GrpcDemoLesson['steps'] = [
  // =========================================================================
  // Step 1 — Intro: tour Workflow Designer + gRPC palette blocks
  // =========================================================================
  {
    id: 'grpc11-intro',
    title: 'gRPC Nodes in Workflow Designer',
    pauseAfter: true,
    description: `gRPC Studio is great for **exploring** a service, but production test suites need to **chain calls, assert outcomes, and share outputs** between steps. That is what the **Workflow Designer** is for.

Start here in the **Workflows** sidebar: **+ New** creates a blank canvas for your test. If a workflow is already open, click **Fit view** on the canvas toolbar (bottom center) so every node is centered on screen before you build.

The palette has three gRPC node types:

- **gRPC Unary** — executes one unary call; publishes the response as workflow variables
- **gRPC Assert** — reads the result of an upstream call and evaluates assertions (status, field, trailer, duration)
- **gRPC Server-Stream** — executes a server-streaming call and collects messages until a condition or timeout

In this lesson you will build a short workflow: **Echo Call → Assert Echo**, run it with **Quick Test**, and then see what a failing assertion looks like.`,
    highlight: WF.SIDEBAR_NEW_BTN,
    preAction: async (ctx) => {
      resetWf14Session();
      await cleanupWorkflowDemoRunUi(ctx);
      await closeWfConfigModalIfOpen(ctx);
      ctx.navigateToTab('workflow');
      await ctx.delay(500);
      const skipBtn = document.querySelector<HTMLElement>('.onboarding-tooltip-skip');
      if (skipBtn) {
        skipBtn.click();
        await ctx.delay(300);
      }
    },
    action: async (ctx) => {
      // Beat 1 — + New: where every workflow in this lesson will be created.
      await expandWfDemoAppSidebar(ctx);
      await spotlightAndPause(ctx, WF.SIDEBAR, 700);
      await spotlightAndPause(ctx, WF.SIDEBAR_NEW_BTN, 900);

      // Beat 2 — Fit view when a workflow is already on the canvas.
      await clickFitViewIfCanvasLoaded(ctx);

      // Beat 3 — tour the designer and gRPC palette blocks.
      await spotlightAndPause(ctx, WF.DESIGNER, 800);
      await spotlightAndPause(ctx, WF.PALETTE, 800);

      const grpcUnaryEl = document.querySelector<HTMLElement>(WF.PAL_GRPC_UNARY);
      if (grpcUnaryEl) {
        grpcUnaryEl.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
        await ctx.delay(400);
      }
      await spotlightAndPause(ctx, WF.PAL_GRPC_UNARY, 900);
      await spotlightAndPause(ctx, WF.PAL_GRPC_ASSERT, 800);
      await spotlightAndPause(ctx, WF.CANVAS, 700);
    },
    verify: WF.PALETTE,
  },

  // =========================================================================
  // Step 2 — Create blank workflow
  // =========================================================================
  {
    id: 'grpc11-create',
    title: 'Create a New Workflow',
    pauseAfter: true,
    description: `Click **+ New** in the sidebar to create a blank workflow, then name it **gRPC Echo Demo**. Every workflow starts with a **Start** node (entry point) and an **End** node (exit point). You will add gRPC nodes between them.

The workflow name appears in the sidebar list and in run history — pick names that describe the test intent (e.g. "Order Create → Assert → Cleanup").`,
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
      await spotlightAndPause(ctx, WF.SIDEBAR, 800);

      // Click + New.
      await spotlightAndPause(ctx, WF.SIDEBAR_NEW_BTN, 700);
      await ctx.click(WF.SIDEBAR_NEW_BTN);
      await ctx.delay(400);

      // Pick "Blank" from the dropdown.
      await ctx.click(WF.NEW_BLANK_ITEM);
      await ctx.delay(400);

      // Fill the workflow name.
      await ctx.fill(WF.CREATE_INPUT, WF14_NAME);
      await ctx.delay(300);

      // Confirm create.
      await ctx.click(WF.CREATE_OK);
      await ctx.waitFor(WF.CANVAS, 8000);
      await ctx.delay(700);

      // Collapse sidebar — canvas gets full width.
      await collapseOnce(ctx);
      wf14Session.workflowCreated = true;

      // Spotlight the empty canvas.
      await spotlightAndPause(ctx, WF.CANVAS, 900);
    },
    verify: WF.CANVAS,
  },

  // =========================================================================
  // Step 3 — Add gRPC Unary node from palette
  // =========================================================================
  {
    id: 'grpc11-add-unary',
    title: 'Add a gRPC Unary Node',
    pauseAfter: true,
    description: `Click **gRPC Unary** in the palette — or drag it onto the canvas — to add a unary call node.

The node appears with a **G** badge (Integration category). The demo wires **Start → Echo Call** immediately so you can see the execution path, then clicks **Fit view** to center the connected graph on screen before configuration.

**What the node does at runtime:**

It opens a gRPC channel to the configured target, sends the request body, waits for the unary response, and publishes all response fields into the steps.{nodeId}.* variable namespace so downstream nodes can reference them.`,
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
        await ctx.delay(400);
      }
      await spotlightAndPause(ctx, WF.PAL_GRPC_UNARY, 900);

      // Add node via bridge (same as clicking in palette).
      if (!isNodeOnCanvas(WF14_NODE_GRPC)) {
        addWorkflowNodeWithPreset('grpcUnary', WF14_NODE_GRPC, 'Echo Call', {
          x: 320,
          y: 200,
        });
        await ctx.delay(600);
        wf14Session.unaryAdded = true;
      }

      // Wire Start → Echo Call immediately (resolve real canvas node ids).
      connectCanvasNodes('.react-flow__node-start', WF.NODE_GRPC_UNARY, 'out');
      await ctx.delay(600);

      // Center the connected graph on screen.
      await clickWfFitView(ctx);

      // Spotlight the canvas with the new node and edge.
      await spotlightAndPause(ctx, WF.CANVAS, 800);
      await spotlightAndPause(ctx, WF.NODE_GRPC_UNARY, 900);
    },
    verify: WF.NODE_GRPC_UNARY,
  },

  // =========================================================================
  // Step 4 — Configure gRPC Unary: Target, Service, Method
  // =========================================================================
  {
    id: 'grpc11-config-conn',
    title: 'Configure: Target, Service & Method',
    pauseAfter: true,
    description: `Double-click the node (or use the config button) to open the configuration panel.

**Target** — the gRPC server address; use localhost:50051 for the local Go Echo fixture. Studio reflects automatically against that host.

**Descriptor Key** — auto-filled after reflection. It is the cache ID for the protobuf schema the runtime uses to encode your JSON request and decode the response; you rarely edit it manually.

**Service** and **Method** — pick from the dropdown lists populated by reflection instead of typing package names by hand.

You can still use environment variable templates like {{grpcHost}} for portable targets; in that case service and method stay as manual inputs until the runner resolves the address.`,
    highlight: GRPC.WF_UNARY_CONFIG,
    preAction: async (ctx) => {
      await ensureOnWorkflowTab(ctx);
      if (!isWorkflowPresent() || !isNodeOnCanvas(WF14_NODE_GRPC)) {
        await seedCompleteWorkflowQuiet(ctx);
        return;
      }
      await closeWfConfigModalIfOpen(ctx);
    },
    action: async (ctx) => {
      // Open config modal for the unary node.
      await openWfNodeConfigModal(ctx, { nodeId: WF14_NODE_GRPC });
      await waitForWfConfigPanel(ctx, GRPC.WF_UNARY_CONFIG);

      // Spotlight the config panel.
      await spotlightAndPause(ctx, GRPC.WF_UNARY_CONFIG, 800);

      // Fill Target — reflection runs automatically.
      await fillWfConfigField(ctx, GRPC.WF_UNARY_CFG_TARGET, 'localhost:50051');
      try {
        await ctx.waitFor('[data-testid="grpc-unary-config-reflect-status"][data-status="ready"]', 12_000);
      } catch { /* reflection may already be cached */ }
      await ctx.delay(600);

      // Pick Service and Method from reflection dropdowns.
      await selectWfConfigOption(ctx, GRPC.WF_UNARY_CFG_SERVICE, 'echo.EchoService');
      await selectWfConfigOption(ctx, GRPC.WF_UNARY_CFG_METHOD, 'Echo');

      // Spotlight the whole panel to show the filled connection fields.
      await pauseWfConfigSection(ctx);
      await spotlightAndPause(ctx, GRPC.WF_UNARY_CONFIG, 900);
    },
    verify: GRPC.WF_UNARY_CONFIG,
  },

  // =========================================================================
  // Step 5 — Configure body + Save As; save and close
  // =========================================================================
  {
    id: 'grpc11-config-body',
    title: 'Configure: Request Body & Save As',
    pauseAfter: true,
    description: `**Request Body** — a JSON object matching the proto message fields. For EchoRequest we send { "message": "workflow-test" }. You can use workflow variable templates like {{myVar}} inside the JSON values.

**Save As** — an alias for the output namespace. Setting echoReply means downstream nodes can reference {{steps.echoReply.grpc.response.message}} instead of the raw node ID. Keep aliases short and descriptive.

Click **Save** to close the panel and apply the configuration.`,
    highlight: GRPC.WF_UNARY_CFG_BODY,
    preAction: async (ctx) => {
      await ensureOnWorkflowTab(ctx);
      if (!isWorkflowPresent() || !isNodeOnCanvas(WF14_NODE_GRPC)) {
        await seedCompleteWorkflowQuiet(ctx);
        return;
      }
      await closeWfConfigModalIfOpen(ctx);
      // Ensure connection config is set if step 4 was skipped.
      ensureUnaryConnectionConfig();
    },
    action: async (ctx) => {
      // Open config modal (may already be open, re-open for viewer clarity).
      await openWfNodeConfigModal(ctx, { nodeId: WF14_NODE_GRPC });
      await waitForWfConfigPanel(ctx, GRPC.WF_UNARY_CONFIG);

      // Spotlight the body textarea.
      await spotlightAndPause(ctx, GRPC.WF_UNARY_CFG_BODY, 900);

      // Fill body JSON.
      await fillWfConfigField(ctx, GRPC.WF_UNARY_CFG_BODY, ECHO_BODY_JSON);

      // Section break before Save As.
      await pauseWfConfigSection(ctx);

      // Spotlight and fill Save As.
      await spotlightAndPause(ctx, GRPC.WF_UNARY_CFG_SAVE_AS, 800);
      await fillWfConfigField(ctx, GRPC.WF_UNARY_CFG_SAVE_AS, 'echoReply');

      // Save and close the modal.
      await saveAndCloseWfConfigModal(ctx);
      wf14Session.unaryConfigured = true;
      await ctx.delay(500);

      // Spotlight the configured node on canvas.
      await spotlightAndPause(ctx, WF.NODE_GRPC_UNARY, 900);
    },
    verify: WF.NODE_GRPC_UNARY,
  },

  // =========================================================================
  // Step 6 — Configure metadata, auth, and TLS options
  // =========================================================================
  {
    id: 'grpc11-config-security',
    title: 'Configure: Metadata, Auth & TLS',
    pauseAfter: true,
    description: `Workflow gRPC nodes support the same transport options as gRPC Studio:

**Metadata (JSON object)** — custom request headers such as \`x-demo-run-id\` for correlation across workflow steps.

**Authentication** — choose **Bearer Token**, Basic, API Key, or inherit from a global auth profile. The token is merged into outbound metadata at runtime.

**TLS mode** — keep **Plaintext** for the local Echo fixture on \`localhost:50051\`. Switch to **TLS** or **mTLS** and configure certificates when calling encrypted servers (for example the Docker fixture on \`localhost:50443\`).

**Connection profile** — optionally pick a saved gRPC profile to prefill target and TLS settings from Environment Manager.`,
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

      await spotlightAndPause(ctx, GRPC.WF_UNARY_CFG_METADATA, 900);
      await fillWfConfigField(ctx, GRPC.WF_UNARY_CFG_METADATA, ECHO_METADATA_JSON);
      await pauseWfConfigSection(ctx);

      await spotlightAndPause(ctx, GRPC.WF_UNARY_CFG_AUTH_SECTION, 900);
      await selectWfConfigOption(ctx, GRPC.AUTH_TYPE_SELECT, 'bearer');
      await ctx.delay(500);
      await fillWfConfigField(ctx, GRPC.AUTH_BEARER_TOKEN, ECHO_BEARER_TOKEN);
      await pauseWfConfigSection(ctx);

      await spotlightAndPause(ctx, GRPC.WF_UNARY_CFG_TLS_MODE, 800);
      await ctx.delay(700);

      await saveAndCloseWfConfigModal(ctx);
      wf14Session.unarySecurityConfigured = true;
      await ctx.delay(500);
      await spotlightAndPause(ctx, WF.NODE_GRPC_UNARY, 900);
    },
    verify: GRPC.WF_UNARY_CFG_AUTH_SECTION,
  },

  // =========================================================================
  // Step 7 — Add gRPC Assert node; connect after unary
  // =========================================================================
  {
    id: 'grpc11-add-assert',
    title: 'Add a gRPC Assert Node',
    pauseAfter: true,
    description: `Click **gRPC Assert** in the palette to add an assertion gate after the Echo call.

The **gRPC Assert** node does not make any network calls — it reads the result stored by an upstream call node and evaluates your assertions:

- grpcStatus: 0 — expects OK status code (0 = success in gRPC)
- grpcField: "message" — checks a field in the response body
- grpcTrailer: "..." — checks a trailing metadata value
- grpcDuration: { max: 500 } — enforces a latency budget

After the node appears, the demo wires **Echo Call → Assert Echo → End**, then clicks **Fit view** so the full chain is visible on screen.`,
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
      // Spotlight the palette gRPC Assert block.
      const assertBlock = document.querySelector<HTMLElement>(WF.PAL_GRPC_ASSERT);
      if (assertBlock) {
        assertBlock.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
        await ctx.delay(400);
      }
      await spotlightAndPause(ctx, WF.PAL_GRPC_ASSERT, 900);

      // Add assert node if not present.
      if (!isNodeOnCanvas(WF14_NODE_ASSERT)) {
        addWorkflowNodeWithPreset('grpcAssert', WF14_NODE_ASSERT, 'Assert Echo', {
          x: 580,
          y: 200,
        });
        await ctx.delay(500);
        wf14Session.assertAdded = true;
      }

      // Wire Echo Call → Assert → End (default handles — only Start uses out).
      ensureGrpcEchoChainConnected();
      await ctx.delay(600);

      // Center the full connected graph on screen.
      await clickWfFitView(ctx);

      // Spotlight the canvas to show the connected graph.
      await spotlightAndPause(ctx, WF.CANVAS, 800);

      // Spotlight the assert node.
      await spotlightAndPause(ctx, WF.NODE_GRPC_ASSERT, 900);
    },
    verify: WF.NODE_GRPC_ASSERT,
  },

  // =========================================================================
  // Step 7 — Configure gRPC Assert
  // =========================================================================
  {
    id: 'grpc11-config-assert',
    title: 'Configure the Assert Node',
    pauseAfter: true,
    description: `**Source** — the node ID or saveAs alias of the upstream gRPC call whose result this node should evaluate. Enter echoReply (the alias we set in Step 5).

**Assertions (JSON array)** — a list of assertion objects. Each object specifies one condition. They are evaluated in order and all must pass:

[ { "grpcStatus": 0 }, { "grpcField": "message", "equals": "workflow-test" } ]

grpcField uses dot-notation to reach nested fields, e.g. "nested.value".
Click **Save** to apply.`,
    highlight: GRPC.WF_ASSERT_CONFIG,
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
      await closeWfConfigModalIfOpen(ctx);
      ensureGrpcEchoChainConnected();
    },
    action: async (ctx) => {
      // Open assert node config.
      await openWfNodeConfigModal(ctx, { nodeId: WF14_NODE_ASSERT });
      await waitForWfConfigPanel(ctx, GRPC.WF_ASSERT_CONFIG);

      // Spotlight the config panel.
      await spotlightAndPause(ctx, GRPC.WF_ASSERT_CONFIG, 800);

      // Fill Source.
      await spotlightAndPause(ctx, GRPC.WF_ASSERT_CFG_SOURCE, 800);
      await fillWfConfigField(ctx, GRPC.WF_ASSERT_CFG_SOURCE, 'echoReply');

      // Section break before assertions.
      await pauseWfConfigSection(ctx);

      // Fill Assertions JSON.
      await spotlightAndPause(ctx, GRPC.WF_ASSERT_CFG_ASSERTIONS, 900);
      await fillWfConfigField(ctx, GRPC.WF_ASSERT_CFG_ASSERTIONS, ECHO_ASSERTIONS_JSON);

      // Save and close.
      await saveAndCloseWfConfigModal(ctx);
      wf14Session.assertConfigured = true;
      await ctx.delay(500);

      // Spotlight the full canvas with both nodes.
      await spotlightAndPause(ctx, WF.CANVAS, 900);
    },
    verify: WF.CANVAS,
  },

  // =========================================================================
  // Step 8 — Run Quick Test; all nodes green
  // =========================================================================
  {
    id: 'grpc11-quick-test',
    title: 'Run Quick Test — All Green',
    pauseAfter: true,
    description: `Click **Quick Test** to execute the workflow once without saving a run record. The canvas shows live step status as each node runs:

- **🟢 Green** — the node succeeded (gRPC call returned OK; all assertions passed)
- **🔴 Red** — the node failed (call error or assertion failure)
- **🔵 Blue / running** — the node is executing

When the run completes, the console log shows the full gRPC request and response for each call node, plus assertion pass/fail details for each assert node. **Tip:** The Go Echo server must be running at localhost:50051 for Quick Test to succeed.`,
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
      // Keep the console mounted before execution so live logs are captured.
      await spotlightAndPause(ctx, WF.CONSOLE, 800);

      // Spotlight the Quick Test button.
      await spotlightAndPause(ctx, WF.QUICK_TEST_BTN, 900);

      // Trigger Quick Test with a visible click so the viewer sees it happen.
      await ctx.click(WF.QUICK_TEST_BTN);
      await ctx.delay(700);

      // Wait for node run overlays to appear (success or fail).
      try {
        await ctx.waitFor('.wf-node-run-status', 15_000);
      } catch { /* server may not be running; continue demo */ }
      await ctx.delay(800);

      // Spotlight the canvas with node status overlays.
      await spotlightAndPause(ctx, WF.CANVAS, 1000);

      // Return to the console to show the streamed request/response logs.
      await spotlightAndPause(ctx, WF.CONSOLE, 900);

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
    pauseAfter: true,
    description: `Edit the **Assert Echo** node: change "equals": "workflow-test" to "equals": "wrong-value". Re-run Quick Test.

The gRPC Unary node still completes (the server returns OK), but the assertion node turns **red** because the response field did not match the expected value.

In the console log you will see the exact failure reason: which assertion failed and what value was actually returned. This is how you diagnose unexpected responses in a workflow — the failing assert node pinpoints **which step** in the chain broke, not just that the workflow failed.`,
    highlight: WF.NODE_GRPC_ASSERT,
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
      // Spotlight the assert node.
      await spotlightAndPause(ctx, WF.NODE_GRPC_ASSERT, 800);

      // Open assert config.
      await openWfNodeConfigModal(ctx, { nodeId: WF14_NODE_ASSERT });
      await waitForWfConfigPanel(ctx, GRPC.WF_ASSERT_CONFIG);

      // Spotlight the assertions field.
      await spotlightAndPause(ctx, GRPC.WF_ASSERT_CFG_ASSERTIONS, 900);

      // Patch to wrong value.
      await fillWfConfigField(ctx, GRPC.WF_ASSERT_CFG_ASSERTIONS, WRONG_ASSERTIONS_JSON);

      // Save and close.
      await saveAndCloseWfConfigModal(ctx);
      await ctx.delay(500);

      // Run Quick Test again.
      await spotlightAndPause(ctx, WF.CONSOLE, 700);
      await spotlightAndPause(ctx, WF.QUICK_TEST_BTN, 800);
      await ctx.click(WF.QUICK_TEST_BTN);
      await ctx.delay(700);

      // Wait for node overlays.
      try {
        await ctx.waitFor('.wf-node-run-status', 15_000);
      } catch { /* server may not be running */ }
      await ctx.delay(800);

      // Spotlight canvas — assert node should be red.
      await spotlightAndPause(ctx, WF.CANVAS, 900);
      await spotlightAndPause(ctx, WF.NODE_GRPC_ASSERT, 1000);

      // Open console to show failure detail.
      await openWfConsoleIfClosed(ctx);
      await ctx.delay(500);
      await spotlightAndPause(ctx, WF.CONSOLE, 900);
    },
    verify: WF.NODE_GRPC_ASSERT,
  },
];
