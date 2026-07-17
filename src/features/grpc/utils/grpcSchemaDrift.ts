import type {
  GrpcDescriptor,
  GrpcDescriptorDriftState,
  GrpcMessageSchema,
  GrpcMethodInfo,
} from '../../../shared/grpc/contracts';
import { findGrpcMethod } from './grpcExplorerUtils';
import { syncBodyWithSchema } from './grpcProtoFormValues';

export type GrpcSchemaDriftIssueKind =
  | 'method_missing'
  | 'field_removed'
  | 'field_type_changed';

export interface GrpcSchemaDriftIssue {
  kind: GrpcSchemaDriftIssueKind;
  fieldName?: string;
  message: string;
}

export interface GrpcSchemaDriftRebindSuggestion {
  service: string;
  method: string;
  reason: string;
}

export interface GrpcSchemaDriftAnalysis {
  state: GrpcDescriptorDriftState;
  message: string;
  issues: GrpcSchemaDriftIssue[];
  suggestedRebinds: GrpcSchemaDriftRebindSuggestion[];
}

function bodyUsesField(body: Record<string, unknown>, fieldName: string): boolean {
  if (!Object.prototype.hasOwnProperty.call(body, fieldName)) {
    return false;
  }
  const value = body[fieldName];
  if (value === undefined || value === null) {
    return false;
  }
  if (typeof value === 'string' && value.trim() === '') {
    return false;
  }
  if (Array.isArray(value) && value.length === 0) {
    return false;
  }
  return true;
}

function fieldShapeSignature(field: {
  type: string;
  label?: string;
  isMap?: boolean;
  mapKeyType?: string;
  messageTypeName?: string;
  enumTypeName?: string;
}): string {
  const valueType = field.type === 'message' && field.messageTypeName
    ? field.messageTypeName
    : field.type === 'enum' && field.enumTypeName
      ? field.enumTypeName
      : field.type;
  if (field.isMap) {
    return `map<${field.mapKeyType ?? 'string'},${valueType}>`;
  }
  return `${valueType}:${field.label ?? 'optional'}`;
}

export function compareRequestSchemaDrift(
  body: Record<string, unknown>,
  previousSchema: GrpcMessageSchema,
  nextSchema: GrpcMessageSchema,
): GrpcSchemaDriftIssue[] {
  const issues: GrpcSchemaDriftIssue[] = [];
  const nextFields = new Map(nextSchema.fields.map((field) => [field.name, field]));
  const previousFields = new Map(previousSchema.fields.map((field) => [field.name, field]));

  for (const [name, previousField] of previousFields) {
    const nextField = nextFields.get(name);
    if (!nextField) {
      if (bodyUsesField(body, name)) {
        issues.push({
          kind: 'field_removed',
          fieldName: name,
          message: `Field "${name}" was removed from the request schema`,
        });
      }
      continue;
    }
    if (fieldShapeSignature(previousField) !== fieldShapeSignature(nextField) && bodyUsesField(body, name)) {
      issues.push({
        kind: 'field_type_changed',
        fieldName: name,
        message: `Field "${name}" changed from ${fieldShapeSignature(previousField)} to ${fieldShapeSignature(nextField)}`,
      });
    }
  }

  for (const key of Object.keys(body)) {
    if (!bodyUsesField(body, key) || nextFields.has(key)) {
      continue;
    }
    if (issues.some((issue) => issue.fieldName === key)) {
      continue;
    }
    issues.push({
      kind: 'field_removed',
      fieldName: key,
      message: `Field "${key}" is not in the request schema`,
    });
  }

  return issues;
}

export function suggestGrpcSchemaRebinds(
  descriptor: GrpcDescriptor,
  previousDescriptor: GrpcDescriptor | undefined,
  service: string,
  method: string,
): GrpcSchemaDriftRebindSuggestion[] {
  const previousMethod = previousDescriptor
    ? findGrpcMethod(previousDescriptor, service, method)
    : undefined;
  const suggestions = new Map<string, GrpcSchemaDriftRebindSuggestion>();

  for (const serviceInfo of descriptor.services) {
    for (const methodInfo of serviceInfo.methods) {
      const key = `${serviceInfo.fullName}/${methodInfo.name}`;
      if (methodInfo.name === method) {
        suggestions.set(key, {
          service: serviceInfo.fullName,
          method: methodInfo.name,
          reason: serviceInfo.fullName === service
            ? 'Same method name on service'
            : `Method "${method}" on ${serviceInfo.fullName}`,
        });
      } else if (
        previousMethod
        && methodInfo.requestTypeName === previousMethod.requestTypeName
      ) {
        suggestions.set(key, {
          service: serviceInfo.fullName,
          method: methodInfo.name,
          reason: `Same request type ${methodInfo.requestTypeName}`,
        });
      }
    }
  }

  return [...suggestions.values()];
}

export function analyzeWarningDriftWithBaseline(
  body: Record<string, unknown>,
  baselineSchema: GrpcMessageSchema,
  method: GrpcMethodInfo,
): GrpcSchemaDriftAnalysis {
  const issues = compareRequestSchemaDrift(body, baselineSchema, method.requestSchema);
  if (issues.length === 0) {
    return {
      state: 'none',
      message: '',
      issues: [],
      suggestedRebinds: [],
    };
  }

  const fieldSummary = issues.length === 1
    ? issues[0]!.message
    : `${issues.length} request schema changes affect your draft`;

  return {
    state: 'warning',
    message: fieldSummary,
    issues,
    suggestedRebinds: [],
  };
}

export function analyzeGrpcSchemaDrift(options: {
  previousDescriptor?: GrpcDescriptor;
  nextDescriptor: GrpcDescriptor;
  service?: string;
  method?: string;
  body?: Record<string, unknown>;
}): GrpcSchemaDriftAnalysis {
  const body = options.body ?? {};
  const { service, method, nextDescriptor, previousDescriptor } = options;

  if (!service?.trim() || !method?.trim()) {
    return {
      state: 'none',
      message: '',
      issues: [],
      suggestedRebinds: [],
    };
  }

  const nextMethod = findGrpcMethod(nextDescriptor, service, method);
  const previousMethod = previousDescriptor
    ? findGrpcMethod(previousDescriptor, service, method)
    : undefined;

  if (!nextMethod) {
    const suggestedRebinds = suggestGrpcSchemaRebinds(
      nextDescriptor,
      previousDescriptor,
      service,
      method,
    );
    return {
      state: 'blocking',
      message: `${service}/${method} is no longer available in the refreshed schema.`,
      issues: [{
        kind: 'method_missing',
        message: `Method ${service}/${method} was removed or renamed`,
      }],
      suggestedRebinds,
    };
  }

  if (!previousMethod) {
    return {
      state: 'none',
      message: '',
      issues: [],
      suggestedRebinds: [],
    };
  }

  const issues = compareRequestSchemaDrift(
    body,
    previousMethod.requestSchema,
    nextMethod.requestSchema,
  );

  if (issues.length === 0) {
    return {
      state: 'none',
      message: '',
      issues: [],
      suggestedRebinds: [],
    };
  }

  const fieldSummary = issues.length === 1
    ? issues[0]!.message
    : `${issues.length} request schema changes affect your draft`;

  return {
    state: 'warning',
    message: fieldSummary,
    issues,
    suggestedRebinds: [],
  };
}

/** Drop body keys that are not in the schema (keeps known fields as-is). */
export function pruneGrpcBodyToSchema(
  body: Record<string, unknown>,
  schema: GrpcMessageSchema,
): Record<string, unknown> {
  const allowed = new Set(schema.fields.map((field) => field.name));
  const pruned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (allowed.has(key)) {
      pruned[key] = value;
    }
  }
  return pruned;
}

export function rebindGrpcBodyToMethod(
  body: Record<string, unknown>,
  method: GrpcMethodInfo,
): Record<string, unknown> {
  return syncBodyWithSchema(body, method.requestSchema);
}
