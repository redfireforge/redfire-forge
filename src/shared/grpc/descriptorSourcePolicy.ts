/**
 * Phase 3A — descriptor source selection policy and execution identity.
 * Shared by renderer tab state and src-server descriptor loaders (3B+).
 */
import type {
  GrpcDescriptor,
  GrpcDescriptorSource,
  GrpcDescriptorSourceFingerprint,
  GrpcDescriptorSourceSelection,
  GrpcDescriptorSelectionMode,
} from './contracts';

/** Default auto precedence from Phase 3 plan. */
export const DEFAULT_DESCRIPTOR_SOURCE_PRECEDENCE: readonly GrpcDescriptorSource[] = [
  'reflection',
  'proto_files',
  'protoset',
  'bsr',
  'url_proto',
] as const;

export interface GrpcDescriptorSourceAvailability {
  reflection?: boolean;
  proto_files?: boolean;
  protoset?: boolean;
  bsr?: boolean;
  url_proto?: boolean;
}

export interface ResolveDescriptorSourceInput {
  selection: GrpcDescriptorSourceSelection;
  availability: GrpcDescriptorSourceAvailability;
}

export interface ResolveDescriptorSourceResult {
  source: GrpcDescriptorSource | null;
  reason: 'manual' | 'auto_precedence' | 'unavailable';
}

export function createDefaultDescriptorSourceSelection(): GrpcDescriptorSourceSelection {
  return {
    mode: 'auto',
    autoPrecedence: [...DEFAULT_DESCRIPTOR_SOURCE_PRECEDENCE],
  };
}

export function normalizeDescriptorSourceSelection(
  selection?: Partial<GrpcDescriptorSourceSelection>,
): GrpcDescriptorSourceSelection {
  const mode: GrpcDescriptorSelectionMode = selection?.mode ?? 'auto';
  const autoPrecedence = selection?.autoPrecedence?.length
    ? [...selection.autoPrecedence]
    : [...DEFAULT_DESCRIPTOR_SOURCE_PRECEDENCE];
  return {
    mode,
    activeSource: selection?.activeSource,
    autoPrecedence,
  };
}

export function isDescriptorSourceAvailable(
  source: GrpcDescriptorSource,
  availability: GrpcDescriptorSourceAvailability,
): boolean {
  switch (source) {
    case 'reflection':
      return availability.reflection !== false;
    case 'proto_files':
      return availability.proto_files === true;
    case 'protoset':
      return availability.protoset === true;
    case 'bsr':
      return availability.bsr === true;
    case 'url_proto':
      return availability.url_proto === true;
    default:
      return false;
  }
}

/** Resolve which descriptor source to use for the next load attempt. */
export function resolveDescriptorSource(
  input: ResolveDescriptorSourceInput,
): ResolveDescriptorSourceResult {
  const selection = normalizeDescriptorSourceSelection(input.selection);

  if (selection.mode === 'manual') {
    const manual = selection.activeSource;
    if (!manual) {
      return { source: null, reason: 'unavailable' };
    }
    if (!isDescriptorSourceAvailable(manual, input.availability)) {
      return { source: null, reason: 'unavailable' };
    }
    return { source: manual, reason: 'manual' };
  }

  const precedence = selection.autoPrecedence ?? DEFAULT_DESCRIPTOR_SOURCE_PRECEDENCE;
  for (const source of precedence) {
    if (isDescriptorSourceAvailable(source, input.availability)) {
      return { source, reason: 'auto_precedence' };
    }
  }
  return { source: null, reason: 'unavailable' };
}

export type GrpcDescriptorPhaseFailureKind =
  | 'source_unavailable'
  | 'import_resolution_failed'
  | 'schema_drift'
  | 'cache_stale'
  | 'reflection_failed'
  | 'describe_failed';

/** Whether auto mode should try the next source after a failure. */
export function shouldAttemptDescriptorSourceFallback(
  mode: GrpcDescriptorSelectionMode,
  failure: GrpcDescriptorPhaseFailureKind,
): boolean {
  if (mode !== 'auto') {
    return false;
  }
  return failure === 'source_unavailable'
    || failure === 'reflection_failed'
    || failure === 'describe_failed';
}

export function buildDescriptorSourceFingerprint(
  descriptor: Pick<GrpcDescriptor, 'source' | 'sourceRef' | 'contentSha256'> & {
    reflectionVersion?: 'v1' | 'v1alpha';
  },
  extras?: Partial<Pick<GrpcDescriptorSourceFingerprint, 'etag' | 'bsrModule' | 'bsrDigest' | 'resolvedAt'>>,
): GrpcDescriptorSourceFingerprint {
  if (!descriptor.contentSha256?.trim()) {
    throw new Error('contentSha256 is required to build a descriptor source fingerprint');
  }
  return {
    source: descriptor.source,
    sourceRef: descriptor.sourceRef?.trim() || 'unknown',
    contentSha256: descriptor.contentSha256,
    reflectionVersion: descriptor.reflectionVersion,
    resolvedAt: extras?.resolvedAt ?? new Date().toISOString(),
    etag: extras?.etag,
    bsrModule: extras?.bsrModule,
    bsrDigest: extras?.bsrDigest,
  };
}

/** Prefer tab fingerprint, then descriptor fingerprint, then derive from descriptor content identity. */
export function resolveDescriptorSourceFingerprint(
  descriptor?: Pick<
    GrpcDescriptor,
    'source' | 'sourceRef' | 'contentSha256' | 'sourceFingerprint' | 'reflectionVersion'
  > | null,
  tabFingerprint?: GrpcDescriptorSourceFingerprint | null,
): GrpcDescriptorSourceFingerprint | undefined {
  if (tabFingerprint) {
    return tabFingerprint;
  }
  if (!descriptor) {
    return undefined;
  }
  if (descriptor.sourceFingerprint) {
    return descriptor.sourceFingerprint;
  }
  if (!descriptor.contentSha256?.trim()) {
    return undefined;
  }
  return buildDescriptorSourceFingerprint(descriptor);
}

export function formatDescriptorExecutionIdentity(
  descriptorKey: string,
  fingerprint?: GrpcDescriptorSourceFingerprint | null,
): string {
  const key = descriptorKey.trim();
  if (!fingerprint) {
    return key;
  }
  return `${key}@${fingerprint.source}:${fingerprint.sourceRef}:${fingerprint.contentSha256}`;
}

export function areDescriptorFingerprintsCompatible(
  left?: GrpcDescriptorSourceFingerprint | null,
  right?: GrpcDescriptorSourceFingerprint | null,
): boolean {
  if (!left || !right) {
    return !left && !right;
  }
  return left.source === right.source
    && left.sourceRef === right.sourceRef
    && left.contentSha256 === right.contentSha256;
}

export function isDescriptorExecutionIdentityCompatible(
  descriptorKey: string,
  fingerprint: GrpcDescriptorSourceFingerprint | undefined,
  descriptor: Pick<GrpcDescriptor, 'key' | 'sourceFingerprint' | 'contentSha256' | 'source' | 'sourceRef'>,
): boolean {
  if (descriptor.key !== descriptorKey) {
    return false;
  }
  if (!fingerprint) {
    return true;
  }
  const descriptorFingerprint = descriptor.sourceFingerprint
    ?? (descriptor.contentSha256
      ? buildDescriptorSourceFingerprint(descriptor)
      : undefined);
  return areDescriptorFingerprintsCompatible(fingerprint, descriptorFingerprint);
}
