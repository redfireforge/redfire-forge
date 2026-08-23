/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useWebSocketRecordingBridge } from './useWebSocketRecordingBridge';
import type { WsFrame } from '@shared/websocket/types';

function frame(id: string): WsFrame {
  return {
    id,
    direction: 'incoming',
    data: `msg-${id}`,
    format: 'text',
    timestamp: Date.now(),
    size: 5,
  } as unknown as WsFrame;
}

let recordMessage: ReturnType<typeof vi.fn>;
let recordStateChange: ReturnType<typeof vi.fn>;

beforeEach(() => {
  recordMessage = vi.fn();
  recordStateChange = vi.fn();
});

function renderBridge(initial: {
  messages: WsFrame[];
  connectionState: string;
  draftUrl: string;
  recordingState: 'idle' | 'recording' | 'replaying' | 'paused';
}) {
  return renderHook((props: typeof initial) => useWebSocketRecordingBridge({
    ...props,
    recordMessage,
    recordStateChange,
  }), { initialProps: initial });
}

describe('useWebSocketRecordingBridge', () => {
  it('does not record messages while idle', () => {
    const { rerender } = renderBridge({ messages: [], connectionState: 'disconnected', draftUrl: '', recordingState: 'idle' });
    rerender({ messages: [frame('1')], connectionState: 'disconnected', draftUrl: '', recordingState: 'idle' });
    expect(recordMessage).not.toHaveBeenCalled();
  });

  it('records newly appended messages while recording', () => {
    const { rerender } = renderBridge({ messages: [], connectionState: 'connected', draftUrl: 'wss://x', recordingState: 'recording' });
    rerender({ messages: [frame('1'), frame('2')], connectionState: 'connected', draftUrl: 'wss://x', recordingState: 'recording' });
    expect(recordMessage).toHaveBeenCalledTimes(2);
    expect(recordMessage.mock.calls[0][0].id).toBe('1');
    expect(recordMessage.mock.calls[1][0].id).toBe('2');
  });

  it('does nothing when the last message id is unchanged', () => {
    const msgs = [frame('1')];
    const { rerender } = renderBridge({ messages: msgs, connectionState: 'connected', draftUrl: 'wss://x', recordingState: 'recording' });
    recordMessage.mockClear();
    // Same array contents (same last id) → no new recording
    rerender({ messages: [...msgs], connectionState: 'connected', draftUrl: 'wss://x', recordingState: 'recording' });
    expect(recordMessage).not.toHaveBeenCalled();
  });

  it('handles cap eviction where the array does not grow but new frames arrive', () => {
    const { rerender } = renderBridge({ messages: [frame('1'), frame('2')], connectionState: 'connected', draftUrl: 'wss://x', recordingState: 'recording' });
    recordMessage.mockClear();
    // Array length stays 2 but oldest evicted and a new frame '3' appended
    rerender({ messages: [frame('2'), frame('3')], connectionState: 'connected', draftUrl: 'wss://x', recordingState: 'recording' });
    expect(recordMessage).toHaveBeenCalledTimes(1);
    expect(recordMessage.mock.calls[0][0].id).toBe('3');
  });

  it('records all frames after eviction when the last-seen id is gone', () => {
    const { rerender } = renderBridge({ messages: [frame('1')], connectionState: 'connected', draftUrl: 'wss://x', recordingState: 'recording' });
    recordMessage.mockClear();
    // last seen id '1' no longer present; array same length → record from start
    rerender({ messages: [frame('9')], connectionState: 'connected', draftUrl: 'wss://x', recordingState: 'recording' });
    expect(recordMessage).toHaveBeenCalledTimes(1);
    expect(recordMessage.mock.calls[0][0].id).toBe('9');
  });

  it('records a state change while recording', () => {
    const { rerender } = renderBridge({ messages: [], connectionState: 'disconnected', draftUrl: 'wss://x', recordingState: 'recording' });
    rerender({ messages: [], connectionState: 'connected', draftUrl: 'wss://x', recordingState: 'recording' });
    expect(recordStateChange).toHaveBeenCalledWith('connected', 'wss://x');
  });

  it('does not record state changes while idle', () => {
    const { rerender } = renderBridge({ messages: [], connectionState: 'disconnected', draftUrl: 'wss://x', recordingState: 'idle' });
    rerender({ messages: [], connectionState: 'connected', draftUrl: 'wss://x', recordingState: 'idle' });
    expect(recordStateChange).not.toHaveBeenCalled();
  });
});
