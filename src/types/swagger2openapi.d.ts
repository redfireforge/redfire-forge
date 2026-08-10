/**
 * Minimal ambient types for `swagger2openapi` (Mermade / oas-kit).
 *
 * The published package (v7.0.8) ships no type declarations and there is no
 * `@types/swagger2openapi`. We only use `convertObj` in object/offline mode,
 * so this declares just that surface. See
 * docs/plan/future/catalog/convert-swagger-to-openapi-plan.md (§6.1).
 */
declare module 'swagger2openapi' {
  export interface ConvertOptions {
    /** Attempt to patch/repair small source errors instead of throwing. */
    patch?: boolean;
    /** Treat non-fatal issues as `x-s2o-warning` extensions instead of throwing. */
    warnOnly?: boolean;
    /** Target OpenAPI 3.0.x patch version, e.g. '3.0.0' | '3.0.3' | '3.0.4'. */
    targetVersion?: string;
    /** Resolve external `$ref`s over the network / filesystem. Keep false for offline use. */
    resolve?: boolean;
    /** Fetch source over HTTP (unused — we pass an object). */
    source?: string;
    /** Collected warnings when `warnOnly` is set. */
    warnings?: unknown[];
    [key: string]: unknown;
  }

  /**
   * `convertObj` resolves the (mutated) options object with the converted
   * document attached as `openapi` and any collected `warnings` at the top level.
   */
  export interface ConvertResult extends ConvertOptions {
    /** The converted OpenAPI 3 document. */
    openapi: Record<string, unknown>;
    /** Collected warnings when `warnOnly` is set. */
    warnings?: unknown[];
  }

  /** Convert an in-memory Swagger 2.0 object to OpenAPI 3. Resolves a promise when no callback is passed. */
  export function convertObj(
    schema: Record<string, unknown>,
    options: ConvertOptions,
  ): Promise<ConvertResult>;

  export class S2OError extends Error {}
}
