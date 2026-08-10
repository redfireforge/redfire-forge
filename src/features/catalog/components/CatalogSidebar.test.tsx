/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import CatalogSidebar from './CatalogSidebar';
import { makeEntry, makeEndpoint, makeFolder, makeVersion } from './catalogTestFactories';

function defaultProps() {
  return {
    onSelectEntry: vi.fn(),
    onImport: vi.fn(),
    onReimport: vi.fn(),
    onDeleteEntry: vi.fn(),
    onVersionHistory: vi.fn(),
    onExportSpec: vi.fn(),
    onEdit: vi.fn(),
  };
}

describe('CatalogSidebar', () => {
  it('shows the empty state when no entries exist', () => {
    render(<CatalogSidebar entries={[]} {...defaultProps()} />);
    expect(screen.getByText(/No APIs imported yet/)).toBeInTheDocument();
  });

  it('fires onImport from the Import Spec button', async () => {
    const props = defaultProps();
    render(<CatalogSidebar entries={[]} {...props} />);
    await userEvent.click(screen.getByRole('button', { name: /Import Spec/ }));
    expect(props.onImport).toHaveBeenCalled();
  });

  it('fires onBatchConvertToOpenApi from the Batch Convert button when provided', async () => {
    const props = { ...defaultProps(), onBatchConvertToOpenApi: vi.fn() };
    render(<CatalogSidebar entries={[]} {...props} />);
    await userEvent.click(screen.getByRole('button', { name: /Batch Convert/ }));
    expect(props.onBatchConvertToOpenApi).toHaveBeenCalled();
  });

  it('renders entries with version, endpoint count and method dots; selects on click', async () => {
    const props = defaultProps();
    const entry = makeEntry({
      id: 'e1',
      name: 'Petstore',
      endpoints: [makeEndpoint({ id: 'g', method: 'GET' })],
      folders: [makeFolder({ endpoints: [makeEndpoint({ id: 'p', method: 'POST' })] })],
    });
    render(<CatalogSidebar entries={[entry]} selectedEntryId="e1" {...props} />);
    expect(screen.getByText('Petstore')).toBeInTheDocument();
    expect(screen.getByText('v1.0.0')).toBeInTheDocument();
    expect(screen.getByText('2 endpoints')).toBeInTheDocument();

    await userEvent.click(screen.getByText('Petstore'));
    expect(props.onSelectEntry).toHaveBeenCalledWith('e1');
  });

  it('selects an entry via keyboard (Enter)', async () => {
    const props = defaultProps();
    const entry = makeEntry({ id: 'e1', name: 'KbAPI' });
    render(<CatalogSidebar entries={[entry]} {...props} />);
    const row = screen.getByRole('button', { name: /KbAPI/ });
    row.focus();
    await userEvent.keyboard('{Enter}');
    expect(props.onSelectEntry).toHaveBeenCalledWith('e1');
  });

  it('selects an entry via keyboard (Space) and ignores other keys', async () => {
    const props = defaultProps();
    const entry = makeEntry({ id: 'e1', name: 'KbSpaceAPI' });
    render(<CatalogSidebar entries={[entry]} {...props} />);
    const row = screen.getByRole('button', { name: /KbSpaceAPI/ });
    row.focus();

    await userEvent.keyboard('{ArrowDown}');
    expect(props.onSelectEntry).not.toHaveBeenCalled();

    await userEvent.keyboard(' ');
    expect(props.onSelectEntry).toHaveBeenCalledWith('e1');
  });

  it('filters entries and shows the no-match message', async () => {
    const props = defaultProps();
    const entries = [makeEntry({ id: 'a', name: 'Alpha' }), makeEntry({ id: 'b', name: 'Beta' })];
    render(<CatalogSidebar entries={entries} {...props} />);
    const filterBox = screen.getByPlaceholderText('Filter APIs...');
    await userEvent.type(filterBox, 'alph');
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.queryByText('Beta')).not.toBeInTheDocument();

    await userEvent.clear(filterBox);
    await userEvent.type(filterBox, 'zzz');
    expect(screen.getByText(/No APIs match/)).toBeInTheDocument();
  });

  it('opens the context menu and invokes each action', async () => {
    const props = defaultProps();
    const entry = makeEntry({ id: 'e1', name: 'CtxAPI', versions: [makeVersion(), makeVersion({ id: 'v2', version: '2.0.0' })] });
    render(<CatalogSidebar entries={[entry]} {...props} />);

    const row = screen.getByText('CtxAPI');
    await userEvent.pointer({ keys: '[MouseRight]', target: row });

    expect(screen.getByText(/v1.0.0 \(current\)/)).toBeInTheDocument();

    await userEvent.click(screen.getByText('Edit'));
    expect(props.onEdit).toHaveBeenCalledWith('e1');

    await userEvent.pointer({ keys: '[MouseRight]', target: screen.getByText('CtxAPI') });
    await userEvent.click(screen.getByText('Re-import / Update'));
    expect(props.onReimport).toHaveBeenCalledWith('e1');

    await userEvent.pointer({ keys: '[MouseRight]', target: screen.getByText('CtxAPI') });
    await userEvent.click(screen.getByText('Version History'));
    expect(props.onVersionHistory).toHaveBeenCalledWith('e1');

    await userEvent.pointer({ keys: '[MouseRight]', target: screen.getByText('CtxAPI') });
    await userEvent.click(screen.getByText('Export Original Spec'));
    expect(props.onExportSpec).toHaveBeenCalledWith('e1');

    await userEvent.pointer({ keys: '[MouseRight]', target: screen.getByText('CtxAPI') });
    await userEvent.click(screen.getByText('Delete'));
    expect(props.onDeleteEntry).toHaveBeenCalledWith('e1');
  });

  it('omits optional context-menu items when their callbacks are not provided', async () => {
    const entry = makeEntry({ id: 'e1', name: 'MinAPI' });
    render(
      <CatalogSidebar
        entries={[entry]}
        onSelectEntry={vi.fn()}
        onImport={vi.fn()}
        onReimport={vi.fn()}
        onDeleteEntry={vi.fn()}
        onVersionHistory={vi.fn()}
      />,
    );
    await userEvent.pointer({ keys: '[MouseRight]', target: screen.getByText('MinAPI') });
    expect(screen.queryByText('Edit')).not.toBeInTheDocument();
    expect(screen.queryByText('Export Original Spec')).not.toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('renders and triggers Convert / Upgrade action when onConvertToOpenApi is provided', async () => {
    const props = { ...defaultProps(), onConvertToOpenApi: vi.fn() };
    const entry = makeEntry({ id: 'e1', name: 'ConvertableAPI' });
    render(<CatalogSidebar entries={[entry]} {...props} />);

    await userEvent.pointer({ keys: '[MouseRight]', target: screen.getByText('ConvertableAPI') });
    await userEvent.click(screen.getByTestId('catalog-ctx-convert'));
    expect(props.onConvertToOpenApi).toHaveBeenCalledWith('e1');
  });

  it('handles stale context menu entry ids by rendering no menu items', async () => {
    const props = defaultProps();
    const entry = makeEntry({ id: 'e1', name: 'StaleEntryAPI' });
    const { rerender } = render(<CatalogSidebar entries={[entry]} {...props} />);

    await userEvent.pointer({ keys: '[MouseRight]', target: screen.getByText('StaleEntryAPI') });
    rerender(<CatalogSidebar entries={[]} {...props} />);

    expect(screen.getByTestId('catalog-ctx-menu')).toBeInTheDocument();
    expect(screen.queryByText('Delete')).not.toBeInTheDocument();
    expect(screen.queryByText('Version History')).not.toBeInTheDocument();
  });
});
