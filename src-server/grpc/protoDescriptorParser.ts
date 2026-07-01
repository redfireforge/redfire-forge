import protobuf from 'protobufjs';
import type { GrpcDescribeRequest } from '../../src/shared/grpc/contracts.js';
import {
  buildProtoFileMap,
  type ProtoFileInput,
} from './protoImportResolver.js';
import descriptor from 'protobufjs/ext/descriptor/index.js';
import {
  cacheProtoIngestRoot,
  computeProtoIngestFingerprint,
  createRootWithBundledWkt,
  getCachedProtoIngestRoot,
  parseUserProtoFilesIntoRoot,
} from './protoFileDescriptorPool.js';

export type { ProtoFileInput };

export { ProtoImportResolutionError } from './protoImportResolver.js';

export function parseProtoFiles(
  protoFiles: ProtoFileInput[],
  importPaths: string[] = [],
): protobuf.Root {
  if (!protoFiles.length) {
    throw new Error('protoFiles must contain at least one file');
  }

  const fingerprint = computeProtoIngestFingerprint(protoFiles, importPaths);
  const cached = getCachedProtoIngestRoot(fingerprint);
  if (cached) {
    return cached;
  }

  const fileMap = buildProtoFileMap({ protoFiles, importPaths, includeWktBundle: true });
  const root = createRootWithBundledWkt(fileMap, importPaths);
  parseUserProtoFilesIntoRoot(root, protoFiles, fileMap, importPaths);
  cacheProtoIngestRoot(fingerprint, root);
  return root;
}

export function parseProtosetBase64(protosetBase64: string): protobuf.Root {
  let buffer: Buffer;
  try {
    buffer = Buffer.from(protosetBase64.trim(), 'base64');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid protosetBase64: ${message}`);
  }
  if (buffer.length === 0) {
    throw new Error('protosetBase64 decoded to an empty buffer');
  }

  let fileDescriptorSet: ReturnType<typeof descriptor.FileDescriptorSet.decode>;
  try {
    fileDescriptorSet = descriptor.FileDescriptorSet.decode(buffer);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to decode protoset: ${message}`);
  }
  if (!fileDescriptorSet.file?.length) {
    throw new Error('protoset contains no file descriptors');
  }

  try {
    const root = protobuf.Root.fromDescriptor(fileDescriptorSet);
    root.resolveAll();
    return root;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to load protoset descriptor: ${message}`);
  }
}

export function parseDescribeRequestSource(request: GrpcDescribeRequest): protobuf.Root {
  if (request.source === 'proto_files') {
    return parseProtoFiles(
      request.protoFiles ?? [],
      request.importPaths ?? [],
    );
  }
  if (request.source === 'protoset') {
    if (!request.protosetBase64?.trim()) {
      throw new Error('protosetBase64 is required when source is protoset');
    }
    return parseProtosetBase64(request.protosetBase64);
  }
  throw new Error(`Unsupported describe source: ${request.source as string}`);
}

export function encodeRootAsProtosetBase64(root: protobuf.Root): string {
  root.resolveAll();
  const fileDescriptorSet = root.toDescriptor('proto3');
  return Buffer.from(descriptor.FileDescriptorSet.encode(fileDescriptorSet).finish()).toString('base64');
}
