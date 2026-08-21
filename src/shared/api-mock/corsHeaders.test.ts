import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from './defaults';
import {
  corsPreflightHeaders,
  corsResponseHeaders,
  isCorsPreflight,
  requestOriginHeader,
} from './corsHeaders';

const corsOn = {
  ...DEFAULT_SETTINGS.cors,
  enabled: true,
};

describe('corsHeaders', () => {
  it('is a no-op when CORS is disabled', () => {
    expect(corsResponseHeaders(DEFAULT_SETTINGS.cors, 'https://app.test')).toEqual({});
    expect(isCorsPreflight('OPTIONS', DEFAULT_SETTINGS.cors)).toBe(false);
  });

  it('treats OPTIONS as preflight only when enabled', () => {
    expect(isCorsPreflight('OPTIONS', corsOn)).toBe(true);
    expect(isCorsPreflight('GET', corsOn)).toBe(false);
    expect(isCorsPreflight('options', corsOn)).toBe(true);
  });

  it('allows any origin when the allowlist is empty or contains *', () => {
    const wildcard = corsResponseHeaders(corsOn, 'https://app.test');
    expect(wildcard['Access-Control-Allow-Origin']).toBe('*');
    const empty = corsResponseHeaders({ ...corsOn, allowOrigins: [] }, 'https://app.test');
    expect(empty['Access-Control-Allow-Origin']).toBe('*');
  });

  it('echoes a matching origin when the allowlist is specific', () => {
    const headers = corsResponseHeaders(
      { ...corsOn, allowOrigins: ['https://app.test'] },
      'https://app.test',
    );
    expect(headers['Access-Control-Allow-Origin']).toBe('https://app.test');
  });

  it('omits Allow-Origin when the request origin is not allowlisted', () => {
    const headers = corsResponseHeaders(
      { ...corsOn, allowOrigins: ['https://app.test'] },
      'https://other.test',
    );
    expect(headers['Access-Control-Allow-Origin']).toBeUndefined();
    expect(headers['Access-Control-Allow-Methods']).toContain('GET');
  });

  it('echoes origin and sets credentials when allowCredentials is on', () => {
    const headers = corsResponseHeaders(
      { ...corsOn, allowCredentials: true },
      'https://app.test',
    );
    expect(headers['Access-Control-Allow-Origin']).toBe('https://app.test');
    expect(headers['Access-Control-Allow-Credentials']).toBe('true');
    expect(headers.Vary).toBe('Origin');
  });

  it('does not pair credentials with a wildcard origin', () => {
    const headers = corsResponseHeaders({ ...corsOn, allowCredentials: true }, undefined);
    expect(headers['Access-Control-Allow-Origin']).toBeUndefined();
    expect(headers['Access-Control-Allow-Credentials']).toBeUndefined();
  });

  it('adds Max-Age on preflight and expose headers when configured', () => {
    const headers = corsPreflightHeaders(
      { ...corsOn, maxAge: 120, exposeHeaders: ['X-Request-Id'] },
      'https://app.test',
    );
    expect(headers['Access-Control-Max-Age']).toBe('120');
    expect(headers['Access-Control-Expose-Headers']).toBe('X-Request-Id');
  });

  it('reads Origin from Node-style header maps', () => {
    expect(requestOriginHeader({ origin: 'https://a.test' })).toBe('https://a.test');
    expect(requestOriginHeader({ Origin: ['https://b.test'] })).toBe('https://b.test');
    expect(requestOriginHeader({})).toBeUndefined();
  });

  it('uses default methods and headers when the lists are empty', () => {
    const headers = corsResponseHeaders(
      { ...corsOn, allowMethods: [], allowHeaders: [] },
      'https://app.test',
    );
    expect(headers['Access-Control-Allow-Methods']).toBe('GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS');
    expect(headers['Access-Control-Allow-Headers']).toBe('Content-Type,Authorization,Accept');
  });

  it('treats missing allowOrigins and maxAge as defaults', () => {
    const cors = { ...corsOn } as { allowOrigins?: string[]; maxAge?: number } & typeof corsOn;
    delete cors.allowOrigins;
    delete cors.maxAge;
    const headers = corsPreflightHeaders(cors, 'https://app.test');
    expect(headers['Access-Control-Allow-Origin']).toBe('*');
    expect(headers['Access-Control-Max-Age']).toBe('86400');
  });
});
