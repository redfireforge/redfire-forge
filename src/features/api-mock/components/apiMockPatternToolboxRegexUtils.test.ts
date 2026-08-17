/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import {
  explainRegex,
  regexTabMatcher,
  sampleActualLabel,
  sampleCheckLabel,
  sampleExpectLabel,
  testRegex,
} from './apiMockPatternToolboxRegexUtils';

describe('apiMockPatternToolboxRegexUtils', () => {
  it('labels sample expectation, actual match, and check separately', () => {
    expect(sampleExpectLabel(true)).toBe('Expect match');
    expect(sampleExpectLabel(false)).toBe('Expect no match');
    expect(sampleActualLabel(true)).toBe('Matches');
    expect(sampleActualLabel(false)).toBe('Does not match');
    expect(sampleActualLabel('invalid')).toBe('Invalid');
    expect(sampleCheckLabel(true)).toBe('As expected');
    expect(sampleCheckLabel(false)).toBe('Not as expected');
  });

  it('tests a pattern and explains anchors', () => {
    expect(testRegex('^S-[0-9]{4}$', 'S-2048', true)).toBe(true);
    expect(testRegex('^S-[0-9]{4}$', 's-2048', true)).toBe(false);
    expect(testRegex('^S-[0-9]{4}$', 's-2048', false)).toBe(true);
    expect(testRegex('[', 'x', true)).toBe('invalid');
    expect(explainRegex('^S-[0-9]+$')).toContain('start of value');
  });

  it('keeps glob and already-anchored regex, and wraps a bare path fragment', () => {
    expect(regexTabMatcher('*.png', 'glob', false)).toEqual({ kind: 'glob', value: '*.png' });
    expect(regexTabMatcher('^S-[0-9]{4}$', 'regex', true)).toEqual({
      kind: 'regex', value: '^S-[0-9]{4}$',
    });
    expect(regexTabMatcher('42', undefined, false)).toEqual({ kind: 'regex', value: '^42$' });
  });
});
