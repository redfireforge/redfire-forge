import { describe, expect, it } from 'vitest';
import { MOCK_TEMPLATE_COMPLETIONS, mockTemplateCompletionsForPrefix } from './apiMockTemplateCompletions';

describe('apiMockTemplateCompletions', () => {
  it('returns the full catalog for a blank prefix and filters faker helpers', () => {
    expect(mockTemplateCompletionsForPrefix('').length).toBe(MOCK_TEMPLATE_COMPLETIONS.length);
    expect(mockTemplateCompletionsForPrefix('   ').length).toBe(MOCK_TEMPLATE_COMPLETIONS.length);
    const faker = mockTemplateCompletionsForPrefix('faker person');
    expect(faker.some(item => item.label.includes('person.firstName'))).toBe(true);
    expect(mockTemplateCompletionsForPrefix('uuid').some(item => item.label === 'uuid')).toBe(true);
    expect(mockTemplateCompletionsForPrefix('}').length).toBe(0);
    expect(mockTemplateCompletionsForPrefix('}}')).toEqual([]);
    expect(mockTemplateCompletionsForPrefix('no-such-helper')).toEqual([]);
  });
});
