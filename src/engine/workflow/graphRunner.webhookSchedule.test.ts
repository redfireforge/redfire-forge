import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runGraph, type GraphRunCallbacks } from './graphRunner';
import type { WorkflowNode, WorkflowEdge, WebhookTriggerNodeData, ScheduleTriggerNodeData } from '../../types/workflow';

vi.mock('../../utils/httpClient', () => ({
  httpFetch: vi.fn(),
}));

import { httpFetch } from '../../utils/httpClient';

const mockFetch = vi.mocked(httpFetch);

beforeEach(() => {
  mockFetch.mockClear();
  mockFetch.mockResolvedValue({
    status: 200,
    statusText: 'OK',
    headers: new Headers({ 'content-type': 'application/json' }),
    body: '{"status": "ok"}',
    duration: 100,
  });
});

describe('runGraph - Webhook Trigger', () => {
  it('recognizes webhook node as entry point', async () => {
    const webhookNode: WorkflowNode = {
      id: 'wh1',
      type: 'webhook',
      position: { x: 0, y: 0 },
      data: {
        label: 'Webhook',
        method: 'POST',
        path: '/api/test',
        samplePayload: '{}',
      } as WebhookTriggerNodeData,
    };

    const states: Array<{ id: string; state: string }> = [];
    const callbacks: GraphRunCallbacks = {
      onNodeStateChange: (id, status) => states.push({ id, state: status.state }),
      onVariablesChange: vi.fn(),
      onComplete: vi.fn(),
    };

    await runGraph([webhookNode], [], {}, callbacks, new AbortController().signal, {});

    expect(states).toContainEqual({ id: 'wh1', state: 'pass' });
  });

  it('extracts variables from webhook samplePayload using JSONPath', async () => {
    const webhookNode: WorkflowNode = {
      id: 'wh1',
      type: 'webhook',
      position: { x: 0, y: 0 },
      data: {
        label: 'Webhook',
        method: 'POST',
        path: '/api/vehicle-created',
        samplePayload: JSON.stringify({
          event: 'vehicle.created',
          data: { vin: '1HGBH41JXMN109186', year: 2021 },
        }),
        extractVariables: [
          { name: 'eventType', jsonPath: '$.event' },
          { name: 'vin', jsonPath: '$.data.vin' },
          { name: 'year', jsonPath: '$.data.year' },
        ],
      } as WebhookTriggerNodeData,
    };

    let extractedVars: Record<string, string> = {};
    const callbacks: GraphRunCallbacks = {
      onNodeStateChange: vi.fn(),
      onVariablesChange: (vars) => { extractedVars = vars; },
      onComplete: vi.fn(),
    };

    await runGraph([webhookNode], [], {}, callbacks, new AbortController().signal, {});

    expect(extractedVars).toEqual({
      eventType: 'vehicle.created',
      vin: '1HGBH41JXMN109186',
      year: '2021',
    });
  });

  it('handles invalid JSON in samplePayload gracefully', async () => {
    const webhookNode: WorkflowNode = {
      id: 'wh1',
      type: 'webhook',
      position: { x: 0, y: 0 },
      data: {
        label: 'Webhook',
        method: 'POST',
        path: '/api/test',
        samplePayload: 'not valid json',
        extractVariables: [{ name: 'test', jsonPath: '$.test' }],
      } as WebhookTriggerNodeData,
    };

    const states: Array<{ id: string; state: string }> = [];
    const callbacks: GraphRunCallbacks = {
      onNodeStateChange: (id, status) => states.push({ id, state: status.state }),
      onVariablesChange: vi.fn(),
      onComplete: vi.fn(),
    };

    await runGraph([webhookNode], [], {}, callbacks, new AbortController().signal, {});

    // Should still pass even with invalid JSON
    expect(states).toContainEqual({ id: 'wh1', state: 'pass' });
  });

  it('handles missing JSONPath in samplePayload', async () => {
    const webhookNode: WorkflowNode = {
      id: 'wh1',
      type: 'webhook',
      position: { x: 0, y: 0 },
      data: {
        label: 'Webhook',
        method: 'POST',
        path: '/api/test',
        samplePayload: '{"event": "test"}',
        extractVariables: [{ name: 'missing', jsonPath: '$.data.missing' }],
      } as WebhookTriggerNodeData,
    };

    let extractedVars: Record<string, string> = {};
    const callbacks: GraphRunCallbacks = {
      onNodeStateChange: vi.fn(),
      onVariablesChange: (vars) => { extractedVars = vars; },
      onComplete: vi.fn(),
    };

    await runGraph([webhookNode], [], {}, callbacks, new AbortController().signal, {});

    // Should not set variable if path doesn't exist
    expect(extractedVars).not.toHaveProperty('missing');
  });

  it('webhook node flows to downstream HTTP node with extracted variables', async () => {
    const webhookNode: WorkflowNode = {
      id: 'wh1',
      type: 'webhook',
      position: { x: 0, y: 0 },
      data: {
        label: 'Webhook',
        method: 'POST',
        path: '/api/trigger',
        samplePayload: '{"orderId": "12345"}',
        extractVariables: [{ name: 'orderId', jsonPath: '$.orderId' }],
      } as WebhookTriggerNodeData,
    };

    const httpNode: WorkflowNode = {
      id: 'http1',
      type: 'http',
      position: { x: 0, y: 100 },
      data: {
        label: 'Get Order',
        scenario: {
          id: 's1',
          name: 'Get Order',
          url: 'http://api.example.com/orders/{{orderId}}',
          method: 'GET',
          headers: [],
          body: '',
          auth: { type: 'none' },
          validation: { mode: 'none' },
        },
      },
    };

    const edge: WorkflowEdge = { id: 'e1', source: 'wh1', target: 'http1' };

    const callbacks: GraphRunCallbacks = {
      onNodeStateChange: vi.fn(),
      onVariablesChange: vi.fn(),
      onComplete: vi.fn(),
    };

    await runGraph([webhookNode, httpNode], [edge], {}, callbacks, new AbortController().signal, {});

    // Check first argument (URL) contains the substituted orderId
    const firstCall = mockFetch.mock.calls[0];
    expect(firstCall[0]).toContain('12345');
  });
});

describe('runGraph - Schedule Trigger', () => {
  it('recognizes schedule node as entry point', async () => {
    const scheduleNode: WorkflowNode = {
      id: 'sch1',
      type: 'schedule',
      position: { x: 0, y: 0 },
      data: {
        label: 'Daily Report',
        cronExpression: '0 9 * * MON-FRI',
        timezone: 'America/New_York',
        scheduleDescription: 'Every weekday at 9am EST',
      } as ScheduleTriggerNodeData,
    };

    const states: Array<{ id: string; state: string }> = [];
    const callbacks: GraphRunCallbacks = {
      onNodeStateChange: (id, status) => states.push({ id, state: status.state }),
      onVariablesChange: vi.fn(),
      onComplete: vi.fn(),
    };

    await runGraph([scheduleNode], [], {}, callbacks, new AbortController().signal, {});

    expect(states).toContainEqual({ id: 'sch1', state: 'pass' });
  });

  it('seeds triggerTime and triggerTimestamp variables', async () => {
    const scheduleNode: WorkflowNode = {
      id: 'sch1',
      type: 'schedule',
      position: { x: 0, y: 0 },
      data: {
        label: 'Scheduled Job',
        cronExpression: '0 * * * *',
        timezone: 'UTC',
      } as ScheduleTriggerNodeData,
    };

    let extractedVars: Record<string, string> = {};
    const callbacks: GraphRunCallbacks = {
      onNodeStateChange: vi.fn(),
      onVariablesChange: (vars) => { extractedVars = vars; },
      onComplete: vi.fn(),
    };

    await runGraph([scheduleNode], [], {}, callbacks, new AbortController().signal, {});

    expect(extractedVars).toHaveProperty('triggerTime');
    expect(extractedVars).toHaveProperty('triggerTimestamp');
    // Verify triggerTime is ISO format
    expect(extractedVars.triggerTime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    // Verify triggerTimestamp is a number string
    expect(extractedVars.triggerTimestamp).toMatch(/^\d+$/);
  });

  it('seeds inputVariables from schedule node', async () => {
    const scheduleNode: WorkflowNode = {
      id: 'sch1',
      type: 'schedule',
      position: { x: 0, y: 0 },
      data: {
        label: 'Report Job',
        cronExpression: '0 0 * * *',
        timezone: 'UTC',
        inputVariables: {
          reportType: 'daily',
          recipients: 'team@example.com',
        },
      } as ScheduleTriggerNodeData,
    };

    let extractedVars: Record<string, string> = {};
    const callbacks: GraphRunCallbacks = {
      onNodeStateChange: vi.fn(),
      onVariablesChange: (vars) => { extractedVars = vars; },
      onComplete: vi.fn(),
    };

    await runGraph([scheduleNode], [], {}, callbacks, new AbortController().signal, {});

    expect(extractedVars).toMatchObject({
      reportType: 'daily',
      recipients: 'team@example.com',
    });
    // Should also have trigger time variables
    expect(extractedVars).toHaveProperty('triggerTime');
    expect(extractedVars).toHaveProperty('triggerTimestamp');
  });

  it('schedule node flows to downstream HTTP node with trigger variables', async () => {
    const scheduleNode: WorkflowNode = {
      id: 'sch1',
      type: 'schedule',
      position: { x: 0, y: 0 },
      data: {
        label: 'Daily Job',
        cronExpression: '0 0 * * *',
        timezone: 'UTC',
        inputVariables: { reportId: 'daily-001' },
      } as ScheduleTriggerNodeData,
    };

    const httpNode: WorkflowNode = {
      id: 'http1',
      type: 'http',
      position: { x: 0, y: 100 },
      data: {
        label: 'Generate Report',
        scenario: {
          id: 's1',
          name: 'Generate',
          url: 'http://api.example.com/reports/{{reportId}}?time={{triggerTime}}',
          method: 'POST',
          headers: [],
          body: '',
          auth: { type: 'none' },
          validation: { mode: 'none' },
        },
      },
    };

    const edge: WorkflowEdge = { id: 'e1', source: 'sch1', target: 'http1' };

    const callbacks: GraphRunCallbacks = {
      onNodeStateChange: vi.fn(),
      onVariablesChange: vi.fn(),
      onComplete: vi.fn(),
    };

    await runGraph([scheduleNode, httpNode], [edge], {}, callbacks, new AbortController().signal, {});

    // Check first argument (URL) contains both reportId and triggerTime
    const firstCall = mockFetch.mock.calls[0];
    expect(firstCall[0]).toContain('daily-001');
    expect(firstCall[0]).toMatch(/time=\d{4}-\d{2}-\d{2}T/);
  });
});

describe('runGraph - Mixed Trigger Nodes', () => {
  it('executes connected webhook → HTTP workflow', async () => {
    const webhookNode: WorkflowNode = {
      id: 'wh1',
      type: 'webhook',
      position: { x: 0, y: 0 },
      data: {
        label: 'Webhook',
        method: 'POST',
        path: '/api/test',
        samplePayload: '{"data":"value"}',
      } as WebhookTriggerNodeData,
    };

    const httpNode: WorkflowNode = {
      id: 'http1',
      type: 'http',
      position: { x: 0, y: 100 },
      data: {
        label: 'API Call',
        scenario: {
          id: 's1',
          name: 'Test',
          url: 'http://example.com',
          method: 'GET',
          headers: [],
          body: '',
          auth: { type: 'none' },
          validation: { mode: 'none' },
        },
      },
    };

    const edge: WorkflowEdge = { id: 'e1', source: 'wh1', target: 'http1' };

    const states: Array<{ id: string; state: string }> = [];
    const callbacks: GraphRunCallbacks = {
      onNodeStateChange: (id, status) => states.push({ id, state: status.state }),
      onVariablesChange: vi.fn(),
      onComplete: vi.fn(),
    };

    await runGraph([webhookNode, httpNode], [edge], {}, callbacks, new AbortController().signal, {});

    // Both nodes should execute in order
    expect(states).toContainEqual({ id: 'wh1', state: 'pass' });
    expect(states).toContainEqual({ id: 'http1', state: 'running' });
  });

  it('executes connected schedule → HTTP workflow', async () => {
    const scheduleNode: WorkflowNode = {
      id: 'sch1',
      type: 'schedule',
      position: { x: 0, y: 0 },
      data: {
        label: 'Schedule',
        cronExpression: '0 0 * * *',
        timezone: 'UTC',
      } as ScheduleTriggerNodeData,
    };

    const httpNode: WorkflowNode = {
      id: 'http1',
      type: 'http',
      position: { x: 0, y: 100 },
      data: {
        label: 'API Call',
        scenario: {
          id: 's1',
          name: 'Test',
          url: 'http://example.com',
          method: 'GET',
          headers: [],
          body: '',
          auth: { type: 'none' },
          validation: { mode: 'none' },
        },
      },
    };

    const edge: WorkflowEdge = { id: 'e1', source: 'sch1', target: 'http1' };

    const states: Array<{ id: string; state: string }> = [];
    const callbacks: GraphRunCallbacks = {
      onNodeStateChange: (id, status) => states.push({ id, state: status.state }),
      onVariablesChange: vi.fn(),
      onComplete: vi.fn(),
    };

    await runGraph([scheduleNode, httpNode], [edge], {}, callbacks, new AbortController().signal, {});

    // Both nodes should execute in order
    expect(states).toContainEqual({ id: 'sch1', state: 'pass' });
    expect(states).toContainEqual({ id: 'http1', state: 'running' });
  });
});
