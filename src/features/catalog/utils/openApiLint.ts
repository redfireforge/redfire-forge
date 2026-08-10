/**
 * Deep OpenAPI 3.0 lint (P4-D).
 *
 * Lazy-loads `oas-validator` (oas-kit family — the same dependency tree as the
 * swagger2openapi convert engine) to run full JSON-schema validation **plus** the
 * `oas-linter` best-practice rules on a converted document. This is **advisory only**
 * and never blocks Download/Save — the fast structural `validateOpenApi3` gate governs
 * that. oas-validator targets **OpenAPI 3.0.x**; 3.1/3.2 documents report
 * `supported: false`. Every failure (import, engine, runtime) degrades gracefully so a
 * browser-bundling problem can never break conversion.
 *
 * See docs/plan/future/catalog/convert-swagger-to-openapi-plan.md (§P4-D).
 */

export interface LintFinding {
  /** JSON pointer to the offending node (e.g. `#/paths/~1a/get`). */
  pointer?: string;
  /** Rule name (e.g. `operation-operationId`). */
  rule?: string;
  /** Human-readable description of the rule. */
  message: string;
}

export interface LintResult {
  /** oas-validator only supports OpenAPI 3.0.x — false for 3.1 / 3.2 (and unsupported). */
  supported: boolean;
  /** True when the deep validator ran and found zero issues. */
  clean: boolean;
  /** Advisory best-practice findings (rule violations). */
  findings: LintFinding[];
  /** A hard schema-level error, if validation failed for a non-lint reason. */
  schemaError?: string;
  /** True when the validator could not be loaded/run in this environment (graceful). */
  unavailable?: boolean;
}

type ValidateFn = (openapi: unknown, options: Record<string, unknown>) => Promise<unknown>;

/** Resolve the `validate` export across CJS/ESM interop shapes. Exported for testing. */
export function resolveValidate(mod: unknown): ValidateFn | undefined {
  if (!mod || typeof mod !== 'object') return undefined;
  try {
    const ns = mod as { validate?: unknown; default?: { validate?: unknown } };
    if (typeof ns.validate === 'function') return ns.validate as ValidateFn;
    const dflt = ns.default;
    if (dflt && typeof dflt === 'object' && typeof dflt.validate === 'function') {
      return dflt.validate as ValidateFn;
    }
  } catch {
    // Some module-namespace proxies throw on missing-export access — treat as absent.
  }
  return undefined;
}

/**
 * Map oas-validator's internal warning objects (`{ pointer, rule: { name, description } }`)
 * to our flat, deduplicated finding shape. Exported for direct unit testing.
 */
export function extractFindings(ex: unknown): LintFinding[] {
  const warnings = (ex as { options?: { warnings?: unknown } })?.options?.warnings;
  if (!Array.isArray(warnings)) return [];
  const out: LintFinding[] = [];
  const seen = new Set<string>();
  for (const w of warnings) {
    if (!w || typeof w !== 'object') continue;
    const rec = w as { pointer?: unknown; rule?: { name?: unknown; description?: unknown } };
    const pointer = typeof rec.pointer === 'string' ? rec.pointer : undefined;
    const rule = typeof rec.rule?.name === 'string' ? rec.rule.name : undefined;
    const message = typeof rec.rule?.description === 'string'
      ? rec.rule.description
      : (rule ?? 'Lint rule violation');
    const key = `${pointer}|${rule}|${message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ pointer, rule, message });
  }
  return out;
}

/** oas-validator's aggregate-throw message when the doc is schema-valid but lint-dirty. */
const LINT_VIOLATION_RE = /lint rule violation/i;

/**
 * Deep-lint an OpenAPI 3.0 document. **Never throws** — always resolves a LintResult.
 *
 * @param openapi         the converted OpenAPI document object
 * @param openapiVersion  its `openapi` version string (e.g. `'3.0.4'`)
 */
export async function lintOpenApi(
  openapi: Record<string, unknown>,
  openapiVersion: string,
): Promise<LintResult> {
  if (!/^3\.0/.test(openapiVersion)) {
    return { supported: false, clean: true, findings: [] };
  }

  let mod: unknown;
  try {
    mod = await import('oas-validator');
  } catch {
    return { supported: false, clean: true, findings: [], unavailable: true };
  }
  const validate = resolveValidate(mod);
  if (!validate) {
    return { supported: false, clean: true, findings: [], unavailable: true };
  }

  // resolve:false → no network/fs; omitting `source` avoids the url.pathToFileURL path.
  const options = { lint: true, resolve: false, laxurls: true, laxDefaults: true, lintLimit: 1000 };
  try {
    await validate(structuredClone(openapi), options);
    return { supported: true, clean: true, findings: [] };
  } catch (ex) {
    const findings = extractFindings(ex);
    const msg = ex instanceof Error ? ex.message : String(ex);
    const lintOnly = LINT_VIOLATION_RE.test(msg);
    return {
      supported: true,
      clean: false,
      findings,
      schemaError: lintOnly ? undefined : msg,
    };
  }
}
