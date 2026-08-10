/**
 * Ambient types for `oas-validator` (oas-kit). The package ships no types; we only
 * declare the small surface the deep-lint module uses. `validate` resolves the mutated
 * options object on success and rejects with an error whose `.options.warnings` holds
 * the collected lint findings when `options.lint` is set.
 */
declare module 'oas-validator' {
  interface ValidateOptions {
    [key: string]: unknown;
  }
  export function validate(openapi: unknown, options: ValidateOptions, callback?: unknown): Promise<unknown>;
  export function validateInner(openapi: unknown, options: ValidateOptions, callback?: unknown): Promise<unknown>;
  export function microValidate(openapi: unknown, options?: ValidateOptions): boolean;
  export function optionallyValidate(openapi: unknown, options: ValidateOptions): unknown;
}
