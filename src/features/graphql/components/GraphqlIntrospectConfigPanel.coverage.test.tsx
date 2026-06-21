/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import GraphqlIntrospectConfigPanel from './GraphqlIntrospectConfigPanel';
import type { GraphqlIntrospectNodeData } from '../../workflow/types/workflow';

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
  GqlHeadersSection: ({ onAdd, headerCrud }: { onAdd: () => void; headerCrud?: { update: (i: number, p: Record<string, unknown>) => void } }) => (
    <div>
      <button type="button" data-testid="mock-headers-add" onClick={onAdd}>add-header</button>
      <button type="button" data-testid="mock-headers-update" onClick={() => headerCrud?.update(0, { key: 'Authorization' })}>patch-header</button>
    </div>
  ),
  GqlAuthSection: ({ onChange }: { onChange: (auth: { type: string }) => void }) => (
    <button type="button" data-testid="mock-auth-change" onClick={() => onChange({ type: 'bearer' })}>auth</button>
  ),
  GqlOutputSection: ({ onAdd, crud }: { onAdd: () => void; crud?: { update: (i: number, p: Record<string, unknown>) => void } }) => (
    <div>
      <button type="button" data-testid="mock-output-add" onClick={onAdd}>add-output</button>
      <button type="button" data-testid="mock-output-update" onClick={() => crud?.update(0, { variableName: 'schemaOut' })}>patch-output</button>
    </div>
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

  it('adds and removes required fields and parses required type names', () => {
    const onChange = vi.fn();
    render(
      <GraphqlIntrospectConfigPanel
        data={{
          type: 'graphqlIntrospect',
          label: 'Intro',
          endpoint: 'https://api.example.com/graphql',
          timeoutMs: 30000,
          headers: [],
          outputBindings: [{ field: 'sdl', variableName: 'schemaSdl', enabled: true }],
          requiredFields: [],
          requiredTypes: ['User'],
        }}
        onChange={onChange}
      />,
    );

    fireEvent.change(screen.getByDisplayValue('Intro'), { target: { value: 'Intro v2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Schema Validation' }));

    fireEvent.change(screen.getByTestId('gql-wf-introspect-min-type-count'), { target: { value: '5' } });
    fireEvent.change(screen.getByTestId('gql-wf-introspect-required-types'), { target: { value: 'User, Post' } });

    fireEvent.change(screen.getByTestId('gql-wf-introspect-new-type'), { target: { value: 'User' } });
    fireEvent.change(screen.getByTestId('gql-wf-introspect-new-field'), { target: { value: 'email' } });
    fireEvent.click(screen.getByTestId('gql-wf-introspect-add-field-btn'));

    expect(onChange.mock.calls.some((call) =>
      (call[0].requiredFields ?? []).some(
        (rf: { typeName: string; fieldName: string }) => rf.typeName === 'User' && rf.fieldName === 'email',
      ),
    )).toBe(true);
  });

  it('adds required field on Enter key in field name input', () => {
    const onChange = vi.fn();
    render(
      <GraphqlIntrospectConfigPanel
        data={{
          type: 'graphqlIntrospect',
          label: 'Intro',
          endpoint: 'https://api.example.com/graphql',
          requiredFields: [],
        }}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Schema Validation' }));
    fireEvent.change(screen.getByTestId('gql-wf-introspect-new-type'), { target: { value: 'Query' } });
    fireEvent.change(screen.getByTestId('gql-wf-introspect-new-field'), { target: { value: 'viewer' } });
    fireEvent.keyDown(screen.getByTestId('gql-wf-introspect-new-field'), { key: 'Enter' });

    expect(onChange.mock.calls.some((c) =>
      (c[0].requiredFields ?? []).some((rf: { typeName: string; fieldName: string }) =>
        rf.typeName === 'Query' && rf.fieldName === 'viewer',
      ),
    )).toBe(true);
  });

  it('supports stateful add/remove required fields and header crud callbacks', () => {
    function Harness() {
      const [data, setData] = useState<GraphqlIntrospectNodeData>({
        type: 'graphqlIntrospect',
        label: 'Intro',
        endpoint: 'https://api.example.com/graphql',
        headers: [],
        requiredFields: [],
        requiredTypes: ['User'],
      });
      return <GraphqlIntrospectConfigPanel data={data} onChange={setData} />;
    }

    render(<Harness />);

    fireEvent.click(screen.getByRole('button', { name: 'Schema Validation' }));
    fireEvent.change(screen.getByTestId('gql-wf-introspect-min-type-count'), { target: { value: '' } });
    fireEvent.change(screen.getByTestId('gql-wf-introspect-required-types'), { target: { value: '   ' } });
    fireEvent.click(screen.getByTestId('gql-wf-introspect-add-field-btn'));

    fireEvent.change(screen.getByTestId('gql-wf-introspect-new-type'), { target: { value: 'User' } });
    fireEvent.change(screen.getByTestId('gql-wf-introspect-new-field'), { target: { value: 'email' } });
    fireEvent.keyDown(screen.getByTestId('gql-wf-introspect-new-field'), { key: 'Enter' });
    expect(screen.getByText(/User\.email/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Remove required field User.email/ }));
    expect(screen.getByText('No required fields — click + Add')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Endpoint' }));
    fireEvent.click(screen.getByTestId('mock-headers-add'));
    fireEvent.change(screen.getByTestId('mock-expression'), { target: { value: 'https://next.example.com/graphql' } });
    fireEvent.click(screen.getByTestId('mock-headers-update'));
    fireEvent.click(screen.getByRole('button', { name: 'Output' }));
    fireEvent.click(screen.getByTestId('mock-output-update'));
  });
});
