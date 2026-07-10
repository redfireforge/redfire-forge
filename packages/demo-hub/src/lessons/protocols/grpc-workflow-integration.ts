/**
 * Lesson GRPC-WF: gRPC in Workflows — Nodes, Assertions & Chaining
 *
 * Thin barrel — helpers and steps live in sibling modules.
 */
import { deleteWorkflowByName, getWorkflowByName } from '../../adapters';
import {
  buildGrpcLessonShellFromRoster,
  buildGrpcContractMetaFromRoster,
  getGrpcLessonRosterEntry,
  type GrpcDemoLesson,
} from './grpc-lesson-contract';
import {
  grpcFirstCallCleanup,
  grpcFirstCallSetup,
} from './grpc-lesson-helpers';
import {
  cleanupWorkflowDemoRunUi,
  closeWfConfigModalIfOpen,
  closeWfConsoleIfOpen,
  collapseWfDemoAppSidebar,
} from '../wf-demo-helpers';
import {
  WF14_NAME,
  resetWf14Session,
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
  },
  steps: grpcWorkflowIntegrationSteps,
  setup: async (ctx) => {
    resetWf14Session();
    await grpcFirstCallSetup(ctx);
    await cleanupWorkflowDemoRunUi(ctx);
    await closeWfConfigModalIfOpen(ctx);
    if (getWorkflowByName(WF14_NAME)) {
      deleteWorkflowByName(WF14_NAME);
      await ctx.delay(200);
    }
    ctx.navigateToTab('workflow');
    await ctx.delay(400);
    const skipBtn = document.querySelector<HTMLElement>('.onboarding-tooltip-skip');
    if (skipBtn) { skipBtn.click(); await ctx.delay(200); }
    await collapseWfDemoAppSidebar(ctx);
    wf14Session.sidebarCollapsed = true;
  },
  cleanup: async (ctx) => {
    await closeWfConfigModalIfOpen(ctx);
    await cleanupWorkflowDemoRunUi(ctx);
    await closeWfConsoleIfOpen(ctx);
    deleteWorkflowByName(WF14_NAME);
    resetWf14Session();
    await grpcFirstCallCleanup(ctx);
  },
};
