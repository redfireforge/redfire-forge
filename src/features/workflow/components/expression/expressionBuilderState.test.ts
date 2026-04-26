import { describe, expect, it } from 'vitest';
import type { ExpressionFunction } from '../../utils/expressionFunctions';
import {
  buildExpressionFromArgValues,
  buildExpressionTemplate,
  formatExpressionArgValue,
} from './expressionBuilderState';

const sampleFunction: ExpressionFunction = {
  name: '$concat',
  category: 'String',
  signature: '$concat(a, b) -> string',
  description: 'Join values',
  args: [
    { name: 'a', type: 'string', required: true, description: 'First value' },
    { name: 'b', type: 'string', required: true, description: 'Second value' },
  ],
  returnType: 'string',
  examples: [{ input: '$concat("a", "b")', output: 'ab' }],
  evaluate: (...args) => args.join(''),
};

describe('expressionBuilderState', () => {
  it('builds the initial template from function arg names', () => {
    expect(buildExpressionTemplate(sampleFunction)).toBe('$concat(a, b)');
  });

  it('keeps variable refs, booleans, and numbers unquoted', () => {
    expect(formatExpressionArgValue('{{token}}', 'value')).toBe('{{token}}');
    expect(formatExpressionArgValue('true', 'value')).toBe('true');
    expect(formatExpressionArgValue('42', 'value')).toBe('42');
  });

  it('quotes plain strings and falls back to arg names when blank', () => {
    expect(formatExpressionArgValue('hello', 'value')).toBe('"hello"');
    expect(formatExpressionArgValue('', 'value')).toBe('value');
  });

  it('builds an expression from argument values', () => {
    expect(buildExpressionFromArgValues(sampleFunction, ['hello', '{{userId}}'])).toBe(
      '$concat("hello", {{userId}})',
    );
  });
});