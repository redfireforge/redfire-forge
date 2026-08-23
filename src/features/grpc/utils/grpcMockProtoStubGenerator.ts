/**
 * Generate mock rule stubs from a loaded GrpcDescriptor.
 * Creates one rule per RPC method with sensible defaults:
 * - Predicate: method_equals the RPC method name
 * - Response: empty body with status 0 (OK) and a placeholder body built from the response schema
 */

import type { GrpcDescriptor, GrpcMessageSchema, GrpcFieldSchema } from '@shared/grpc/contracts';
import {
  createDefaultGrpcMockBuilderRuleRow,
  createDefaultGrpcMockBuilderPredicateLeaf,
  type GrpcMockBuilderRuleRow,
  type GrpcMockBuilderPredicateLeaf,
} from './grpcMockRuleBuilderModel';

const ENUM_SUCCESS_PREFERRED_NAMES = ['SUCCESS', 'OK', 'SERVING', 'READY', 'ACTIVE'] as const;

function pickDefaultEnumValueName(field: GrpcFieldSchema): string | number {
  const enumValues = field.enumValues;
  if (!enumValues || enumValues.length === 0) {
    return 0;
  }

  for (const preferredName of ENUM_SUCCESS_PREFERRED_NAMES) {
    const match = enumValues.find((entry) => entry.name.toUpperCase() === preferredName);
    if (match) {
      return match.name;
    }
  }

  return enumValues[0]?.name ?? 0;
}

/** Build a stub JSON body from a message schema (one level deep). */
function buildStubBody(schema: GrpcMessageSchema | undefined): string {
  if (!schema || !schema.fields || schema.fields.length === 0) {
    return '{}';
  }
  const obj: Record<string, unknown> = {};
  for (const field of schema.fields) {
    obj[field.name] = stubFieldValue(field);
  }
  return JSON.stringify(obj, null, 2);
}

function stubFieldValue(field: GrpcFieldSchema): unknown {
  if (field.label === 'repeated') {
    return [];
  }
  switch (field.type) {
    case 'string': return '';
    case 'bool': return false;
    case 'int32': case 'int64': case 'uint32': case 'uint64':
    case 'sint32': case 'sint64': case 'fixed32': case 'fixed64':
    case 'sfixed32': case 'sfixed64':
      return 0;
    case 'float': case 'double': return 0.0;
    case 'bytes': return '';
    case 'enum':
      return pickDefaultEnumValueName(field);
    case 'message':
      return {};
    default:
      return null;
  }
}

export interface GenerateProtoStubsResult {
  rules: GrpcMockBuilderRuleRow[];
  serviceCount: number;
  methodCount: number;
}

export function generateMockRuleStubsFromDescriptor(
  descriptor: GrpcDescriptor,
  startPriority: number = 1,
): GenerateProtoStubsResult {
  const rules: GrpcMockBuilderRuleRow[] = [];
  let priority = startPriority;
  let methodCount = 0;

  for (const service of descriptor.services) {
    for (const method of service.methods) {
      methodCount++;
      const leafPredicate: GrpcMockBuilderPredicateLeaf = {
        ...createDefaultGrpcMockBuilderPredicateLeaf(),
        kind: 'method_equals',
        method: method.name,
      };

      const responseBody = buildStubBody(method.responseSchema);

      const rule: GrpcMockBuilderRuleRow = {
        ...createDefaultGrpcMockBuilderRuleRow(priority),
        name: `${service.fullName}/${method.name}`,
        predicate: leafPredicate,
        responseBodyText: responseBody,
        responseStatusCode: 0,
      };

      rules.push(rule);
      priority++;
    }
  }

  return {
    rules,
    serviceCount: descriptor.services.length,
    methodCount,
  };
}
