import { describe, it, expect } from 'vitest';
import {
  decodeGqlWsMessage,
  encodeGqlWsConnectionInit,
  encodeGqlWsSubscribe,
  encodeGqlWsComplete,
  encodeGqlWsPing,
  encodeGqlWsPong,
  getGqlWsMessageSummary,
  isGqlWsPing,
  isGqlWsConnectionAck,
} from './graphqlWsCodec';

describe('graphqlWsCodec', () => {
  describe('decodeGqlWsMessage', () => {
    it('decodes connection_init', () => {
      const msg = decodeGqlWsMessage('{"type":"connection_init"}');
      expect(msg.type).toBe('connection_init');
      expect(msg.id).toBeUndefined();
      expect(msg.payload).toBeUndefined();
    });

    it('decodes connection_ack with payload', () => {
      const msg = decodeGqlWsMessage('{"type":"connection_ack","payload":{"server":"v1"}}');
      expect(msg.type).toBe('connection_ack');
      expect(msg.payload).toEqual({ server: 'v1' });
    });

    it('decodes subscribe', () => {
      const raw = JSON.stringify({
        type: 'subscribe',
        id: '1',
        payload: { query: 'subscription { onMsg { id } }' },
      });
      const msg = decodeGqlWsMessage(raw);
      expect(msg.type).toBe('subscribe');
      expect(msg.id).toBe('1');
      expect((msg.payload as Record<string, unknown>).query).toBe('subscription { onMsg { id } }');
    });

    it('decodes next', () => {
      const raw = JSON.stringify({
        type: 'next',
        id: '1',
        payload: { data: { onMsg: { id: '42', text: 'hello' } } },
      });
      const msg = decodeGqlWsMessage(raw);
      expect(msg.type).toBe('next');
      expect(msg.id).toBe('1');
    });

    it('decodes error', () => {
      const raw = JSON.stringify({
        type: 'error',
        id: '2',
        payload: [{ message: 'Field not found' }],
      });
      const msg = decodeGqlWsMessage(raw);
      expect(msg.type).toBe('error');
      expect(msg.id).toBe('2');
      expect(Array.isArray(msg.payload)).toBe(true);
    });

    it('decodes complete', () => {
      const msg = decodeGqlWsMessage('{"type":"complete","id":"3"}');
      expect(msg.type).toBe('complete');
      expect(msg.id).toBe('3');
    });

    it('decodes ping', () => {
      const msg = decodeGqlWsMessage('{"type":"ping"}');
      expect(msg.type).toBe('ping');
    });

    it('decodes pong', () => {
      const msg = decodeGqlWsMessage('{"type":"pong"}');
      expect(msg.type).toBe('pong');
    });

    it('handles invalid JSON gracefully', () => {
      const msg = decodeGqlWsMessage('not json');
      expect(msg.type).toBe('unknown');
      expect(msg.payload).toBe('not json');
    });

    it('handles JSON without type field', () => {
      const msg = decodeGqlWsMessage('{"foo":"bar"}');
      expect(msg.type).toBe('unknown');
    });

    it('coerces numeric id to string', () => {
      const msg = decodeGqlWsMessage('{"type":"next","id":42,"payload":{"data":{}}}');
      expect(msg.id).toBe('42');
    });
  });

  describe('encodeGqlWsConnectionInit', () => {
    it('encodes without payload', () => {
      const result = JSON.parse(encodeGqlWsConnectionInit());
      expect(result.type).toBe('connection_init');
      expect(result.payload).toBeUndefined();
    });

    it('encodes with auth payload', () => {
      const result = JSON.parse(encodeGqlWsConnectionInit({ token: 'abc123' }));
      expect(result.type).toBe('connection_init');
      expect(result.payload).toEqual({ token: 'abc123' });
    });

    it('omits empty payload object', () => {
      const result = JSON.parse(encodeGqlWsConnectionInit({}));
      expect(result.payload).toBeUndefined();
    });
  });

  describe('encodeGqlWsSubscribe', () => {
    it('encodes basic subscription', () => {
      const result = JSON.parse(encodeGqlWsSubscribe('1', 'subscription { onMsg { id } }'));
      expect(result.type).toBe('subscribe');
      expect(result.id).toBe('1');
      expect(result.payload.query).toBe('subscription { onMsg { id } }');
      expect(result.payload.variables).toBeUndefined();
    });

    it('encodes with variables', () => {
      const result = JSON.parse(encodeGqlWsSubscribe('2', 'query GetUser($id: ID!) { user(id: $id) { name } }', { id: '5' }));
      expect(result.payload.variables).toEqual({ id: '5' });
    });

    it('encodes with operationName', () => {
      const result = JSON.parse(encodeGqlWsSubscribe('3', 'query Foo { bar }', undefined, 'Foo'));
      expect(result.payload.operationName).toBe('Foo');
    });

    it('omits empty variables', () => {
      const result = JSON.parse(encodeGqlWsSubscribe('4', 'query { x }', {}));
      expect(result.payload.variables).toBeUndefined();
    });
  });

  describe('encodeGqlWsComplete', () => {
    it('encodes complete message', () => {
      const result = JSON.parse(encodeGqlWsComplete('5'));
      expect(result.type).toBe('complete');
      expect(result.id).toBe('5');
    });
  });

  describe('encodeGqlWsPing / encodeGqlWsPong', () => {
    it('encodes ping without payload', () => {
      const result = JSON.parse(encodeGqlWsPing());
      expect(result.type).toBe('ping');
      expect(result.payload).toBeUndefined();
    });

    it('encodes ping with payload', () => {
      const result = JSON.parse(encodeGqlWsPing({ ts: 123 }));
      expect(result.type).toBe('ping');
      expect(result.payload).toEqual({ ts: 123 });
    });

    it('encodes pong without payload', () => {
      const result = JSON.parse(encodeGqlWsPong());
      expect(result.type).toBe('pong');
      expect(result.payload).toBeUndefined();
    });

    it('encodes pong with payload', () => {
      const result = JSON.parse(encodeGqlWsPong({ ts: 456 }));
      expect(result.payload).toEqual({ ts: 456 });
    });
  });

  describe('getGqlWsMessageSummary', () => {
    it('summarizes connection_init', () => {
      expect(getGqlWsMessageSummary({ type: 'connection_init' })).toBe('connection_init');
    });

    it('summarizes connection_ack', () => {
      expect(getGqlWsMessageSummary({ type: 'connection_ack' })).toBe('connection_ack');
    });

    it('summarizes subscribe with named operation', () => {
      const msg = { type: 'subscribe', id: '1', payload: { query: 'subscription OnMsg { onMsg { id } }' } };
      expect(getGqlWsMessageSummary(msg)).toBe('subscribe #1: subscription OnMsg');
    });

    it('summarizes subscribe with anonymous operation', () => {
      const msg = { type: 'subscribe', id: '2', payload: { query: 'query { users { id } }' } };
      expect(getGqlWsMessageSummary(msg)).toBe('subscribe #2: query');
    });

    it('summarizes subscribe without query', () => {
      const msg = { type: 'subscribe', id: '3', payload: {} };
      expect(getGqlWsMessageSummary(msg)).toBe('subscribe #3');
    });

    it('summarizes next with data key', () => {
      const msg = { type: 'next', id: '1', payload: { data: { onMsg: { id: '1' } } } };
      expect(getGqlWsMessageSummary(msg)).toBe('next #1: {onMsg…}');
    });

    it('summarizes next without data', () => {
      const msg = { type: 'next', id: '1', payload: {} };
      expect(getGqlWsMessageSummary(msg)).toBe('next #1');
    });

    it('summarizes error with message', () => {
      const msg = { type: 'error', id: '2', payload: [{ message: 'Not authorized' }] };
      expect(getGqlWsMessageSummary(msg)).toBe('error #2: Not authorized');
    });

    it('summarizes error without message', () => {
      const msg = { type: 'error', id: '2', payload: [] };
      expect(getGqlWsMessageSummary(msg)).toBe('error #2');
    });

    it('summarizes complete with id', () => {
      expect(getGqlWsMessageSummary({ type: 'complete', id: '4' })).toBe('complete #4');
    });

    it('summarizes complete without id', () => {
      expect(getGqlWsMessageSummary({ type: 'complete' })).toBe('complete');
    });

    it('summarizes ping', () => {
      expect(getGqlWsMessageSummary({ type: 'ping' })).toBe('ping');
    });

    it('summarizes pong', () => {
      expect(getGqlWsMessageSummary({ type: 'pong' })).toBe('pong');
    });

    it('returns type for unknown', () => {
      expect(getGqlWsMessageSummary({ type: 'custom' })).toBe('custom');
    });
  });

  describe('isGqlWsPing', () => {
    it('returns true for ping', () => {
      expect(isGqlWsPing({ type: 'ping' })).toBe(true);
    });

    it('returns false for pong', () => {
      expect(isGqlWsPing({ type: 'pong' })).toBe(false);
    });

    it('returns false for next', () => {
      expect(isGqlWsPing({ type: 'next', id: '1' })).toBe(false);
    });
  });

  describe('isGqlWsConnectionAck', () => {
    it('returns true for connection_ack', () => {
      expect(isGqlWsConnectionAck({ type: 'connection_ack' })).toBe(true);
    });

    it('returns false for connection_init', () => {
      expect(isGqlWsConnectionAck({ type: 'connection_init' })).toBe(false);
    });
  });
});
