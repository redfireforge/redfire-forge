import type { Dispatch, MutableRefObject, RefObject, SetStateAction } from 'react';
import type { GrpcStudioTabState, GrpcTabDescriptorState } from '../grpcStudioTypes';
import type {
  GrpcConnectionProfile,
  GrpcTabConnectionPageDefaults,
} from '../utils/resolveGrpcTabConnection';
import type { GrpcStudioSessionState } from './grpcStudioSessionHelpers';

export interface GrpcStudioRuntimeContext {
  sessionRef: RefObject<GrpcStudioSessionState>;
  tabsRef: RefObject<GrpcStudioTabState[]>;
  setSession: Dispatch<SetStateAction<GrpcStudioSessionState>>;
  commitSession: (next: GrpcStudioSessionState) => GrpcStudioSessionState;
  descriptorLoadGenerationRef: MutableRefObject<Record<string, number>>;
  callGenerationRef: MutableRefObject<Record<string, number>>;
  streamGenerationRef: MutableRefObject<Record<string, number>>;
  streamDisposeRef: MutableRefObject<Record<string, () => void>>;
  inFlightCallRef: MutableRefObject<Record<string, string>>;
  tabConnectionFingerprintRef: MutableRefObject<Record<string, string>>;
  fireCancelInFlight: (tabId: string, requestId: string) => void;
  envVarMap: Record<string, string>;
  workspaceDefaults?: Record<string, string>;
  profiles: GrpcConnectionProfile[];
  pageDefaults: GrpcTabConnectionPageDefaults;
  maxTabs: number;
  updateTab: (
    tabId: string,
    patch: Partial<GrpcStudioTabState>,
    options?: { descriptorPatch?: Partial<GrpcTabDescriptorState> },
  ) => void;
  patchTabDescriptor: (tabId: string, patch: Partial<GrpcTabDescriptorState>) => void;
}
