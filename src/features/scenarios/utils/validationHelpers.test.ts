import { describe, it, expect } from 'vitest';
import {
  getExpectedFields,
  getAssertions,
  hasExpectedFields,
  hasAssertions,
  hasActiveRules,
  hasValidationConfig,
  hasSampleJson,
} from './validationHelpers';
import type { Scenario } from '@shared/types';

type V = Scenario['validation'];

function makeV(overrides: Partial<V> = {}): V {
  return { mode: 'none', ...overrides } as V;
}

describe('validationHelpers', () => {
  describe('getExpectedFields', () => {
    it('returns empty array when expectedFields is undefined', () => {
      expect(getExpectedFields(makeV())).toEqual([]);
    });
    it('returns the fields when defined', () => {
      const fields = [{ jsonPath: '$.id', expectedValue: '1' }];
      expect(getExpectedFields(makeV({ expectedFields: fields }))).toBe(fields);
    });
  });

  describe('getAssertions', () => {
    it('returns empty array when assertions is undefined', () => {
      expect(getAssertions(makeV())).toEqual([]);
    });
    it('returns assertions when defined', () => {
      const assertions = [{ type: 'status' as const, expected: '200' }];
      expect(getAssertions(makeV({ assertions }))).toBe(assertions);
    });
  });

  describe('hasExpectedFields', () => {
    it('false when undefined', () => expect(hasExpectedFields(makeV())).toBe(false));
    it('false when empty', () => expect(hasExpectedFields(makeV({ expectedFields: [] }))).toBe(false));
    it('true when populated', () => expect(hasExpectedFields(makeV({ expectedFields: [{ jsonPath: '$.x', expectedValue: '1' }] }))).toBe(true));
  });

  describe('hasAssertions', () => {
    it('false when undefined', () => expect(hasAssertions(makeV())).toBe(false));
    it('false when empty', () => expect(hasAssertions(makeV({ assertions: [] }))).toBe(false));
    it('true when populated', () => expect(hasAssertions(makeV({ assertions: [{ type: 'status', expected: '200' }] }))).toBe(true));
  });

  describe('hasActiveRules', () => {
    it('false when mode is none', () => expect(hasActiveRules(makeV({ mode: 'none', expectedFields: [{ jsonPath: '$.id', expectedValue: '1' }] }))).toBe(false));
    it('false when mode is selective but no fields', () => expect(hasActiveRules(makeV({ mode: 'selective' }))).toBe(false));
    it('true when mode is selective and has fields', () => expect(hasActiveRules(makeV({ mode: 'selective', expectedFields: [{ jsonPath: '$.id', expectedValue: '1' }] }))).toBe(true));
  });

  describe('hasValidationConfig', () => {
    it('false when nothing configured', () => expect(hasValidationConfig(makeV())).toBe(false));
    it('true when only fields', () => expect(hasValidationConfig(makeV({ expectedFields: [{ jsonPath: '$.id', expectedValue: '1' }] }))).toBe(true));
    it('true when only assertions', () => expect(hasValidationConfig(makeV({ assertions: [{ type: 'status', expected: '200' }] }))).toBe(true));
  });

  describe('hasSampleJson', () => {
    it('false when undefined', () => expect(hasSampleJson(makeV())).toBe(false));
    it('false when empty string', () => expect(hasSampleJson(makeV({ sampleJson: '' }))).toBe(false));
    it('false when whitespace only', () => expect(hasSampleJson(makeV({ sampleJson: '   ' }))).toBe(false));
    it('true when has content', () => expect(hasSampleJson(makeV({ sampleJson: '{"id":1}' }))).toBe(true));
  });
});
