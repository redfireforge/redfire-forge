import { describe, expect, it } from 'vitest';
import { joinClassNames } from './classNames';

describe('joinClassNames', () => {
  it('joins truthy class names with spaces', () => {
    expect(joinClassNames('a', 'b', 'c')).toBe('a b c');
  });

  it('skips falsy values', () => {
    expect(joinClassNames('a', undefined, false, null, 'b')).toBe('a b');
  });
});
