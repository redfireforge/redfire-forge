/**
 * Shared setup for GrpcStudioPage coverage-gap integration tests.
 */
import { act, fireEvent, screen, within } from '@testing-library/react';
import { beforeEach, vi } from 'vitest';
import { setGrpcClientTransport } from '@shared/grpc/grpcApiClient';
import { setGrpcStreamTransport } from '@shared/grpc/grpcStreamClient';
import { clearGrpcStudioPersistence } from '../hooks/useGrpcStudioPersistence';
import { resetGrpcTabCounterForTests } from '../grpcStudioTypes';
import { resetGrpcTabSecretVaultForTests } from '../utils/grpcTabSecretVault';

export function grpcStudioTabs() {
  return within(screen.getByTestId('grpc-tab-bar'));
}

export async function clickByTestId(testId: string) {
  await act(async () => {
    fireEvent.click(screen.getByTestId(testId));
  });
}

export function setupGrpcStudioPageCoverageGapsTest(downloadProtosetFileMock: { mockReset: () => void }): void {
  const originalConsoleError = console.error;

  beforeEach(() => {
    vi.restoreAllMocks();
    downloadProtosetFileMock.mockReset();
    resetGrpcTabCounterForTests();
    resetGrpcTabSecretVaultForTests();
    clearGrpcStudioPersistence();
    setGrpcClientTransport(null);
    setGrpcStreamTransport(null);
    vi.spyOn(console, 'error').mockImplementation((...args: Parameters<typeof console.error>) => {
      const message = args.map((part) => String(part)).join(' ');
      if (
        message.includes('not wrapped in act(')
        || message.includes('Not implemented: navigation to another Document')
      ) {
        return;
      }
      originalConsoleError(...args);
    });
  });
}
