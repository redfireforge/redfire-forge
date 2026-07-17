/**
 * Lesson GRPC-WF: gRPC in Workflows — Nodes, Assertions & Chaining
 *
 * Thin barrel — helpers and steps live in sibling modules.
 */
import { deleteWorkflowByName, fitWorkflowCanvasView } from '../../adapters';
import {
  buildGrpcLessonShellFromRoster,
  buildGrpcContractMetaFromRoster,
  getGrpcLessonRosterEntry,
  type GrpcDemoLesson,
} from './grpc-lesson-contract';
import { grpcFirstCallCleanup } from './grpc-lesson-helpers';
import {
  cleanupWorkflowDemoRunUi,
  closeWfConfigModalIfOpen,
  closeWfConsoleIfOpen,
  expandWfDemoAppSidebar,
  setWfConfigDemoTiming,
  WF_CONFIG_DEMO_TIMING_BRISK,
} from '../wf-demo-helpers';
import { WF } from '@shared/selectors';
import {
  WF14_NAME,
  resetWf14Session,
  seedCompleteWorkflowQuiet,
  wf14Session,
} from './grpc-workflow-integration-helpers';
import { grpcWorkflowIntegrationSteps } from './grpc-workflow-integration-steps';

const GRPC_WF_ROSTER = getGrpcLessonRosterEntry('grpc-workflow-integration')!;

export const grpcWorkflowIntegrationLesson: GrpcDemoLesson = {
  ...buildGrpcLessonShellFromRoster(GRPC_WF_ROSTER),
  domainId: 'protocols',
  category: 'grpc',
  grpc: buildGrpcContractMetaFromRoster(GRPC_WF_ROSTER),
  description:
    'Build a workflow with a gRPC Unary node, chain it to a gRPC Assert node, run ' +
    'Quick Test, and see how assertion failures surface in the canvas and console log.',
  concept: {
    title: 'gRPC Workflow Nodes — Call, Assert, Chain',
    body: `gRPC Studio is for exploration; the **Workflow Designer** is for automated, repeatable test suites that chain multiple calls and assertions.

Three node types cover the core workflow patterns:

- **grpcUnary** — a single unary call; publishes response fields as steps.{alias}.* variables
- **grpcServerStream** — a streaming call; collects messages until count/expression/timeout
- **grpcAssert** — reads an upstream node's result; evaluates status, field, trailer, and duration assertions

Assertions use a compact JSON DSL — no code:

[ { "grpcStatus": 0 }, { "grpcField": "message", "equals": "workflow-test" }, { "grpcDuration": { "max": 500 } } ]

A failing assert node **blocks downstream execution** unless onError: "continue" is set. The console log shows the exact field value that did not match.`,
    keyTerms: [
      {
        term: 'grpcUnary node',
        definition:
          'A workflow node that executes one unary gRPC call. Publishes the response body, status, headers, trailers, and duration as steps.{alias}.* variables for downstream nodes.',
      },
      {
        term: 'grpcAssert node',
        definition:
          'A workflow node that reads an upstream call\'s result and evaluates assertions — grpcStatus, grpcField, grpcTrailer, and grpcDuration. Fails the workflow on mismatch unless onError: "continue" is set.',
      },
      {
        term: 'grpcServerStream node',
        definition:
          'A workflow node for server-streaming calls. Collects messages until a count limit, expression match, or timeout. Publishes the collected message array for downstream assertions.',
      },
      {
        term: 'Assertion DSL',
        definition:
          'A compact JSON array where each object is one assertion rule: { "grpcStatus": 0 }, { "grpcField": "name", "equals": "value" }, { "grpcDuration": { "max": 500 } }. No scripting required.',
      },
      {
        term: 'Quick Test',
        definition:
          'A one-click workflow execution that runs Start → all nodes → End on the canvas. Green badges mean pass; red badges mean an assertion failed. The console log shows per-node details.',
      },
    ],
    diagram: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 340" style="display:block;width:100%;height:auto;font-family:system-ui,sans-serif">
  <defs>
    <marker id="grpc11-arr" markerWidth="7" markerHeight="7" refX="4" refY="3.5" orient="auto">
      <path d="M1,1 L6,3.5 L1,6 Z" fill="#3b82f6"/>
    </marker>
    <marker id="grpc11-arr-g" markerWidth="7" markerHeight="7" refX="4" refY="3.5" orient="auto">
      <path d="M1,1 L6,3.5 L1,6 Z" fill="#22c55e"/>
    </marker>
    <marker id="grpc11-arr-r" markerWidth="7" markerHeight="7" refX="4" refY="3.5" orient="auto">
      <path d="M1,1 L6,3.5 L1,6 Z" fill="#ef4444"/>
    </marker>
  </defs>

  <!-- Background -->
  <rect width="700" height="340" rx="10" fill="#0d1520"/>

  <!-- Title -->
  <text x="350" y="28" text-anchor="middle" font-size="13" fill="#e2e8f0" font-weight="600">Workflow: Call → Assert → Result</text>

  <!-- ── Canvas area ── -->
  <rect x="20" y="45" width="660" height="155" rx="8" fill="#0f172a" stroke="#3b4a60" stroke-width="1"/>
  <text x="40" y="65" font-size="9" fill="#64748b">Workflow Canvas</text>

  <!-- Start node -->
  <rect x="40" y="90" width="70" height="40" rx="20" fill="#1e293b" stroke="#22c55e" stroke-width="1.4"/>
  <text x="75" y="115" text-anchor="middle" font-size="9" fill="#4ade80" font-weight="600">Start</text>

  <!-- Arrow: Start → Unary -->
  <line x1="110" y1="110" x2="155" y2="110" stroke="#3b82f6" stroke-width="1.4" marker-end="url(#grpc11-arr)"/>

  <!-- gRPC Unary node -->
  <rect x="160" y="80" width="140" height="60" rx="6" fill="#1e293b" stroke="#3b82f6" stroke-width="1.4"/>
  <rect x="160" y="80" width="22" height="60" rx="6" fill="#1d4ed8"/>
  <text x="171" y="115" text-anchor="middle" font-size="11" fill="#ffffff" font-weight="700">G</text>
  <text x="235" y="102" text-anchor="middle" font-size="9" fill="#93c5fd" font-weight="600">gRPC Unary</text>
  <text x="235" y="118" text-anchor="middle" font-size="7.5" fill="#a8b8cc">Echo Call</text>
  <text x="235" y="132" text-anchor="middle" font-family="monospace" font-size="6.5" fill="#64748b">{"message":"workflow-test"}</text>

  <!-- Arrow: Unary → Assert -->
  <line x1="300" y1="110" x2="345" y2="110" stroke="#3b82f6" stroke-width="1.4" marker-end="url(#grpc11-arr)"/>

  <!-- gRPC Assert node -->
  <rect x="350" y="80" width="140" height="60" rx="6" fill="#1e293b" stroke="#fbbf24" stroke-width="1.4"/>
  <rect x="350" y="80" width="22" height="60" rx="6" fill="#b45309"/>
  <text x="361" y="115" text-anchor="middle" font-size="11" fill="#ffffff" font-weight="700">A</text>
  <text x="425" y="102" text-anchor="middle" font-size="9" fill="#fbbf24" font-weight="600">gRPC Assert</text>
  <text x="425" y="118" text-anchor="middle" font-size="7.5" fill="#a8b8cc">Assert Echo</text>
  <text x="425" y="132" text-anchor="middle" font-family="monospace" font-size="6.5" fill="#64748b">status=OK, field=message</text>

  <!-- Arrow: Assert → End -->
  <line x1="490" y1="110" x2="540" y2="110" stroke="#3b82f6" stroke-width="1.4" marker-end="url(#grpc11-arr)"/>

  <!-- End node -->
  <rect x="545" y="90" width="70" height="40" rx="20" fill="#1e293b" stroke="#64748b" stroke-width="1.4"/>
  <text x="580" y="115" text-anchor="middle" font-size="9" fill="#a8b8cc" font-weight="600">End</text>

  <!-- Pass badges -->
  <rect x="195" y="73" width="30" height="14" rx="7" fill="#1c3a2a" stroke="#22c55e" stroke-width="0.8"/>
  <text x="210" y="83" text-anchor="middle" font-size="7" fill="#4ade80">✓ OK</text>
  <rect x="390" y="73" width="30" height="14" rx="7" fill="#1c3a2a" stroke="#22c55e" stroke-width="0.8"/>
  <text x="405" y="83" text-anchor="middle" font-size="7" fill="#4ade80">✓ OK</text>

  <!-- Quick Test button -->
  <rect x="280" y="160" width="100" height="24" rx="12" fill="#1d4ed8" stroke="#3b82f6" stroke-width="1"/>
  <text x="330" y="176" text-anchor="middle" font-size="9" fill="#ffffff" font-weight="600">▶ Quick Test</text>

  <!-- ── Bottom: Variable publish + assertion DSL ── -->
  <rect x="20" y="215" width="320" height="105" rx="6" fill="#0f172a" stroke="#3b82f6" stroke-width="1"/>
  <text x="180" y="235" text-anchor="middle" font-size="9.5" fill="#93c5fd" font-weight="600">Published Variables (from Unary)</text>
  <rect x="32" y="245" width="296" height="14" rx="3" fill="#0a1118" stroke="#3b4a60"/>
  <text x="180" y="256" text-anchor="middle" font-family="monospace" font-size="7" fill="#a8b8cc">steps.echoCall.body.message = "workflow-test"</text>
  <rect x="32" y="263" width="296" height="14" rx="3" fill="#0a1118" stroke="#3b4a60"/>
  <text x="180" y="274" text-anchor="middle" font-family="monospace" font-size="7" fill="#a8b8cc">steps.echoCall.status = 0  (OK)</text>
  <rect x="32" y="281" width="296" height="14" rx="3" fill="#0a1118" stroke="#3b4a60"/>
  <text x="180" y="292" text-anchor="middle" font-family="monospace" font-size="7" fill="#a8b8cc">steps.echoCall.duration = 3ms</text>

  <rect x="360" y="215" width="320" height="105" rx="6" fill="#0f172a" stroke="#fbbf24" stroke-width="1"/>
  <text x="520" y="235" text-anchor="middle" font-size="9.5" fill="#fbbf24" font-weight="600">Assertion DSL (Assert node)</text>
  <rect x="372" y="245" width="296" height="14" rx="3" fill="#0a1118" stroke="#3b4a60"/>
  <text x="520" y="256" text-anchor="middle" font-family="monospace" font-size="7" fill="#4ade80">{ "grpcStatus": 0 }</text>
  <rect x="372" y="263" width="296" height="14" rx="3" fill="#0a1118" stroke="#3b4a60"/>
  <text x="520" y="274" text-anchor="middle" font-family="monospace" font-size="7" fill="#4ade80">{ "grpcField":"message", "equals":"workflow-test" }</text>
  <rect x="372" y="281" width="296" height="14" rx="3" fill="#0a1118" stroke="#3b4a60"/>
  <text x="520" y="292" text-anchor="middle" font-family="monospace" font-size="7" fill="#4ade80">{ "grpcDuration": { "max": 500 } }</text>
</svg>`,
  },
  steps: grpcWorkflowIntegrationSteps,
  setup: async (ctx) => {
    resetWf14Session();
    // Dense multi-field config tour — use brisk modal pacing (still readable at 1×).
    setWfConfigDemoTiming(WF_CONFIG_DEMO_TIMING_BRISK);
    // Land directly on step 1 Reading: seeded Echo workflow + Blocks palette.
    // Skip grpcFirstCallSetup Studio tour (visible tab/drawer flash before Reading).
    try {
      const { purgeGrpcDemoEphemeralStorage } = await import('../grpc-demo-storage-cleanup');
      await purgeGrpcDemoEphemeralStorage();
    } catch {
      // Best-effort hygiene only.
    }
    await cleanupWorkflowDemoRunUi(ctx);
    await closeWfConfigModalIfOpen(ctx);
    ctx.navigateToTab('workflow');
    await ctx.delay(180);
    const skipBtn = document.querySelector<HTMLElement>('.onboarding-tooltip-skip');
    if (skipBtn) { skipBtn.click(); await ctx.delay(60); }
    await seedCompleteWorkflowQuiet(ctx);
    await expandWfDemoAppSidebar(ctx);
    wf14Session.sidebarCollapsed = false;
    await ctx.waitFor(WF.PAL_SEARCH, 5000);
    if (document.querySelector<HTMLInputElement>(WF.PAL_SEARCH)?.value) {
      await ctx.fill(WF.PAL_SEARCH, '');
    }
    // Fit View so Reading opens on a readable centered graph (sidebar + LiveDemo card).
    fitWorkflowCanvasView();
    document.querySelector<HTMLElement>(WF.FIT_VIEW_BTN)?.click();
    await ctx.delay(120);
  },
  cleanup: async (ctx) => {
    await closeWfConfigModalIfOpen(ctx);
    await cleanupWorkflowDemoRunUi(ctx);
    await closeWfConsoleIfOpen(ctx);
    deleteWorkflowByName(WF14_NAME);
    resetWf14Session();
    setWfConfigDemoTiming(null);
    await grpcFirstCallCleanup(ctx);
  },
};
