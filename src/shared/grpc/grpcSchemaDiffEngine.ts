/**
 * Phase 11F - gRPC proto schema diff engine.
 *
 * Descriptor-to-descriptor comparison with Buf-style wire-compatibility severity classification.
 */

import type {
  GrpcDescriptor,
  GrpcEnumSchema,
  GrpcFieldSchema,
  GrpcMessageSchema,
  GrpcMethodInfo,
  GrpcServiceInfo,
} from './contracts';
import {
  buildGrpcSchemaDiffReport,
  type GrpcSchemaDiffChange,
  type GrpcSchemaDiffInput,
  type GrpcSchemaDiffReport,
} from './grpcSchemaDiffContracts';

export interface GrpcDescriptorIndex {
  services: Map<string, GrpcServiceInfo>;
  messages: Map<string, GrpcMessageSchema>;
  enums: Map<string, GrpcEnumSchema>;
}

export function buildGrpcDescriptorIndex(descriptor: GrpcDescriptor): GrpcDescriptorIndex {
  const services = new Map<string, GrpcServiceInfo>();
  for (const service of descriptor.services) {
    services.set(service.fullName, service);
  }

  const messages = new Map<string, GrpcMessageSchema>();
  for (const message of descriptor.messageTypes ?? []) {
    messages.set(message.typeName, message);
  }
  for (const service of descriptor.services) {
    for (const method of service.methods) {
      if (!messages.has(method.requestSchema.typeName)) {
        messages.set(method.requestSchema.typeName, method.requestSchema);
      }
      if (!messages.has(method.responseSchema.typeName)) {
        messages.set(method.responseSchema.typeName, method.responseSchema);
      }
    }
  }

  const enums = new Map<string, GrpcEnumSchema>();
  for (const enumType of descriptor.enumTypes ?? []) {
    enums.set(enumType.typeName, enumType);
  }
  for (const message of messages.values()) {
    for (const field of message.fields) {
      if (field.type === 'enum' && field.enumTypeName && field.enumValues?.length) {
        if (!enums.has(field.enumTypeName)) {
          enums.set(field.enumTypeName, {
            typeName: field.enumTypeName,
            values: field.enumValues.map((value) => ({ ...value })),
          });
        }
      }
    }
  }

  return { services, messages, enums };
}

export function fieldWireShapeSignature(field: GrpcFieldSchema): string {
  const valueType = field.type === 'message' && field.messageTypeName
    ? field.messageTypeName
    : field.type === 'enum' && field.enumTypeName
      ? field.enumTypeName
      : field.type;

  if (field.isMap) {
    return `map<${field.mapKeyType ?? 'string'},${valueType}>:${field.label}`;
  }

  return `${valueType}:${field.label}`;
}

function pushChange(changes: GrpcSchemaDiffChange[], change: GrpcSchemaDiffChange): void {
  changes.push(change);
}

function compareDocComment(
  changes: GrpcSchemaDiffChange[],
  entityType: GrpcSchemaDiffChange['entityType'],
  entityPath: string,
  leftDoc: string | undefined,
  rightDoc: string | undefined,
): void {
  const normalizedLeft = leftDoc?.trim() ?? '';
  const normalizedRight = rightDoc?.trim() ?? '';
  if (normalizedLeft === normalizedRight) {
    return;
  }

  pushChange(changes, {
    severity: 'informational',
    entityType,
    entityPath,
    changeType: 'doc_comment_changed',
    description: `Documentation changed for ${entityPath}`,
  });
}

function compareServices(
  left: GrpcDescriptorIndex,
  right: GrpcDescriptorIndex,
  changes: GrpcSchemaDiffChange[],
): void {
  const serviceNames = new Set([...left.services.keys(), ...right.services.keys()]);
  const sorted = [...serviceNames].sort((a, b) => a.localeCompare(b));

  for (const fullName of sorted) {
    const leftService = left.services.get(fullName);
    const rightService = right.services.get(fullName);

    if (leftService == null && rightService != null) {
      pushChange(changes, {
        severity: 'non_breaking',
        entityType: 'service',
        entityPath: fullName,
        changeType: 'added',
        description: `Service ${fullName} was added`,
      });
      for (const methodInfo of rightService.methods) {
        pushChange(changes, {
          severity: 'non_breaking',
          entityType: 'method',
          entityPath: `${fullName}/${methodInfo.name}`,
          changeType: 'added',
          description: `RPC ${fullName}/${methodInfo.name} was added`,
        });
      }
      continue;
    }

    if (leftService != null && rightService == null) {
      pushChange(changes, {
        severity: 'breaking',
        entityType: 'service',
        entityPath: fullName,
        changeType: 'removed',
        description: `Service ${fullName} was removed`,
      });
      for (const methodInfo of leftService.methods) {
        pushChange(changes, {
          severity: 'breaking',
          entityType: 'method',
          entityPath: `${fullName}/${methodInfo.name}`,
          changeType: 'removed',
          description: `RPC ${fullName}/${methodInfo.name} was removed`,
        });
      }
      continue;
    }

    if (leftService == null || rightService == null) {
      continue;
    }

    compareMethods(fullName, leftService, rightService, changes);
  }
}

function compareMethods(
  serviceName: string,
  leftService: GrpcServiceInfo,
  rightService: GrpcServiceInfo,
  changes: GrpcSchemaDiffChange[],
): void {
  const leftMethods = new Map(leftService.methods.map((method) => [method.name, method]));
  const rightMethods = new Map(rightService.methods.map((method) => [method.name, method]));
  const methodNames = new Set([...leftMethods.keys(), ...rightMethods.keys()]);
  const sorted = [...methodNames].sort((a, b) => a.localeCompare(b));

  for (const methodName of sorted) {
    const entityPath = `${serviceName}/${methodName}`;
    const leftMethod = leftMethods.get(methodName);
    const rightMethod = rightMethods.get(methodName);

    if (leftMethod == null && rightMethod != null) {
      pushChange(changes, {
        severity: 'non_breaking',
        entityType: 'method',
        entityPath,
        changeType: 'added',
        description: `RPC ${entityPath} was added`,
      });
      continue;
    }

    if (leftMethod != null && rightMethod == null) {
      pushChange(changes, {
        severity: 'breaking',
        entityType: 'method',
        entityPath,
        changeType: 'removed',
        description: `RPC ${entityPath} was removed`,
      });
      continue;
    }

    if (leftMethod == null || rightMethod == null) {
      continue;
    }

    compareMethodSignature(entityPath, leftMethod, rightMethod, changes);
    compareDocComment(changes, 'method', entityPath, leftMethod.docComment, rightMethod.docComment);
  }
}

function compareMethodSignature(
  entityPath: string,
  leftMethod: GrpcMethodInfo,
  rightMethod: GrpcMethodInfo,
  changes: GrpcSchemaDiffChange[],
): void {
  if (leftMethod.callType !== rightMethod.callType) {
    pushChange(changes, {
      severity: 'breaking',
      entityType: 'method',
      entityPath,
      changeType: 'modified',
      description: `RPC ${entityPath} call type changed from ${leftMethod.callType} to ${rightMethod.callType}`,
    });
  }

  if (leftMethod.requestTypeName !== rightMethod.requestTypeName) {
    pushChange(changes, {
      severity: 'breaking',
      entityType: 'method',
      entityPath,
      changeType: 'modified',
      description: `RPC ${entityPath} request type changed from ${leftMethod.requestTypeName} to ${rightMethod.requestTypeName}`,
    });
  }

  if (leftMethod.responseTypeName !== rightMethod.responseTypeName) {
    pushChange(changes, {
      severity: 'breaking',
      entityType: 'method',
      entityPath,
      changeType: 'modified',
      description: `RPC ${entityPath} response type changed from ${leftMethod.responseTypeName} to ${rightMethod.responseTypeName}`,
    });
  }
}

function compareMessages(
  left: GrpcDescriptorIndex,
  right: GrpcDescriptorIndex,
  changes: GrpcSchemaDiffChange[],
): void {
  const typeNames = new Set([...left.messages.keys(), ...right.messages.keys()]);
  const sorted = [...typeNames].sort((a, b) => a.localeCompare(b));

  for (const typeName of sorted) {
    const leftMessage = left.messages.get(typeName);
    const rightMessage = right.messages.get(typeName);

    if (leftMessage == null && rightMessage != null) {
      pushChange(changes, {
        severity: 'non_breaking',
        entityType: 'message',
        entityPath: typeName,
        changeType: 'added',
        description: `Message ${typeName} was added`,
      });
      continue;
    }

    if (leftMessage != null && rightMessage == null) {
      pushChange(changes, {
        severity: 'breaking',
        entityType: 'message',
        entityPath: typeName,
        changeType: 'removed',
        description: `Message ${typeName} was removed`,
      });
      continue;
    }

    if (leftMessage == null || rightMessage == null) {
      continue;
    }

    compareMessageFields(typeName, leftMessage, rightMessage, changes);
    compareDocComment(changes, 'message', typeName, leftMessage.docComment, rightMessage.docComment);
  }
}

function compareMessageFields(
  typeName: string,
  leftMessage: GrpcMessageSchema,
  rightMessage: GrpcMessageSchema,
  changes: GrpcSchemaDiffChange[],
): void {
  const leftByNumber = new Map(leftMessage.fields.map((field) => [field.number, field]));
  const rightByNumber = new Map(rightMessage.fields.map((field) => [field.number, field]));
  const fieldNumbers = new Set([...leftByNumber.keys(), ...rightByNumber.keys()]);
  const sorted = [...fieldNumbers].sort((a, b) => a - b);

  for (const fieldNumber of sorted) {
    const leftField = leftByNumber.get(fieldNumber);
    const rightField = rightByNumber.get(fieldNumber);
    const entityPath = `${typeName}#${fieldNumber}`;

    if (leftField == null && rightField != null) {
      const severity = rightField.label === 'required' ? 'breaking' : 'non_breaking';
      pushChange(changes, {
        severity,
        entityType: 'field',
        entityPath: `${typeName}.${rightField.name}`,
        changeType: 'added',
        description: `Field ${rightField.name} (#${fieldNumber}) was added to ${typeName}`,
      });
      continue;
    }

    if (leftField != null && rightField == null) {
      pushChange(changes, {
        severity: 'breaking',
        entityType: 'field',
        entityPath: `${typeName}.${leftField.name}`,
        changeType: 'removed',
        description: `Field ${leftField.name} (#${fieldNumber}) was removed from ${typeName}`,
      });
      continue;
    }

    if (leftField == null || rightField == null) {
      continue;
    }

    if (fieldWireShapeSignature(leftField) !== fieldWireShapeSignature(rightField)) {
      pushChange(changes, {
        severity: 'breaking',
        entityType: 'field',
        entityPath: `${typeName}.${leftField.name}`,
        changeType: 'modified',
        description: `Field #${fieldNumber} wire shape changed from ${fieldWireShapeSignature(leftField)} to ${fieldWireShapeSignature(rightField)}`,
      });
      continue;
    }

    if (leftField.name !== rightField.name) {
      pushChange(changes, {
        severity: 'informational',
        entityType: 'field',
        entityPath: entityPath,
        changeType: 'renamed',
        description: `Field #${fieldNumber} renamed from ${leftField.name} to ${rightField.name}`,
      });
    }

    compareDocComment(
      changes,
      'field',
      `${typeName}.${rightField.name}`,
      leftField.docComment,
      rightField.docComment,
    );
  }
}

function compareEnums(
  left: GrpcDescriptorIndex,
  right: GrpcDescriptorIndex,
  changes: GrpcSchemaDiffChange[],
): void {
  const typeNames = new Set([...left.enums.keys(), ...right.enums.keys()]);
  const sorted = [...typeNames].sort((a, b) => a.localeCompare(b));

  for (const typeName of sorted) {
    const leftEnum = left.enums.get(typeName);
    const rightEnum = right.enums.get(typeName);

    if (leftEnum == null && rightEnum != null) {
      pushChange(changes, {
        severity: 'non_breaking',
        entityType: 'enum',
        entityPath: typeName,
        changeType: 'added',
        description: `Enum ${typeName} was added`,
      });
      for (const enumValue of rightEnum.values) {
        pushChange(changes, {
          severity: 'non_breaking',
          entityType: 'enum_value',
          entityPath: `${typeName}.${enumValue.name}`,
          changeType: 'added',
          description: `Enum value ${enumValue.name} (#${enumValue.number}) was added to ${typeName}`,
          caveat: 'Clients must tolerate unknown enum values on the wire.',
        });
      }
      continue;
    }

    if (leftEnum != null && rightEnum == null) {
      pushChange(changes, {
        severity: 'breaking',
        entityType: 'enum',
        entityPath: typeName,
        changeType: 'removed',
        description: `Enum ${typeName} was removed`,
      });
      for (const enumValue of leftEnum.values) {
        pushChange(changes, {
          severity: 'breaking',
          entityType: 'enum_value',
          entityPath: `${typeName}.${enumValue.name}`,
          changeType: 'removed',
          description: `Enum value ${enumValue.name} (#${enumValue.number}) was removed from ${typeName}`,
        });
      }
      continue;
    }

    if (leftEnum == null || rightEnum == null) {
      continue;
    }

    compareEnumValues(typeName, leftEnum, rightEnum, changes);
    compareDocComment(changes, 'enum', typeName, leftEnum.docComment, rightEnum.docComment);
  }
}

function compareEnumValues(
  typeName: string,
  leftEnum: GrpcEnumSchema,
  rightEnum: GrpcEnumSchema,
  changes: GrpcSchemaDiffChange[],
): void {
  const leftByNumber = new Map(leftEnum.values.map((value) => [value.number, value]));
  const rightByNumber = new Map(rightEnum.values.map((value) => [value.number, value]));
  const numbers = new Set([...leftByNumber.keys(), ...rightByNumber.keys()]);
  const sorted = [...numbers].sort((a, b) => a - b);

  for (const number of sorted) {
    const leftValue = leftByNumber.get(number);
    const rightValue = rightByNumber.get(number);
    const entityPath = `${typeName}#${number}`;

    if (leftValue == null && rightValue != null) {
      pushChange(changes, {
        severity: 'non_breaking',
        entityType: 'enum_value',
        entityPath: `${typeName}.${rightValue.name}`,
        changeType: 'added',
        description: `Enum value ${rightValue.name} (#${number}) was added to ${typeName}`,
        caveat: 'Clients must tolerate unknown enum values on the wire.',
      });
      continue;
    }

    if (leftValue != null && rightValue == null) {
      pushChange(changes, {
        severity: 'breaking',
        entityType: 'enum_value',
        entityPath: `${typeName}.${leftValue.name}`,
        changeType: 'removed',
        description: `Enum value ${leftValue.name} (#${number}) was removed from ${typeName}`,
      });
      continue;
    }

    if (leftValue == null || rightValue == null) {
      continue;
    }

    if (leftValue.name !== rightValue.name) {
      pushChange(changes, {
        severity: 'breaking',
        entityType: 'enum_value',
        entityPath: entityPath,
        changeType: 'modified',
        description: `Enum value #${number} changed from ${leftValue.name} to ${rightValue.name}`,
      });
    }
  }
}

export function collectGrpcSchemaDiffChanges(
  left: GrpcDescriptor,
  right: GrpcDescriptor,
): GrpcSchemaDiffChange[] {
  const leftIndex = buildGrpcDescriptorIndex(left);
  const rightIndex = buildGrpcDescriptorIndex(right);
  const changes: GrpcSchemaDiffChange[] = [];

  compareServices(leftIndex, rightIndex, changes);
  compareMessages(leftIndex, rightIndex, changes);
  compareEnums(leftIndex, rightIndex, changes);

  return changes;
}

export function computeGrpcSchemaDiff(input: GrpcSchemaDiffInput): GrpcSchemaDiffReport {
  const leftKey = input.leftDescriptorKey || input.left.key;
  const rightKey = input.rightDescriptorKey || input.right.key;

  if (!leftKey?.trim() || !rightKey?.trim()) {
    throw new GrpcSchemaDiffDescriptorKeyError();
  }

  const changes = collectGrpcSchemaDiffChanges(input.left, input.right);

  return buildGrpcSchemaDiffReport({
    leftDescriptorKey: leftKey,
    rightDescriptorKey: rightKey,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    changes,
  });
}

export class GrpcSchemaDiffDescriptorKeyError extends Error {
  readonly category = 'validation' as const;

  constructor() {
    super('Both left and right descriptor keys are required for schema diff reports.');
    this.name = 'GrpcSchemaDiffDescriptorKeyError';
  }
}
