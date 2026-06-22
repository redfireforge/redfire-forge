import { describe, it, expect, vi, beforeEach } from 'vitest';
import { deriveEndpointHostnameBadge, isGraphqlMockEndpoint, normalizeGraphqlEndpoint, resolveMockServerConnectionId } from './graphqlEndpointUtils';

vi.mock('../../../shared/utils/platform', () => ({
  isTauri: vi.fn(() => false),
}));

import { isTauri } from '../../../shared/utils/platform';

describe('normalizeGraphqlEndpoint', () => {
  beforeEach(() => {
    vi.mocked(isTauri).mockReturnValue(false);
  });

  it('trims surrounding whitespace and rewrites localhost to 127.0.0.1 on web', () => {
    expect(normalizeGraphqlEndpoint('  http://localhost:4010/graphql  ')).toBe('http://127.0.0.1:4010/graphql');
  });

  it('keeps localhost on desktop (Tauri)', () => {
    vi.mocked(isTauri).mockReturnValue(true);
    expect(normalizeGraphqlEndpoint('http://localhost:4010/graphql')).toBe('http://localhost:4010/graphql');
    expect(normalizeGraphqlEndpoint('http://127.0.0.1:4010/graphql')).toBe('http://localhost:4010/graphql');
  });

  it('returns empty string for undefined or null', () => {
    expect(normalizeGraphqlEndpoint(undefined)).toBe('');
    expect(normalizeGraphqlEndpoint(null)).toBe('');
  });
});

describe('isGraphqlMockEndpoint', () => {
  it('detects the desktop mock proxy URL', () => {
    expect(isGraphqlMockEndpoint('http://localhost:3001/api/graphql/mock')).toBe(true);
  });

  it('returns false for live GraphQL endpoints', () => {
    expect(isGraphqlMockEndpoint('http://localhost:4010/graphql')).toBe(false);
  });
});

describe('resolveMockServerConnectionId', () => {
  it('prefers the live upstream endpoint over the mock proxy URL', () => {
    expect(resolveMockServerConnectionId(
      'http://localhost:4010/graphql',
      null,
      'http://localhost:3001/api/graphql/mock',
    )).toBe('http://localhost:4010/graphql');
  });

  it('skips mock URL when tab override points at the mock proxy', () => {
    expect(resolveMockServerConnectionId(
      '',
      'http://localhost:4010/graphql',
      'http://localhost:3001/api/graphql/mock',
    )).toBe('http://localhost:4010/graphql');
  });

  it('prefers tab override when requested', () => {
    expect(resolveMockServerConnectionId(
      'https://api.example.com/graphql',
      'https://api.example.com/graphql',
      'https://staging.example.com/graphql',
      true,
    )).toBe('https://staging.example.com/graphql');
  });

  it('returns empty string when only mock URLs are available', () => {
    expect(resolveMockServerConnectionId(
      'http://localhost:3001/api/graphql/mock',
      null,
      'http://localhost:3001/api/graphql/mock',
    )).toBe('');
  });
});

describe('deriveEndpointHostnameBadge', () => {
  beforeEach(() => {
    vi.mocked(isTauri).mockReturnValue(false);
  });

  it('returns hostname for https URL', () => {
    expect(deriveEndpointHostnameBadge('https://api.example.com/graphql')).toBe('api.example.com');
  });

  it('returns hostname:port when port is present', () => {
    expect(deriveEndpointHostnameBadge('https://localhost:4000/graphql')).toBe('localhost:4000');
  });

  it('truncates long hostnames', () => {
    expect(deriveEndpointHostnameBadge('https://very-long-subdomain.example.com/graphql', 10))
      .toBe('very-long…');
  });

  it('returns null for empty or invalid URLs', () => {
    expect(deriveEndpointHostnameBadge('')).toBeNull();
    expect(deriveEndpointHostnameBadge('not-a-url')).toBeNull();
  });

  it('parses http URLs', () => {
    expect(deriveEndpointHostnameBadge('http://staging.example.com/v1/gql')).toBe('staging.example.com');
  });

  it('parses bare hostname without scheme', () => {
    expect(deriveEndpointHostnameBadge('api.example.com/graphql')).toBe('api.example.com');
  });

  it('parses bare localhost with port', () => {
    expect(deriveEndpointHostnameBadge('localhost:4000/graphql')).toBe('localhost:4000');
  });

  it('falls back to regex when URL constructor throws', () => {
    expect(deriveEndpointHostnameBadge('https://[invalid/graphql')).toBe('[invalid');
  });

  it('returns null for hostname shorter than 2 chars', () => {
    expect(deriveEndpointHostnameBadge('https://a/x')).toBeNull();
  });
});
