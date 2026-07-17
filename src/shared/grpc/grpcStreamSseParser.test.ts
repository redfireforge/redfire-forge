import { describe, expect, it } from 'vitest';
import { parseGrpcSseStream } from './grpcStreamSseParser';

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

describe('grpcStreamSseParser', () => {
  it('parses event and data lines', async () => {
    const frames = await collectSseFrames(
      'event: grpc-message\ndata: {"type":"grpc-message"}\n\n',
    );
    expect(frames).toEqual([
      { event: 'grpc-message', data: '{"type":"grpc-message"}' },
    ]);
  });

  it('parses multiple frames', async () => {
    const frames = await collectSseFrames(
      'event: grpc-message\ndata: one\n\nevent: grpc-end\ndata: two\n\n',
    );
    expect(frames).toHaveLength(2);
    expect(frames[1]?.event).toBe('grpc-end');
  });

  it('flushes final frame when stream closes without trailing blank line', async () => {
    const frames = await collectSseFrames(
      'event: grpc-end\ndata: {"type":"grpc-end"}',
    );
    expect(frames).toEqual([
      { event: 'grpc-end', data: '{"type":"grpc-end"}' },
    ]);
  });

  it('stops reading when abortSignal fires on an idle stream', async () => {
    const controller = new AbortController();
    const stream = new ReadableStream<Uint8Array>({ start() {} });

    const collectPromise = (async () => {
      const frames = [];
      for await (const frame of parseGrpcSseStream(stream, { abortSignal: controller.signal })) {
        frames.push(frame);
      }
      return frames;
    })();

    controller.abort();
    await expect(collectPromise).rejects.toMatchObject({ name: 'AbortError' });
  });
});
