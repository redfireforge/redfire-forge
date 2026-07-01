import type { GrpcDescriptor } from '../../src/shared/grpc/contracts.js';
import { clearDynamicProtoCodecCache } from './dynamicProtoCodec.js';
import { clearDescriptorRootCache, deleteDescriptorRootCache } from './descriptorRootCache.js';

const store = new Map<string, GrpcDescriptor>();

export function getGrpcDescriptor(key: string): GrpcDescriptor | undefined {
  return store.get(key);
}

export function setGrpcDescriptor(descriptor: GrpcDescriptor): void {
  store.set(descriptor.key, descriptor);
  clearDynamicProtoCodecCache();
}

export function hasGrpcDescriptor(key: string): boolean {
  return store.has(key);
}

export function deleteGrpcDescriptor(key: string): boolean {
  const removed = store.delete(key);
  if (removed) {
    deleteDescriptorRootCache(key);
    clearDynamicProtoCodecCache();
  }
  return removed;
}

/** Test helper — clears interim descriptor cache. */
export function clearGrpcDescriptorStore(): void {
  store.clear();
  clearDescriptorRootCache();
  clearDynamicProtoCodecCache();
}
