import { describe, it, expect } from 'vitest';
import {
  computeAutoMapCandidates,
  candidatesToMappings,
  normalizeFieldName,
} from './autoMapAlgorithm';
import { buildJsonTree } from '../../../utils/jsonTreeModel';
import type { Mapping } from '../types';

describe('normalizeFieldName', () => {
  it('normalizes camelCase', () => {
    expect(normalizeFieldName('userName')).toBe('username');
  });

  it('normalizes snake_case', () => {
    expect(normalizeFieldName('user_name')).toBe('username');
  });

  it('normalizes kebab-case', () => {
    expect(normalizeFieldName('user-name')).toBe('username');
  });

  it('normalizes PascalCase', () => {
    expect(normalizeFieldName('UserName')).toBe('username');
  });

  it('normalizes mixed separators', () => {
    expect(normalizeFieldName('user_Name-Id')).toBe('usernameid');
  });

  it('preserves already lowercase', () => {
    expect(normalizeFieldName('email')).toBe('email');
  });
});

describe('computeAutoMapCandidates', () => {
  const source = { name: 'Alice', email: 'a@b.com', age: 30 };
  const target = { name: '', email: '', age: 0 };
  const sourceTree = buildJsonTree(source, '', '');
  const targetTree = buildJsonTree(target, '', '');

  it('finds exact name matches', () => {
    const candidates = computeAutoMapCandidates(sourceTree, targetTree, []);
    expect(candidates).toHaveLength(3);
    expect(candidates.every((c) => c.confidence === 'exact')).toBe(true);
    expect(candidates.map((c) => c.targetPath).sort()).toEqual(['age', 'email', 'name']);
  });

  it('skips already-mapped targets', () => {
    const existing: Mapping[] = [
      { id: '1', sourcePath: 'name', sourceId: 's1', targetPath: 'name' },
    ];
    const candidates = computeAutoMapCandidates(sourceTree, targetTree, existing);
    expect(candidates).toHaveLength(2);
    expect(candidates.find((c) => c.targetPath === 'name')).toBeUndefined();
  });

  it('skips already-used source paths from existing mappings', () => {
    const existing: Mapping[] = [
      { id: '1', sourcePath: 'email', sourceId: 's1', targetPath: 'custom_field' },
    ];
    const candidates = computeAutoMapCandidates(sourceTree, targetTree, existing);
    expect(candidates.find((c) => c.sourcePath === 'email')).toBeUndefined();
  });

  it('finds case-insensitive matches', () => {
    const src = buildJsonTree({ UserName: 'A', Email: 'b' }, '', '');
    const tgt = buildJsonTree({ username: '', email: '' }, '', '');
    const candidates = computeAutoMapCandidates(src, tgt, []);
    expect(candidates).toHaveLength(2);
    expect(candidates.every((c) => c.confidence === 'case-insensitive')).toBe(true);
  });

  it('finds normalized matches (camel ↔ snake)', () => {
    const src = buildJsonTree({ user_name: 'A', email_address: 'b' }, '', '');
    const tgt = buildJsonTree({ userName: '', emailAddress: '' }, '', '');
    const candidates = computeAutoMapCandidates(src, tgt, []);
    expect(candidates).toHaveLength(2);
    expect(candidates.every((c) => c.confidence === 'normalized')).toBe(true);
  });

  it('prefers exact over case-insensitive', () => {
    const src = buildJsonTree({ name: 'A', Name: 'B' }, '', '');
    const tgt = buildJsonTree({ name: '' }, '', '');
    const candidates = computeAutoMapCandidates(src, tgt, []);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].confidence).toBe('exact');
    expect(candidates[0].sourcePath).toBe('name');
  });

  it('handles nested structures', () => {
    const src = buildJsonTree({ user: { firstName: 'A', lastName: 'B' } }, '', '');
    const tgt = buildJsonTree({ profile: { first_name: '', last_name: '' } }, '', '');
    const candidates = computeAutoMapCandidates(src, tgt, []);
    expect(candidates).toHaveLength(2);
    expect(candidates.every((c) => c.confidence === 'normalized')).toBe(true);
  });

  it('returns empty when no matches found', () => {
    const src = buildJsonTree({ foo: 1 }, '', '');
    const tgt = buildJsonTree({ bar: 2 }, '', '');
    const candidates = computeAutoMapCandidates(src, tgt, []);
    expect(candidates).toHaveLength(0);
  });

  it('each source field is used at most once', () => {
    const src = buildJsonTree({ name: 'A' }, '', '');
    const tgt = buildJsonTree({ name: '', Name: '' }, '', '');
    const candidates = computeAutoMapCandidates(src, tgt, []);
    expect(candidates).toHaveLength(1);
  });
});

describe('candidatesToMappings', () => {
  it('converts candidates to Mapping objects', () => {
    const candidates = [
      { sourcePath: 'name', targetPath: 'name', confidence: 'exact' as const },
      { sourcePath: 'email', targetPath: 'email', confidence: 'exact' as const },
    ];
    const mappings = candidatesToMappings(candidates, 'source-1');
    expect(mappings).toHaveLength(2);
    expect(mappings[0].sourceId).toBe('source-1');
    expect(mappings[0].isAutoMapped).toBe(true);
    expect(mappings[0].id).toBeTruthy();
    expect(mappings[0].sourcePath).toBe('name');
    expect(mappings[0].targetPath).toBe('name');
    expect(mappings[1].id).not.toBe(mappings[0].id);
  });
});

describe('computeAutoMapCandidates – edge cases', () => {
  it('matches by last segment of bracket-heavy paths', () => {
    const src = buildJsonTree({ items: [{ sku: 'A' }] }, '', '');
    const tgt = buildJsonTree({ sku: '' }, '', '');
    const candidates = computeAutoMapCandidates(src, tgt, []);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].sourcePath).toBe('items[0].sku');
    expect(candidates[0].targetPath).toBe('sku');
    expect(candidates[0].confidence).toBe('exact');
  });

  it('matches kebab-case to camelCase via normalized tier', () => {
    const src = buildJsonTree({ 'user-email': 'x' }, '', '');
    const tgt = buildJsonTree({ userEmail: '' }, '', '');
    const candidates = computeAutoMapCandidates(src, tgt, []);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].confidence).toBe('normalized');
  });

  it('case-insensitive beats normalized when both apply', () => {
    const src = buildJsonTree({ Email: 'x' }, '', '');
    const tgt = buildJsonTree({ email: '' }, '', '');
    const candidates = computeAutoMapCandidates(src, tgt, []);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].confidence).toBe('case-insensitive');
  });

  it('handles empty source tree', () => {
    const src = buildJsonTree({}, '', '');
    const tgt = buildJsonTree({ name: '' }, '', '');
    const candidates = computeAutoMapCandidates(src, tgt, []);
    expect(candidates).toHaveLength(0);
  });

  it('handles empty target tree', () => {
    const src = buildJsonTree({ name: 'A' }, '', '');
    const tgt = buildJsonTree({}, '', '');
    const candidates = computeAutoMapCandidates(src, tgt, []);
    expect(candidates).toHaveLength(0);
  });

  it('does not match intermediate nodes (only leaves)', () => {
    const src = buildJsonTree({ user: { name: 'A' } }, '', '');
    const tgt = buildJsonTree({ user: '' }, '', '');
    const candidates = computeAutoMapCandidates(src, tgt, []);
    // source 'user' is not a leaf (has child 'name'), so no match for target 'user'
    expect(candidates).toHaveLength(0);
  });

  it('claims sourcePath for expression mappings so leaf is not reused', () => {
    const src = buildJsonTree({ email: 'a@b.com', name: 'A' }, '', '');
    const tgt = buildJsonTree({ email: '', name: '' }, '', '');
    const existing: Mapping[] = [
      { id: 'e1', sourcePath: 'email', sourceId: 's1', targetPath: 'contactEmail', expression: '$upper($.email)' },
    ];
    const candidates = computeAutoMapCandidates(src, tgt, existing);
    const emailCandidates = candidates.filter(c => c.sourcePath === 'email');
    expect(emailCandidates).toHaveLength(0);
    const nameCandidates = candidates.filter(c => c.sourcePath === 'name');
    expect(nameCandidates).toHaveLength(1);
  });
});
