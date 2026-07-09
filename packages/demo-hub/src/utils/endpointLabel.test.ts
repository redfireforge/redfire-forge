import { describe, it, expect } from 'vitest';
import { deriveEndpointHostPort, deriveEndpointLabel } from './endpointLabel';

describe('deriveEndpointLabel', () => {
  it('maps well-known demo fixture ports to friendly names', () => {
    expect(deriveEndpointLabel('http://localhost:50052/health')).toBe('Docker echo');
    expect(deriveEndpointLabel('http://localhost:3001/health')).toBe('Express proxy');
    expect(deriveEndpointLabel('http://localhost:4010/health')).toBe('GraphQL server');
    expect(deriveEndpointLabel('http://localhost:8081/actuator/health')).toBe('Spring Boot fixture');
  });

  it('falls back to host:port for unknown ports', () => {
    expect(deriveEndpointLabel('http://localhost:9999/health')).toBe('localhost:9999');
    expect(deriveEndpointLabel('ws://localhost:3100/socket.io/?EIO=4')).toBe('localhost:3100');
  });

  it('returns the raw string for unparseable input', () => {
    expect(deriveEndpointLabel('not a url')).toBe('not a url');
  });
});

describe('deriveEndpointHostPort', () => {
  it('extracts host:port from a URL', () => {
    expect(deriveEndpointHostPort('http://localhost:50052/health')).toBe('localhost:50052');
    expect(deriveEndpointHostPort('http://127.0.0.1:3001/health')).toBe('127.0.0.1:3001');
  });

  it('defaults the port from the protocol when omitted', () => {
    expect(deriveEndpointHostPort('http://example.com/health')).toBe('example.com:80');
    expect(deriveEndpointHostPort('https://example.com/health')).toBe('example.com:443');
  });

  it('returns the raw string for unparseable input', () => {
    expect(deriveEndpointHostPort('::::')).toBe('::::');
  });
});
