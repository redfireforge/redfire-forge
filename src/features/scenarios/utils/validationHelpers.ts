import type { Scenario, ExpectedField, Assertion, FailureDetail } from '../../../shared/types';

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

/**
 * Guard-check for handleValidateResponse scope validation.
 * Returns FailureDetail[] if any precondition is unmet, or null if all checks pass.
 * Used by both useTestFetch and useWorkflowValidationFetch to avoid duplicating
 * the early-exit scope checks.
 */
export function checkValidationScopeGuards(
  url: string,
  v: Validation,
  scope: 'assertions' | 'rules' | 'all',
): FailureDetail[] | null {
  if (!url.trim()) {
    return [{ path: '(url)', expected: 'a URL', actual: 'empty' }];
  }
  const rulesConfigured = hasActiveRules(v);
  const assertionsConfigured = hasAssertions(v);

  if (scope === 'rules' && !rulesConfigured) {
    return [{ path: '(config)', expected: 'validation rules', actual: 'no rules configured' }];
  }
  if (scope === 'assertions' && !assertionsConfigured) {
    return [{ path: '(config)', expected: 'assertions', actual: 'no assertions configured' }];
  }
  if (scope === 'all' && !rulesConfigured && !assertionsConfigured) {
    return [{ path: '(config)', expected: 'validation rules or assertions', actual: 'none configured' }];
  }
  return null;
}
