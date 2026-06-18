/**
 * @vitest-environment jsdom
 * GqlRightPane.test.tsx — unit tests for the Response/Schema right panel.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GqlRightPane } from './GqlRightPane';
import type { GraphqlSchemaInfo, GraphqlTypeNode } from '../../../shared/types/graphql';

vi.mock('../utils/monacoGraphqlSetup', () => ({
  buildModelUri: (id: string) => `inmemory://graphql/${id}`,
  buildVarsModelUri: (id: string) => `inmemory://graphql/vars/${id}`,
  extractOperations: vi.fn(() => []),
  deriveTabLabel: vi.fn(() => 'Untitled'),
  deriveOperationType: vi.fn(() => undefined),
  registerGraphqlLanguage: vi.fn(),
  getOrInitGraphqlMode: vi.fn(),
}));

function makeSchemaInfo(overrides: Partial<GraphqlSchemaInfo> = {}): GraphqlSchemaInfo {
  const type: GraphqlTypeNode = {
    name: 'Query',
    kind: 'OBJECT',
    fields: [{ name: 'user', type: 'User!' }],
  };
  return {
    sdl: 'type Query { user: User! }',
    types: [type],
    queryType: 'Query',
    fetchedAt: Date.now(),
    ...overrides,
  };
}

const baseProps = {
  view: 'response' as const,
  onViewChange: vi.fn(),
  response: null,
  executing: false,
  execStatus: 'idle' as const,
  schemaInfo: null,
  schemaStatus: 'idle' as const,
  schemaErrorMessage: null,
  onIntrospect: vi.fn(),
  introspecting: false,
};

describe('GqlRightPane', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders the right pane container', () => {
    render(<GqlRightPane {...baseProps} />);
    expect(screen.getByTestId('gql-right-pane')).toBeTruthy();
  });

  it('renders Response tab as active when view=response', () => {
    render(<GqlRightPane {...baseProps} />);
    expect(screen.getByTestId('gql-right-tab-response').getAttribute('aria-selected')).toBe('true');
  });

  it('renders Schema tab as inactive when view=response', () => {
    render(<GqlRightPane {...baseProps} />);
    expect(screen.getByTestId('gql-right-tab-schema').getAttribute('aria-selected')).toBe('false');
  });

  it('renders Schema tab as active when view=schema', () => {
    render(<GqlRightPane {...baseProps} view="schema" />);
    expect(screen.getByTestId('gql-right-tab-schema').getAttribute('aria-selected')).toBe('true');
  });

  it('calls onViewChange with "schema" when Schema tab clicked', () => {
    render(<GqlRightPane {...baseProps} />);
    fireEvent.click(screen.getByTestId('gql-right-tab-schema'));
    expect(baseProps.onViewChange).toHaveBeenCalledWith('schema');
  });

  it('calls onViewChange with "response" when Response tab clicked', () => {
    render(<GqlRightPane {...baseProps} view="schema" />);
    fireEvent.click(screen.getByTestId('gql-right-tab-response'));
    expect(baseProps.onViewChange).toHaveBeenCalledWith('response');
  });

  it('shows empty response state when no response', () => {
    render(<GqlRightPane {...baseProps} />);
    expect(screen.getByTestId('gql-response-empty')).toBeTruthy();
  });

  it('shows loading state when executing=true', () => {
    render(<GqlRightPane {...baseProps} executing />);
    expect(screen.getByTestId('gql-response-loading')).toBeTruthy();
  });

  it('shows schema idle state when view=schema and schemaStatus=idle', () => {
    render(<GqlRightPane {...baseProps} view="schema" />);
    expect(screen.getByTestId('gql-se-empty-idle')).toBeTruthy();
  });

  it('shows schema loading state when view=schema and schemaStatus=loading', () => {
    render(<GqlRightPane {...baseProps} view="schema" schemaStatus="loading" />);
    expect(screen.getByTestId('gql-se-loading')).toBeTruthy();
  });

  it('shows schema error state when view=schema and schemaStatus=error', () => {
    render(<GqlRightPane {...baseProps} view="schema" schemaStatus="error" schemaErrorMessage="Connection refused" />);
    expect(screen.getByTestId('gql-se-error')).toBeTruthy();
  });

  it('shows introspection disabled state when schemaStatus=introspection-disabled', () => {
    render(<GqlRightPane {...baseProps} view="schema" schemaStatus="introspection-disabled" />);
    expect(screen.getByTestId('gql-se-introspection-disabled')).toBeTruthy();
  });

  it('shows ok badge on Response tab after successful execution', () => {
    render(<GqlRightPane {...baseProps} execStatus="success" />);
    const responseTab = screen.getByTestId('gql-right-tab-response');
    expect(responseTab.querySelector('.gql-right-tab-badge--ok')).toBeTruthy();
  });

  it('shows error badge on Response tab after execution error', () => {
    render(<GqlRightPane {...baseProps} execStatus="error" />);
    const responseTab = screen.getByTestId('gql-right-tab-response');
    expect(responseTab.querySelector('.gql-right-tab-badge--error')).toBeTruthy();
  });

  it('shows ok badge on Schema tab when schemaStatus=loaded', () => {
    render(<GqlRightPane {...baseProps} schemaStatus="loaded" schemaInfo={makeSchemaInfo()} />);
    const schemaTab = screen.getByTestId('gql-right-tab-schema');
    expect(schemaTab.querySelector('.gql-right-tab-badge--ok')).toBeTruthy();
  });

  it('shows error badge on Schema tab when schemaStatus=error', () => {
    render(<GqlRightPane {...baseProps} schemaStatus="error" />);
    const schemaTab = screen.getByTestId('gql-right-tab-schema');
    expect(schemaTab.querySelector('.gql-right-tab-badge--error')).toBeTruthy();
  });
});
