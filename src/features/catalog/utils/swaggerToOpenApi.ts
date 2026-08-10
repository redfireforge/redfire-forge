import YAML from 'yaml';

/**
 * Swagger 2.0 → OpenAPI 3.x conversion dispatcher.
 *
 * Ships two lazy-loaded, user-selectable engines behind one identical result
 * shape, with a mandatory validation gate and validate-driven auto-fallback.
 * See docs/plan/future/catalog/convert-swagger-to-openapi-plan.md (§6.1).
 */

export type ConvertEngine = 'swagger2openapi' | 'scalar';
export type ConvertTarget = '3.0' | '3.1' | '3.2';

/** Detected source spec format (drives Convert vs Upgrade routing in the modal). */
export type SpecFormat = 'swagger2' | 'oas30' | 'oas31' | 'oas32' | 'unknown';

/** Internal shape every engine adapter returns; normalized by the dispatcher. */
export interface EngineOutput {
  openapi: Record<string, unknown>;
  openapiVersion: string;
  warnings: string[];
}

export interface ConvertOptions {
  /** Conversion engine. Default `'swagger2openapi'` (proven correct — plan §4.5). */
  engine?: ConvertEngine;
  /** Target OpenAPI major.minor. Default `'3.0'`. */
  target?: ConvertTarget;
  /** Auto-fall back to the other engine when the chosen one throws OR emits invalid output. Default `true`. */
  fallbackOnInvalid?: boolean;
}

export interface ConvertSwaggerResult {
  /** Pretty-printed OpenAPI 3 YAML (empty string only if conversion produced nothing). */
  yaml: string;
  /** Resolved `openapi` version string, e.g. `'3.0.4'` | `'3.1.1'`. */
  openapiVersion: string;
  /** Which engine actually produced the returned output. */
  engineUsed: ConvertEngine;
  /** True when the requested engine threw or was invalid and we auto-switched. */
  fellBack: boolean;
  /** Why the fallback fired, when it did. */
  fallbackReason?: 'threw' | 'invalid-output';
  /** Did the returned output pass the structural OpenAPI 3 validation gate? */
  valid: boolean;
  /** Validation errors (empty when `valid`). Callers must block download/save when non-empty. */
  validationErrors: string[];
  /** Normalized conversion warnings (advisory; distinct from `validationErrors`). */
  warnings: string[];
  /** The converted OpenAPI 3 object. */
  openapi: Record<string, unknown>;
}

/** Which targets each engine can emit — drives the modal's coupled dropdowns (P1). */
export const ENGINE_TARGETS: Record<ConvertEngine, ConvertTarget[]> = {
  swagger2openapi: ['3.0'],
  scalar: ['3.0', '3.1'],
};

// ─── Parsing helpers ─────────────────────────────────────

/** Robustly parse spec text as YAML, then JSON. Returns `undefined` on failure. */
function parseSpecText(rawText: string): unknown {
  try {
    return YAML.parse(rawText);
  } catch {
    try {
      return JSON.parse(rawText);
    } catch {
      return undefined;
    }
  }
}

/**
 * True when `rawText` is a Swagger 2.0 document (JSON or YAML). Does not rely on
 * `getSpecFormatLabel` (YAML-only). Exported for menu/action gating.
 */
export function isSwagger2RawSpec(rawText: string): boolean {
  const parsed = parseSpecText(rawText);
  if (!parsed || typeof parsed !== 'object') return false;
  const swagger = (parsed as Record<string, unknown>).swagger;
  return typeof swagger === 'string' && swagger.startsWith('2');
}

/**
 * Detect the source spec format (Swagger 2.0 vs OpenAPI 3.0/3.1/3.2). Used by the
 * Convert/Upgrade modal + the opener to decide which targets to offer and whether the
 * action applies at all (P4-A). Returns `'unknown'` for unparseable / non-spec input.
 */
export function detectSpecFormat(rawText: string): SpecFormat {
  const parsed = parseSpecText(rawText);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return 'unknown';
  const obj = parsed as Record<string, unknown>;
  const swagger = obj.swagger;
  if (typeof swagger === 'string' && swagger.startsWith('2')) return 'swagger2';
  const openapi = obj.openapi;
  if (typeof openapi === 'string') {
    if (openapi.startsWith('3.0')) return 'oas30';
    if (openapi.startsWith('3.1')) return 'oas31';
    if (openapi.startsWith('3.2')) return 'oas32';
    if (openapi.startsWith('3')) return 'oas30'; // unknown 3.x minor → treat as 3.0-ish
  }
  return 'unknown';
}

/**
 * Upgrade targets available for a given source format — **only forward** (never a
 * downgrade or a no-op). Swagger 2.0 converts to 3.0/3.1; a 3.0 doc upgrades to 3.1/3.2;
 * a 3.1 doc upgrades to 3.2; 3.2 (latest) and unknown have none.
 */
export function availableTargets(format: SpecFormat): ConvertTarget[] {
  switch (format) {
    case 'swagger2': return ['3.0', '3.1'];
    case 'oas30': return ['3.1', '3.2'];
    case 'oas31': return ['3.2'];
    default: return [];
  }
}

// ─── Validation gate ─────────────────────────────────────

const SWAGGER2_ROOT_KEYS = ['swagger', 'definitions', 'securityDefinitions', 'schemes', 'host', 'basePath'];
const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'trace'];
const COMPONENT_SECTIONS = ['schemas', 'responses', 'parameters', 'requestBodies', 'securitySchemes', 'headers', 'examples', 'links', 'callbacks'];

/** Collect every `$ref` string in the document (deduplicated). */
function collectRefs(node: unknown, depth: number, seen: Set<unknown>, out: Set<string>): void {
  if (depth > 60 || node === null || typeof node !== 'object' || seen.has(node)) return;
  seen.add(node);
  if (Array.isArray(node)) {
    for (const item of node) collectRefs(item, depth + 1, seen, out);
    return;
  }
  const record = node as Record<string, unknown>;
  if (typeof record.$ref === 'string') out.add(record.$ref);
  for (const value of Object.values(record)) collectRefs(value, depth + 1, seen, out);
}

/** Validate a `parameters` array: no `in: body`/`formData` and no requestBody `$ref`. */
function checkParameters(params: unknown, where: string, errors: string[]): void {
  if (params === undefined) return;
  if (!Array.isArray(params)) {
    errors.push(`${where}: 'parameters' must be an array`);
    return;
  }
  for (const p of params) {
    if (!p || typeof p !== 'object') continue;
    const param = p as Record<string, unknown>;
    if (param.in === 'body' || param.in === 'formData') {
      errors.push(`${where}: Swagger 2.0 '${String(param.in)}' parameter must be converted to requestBody`);
    }
    if (typeof param.$ref === 'string' && param.$ref.includes('/requestBodies/')) {
      errors.push(`${where}: requestBody $ref found inside parameters[] (invalid OpenAPI 3) — ${param.$ref}`);
    }
  }
}

/** Resolve a local `#/a/b/c` JSON pointer against `root`; `undefined` if missing. */
function resolveLocalRef(ref: string, root: Record<string, unknown>): unknown {
  const parts = ref.slice(2).split('/').map(p => p.replace(/~1/g, '/').replace(/~0/g, '~'));
  let current: unknown = root;
  for (const part of parts) {
    if (current === null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

/**
 * Heuristic check for a schema object. Used only for compatibility normalization
 * so we can safely collapse schema-level `examples` arrays back to `example`.
 */
function isSchemaLikeObject(obj: Record<string, unknown>): boolean {
  return (
    'type' in obj
    || 'properties' in obj
    || 'items' in obj
    || 'allOf' in obj
    || 'anyOf' in obj
    || 'oneOf' in obj
    || 'not' in obj
    || '$ref' in obj
    || 'enum' in obj
    || 'const' in obj
    || 'format' in obj
    || 'minimum' in obj
    || 'maximum' in obj
    || 'pattern' in obj
    || 'minLength' in obj
    || 'maxLength' in obj
    || 'minItems' in obj
    || 'maxItems' in obj
  );
}

/**
 * Keep schema examples compatible with older tooling by preferring `example`
 * over JSON Schema's `examples` array when both are present in schema objects.
 */
function collapseSchemaExamples(node: unknown, notes: string[], path: string[] = [], seen = new Set<unknown>(), counter = { count: 0 }): void {
  if (node === null || typeof node !== 'object' || seen.has(node)) return;
  seen.add(node);

  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i += 1) {
      collapseSchemaExamples(node[i], notes, [...path, String(i)], seen, counter);
    }
    return;
  }

  const obj = node as Record<string, unknown>;
  if (isSchemaLikeObject(obj) && Array.isArray(obj.examples) && obj.example === undefined) {
    if (obj.examples.length > 0) {
      obj.example = obj.examples[0];
      counter.count++;
    }
    delete obj.examples;
  }

  for (const [key, value] of Object.entries(obj)) {
    collapseSchemaExamples(value, notes, [...path, key], seen, counter);
  }

  if (path.length === 0 && counter.count > 0) {
    notes.push(`Collapsed schema examples[] to example in ${counter.count} location${counter.count === 1 ? '' : 's'}.`);
  }
}

/**
 * Structural OpenAPI 3 validation gate (browser/Node/Tauri-safe, dependency-free).
 * Catches the silent-invalid class the engine comparison exposed (plan §4.5):
 * leftover Swagger-2 keys, `in: body`/`formData` or requestBody `$ref`s stuck in
 * `parameters[]`, dangling `#/definitions/*` refs, and broken component refs.
 */
export function validateOpenApi3(openapi: unknown): string[] {
  const errors: string[] = [];

  if (!openapi || typeof openapi !== 'object' || Array.isArray(openapi)) {
    return ['Converted output is not an object'];
  }
  const doc = openapi as Record<string, unknown>;

  // openapi version
  if (typeof doc.openapi !== 'string' || !doc.openapi.startsWith('3.')) {
    errors.push("Missing or invalid 'openapi' version field (expected a 3.x string)");
  }
  // OpenAPI 3.0.x requires a non-empty `responses` on every operation; 3.1+ relaxed
  // this (webhook/callback-only operations may omit it), so only enforce it for 3.0.x.
  const requiresResponses = typeof doc.openapi === 'string' && doc.openapi.startsWith('3.0');

  // leftover Swagger 2.0 root keys
  for (const key of SWAGGER2_ROOT_KEYS) {
    if (key in doc) errors.push(`Leftover Swagger 2.0 field at document root: '${key}'`);
  }

  // info
  const info = doc.info;
  if (!info || typeof info !== 'object') {
    errors.push("Missing 'info' object");
  } else if (typeof (info as Record<string, unknown>).title !== 'string') {
    errors.push("Missing 'info.title'");
  }

  // paths + operations
  const paths = doc.paths;
  if (paths !== undefined && (typeof paths !== 'object' || paths === null || Array.isArray(paths))) {
    errors.push("'paths' must be an object");
  } else if (paths && typeof paths === 'object') {
    for (const [pathKey, pathItem] of Object.entries(paths as Record<string, unknown>)) {
      if (!pathItem || typeof pathItem !== 'object') continue;
      const item = pathItem as Record<string, unknown>;

      // path-item-level shared parameters (also a valid place for a leftover body)
      checkParameters(item.parameters, `${pathKey} (path item)`, errors);

      for (const method of HTTP_METHODS) {
        const op = item[method];
        if (!op || typeof op !== 'object') continue;
        const operation = op as Record<string, unknown>;
        const where = `${method.toUpperCase()} ${pathKey}`;

        // parameters must not hold body/formData or a requestBody $ref (the Scalar bug)
        checkParameters(operation.parameters, where, errors);

        // responses required and non-empty (OpenAPI 3.0.x only — see `requiresResponses`)
        if (requiresResponses) {
          const responses = operation.responses;
          if (!responses || typeof responses !== 'object' || Object.keys(responses as Record<string, unknown>).length === 0) {
            errors.push(`${where}: operation has no 'responses'`);
          }
        }
      }
    }
  }

  // ref integrity
  const refs = new Set<string>();
  collectRefs(doc, 0, new Set<unknown>(), refs);
  for (const ref of refs) {
    if (ref.startsWith('#/definitions/') || ref.startsWith('#/parameters/') || ref.startsWith('#/responses/')) {
      errors.push(`Dangling Swagger 2.0 $ref (not rewritten to components): ${ref}`);
      continue;
    }
    if (!ref.startsWith('#/')) continue; // external refs are advisory-only (warning, not invalid)
    if (ref.startsWith('#/components/')) {
      const section = ref.split('/')[2];
      if (section && !COMPONENT_SECTIONS.includes(section)) continue; // unknown but not our concern
      if (resolveLocalRef(ref, doc) === undefined) {
        errors.push(`Broken $ref (target not found): ${ref}`);
      }
    }
  }

  return errors;
}

// ─── Post-conversion repair ──────────────────────────────

/** Remove any `parameters[]` entries whose `$ref` points into `#/components/requestBodies/`
 *  and return the first one found (there should only ever be one per operation/path item).
 *  Mutates `holder.parameters` in place when a match is found — dropping the `parameters`
 *  key entirely when nothing legitimate is left (an empty `parameters: []` is harmless but
 *  unnecessary once the ref has moved to `requestBody`). */
function extractMisplacedRequestBodyRef(holder: Record<string, unknown>, where: string, notes: string[]): string | undefined {
  const params = holder.parameters;
  if (!Array.isArray(params)) return undefined;
  let found: string | undefined;
  const kept = params.filter((p) => {
    if (p && typeof p === 'object' && typeof (p as Record<string, unknown>).$ref === 'string') {
      const ref = (p as Record<string, unknown>).$ref as string;
      if (ref.includes('/requestBodies/')) {
        found = found ?? ref;
        notes.push(`Relocated requestBody $ref out of parameters[] at ${where}: ${ref}`);
        return false;
      }
    }
    return true;
  });
  if (found) {
    if (kept.length === 0) {
      delete holder.parameters;
    } else {
      holder.parameters = kept;
    }
  }
  return found;
}

/**
 * Best-effort structural repair applied to every engine's output before validation.
 * Fixes two specific, well-understood defects seen in real Swagger 2.0 → OpenAPI 3
 * conversions (plan §4.5 / "the Scalar bug"):
 *  - a leftover Swagger 2.0 `schemes` root key (redundant once `servers[].url` carries
 *    the scheme — safe to drop, never the sole source of scheme info in OpenAPI 3).
 *  - a `requestBody` `$ref` left inside an operation's (or path item's) `parameters[]`
 *    array instead of being moved to `requestBody` itself.
 * Purely corrective — never invents data, only relocates or drops what `validateOpenApi3`
 * already flags as leftover/misplaced. Safe to run unconditionally on any engine output.
 */
/** Canonical top-level key order for OpenAPI 3.x documents. */
const OAS3_KEY_ORDER = ['openapi', 'servers', 'info', 'tags', 'security', 'paths', 'components', 'webhooks'];

/**
 * Reorder top-level keys to the canonical order expected by most tooling.
 * Keys not in the canonical list are appended at the end in their original order.
 */
function reorderTopLevelKeys(doc: Record<string, unknown>): Record<string, unknown> {
  const ordered: Record<string, unknown> = {};
  for (const key of OAS3_KEY_ORDER) {
    if (key in doc) ordered[key] = doc[key];
  }
  for (const key of Object.keys(doc)) {
    if (!(key in ordered)) ordered[key] = doc[key];
  }
  return ordered;
}

/**
 * Derive a human-readable description from a tag name.
 * "VehiclePurchaseOffers" → "Vehicle purchase offers."
 * "Offers Static Metadata" → "Offers static metadata."
 */
function tagNameToDescription(name: string): string {
  const spaced = name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  const words = spaced.split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  const sentence = words
    .map((w, i) => (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w.toLowerCase()))
    .join(' ');
  return sentence.endsWith('.') ? sentence : `${sentence}.`;
}

/**
 * Collect unique tag names from all operations and create a top-level `tags` array
 * with auto-derived descriptions if one doesn't exist yet.
 */
function ensureTopLevelTags(doc: Record<string, unknown>): void {
  if (doc.tags && Array.isArray(doc.tags) && (doc.tags as unknown[]).length > 0) return;
  const paths = doc.paths;
  if (!paths || typeof paths !== 'object') return;
  const seen = new Set<string>();
  const tags: Array<{ name: string; description: string }> = [];
  for (const pathItem of Object.values(paths as Record<string, unknown>)) {
    if (!pathItem || typeof pathItem !== 'object') continue;
    for (const method of HTTP_METHODS) {
      const op = (pathItem as Record<string, unknown>)[method];
      if (!op || typeof op !== 'object') continue;
      const opTags = (op as Record<string, unknown>).tags;
      if (!Array.isArray(opTags)) continue;
      for (const t of opTags) {
        if (typeof t === 'string' && !seen.has(t)) {
          seen.add(t);
          tags.push({ name: t, description: tagNameToDescription(t) });
        }
      }
    }
  }
  if (tags.length > 0) doc.tags = tags;
}

/**
 * Walk schema trees and expand any `example` value that is a JSON-encoded string
 * into a parsed object/array, so YAML serialization produces readable structure
 * instead of a single-line JSON blob.
 */
function expandJsonStringExamples(node: unknown, seen = new Set<unknown>()): void {
  if (node === null || typeof node !== 'object' || seen.has(node)) return;
  seen.add(node);
  if (Array.isArray(node)) {
    for (const item of node) expandJsonStringExamples(item, seen);
    return;
  }
  const obj = node as Record<string, unknown>;
  if (typeof obj.example === 'string') {
    const raw = obj.example.trim();
    if ((raw.startsWith('{') && raw.endsWith('}')) || (raw.startsWith('[') && raw.endsWith(']'))) {
      try {
        obj.example = JSON.parse(raw);
      } catch { /* keep as string if not valid JSON */ }
    }
  }
  for (const value of Object.values(obj)) expandJsonStringExamples(value, seen);
}

export function normalizeConvertedOpenApi3(openapi: Record<string, unknown>): { doc: Record<string, unknown>; notes: string[] } {
  const doc = structuredClone(openapi) as Record<string, unknown>;
  const notes: string[] = [];

  if ('schemes' in doc) {
    delete doc.schemes;
    notes.push('Removed leftover Swagger 2.0 "schemes" field (implied by server URLs in OpenAPI 3).');
  }

  collapseSchemaExamples(doc, notes);
  expandJsonStringExamples(doc);
  ensureTopLevelTags(doc);

  const paths = doc.paths;
  if (paths && typeof paths === 'object' && !Array.isArray(paths)) {
    for (const [pathKey, pathItemRaw] of Object.entries(paths as Record<string, unknown>)) {
      if (!pathItemRaw || typeof pathItemRaw !== 'object') continue;
      const pathItem = pathItemRaw as Record<string, unknown>;

      // Shared path-item-level parameter: propagate into every operation missing requestBody.
      const sharedRef = extractMisplacedRequestBodyRef(pathItem, `${pathKey} (path item)`, notes);
      if (sharedRef) {
        for (const method of HTTP_METHODS) {
          const op = pathItem[method];
          if (!op || typeof op !== 'object') continue;
          const operation = op as Record<string, unknown>;
          if (!operation.requestBody) operation.requestBody = { $ref: sharedRef };
        }
      }

      for (const method of HTTP_METHODS) {
        const op = pathItem[method];
        if (!op || typeof op !== 'object') continue;
        const operation = op as Record<string, unknown>;
        const ref = extractMisplacedRequestBodyRef(operation, `${method.toUpperCase()} ${pathKey}`, notes);
        if (ref && !operation.requestBody) {
          operation.requestBody = { $ref: ref };
        }
      }
    }
  }

  return { doc: reorderTopLevelKeys(doc), notes };
}


// ─── Dispatcher ──────────────────────────────────────────

function otherEngine(engine: ConvertEngine): ConvertEngine {
  return engine === 'swagger2openapi' ? 'scalar' : 'swagger2openapi';
}

async function runEngine(engine: ConvertEngine, spec: Record<string, unknown>, target: ConvertTarget): Promise<EngineOutput> {
  if (engine === 'swagger2openapi') {
    const { runSwagger2OpenApi } = await import('./engines/swagger2openapiEngine');
    return runSwagger2OpenApi(spec, target);
  }
  const { runScalarUpgrade } = await import('./engines/scalarEngine');
  return runScalarUpgrade(spec, target);
}

/**
 * Convert Swagger 2.0 raw text to validated OpenAPI 3 YAML.
 *
 * @throws if the input cannot be parsed, is not Swagger 2.0, or the engine cannot
 *         target the requested version. Invalid *output* does NOT throw — it is
 *         returned with `valid: false` so callers can block download/save.
 */
export async function convertSwaggerToOpenApiYaml(
  rawText: string,
  opts: ConvertOptions = {},
): Promise<ConvertSwaggerResult> {
  const engine: ConvertEngine = opts.engine ?? 'swagger2openapi';
  const target: ConvertTarget = opts.target ?? '3.0';
  const fallbackOnInvalid = opts.fallbackOnInvalid ?? true;

  const parsed = parseSpecText(rawText);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Could not parse spec as YAML or JSON');
  }
  const spec = parsed as Record<string, unknown>;

  const swagger = spec.swagger;
  if (typeof swagger !== 'string' || !swagger.startsWith('2')) {
    throw new Error('Not a Swagger 2.0 spec — this entry is already OpenAPI 3 or an unsupported format');
  }

  if (!ENGINE_TARGETS[engine].includes(target)) {
    throw new Error(`Engine "${engine}" cannot target OpenAPI ${target}`);
  }

  // Primary attempt
  let engineUsed = engine;
  let output: EngineOutput | undefined;
  let errors: string[];
  let fellBack = false;
  let fallbackReason: 'threw' | 'invalid-output' | undefined;
  let primaryThrew: unknown;

  try {
    const rawOutput = await runEngine(engine, spec, target);
    const { doc, notes } = normalizeConvertedOpenApi3(rawOutput.openapi);
    output = { ...rawOutput, openapi: doc, warnings: [...rawOutput.warnings, ...notes] };
    errors = validateOpenApi3(output.openapi);
  } catch (err) {
    primaryThrew = err;
    errors = [err instanceof Error ? err.message : String(err)];
  }

  // Fallback: on throw OR invalid output, try the other engine if it supports the target.
  const needsFallback = (primaryThrew !== undefined) || (output !== undefined && errors.length > 0);
  const fallback = otherEngine(engine);
  if (needsFallback && fallbackOnInvalid && ENGINE_TARGETS[fallback].includes(target)) {
    try {
      const rawFbOutput = await runEngine(fallback, spec, target);
      const { doc, notes } = normalizeConvertedOpenApi3(rawFbOutput.openapi);
      const fbOutput: EngineOutput = { ...rawFbOutput, openapi: doc, warnings: [...rawFbOutput.warnings, ...notes] };
      const fbErrors = validateOpenApi3(fbOutput.openapi);
      // Adopt the fallback if it is valid, or if the primary threw outright.
      if (fbErrors.length === 0 || primaryThrew !== undefined) {
        engineUsed = fallback;
        output = fbOutput;
        errors = fbErrors;
        fellBack = true;
        fallbackReason = primaryThrew !== undefined ? 'threw' : 'invalid-output';
        // Primary crashed and the fallback is still invalid — surface *why* the
        // primary engine actually failed instead of only showing the fallback's
        // unrelated structural errors (otherwise the real root cause is silently lost).
        if (primaryThrew !== undefined && fbErrors.length > 0) {
          const detail = primaryThrew instanceof Error ? primaryThrew.message : String(primaryThrew);
          errors = [`Primary engine "${engine}" crashed: ${detail}`, ...fbErrors];
        }
      }
    } catch {
      // Fallback also failed — keep the primary result/errors below.
    }
  }

  if (!output) {
    // Both engines threw (or primary threw and fallback unavailable/threw).
    const detail = primaryThrew instanceof Error ? primaryThrew.message : String(primaryThrew);
    throw new Error(`Conversion failed: ${detail}`);
  }

  const yaml = YAML.stringify(output.openapi, { lineWidth: 0 });

  return {
    yaml,
    openapiVersion: output.openapiVersion,
    engineUsed,
    fellBack,
    fallbackReason,
    valid: errors.length === 0,
    validationErrors: errors,
    warnings: output.warnings,
    openapi: output.openapi,
  };
}

export interface UpgradeOptions {
  /** Target OpenAPI major.minor (must be an *upgrade* from the source). */
  target: ConvertTarget;
}

/**
 * Upgrade an existing OpenAPI 3.0 / 3.1 document to a higher minor (3.1 / 3.2) as
 * validated YAML (P4-A). Scalar-only (`@scalar/openapi-upgrader`) — the sole in-app
 * engine that emits 3.1/3.2 — so there is no engine fallback. Same result shape as
 * {@link convertSwaggerToOpenApiYaml}; invalid output is returned (not thrown) with
 * `valid: false` so callers can block download/save.
 *
 * @throws if the input cannot be parsed, is not OpenAPI 3.x, or the requested target is
 *         not a forward upgrade from the detected source.
 */
export async function upgradeOpenApi3Yaml(
  rawText: string,
  opts: UpgradeOptions,
): Promise<ConvertSwaggerResult> {
  const { target } = opts;

  const parsed = parseSpecText(rawText);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Could not parse spec as YAML or JSON');
  }
  const spec = parsed as Record<string, unknown>;

  const openapi = spec.openapi;
  if (typeof openapi !== 'string' || !openapi.startsWith('3')) {
    throw new Error('Not an OpenAPI 3.x spec — nothing to upgrade');
  }

  const format = detectSpecFormat(rawText);
  if (!availableTargets(format).includes(target)) {
    throw new Error(`Cannot upgrade ${format} to OpenAPI ${target}`);
  }

  let output: EngineOutput;
  try {
    const { runScalarUpgrade } = await import('./engines/scalarEngine');
    const rawOutput = await runScalarUpgrade(spec, target);
    const { doc, notes } = normalizeConvertedOpenApi3(rawOutput.openapi);
    output = { ...rawOutput, openapi: doc, warnings: [...rawOutput.warnings, ...notes] };
  } catch (err) {
    throw new Error(`Upgrade failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  const errors = validateOpenApi3(output.openapi);
  const yaml = YAML.stringify(output.openapi, { lineWidth: 0 });

  return {
    yaml,
    openapiVersion: output.openapiVersion,
    engineUsed: 'scalar',
    fellBack: false,
    valid: errors.length === 0,
    validationErrors: errors,
    warnings: output.warnings,
    openapi: output.openapi,
  };
}
