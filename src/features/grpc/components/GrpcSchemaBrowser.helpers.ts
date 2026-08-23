import type { GrpcDescriptor, GrpcFieldSchema, GrpcMethodInfo } from '@shared/grpc/contracts';
import { lookupMessageSchema } from '../utils/grpcSchemaBrowserModel';

export type GrpcurlBodyMode = 'minimal' | 'full';

export const GRPCURL_COPY_HINT_SEEN_KEY = 'grpc-schema-copy-grpcurl-hint-seen';
export const GRPCURL_INSTALL_GO_CMD = 'go install github.com/fullstorydev/grpcurl/cmd/grpcurl@latest';

export const GRPCURL_INSTALL_OPTIONS = [
  { label: 'macOS (Homebrew)', command: 'brew install grpcurl' },
  { label: 'Linux (apt)', command: 'sudo apt install grpcurl' },
  { label: 'Linux (Snap)', command: 'sudo snap install grpcurl' },
  { label: 'Windows (winget)', command: 'winget install FullStory.grpcurl' },
  { label: 'Windows (Chocolatey)', command: 'choco install grpcurl' },
  { label: 'Any OS with Go', command: GRPCURL_INSTALL_GO_CMD },
] as const;

export function grpcurlInstallHintForPlatform(): string {
  const platform = (typeof navigator !== 'undefined' ? navigator.platform : '').toLowerCase();
  if (platform.includes('mac')) {
    return `Install grpcurl (macOS): brew install grpcurl | Any OS with Go: ${GRPCURL_INSTALL_GO_CMD}`;
  }
  if (platform.includes('win')) {
    return `Install grpcurl (Windows): use the official release package | Any OS with Go: ${GRPCURL_INSTALL_GO_CMD}`;
  }
  return `Install grpcurl: use your distro package or official release | Any OS with Go: ${GRPCURL_INSTALL_GO_CMD}`;
}

export function fieldTypeLabel(field: GrpcFieldSchema): string {
  if (field.isMap) {
    const keyType = field.mapKeyType ?? 'string';
    if (field.type === 'message' && field.messageTypeName) {
      return `map<${keyType}, ${field.messageTypeName}>`;
    }
    return `map<${keyType}, ${field.type}>`;
  }
  if (field.type === 'message' && field.messageTypeName) {
    return field.messageTypeName;
  }
  if (field.type === 'enum' && field.enumTypeName) {
    return field.enumTypeName;
  }
  return field.type;
}

export function fieldLabelText(field: GrpcFieldSchema): string {
  if (field.isOneofMember && field.oneofName) {
    return `oneof ${field.oneofName}`;
  }
  return field.label;
}

function exampleScalarValue(field: GrpcFieldSchema): unknown {
  if (field.isMap) return {};
  if (field.label === 'repeated') return [];

  if (field.type === 'string' || field.type === 'bytes') {
    const name = field.name.toLowerCase();
    if (name === 'id' || name.endsWith('_id') || name.endsWith('id')) return 'A-100';
    if (name.includes('message')) return 'hello';
    if (name.includes('name')) return 'demo';
    return 'string';
  }

  if (field.type === 'bool') return true;

  if (
    field.type === 'int32'
    || field.type === 'uint32'
    || field.type === 'sint32'
    || field.type === 'fixed32'
    || field.type === 'sfixed32'
    || field.type === 'float'
    || field.type === 'double'
  ) {
    return 1;
  }

  if (
    field.type === 'int64'
    || field.type === 'uint64'
    || field.type === 'sint64'
    || field.type === 'fixed64'
    || field.type === 'sfixed64'
  ) {
    return '1';
  }

  if (field.type === 'enum') return field.enumValues?.[0]?.number ?? 0;

  return null;
}

function buildExampleBodyFromType(
  descriptor: GrpcDescriptor,
  typeName: string,
  visited: Set<string>,
): Record<string, unknown> {
  const schema = lookupMessageSchema(descriptor, typeName);
  if (!schema || visited.has(typeName)) {
    return {};
  }

  const nextVisited = new Set(visited);
  nextVisited.add(typeName);

  const body: Record<string, unknown> = {};
  const oneofRendered = new Set<string>();
  for (const field of schema.fields) {
    if (field.isOneofMember && field.oneofName) {
      if (oneofRendered.has(field.oneofName)) {
        continue;
      }
      oneofRendered.add(field.oneofName);
    }

    if (field.type === 'message' && field.messageTypeName) {
      body[field.name] = buildExampleBodyFromType(descriptor, field.messageTypeName, nextVisited);
      continue;
    }

    body[field.name] = exampleScalarValue(field);
  }

  return body;
}

function preferredFieldForMinimalPayload(fields: GrpcFieldSchema[]): GrpcFieldSchema | undefined {
  const preferred = fields.find((field) => {
    const name = field.name.toLowerCase();
    return name === 'id' || name.endsWith('_id') || name.includes('message') || name.includes('name');
  });
  return preferred ?? fields[0];
}

function buildMinimalBodyFromType(
  descriptor: GrpcDescriptor,
  typeName: string,
  visited: Set<string>,
): Record<string, unknown> {
  const schema = lookupMessageSchema(descriptor, typeName);
  if (!schema || visited.has(typeName)) {
    return {};
  }

  const nextVisited = new Set(visited);
  nextVisited.add(typeName);

  const field = preferredFieldForMinimalPayload(schema.fields);
  if (!field) {
    return {};
  }

  if (field.type === 'message' && field.messageTypeName) {
    return {
      [field.name]: buildMinimalBodyFromType(descriptor, field.messageTypeName, nextVisited),
    };
  }

  return {
    [field.name]: exampleScalarValue(field),
  };
}

export function buildGrpcurlBodyTemplate(
  descriptor: GrpcDescriptor,
  method: GrpcMethodInfo,
  mode: GrpcurlBodyMode,
): Record<string, unknown> {
  if (mode === 'minimal') {
    return buildMinimalBodyFromType(descriptor, method.requestTypeName, new Set<string>());
  }
  return buildExampleBodyFromType(descriptor, method.requestTypeName, new Set<string>());
}

export function schemaTypeTestId(typeName: string): string {
  return typeName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
