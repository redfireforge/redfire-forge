/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import PopulateFetchStep from './PopulateFetchStep';
import type { Scenario, DataSource } from '../../../shared/types';

vi.mock('../../../engine/dataSourceExpander', () => ({
  resolveScenarioFromDataRow: vi.fn((draft) => draft),
}));

const createMockScenario = (overrides: Partial<Scenario> = {}): Scenario => ({
  id: 'test-1',
  name: 'Test Scenario',
  url: 'https://api.example.com/users',
  method: 'GET',
  headers: [],
  ...overrides,
});

const createMockDataTable = (overrides: Partial<DataSource> = {}): DataSource => ({
  columns: [],
  rows: [],
  source: { type: 'inline' },
  ...overrides,
});

describe('PopulateFetchStep', () => {
  it('renders description text', () => {
    render(
      <PopulateFetchStep
        draft={createMockScenario()}
        dataTable={createMockDataTable()}
        loading={false}
        error={null}
        lastRequest={null}
        lastResponse={null}
        onFetch={vi.fn()}
      />
    );

    expect(screen.getByText(/Send a request to this test's URL/)).toBeInTheDocument();
  });

  it('shows method badge and URL', () => {
    render(
      <PopulateFetchStep
        draft={createMockScenario({ method: 'POST', url: 'https://api.example.com/create' })}
        dataTable={createMockDataTable()}
        loading={false}
        error={null}
        lastRequest={null}
        lastResponse={null}
        onFetch={vi.fn()}
      />
    );

    expect(screen.getByText('POST')).toBeInTheDocument();
    expect(screen.getByText('https://api.example.com/create')).toBeInTheDocument();
  });

  it('shows send request button', () => {
    render(
      <PopulateFetchStep
        draft={createMockScenario()}
        dataTable={createMockDataTable()}
        loading={false}
        error={null}
        lastRequest={null}
        lastResponse={null}
        onFetch={vi.fn()}
      />
    );

    expect(screen.getByText('▶ Send Request')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    render(
      <PopulateFetchStep
        draft={createMockScenario()}
        dataTable={createMockDataTable()}
        loading={true}
        error={null}
        lastRequest={null}
        lastResponse={null}
        onFetch={vi.fn()}
      />
    );

    expect(screen.getByText('⏳ Sending…')).toBeInTheDocument();
  });

  it('disables button when loading', () => {
    render(
      <PopulateFetchStep
        draft={createMockScenario()}
        dataTable={createMockDataTable()}
        loading={true}
        error={null}
        lastRequest={null}
        lastResponse={null}
        onFetch={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: /Sending/ })).toBeDisabled();
  });

  it('calls onFetch when button clicked', () => {
    const onFetch = vi.fn();
    render(
      <PopulateFetchStep
        draft={createMockScenario()}
        dataTable={createMockDataTable()}
        loading={false}
        error={null}
        lastRequest={null}
        lastResponse={null}
        onFetch={onFetch}
      />
    );

    fireEvent.click(screen.getByText('▶ Send Request'));
    expect(onFetch).toHaveBeenCalledTimes(1);
  });

  it('displays error message', () => {
    render(
      <PopulateFetchStep
        draft={createMockScenario()}
        dataTable={createMockDataTable()}
        loading={false}
        error="Connection refused"
        lastRequest={null}
        lastResponse={null}
        onFetch={vi.fn()}
      />
    );

    expect(screen.getByText(/Connection refused/)).toBeInTheDocument();
  });

  it('shows request debug info', () => {
    render(
      <PopulateFetchStep
        draft={createMockScenario()}
        dataTable={createMockDataTable()}
        loading={false}
        error={null}
        lastRequest={{
          method: 'GET',
          url: 'https://api.example.com/users',
          headers: { Authorization: 'Bearer token' },
          body: undefined,
        }}
        lastResponse={null}
        onFetch={vi.fn()}
      />
    );

    expect(screen.getByText('Request / Response Details')).toBeInTheDocument();
    expect(screen.getByText('Request')).toBeInTheDocument();
    expect(screen.getByText(/Bearer token/)).toBeInTheDocument();
  });

  it('shows response debug info', () => {
    render(
      <PopulateFetchStep
        draft={createMockScenario()}
        dataTable={createMockDataTable()}
        loading={false}
        error={null}
        lastRequest={null}
        lastResponse={{
          status: 200,
          statusText: 'OK',
          body: '{"users": []}',
        }}
        onFetch={vi.fn()}
      />
    );

    expect(screen.getByText('Response')).toBeInTheDocument();
    expect(screen.getByText(/200 OK/)).toBeInTheDocument();
  });

  it('shows response error in debug', () => {
    render(
      <PopulateFetchStep
        draft={createMockScenario()}
        dataTable={createMockDataTable()}
        loading={false}
        error={null}
        lastRequest={null}
        lastResponse={{
          status: 0,
          statusText: 'Error',
          error: 'Network Error',
          body: '',
        }}
        onFetch={vi.fn()}
      />
    );

    expect(screen.getByText(/Network Error/)).toBeInTheDocument();
  });

  it('mentions first enabled row when data rows exist', () => {
    render(
      <PopulateFetchStep
        draft={createMockScenario()}
        dataTable={createMockDataTable({
          rows: [{ id: 'r1', values: {}, enabled: true }],
        })}
        loading={false}
        error={null}
        lastRequest={null}
        lastResponse={null}
        onFetch={vi.fn()}
      />
    );

    expect(screen.getByText(/first enabled data row/)).toBeInTheDocument();
  });
});
