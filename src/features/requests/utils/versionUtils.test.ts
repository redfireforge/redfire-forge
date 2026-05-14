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
    const result = buildRulesSnapshot(version as Parameters<typeof buildRulesSnapshot>[0]);
    expect(result.mode).toBe('strict');
    expect(result.selectiveMode).toBe('include');
    expect(result.expectedFields[0].jsonPath).toBe('$.a');
    expect(result.expectedFields[1].jsonPath).toBe('$.b');
    expect(result.excludedPaths).toEqual(['$.a', '$.z']);
    expect(result.unorderedArrays).toBe(true);
  });

  it('handles missing optional fields with defaults', () => {
    const version = { id: 'v2' };
    const result = buildRulesSnapshot(version as Parameters<typeof buildRulesSnapshot>[0]);
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
    buildRulesSnapshot(version as Parameters<typeof buildRulesSnapshot>[0]);
    expect(fields[0].jsonPath).toBe('$.b'); // unchanged
    expect(excluded[0]).toBe('$.z'); // unchanged
  });

  it('uses defaults when validationMode and selectiveMode are empty strings', () => {
    const version = {
      id: 'v4',
      validationMode: '',
      selectiveMode: '',
      expectedFields: [],
      excludedPaths: [],
    };
    const result = buildRulesSnapshot(version as Parameters<typeof buildRulesSnapshot>[0]);
    expect(result.mode).toBe('none');
    expect(result.selectiveMode).toBe('include');
  });

  it('copies assertions when property exists and is truthy', () => {
    const assertions = [{ type: 'custom' as const, expression: 'true', description: 'ok' }];
    const version = {
      id: 'v5',
      timestamp: 1,
      validationMode: 'full' as const,
      selectiveMode: 'exclude' as const,
      expectedFields: [],
      excludedPaths: [],
      assertions,
    };
    const result = buildRulesSnapshot(version as Parameters<typeof buildRulesSnapshot>[0]);
    expect(result.assertions).toEqual(assertions);
    expect(result.assertions).not.toBe(assertions);
  });

  it('uses empty assertions when key is present but falsy', () => {
    const version = {
      id: 'v6',
      timestamp: 1,
      validationMode: 'full' as const,
      expectedFields: [],
      excludedPaths: [],
      assertions: undefined,
    };
    const result = buildRulesSnapshot(version as Parameters<typeof buildRulesSnapshot>[0]);
    expect(result.assertions).toEqual([]);
  });

  it('uses empty assertions when object has no assertions property (ResponseVersion shape)', () => {
    const version = {
      id: 'v7',
      timestamp: 1,
      json: '{}',
      validationMode: 'selective' as const,
      expectedFields: [{ jsonPath: '$.a', expectedValue: '1' }],
      excludedPaths: [],
    };
    const result = buildRulesSnapshot(version);
    expect(result.assertions).toEqual([]);
  });
});
