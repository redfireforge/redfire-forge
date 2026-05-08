/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { NodeStatusBadge } from './NodeStatusBadge';
import type { NodeRunStatus } from '../../types/workflow';

describe('NodeStatusBadge', () => {
  it('renders nothing when rs is undefined', () => {
    const { container } = render(<NodeStatusBadge rs={undefined} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing for idle state', () => {
    const rs: NodeRunStatus = { state: 'idle' };
    const { container } = render(<NodeStatusBadge rs={rs} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders running badge with spinner', () => {
    const rs: NodeRunStatus = { state: 'running' };
    const { container } = render(<NodeStatusBadge rs={rs} />);
    const badge = container.querySelector('.wf-status-running');
    expect(badge).toBeTruthy();
    expect(badge?.textContent).toContain('Running');
    expect(container.querySelector('.wf-spinner')).toBeTruthy();
  });

  it('renders pass badge with checkmark', () => {
    const rs: NodeRunStatus = { state: 'pass' };
    const { container } = render(<NodeStatusBadge rs={rs} />);
    const badge = container.querySelector('.wf-status-pass');
    expect(badge).toBeTruthy();
    expect(badge?.textContent).toContain('✓');
    expect(badge?.textContent).toContain('Pass');
  });

  it('renders pass badge with response time when available', () => {
    const rs: NodeRunStatus = { state: 'pass', responseTimeMs: 123 };
    const { container } = render(<NodeStatusBadge rs={rs} />);
    const badge = container.querySelector('.wf-status-pass');
    expect(badge?.textContent).toContain('123ms');
  });

  it('renders pass badge without time when responseTimeMs is undefined', () => {
    const rs: NodeRunStatus = { state: 'pass' };
    const { container } = render(<NodeStatusBadge rs={rs} />);
    const badge = container.querySelector('.wf-status-pass');
    expect(badge?.textContent).not.toContain('ms');
  });

  it('renders fail badge with error snippet', () => {
    const rs: NodeRunStatus = { state: 'fail', error: 'Connection refused by remote host' };
    const { container } = render(<NodeStatusBadge rs={rs} />);
    const badge = container.querySelector('.wf-status-fail');
    expect(badge).toBeTruthy();
    expect(badge?.textContent).toContain('✗');
    expect(badge?.textContent).toContain('Fail');
    expect(badge?.textContent).toContain('Connection refused by remote');
  });

  it('renders fail badge without error when error is undefined', () => {
    const rs: NodeRunStatus = { state: 'fail' };
    const { container } = render(<NodeStatusBadge rs={rs} />);
    const badge = container.querySelector('.wf-status-fail');
    expect(badge?.textContent).toContain('Fail');
    expect(badge?.textContent).not.toContain('·');
  });

  it('renders nothing for paused state (handled by NodePausedOverlay)', () => {
    const rs: NodeRunStatus = { state: 'paused' };
    const { container } = render(<NodeStatusBadge rs={rs} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing for skipped state', () => {
    const rs: NodeRunStatus = { state: 'skipped' };
    const { container } = render(<NodeStatusBadge rs={rs} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing for pending state', () => {
    const rs: NodeRunStatus = { state: 'pending' };
    const { container } = render(<NodeStatusBadge rs={rs} />);
    expect(container.innerHTML).toBe('');
  });

  it('truncates long error messages to 30 characters', () => {
    const rs: NodeRunStatus = { state: 'fail', error: 'This is a very long error message that exceeds the limit' };
    const { container } = render(<NodeStatusBadge rs={rs} />);
    const badge = container.querySelector('.wf-status-fail');
    expect(badge?.textContent).toContain('This is a very long error mess');
    expect(badge?.textContent).not.toContain('exceeds');
  });
});
