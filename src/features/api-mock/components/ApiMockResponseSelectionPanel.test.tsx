/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ApiMockResponseSelectionPanel, readJsonPathCondition, writeJsonPathCondition } from './ApiMockResponseSelectionPanel';
import { createDefaultResponse } from '../../../shared/api-mock/defaults';
import type { ApiMockRouteV1, ApiMockResponseVariantV1 } from '../../../shared/api-mock/contracts';
import { CUSTOM_SELECT_SET_VALUE_EVENT } from '../../../shared/components/CustomSelect';

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

function renderPanel(
  routeOverrides: Partial<ApiMockRouteV1> = {},
  variantOverrides: Partial<ApiMockResponseVariantV1> = {},
  extra: { sequencePosition?: number; conditionLabel?: string } = {},
) {
  const activeVariant = { ...createDefaultResponse('resp-1'), ...variantOverrides };
  const route = makeRoute({ responses: [activeVariant], ...routeOverrides });
  const onUpdateRoute = vi.fn();
  const onUpdateVariant = vi.fn();
  const onModeChange = vi.fn();
  render(
    <ApiMockResponseSelectionPanel
      route={route}
      activeVariant={activeVariant}
      conditionLabel={extra.conditionLabel ?? 'Default rule'}
      sequencePosition={extra.sequencePosition}
      onUpdateRoute={onUpdateRoute}
      onUpdateVariant={onUpdateVariant}
      onModeChange={onModeChange}
    />,
  );
  return { onUpdateRoute, onUpdateVariant, onModeChange, activeVariant, route };
}

describe('ApiMockResponseSelectionPanel', () => {
  it('changes response mode via CustomSelect', () => {
    const { onModeChange } = renderPanel();
    fireEvent(
      screen.getByTestId('api-mock-response-mode'),
      new CustomEvent(CUSTOM_SELECT_SET_VALUE_EVENT, { detail: { value: 'weighted' }, bubbles: true }),
    );
    expect(onModeChange).toHaveBeenCalledWith('weighted');
  });

  it('marks active variant as default in rules mode', () => {
    const second = { ...createDefaultResponse('resp-2'), name: 'Alt', isDefault: false };
    const { onUpdateRoute } = renderPanel({ responses: [createDefaultResponse('resp-1'), second] });
    fireEvent.click(screen.getByTestId('api-mock-selection-default'));
    expect(onUpdateRoute).toHaveBeenCalledWith({
      responses: expect.arrayContaining([
        expect.objectContaining({ id: 'resp-1', isDefault: true }),
        expect.objectContaining({ id: 'resp-2', isDefault: false }),
      ]),
    });
  });

  it('shows sequence position badge', () => {
    const disabled = { ...createDefaultResponse('resp-2'), enabled: false };
    renderPanel(
      { responseMode: 'sequence', responses: [createDefaultResponse('resp-1'), disabled] },
      {},
      { sequencePosition: 2 },
    );
    expect(screen.getByTestId('api-mock-sequence-position')).toHaveTextContent('Position 2 of 1');
  });

  it('edits weighted variant weight', () => {
    const { onUpdateVariant } = renderPanel({ responseMode: 'weighted' });
    fireEvent.change(screen.getByTestId('api-mock-variant-weight'), { target: { value: '5' } });
    expect(onUpdateVariant).toHaveBeenCalledWith({ weight: 5 });
    fireEvent.change(screen.getByTestId('api-mock-variant-weight'), { target: { value: 'abc' } });
    expect(onUpdateVariant).toHaveBeenLastCalledWith({ weight: 0 });
  });

  it('edits state transitions and counter rows', () => {
    const { onUpdateVariant } = renderPanel(
      { responseMode: 'state' },
      { transition: { targetState: 'Next', counterUpdates: [{ key: 'n', delta: 2 }] } },
    );

    fireEvent.change(screen.getByTestId('api-mock-variant-required-state'), { target: { value: 'Boot' } });
    fireEvent.change(screen.getByTestId('api-mock-variant-required-state'), { target: { value: '' } });
    fireEvent.change(screen.getByTestId('api-mock-variant-next-state'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Counter 1 key'), { target: { value: 'hits' } });
    fireEvent.change(screen.getByLabelText('Counter 1 delta'), { target: { value: 'abc' } });
    fireEvent.click(screen.getByTestId('api-mock-counter-remove-0'));
    fireEvent.click(screen.getByTestId('api-mock-counter-add'));
    expect(onUpdateVariant).toHaveBeenCalled();
  });

  it('shows mode notice for non-rules modes', () => {
    renderPanel({ responseMode: 'sequence' });
    expect(screen.getByTestId('api-mock-selection-panel').textContent).toMatch(/sequence/i);
    expect(screen.getByTestId('api-mock-selection-panel').textContent).toMatch(/mode is active on the live listener/i);
  });

  it('authors a JSONPath condition on a non-default variant', () => {
    const { onUpdateVariant } = renderPanel(
      {},
      { isDefault: false, name: 'Missing' },
    );
    expect(screen.getByTestId('api-mock-selection-default-note').textContent).toMatch(/Exactly one/);
    fireEvent.change(screen.getByTestId('api-mock-selection-condition-path'), { target: { value: '$.sku' } });
    expect(onUpdateVariant).toHaveBeenCalledWith({
      conditions: expect.objectContaining({
        combinator: 'all',
        children: [expect.objectContaining({
          operator: 'jsonPath_equals',
          expected: ['$.sku', ''],
        })],
      }),
    });
    fireEvent.change(screen.getByTestId('api-mock-selection-condition-value'), { target: { value: 'MISSING' } });
    expect(onUpdateVariant).toHaveBeenLastCalledWith({
      conditions: expect.objectContaining({
        children: [expect.objectContaining({ expected: ['', 'MISSING'] })],
      }),
    });
  });

  it('reads an existing JSONPath pair', () => {
    renderPanel(
      {},
      {
        isDefault: false,
        conditions: {
          id: 'pg-cond',
          combinator: 'all',
          children: [{
            id: 'p1',
            source: 'body',
            selector: '',
            operator: 'jsonPath_equals',
            expected: ['$.sku', 'MISSING'],
          }],
        },
      },
    );
    expect(screen.getByTestId('api-mock-selection-condition-path')).toHaveValue('$.sku');
    expect(screen.getByTestId('api-mock-selection-condition-value')).toHaveValue('MISSING');
  });

  it('readJsonPathCondition falls back to selector when expected is not a pair', () => {
    const base = createDefaultResponse('resp-r');
    expect(readJsonPathCondition({
      ...base,
      conditions: {
        id: 'pg',
        combinator: 'all',
        children: [{
          id: 'p',
          source: 'body',
          selector: '$.id',
          operator: 'jsonPath_equals',
          expected: 'solo',
        }],
      },
    })).toEqual({ path: '$.id', value: 'solo' });

    expect(readJsonPathCondition({
      ...base,
      conditions: {
        id: 'pg',
        combinator: 'all',
        children: [{
          id: 'p',
          source: 'body',
          selector: '',
          operator: 'jsonPath_equals',
        }],
      },
    })).toEqual({ path: '', value: '' });

    expect(readJsonPathCondition({
      ...base,
      conditions: {
        id: 'pg',
        combinator: 'all',
        children: [{
          id: 'p',
          source: 'body',
          selector: '',
          operator: 'jsonPath_equals',
          expected: [undefined, undefined],
        }],
      },
    })).toEqual({ path: '', value: '' });
  });

  it('writeJsonPathCondition mints a group id when the variant has none', () => {
    const written = writeJsonPathCondition(createDefaultResponse('resp-z'), '$.a', '1');
    expect(written?.id).toBe('pg-cond-resp-z');
    expect(writeJsonPathCondition(createDefaultResponse('resp-z'), '  ', '  ')).toBeUndefined();
  });

  it('updates state counters when the transition has no target state', () => {
    const { onUpdateVariant } = renderPanel(
      { responseMode: 'state' },
      { transition: { currentState: 'A', counterUpdates: [{ key: 'n', delta: 1 }] } },
    );
    fireEvent.change(screen.getByLabelText('Counter 1 key'), { target: { value: 'hits' } });
    fireEvent.change(screen.getByLabelText('Counter 1 delta'), { target: { value: '3' } });
    fireEvent.click(screen.getByTestId('api-mock-counter-remove-0'));
    expect(onUpdateVariant).toHaveBeenCalledWith(expect.objectContaining({
      transition: expect.objectContaining({ targetState: 'Started' }),
    }));
  });
});
