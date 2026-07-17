import { describe, it, expect, vi } from 'vitest';
import { createSseParser } from './sseParser';

describe('createSseParser', () => {
  it('parses a simple message event', () => {
    const onEvent = vi.fn();
    const parser = createSseParser({ onEvent });

    parser.feed('data: hello world\n\n');

    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent).toHaveBeenCalledWith({
      eventType: 'message',
      data: 'hello world',
      lastEventId: '',
    });
  });

  it('parses named event types', () => {
    const onEvent = vi.fn();
    const parser = createSseParser({ onEvent });

    parser.feed('event: update\ndata: {"key":"value"}\n\n');

    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent.mock.calls[0][0].eventType).toBe('update');
    expect(onEvent.mock.calls[0][0].data).toBe('{"key":"value"}');
  });

  it('handles multi-line data fields', () => {
    const onEvent = vi.fn();
    const parser = createSseParser({ onEvent });

    parser.feed('data: line 1\ndata: line 2\ndata: line 3\n\n');

    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent.mock.calls[0][0].data).toBe('line 1\nline 2\nline 3');
  });

  it('handles event id field', () => {
    const onEvent = vi.fn();
    const parser = createSseParser({ onEvent });

    parser.feed('id: 42\ndata: test\n\n');

    expect(onEvent.mock.calls[0][0].lastEventId).toBe('42');
    expect(parser.getLastEventId()).toBe('42');
  });

  it('remembers last event id across events', () => {
    const onEvent = vi.fn();
    const parser = createSseParser({ onEvent });

    parser.feed('id: 1\ndata: first\n\ndata: second\n\n');

    expect(onEvent).toHaveBeenCalledTimes(2);
    expect(onEvent.mock.calls[0][0].lastEventId).toBe('1');
    expect(onEvent.mock.calls[1][0].lastEventId).toBe('1');
  });

  it('ignores comment lines (starting with :)', () => {
    const onEvent = vi.fn();
    const parser = createSseParser({ onEvent });

    parser.feed(': this is a comment\ndata: hello\n\n');

    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent.mock.calls[0][0].data).toBe('hello');
  });

  it('handles retry field', () => {
    const onRetry = vi.fn();
    const onEvent = vi.fn();
    const parser = createSseParser({ onEvent, onRetry });

    parser.feed('retry: 5000\ndata: test\n\n');

    expect(onRetry).toHaveBeenCalledWith(5000);
  });

  it('ignores non-numeric retry values', () => {
    const onRetry = vi.fn();
    const parser = createSseParser({ onEvent: vi.fn(), onRetry });

    parser.feed('retry: abc\ndata: test\n\n');

    expect(onRetry).not.toHaveBeenCalled();
  });

  it('ignores id field containing null bytes', () => {
    const onEvent = vi.fn();
    const parser = createSseParser({ onEvent });

    parser.feed('id: 1\ndata: first\n\nid: bad\x00id\ndata: second\n\n');

    expect(parser.getLastEventId()).toBe('1');
  });

  it('handles chunked delivery (split across multiple feeds)', () => {
    const onEvent = vi.fn();
    const parser = createSseParser({ onEvent });

    parser.feed('data: hel');
    expect(onEvent).not.toHaveBeenCalled();

    parser.feed('lo\n\n');
    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent.mock.calls[0][0].data).toBe('hello');
  });

  it('handles \\r\\n line endings', () => {
    const onEvent = vi.fn();
    const parser = createSseParser({ onEvent });

    parser.feed('data: hello\r\n\r\n');

    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent.mock.calls[0][0].data).toBe('hello');
  });

  it('handles bare \\r line endings', () => {
    const onEvent = vi.fn();
    const parser = createSseParser({ onEvent });

    parser.feed('data: hello\r\r');

    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent.mock.calls[0][0].data).toBe('hello');
  });

  it('does not emit event when no data lines present', () => {
    const onEvent = vi.fn();
    const parser = createSseParser({ onEvent });

    parser.feed('event: ping\n\n');

    expect(onEvent).not.toHaveBeenCalled();
  });

  it('resets event type after each event dispatch', () => {
    const onEvent = vi.fn();
    const parser = createSseParser({ onEvent });

    parser.feed('event: custom\ndata: first\n\ndata: second\n\n');

    expect(onEvent).toHaveBeenCalledTimes(2);
    expect(onEvent.mock.calls[0][0].eventType).toBe('custom');
    expect(onEvent.mock.calls[1][0].eventType).toBe('message');
  });

  it('handles field with no value (no colon)', () => {
    const onEvent = vi.fn();
    const parser = createSseParser({ onEvent });

    parser.feed('data\n\n');

    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent.mock.calls[0][0].data).toBe('');
  });

  it('strips single leading space from value', () => {
    const onEvent = vi.fn();
    const parser = createSseParser({ onEvent });

    parser.feed('data:  two spaces\n\n');

    expect(onEvent.mock.calls[0][0].data).toBe(' two spaces');
  });

  it('flush emits buffered event', () => {
    const onEvent = vi.fn();
    const parser = createSseParser({ onEvent });

    parser.feed('data: buffered');
    expect(onEvent).not.toHaveBeenCalled();

    parser.flush();
    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent.mock.calls[0][0].data).toBe('buffered');
  });

  it('handles multiple events in one chunk', () => {
    const onEvent = vi.fn();
    const parser = createSseParser({ onEvent });

    parser.feed('data: one\n\ndata: two\n\ndata: three\n\n');

    expect(onEvent).toHaveBeenCalledTimes(3);
    expect(onEvent.mock.calls[0][0].data).toBe('one');
    expect(onEvent.mock.calls[1][0].data).toBe('two');
    expect(onEvent.mock.calls[2][0].data).toBe('three');
  });

  it('handles empty data field', () => {
    const onEvent = vi.fn();
    const parser = createSseParser({ onEvent });

    parser.feed('data:\n\n');

    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent.mock.calls[0][0].data).toBe('');
  });

  it('ignores unknown field names', () => {
    const onEvent = vi.fn();
    const parser = createSseParser({ onEvent });

    parser.feed('unknown: value\ndata: test\n\n');

    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent.mock.calls[0][0].data).toBe('test');
  });

  it('handles negative retry value gracefully', () => {
    const onRetry = vi.fn();
    const parser = createSseParser({ onEvent: vi.fn(), onRetry });

    parser.feed('retry: -1\ndata: test\n\n');

    expect(onRetry).not.toHaveBeenCalled();
  });

  it('resets lastEventId when id field has empty value', () => {
    const onEvent = vi.fn();
    const parser = createSseParser({ onEvent });

    parser.feed('id: 42\ndata: first\n\nid:\ndata: second\n\n');

    expect(onEvent).toHaveBeenCalledTimes(2);
    expect(onEvent.mock.calls[0][0].lastEventId).toBe('42');
    expect(onEvent.mock.calls[1][0].lastEventId).toBe('');
    expect(parser.getLastEventId()).toBe('');
  });

  it('strips BOM from the beginning of the stream', () => {
    const onEvent = vi.fn();
    const parser = createSseParser({ onEvent });

    parser.feed('\uFEFFdata: hello\n\n');

    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent.mock.calls[0][0].data).toBe('hello');
  });

  it('only strips BOM from the first chunk', () => {
    const onEvent = vi.fn();
    const parser = createSseParser({ onEvent });

    parser.feed('data: first\n\n');
    parser.feed('\uFEFFdata: second\n\n');

    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent.mock.calls[0][0].data).toBe('first');
  });

  it('handles realistic LLM streaming chunk', () => {
    const onEvent = vi.fn();
    const parser = createSseParser({ onEvent });

    const chunk = [
      'event: token',
      'data: {"text":"Hello","index":0}',
      '',
      'event: token',
      'data: {"text":" World","index":1}',
      '',
      'event: done',
      'data: [DONE]',
      '',
      '',
    ].join('\n');

    parser.feed(chunk);

    expect(onEvent).toHaveBeenCalledTimes(3);
    expect(onEvent.mock.calls[0][0]).toEqual({ eventType: 'token', data: '{"text":"Hello","index":0}', lastEventId: '' });
    expect(onEvent.mock.calls[1][0]).toEqual({ eventType: 'token', data: '{"text":" World","index":1}', lastEventId: '' });
    expect(onEvent.mock.calls[2][0]).toEqual({ eventType: 'done', data: '[DONE]', lastEventId: '' });
  });
});
