import { describe, expect, it } from 'vitest';
import { parseGrpcSseStream, parseGrpcStreamEventJson } from './grpcStreamSseParser';

async function collectSseFrames(text: string) {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(text));
      controller.close();
    },
  });
  const frames = [];
  for await (const frame of parseGrpcSseStream(stream)) {
    frames.push(frame);
  }
  return frames;
}

describe('grpcStreamSseParser coverage gaps', () => {
  it('skips blank lines without data payload', async () => {
    const frames = await collectSseFrames('event: grpc-heartbeat\n\n\n');
    expect(frames).toEqual([]);
  });

  it('uses default message event type when event line is absent', async () => {
    const frames = await collectSseFrames('data: ping\n\n');
    expect(frames).toEqual([{ event: 'message', data: 'ping' }]);
  });

  it('parses trailing buffer without newline on stream close', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('event: grpc-end\ndata: done'));
        controller.close();
      },
    });
    const frames = [];
    for await (const frame of parseGrpcSseStream(stream)) {
      frames.push(frame);
    }
    expect(frames).toEqual([{ event: 'grpc-end', data: 'done' }]);
  });

  it('parseGrpcStreamEventJson parses JSON payloads', () => {
    expect(parseGrpcStreamEventJson('{"type":"grpc-message"}')).toEqual({ type: 'grpc-message' });
  });

  it('yields no trailing frame when stream ends with only complete SSE frames', async () => {
    const frames = await collectSseFrames('data: complete\n\n');
    expect(frames).toEqual([{ event: 'message', data: 'complete' }]);
  });

  it('parses trailing event-only buffer without a data line', async () => {
    const frames = await collectSseFrames('event: grpc-heartbeat\n');
    expect(frames).toEqual([]);
  });

  it('ignores non-event lines in the trailing buffer', async () => {
    const frames = await collectSseFrames(': trailing comment\ndata: tail\n');
    expect(frames).toEqual([{ event: 'message', data: 'tail' }]);
  });

  it('ignores junk lines left in the trailing buffer without a data payload', async () => {
    const frames = await collectSseFrames('event: foo\nbar');
    expect(frames).toEqual([]);
  });

  it('yields nothing for an empty stream body', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.close();
      },
    });
    const frames = [];
    for await (const frame of parseGrpcSseStream(stream)) {
      frames.push(frame);
    }
    expect(frames).toEqual([]);
  });

  it('parses frames split across multiple stream chunks', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('event: grpc-message\nda'));
        controller.enqueue(new TextEncoder().encode('ta: {"type":"chunked"}\n\n'));
        controller.close();
      },
    });

    const frames = [];
    for await (const frame of parseGrpcSseStream(stream)) {
      frames.push(frame);
    }

    expect(frames).toEqual([{ event: 'grpc-message', data: '{"type":"chunked"}' }]);
  });

  it('parses trailing buffer lines when stream ends without a blank line separator', async () => {
    const frames = await collectSseFrames('event: grpc-end\ndata: tail');
    expect(frames).toEqual([{ event: 'grpc-end', data: 'tail' }]);
  });

  it('ignores unrelated lines and only emits frames with data payloads', async () => {
    const frames = await collectSseFrames(': comment\ndata: ping\n\n');
    expect(frames).toEqual([{ event: 'message', data: 'ping' }]);
  });

  it('throws AbortError when abortSignal is already aborted before read', async () => {
    const controller = new AbortController();
    controller.abort();
    let cancelRejectHandled = false;
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(new TextEncoder().encode('data: x\n\n'));
        c.close();
      },
      cancel() {
        cancelRejectHandled = true;
        return Promise.reject(new Error('early cancel failed'));
      },
    });

    await expect(async () => {
      for await (const _frame of parseGrpcSseStream(stream, { abortSignal: controller.signal })) {
        // drain
      }
    }).rejects.toMatchObject({ name: 'AbortError' });
    expect(cancelRejectHandled).toBe(true);
  });

  it('throws AbortError when aborted during read loop', async () => {
    const controller = new AbortController();
    const stream = new ReadableStream({
      start(c) {
        c.enqueue(new TextEncoder().encode('data: partial\n\n'));
        controller.abort();
      },
    });

    await expect(async () => {
      for await (const _frame of parseGrpcSseStream(stream, { abortSignal: controller.signal })) {
        // drain
      }
    }).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('throws AbortError when stream ends while aborted', async () => {
    const controller = new AbortController();
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        controller.abort();
        c.close();
      },
    });

    await expect(async () => {
      for await (const _frame of parseGrpcSseStream(stream, { abortSignal: controller.signal })) {
        // drain
      }
    }).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('parses trailing buffer event line without blank-line separator', async () => {
    const frames = await collectSseFrames('event: grpc-custom\n');
    expect(frames).toEqual([]);
  });

  it('registers abort listener that cancels the reader', async () => {
    const controller = new AbortController();
    let cancelCalled = false;
    const stream = new ReadableStream({
      start(c) {
        c.enqueue(new TextEncoder().encode('data: one\n\n'));
      },
      cancel() {
        cancelCalled = true;
        return Promise.reject(new Error('cancel failed'));
      },
    });

    const iterator = parseGrpcSseStream(stream, { abortSignal: controller.signal });
    await iterator.next();
    controller.abort();
    await expect(iterator.next()).rejects.toMatchObject({ name: 'AbortError' });
    expect(cancelCalled).toBe(true);
  });
});
