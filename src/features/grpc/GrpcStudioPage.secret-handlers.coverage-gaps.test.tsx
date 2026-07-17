/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GrpcStudioPage } from './GrpcStudioPage';
import { resetGrpcTabCounterForTests } from './grpcStudioTypes';
import * as grpcTabSecretVault from './utils/grpcTabSecretVault';
import * as useGrpcStudioModule from './hooks/useGrpcStudio';

vi.mock('./hooks/useGrpcStudio', async (importOriginal) => {
  const actual = await importOriginal<typeof useGrpcStudioModule>();
  return {
    ...actual,
    useGrpcStudio: (options?: Parameters<typeof actual.useGrpcStudio>[0]) => {
      const hook = actual.useGrpcStudio(options);
      return {
        ...hook,
        activeTab: {
          ...hook.activeTab,
          tlsMode: 'tls' as const,
          tlsConfig: { serverCaPem: 'stored-ca' },
          auth: { type: 'bearer' as const, bearerToken: 'stored-token' },
          maskedSecretFields: {
            tls: { serverCaPem: true },
            auth: { bearerToken: true },
          },
        },
      };
    },
  };
});

describe('GrpcStudioPage secret handler coverage gaps', () => {
  beforeEach(() => {
    resetGrpcTabCounterForTests();
    vi.restoreAllMocks();
  });

  it('unmasks and clears TLS secrets from the TLS modal', async () => {
    const clearSpy = vi.spyOn(grpcTabSecretVault, 'clearTabTlsSecretField').mockResolvedValue({
      tlsConfig: { serverCaPem: '' },
      maskedSecretFields: undefined,
    });

    render(<GrpcStudioPage resolvedBaseUrl="localhost:50051" />);
    fireEvent.click(screen.getByTestId('grpc-tls-badge'));
    await waitFor(() => expect(screen.getByTestId('grpc-tls-body')).toBeTruthy());
    expect(screen.getByTestId('grpc-tls-server-ca-stored-hint')).toBeTruthy();

    fireEvent.change(screen.getByTestId('grpc-tls-server-ca'), { target: { value: 'edited' } });
    fireEvent.click(screen.getByTestId('grpc-tls-server-ca-clear'));
    await waitFor(() => expect(clearSpy).toHaveBeenCalled());
  });

  it('unmasks and clears auth secrets from the auth tab', async () => {
    const clearSpy = vi.spyOn(grpcTabSecretVault, 'clearTabAuthSecretField').mockResolvedValue({
      auth: { type: 'bearer', bearerToken: '' },
      maskedSecretFields: undefined,
    });

    render(<GrpcStudioPage resolvedBaseUrl="localhost:50051" />);
    fireEvent.click(screen.getByTestId('grpc-auth-badge'));
    await waitFor(() => expect(screen.getByTestId('grpc-auth-bearer-token-stored-hint')).toBeTruthy());

    fireEvent.change(screen.getByTestId('grpc-auth-bearer-token'), { target: { value: 'edited' } });
    fireEvent.click(screen.getByTestId('grpc-auth-bearer-token-clear'));
    await waitFor(() => expect(clearSpy).toHaveBeenCalled());
  });
});
