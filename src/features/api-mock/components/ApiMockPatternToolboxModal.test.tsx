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
  extra?: {
    onApplyConditions?: ReturnType<typeof vi.fn>;
    contextLabel?: string;
    predicateSource?: 'cookie' | 'header' | 'query' | 'pathParam';
    predicateSelector?: string;
    predicateOperator?: 'regex' | 'glob';
    predicateExpected?: string;
  },
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
      predicateSource={extra?.predicateSource}
      predicateSelector={extra?.predicateSelector}
      predicateOperator={extra?.predicateOperator}
      predicateExpected={extra?.predicateExpected}
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
    expect(screen.getByTestId('api-mock-toolbox-applied-source').textContent).toBe('path');
    expect(screen.getByTestId('api-mock-toolbox-lib-Numeric ID').className).toContain('active');
  });

  it('names the open Match row in Applied condition and drops Numeric ID when the pattern is custom', () => {
    renderModal(
      { kind: 'exact', value: '/reports' },
      {
        contextLabel: 'GET /reports · Cookie “sid”',
        predicateSource: 'cookie',
        predicateSelector: 'sid',
        predicateOperator: 'regex',
        predicateExpected: '',
      },
    );
    fireEvent.click(screen.getByTestId('api-mock-toolbox-tab-regex'));
    expect(screen.getByTestId('api-mock-toolbox-applied-source').textContent).toBe('cookie');
    expect(screen.getByTestId('api-mock-toolbox-applied-selector').textContent).toBe('sid');
    fireEvent.change(screen.getByTestId('api-mock-toolbox-regex'), { target: { value: '^S-[0-9]{4}$' } });
    expect(screen.getByTestId('api-mock-toolbox-applied-expected').textContent).toBe('^S-[0-9]{4}$');
    expect(screen.getByTestId('api-mock-toolbox-lib-Numeric ID').className).not.toContain('active');
    expect(screen.getByTestId('api-mock-toolbox-sample-row-s1').textContent).toMatch(/Should match/);
    expect(screen.getByTestId('api-mock-toolbox-sample-row-s1').className).toContain('fail');
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
    expect(screen.getByTestId('api-mock-toolbox-json-result').className).toContain('pass');
    fireEvent.click(screen.getByTestId('api-mock-toolbox-apply'));
    expect(onApplyConditions).toHaveBeenCalledWith([
      expect.objectContaining({ source: 'body', operator: 'jsonPath_exists', expected: '$.id' }),
    ]);
    expect(onClose).toHaveBeenCalled();
  });

  it('marks JSONPath exists as a miss when the path does not resolve', () => {
    renderModal({ kind: 'exact', value: '/' });
    fireEvent.click(screen.getByTestId('api-mock-toolbox-tab-jsonpath'));
    fireEvent.change(screen.getByTestId('api-mock-toolbox-jsonpath'), { target: { value: '$.missing' } });
    fireEvent.change(screen.getByTestId('api-mock-toolbox-json-expected'), { target: { value: '' } });
    expect(screen.getByTestId('api-mock-toolbox-json-result').className).toContain('fail');
  });

  it('marks JSONPath equals as a hit for pretty vs compact object JSON', () => {
    renderModal({ kind: 'exact', value: '/' });
    fireEvent.click(screen.getByTestId('api-mock-toolbox-tab-jsonpath'));
    fireEvent.change(screen.getByTestId('api-mock-toolbox-jsonpath'), { target: { value: '$.customer' } });
    fireEvent.change(screen.getByTestId('api-mock-toolbox-json-expected'), {
      target: { value: '{\n  "id": "C-4421",\n  "tier": "gold"\n}' },
    });
    expect(screen.getByTestId('api-mock-toolbox-json-result').className).toContain('pass');
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

  it('applies XPath and schema conditions', () => {
    const { onApplyConditions, onClose } = renderModal();
    fireEvent.click(screen.getByTestId('api-mock-toolbox-tab-xpath'));
    fireEvent.change(screen.getByTestId('api-mock-toolbox-xpath-expr'), { target: { value: '/*' } });
    fireEvent.click(screen.getByTestId('api-mock-toolbox-apply'));
    expect(onApplyConditions).toHaveBeenCalledWith([
      expect.objectContaining({ operator: 'xpath_exists', expected: '/*' }),
    ]);
    expect(onClose).toHaveBeenCalled();
  });

  it('applies JSON Schema via onApplyPredicate when editing a matcher row', () => {
    const onApplyPredicate = vi.fn();
    const onClose = vi.fn();
    render(
      <ApiMockPatternToolboxModal
        initial={{ kind: 'exact', value: '/x' }}
        initialTab="schema"
        predicateExpected={{ type: 'object' }}
        onApply={vi.fn()}
        onApplyPredicate={onApplyPredicate}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByTestId('api-mock-toolbox-schema-preset-Required id'));
    fireEvent.click(screen.getByTestId('api-mock-toolbox-apply'));
    expect(onApplyPredicate).toHaveBeenCalledWith(expect.objectContaining({ operator: 'jsonSchema' }));
  });

  it('applies XML schema names through onApplyConditions', () => {
    const { onApplyConditions, onClose } = renderModal();
    fireEvent.click(screen.getByTestId('api-mock-toolbox-tab-schema'));
    fireEvent.click(screen.getByTestId('api-mock-toolbox-schema-kind-xml'));
    fireEvent.click(screen.getByTestId('api-mock-toolbox-apply'));
    expect(onApplyConditions).toHaveBeenCalledWith([
      expect.objectContaining({ operator: 'xmlSchema' }),
    ]);
    expect(onClose).toHaveBeenCalled();
  });

  it('opens schema tab as XML when the expected value is not JSON', () => {
    render(
      <ApiMockPatternToolboxModal
        initial={{ kind: 'exact', value: '/x' }}
        initialTab="schema"
        predicateExpected="Order, Id"
        onApply={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByTestId('api-mock-toolbox-schema-kind-xml').className).toContain('active');
  });

  it('keeps xmlSchema object expected on the XML tab instead of treating it as JSON Schema', () => {
    const onApplyPredicate = vi.fn();
    render(
      <ApiMockPatternToolboxModal
        initial={{ kind: 'exact', value: '/x' }}
        initialTab="schema"
        predicateOperator="xmlSchema"
        predicateExpected={{ required: ['Order'] }}
        onApply={vi.fn()}
        onApplyPredicate={onApplyPredicate}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByTestId('api-mock-toolbox-schema-kind-xml').className).toContain('active');
    fireEvent.click(screen.getByTestId('api-mock-toolbox-apply'));
    expect(onApplyPredicate).toHaveBeenCalledWith(expect.objectContaining({ operator: 'xmlSchema' }));
  });

  it('applies xpath_equals via onApplyPredicate', () => {
    const onApplyPredicate = vi.fn();
    render(
      <ApiMockPatternToolboxModal
        initial={{ kind: 'exact', value: '/x' }}
        initialTab="xpath"
        onApply={vi.fn()}
        onApplyPredicate={onApplyPredicate}
        onClose={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByTestId('api-mock-toolbox-xpath-value'), { target: { value: 'open' } });
    fireEvent.click(screen.getByTestId('api-mock-toolbox-apply'));
    expect(onApplyPredicate).toHaveBeenCalledWith(expect.objectContaining({
      operator: 'xpath_equals',
      expected: ['/*', 'open'],
    }));
  });

  it('applies jsonPath via onApplyPredicate', () => {
    const onApplyPredicate = vi.fn();
    render(
      <ApiMockPatternToolboxModal
        initial={{ kind: 'exact', value: '/x' }}
        initialTab="jsonpath"
        onApply={vi.fn()}
        onApplyPredicate={onApplyPredicate}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('api-mock-toolbox-apply'));
    expect(onApplyPredicate).toHaveBeenCalledWith(expect.objectContaining({
      operator: expect.stringMatching(/^jsonPath_/),
    }));
  });

  it('keeps regex patterns that already start with /', () => {
    const { onApply } = renderModal({ kind: 'regex', value: '/users/' });
    fireEvent.click(screen.getByTestId('api-mock-toolbox-apply'));
    expect(onApply).toHaveBeenCalledWith(expect.objectContaining({ kind: 'regex', value: '/users/' }));
  });

  it('does not rewrite a predicate row when Apply is used on the Path tab', () => {
    const onApply = vi.fn();
    const onApplyPredicate = vi.fn();
    const onClose = vi.fn();
    render(
      <ApiMockPatternToolboxModal
        initial={{ kind: 'parameterized', value: '/users/:id' }}
        initialTab="path"
        predicateOperator="jsonSchema"
        predicateExpected="{}"
        onApply={onApply}
        onApplyPredicate={onApplyPredicate}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByTestId('api-mock-toolbox-apply'));
    expect(onApply).not.toHaveBeenCalled();
    expect(onApplyPredicate).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('does not rewrite a schema matcher when Apply is used on the Regex tab', () => {
    const onApply = vi.fn();
    const onApplyPredicate = vi.fn();
    const onClose = vi.fn();
    render(
      <ApiMockPatternToolboxModal
        initial={{ kind: 'regex', value: '^[0-9]+$' }}
        initialTab="regex"
        predicateOperator="jsonSchema"
        predicateExpected="{}"
        onApply={onApply}
        onApplyPredicate={onApplyPredicate}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByTestId('api-mock-toolbox-apply'));
    expect(onApply).not.toHaveBeenCalled();
    expect(onApplyPredicate).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('identity-applies an existing jsonPath_exists matcher instead of replacing it with the sample', () => {
    const onApplyPredicate = vi.fn();
    render(
      <ApiMockPatternToolboxModal
        initial={{ kind: 'exact', value: '/x' }}
        initialTab="jsonpath"
        predicateOperator="jsonPath_exists"
        predicateExpected="$.user.email"
        onApply={vi.fn()}
        onApplyPredicate={onApplyPredicate}
        onClose={vi.fn()}
      />,
    );
    expect((screen.getByTestId('api-mock-toolbox-jsonpath') as HTMLInputElement).value).toBe('$.user.email');
    expect((screen.getByTestId('api-mock-toolbox-json-expected') as HTMLInputElement).value).toBe('');
    expect(screen.getByTestId('api-mock-toolbox-apply').textContent).toBe('Apply matcher');
    fireEvent.click(screen.getByTestId('api-mock-toolbox-apply'));
    expect(onApplyPredicate).toHaveBeenCalledWith({
      source: 'body',
      selector: '',
      operator: 'jsonPath_exists',
      expected: '$.user.email',
    });
  });

  it('identity-applies an existing xpath_equals matcher', () => {
    const onApplyPredicate = vi.fn();
    render(
      <ApiMockPatternToolboxModal
        initial={{ kind: 'exact', value: '/x' }}
        initialTab="xpath"
        predicateOperator="xpath_equals"
        predicateExpected={['//status', 'open']}
        onApply={vi.fn()}
        onApplyPredicate={onApplyPredicate}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('api-mock-toolbox-apply'));
    expect(onApplyPredicate).toHaveBeenCalledWith(expect.objectContaining({
      operator: 'xpath_equals',
      expected: ['//status', 'open'],
    }));
  });

  it('applies an unanchored glob without converting it to a regex', () => {
    const onApply = vi.fn();
    render(
      <ApiMockPatternToolboxModal
        initial={{ kind: 'exact', value: '/x' }}
        initialTab="regex"
        predicateOperator="glob"
        predicateExpected="*.png"
        onApply={onApply}
        onApplyPredicate={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect((screen.getByTestId('api-mock-toolbox-regex') as HTMLInputElement).value).toBe('*.png');
    expect(screen.getByText('Valid')).toBeTruthy();
    fireEvent.change(screen.getAllByLabelText('Sample value')[0], { target: { value: 'logo.png' } });
    expect(document.querySelectorAll('.am-sample-row')[0].className).toContain('pass');
    fireEvent.click(screen.getByTestId('api-mock-toolbox-apply'));
    expect(onApply).toHaveBeenCalledWith(expect.objectContaining({ kind: 'glob', value: '*.png' }));
  });

  it('live-samples an unanchored path regex with the same ^…$ wrap Apply writes', () => {
    const { onApply } = renderModal({ kind: 'regex', value: '^[0-9]+$' });
    fireEvent.change(screen.getByTestId('api-mock-toolbox-regex'), { target: { value: '42' } });
    const rows = document.querySelectorAll('.am-sample-row');
    expect(rows[0].className).toContain('pass');
    expect(rows[3].className).toContain('pass');
    fireEvent.click(screen.getByTestId('api-mock-toolbox-apply'));
    expect(onApply).toHaveBeenCalledWith(expect.objectContaining({ kind: 'regex', value: '^42$' }));
  });

  it('seeds Ignore case from the predicate row instead of the route path flags', () => {
    const onApply = vi.fn();
    render(
      <ApiMockPatternToolboxModal
        initial={{ kind: 'regex', value: '/users', flags: { caseInsensitive: true } }}
        initialTab="regex"
        predicateOperator="regex"
        predicateExpected="admin"
        predicateCaseInsensitive={false}
        onApply={onApply}
        onApplyPredicate={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('api-mock-toolbox-apply'));
    expect(onApply).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'regex',
      value: 'admin',
      flags: undefined,
    }));
  });

  it('applies Ignore case from a case-insensitive predicate row', () => {
    const onApply = vi.fn();
    render(
      <ApiMockPatternToolboxModal
        initial={{ kind: 'exact', value: '/x' }}
        initialTab="regex"
        predicateOperator="regex"
        predicateExpected="Admin"
        predicateCaseInsensitive
        onApply={onApply}
        onApplyPredicate={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('api-mock-toolbox-apply'));
    expect(onApply).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'regex',
      flags: { caseInsensitive: true },
    }));
  });

  it('does not copy a JSONPath expected value into the schema editor', () => {
    render(
      <ApiMockPatternToolboxModal
        initial={{ kind: 'exact', value: '/x' }}
        initialTab="schema"
        predicateOperator="jsonPath_exists"
        predicateExpected="$.user.email"
        onApply={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect((screen.getByTestId('api-mock-toolbox-schema-editor') as HTMLTextAreaElement).value).toContain('"type": "object"');
  });
});
