export interface ExpressionFunctionArg {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

export interface ExpressionFunction {
  name: string;
  category: string;
  signature: string;
  description: string;
  args: ExpressionFunctionArg[];
  returnType: string;
  examples: { input: string; output: string }[];
  evaluate: (...args: unknown[]) => unknown;
}

export const EXPRESSION_CATEGORIES = ['String', 'Math', 'Array', 'Object', 'Conditional', 'JSON', 'Date/Time', 'Encoding'] as const;
export type ExpressionCategory = (typeof EXPRESSION_CATEGORIES)[number];
