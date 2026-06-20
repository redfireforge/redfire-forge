/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWebSocketRecording } from './useWebSocketRecording';
import type { WsFrame, WsRecording } from '../../shared/websocket/types';
import { createFrame } from '../../shared/websocket/types';

vi.mock('../../shared/utils/fileSaver', () => ({
  saveJsonFile: vi.fn().mockResolvedValue(undefined),
}));

function makeFrame(overrides?: Partial<WsFrame>): WsFrame {
  return {
    ...createFrame('received', 'text', 'test data'),
    ...overrides,
  };
}

describe('useWebSocketRecording', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts in idle state', () => {
    const { result } = renderHook(() => useWebSocketRecording());
    expect(result.current.state).toBe('idle');
    expect(result.current.replayProgress).toBeNull();
    expect(result.current.loadedRecording).toBeNull();
  });

  it('transitions to recording state on startRecording', () => {
    const { result } = renderHook(() => useWebSocketRecording());
    act(() => {
      result.current.startRecording('ws://localhost:8765', 'raw');
    });
    expect(result.current.state).toBe('recording');
  });

  it('records messages during recording', () => {
    const { result } = renderHook(() => useWebSocketRecording());
    act(() => {
      result.current.startRecording('ws://localhost:8765', 'raw');
    });

    const frame = makeFrame({ id: 'test-1' });
    act(() => {
      result.current.recordMessage(frame);
    });

    expect(result.current.state).toBe('recording');
  });

  it('records state changes during recording', () => {
    const { result } = renderHook(() => useWebSocketRecording());
    act(() => {
      result.current.startRecording('ws://localhost:8765', 'raw');
    });
    act(() => {
      result.current.recordStateChange('connected', 'ws://localhost:8765');
    });
    expect(result.current.state).toBe('recording');
  });

  it('stopRecording returns to idle and saves file', async () => {
    const fileSaver = await import('../../shared/utils/fileSaver');
    const { result } = renderHook(() => useWebSocketRecording());
    act(() => {
      result.current.startRecording('ws://localhost:8765', 'auto');
    });

    const frame = makeFrame({ id: 'rec-1' });
    act(() => {
      result.current.recordMessage(frame);
    });

    act(() => {
      result.current.stopRecording();
    });

    expect(result.current.state).toBe('idle');
    expect(fileSaver.saveJsonFile).toHaveBeenCalledTimes(1);
    const savedArg = (fileSaver.saveJsonFile as ReturnType<typeof vi.fn>).mock.calls[0][0] as WsRecording;
    expect(savedArg._format).toBe('ws-recording-v1');
    expect(savedArg.metadata.url).toBe('ws://localhost:8765');
    expect(savedArg.metadata.protocol).toBe('auto');
    expect(savedArg.events.length).toBe(1);
    expect(savedArg.events[0].type).toBe('message');
  });

  it('ignores recordMessage when not recording', () => {
    const { result } = renderHook(() => useWebSocketRecording());
    const frame = makeFrame({ id: 'ignored' });
    act(() => {
      result.current.recordMessage(frame);
    });
    expect(result.current.state).toBe('idle');
  });

  it('ignores recordMessage after stopRecording (startTimeRef reset)', async () => {
    const fileSaver = await import('../../shared/utils/fileSaver');
    const mockSave = fileSaver.saveJsonFile as ReturnType<typeof vi.fn>;
    mockSave.mockClear();
    const { result } = renderHook(() => useWebSocketRecording());

    act(() => { result.current.startRecording('ws://localhost', 'raw'); });
    act(() => { result.current.recordMessage(makeFrame({ id: 'before-stop' })); });
    act(() => { result.current.stopRecording(); });

    act(() => { result.current.recordMessage(makeFrame({ id: 'after-stop' })); });

    act(() => { result.current.startRecording('ws://localhost', 'raw'); });
    act(() => { result.current.recordMessage(makeFrame({ id: 'second-session' })); });
    act(() => { result.current.stopRecording(); });

    expect(mockSave).toHaveBeenCalledTimes(2);
    const secondRecording = mockSave.mock.calls[1][0] as WsRecording;
    expect(secondRecording.events.length).toBe(1);
    expect((secondRecording.events[0] as { frame: WsFrame }).frame.id).toBe('second-session');
  });

  it('loadRecording validates format', async () => {
    const { result } = renderHook(() => useWebSocketRecording());

    const invalidFile = new File(['{"foo":"bar"}'], 'bad.json', { type: 'application/json' });
    let loaded = false;
    await act(async () => {
      loaded = await result.current.loadRecording(invalidFile);
    });
    expect(loaded).toBe(false);
    expect(result.current.loadedRecording).toBeNull();

    const validRecording: WsRecording = {
      _format: 'ws-recording-v1',
      metadata: { url: 'ws://test', protocol: 'raw', startedAt: '2026-01-01T00:00:00Z', durationMs: 1000, messageCount: 1 },
      events: [{ type: 'message', relativeMs: 100, frame: makeFrame({ id: 'r-1' }) }],
    };
    const validFile = new File([JSON.stringify(validRecording)], 'good.json', { type: 'application/json' });
    await act(async () => {
      loaded = await result.current.loadRecording(validFile);
    });
    expect(loaded).toBe(true);
    expect(result.current.loadedRecording).not.toBeNull();
    expect(result.current.loadedRecording!._format).toBe('ws-recording-v1');
  });

  it('loadRecording returns false on invalid JSON', async () => {
    const { result } = renderHook(() => useWebSocketRecording());
    const badFile = new File(['not json'], 'bad.json', { type: 'application/json' });
    let loaded = false;
    await act(async () => {
      loaded = await result.current.loadRecording(badFile);
    });
    expect(loaded).toBe(false);
  });

  it('startReplay transitions to replaying and calls onMessage for each event', async () => {
    const { result } = renderHook(() => useWebSocketRecording());

    const frame1 = makeFrame({ id: 'r-1' });
    const frame2 = makeFrame({ id: 'r-2' });
    const recording: WsRecording = {
      _format: 'ws-recording-v1',
      metadata: { url: 'ws://test', protocol: 'raw', startedAt: '2026-01-01T00:00:00Z', durationMs: 200, messageCount: 2 },
      events: [
        { type: 'message', relativeMs: 50, frame: frame1 },
        { type: 'message', relativeMs: 100, frame: frame2 },
      ],
    };

    const validFile = new File([JSON.stringify(recording)], 'rec.json', { type: 'application/json' });
    await act(async () => {
      await result.current.loadRecording(validFile);
    });

    const receivedFrames: WsFrame[] = [];
    act(() => {
      result.current.startReplay((frame) => receivedFrames.push(frame));
    });
    expect(result.current.state).toBe('replaying');

    act(() => { vi.advanceTimersByTime(60); });
    expect(receivedFrames.length).toBe(1);
    expect(receivedFrames[0].id).toBe('r-1');

    act(() => { vi.advanceTimersByTime(60); });
    expect(receivedFrames.length).toBe(2);
    expect(receivedFrames[1].id).toBe('r-2');
  });

  it('pauseReplay and resumeReplay work correctly', async () => {
    const { result } = renderHook(() => useWebSocketRecording());

    const recording: WsRecording = {
      _format: 'ws-recording-v1',
      metadata: { url: 'ws://test', protocol: 'raw', startedAt: '2026-01-01T00:00:00Z', durationMs: 500, messageCount: 2 },
      events: [
        { type: 'message', relativeMs: 100, frame: makeFrame({ id: 'p-1' }) },
        { type: 'message', relativeMs: 300, frame: makeFrame({ id: 'p-2' }) },
      ],
    };

    const validFile = new File([JSON.stringify(recording)], 'rec.json', { type: 'application/json' });
    await act(async () => {
      await result.current.loadRecording(validFile);
    });

    const received: WsFrame[] = [];
    act(() => {
      result.current.startReplay((f) => received.push(f));
    });

    act(() => { vi.advanceTimersByTime(110); });
    expect(received.length).toBe(1);

    act(() => { result.current.pauseReplay(); });
    expect(result.current.state).toBe('paused');

    act(() => { vi.advanceTimersByTime(500); });
    expect(received.length).toBe(1);

    act(() => { result.current.resumeReplay(); });
    expect(result.current.state).toBe('replaying');

    act(() => { vi.advanceTimersByTime(210); });
    expect(received.length).toBe(2);
  });

  it('stopReplay clears state and returns to idle', async () => {
    const { result } = renderHook(() => useWebSocketRecording());

    const recording: WsRecording = {
      _format: 'ws-recording-v1',
      metadata: { url: 'ws://test', protocol: 'raw', startedAt: '2026-01-01T00:00:00Z', durationMs: 500, messageCount: 1 },
      events: [
        { type: 'message', relativeMs: 100, frame: makeFrame({ id: 's-1' }) },
      ],
    };

    const validFile = new File([JSON.stringify(recording)], 'rec.json', { type: 'application/json' });
    await act(async () => {
      await result.current.loadRecording(validFile);
    });

    act(() => {
      result.current.startReplay(() => {});
    });
    expect(result.current.state).toBe('replaying');

    act(() => { result.current.stopReplay(); });
    expect(result.current.state).toBe('idle');
    expect(result.current.replayProgress).toBeNull();
    expect(result.current.loadedRecording).toBeNull();
  });

  it('Max speed (0) plays all messages instantly', async () => {
    const { result } = renderHook(() => useWebSocketRecording());

    const recording: WsRecording = {
      _format: 'ws-recording-v1',
      metadata: { url: 'ws://test', protocol: 'raw', startedAt: '2026-01-01T00:00:00Z', durationMs: 5000, messageCount: 3 },
      events: [
        { type: 'message', relativeMs: 100, frame: makeFrame({ id: 'max-1' }) },
        { type: 'message', relativeMs: 2000, frame: makeFrame({ id: 'max-2' }) },
        { type: 'message', relativeMs: 5000, frame: makeFrame({ id: 'max-3' }) },
      ],
    };

    const validFile = new File([JSON.stringify(recording)], 'rec.json', { type: 'application/json' });
    await act(async () => {
      await result.current.loadRecording(validFile);
    });

    act(() => { result.current.setReplaySpeed(0); });

    const received: WsFrame[] = [];
    act(() => {
      result.current.startReplay((f) => received.push(f));
    });

    expect(received.length).toBe(3);
    expect(result.current.state).toBe('idle');
  });

  it('setReplaySpeed updates the speed', () => {
    const { result } = renderHook(() => useWebSocketRecording());
    expect(result.current.replaySpeed).toBe(1);
    act(() => { result.current.setReplaySpeed(5); });
    expect(result.current.replaySpeed).toBe(5);
  });

  it('replayProgress updates as events are replayed', async () => {
    const { result } = renderHook(() => useWebSocketRecording());

    const recording: WsRecording = {
      _format: 'ws-recording-v1',
      metadata: { url: 'ws://test', protocol: 'raw', startedAt: '2026-01-01T00:00:00Z', durationMs: 300, messageCount: 2 },
      events: [
        { type: 'message', relativeMs: 100, frame: makeFrame({ id: 'prog-1' }) },
        { type: 'message', relativeMs: 200, frame: makeFrame({ id: 'prog-2' }) },
      ],
    };

    const validFile = new File([JSON.stringify(recording)], 'rec.json', { type: 'application/json' });
    await act(async () => {
      await result.current.loadRecording(validFile);
    });

    act(() => { result.current.startReplay(() => {}); });
    expect(result.current.replayProgress).toEqual({
      current: 0, total: 2, elapsedMs: 0, durationMs: 300,
    });

    act(() => { vi.advanceTimersByTime(110); });
    expect(result.current.replayProgress!.current).toBe(1);
  });

  it('cleanup clears timer on unmount', async () => {
    const { result, unmount } = renderHook(() => useWebSocketRecording());

    const recording: WsRecording = {
      _format: 'ws-recording-v1',
      metadata: { url: 'ws://test', protocol: 'raw', startedAt: '2026-01-01T00:00:00Z', durationMs: 10000, messageCount: 1 },
      events: [
        { type: 'message', relativeMs: 5000, frame: makeFrame({ id: 'cleanup-1' }) },
      ],
    };

    const validFile = new File([JSON.stringify(recording)], 'rec.json', { type: 'application/json' });
    await act(async () => {
      await result.current.loadRecording(validFile);
    });

    act(() => { result.current.startReplay(() => {}); });
    expect(result.current.state).toBe('replaying');

    unmount();
    expect(() => vi.advanceTimersByTime(6000)).not.toThrow();
  });

  it('startReplay does nothing if no recording loaded', () => {
    const { result } = renderHook(() => useWebSocketRecording());
    const received: WsFrame[] = [];
    act(() => { result.current.startReplay((f) => received.push(f)); });
    expect(result.current.state).toBe('idle');
    expect(received.length).toBe(0);
  });

  it('skips state-change events during replay without error', async () => {
    const { result } = renderHook(() => useWebSocketRecording());

    const recording: WsRecording = {
      _format: 'ws-recording-v1',
      metadata: { url: 'ws://test', protocol: 'raw', startedAt: '2026-01-01T00:00:00Z', durationMs: 300, messageCount: 1 },
      events: [
        { type: 'state-change', relativeMs: 50, state: 'connected', url: 'ws://test' },
        { type: 'message', relativeMs: 100, frame: makeFrame({ id: 'sc-1' }) },
      ],
    };

    const validFile = new File([JSON.stringify(recording)], 'rec.json', { type: 'application/json' });
    await act(async () => {
      await result.current.loadRecording(validFile);
    });

    const received: WsFrame[] = [];
    act(() => { result.current.startReplay((f) => received.push(f)); });

    act(() => { vi.advanceTimersByTime(60); });
    expect(received.length).toBe(0);

    act(() => { vi.advanceTimersByTime(60); });
    expect(received.length).toBe(1);
  });

  it('ignores recordStateChange when not recording', () => {
    const { result } = renderHook(() => useWebSocketRecording());
    act(() => { result.current.recordStateChange('connected'); });
    expect(result.current.state).toBe('idle');
  });

  it('loadRecording rejects recordings with wrong format', async () => {
    const { result } = renderHook(() => useWebSocketRecording());

    const noFormat = new File([JSON.stringify({ metadata: {}, events: [] })], 'bad.json');
    let loaded = false;
    await act(async () => { loaded = await result.current.loadRecording(noFormat); });
    expect(loaded).toBe(false);

    const noMetadata = new File([JSON.stringify({ _format: 'ws-recording-v1', events: [] })], 'bad2.json');
    await act(async () => { loaded = await result.current.loadRecording(noMetadata); });
    expect(loaded).toBe(false);

    const badEvents = new File([JSON.stringify({
      _format: 'ws-recording-v1',
      metadata: { url: 'ws://x', protocol: 'raw', startedAt: '', durationMs: 0, messageCount: 0 },
      events: 'not-an-array',
    })], 'bad3.json');
    await act(async () => { loaded = await result.current.loadRecording(badEvents); });
    expect(loaded).toBe(false);
  });

  it('stopRecording still returns to idle when saveJsonFile rejects', async () => {
    const fileSaver = await import('../../shared/utils/fileSaver');
    vi.mocked(fileSaver.saveJsonFile).mockRejectedValueOnce(new Error('disk full'));
    const { result } = renderHook(() => useWebSocketRecording());
    act(() => { result.current.startRecording('ws://localhost', 'raw'); });
    act(() => { result.current.stopRecording(); });
    expect(result.current.state).toBe('idle');
  });

  it('resumeReplay is a no-op without a loaded recording', () => {
    const { result } = renderHook(() => useWebSocketRecording());
    act(() => { result.current.resumeReplay(); });
    expect(result.current.state).toBe('idle');
  });

  it('max speed replay skips non-message events in the instant loop', async () => {
    const { result } = renderHook(() => useWebSocketRecording());
    const recording: WsRecording = {
      _format: 'ws-recording-v1',
      metadata: { url: 'ws://test', protocol: 'raw', startedAt: '2026-01-01T00:00:00Z', durationMs: 200, messageCount: 1 },
      events: [
        { type: 'state-change', relativeMs: 10, state: 'connected' },
        { type: 'message', relativeMs: 50, frame: makeFrame({ id: 'instant-1' }) },
      ],
    };
    const validFile = new File([JSON.stringify(recording)], 'rec.json');
    await act(async () => { await result.current.loadRecording(validFile); });
    act(() => { result.current.setReplaySpeed(0); });
    const received: WsFrame[] = [];
    act(() => { result.current.startReplay((f) => received.push(f)); });
    expect(received).toHaveLength(1);
    expect(received[0].id).toBe('instant-1');
  });

  it('cleanup clears replay timer on unmount when timer is active', async () => {
    const { result, unmount } = renderHook(() => useWebSocketRecording());
    const recording: WsRecording = {
      _format: 'ws-recording-v1',
      metadata: { url: 'ws://test', protocol: 'raw', startedAt: '2026-01-01T00:00:00Z', durationMs: 5000, messageCount: 1 },
      events: [{ type: 'message', relativeMs: 5000, frame: makeFrame({ id: 'late' }) }],
    };
    await act(async () => {
      await result.current.loadRecording(new File([JSON.stringify(recording)], 'rec.json'));
    });
    act(() => { result.current.startReplay(() => {}); });
    unmount();
    expect(() => act(() => { vi.advanceTimersByTime(6000); })).not.toThrow();
  });
});
