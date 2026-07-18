import type { ConvertTarget, EngineOutput } from '../swaggerToOpenApi';
import type { convertObj as ConvertObjFn } from 'swagger2openapi';

/** swagger2openapi target string per requested OpenAPI 3.0 target.
 *  Must be a real, published OpenAPI 3.0.x release — the spec only ever
 *  shipped 3.0.0 / 3.0.1 / 3.0.2 / 3.0.3 (no 3.0.4 exists), so 3.0.3 (the
 *  latest official 3.0.x patch) is used here. */
const S2O_TARGET_VERSION = '3.0.3';

/**
 * Collect human-readable warnings from a swagger2openapi run:
 *  - `warnings` populated on the resolved options object when `warnOnly` is set
 *  - any `x-s2o-warning` extension strings embedded in the converted document
 * Exported for direct unit testing.
 */
export function collectWarnings(openapi: Record<string, unknown>, optionWarnings: unknown[]): string[] {
  const out: string[] = [];

  for (const w of optionWarnings) {
    if (typeof w === 'string') out.push(w);
    else if (w && typeof w === 'object' && typeof (w as { message?: unknown }).message === 'string') {
      out.push((w as { message: string }).message);
    }
  }

  const seen = new Set<unknown>();
  const walk = (node: unknown, depth: number): void => {
    if (depth > 40 || node === null || typeof node !== 'object' || seen.has(node)) return;
    seen.add(node);
    if (Array.isArray(node)) {
      for (const item of node) walk(item, depth + 1);
      return;
    }
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (key === 'x-s2o-warning' && typeof value === 'string') out.push(value);
      else walk(value, depth + 1);
    }
  };
  walk(openapi, 0);

  return Array.from(new Set(out));
}

/**
 * Resolve the `convertObj` function across CJS/ESM interop shapes (some bundlers
 * nest named exports under `.default`). Exported for direct unit testing.
 * @throws if no `convertObj` function can be found.
 */
export function resolveConvertObj(mod: unknown): typeof ConvertObjFn {
  const namespace = mod as { convertObj?: unknown; default?: { convertObj?: unknown } };
  const fn = typeof namespace.convertObj === 'function'
    ? namespace.convertObj
    : namespace.default?.convertObj;
  if (typeof fn !== 'function') {
    throw new Error('swagger2openapi: convertObj export not found');
  }
  return fn as typeof ConvertObjFn;
}

/**
 * swagger2openapi engine adapter (DEFAULT). Converts Swagger 2.0 → OpenAPI 3.0.x.
 * Lazy-loaded so the ~200KB oas-kit chunk never enters the cold-start bundle.
 */
export async function runSwagger2OpenApi(
  spec: Record<string, unknown>,
  target: ConvertTarget,
): Promise<EngineOutput> {
  if (target !== '3.0') {
    throw new Error('swagger2openapi can only target OpenAPI 3.0.x');
  }

  const mod = await import('swagger2openapi');
  const convertObj = resolveConvertObj(mod);

  // Clone so the converter (which mutates its input) never corrupts the source
  // shared with a fallback engine run.
  const source = structuredClone(spec);
  const result = await convertObj(source, {
    patch: true,
    warnOnly: true,
    targetVersion: S2O_TARGET_VERSION,
    resolve: false,
  });

  const openapi = result.openapi;
  const openapiVersion = typeof openapi.openapi === 'string' ? openapi.openapi : S2O_TARGET_VERSION;
  // `convertObj` resolves the mutated options object; collected warnings sit at
  // `result.warnings` (top level), and `x-s2o-warning` extensions live in the doc.
  const warnings = collectWarnings(openapi, Array.isArray(result.warnings) ? result.warnings : []);

  return { openapi, openapiVersion, warnings };
}
