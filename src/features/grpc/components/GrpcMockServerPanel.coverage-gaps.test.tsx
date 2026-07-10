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

  it('shows companion-required mode, internal-only endpoint, and builder tab wiring', () => {
    vi.spyOn(mockListenerClient, 'supportsGrpcMockNetworkListener').mockReturnValue(false);

    const patchMockExposeNetwork = vi.fn();
    const patchMockRulesJson = vi.fn();
    const resetMockRulesToDefault = vi.fn();

    render(
      <GrpcMockServerPanel
        advanced={buildAdvancedMock({
          patchMockExposeNetwork,
          patchMockRulesJson,
          resetMockRulesToDefault,
          mockServer: {
            rulesJson: '{"rules":[{"id":"r1","name":"Echo ok","enabled":true,"priority":1,"predicate":{"kind":"method_equals","method":"Echo"},"response":{"statusCode":0}}]}',
            exposeNetworkEndpoint: false,
          },
        })}
      />,
    );

    expect(screen.getByText(/Companion required/i)).toBeTruthy();
    expect(screen.getByText(/requires the web companion server/i)).toBeTruthy();
    expect(screen.queryByTestId('grpc-mock-expose-network')).toBeNull();

    fireEvent.click(screen.getByTestId('grpc-mock-tab-json'));
    fireEvent.change(screen.getByTestId('grpc-mock-rules-json'), { target: { value: '{"rules":[]}' } });
    expect(patchMockRulesJson).toHaveBeenCalledWith('{"rules":[]}');

    fireEvent.click(screen.getByTestId('grpc-mock-reset-rules'));
    expect(resetMockRulesToDefault).toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('grpc-mock-tab-builder'));
    expect(screen.getByTestId('grpc-mock-authoring-tools')).toBeTruthy();
  });

  it('shows internal-only endpoint mode when network listener is supported but disabled', () => {
    vi.spyOn(mockListenerClient, 'supportsGrpcMockNetworkListener').mockReturnValue(true);

    render(
      <GrpcMockServerPanel
        advanced={buildAdvancedMock({
          mockServer: {
            rulesJson: '{"rules":[]}',
            exposeNetworkEndpoint: false,
          },
        })}
      />,
    );

    expect(screen.getByText(/Internal only/i)).toBeTruthy();
    expect(screen.getByTestId('grpc-mock-expose-network')).toBeTruthy();
  });

  it('copies rules JSON when export helper returns text and shows runtime hit badges', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(
      <GrpcMockServerPanel
        advanced={buildAdvancedMock({
          exportMockRulesJson: vi.fn(() => '{"rules":[{"id":"r1"}]}'),
          mockRunning: true,
          mockServer: {
            rulesJson: '{"rules":[{"id":"r1","name":"Echo ok","enabled":true,"priority":1,"predicate":{"kind":"method_equals","method":"Echo"},"response":{"statusCode":0}}]}',
            latencyPolicy: { defaultLatencyMs: 25, jitterMs: 5 },
          },
          mockManagerState: {
            committed: { generation: 3, tabId: 'tab-ui', rulesHash: 'abc' },
            ruleHitCounts: { r1: 2 },
            defaultHitCount: 1,
            missCount: 4,
          },
        })}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-mock-tab-json'));
    fireEvent.click(screen.getByTestId('grpc-mock-export-json'));
    await Promise.resolve();
    expect(writeText).toHaveBeenCalledWith('{"rules":[{"id":"r1"}]}');

    fireEvent.click(screen.getByTestId('grpc-mock-tab-runtime'));
    expect(screen.getByTestId('grpc-mock-generation').textContent).toContain('3');
    expect(screen.getByTestId('grpc-mock-hit-count-r1').className).toContain('grpc-mock-hit-badge--active');
    expect(screen.getByTestId('grpc-mock-hit-summary').textContent).toMatch(/Default: 1/);
    expect(screen.getByTestId('grpc-mock-hit-summary').textContent).toMatch(/No match: 4/);

    fireEvent.change(screen.getByTestId('grpc-mock-latency-default'), { target: { value: '40' } });
    fireEvent.change(screen.getByTestId('grpc-mock-latency-jitter'), { target: { value: '' } });
  });

  it('wires start/stop controls and listener log metadata rows', async () => {
    vi.spyOn(mockListenerClient, 'supportsGrpcMockNetworkListener').mockReturnValue(true);
    vi.spyOn(mockListenerClient, 'fetchGrpcMockNetworkListenerLogs')
      .mockResolvedValueOnce({
        entries: [{
          id: 'log-4',
          event: 'request_matched',
          service: 'echo.EchoService',
          method: 'Echo',
          ruleName: 'Echo ok',
          timestamp: '2026-07-01T00:00:02.000Z',
        }],
        nextCursor: 3,
      })
      .mockResolvedValue({ entries: [], nextCursor: 3 });

    const startMockServer = vi.fn();
    const stopMockServer = vi.fn();
    const patchMockLatency = vi.fn();
    const patchMockExposeNetwork = vi.fn();

    const { rerender } = render(
      <GrpcMockServerPanel
        advanced={buildAdvancedMock({
          startMockServer,
          stopMockServer,
          patchMockLatency,
          patchMockExposeNetwork,
          mockServer: {
            rulesJson: '{"rules":[{"id":"r1","name":"Echo ok","enabled":false,"priority":1,"predicate":{"kind":"method_equals","method":"Echo"},"response":{"statusCode":0}}]}',
            exposeNetworkEndpoint: true,
            listenerStatus: { listenTarget: '127.0.0.1:50100', generation: 0, tabId: 'tab-ui' },
          },
        })}
      />,
    );

    expect(screen.getByText(/External \+ internal/i)).toBeTruthy();
    fireEvent.click(screen.getByTestId('grpc-mock-start-btn'));
    expect(startMockServer).toHaveBeenCalled();
    expect(screen.queryByTestId('grpc-mock-listener-generation')).toBeNull();

    rerender(
      <GrpcMockServerPanel
        advanced={buildAdvancedMock({
          stopMockServer,
          patchMockExposeNetwork,
          mockRunning: true,
          mockServer: {
            rulesJson: '{"rules":[{"id":"r1","name":"Echo ok","enabled":true,"priority":1,"predicate":{"kind":"method_equals","method":"Echo"},"response":{"statusCode":0}}]}',
            exposeNetworkEndpoint: true,
          },
        })}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-mock-stop-btn'));
    expect(stopMockServer).toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('grpc-mock-tab-runtime'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(900);
    });
    expect(screen.getByTestId('grpc-mock-listener-log-log-4').textContent).toMatch(/Echo ok/);
    expect(screen.getByTestId('grpc-mock-listener-log-log-4').textContent).toMatch(/echo\.EchoService\/Echo/);

    fireEvent.click(screen.getByTestId('grpc-mock-expose-network'));
    expect(patchMockExposeNetwork).toHaveBeenCalledWith(false);
  });

  it('uses singular hit labels, miss-only summary, and empty-listener placeholder', async () => {
    vi.spyOn(mockListenerClient, 'supportsGrpcMockNetworkListener').mockReturnValue(true);
    vi.spyOn(mockListenerClient, 'fetchGrpcMockNetworkListenerLogs').mockResolvedValue({
      entries: [],
      nextCursor: 0,
    });

    render(
      <GrpcMockServerPanel
        advanced={buildAdvancedMock({
          mockRunning: true,
          mockServer: {
            rulesJson: '{"rules":[{"id":"r1","name":"Echo ok","enabled":true,"priority":1,"predicate":{"kind":"method_equals","method":"Echo"},"response":{"statusCode":0}}]}',
          },
          mockManagerState: {
            ruleHitCounts: { r1: 1 },
            defaultHitCount: 0,
            missCount: 2,
          },
        })}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-mock-tab-runtime'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(900);
    });
    expect(screen.getByTestId('grpc-mock-hit-count-r1').getAttribute('title')).toBe('1 hit since start');
    expect(screen.getByTestId('grpc-mock-hit-summary').textContent).toMatch(/No match: 2/);
    expect(screen.getByTestId('grpc-mock-hit-summary').textContent).not.toMatch(/Default:/);
    expect(screen.getByText(/Listener activity will appear here once external clients connect/i)).toBeTruthy();
  });
});
