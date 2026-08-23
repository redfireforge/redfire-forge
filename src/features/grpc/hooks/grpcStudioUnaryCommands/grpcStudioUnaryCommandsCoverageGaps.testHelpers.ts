import { vi } from 'vitest';
import {
  FIXTURE_DESCRIPTOR,
  FIXTURE_DESCRIPTOR_KEY,
  FIXTURE_CANCEL_SUCCESS_ENVELOPE,
} from '@shared/grpc/contractFixtures';
import {
  createEmptyTabDescriptorState,
  createGrpcStudioTab,
} from '../../grpcStudioTypes';
import * as grpcApiClient from '@shared/grpc/grpcApiClient';
import * as callHistoryCapture from '../../utils/grpcStudioCallHistoryCapture';
import * as streamHelpers from '../grpcStreamSessionHelpers';
import { createInitialSessionState } from '../grpcStudioSessionHelpers';
import type { GrpcStudioRuntimeContext } from '../grpcStudioRuntimeContext';

export function makeRuntime(sessionRef: { current: ReturnType<typeof createInitialSessionState> }): GrpcStudioRuntimeContext {
  const updateTab = vi.fn((tabId, patch) => {
    sessionRef.current = {
      ...sessionRef.current,
      tabs: sessionRef.current.tabs.map((tab) => (
        tab.id === tabId ? { ...tab, ...patch } : tab
      )),
    };
  });
  return {
    sessionRef,
    tabsRef: { current: sessionRef.current.tabs },
    setSession: vi.fn(),
    commitSession: (next) => next,
    descriptorLoadGenerationRef: { current: {} },
    callGenerationRef: { current: {} },
    streamGenerationRef: { current: {} },
    streamDisposeRef: { current: {} },
    inFlightCallRef: { current: {} },
    tabConnectionFingerprintRef: { current: {} },
    fireCancelInFlight: vi.fn(),
    envVarMap: {},
    profiles: [],
    globalAuthProfiles: [],
    defaultAuthProfileId: null,
    pageDefaults: { target: 'localhost:50051', tlsMode: 'disabled' },
    workspaceDefaults: { target: 'workspace:50051', tlsMode: 'disabled' },
    maxTabs: 8,
    updateTab,
    patchTabDescriptor: vi.fn(),
  };
}

export function makeCore(sessionRef: { current: ReturnType<typeof createInitialSessionState> }) {
  return {
    sessionRef,
    tabsRef: { current: sessionRef.current.tabs },
    commitSession: (next: typeof sessionRef.current) => {
      sessionRef.current = next;
      return next;
    },
    setSession: vi.fn((updater: typeof sessionRef.current | ((prev: typeof sessionRef.current) => typeof sessionRef.current)) => {
      sessionRef.current = typeof updater === 'function'
        ? updater(sessionRef.current)
        : updater;
    }),
    callGenerationRef: { current: {} as Record<string, number> },
    streamGenerationRef: { current: {} as Record<string, number> },
    streamDisposeRef: { current: {} as Record<string, () => void> },
    inFlightCallRef: { current: {} as Record<string, string> },
  };
}

export function configureUnaryTab(session: ReturnType<typeof createInitialSessionState>) {
  const tabId = session.activeTabId;
  session.tabs[0] = createGrpcStudioTab({
    id: tabId,
    target: 'localhost:50051',
    service: 'echo.EchoService',
    method: 'Echo',
    body: { message: 'hello' },
    descriptorKey: FIXTURE_DESCRIPTOR_KEY,
  });
  session.tabDescriptors[tabId] = {
    ...createEmptyTabDescriptorState(),
    descriptor: FIXTURE_DESCRIPTOR,
    loadState: 'loaded',
  };
  return tabId;
}

export function setupGrpcStudioUnaryCommandsCoverageGapsTest(): void {
  vi.mocked(grpcApiClient.postGrpcCall).mockReset();
  vi.mocked(grpcApiClient.deleteGrpcCall).mockReset();
  vi.mocked(callHistoryCapture.captureGrpcCallHistoryFromOutcome).mockReset();
  vi.mocked(streamHelpers.abortTabActiveStream).mockReset();
  vi.mocked(grpcApiClient.deleteGrpcCall).mockResolvedValue(FIXTURE_CANCEL_SUCCESS_ENVELOPE);
}
