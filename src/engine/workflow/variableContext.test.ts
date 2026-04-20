import { describe, expect, it } from 'vitest';
import type { WorkflowNode } from '../../types/workflow';
import { VariableContext, parseNodeScopedInner } from './variableContext';

describe('parseNodeScopedInner', () => {
  it('parses legacy node id and variable name', () => {
    expect(parseNodeScopedInner('node:step-1.channel')).toEqual({ kind: 'id', nodeId: 'step-1', name: 'channel' });
  });

  it('parses quoted step label', () => {
    expect(parseNodeScopedInner('node:"Retrieve Kafka Status".vin')).toEqual({
      kind: 'label',
      label: 'Retrieve Kafka Status',
      name: 'vin',
    });
  });

  it('returns null for plain names', () => {
    expect(parseNodeScopedInner('channel')).toBe(null);
  });
});

describe('VariableContext node-scoped refs', () => {
  it('resolves {{node:id.name}} from setForNode', () => {
    const ctx = new VariableContext();
    ctx.setForNode('n1', 'channel', 'A');
    ctx.setForNode('n2', 'channel', 'B');
    expect(ctx.resolve('x {{node:n1.channel}} {{node:n2.channel}}')).toBe('x A B');
  });

  it('resolves {{node:"Step".name}} after registerWorkflowNodes', () => {
    const nodes: WorkflowNode[] = [
      {
        id: 'nid',
        type: 'http',
        position: { x: 0, y: 0 },
        data: {
          label: 'Retrieve Kafka Status',
          scenario: {
            id: 's',
            name: 's',
            url: '/',
            method: 'GET',
            headers: [],
            body: '',
            auth: { type: 'none' },
            validation: { mode: 'none' },
          },
        },
      },
    ];
    const ctx = new VariableContext();
    ctx.registerWorkflowNodes(nodes);
    ctx.setForNode('nid', 'vin', 'VIN123');
    expect(ctx.resolve('{{node:"Retrieve Kafka Status".vin}}')).toBe('VIN123');
  });

  it('does not resolve duplicate step titles by label', () => {
    const nodes: WorkflowNode[] = [
      {
        id: 'a',
        type: 'http',
        position: { x: 0, y: 0 },
        data: {
          label: 'Same',
          scenario: {
            id: 's1', name: 's', url: '/', method: 'GET', headers: [], body: '', auth: { type: 'none' }, validation: { mode: 'none' },
          },
        },
      },
      {
        id: 'b',
        type: 'http',
        position: { x: 0, y: 0 },
        data: {
          label: 'Same',
          scenario: {
            id: 's2', name: 's', url: '/', method: 'GET', headers: [], body: '', auth: { type: 'none' }, validation: { mode: 'none' },
          },
        },
      },
    ];
    const ctx = new VariableContext();
    ctx.registerWorkflowNodes(nodes);
    ctx.setForNode('a', 'x', '1');
    ctx.setForNode('b', 'x', '2');
    expect(ctx.resolve('{{node:"Same".x}}')).toBe('{{node:"Same".x}}');
    expect(ctx.resolve('{{node:a.x}}')).toBe('1');
    expect(ctx.resolve('{{node:b.x}}')).toBe('2');
  });

  it('keeps flat {{name}} as latest writer for set()', () => {
    const ctx = new VariableContext();
    ctx.setForNode('n1', 'channel', 'A');
    ctx.set('channel', 'last');
    expect(ctx.resolve('{{channel}}')).toBe('last');
  });

  it('inherits per-node maps in child()', () => {
    const parent = new VariableContext();
    parent.setForNode('n1', 'x', '1');
    const child = parent.child();
    expect(child.resolve('{{node:n1.x}}')).toBe('1');
    child.setForNode('n2', 'y', '2');
    expect(parent.resolve('{{node:n2.y}}')).toBe('{{node:n2.y}}');
  });

  it('snapshot prefers node:"Label".name when label is unique', () => {
    const nodes: WorkflowNode[] = [
      {
        id: 'nid',
        type: 'http',
        position: { x: 0, y: 0 },
        data: {
          label: 'My Step',
          scenario: {
            id: 's', name: 's', url: '/', method: 'GET', headers: [], body: '', auth: { type: 'none' }, validation: { mode: 'none' },
          },
        },
      },
    ];
    const ctx = new VariableContext();
    ctx.registerWorkflowNodes(nodes);
    ctx.setForNode('nid', 'k', 'v');
    expect(ctx.snapshot()['node:"My Step".k']).toBe('v');
  });
});
