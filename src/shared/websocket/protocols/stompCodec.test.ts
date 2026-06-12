import { describe, it, expect } from 'vitest';
import {
  decodeStompFrame,
  encodeStompFrame,
  encodeStompConnect,
  encodeStompSend,
  encodeStompSubscribe,
  encodeStompDisconnect,
  getStompFrameSummary,
  isStompHeartbeat,
  encodeStompHeartbeat,
  isStompFrame,
} from './stompCodec';

describe('stompCodec', () => {
  describe('decodeStompFrame', () => {
    it('decodes a CONNECTED frame', () => {
      const raw = 'CONNECTED\nversion:1.2\nheart-beat:0,0\n\n\0';
      const frame = decodeStompFrame(raw);
      expect(frame.command).toBe('CONNECTED');
      expect(frame.headers['version']).toBe('1.2');
      expect(frame.headers['heart-beat']).toBe('0,0');
      expect(frame.body).toBe('');
    });

    it('decodes a MESSAGE frame with body', () => {
      const raw = 'MESSAGE\ndestination:/topic/chat\nmessage-id:msg-001\ncontent-type:text/plain\n\nHello World!\0';
      const frame = decodeStompFrame(raw);
      expect(frame.command).toBe('MESSAGE');
      expect(frame.headers['destination']).toBe('/topic/chat');
      expect(frame.headers['message-id']).toBe('msg-001');
      expect(frame.body).toBe('Hello World!');
    });

    it('decodes a MESSAGE with JSON body', () => {
      const body = '{"user":"alice","text":"hi"}';
      const raw = `MESSAGE\ndestination:/queue/updates\ncontent-type:application/json\n\n${body}\0`;
      const frame = decodeStompFrame(raw);
      expect(frame.command).toBe('MESSAGE');
      expect(frame.body).toBe(body);
    });

    it('decodes a SEND frame', () => {
      const raw = 'SEND\ndestination:/app/chat\ncontent-length:5\n\nhello\0';
      const frame = decodeStompFrame(raw);
      expect(frame.command).toBe('SEND');
      expect(frame.headers['destination']).toBe('/app/chat');
      expect(frame.body).toBe('hello');
    });

    it('decodes a SUBSCRIBE frame', () => {
      const raw = 'SUBSCRIBE\ndestination:/topic/news\nid:sub-0\nack:auto\n\n\0';
      const frame = decodeStompFrame(raw);
      expect(frame.command).toBe('SUBSCRIBE');
      expect(frame.headers['destination']).toBe('/topic/news');
      expect(frame.headers['id']).toBe('sub-0');
      expect(frame.headers['ack']).toBe('auto');
    });

    it('decodes an ERROR frame', () => {
      const raw = 'ERROR\nmessage:Invalid destination\n\nThe destination /bad does not exist.\0';
      const frame = decodeStompFrame(raw);
      expect(frame.command).toBe('ERROR');
      expect(frame.headers['message']).toBe('Invalid destination');
      expect(frame.body).toBe('The destination /bad does not exist.');
    });

    it('decodes a RECEIPT frame', () => {
      const raw = 'RECEIPT\nreceipt-id:msg-12345\n\n\0';
      const frame = decodeStompFrame(raw);
      expect(frame.command).toBe('RECEIPT');
      expect(frame.headers['receipt-id']).toBe('msg-12345');
    });

    it('handles CRLF line endings', () => {
      const raw = 'CONNECTED\r\nversion:1.2\r\n\r\n\0';
      const frame = decodeStompFrame(raw);
      expect(frame.command).toBe('CONNECTED');
      expect(frame.headers['version']).toBe('1.2');
    });

    it('handles frame without null terminator', () => {
      const raw = 'MESSAGE\ndestination:/topic/a\n\nbody';
      const frame = decodeStompFrame(raw);
      expect(frame.command).toBe('MESSAGE');
      expect(frame.body).toBe('body');
    });

    it('uses first occurrence for duplicate headers', () => {
      const raw = 'MESSAGE\nfoo:first\nfoo:second\n\n\0';
      const frame = decodeStompFrame(raw);
      expect(frame.headers['foo']).toBe('first');
    });

    it('decodes escaped header values (v1.2)', () => {
      const raw = 'MESSAGE\nheader-with\\ccolon:value\\nwith\\nnewlines\n\n\0';
      const frame = decodeStompFrame(raw);
      expect(frame.headers['header-with:colon']).toBe('value\nwith\nnewlines');
    });

    it('correctly decodes \\\\ followed by n (not as newline)', () => {
      // \\n in STOMP header = escaped backslash + literal n
      const raw = 'MESSAGE\npath:C\\\\nope\n\n\0';
      const frame = decodeStompFrame(raw);
      expect(frame.headers['path']).toBe('C\\nope');
    });

    it('decodes \\r escape as carriage return (STOMP v1.2)', () => {
      const raw = 'MESSAGE\nvalue:line1\\rline2\n\n\0';
      const frame = decodeStompFrame(raw);
      expect(frame.headers['value']).toBe('line1\rline2');
    });

    it('decodes command case-insensitively (normalizes to uppercase)', () => {
      const raw = 'connected\nversion:1.2\n\n\0';
      const frame = decodeStompFrame(raw);
      expect(frame.command).toBe('CONNECTED');
    });

    it('handles empty body with double newline', () => {
      const raw = 'DISCONNECT\nreceipt:r1\n\n\0';
      const frame = decodeStompFrame(raw);
      expect(frame.command).toBe('DISCONNECT');
      expect(frame.headers['receipt']).toBe('r1');
      expect(frame.body).toBe('');
    });
  });

  describe('encodeStompFrame', () => {
    it('encodes a basic frame', () => {
      const result = encodeStompFrame('SEND', { destination: '/topic/test' }, 'hello');
      expect(result).toBe('SEND\ndestination:/topic/test\n\nhello\0');
    });

    it('encodes a frame without body', () => {
      const result = encodeStompFrame('DISCONNECT', { receipt: 'r1' });
      expect(result).toBe('DISCONNECT\nreceipt:r1\n\n\0');
    });

    it('escapes header values', () => {
      const result = encodeStompFrame('SEND', { 'key:special': 'val\nnewline' });
      expect(result).toContain('key\\cspecial:val\\nnewline');
    });

    it('escapes carriage return in header values (STOMP v1.2)', () => {
      const result = encodeStompFrame('SEND', { key: 'val\rwith\rcr' });
      expect(result).toContain('key:val\\rwith\\rcr');
    });

    it('encodes multiple headers', () => {
      const result = encodeStompFrame('SUBSCRIBE', { destination: '/a', id: 'sub-1', ack: 'auto' });
      expect(result).toContain('destination:/a\n');
      expect(result).toContain('id:sub-1\n');
      expect(result).toContain('ack:auto\n');
    });
  });

  describe('encodeStompConnect', () => {
    it('encodes minimal CONNECT', () => {
      const result = encodeStompConnect();
      expect(result).toContain('CONNECT\n');
      expect(result).toContain('accept-version:1.2\n');
      expect(result.endsWith('\n\0')).toBe(true);
    });

    it('encodes CONNECT with host', () => {
      const result = encodeStompConnect('my-broker');
      expect(result).toContain('host:my-broker\n');
    });

    it('encodes CONNECT with credentials', () => {
      const result = encodeStompConnect('host', 'user', 'pass');
      expect(result).toContain('login:user\n');
      expect(result).toContain('passcode:pass\n');
    });

    it('encodes CONNECT with heart-beat', () => {
      const result = encodeStompConnect(undefined, undefined, undefined, [10000, 10000]);
      expect(result).toContain('heart-beat:10000,10000\n');
    });
  });

  describe('encodeStompSend', () => {
    it('encodes SEND with destination and body', () => {
      const result = encodeStompSend('/topic/chat', 'hello');
      expect(result).toContain('SEND\n');
      expect(result).toContain('destination:/topic/chat\n');
      expect(result).toContain('content-length:5\n');
      expect(result.endsWith('hello\0')).toBe(true);
    });

    it('encodes SEND with content-type', () => {
      const result = encodeStompSend('/queue/msg', '{"a":1}', 'application/json');
      expect(result).toContain('content-type:application/json\n');
    });

    it('encodes SEND without body', () => {
      const result = encodeStompSend('/topic/trigger');
      expect(result).toContain('destination:/topic/trigger\n');
      expect(result.endsWith('\n\0')).toBe(true);
    });

    it('encodes SEND with extra headers', () => {
      const result = encodeStompSend('/topic/x', 'data', undefined, { receipt: 'r-1' });
      expect(result).toContain('receipt:r-1\n');
    });
  });

  describe('encodeStompSubscribe', () => {
    it('encodes SUBSCRIBE', () => {
      const result = encodeStompSubscribe('/topic/news', 'sub-0');
      expect(result).toContain('SUBSCRIBE\n');
      expect(result).toContain('destination:/topic/news\n');
      expect(result).toContain('id:sub-0\n');
      expect(result).toContain('ack:auto\n');
    });

    it('encodes SUBSCRIBE with client ack', () => {
      const result = encodeStompSubscribe('/queue/work', 'sub-1', 'client');
      expect(result).toContain('ack:client\n');
    });
  });

  describe('encodeStompDisconnect', () => {
    it('encodes basic DISCONNECT', () => {
      const result = encodeStompDisconnect();
      expect(result).toBe('DISCONNECT\n\n\0');
    });

    it('encodes DISCONNECT with receipt', () => {
      const result = encodeStompDisconnect('r-77');
      expect(result).toContain('receipt:r-77\n');
    });
  });

  describe('getStompFrameSummary', () => {
    it('summarizes CONNECTED', () => {
      const frame = decodeStompFrame('CONNECTED\nversion:1.2\n\n\0');
      expect(getStompFrameSummary(frame)).toBe('CONNECTED (v1.2)');
    });

    it('summarizes MESSAGE with destination', () => {
      const frame = decodeStompFrame('MESSAGE\ndestination:/topic/chat\n\nhello\0');
      expect(getStompFrameSummary(frame)).toBe('MESSAGE ← /topic/chat');
    });

    it('summarizes SEND with destination', () => {
      const frame = decodeStompFrame('SEND\ndestination:/app/msg\n\nhi\0');
      expect(getStompFrameSummary(frame)).toBe('SEND → /app/msg');
    });

    it('summarizes SUBSCRIBE', () => {
      const frame = decodeStompFrame('SUBSCRIBE\ndestination:/topic/news\nid:sub-0\n\n\0');
      expect(getStompFrameSummary(frame)).toBe('SUBSCRIBE /topic/news');
    });

    it('summarizes UNSUBSCRIBE', () => {
      const frame = decodeStompFrame('UNSUBSCRIBE\nid:sub-0\n\n\0');
      expect(getStompFrameSummary(frame)).toBe('UNSUBSCRIBE sub-0');
    });

    it('summarizes RECEIPT', () => {
      const frame = decodeStompFrame('RECEIPT\nreceipt-id:r-1\n\n\0');
      expect(getStompFrameSummary(frame)).toBe('RECEIPT #r-1');
    });

    it('summarizes ERROR', () => {
      const frame = decodeStompFrame('ERROR\nmessage:Bad request\n\ndetails\0');
      expect(getStompFrameSummary(frame)).toBe('ERROR: Bad request');
    });

    it('summarizes DISCONNECT', () => {
      const frame = decodeStompFrame('DISCONNECT\n\n\0');
      expect(getStompFrameSummary(frame)).toBe('DISCONNECT');
    });

    it('summarizes CONNECT', () => {
      const frame = decodeStompFrame('CONNECT\nhost:broker.example.com\n\n\0');
      expect(getStompFrameSummary(frame)).toBe('CONNECT → broker.example.com');
    });

    it('summarizes ACK', () => {
      const frame = decodeStompFrame('ACK\nmessage-id:msg-42\n\n\0');
      expect(getStompFrameSummary(frame)).toBe('ACK msg-42');
    });

    it('summarizes NACK', () => {
      const frame = decodeStompFrame('NACK\nid:sub-1\n\n\0');
      expect(getStompFrameSummary(frame)).toBe('NACK sub-1');
    });
  });

  describe('isStompHeartbeat', () => {
    it('returns true for empty string', () => {
      expect(isStompHeartbeat('')).toBe(true);
    });

    it('returns true for single LF', () => {
      expect(isStompHeartbeat('\n')).toBe(true);
    });

    it('returns true for CRLF', () => {
      expect(isStompHeartbeat('\r\n')).toBe(true);
    });

    it('returns true for null char only', () => {
      expect(isStompHeartbeat('\0')).toBe(true);
    });

    it('returns false for actual frame', () => {
      expect(isStompHeartbeat('MESSAGE\ndestination:/topic\n\n\0')).toBe(false);
    });

    it('returns false for text content', () => {
      expect(isStompHeartbeat('hello')).toBe(false);
    });
  });

  describe('encodeStompHeartbeat', () => {
    it('returns LF', () => {
      expect(encodeStompHeartbeat()).toBe('\n');
    });
  });

  describe('isStompFrame', () => {
    it('returns true for CONNECTED', () => {
      expect(isStompFrame('CONNECTED\nversion:1.2\n\n\0')).toBe(true);
    });

    it('returns true for MESSAGE', () => {
      expect(isStompFrame('MESSAGE\ndestination:/a\n\n\0')).toBe(true);
    });

    it('returns true for SEND', () => {
      expect(isStompFrame('SEND\ndestination:/b\n\nhi\0')).toBe(true);
    });

    it('returns false for empty string', () => {
      expect(isStompFrame('')).toBe(false);
    });

    it('returns false for arbitrary text', () => {
      expect(isStompFrame('hello world')).toBe(false);
    });

    it('returns false for JSON', () => {
      expect(isStompFrame('{"type":"message"}')).toBe(false);
    });
  });
});
