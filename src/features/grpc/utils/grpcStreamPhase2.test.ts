/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import {
  appendGrpcStreamPendingBody,
  GRPC_STREAM_PENDING_QUEUE_CAP,
  previewGrpcStreamPendingBody,
  removeGrpcStreamPendingBodyAtIndex,
} from './grpcStreamPendingQueue';
import {
  buildGrpcStreamLogExportFilename,
  buildGrpcStreamLogExportPayload,
  downloadGrpcStreamLogExport,
} from './grpcStreamLogExport';

describe('grpcStreamPendingQueue', () => {
  it('appends and removes pending bodies', () => {
    const next = appendGrpcStreamPendingBody([], { message: 'a' });
    expect(next).toHaveLength(1);
    expect(removeGrpcStreamPendingBodyAtIndex(next, 0)).toEqual([]);
  });

  it('previews long JSON bodies', () => {
    const preview = previewGrpcStreamPendingBody({ message: 'x'.repeat(80) });
    expect(preview.endsWith('…')).toBe(true);
  });

  it('caps pending queue length', () => {
    let queue: Record<string, unknown>[] = [];
    for (let index = 0; index < GRPC_STREAM_PENDING_QUEUE_CAP + 5; index += 1) {
      queue = appendGrpcStreamPendingBody(queue, { index });
    }
    expect(queue).toHaveLength(GRPC_STREAM_PENDING_QUEUE_CAP);
    expect(queue[0]).toEqual({ index: 5 });
  });
});

describe('grpcStreamLogExport', () => {
  it('builds export payload with direction counts', () => {
    const payload = buildGrpcStreamLogExportPayload({
      messages: [
        {
          sequence: 1,
          timestamp: '2026-07-01T00:00:00.000Z',
          direction: 'outbound',
          data: { message: 'hi' },
        },
        {
          sequence: 2,
          timestamp: '2026-07-01T00:00:01.000Z',
          direction: 'inbound',
          data: { message: 'pong' },
        },
      ],
      service: 'echo.EchoService',
      method: 'ServerStream',
      callType: 'server_streaming',
    });

    expect(payload._meta.totalMessages).toBe(2);
    expect(payload._meta.inboundCount).toBe(1);
    expect(payload._meta.outboundCount).toBe(1);
    expect(payload.messages).toHaveLength(2);
  });

  it('builds safe export filenames', () => {
    expect(buildGrpcStreamLogExportFilename({
      service: 'echo.EchoService',
      method: 'ServerStream',
    })).toMatch(/^grpc-stream-echo-serverstream-\d+\.json$/);
  });

  it('downloads export payload via temporary anchor', async () => {
    vi.useFakeTimers();
    const click = vi.fn();
    const anchor = {
      href: '',
      download: '',
      click,
    } as unknown as HTMLAnchorElement;
    const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(anchor);
    const appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(() => anchor);
    const removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation(() => anchor);
    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:grpc-log');
    const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);

    const payload = buildGrpcStreamLogExportPayload({ messages: [] });
    downloadGrpcStreamLogExport(payload, 'grpc-stream-test.json');

    expect(createElementSpy).toHaveBeenCalledWith('a');
    expect(anchor.download).toBe('grpc-stream-test.json');
    expect(click).toHaveBeenCalledOnce();

    vi.runAllTimers();
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:grpc-log');

    vi.useRealTimers();
    createElementSpy.mockRestore();
    appendChildSpy.mockRestore();
    removeChildSpy.mockRestore();
    createObjectURLSpy.mockRestore();
    revokeObjectURLSpy.mockRestore();
  });
});
