/** GRPC-WF Workflow integration — constants, session state, and quiet helpers */
import { FIXTURE_DESCRIPTOR_KEY } from '@shared/grpc/contractFixtures';
import { WF } from '@shared/selectors';
import {
  getGrpcActiveDescriptorKey,
  connectWorkflowNodes,
  getWorkflowByName,
  patchWorkflowNodeDataById,
  removeWorkflowEdge,
  seedNamedWorkflow,
} from '../../adapters';
import { spotlightAndPause } from './grpc-lesson-helpers';
import {
  collapseWfDemoAppSidebar,
} from '../wf-demo-helpers';
import type { DemoActionContext } from '../../types';

export const WF14_NAME = 'gRPC Echo Demo';
export const WF14_NODE_START = 'grpc14-start';
export const WF14_NODE_GRPC = 'grpc14-echo';
export const WF14_NODE_ASSERT = 'grpc14-assert';
export const WF14_NODE_END = 'grpc14-end';

/** Request body for the Echo call — set once when config step runs. */
export const ECHO_BODY_JSON = '{\n  "message": "workflow-test"\n}';

/** Metadata sent with the Echo call — demo correlation header. */
export const ECHO_METADATA_JSON = '{\n  "x-demo-run-id": "workflow-demo"\n}';

/** Demo bearer token for auth panel step. */
export const ECHO_BEARER_TOKEN = 'demo-workflow-token';

/** Assertions array — grpcStatus: 0 + field check. */
export const ECHO_ASSERTIONS_JSON =
  '[\n' +
  '  { "grpcStatus": 0 },\n' +
  '  { "grpcField": "message", "equals": "workflow-test" }\n' +
  ']';

/** Intentionally wrong assertions for the failure step. */
export const WRONG_ASSERTIONS_JSON =
  '[\n' +
  '  { "grpcField": "message", "equals": "wrong-value" }\n' +
  ']';

function resolveWorkflowDescriptorKey(): string {
  return getGrpcActiveDescriptorKey() ?? FIXTURE_DESCRIPTOR_KEY;
}

// ---------------------------------------------------------------------------
// Session flags — track which build steps have been completed this run
// ---------------------------------------------------------------------------

export const wf14Session = {
  sidebarCollapsed: false,
  workflowCreated: false,
  unaryAdded: false,
  unaryConfigured: false,
  unarySecurityConfigured: false,
  assertAdded: false,
  assertConfigured: false,
  quickTestRun: false,
};

export function resetWf14Session(): void {
  wf14Session.sidebarCollapsed = false;
  wf14Session.workflowCreated = false;
  wf14Session.unaryAdded = false;
  wf14Session.unaryConfigured = false;
  wf14Session.unarySecurityConfigured = false;
  wf14Session.assertAdded = false;
  wf14Session.assertConfigured = false;
  wf14Session.quickTestRun = false;
}

// ---------------------------------------------------------------------------
// Workflow factory — used by preAction guards to rebuild on rapid Next
// ---------------------------------------------------------------------------

export function buildCompleteGrpcEchoWorkflow(): Record<string, unknown> {
  return {
    id: 'grpc14-wf-demo',
    name: WF14_NAME,
    schemaVersion: 6,
    variables: {},
    services: [],
    hostProfiles: [],
    authProfiles: [],
    nodes: [
      {
        id: WF14_NODE_START,
        type: 'start',
        position: { x: 100, y: 200 },
        data: { label: 'Start', inputVariables: {} },
      },
      {
        id: WF14_NODE_GRPC,
        type: 'grpcUnary',
        position: { x: 320, y: 200 },
        data: {
          label: 'Echo Call',
          callType: 'unary',
          target: 'localhost:50051',
          descriptorKey: resolveWorkflowDescriptorKey(),
          service: 'echo.EchoService',
          method: 'Echo',
          body: { message: 'workflow-test' },
          metadata: { 'x-demo-run-id': 'workflow-demo' },
          auth: { type: 'bearer', bearerToken: ECHO_BEARER_TOKEN },
          saveAs: 'echoReply',
          onError: 'fail',
        },
      },
      {
        id: WF14_NODE_ASSERT,
        type: 'grpcAssert',
        position: { x: 580, y: 200 },
        data: {
          label: 'Assert Echo',
          source: 'echoReply',
          assertions: [
            { grpcStatus: 0 },
            { grpcField: 'message', equals: 'workflow-test' },
          ],
          onError: 'fail',
        },
      },
      {
        id: WF14_NODE_END,
        type: 'end',
        position: { x: 820, y: 200 },
        data: { label: 'End' },
      },
    ],
    edges: [
      { id: 'grpc14-e1', source: WF14_NODE_START, target: WF14_NODE_GRPC },
      { id: 'grpc14-e2', source: WF14_NODE_GRPC, target: WF14_NODE_ASSERT },
      { id: 'grpc14-e3', source: WF14_NODE_ASSERT, target: WF14_NODE_END },
    ],
  };
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

export function isNodeOnCanvas(nodeId: string): boolean {
  return !!document.querySelector(`.react-flow__node[data-id="${nodeId}"]`);
}

export function isWorkflowPresent(): boolean {
  return !!getWorkflowByName(WF14_NAME);
}

function isCanvasShowingWorkflow(): boolean {
  return !!document.querySelector(`${WF.CANVAS} .react-flow__node`);
}

/** Visible Fit view click — centers the connected graph on screen. */
export async function clickWfFitView(ctx: DemoActionContext): Promise<void> {
  const fitBtn = document.querySelector<HTMLElement>(WF.FIT_VIEW_BTN);
  if (!fitBtn) return;
  await spotlightAndPause(ctx, WF.FIT_VIEW_BTN, 800);
  await ctx.click(WF.FIT_VIEW_BTN);
  await ctx.delay(600);
}

/** Click Fit view when the canvas already has nodes (e.g. a previously opened workflow). */
export async function clickFitViewIfCanvasLoaded(ctx: DemoActionContext): Promise<void> {
  if (!isCanvasShowingWorkflow()) return;
  await clickWfFitView(ctx);
}

function resolveCanvasNodeId(selector: string, fallbackId = ''): string {
  const el = document.querySelector<HTMLElement>(selector);
  return el?.getAttribute('data-id')
    ?? el?.closest('.react-flow__node')?.getAttribute('data-id')
    ?? fallbackId;
}

export function connectCanvasNodes(
  sourceSelector: string,
  targetSelector: string,
  sourceHandle: string | null = null,
): boolean {
  const sourceId = resolveCanvasNodeId(sourceSelector);
  const targetId = resolveCanvasNodeId(targetSelector);
  if (!sourceId || !targetId) return false;
  removeWorkflowEdge(sourceId, targetId);
  return connectWorkflowNodes(sourceId, targetId, sourceHandle, null);
}

/** Wire Start → Unary → Assert → End using correct handle ids (only Start uses out). */
export function ensureGrpcEchoChainConnected(): void {
  connectCanvasNodes('.react-flow__node-start', WF.NODE_GRPC_UNARY, 'out');
  connectCanvasNodes(WF.NODE_GRPC_UNARY, WF.NODE_GRPC_ASSERT, null);
  connectCanvasNodes(WF.NODE_GRPC_ASSERT, WF.NODE_END, null);
}

export async function ensureOnWorkflowTab(ctx: DemoActionContext): Promise<void> {
  if (!document.querySelector(WF.CANVAS)) {
    ctx.navigateToTab('workflow');
    await ctx.delay(500);
  }
}

/**
 * Seed the complete workflow and mark all session flags — fast path for rapid-Next
 * users who skipped building steps.
 */
export async function seedCompleteWorkflowQuiet(ctx: DemoActionContext): Promise<void> {
  await seedNamedWorkflow(ctx, WF14_NAME, buildCompleteGrpcEchoWorkflow(), {
    deleteDelayMs: 150,
    insertDelayMs: 400,
  });
  Object.assign(wf14Session, {
    workflowCreated: true,
    unaryAdded: true,
    unaryConfigured: true,
    unarySecurityConfigured: true,
    assertAdded: true,
    assertConfigured: true,
  });
}

/** Collapse sidebar once after workflow creation. */
export async function collapseOnce(ctx: DemoActionContext): Promise<void> {
  if (wf14Session.sidebarCollapsed) return;
  await collapseWfDemoAppSidebar(ctx);
  wf14Session.sidebarCollapsed = true;
}

/** Ensure the unary node has target/service/method configured. */
export function ensureUnaryConnectionConfig(): void {
  if (wf14Session.unaryConfigured && wf14Session.unarySecurityConfigured) return;
  patchWorkflowNodeDataById(WF14_NODE_GRPC, {
    target: 'localhost:50051',
    descriptorKey: resolveWorkflowDescriptorKey(),
    service: 'echo.EchoService',
    method: 'Echo',
    body: { message: 'workflow-test' },
    metadata: { 'x-demo-run-id': 'workflow-demo' },
    auth: { type: 'bearer', bearerToken: ECHO_BEARER_TOKEN },
    saveAs: 'echoReply',
  });
  wf14Session.unaryConfigured = true;
  wf14Session.unarySecurityConfigured = true;
}

export function ensureUnarySecurityConfig(): void {
  if (wf14Session.unarySecurityConfigured) return;
  patchWorkflowNodeDataById(WF14_NODE_GRPC, {
    metadata: { 'x-demo-run-id': 'workflow-demo' },
    auth: { type: 'bearer', bearerToken: ECHO_BEARER_TOKEN },
  });
  wf14Session.unarySecurityConfigured = true;
}

/** Ensure assert node has source + assertions configured. */
export function ensureAssertConfig(): void {
  if (wf14Session.assertConfigured) return;
  patchWorkflowNodeDataById(WF14_NODE_ASSERT, {
    source: 'echoReply',
    assertions: [
      { grpcStatus: 0 },
      { grpcField: 'message', equals: 'workflow-test' },
    ],
  });
  wf14Session.assertConfigured = true;
}

/** Full pre-check guard: if the workflow or any required nodes are missing, re-seed everything. */
export async function ensureFullWorkflowQuiet(ctx: DemoActionContext): Promise<void> {
  await ensureOnWorkflowTab(ctx);
  if (
    !isWorkflowPresent() ||
    !isNodeOnCanvas(WF14_NODE_GRPC) ||
    !isNodeOnCanvas(WF14_NODE_ASSERT)
  ) {
    await seedCompleteWorkflowQuiet(ctx);
    await ctx.delay(300);
  }
}
