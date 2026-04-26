/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import NodeConfigLogsTab from './NodeConfigLogsTab';
import type { NodeRunStatus } from '../../types/workflow';

const makeStatus = (overrides: Partial<NodeRunStatus> = {}): NodeRunStatus => ({
  state: 'pass',
  statusCode: 200,
  responseTimeMs: 55,
  ...overrides,
});

describe('NodeConfigLogsTab', () => {
  it('shows empty state when nodeRunStatus is null', () => {
    render(<NodeConfigLogsTab nodeRunStatus={null} />);
    expect(screen.getByText(/No logs yet/)).toBeTruthy();
  });

  it('shows empty state when nodeRunStatus is undefined', () => {
    render(<NodeConfigLogsTab />);
    expect(screen.getByText(/No logs yet/)).toBeTruthy();
  });

  it('shows empty state when state is idle', () => {
    render(<NodeConfigLogsTab nodeRunStatus={{ state: 'idle' }} />);
    expect(screen.getByText(/No logs yet/)).toBeTruthy();
  });

  it('shows empty state when state is pending', () => {
    render(<NodeConfigLogsTab nodeRunStatus={{ state: 'pending' }} />);
    expect(screen.getByText(/No logs yet/)).toBeTruthy();
  });

  it('renders HTTP status log entry for passing run', () => {
    render(<NodeConfigLogsTab nodeRunStatus={makeStatus()} />);
    expect(screen.getByText('OK')).toBeTruthy();
    expect(screen.getByText('HTTP 200 (55ms)')).toBeTruthy();
  });

  it('renders ERR level for failed run', () => {
    render(<NodeConfigLogsTab nodeRunStatus={makeStatus({ state: 'fail', statusCode: 500 })} />);
    expect(screen.getByText('ERR')).toBeTruthy();
    expect(screen.getByText(/HTTP 500/)).toBeTruthy();
  });

  it('renders INFO level for non-pass/non-fail state', () => {
    render(<NodeConfigLogsTab nodeRunStatus={makeStatus({ state: 'running' as NodeRunStatus['state'], statusCode: 200 })} />);
    expect(screen.getByText('INFO')).toBeTruthy();
  });

  it('does not show duration when responseTimeMs is undefined', () => {
    render(<NodeConfigLogsTab nodeRunStatus={makeStatus({ responseTimeMs: undefined })} />);
    expect(screen.getByText('HTTP 200')).toBeTruthy();
    expect(screen.queryByText(/\(.*ms\)/)).not.toBeTruthy();
  });

  it('renders extracted variable log entries', () => {
    render(<NodeConfigLogsTab nodeRunStatus={makeStatus({ extracted: { token: 'abc', id: '7' } })} />);
    expect(screen.getByText(/Extracted: token/)).toBeTruthy();
    expect(screen.getByText(/Extracted: id/)).toBeTruthy();
  });

  it('renders error log entry', () => {
    render(<NodeConfigLogsTab nodeRunStatus={makeStatus({ state: 'fail', error: 'Timeout exceeded' })} />);
    const errSpans = screen.getAllByText('ERR');
    expect(errSpans.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Timeout exceeded')).toBeTruthy();
  });

  it('applies correct CSS classes for log levels', () => {
    const { container } = render(<NodeConfigLogsTab nodeRunStatus={makeStatus({ state: 'pass', extracted: { x: '1' }, error: 'some err' })} />);
    expect(container.querySelector('.wf-log-level-ok')).toBeTruthy();
    expect(container.querySelector('.wf-log-level-info')).toBeTruthy();
    expect(container.querySelector('.wf-log-level-err')).toBeTruthy();
  });

  it('does not render statusCode entry when statusCode is undefined', () => {
    render(<NodeConfigLogsTab nodeRunStatus={{ state: 'fail', error: 'No response' }} />);
    expect(screen.queryByText(/HTTP/)).not.toBeTruthy();
    expect(screen.getByText('No response')).toBeTruthy();
  });
});
