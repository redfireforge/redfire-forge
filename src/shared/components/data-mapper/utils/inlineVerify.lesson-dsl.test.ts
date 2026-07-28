import { describe, it, expect } from 'vitest';
import { runInlineVerify } from './inlineVerify';
import { parseDsl, dslToModel } from './validationDsl';

const SAMPLE = {
  id: 1,
  name: 'Leanne Graham',
  username: 'Bret',
  email: 'Sincere@april.biz',
};

describe('runInlineVerify — $.path prefix (Validation Rules Verify)', () => {
  it('returns pass markers when DSL paths include the $. prefix', () => {
    const dsl = [
      '$.name equals "Leanne Graham"',
      '$.email contains "@"',
      '$.id greater_than 0',
    ].join('\n');
    const { rules, errors } = parseDsl(dsl);
    expect(errors).toEqual([]);
    expect(dslToModel(rules).fields).toHaveLength(3);

    const results = runInlineVerify(dsl, SAMPLE);
    expect(results).toHaveLength(3);
    expect(results.every((r) => r.passed)).toBe(true);
    expect(results.map((r) => r.lineNumber)).toEqual([1, 2, 3]);
  });

  it('still matches paths without the $. prefix', () => {
    const dsl = [
      'name equals "Leanne Graham"',
      'email contains "@"',
      'id greater_than 0',
    ].join('\n');
    const results = runInlineVerify(dsl, SAMPLE);
    expect(results).toHaveLength(3);
    expect(results.every((r) => r.passed)).toBe(true);
  });
});
