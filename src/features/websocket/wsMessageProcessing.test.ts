import { describe, it, expect, vi } from 'vitest';
import { processReceivedMessage } from './wsMessageProcessing';

describe('processReceivedMessage', () => {
  const noop = vi.fn();

  it('creates a text frame for non-binary data', () => {
    const result = processReceivedMessage('hello', false, 'raw', null, false, noop);
    expect(result.frame.type).toBe('text');
    expect(result.frame.data).toBe('hello');
    expect(result.frame.direction).toBe('received');
    expect(result.autoRespond).toBeNull();
  });

  it('creates a binary frame for binary data', () => {
    const result = processReceivedMessage('binarydata', true, 'raw', null, false, noop);
    expect(result.frame.type).toBe('binary');
    expect(result.autoRespond).toBeNull();
  });

  it('detects protocol in auto mode on first non-binary message', () => {
    const onDetect = vi.fn();
    // Socket.IO open packet starts with "0{"
    const sioOpen = '0{"sid":"test","upgrades":[],"pingTimeout":25000,"pingInterval":25000}';
    const result = processReceivedMessage(sioOpen, false, 'auto', null, false, onDetect);
    expect(result.detectionNowDone).toBe(true);
    expect(onDetect).toHaveBeenCalled();
  });

  it('skips detection when messageDetectionDone is already true', () => {
    const onDetect = vi.fn();
    const result = processReceivedMessage('hello', false, 'auto', null, true, onDetect);
    expect(result.detectionNowDone).toBe(true);
    expect(onDetect).not.toHaveBeenCalled();
  });

  it('skips detection for binary messages even in auto mode', () => {
    const onDetect = vi.fn();
    const result = processReceivedMessage('data', true, 'auto', null, false, onDetect);
    expect(result.detectionNowDone).toBe(false);
    expect(onDetect).not.toHaveBeenCalled();
  });

  it('skips detection when protocol mode is not auto', () => {
    const onDetect = vi.fn();
    const result = processReceivedMessage('hello', false, 'raw', null, false, onDetect);
    expect(result.detectionNowDone).toBe(false);
    expect(onDetect).not.toHaveBeenCalled();
  });

  it('triggers auto-respond for Socket.IO ping (text "2")', () => {
    const result = processReceivedMessage(
      '2', false, 'socket-io', { protocol: 'socket-io', confidence: 'high', reason: 'test' }, true, noop,
    );
    expect(result.autoRespond).not.toBeNull();
    expect(result.autoRespond?.replyData).toBe('3');
  });

  it('does not auto-respond to binary messages', () => {
    const result = processReceivedMessage(
      '2', true, 'socket-io', { protocol: 'socket-io', confidence: 'high', reason: 'test' }, true, noop,
    );
    expect(result.autoRespond).toBeNull();
  });

  it('does not auto-respond to normal text messages', () => {
    const result = processReceivedMessage(
      '{"type":"update","data":123}', false, 'raw', null, true, noop,
    );
    expect(result.autoRespond).toBeNull();
  });

  it('returns correct detectionNowDone when detection finds nothing', () => {
    const onDetect = vi.fn();
    const result = processReceivedMessage('plain text', false, 'auto', null, false, onDetect);
    // detection was attempted (detectionNowDone = true), but nothing detected (callback not called)
    expect(result.detectionNowDone).toBe(true);
    expect(onDetect).not.toHaveBeenCalled();
  });

  it('auto-responds to Socket.IO OPEN on first message when detection happens from that same message', () => {
    const onDetect = vi.fn();
    const sioOpen = '0{"sid":"test123","upgrades":[],"pingTimeout":25000,"pingInterval":25000}';
    const result = processReceivedMessage(sioOpen, false, 'auto', null, false, onDetect);
    expect(result.detectionNowDone).toBe(true);
    expect(onDetect).toHaveBeenCalled();
    expect(result.autoRespond).not.toBeNull();
    expect(result.autoRespond?.replyData).toBe('40');
  });

  it('auto-responds to STOMP heartbeat on first message when detection happens from URL-based prior detection', () => {
    const detected = { protocol: 'stomp' as const, confidence: 'high' as const, reason: 'URL path contains /stomp' };
    const result = processReceivedMessage('\n', false, 'auto', detected, true, noop);
    expect(result.autoRespond).not.toBeNull();
    expect(result.autoRespond?.replyData).toBe('\n');
  });

  it('auto-responds to graphql-ws ping when protocol is detected', () => {
    const pingStr = JSON.stringify({ type: 'ping' });
    const detected = { protocol: 'graphql-ws' as const, confidence: 'high' as const, reason: 'Subprotocol matches graphql-ws' };
    const result = processReceivedMessage(pingStr, false, 'auto', detected, true, noop);
    expect(result.autoRespond).not.toBeNull();
    expect(JSON.parse(result.autoRespond!.replyData).type).toBe('pong');
  });
});
