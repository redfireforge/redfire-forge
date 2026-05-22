import { describe, it, expect } from 'vitest';
import { syncHttpNodeLabelsWithServices } from './workflowWithServices';
import { defaultNodeData, type WorkflowRFNode } from './workflowNodeFactory';
import { WorkflowService } from '../types/workflow';

function makeHttpNode(
  id: string,
  overrides: Partial<WorkflowRFNode['data']> & { serviceId?: string; label: string },
): WorkflowRFNode {
  const base = defaultNodeData('http');
  return {
    id,
    type: 'http',
    position: { x: 0, y: 0 },
    data: { ...base, ...overrides },
  } as WorkflowRFNode;
}

describe('syncHttpNodeLabelsWithServices', () => {
  it('updates HTTP node label when service name differs from current label', () => {
    const nodes: WorkflowRFNode[] = [
      makeHttpNode('h1', { label: 'Old', serviceId: 's1' }),
    ];
    const services: WorkflowService[] = [
      {
        id: 's1',
        name: 'Payments API',
        endpoints: [],
      },
    ];
    const out = syncHttpNodeLabelsWithServices(nodes, services);
    expect(out[0].data.label).toBe('Payments API');
    expect(out[0]).not.toBe(nodes[0]);
  });

  it('returns same node reference when label already matches service name', () => {
    const nodes: WorkflowRFNode[] = [
      makeHttpNode('h1', { label: 'Payments API', serviceId: 's1' }),
    ];
    const services: WorkflowService[] = [
      { id: 's1', name: 'Payments API', endpoints: [] },
    ];
    const out = syncHttpNodeLabelsWithServices(nodes, services);
    expect(out[0]).toBe(nodes[0]);
    expect(out[0].data.label).toBe('Payments API');
  });

  it('returns same node reference when HTTP node has no serviceId', () => {
    const nodes: WorkflowRFNode[] = [
      makeHttpNode('h1', { label: 'Custom', serviceId: undefined }),
    ];
    const services: WorkflowService[] = [
      { id: 's1', name: 'Payments API', endpoints: [] },
    ];
    const out = syncHttpNodeLabelsWithServices(nodes, services);
    expect(out[0]).toBe(nodes[0]);
    expect(out[0].data.label).toBe('Custom');
  });

  it('leaves HTTP node unchanged when serviceId not in registry', () => {
    const nodes: WorkflowRFNode[] = [
      makeHttpNode('h1', { label: 'Custom', serviceId: 'missing' }),
    ];
    const services: WorkflowService[] = [
      { id: 's1', name: 'Other', endpoints: [] },
    ];
    const out = syncHttpNodeLabelsWithServices(nodes, services);
    expect(out[0]).toBe(nodes[0]);
    expect(out[0].data.label).toBe('Custom');
  });

  it('handles empty services list', () => {
    const nodes: WorkflowRFNode[] = [
      makeHttpNode('h1', { label: 'Any', serviceId: 's1' }),
    ];
    const out = syncHttpNodeLabelsWithServices(nodes, []);
    expect(out[0].data.label).toBe('Any');
  });

  it('does not modify non-HTTP workflow nodes', () => {
    const start: WorkflowRFNode = {
      id: 's0',
      type: 'start',
      position: { x: 0, y: 0 },
      data: defaultNodeData('start'),
    } as WorkflowRFNode;
    const services: WorkflowService[] = [{ id: 'x', name: 'X', endpoints: [] }];
    const out = syncHttpNodeLabelsWithServices([start], services);
    expect(out[0]).toBe(start);
  });

  it('supports legacy HTTP-shape nodes where type omits http but data has scenario', () => {
    const legacy: WorkflowRFNode = {
      id: 'legacy',
      type: 'custom-legacy',
      position: { x: 0, y: 0 },
      data: {
        ...defaultNodeData('http'),
        label: 'Old',
        serviceId: 's1',
      },
    } as WorkflowRFNode;
    const services: WorkflowService[] = [{ id: 's1', name: 'Renamed svc', endpoints: [] }];
    const out = syncHttpNodeLabelsWithServices([legacy], services);
    expect(out[0].data.label).toBe('Renamed svc');
    expect(out[0]).not.toBe(legacy);
  });

  it('syncs only mixed HTTP and non-HTTP nodes in order', () => {
    const start: WorkflowRFNode = {
      id: 's0',
      type: 'start',
      position: { x: 0, y: 0 },
      data: defaultNodeData('start'),
    } as WorkflowRFNode;
    const httpA = makeHttpNode('ha', { label: 'a', serviceId: 'svc-a' });
    const httpB = makeHttpNode('hb', { label: 'svc-b name', serviceId: 'svc-b' });
    const services: WorkflowService[] = [
      { id: 'svc-a', name: 'Service A', endpoints: [] },
      { id: 'svc-b', name: 'svc-b name', endpoints: [] },
    ];
    const out = syncHttpNodeLabelsWithServices([start, httpA, httpB], services);
    expect(out[0]).toBe(start);
    expect(out[1].data.label).toBe('Service A');
    expect(out[2].data.label).toBe('svc-b name');
    expect(out[2]).toBe(httpB);
  });
});
