import type { GrpcHybridSchemaComplexityBucket } from '../../utils/grpcHybridTelemetry';

export function stringifyUnknown(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function hashTabId(tabId: string): string {
  let hash = 0;
  for (let i = 0; i < tabId.length; i += 1) {
    hash = (hash * 31 + tabId.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16);
}

export function schemaComplexityBucket(fieldCount: number): GrpcHybridSchemaComplexityBucket {
  if (fieldCount <= 20) return 'small';
  if (fieldCount <= 80) return 'medium';
  return 'large';
}
