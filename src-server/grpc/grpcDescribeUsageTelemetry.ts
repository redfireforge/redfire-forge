import type { GrpcDescribeRequest } from '../../src/shared/grpc/contracts.js';

export interface GrpcDescribeUsageTelemetrySnapshot {
  total: number;
  protoRoots: number;
  protoset: number;
  bsr: number;
  urlProto: number;
  lastUpdatedAt: number | null;
}

const usageTelemetry: GrpcDescribeUsageTelemetrySnapshot = {
  total: 0,
  protoRoots: 0,
  protoset: 0,
  bsr: 0,
  urlProto: 0,
  lastUpdatedAt: null,
};

function hasProtoRoots(request: GrpcDescribeRequest): boolean {
  return Array.isArray(request.protoRoots) && request.protoRoots.length > 0;
}

export function recordGrpcDescribeUsage(request: GrpcDescribeRequest): void {
  usageTelemetry.total += 1;
  usageTelemetry.lastUpdatedAt = Date.now();

  switch (request.source) {
    case 'proto_files': {
      if (hasProtoRoots(request)) usageTelemetry.protoRoots += 1;
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

export function getGrpcDescribeUsageTelemetrySnapshot(): GrpcDescribeUsageTelemetrySnapshot {
  return { ...usageTelemetry };
}

export function resetGrpcDescribeUsageTelemetry(): void {
  usageTelemetry.total = 0;
  usageTelemetry.protoRoots = 0;
  usageTelemetry.protoset = 0;
  usageTelemetry.bsr = 0;
  usageTelemetry.urlProto = 0;
  usageTelemetry.lastUpdatedAt = null;
}
