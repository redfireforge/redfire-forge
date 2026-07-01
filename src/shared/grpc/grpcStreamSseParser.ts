/**
 * gRPC stream SSE line parser (Phase 2E).
 * Parses `event:` / `data:` frames from a ReadableStream body.
 */

export interface GrpcSseFrame {
  event: string;
  data: string;
}

export async function* parseGrpcSseStream(
  stream: ReadableStream<Uint8Array>,
  options?: { abortSignal?: AbortSignal },
): AsyncGenerator<GrpcSseFrame> {
  const reader = stream.getReader();
  const abortSignal = options?.abortSignal;

  if (abortSignal) {
    if (abortSignal.aborted) {
      await reader.cancel().catch(() => undefined);
      throw new DOMException('Aborted', 'AbortError');
    }
    abortSignal.addEventListener('abort', () => {
      reader.cancel().catch(() => undefined);
    }, { once: true });
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let eventType = 'message';
  let dataLine = '';

  try {
    while (true) {
      if (abortSignal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }
      const { done, value } = await reader.read();
      if (done) {
        if (abortSignal?.aborted) {
          throw new DOMException('Aborted', 'AbortError');
        }
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (line.startsWith('event: ')) {
          eventType = line.slice(7).trim();
        } else if (line.startsWith('data: ')) {
          dataLine = line.slice(6);
        } else if (line === '') {
          if (dataLine) {
            yield { event: eventType, data: dataLine };
          }
          eventType = 'message';
          dataLine = '';
        }
      }
    }

    if (buffer) {
      for (const line of buffer.split('\n')) {
        if (line.startsWith('event: ')) {
          eventType = line.slice(7).trim();
        } else if (line.startsWith('data: ')) {
          dataLine = line.slice(6);
        }
      }
    }

    if (dataLine) {
      yield { event: eventType, data: dataLine };
    }
  } finally {
    reader.releaseLock();
  }
}

export function parseGrpcStreamEventJson(data: string): unknown {
  return JSON.parse(data) as unknown;
}
