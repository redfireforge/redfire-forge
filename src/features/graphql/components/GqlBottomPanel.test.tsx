/**
 * @vitest-environment jsdom
 * GqlBottomPanel.test.tsx — unit tests for the Variables/Headers bottom panel.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GqlBottomPanel } from './GqlBottomPanel';
import type { GraphqlHeaderRow } from '../../../shared/types/graphql';

vi.mock('../utils/monacoGraphqlSetup', () => ({
  buildModelUri: (id: string) => `inmemory://graphql/${id}`,
  buildVarsModelUri: (id: string) => `inmemory://graphql/vars/${id}`,
  extractOperations: vi.fn(() => []),
  deriveTabLabel: vi.fn(() => 'Untitled'),
  deriveOperationType: vi.fn(() => undefined),
  registerGraphqlLanguage: vi.fn(),
  getOrInitGraphqlMode: vi.fn(),
}));

// GraphqlVariablesPanel uses Monaco editor — mock it so DOM tests don't load Monaco.
vi.mock('./GraphqlVariablesPanel', () => ({
  GraphqlVariablesPanel: ({ onChange, defaultValue }: { onChange: (v: string) => void; defaultValue: string }) => (
    <textarea
      data-testid="gql-vars-editor"
      defaultValue={defaultValue}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

function makeHeader(id: string): GraphqlHeaderRow {
  return { id, key: 'X-Custom', value: 'test', enabled: true };
}

describe('GqlBottomPanel', () => {
  const baseProps = {
    activeTab: 'variables' as const,
    onTabChange: vi.fn(),
    varsModelPath: 'inmemory://graphql/vars/t1',
    defaultVarsValue: '{\n  \n}',
    onVariablesChange: vi.fn(),
    varsError: null,
    headers: [],
    onHeadersChange: vi.fn(),
  };

  beforeEach(() => vi.clearAllMocks());

  it('renders Variables tab as active', () => {
    render(<GqlBottomPanel {...baseProps} />);
    const tab = screen.getByTestId('gql-bottom-tab-variables');
    expect(tab.getAttribute('aria-selected')).toBe('true');
  });

  it('renders Headers tab as inactive by default', () => {
    render(<GqlBottomPanel {...baseProps} />);
    expect(screen.getByTestId('gql-bottom-tab-headers').getAttribute('aria-selected')).toBe('false');
  });

  it('calls onTabChange when Headers tab is clicked', () => {
    render(<GqlBottomPanel {...baseProps} />);
    fireEvent.click(screen.getByTestId('gql-bottom-tab-headers'));
    expect(baseProps.onTabChange).toHaveBeenCalledWith('headers');
  });

  it('calls onTabChange when Variables tab is clicked', () => {
    const props = { ...baseProps, activeTab: 'headers' as const };
    render(<GqlBottomPanel {...props} />);
    fireEvent.click(screen.getByTestId('gql-bottom-tab-variables'));
    expect(props.onTabChange).toHaveBeenCalledWith('variables');
  });

  it('shows Variables editor when activeTab is variables', () => {
    render(<GqlBottomPanel {...baseProps} />);
    expect(screen.getByTestId('gql-vars-editor')).toBeTruthy();
  });

  it('does not show Variables editor when activeTab is headers', () => {
    render(<GqlBottomPanel {...baseProps} activeTab="headers" />);
    expect(screen.queryByTestId('gql-vars-editor')).toBeNull();
  });

  it('shows GraphqlHeadersPanel when activeTab is headers', () => {
    render(<GqlBottomPanel {...baseProps} activeTab="headers" />);
    expect(screen.getByTestId('gql-headers-panel')).toBeTruthy();
  });

  it('shows error banner when varsError is set', () => {
    render(<GqlBottomPanel {...baseProps} varsError="Invalid JSON" />);
    expect(screen.getByTestId('gql-vars-error-banner')).toBeTruthy();
  });

  it('does not show error banner when varsError is null', () => {
    render(<GqlBottomPanel {...baseProps} />);
    expect(screen.queryByTestId('gql-vars-error-banner')).toBeNull();
  });

  it('shows error dot on Variables tab when varsError is set', () => {
    render(<GqlBottomPanel {...baseProps} varsError="Bad JSON" />);
    const varsTab = screen.getByTestId('gql-bottom-tab-variables');
    expect(varsTab.querySelector('.gql-bottom-tab-error-dot')).toBeTruthy();
  });

  it('shows active header count badge on Headers tab', () => {
    const headers = [makeHeader('h1'), makeHeader('h2'), { ...makeHeader('h3'), enabled: false }];
    render(<GqlBottomPanel {...baseProps} headers={headers} />);
    const headersTab = screen.getByTestId('gql-bottom-tab-headers');
    expect(headersTab.textContent).toContain('2');
  });

  it('does not show badge when no active headers', () => {
    render(<GqlBottomPanel {...baseProps} headers={[]} />);
    const headersTab = screen.getByTestId('gql-bottom-tab-headers');
    expect(headersTab.querySelector('.gql-bottom-tab-badge')).toBeNull();
  });

  it('calls onVariablesChange when Variables editor fires onChange', () => {
    render(<GqlBottomPanel {...baseProps} />);
    fireEvent.change(screen.getByTestId('gql-vars-editor'), { target: { value: '{"key":"value"}' } });
    expect(baseProps.onVariablesChange).toHaveBeenCalledWith('{"key":"value"}');
  });
});
