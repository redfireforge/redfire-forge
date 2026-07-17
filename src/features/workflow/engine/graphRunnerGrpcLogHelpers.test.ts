import { describe, expect, it } from 'vitest';
import {
  describeGrpcAssertion,
  logGrpcAssertUpstream,
  logGrpcAssertionResults,
  logGrpcCallResponse,
  logGrpcRequestBody,
  logGrpcRequestMetadata,
  logGrpcSaveAs,
  resolveGrpcRequestMetadataForLog,
} from './graphRunnerGrpcLogHelpers';

function collectLines(fn: (emit: (line: { prefix: string; text: string }) => void) => void) {
  const lines: Array<{ prefix: string; text: string }> = [];
  fn((line) => lines.push(line));
  return lines;
}

describe('graphRunnerGrpcLogHelpers', () => {
  it('logGrpcRequestBody skips empty bodies', () => {
    const lines = collectLines((log) => {
      logGrpcRequestBody('Echo', log, {});
      logGrpcRequestBody('Echo', log, { message: 'workflow-test' });
    });
    expect(lines).toHaveLength(1);
    expect(lines[0]?.text).toContain('workflow-test');
  });

  it('logGrpcRequestMetadata logs merged metadata with redacted authorization', () => {
    const lines = collectLines((log) => {
      logGrpcRequestMetadata(
        'Echo',
        log,
        { 'x-demo-run-id': 'workflow-demo' },
        { type: 'bearer', bearerToken: 'demo-workflow-token' },
      );
    });
    expect(lines.some((l) => l.text.includes('x-demo-run-id: workflow-demo'))).toBe(true);
    expect(lines.some((l) => l.text.includes('authorization:'))).toBe(true);
    expect(lines.some((l) => l.text.includes('demo-workflow-token'))).toBe(false);
  });

  it('resolveGrpcRequestMetadataForLog merges auth into outbound metadata', () => {
    const merged = resolveGrpcRequestMetadataForLog(
      { 'x-demo-run-id': 'workflow-demo' },
      { type: 'bearer', bearerToken: 'secret' },
    );
    expect(merged['x-demo-run-id']).toBe('workflow-demo');
    expect(merged.authorization).toMatch(/^Bearer secret$/);
  });

  it('logGrpcCallResponse emits status and response body', () => {
    const lines = collectLines((log) => {
      logGrpcCallResponse('Echo', log, {
        nodeId: 'n1',
        callType: 'unary',
        status: 'success',
        grpcStatus: 0,
        grpcStatusMessage: 'OK',
        durationMs: 42,
        body: { message: 'workflow-test' },
      });
    });
    expect(lines[0]?.text).toContain('gRPC 0 OK');
    expect(lines[1]?.text).toContain('workflow-test');
  });

  it('logGrpcSaveAs logs alias namespace', () => {
    const lines = collectLines((log) => logGrpcSaveAs('Echo', log, 'echoReply'));
    expect(lines[0]?.prefix).toBe('#');
    expect(lines[0]?.text).toContain('steps.echoReply');
  });

  it('describeGrpcAssertion formats common assertion kinds', () => {
    expect(describeGrpcAssertion({ grpcStatus: 0 })).toBe('grpcStatus = 0');
    expect(describeGrpcAssertion({ grpcField: 'message', equals: 'ok' })).toContain('message');
  });

  it('logGrpcAssertUpstream includes upstream status and body', () => {
    const lines = collectLines((log) => {
      logGrpcAssertUpstream('Assert', log, {
        nodeId: 'u1',
        callType: 'unary',
        status: 'success',
        grpcStatus: 0,
        body: { message: 'hello' },
      });
    });
    expect(lines[0]?.text).toContain('Upstream: unary gRPC 0 OK');
    expect(lines[1]?.text).toContain('hello');
  });

  it('logGrpcAssertionResults logs per-assertion pass and fail lines', () => {
    const passLines = collectLines((log) => {
      logGrpcAssertionResults(
        'Assert',
        log,
        [{ grpcStatus: 0 }, { grpcField: 'message', equals: 'ok' }],
        true,
        [],
      );
    });
    expect(passLines).toHaveLength(2);
    expect(passLines.every((l) => l.prefix === '✓')).toBe(true);

    const failLines = collectLines((log) => {
      logGrpcAssertionResults(
        'Assert',
        log,
        [{ grpcField: 'message', equals: 'ok' }],
        false,
        ['assertions[0]: message equals expected "ok", got "bad"'],
      );
    });
    expect(failLines[0]?.prefix).toBe('!');
    expect(failLines[0]?.text).toContain('got "bad"');

    const unmatchedFailLines = collectLines((log) => {
      logGrpcAssertionResults(
        'Assert',
        log,
        [{ grpcStatus: 0 }, { grpcField: 'message', equals: 'ok' }],
        false,
        ['assertions[1]: later assertion failed'],
      );
    });
    expect(unmatchedFailLines[0]?.prefix).toBe('✓');
    expect(unmatchedFailLines[1]?.prefix).toBe('!');
  });
});
