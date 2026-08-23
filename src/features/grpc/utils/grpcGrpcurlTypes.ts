/**
 * Phase 5F/5G — shared grpcurl interop types and compatibility matrix.
 */
import type { GrpcTlsMode } from '@shared/grpc/contracts';

/** TLS material referenced by filesystem path (never PEM content in grpcurl CLI). */
export interface GrpcGrpcurlTlsFilePaths {
  certPath?: string;
  keyPath?: string;
  caCertPath?: string;
}

/** Descriptor source flags emitted by grpcurl or captured on import. */
export interface GrpcGrpcurlDescriptorFlags {
  protoPaths: string[];
  protosetPath?: string;
  importPaths: string[];
}

export interface GrpcGrpcurlExportOptions {
  targetAddress: string;
  serviceFullName: string;
  methodName: string;
  tlsMode?: GrpcTlsMode;
  body?: Record<string, unknown>;
  metadata?: Record<string, string>;
  serverNameOverride?: string;
  tlsFilePaths?: GrpcGrpcurlTlsFilePaths;
  descriptorFlags?: GrpcGrpcurlDescriptorFlags;
  includeSecretMetadata?: boolean;
  includeRedactedSecretMetadata?: boolean;
  includeRedactedSecretMetadataHints?: boolean;
}

export interface GrpcGrpcurlImportSuccess {
  ok: true;
  targetAddress: string;
  serviceFullName: string;
  methodName: string;
  tlsMode: GrpcTlsMode;
  body: Record<string, unknown>;
  metadata: Record<string, string>;
  serverNameOverride?: string;
  tlsFilePaths?: GrpcGrpcurlTlsFilePaths;
  descriptorFlags?: GrpcGrpcurlDescriptorFlags;
  unsupportedFlags: string[];
  warnings: string[];
}

export interface GrpcGrpcurlImportFailure {
  ok: false;
  error: string;
  unsupportedFlags: string[];
  warnings: string[];
}

export type GrpcGrpcurlImportResult = GrpcGrpcurlImportSuccess | GrpcGrpcurlImportFailure;

export interface GrpcGrpcurlFlagCompatRow {
  flag: string;
  studioField: string;
  importSupport: 'full' | 'partial' | 'none';
  exportSupport: 'full' | 'partial' | 'none';
  notes: string;
}

/** Documented grpcurl ↔ Studio mapping (Phase 5G deliverable). */
export const GRPC_GRPCURL_FLAG_COMPAT_MATRIX: readonly GrpcGrpcurlFlagCompatRow[] = [
  { flag: '-plaintext', studioField: 'tlsMode: disabled', importSupport: 'full', exportSupport: 'full', notes: 'Mutually exclusive with TLS cert flags' },
  { flag: '(no -plaintext)', studioField: 'tlsMode: tls | mtls', importSupport: 'full', exportSupport: 'full', notes: 'mtls when -cert and -key present on import' },
  { flag: '-cacert', studioField: 'tlsFilePaths.caCertPath', importSupport: 'full', exportSupport: 'partial', notes: 'Path only — PEM never embedded in export' },
  { flag: '-cert', studioField: 'tlsFilePaths.certPath', importSupport: 'full', exportSupport: 'partial', notes: 'Path only — load PEM via TLS modal' },
  { flag: '-key', studioField: 'tlsFilePaths.keyPath', importSupport: 'full', exportSupport: 'partial', notes: 'Path only — load PEM via TLS modal' },
  { flag: '-authority', studioField: 'tlsConfig.serverNameOverride', importSupport: 'full', exportSupport: 'full', notes: 'SNI / server name override' },
  { flag: '-proto', studioField: 'descriptorImport.protoPaths[]', importSupport: 'full', exportSupport: 'partial', notes: 'Repeated; emitted when export context supplies paths' },
  { flag: '-protoset', studioField: 'descriptorImport.protosetPath', importSupport: 'full', exportSupport: 'partial', notes: 'Single protoset file path' },
  { flag: '-import-path', studioField: 'descriptorImport.importPaths[]', importSupport: 'full', exportSupport: 'partial', notes: 'Repeated proto import roots' },
  { flag: '-H', studioField: 'metadata', importSupport: 'full', exportSupport: 'full', notes: 'Secret keys/values omitted on export; *-bin base64 preserved' },
  { flag: '-d', studioField: 'body', importSupport: 'full', exportSupport: 'full', notes: 'JSON object only in v1' },
  { flag: '-format', studioField: 'body format', importSupport: 'partial', exportSupport: 'none', notes: 'Only json supported on import' },
  { flag: '-insecure', studioField: '—', importSupport: 'none', exportSupport: 'none', notes: 'Reported as unsupported — use Studio TLS trust settings' },
  { flag: 'host:port', studioField: 'target', importSupport: 'full', exportSupport: 'full', notes: 'Supports {{envVar}} templates' },
  { flag: 'Service/Method', studioField: 'service + method', importSupport: 'full', exportSupport: 'full', notes: 'Full protobuf service name' },
] as const;

export interface GrpcGrpcurlExportContext {
  tlsFilePaths?: GrpcGrpcurlTlsFilePaths;
  descriptorFlags?: GrpcGrpcurlDescriptorFlags;
}
