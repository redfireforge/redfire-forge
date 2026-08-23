/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { AcknowledgedSection, ChangeRow } from './GraphqlSchemaDiffChangeRows';
import { ackSectionChangeRowNoop } from '../utils/graphqlSchemaDiffConstants';
import type { GraphqlSchemaDiffChange } from '@shared/types/graphql';

const change: GraphqlSchemaDiffChange = {
  path: 'Query.oldField',
  description: 'Field removed',
  criticality: 'BREAKING',
  acknowledged: false,
};

describe('ChangeRow', () => {
  it('renders acknowledge flow and note form', () => {
    const onToggleAck = vi.fn();
    const onAckNoteChange = vi.fn();
    const onAckSubmit = vi.fn();
    const { rerender } = render(
      <ChangeRow
        change={change}
        canAcknowledge
        isAckExpanded={false}
        ackNote=""
        onToggleAck={onToggleAck}
        onAckNoteChange={onAckNoteChange}
        onAckSubmit={onAckSubmit}
      />,
    );
    fireEvent.click(screen.getByTestId('gql-diff-ack-btn'));
    expect(onToggleAck).toHaveBeenCalled();

    rerender(
      <ChangeRow
        change={change}
        canAcknowledge
        isAckExpanded
        ackNote="planned"
        onToggleAck={onToggleAck}
        onAckNoteChange={onAckNoteChange}
        onAckSubmit={onAckSubmit}
      />,
    );
    fireEvent.change(screen.getByTestId('gql-diff-ack-note'), { target: { value: 'note' } });
    expect(onAckNoteChange).toHaveBeenCalled();
    fireEvent.keyDown(screen.getByTestId('gql-diff-ack-note'), { key: 'Enter' });
    expect(onAckSubmit).toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('gql-diff-ack-confirm'));
    expect(onAckSubmit).toHaveBeenCalledTimes(2);
  });

  it('shows undo and acknowledged note when acked', () => {
    const onUnacknowledge = vi.fn();
    render(
      <ChangeRow
        change={{
          ...change,
          acknowledged: true,
          acknowledgeNote: 'Intentional',
        }}
        canAcknowledge={false}
        isAckExpanded={false}
        ackNote=""
        onToggleAck={vi.fn()}
        onAckNoteChange={vi.fn()}
        onAckSubmit={vi.fn()}
        onUnacknowledge={onUnacknowledge}
      />,
    );
    expect(screen.getByText(/Note: Intentional/)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('gql-diff-unack-btn'));
    expect(onUnacknowledge).toHaveBeenCalled();
  });
});

describe('AcknowledgedSection', () => {
  it('expands and calls onUnacknowledge for acked rows', () => {
    const onUnacknowledge = vi.fn();
    render(
      <AcknowledgedSection
        changes={[{ ...change, acknowledged: true }]}
        onUnacknowledge={onUnacknowledge}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Acknowledged \(1\)/ }));
    fireEvent.click(screen.getByTestId('gql-diff-unack-btn'));
    expect(onUnacknowledge).toHaveBeenCalledWith('Query.oldField');
  });

  it('renders ack rows without unack when handler omitted', () => {
    render(
      <AcknowledgedSection changes={[{ ...change, acknowledged: true }]} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Acknowledged \(1\)/ }));
    expect(screen.queryByTestId('gql-diff-unack-btn')).not.toBeInTheDocument();
  });

  it('invokes noop handlers on acked rows inside section', () => {
    render(
      <AcknowledgedSection
        changes={[{ ...change, acknowledged: true, acknowledgeNote: 'ok' }]}
        onUnacknowledge={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Acknowledged \(1\)/ }));
    fireEvent.click(screen.getByTestId('gql-diff-unack-btn'));
    fireEvent.click(screen.getByRole('button', { name: /Acknowledged \(1\)/ }));
  });

  it('shows Cancel label when ack form expanded', () => {
    render(
      <ChangeRow
        change={change}
        canAcknowledge
        isAckExpanded
        ackNote=""
        onToggleAck={vi.fn()}
        onAckNoteChange={vi.fn()}
        onAckSubmit={vi.fn()}
      />,
    );
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('ackSectionChangeRowNoop is safe to call', () => {
    expect(() => ackSectionChangeRowNoop()).not.toThrow();
  });
});
