import type { ExpressionFunction } from '../../utils/expressionFunctions';

export function buildExpressionTemplate(fn: ExpressionFunction): string {
  return `${fn.name}(${fn.args.map((arg) => arg.name).join(', ')})`;
}

export function formatExpressionArgValue(value: string, fallbackName: string): string {
  if (!value) return fallbackName;
  if (value.startsWith('{{') || !isNaN(Number(value)) || value === 'true' || value === 'false') {
    return value;
  }
  return `"${value}"`;
}

export function buildExpressionFromArgValues(fn: ExpressionFunction, argValues: string[]): string {
  const args = fn.args.map((arg, index) => formatExpressionArgValue(argValues[index] ?? '', arg.name));
  return `${fn.name}(${args.join(', ')})`;
}