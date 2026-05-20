import type { Scenario, ExpectedField, Assertion } from '../../../shared/types';

type Validation = Scenario['validation'];

export function getExpectedFields(v: Validation): ExpectedField[] {
  return v.expectedFields || [];
}

export function getAssertions(v: Validation): Assertion[] {
  return v.assertions || [];
}

export function hasExpectedFields(v: Validation): boolean {
  return getExpectedFields(v).length > 0;
}

export function hasAssertions(v: Validation): boolean {
  return getAssertions(v).length > 0;
}

/** mode !== 'none' AND has expectedFields configured. */
export function hasActiveRules(v: Validation): boolean {
  return v.mode !== 'none' && hasExpectedFields(v);
}

/** Has either active rules or assertions. */
export function hasValidationConfig(v: Validation): boolean {
  return hasExpectedFields(v) || hasAssertions(v);
}

export function hasSampleJson(v: Validation): boolean {
  return (v.sampleJson || '').trim().length > 0;
}
