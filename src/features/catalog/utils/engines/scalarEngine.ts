import type { ConvertTarget, EngineOutput } from '../swaggerToOpenApi';

/**
 * Derive review warnings the pure Scalar upgrader does not emit itself:
 *  - unresolved external `$ref`s (anything not starting with `#/`)
 *  - operations dropped because they use a method the Catalog does not model
 * (Kept intentionally small — the validation gate in the dispatcher is the real
 * correctness check; these are advisory.)
 */
export function deriveWarnings(openapi: Record<string, unknown>): string[] {
  const out: string[] = [];
  const seen = new Set<unknown>();

  const walk = (node: unknown, depth: number): void => {
    if (depth > 40 || node === null || typeof node !== 'object' || seen.has(node)) return;
    seen.add(node);
    if (Array.isArray(node)) {
      for (const item of node) walk(item, depth + 1);
      return;
    }
    const record = node as Record<string, unknown>;
    if (typeof record.$ref === 'string' && !record.$ref.startsWith('#/')) {
      out.push(`External $ref not resolved: ${record.$ref}`);
    }
    for (const value of Object.values(record)) walk(value, depth + 1);
  };
  walk(openapi, 0);

  return Array.from(new Set(out));
}

/** Default `openapi` version string per target when Scalar omits it from output.
 *  `3.0.3` is the latest *real* published OpenAPI 3.0.x release (there is no
 *  official 3.0.4) — kept in sync with `S2O_TARGET_VERSION` in swagger2openapiEngine. */
const DEFAULT_VERSION: Record<ConvertTarget, string> = {
  '3.0': '3.0.3',
  '3.1': '3.1.1',
  '3.2': '3.2.0',
};

/**
 * Scalar (`@scalar/openapi-upgrader`) engine adapter — the only in-app path to 3.1/3.2.
 * Handles both Swagger 2.0 → 3.0 conversion and OpenAPI 3.0/3.1 → 3.1/3.2 upgrades.
 * Lazy-loaded; sub-path import keeps the 2.0→3.0 chunk small.
 */
export async function runScalarUpgrade(
  spec: Record<string, unknown>,
  target: ConvertTarget,
): Promise<EngineOutput> {
  const source = structuredClone(spec);
  let openapi: Record<string, unknown>;

  if (target === '3.0') {
    // 2.0 → 3.0 only. `upgradeFromTwoToThree` sub-path keeps this chunk minimal.
    const { upgradeFromTwoToThree } = await import('@scalar/openapi-upgrader/2.0-to-3.0');
    openapi = upgradeFromTwoToThree(source) as Record<string, unknown>;
    // @scalar/openapi-upgrader unconditionally hardcodes `openapi: '3.0.4'` on this
    // path — there is no official OpenAPI 3.0.4 release (the spec stopped at 3.0.3).
    // Always stamp the real, canonical 3.0.x version instead of trusting it.
    openapi.openapi = DEFAULT_VERSION['3.0'];
  } else {
    // `upgrade(doc, '3.1' | '3.2')` accepts 2.0 / 3.0 / 3.1 sources and chains internally.
    // Branch on the literal so the overloaded signature resolves. (Correctly stamps
    // real 3.1.1 / 3.2.0 versions — no known version bug on this path.)
    const { upgrade } = await import('@scalar/openapi-upgrader');
    openapi = (target === '3.1'
      ? upgrade(source, '3.1')
      : upgrade(source, '3.2')) as unknown as Record<string, unknown>;
  }

  const openapiVersion = typeof openapi.openapi === 'string'
    ? openapi.openapi
    : DEFAULT_VERSION[target];

  return { openapi, openapiVersion, warnings: deriveWarnings(openapi) };
}
