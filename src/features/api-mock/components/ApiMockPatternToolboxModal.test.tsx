/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ApiMockPatternToolboxModal } from './ApiMockPatternToolboxModal';
import type { ApiMockPathMatcherV1 } from '../../../shared/api-mock/contracts';

function renderModal(
  initial: ApiMockPathMatcherV1 = { kind: 'parameterized', value: '/users/:id' },
  extra?: { onApplyConditions?: ReturnType<typeof vi.fn>; contextLabel?: string },
) {
  const onApply = vi.fn();
  const onClose = vi.fn();
  const onApplyConditions = extra?.onApplyConditions ?? vi.fn();
  render(
    <ApiMockPatternToolboxModal
      initial={initial}
      onApply={onApply}
      onApplyConditions={onApplyConditions}
      onClose={onClose}
      contextLabel={extra?.contextLabel}
    />,
  );
  return { onApply, onClose, onApplyConditions };
}

function pickCustomSelectByLabel(label: string, value: string, container: ParentNode = document) {
  const trigger = container.querySelector(`[aria-label="${label}"].cs-trigger`) as HTMLElement;
  fireEvent.click(trigger);
  fireEvent.click(document.querySelector(`[role="option"][data-value="${value}"]`) as HTMLElement);
}

describe('ApiMockPatternToolboxModal', () => {
  it('shows a live match with captured params and applies the matcher', () => {
    const { onApply, onClose } = renderModal();
    expect(screen.getByTestId('api-mock-toolbox-result').textContent).toContain('Matches');
    expect(screen.getByTestId('api-mock-toolbox-result').textContent).toContain('id=123');

    fireEvent.click(screen.getByTestId('api-mock-toolbox-apply'));
    expect(onApply).toHaveBeenCalledWith({ kind: 'parameterized', value: '/users/:id', flags: undefined });
    expect(onClose).toHaveBeenCalled();
  });

  it('covers toggle, kind select, sample editing, and a non-match danger state', () => {
    renderModal({ kind: 'exact', value: '/users' });

    const kind = screen.getByTestId('api-mock-toolbox-kind');
    fireEvent.click(kind.querySelector('.cs-trigger') as HTMLElement);
    fireEvent.click(document.querySelector('[role="option"][data-value="regex"]') as HTMLElement);

    fireEvent.click(screen.getByTestId('api-mock-toolbox-ci'));
    fireEvent.change(screen.getByTestId('api-mock-toolbox-pattern'), { target: { value: '^/users/[0-9]+$' } });
    fireEvent.change(screen.getByTestId('api-mock-toolbox-sample'), { target: { value: '/orders/x' } });

    const result = screen.getByTestId('api-mock-toolbox-result');
    expect(result.textContent).toContain('Does not match');
    expect(result.className).toContain('danger');
  });

  it('applies presets and can cancel without applying', () => {
    const { onApply, onClose } = renderModal({ kind: 'exact', value: '/' });

    fireEvent.click(screen.getByTestId('api-mock-toolbox-preset-nested params'));
    expect((screen.getByTestId('api-mock-toolbox-pattern') as HTMLInputElement).value).toBe('/orders/{orderId}/items/{itemId}');
    expect((screen.getByTestId('api-mock-toolbox-sample') as HTMLInputElement).value).toBe('/orders/7/items/3');
    expect(screen.getByTestId('api-mock-toolbox-result').textContent).toContain('orderId=7');
    expect(screen.getByTestId('api-mock-toolbox-result').textContent).toContain('itemId=3');

    fireEvent.click(screen.getByTestId('api-mock-toolbox-cancel'));
    expect(onApply).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('does not close when clicking the overlay backdrop', () => {
    const { onClose } = renderModal({ kind: 'exact', value: '/' });
    fireEvent.click(screen.getByTestId('api-mock-toolbox-overlay'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('resolves select-all in the JSON sample to root $', async () => {
    renderModal({ kind: 'exact', value: '/' });
    fireEvent.click(screen.getByRole('tab', { name: 'JSON body / JSONPath' }));

    const sample = screen.getByTestId('api-mock-toolbox-json-sample') as HTMLTextAreaElement;
    sample.focus();
    sample.setSelectionRange(0, sample.value.length);
    fireEvent.select(sample);
    // handler reads selection on rAF
    await vi.waitFor(() => {
      expect((screen.getByTestId('api-mock-toolbox-jsonpath') as HTMLInputElement).value).toBe('$');
    });
  });

  it('resolves a clicked array field to $.items[0].sku', async () => {
    renderModal({ kind: 'exact', value: '/' });
    fireEvent.click(screen.getByRole('tab', { name: 'JSON body / JSONPath' }));

    const sample = screen.getByTestId('api-mock-toolbox-json-sample') as HTMLTextAreaElement;
    const skuAt = sample.value.indexOf('"sku"');
    sample.focus();
    sample.setSelectionRange(skuAt, skuAt + 5);
    fireEvent.select(sample);
    await vi.waitFor(() => {
      expect((screen.getByTestId('api-mock-toolbox-jsonpath') as HTMLInputElement).value).toBe('$.items[0].sku');
      expect((screen.getByTestId('api-mock-toolbox-json-expected') as HTMLInputElement).value).toBe('RF-100');
    });
  });

  it('shows context label and opens on regex tab when initial kind is regex', () => {
    renderModal({ kind: 'regex', value: '^[0-9]+$' }, { contextLabel: 'Path param id' });
    expect(screen.getByText('Path param id')).toBeTruthy();
    expect(screen.getByTestId('api-mock-toolbox-regex')).toBeTruthy();
    expect(screen.getByTestId('api-mock-toolbox-apply').textContent).toBe('Apply pattern');
  });

  it('covers regex library search, apply, flags, samples, and invalid pattern', () => {
    renderModal({ kind: 'regex', value: '^[0-9]+$' });

    fireEvent.change(screen.getByTestId('api-mock-toolbox-library-search'), { target: { value: 'uuid' } });
    expect(screen.getByTestId('api-mock-toolbox-lib-UUID v4')).toBeTruthy();
    expect(screen.queryByTestId('api-mock-toolbox-lib-Numeric ID')).toBeNull();

    fireEvent.click(screen.getByTestId('api-mock-toolbox-lib-UUID v4'));
    expect((screen.getByTestId('api-mock-toolbox-regex') as HTMLInputElement).value).toContain('[0-9a-f]');

    fireEvent.change(screen.getByTestId('api-mock-toolbox-regex'), { target: { value: 'abc' } });
    expect((screen.getByTestId('api-mock-toolbox-regex') as HTMLInputElement).value).toBe('abc');

    fireEvent.click(screen.getByLabelText('Ignore case'));
    fireEvent.click(screen.getByLabelText('Unicode'));
    fireEvent.click(screen.getByLabelText('Multiline'));
    fireEvent.click(screen.getByLabelText('Case sensitive'));

    fireEvent.change(screen.getByTestId('api-mock-toolbox-regex'), { target: { value: '[' } });
    expect(screen.getByText('Invalid')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '+ Sample' }));
    const sampleInputs = screen.getAllByLabelText('Sample value');
    const newSample = sampleInputs[sampleInputs.length - 1] as HTMLInputElement;
    fireEvent.change(newSample, { target: { value: '550e8400-e29b-41d4-a716-446655440000' } });

    const toggles = screen.getAllByTitle('Toggle should match / should fail');
    fireEvent.click(toggles[0]);
    expect(toggles[0].textContent).toBe('Should fail');

    const deleteButtonsBefore = screen.getAllByLabelText('Delete sample').length;
    fireEvent.click(screen.getAllByLabelText('Delete sample')[0]);
    expect(screen.getAllByLabelText('Delete sample').length).toBe(deleteButtonsBefore - 1);
  });

  it('applies regex pattern with auto-anchoring when pattern lacks ^ prefix', () => {
    const { onApply, onClose } = renderModal({ kind: 'regex', value: '^[0-9]+$' });
    fireEvent.change(screen.getByTestId('api-mock-toolbox-regex'), { target: { value: '[0-9]+' } });
    fireEvent.click(screen.getByLabelText('Ignore case'));
    fireEvent.click(screen.getByTestId('api-mock-toolbox-apply'));
    expect(onApply).toHaveBeenCalledWith({
      kind: 'regex',
      value: '^[0-9]+$',
      flags: { caseInsensitive: true },
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('generalizes path segments and handles empty initial path', () => {
    renderModal({ kind: 'exact', value: '/users/42/orders/A-1098' });

    const parts = screen.getAllByRole('button').filter(b => b.className.includes('am-path-part'));
    expect(parts.some(p => p.textContent?.includes('42 → :param'))).toBe(true);

    fireEvent.click(parts.find(p => p.textContent === 'users') as HTMLElement);
    expect((screen.getByTestId('api-mock-toolbox-pattern') as HTMLInputElement).value).toBe('/:users/42/orders/A-1098');

    fireEvent.click(parts.find(p => p.textContent?.includes('42 → :param')) as HTMLElement);
    expect((screen.getByTestId('api-mock-toolbox-pattern') as HTMLInputElement).value).toContain('/42/');
  });

  it('shows empty path params extraction and falls back path parts for empty value', () => {
    renderModal({ kind: 'exact', value: '' });
    expect(screen.getByText('No path parameters extracted.')).toBeTruthy();
  });

  it('handles invalid JSON, manual jsonPath edits, and applies jsonPath_exists', async () => {
    const onApplyConditions = vi.fn();
    const { onClose } = renderModal({ kind: 'exact', value: '/' }, { onApplyConditions });

    fireEvent.click(screen.getByTestId('api-mock-toolbox-tab-jsonpath'));

    fireEvent.change(screen.getByTestId('api-mock-toolbox-json-sample'), { target: { value: '{ broken' } });
    expect(screen.getByText('Invalid JSON')).toBeTruthy();
    expect(screen.getByTestId('api-mock-toolbox-json-valid').className).toContain('danger');

    fireEvent.change(screen.getByTestId('api-mock-toolbox-json-sample'), {
      target: { value: JSON.stringify({ id: 99 }, null, 2) },
    });
    fireEvent.change(screen.getByTestId('api-mock-toolbox-jsonpath'), { target: { value: '$.missing' } });
    expect((screen.getByTestId('api-mock-toolbox-json-resolved') as HTMLInputElement).value).toBe('(no match)');

    fireEvent.change(screen.getByTestId('api-mock-toolbox-jsonpath'), { target: { value: '$.id' } });
    fireEvent.change(screen.getByTestId('api-mock-toolbox-json-expected'), { target: { value: '' } });
    fireEvent.click(screen.getByTestId('api-mock-toolbox-apply'));
    expect(onApplyConditions).toHaveBeenCalledWith([
      expect.objectContaining({ source: 'body', operator: 'jsonPath_exists', expected: '$.id' }),
    ]);
    expect(onClose).toHaveBeenCalled();
  });

  it('applies jsonPath_equals when expected value is set', () => {
    const onApplyConditions = vi.fn();
    renderModal({ kind: 'exact', value: '/' }, { onApplyConditions });
    fireEvent.click(screen.getByTestId('api-mock-toolbox-tab-jsonpath'));
    fireEvent.change(screen.getByTestId('api-mock-toolbox-json-expected'), { target: { value: '99' } });
    fireEvent.click(screen.getByTestId('api-mock-toolbox-apply'));
    expect(onApplyConditions).toHaveBeenCalledWith([
      expect.objectContaining({ operator: 'jsonPath_equals', expected: ['$', '99'] }),
    ]);
  });

  it('reads textarea selection on document mouseup while focused', async () => {
    renderModal({ kind: 'exact', value: '/' });
    fireEvent.click(screen.getByRole('tab', { name: 'JSON body / JSONPath' }));

    const sample = screen.getByTestId('api-mock-toolbox-json-sample') as HTMLTextAreaElement;
    const tierAt = sample.value.indexOf('"tier"');
    sample.focus();
    sample.setSelectionRange(tierAt, tierAt + 6);
    fireEvent.mouseUp(document);
    await vi.waitFor(() => {
      expect((screen.getByTestId('api-mock-toolbox-jsonpath') as HTMLInputElement).value).toBe('$.customer.tier');
    });
  });

  it('composes constraints with present/absent operators and applies them', () => {
    const onApplyConditions = vi.fn();
    const { onClose } = renderModal({ kind: 'exact', value: '/' }, { onApplyConditions });

    fireEvent.click(screen.getByTestId('api-mock-toolbox-tab-constraints'));
    expect(screen.getByText(/Name at least one header/)).toBeTruthy();
    expect(screen.getByTestId('api-mock-toolbox-apply').textContent).toBe('Add conditions');

    fireEvent.click(screen.getByTestId('api-mock-toolbox-add-constraint'));
    const constraintRows = () => document.querySelectorAll('.am-constraint-row');
    expect(constraintRows().length).toBe(2);

    fireEvent.change(screen.getByTestId('api-mock-toolbox-constraint-name-c1'), { target: { value: 'X-Tenant' } });
    fireEvent.change(screen.getByTestId('api-mock-toolbox-constraint-value-c1'), { target: { value: 'acme' } });

    const addedRow = constraintRows()[1] as HTMLElement;
    const addedId = addedRow.getAttribute('data-testid')!.replace('api-mock-toolbox-constraint-', '');
    pickCustomSelectByLabel('Constraint source', 'query', addedRow);
    fireEvent.change(screen.getByTestId(`api-mock-toolbox-constraint-name-${addedId}`), { target: { value: 'debug' } });
    pickCustomSelectByLabel('Constraint operator', 'present', addedRow);
    expect(screen.getByTestId(`api-mock-toolbox-constraint-value-${addedId}`)).toBeDisabled();

    fireEvent.click(screen.getByTestId(`api-mock-toolbox-constraint-remove-${addedId}`));
    fireEvent.click(screen.getByTestId('api-mock-toolbox-apply'));
    expect(onApplyConditions).toHaveBeenCalledWith([
      expect.objectContaining({
        source: 'header',
        selector: 'X-Tenant',
        operator: 'exact',
        expected: 'acme',
      }),
    ]);
    expect(onClose).toHaveBeenCalled();
  });
});
