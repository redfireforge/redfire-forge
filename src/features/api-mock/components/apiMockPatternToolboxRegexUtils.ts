import type { ApiMockPredicateV1 } from '../../../shared/api-mock/contracts';

export function testRegex(pattern: string, value: string, caseSensitive: boolean): boolean | 'invalid' {
  try {
    const re = new RegExp(pattern, caseSensitive ? '' : 'i');
    return re.test(value);
  } catch {
    return 'invalid';
  }
}

/** Same kind/value the Regex tab Apply button writes (glob vs regex, path auto-anchor). */
export function regexTabMatcher(
  regexPattern: string,
  predicateOperator: ApiMockPredicateV1['operator'] | undefined,
  predicateMode: boolean,
): { kind: 'glob' | 'regex'; value: string } {
  const keepGlob = predicateOperator === 'glob';
  const value = keepGlob || predicateMode
    || regexPattern.startsWith('^') || regexPattern.startsWith('/')
    ? regexPattern
    : `^${regexPattern}$`;
  return { kind: keepGlob ? 'glob' : 'regex', value };
}

export function explainRegex(pattern: string): string {
  const lines: string[] = [];
  if (pattern.startsWith('^')) lines.push('^       start of value');
  if (/\[0-9\]\+/.test(pattern) || /\\d\+/.test(pattern)) lines.push('[0-9]+  one or more digits');
  if (pattern.endsWith('$')) lines.push('$       end of value');
  if (lines.length === 0) lines.push(pattern || '(empty pattern)');
  return lines.join('\n');
}
