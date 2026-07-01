/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import {
  buildGrpcStreamLogExportFilename,
  buildGrpcStreamLogExportPayload,
  downloadGrpcStreamLogExport,
} from './grpcStreamLogExport';

describe('grpcStreamLogExport', () => {
  it('buildGrpcStreamLogExportPayload counts inbound and outbound messages', () => {
    const payload = buildGrpcStreamLogExportPayload({
      service: 'echo.EchoService',
      method: 'ServerStream',
      callType: 'server_streaming',
      streamLifecycle: 'ended',
      startedAt: '2026-07-01T00:00:00.000Z',
      endedAt: '2026-07-01T00:00:01.000Z',
      messages: [
        { sequence: 1, timestamp: 't1', direction: 'inbound', data: { msg: 'a' } },
        { sequence: 2, timestamp: 't2', direction: 'outbound', data: { msg: 'b' } },
        { sequence: 3, timestamp: 't3', direction: 'outbound', data: { msg: 'c' } },
      ],
    });
    expect(payload._meta.totalMessages).toBe(3);
    expect(payload._meta.inboundCount).toBe(1);
    expect(payload._meta.outboundCount).toBe(2);
    expect(payload.messages).toHaveLength(3);
  });

  it('buildGrpcStreamLogExportFilename handles dotted services and sanitizes parts', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    expect(buildGrpcStreamLogExportFilename({
      service: 'echo.EchoService',
      method: 'ServerStream',
    })).toBe('grpc-stream-echo-serverstream-1700000000000.json');
    expect(buildGrpcStreamLogExportFilename({
      service: 'PlainService',
      method: 'Echo',
    })).toBe('grpc-stream-plain-echo-1700000000000.json');
    expect(buildGrpcStreamLogExportFilename({})).toMatch(/^grpc-stream-grpc-stream-\d+\.json$/);
    expect(buildGrpcStreamLogExportFilename({
      service: '!!!',
      method: '$$$',
    })).toBe('grpc-stream-grpc-stream-1700000000000.json');
    vi.restoreAllMocks();
  });

  it('downloadGrpcStreamLogExport creates anchor and revokes object url', () => {
    vi.useFakeTimers();
    const click = vi.fn();
    const anchor = { href: '', download: '', click } as HTMLAnchorElement;
    const createElement = vi.spyOn(document, 'createElement').mockReturnValue(anchor);
    const appendChild = vi.spyOn(document.body, 'appendChild').mockImplementation(() => anchor);
    const removeChild = vi.spyOn(document.body, 'removeChild').mockImplementation(() => anchor);
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    downloadGrpcStreamLogExport({
      _meta: {
        exportedAt: '2026-07-01T00:00:00.000Z',
        totalMessages: 0,
        inboundCount: 0,
        outboundCount: 0,
      },
      messages: [],
    }, 'export.json');

    expect(anchor.download).toBe('export.json');
    expect(click).toHaveBeenCalled();
    vi.runAllTimers();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:test');

    createElement.mockRestore();
    appendChild.mockRestore();
    removeChild.mockRestore();
    createObjectURL.mockRestore();
    revokeObjectURL.mockRestore();
    vi.useRealTimers();
  });
});
