/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import UnpublishConfirmDialog, { type UnpublishRequest } from './UnpublishConfirmDialog';
import type { AffectedWorkflowInfo } from '../utils/workflowExposureScanner';

function makeAffected(over: Partial<AffectedWorkflowInfo> = {}): AffectedWorkflowInfo {
  return {
    workflowId: 'wf-1',
    workflowName: 'Checkout Flow',
    nodeIds: ['node-1'],
    nodeLabels: ['Fetch User'],
    ...over,
  };
}

function makeRequest(over: Partial<UnpublishRequest> = {}): UnpublishRequest {
  return {
    endpointLabel: 'Get User',
    method: 'get',
    path: '/users/{id}',
    entryId: 'entry-1',
    endpointId: 'ep-1',
    affected: [makeAffected()],
    ...over,
  };
}

function renderDialog(
  requestOver: Partial<UnpublishRequest> = {},
  handlers: {
    onPaletteOnly?: () => void;
    onPaletteAndWorkflows?: () => void;
    onCancel?: () => void;
  } = {},
) {
  const onPaletteOnly = handlers.onPaletteOnly ?? vi.fn();
  const onPaletteAndWorkflows = handlers.onPaletteAndWorkflows ?? vi.fn();
  const onCancel = handlers.onCancel ?? vi.fn();
  const request = makeRequest(requestOver);

  const view = render(
    <UnpublishConfirmDialog
      request={request}
      onPaletteOnly={onPaletteOnly}
      onPaletteAndWorkflows={onPaletteAndWorkflows}
      onCancel={onCancel}
    />,
  );

  return { onPaletteOnly, onPaletteAndWorkflows, onCancel, request, ...view };
}

describe('UnpublishConfirmDialog', () => {
  it('renders the dialog with correct title', () => {
    renderDialog();
    expect(screen.getByText('Un-publish Endpoint')).toBeInTheDocument();
  });

  it('shows method uppercased and path in the summary', () => {
    renderDialog({ method: 'post', path: '/orders' });
    expect(screen.getByText('POST /orders')).toBeInTheDocument();
  });

  it('uses singular workflow and node labels when counts are 1', () => {
    renderDialog({
      affected: [makeAffected({ nodeIds: ['n1'] })],
    });
    const summary = screen.getByText(/is used in/i).closest('p');
    expect(summary).toHaveTextContent('1 workflow (1 node total).');
    expect(summary).not.toHaveTextContent('workflows');
    expect(summary).not.toHaveTextContent('nodes total');
    expect(screen.getByText('1 node')).toBeInTheDocument();
  });

  it('uses plural workflow and node labels when counts are greater than 1', () => {
    renderDialog({
      affected: [
        makeAffected({ workflowId: 'wf-1', workflowName: 'Flow A', nodeIds: ['n1', 'n2'] }),
        makeAffected({ workflowId: 'wf-2', workflowName: 'Flow B', nodeIds: ['n3'] }),
      ],
    });
    const summary = screen.getByText(/is used in/i).closest('p');
    expect(summary).toHaveTextContent('2 workflows (3 nodes total).');
    expect(screen.getByText('2 nodes')).toBeInTheDocument();
    expect(screen.getByText('1 node')).toBeInTheDocument();
  });

  it('lists all affected workflows with names and node counts', () => {
    renderDialog({
      affected: [
        makeAffected({ workflowId: 'wf-a', workflowName: 'Alpha', nodeIds: ['a1', 'a2'] }),
        makeAffected({ workflowId: 'wf-b', workflowName: 'Beta', nodeIds: ['b1'] }),
      ],
    });

    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
    expect(screen.getByText('2 nodes')).toBeInTheDocument();
    expect(screen.getByText('1 node')).toBeInTheDocument();
  });

  it('calls onCancel when Cancel is clicked', () => {
    const { onCancel } = renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onPaletteOnly when Remove from Palette Only is clicked', () => {
    const { onPaletteOnly } = renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Remove from Palette Only' }));
    expect(onPaletteOnly).toHaveBeenCalledTimes(1);
  });

  it('calls onPaletteAndWorkflows when Remove from Palette & Workflows is clicked', () => {
    const { onPaletteAndWorkflows } = renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Remove from Palette & Workflows' }));
    expect(onPaletteAndWorkflows).toHaveBeenCalledTimes(1);
  });

  it('shows Removing… and disables the destructive button after click', () => {
    renderDialog();
    const removeBtn = screen.getByRole('button', { name: 'Remove from Palette & Workflows' });
    expect(removeBtn).not.toBeDisabled();

    fireEvent.click(removeBtn);

    expect(screen.getByRole('button', { name: 'Removing…' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Remove from Palette & Workflows' })).not.toBeInTheDocument();
  });

  it('calls onCancel when clicking the overlay outside the dialog', () => {
    const { onCancel } = renderDialog();
    fireEvent.mouseDown(document.querySelector('.sw-unpublish-overlay')!);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('does not call onCancel when clicking inside the dialog', () => {
    const { onCancel } = renderDialog();
    fireEvent.mouseDown(document.querySelector('.sw-unpublish-dialog')!);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('shows publication date when publication metadata is present', () => {
    renderDialog({
      publication: {
        publishedAt: new Date('2026-07-24T12:00:00Z').getTime(),
        publishedFromVersionId: 'v1',
      },
    });

    expect(screen.getByTestId('unpublish-pub-date')).toBeInTheDocument();
    expect(screen.getByTestId('unpublish-pub-date').textContent).toContain('Published');
  });

  it('shows publication note when present', () => {
    renderDialog({
      publication: {
        publishedAt: Date.now(),
        publishedFromVersionId: 'v1',
        note: 'Approved for load testing',
      },
    });

    expect(screen.getByTestId('unpublish-pub-note')).toHaveTextContent('Note: Approved for load testing');
  });

  it('does not show publication metadata section when publication is undefined', () => {
    renderDialog({});
    expect(screen.queryByTestId('unpublish-pub-date')).not.toBeInTheDocument();
    expect(screen.queryByTestId('unpublish-pub-note')).not.toBeInTheDocument();
  });

  it('does not show note when publication has no note', () => {
    renderDialog({
      publication: {
        publishedAt: Date.now(),
        publishedFromVersionId: 'v1',
      },
    });

    expect(screen.getByTestId('unpublish-pub-date')).toBeInTheDocument();
    expect(screen.queryByTestId('unpublish-pub-note')).not.toBeInTheDocument();
  });

  it('calls onCancel when Escape key is pressed', () => {
    const { onCancel } = renderDialog();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
