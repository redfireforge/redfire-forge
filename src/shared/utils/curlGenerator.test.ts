import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../engine/tokenManager', () => ({
  acquireOAuth2Token: vi.fn(),
}));

import { buildCurlCommand } from './curlGenerator';
import { acquireOAuth2Token } from '@engine/tokenManager';
import type { AuthConfig, Scenario } from '../types';

const mockAcquireOAuth2 = vi.mocked(acquireOAuth2Token);

function minimalScenario(overrides: Partial<Scenario> = {}): Scenario {
  return {
    id: 's1',
    name: 'Test',
    url: 'https://api.example.com/v1/resource',
    method: 'GET',
    headers: [],
    body: '',
    auth: { type: 'none' },
    validation: { mode: 'none' },
    ...overrides,
  };
}

describe('buildCurlCommand', () => {
  beforeEach(() => {
    mockAcquireOAuth2.mockReset();
  });

  it('builds minimal GET without -X and only the URL', async () => {
    const scenario = minimalScenario();
    const cmd = await buildCurlCommand(scenario, { type: 'none' });
    expect(cmd).toBe("curl 'https://api.example.com/v1/resource'");
    expect(cmd).not.toMatch(/-X/);
  });

  it('adds -X for non-GET methods', async () => {
    const scenario = minimalScenario({ method: 'POST' });
    const cmd = await buildCurlCommand(scenario, { type: 'none' });
    expect(cmd).toContain("-X POST");
  });

  it('skips headers with empty or whitespace keys', async () => {
    const scenario = minimalScenario({
      method: 'POST',
      headers: [
        { key: '   ', value: 'x' },
        { key: '', value: 'y' },
        { key: 'X-Foo', value: 'bar' },
      ],
    });
    const cmd = await buildCurlCommand(scenario, { type: 'none' });
    expect(cmd).toContain("X-Foo: bar");
    expect(cmd).not.toContain('whitespace');
  });

  it('omits scenario Authorization header when effective auth is not none', async () => {
    const scenario = minimalScenario({
      method: 'POST',
      headers: [{ key: 'Authorization', value: 'Bearer old' }],
    });
    const cmd = await buildCurlCommand(scenario, {
      type: 'basic',
      username: 'u',
      password: 'p',
    });
    expect(cmd).not.toContain('Bearer old');
    expect(cmd).toMatch(/Authorization: Basic/);
  });

  it('keeps scenario Authorization header when effective auth is none', async () => {
    const scenario = minimalScenario({
      method: 'POST',
      headers: [{ key: 'Authorization', value: 'Custom token' }],
    });
    const cmd = await buildCurlCommand(scenario, { type: 'none' });
    expect(cmd).toContain("Authorization: Custom token");
  });

  it('adds Basic auth via resolveAuthHeaders', async () => {
    const scenario = minimalScenario({ method: 'GET' });
    const cmd = await buildCurlCommand(scenario, {
      type: 'basic',
      username: 'alice',
      password: 'secret',
    });
    expect(cmd).toContain(`Basic ${btoa('alice:secret')}`);
  });

  it('adds Bearer auth via resolveAuthHeaders', async () => {
    const scenario = minimalScenario({ method: 'GET' });
    const cmd = await buildCurlCommand(scenario, {
      type: 'bearer',
      token: 'tok123',
    });
    expect(cmd).toContain('Bearer tok123');
  });

  it('adds API key in header via resolveAuthHeaders', async () => {
    const scenario = minimalScenario({ method: 'GET' });
    const cmd = await buildCurlCommand(scenario, {
      type: 'apikey',
      apiKeyName: 'X-Key',
      apiKeyValue: 'abc',
      apiKeyIn: 'header',
    });
    expect(cmd).toContain("X-Key: abc");
  });

  it('appends API key to query string when apiKeyIn is query', async () => {
    const scenario = minimalScenario({
      method: 'GET',
      url: 'https://api.example.com/items?page=1',
    });
    const cmd = await buildCurlCommand(scenario, {
      type: 'apikey',
      apiKeyName: 'key',
      apiKeyValue: 'val',
      apiKeyIn: 'query',
    });
    expect(cmd).toMatch(/key=val/);
    expect(cmd).toContain('https://api.example.com/items');
  });

  it('keeps original URL when query API key cannot parse URL', async () => {
    const scenario = minimalScenario({
      method: 'GET',
      url: ':::',
    });
    const cmd = await buildCurlCommand(scenario, {
      type: 'apikey',
      apiKeyName: 'k',
      apiKeyValue: 'v',
      apiKeyIn: 'query',
    });
    expect(cmd).toContain("':::");
  });

  it('does not modify URL for apikey query when name or value is missing', async () => {
    const scenario = minimalScenario({
      method: 'GET',
      url: 'https://api.example.com/x',
    });
    const cmd = await buildCurlCommand(scenario, {
      type: 'apikey',
      apiKeyName: '',
      apiKeyValue: 'v',
      apiKeyIn: 'query',
    });
    expect(cmd).toBe("curl 'https://api.example.com/x'");
  });

  it('adds digest flags and -u without resolveAuthHeaders branch', async () => {
    const scenario = minimalScenario({ method: 'GET' });
    const cmd = await buildCurlCommand(scenario, {
      type: 'digest',
      username: 'root',
      password: 'toor',
    });
    expect(cmd).toContain('--digest');
    expect(cmd).toContain("-u 'root:toor'");
  });

  it('uses empty password in digest -u when password omitted', async () => {
    const scenario = minimalScenario({ method: 'GET' });
    const cmd = await buildCurlCommand(scenario, {
      type: 'digest',
      username: 'root',
    });
    expect(cmd).toContain("-u 'root:'");
  });

  it('does not add digest when username is missing', async () => {
    const scenario = minimalScenario({ method: 'GET' });
    const cmd = await buildCurlCommand(scenario, {
      type: 'digest',
      username: '',
      password: 'x',
    });
    expect(cmd).not.toContain('--digest');
  });

  it('injects OAuth2 Bearer token when acquireOAuth2Token succeeds', async () => {
    mockAcquireOAuth2.mockResolvedValue('access-token-xyz');
    const scenario = minimalScenario({ method: 'GET' });
    const auth: AuthConfig = {
      type: 'oauth2',
      tokenUrl: 'https://id.example.com/token',
      clientId: 'c',
      clientSecret: 's',
    };
    const cmd = await buildCurlCommand(scenario, auth);
    expect(mockAcquireOAuth2).toHaveBeenCalledWith(auth);
    expect(cmd).toContain('Bearer access-token-xyz');
  });

  it('adds error placeholder when acquireOAuth2Token rejects', async () => {
    mockAcquireOAuth2.mockRejectedValue(new Error('network'));
    const scenario = minimalScenario({ method: 'GET' });
    const cmd = await buildCurlCommand(scenario, {
      type: 'oauth2',
      tokenUrl: 'https://id.example.com/token',
      clientId: 'c',
      clientSecret: 's',
    });
    expect(cmd).toContain('Bearer <TOKEN_ERROR: check OAuth2 config>');
  });

  it('form-data: defaults bodyForm to empty array when undefined', async () => {
    const scenario = minimalScenario({
      method: 'POST',
      bodyType: 'form-data',
      headers: [{ key: 'X-Only', value: '1' }],
      bodyForm: undefined,
    });
    const cmd = await buildCurlCommand(scenario, { type: 'none' });
    expect(cmd).toContain("X-Only: 1");
    expect(cmd).not.toContain('--form');
  });

  it('form-data: leaves headers unchanged when no Content-Type to strip', async () => {
    const scenario = minimalScenario({
      method: 'POST',
      bodyType: 'form-data',
      headers: [{ key: 'X-Only', value: '1' }],
      bodyForm: [{ key: 'f1', value: 'v' }],
    });
    const cmd = await buildCurlCommand(scenario, { type: 'none' });
    expect(cmd).toContain("X-Only: 1");
    expect(cmd).toContain("--form 'f1=v'");
  });

  it('form-data: strips Content-Type, emits --form and escapes single quotes in values', async () => {
    const scenario = minimalScenario({
      method: 'POST',
      bodyType: 'form-data',
      headers: [
        { key: 'Content-Type', value: 'multipart/form-data; boundary=old' },
        { key: 'X-Trace', value: '1' },
      ],
      bodyForm: [
        { key: 'a', value: "it's" },
        { key: '  ', value: 'skip' },
        { key: 'b', value: 'y' },
      ],
    });
    const cmd = await buildCurlCommand(scenario, { type: 'none' });
    expect(cmd).not.toMatch(/Content-Type/i);
    expect(cmd).toContain("X-Trace: 1");
    expect(cmd).toContain("--form 'a=it'\\''s'");
    expect(cmd).toContain("--form 'b=y'");
    expect(cmd).not.toContain('skip');
  });

  it('form-urlencoded: adds default Content-Type when missing and uses --data-urlencode', async () => {
    const scenario = minimalScenario({
      method: 'POST',
      bodyType: 'form-urlencoded',
      bodyForm: [
        { key: 'q', value: 'hello' },
        { key: 'x', value: "a'b" },
      ],
    });
    const cmd = await buildCurlCommand(scenario, { type: 'none' });
    expect(cmd).toContain('Content-Type: application/x-www-form-urlencoded');
    expect(cmd).toMatch(/--data-urlencode 'q=hello&x=a%27b'/);
  });

  it('form-urlencoded: does not duplicate Content-Type when already present', async () => {
    const scenario = minimalScenario({
      method: 'POST',
      bodyType: 'form-urlencoded',
      headers: [{ key: 'Content-Type', value: 'application/x-www-form-urlencoded;charset=utf-8' }],
      bodyForm: [{ key: 'a', value: '1' }],
    });
    const cmd = await buildCurlCommand(scenario, { type: 'none' });
    const matches = cmd.match(/Content-Type: application\/x-www-form-urlencoded/g);
    expect(matches?.length).toBe(1);
  });

  it('form-urlencoded: omits --data-urlencode when serialized body is empty', async () => {
    const scenario = minimalScenario({
      method: 'POST',
      bodyType: 'form-urlencoded',
      bodyForm: [],
    });
    const cmd = await buildCurlCommand(scenario, { type: 'none' });
    expect(cmd).not.toContain('--data-urlencode');
  });

  it('json body: adds Content-Type and -d with escaped quotes', async () => {
    const scenario = minimalScenario({
      method: 'POST',
      body: `{"msg":"it's"}`,
    });
    const cmd = await buildCurlCommand(scenario, { type: 'none' });
    expect(cmd).toContain('Content-Type: application/json');
    expect(cmd).toContain("-d '{\"msg\":\"it'\\''s\"}'");
  });

  it('does not add duplicate Content-Type from serializer when header exists', async () => {
    const scenario = minimalScenario({
      method: 'POST',
      body: '{}',
      headers: [{ key: 'Content-Type', value: 'application/vnd.api+json' }],
    });
    const cmd = await buildCurlCommand(scenario, { type: 'none' });
    expect(cmd.match(/Content-Type:/g)?.length).toBe(1);
    expect(cmd).toContain('application/vnd.api+json');
  });

  it('xml bodyType adds application/xml when no Content-Type header', async () => {
    const scenario = minimalScenario({
      method: 'POST',
      bodyType: 'xml',
      body: '<r/>',
    });
    const cmd = await buildCurlCommand(scenario, { type: 'none' });
    expect(cmd).toContain('Content-Type: application/xml');
    expect(cmd).toContain("-d '<r/>'");
  });

  it('GET forces none for body-type branches but still appends -d when body string is non-empty', async () => {
    const scenario = minimalScenario({
      method: 'GET',
      body: 'still-emitted',
      bodyType: 'json',
    });
    const cmd = await buildCurlCommand(scenario, { type: 'none' });
    expect(cmd).not.toContain('Content-Type: application/json');
    expect(cmd).toContain("-d 'still-emitted'");
  });

  it('POST with no body and no implicit type does not add -d or extra Content-Type', async () => {
    const scenario = minimalScenario({
      method: 'POST',
      body: '',
    });
    const cmd = await buildCurlCommand(scenario, { type: 'none' });
    expect(cmd).not.toContain('-d ');
    expect(cmd).not.toContain('Content-Type');
  });

  it('trims header keys when emitting -H', async () => {
    const scenario = minimalScenario({
      method: 'POST',
      headers: [{ key: '  X-Custom  ', value: 'v' }],
    });
    const cmd = await buildCurlCommand(scenario, { type: 'none' });
    expect(cmd).toContain("X-Custom: v");
  });

  it('auth type inherit performs no auth side effects', async () => {
    const scenario = minimalScenario({ method: 'GET' });
    const cmd = await buildCurlCommand(scenario, { type: 'inherit' });
    expect(cmd).toBe("curl 'https://api.example.com/v1/resource'");
    expect(mockAcquireOAuth2).not.toHaveBeenCalled();
  });
});
