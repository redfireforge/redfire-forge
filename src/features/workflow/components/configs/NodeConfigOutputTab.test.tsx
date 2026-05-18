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
