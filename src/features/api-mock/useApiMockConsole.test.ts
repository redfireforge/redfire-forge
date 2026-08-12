/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useApiMockConsole } from './useApiMockConsole';

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;
  constructor(public readonly url: string) {
    FakeEventSource.instances.push(this);
  }
  close() {
    this.closed = true;
  }
}

describe('useApiMockConsole', () => {
  beforeEach(() => {
    FakeEventSource.instances = [];
    vi.stubGlobal('EventSource', FakeEventSource as unknown as typeof EventSource);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does nothing when inactive', () => {
    renderHook(() => useApiMockConsole(false));
    expect(FakeEventSource.instances).toHaveLength(0);
  });

  it('subscribes to the log stream and keeps only api-mock lines', () => {
    const { result, unmount } = renderHook(() => useApiMockConsole(true));
    expect(FakeEventSource.instances).toHaveLength(1);
    expect(FakeEventSource.instances[0].url).toBe('/api/logs/stream');

    act(() => {
      FakeEventSource.instances[0].onmessage?.({ data: JSON.stringify({ source: 'workflow', message: 'skip me' }) });
      FakeEventSource.instances[0].onmessage?.({ data: JSON.stringify({ source: 'api-mock', ts: '2026-08-12T00:00:00.000Z', level: 'info', message: 'Started on :4600' }) });
      FakeEventSource.instances[0].onmessage?.({ data: JSON.stringify({ source: 'api-mock', text: 'fallback text' }) });
    });

    expect(result.current.lines).toEqual([
      { ts: '2026-08-12T00:00:00.000Z', level: 'info', message: 'Started on :4600' },
      { ts: undefined, level: undefined, message: 'fallback text' },
    ]);

    unmount();
    expect(FakeEventSource.instances[0].closed).toBe(true);
  });

  it('ignores malformed events and supports clear', () => {
    const { result } = renderHook(() => useApiMockConsole(true));

    act(() => {
      FakeEventSource.instances[0].onmessage?.({ data: 'not-json' });
      FakeEventSource.instances[0].onmessage?.({ data: JSON.stringify({ source: 'api-mock' }) });
      FakeEventSource.instances[0].onerror?.();
    });
    expect(result.current.lines).toEqual([{ ts: undefined, level: undefined, message: '' }]);

    act(() => result.current.clear());
    expect(result.current.lines).toEqual([]);
  });

  it('swallows EventSource construction failures', () => {
    vi.stubGlobal('EventSource', class BrokenEventSource {
      constructor() {
        throw new Error('boom');
      }
    } as unknown as typeof EventSource);

    const { result } = renderHook(() => useApiMockConsole(true));
    expect(result.current.lines).toEqual([]);
  });
});
