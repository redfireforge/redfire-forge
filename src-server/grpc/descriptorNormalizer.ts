import protobuf from 'protobufjs';
import descriptor from 'protobufjs/ext/descriptor/index.js';
import type {
  GrpcCallType,
  GrpcDescriptor,
  GrpcDescriptorSource,
  GrpcEnumSchema,
  GrpcFieldSchema,
  GrpcFieldType,
  GrpcMessageSchema,
  GrpcMethodInfo,
  GrpcServiceInfo,
} from '../../src/shared/grpc/contracts.js';

const WELL_KNOWN_FIELD_TYPES: Record<string, GrpcFieldType> = {
  'google.protobuf.Timestamp': 'google.protobuf.Timestamp',
  'google.protobuf.Duration': 'google.protobuf.Duration',
  'google.protobuf.Any': 'google.protobuf.Any',
  'google.protobuf.Struct': 'google.protobuf.Struct',
  'google.protobuf.Value': 'google.protobuf.Value',
  'google.protobuf.BoolValue': 'google.protobuf.BoolValue',
  'google.protobuf.StringValue': 'google.protobuf.StringValue',
  'google.protobuf.Int32Value': 'google.protobuf.Int32Value',
  'google.protobuf.Int64Value': 'google.protobuf.Int64Value',
};

const SCALAR_FIELD_TYPES = new Set<GrpcFieldType>([
  'bool',
  'bytes',
  'string',
  'int32',
  'int64',
  'uint32',
  'uint64',
  'sint32',
  'sint64',
  'fixed32',
  'fixed64',
  'sfixed32',
  'sfixed64',
  'float',
  'double',
]);

function stripLeadingDot(typeName: string): string {
  return typeName.startsWith('.') ? typeName.slice(1) : typeName;
}

function isInternalSchemaType(typeName: string): boolean {
  return typeName.startsWith('google.protobuf.')
    || typeName.startsWith('google.api.');
}

function methodCallType(requestStream: boolean, responseStream: boolean): GrpcCallType {
  if (requestStream && responseStream) return 'bidi_streaming';
  if (requestStream) return 'client_streaming';
  if (responseStream) return 'server_streaming';
  return 'unary';
}

function mapFieldType(field: protobuf.Field): GrpcFieldType {
  if (field.resolvedType instanceof protobuf.Enum) {
    return 'enum';
  }
  if (field.resolvedType instanceof protobuf.Type) {
    const fullName = stripLeadingDot(field.resolvedType.fullName);
    const wkt = WELL_KNOWN_FIELD_TYPES[fullName];
    if (wkt) return wkt;
    return 'message';
  }
  if (SCALAR_FIELD_TYPES.has(field.type as GrpcFieldType)) {
    return field.type as GrpcFieldType;
  }
  return 'string';
}

function mapKeyType(field: protobuf.Field): GrpcFieldType {
  const keyType = (field as protobuf.Field & { keyType?: string }).keyType;
  if (keyType && SCALAR_FIELD_TYPES.has(keyType as GrpcFieldType)) {
    return keyType as GrpcFieldType;
  }
  return 'string';
}

function fieldLabel(field: protobuf.Field): GrpcFieldSchema['label'] {
  if (field.repeated) return 'repeated';
  if (field.required) return 'required';
  return 'optional';
}

function fieldSchemaName(field: protobuf.Field): string {
  const extended = field as protobuf.Field & { protoName?: string };
  return extended.protoName ?? field.name;
}

function buildMessageSchema(type: protobuf.Type): GrpcMessageSchema {
  const fields: GrpcFieldSchema[] = type.fieldsArray
    .slice()
    .sort((a, b) => a.id - b.id || a.name.localeCompare(b.name))
    .map((field) => {
    const schema: GrpcFieldSchema = {
      name: fieldSchemaName(field),
      number: field.id,
      type: mapFieldType(field),
      label: fieldLabel(field),
    };
    if ((field as protobuf.Field & { map?: boolean }).map) {
      schema.isMap = true;
      schema.mapKeyType = mapKeyType(field);
      schema.label = 'optional';
    }
    if (field.partOf) {
      schema.isOneofMember = true;
      schema.oneofName = field.partOf.name;
    }
    if (field.resolvedType instanceof protobuf.Type) {
      schema.messageTypeName = stripLeadingDot(field.resolvedType.fullName);
    }
    if (field.resolvedType instanceof protobuf.Enum) {
      schema.enumTypeName = stripLeadingDot(field.resolvedType.fullName);
      schema.enumValues = Object.entries(field.resolvedType.values)
        .map(([name, number]) => ({
          name,
          number: number as number,
        }))
        .sort((a, b) => a.name.localeCompare(b.name) || a.number - b.number);
    }
    if (field.comment) {
      schema.docComment = field.comment.trim();
    }
    return schema;
  });

  return {
    typeName: stripLeadingDot(type.fullName),
    fields,
    docComment: type.comment?.trim(),
  };
}

function resolveMessageType(root: protobuf.Root, typeName: string): protobuf.Type {
  const lookupName = typeName.includes('.') ? typeName : `.${typeName}`;
  const resolved = root.lookupType(lookupName);
  if (!resolved) {
    throw new Error(`Type ${typeName} not found in descriptor`);
  }
  return resolved;
}

function buildMethodInfo(root: protobuf.Root, method: protobuf.Method): GrpcMethodInfo {
  const requestType = resolveMessageType(root, method.requestType);
  const responseType = resolveMessageType(root, method.responseType);
  return {
    name: method.name,
    callType: methodCallType(!!method.requestStream, !!method.responseStream),
    requestTypeName: stripLeadingDot(requestType.fullName),
    responseTypeName: stripLeadingDot(responseType.fullName),
    requestSchema: buildMessageSchema(requestType),
    responseSchema: buildMessageSchema(responseType),
    docComment: method.comment?.trim(),
  };
}

function buildEnumSchema(enumType: protobuf.Enum): GrpcEnumSchema {
  const values = Object.entries(enumType.values)
    .map(([name, number]) => ({
      name,
      number: number as number,
    }))
    .sort((a, b) => a.number - b.number || a.name.localeCompare(b.name));
  return {
    typeName: stripLeadingDot(enumType.fullName),
    values,
    docComment: enumType.comment?.trim(),
  };
}

function collectMessageTypes(root: protobuf.Root): GrpcMessageSchema[] {
  const messages: GrpcMessageSchema[] = [];
  const walk = (namespace: protobuf.NamespaceBase) => {
    for (const nested of namespace.nestedArray) {
      if (nested instanceof protobuf.Type) {
        const typeName = stripLeadingDot(nested.fullName);
        if (!isInternalSchemaType(typeName)) {
          messages.push(buildMessageSchema(nested));
        }
      } else if (nested instanceof protobuf.Namespace) {
        walk(nested);
      }
    }
  };
  walk(root);
  return messages.sort((a, b) => a.typeName.localeCompare(b.typeName));
}

function collectEnumTypes(root: protobuf.Root): GrpcEnumSchema[] {
  const enums: GrpcEnumSchema[] = [];
  const walk = (namespace: protobuf.NamespaceBase) => {
    for (const nested of namespace.nestedArray) {
      if (nested instanceof protobuf.Enum) {
        const typeName = stripLeadingDot(nested.fullName);
        if (!isInternalSchemaType(typeName)) {
          enums.push(buildEnumSchema(nested));
        }
      } else if (nested instanceof protobuf.Namespace) {
        walk(nested);
      }
    }
  };
  walk(root);
  return enums.sort((a, b) => a.typeName.localeCompare(b.typeName));
}

function collectServices(root: protobuf.Root): GrpcServiceInfo[] {
  const services: GrpcServiceInfo[] = [];

  const walk = (namespace: protobuf.NamespaceBase) => {
    for (const nested of namespace.nestedArray) {
      if (nested instanceof protobuf.Service) {
        const methods = nested.methodsArray
          .map((method) => buildMethodInfo(root, method))
          .sort((a, b) => a.name.localeCompare(b.name));
        services.push({
          fullName: stripLeadingDot(nested.fullName),
          methods,
        });
      } else if (nested instanceof protobuf.Namespace) {
        walk(nested);
      }
    }
  };

  walk(root);
  return services.sort((a, b) => a.fullName.localeCompare(b.fullName));
}

export function normalizeRootToDescriptor(
  root: protobuf.Root,
  source: GrpcDescriptorSource,
  key: string,
  options?: { sourceRef?: string; contentSha256?: string },
): GrpcDescriptor {
  root.resolveAll();
  const services = collectServices(root);
  if (services.length === 0) {
    throw new Error('No gRPC services found in descriptor source');
  }
  return {
    source,
    key,
    sourceRef: options?.sourceRef,
    contentSha256: options?.contentSha256,
    services,
    messageTypes: collectMessageTypes(root),
    enumTypes: collectEnumTypes(root),
  };
}

/** Compare service/method signatures across descriptors (ignoring key/source metadata). */
export function descriptorServiceSignatures(descriptor: GrpcDescriptor): string {
  return JSON.stringify(
    descriptor.services.map((service) => ({
      fullName: service.fullName,
      methods: service.methods.map((method) => ({
        name: method.name,
        callType: method.callType,
        requestTypeName: method.requestTypeName,
        responseTypeName: method.responseTypeName,
        requestSchema: method.requestSchema,
        responseSchema: method.responseSchema,
      })),
    })),
  );
}

export function mergeProtobufRoots(roots: protobuf.Root[]): protobuf.Root {
  if (roots.length === 0) {
    throw new Error('mergeProtobufRoots requires at least one root');
  }
  if (roots.length === 1) {
    return roots[0]!;
  }

  const mergedSet = descriptor.FileDescriptorSet.create({ file: [] });
  const seenFiles = new Set<string>();
  for (const root of roots) {
    root.resolveAll();
    const fileDescriptorSet = root.toDescriptor('proto3');
    for (const file of fileDescriptorSet.file ?? []) {
      const fileName = file.name ?? '';
      if (fileName && !seenFiles.has(fileName)) {
        seenFiles.add(fileName);
        mergedSet.file!.push(file);
      }
    }
  }

  const merged = protobuf.Root.fromDescriptor(mergedSet);
  merged.resolveAll();
  return merged;
}
