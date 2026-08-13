/**
 * JSON Schema, XML Schema (element-presence subset), multipart, and SHA-256 matchers.
 */
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { BoundedCache } from './perfBudgets';
import { sha256HexSync } from './sha256Sync';
import { evaluateXPath } from './xpathMatcher';

export interface MatcherContext {
  contentType?: string;
}

let ajv: Ajv | undefined;
const schemaCache = new BoundedCache<string, ((data: unknown) => boolean) | false>(128);

function getAjv(): Ajv {
  if (!ajv) {
    ajv = new Ajv({ allErrors: true, strict: false, validateSchema: false, addUsedSchema: false });
    addFormats(ajv);
  }
  return ajv;
}

function asBody(value: string | string[] | null): string | null {
  if (value == null) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function schemaKey(expected: unknown): string {
  return typeof expected === 'string' ? expected : JSON.stringify(expected ?? null);
}

function compileJsonSchema(expected: unknown): ((data: unknown) => boolean) | false {
  const key = schemaKey(expected);
  const cached = schemaCache.get(key);
  if (cached !== undefined) return cached;
  try {
    const schema = typeof expected === 'string' ? JSON.parse(expected) : expected;
    if (schema == null || typeof schema !== 'object' || Array.isArray(schema)) {
      schemaCache.set(key, false);
      return false;
    }
    // Clone so Ajv cannot mutate the persisted route expected-value object.
    const validate = getAjv().compile(JSON.parse(JSON.stringify(schema)) as object);
    const fn = (data: unknown) => Boolean(validate(data));
    schemaCache.set(key, fn);
    return fn;
  } catch {
    schemaCache.set(key, false);
    return false;
  }
}

export function isJsonSchemaCompileable(expected: unknown): boolean {
  return compileJsonSchema(expected) !== false;
}

export function matchJsonSchema(value: string | string[] | null, expected: unknown): boolean {
  const body = asBody(value);
  if (body == null) return false;
  let data: unknown;
  try { data = JSON.parse(body); } catch { return false; }
  const validate = compileJsonSchema(expected);
  if (!validate) return false;
  return validate(data);
}

const ELEMENT_NAME = /<(?:xs:|xsd:)?element\b[^>]*\bname=["']([^"']+)["']/gi;

function namesFromList(list: unknown): string[] | undefined {
  if (Array.isArray(list)) {
    const names = list.map(v => String(v)).filter(Boolean);
    // Empty `required: []` must not shadow `requiredElements` / `elements`.
    return names.length > 0 ? names : undefined;
  }
  if (typeof list === 'string' && list.trim()) {
    return list.split(/[\s,]+/).map(s => s.trim()).filter(Boolean);
  }
  return undefined;
}

function namesFromObject(rec: Record<string, unknown>): string[] | undefined {
  return namesFromList(rec.required) ?? namesFromList(rec.requiredElements) ?? namesFromList(rec.elements);
}

function requiredXmlNames(expected: unknown): string[] {
  if (Array.isArray(expected)) return expected.map(v => String(v)).filter(Boolean);
  if (expected && typeof expected === 'object') {
    return namesFromObject(expected as Record<string, unknown>) ?? [];
  }
  if (typeof expected !== 'string' || !expected.trim()) return [];
  const trimmed = expected.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) return parsed.map(v => String(v)).filter(Boolean);
      if (parsed && typeof parsed === 'object') {
        return namesFromObject(parsed as Record<string, unknown>) ?? [];
      }
    } catch { /* name list or XSD snippet */ }
  }
  const xmlish = expected.includes('<');
  if (xmlish) {
    const names: string[] = [];
    ELEMENT_NAME.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = ELEMENT_NAME.exec(expected))) names.push(match[1]);
    return names;
  }
  return expected.split(/[\s,]+/).map(s => s.trim()).filter(Boolean);
}

/**
 * Local name safe to interpolate into `local-name()='…'`. Prefixes are stripped
 * (`ns:Order` → `Order`). Anything that is not an NCName fails closed so a
 * crafted expected value cannot change the XPath shape.
 */
function xmlSafeLocalName(name: string): string | undefined {
  const trimmed = name.trim();
  if (!trimmed) return undefined;
  const local = trimmed.includes(':') ? trimmed.slice(trimmed.lastIndexOf(':') + 1) : trimmed;
  if (!/^[\p{L}_][\p{L}\p{N}._-]*$/u.test(local)) return undefined;
  return local;
}

/** Well-formed XML plus required element local-names extracted from a minimal XSD or name list. */
export function matchXmlSchema(value: string | string[] | null, expected: unknown): boolean {
  const body = asBody(value);
  if (body == null || !body.trim()) return false;
  const probe = evaluateXPath(body, '/*');
  if (!probe.ok) return false;
  const names = requiredXmlNames(expected);
  if (names.length === 0) return probe.matched;
  return names.every(name => {
    const local = xmlSafeLocalName(name);
    if (!local) return false;
    return evaluateXPath(body, `//*[local-name()='${local}']`).matched;
  });
}

export interface MultipartPart {
  name: string;
  filename?: string;
  contentType?: string;
  value: string;
}

function parseBoundary(contentType: string | undefined, body: string): string | undefined {
  const fromHeader = contentType?.match(/boundary=(?:"([^"]+)"|([^;,\s]+))/i);
  if (fromHeader) return (fromHeader[1] || fromHeader[2])?.trim();
  const fromBody = body.match(/^--([^\r\n]+)/);
  return fromBody?.[1];
}

function dispositionParam(disp: string, key: string): string | undefined {
  const double = disp.match(new RegExp(`\\b${key}="([^"]*)"`, 'i'))?.[1];
  if (double != null) return double;
  const single = disp.match(new RegExp(`\\b${key}='([^']*)'`, 'i'))?.[1];
  if (single != null) return single;
  const bare = disp.match(new RegExp(`\\b${key}=([^;\\s]+)`, 'i'))?.[1];
  return bare?.replace(/^['"]|['"]$/g, '');
}

export function parseMultipart(body: string, contentType?: string): MultipartPart[] {
  const boundary = parseBoundary(contentType, body);
  if (!boundary || !body.includes(boundary)) return [];
  const rawParts = body.split(`--${boundary}`).slice(1);
  const parts: MultipartPart[] = [];
  for (const raw of rawParts) {
    if (raw.trim() === '--' || raw.trim() === '') continue;
    const split = raw.replace(/^\r?\n/, '').split(/\r?\n\r?\n/);
    const headers = split[0] ?? '';
    const value = (split.slice(1).join('\n\n')).replace(/\r?\n$/, '');
    const disp = headers.match(/content-disposition:\s*form-data;([^\r\n]*)/i)?.[1] ?? '';
    const name = dispositionParam(disp, 'name');
    if (!name) continue;
    const filename = dispositionParam(disp, 'filename');
    const partType = headers.match(/content-type:\s*([^\r\n]+)/i)?.[1]?.trim();
    parts.push({ name, filename, contentType: partType, value });
  }
  return parts;
}

function fieldSpec(expected: unknown): { name: string; value?: string } | undefined {
  if (typeof expected === 'string' && expected) return { name: expected };
  if (Array.isArray(expected) && expected[0]) {
    const raw = expected[1];
    // Pair UI always writes [name, value]; blank value means "field/file present".
    const value = raw == null || raw === '' ? undefined : String(raw);
    return { name: String(expected[0]), value };
  }
  return undefined;
}

export function matchMultipartField(
  value: string | string[] | null,
  expected: unknown,
  ctx?: MatcherContext,
): boolean {
  const body = asBody(value);
  if (body == null) return false;
  const spec = fieldSpec(expected);
  if (!spec) return false;
  const part = parseMultipart(body, ctx?.contentType).find(p => p.name === spec.name);
  if (!part) return false;
  if (spec.value == null) return true;
  return part.value === spec.value;
}

export function matchMultipartFile(
  value: string | string[] | null,
  expected: unknown,
  ctx?: MatcherContext,
): boolean {
  const body = asBody(value);
  if (body == null) return false;
  const spec = fieldSpec(expected);
  if (!spec) return false;
  const part = parseMultipart(body, ctx?.contentType).find(p => p.name === spec.name && p.filename);
  if (!part) return false;
  if (spec.value == null) return true;
  return part.filename === spec.value;
}

export function matchBinarySha256(value: string | string[] | null, expected: unknown): boolean {
  const body = asBody(value);
  if (body == null || expected == null) return false;
  const want = String(expected).trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(want)) return false;
  return sha256HexSync(body) === want;
}
