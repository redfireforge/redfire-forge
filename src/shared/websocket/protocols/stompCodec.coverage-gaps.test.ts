import { describe, it, expect } from 'vitest';
import {
  decodeStompFrame,
  encodeStompFrame,
  encodeStompConnect,
  encodeStompSend,
  encodeStompDisconnect,
  getStompFrameSummary,
} from './stompCodec';

describe('stompCodec coverage gaps', () => {
  it('decodeStompFrame handles trailing backslash in header value', () => {
    const raw = 'MESSAGE\nkey:val\\\\\n\n\0';
    const frame = decodeStompFrame(raw);
    expect(frame.headers['key']).toBe('val\\');
  });

  it('encodeStompConnect omits optional fields when not provided', () => {
    const frame = encodeStompConnect();
    expect(frame).toContain('CONNECT');
    expect(frame).not.toContain('host:');
    expect(frame).not.toContain('login:');
    expect(frame).not.toContain('passcode:');
    expect(frame).not.toContain('heart-beat:');
  });

  it('encodeStompSend omits content-type and content-length when body is absent', () => {
    const frame = encodeStompSend('/topic/a');
    expect(frame).toContain('destination:/topic/a');
    expect(frame).not.toContain('content-type:');
    expect(frame).not.toContain('content-length:');
  });

  it('encodeStompDisconnect omits receipt header when not provided', () => {
    const frame = encodeStompDisconnect();
    expect(frame).toContain('DISCONNECT');
    expect(frame).not.toContain('receipt:');
  });

  it('getStompFrameSummary covers default command branch', () => {
    const frame = decodeStompFrame('BEGIN\ntx:1\n\n\0');
    expect(getStompFrameSummary(frame)).toBe('BEGIN');
  });

  it('getStompFrameSummary covers CONNECT with host header', () => {
    const frame = decodeStompFrame('CONNECT\nhost:broker.example\n\n\0');
    expect(getStompFrameSummary(frame)).toBe('CONNECT → broker.example');
  });

  it('encodeStompFrame escapes backslashes before other sequences in keys and values', () => {
    const frame = encodeStompFrame('SEND', { 'weird\\key': 'a\\nb' }, 'body');
    expect(frame).toContain('weird\\\\key:a\\\\nb');
  });
});
