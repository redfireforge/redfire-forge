/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useNodeClipboard } from './useNodeClipboard';
import type { ToastApi } from '../components/WorkflowToastProvider';
import type { Node } from '@xyflow/react';

function makeNodes(): Node[] {
  return [
    { id: 'n1', type: 'http', position: { x: 100, y: 200 }, data: { label: 'Get Users', scenario: {} } },
    { id: 'n2', type: 'condition', position: { x: 300, y: 400 }, data: { label: 'Check Status' } },
  ];
}

function mockToast(): ToastApi {
  return { show: vi.fn(), dismiss: vi.fn() };
}

describe('useNodeClipboard', () => {
  it('copyNode copies the selected node and shows toast', () => {
    const nodes = makeNodes();
    const toast = mockToast();
    const { result } = renderHook(() =>
      useNodeClipboard({ getNodes: () => nodes, selectedNodeId: 'n1', toast }),
    );
    expect(result.current.copiedNodeData).toBeNull();
    act(() => result.current.copyNode());
    expect(result.current.copiedNodeData).not.toBeNull();
    expect(result.current.copiedNodeData?.type).toBe('http');
    expect(toast.show).toHaveBeenCalledWith('info', 'Node copied', '"Get Users"');
  });

  it('copyNode with explicit nodeId copies that node', () => {
    const nodes = makeNodes();
    const toast = mockToast();
    const { result } = renderHook(() =>
      useNodeClipboard({ getNodes: () => nodes, selectedNodeId: null, toast }),
    );
    act(() => result.current.copyNode('n2'));
    expect(result.current.copiedNodeData?.type).toBe('condition');
    expect(toast.show).toHaveBeenCalledWith('info', 'Node copied', '"Check Status"');
  });

  it('copyNode does nothing when no node is found', () => {
    const toast = mockToast();
    const { result } = renderHook(() =>
      useNodeClipboard({ getNodes: () => [] as Node[], selectedNodeId: 'missing', toast }),
    );
    act(() => result.current.copyNode());
    expect(result.current.copiedNodeData).toBeNull();
    expect(toast.show).not.toHaveBeenCalled();
  });

  it('copyNode does nothing when selectedNodeId is null', () => {
    const toast = mockToast();
    const { result } = renderHook(() =>
      useNodeClipboard({ getNodes: () => makeNodes(), selectedNodeId: null, toast }),
    );
    act(() => result.current.copyNode());
    expect(result.current.copiedNodeData).toBeNull();
  });

  it('buildPasteNode returns null when nothing is copied', () => {
    const toast = mockToast();
    const { result } = renderHook(() =>
      useNodeClipboard({ getNodes: () => makeNodes(), selectedNodeId: 'n1', toast }),
    );
    const node = result.current.buildPasteNode({ x: 100, y: 200 });
    expect(node).toBeNull();
  });

  it('buildPasteNode creates a new node from clipboard data', () => {
    const nodes = makeNodes();
    const toast = mockToast();
    const { result } = renderHook(() =>
      useNodeClipboard({ getNodes: () => nodes, selectedNodeId: 'n1', toast }),
    );
    act(() => result.current.copyNode());
    const node = result.current.buildPasteNode({ x: 50, y: 60 });
    expect(node).not.toBeNull();
    expect(node!.type).toBe('http');
    expect(node!.position).toEqual({ x: 50, y: 60 });
    expect((node!.data as Record<string, unknown>).label).toBe('Get Users (copy)');
    expect(node!.id).toBeTruthy();
    expect(node!.id).not.toBe('n1'); // new ID
  });

  it('buildPasteNode creates deep clones (mutations do not leak)', () => {
    const nodes = makeNodes();
    const toast = mockToast();
    const { result } = renderHook(() =>
      useNodeClipboard({ getNodes: () => nodes, selectedNodeId: 'n1', toast }),
    );
    act(() => result.current.copyNode());
    const node1 = result.current.buildPasteNode({ x: 0, y: 0 });
    const node2 = result.current.buildPasteNode({ x: 10, y: 10 });
    expect(node1!.data).not.toBe(node2!.data);
  });

  it('buildDuplicateNode returns null when no node selected', () => {
    const toast = mockToast();
    const { result } = renderHook(() =>
      useNodeClipboard({ getNodes: () => makeNodes(), selectedNodeId: null, toast }),
    );
    expect(result.current.buildDuplicateNode()).toBeNull();
  });

  it('buildDuplicateNode creates node offset from source', () => {
    const nodes = makeNodes();
    const toast = mockToast();
    const { result } = renderHook(() =>
      useNodeClipboard({ getNodes: () => nodes, selectedNodeId: 'n1', toast }),
    );
    const dup = result.current.buildDuplicateNode();
    expect(dup).not.toBeNull();
    expect(dup!.type).toBe('http');
    expect(dup!.position.x).toBe(140); // 100 + 40
    expect(dup!.position.y).toBe(280); // 200 + 80
    expect((dup!.data as Record<string, unknown>).label).toBe('Get Users (copy)');
    expect(dup!.id).not.toBe('n1');
  });

  it('buildDuplicateNode with explicit nodeId works', () => {
    const nodes = makeNodes();
    const toast = mockToast();
    const { result } = renderHook(() =>
      useNodeClipboard({ getNodes: () => nodes, selectedNodeId: null, toast }),
    );
    const dup = result.current.buildDuplicateNode('n2');
    expect(dup).not.toBeNull();
    expect(dup!.type).toBe('condition');
    expect(dup!.position.x).toBe(340); // 300 + 40
    expect((dup!.data as Record<string, unknown>).label).toBe('Check Status (copy)');
  });

  it('buildDuplicateNode returns null for non-existent nodeId', () => {
    const toast = mockToast();
    const { result } = renderHook(() =>
      useNodeClipboard({ getNodes: () => makeNodes(), selectedNodeId: null, toast }),
    );
    expect(result.current.buildDuplicateNode('missing')).toBeNull();
  });

  it('buildDuplicateNode uses zero offsets when source position is missing', () => {
    const nodes: Node[] = [
      { id: 'n1', type: 'http', data: { label: 'A', scenario: {} } } as Node,
    ];
    const toast = mockToast();
    const { result } = renderHook(() =>
      useNodeClipboard({ getNodes: () => nodes, selectedNodeId: 'n1', toast }),
    );
    const dup = result.current.buildDuplicateNode();
    expect(dup!.position).toEqual({ x: 40, y: 80 });
  });

  it('node label falls back to type when label is undefined', () => {
    const nodes: Node[] = [
      { id: 'n1', type: 'delay', position: { x: 0, y: 0 }, data: {} },
    ];
    const toast = mockToast();
    const { result } = renderHook(() =>
      useNodeClipboard({ getNodes: () => nodes, selectedNodeId: 'n1', toast }),
    );
    act(() => result.current.copyNode());
    expect(toast.show).toHaveBeenCalledWith('info', 'Node copied', '"delay"');
    const dup = result.current.buildDuplicateNode();
    expect((dup!.data as Record<string, unknown>).label).toBe('delay (copy)');
  });
});
