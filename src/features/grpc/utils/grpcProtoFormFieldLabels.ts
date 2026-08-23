import type { GrpcFieldSchema } from '@shared/grpc/contracts';
import { isGrpcWellKnownFieldType, isWideIntegralFieldType, wktFieldBadgeLabel } from './grpcProtoFormValues';

export const GRPC_ANY_TYPE_URL_PREFIX = 'type.googleapis.com/';

export function parseGrpcAnyTypeName(value: unknown): string {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return '';
  }
  const typeValue = (value as Record<string, unknown>)['@type'];
  if (typeof typeValue !== 'string') {
    return '';
  }
  const trimmed = typeValue.trim();
  if (!trimmed) {
    return '';
  }
  if (trimmed.startsWith(GRPC_ANY_TYPE_URL_PREFIX)) {
    return trimmed.slice(GRPC_ANY_TYPE_URL_PREFIX.length);
  }
  const slashIndex = trimmed.lastIndexOf('/');
  if (slashIndex >= 0 && slashIndex < trimmed.length - 1) {
    return trimmed.slice(slashIndex + 1);
  }
  return trimmed;
}

export function toGrpcAnyTypeUrl(typeName: string): string {
  const trimmed = typeName.trim();
  if (!trimmed) {
    return '';
  }
  if (trimmed.includes('/')) {
    return trimmed;
  }
  return `${GRPC_ANY_TYPE_URL_PREFIX}${trimmed}`;
}

export function fieldTypeBadgeLabel(field: GrpcFieldSchema): string {
  if (field.isMap) {
    const keyType = field.mapKeyType ?? 'string';
    if (field.type === 'message' && field.messageTypeName) {
      return `map<${keyType}, ${field.messageTypeName}>`;
    }
    if (field.type === 'enum' && field.enumTypeName) {
      return `map<${keyType}, ${field.enumTypeName}>`;
    }
    return `map<${keyType}, ${field.type}>`;
  }
  if (field.label === 'repeated') {
    return `repeated ${field.type}`;
  }
  if (field.type === 'enum' && field.enumTypeName) {
    return 'enum';
  }
  if (isGrpcWellKnownFieldType(field.type)) {
    return wktFieldBadgeLabel(field.type);
  }
  return field.type;
}

export function fieldNoteLabel(field: GrpcFieldSchema): string {
  return `#${field.number} ${field.label}`;
}

export function isNumericScalarField(field: GrpcFieldSchema): boolean {
  if (isWideIntegralFieldType(field.type)) {
    return false;
  }
  return field.type !== 'string'
    && field.type !== 'bytes'
    && field.type !== 'bool'
    && field.type !== 'enum'
    && field.type !== 'message';
}

export function isWideIntegralScalarField(field: GrpcFieldSchema): boolean {
  return isWideIntegralFieldType(field.type);
}
