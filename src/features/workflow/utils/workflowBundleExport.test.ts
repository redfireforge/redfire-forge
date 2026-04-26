import { describe, it, expect } from 'vitest';
import {
  collectWorkflowBundle,
  detectImportConflicts,
  resolveImportBundle,
} from './workflowBundleExport';
import type { Workflow, WorkflowNode, SubWorkflowNodeData } from '../types/workflow';

function makeWorkflow(id: string, name: string, nodes: WorkflowNode[] = []): Workflow {
  return {
    id,
    name,
    variables: {},
    nodes,
    edges: [],
    createdAt: 1000,
    updatedAt: 2000,
  };
}

function subNode(id: string, workflowId: string): WorkflowNode {
  return {
    id,
    type: 'subWorkflow',
    position: { x: 0, y: 0 },
    data: {
      label: 'Sub',
      workflowId,
      inputMappings: [],
      outputMappings: [],
    } satisfies SubWorkflowNodeData,
  };
}

// ─── collectWorkflowBundle ───────────────────────────────

describe('collectWorkflowBundle', () => {
  it('returns root workflow with no children when no sub-workflow nodes', () => {
    const wf = makeWorkflow('root', 'Root');
    const bundle = collectWorkflowBundle('root', [wf]);
    expect(bundle).not.toBeNull();
    expect(bundle!.root.id).toBe('root');
    expect(bundle!.children).toHaveLength(0);
  });

  it('returns null when root workflow not found', () => {
    const bundle = collectWorkflowBundle('missing', []);
    expect(bundle).toBeNull();
  });

  it('collects direct child workflows', () => {
    const child = makeWorkflow('child-1', 'Child');
    const root = makeWorkflow('root', 'Root', [subNode('sw1', 'child-1')]);
    const bundle = collectWorkflowBundle('root', [root, child]);

    expect(bundle!.root.id).toBe('root');
    expect(bundle!.children).toHaveLength(1);
    expect(bundle!.children[0].id).toBe('child-1');
  });

  it('collects transitive child workflows (A → B → C)', () => {
    const c = makeWorkflow('wf-c', 'C');
    const b = makeWorkflow('wf-b', 'B', [subNode('sw-b', 'wf-c')]);
    const a = makeWorkflow('wf-a', 'A', [subNode('sw-a', 'wf-b')]);
    const bundle = collectWorkflowBundle('wf-a', [a, b, c]);

    expect(bundle!.children).toHaveLength(2);
    const ids = bundle!.children.map((w) => w.id).sort();
    expect(ids).toEqual(['wf-b', 'wf-c']);
  });

  it('deduplicates children referenced by multiple parents', () => {
    const shared = makeWorkflow('shared', 'Shared');
    const b = makeWorkflow('wf-b', 'B', [subNode('sw-b', 'shared')]);
    const root = makeWorkflow('root', 'Root', [
      subNode('sw1', 'wf-b'),
      subNode('sw2', 'shared'),
    ]);
    const bundle = collectWorkflowBundle('root', [root, b, shared]);

    expect(bundle!.children).toHaveLength(2);
    const ids = bundle!.children.map((w) => w.id).sort();
    expect(ids).toEqual(['shared', 'wf-b']);
  });

  it('handles missing child references gracefully', () => {
    const root = makeWorkflow('root', 'Root', [subNode('sw1', 'missing')]);
    const bundle = collectWorkflowBundle('root', [root]);

    expect(bundle!.root.id).toBe('root');
    expect(bundle!.children).toHaveLength(0);
  });

  it('handles circular references without infinite loop', () => {
    const b = makeWorkflow('wf-b', 'B', [subNode('sw-b', 'wf-a')]);
    const a = makeWorkflow('wf-a', 'A', [subNode('sw-a', 'wf-b')]);
    const bundle = collectWorkflowBundle('wf-a', [a, b]);

    expect(bundle!.root.id).toBe('wf-a');
    expect(bundle!.children).toHaveLength(1);
    expect(bundle!.children[0].id).toBe('wf-b');
  });
});

// ─── detectImportConflicts ────────────────────────────────

describe('detectImportConflicts', () => {
  it('returns no conflicts when no IDs overlap', () => {
    const bundle = { root: makeWorkflow('new-1', 'New'), children: [] };
    const existing = [makeWorkflow('old-1', 'Old')];
    const conflicts = detectImportConflicts(bundle, existing);
    expect(conflicts).toHaveLength(0);
  });

  it('returns no conflict when IDs match but content is identical', () => {
    const wf = makeWorkflow('wf-1', 'Workflow');
    const bundle = { root: wf, children: [] };
    // Same content, different timestamps
    const existing = [{ ...wf, createdAt: 0, updatedAt: 0 }];
    const conflicts = detectImportConflicts(bundle, existing);
    expect(conflicts).toHaveLength(0);
  });

  it('detects conflict when IDs match but content differs', () => {
    const incoming = makeWorkflow('wf-1', 'New Name');
    const existing = [makeWorkflow('wf-1', 'Old Name')];
    const bundle = { root: incoming, children: [] };
    const conflicts = detectImportConflicts(bundle, existing);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].workflowId).toBe('wf-1');
    expect(conflicts[0].incomingName).toBe('New Name');
    expect(conflicts[0].existingName).toBe('Old Name');
  });

  it('detects conflicts in child workflows', () => {
    const root = makeWorkflow('root', 'Root');
    const child = makeWorkflow('child-1', 'New Child');
    const bundle = { root, children: [child] };
    const existing = [makeWorkflow('child-1', 'Old Child')];
    const conflicts = detectImportConflicts(bundle, existing);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].workflowId).toBe('child-1');
  });
});

// ─── resolveImportBundle ──────────────────────────────────

describe('resolveImportBundle', () => {
  it('adds new workflows that do not exist locally', () => {
    const root = makeWorkflow('new-root', 'Root');
    const child = makeWorkflow('new-child', 'Child');
    const bundle = { root, children: [child] };
    const result = resolveImportBundle(bundle, [], new Map());

    expect(result.toAdd).toHaveLength(2);
    expect(result.toReplace).toHaveLength(0);
    expect(result.kept).toHaveLength(0);
  });

  it('keeps existing workflows with identical content', () => {
    const wf = makeWorkflow('wf-1', 'Same');
    const bundle = { root: wf, children: [] };
    const existing = [{ ...wf, createdAt: 0, updatedAt: 0 }];
    const result = resolveImportBundle(bundle, existing, new Map());

    expect(result.toAdd).toHaveLength(0);
    expect(result.toReplace).toHaveLength(0);
    expect(result.kept).toEqual(['wf-1']);
  });

  it('keeps conflicting workflow when resolution is "keep"', () => {
    const incoming = makeWorkflow('wf-1', 'New');
    const existing = [makeWorkflow('wf-1', 'Old')];
    const bundle = { root: incoming, children: [] };
    const result = resolveImportBundle(
      bundle,
      existing,
      new Map([['wf-1', 'keep']]),
    );

    expect(result.kept).toEqual(['wf-1']);
    expect(result.toReplace).toHaveLength(0);
    expect(result.toAdd).toHaveLength(0);
  });

  it('replaces conflicting workflow when resolution is "replace"', () => {
    const incoming = makeWorkflow('wf-1', 'New');
    const existing = [makeWorkflow('wf-1', 'Old')];
    const bundle = { root: incoming, children: [] };
    const result = resolveImportBundle(
      bundle,
      existing,
      new Map([['wf-1', 'replace']]),
    );

    expect(result.toReplace).toHaveLength(1);
    expect(result.toReplace[0].name).toBe('New');
    expect(result.toReplace[0].id).toBe('wf-1');
    expect(result.kept).toHaveLength(0);
  });

  it('creates copy with new ID when resolution is "copy"', () => {
    const incoming = makeWorkflow('wf-1', 'Workflow');
    const existing = [makeWorkflow('wf-1', 'Old')];
    const bundle = { root: incoming, children: [] };
    const result = resolveImportBundle(
      bundle,
      existing,
      new Map([['wf-1', 'copy']]),
    );

    expect(result.toAdd).toHaveLength(1);
    expect(result.toAdd[0].id).not.toBe('wf-1');
    expect(result.toAdd[0].name).toBe('Workflow (imported)');
  });

  it('updates sub-workflow references when parent is copied', () => {
    const child = makeWorkflow('child-1', 'Child');
    const root = makeWorkflow('root', 'Root', [subNode('sw1', 'child-1')]);
    const existing = [makeWorkflow('root', 'Old Root')];
    const bundle = { root, children: [child] };
    const result = resolveImportBundle(
      bundle,
      existing,
      new Map([['root', 'copy']]),
    );

    // Root was copied with new ID
    const copiedRoot = result.toAdd.find((w) => w.name === 'Root (imported)');
    expect(copiedRoot).toBeTruthy();
    expect(copiedRoot!.id).not.toBe('root');

    // Child should be added as-is (no conflict)
    const addedChild = result.toAdd.find((w) => w.id === 'child-1');
    expect(addedChild).toBeTruthy();
  });

  it('remaps sub-workflow references when child is copied', () => {
    const child = makeWorkflow('child-1', 'Child');
    const root = makeWorkflow('root', 'Root', [subNode('sw1', 'child-1')]);
    const existingChild = makeWorkflow('child-1', 'Old Child');
    const bundle = { root, children: [child] };
    const result = resolveImportBundle(
      bundle,
      [existingChild],
      new Map([['child-1', 'copy']]),
    );

    // Child should be copied with new ID
    const copiedChild = result.toAdd.find((w) => w.name === 'Child (imported)');
    expect(copiedChild).toBeTruthy();
    expect(copiedChild!.id).not.toBe('child-1');

    // Root should have its sub-workflow reference updated to new child ID
    const addedRoot = result.toAdd.find((w) => w.id === 'root');
    expect(addedRoot).toBeTruthy();
    const swData = addedRoot!.nodes.find((n) => n.type === 'subWorkflow')
      ?.data as SubWorkflowNodeData;
    expect(swData.workflowId).toBe(copiedChild!.id);
  });

  it('defaults unresolved conflicts to "keep"', () => {
    const incoming = makeWorkflow('wf-1', 'New');
    const existing = [makeWorkflow('wf-1', 'Old')];
    const bundle = { root: incoming, children: [] };
    // No resolution provided
    const result = resolveImportBundle(bundle, existing, new Map());

    expect(result.kept).toEqual(['wf-1']);
    expect(result.toAdd).toHaveLength(0);
    expect(result.toReplace).toHaveLength(0);
  });
});
