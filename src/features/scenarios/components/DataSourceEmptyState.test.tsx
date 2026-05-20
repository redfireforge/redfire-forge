/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import DataSourceEmptyState from './DataSourceEmptyState';
import { Scenario } from '../../../shared/types';

// Mock the DataSourceSetupModal — expose apply for parameterize / configure branches
vi.mock('./DataSourceSetupModal', () => ({
  default: function MockDataSourceSetupModal({
    onApply,
    onClose,
    mode,
    test,
  }: {
    onApply: (...args: unknown[]) => void;
    onClose: () => void;
    mode?: string;
    test: { id: string; name: string; url: string; headers: { key: string; value: string }[] };
  }) {
    return (
      <div data-testid="setup-modal">
        <span data-testid="setup-modal-mode">{mode}</span>
        <button type="button" data-testid="setup-modal-close" onClick={onClose}>
          Close setup
        </button>
        <button
          type="button"
          data-testid="setup-modal-apply-parameterize"
          onClick={() =>
            onApply(
              { id: 'tbl', columns: [], rows: [], source: { type: 'inline' as const } },
              'https://api.example.com/{{id}}',
              { copyName: 'Param Copy', targetFgId: 'fg-1', targetScenarioId: 'sc-1' },
            )
          }
        >
          Apply Parameterize
        </button>
        <button
          type="button"
          data-testid="setup-modal-apply-parameterize-default-name"
          onClick={() =>
            onApply(
              { id: 'tbl', columns: [], rows: [], source: { type: 'inline' as const } },
              'https://api.example.com/{{id}}',
              { targetFgId: 'fg-1', targetScenarioId: 'sc-1' },
            )
          }
        >
          Apply Param Default Name
        </button>
        <button
          type="button"
          data-testid="setup-modal-apply-configure"
          onClick={() =>
            onApply(
              { id: 'tbl2', columns: [], rows: [], source: { type: 'inline' as const } },
              test.url,
              { auth: { type: 'none' as const } },
            )
          }
        >
          Apply Configure
        </button>
      </div>
    );
  },
}));

function createMockDraft(): Scenario {
  return {
    id: 'test-1',
    name: 'Test Scenario',
    url: 'https://api.example.com/users/{{id}}',
    method: 'GET',
    headers: [{ key: 'X-Test', value: '1' }],
    body: '',
    bodyType: 'none',
    auth: { type: 'none' },
    validation: {
      mode: 'none',
      expectedFields: [{ jsonPath: '$.id', expectedValue: '' }],
    },
  };
}

describe('DataSourceEmptyState', () => {
  it('renders data source empty state', () => {
    render(
      <DataSourceEmptyState
        draft={createMockDraft()}
        onDraftChange={vi.fn()}
        showSetupModal={false}
        setShowSetupModal={vi.fn()}
        handleSetupApply={vi.fn()}
      />
    );
    expect(screen.getByText(/No data source attached/)).toBeInTheDocument();
  });

  it('renders Quick Setup button', () => {
    render(
      <DataSourceEmptyState
        draft={createMockDraft()}
        onDraftChange={vi.fn()}
        showSetupModal={false}
        setShowSetupModal={vi.fn()}
        handleSetupApply={vi.fn()}
      />
    );
    expect(screen.getByText('⚡ Quick Setup')).toBeInTheDocument();
  });

  it('renders Configure Wizard button', () => {
    render(
      <DataSourceEmptyState
        draft={createMockDraft()}
        onDraftChange={vi.fn()}
        showSetupModal={false}
        setShowSetupModal={vi.fn()}
        handleSetupApply={vi.fn()}
      />
    );
    expect(screen.getByText('Configure Wizard')).toBeInTheDocument();
  });

  it('opens setup modal when Configure Wizard is clicked', () => {
    const setShowSetupModal = vi.fn();
    render(
      <DataSourceEmptyState
        draft={createMockDraft()}
        onDraftChange={vi.fn()}
        showSetupModal={false}
        setShowSetupModal={setShowSetupModal}
        handleSetupApply={vi.fn()}
      />
    );
    fireEvent.click(screen.getByText('Configure Wizard'));
    expect(setShowSetupModal).toHaveBeenCalledWith(true);
  });

  it('renders parameterize mode when onCreateParameterizedCopy is provided', () => {
    render(
      <DataSourceEmptyState
        draft={createMockDraft()}
        onDraftChange={vi.fn()}
        onCreateParameterizedCopy={vi.fn()}
        showSetupModal={false}
        setShowSetupModal={vi.fn()}
        handleSetupApply={vi.fn()}
      />
    );
    expect(screen.getByText('Parameterize This Test')).toBeInTheDocument();
  });

  it('shows Create Parameterized Copy button in parameterize mode', () => {
    render(
      <DataSourceEmptyState
        draft={createMockDraft()}
        onDraftChange={vi.fn()}
        onCreateParameterizedCopy={vi.fn()}
        showSetupModal={false}
        setShowSetupModal={vi.fn()}
        handleSetupApply={vi.fn()}
      />
    );
    expect(screen.getByText('📋 Create Parameterized Copy')).toBeInTheDocument();
  });

  it('shows setup modal when showSetupModal is true', () => {
    render(
      <DataSourceEmptyState
        draft={createMockDraft()}
        onDraftChange={vi.fn()}
        showSetupModal={true}
        setShowSetupModal={vi.fn()}
        handleSetupApply={vi.fn()}
      />
    );
    expect(screen.getByTestId('setup-modal')).toBeInTheDocument();
  });

  it('calls onDraftChange with dataSource when Quick Setup creates columns from URL', () => {
    const onDraftChange = vi.fn();
    const draft = createMockDraft();
    render(
      <DataSourceEmptyState
        draft={draft}
        onDraftChange={onDraftChange}
        showSetupModal={false}
        setShowSetupModal={vi.fn()}
        handleSetupApply={vi.fn()}
      />
    );
    fireEvent.click(screen.getByText('⚡ Quick Setup'));
    // Should detect {{id}} in the URL and create a dataSource
    expect(onDraftChange).toHaveBeenCalled();
  });

  it('opens setup wizard when Quick Setup finds no templated columns', () => {
    const setShowSetupModal = vi.fn();
    const onDraftChange = vi.fn();
    const draft = { ...createMockDraft(), url: 'https://api.example.com/plain' };
    render(
      <DataSourceEmptyState
        draft={draft}
        onDraftChange={onDraftChange}
        showSetupModal={false}
        setShowSetupModal={setShowSetupModal}
        handleSetupApply={vi.fn()}
      />
    );
    fireEvent.click(screen.getByText('⚡ Quick Setup'));
    expect(setShowSetupModal).toHaveBeenCalledWith(true);
    expect(onDraftChange).not.toHaveBeenCalled();
  });

  it('opens setup modal from parameterize empty state', () => {
    const setShowSetupModal = vi.fn();
    render(
      <DataSourceEmptyState
        draft={createMockDraft()}
        onDraftChange={vi.fn()}
        onCreateParameterizedCopy={vi.fn()}
        showSetupModal={false}
        setShowSetupModal={setShowSetupModal}
        handleSetupApply={vi.fn()}
      />
    );
    fireEvent.click(screen.getByText('📋 Create Parameterized Copy'));
    expect(setShowSetupModal).toHaveBeenCalledWith(true);
  });

  it('parameterize apply creates copy with new id and calls onCreateParameterizedCopy', () => {
    const onCreate = vi.fn();
    render(
      <DataSourceEmptyState
        draft={createMockDraft()}
        onDraftChange={vi.fn()}
        onCreateParameterizedCopy={onCreate}
        showSetupModal
        setShowSetupModal={vi.fn()}
        handleSetupApply={vi.fn()}
      />,
    );
    expect(screen.getByTestId('setup-modal-mode')).toHaveTextContent('parameterize');
    fireEvent.click(screen.getByTestId('setup-modal-apply-parameterize'));
    expect(onCreate).toHaveBeenCalled();
    const copy = onCreate.mock.calls[0][0];
    expect(copy.id).not.toBe('test-1');
    expect(copy.name).toBe('Param Copy');
    expect(copy.sourceTestId).toBe('test-1');
    expect(copy.dataSource).toBeDefined();
    expect(onCreate).toHaveBeenCalledWith(expect.any(Object), 'fg-1', 'sc-1');
  });

  it('configure apply uses handleSetupApply when not parameterizing', () => {
    const handleSetupApply = vi.fn();
    const draft = createMockDraft();
    render(
      <DataSourceEmptyState
        draft={draft}
        onDraftChange={vi.fn()}
        showSetupModal
        setShowSetupModal={vi.fn()}
        handleSetupApply={handleSetupApply}
      />,
    );
    expect(screen.getByTestId('setup-modal-mode')).toHaveTextContent('configure');
    fireEvent.click(screen.getByTestId('setup-modal-apply-configure'));
    expect(handleSetupApply).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'tbl2' }),
      draft.url,
      { auth: { type: 'none' } },
    );
  });

  it('closes setup modal when DataSourceSetupModal calls onClose', () => {
    const setShowSetupModal = vi.fn();
    render(
      <DataSourceEmptyState
        draft={createMockDraft()}
        onDraftChange={vi.fn()}
        showSetupModal
        setShowSetupModal={setShowSetupModal}
        handleSetupApply={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('setup-modal-close'));
    expect(setShowSetupModal).toHaveBeenCalledWith(false);
  });

  it('parameterize apply uses draft name when copyName is omitted', () => {
    const onCreate = vi.fn();
    render(
      <DataSourceEmptyState
        draft={createMockDraft()}
        onDraftChange={vi.fn()}
        onCreateParameterizedCopy={onCreate}
        showSetupModal
        setShowSetupModal={vi.fn()}
        handleSetupApply={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('setup-modal-apply-parameterize-default-name'));
    expect(onCreate).toHaveBeenCalled();
    const copy = onCreate.mock.calls[0][0] as Scenario;
    expect(copy.name).toBe('Test Scenario (Parameterized)');
  });
});
