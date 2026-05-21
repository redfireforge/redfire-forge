/* eslint-disable react-refresh/only-export-components -- shared test helpers
   intentionally combine fixtures, helpers, and JSX mock components used
   across WorkflowRunner test splits. */
/**
 * Shared test helpers for WorkflowRunner test splits.
 *
 * The hoisted mock containers (vi.hoisted) and vi.mock factory calls must
 * stay in each test file due to Vitest's per-file hoisting rules. Everything
 * that is pure data or a stateless component can live here.
 *
 * IMPORTANT: this module must NOT import `../WorkflowRunner` (or anything that
 * transitively imports it). The vi.mock for `./components/MultiWebhookTestingPanel`
 * in each test file dynamically imports THIS module — pulling WorkflowRunner
 * into that import chain causes a hang because WorkflowRunner imports
 * MultiWebhookTestingPanel which is still being mocked.
 */
import type { JSX } from 'react';
import { fireEvent, screen } from '@testing-library/react';
import type { Workflow } from '../../workflow/types/workflow';
import type { TestSummary } from '../../../shared/types';

const NOW = 0;
const TIMESTAMPS = { createdAt: NOW, updatedAt: NOW } as const;

// ─── Workflow Fixtures ────────────────────────────────────────────────

export const mockWorkflows: Workflow[] = [
  {
    id: 'wf1',
    name: 'Test Workflow',
    nodes: [
      { id: 'n1', type: 'http', position: { x: 0, y: 0 }, data: { label: 'Get Users' } },
      { id: 'n2', type: 'http', position: { x: 100, y: 0 }, data: { label: 'Get Orders' } },
    ],
    edges: [{ id: 'e1', source: 'n1', target: 'n2' }],
    variables: { baseUrl: 'https://api.example.com' },
    ...TIMESTAMPS,
  },
  {
    id: 'wf2',
    name: 'Another Workflow',
    nodes: [
      { id: 'n1', type: 'http', position: { x: 0, y: 0 }, data: { label: 'Health Check' } },
    ],
    edges: [],
    variables: {},
    ...TIMESTAMPS,
  },
];

/** Webhook as entry trigger (only incoming from orphaned start). */
export const wfWebhookStart: Workflow = {
  id: 'wf-wh',
  name: 'Webhook Start',
  nodes: [
    {
      id: 'so-no-edges',
      type: 'start',
      position: { x: 0, y: -20 },
      data: { label: 'BareStart', inputVariables: {} },
    },
    {
      id: 'sta',
      type: 'start',
      position: { x: 0, y: 0 },
      data: { label: 'StartToWebhook', inputVariables: {} },
    },
    {
      id: 'sx-http',
      type: 'start',
      position: { x: 100, y: 0 },
      data: { label: 'StartToHttp', inputVariables: {} },
    },
    {
      id: 'wh-trigger',
      type: 'webhook',
      position: { x: 0, y: 50 },
      data: { label: 'Webhook', method: 'POST', path: '/evt', samplePayload: '{"a":1}' },
    },
    { id: 'hx', type: 'http', position: { x: 0, y: 100 }, data: { label: 'After' } },
  ],
  edges: [
    { id: 'eas', source: 'sta', target: 'wh-trigger' },
    { id: 'esx', source: 'sx-http', target: 'hx' },
    { id: 'ew', source: 'wh-trigger', target: 'hx' },
  ],
  variables: {},
  ...TIMESTAMPS,
};

/** Webhook receives real incoming edge → not treated as webhook-triggered harness start. */
export const wfWebhookMid: Workflow = {
  id: 'wf-wh-mid',
  name: 'Mid Webhook',
  nodes: [
    { id: 'h-before', type: 'http', position: { x: 0, y: 0 }, data: { label: 'First' } },
    {
      id: 'wh-mid',
      type: 'webhook',
      position: { x: 0, y: 50 },
      data: { label: 'W', method: 'POST', path: '/', samplePayload: '{}' },
    },
  ],
  edges: [{ id: 'e1', source: 'h-before', target: 'wh-mid' }],
  variables: {},
  ...TIMESTAMPS,
};

/** Start fans out to both webhook and HTTP — webhook must not register as harness trigger. */
export const wfWebhookBranchingStart: Workflow = {
  id: 'wf-wh-branch',
  name: 'Branching Start + Webhook',
  nodes: [
    { id: 's-multi', type: 'start', position: { x: 0, y: 0 }, data: { label: 'Split' } },
    {
      id: 'wh-branch',
      type: 'webhook',
      position: { x: 0, y: 50 },
      data: { label: 'W', method: 'POST', path: '/', samplePayload: '{}' },
    },
    { id: 'hx-split', type: 'http', position: { x: 120, y: 0 }, data: { label: 'Other' } },
  ],
  edges: [
    { id: 'eb1', source: 's-multi', target: 'wh-branch' },
    { id: 'eb2', source: 's-multi', target: 'hx-split' },
    { id: 'eb3', source: 'wh-branch', target: 'hx-split' },
  ],
  variables: {},
  ...TIMESTAMPS,
};

export const wfCorr: Workflow = {
  id: 'wf-corr',
  name: 'Correlation Flow',
  nodes: [
    {
      id: 'cw-node',
      type: 'correlationWait',
      position: { x: 0, y: 0 },
      data: {
        label: 'Wait',
        correlationIdExpression: '{{id}}',
        webhookPath: '/cb',
        correlationSource: 'body',
        correlationJsonPath: '$.paymentId',
        timeoutMs: 5000,
      },
    },
    { id: 'h-after', type: 'http', position: { x: 50, y: 0 }, data: { label: 'Done' } },
  ],
  edges: [{ id: 'ec', source: 'cw-node', target: 'h-after' }],
  variables: {},
  ...TIMESTAMPS,
};

export const wfPoll: Workflow = {
  id: 'wf-poll',
  name: 'Poll Flow',
  nodes: [
    {
      id: 'wfc',
      type: 'waitForCondition',
      position: { x: 0, y: 0 },
      data: {
        label: 'Poll',
        conditionExpression: '{{x}}==1',
        pollIntervalMs: 100,
        timeoutMs: 1000,
        maxAttempts: 10,
      },
    },
    { id: 'h1', type: 'http', position: { x: 1, y: 0 }, data: { label: 'X' } },
  ],
  edges: [],
  variables: {},
  ...TIMESTAMPS,
};

export const allWorkflowVariants: Workflow[] = [
  ...mockWorkflows,
  wfWebhookStart,
  wfWebhookMid,
  wfWebhookBranchingStart,
  wfCorr,
  wfPoll,
];

export const wfIdToName: Record<string, string> = Object.fromEntries(
  allWorkflowVariants.map((wf) => [wf.id, wf.name]),
);

// ─── Test Helpers ──────────────────────────────────────────────────────

export function selectWorkflowById(id: string): void {
  const trigger = screen.getByTestId('workflow-select');
  fireEvent.click(trigger);
  const name = wfIdToName[id];
  if (!name) throw new Error(`Unknown workflow id in test helper: ${id}`);
  fireEvent.click(screen.getByText(name));
}

export function makeSummary(overrides: Partial<TestSummary> = {}): TestSummary {
  return {
    tps: 1,
    avgResponseTime: 10,
    minResponseTime: 10,
    maxResponseTime: 10,
    p50ResponseTime: 10,
    p95ResponseTime: 10,
    p99ResponseTime: 10,
    errorRate: 0,
    errorsByStatus: {},
    totalRequests: 1,
    successfulRequests: 1,
    failedRequests: 0,
    failedValidations: 0,
    totalDurationMs: 1000,
    ...overrides,
  };
}

// ─── MultiWebhookTestingPanel mock ─────────────────────────────────────

export interface MultiWebhookStubProps {
  workflow: Workflow;
  isRunning: boolean;
  onFireWebhook?: (
    nodeId: string,
    correlationId: string,
    payload: Record<string, unknown>,
  ) => Promise<void>;
  onSaveScenario?: (
    scenario: {
      name: string;
      payloads: Array<{ nodeId: string; payload: Record<string, unknown> }>;
    },
  ) => void;
  onDeleteScenario?: (scenarioId: string) => void;
}

export function MultiWebhookStub(props: MultiWebhookStubProps): JSX.Element {
  return (
    <div data-testid="multi-webhook-stub">
      <button
        type="button"
        data-testid="stub-save-webhook-scenario"
        onClick={() =>
          props.onSaveScenario?.({
            name: 'Stub scenario',
            payloads: [{ nodeId: 'cw-node', payload: { k: 1 } }],
          })
        }
      >
        save-scenario
      </button>
      <button
        type="button"
        data-testid="stub-delete-webhook-scenario"
        onClick={() => props.onDeleteScenario?.('sc-1')}
      >
        delete-scenario
      </button>
      <button
        type="button"
        data-testid="stub-fire-webhook"
        onClick={() => void props.onFireWebhook?.('cw-node', 'corr-1', { x: true })}
      >
        fire-webhook
      </button>
      <button
        type="button"
        data-testid="stub-fire-webhook-unknown-node"
        onClick={() => {
          void props.onFireWebhook?.('definitely-unknown-node-id', 'c', {}).catch(() => {});
        }}
      >
        fire-webhook-unknown
      </button>
    </div>
  );
}
