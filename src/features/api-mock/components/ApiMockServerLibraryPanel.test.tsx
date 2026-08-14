/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ApiMockServerLibraryPanel } from './ApiMockServerLibraryPanel';
import { ApiMockServerLibraryModal } from './ApiMockServerLibraryModal';
import { DEFAULT_SETTINGS } from '../../../shared/api-mock/defaults';
import type { ApiMockLibraryEntry } from '../apiMockServerLibrary';
import type { ApiMockServerDefinitionV1 } from '../../../shared/api-mock/contracts';

function makeEntry(id: string, name: string, open: boolean, port = 4600): ApiMockLibraryEntry {
  const server: ApiMockServerDefinitionV1 = {
    id,
    name,
    enabled: true,
    host: '127.0.0.1',
    port,
    basePath: '',
    folders: [],
    routes: [],
    samples: [],
    variables: [],
    settings: { ...DEFAULT_SETTINGS },
    createdAt: '2026-08-13T00:00:00.000Z',
    updatedAt: '2026-08-13T00:00:00.000Z',
  };
  return { server, open, ruleCount: 2, exampleCount: 1 };
}

const ENTRIES = [makeEntry('srv-open', 'Orders API', true, 4600), makeEntry('srv-parked', 'Users API', false, 4601)];

function renderPanel(overrides: Partial<React.ComponentProps<typeof ApiMockServerLibraryPanel>> = {}) {
  const props = {
    entries: ENTRIES,
    activeServerId: 'srv-open',
    atTabLimit: false,
    onOpen: vi.fn(),
    onDelete: vi.fn(),
    ...overrides,
  };
  render(<div className="api-mock-root"><ApiMockServerLibraryPanel {...props} /></div>);
  return props;
}

describe('ApiMockServerLibraryPanel', () => {
  it('marks the current tab, labels parked rows, and reports counts', () => {
    renderPanel();
    expect(screen.getByTestId('api-mock-library-open-badge-srv-open')).toHaveTextContent('Current tab');
    expect(screen.queryByTestId('api-mock-library-open-badge-srv-parked')).toBeNull();
    expect(screen.getByTestId('api-mock-library-open-srv-open')).toHaveTextContent('Go to tab');
    expect(screen.getByTestId('api-mock-library-open-srv-parked')).toHaveTextContent('Open');
    expect(screen.getByTestId('api-mock-library-count')).toHaveTextContent('2 of 2 saved · 1 closed');
    expect(screen.getByTestId('api-mock-library-row-srv-parked')).toHaveTextContent('2 rules · 1 example');
  });

  it('labels an open-but-inactive row without the current-tab badge text', () => {
    renderPanel({ activeServerId: 'srv-parked' });
    expect(screen.getByTestId('api-mock-library-open-badge-srv-open')).toHaveTextContent('Open');
  });

  it('filters rows by search and explains an empty result', () => {
    renderPanel();
    fireEvent.change(screen.getByTestId('api-mock-library-search'), { target: { value: 'users' } });
    expect(screen.queryByTestId('api-mock-library-row-srv-open')).toBeNull();
    expect(screen.getByTestId('api-mock-library-row-srv-parked')).toBeTruthy();

    fireEvent.change(screen.getByTestId('api-mock-library-search'), { target: { value: 'zzz' } });
    expect(screen.getByTestId('api-mock-library-empty')).toHaveTextContent('No saved mock server matches this search.');
  });

  it('invites the first server when the library is empty', () => {
    renderPanel({ entries: [] });
    expect(screen.getByTestId('api-mock-library-empty')).toHaveTextContent('No saved mock servers yet.');
    expect(screen.queryByTestId('api-mock-library-list')).toBeNull();
  });

  it('raises open, delete, and create', () => {
    const onCreate = vi.fn();
    const props = renderPanel({ onCreate });
    fireEvent.click(screen.getByTestId('api-mock-library-open-srv-parked'));
    fireEvent.click(screen.getByTestId('api-mock-library-delete-srv-open'));
    fireEvent.click(screen.getByTestId('api-mock-library-create'));
    expect(props.onOpen).toHaveBeenCalledWith('srv-parked');
    expect(props.onDelete).toHaveBeenCalledWith('srv-open');
    expect(onCreate).toHaveBeenCalled();
  });

  it('omits the create button when the caller supplies no handler', () => {
    renderPanel();
    expect(screen.queryByTestId('api-mock-library-create')).toBeNull();
  });

  it('blocks opening a parked server at the tab ceiling but still allows switching tabs', () => {
    renderPanel({ atTabLimit: true });
    expect(screen.getByTestId('api-mock-library-open-srv-parked')).toBeDisabled();
    expect(screen.getByTestId('api-mock-library-open-srv-open')).not.toBeDisabled();
  });
});

describe('ApiMockServerLibraryModal', () => {
  it('renders the panel in a dialog and closes from the footer', () => {
    const onClose = vi.fn();
    render(
      <ApiMockServerLibraryModal
        entries={ENTRIES}
        activeServerId="srv-open"
        atTabLimit={false}
        onOpen={vi.fn()}
        onDelete={vi.fn()}
        onCreate={vi.fn()}
        onClose={onClose}
      />,
    );
    expect(screen.getByTestId('api-mock-library-modal')).toBeTruthy();
    expect(screen.getByTestId('api-mock-library')).toBeTruthy();
    fireEvent.click(screen.getByTestId('api-mock-library-close'));
    expect(onClose).toHaveBeenCalled();
  });
});
