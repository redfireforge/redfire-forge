import { act } from '@testing-library/react';
import { vi } from 'vitest';
import { FIXTURE_DESCRIPTOR } from '../../../shared/grpc/contractFixtures';
import { setGrpcClientTransport } from '../../../shared/grpc/grpcApiClient';
import { setGrpcStreamTransport } from '../../../shared/grpc/grpcStreamClient';
import { resetGrpcTabCounterForTests } from '../grpcStudioTypes';
import type { useGrpcStudio } from './useGrpcStudio';

export const PAGE_DEFAULTS = { target: 'localhost:50051', tlsMode: 'disabled' as const };

export interface UseGrpcStudioTestSetupOptions {
  stream?: boolean;
  restoreMocks?: boolean;
}

/** Shared hook test reset — call from `beforeEach` in split useGrpcStudio test files. */
export function setupUseGrpcStudioHookTest(options: UseGrpcStudioTestSetupOptions = {}): void {
  resetGrpcTabCounterForTests();
  setGrpcClientTransport(null);
  if (options.stream) {
    setGrpcStreamTransport(null);
    if (options.restoreMocks) {
      vi.restoreAllMocks();
    }
  }
}

export function seedUnaryReadyTab(
  result: { current: ReturnType<typeof useGrpcStudio> },
  patch: Record<string, unknown> = {},
): string {
  const tabId = result.current.activeTab.id;
  act(() => {
    result.current.updateTab(tabId, {
      target: 'localhost:50051',
      descriptorKey: FIXTURE_DESCRIPTOR.key,
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: 'hello' },
      metadata: { 'x-request-id': '1' },
      ...patch,
    });
  });
  return tabId;
}
