import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Workflow } from '@workflow/types/workflow';
import type { HttpNodeData } from '@workflow/types/workflow/node-core';
import {
  makeWorkflow,
  makeWorkflowNode,
  makeWorkflowEdge,
} from '@test-utils/factories';

vi.mock('../../../shared/utils/storage', () => ({
  loadWorkflows: vi.fn(),
  saveWorkflows: vi.fn(),
}));

import * as storage from '@shared/utils/storage';
import {
  scanWorkflowsForCatalogRef,
  removeCatalogNodesFromWorkflows,
} from './workflowExposureScanner';

const mockLoadWorkflows = vi.mocked(storage.loadWorkflows);
const mockSaveWorkflows = vi.mocked(storage.saveWorkflows);

const ENTRY_ID = 'entry-abc';
const ENDPOINT_ID = 'endpoint-xyz';

function makeHttpNode(
  id: string,
  label: string,
  catalogRef?: HttpNodeData['catalogRef'],
) {
  return makeWorkflowNode({
    id,
    type: 'http',
    data: {
      label,
      method: 'GET',
      url: '/api/test',
      scenario: { id: 'sc-1', name: label, url: '/api/test', method: 'GET' },
      ...(catalogRef ? { catalogRef } : {}),
    } as HttpNodeData,
  });
}

function makeCatalogRef(
  entryId = ENTRY_ID,
  endpointId = ENDPOINT_ID,
): NonNullable<HttpNodeData['catalogRef']> {
  return {
    entryId,
    endpointId,
    method: 'GET',
    path: '/api/test',
  };
}

function makeWorkflowWithNodes(
  id: string,
  name: string,
  nodes: ReturnType<typeof makeHttpNode>[],
  edges: ReturnType<typeof makeWorkflowEdge>[] = [],
): Workflow {
  return makeWorkflow({ id, name, nodes, edges });
}

describe('scanWorkflowsForCatalogRef', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty array when no workflows exist', async () => {
    mockLoadWorkflows.mockResolvedValue([]);

    const results = await scanWorkflowsForCatalogRef(ENTRY_ID, ENDPOINT_ID);

    expect(results).toEqual([]);
    expect(mockLoadWorkflows).toHaveBeenCalledOnce();
  });

  it('returns empty array when no nodes match', async () => {
    mockLoadWorkflows.mockResolvedValue([
      makeWorkflowWithNodes('wf-1', 'No Match WF', [
        makeHttpNode('n1', 'Plain Node'),
        makeHttpNode('n2', 'Other Entry', makeCatalogRef('other-entry', ENDPOINT_ID)),
        makeHttpNode('n3', 'Other Endpoint', makeCatalogRef(ENTRY_ID, 'other-endpoint')),
      ]),
    ]);

    const results = await scanWorkflowsForCatalogRef(ENTRY_ID, ENDPOINT_ID);

    expect(results).toEqual([]);
  });

  it('finds matching nodes in a single workflow', async () => {
    mockLoadWorkflows.mockResolvedValue([
      makeWorkflowWithNodes('wf-1', 'Single Match WF', [
        makeHttpNode('n1', 'Unrelated'),
        makeHttpNode('n2', 'Catalog Node', makeCatalogRef()),
      ]),
    ]);

    const results = await scanWorkflowsForCatalogRef(ENTRY_ID, ENDPOINT_ID);

    expect(results).toEqual([
      {
        workflowId: 'wf-1',
        workflowName: 'Single Match WF',
        nodeIds: ['n2'],
        nodeLabels: ['Catalog Node'],
      },
    ]);
  });

  it('finds matching nodes across multiple workflows', async () => {
    mockLoadWorkflows.mockResolvedValue([
      makeWorkflowWithNodes('wf-1', 'First WF', [
        makeHttpNode('n1', 'Alpha', makeCatalogRef()),
      ]),
      makeWorkflowWithNodes('wf-2', 'Second WF', [
        makeHttpNode('n2', 'Beta', makeCatalogRef()),
        makeHttpNode('n3', 'Gamma', makeCatalogRef()),
      ]),
      makeWorkflowWithNodes('wf-3', 'Third WF', [
        makeHttpNode('n4', 'No Ref'),
      ]),
    ]);

    const results = await scanWorkflowsForCatalogRef(ENTRY_ID, ENDPOINT_ID);

    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({
      workflowId: 'wf-1',
      workflowName: 'First WF',
      nodeIds: ['n1'],
      nodeLabels: ['Alpha'],
    });
    expect(results[1]).toEqual({
      workflowId: 'wf-2',
      workflowName: 'Second WF',
      nodeIds: ['n2', 'n3'],
      nodeLabels: ['Beta', 'Gamma'],
    });
  });

  it('ignores nodes without catalogRef', async () => {
    mockLoadWorkflows.mockResolvedValue([
      makeWorkflowWithNodes('wf-1', 'Mixed WF', [
        makeHttpNode('n1', 'No Catalog Ref'),
        makeHttpNode('n2', 'Has Ref', makeCatalogRef()),
      ]),
    ]);

    const results = await scanWorkflowsForCatalogRef(ENTRY_ID, ENDPOINT_ID);

    expect(results).toEqual([
      {
        workflowId: 'wf-1',
        workflowName: 'Mixed WF',
        nodeIds: ['n2'],
        nodeLabels: ['Has Ref'],
      },
    ]);
  });

  it('ignores nodes with different entryId or endpointId', async () => {
    mockLoadWorkflows.mockResolvedValue([
      makeWorkflowWithNodes('wf-1', 'Partial Match WF', [
        makeHttpNode('n1', 'Wrong Entry', makeCatalogRef('wrong-entry', ENDPOINT_ID)),
        makeHttpNode('n2', 'Wrong Endpoint', makeCatalogRef(ENTRY_ID, 'wrong-endpoint')),
        makeHttpNode('n3', 'Exact Match', makeCatalogRef()),
      ]),
    ]);

    const results = await scanWorkflowsForCatalogRef(ENTRY_ID, ENDPOINT_ID);

    expect(results).toEqual([
      {
        workflowId: 'wf-1',
        workflowName: 'Partial Match WF',
        nodeIds: ['n3'],
        nodeLabels: ['Exact Match'],
      },
    ]);
  });

  it('returns correct nodeLabels for multiple matching nodes', async () => {
    mockLoadWorkflows.mockResolvedValue([
      makeWorkflowWithNodes('wf-1', 'Labels WF', [
        makeHttpNode('n1', 'GET /users', makeCatalogRef()),
        makeHttpNode('n2', 'POST /orders', makeCatalogRef()),
      ]),
    ]);

    const results = await scanWorkflowsForCatalogRef(ENTRY_ID, ENDPOINT_ID);

    expect(results[0]?.nodeLabels).toEqual(['GET /users', 'POST /orders']);
  });
});

describe('removeCatalogNodesFromWorkflows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSaveWorkflows.mockResolvedValue(undefined);
  });

  it('returns 0 and does not call saveWorkflows when no matches', async () => {
    mockLoadWorkflows.mockResolvedValue([
      makeWorkflowWithNodes('wf-1', 'Empty WF', [
        makeHttpNode('n1', 'No Ref'),
      ]),
    ]);

    const removed = await removeCatalogNodesFromWorkflows(ENTRY_ID, ENDPOINT_ID);

    expect(removed).toBe(0);
    expect(mockSaveWorkflows).not.toHaveBeenCalled();
  });

  it('removes matching nodes and their edges', async () => {
    const workflows = [
      makeWorkflowWithNodes(
        'wf-1',
        'Remove WF',
        [
          makeHttpNode('n1', 'Keep'),
          makeHttpNode('n2', 'Remove Me', makeCatalogRef()),
          makeHttpNode('n3', 'Also Keep'),
        ],
        [
          makeWorkflowEdge({ id: 'e1', source: 'n1', target: 'n2' }),
          makeWorkflowEdge({ id: 'e2', source: 'n2', target: 'n3' }),
          makeWorkflowEdge({ id: 'e3', source: 'n1', target: 'n3' }),
        ],
      ),
    ];
    mockLoadWorkflows.mockResolvedValue(workflows);

    const removed = await removeCatalogNodesFromWorkflows(ENTRY_ID, ENDPOINT_ID);

    expect(removed).toBe(1);
    expect(mockSaveWorkflows).toHaveBeenCalledOnce();

    const saved = mockSaveWorkflows.mock.calls[0]?.[0];
    expect(saved).toHaveLength(1);
    expect(saved?.[0]?.nodes.map(n => n.id)).toEqual(['n1', 'n3']);
    expect(saved?.[0]?.edges.map(e => e.id)).toEqual(['e3']);
  });

  it('preserves non-matching nodes', async () => {
    mockLoadWorkflows.mockResolvedValue([
      makeWorkflowWithNodes('wf-1', 'Preserve WF', [
        makeHttpNode('n1', 'Plain'),
        makeHttpNode('n2', 'Other Catalog', makeCatalogRef('other', 'other')),
        makeHttpNode('n3', 'Target', makeCatalogRef()),
      ]),
    ]);

    await removeCatalogNodesFromWorkflows(ENTRY_ID, ENDPOINT_ID);

    const saved = mockSaveWorkflows.mock.calls[0]?.[0]?.[0];
    expect(saved?.nodes.map(n => n.id)).toEqual(['n1', 'n2']);
  });

  it('removes edges connected to removed nodes as source or target', async () => {
    mockLoadWorkflows.mockResolvedValue([
      makeWorkflowWithNodes(
        'wf-1',
        'Edge WF',
        [
          makeHttpNode('src', 'Source', makeCatalogRef()),
          makeHttpNode('mid', 'Middle'),
          makeHttpNode('tgt', 'Target', makeCatalogRef()),
        ],
        [
          makeWorkflowEdge({ id: 'e-out', source: 'src', target: 'mid' }),
          makeWorkflowEdge({ id: 'e-in', source: 'mid', target: 'tgt' }),
          makeWorkflowEdge({ id: 'e-safe', source: 'mid', target: 'mid' }),
        ],
      ),
    ]);

    await removeCatalogNodesFromWorkflows(ENTRY_ID, ENDPOINT_ID);

    const saved = mockSaveWorkflows.mock.calls[0]?.[0]?.[0];
    expect(saved?.nodes.map(n => n.id)).toEqual(['mid']);
    expect(saved?.edges.map(e => e.id)).toEqual(['e-safe']);
  });

  it('calls saveWorkflows with updated workflows', async () => {
    const original = makeWorkflowWithNodes('wf-1', 'Save WF', [
      makeHttpNode('n1', 'Remove', makeCatalogRef()),
    ]);
    mockLoadWorkflows.mockResolvedValue([original]);

    await removeCatalogNodesFromWorkflows(ENTRY_ID, ENDPOINT_ID);

    expect(mockSaveWorkflows).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'wf-1',
        name: 'Save WF',
        nodes: [],
        edges: [],
      }),
    ]);
  });

  it('returns correct count of removed nodes', async () => {
    mockLoadWorkflows.mockResolvedValue([
      makeWorkflowWithNodes('wf-1', 'Count WF', [
        makeHttpNode('n1', 'One', makeCatalogRef()),
        makeHttpNode('n2', 'Two', makeCatalogRef()),
        makeHttpNode('n3', 'Three', makeCatalogRef()),
      ]),
    ]);

    const removed = await removeCatalogNodesFromWorkflows(ENTRY_ID, ENDPOINT_ID);

    expect(removed).toBe(3);
  });

  it('handles multiple workflows with some having matches', async () => {
    mockLoadWorkflows.mockResolvedValue([
      makeWorkflowWithNodes('wf-1', 'No Match', [
        makeHttpNode('a1', 'Plain'),
      ]),
      makeWorkflowWithNodes(
        'wf-2',
        'Has Match',
        [
          makeHttpNode('b1', 'Match', makeCatalogRef()),
          makeHttpNode('b2', 'Keep'),
        ],
        [makeWorkflowEdge({ id: 'be1', source: 'b1', target: 'b2' })],
      ),
      makeWorkflowWithNodes('wf-3', 'Also No Match', [
        makeHttpNode('c1', 'Other', makeCatalogRef('x', 'y')),
      ]),
    ]);

    const removed = await removeCatalogNodesFromWorkflows(ENTRY_ID, ENDPOINT_ID);

    expect(removed).toBe(1);
    const saved = mockSaveWorkflows.mock.calls[0]?.[0];
    expect(saved).toHaveLength(3);

    expect(saved?.[0]?.nodes.map(n => n.id)).toEqual(['a1']);
    expect(saved?.[1]?.nodes.map(n => n.id)).toEqual(['b2']);
    expect(saved?.[1]?.edges).toEqual([]);
    expect(saved?.[2]?.nodes.map(n => n.id)).toEqual(['c1']);
  });
});
