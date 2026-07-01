/**
 * Phase 9H/9I — Studio deep execute + stream send interpolation tests.
 */
import { describe, expect, it } from 'vitest';
import { createGrpcInterpolationEnvSnapshotFromMap } from './grpcInterpolationEnvSnapshot';
import {
  resolveGrpcStudioStreamMessageBodyForSend,
  resolveGrpcStudioTabFieldsForExecute,
} from './grpcStudioExecuteInterpolation';

describe('grpcStudioExecuteInterpolation (Phase 9H)', () => {
  const env = {
    greeting: 'hello',
    envName: 'dev',
    token: 'abc123',
  };

  it('deep-resolves body, metadata, and auth at execute time', () => {
    const resolved = resolveGrpcStudioTabFieldsForExecute(
      {
        body: { message: '{{greeting}}', nested: { tag: '{{envName}}' } },
        metadata: { 'x-env': '{{envName}}' },
        auth: { type: 'bearer', bearerToken: '{{token}}' },
      },
      env,
    );
    expect(resolved.body).toEqual({ message: 'hello', nested: { tag: 'dev' } });
    expect(resolved.metadata).toEqual({ 'x-env': 'dev' });
    expect(resolved.auth?.bearerToken).toBe('abc123');
  });

  it('preserves escaped literals in body strings', () => {
    const escaped = String.raw`\{{greeting}}`;
    const resolved = resolveGrpcStudioTabFieldsForExecute(
      { body: { message: escaped }, metadata: {}, auth: { type: 'none' } },
      env,
    );
    expect(resolved.body).toEqual({ message: escaped });
  });

  it('rejects unresolved tokens in body leaves', () => {
    expect(() => resolveGrpcStudioTabFieldsForExecute(
      { body: { message: '{{missing}}' }, metadata: {}, auth: { type: 'none' } },
      env,
    )).toThrow(/unresolved template variables/i);
  });

  it('resolves templated metadata keys after interpolation (harness parity)', () => {
    const resolved = resolveGrpcStudioTabFieldsForExecute(
      {
        body: {},
        metadata: { '{{headerName}}': '{{envName}}' },
        auth: { type: 'none' },
      },
      { headerName: 'x-tenant', envName: 'dev' },
    );
    expect(resolved.metadata).toEqual({ 'x-tenant': 'dev' });
  });

  it('rejects empty bearer token after env resolves to blank', () => {
    expect(() => resolveGrpcStudioTabFieldsForExecute(
      {
        body: {},
        metadata: {},
        auth: { type: 'bearer', bearerToken: '{{token}}' },
      },
      { token: '   ' },
    )).toThrow(/Bearer token is required/i);
  });
});

describe('resolveGrpcStudioStreamMessageBodyForSend (Phase 9I)', () => {
  it('deep-resolves stream message body using frozen interpolation env', () => {
    const env = createGrpcInterpolationEnvSnapshotFromMap({ greeting: 'hello', envName: 'dev' });
    const resolved = resolveGrpcStudioStreamMessageBodyForSend(
      { message: '{{greeting}}', nested: { tag: '{{envName}}' } },
      env,
    );
    expect(resolved).toEqual({ message: 'hello', nested: { tag: 'dev' } });
  });

  it('rejects send when interpolation env snapshot is missing', () => {
    expect(() => resolveGrpcStudioStreamMessageBodyForSend({ message: 'x' }, undefined))
      .toThrow(/active execute snapshot/i);
  });

  it('rejects unresolved tokens in stream message body', () => {
    const env = createGrpcInterpolationEnvSnapshotFromMap({});
    expect(() => resolveGrpcStudioStreamMessageBodyForSend(
      { message: '{{missing}}' },
      env,
    )).toThrow(/unresolved template variables/i);
  });
});
