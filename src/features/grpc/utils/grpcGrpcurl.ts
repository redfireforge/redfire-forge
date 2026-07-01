/**
 * Phase 5F/5G — grpcurl interop (barrel re-export for Phase 4H callers).
 */
export {
  buildGrpcurlInvokeCommand,
  filterMetadataForGrpcurlExport,
  formatGrpcMethodSignature,
  formatGrpcStreamKeyword,
  grpcGrpcurlImportToTabPatch,
  normalizeGrpcurlCommandInput,
  parseGrpcurlCommand,
  tokenizeGrpcurlCommand,
} from './grpcGrpcurlCore';

export {
  buildGrpcurlInvokeCommandFromSavedRequest,
  buildGrpcurlInvokeCommandFromSnapshot,
  compareGrpcGrpcurlSemanticParity,
  resolveGrpcurlExportContextForTabRequest,
} from './grpcGrpcurlExport';

export {
  GRPC_GRPCURL_FLAG_COMPAT_MATRIX,
  type GrpcGrpcurlDescriptorFlags,
  type GrpcGrpcurlExportContext,
  type GrpcGrpcurlExportOptions,
  type GrpcGrpcurlFlagCompatRow,
  type GrpcGrpcurlImportFailure,
  type GrpcGrpcurlImportResult,
  type GrpcGrpcurlImportSuccess,
  type GrpcGrpcurlTlsFilePaths,
} from './grpcGrpcurlTypes';
