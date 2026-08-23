/**
 * gRPC request body composer — JSON ↔ form parity (Phase 1F).
 */
import type { GrpcFieldSchema, GrpcMessageSchema } from '@shared/grpc/contracts';
import {
  groupMessageFields,
  isValidWideIntegralString,
  isWideIntegralFieldType,
  resolveActiveOneofMember,
  syncBodyWithSchema,
} from './grpcProtoFormValues';

export function serializeGrpcBodyJson(body: Record<string, unknown>): string {
  return JSON.stringify(body, null, 2);
}

export type GrpcBodyJsonParseResult =
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; error: string };

export interface ApplyJsonTextToSchemaOptions {
  /** When false, allows numeric literals for already-synced bodies (form → send path). Default true. */
  enforceWideIntegralStringLiterals?: boolean;
  messageTypes?: GrpcMessageSchema[];
}

export function buildGrpcMessageSchemaIndex(
  messageTypes: GrpcMessageSchema[] | undefined,
): Map<string, GrpcMessageSchema> | undefined {
  if (!messageTypes?.length) return undefined;
  const index = new Map<string, GrpcMessageSchema>();
  for (const schema of messageTypes) {
    index.set(schema.typeName, schema);
    const shortName = schema.typeName.split('.').pop();
    if (shortName && !index.has(shortName)) {
      index.set(shortName, schema);
    }
  }
  return index;
}

function resolveNestedMessageSchema(
  field: GrpcFieldSchema,
  messageIndex: Map<string, GrpcMessageSchema> | undefined,
): GrpcMessageSchema | undefined {
  if (!messageIndex || field.type !== 'message' || !field.messageTypeName) {
    return undefined;
  }
  return messageIndex.get(field.messageTypeName)
    ?? messageIndex.get(field.messageTypeName.split('.').pop() ?? '');
}

export { resolveNestedMessageSchema };

export function parseGrpcBodyJson(text: string): GrpcBodyJsonParseResult {
  const trimmed = text.trim();
  if (!trimmed) {
    return { ok: true, body: {} };
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ok: false, error: 'Request body must be a JSON object' };
    }
    return { ok: true, body: parsed as Record<string, unknown> };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid JSON';
    return { ok: false, error: message };
  }
}

export interface WideIntegralJsonValidationOptions {
  /** When false, allows safe integer JSON literals (form → send path). Unsafe integers always rejected. */
  strictStringLiterals?: boolean;
}

function wideIntegralCheckType(type: GrpcFieldSchema['type']): GrpcFieldSchema['type'] | null {
  if (type === 'google.protobuf.Int64Value') return 'int64';
  if (isWideIntegralFieldType(type)) return type;
  return null;
}

function scalarWideIntegralJsonViolation(
  raw: unknown,
  type: GrpcFieldSchema['type'],
  path: string,
  strictStringLiterals: boolean,
): string | null {
  if (type === 'google.protobuf.Int64Value') {
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      return scalarWideIntegralJsonViolation(
        (raw as Record<string, unknown>).value,
        'int64',
        `${path}.value`,
        strictStringLiterals,
      );
    }
    return null;
  }

  const wideType = wideIntegralCheckType(type);
  if (!wideType) {
    return null;
  }

  if (typeof raw === 'number') {
    if (!Number.isSafeInteger(raw)) {
      return `Field "${path}" exceeds JavaScript safe integer range — use a quoted decimal string (e.g. "${path.split('.').pop()}": "9007199254740993")`;
    }
    if (strictStringLiterals) {
      return `Field "${path}" must be a quoted decimal string in JSON to preserve 64-bit precision`;
    }
    return null;
  }

  if (typeof raw === 'string' && raw.trim() !== '' && !isValidWideIntegralString(raw, wideType)) {
    return `Field "${path}" is not a valid ${wideType} decimal string`;
  }

  return null;
}

function fieldWideIntegralJsonViolation(
  raw: unknown,
  field: GrpcFieldSchema,
  path: string,
  messageIndex: Map<string, GrpcMessageSchema> | undefined,
  strictStringLiterals: boolean,
): string | null {
  const nestedSchema = resolveNestedMessageSchema(field, messageIndex);

  if (field.isMap) {
    if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
      return null;
    }
    if (nestedSchema) {
      for (const [key, item] of Object.entries(raw as Record<string, unknown>)) {
        if (item && typeof item === 'object' && !Array.isArray(item)) {
          const nestedViolation = findWideIntegralJsonViolationsInObject(
            item as Record<string, unknown>,
            nestedSchema,
            messageIndex,
            `${path}.${key}`,
            strictStringLiterals,
          );
          if (nestedViolation) return nestedViolation;
        }
      }
      return null;
    }
    const valueField: GrpcFieldSchema = { ...field, isMap: false, label: 'optional' };
    for (const [key, item] of Object.entries(raw as Record<string, unknown>)) {
      const violation = fieldWideIntegralJsonViolation(item, valueField, `${path}.${key}`, messageIndex, strictStringLiterals);
      if (violation) return violation;
    }
    return null;
  }

  if (field.label === 'repeated') {
    if (!Array.isArray(raw)) return null;
    if (nestedSchema) {
      for (let index = 0; index < raw.length; index += 1) {
        const item = raw[index];
        if (item && typeof item === 'object' && !Array.isArray(item)) {
          const nestedViolation = findWideIntegralJsonViolationsInObject(
            item as Record<string, unknown>,
            nestedSchema,
            messageIndex,
            `${path}[${index}]`,
            strictStringLiterals,
          );
          if (nestedViolation) return nestedViolation;
        }
      }
      return null;
    }
    for (let index = 0; index < raw.length; index += 1) {
      const violation = scalarWideIntegralJsonViolation(raw[index], field.type, `${path}[${index}]`, strictStringLiterals);
      if (violation) return violation;
    }
    return null;
  }

  if (nestedSchema && raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return findWideIntegralJsonViolationsInObject(
      raw as Record<string, unknown>,
      nestedSchema,
      messageIndex,
      path,
      strictStringLiterals,
    );
  }

  return scalarWideIntegralJsonViolation(raw, field.type, path, strictStringLiterals);
}

function findWideIntegralJsonViolationsInObject(
  source: Record<string, unknown>,
  schema: GrpcMessageSchema,
  messageIndex: Map<string, GrpcMessageSchema> | undefined,
  pathPrefix: string,
  strictStringLiterals: boolean,
): string | null {
  const { regular, oneofGroups } = groupMessageFields(schema.fields);
  for (const field of regular) {
    if (!Object.prototype.hasOwnProperty.call(source, field.name)) continue;
    const fieldPath = pathPrefix ? `${pathPrefix}.${field.name}` : field.name;
    const violation = fieldWideIntegralJsonViolation(source[field.name], field, fieldPath, messageIndex, strictStringLiterals);
    if (violation) return violation;
  }
  for (const members of oneofGroups.values()) {
    const activeName = resolveActiveOneofMember(members, source) ?? members[0]?.name;
    const active = members.find((member) => member.name === activeName);
    if (!active || !Object.prototype.hasOwnProperty.call(source, active.name)) continue;
    const fieldPath = pathPrefix ? `${pathPrefix}.${active.name}` : active.name;
    const violation = fieldWideIntegralJsonViolation(source[active.name], active, fieldPath, messageIndex, strictStringLiterals);
    if (violation) return violation;
  }
  return null;
}

/** Reject invalid / unsafe 64-bit JSON values (OQ-8). */
export function findWideIntegralJsonViolations(
  source: Record<string, unknown>,
  schema: GrpcMessageSchema,
  messageIndex?: Map<string, GrpcMessageSchema>,
  options: WideIntegralJsonValidationOptions = {},
): string | null {
  const strictStringLiterals = options.strictStringLiterals !== false;
  return findWideIntegralJsonViolationsInObject(source, schema, messageIndex, '', strictStringLiterals);
}

/** Re-sync nested message bodies so wide integrals coerce consistently (OQ-8). */
function normalizeNestedBodies(
  body: Record<string, unknown>,
  schema: GrpcMessageSchema,
  messageIndex: Map<string, GrpcMessageSchema> | undefined,
): Record<string, unknown> {
  if (!messageIndex) return body;

  const next = { ...body };
  const { regular, oneofGroups } = groupMessageFields(schema.fields);

  const walkField = (field: GrpcFieldSchema) => {
    if (!Object.prototype.hasOwnProperty.call(next, field.name)) return;
    const raw = next[field.name];
    const nestedSchema = resolveNestedMessageSchema(field, messageIndex);

    if (field.isMap && nestedSchema && raw && typeof raw === 'object' && !Array.isArray(raw)) {
      const mapNext: Record<string, unknown> = {};
      for (const [key, item] of Object.entries(raw as Record<string, unknown>)) {
        mapNext[key] = item && typeof item === 'object' && !Array.isArray(item)
          ? normalizeNestedBodies(
            syncBodyWithSchema(item, nestedSchema),
            nestedSchema,
            messageIndex,
          )
          : item;
      }
      next[field.name] = mapNext;
      return;
    }

    if (field.label === 'repeated' && nestedSchema && Array.isArray(raw)) {
      next[field.name] = raw.map((item) => (
        item && typeof item === 'object' && !Array.isArray(item)
          ? normalizeNestedBodies(
            syncBodyWithSchema(item, nestedSchema),
            nestedSchema,
            messageIndex,
          )
          : item
      ));
      return;
    }

    if (nestedSchema && raw && typeof raw === 'object' && !Array.isArray(raw)) {
      const syncedChild = syncBodyWithSchema(raw, nestedSchema);
      next[field.name] = normalizeNestedBodies(syncedChild, nestedSchema, messageIndex);
    }
  };

  for (const field of regular) walkField(field);
  for (const members of oneofGroups.values()) {
    const activeName = resolveActiveOneofMember(members, next) ?? members[0]?.name;
    const active = members.find((member) => member.name === activeName);
    if (active) walkField(active);
  }

  return next;
}

export function applyJsonTextToSchema(
  text: string,
  schema: GrpcMessageSchema,
  options: ApplyJsonTextToSchemaOptions = {},
): GrpcBodyJsonParseResult {
  const parsed = parseGrpcBodyJson(text);
  if (!parsed.ok) return parsed;

  const messageIndex = buildGrpcMessageSchemaIndex(options.messageTypes);
  const wideIntegralViolation = findWideIntegralJsonViolations(parsed.body, schema, messageIndex, {
    strictStringLiterals: options.enforceWideIntegralStringLiterals !== false,
  });
  if (wideIntegralViolation) {
    return { ok: false, error: wideIntegralViolation };
  }

  return {
    ok: true,
    body: normalizeNestedBodies(
      syncBodyWithSchema(parsed.body, schema),
      schema,
      messageIndex,
    ),
  };
}

export function bodiesAreJsonEquivalent(
  left: Record<string, unknown>,
  right: Record<string, unknown>,
): boolean {
  return serializeGrpcBodyJson(left) === serializeGrpcBodyJson(right);
}
