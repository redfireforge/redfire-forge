import { describe, it, expect, vi } from 'vitest';
import { createResponseVersion, createRulesVersion } from './versionFactory';

// Mock uuid to produce deterministic IDs
vi.mock('uuid', () => ({ v4: () => 'test-uuid-1234' }));

const baseValidation = {
  mode: 'selective' as const,
  selectiveMode: 'include' as const,
  expectedFields: [{ path: '$.id', operator: 'exists' as const }],
  excludedPaths: ['$.meta'],
  unorderedArrays: true,
};

describe('createResponseVersion', () => {
  it('creates a version with all fields from validation state', () => {
    const ver = createResponseVersion(baseValidation as any, '{"id":1}');
    expect(ver.id).toBe('test-uuid-1234');
    expect(ver.timestamp).toBeGreaterThan(0);
    expect(ver.json).toBe('{"id":1}');
    expect(ver.validationMode).toBe('selective');
    expect(ver.selectiveMode).toBe('include');
    expect(ver.expectedFields).toEqual([{ path: '$.id', operator: 'exists' }]);
    expect(ver.excludedPaths).toEqual(['$.meta']);
    expect(ver.unorderedArrays).toBe(true);
  });

  it('copies expectedFields array (not reference)', () => {
    const ver = createResponseVersion(baseValidation as any, '{}');
    expect(ver.expectedFields).not.toBe(baseValidation.expectedFields);
  });

  it('copies excludedPaths array (not reference)', () => {
    const ver = createResponseVersion(baseValidation as any, '{}');
    expect(ver.excludedPaths).not.toBe(baseValidation.excludedPaths);
  });

  it('handles undefined expectedFields', () => {
    const v = { ...baseValidation, expectedFields: undefined };
    const ver = createResponseVersion(v as any, '{}');
    expect(ver.expectedFields).toEqual([]);
  });

  it('handles undefined excludedPaths', () => {
    const v = { ...baseValidation, excludedPaths: undefined };
    const ver = createResponseVersion(v as any, '{}');
    expect(ver.excludedPaths).toEqual([]);
  });
});

describe('createRulesVersion', () => {
  it('creates a version without json field', () => {
    const ver = createRulesVersion(baseValidation as any);
    expect(ver.id).toBe('test-uuid-1234');
    expect(ver.timestamp).toBeGreaterThan(0);
    expect(ver.validationMode).toBe('selective');
    expect(ver.selectiveMode).toBe('include');
    expect(ver.expectedFields).toEqual([{ path: '$.id', operator: 'exists' }]);
    expect(ver.excludedPaths).toEqual(['$.meta']);
    expect(ver.unorderedArrays).toBe(true);
    expect((ver as any).json).toBeUndefined();
  });

  it('copies arrays by value', () => {
    const ver = createRulesVersion(baseValidation as any);
    expect(ver.expectedFields).not.toBe(baseValidation.expectedFields);
    expect(ver.excludedPaths).not.toBe(baseValidation.excludedPaths);
  });

  it('handles empty/undefined fields gracefully', () => {
    const v = { mode: 'none' as const };
    const ver = createRulesVersion(v as any);
    expect(ver.expectedFields).toEqual([]);
    expect(ver.excludedPaths).toEqual([]);
    expect(ver.validationMode).toBe('none');
  });
});
