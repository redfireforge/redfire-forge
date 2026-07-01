/**
 * Coverage gaps — buildGrpcNodeOperations.ts
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FIXTURE_SERVER_STREAM_START_REQUEST } from './contractFixtures';

const invokeGrpcUnaryMock = vi.fn();
const collectGrpcWorkflowServerStreamMock = vi.fn();
const retainMock = vi.fn();

vi.mock('./grpcTransportFacade', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./grpcTransportFacade')>();
  return {
    ...actual,
    invokeGrpcUnary: (...args: unknown[]) => invokeGrpcUnaryMock(...args),
    retainGrpcNativeTransport: (...args: unknown[]) => retainMock(...args),
  };
});

vi.mock('../../features/workflow/utils/grpcWorkflowStreamCollector', () => ({
  collectGrpcWorkflowServerStream: (...args: unknown[]) => collectGrpcWorkflowServerStreamMock(...args),
}));

vi.mock('../utils/platform', () => ({
  isTauri: vi.fn(() => false),
}));

import { isTauri } from '../utils/platform';

describe('buildGrpcNodeOperations coverage gaps', () => {
  beforeEach(async () => {
    vi.resetModules();
    retainMock.mockClear();
    invokeGrpcUnaryMock.mockReset();
    collectGrpcWorkflowServerStreamMock.mockReset();
  });

  it('retains native transport only once across repeated builds on tauri', async () => {
    vi.mocked(isTauri).mockReturnValue(true);
    const { buildGrpcNodeOperations } = await import('./buildGrpcNodeOperations');
    buildGrpcNodeOperations();
    buildGrpcNodeOperations();
    expect(retainMock).toHaveBeenCalledTimes(1);
  });

  it('does not retain native transport outside tauri', async () => {
    vi.mocked(isTauri).mockReturnValue(false);
    vi.resetModules();
    retainMock.mockClear();
    const { buildGrpcNodeOperations } = await import('./buildGrpcNodeOperations');
    buildGrpcNodeOperations();
    expect(retainMock).not.toHaveBeenCalled();
  });

  it('collectServerStream delegates to collectGrpcWorkflowServerStream', async () => {
    collectGrpcWorkflowServerStreamMock.mockResolvedValueOnce({
      messages: [{ n: 1 }],
      durationMs: 10,
      grpcStatus: 0,
      grpcStatusMessage: 'OK',
      trailers: {},
      stopReason: 'max_messages',
    });

    const { buildGrpcNodeOperations } = await import('./buildGrpcNodeOperations');
    const ops = buildGrpcNodeOperations();
    const controller = new AbortController();
    const result = await ops.collectServerStream(
      FIXTURE_SERVER_STREAM_START_REQUEST,
      'workflow:node-1',
      { maxMessages: 1 },
      { abortSignal: controller.signal },
    );

    expect(collectGrpcWorkflowServerStreamMock).toHaveBeenCalledWith(
      FIXTURE_SERVER_STREAM_START_REQUEST,
      'workflow:node-1',
      { maxMessages: 1 },
      { abortSignal: controller.signal },
    );
    expect(result.messages).toEqual([{ n: 1 }]);
  });

  it('invokeUnary forwards errorDetail from envelope data', async () => {
    invokeGrpcUnaryMock.mockResolvedValueOnce({
      ok: true,
      op: 'call',
      data: {
        status: 0,
        statusMessage: 'OK',
        headers: { h: '1' },
        trailers: { t: '2' },
        body: { message: 'ok' },
        durationMs: 10,
        errorDetail: 'ignored-on-success',
      },
    });

    const { buildGrpcNodeOperations } = await import('./buildGrpcNodeOperations');
    const ops = buildGrpcNodeOperations();
    const result = await ops.invokeUnary({
      requestId: 'req-1',
      target: { address: 'localhost:50051', tlsMode: 'disabled' },
      descriptorKey: 'dk',
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: 'hi' },
    }, 'workflow:node-1');

    expect(result.errorDetail).toBe('ignored-on-success');
    expect(result.headers).toEqual({ h: '1' });
  });
});
