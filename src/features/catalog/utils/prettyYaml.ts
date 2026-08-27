/**
 * Pretty-YAML normalization (P4 follow-up).
 *
 * Lazy-loads `openapi-format` (thim81) to sort a converted OpenAPI document into a
 * canonical, diff-friendly key order (openapi → info → servers → … → components)
 * with alphabetically ordered paths/components, then re-emits YAML via the same
 * `yaml` library the converter uses. This is a **display/output nicety** layered on
 * top of the conversion result — it never changes semantics and never gates
 * Download/Save. Every failure (import, sort, bundling) degrades gracefully back to
 * the un-sorted YAML so a browser-bundling problem can never break conversion.
 */
import YAML from 'yaml';

export interface PrettifyResult {
  /** The YAML to display / download / save. */
  yaml: string;
  /** True when openapi-format sorting was applied; false when it fell back. */
  applied: boolean;
}

type SortFn = (
  oaObj: Record<string, unknown>,
  options: Record<string, unknown>,
) => Promise<{ data: Record<string, unknown> }>;

/** Resolve the `openapiSort` export across CJS/ESM interop shapes. Exported for testing. */
export function resolveSort(mod: unknown): SortFn | undefined {
  if (!mod || typeof mod !== 'object') return undefined;
  try {
    const ns = mod as { openapiSort?: unknown; default?: { openapiSort?: unknown } };
    if (typeof ns.openapiSort === 'function') return ns.openapiSort as SortFn;
    const dflt = ns.default;
    if (dflt && typeof dflt === 'object' && typeof dflt.openapiSort === 'function') {
      return dflt.openapiSort as SortFn;
    }
  } catch {
    // Some module-namespace proxies throw on missing-export access — treat as absent.
  }
  return undefined;
}

/**
 * Return a canonically-sorted YAML rendering of an OpenAPI document. **Never throws.**
 *
 * @param openapi   the converted OpenAPI document object
 * @param lineWidth `yaml` stringify line width (0 = no wrapping, matches the converter)
 */
export async function prettifyOpenApiYaml(
  openapi: Record<string, unknown>,
  lineWidth = 0,
): Promise<PrettifyResult> {
  const fallback = (): string => YAML.stringify(openapi, { lineWidth });
  try {
    const mod = await import('openapi-format');
    const openapiSort = resolveSort(mod);
    if (!openapiSort) return { yaml: fallback(), applied: false };
    // Clone so the sorter can never mutate the caller's document.
    const { data } = await openapiSort(structuredClone(openapi), { sort: true });
    if (!data || typeof data !== 'object') return { yaml: fallback(), applied: false };
    return { yaml: YAML.stringify(data, { lineWidth }), applied: true };
  } catch {
    return { yaml: fallback(), applied: false };
  }
}
