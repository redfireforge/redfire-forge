/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  ApiMockResponseSelectionPanel,
  applyToolboxPredicateToSelection,
  readJsonPathCondition,
  sequenceCursorLabel,
  writeJsonPathCondition,
} from './ApiMockResponseSelectionPanel';
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

describe('sequenceCursorLabel', () => {
  it('maps the shared 0-based cursor to a 1-based next step', () => {
    expect(sequenceCursorLabel(undefined, 2)).toBe('Next: Step 1 of 2');
    expect(sequenceCursorLabel(0, 2)).toBe('Next: Step 1 of 2');
    expect(sequenceCursorLabel(1, 2)).toBe('Next: Step 2 of 2');
    expect(sequenceCursorLabel(2, 2)).toBe('Next: Step 1 of 2');
    expect(sequenceCursorLabel(2, 1)).toBe('Next: Step 1 of 1');
    expect(sequenceCursorLabel(0, 0)).toBe('Next: Step 1 of 1');
  });
});

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
    expect(screen.getByTestId('api-mock-sequence-position')).toHaveTextContent('Next: Step 1 of 1');
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
    expect(screen.getByTestId('api-mock-counter-row-0')).toHaveClass('am-counter-row');
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

  it('shows Pick from sample on the JSONPath row for a non-default variant', () => {
    renderPanel({}, { isDefault: false, name: 'Missing' });
    expect(screen.getByTestId('api-mock-selection-condition-toolbox')).toHaveTextContent('Pick from sample');
    expect(screen.getByTestId('api-mock-selection-condition-path').closest('.am-selection-jsonpath-row')).toBeTruthy();
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

  it('opens the JSONPath picker and applies a sample path', () => {
    const { onUpdateVariant } = renderPanel({}, { isDefault: false, name: 'Missing' });
    fireEvent.click(screen.getByTestId('api-mock-selection-condition-toolbox'));
    expect(screen.getByTestId('api-mock-pattern-toolbox')).toBeInTheDocument();
    expect(screen.queryByTestId('api-mock-toolbox-tab-regex')).not.toBeInTheDocument();
    fireEvent.change(screen.getByTestId('api-mock-toolbox-jsonpath'), { target: { value: '$.sku' } });
    fireEvent.change(screen.getByTestId('api-mock-toolbox-json-expected'), { target: { value: 'MISSING' } });
    fireEvent.click(screen.getByTestId('api-mock-toolbox-apply'));
    expect(onUpdateVariant).toHaveBeenCalledWith({
      conditions: expect.objectContaining({
        children: [expect.objectContaining({
          operator: 'jsonPath_equals',
          expected: ['$.sku', 'MISSING'],
        })],
      }),
    });
    expect(screen.queryByTestId('api-mock-pattern-toolbox')).not.toBeInTheDocument();
  });

  it('seeds the JSONPath picker from the current condition and keeps the value on exists', () => {
    const { onUpdateVariant } = renderPanel(
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
    fireEvent.click(screen.getByTestId('api-mock-selection-condition-toolbox'));
    expect(screen.getByTestId('api-mock-toolbox-jsonpath')).toHaveValue('$.sku');
    expect(screen.getByTestId('api-mock-toolbox-json-expected')).toHaveValue('MISSING');
    fireEvent.change(screen.getByTestId('api-mock-toolbox-jsonpath'), { target: { value: '$.items[0].sku' } });
    fireEvent.change(screen.getByTestId('api-mock-toolbox-json-expected'), { target: { value: '' } });
    fireEvent.click(screen.getByTestId('api-mock-toolbox-apply'));
    expect(onUpdateVariant).toHaveBeenCalledWith({
      conditions: expect.objectContaining({
        children: [expect.objectContaining({ expected: ['$.items[0].sku', 'MISSING'] })],
      }),
    });
  });

  it('cancels the JSONPath picker without writing a condition', () => {
    const { onUpdateVariant } = renderPanel({}, { isDefault: false, name: 'Missing' });
    fireEvent.click(screen.getByTestId('api-mock-selection-condition-toolbox'));
    fireEvent.click(screen.getByTestId('api-mock-toolbox-cancel'));
    expect(onUpdateVariant).not.toHaveBeenCalled();
    expect(screen.queryByTestId('api-mock-pattern-toolbox')).not.toBeInTheDocument();
  });

  it('applyToolboxPredicateToSelection maps equals, exists, and ignores other operators', () => {
    const base = {
      ...createDefaultResponse('resp-r'),
      conditions: {
        id: 'pg',
        combinator: 'all' as const,
        children: [{
          id: 'p',
          source: 'body' as const,
          selector: '',
          operator: 'jsonPath_equals' as const,
          expected: ['$.sku', 'MISSING'],
        }],
      },
    };
    expect(applyToolboxPredicateToSelection(base, {
      operator: 'jsonPath_equals',
      expected: ['$.items[0].sku', 'RF-100'],
    })?.children).toEqual([expect.objectContaining({ expected: ['$.items[0].sku', 'RF-100'] })]);
    expect(applyToolboxPredicateToSelection(base, {
      operator: 'jsonPath_equals',
      expected: '$.id',
    })?.children).toEqual([expect.objectContaining({ expected: ['$.id', 'MISSING'] })]);
    expect(applyToolboxPredicateToSelection(base, {
      operator: 'jsonPath_exists',
      expected: '$.customer.id',
    })?.children).toEqual([expect.objectContaining({ expected: ['$.customer.id', 'MISSING'] })]);
    expect(applyToolboxPredicateToSelection(base, { operator: 'regex', expected: 'x' })).toBe(base.conditions);
    expect(applyToolboxPredicateToSelection(base, { operator: 'jsonPath_equals' })).toBe(base.conditions);
    expect(applyToolboxPredicateToSelection(createDefaultResponse('empty'), {
      operator: 'jsonPath_equals',
      expected: [undefined, undefined],
    })).toBeUndefined();
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
