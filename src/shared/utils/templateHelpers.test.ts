import { describe, it, expect } from 'vitest';
import { isTemplateToken, decodeTemplateBraces } from './templateHelpers';

describe('isTemplateToken', () => {
  it('returns true for simple {{var}}', () => {
    expect(isTemplateToken('{{name}}')).toBe(true);
  });

  it('returns true with leading/trailing whitespace', () => {
    expect(isTemplateToken('  {{name}}  ')).toBe(true);
  });

  it('returns true for underscored names', () => {
    expect(isTemplateToken('{{my_var_1}}')).toBe(true);
  });

  it('returns false for empty string', () => {
    expect(isTemplateToken('')).toBe(false);
  });

  it('returns false for plain text', () => {
    expect(isTemplateToken('hello')).toBe(false);
  });

  it('returns false for partial template', () => {
    expect(isTemplateToken('prefix{{name}}')).toBe(false);
    expect(isTemplateToken('{{name}}suffix')).toBe(false);
  });

  it('returns false for multiple templates', () => {
    expect(isTemplateToken('{{a}}{{b}}')).toBe(false);
  });

  it('returns false for nested braces', () => {
    expect(isTemplateToken('{{a{b}}}')).toBe(false);
  });

  it('returns true for dotted path', () => {
    expect(isTemplateToken('{{user.name}}')).toBe(true);
  });
});

describe('decodeTemplateBraces', () => {
  it('decodes %7B and %7D to curly braces', () => {
    expect(decodeTemplateBraces('%7B%7Bname%7D%7D')).toBe('{{name}}');
  });

  it('handles mixed case encoding', () => {
    expect(decodeTemplateBraces('%7b%7Bname%7d%7D')).toBe('{{name}}');
  });

  it('returns plain text unchanged', () => {
    expect(decodeTemplateBraces('hello world')).toBe('hello world');
  });

  it('handles already-decoded braces', () => {
    expect(decodeTemplateBraces('{{name}}')).toBe('{{name}}');
  });

  it('decodes partial encoding', () => {
    expect(decodeTemplateBraces('https://api.com/%7B%7Bid%7D%7D?q=%7B%7Bq%7D%7D')).toBe('https://api.com/{{id}}?q={{q}}');
  });

  it('handles empty string', () => {
    expect(decodeTemplateBraces('')).toBe('');
  });
});
