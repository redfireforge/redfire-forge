import { describe, it, expect, vi } from 'vitest';
import { executeHttpNode } from './graphRunnerHelpers';
import { VariableContext } from './variableContext';
import { TokenManager } from '@engine/tokenManager';
import type { HttpNodeData } from '../types/workflow';

// Mock httpFetch
vi.mock('../../../utils/httpClient', () => ({
  httpFetch: vi.fn().mockResolvedValue({
    status: 200,
    body: JSON.stringify({ success: true }),
    headers: {},
  }),
}));

describe('executeHttpNode - workflowNodeId', () => {
  it('sets workflowNodeId to the React Flow node ID', async () => {
    const httpData: HttpNodeData = {
      label: 'Create Order',
      scenario: {
        id: 'scen-123',
        name: 'Create Order Scenario',
        method: 'POST',
        url: 'https://api.example.com/orders',
        headers: [],
        queryParams: [],
        body: '',
        bodyForm: [],
        auth: { type: 'none' },
        validation: { mode: 'none' },
      },
    };

    const httpNodeId = 'n42'; // React Flow node ID
    const workflowDefaults = {};

    const result = await executeHttpNode(
      httpData,
      new VariableContext(),
      new TokenManager(),
      httpNodeId,
      workflowDefaults,
    );

    // Verify workflowNodeId is set to the React Flow node ID, not scenarioId
    expect(result.requestResult.workflowNodeId).toBe('n42');
    expect(result.requestResult.scenarioId).toBe('scen-123');
    expect(result.requestResult.workflowNodeId).not.toBe(result.requestResult.scenarioId);
  });

  it('sets workflowNodeId correctly for different node IDs', async () => {
    const httpData: HttpNodeData = {
      label: 'Get User',
      scenario: {
        id: 'scenario-xyz',
        name: 'Get User Scenario',
        method: 'GET',
        url: 'https://api.example.com/users/123',
        headers: [],
        queryParams: [],
        body: '',
        bodyForm: [],
        auth: { type: 'none' },
        validation: { mode: 'none' },
      },
    };

    const testCases = ['n1', 'n2', 'node-5', 'http-node-123'];

    for (const nodeId of testCases) {
      const result = await executeHttpNode(
        httpData,
        new VariableContext(),
        new TokenManager(),
        nodeId,
        {},
      );

      expect(result.requestResult.workflowNodeId).toBe(nodeId);
    }
  });

  it('preserves workflowNodeId through variable extraction', async () => {
    const httpData: HttpNodeData = {
      label: 'Create Order',
      scenario: {
        id: 'scen-456',
        name: 'Create Order',
        method: 'POST',
        url: 'https://api.example.com/orders',
        headers: [],
        queryParams: [],
        body: '',
        bodyForm: [],
        auth: { type: 'none' },
        validation: { mode: 'none' },
        extractions: [
          { name: 'orderId', jsonPath: '$.orderId' },
        ],
      },
    };

    const httpNodeId = 'n7';

    const result = await executeHttpNode(
      httpData,
      new VariableContext(),
      new TokenManager(),
      httpNodeId,
      {},
    );

    expect(result.requestResult.workflowNodeId).toBe('n7');
    expect(result.requestResult.scenarioId).toBe('scen-456');
  });

  it('sets workflowNodeId correctly for data source expanded scenarios', async () => {
    const httpData: HttpNodeData = {
      label: 'Create Orders',
      scenario: {
        id: 'scen-789',
        name: 'Create Orders',
        method: 'POST',
        url: 'https://api.example.com/orders',
        headers: [],
        queryParams: [],
        body: '',
        bodyForm: [],
        auth: { type: 'none' },
        validation: { mode: 'none' },
        dataRowId: 'row-1',
        dataRowLabel: 'Order 1',
      },
    };

    const httpNodeId = 'n12';

    const result = await executeHttpNode(
      httpData,
      new VariableContext(),
      new TokenManager(),
      httpNodeId,
      {},
    );

    expect(result.requestResult.workflowNodeId).toBe('n12');
    expect(result.requestResult.scenarioId).toBe('scen-789');
    expect(result.requestResult.dataRowId).toBe('row-1');
    expect(result.requestResult.dataRowLabel).toBe('Order 1');
  });
});
