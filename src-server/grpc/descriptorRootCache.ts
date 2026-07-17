import type protobuf from 'protobufjs';

const rootByDescriptorKey = new Map<string, protobuf.Root>();

export function setDescriptorRootCache(descriptorKey: string, root: protobuf.Root): void {
  rootByDescriptorKey.set(descriptorKey, root);
}

export function getDescriptorRootCache(descriptorKey: string): protobuf.Root | undefined {
  return rootByDescriptorKey.get(descriptorKey);
}

export function deleteDescriptorRootCache(descriptorKey: string): void {
  rootByDescriptorKey.delete(descriptorKey);
}

export function clearDescriptorRootCache(): void {
  rootByDescriptorKey.clear();
}
