import { vi, beforeEach } from 'vitest';
import { FIXTURE_DESCRIPTOR } from '../../../../shared/grpc/contractFixtures';
import { createEmptyTabDescriptorState } from '../../grpcStudioTypes';
import { createInitialSessionState } from '../grpcStudioSessionHelpers';
import type { GrpcStudioRuntimeContext } from '../grpcStudioRuntimeContext';
import * as descriptorFallback from '../../utils/descriptorSourceFallback';
import * as downloadProtoset from '../../utils/downloadProtoset';
import * as secretVault from '../../utils/grpcTabSecretVault';

export function makeRuntime(overrides: Partial<GrpcStudioRuntimeContext> = {}): GrpcStudioRuntimeContext {
  const session = createInitialSessionState();
  const sessionRef = { current: session };
  const updateTab = vi.fn((tabId, patch) => {
    sessionRef.current = {
      ...sessionRef.current,
      tabs: sessionRef.current.tabs.map((tab) => (
        tab.id === tabId ? { ...tab, ...patch } : tab
      )),
    };
  });
  const patchTabDescriptor = vi.fn((tabId, patch) => {
    sessionRef.current = {
      ...sessionRef.current,
      tabDescriptors: {
        ...sessionRef.current.tabDescriptors,
        [tabId]: {
          ...(sessionRef.current.tabDescriptors[tabId] ?? createEmptyTabDescriptorState()),
          ...patch,
        },
      },
    };
  });

  return {
    sessionRef,
    tabsRef: { current: session.tabs },
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
    pageDefaults: { target: 'localhost:50051', tlsMode: 'disabled' },
    maxTabs: 8,
    globalAuthProfiles: [],
    defaultAuthProfileId: null,
    updateTab,
    patchTabDescriptor,
    ...overrides,
  };
}

export function setupGrpcStudioDescriptorLoadCoverageGapsTest(): void {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(descriptorFallback.loadDescriptorWithAutoFallback).mockReset();
    vi.mocked(descriptorFallback.loadDescriptorWithAutoFallback).mockResolvedValue({
      descriptor: FIXTURE_DESCRIPTOR,
      source: 'reflection',
    });
    vi.mocked(downloadProtoset.downloadProtosetFile).mockReset();
    vi.mocked(secretVault.scheduleTabSecretsVaultSync).mockReset();
  });
}
