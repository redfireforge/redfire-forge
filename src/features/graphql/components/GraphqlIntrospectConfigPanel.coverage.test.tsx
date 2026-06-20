/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import GraphqlIntrospectConfigPanel from './GraphqlIntrospectConfigPanel';

vi.mock('../../../shared/hooks/useListCrud', () => ({
  useListCrud: (items: unknown[], setItems: (next: unknown[]) => void) => ({
    update: (idx: number, patch: Record<string, unknown>) => {
      const next = items.map((item, i) => (i === idx ? { ...(item as Record<string, unknown>), ...patch } : item));
      setItems(next);
    },
    remove: (idx: number) => setItems(items.filter((_, i) => i !== idx)),
    move: vi.fn(),
  }),
}));

vi.mock('../../workflow/components/expression/InsertVarField', () => ({
  default: ({ children, onInsert }: { children: React.ReactNode; onInsert: (snippet: string) => void }) => (
    <div>
      <button type="button" data-testid="mock-insert" onClick={() => onInsert('{{var}}')}>insert</button>
      {children}
    </div>
  ),
}));

vi.mock('../../workflow/components/expression/ExpressionInput', () => ({
  default: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <input data-testid="mock-expression" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

vi.mock('./GraphqlQueryConfigPanel', () => ({
  GqlHeadersSection: ({ onAdd }: { onAdd: () => void }) => (
    <button type="button" data-testid="mock-headers-add" onClick={onAdd}>add-header</button>
  ),
  GqlAuthSection: ({ onChange }: { onChange: (auth: { type: string }) => void }) => (
    <button type="button" data-testid="mock-auth-change" onClick={() => onChange({ type: 'bearer' })}>auth</button>
  ),
  GqlOutputSection: ({ onAdd }: { onAdd: () => void }) => (
    <button type="button" data-testid="mock-output-add" onClick={onAdd}>add-output</button>
  ),
}));

vi.mock('../utils/graphqlPanelHelpers', () => ({
  computeIntrospectTabErrors: ({ endpoint, outputBindings }: { endpoint?: string; outputBindings: Array<{ variableName?: string }> }) => ({
    endpoint: !endpoint,
    output: outputBindings.some((b) => !b.variableName),
  }),
}));

describe('GraphqlIntrospectConfigPanel coverage edges', () => {
  it('handles undefined optional arrays/fields and inserts endpoint variable', () => {
    const onChange = vi.fn();
    render(
      <GraphqlIntrospectConfigPanel
        data={{
          type: 'graphqlIntrospect',
          label: 'I',
          endpoint: undefined,
          timeoutMs: undefined,
          headers: undefined,
          outputBindings: undefined,
          requiredFields: undefined,
          requiredTypes: undefined,
        }}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByTestId('mock-insert'));
    fireEvent.change(screen.getByTestId('gql-wf-introspect-timeout-input'), { target: { value: '12000' } });
    fireEvent.click(screen.getByTestId('gql-wf-introspect-skip-tls'));
    fireEvent.click(screen.getByTestId('mock-headers-add'));
    fireEvent.click(screen.getByTestId('mock-auth-change'));

    expect(onChange).toHaveBeenCalled();
  });

  it('maps empty minTypeCount input to undefined and shows output tab add path', () => {
    const onChange = vi.fn();
    render(
      <GraphqlIntrospectConfigPanel
        data={{
          type: 'graphqlIntrospect',
          label: 'I2',
          endpoint: 'https://api.example.com/graphql',
          timeoutMs: 30000,
          headers: [],
          outputBindings: [{ field: 'sdl', variableName: '', enabled: true }],
          requiredFields: [],
          requiredTypes: ['User'],
        }}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Schema Validation' }));
    fireEvent.change(screen.getByTestId('gql-wf-introspect-min-type-count'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Output' }));
    fireEvent.click(screen.getByTestId('mock-output-add'));

    const calls = onChange.mock.calls.map((c) => c[0]);
    expect(calls.some((d: { minTypeCount?: number }) => d.minTypeCount === undefined)).toBe(true);
  });
});
