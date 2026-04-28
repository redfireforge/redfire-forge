export type { ExpressionFunction, ExpressionFunctionArg } from './types';
export { EXPRESSION_CATEGORIES } from './types';
export type { ExpressionCategory } from './types';

import { stringFunctions } from './stringFunctions';
import { mathFunctions } from './mathFunctions';
import { conditionalFunctions } from './conditionalFunctions';
import { jsonFunctions } from './jsonFunctions';
import { dateTimeFunctions } from './dateTimeFunctions';
import { encodingFunctions } from './encodingFunctions';
import type { ExpressionFunction } from './types';
import { EXPRESSION_CATEGORIES } from './types';

export const EXPRESSION_FUNCTIONS: ExpressionFunction[] = [
  ...stringFunctions,
  ...mathFunctions,
  ...conditionalFunctions,
  ...jsonFunctions,
  ...dateTimeFunctions,
  ...encodingFunctions,
];

export const EXPRESSION_FUNCTION_MAP = new Map<string, ExpressionFunction>(
  EXPRESSION_FUNCTIONS.map((f) => [f.name, f]),
);

export function groupedExpressionFunctions(): { category: string; functions: ExpressionFunction[] }[] {
  return EXPRESSION_CATEGORIES.map((cat) => ({
    category: cat,
    functions: EXPRESSION_FUNCTIONS.filter((f) => f.category === cat),
  })).filter((g) => g.functions.length > 0);
}
