import {
  clearGrpcTabTransportRegistration,
  syncGrpcTabTransportMode,
} from '../../../shared/grpc/grpcTransportTabRouting';
import type { GrpcStudioTabState } from '../grpcStudioTypes';
import { resolveGrpcStudioTabTransportMode } from '../grpcStudioTypes';

export function syncGrpcStudioTabTransport(tab: GrpcStudioTabState): void {
  syncGrpcTabTransportMode(tab.id, resolveGrpcStudioTabTransportMode(tab));
}

export function clearGrpcStudioTabTransport(tabId: string): void {
  clearGrpcTabTransportRegistration(tabId);
}
