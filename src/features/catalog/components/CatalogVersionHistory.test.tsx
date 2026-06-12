/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import CatalogVersionHistory from './CatalogVersionHistory';
import { makeEntry, makeVersion } from './catalogTestFactories';

vi.mock('../../../shared/components/FullPanelModal', () => ({
  default: ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div data-testid="full-panel-modal">
      <div data-testid="modal-title">{title}</div>
      <div data-testid="modal-body">{children}</div>
    </div>
  ),
}));

const parseOpenApiSpec = vi.fn();
vi.mock('../utils/openApiParser', () => ({
  parseOpenApiSpec: (raw: string) => parseOpenApiSpec(raw),
}));

const diffCatalogEntries = vi.fn();
vi.mock('../utils/catalogSpecDiff', () => ({
  diffCatalogEntries: (...args: unknown[]) => diffCatalogEntries(...args),
}));

vi.mock('./CatalogVersionDiff', () => ({
  default: () => <div data-testid="version-diff">DIFF</div>,
}));

const twoVersionEntry = makeEntry({
  currentVersionId: 'v2',
  versions: [
    makeVersion({ id: 'v2', version: '2.0.0', specSize: 4096, changelog: 'Added endpoints' }),
    makeVersion({ id: 'v1', version: '1.0.0', specSize: 2048 }),
  ],
});

function renderHistory(over: {
  entry?: typeof twoVersionEntry;
  loadRawSpec?: (entryId: string, versionId: string) => Promise<string | null>;
} = {}) {
  const onClose = vi.fn();
  const onSwitchVersion = vi.fn();
  const onReimport = vi.fn();
  const loadRawSpec = over.loadRawSpec ?? vi.fn().mockResolvedValue('{"openapi":"3.0.0"}');
  render(
    <CatalogVersionHistory
      entry={over.entry ?? twoVersionEntry}
      onClose={onClose}
      onSwitchVersion={onSwitchVersion}
      onReimport={onReimport}
      loadRawSpec={loadRawSpec}
    />,
  );
  return { onClose, onSwitchVersion, onReimport, loadRawSpec };
}

beforeEach(() => {
  parseOpenApiSpec.mockReset();
  diffCatalogEntries.mockReset();
});

describe('CatalogVersionHistory', () => {
  it('renders the title, version list and empty compare state', () => {
    renderHistory();
    expect(screen.getByTestId('modal-title')).toHaveTextContent('Version History — My API');
    expect(screen.getByText('v2.0.0')).toBeInTheDocument();
    expect(screen.getByText('v1.0.0')).toBeInTheDocument();
    expect(screen.getByText('CURRENT')).toBeInTheDocument();
    expect(screen.getByText('Compare Versions')).toBeInTheDocument();
  });

  it('triggers reimport and close from the Import button', async () => {
    const { onReimport, onClose } = renderHistory();
    await userEvent.click(screen.getByRole('button', { name: /Import/ }));
    expect(onReimport).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('restores a non-current version and closes', async () => {
    const { onSwitchVersion, onClose } = renderHistory();
    await userEvent.click(screen.getByTitle('Restore this version'));
    expect(onSwitchVersion).toHaveBeenCalledWith('v1');
    expect(onClose).toHaveBeenCalled();
  });

  it('selects versions, clears, and caps at two selections', async () => {
    const threeVersionEntry = makeEntry({
      currentVersionId: 'v3',
      versions: [
        makeVersion({ id: 'v3', version: '3.0.0' }),
        makeVersion({ id: 'v2', version: '2.0.0' }),
        makeVersion({ id: 'v1', version: '1.0.0' }),
      ],
    });
    renderHistory({ entry: threeVersionEntry });
    const selectAreas = document.querySelectorAll('.cat-vh-card-select');
    await userEvent.click(selectAreas[0]);
    expect(screen.getByText('1/2 selected')).toBeInTheDocument();
    await userEvent.click(selectAreas[1]);
    expect(screen.getByText('2/2 selected')).toBeInTheDocument();
    // Third selection replaces the oldest, still 2/2
    await userEvent.click(selectAreas[2]);
    expect(screen.getByText('2/2 selected')).toBeInTheDocument();
    // Toggle off one
    await userEvent.click(selectAreas[2]);
    expect(screen.getByText('1/2 selected')).toBeInTheDocument();
    // Clear
    await userEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(screen.queryByText(/selected/)).not.toBeInTheDocument();
  });

  it('computes a diff when comparing two versions', async () => {
    parseOpenApiSpec.mockImplementation(async () => ({ entry: makeEntry() }));
    diffCatalogEntries.mockReturnValue({ changes: [] });
    renderHistory();
    const selectAreas = document.querySelectorAll('.cat-vh-card-select');
    await userEvent.click(selectAreas[0]);
    await userEvent.click(selectAreas[1]);
    await userEvent.click(screen.getByRole('button', { name: 'Compare' }));
    await waitFor(() => expect(screen.getByTestId('version-diff')).toBeInTheDocument());
    expect(diffCatalogEntries).toHaveBeenCalled();
  });

  it('shows an error when raw spec is unavailable', async () => {
    const loadRawSpec = vi.fn().mockResolvedValue(null);
    renderHistory({ loadRawSpec });
    const selectAreas = document.querySelectorAll('.cat-vh-card-select');
    await userEvent.click(selectAreas[0]);
    await userEvent.click(selectAreas[1]);
    await userEvent.click(screen.getByRole('button', { name: 'Compare' }));
    await waitFor(() =>
      expect(screen.getByText('Raw spec not available for comparison.')).toBeInTheDocument(),
    );
  });

  it('shows an error when parsing throws', async () => {
    parseOpenApiSpec.mockRejectedValue(new Error('bad spec'));
    renderHistory();
    const selectAreas = document.querySelectorAll('.cat-vh-card-select');
    await userEvent.click(selectAreas[0]);
    await userEvent.click(selectAreas[1]);
    await userEvent.click(screen.getByRole('button', { name: 'Compare' }));
    await waitFor(() => expect(screen.getByText('bad spec')).toBeInTheDocument());
  });
});
