/**
 * SSE text protocol parser per W3C spec.
 * Handles event:, data:, id:, retry:, comments, multi-line data, and partial chunks.
 * @see https://html.spec.whatwg.org/multipage/server-sent-events.html#parsing-an-event-stream
 */

export interface SseParsedEvent {
  eventType: string;
  data: string;
  lastEventId: string;
}

export interface SseParserCallbacks {
  onEvent: (event: SseParsedEvent) => void;
  onRetry?: (ms: number) => void;
}

export function createSseParser(callbacks: SseParserCallbacks) {
  let eventType = '';
  let dataLines: string[] = [];
  let lastEventId = '';
  let carry = '';
  let firstChunk = true;

  function processLine(line: string): void {
    if (line === '') {
      if (dataLines.length > 0) {
        const data = dataLines.join('\n');
        callbacks.onEvent({
          eventType: eventType || 'message',
          data,
          lastEventId,
        });
      }
      eventType = '';
      dataLines = [];
      return;
    }

    if (line.startsWith(':')) return;

    const colonIdx = line.indexOf(':');
    let field: string;
    let value: string;

    if (colonIdx === -1) {
      field = line;
      value = '';
    } else {
      field = line.slice(0, colonIdx);
      value = line.slice(colonIdx + 1);
      if (value.startsWith(' ')) value = value.slice(1);
    }

    switch (field) {
      case 'event':
        eventType = value;
        break;
      case 'data':
        dataLines.push(value);
        break;
      case 'id':
        if (!value.includes('\0')) {
          lastEventId = value;
        }
        break;
      case 'retry': {
        const ms = parseInt(value, 10);
        if (!isNaN(ms) && ms >= 0 && String(ms) === value.trim()) {
          callbacks.onRetry?.(ms);
        }
        break;
      }
    }
  }

  return {
    feed(chunk: string): void {
      let input = chunk;
      if (firstChunk) {
        firstChunk = false;
        if (input.charCodeAt(0) === 0xFEFF) input = input.slice(1);
      }
      const text = carry + input;
      const lines = text.split(/\r\n|\r|\n/);
      carry = lines.pop() ?? '';
      for (const line of lines) {
        processLine(line);
      }
    },

    flush(): void {
      if (carry) {
        processLine(carry);
        carry = '';
      }
      if (dataLines.length > 0) {
        const data = dataLines.join('\n');
        callbacks.onEvent({
          eventType: eventType || 'message',
          data,
          lastEventId,
        });
        eventType = '';
        dataLines = [];
      }
    },

    getLastEventId(): string {
      return lastEventId;
    },
  };
}
