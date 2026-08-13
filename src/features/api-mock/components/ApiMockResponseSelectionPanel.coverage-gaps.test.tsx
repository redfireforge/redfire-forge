/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ApiMockResponseSelectionPanel } from './ApiMockResponseSelectionPanel';
import { createDefaultResponse } from '../../../shared/api-mock/defaults';
import type { ApiMockRouteV1, ApiMockResponseVariantV1 } from '../../../shared/api-mock/contracts';

const ts = '2026-08-12T00:00:00.000Z';

function makeRoute(overrides: Partial<ApiMockRouteV1> = {}): ApiMockRouteV1 {
  return {
    id: 'route-1',
    name: 'Route 1',
    enabled: true,
    method: 'GET',
    path: { kind: 'exact', value: '/users' },
    priority: 10,
    predicates: { id: 'pg', combinator: 'all', children: [] },
    responseMode: 'rules',
    responses: [createDefaultResponse('resp-1')],
    tags: [],
    createdAt: ts,
    updatedAt: ts,
    ...overrides,
  };
}

describe('ApiMockResponseSelectionPanel coverage gaps', () => {
  it('defaults sequence position to zero and handles all-disabled responses', () => {
    const disabled = { ...createDefaultResponse('resp-1'), enabled: false };
    render(
      <ApiMockResponseSelectionPanel
        route={makeRoute({ responseMode: 'sequence', responses: [disabled] })}
        activeVariant={disabled}
        conditionLabel="Always"
        onUpdateRoute={vi.fn()}
        onUpdateVariant={vi.fn()}
        onModeChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId('api-mock-sequence-position')).toHaveTextContent('Position 0 of 1');
  });

  it('shows enabled response count in sequence mode', () => {
    render(
      <ApiMockResponseSelectionPanel
        route={makeRoute({
          responseMode: 'sequence',
          responses: [createDefaultResponse('resp-1'), { ...createDefaultResponse('resp-2'), enabled: true }],
        })}
        activeVariant={createDefaultResponse('resp-1')}
        conditionLabel="Always"
        sequencePosition={1}
        onUpdateRoute={vi.fn()}
        onUpdateVariant={vi.fn()}
        onModeChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId('api-mock-sequence-position')).toHaveTextContent('Position 1 of 2');
  });

  it('updates counters through a stateful panel', () => {
    function Stateful() {
      const [variant, setVariant] = useState<ApiMockResponseVariantV1>({
        ...createDefaultResponse('resp-1'),
        transition: { targetState: 'Active', counterUpdates: [{ key: 'hits', delta: 1 }] },
      });
      return (
        <ApiMockResponseSelectionPanel
          route={makeRoute({ responseMode: 'state', responses: [variant] })}
          activeVariant={variant}
          conditionLabel="Any"
          onUpdateRoute={vi.fn()}
          onUpdateVariant={patch => setVariant(v => ({
            ...v,
            transition: patch.transition ?? v.transition,
          }))}
          onModeChange={vi.fn()}
        />
      );
    }
    render(<Stateful />);

    fireEvent.change(screen.getByLabelText('Counter 1 key'), { target: { value: 'views' } });
    fireEvent.change(screen.getByLabelText('Counter 1 delta'), { target: { value: '-1' } });
    fireEvent.click(screen.getByTestId('api-mock-counter-add'));
    expect(screen.getByTestId('api-mock-counter-row-1')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Counter 2 key'), { target: { value: 'miss' } });
    fireEvent.change(screen.getByLabelText('Counter 2 delta'), { target: { value: '3' } });
    fireEvent.click(screen.getByTestId('api-mock-counter-remove-0'));
    expect(screen.queryByTestId('api-mock-counter-row-1')).toBeNull();

    fireEvent.click(screen.getByTestId('api-mock-counter-remove-0'));
    expect(screen.queryByTestId('api-mock-counter-row-0')).toBeNull();
  });

  it('fills required state target when empty', () => {
    const onUpdateVariant = vi.fn();
    render(
      <ApiMockResponseSelectionPanel
        route={makeRoute({ responseMode: 'state' })}
        activeVariant={createDefaultResponse('resp-1')}
        conditionLabel="Any"
        onUpdateRoute={vi.fn()}
        onUpdateVariant={onUpdateVariant}
        onModeChange={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByTestId('api-mock-variant-required-state'), { target: { value: 'Idle' } });
    expect(onUpdateVariant).toHaveBeenCalledWith({
      transition: expect.objectContaining({ currentState: 'Idle', targetState: 'Idle' }),
    });
  });

  it('edits next state without an existing transition', () => {
    const onUpdateVariant = vi.fn();
    const { rerender } = render(
      <ApiMockResponseSelectionPanel
        route={makeRoute({ responseMode: 'state' })}
        activeVariant={createDefaultResponse('resp-1')}
        conditionLabel="Any"
        onUpdateRoute={vi.fn()}
        onUpdateVariant={onUpdateVariant}
        onModeChange={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByTestId('api-mock-variant-next-state'), { target: { value: 'Done' } });
    expect(onUpdateVariant).toHaveBeenCalledWith({
      transition: { currentState: undefined, targetState: 'Done', counterUpdates: undefined },
    });

    rerender(
      <ApiMockResponseSelectionPanel
        route={makeRoute({ responseMode: 'state' })}
        activeVariant={{ ...createDefaultResponse('resp-1'), transition: { targetState: 'Done' } }}
        conditionLabel="Any"
        onUpdateRoute={vi.fn()}
        onUpdateVariant={onUpdateVariant}
        onModeChange={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByTestId('api-mock-variant-next-state'), { target: { value: '' } });
    expect(onUpdateVariant).toHaveBeenLastCalledWith({
      transition: { currentState: undefined, targetState: 'Started', counterUpdates: undefined },
    });
  });

  it('preserves existing target state when required state changes', () => {
    const onUpdateVariant = vi.fn();
    render(
      <ApiMockResponseSelectionPanel
        route={makeRoute({ responseMode: 'state' })}
        activeVariant={{
          ...createDefaultResponse('resp-1'),
          transition: { currentState: 'Idle', targetState: 'Active', counterUpdates: undefined },
        }}
        conditionLabel="Any"
        onUpdateRoute={vi.fn()}
        onUpdateVariant={onUpdateVariant}
        onModeChange={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByTestId('api-mock-variant-required-state'), { target: { value: 'Boot' } });
    expect(onUpdateVariant).toHaveBeenCalledWith({
      transition: {
        currentState: 'Boot',
        targetState: 'Active',
        counterUpdates: undefined,
      },
    });
  });

  it('adds counter with default target state when missing', () => {
    const onUpdateVariant = vi.fn();
    render(
      <ApiMockResponseSelectionPanel
        route={makeRoute({ responseMode: 'state' })}
        activeVariant={{
          ...createDefaultResponse('resp-1'),
          transition: { currentState: 'Idle' },
        }}
        conditionLabel="Any"
        onUpdateRoute={vi.fn()}
        onUpdateVariant={onUpdateVariant}
        onModeChange={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('api-mock-counter-add'));
    expect(onUpdateVariant).toHaveBeenCalledWith({
      transition: expect.objectContaining({
        targetState: 'Started',
        counterUpdates: [{ key: 'hits', delta: 1 }],
      }),
    });
  });

  it('removes one counter while keeping another', () => {
    const onUpdateVariant = vi.fn();
    render(
      <ApiMockResponseSelectionPanel
        route={makeRoute({ responseMode: 'state' })}
        activeVariant={{
          ...createDefaultResponse('resp-1'),
          transition: {
            targetState: 'Active',
            counterUpdates: [{ key: 'a', delta: 1 }, { key: 'b', delta: 2 }],
          },
        }}
        conditionLabel="Any"
        onUpdateRoute={vi.fn()}
        onUpdateVariant={onUpdateVariant}
        onModeChange={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('api-mock-counter-remove-0'));
    expect(onUpdateVariant).toHaveBeenLastCalledWith({
      transition: expect.objectContaining({
        counterUpdates: [{ key: 'b', delta: 2 }],
      }),
    });
  });

  it('shows state mode notice and explicit weight value', () => {
    render(
      <ApiMockResponseSelectionPanel
        route={makeRoute({ responseMode: 'state' })}
        activeVariant={{ ...createDefaultResponse('resp-1'), weight: 10 }}
        conditionLabel="Any"
        onUpdateRoute={vi.fn()}
        onUpdateVariant={vi.fn()}
        onModeChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId('api-mock-selection-panel').textContent).toMatch(/state/i);
  });

  it('shows default weight and weighted mode notice', () => {
    const onUpdateVariant = vi.fn();
    render(
      <ApiMockResponseSelectionPanel
        route={makeRoute({ responseMode: 'weighted' })}
        activeVariant={{ ...createDefaultResponse('resp-1'), weight: undefined }}
        conditionLabel="Any"
        onUpdateRoute={vi.fn()}
        onUpdateVariant={onUpdateVariant}
        onModeChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId('api-mock-variant-weight')).toHaveValue(1);
    expect(screen.getByTestId('api-mock-selection-panel').textContent).toMatch(/weighted/i);
  });
});
