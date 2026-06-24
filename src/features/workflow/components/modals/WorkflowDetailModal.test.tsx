/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import WorkflowDetailModal from './WorkflowDetailModal';

vi.mock('../panels/WorkflowResponseBody', () => ({
  default: ({ body, subtitle }: { body: string; subtitle?: string }) => (
    <div data-testid="response-body">body:{body};sub:{subtitle ?? ''}</div>
  ),
}));

vi.mock('./WorkflowEditorModalFrame', () => ({
  default: ({ open, title, children, footer, onClose, dialogClassName, hideExpandButton, hideCloseButton }: {
    open: boolean;
    title: React.ReactNode;
    children: React.ReactNode;
    footer: React.ReactNode;
    onClose: () => void;
    dialogClassName?: string;
    hideExpandButton?: boolean;
    hideCloseButton?: boolean;
  }) =>
    open ? (
      <div data-testid="frame" data-dialog-class={dialogClassName ?? ''} data-hide-expand={String(!!hideExpandButton)} data-hide-close={String(!!hideCloseButton)}>
        <div data-testid="frame-title">{title}</div>
        <button data-testid="frame-x" onClick={onClose}>x</button>
        <div data-testid="frame-body">{children}</div>
        <div data-testid="frame-footer">{footer}</div>
      </div>
    ) : null,
}));

vi.mock('../panels/WorkflowQuickTestFailurePanel', () => ({
  default: () => <div data-testid="failure-panel">failure</div>,
}));

const baseProps = {
  open: true,
  title: 'Detail',
  onClose: vi.fn(),
};

describe('WorkflowDetailModal', () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it('renders nothing when closed', () => {
    const { container } = render(<WorkflowDetailModal {...baseProps} open={false} />);
    expect(container.querySelector('[data-testid="frame"]')).toBeNull();
  });

  it('renders response body in step-result mode', () => {
    render(<WorkflowDetailModal {...baseProps} body="hello" subtitle="sub" />);
    expect(screen.getByTestId('response-body').textContent).toContain('body:hello');
    expect(screen.getByTestId('response-body').textContent).toContain('sub:sub');
  });

  it('renders textarea in variable mode and fires onVariableChange', () => {
    const onVariableChange = vi.fn();
    render(
      <WorkflowDetailModal
        {...baseProps}
        variableMode
        variableValue="plain"
        subtitle="vsub"
        onVariableChange={onVariableChange}
      />,
    );
    expect(screen.getByText('vsub')).toBeTruthy();
    const ta = document.querySelector('.wf-detail-modal-textarea') as HTMLTextAreaElement;
    fireEvent.change(ta, { target: { value: 'changed' } });
    expect(onVariableChange).toHaveBeenCalledWith('changed');
  });

  it('shows pretty toggle only for JSON values and formats on toggle', () => {
    render(
      <WorkflowDetailModal
        {...baseProps}
        variableMode
        variableValue='{"a":1}'
      />,
    );
    const toggle = screen.getByText('Pretty Format');
    fireEvent.click(toggle);
    expect(screen.getByText('Raw')).toBeTruthy();
    expect(document.querySelector('.wf-detail-modal-pretty')).not.toBeNull();
    // toggle back to raw
    fireEvent.click(screen.getByText('Raw'));
    expect(document.querySelector('.wf-detail-modal-textarea')).not.toBeNull();
  });

  it('does not show pretty toggle for non-JSON variable value', () => {
    render(<WorkflowDetailModal {...baseProps} variableMode variableValue="notjson" />);
    expect(screen.queryByText('Pretty Format')).toBeNull();
  });

  it('does not show Copy in variable mode and uses compact chrome', () => {
    render(
      <WorkflowDetailModal
        {...baseProps}
        variableMode
        variableValue="https://api.example.com"
        subtitle="Edit the value"
        onApplyVariable={vi.fn()}
      />,
    );
    expect(screen.queryByText('Copy')).toBeNull();
    expect(screen.getByText('Apply')).toBeTruthy();
    expect(screen.getByText('Close')).toBeTruthy();
    const frame = screen.getByTestId('frame');
    expect(frame.getAttribute('data-dialog-class')).toContain('wf-detail-modal--compact');
    expect(frame.getAttribute('data-hide-expand')).toBe('true');
    expect(frame.getAttribute('data-hide-close')).toBe('true');
  });

  it('calls clipboard.writeText with body on Copy (step mode)', () => {
    render(<WorkflowDetailModal {...baseProps} body="bodytext" />);
    fireEvent.click(screen.getByText('Copy'));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('bodytext');
  });

  it('shows Apply only in variable mode and fires onApplyVariable', () => {
    const onApplyVariable = vi.fn();
    render(
      <WorkflowDetailModal
        {...baseProps}
        variableMode
        variableValue="v"
        onApplyVariable={onApplyVariable}
      />,
    );
    fireEvent.click(screen.getByText('Apply'));
    expect(onApplyVariable).toHaveBeenCalled();
  });

  it('hides Apply in step mode and Close calls onClose', () => {
    const onClose = vi.fn();
    render(<WorkflowDetailModal {...baseProps} onClose={onClose} body="b" />);
    expect(screen.queryByText('Apply')).toBeNull();
    fireEvent.click(screen.getByText('Close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('ignores clipboard write failures', async () => {
    vi.mocked(navigator.clipboard.writeText).mockRejectedValueOnce(new Error('denied'));
    render(<WorkflowDetailModal {...baseProps} body="failcopy" />);
    fireEvent.click(screen.getByText('Copy'));
    await Promise.resolve();
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('failcopy');
  });

  it('renders empty textarea when variableValue is undefined', () => {
    render(<WorkflowDetailModal {...baseProps} variableMode />);
    const ta = document.querySelector('.wf-detail-modal-textarea') as HTMLTextAreaElement;
    expect(ta.value).toBe('');
  });

  it('falls back to textarea when pretty mode has empty value after rerender', () => {
    const { rerender } = render(
      <WorkflowDetailModal {...baseProps} variableMode variableValue='{"a":1}' />,
    );
    fireEvent.click(screen.getByText('Pretty Format'));
    rerender(<WorkflowDetailModal {...baseProps} variableMode variableValue="" />);
    expect(document.querySelector('.wf-detail-modal-textarea')).not.toBeNull();
  });

  it('falls back to textarea when pretty mode has invalid json after rerender', () => {
    const { rerender } = render(
      <WorkflowDetailModal {...baseProps} variableMode variableValue='{"a":1}' />,
    );
    fireEvent.click(screen.getByText('Pretty Format'));
    rerender(<WorkflowDetailModal {...baseProps} variableMode variableValue="not-json" />);
    expect(document.querySelector('.wf-detail-modal-textarea')).not.toBeNull();
  });

  it('resets pretty toggle when modal reopens', () => {
    const { rerender } = render(
      <WorkflowDetailModal {...baseProps} variableMode variableValue='{"a":1}' />,
    );
    fireEvent.click(screen.getByText('Pretty Format'));
    rerender(<WorkflowDetailModal {...baseProps} open={false} variableMode variableValue='{"a":1}' />);
    rerender(<WorkflowDetailModal {...baseProps} open variableMode variableValue='{"a":1}' />);
    expect(screen.getByText('Pretty Format')).toBeTruthy();
  });

  it('uses compact chrome without Copy for Quick Test failure report', () => {
    render(
      <WorkflowDetailModal
        {...baseProps}
        title="Quick Test failed"
        failureReport={{
          summary: '$ less_than 1 — got 181 (expected < 1)',
          failedSteps: [{ nodeId: 'a', label: 'GraphQL Assert', state: 'fail', error: 'fail' }],
          passedSteps: [{ nodeId: 'q', label: 'GraphQL Query', state: 'pass', responseTimeMs: 181 }],
          variableSnapshot: { gqlLatency: '181' },
          durationMs: 7800,
          hints: ['Open the Console panel'],
        }}
      />,
    );
    expect(screen.getByTestId('failure-panel')).toBeTruthy();
    expect(screen.queryByText('Copy')).toBeNull();
    expect(screen.getByText('Close')).toBeTruthy();
    const frame = screen.getByTestId('frame');
    expect(frame.getAttribute('data-dialog-class')).toContain('wf-detail-modal--compact');
    expect(frame.getAttribute('data-hide-expand')).toBe('true');
    expect(frame.getAttribute('data-hide-close')).toBe('true');
  });
});
