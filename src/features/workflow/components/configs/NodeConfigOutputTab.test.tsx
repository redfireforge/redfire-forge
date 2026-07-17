/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import NodeConfigOutputTab from './NodeConfigOutputTab';
import type { NodeRunStatus } from '../../types/workflow';

const makeStatus = (overrides: Partial<NodeRunStatus> = {}): NodeRunStatus => ({
  state: 'pass',
  statusCode: 200,
  responseTimeMs: 42,
  ...overrides,
});

describe('NodeConfigOutputTab', () => {
  it('shows empty state when nodeRunStatus is null', () => {
    render(<NodeConfigOutputTab nodeRunStatus={null} />);
    expect(screen.getByText(/No execution data yet/)).toBeTruthy();
  });

  it('shows empty state when nodeRunStatus is undefined', () => {
    render(<NodeConfigOutputTab />);
    expect(screen.getByText(/No execution data yet/)).toBeTruthy();
  });

  it('shows empty state when state is idle', () => {
    render(<NodeConfigOutputTab nodeRunStatus={{ state: 'idle' }} />);
    expect(screen.getByText(/No execution data yet/)).toBeTruthy();
  });

  it('shows empty state when state is pending', () => {
    render(<NodeConfigOutputTab nodeRunStatus={{ state: 'pending' }} />);
    expect(screen.getByText(/No execution data yet/)).toBeTruthy();
  });

  it('renders status code and duration for a passing run', () => {
    render(<NodeConfigOutputTab nodeRunStatus={makeStatus()} />);
    expect(screen.getAllByText('200').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('42ms')).toBeTruthy();
    expect(screen.getByText('Last Quick Test')).toBeTruthy();
  });

  it('renders pass status badge with correct class', () => {
    const { container } = render(<NodeConfigOutputTab nodeRunStatus={makeStatus()} />);
    const badge = container.querySelector('.wf-output-status-pass');
    expect(badge).toBeTruthy();
  });

  it('renders fail status badge with correct class', () => {
    const { container } = render(<NodeConfigOutputTab nodeRunStatus={makeStatus({ state: 'fail', statusCode: 500 })} />);
    const badge = container.querySelector('.wf-output-status-fail');
    expect(badge).toBeTruthy();
  });

  it('shows status code as meta-err when >= 400', () => {
    const { container } = render(<NodeConfigOutputTab nodeRunStatus={makeStatus({ state: 'fail', statusCode: 500 })} />);
    expect(container.querySelector('.wf-output-meta-err')).toBeTruthy();
  });

  it('shows status code as meta-ok when < 400', () => {
    const { container } = render(<NodeConfigOutputTab nodeRunStatus={makeStatus({ statusCode: 201 })} />);
    expect(container.querySelector('.wf-output-meta-ok')).toBeTruthy();
  });

  it('renders extracted variables table', () => {
    render(<NodeConfigOutputTab nodeRunStatus={makeStatus({ extracted: { token: 'abc123', userId: '42' } })} />);
    expect(screen.getByText('Extracted Variables')).toBeTruthy();
    expect(screen.getByText('token')).toBeTruthy();
    expect(screen.getByText('abc123')).toBeTruthy();
    expect(screen.getByText('userId')).toBeTruthy();
    expect(screen.getByText('42')).toBeTruthy();
  });

  it('does not render extracted section when extracted is empty', () => {
    render(<NodeConfigOutputTab nodeRunStatus={makeStatus({ extracted: {} })} />);
    expect(screen.queryByText('Extracted Variables')).not.toBeTruthy();
  });

  it('renders response detail', () => {
    render(<NodeConfigOutputTab nodeRunStatus={makeStatus({ responseDetail: '{"ok":true}' })} />);
    expect(screen.getByText('Response')).toBeTruthy();
    expect(screen.getByText('{"ok":true}')).toBeTruthy();
  });

  it('renders error section', () => {
    render(<NodeConfigOutputTab nodeRunStatus={makeStatus({ state: 'fail', error: 'Connection refused' })} />);
    expect(screen.getByText('Error')).toBeTruthy();
    expect(screen.getByText('Connection refused')).toBeTruthy();
  });

  it('does not show duration when responseTimeMs is undefined', () => {
    render(<NodeConfigOutputTab nodeRunStatus={makeStatus({ responseTimeMs: undefined })} />);
    expect(screen.queryByText(/ms$/)).not.toBeTruthy();
  });

  it('falls back to state text when no statusCode', () => {
    render(<NodeConfigOutputTab nodeRunStatus={{ state: 'pass' }} />);
    expect(screen.getAllByText(/Passed/).length).toBeGreaterThanOrEqual(1);
  });

  it('shows Result meta card for non-HTTP nodes without statusCode or responseTimeMs', () => {
    const { container } = render(<NodeConfigOutputTab nodeRunStatus={{ state: 'fail', error: 'timeout' }} />);
    expect(container.querySelector('.wf-output-meta-label')?.textContent).toBe('Result');
    expect(screen.getAllByText(/Failed/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('timeout')).toBeTruthy();
  });

  it('shows skipped state label', () => {
    render(<NodeConfigOutputTab nodeRunStatus={{ state: 'skipped' }} />);
    expect(screen.getAllByText(/Skipped/).length).toBeGreaterThanOrEqual(1);
  });
});

// ─── gRPC nodes (Phase 6G) ────────────────────────────────────────────────────

describe('NodeConfigOutputTab — gRPC nodes', () => {
  const grpcUnaryStatus = (): NodeRunStatus => ({
    state: 'pass',
    responseTimeMs: 45,
    grpcMeta: {
      service: 'echo.EchoService',
      method: 'Echo',
      target: 'localhost:50051',
      callType: 'unary',
      grpcStatus: 0,
      grpcStatusMessage: 'OK',
      bodyPreview: '{"reply":"hello"}',
    },
  });

  it('shows "Unary Details" section header for a grpcUnary node', () => {
    render(<NodeConfigOutputTab nodeRunStatus={grpcUnaryStatus()} />);
    expect(screen.getByText(/Unary Details/i)).toBeTruthy();
  });

  it('hides HTTP statusCode row for gRPC nodes', () => {
    const status: NodeRunStatus = { ...grpcUnaryStatus(), statusCode: 200 };
    render(<NodeConfigOutputTab nodeRunStatus={status} />);
    // statusCode = 200 present but should NOT render Status row for gRPC
    expect(screen.queryByText('Status')).not.toBeTruthy();
  });

  it('shows gRPC status code and label for unary node', () => {
    render(<NodeConfigOutputTab nodeRunStatus={grpcUnaryStatus()} />);
    expect(screen.getByText(/0 OK/)).toBeTruthy();
  });

  it('shows gRPC status as error color when non-zero', () => {
    const status: NodeRunStatus = {
      state: 'fail',
      grpcMeta: {
        service: 'svc.Svc',
        method: 'Call',
        target: 'host:1234',
        callType: 'unary',
        grpcStatus: 14,
      },
    };
    const { container } = render(<NodeConfigOutputTab nodeRunStatus={status} />);
    expect(container.querySelector('.wf-output-meta-err')).toBeTruthy();
  });

  it('shows method and target for unary node', () => {
    render(<NodeConfigOutputTab nodeRunStatus={grpcUnaryStatus()} />);
    expect(screen.getByText('echo.EchoService/Echo')).toBeTruthy();
    expect(screen.getByText('localhost:50051')).toBeTruthy();
  });

  it('shows response body preview for unary node', () => {
    render(<NodeConfigOutputTab nodeRunStatus={grpcUnaryStatus()} />);
    expect(screen.getByText('Response')).toBeTruthy();
    expect(screen.getByText('{"reply":"hello"}')).toBeTruthy();
  });

  it('shows "Server Stream Details" section header for server_streaming', () => {
    const status: NodeRunStatus = {
      state: 'pass',
      responseTimeMs: 120,
      grpcMeta: {
        service: 'events.Svc',
        method: 'Watch',
        target: 'host:9090',
        callType: 'server_streaming',
        grpcStatus: 0,
        messageCount: 5,
        streamStopReason: 'stream_end',
      },
    };
    render(<NodeConfigOutputTab nodeRunStatus={status} />);
    expect(screen.getByText(/Server Stream Details/i)).toBeTruthy();
    expect(screen.getByText('5')).toBeTruthy();
    expect(screen.getByText('stream_end')).toBeTruthy();
  });

  it('shows "Assert Details" section header for assert node', () => {
    const status: NodeRunStatus = {
      state: 'pass',
      responseTimeMs: 2,
      grpcMeta: {
        service: '',
        method: 'ASSERT',
        target: 'echoCall',
        callType: 'assert',
        assertionFailures: [],
      },
    };
    render(<NodeConfigOutputTab nodeRunStatus={status} />);
    expect(screen.getByText(/Assert Details/i)).toBeTruthy();
  });

  it('shows "All assertions passed" for assert pass (assertionFailures=[])', () => {
    const status: NodeRunStatus = {
      state: 'pass',
      responseTimeMs: 2,
      grpcMeta: {
        service: '',
        method: 'ASSERT',
        target: 'echoCall',
        callType: 'assert',
        assertionFailures: [],
      },
    };
    render(<NodeConfigOutputTab nodeRunStatus={status} />);
    expect(screen.getByText(/All assertions passed/i)).toBeTruthy();
  });

  it('shows assertion failures list for assert fail (assertionFailures non-empty)', () => {
    const status: NodeRunStatus = {
      state: 'fail',
      responseTimeMs: 1,
      grpcMeta: {
        service: '',
        method: 'ASSERT',
        target: 'echoCall',
        callType: 'assert',
        assertionFailures: ['$.msg expected "ok" got "fail"', '$.code expected 0 got 3'],
      },
    };
    render(<NodeConfigOutputTab nodeRunStatus={status} />);
    expect(screen.getByText('Assertion Failures')).toBeTruthy();
    expect(screen.getByText('$.msg expected "ok" got "fail"')).toBeTruthy();
    expect(screen.getByText('$.code expected 0 got 3')).toBeTruthy();
  });

  it('shows nothing about assertions when assertionFailures is undefined (not yet evaluated)', () => {
    const status: NodeRunStatus = {
      state: 'pass',
      grpcMeta: {
        service: '',
        method: 'ASSERT',
        target: 'echoCall',
        callType: 'assert',
        // assertionFailures intentionally omitted
      },
    };
    render(<NodeConfigOutputTab nodeRunStatus={status} />);
    expect(screen.queryByText(/All assertions passed/i)).not.toBeTruthy();
    expect(screen.queryByText('Assertion Failures')).not.toBeTruthy();
  });

  it('hides responseDetail section for gRPC nodes', () => {
    const status: NodeRunStatus = {
      ...grpcUnaryStatus(),
      responseDetail: 'UNARY echo.EchoService/Echo → localhost:50051\ngRPC 0 OK',
    };
    render(<NodeConfigOutputTab nodeRunStatus={status} />);
    // responseDetail is suppressed when grpcMeta is set; GrpcMetaSection used instead
    expect(screen.queryByText('Response')).toBeTruthy(); // bodyPreview section "Response" exists
    // but the raw responseDetail text should NOT render as a <pre> block
    expect(screen.queryByText(/UNARY echo\.EchoService/)).not.toBeTruthy();
  });

  it('shows attempts row when attempts > 1', () => {
    const status: NodeRunStatus = {
      state: 'pass',
      grpcMeta: {
        service: 'svc.Svc',
        method: 'Call',
        target: 'host:1',
        callType: 'unary',
        grpcStatus: 0,
        attempts: 3,
      },
    };
    render(<NodeConfigOutputTab nodeRunStatus={status} />);
    expect(screen.getByText('3')).toBeTruthy();
  });
});
