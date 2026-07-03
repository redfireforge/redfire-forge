import type { GrpcDescribeRequest } from '../../src/shared/grpc/contracts.js';

export interface GrpcDescribeUsageTelemetrySnapshot {
  total: number;
  protoRoots: number;
  protoFilesLegacy: number;
  protoRootsAndProtoFiles: number;
  protoset: number;
  bsr: number;
  urlProto: number;
  lastUpdatedAt: number | null;
}

const usageTelemetry: GrpcDescribeUsageTelemetrySnapshot = {
  total: 0,
  protoRoots: 0,
  protoFilesLegacy: 0,
  protoRootsAndProtoFiles: 0,
  protoset: 0,
  bsr: 0,
  urlProto: 0,
  lastUpdatedAt: null,
};

let loggedLegacyProtoFilesDeprecation = false;

function hasProtoRoots(request: GrpcDescribeRequest): boolean {
  return Array.isArray(request.protoRoots) && request.protoRoots.length > 0;
}

function hasLegacyProtoFiles(request: GrpcDescribeRequest): boolean {
  return Array.isArray(request.protoFiles) && request.protoFiles.length > 0;
}

export function isLegacyProtoFilesOnlyDescribeRequest(request: GrpcDescribeRequest): boolean {
  return request.source === 'proto_files'
    && hasLegacyProtoFiles(request)
    && !hasProtoRoots(request);
}

export function recordGrpcDescribeUsage(request: GrpcDescribeRequest): void {
  usageTelemetry.total += 1;
  usageTelemetry.lastUpdatedAt = Date.now();

  switch (request.source) {
    case 'proto_files': {
      const roots = hasProtoRoots(request);
      const legacyFiles = hasLegacyProtoFiles(request);
      if (roots) usageTelemetry.protoRoots += 1;
      if (legacyFiles) usageTelemetry.protoFilesLegacy += 1;
      if (roots && legacyFiles) usageTelemetry.protoRootsAndProtoFiles += 1;
      break;
    }
    case 'protoset':
      usageTelemetry.protoset += 1;
      break;
    case 'bsr':
      usageTelemetry.bsr += 1;
      break;
    case 'url_proto':
      usageTelemetry.urlProto += 1;
      break;
    default:
      break;
  }
}

export function shouldLogLegacyProtoFilesDeprecation(): boolean {
  if (loggedLegacyProtoFilesDeprecation) return false;
  loggedLegacyProtoFilesDeprecation = true;
  return true;
}

export function getGrpcDescribeUsageTelemetrySnapshot(): GrpcDescribeUsageTelemetrySnapshot {
  return { ...usageTelemetry };
}

export function resetGrpcDescribeUsageTelemetry(): void {
  usageTelemetry.total = 0;
  usageTelemetry.protoRoots = 0;
  usageTelemetry.protoFilesLegacy = 0;
  usageTelemetry.protoRootsAndProtoFiles = 0;
  usageTelemetry.protoset = 0;
  usageTelemetry.bsr = 0;
  usageTelemetry.urlProto = 0;
  usageTelemetry.lastUpdatedAt = null;
  loggedLegacyProtoFilesDeprecation = false;
}
