import { describe, it, expect } from 'vitest';
import { computeAutoMapCandidates, candidatesToMappings, normalizeFieldName, MATCH_SCORES, } from './autoMapAlgorithm';
import { buildJsonTree } from '../../../utils/jsonTreeModel';
import { Mapping } from '../types';

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

describe('computeAutoMapCandidates – suffix matching', () => {
  it('matches source suffix to shorter target name', () => {
    const src = buildJsonTree({ userEmail: 'a@b.com', userPhone: '555' }, '', '');
    const tgt = buildJsonTree({ email: '', phone: '' }, '', '');
    const candidates = computeAutoMapCandidates(src, tgt, []);
    expect(candidates).toHaveLength(2);
    expect(candidates.every(c => c.tier === 'suffix')).toBe(true);
    expect(candidates.every(c => c.score === MATCH_SCORES.suffix)).toBe(true);
  });

  it('matches shorter source name as suffix of longer target', () => {
    const src = buildJsonTree({ email: 'a@b.com' }, '', '');
    const tgt = buildJsonTree({ contactEmail: '' }, '', '');
    const candidates = computeAutoMapCandidates(src, tgt, []);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].tier).toBe('suffix');
  });

  it('does not match identical names as suffix (handled by exact)', () => {
    const src = buildJsonTree({ email: 'a@b.com' }, '', '');
    const tgt = buildJsonTree({ email: '' }, '', '');
    const candidates = computeAutoMapCandidates(src, tgt, []);
    expect(candidates[0].tier).toBe('exact');
  });

  it('prefers normalized over suffix when both match', () => {
    const src = buildJsonTree({ user_name: 'A' }, '', '');
    const tgt = buildJsonTree({ userName: '' }, '', '');
    const candidates = computeAutoMapCandidates(src, tgt, []);
    expect(candidates[0].tier).toBe('normalized');
  });
});

describe('computeAutoMapCandidates – synonym matching', () => {
  it('matches qty → quantity via synonym', () => {
    const src = buildJsonTree({ qty: 5 }, '', '');
    const tgt = buildJsonTree({ quantity: 0 }, '', '');
    const candidates = computeAutoMapCandidates(src, tgt, []);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].tier).toBe('synonym');
    expect(candidates[0].score).toBe(MATCH_SCORES.synonym);
  });

  it('matches tel → phone via synonym', () => {
    const src = buildJsonTree({ tel: '555-1234' }, '', '');
    const tgt = buildJsonTree({ phone: '' }, '', '');
    const candidates = computeAutoMapCandidates(src, tgt, []);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].tier).toBe('synonym');
  });

  it('matches desc → description via synonym', () => {
    const src = buildJsonTree({ desc: 'A thing' }, '', '');
    const tgt = buildJsonTree({ description: '' }, '', '');
    const candidates = computeAutoMapCandidates(src, tgt, []);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].tier).toBe('synonym');
  });

  it('matches addr → address via synonym', () => {
    const src = buildJsonTree({ addr: '123 Main St' }, '', '');
    const tgt = buildJsonTree({ address: '' }, '', '');
    const candidates = computeAutoMapCandidates(src, tgt, []);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].tier).toBe('synonym');
  });

  it('matches img → image via synonym', () => {
    const src = buildJsonTree({ img: 'pic.jpg' }, '', '');
    const tgt = buildJsonTree({ image: '' }, '', '');
    const candidates = computeAutoMapCandidates(src, tgt, []);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].tier).toBe('synonym');
  });

  it('does not match unrelated words', () => {
    const src = buildJsonTree({ color: 'red' }, '', '');
    const tgt = buildJsonTree({ weight: 0 }, '', '');
    const candidates = computeAutoMapCandidates(src, tgt, []);
    expect(candidates).toHaveLength(0);
  });

  it('prefers suffix over synonym when both match', () => {
    const src = buildJsonTree({ userPhone: '555' }, '', '');
    const tgt = buildJsonTree({ phone: '' }, '', '');
    const candidates = computeAutoMapCandidates(src, tgt, []);
    expect(candidates[0].tier).toBe('suffix');
  });

  it('handles synonyms with normalized names (camelCase source)', () => {
    const src = buildJsonTree({ firstName: 'Alice' }, '', '');
    const tgt = buildJsonTree({ fname: '' }, '', '');
    const candidates = computeAutoMapCandidates(src, tgt, []);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].tier).toBe('synonym');
  });
});

describe('computeAutoMapCandidates – semantic value matching', () => {
  it('matches by shared email type', () => {
    const sourceData = { contact: 'alice@example.com', foo: 'bar' };
    const targetData = { recipientMail: 'bob@test.org', baz: 'qux' };
    const src = buildJsonTree(sourceData, '', '');
    const tgt = buildJsonTree(targetData, '', '');
    const candidates = computeAutoMapCandidates(src, tgt, [], {
      sourceData, targetData,
    });
    const emailMatch = candidates.find(c => c.tier === 'semantic-value');
    expect(emailMatch).toBeDefined();
    expect(emailMatch!.semanticType).toBe('email');
    expect(emailMatch!.score).toBe(MATCH_SCORES['semantic-value']);
  });

  it('does not match when values have different semantic types', () => {
    const sourceData = { val: 'alice@example.com' };
    const targetData = { val2: 'https://example.com' };
    const src = buildJsonTree(sourceData, '', '');
    const tgt = buildJsonTree(targetData, '', '');
    const candidates = computeAutoMapCandidates(src, tgt, [], {
      sourceData, targetData,
    });
    expect(candidates.find(c => c.tier === 'semantic-value')).toBeUndefined();
  });

  it('skips semantic matching when no options provided', () => {
    const sourceData = { a: 'alice@example.com' };
    const targetData = { b: 'bob@test.org' };
    const src = buildJsonTree(sourceData, '', '');
    const tgt = buildJsonTree(targetData, '', '');
    const candidates = computeAutoMapCandidates(src, tgt, []);
    expect(candidates.find(c => c.tier === 'semantic-value')).toBeUndefined();
  });

  it('matches UUID values semantically', () => {
    const sourceData = { ref: '550e8400-e29b-41d4-a716-446655440000' };
    const targetData = { identifier: '12345678-1234-1234-1234-123456789abc' };
    const src = buildJsonTree(sourceData, '', '');
    const tgt = buildJsonTree(targetData, '', '');
    const candidates = computeAutoMapCandidates(src, tgt, [], { sourceData, targetData });
    expect(candidates).toHaveLength(1);
    expect(candidates[0].tier).toBe('semantic-value');
    expect(candidates[0].semanticType).toBe('uuid');
  });
});

describe('computeAutoMapCandidates – scoring', () => {
  it('exact match has score 100', () => {
    const src = buildJsonTree({ name: 'A' }, '', '');
    const tgt = buildJsonTree({ name: '' }, '', '');
    const candidates = computeAutoMapCandidates(src, tgt, []);
    expect(candidates[0].score).toBe(100);
    expect(candidates[0].tier).toBe('exact');
  });

  it('case-insensitive match has score 90', () => {
    const src = buildJsonTree({ Name: 'A' }, '', '');
    const tgt = buildJsonTree({ name: '' }, '', '');
    const candidates = computeAutoMapCandidates(src, tgt, []);
    expect(candidates[0].score).toBe(90);
    expect(candidates[0].tier).toBe('case-insensitive');
  });

  it('normalized match has score 80', () => {
    const src = buildJsonTree({ user_name: 'A' }, '', '');
    const tgt = buildJsonTree({ userName: '' }, '', '');
    const candidates = computeAutoMapCandidates(src, tgt, []);
    expect(candidates[0].score).toBe(80);
    expect(candidates[0].tier).toBe('normalized');
  });

  it('suffix match has score 75', () => {
    const src = buildJsonTree({ userEmail: 'a@b.com' }, '', '');
    const tgt = buildJsonTree({ email: '' }, '', '');
    const candidates = computeAutoMapCandidates(src, tgt, []);
    expect(candidates[0].score).toBe(75);
    expect(candidates[0].tier).toBe('suffix');
  });

  it('synonym match has score 60', () => {
    const src = buildJsonTree({ qty: 5 }, '', '');
    const tgt = buildJsonTree({ quantity: 0 }, '', '');
    const candidates = computeAutoMapCandidates(src, tgt, []);
    expect(candidates[0].score).toBe(60);
    expect(candidates[0].tier).toBe('synonym');
  });

  it('MATCH_SCORES constant has all tiers', () => {
    expect(MATCH_SCORES.exact).toBe(100);
    expect(MATCH_SCORES['case-insensitive']).toBe(90);
    expect(MATCH_SCORES.normalized).toBe(80);
    expect(MATCH_SCORES.suffix).toBe(75);
    expect(MATCH_SCORES.synonym).toBe(60);
    expect(MATCH_SCORES['semantic-value']).toBe(50);
  });

  it('candidates have both confidence (legacy) and tier fields', () => {
    const src = buildJsonTree({ qty: 5 }, '', '');
    const tgt = buildJsonTree({ quantity: 0 }, '', '');
    const candidates = computeAutoMapCandidates(src, tgt, []);
    expect(candidates[0].confidence).toBe('synonym');
    expect(candidates[0].tier).toBe('synonym');
  });
});
