import { describe, it, expect } from 'vitest';
import { buildGraphqlCurlCommand, isLocalhostGraphqlEndpoint } from './graphqlCurlExport';

describe('isLocalhostGraphqlEndpoint', () => {
  it('detects localhost and loopback hosts', () => {
    expect(isLocalhostGraphqlEndpoint('http://127.0.0.1:4010/graphql')).toBe(true);
    expect(isLocalhostGraphqlEndpoint('http://localhost:4010/graphql')).toBe(true);
    expect(isLocalhostGraphqlEndpoint('http://api.example.com/graphql')).toBe(false);
  });
});

describe('buildGraphqlCurlCommand', () => {
  it('includes --noproxy for localhost endpoints so corporate HTTP_PROXY is ignored', () => {
    const cmd = buildGraphqlCurlCommand(
      'query { health }',
      {},
      'http://127.0.0.1:4010/graphql',
    );
    expect(cmd).toContain("--noproxy '*'");
    expect(cmd).toContain("'http://127.0.0.1:4010/graphql'");
  });

  it('omits --noproxy for remote endpoints', () => {
    const cmd = buildGraphqlCurlCommand(
      'query { health }',
      {},
      'https://api.example.com/graphql',
    );
    expect(cmd).not.toContain('--noproxy');
  });

  it('escapes single quotes in JSON body', () => {
    const cmd = buildGraphqlCurlCommand(
      "query { user(name: \"O'Brien\") { id } }",
      {},
      'http://localhost/graphql',
    );
    expect(cmd).toContain("'\\''");
  });
});
