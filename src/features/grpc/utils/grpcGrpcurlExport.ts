/**
 * Phase 5G — grpcurl export builders from Studio contexts + parity helpers.
 */
import type { GrpcTabExecuteSnapshot } from '@shared/grpc/contracts';
import { normalizeGrpcMetadata } from '@shared/grpc/contracts';
import { prepareGrpcExecuteRequestMetadata } from '@shared/grpc/grpcAuthPolicy';
import type { GrpcSavedRequest } from '@shared/grpc/grpcSavedRequest';
import { buildGrpcurlInvokeCommand } from './grpcGrpcurlCore';
import type {
  GrpcGrpcurlExportContext,
  GrpcGrpcurlImportSuccess,
} from './grpcGrpcurlTypes';

function sortedPathList(values: string[] | undefined): string[] {
  return values ? values.slice().sort((a, b) => a.localeCompare(b)) : [];
}

export function buildGrpcurlInvokeCommandFromSavedRequest(
  saved: GrpcSavedRequest,
  context?: GrpcGrpcurlExportContext,
): string {
  const targetAddress = saved.target?.trim() || '{{grpcHost}}';
  return buildGrpcurlInvokeCommand({
    targetAddress,
    serviceFullName: saved.service,
    methodName: saved.method,
    tlsMode: saved.tlsMode ?? 'disabled',
    body: saved.body,
    metadata: saved.metadata,
    serverNameOverride: saved.tlsConfig?.serverNameOverride,
    tlsFilePaths: context?.tlsFilePaths,
    descriptorFlags: context?.descriptorFlags,
  });
}

export function buildGrpcurlInvokeCommandFromSnapshot(
  snapshot: GrpcTabExecuteSnapshot,
  context?: GrpcGrpcurlExportContext,
): string {
  let effectiveMetadata: Record<string, string> | undefined = snapshot.metadata;
  try {
    effectiveMetadata = prepareGrpcExecuteRequestMetadata(snapshot.metadata, snapshot.auth) ?? snapshot.metadata;
  } catch {
    effectiveMetadata = snapshot.metadata;
  }

  return buildGrpcurlInvokeCommand({
    targetAddress: snapshot.target.address,
    serviceFullName: snapshot.service,
    methodName: snapshot.method,
    tlsMode: snapshot.target.tlsMode ?? 'disabled',
    body: snapshot.body,
    metadata: effectiveMetadata,
    serverNameOverride: snapshot.target.tlsConfig?.serverNameOverride,
    tlsFilePaths: context?.tlsFilePaths,
    descriptorFlags: context?.descriptorFlags,
    includeSecretMetadata: true,
    includeRedactedSecretMetadata: false,
    includeRedactedSecretMetadataHints: true,
  });
}

/** Use tab import hints only when the active tab matches the exported service/method. */
export function resolveGrpcurlExportContextForTabRequest(
  tab: { service?: string; method?: string; grpcurlExportContext?: GrpcGrpcurlExportContext },
  service: string,
  method: string,
): GrpcGrpcurlExportContext | undefined {
  if (tab.service !== service || tab.method !== method) return undefined;
  return tab.grpcurlExportContext;
}

/** Compare semantic fields after export → import (ignores flag ordering). */
export function compareGrpcGrpcurlSemanticParity(
  imported: GrpcGrpcurlImportSuccess,
  expected: {
    targetAddress: string;
    serviceFullName: string;
    methodName: string;
    tlsMode: GrpcGrpcurlImportSuccess['tlsMode'];
    body?: Record<string, unknown>;
    metadata?: Record<string, string>;
    serverNameOverride?: string;
    tlsFilePaths?: GrpcGrpcurlImportSuccess['tlsFilePaths'];
    descriptorFlags?: GrpcGrpcurlImportSuccess['descriptorFlags'];
  },
): string[] {
  const mismatches: string[] = [];
  if (imported.targetAddress !== expected.targetAddress) {
    mismatches.push(`targetAddress: ${imported.targetAddress} !== ${expected.targetAddress}`);
  }
  if (imported.serviceFullName !== expected.serviceFullName) {
    mismatches.push(`serviceFullName: ${imported.serviceFullName} !== ${expected.serviceFullName}`);
  }
  if (imported.methodName !== expected.methodName) {
    mismatches.push(`methodName: ${imported.methodName} !== ${expected.methodName}`);
  }
  if (imported.tlsMode !== expected.tlsMode) {
    mismatches.push(`tlsMode: ${imported.tlsMode} !== ${expected.tlsMode}`);
  }
  if (expected.serverNameOverride !== undefined
    && imported.serverNameOverride !== expected.serverNameOverride) {
    mismatches.push(`serverNameOverride: ${imported.serverNameOverride} !== ${expected.serverNameOverride}`);
  }
  if (expected.body !== undefined && JSON.stringify(imported.body) !== JSON.stringify(expected.body)) {
    mismatches.push('body mismatch');
  }
  if (expected.metadata !== undefined) {
    for (const [key, value] of Object.entries(normalizeGrpcMetadata(expected.metadata))) {
      if (imported.metadata[key] !== value) {
        mismatches.push(`metadata[${key}]: ${imported.metadata[key]} !== ${value}`);
      }
    }
  }
  if (expected.tlsFilePaths) {
    const left = imported.tlsFilePaths ?? {};
    for (const field of ['certPath', 'keyPath', 'caCertPath'] as const) {
      if (expected.tlsFilePaths[field] !== undefined && left[field] !== expected.tlsFilePaths[field]) {
        mismatches.push(`tlsFilePaths.${field} mismatch`);
      }
    }
  }
  if (expected.descriptorFlags) {
    const left = imported.descriptorFlags ?? { protoPaths: [], importPaths: [] };
    if (expected.descriptorFlags.protosetPath !== undefined
      && left.protosetPath !== expected.descriptorFlags.protosetPath) {
      mismatches.push('descriptorFlags.protosetPath mismatch');
    }
    if (expected.descriptorFlags.protoPaths !== undefined
      && JSON.stringify(sortedPathList(left.protoPaths))
        !== JSON.stringify(sortedPathList(expected.descriptorFlags.protoPaths))) {
      mismatches.push('descriptorFlags.protoPaths mismatch');
    }
    if (expected.descriptorFlags.importPaths !== undefined
      && JSON.stringify(sortedPathList(left.importPaths))
        !== JSON.stringify(sortedPathList(expected.descriptorFlags.importPaths))) {
      mismatches.push('descriptorFlags.importPaths mismatch');
    }
  }
  return mismatches;
}
