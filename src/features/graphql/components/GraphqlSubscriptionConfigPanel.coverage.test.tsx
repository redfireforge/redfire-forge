/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { selectOption } from '../../../test-utils/customSelectHelper';
import GraphqlSubscriptionConfigPanel from './GraphqlSubscriptionConfigPanel';

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
      <button type="button" data-testid="mock-insert" onClick={() => onInsert('{{v}}')}>insert</button>
      {children}
    </div>
  ),
}));

vi.mock('../../workflow/components/expression/ExpressionInput', () => ({
  default: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <input data-testid="mock-expression" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

vi.mock('../../workflow/components/expression/AvailableVariables', () => ({
  default: () => <div data-testid="mock-vars" />,
}));

vi.mock('./GraphqlQueryConfigPanel', () => ({
  GqlHeadersSection: ({ onAdd }: { onAdd: () => void }) => <button type="button" data-testid="mock-headers-add" onClick={onAdd}>headers</button>,
  GqlAuthSection: ({ onChange }: { onChange: (auth: { type: string }) => void }) => <button type="button" data-testid="mock-auth-change" onClick={() => onChange({ type: 'bearer' })}>auth</button>,
  GqlExtractionSection: ({ onAdd }: { onAdd: () => void }) => <button type="button" data-testid="mock-extract-add" onClick={onAdd}>extract</button>,
  GqlOutputSection: ({ onAdd }: { onAdd: () => void }) => <button type="button" data-testid="mock-output-add" onClick={onAdd}>output</button>,
}));

vi.mock('../utils/graphqlPanelHelpers', () => ({
  computeSubscriptionTabErrors: ({ endpoint, subscriptionQuery, variables, outputBindings }: { endpoint?: string; subscriptionQuery?: string; variables?: string; outputBindings: Array<{ variableName?: string }> }) => ({
    subscription: !endpoint || !subscriptionQuery || variables === '{',
    extraction: false,
    output: outputBindings.some((b) => !b.variableName),
  }),
  hasInvalidVariablesJson: (raw?: string) => raw === '{',
}));

describe('GraphqlSubscriptionConfigPanel coverage edges', () => {
  it('handles undefined arrays and endpoint insertion path', () => {
    const onChange = vi.fn();
    render(
      <GraphqlSubscriptionConfigPanel
        data={{
          type: 'graphqlSubscription',
          label: 'S',
          endpoint: undefined,
          subscriptionQuery: undefined,
          variables: undefined,
          headers: undefined,
          extractionRules: undefined,
          outputBindings: undefined,
          stopAfterMessages: undefined,
        }}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByTestId('mock-insert'));
    selectOption(screen.getByTestId('gql-wf-sub-transport-select'), 'graphql-ws (legacy)');
    fireEvent.change(screen.getByTestId('gql-wf-subscription-query-editor'), { target: { value: 'subscription { ping }' } });
    fireEvent.change(screen.getByTestId('gql-wf-sub-variables-editor'), { target: { value: '{}' } });

    expect(screen.getByTestId('mock-vars')).toBeTruthy();
    expect(onChange).toHaveBeenCalled();
  });

  it('covers stop/headers/extraction/output tab action paths', () => {
    const onChange = vi.fn();
    render(
      <GraphqlSubscriptionConfigPanel
        data={{
          type: 'graphqlSubscription',
          label: 'S2',
          endpoint: 'https://api.example.com/graphql',
          subscriptionQuery: 'subscription { pong }',
          variables: '{}',
          headers: [],
          extractionRules: [],
          outputBindings: [{ field: 'messages', variableName: '', enabled: true }],
          stopAfterMessages: 1,
          stopAfterMs: 2000,
          stopCondition: '$.done',
        }}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
    const stopSection = screen.getByTestId('gql-wf-stop-section');
    expect(stopSection).toBeTruthy();
    expect(stopSection.querySelector('.gql-wf-stop-chip--active')?.textContent).toContain('1 message');
    expect(stopSection.textContent).toContain('2s wall time');
    expect(stopSection.querySelectorAll('.gql-wf-stop-chip--active')).toHaveLength(3);
    fireEvent.change(screen.getByTestId('gql-wf-stop-messages-input'), { target: { value: '0' } });
    fireEvent.change(screen.getByTestId('gql-wf-stop-secs-input'), { target: { value: '0' } });
    fireEvent.change(screen.getByTestId('mock-expression'), { target: { value: '' } });

    fireEvent.click(screen.getByRole('button', { name: 'Headers & Auth' }));
    fireEvent.click(screen.getByTestId('mock-headers-add'));
    fireEvent.click(screen.getByTestId('mock-auth-change'));

    fireEvent.click(screen.getByRole('button', { name: 'Extraction' }));
    fireEvent.click(screen.getByTestId('mock-extract-add'));

    fireEvent.click(screen.getByRole('button', { name: 'Output' }));
    fireEvent.click(screen.getByTestId('mock-output-add'));

    expect(onChange).toHaveBeenCalled();
  });
});
