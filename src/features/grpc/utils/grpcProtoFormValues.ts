/**
 * Proto form value helpers — defaults and schema-aware coercion (Phase 1F).
 */
import type { GrpcFieldSchema, GrpcMessageSchema } from '@shared/grpc/contracts';

export function groupMessageFields(fields: GrpcFieldSchema[]): {
  regular: GrpcFieldSchema[];
  oneofGroups: Map<string, GrpcFieldSchema[]>;
} {
  const regular: GrpcFieldSchema[] = [];
  const oneofGroups = new Map<string, GrpcFieldSchema[]>();
  for (const field of fields) {
    if (field.isOneofMember && field.oneofName) {
      const members = oneofGroups.get(field.oneofName) ?? [];
      members.push(field);
      oneofGroups.set(field.oneofName, members);
    } else {
      regular.push(field);
    }
  }
  return { regular, oneofGroups };
}

export function resolveActiveOneofMember(
  members: GrpcFieldSchema[],
  source: Record<string, unknown>,
): string | null {
  const present = members.filter((member) =>
    Object.prototype.hasOwnProperty.call(source, member.name)
    && source[member.name] !== undefined
    && source[member.name] !== null);
  if (!present.length) {
    return null;
  }
  return present[present.length - 1]!.name;
}

export function defaultValueForGrpcField(field: GrpcFieldSchema): unknown {
  if (field.isMap) {
    return {};
  }
  if (field.label === 'repeated') {
    return [];
  }

  switch (field.type) {
    case 'bool':
      return false;
    case 'string':
    case 'bytes':
      return '';
    case 'int32':
    case 'uint32':
    case 'sint32':
    case 'fixed32':
    case 'sfixed32':
    case 'float':
    case 'double':
      return 0;
    case 'int64':
    case 'uint64':
    case 'sint64':
    case 'fixed64':
    case 'sfixed64':
      return '0';
    case 'enum':
      return field.enumValues?.[0]?.number ?? 0;
    case 'message':
      return {};
    case 'google.protobuf.Timestamp':
      return new Date().toISOString();
    case 'google.protobuf.Duration':
      return '0s';
    case 'google.protobuf.BoolValue':
      return { value: false };
    case 'google.protobuf.StringValue':
      return { value: '' };
    case 'google.protobuf.Int32Value':
      return { value: 0 };
    case 'google.protobuf.Int64Value':
      return { value: '0' };
    case 'google.protobuf.Any':
      return { '@type': 'type.googleapis.com/' };
    case 'google.protobuf.Struct':
    case 'google.protobuf.Value':
      return {};
    default:
      return null;
  }
}

export function buildBodyFromSchema(schema: GrpcMessageSchema): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  const { regular, oneofGroups } = groupMessageFields(schema.fields);
  for (const field of regular) {
    body[field.name] = defaultValueForGrpcField(field);
  }
  for (const members of oneofGroups.values()) {
    const first = members[0];
    if (first) {
      body[first.name] = defaultValueForGrpcField(first);
    }
  }
  return body;
}

function isIntegralFieldType(type: GrpcFieldSchema['type']): boolean {
  return type === 'int32'
    || type === 'int64'
    || type === 'uint32'
    || type === 'uint64'
    || type === 'sint32'
    || type === 'sint64'
    || type === 'fixed32'
    || type === 'fixed64'
    || type === 'sfixed32'
    || type === 'sfixed64'
    || type === 'enum';
}

export function isWideIntegralFieldType(type: GrpcFieldSchema['type']): boolean {
  return type === 'int64'
    || type === 'uint64'
    || type === 'sint64'
    || type === 'fixed64'
    || type === 'sfixed64';
}

function isUnsignedWideIntegralFieldType(type: GrpcFieldSchema['type']): boolean {
  return type === 'uint64' || type === 'fixed64';
}

export function isValidWideIntegralString(
  raw: string,
  type: GrpcFieldSchema['type'],
): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return true;
  if (isUnsignedWideIntegralFieldType(type)) {
    return /^\d+$/.test(trimmed);
  }
  return /^-?\d+$/.test(trimmed);
}

function coerceWideIntegralString(raw: unknown, type: GrpcFieldSchema['type']): string {
  if (raw == null || raw === '') return '0';
  const asString = String(raw).trim();
  if (isValidWideIntegralString(asString, type)) {
    return asString === '' ? '0' : asString;
  }
  if (typeof raw === 'number' && Number.isFinite(raw) && Number.isSafeInteger(raw)) {
    return String(raw);
  }
  return '0';
}

function isFloatFieldType(type: GrpcFieldSchema['type']): boolean {
  return type === 'float' || type === 'double';
}

export function isGrpcWellKnownFieldType(type: GrpcFieldSchema['type']): boolean {
  return typeof type === 'string' && type.startsWith('google.protobuf.');
}

export function isGrpcWrapperWkt(type: GrpcFieldSchema['type']): boolean {
  return type === 'google.protobuf.BoolValue'
    || type === 'google.protobuf.StringValue'
    || type === 'google.protobuf.Int32Value'
    || type === 'google.protobuf.Int64Value';
}

export { GRPC_MAP_PENDING_KEY_PREFIX, isGrpcMapPendingKey } from '@shared/grpc/grpcMapPendingKeys';

export function wktFieldBadgeLabel(type: GrpcFieldSchema['type']): string {
  if (!isGrpcWellKnownFieldType(type)) return String(type);
  return type.replace('google.protobuf.', '');
}

export function coerceGrpcFieldValue(field: GrpcFieldSchema, raw: unknown): unknown {
  if (field.isMap) {
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
      return {};
    }
    const valueField: GrpcFieldSchema = { ...field, isMap: false, label: 'optional' };
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(raw as Record<string, unknown>)) {
      result[key] = coerceGrpcFieldValue(valueField, item);
    }
    return result;
  }

  if (field.label === 'repeated') {
    if (!Array.isArray(raw)) return [];
    return raw.map((item) => coerceGrpcScalarFieldValue(field, item));
  }

  if (field.type === 'message') {
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
      return {};
    }
    return { ...(raw as Record<string, unknown>) };
  }

  return coerceGrpcScalarFieldValue(field, raw);
}

function coerceGrpcScalarFieldValue(field: GrpcFieldSchema, raw: unknown): unknown {
  switch (field.type) {
    case 'bool':
      if (typeof raw === 'boolean') return raw;
      if (raw === 'true') return true;
      if (raw === 'false') return false;
      return Boolean(raw);
    case 'string':
    case 'bytes':
      return raw == null ? '' : String(raw);
    case 'enum': {
      if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
      const asNumber = Number(raw);
      if (Number.isFinite(asNumber)) return asNumber;
      const match = field.enumValues?.find((entry) => entry.name === String(raw));
      return match?.number ?? field.enumValues?.[0]?.number ?? 0;
    }
    case 'google.protobuf.Timestamp':
    case 'google.protobuf.Duration':
      return raw == null ? '' : String(raw);
    case 'google.protobuf.BoolValue': {
      const wrapper = raw && typeof raw === 'object' && !Array.isArray(raw)
        ? raw as Record<string, unknown>
        : {};
      const inner = wrapper.value;
      return {
        value: inner === true || inner === 'true',
      };
    }
    case 'google.protobuf.StringValue': {
      const wrapper = raw && typeof raw === 'object' && !Array.isArray(raw)
        ? raw as Record<string, unknown>
        : {};
      return { value: wrapper.value == null ? '' : String(wrapper.value) };
    }
    case 'google.protobuf.Int32Value': {
      const wrapper = raw && typeof raw === 'object' && !Array.isArray(raw)
        ? raw as Record<string, unknown>
        : {};
      const num = Number(wrapper.value);
      return { value: Number.isFinite(num) ? num : 0 };
    }
    case 'google.protobuf.Int64Value': {
      const wrapper = raw && typeof raw === 'object' && !Array.isArray(raw)
        ? raw as Record<string, unknown>
        : {};
      return { value: coerceWideIntegralString(wrapper.value, 'int64') };
    }
    case 'google.protobuf.Any':
      if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
        return defaultValueForGrpcField(field);
      }
      return { ...(raw as Record<string, unknown>) };
    case 'google.protobuf.Struct':
    case 'google.protobuf.Value':
      if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
        return {};
      }
      return { ...(raw as Record<string, unknown>) };
    default:
      if (isWideIntegralFieldType(field.type)) {
        return coerceWideIntegralString(raw, field.type);
      }
      if (isIntegralFieldType(field.type)) {
        const num = Number(raw);
        return Number.isFinite(num) ? num : 0;
      }
      if (isFloatFieldType(field.type)) {
        const num = Number(raw);
        return Number.isFinite(num) ? num : 0;
      }
      if (field.type === 'message') {
        return raw && typeof raw === 'object' && !Array.isArray(raw)
          ? { ...(raw as Record<string, unknown>) }
          : {};
      }
      return raw ?? defaultValueForGrpcField({ ...field, label: 'optional' });
  }
}

/** Normalize a parsed JSON object to the request schema (drops unknown keys, coerces types). */
export function syncBodyWithSchema(
  input: unknown,
  schema: GrpcMessageSchema,
): Record<string, unknown> {
  const source = (input && typeof input === 'object' && !Array.isArray(input))
    ? input as Record<string, unknown>
    : {};

  const next: Record<string, unknown> = {};
  const { regular, oneofGroups } = groupMessageFields(schema.fields);
  for (const field of regular) {
    const raw = Object.prototype.hasOwnProperty.call(source, field.name)
      ? source[field.name]
      : defaultValueForGrpcField(field);
    next[field.name] = coerceGrpcFieldValue(field, raw);
  }
  for (const members of oneofGroups.values()) {
    const activeName = resolveActiveOneofMember(members, source) ?? members[0]?.name;
    const active = members.find((member) => member.name === activeName) ?? members[0];
    if (!active) continue;
    const raw = Object.prototype.hasOwnProperty.call(source, active.name)
      ? source[active.name]
      : defaultValueForGrpcField(active);
    next[active.name] = coerceGrpcFieldValue(active, raw);
  }
  return next;
}

export function setGrpcBodyField(
  body: Record<string, unknown>,
  fieldName: string,
  value: unknown,
): Record<string, unknown> {
  return {
    ...body,
    [fieldName]: value,
  };
}

export function setGrpcOneofMember(
  body: Record<string, unknown>,
  members: GrpcFieldSchema[],
  memberName: string,
  value: unknown,
): Record<string, unknown> {
  const next = { ...body };
  for (const member of members) {
    if (member.name !== memberName) {
      delete next[member.name];
    }
  }
  next[memberName] = value;
  return next;
}
