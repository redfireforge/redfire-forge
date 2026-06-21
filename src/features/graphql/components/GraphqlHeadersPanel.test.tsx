/**
 * @vitest-environment jsdom
 * GraphqlHeadersPanel.test.tsx — unit tests for the headers panel.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GraphqlHeadersPanel } from './GraphqlHeadersPanel';
import type { GraphqlHeaderRow, GraphqlEnvironment } from '../../../shared/types/graphql';

function makeHeader(id: string, overrides: Partial<GraphqlHeaderRow> = {}): GraphqlHeaderRow {
  return { id, key: 'Authorization', value: 'Bearer token', enabled: true, ...overrides };
}

function makeEnv(vars: Record<string, string>): GraphqlEnvironment {
  return {
    id: 'env-1',
    name: 'Test',
    variables: Object.entries(vars).map(([key, value]) => ({ key, value, enabled: true })),
    isActive: true,
    createdAt: 0,
    updatedAt: 0,
  };
}

describe('GraphqlHeadersPanel', () => {
  const onChange = vi.fn();

  beforeEach(() => vi.clearAllMocks());

  it('renders empty state when no headers', () => {
    render(<GraphqlHeadersPanel headers={[]} onChange={onChange} />);
    expect(screen.getByTestId('gql-headers-empty')).toBeTruthy();
  });

  it('renders header rows', () => {
    const headers = [makeHeader('h1'), makeHeader('h2', { key: 'X-Api-Key' })];
    render(<GraphqlHeadersPanel headers={headers} onChange={onChange} />);
    expect(screen.getByTestId('gql-header-row-h1')).toBeTruthy();
    expect(screen.getByTestId('gql-header-row-h2')).toBeTruthy();
  });

  it('renders add button', () => {
    render(<GraphqlHeadersPanel headers={[]} onChange={onChange} />);
    expect(screen.getByTestId('gql-headers-add-btn')).toBeTruthy();
  });

  it('calls onChange with new header when Add is clicked', () => {
    render(<GraphqlHeadersPanel headers={[]} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('gql-headers-add-btn'));
    expect(onChange).toHaveBeenCalledTimes(1);
    const newHeaders = onChange.mock.calls[0][0] as GraphqlHeaderRow[];
    expect(newHeaders).toHaveLength(1);
    expect(newHeaders[0].key).toBe('');
    expect(newHeaders[0].enabled).toBe(true);
  });

  it('calls onChange when key input changes', () => {
    const headers = [makeHeader('h1')];
    render(<GraphqlHeadersPanel headers={headers} onChange={onChange} />);
    fireEvent.change(screen.getByTestId('gql-header-key-h1'), { target: { value: 'X-Custom' } });
    expect(onChange).toHaveBeenCalled();
    const updated = onChange.mock.calls[0][0] as GraphqlHeaderRow[];
    expect(updated[0].key).toBe('X-Custom');
  });

  it('calls onChange when value input changes', () => {
    const headers = [makeHeader('h1')];
    render(<GraphqlHeadersPanel headers={headers} onChange={onChange} />);
    fireEvent.change(screen.getByTestId('gql-header-value-h1'), { target: { value: 'new-value' } });
    expect(onChange).toHaveBeenCalled();
    const updated = onChange.mock.calls[0][0] as GraphqlHeaderRow[];
    expect(updated[0].value).toBe('new-value');
  });

  it('calls onChange with header removed when remove button clicked', () => {
    const headers = [makeHeader('h1'), makeHeader('h2')];
    render(<GraphqlHeadersPanel headers={headers} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('gql-header-remove-h1'));
    expect(onChange).toHaveBeenCalled();
    const updated = onChange.mock.calls[0][0] as GraphqlHeaderRow[];
    expect(updated).toHaveLength(1);
    expect(updated[0].id).toBe('h2');
  });

  it('toggles header enabled state via checkbox', () => {
    const headers = [makeHeader('h1', { enabled: true })];
    render(<GraphqlHeadersPanel headers={headers} onChange={onChange} />);
    const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
    fireEvent.click(checkbox);
    expect(onChange).toHaveBeenCalled();
    const updated = onChange.mock.calls[0][0] as GraphqlHeaderRow[];
    expect(updated[0].enabled).toBe(false);
  });

  it('shows unresolved warning icon for {{var}} that is not in active env', () => {
    const headers = [makeHeader('h1', { value: 'Bearer {{missing_token}}', enabled: true })];
    const env = makeEnv({});
    render(<GraphqlHeadersPanel headers={headers} onChange={onChange} activeEnvironment={env} />);
    expect(screen.getByTestId('gql-header-unresolved-h1')).toBeTruthy();
  });

  it('does not show unresolved warning when var is in active env', () => {
    const headers = [makeHeader('h1', { value: 'Bearer {{token}}', enabled: true })];
    const env = makeEnv({ token: 'secret' });
    render(<GraphqlHeadersPanel headers={headers} onChange={onChange} activeEnvironment={env} />);
    expect(screen.queryByTestId('gql-header-unresolved-h1')).toBeNull();
  });

  it('does not show unresolved warning for disabled headers', () => {
    const headers = [makeHeader('h1', { value: 'Bearer {{token}}', enabled: false })];
    const env = makeEnv({});
    render(<GraphqlHeadersPanel headers={headers} onChange={onChange} activeEnvironment={env} />);
    expect(screen.queryByTestId('gql-header-unresolved-h1')).toBeNull();
  });

  it('does not show unresolved warning when var is in globalEnvMap', () => {
    const headers = [makeHeader('h1', { value: 'Bearer {{envName}}', enabled: true })];
    render(
      <GraphqlHeadersPanel
        headers={headers}
        onChange={onChange}
        globalEnvMap={{ envName: 'staging' }}
      />,
    );
    expect(screen.queryByTestId('gql-header-unresolved-h1')).toBeNull();
  });

  it('disables all controls when disabled prop is true', () => {
    const headers = [makeHeader('h1')];
    render(<GraphqlHeadersPanel headers={headers} onChange={onChange} disabled />);
    const addBtn = screen.getByTestId('gql-headers-add-btn') as HTMLButtonElement;
    expect(addBtn.disabled).toBe(true);
  });
});
