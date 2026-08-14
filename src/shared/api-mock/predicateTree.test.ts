import { describe, it, expect } from 'vitest';
import {
  addChildToGroup,
  countLeaves,
  findLeafInTree,
  isPredicateGroup,
  removeNodeFromTree,
  updateGroupInTree,
  updateLeafInTree,
  COMBINATOR_LABELS,
} from './predicateTree';
import type { ApiMockPredicateGroupV1, ApiMockPredicateV1 } from './contracts';

const leaf = (id: string, expected = 'v'): ApiMockPredicateV1 => ({
  id, source: 'header', selector: 'x', operator: 'exact', expected,
});

function tree(): ApiMockPredicateGroupV1 {
  return {
    id: 'root',
    combinator: 'all',
    children: [
      leaf('l1'),
      { id: 'g1', combinator: 'any', children: [leaf('l2'), leaf('l3')] },
    ],
  };
}

describe('predicateTree', () => {
  it('identifies groups vs leaves', () => {
    expect(isPredicateGroup(tree())).toBe(true);
    expect(isPredicateGroup(leaf('l'))).toBe(false);
  });

  it('appends into a nested group without touching siblings', () => {
    const next = addChildToGroup(tree(), 'g1', leaf('l4'));
    const g1 = next.children[1] as ApiMockPredicateGroupV1;
    expect(g1.children.map(c => c.id)).toEqual(['l2', 'l3', 'l4']);
    expect(next.children[0].id).toBe('l1');
  });

  it('appends to the root group', () => {
    const next = addChildToGroup(tree(), 'root', leaf('l9'));
    expect(next.children.map(c => c.id)).toEqual(['l1', 'g1', 'l9']);
  });

  it('updates a nested leaf only', () => {
    const next = updateLeafInTree(tree(), 'l3', { expected: 'changed' });
    const g1 = next.children[1] as ApiMockPredicateGroupV1;
    expect((g1.children[1] as ApiMockPredicateV1).expected).toBe('changed');
    expect((g1.children[0] as ApiMockPredicateV1).expected).toBe('v');
  });

  it('updates a nested group combinator', () => {
    const next = updateGroupInTree(tree(), 'g1', { combinator: 'not' });
    expect((next.children[1] as ApiMockPredicateGroupV1).combinator).toBe('not');
    expect(next.combinator).toBe('all');
  });

  it('removes a nested leaf and a whole group', () => {
    const noLeaf = removeNodeFromTree(tree(), 'l2');
    expect((noLeaf.children[1] as ApiMockPredicateGroupV1).children.map(c => c.id)).toEqual(['l3']);

    const noGroup = removeNodeFromTree(tree(), 'g1');
    expect(noGroup.children.map(c => c.id)).toEqual(['l1']);
  });

  it('never removes the root', () => {
    expect(removeNodeFromTree(tree(), 'root').id).toBe('root');
  });

  it('counts leaves across nesting', () => {
    expect(countLeaves(tree())).toBe(3);
    expect(countLeaves({ id: 'r', combinator: 'all', children: [] })).toBe(0);
  });

  it('finds nested leaves and returns undefined for missing ids', () => {
    expect(findLeafInTree(tree(), 'l3')?.expected).toBe('v');
    expect(findLeafInTree(tree(), 'missing')).toBeUndefined();
  });

  it('updates the root group combinator in place', () => {
    const next = updateGroupInTree(tree(), 'root', { combinator: 'any' });
    expect(next.combinator).toBe('any');
    expect((next.children[1] as ApiMockPredicateGroupV1).combinator).toBe('any');
  });

  it('exposes combinator labels', () => {
    expect(COMBINATOR_LABELS.all).toBe('All of');
    expect(COMBINATOR_LABELS.not).toBe('None of');
  });
});
