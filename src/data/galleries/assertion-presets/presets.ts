import type { Assertion } from '../../../shared/types';

// ─── 1. API Health Check (Easy) ──────────────────────────────────────────────

export function createApiHealthCheckAssertions(): Assertion[] {
  return [
    { type: 'status', expected: '2xx' },
    { type: 'arrayLength', jsonPath: '$', operator: '>=', value: 1 },
  ];
}

// ─── 2. Paginated List Validation (Easy) ─────────────────────────────────────

export function createPaginatedListAssertions(): Assertion[] {
  return [
    { type: 'arrayLength', jsonPath: '$.data', operator: '>=', value: 1 },
    { type: 'numeric', jsonPath: '$.page', operator: '=', value: 1 },
    { type: 'numeric', jsonPath: '$.total', operator: '>', value: 0 },
  ];
}

// ─── 3. Token Expiry Guard (Medium) ──────────────────────────────────────────

export function createTokenExpiryAssertions(): Assertion[] {
  return [
    { type: 'regex', jsonPath: '$.token', pattern: '^[A-Za-z0-9\\-_]+\\.[A-Za-z0-9\\-_]+\\.[A-Za-z0-9\\-_]+$' },
    { type: 'date', jsonPath: '$.expiresAt', operator: '>', reference: { kind: 'today', timezone: 'utc' } },
    { type: 'numeric', jsonPath: '$.expiresIn', operator: '>', value: 0 },
  ];
}

// ─── 4. E-commerce Price Guard (Medium) ──────────────────────────────────────

export function createPriceGuardAssertions(): Assertion[] {
  return [
    { type: 'numeric', jsonPath: '$.price', operator: '>', value: 0 },
    { type: 'numeric', jsonPath: '$.price', operator: '<', value: 10000 },
    { type: 'arrayLength', jsonPath: '$.variants', operator: '>=', value: 1 },
  ];
}

// ─── 5. Full API Contract (Advanced) ─────────────────────────────────────────

export function createApiContractAssertions(): Assertion[] {
  return [
    { type: 'status', expected: '200' },
    { type: 'numeric', jsonPath: '$.userId', operator: '>=', value: 1 },
    { type: 'numeric', jsonPath: '$.userId', operator: '<=', value: 10 },
    { type: 'numeric', jsonPath: '$.id', operator: '=', value: 1 },
    { type: 'regex', jsonPath: '$.title', pattern: '.{3,}' },
  ];
}
