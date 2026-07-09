/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { createInitialGrpcTabAdvancedFeaturesUiState } from '../grpcStudioAdvancedTypes';
import * as mockListenerClient from '../utils/grpcMockListenerClient';
import { buildAdvancedMock } from '../test-helpers/grpcAdvancedPanel.testHelpers';
import { GrpcMockServerPanel } from './GrpcMockServerPanel';

describe('GrpcMockServerPanel coverage gaps', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('wires network expose toggle and copies listen target', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    vi.spyOn(mockListenerClient, 'supportsGrpcMockNetworkListener').mockReturnValue(true);
    vi.spyOn(mockListenerClient, 'fetchGrpcMockNetworkListenerLogs').mockResolvedValue({
      entries: [],
      nextCursor: 0,
    });

    const patchMockExposeNetwork = vi.fn();

    render(
      <GrpcMockServerPanel
        advanced={buildAdvancedMock({
          patchMockExposeNetwork,
          mockServer: {
            rulesJson: '{"rules":[]}',
            exposeNetworkEndpoint: true,
            listenerStatus: {
              listenTarget: '127.0.0.1:50099',
              generation: 2,
              tabId: 'tab-ui',
            },
          },
        })}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-mock-expose-network'));
    expect(patchMockExposeNetwork).toHaveBeenCalledWith(false);

    fireEvent.click(screen.getByTestId('grpc-mock-copy-listen-target'));
    await Promise.resolve();
    expect(writeText).toHaveBeenCalledWith('127.0.0.1:50099');
    expect(screen.getByTestId('grpc-mock-listener-generation').textContent).toContain('2');
  });

  it('polls listener logs on the runtime tab while mock is running', async () => {
    vi.spyOn(mockListenerClient, 'supportsGrpcMockNetworkListener').mockReturnValue(true);
    vi.spyOn(mockListenerClient, 'fetchGrpcMockNetworkListenerLogs')
      .mockResolvedValueOnce({
        entries: [{
          id: 'log-1',
          event: 'request_matched',
          service: 'echo.EchoService',
          method: 'Echo',
          ruleName: 'Echo ok',
          timestamp: '2026-07-01T00:00:00.000Z',
        }],
        nextCursor: 1,
      })
      .mockResolvedValue({ entries: [], nextCursor: 1 });

    render(
      <GrpcMockServerPanel
        advanced={buildAdvancedMock({
          mockRunning: true,
          mockServer: { rulesJson: '{"rules":[]}' },
        })}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-mock-tab-runtime'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(900);
    });

    expect(screen.getByTestId('grpc-mock-listener-log-log-1')).toBeTruthy();
  });

  it('shows JSON editor parse and export errors', () => {
    render(
      <GrpcMockServerPanel
        advanced={buildAdvancedMock({
          advancedExportError: 'Clipboard denied',
          mockServer: {
            rulesJson: '{',
            parseError: 'Unexpected token',
          },
        })}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-mock-tab-json'));
    expect(screen.getByTestId('grpc-mock-parse-error').textContent).toMatch(/Unexpected token/i);
    expect(screen.getByTestId('grpc-mock-export-error').textContent).toMatch(/Clipboard denied/i);
    expect((screen.getByTestId('grpc-mock-export-json') as HTMLButtonElement).disabled).toBe(true);
  });

  it('skips clipboard copy when export helper returns empty', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(
      <GrpcMockServerPanel
        advanced={buildAdvancedMock({
          exportMockRulesJson: vi.fn(() => undefined),
          mockServer: { rulesJson: '{"rules":[]}' },
        })}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-mock-tab-json'));
    fireEvent.click(screen.getByTestId('grpc-mock-export-json'));
    await Promise.resolve();
    expect(writeText).not.toHaveBeenCalled();
  });

  it('clears listener logs when mock runtime stops', async () => {
    vi.spyOn(mockListenerClient, 'supportsGrpcMockNetworkListener').mockReturnValue(true);
    vi.spyOn(mockListenerClient, 'fetchGrpcMockNetworkListenerLogs').mockResolvedValue({
      entries: [{
        id: 'log-2',
        event: 'listener_started',
        timestamp: '2026-07-01T00:00:00.000Z',
      }],
      nextCursor: 1,
    });

    const { rerender } = render(
      <GrpcMockServerPanel
        advanced={buildAdvancedMock({
          mockRunning: true,
          mockServer: { rulesJson: '{"rules":[]}' },
        })}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-mock-tab-runtime'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(900);
      await vi.advanceTimersByTimeAsync(900);
    });
    expect(screen.getByTestId('grpc-mock-listener-log')).toBeTruthy();
    expect(screen.getAllByTestId('grpc-mock-listener-log-log-2')).toHaveLength(1);

    rerender(
      <GrpcMockServerPanel
        advanced={buildAdvancedMock({
          mockRunning: false,
          mockServer: { rulesJson: '{"rules":[]}' },
        })}
      />,
    );
    expect(screen.queryByTestId('grpc-mock-listener-log')).toBeNull();
  });

  it('shows runtime error detail and listener rows without rpc metadata', async () => {
    vi.spyOn(mockListenerClient, 'supportsGrpcMockNetworkListener').mockReturnValue(true);
    vi.spyOn(mockListenerClient, 'fetchGrpcMockNetworkListenerLogs')
      .mockResolvedValueOnce({
        entries: [{
          id: 'log-3',
          event: 'listener_stopped',
          timestamp: '2026-07-01T00:00:01.000Z',
        }],
        nextCursor: 2,
      })
      .mockResolvedValue({ entries: [], nextCursor: 2 });

    render(
      <GrpcMockServerPanel
        advanced={buildAdvancedMock({
          mockRunning: true,
          mockServer: { rulesJson: '{"rules":[]}' },
          runtime: {
            ...createInitialGrpcTabAdvancedFeaturesUiState().runtime,
            mockRuntime: {
              status: 'failed',
              cancellationRequested: false,
              error: { category: 'runtime', message: 'bind EADDRINUSE' },
            },
          },
        })}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-mock-tab-runtime'));
    expect(screen.getByText(/bind EADDRINUSE/i)).toBeTruthy();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(900);
    });
    expect(screen.getByTestId('grpc-mock-listener-log-log-3')).toBeTruthy();
  });
});
