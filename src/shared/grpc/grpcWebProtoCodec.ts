/**
 * Browser protoset protobuf encode/decode — Phase 10C.
 *
 * Loads FileDescriptorSet bytes (via Express export) and encodes/decodes messages
 * for grpc-web browser-direct transport.
 */
import protobuf from 'protobufjs';
import descriptor from 'protobufjs/ext/descriptor/index.js';

const FileDescriptorSetCodec = (descriptor as unknown as {
  FileDescriptorSet: {
    decode: (buffer: Uint8Array) => { file?: unknown[] };
  };
}).FileDescriptorSet;

const rootFromDescriptor = (protobuf.Root as unknown as {
  fromDescriptor: (set: unknown) => protobuf.Root;
}).fromDescriptor;

const rootCache = new Map<string, protobuf.Root>();

function cacheKey(protosetBase64: string): string {
  return protosetBase64.trim();
}

export function base64ToUint8Array(base64: string): Uint8Array {
  const trimmed = base64.trim();
  if (!trimmed) {
    return new Uint8Array(0);
  }
  const binary = atob(trimmed);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export function loadProtobufRootFromProtosetBase64(protosetBase64: string): protobuf.Root {
  const key = cacheKey(protosetBase64);
  const cached = rootCache.get(key);
  if (cached) {
    return cached;
  }

  const buffer = base64ToUint8Array(protosetBase64);
  if (buffer.length === 0) {
    throw new Error('protosetBase64 decoded to an empty buffer');
  }

  let fileDescriptorSet: { file?: unknown[] };
  try {
    fileDescriptorSet = FileDescriptorSetCodec.decode(buffer);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to decode protoset: ${message}`, { cause: error });
  }
  if (!fileDescriptorSet.file?.length) {
    throw new Error('protoset contains no file descriptors');
  }

  try {
    const root = rootFromDescriptor(fileDescriptorSet);
    root.resolveAll();
    rootCache.set(key, root);
    return root;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to load protoset descriptor: ${message}`, { cause: error });
  }
}

function lookupMessageType(root: protobuf.Root, typeName: string): protobuf.Type {
  const lookupCandidates = [
    typeName,
    typeName.startsWith('.') ? typeName.slice(1) : `.${typeName}`,
    typeName.split('.').pop() ?? typeName,
  ];
  const seen = new Set<string>();
  for (const candidate of lookupCandidates) {
    if (!candidate || seen.has(candidate)) continue;
    seen.add(candidate);
    try {
      return root.lookupType(candidate);
    } catch {
      // try next candidate
    }
  }
  throw new Error(`Type ${typeName} not found in protoset`);
}

function lookupService(root: protobuf.Root, serviceName: string): protobuf.Service {
  const lookupCandidates = [
    serviceName,
    serviceName.startsWith('.') ? serviceName.slice(1) : `.${serviceName}`,
    serviceName.split('.').pop() ?? serviceName,
  ];
  const seen = new Set<string>();
  for (const candidate of lookupCandidates) {
    if (!candidate || seen.has(candidate)) continue;
    seen.add(candidate);
    try {
      return root.lookupService(candidate);
    } catch {
      // try next candidate
    }
  }
  throw new Error(`Service ${serviceName} not found in protoset`);
}

export function resolveGrpcWebMethodTypes(
  root: protobuf.Root,
  service: string,
  method: string,
): { requestTypeName: string; responseTypeName: string } {
  const serviceType = lookupService(root, service);
  const methodDef = serviceType.methods[method]
    ?? serviceType.methodsArray.find((entry) => entry.name === method);
  if (!methodDef) {
    throw new Error(`Method ${method} not found on service ${service}`);
  }
  const requestType = methodDef.resolvedRequestType;
  const responseType = methodDef.resolvedResponseType;
  if (!requestType?.fullName || !responseType?.fullName) {
    throw new Error(`Method ${service}/${method} is missing resolved message types`);
  }
  const stripDot = (fullName: string) => (fullName.startsWith('.') ? fullName.slice(1) : fullName);
  return {
    requestTypeName: stripDot(requestType.fullName),
    responseTypeName: stripDot(responseType.fullName),
  };
}

export function encodeGrpcWebProtoMessage(
  protosetBase64: string,
  typeName: string,
  body: Record<string, unknown>,
): Uint8Array {
  const root = loadProtobufRootFromProtosetBase64(protosetBase64);
  const Type = lookupMessageType(root, typeName);
  const err = Type.verify(body);
  if (err) {
    throw new Error(`Invalid request body for ${typeName}: ${err}`);
  }
  const message = Type.create(body);
  return Uint8Array.from(Type.encode(message).finish());
}

export function decodeGrpcWebProtoMessage(
  protosetBase64: string,
  typeName: string,
  bytes: Uint8Array,
): Record<string, unknown> {
  const root = loadProtobufRootFromProtosetBase64(protosetBase64);
  const Type = lookupMessageType(root, typeName);
  const decoded = Type.decode(bytes);
  return Type.toObject(decoded, {
    longs: String,
    enums: String,
    bytes: String,
    defaults: true,
  }) as Record<string, unknown>;
}

export function clearGrpcWebProtoCodecCacheForTests(): void {
  rootCache.clear();
}
