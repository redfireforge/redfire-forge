import { vi } from 'vitest';
import { setGrpcClientTransport } from '../../../shared/grpc/grpcApiClient';
import { setGrpcStreamTransport } from '../../../shared/grpc/grpcStreamClient';
import { resetGrpcTabCounterForTests } from '../grpcStudioTypes';

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
