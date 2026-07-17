// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import WorkflowSlaPanel from './WorkflowSlaPanel';
import type { SlaTarget } from '../../../shared/types';

// Capture the props the editor was last rendered with so tests can invoke its callbacks.
let lastEditorProps: {
  draft: SlaTarget[];
  onChange: (t: SlaTarget[]) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  scenarioNames: string[];
} | null = null;

vi.mock('../../results/components/SlaTargetEditor', () => ({
  SlaTargetEditor: (props: typeof lastEditorProps) => {
    lastEditorProps = props;
    return (
      <div data-testid="sla-editor">
        <span data-testid="editor-draft-count">{props!.draft.length}</span>
        <span data-testid="editor-saving">{String(props!.saving)}</span>
        <button onClick={props!.onSave}>editor-save</button>
        <button onClick={props!.onCancel}>editor-cancel</button>
        <button onClick={() => props!.onChange([...props!.draft, makeTarget('extra')])}>editor-add</button>
      </div>
    );
  },
}));

function makeTarget(id: string): SlaTarget {
  return { id, metric: 'p95', operator: 'lte', value: 500 };
}

describe('WorkflowSlaPanel', () => {
  beforeEach(() => {
    lastEditorProps = null;
  });

  it('renders collapsed with no badge and the "define" hint when there are no targets', () => {
    render(<WorkflowSlaPanel initialTargets={[]} onSave={vi.fn()} />);
    expect(screen.getByText('SLA Targets')).toBeInTheDocument();
    expect(screen.getByText('Define SLA targets for this workflow')).toBeInTheDocument();
    expect(screen.queryByTestId('sla-editor')).not.toBeInTheDocument();
    // chevron points down when collapsed
    expect(screen.getByText('▼')).toBeInTheDocument();
  });

  it('shows a count badge and singular hint for a single target', () => {
    render(<WorkflowSlaPanel initialTargets={[makeTarget('a')]} onSave={vi.fn()} />);
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('1 target defined — embedded at run time')).toBeInTheDocument();
  });

  it('shows the plural hint for multiple targets', () => {
    render(<WorkflowSlaPanel initialTargets={[makeTarget('a'), makeTarget('b')]} onSave={vi.fn()} />);
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('2 targets defined — embedded at run time')).toBeInTheDocument();
  });

  it('expands and collapses when the header is clicked', () => {
    render(<WorkflowSlaPanel initialTargets={[]} onSave={vi.fn()} />);
    const header = screen.getByRole('button', { name: /SLA Targets/ });
    expect(header).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(header);
    expect(header).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('sla-editor')).toBeInTheDocument();
    expect(screen.getByText('▲')).toBeInTheDocument();

    fireEvent.click(header);
    expect(header).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('sla-editor')).not.toBeInTheDocument();
  });

  it('does not toggle and applies the disabled class/attribute when disabled', () => {
    const { container } = render(<WorkflowSlaPanel initialTargets={[]} onSave={vi.fn()} disabled />);
    const header = screen.getByRole('button', { name: /SLA Targets/ });
    expect(header).toBeDisabled();
    expect(container.querySelector('.workflow-sla-panel--disabled')).toBeInTheDocument();

    fireEvent.click(header);
    // remains collapsed
    expect(header).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('sla-editor')).not.toBeInTheDocument();
  });

  it('toggles the saving flag while onSave resolves', async () => {
    let resolveSave: () => void = () => {};
    const onSave = vi.fn(() => new Promise<void>((res) => { resolveSave = res; }));
    render(<WorkflowSlaPanel initialTargets={[makeTarget('a')]} onSave={onSave} />);

    fireEvent.click(screen.getByRole('button', { name: /SLA Targets/ }));
    fireEvent.click(screen.getByText('editor-save'));

    // saving becomes true while the promise is pending
    await waitFor(() => expect(screen.getByTestId('editor-saving')).toHaveTextContent('true'));
    expect(onSave).toHaveBeenCalledWith([makeTarget('a')]);

    resolveSave();
    await waitFor(() => expect(screen.getByTestId('editor-saving')).toHaveTextContent('false'));
  });

  it('resets saving to false even when onSave rejects', async () => {
    const onSave = vi.fn(() => Promise.reject(new Error('boom')));
    render(<WorkflowSlaPanel initialTargets={[makeTarget('a')]} onSave={onSave} />);
    fireEvent.click(screen.getByRole('button', { name: /SLA Targets/ }));

    await act(async () => {
      await expect(lastEditorProps!.onSave()).rejects.toThrow('boom');
    });
    await waitFor(() => expect(screen.getByTestId('editor-saving')).toHaveTextContent('false'));
  });

  it('updates the draft through onChange', () => {
    render(<WorkflowSlaPanel initialTargets={[makeTarget('a')]} onSave={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /SLA Targets/ }));
    expect(screen.getByTestId('editor-draft-count')).toHaveTextContent('1');

    fireEvent.click(screen.getByText('editor-add'));
    expect(screen.getByTestId('editor-draft-count')).toHaveTextContent('2');
  });

  it('cancel resets the draft to initial targets and collapses the panel', () => {
    render(<WorkflowSlaPanel initialTargets={[makeTarget('a')]} onSave={vi.fn()} />);
    const header = screen.getByRole('button', { name: /SLA Targets/ });
    fireEvent.click(header);

    // mutate the draft
    fireEvent.click(screen.getByText('editor-add'));
    expect(screen.getByTestId('editor-draft-count')).toHaveTextContent('2');

    fireEvent.click(screen.getByText('editor-cancel'));
    // collapses
    expect(header).toHaveAttribute('aria-expanded', 'false');

    // re-expand: draft should have been reset to the single initial target
    fireEvent.click(header);
    expect(screen.getByTestId('editor-draft-count')).toHaveTextContent('1');
  });

  it('re-syncs the draft when initialTargets reference changes', () => {
    const first = [makeTarget('a')];
    const { rerender } = render(<WorkflowSlaPanel initialTargets={first} onSave={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /SLA Targets/ }));
    expect(screen.getByTestId('editor-draft-count')).toHaveTextContent('1');

    const next = [makeTarget('a'), makeTarget('b'), makeTarget('c')];
    rerender(<WorkflowSlaPanel initialTargets={next} onSave={vi.fn()} />);
    expect(screen.getByTestId('editor-draft-count')).toHaveTextContent('3');
  });
});
