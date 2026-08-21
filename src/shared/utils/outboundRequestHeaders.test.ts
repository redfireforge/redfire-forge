import { describe, expect, it } from 'vitest';
import {
  isClientManagedRequestHeader,
  stripClientManagedRequestHeaders,
  withKeepAliveConnection,
} from './outboundRequestHeaders';

describe('outboundRequestHeaders', () => {
  it('flags hop-by-hop and client-managed names case-insensitively', () => {
    expect(isClientManagedRequestHeader('connection')).toBe(true);
    expect(isClientManagedRequestHeader('Connection')).toBe(true);
    expect(isClientManagedRequestHeader('HOST')).toBe(true);
    expect(isClientManagedRequestHeader('accept-encoding')).toBe(true);
    expect(isClientManagedRequestHeader('x-custom')).toBe(false);
    expect(isClientManagedRequestHeader('accept')).toBe(false);
  });

  it('strips journal transport headers while keeping useful ones', () => {
    expect(stripClientManagedRequestHeaders({
      host: '127.0.0.1:4500',
      connection: 'keep-alive',
      accept: '*/*',
      'user-agent': 'node',
      'accept-encoding': 'gzip, deflate',
      'x-request-id': 'abc',
    })).toEqual({
      accept: '*/*',
      'user-agent': 'node',
      'x-request-id': 'abc',
    });
  });

  it('withKeepAliveConnection removes lowercase connection before setting Connection', () => {
    expect(withKeepAliveConnection({
      connection: 'keep-alive',
      Host: '127.0.0.1:4500',
      accept: '*/*',
    })).toEqual({
      accept: '*/*',
      Connection: 'keep-alive',
    });
  });
});
