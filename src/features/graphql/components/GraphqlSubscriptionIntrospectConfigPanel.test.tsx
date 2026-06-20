/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import GraphqlIntrospectConfigPanel from './GraphqlIntrospectConfigPanel';
import GraphqlSubscriptionConfigPanel from './GraphqlSubscriptionConfigPanel';

type PanelPatch = {
  minTypeCount?: number;
  requiredTypes?: string[];
  timeoutMs?: number;
  skipTlsVerify?: boolean;
  stopAfterMessages?: number;
  stopAfterMs?: number;
  stopCondition?: string;
  subscriptionTransport?: string;
  subscriptionQuery?: string;
};

vi.mock('../../../shared/hooks/useListCrud', () => ({
  useListCrud: (items: unknown[], setItems: (next: unknown[]) => void) => ({
    update: (idx: number, patch: Record<string, unknown>) => {
      const next = items.map((item, i) => (i === idx ? { ...(item as Record<string, unknown>), ...patch } : item));
      setItems(next);
    },
    remove: (idx: number) => {
      setItems(items.filter((_, i) => i !== idx));
    },
    move: vi.fn(),
  }),
}));

vi.mock('../../workflow/components/expression/InsertVarField', () => ({
  default: ({ children, onInsert }: { children: React.ReactNode; onInsert: (snippet: string) => void }) => (
    <div data-testid="insert-var-field">
      <button type="button" data-testid="insert-var-btn" onClick={() => onInsert('{{var}}')}>insert</button>
      {children}
    </div>
  ),
}));

vi.mock('../../workflow/components/expression/ExpressionInput', () => ({
  default: ({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) => (
    <input
      data-testid="expression-input"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

vi.mock('../../workflow/components/expression/AvailableVariables', () => ({
  default: () => <div data-testid="available-vars">vars</div>,
}));

vi.mock('./GraphqlQueryConfigPanel', () => ({
  GqlHeadersSection: ({ onAdd, headerCrud }: { onAdd: () => void; headerCrud: { update: (i: number, patch: Record<string, unknown>) => void } }) => (
    <>
      <button type="button" data-testid="mock-headers-add" onClick={onAdd}>add-header</button>
      <button type="button" data-testid="mock-headers-update" onClick={() => headerCrud.update(0, { key: 'X-Test' })}>update-header</button>
    </>
  ),
  GqlAuthSection: ({ onChange }: { onChange: (auth: { type: string; token: string }) => void }) => (
    <button type="button" data-testid="mock-auth-change" onClick={() => onChange({ type: 'bearer', token: '{{token}}' })}>auth-change</button>
  ),
  GqlExtractionSection: ({ onAdd, crud }: { onAdd: () => void; crud: { update: (i: number, patch: Record<string, unknown>) => void } }) => (
    <>
      <button type="button" data-testid="mock-extraction-add" onClick={onAdd}>add-extraction</button>
      <button type="button" data-testid="mock-extraction-update" onClick={() => crud.update(0, { variableName: 'extractedVar' })}>update-extraction</button>
    </>
  ),
  GqlOutputSection: ({ onAdd, crud }: { onAdd: () => void; crud: { update: (i: number, patch: Record<string, unknown>) => void } }) => (
    <>
      <button type="button" data-testid="mock-output-add" onClick={onAdd}>add-output</button>
      <button type="button" data-testid="mock-output-update" onClick={() => crud.update(0, { variableName: 'outVar' })}>update-output</button>
    </>
  ),
}));

vi.mock('../utils/graphqlPanelHelpers', () => ({
  computeIntrospectTabErrors: ({ endpoint, outputBindings }: { endpoint?: string; outputBindings: Array<{ variableName?: string }> }) => ({
    endpoint: !endpoint?.trim(),
    output: outputBindings.some((b) => !b.variableName?.trim()),
  }),
  computeSubscriptionTabErrors: ({ endpoint, subscriptionQuery, variables, outputBindings }: { endpoint?: string; subscriptionQuery?: string; variables?: string; outputBindings: Array<{ variableName?: string }> }) => {
    let invalid = false;
    try {
      JSON.parse(variables ?? '{}');
    } catch {
      invalid = true;
    }
    return {
      subscription: !endpoint?.trim() || !subscriptionQuery?.trim() || invalid,
      extraction: false,
      output: outputBindings.some((b) => !b.variableName?.trim()),
    };
  },
  hasInvalidVariablesJson: (raw?: string) => {
    try {
      JSON.parse(raw ?? '{}');
      return false;
    } catch {
      return true;
    }
  },
}));

function introspectData() {
  return {
    type: 'graphqlIntrospect',
    label: 'Introspect',
    endpoint: '',
    timeoutMs: 30000,
    headers: [],
    outputBindings: [{ field: 'sdl', variableName: '', enabled: true }],
    requiredFields: [],
  };
}

function subscriptionData() {
  return {
    type: 'graphqlSubscription',
    label: 'Sub',
    endpoint: '',
    subscriptionQuery: '',
    variables: '{',
    headers: [],
    extractionRules: [],
    outputBindings: [{ field: 'messages', variableName: '', enabled: true }],
    stopAfterMessages: 0,
  };
}

describe('GraphqlIntrospectConfigPanel', () => {
  it('renders endpoint tab errors and supports endpoint insertion/update', () => {
    const onChange = vi.fn();
    render(<GraphqlIntrospectConfigPanel data={introspectData()} onChange={onChange} />);

    expect(screen.getByText('Endpoint is required')).toBeTruthy();

    fireEvent.click(screen.getByTestId('insert-var-btn'));
    expect(onChange).toHaveBeenCalled();

    fireEvent.change(screen.getByTestId('expression-input'), { target: { value: 'https://api.example.com/graphql' } });
    expect(onChange).toHaveBeenCalled();
  });

  it('validation tab adds required field via button and Enter key', () => {
    const onChange = vi.fn();
    render(<GraphqlIntrospectConfigPanel data={introspectData()} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Schema Validation' }));

    fireEvent.change(screen.getByTestId('gql-wf-introspect-new-type'), { target: { value: 'User' } });
    fireEvent.change(screen.getByTestId('gql-wf-introspect-new-field'), { target: { value: 'id' } });
    fireEvent.click(screen.getByTestId('gql-wf-introspect-add-field-btn'));

    expect(onChange).toHaveBeenCalled();

    fireEvent.change(screen.getByTestId('gql-wf-introspect-new-type'), { target: { value: 'Order' } });
    fireEvent.change(screen.getByTestId('gql-wf-introspect-new-field'), { target: { value: 'status' } });
    fireEvent.keyDown(screen.getByTestId('gql-wf-introspect-new-field'), { key: 'Enter' });

    expect(onChange).toHaveBeenCalled();
  });

  it('validation tab updates minTypeCount/requiredTypes and removes existing required field', () => {
    const onChange = vi.fn();
    const data = {
      ...introspectData(),
      requiredFields: [{ typeName: 'User', fieldName: 'email' }],
      requiredTypes: ['User'],
      outputBindings: [{ field: 'sdl', variableName: 'schemaVar', enabled: true }],
    };
    render(<GraphqlIntrospectConfigPanel data={data} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Schema Validation' }));

    fireEvent.change(screen.getByTestId('gql-wf-introspect-min-type-count'), { target: { value: '12' } });
    fireEvent.change(screen.getByTestId('gql-wf-introspect-required-types'), { target: { value: 'User, Order' } });
    fireEvent.click(screen.getByRole('button', { name: /Remove required field User.email/i }));

    expect(onChange).toHaveBeenCalled();
    const calls = onChange.mock.calls.map((c) => c[0]);
    expect(calls.some((d: PanelPatch) => d.minTypeCount === 12)).toBe(true);
    expect(calls.some((d: PanelPatch) => Array.isArray(d.requiredTypes) && d.requiredTypes.length === 2)).toBe(true);
  });

  it('endpoint tab updates timeout and skip TLS fields', () => {
    const onChange = vi.fn();
    render(<GraphqlIntrospectConfigPanel data={introspectData()} onChange={onChange} />);

    fireEvent.change(screen.getByTestId('gql-wf-introspect-timeout-input'), { target: { value: '45000' } });
    fireEvent.click(screen.getByTestId('gql-wf-introspect-skip-tls'));

    expect(onChange).toHaveBeenCalled();
    const calls = onChange.mock.calls.map((c) => c[0]);
    expect(calls.some((d: PanelPatch) => d.timeoutMs === 45000)).toBe(true);
    expect(calls.some((d: PanelPatch) => d.skipTlsVerify === true)).toBe(true);
  });

  it('output tab delegates add binding action', () => {
    const onChange = vi.fn();
    render(<GraphqlIntrospectConfigPanel data={introspectData()} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Output' }));
    fireEvent.click(screen.getByTestId('mock-output-add'));

    expect(onChange).toHaveBeenCalled();
  });

  it('clears requiredTypes when comma list becomes empty', () => {
    const onChange = vi.fn();
    const data = {
      ...introspectData(),
      requiredTypes: ['User'],
      outputBindings: [{ field: 'sdl', variableName: 'schemaVar', enabled: true }],
    };
    render(<GraphqlIntrospectConfigPanel data={data} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Schema Validation' }));
    fireEvent.change(screen.getByTestId('gql-wf-introspect-required-types'), { target: { value: ' ,  ' } });

    const calls = onChange.mock.calls.map((c) => c[0]);
    expect(calls.some((d: PanelPatch) => d.requiredTypes === undefined)).toBe(true);
  });

  it('does not add required field when type/name inputs are blank', () => {
    const onChange = vi.fn();
    render(<GraphqlIntrospectConfigPanel data={introspectData()} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Schema Validation' }));
    fireEvent.click(screen.getByTestId('gql-wf-introspect-add-field-btn'));

    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('GraphqlSubscriptionConfigPanel', () => {
  it('renders subscription tab errors for required fields/invalid JSON', () => {
    const onChange = vi.fn();
    render(<GraphqlSubscriptionConfigPanel data={subscriptionData()} onChange={onChange} />);

    expect(screen.getByText('Endpoint is required')).toBeTruthy();
    expect(screen.getByText('Subscription query is required')).toBeTruthy();
    expect(screen.getByText('Variables must be valid JSON')).toBeTruthy();
  });

  it('stop tab updates stopAfterMessages and converts seconds to ms', () => {
    const onChange = vi.fn();
    render(<GraphqlSubscriptionConfigPanel data={subscriptionData()} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));

    fireEvent.change(screen.getByTestId('gql-wf-stop-messages-input'), { target: { value: '12' } });
    fireEvent.change(screen.getByTestId('gql-wf-stop-secs-input'), { target: { value: '7' } });

    expect(onChange).toHaveBeenCalled();
    const calls = onChange.mock.calls.map((c) => c[0]);
    expect(calls.some((d: PanelPatch) => d.stopAfterMessages === 12)).toBe(true);
    expect(calls.some((d: PanelPatch) => d.stopAfterMs === 7000)).toBe(true);
  });

  it('subscription tab updates transport/query/variables and shows variables helper', () => {
    const onChange = vi.fn();
    const data = {
      ...subscriptionData(),
      endpoint: 'https://api.example.com/graphql',
      subscriptionQuery: 'subscription { ping }',
      variables: '{}',
    };
    render(<GraphqlSubscriptionConfigPanel data={data} onChange={onChange} />);

    fireEvent.change(screen.getByTestId('gql-wf-sub-transport-select'), { target: { value: 'sse' } });
    fireEvent.change(screen.getByTestId('gql-wf-subscription-query-editor'), { target: { value: 'subscription { pong }' } });
    fireEvent.change(screen.getByTestId('gql-wf-sub-variables-editor'), { target: { value: '{"id":1}' } });

    expect(screen.getByTestId('available-vars')).toBeTruthy();
    expect(onChange).toHaveBeenCalled();
    const calls = onChange.mock.calls.map((c) => c[0]);
    expect(calls.some((d: PanelPatch) => d.subscriptionTransport === 'sse')).toBe(true);
    expect(calls.some((d: PanelPatch) => d.subscriptionQuery === 'subscription { pong }')).toBe(true);
  });

  it('stop tab clears stopAfterMs when seconds is set to zero and updates stopCondition', () => {
    const onChange = vi.fn();
    const data = {
      ...subscriptionData(),
      stopAfterMs: 3000,
      variables: '{}',
      endpoint: 'https://api.example.com/graphql',
      subscriptionQuery: 'subscription { ping }',
    };
    render(<GraphqlSubscriptionConfigPanel data={data} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
    fireEvent.change(screen.getByTestId('gql-wf-stop-secs-input'), { target: { value: '0' } });
    fireEvent.change(screen.getByTestId('expression-input'), { target: { value: '$.done' } });

    expect(onChange).toHaveBeenCalled();
    const calls = onChange.mock.calls.map((c) => c[0]);
    expect(calls.some((d: PanelPatch) => d.stopAfterMs === undefined)).toBe(true);
    expect(calls.some((d: PanelPatch) => d.stopCondition === '$.done')).toBe(true);
  });

  it('headers/extraction/output tabs delegate add actions', () => {
    const onChange = vi.fn();
    render(<GraphqlSubscriptionConfigPanel data={subscriptionData()} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Headers & Auth' }));
    fireEvent.click(screen.getByTestId('mock-headers-add'));
    fireEvent.click(screen.getByTestId('mock-headers-update'));
    fireEvent.click(screen.getByTestId('mock-auth-change'));

    fireEvent.click(screen.getByRole('button', { name: 'Extraction' }));
    fireEvent.click(screen.getByTestId('mock-extraction-add'));
    fireEvent.click(screen.getByTestId('mock-extraction-update'));

    fireEvent.click(screen.getByRole('button', { name: 'Output' }));
    fireEvent.click(screen.getByTestId('mock-output-add'));
    fireEvent.click(screen.getByTestId('mock-output-update'));

    expect(onChange).toHaveBeenCalled();
  });

  it('renders tab badges/counts when data is pre-populated', () => {
    const data = {
      ...subscriptionData(),
      endpoint: 'https://api.example.com/graphql',
      subscriptionQuery: 'subscription { ping }',
      variables: '{}',
      headers: [{ id: 'h1', key: 'x-request-id', value: '1', enabled: true }],
      extractionRules: [{ variableName: 'orderId', jsonPath: '$.id' }],
      outputBindings: [{ field: 'messages', variableName: 'msgs', enabled: true }],
    };

    render(<GraphqlSubscriptionConfigPanel data={data} onChange={vi.fn()} />);

    expect(screen.queryByTestId('gql-wf-tab-error-dot')).toBeNull();
    expect(screen.getAllByText('1').length).toBeGreaterThan(0);
  });

  it('hides invalid variables error when subscription tab has errors from other fields only', () => {
    const onChange = vi.fn();
    const data = {
      ...subscriptionData(),
      endpoint: '',
      subscriptionQuery: '',
      variables: '{}',
    };
    render(<GraphqlSubscriptionConfigPanel data={data} onChange={onChange} />);

    expect(screen.getByText('Endpoint is required')).toBeTruthy();
    expect(screen.getByText('Subscription query is required')).toBeTruthy();
    expect(screen.queryByText('Variables must be valid JSON')).toBeNull();
  });

  it('clears stop condition when expression input becomes empty', () => {
    const onChange = vi.fn();
    const data = {
      ...subscriptionData(),
      endpoint: 'https://api.example.com/graphql',
      subscriptionQuery: 'subscription { ping }',
      variables: '{}',
      stopCondition: '$.done',
    };
    render(<GraphqlSubscriptionConfigPanel data={data} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
    fireEvent.change(screen.getByTestId('expression-input'), { target: { value: '' } });

    const calls = onChange.mock.calls.map((c) => c[0]);
    expect(calls.some((d: PanelPatch) => d.stopCondition === undefined)).toBe(true);
  });
});
