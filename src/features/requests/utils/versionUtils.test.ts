import { describe, it, expect } from 'vitest';
import { buildRulesSnapshot } from './versionUtils';

describe('buildRulesSnapshot', () => {
  it('returns normalized snapshot with sorted fields and paths', () => {
    const version = {
      id: 'v1',
      validationMode: 'strict',
      selectiveMode: 'include',
      expectedFields: [
        { jsonPath: '$.b', type: 'string' },
        { jsonPath: '$.a', type: 'number' },
      ],
      excludedPaths: ['$.z', '$.a'],
      unorderedArrays: true,
    };
    const result = buildRulesSnapshot(version as any);
    expect(result.mode).toBe('strict');
    expect(result.selectiveMode).toBe('include');
    expect(result.expectedFields[0].jsonPath).toBe('$.a');
    expect(result.expectedFields[1].jsonPath).toBe('$.b');
    expect(result.excludedPaths).toEqual(['$.a', '$.z']);
    expect(result.unorderedArrays).toBe(true);
  });

  it('handles missing optional fields with defaults', () => {
    const version = { id: 'v2' };
    const result = buildRulesSnapshot(version as any);
    expect(result.mode).toBe('none');
    expect(result.selectiveMode).toBe('include');
    expect(result.expectedFields).toEqual([]);
    expect(result.excludedPaths).toEqual([]);
    expect(result.unorderedArrays).toBe(false);
  });

  it('does not mutate original arrays', () => {
    const fields = [{ jsonPath: '$.b', type: 'string' }, { jsonPath: '$.a', type: 'number' }];
    const excluded = ['$.z', '$.a'];
    const version = { id: 'v3', expectedFields: fields, excludedPaths: excluded };
    buildRulesSnapshot(version as any);
    expect(fields[0].jsonPath).toBe('$.b'); // unchanged
    expect(excluded[0]).toBe('$.z'); // unchanged
  });
});
