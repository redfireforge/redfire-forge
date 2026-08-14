import { describe, expect, it } from 'vitest';
import { FAKER_HELPER_PATHS, renderFakerHelper } from './templateFaker';

describe('templateFaker', () => {
  it('renders every curated path and rejects unknown keys', () => {
    for (const path of FAKER_HELPER_PATHS) {
      expect(renderFakerHelper(path, 3).length).toBeGreaterThan(0);
    }
    expect(renderFakerHelper('person.firstName', 0)).toBe('Ada');
    expect(renderFakerHelper('faker.person.lastName', 0)).toBeTruthy();
    expect(renderFakerHelper('nope.missing', 1)).toBe('');
    expect(renderFakerHelper('datatype.boolean', 0)).toBe('true');
    expect(renderFakerHelper('datatype.boolean', 1)).toBe('false');
    expect(renderFakerHelper('string.uuid', 9)).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });
});
