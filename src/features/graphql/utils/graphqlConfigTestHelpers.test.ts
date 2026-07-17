import { describe, it, expect } from 'vitest';
import {
  buildGraphqlRunSnapshot,
  parseGraphqlRunSnapshot,
  hasGraphqlRunData,
  buildExtractedVariableMap,
  testGraphqlExtractionRules,
  testGraphqlAssertions,
  resolveRuntimeVariableValue,
  normalizeWorkflowVarRef,
  getExtractionTestRoot,
} from './graphqlConfigTestHelpers';
import type { NodeRunStatus } from '../../workflow/types/workflow';

describe('graphqlConfigTestHelpers', () => {
  describe('buildGraphqlRunSnapshot / parseGraphqlRunSnapshot', () => {
    it('round-trips snapshot JSON in responseDetail', () => {
      const detail = buildGraphqlRunSnapshot({ data: { user: { id: '1' } }, httpStatus: 200 });
      const status: NodeRunStatus = { state: 'pass', responseDetail: detail };
      const parsed = parseGraphqlRunSnapshot(status);
      expect(parsed?.data).toEqual({ user: { id: '1' } });
      expect(parsed?.httpStatus).toBe(200);
    });

    it('returns null when responseDetail is missing, blank, or malformed', () => {
      expect(parseGraphqlRunSnapshot(null)).toBeNull();
      expect(parseGraphqlRunSnapshot({ state: 'pass', responseDetail: '   ' })).toBeNull();
      expect(parseGraphqlRunSnapshot({ state: 'pass', responseDetail: '{bad json' })).toBeNull();
    });
  });

  describe('hasGraphqlRunData', () => {
    it('returns false for idle/pending states and true when snapshot has data', () => {
      expect(hasGraphqlRunData({ state: 'idle' })).toBe(false);
      expect(hasGraphqlRunData({ state: 'pending' })).toBe(false);
      expect(hasGraphqlRunData({ state: 'pass', responseDetail: '{"data":{"id":1}}' })).toBe(true);
      expect(hasGraphqlRunData({ state: 'pass', responseDetail: '{"subscriptionLastData":{"id":1}}' })).toBe(true);
    });

    it('falls back to extracted map when snapshot is unavailable', () => {
      expect(hasGraphqlRunData({ state: 'pass', extracted: { userId: '1' } })).toBe(true);
      expect(hasGraphqlRunData({ state: 'pass', extracted: {} })).toBe(false);
    });
  });

  describe('getExtractionTestRoot', () => {
    it('uses subscriptionLastData for subscription mode', () => {
      const snap = { data: { a: 1 }, subscriptionLastData: { b: 2 } };
      expect(getExtractionTestRoot(snap, 'subscription')).toEqual({ b: 2 });
      expect(getExtractionTestRoot(snap, 'query')).toEqual({ a: 1 });
    });

    it('falls back to snapshot.data when subscriptionLastData is missing', () => {
      const snap = { data: { a: 1 } };
      expect(getExtractionTestRoot(snap, 'subscription')).toEqual({ a: 1 });
      expect(getExtractionTestRoot(null, 'query')).toBeUndefined();
    });
  });

  describe('buildExtractedVariableMap', () => {
    it('builds extracted map and skips incomplete rules', () => {
      const extracted = buildExtractedVariableMap(
        [
          { variableName: 'userId', jsonPath: '$.user.id' },
          { variableName: 'missing', jsonPath: '$.missing' },
          { variableName: '', jsonPath: '$.user.id' },
          { variableName: 'noPath', jsonPath: '' },
        ],
        { user: { id: 42 } },
      );

      expect(extracted).toEqual({ userId: '42', missing: '' });
    });
  });

  describe('testGraphqlExtractionRules', () => {
    it('extracts values from response data', () => {
      const results = testGraphqlExtractionRules(
        [{ variableName: 'userId', jsonPath: '$.user.id' }],
        { user: { id: '42' } },
      );
      expect(results[0].ok).toBe(true);
      expect(results[0].value).toBe('"42"');
    });

    it('reports missing paths', () => {
      const results = testGraphqlExtractionRules(
        [{ variableName: 'x', jsonPath: '$.missing' }],
        { user: { id: '1' } },
      );
      expect(results[0].ok).toBe(false);
      expect(results[0].error).toMatch(/not found/i);
    });

    it('reports missing jsonPath and variable name validations', () => {
      const missingPath = testGraphqlExtractionRules([{ variableName: 'x', jsonPath: '   ' }], { id: 1 });
      const missingVar = testGraphqlExtractionRules([{ variableName: '   ', jsonPath: '$.id' }], { id: 1 });
      expect(missingPath[0].error).toMatch(/JSONPath is required/i);
      expect(missingVar[0].error).toMatch(/Variable name is required/i);
    });

    it('treats non-matching complex paths as not-found', () => {
      const results = testGraphqlExtractionRules([{ variableName: 'x', jsonPath: '$.[*].missing' }], { id: 1 });
      expect(results[0].ok).toBe(false);
      expect(results[0].error).toMatch(/not found/i);
    });

    it('returns thrown JSONPath engine errors', async () => {
      vi.resetModules();
      vi.doMock('../../../shared/utils/jsonPath', () => ({
        getByPath: () => {
          throw new Error('boom');
        },
      }));

      const mockedHelpers = await import('./graphqlConfigTestHelpers');
      const results = mockedHelpers.testGraphqlExtractionRules(
        [{ variableName: 'x', jsonPath: '$.user.id' }],
        { user: { id: 1 } },
      );

      expect(results[0].ok).toBe(false);
      expect(results[0].error).toBe('boom');

      vi.doUnmock('../../../shared/utils/jsonPath');
      vi.resetModules();
    });
  });

  describe('resolveRuntimeVariableValue', () => {
    it('normalizes {{var}} syntax', () => {
      expect(normalizeWorkflowVarRef('{{myVar}}')).toBe('myVar');
    });

    it('returns error when variable missing', () => {
      const r = resolveRuntimeVariableValue('myVar', {});
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/run the workflow first/i);
    });

    it('returns required error for empty source variable', () => {
      const r = resolveRuntimeVariableValue('   ', { payload: '{"id":1}' });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/required/i);
    });

    it('returns empty error when runtime variable is empty', () => {
      const r = resolveRuntimeVariableValue('payload', { payload: '' });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/empty/i);
    });

    it('parses JSON variable values', () => {
      const r = resolveRuntimeVariableValue('payload', { payload: '{"id":1}' });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.value).toEqual({ id: 1 });
    });

    it('returns raw string when runtime variable is not JSON', () => {
      const r = resolveRuntimeVariableValue('{{payload}}', { payload: 'plain text value' });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.value).toBe('plain text value');
    });
  });

  describe('testGraphqlAssertions', () => {
    it('evaluates equals assertion', () => {
      const results = testGraphqlAssertions(
        [{ id: 'a1', jsonPath: '$.id', operator: 'equals', expectedValue: '1' }],
        { id: 1 },
      );
      expect(results[0].ok).toBe(true);
    });

    it('reports failed assertion', () => {
      const results = testGraphqlAssertions(
        [{ id: 'a1', jsonPath: '$.id', operator: 'equals', expectedValue: '99' }],
        { id: 1 },
      );
      expect(results[0].ok).toBe(false);
    });

    it('returns JSONPath required when assertion path is blank', () => {
      const results = testGraphqlAssertions(
        [{ id: 'a1', jsonPath: '   ', operator: 'equals', expectedValue: '1' }],
        { id: 1 },
      );
      expect(results[0].ok).toBe(false);
      expect(results[0].message).toMatch(/JSONPath is required/i);
    });

    it('uses custom description for failed assertion and reports undefined actual', () => {
      const results = testGraphqlAssertions(
        [{ id: 'a1', jsonPath: '$.missing', operator: 'exists', description: 'must exist' }],
        { id: 1 },
      );
      expect(results[0].ok).toBe(false);
      expect(results[0].actual).toBe('undefined');
      expect(results[0].message).toBe('must exist');
    });
  });
});
