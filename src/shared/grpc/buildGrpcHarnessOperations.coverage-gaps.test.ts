/**
 * Coverage gaps — buildGrpcHarnessOperations.ts (Phase 8C bridge).
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { FIXTURE_SERVER_STREAM_START_REQUEST, FIXTURE_UNARY_CALL_REQUEST } from './contractFixtures';

const invokeUnary = vi.fn();
const collectGrpcHarnessServerStream = vi.fn();
const executeGrpcHarnessClientStream = vi.fn();
const executeGrpcHarnessBidiStream = vi.fn();

vi.mock('./buildGrpcNodeOperations', () => ({
  buildGrpcNodeOperations: () => ({ invokeUnary }),
}));

vi.mock('./grpcHarnessStreamCollector', () => ({
  collectGrpcHarnessServerStream,
  executeGrpcHarnessClientStream,
  executeGrpcHarnessBidiStream,
}));

describe('buildGrpcHarnessOperations coverage gaps', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  it('delegates invokeUnary to node operations', async () => {
    invokeUnary.mockResolvedValueOnce({ status: 0, statusMessage: 'OK' });
    const { buildGrpcHarnessOperations } = await import('./buildGrpcHarnessOperations');
    const ops = buildGrpcHarnessOperations();
    await ops.invokeUnary(FIXTURE_UNARY_CALL_REQUEST, 'tab-1');
    expect(invokeUnary).toHaveBeenCalledWith(FIXTURE_UNARY_CALL_REQUEST, 'tab-1');
  });

  it('delegates collectHarnessServerStream with collect config and abort signal', async () => {
    collectGrpcHarnessServerStream.mockResolvedValueOnce({ callType: 'server_streaming', passed: true });
    const { buildGrpcHarnessOperations } = await import('./buildGrpcHarnessOperations');
    const ops = buildGrpcHarnessOperations();
    const controller = new AbortController();
    const collect = { maxMessages: 3 };
    await ops.collectHarnessServerStream(
      FIXTURE_SERVER_STREAM_START_REQUEST,
      'tab-2',
      collect,
      { abortSignal: controller.signal },
    );
    expect(collectGrpcHarnessServerStream).toHaveBeenCalledWith(
      FIXTURE_SERVER_STREAM_START_REQUEST,
      'tab-2',
      collect,
      { abortSignal: controller.signal },
    );
  });

  it('delegates executeClientStream with send messages', async () => {
    executeGrpcHarnessClientStream.mockResolvedValueOnce({ callType: 'client_streaming', passed: true });
    const { buildGrpcHarnessOperations } = await import('./buildGrpcHarnessOperations');
    const ops = buildGrpcHarnessOperations();
    const messages = [{ message: 'one' }];
    await ops.executeClientStream(FIXTURE_SERVER_STREAM_START_REQUEST, 'tab-3', messages);
    expect(executeGrpcHarnessClientStream).toHaveBeenCalledWith(
      FIXTURE_SERVER_STREAM_START_REQUEST,
      'tab-3',
      messages,
      undefined,
    );
  });

  it('delegates executeBidiStream with collect bounds', async () => {
    executeGrpcHarnessBidiStream.mockResolvedValueOnce({ callType: 'bidi_streaming', passed: true });
    const { buildGrpcHarnessOperations } = await import('./buildGrpcHarnessOperations');
    const ops = buildGrpcHarnessOperations();
    const messages = [{ message: 'ping' }];
    const collect = { maxMessages: 5, maxDurationMs: 1000 };
    await ops.executeBidiStream(
      FIXTURE_SERVER_STREAM_START_REQUEST,
      'tab-4',
      messages,
      collect,
    );
    expect(executeGrpcHarnessBidiStream).toHaveBeenCalledWith(
      FIXTURE_SERVER_STREAM_START_REQUEST,
      'tab-4',
      messages,
      collect,
      undefined,
    );
  });
});
