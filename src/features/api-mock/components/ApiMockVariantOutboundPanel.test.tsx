/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  ApiMockVariantOutboundPanel,
  formatCallbackBodyJson,
} from './ApiMockVariantOutboundPanel';
import { createDefaultResponse } from '../../../shared/api-mock/defaults';
import type { ApiMockCallbackV1 } from '../../../shared/api-mock/callbackContracts';

interface SelectOption {
  value: string;
  label: string;
}

interface CustomSelectMockProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  'aria-label'?: string;
}

vi.mock('../../../shared/components/CustomSelect', () => ({
  CustomSelect: ({ value, onChange, options, 'aria-label': aria }: CustomSelectMockProps) => (
    <select aria-label={aria} value={value} onChange={e => onChange(e.target.value)}>
      {options.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  ),
}));

function variantWithCallback(bodyTemplate: string) {
  const cb: ApiMockCallbackV1 = {
    id: 'cb-1',
    enabled: true,
    url: 'https://hooks.example.com/mock-event',
    method: 'POST',
    headers: [],
    bodyTemplate,
    timeoutMs: 10_000,
    maxRetries: 3,
  };
  return { ...createDefaultResponse('v1'), callbacks: [cb] };
}

describe('formatCallbackBodyJson', () => {
  it('pretty-prints and minifies valid JSON with quoted templates', () => {
    const raw = '{"event":"mock.matched","path":"{{request.path}}"}';
    const pretty = formatCallbackBodyJson(raw, 'pretty');
    expect(pretty.ok).toBe(true);
    if (pretty.ok) {
      expect(pretty.value).toContain('\n');
      expect(pretty.value).toContain('{{request.path}}');
    }
    const oneline = formatCallbackBodyJson(pretty.ok ? pretty.value : raw, 'oneline');
    expect(oneline.ok).toBe(true);
    if (oneline.ok) {
      expect(oneline.value).not.toContain('\n');
      expect(oneline.value).toContain('{{request.path}}');
    }
  });

  it('rejects empty and invalid JSON', () => {
    expect(formatCallbackBodyJson('   ', 'pretty')).toEqual({ ok: false, error: 'Body is empty.' });
    const bad = formatCallbackBodyJson('{ "id": {{uuid}} }', 'pretty');
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error).toMatch(/template expressions/i);
    const syntax = formatCallbackBodyJson('{ broken', 'pretty');
    expect(syntax.ok).toBe(false);
    if (!syntax.ok) expect(syntax.error).toMatch(/JSON/i);
  });
});

function variantWithTransform(
  rule: Partial<import('../../../shared/api-mock/callbackContracts').ApiMockTransformRuleV1> & { id: string; op: import('../../../shared/api-mock/callbackContracts').ApiMockTransformRuleV1['op'] },
) {
  return {
    ...createDefaultResponse('v1'),
    transforms: [{
      id: rule.id,
      enabled: rule.enabled ?? true,
      target: 'response' as const,
      op: rule.op,
      key: rule.key,
      value: rule.value,
    }],
  };
}

describe('ApiMockVariantOutboundPanel', () => {
  it('adds transform and callback rows', () => {
    const onUpdate = vi.fn();
    const variant = createDefaultResponse('v1');
    render(<ApiMockVariantOutboundPanel variant={variant} onUpdate={onUpdate} />);

    fireEvent.click(screen.getByTestId('api-mock-transform-add'));
    expect(onUpdate).toHaveBeenCalled();
    const transforms = onUpdate.mock.calls.at(-1)?.[0]?.transforms;
    expect(transforms).toHaveLength(1);

    fireEvent.click(screen.getByTestId('api-mock-callback-add'));
    const callbacks = onUpdate.mock.calls.at(-1)?.[0]?.callbacks;
    expect(callbacks).toHaveLength(1);
    expect(callbacks[0].enabled).toBe(false);
  });

  it('formats callback body with Pretty and One line badges', () => {
    const onUpdate = vi.fn();
    const variant = variantWithCallback('{"event":"mock.matched","path":"{{request.path}}"}');
    const { rerender } = render(<ApiMockVariantOutboundPanel variant={variant} onUpdate={onUpdate} />);

    expect(screen.getByTestId('api-mock-callback-body-cb-1').closest('.am-form-row')).toHaveClass('am-form-row--tall');

    fireEvent.click(screen.getByTestId('api-mock-callback-pretty-cb-1'));
    const prettyPatch = onUpdate.mock.calls.at(-1)?.[0]?.callbacks?.[0]?.bodyTemplate as string;
    expect(prettyPatch).toContain('\n  "event"');

    onUpdate.mockClear();
    rerender(<ApiMockVariantOutboundPanel variant={variantWithCallback(prettyPatch)} onUpdate={onUpdate} />);
    fireEvent.click(screen.getByTestId('api-mock-callback-oneline-cb-1'));
    const onelinePatch = onUpdate.mock.calls.at(-1)?.[0]?.callbacks?.[0]?.bodyTemplate as string;
    expect(onelinePatch).toBe('{"event":"mock.matched","path":"{{request.path}}"}');
  });

  it('shows a format error for invalid JSON bodies', () => {
    const onUpdate = vi.fn();
    render(
      <ApiMockVariantOutboundPanel
        variant={variantWithCallback('{ broken')}
        onUpdate={onUpdate}
      />,
    );
    fireEvent.click(screen.getByTestId('api-mock-callback-pretty-cb-1'));
    expect(screen.getByTestId('api-mock-callback-format-error-cb-1')).toBeTruthy();
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('shows empty-state copy when no transforms or callbacks exist', () => {
    render(<ApiMockVariantOutboundPanel variant={createDefaultResponse('v1')} onUpdate={vi.fn()} />);
    expect(screen.getByTestId('api-mock-outbound-pipeline').textContent).toMatch(/Template/);
    expect(screen.getByTestId('api-mock-transform-empty').textContent).toMatch(/No transforms/);
    expect(screen.getByTestId('api-mock-callback-empty').textContent).toMatch(/No outbound callbacks/);
  });

  it('marks Transforms and Callbacks as configured but Template and Client as passive markers', () => {
    render(<ApiMockVariantOutboundPanel variant={createDefaultResponse('v1')} onUpdate={vi.fn()} />);
    const stepFor = (label: string) =>
      screen.getByText(label, { selector: '.am-outbound-step' }).closest('.am-outbound-step');
    expect(stepFor('Transforms')?.className).toContain('am-outbound-step--edit');
    expect(stepFor('Callbacks')?.className).toContain('am-outbound-step--edit');
    expect(stepFor('Template')?.className).toContain('am-outbound-step--passive');
    expect(stepFor('Client')?.className).toContain('am-outbound-step--passive');
  });

  it('updates, toggles, and removes transform rows for each op', () => {
    const onUpdate = vi.fn();
    const variant = variantWithTransform({
      id: 'xf-1',
      op: 'setHeader',
      key: 'X-Test',
      value: 'one',
      enabled: true,
    });
    render(<ApiMockVariantOutboundPanel variant={variant} onUpdate={onUpdate} />);

    fireEvent.click(screen.getByLabelText('Enable transform'));
    expect(onUpdate.mock.calls.at(-1)?.[0]?.transforms?.[0]?.enabled).toBe(false);

    fireEvent.change(screen.getByLabelText('Header name'), { target: { value: 'X-Updated' } });
    expect(onUpdate.mock.calls.at(-1)?.[0]?.transforms?.[0]?.key).toBe('X-Updated');

    fireEvent.change(screen.getByLabelText('Transform value'), { target: { value: 'two' } });
    expect(onUpdate.mock.calls.at(-1)?.[0]?.transforms?.[0]?.value).toBe('two');

    fireEvent.change(screen.getByLabelText('Transform op'), { target: { value: 'setStatus' } });
    expect(onUpdate.mock.calls.at(-1)?.[0]?.transforms?.[0]?.op).toBe('setStatus');

    fireEvent.click(screen.getByLabelText('Remove transform'));
    expect(onUpdate.mock.calls.at(-1)?.[0]?.transforms).toEqual([]);
  });

  it('renders append/remove header fields and replaceBody value only', () => {
    const onUpdate = vi.fn();
    const { rerender } = render(
      <ApiMockVariantOutboundPanel
        variant={variantWithTransform({ id: 'xf-a', op: 'appendHeader', key: 'X-A', value: 'v' })}
        onUpdate={onUpdate}
      />,
    );
    expect(screen.getByLabelText('Header name')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Header name'), { target: { value: 'X-B' } });
    expect(onUpdate.mock.calls.at(-1)?.[0]?.transforms?.[0]?.key).toBe('X-B');

    rerender(
      <ApiMockVariantOutboundPanel
        variant={variantWithTransform({ id: 'xf-r', op: 'removeHeader', key: 'X-Remove' })}
        onUpdate={onUpdate}
      />,
    );
    expect(screen.queryByLabelText('Transform value')).toBeNull();
    fireEvent.change(screen.getByLabelText('Header name'), { target: { value: 'X-Gone' } });

    rerender(
      <ApiMockVariantOutboundPanel
        variant={variantWithTransform({ id: 'xf-b', op: 'replaceBody', value: '{"ok":true}' })}
        onUpdate={onUpdate}
      />,
    );
    expect(screen.queryByLabelText('Header name')).toBeNull();
    fireEvent.change(screen.getByLabelText('Transform value'), { target: { value: '{"ok":false}' } });
    expect(onUpdate.mock.calls.at(-1)?.[0]?.transforms?.[0]?.value).toBe('{"ok":false}');
  });

  it('edits callback fields, clears format errors, and removes callbacks', () => {
    const onUpdate = vi.fn();
    const variant = variantWithCallback('{"event":"mock.matched"}');
    const { rerender } = render(<ApiMockVariantOutboundPanel variant={variant} onUpdate={onUpdate} />);

    fireEvent.click(screen.getByTestId('api-mock-callback-enabled-cb-1'));
    expect(onUpdate.mock.calls.at(-1)?.[0]?.callbacks?.[0]?.enabled).toBe(false);

    fireEvent.change(screen.getByTestId('api-mock-callback-url-cb-1'), { target: { value: 'https://example.com/hook' } });
    expect(onUpdate.mock.calls.at(-1)?.[0]?.callbacks?.[0]?.url).toBe('https://example.com/hook');

    fireEvent.change(screen.getByLabelText('Callback method'), { target: { value: 'PATCH' } });
    expect(onUpdate.mock.calls.at(-1)?.[0]?.callbacks?.[0]?.method).toBe('PATCH');

    fireEvent.change(screen.getByLabelText('Timeout ms'), { target: { value: '5000' } });
    expect(onUpdate.mock.calls.at(-1)?.[0]?.callbacks?.[0]?.timeoutMs).toBe(5000);

    fireEvent.change(screen.getByLabelText('Max retries'), { target: { value: '2' } });
    expect(onUpdate.mock.calls.at(-1)?.[0]?.callbacks?.[0]?.maxRetries).toBe(2);

    fireEvent.click(screen.getByTestId('api-mock-callback-pretty-cb-1'));
    expect(onUpdate).toHaveBeenCalled();

    onUpdate.mockClear();
    rerender(
      <ApiMockVariantOutboundPanel
        variant={variantWithCallback('{ broken')}
        onUpdate={onUpdate}
      />,
    );
    fireEvent.click(screen.getByTestId('api-mock-callback-pretty-cb-1'));
    expect(screen.getByTestId('api-mock-callback-format-error-cb-1')).toBeTruthy();

    fireEvent.change(screen.getByTestId('api-mock-callback-body-cb-1'), { target: { value: '{"fixed":true}' } });
    expect(screen.queryByTestId('api-mock-callback-format-error-cb-1')).toBeNull();
    expect(onUpdate.mock.calls.at(-1)?.[0]?.callbacks?.[0]?.bodyTemplate).toBe('{"fixed":true}');

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(onUpdate.mock.calls.at(-1)?.[0]?.callbacks).toEqual([]);
  });

  it('falls back timeout and retries when numeric inputs are cleared', () => {
    const onUpdate = vi.fn();
    render(<ApiMockVariantOutboundPanel variant={variantWithCallback('{}')} onUpdate={onUpdate} />);
    fireEvent.change(screen.getByLabelText('Timeout ms'), { target: { value: '' } });
    expect(onUpdate.mock.calls.at(-1)?.[0]?.callbacks?.[0]?.timeoutMs).toBe(10_000);
    fireEvent.change(screen.getByLabelText('Max retries'), { target: { value: '' } });
    expect(onUpdate.mock.calls.at(-1)?.[0]?.callbacks?.[0]?.maxRetries).toBe(0);
  });

  it('clears format errors on successful format and removes stale errors when deleting callbacks', () => {
    const onUpdate = vi.fn();
    const broken = variantWithCallback('{ broken');
    const { rerender } = render(<ApiMockVariantOutboundPanel variant={broken} onUpdate={onUpdate} />);

    fireEvent.click(screen.getByTestId('api-mock-callback-pretty-cb-1'));
    expect(screen.getByTestId('api-mock-callback-format-error-cb-1')).toBeTruthy();

    rerender(
      <ApiMockVariantOutboundPanel
        variant={variantWithCallback('{"event":"mock.matched"}')}
        onUpdate={onUpdate}
      />,
    );
    fireEvent.click(screen.getByTestId('api-mock-callback-pretty-cb-1'));
    expect(screen.queryByTestId('api-mock-callback-format-error-cb-1')).toBeNull();
    expect(onUpdate.mock.calls.at(-1)?.[0]?.callbacks?.[0]?.bodyTemplate).toContain('"event"');

    onUpdate.mockClear();
    rerender(<ApiMockVariantOutboundPanel variant={broken} onUpdate={onUpdate} />);
    fireEvent.click(screen.getByTestId('api-mock-callback-pretty-cb-1'));
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(onUpdate.mock.calls.at(-1)?.[0]?.callbacks).toEqual([]);
  });

  it('updates only the targeted row when multiple transforms or callbacks exist', () => {
    const onUpdate = vi.fn();
    const variant = {
      ...createDefaultResponse('v1'),
      transforms: [
        { id: 'xf-1', enabled: true, target: 'response' as const, op: 'setHeader' as const, key: 'A', value: '1' },
        { id: 'xf-2', enabled: false, target: 'response' as const, op: 'setStatus' as const, value: '201' },
      ],
      callbacks: [
        { ...variantWithCallback('{"a":1}').callbacks![0], id: 'cb-1' },
        { ...variantWithCallback('{"b":2}').callbacks![0], id: 'cb-2', enabled: false, url: 'https://b.example/hook' },
      ],
    };
    render(<ApiMockVariantOutboundPanel variant={variant} onUpdate={onUpdate} />);

    fireEvent.click(screen.getAllByLabelText('Enable transform')[1]);
    expect(onUpdate.mock.calls.at(-1)?.[0]?.transforms?.[1]?.enabled).toBe(true);

    fireEvent.change(screen.getByTestId('api-mock-callback-url-cb-2'), { target: { value: 'https://updated.example/hook' } });
    expect(onUpdate.mock.calls.at(-1)?.[0]?.callbacks?.[1]?.url).toBe('https://updated.example/hook');
    expect(onUpdate.mock.calls.at(-1)?.[0]?.callbacks?.[0]?.url).toBe('https://hooks.example.com/mock-event');
  });

  it('uses generic invalid-json message for non-Error parse failures', () => {
    const parseSpy = vi.spyOn(JSON, 'parse').mockImplementation(() => {
      throw 'bad';
    });
    const result = formatCallbackBodyJson('{"x":1}', 'pretty');
    expect(result).toEqual({ ok: false, error: 'Body is not valid JSON.' });
    parseSpy.mockRestore();
  });
});
