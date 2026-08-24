import { describe, it, expect } from 'vitest';
import {
  createApiHealthCheckAssertions,
  createPaginatedListAssertions,
  createTokenExpiryAssertions,
  createPriceGuardAssertions,
  createApiContractAssertions,
  createDataTypeGuardAssertions,
  createRequiredFieldsAssertions,
  createGraphQLNoErrorsAssertions,
  createGraphQLDataShapeAssertions,
} from './presets';
import { assertionPresetCatalog, ASSERTION_PRESET_CATEGORIES } from './index';
import type { Assertion } from '@shared/types';

// ─── Factory output helpers ──────────────────────────────────────────────────

function assertTypes(assertions: Assertion[]): string[] {
  return assertions.map(a => a.type);
}

// ─── Preset factory tests ────────────────────────────────────────────────────

describe('createApiHealthCheckAssertions', () => {
  it('returns 2 assertions', () => {
    expect(createApiHealthCheckAssertions()).toHaveLength(2);
  });

  it('includes a status assertion for 2xx', () => {
    const a = createApiHealthCheckAssertions();
    const status = a.find(x => x.type === 'status');
    expect(status).toBeDefined();
    expect(status!.type === 'status' && status!.expected).toBe('2xx');
  });

  it('includes an arrayLength assertion on $ root', () => {
    const a = createApiHealthCheckAssertions();
    const arr = a.find(x => x.type === 'arrayLength');
    expect(arr).toBeDefined();
    if (arr?.type === 'arrayLength') {
      expect(arr.jsonPath).toBe('$');
      expect(arr.operator).toBe('>=');
      expect(arr.value).toBe(1);
    }
  });

  it('returns a fresh array on each call', () => {
    const a = createApiHealthCheckAssertions();
    const b = createApiHealthCheckAssertions();
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});

describe('createPaginatedListAssertions', () => {
  it('returns 3 assertions', () => {
    expect(createPaginatedListAssertions()).toHaveLength(3);
  });

  it('contains arrayLength and numeric types', () => {
    const types = assertTypes(createPaginatedListAssertions());
    expect(types).toContain('arrayLength');
    expect(types).toContain('numeric');
  });

  it('checks $.data array length >= 1', () => {
    const a = createPaginatedListAssertions();
    const arr = a.find(x => x.type === 'arrayLength');
    if (arr?.type === 'arrayLength') {
      expect(arr.jsonPath).toBe('$.data');
      expect(arr.operator).toBe('>=');
      expect(arr.value).toBe(1);
    }
  });

  it('checks $.page = 1', () => {
    const a = createPaginatedListAssertions();
    const page = a.find(x => x.type === 'numeric' && x.jsonPath === '$.page');
    expect(page).toBeDefined();
    if (page?.type === 'numeric') {
      expect(page.operator).toBe('=');
      expect(page.value).toBe(1);
    }
  });

  it('checks $.total > 0', () => {
    const a = createPaginatedListAssertions();
    const total = a.find(x => x.type === 'numeric' && x.jsonPath === '$.total');
    expect(total).toBeDefined();
    if (total?.type === 'numeric') {
      expect(total.operator).toBe('>');
      expect(total.value).toBe(0);
    }
  });
});

describe('createTokenExpiryAssertions', () => {
  it('returns 3 assertions', () => {
    expect(createTokenExpiryAssertions()).toHaveLength(3);
  });

  it('contains regex, date, and numeric types', () => {
    const types = assertTypes(createTokenExpiryAssertions());
    expect(types).toContain('regex');
    expect(types).toContain('date');
    expect(types).toContain('numeric');
  });

  it('checks $.token matches JWT pattern', () => {
    const a = createTokenExpiryAssertions();
    const regex = a.find(x => x.type === 'regex');
    if (regex?.type === 'regex') {
      expect(regex.jsonPath).toBe('$.token');
      expect(regex.pattern).toContain('[A-Za-z0-9');
    }
  });

  it('checks $.expiresAt > today (UTC)', () => {
    const a = createTokenExpiryAssertions();
    const date = a.find(x => x.type === 'date');
    if (date?.type === 'date') {
      expect(date.jsonPath).toBe('$.expiresAt');
      expect(date.operator).toBe('>');
      expect(date.reference).toEqual({ kind: 'today', timezone: 'utc' });
    }
  });

  it('checks $.expiresIn > 0', () => {
    const a = createTokenExpiryAssertions();
    const num = a.find(x => x.type === 'numeric');
    if (num?.type === 'numeric') {
      expect(num.jsonPath).toBe('$.expiresIn');
      expect(num.operator).toBe('>');
      expect(num.value).toBe(0);
    }
  });
});

describe('createPriceGuardAssertions', () => {
  it('returns 3 assertions', () => {
    expect(createPriceGuardAssertions()).toHaveLength(3);
  });

  it('contains numeric and arrayLength types', () => {
    const types = assertTypes(createPriceGuardAssertions());
    expect(types).toContain('numeric');
    expect(types).toContain('arrayLength');
  });

  it('checks price > 0 and price < 10000', () => {
    const a = createPriceGuardAssertions();
    const prices = a.filter(x => x.type === 'numeric' && x.jsonPath === '$.price');
    expect(prices).toHaveLength(2);
    const ops = prices.map(p => p.type === 'numeric' ? p.operator : '');
    expect(ops).toContain('>');
    expect(ops).toContain('<');
  });

  it('checks $.variants array length >= 1', () => {
    const a = createPriceGuardAssertions();
    const arr = a.find(x => x.type === 'arrayLength');
    if (arr?.type === 'arrayLength') {
      expect(arr.jsonPath).toBe('$.variants');
      expect(arr.operator).toBe('>=');
      expect(arr.value).toBe(1);
    }
  });
});

describe('createApiContractAssertions', () => {
  it('returns 5 assertions', () => {
    expect(createApiContractAssertions()).toHaveLength(5);
  });

  it('contains status, numeric, and regex types', () => {
    const types = assertTypes(createApiContractAssertions());
    expect(types).toContain('status');
    expect(types).toContain('numeric');
    expect(types).toContain('regex');
  });

  it('checks status = 200', () => {
    const a = createApiContractAssertions();
    const status = a.find(x => x.type === 'status');
    expect(status).toBeDefined();
    if (status?.type === 'status') {
      expect(status.expected).toBe('200');
    }
  });

  it('checks $.userId range 1-10', () => {
    const a = createApiContractAssertions();
    const userIds = a.filter(x => x.type === 'numeric' && x.jsonPath === '$.userId');
    expect(userIds).toHaveLength(2);
    const ops = userIds.map(u => u.type === 'numeric' ? u.operator : '');
    expect(ops).toContain('>=');
    expect(ops).toContain('<=');
  });

  it('checks $.id = 1', () => {
    const a = createApiContractAssertions();
    const id = a.find(x => x.type === 'numeric' && x.jsonPath === '$.id');
    if (id?.type === 'numeric') {
      expect(id.operator).toBe('=');
      expect(id.value).toBe(1);
    }
  });

  it('checks $.title matches regex .{3,}', () => {
    const a = createApiContractAssertions();
    const regex = a.find(x => x.type === 'regex');
    if (regex?.type === 'regex') {
      expect(regex.jsonPath).toBe('$.title');
      expect(regex.pattern).toBe('.{3,}');
    }
  });
});

describe('createDataTypeGuardAssertions', () => {
  it('returns 4 assertions', () => {
    expect(createDataTypeGuardAssertions()).toHaveLength(4);
  });

  it('contains only typeCheck assertions', () => {
    const types = assertTypes(createDataTypeGuardAssertions());
    expect(new Set(types)).toEqual(new Set(['typeCheck']));
  });

  it('validates id, name, active, and tags field types', () => {
    const a = createDataTypeGuardAssertions();
    const expected = [
      { path: '$.id', type: 'number' },
      { path: '$.name', type: 'string' },
      { path: '$.active', type: 'boolean' },
      { path: '$.tags', type: 'array' },
    ] as const;

    for (const item of expected) {
      const assertion = a.find(x => x.type === 'typeCheck' && x.jsonPath === item.path);
      expect(assertion).toBeDefined();
      if (assertion?.type === 'typeCheck') {
        expect(assertion.expectedType).toBe(item.type);
      }
    }
  });
});

describe('createRequiredFieldsAssertions', () => {
  it('returns 4 assertions', () => {
    expect(createRequiredFieldsAssertions()).toHaveLength(4);
  });

  it('contains only existence assertions', () => {
    const types = assertTypes(createRequiredFieldsAssertions());
    expect(new Set(types)).toEqual(new Set(['existence']));
  });

  it('requires id/name/email and forbids deletedAt', () => {
    const a = createRequiredFieldsAssertions();

    const mustExist = ['$.id', '$.name', '$.email'];
    for (const path of mustExist) {
      const assertion = a.find(x => x.type === 'existence' && x.jsonPath === path);
      expect(assertion).toBeDefined();
      if (assertion?.type === 'existence') {
        expect(assertion.expectExists).toBe(true);
      }
    }

    const mustNotExist = a.find(x => x.type === 'existence' && x.jsonPath === '$.deletedAt');
    expect(mustNotExist).toBeDefined();
    if (mustNotExist?.type === 'existence') {
      expect(mustNotExist.expectExists).toBe(false);
    }
  });
});

// ─── Catalog & categories ────────────────────────────────────────────────────

describe('assertionPresetCatalog', () => {
  it('contains 9 presets', () => {
    expect(assertionPresetCatalog).toHaveLength(9);
  });

  it('each entry has unique id', () => {
    const ids = assertionPresetCatalog.map(e => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('each entry has matching assertionCount', () => {
    for (const entry of assertionPresetCatalog) {
      const assertions = entry.factory();
      expect(assertions).toHaveLength(entry.assertionCount);
    }
  });

  it('each entry has matching assertionTypes', () => {
    for (const entry of assertionPresetCatalog) {
      const assertions = entry.factory();
      const types = [...new Set(assertions.map(a => a.type))];
      for (const t of entry.assertionTypes) {
        expect(types).toContain(t);
      }
    }
  });

  it('each entry has required gallery fields', () => {
    for (const entry of assertionPresetCatalog) {
      expect(entry.id).toBeTruthy();
      expect(entry.name).toBeTruthy();
      expect(entry.description).toBeTruthy();
      expect(entry.icon).toBeTruthy();
      expect(['easy', 'medium', 'advanced']).toContain(entry.difficulty);
      expect(['api-validation', 'data-quality', 'security']).toContain(entry.category);
      expect(entry.tags.length).toBeGreaterThan(0);
    }
  });
});

describe('ASSERTION_PRESET_CATEGORIES', () => {
  it('has 4 categories including all', () => {
    expect(ASSERTION_PRESET_CATEGORIES).toHaveLength(4);
    expect(ASSERTION_PRESET_CATEGORIES[0].key).toBe('all');
  });

  it('covers all categories used by presets', () => {
    const catKeys = ASSERTION_PRESET_CATEGORIES.map(c => c.key).filter(k => k !== 'all');
    const usedCats = [...new Set(assertionPresetCatalog.map(e => e.category))];
    for (const cat of usedCats) {
      expect(catKeys).toContain(cat);
    }
  });
});

describe('createGraphQLNoErrorsAssertions', () => {
  it('returns 3 assertions', () => {
    expect(createGraphQLNoErrorsAssertions()).toHaveLength(3);
  });

  it('contains status, existence types', () => {
    const types = assertTypes(createGraphQLNoErrorsAssertions());
    expect(types).toContain('status');
    expect(types).toContain('existence');
  });

  it('asserts $.errors absent and $.data present', () => {
    const a = createGraphQLNoErrorsAssertions();
    const errorsAbsent = a.find(x => x.type === 'existence' && x.jsonPath === '$.errors');
    const dataPresent = a.find(x => x.type === 'existence' && x.jsonPath === '$.data');
    expect(errorsAbsent?.type === 'existence' && errorsAbsent.expectExists).toBe(false);
    expect(dataPresent?.type === 'existence' && dataPresent.expectExists).toBe(true);
  });

  it('returns a fresh array on each call', () => {
    expect(createGraphQLNoErrorsAssertions()).not.toBe(createGraphQLNoErrorsAssertions());
  });
});

describe('createGraphQLDataShapeAssertions', () => {
  it('returns 3 assertions', () => {
    expect(createGraphQLDataShapeAssertions()).toHaveLength(3);
  });

  it('contains existence, typeCheck, regex types', () => {
    const types = assertTypes(createGraphQLDataShapeAssertions());
    expect(types).toContain('existence');
    expect(types).toContain('typeCheck');
    expect(types).toContain('regex');
  });

  it('type-checks $.data.user.id as number', () => {
    const a = createGraphQLDataShapeAssertions();
    const tc = a.find(x => x.type === 'typeCheck');
    expect(tc?.type === 'typeCheck' && tc.jsonPath).toBe('$.data.user.id');
    expect(tc?.type === 'typeCheck' && tc.expectedType).toBe('number');
  });

  it('validates $.data.user.email with email regex', () => {
    const a = createGraphQLDataShapeAssertions();
    const rx = a.find(x => x.type === 'regex');
    expect(rx?.type === 'regex' && rx.jsonPath).toBe('$.data.user.email');
    expect(rx?.type === 'regex' && rx.pattern).toContain('@');
  });
});
