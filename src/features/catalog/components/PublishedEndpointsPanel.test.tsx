/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import PublishedEndpointsPanel from './PublishedEndpointsPanel';
import type { PublishedEndpointItem } from '../utils/publishedEndpointAggregator';
import type { WorkflowPublication } from '../types/catalog';
import type { WorkflowPreviewEntry } from '../../../shared/utils/workflowPreviewStorage';

vi.mock('../utils/workflowExposureScanner', () => ({
  scanWorkflowsForCatalogRef: vi.fn().mockResolvedValue([]),
}));

function makePub(overrides?: Partial<WorkflowPublication>): WorkflowPublication {
  return { publishedAt: 1700000000000, publishedFromVersionId: 'v1', ...overrides };
}

function makeItem(overrides?: Partial<PublishedEndpointItem>): PublishedEndpointItem {
  return {
    entryId: 'entry1',
    entryName: 'Test API',
    endpointId: 'ep1',
    method: 'GET',
    path: '/test',
    summary: 'Test endpoint',
    currentVersionId: 'v1',
    publication: makePub(),
    isStale: false,
    ...overrides,
  };
}

describe('PublishedEndpointsPanel', () => {
  const onUnpublish = vi.fn();
  const onViewInCatalog = vi.fn();

  afterEach(() => { vi.clearAllMocks(); });

  it('shows empty state when no items', () => {
    render(<PublishedEndpointsPanel items={[]} onUnpublish={onUnpublish} onViewInCatalog={onViewInCatalog} />);
    expect(screen.getByText('No Published Endpoints')).toBeInTheDocument();
  });

  it('renders table with items', () => {
    const items = [
      makeItem({ endpointId: 'ep1', method: 'GET', path: '/users' }),
      makeItem({ endpointId: 'ep2', method: 'POST', path: '/posts', entryName: 'Blog API' }),
    ];
    render(<PublishedEndpointsPanel items={items} onUnpublish={onUnpublish} onViewInCatalog={onViewInCatalog} />);
    const rows = screen.getAllByTestId('pub-row');
    expect(rows).toHaveLength(2);
    expect(screen.getByText('/users')).toBeInTheDocument();
    expect(screen.getByText('/posts')).toBeInTheDocument();
    expect(screen.getByText('Blog API')).toBeInTheDocument();
  });

  it('shows status badges correctly', () => {
    const items = [
      makeItem({ endpointId: 'ep1', isStale: false }),
      makeItem({ endpointId: 'ep2', isStale: true }),
    ];
    render(<PublishedEndpointsPanel items={items} onUnpublish={onUnpublish} onViewInCatalog={onViewInCatalog} />);
    expect(screen.getByTestId('pub-status-current')).toBeInTheDocument();
    expect(screen.getByTestId('pub-status-stale')).toBeInTheDocument();
  });

  it('filters by search query', () => {
    const items = [
      makeItem({ endpointId: 'ep1', path: '/users', summary: 'List users' }),
      makeItem({ endpointId: 'ep2', path: '/orders', summary: 'Get orders' }),
    ];
    render(<PublishedEndpointsPanel items={items} onUnpublish={onUnpublish} onViewInCatalog={onViewInCatalog} />);
    const searchInput = screen.getByTestId('pub-search');
    fireEvent.change(searchInput, { target: { value: 'orders' } });
    const rows = screen.getAllByTestId('pub-row');
    expect(rows).toHaveLength(1);
    expect(screen.getByText('/orders')).toBeInTheDocument();
  });

  it('filters by status pills', () => {
    const items = [
      makeItem({ endpointId: 'ep1', isStale: false }),
      makeItem({ endpointId: 'ep2', isStale: true }),
    ];
    render(<PublishedEndpointsPanel items={items} onUnpublish={onUnpublish} onViewInCatalog={onViewInCatalog} />);
    
    fireEvent.click(screen.getByTestId('pub-filter-stale'));
    expect(screen.getAllByTestId('pub-row')).toHaveLength(1);
    
    fireEvent.click(screen.getByTestId('pub-filter-current'));
    expect(screen.getAllByTestId('pub-row')).toHaveLength(1);
    
    fireEvent.click(screen.getByTestId('pub-filter-all'));
    expect(screen.getAllByTestId('pub-row')).toHaveLength(2);
  });

  it('shows stale hint when stale endpoints exist', () => {
    const items = [
      makeItem({ endpointId: 'ep1', isStale: true }),
      makeItem({ endpointId: 'ep2', isStale: true }),
    ];
    render(<PublishedEndpointsPanel items={items} onUnpublish={onUnpublish} onViewInCatalog={onViewInCatalog} />);
    expect(screen.getByTestId('pub-stale-hint')).toHaveTextContent('2 endpoints published from an older spec version');
  });

  it('does not show stale hint when all current', () => {
    const items = [makeItem({ isStale: false })];
    render(<PublishedEndpointsPanel items={items} onUnpublish={onUnpublish} onViewInCatalog={onViewInCatalog} />);
    expect(screen.queryByTestId('pub-stale-hint')).not.toBeInTheDocument();
  });

  it('shows singular stale hint when exactly one stale endpoint exists', () => {
    const items = [makeItem({ endpointId: 'ep1', isStale: true })];
    render(<PublishedEndpointsPanel items={items} onUnpublish={onUnpublish} onViewInCatalog={onViewInCatalog} />);
    expect(screen.getByTestId('pub-stale-hint')).toHaveTextContent('1 endpoint published from an older spec version');
  });

  it('opens actions menu and calls onViewInCatalog', () => {
    const items = [makeItem({ entryId: 'e1', endpointId: 'ep1' })];
    render(<PublishedEndpointsPanel items={items} onUnpublish={onUnpublish} onViewInCatalog={onViewInCatalog} />);
    fireEvent.click(screen.getByTestId('pub-actions-btn'));
    expect(screen.getByTestId('pub-actions-menu')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('pub-action-view'));
    expect(onViewInCatalog).toHaveBeenCalledWith('e1', 'ep1');
  });

  it('opens actions menu and calls onUnpublish', () => {
    const items = [makeItem({ entryId: 'e1', endpointId: 'ep1' })];
    render(<PublishedEndpointsPanel items={items} onUnpublish={onUnpublish} onViewInCatalog={onViewInCatalog} />);
    fireEvent.click(screen.getByTestId('pub-actions-btn'));
    fireEvent.click(screen.getByTestId('pub-action-unpublish'));
    expect(onUnpublish).toHaveBeenCalledWith('e1', 'ep1');
  });

  it('supports select all / deselect all', () => {
    const items = [
      makeItem({ endpointId: 'ep1' }),
      makeItem({ endpointId: 'ep2' }),
    ];
    render(<PublishedEndpointsPanel items={items} onUnpublish={onUnpublish} onViewInCatalog={onViewInCatalog} />);
    const selectAll = screen.getByTestId('pub-select-all');
    fireEvent.click(selectAll);
    expect(screen.getByTestId('pub-bulk-unpublish')).toBeInTheDocument();
    expect(screen.getByTestId('pub-bulk-unpublish')).toHaveTextContent('Unpublish 2 selected');
    
    fireEvent.click(selectAll);
    expect(screen.queryByTestId('pub-bulk-unpublish')).not.toBeInTheDocument();
  });

  it('bulk unpublish calls onUnpublish for each selected item when onBulkUnpublish not provided', () => {
    const items = [
      makeItem({ entryId: 'e1', endpointId: 'ep1' }),
      makeItem({ entryId: 'e2', endpointId: 'ep2' }),
    ];
    render(<PublishedEndpointsPanel items={items} onUnpublish={onUnpublish} onViewInCatalog={onViewInCatalog} />);
    fireEvent.click(screen.getByTestId('pub-select-all'));
    fireEvent.click(screen.getByTestId('pub-bulk-unpublish'));
    expect(onUnpublish).toHaveBeenCalledTimes(2);
    expect(onUnpublish).toHaveBeenCalledWith('e1', 'ep1');
    expect(onUnpublish).toHaveBeenCalledWith('e2', 'ep2');
  });

  it('bulk unpublish calls onBulkUnpublish when provided', () => {
    const onBulkUnpublish = vi.fn();
    const items = [
      makeItem({ entryId: 'e1', endpointId: 'ep1' }),
      makeItem({ entryId: 'e2', endpointId: 'ep2' }),
    ];
    render(<PublishedEndpointsPanel items={items} onUnpublish={onUnpublish} onBulkUnpublish={onBulkUnpublish} onViewInCatalog={onViewInCatalog} />);
    fireEvent.click(screen.getByTestId('pub-select-all'));
    fireEvent.click(screen.getByTestId('pub-bulk-unpublish'));
    expect(onBulkUnpublish).toHaveBeenCalledTimes(1);
    expect(onBulkUnpublish).toHaveBeenCalledWith([
      { entryId: 'e1', endpointId: 'ep1' },
      { entryId: 'e2', endpointId: 'ep2' },
    ]);
    expect(onUnpublish).not.toHaveBeenCalled();
  });

  it('individual checkbox toggles selection', () => {
    const items = [
      makeItem({ endpointId: 'ep1' }),
      makeItem({ endpointId: 'ep2' }),
    ];
    render(<PublishedEndpointsPanel items={items} onUnpublish={onUnpublish} onViewInCatalog={onViewInCatalog} />);
    const rows = screen.getAllByTestId('pub-row');
    const checkbox = within(rows[0]).getByRole('checkbox');
    fireEvent.click(checkbox);
    expect(screen.getByTestId('pub-bulk-unpublish')).toHaveTextContent('Unpublish 1 selected');
  });

  it('shows "no results" when filter matches nothing', () => {
    const items = [makeItem()];
    render(<PublishedEndpointsPanel items={items} onUnpublish={onUnpublish} onViewInCatalog={onViewInCatalog} />);
    fireEvent.change(screen.getByTestId('pub-search'), { target: { value: 'zzz-nonexistent' } });
    expect(screen.getByText('No endpoints match the current filter.')).toBeInTheDocument();
  });

  it('displays method badge with correct color', () => {
    const items = [makeItem({ method: 'POST' })];
    render(<PublishedEndpointsPanel items={items} onUnpublish={onUnpublish} onViewInCatalog={onViewInCatalog} />);
    const badge = screen.getByText('POST');
    expect(badge.className).toContain('pub-method');
    expect(badge.style.background).toBeTruthy();
  });

  it('shows summary when different from path', () => {
    const items = [makeItem({ path: '/test', summary: 'Test endpoint' })];
    render(<PublishedEndpointsPanel items={items} onUnpublish={onUnpublish} onViewInCatalog={onViewInCatalog} />);
    expect(screen.getByText('Test endpoint')).toBeInTheDocument();
  });

  it('does not show summary when same as path', () => {
    const items = [makeItem({ path: '/test', summary: '/test' })];
    render(<PublishedEndpointsPanel items={items} onUnpublish={onUnpublish} onViewInCatalog={onViewInCatalog} />);
    const summaryElements = screen.queryAllByText('/test');
    expect(summaryElements).toHaveLength(1);
  });

  it('closes menu when clicking outside', () => {
    const items = [makeItem()];
    render(<PublishedEndpointsPanel items={items} onUnpublish={onUnpublish} onViewInCatalog={onViewInCatalog} />);
    fireEvent.click(screen.getByTestId('pub-actions-btn'));
    expect(screen.getByTestId('pub-actions-menu')).toBeInTheDocument();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByTestId('pub-actions-menu')).not.toBeInTheDocument();
  });

  it('displays filter pill counts correctly', () => {
    const items = [
      makeItem({ endpointId: 'ep1', isStale: false }),
      makeItem({ endpointId: 'ep2', isStale: true }),
      makeItem({ endpointId: 'ep3', isStale: false }),
    ];
    render(<PublishedEndpointsPanel items={items} onUnpublish={onUnpublish} onViewInCatalog={onViewInCatalog} />);
    expect(screen.getByTestId('pub-filter-all')).toHaveTextContent('All (3)');
    expect(screen.getByTestId('pub-filter-current')).toHaveTextContent('Current (2)');
    expect(screen.getByTestId('pub-filter-stale')).toHaveTextContent('Stale (1)');
  });

  it('removes hidden items from selection when filter changes', () => {
    const items = [
      makeItem({ endpointId: 'ep1', isStale: false }),
      makeItem({ endpointId: 'ep2', isStale: true }),
    ];
    render(<PublishedEndpointsPanel items={items} onUnpublish={onUnpublish} onViewInCatalog={onViewInCatalog} />);
    fireEvent.click(screen.getByTestId('pub-select-all'));
    expect(screen.getByTestId('pub-bulk-unpublish')).toHaveTextContent('Unpublish 2 selected');

    fireEvent.click(screen.getByTestId('pub-filter-current'));
    expect(screen.getByTestId('pub-bulk-unpublish')).toHaveTextContent('Unpublish 1 selected');
  });

  describe('republish action', () => {
    it('shows Republish action for stale items when onRepublish provided', () => {
      const onRepublish = vi.fn();
      const items = [makeItem({ isStale: true })];
      render(<PublishedEndpointsPanel items={items} onUnpublish={onUnpublish} onRepublish={onRepublish} onViewInCatalog={onViewInCatalog} />);

      fireEvent.click(screen.getByTestId('pub-actions-btn'));
      const menu = screen.getByTestId('pub-actions-menu');
      expect(within(menu).getByTestId('pub-action-republish')).toBeInTheDocument();
      expect(within(menu).getByTestId('pub-action-republish')).toHaveTextContent('Republish at current version');
    });

    it('does not show Republish action for current (non-stale) items', () => {
      const onRepublish = vi.fn();
      const items = [makeItem({ isStale: false })];
      render(<PublishedEndpointsPanel items={items} onUnpublish={onUnpublish} onRepublish={onRepublish} onViewInCatalog={onViewInCatalog} />);

      fireEvent.click(screen.getByTestId('pub-actions-btn'));
      const menu = screen.getByTestId('pub-actions-menu');
      expect(within(menu).queryByTestId('pub-action-republish')).not.toBeInTheDocument();
    });

    it('does not show Republish action when onRepublish is not provided', () => {
      const items = [makeItem({ isStale: true })];
      render(<PublishedEndpointsPanel items={items} onUnpublish={onUnpublish} onViewInCatalog={onViewInCatalog} />);

      fireEvent.click(screen.getByTestId('pub-actions-btn'));
      const menu = screen.getByTestId('pub-actions-menu');
      expect(within(menu).queryByTestId('pub-action-republish')).not.toBeInTheDocument();
    });

    it('calls onRepublish with correct IDs and closes menu', () => {
      const onRepublish = vi.fn();
      const items = [makeItem({ entryId: 'e42', endpointId: 'ep7', isStale: true })];
      render(<PublishedEndpointsPanel items={items} onUnpublish={onUnpublish} onRepublish={onRepublish} onViewInCatalog={onViewInCatalog} />);

      fireEvent.click(screen.getByTestId('pub-actions-btn'));
      fireEvent.click(screen.getByTestId('pub-action-republish'));

      expect(onRepublish).toHaveBeenCalledWith('e42', 'ep7');
      expect(screen.queryByTestId('pub-actions-menu')).not.toBeInTheDocument();
    });
  });

  describe('permission gating', () => {
    it('hides Unpublish action when canUnpublish is false', () => {
      const items = [makeItem()];
      render(
        <PublishedEndpointsPanel
          items={items} onUnpublish={onUnpublish} onViewInCatalog={onViewInCatalog}
          publishPermission={{ canPublish: true, canUnpublish: false, canRepublish: true }}
        />,
      );
      fireEvent.click(screen.getByTestId('pub-actions-btn'));
      expect(screen.queryByTestId('pub-action-unpublish')).not.toBeInTheDocument();
    });

    it('hides Republish action when canRepublish is false', () => {
      const onRepublish = vi.fn();
      const items = [makeItem({ isStale: true })];
      render(
        <PublishedEndpointsPanel
          items={items} onUnpublish={onUnpublish} onRepublish={onRepublish} onViewInCatalog={onViewInCatalog}
          publishPermission={{ canPublish: true, canUnpublish: true, canRepublish: false }}
        />,
      );
      fireEvent.click(screen.getByTestId('pub-actions-btn'));
      expect(screen.queryByTestId('pub-action-republish')).not.toBeInTheDocument();
    });

    it('hides bulk unpublish button when canUnpublish is false', () => {
      const items = [makeItem(), makeItem({ endpointId: 'ep2' })];
      render(
        <PublishedEndpointsPanel
          items={items} onUnpublish={onUnpublish} onBulkUnpublish={vi.fn()} onViewInCatalog={onViewInCatalog}
          publishPermission={{ canPublish: true, canUnpublish: false, canRepublish: true }}
        />,
      );
      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[0]);
      expect(screen.queryByTestId('pub-bulk-unpublish')).not.toBeInTheDocument();
    });

    it('shows all actions when permission prop is not provided', () => {
      const onRepublish = vi.fn();
      const items = [makeItem({ isStale: true })];
      render(
        <PublishedEndpointsPanel
          items={items} onUnpublish={onUnpublish} onRepublish={onRepublish} onViewInCatalog={onViewInCatalog}
        />,
      );
      fireEvent.click(screen.getByTestId('pub-actions-btn'));
      expect(screen.getByTestId('pub-action-unpublish')).toBeInTheDocument();
      expect(screen.getByTestId('pub-action-republish')).toBeInTheDocument();
    });
  });

  describe('View Usage (D1)', () => {
    it('shows View Usage action in menu', () => {
      const items = [makeItem()];
      render(<PublishedEndpointsPanel items={items} onUnpublish={onUnpublish} onViewInCatalog={onViewInCatalog} />);
      fireEvent.click(screen.getByTestId('pub-actions-btn'));
      expect(screen.getByTestId('pub-action-usage')).toHaveTextContent('View Usage');
    });

    it('shows usage data after clicking View Usage', async () => {
      const { scanWorkflowsForCatalogRef } = await import('../utils/workflowExposureScanner');
      (scanWorkflowsForCatalogRef as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        { workflowId: 'wf1', workflowName: 'My Flow', nodeIds: ['n1', 'n2'], nodeLabels: ['Step A', 'Step B'] },
      ]);

      const items = [makeItem({ entryId: 'e1', endpointId: 'ep1' })];
      render(<PublishedEndpointsPanel items={items} onUnpublish={onUnpublish} onViewInCatalog={onViewInCatalog} />);
      fireEvent.click(screen.getByTestId('pub-actions-btn'));
      fireEvent.click(screen.getByTestId('pub-action-usage'));

      await waitFor(() => {
        expect(screen.getByTestId('pub-usage-list')).toBeInTheDocument();
      });
      expect(screen.getByText('My Flow')).toBeInTheDocument();
    });

    it('shows empty message when no workflows use endpoint', async () => {
      const { scanWorkflowsForCatalogRef } = await import('../utils/workflowExposureScanner');
      (scanWorkflowsForCatalogRef as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);

      const items = [makeItem()];
      render(<PublishedEndpointsPanel items={items} onUnpublish={onUnpublish} onViewInCatalog={onViewInCatalog} />);
      fireEvent.click(screen.getByTestId('pub-actions-btn'));
      fireEvent.click(screen.getByTestId('pub-action-usage'));

      await waitFor(() => {
        expect(screen.getByTestId('pub-usage-empty')).toBeInTheDocument();
      });
    });

    it('hides usage row when View Usage is clicked again for the same endpoint', async () => {
      const { scanWorkflowsForCatalogRef } = await import('../utils/workflowExposureScanner');
      (scanWorkflowsForCatalogRef as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        { workflowId: 'wf1', workflowName: 'W1', nodeIds: ['n1'], nodeLabels: ['N1'] },
      ]);

      const items = [makeItem({ entryId: 'e1', endpointId: 'ep1' })];
      render(<PublishedEndpointsPanel items={items} onUnpublish={onUnpublish} onViewInCatalog={onViewInCatalog} />);
      fireEvent.click(screen.getByTestId('pub-actions-btn'));
      fireEvent.click(screen.getByTestId('pub-action-usage'));

      await waitFor(() => {
        expect(screen.getByTestId('pub-usage-list')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('pub-actions-btn'));
      fireEvent.click(screen.getByTestId('pub-action-usage'));
      expect(screen.queryByTestId('pub-usage-row')).not.toBeInTheDocument();
    });

    it('ignores stale usage responses when switching to a different endpoint', async () => {
      const { scanWorkflowsForCatalogRef } = await import('../utils/workflowExposureScanner');
      let resolveFirst: ((value: unknown) => void) | null = null;
      let resolveSecond: ((value: unknown) => void) | null = null;

      (scanWorkflowsForCatalogRef as ReturnType<typeof vi.fn>)
        .mockImplementationOnce(() => new Promise((r) => { resolveFirst = r; }))
        .mockImplementationOnce(() => new Promise((r) => { resolveSecond = r; }));

      const items = [
        makeItem({ entryId: 'e1', endpointId: 'ep1', path: '/one' }),
        makeItem({ entryId: 'e1', endpointId: 'ep2', path: '/two' }),
      ];
      render(<PublishedEndpointsPanel items={items} onUnpublish={onUnpublish} onViewInCatalog={onViewInCatalog} />);

      const actionsButtons = screen.getAllByTestId('pub-actions-btn');
      fireEvent.click(actionsButtons[0]);
      fireEvent.click(screen.getByTestId('pub-action-usage'));

      fireEvent.click(actionsButtons[1]);
      fireEvent.click(screen.getByTestId('pub-action-usage'));

      resolveFirst?.([{ workflowId: 'wf-old', workflowName: 'Old', nodeIds: ['n1'], nodeLabels: [] }]);
      resolveSecond?.([{ workflowId: 'wf-new', workflowName: 'New', nodeIds: ['n2'], nodeLabels: [] }]);

      await waitFor(() => {
        expect(screen.getByText('New')).toBeInTheDocument();
      });
      expect(screen.queryByText('Old')).not.toBeInTheDocument();
    });
  });

  describe('Bulk Republish (D2)', () => {
    it('shows Republish All Stale button when stale items exist', () => {
      const onRepublish = vi.fn();
      const items = [
        makeItem({ endpointId: 'ep1', isStale: true }),
        makeItem({ endpointId: 'ep2', isStale: true }),
        makeItem({ endpointId: 'ep3', isStale: false }),
      ];
      render(<PublishedEndpointsPanel items={items} onUnpublish={onUnpublish} onRepublish={onRepublish} onViewInCatalog={onViewInCatalog} />);
      expect(screen.getByTestId('pub-bulk-republish')).toHaveTextContent('Republish All Stale (2)');
    });

    it('hides Republish All Stale when no stale items', () => {
      const items = [makeItem({ isStale: false })];
      render(<PublishedEndpointsPanel items={items} onUnpublish={onUnpublish} onRepublish={vi.fn()} onViewInCatalog={onViewInCatalog} />);
      expect(screen.queryByTestId('pub-bulk-republish')).not.toBeInTheDocument();
    });

    it('calls onRepublish for each stale item when clicked', () => {
      const onRepublish = vi.fn();
      const items = [
        makeItem({ entryId: 'e1', endpointId: 'ep1', isStale: true }),
        makeItem({ entryId: 'e2', endpointId: 'ep2', isStale: true }),
        makeItem({ entryId: 'e3', endpointId: 'ep3', isStale: false }),
      ];
      render(<PublishedEndpointsPanel items={items} onUnpublish={onUnpublish} onRepublish={onRepublish} onViewInCatalog={onViewInCatalog} />);
      fireEvent.click(screen.getByTestId('pub-bulk-republish'));
      expect(onRepublish).toHaveBeenCalledTimes(2);
      expect(onRepublish).toHaveBeenCalledWith('e1', 'ep1');
      expect(onRepublish).toHaveBeenCalledWith('e2', 'ep2');
    });

    it('calls onBulkRepublish when provided instead of individual calls', () => {
      const onBulkRepublish = vi.fn();
      const items = [
        makeItem({ entryId: 'e1', endpointId: 'ep1', isStale: true }),
        makeItem({ entryId: 'e2', endpointId: 'ep2', isStale: true }),
      ];
      render(
        <PublishedEndpointsPanel
          items={items} onUnpublish={onUnpublish} onRepublish={vi.fn()} onBulkRepublish={onBulkRepublish}
          onViewInCatalog={onViewInCatalog}
        />,
      );
      fireEvent.click(screen.getByTestId('pub-bulk-republish'));
      expect(onBulkRepublish).toHaveBeenCalledWith([
        { entryId: 'e1', endpointId: 'ep1' },
        { entryId: 'e2', endpointId: 'ep2' },
      ]);
    });

    it('does nothing on bulk republish when stale exists but no handlers are provided', () => {
      const items = [
        makeItem({ entryId: 'e1', endpointId: 'ep1', isStale: true }),
      ];
      render(
        <PublishedEndpointsPanel
          items={items}
          onUnpublish={onUnpublish}
          onViewInCatalog={onViewInCatalog}
        />, 
      );
      fireEvent.click(screen.getByTestId('pub-bulk-republish'));
      expect(onUnpublish).not.toHaveBeenCalled();
    });
  });

  describe('Preview display (D4)', () => {
    const makePreview = (overrides?: Partial<WorkflowPreviewEntry>): WorkflowPreviewEntry => ({
      entryId: 'entry1',
      endpointId: 'pep1',
      method: 'GET',
      path: '/preview-test',
      summary: 'Preview endpoint',
      entryName: 'Preview API',
      addedAt: 1700000000000,
      ...overrides,
    });

    it('shows Previews filter pill when preview items exist', () => {
      const items = [makeItem()];
      const previews = [makePreview()];
      render(
        <PublishedEndpointsPanel
          items={items} previewItems={previews}
          onUnpublish={onUnpublish} onViewInCatalog={onViewInCatalog}
        />,
      );
      expect(screen.getByTestId('pub-filter-preview')).toHaveTextContent('Previews (1)');
    });

    it('hides Previews pill when no preview items', () => {
      const items = [makeItem()];
      render(
        <PublishedEndpointsPanel
          items={items} previewItems={[]}
          onUnpublish={onUnpublish} onViewInCatalog={onViewInCatalog}
        />,
      );
      expect(screen.queryByTestId('pub-filter-preview')).not.toBeInTheDocument();
    });

    it('shows preview table when Previews filter is active', () => {
      const items = [makeItem()];
      const previews = [makePreview({ method: 'PATCH', path: '/my-preview' })];
      render(
        <PublishedEndpointsPanel
          items={items} previewItems={previews}
          onUnpublish={onUnpublish} onViewInCatalog={onViewInCatalog}
        />,
      );
      fireEvent.click(screen.getByTestId('pub-filter-preview'));
      expect(screen.getByTestId('pub-preview-table')).toBeInTheDocument();
      expect(screen.getByTestId('pub-preview-row')).toBeInTheDocument();
      expect(screen.getByText('/my-preview')).toBeInTheDocument();
    });

    it('shows Promote to Published action for preview items', () => {
      const onPromote = vi.fn();
      const previews = [makePreview({ entryId: 'e1', endpointId: 'pep1' })];
      render(
        <PublishedEndpointsPanel
          items={[]} previewItems={previews}
          onUnpublish={onUnpublish} onPromotePreview={onPromote} onViewInCatalog={onViewInCatalog}
        />,
      );
      fireEvent.click(screen.getByTestId('pub-filter-preview'));
      fireEvent.click(screen.getByTestId('pub-preview-actions-btn'));
      fireEvent.click(screen.getByTestId('pub-preview-action-promote'));
      expect(onPromote).toHaveBeenCalledWith('e1', 'pep1');
    });

    it('shows Remove Preview action', () => {
      const onRemove = vi.fn();
      const previews = [makePreview({ entryId: 'e1', endpointId: 'pep1' })];
      render(
        <PublishedEndpointsPanel
          items={[]} previewItems={previews}
          onUnpublish={onUnpublish} onRemovePreview={onRemove} onViewInCatalog={onViewInCatalog}
        />,
      );
      fireEvent.click(screen.getByTestId('pub-filter-preview'));
      fireEvent.click(screen.getByTestId('pub-preview-actions-btn'));
      fireEvent.click(screen.getByTestId('pub-preview-action-remove'));
      expect(onRemove).toHaveBeenCalledWith('e1', 'pep1');
    });

    it('shows preview no-results message when search does not match', () => {
      const previews = [makePreview({ path: '/preview-only', summary: 'Preview only endpoint' })];
      render(
        <PublishedEndpointsPanel
          items={[]} previewItems={previews}
          onUnpublish={onUnpublish} onViewInCatalog={onViewInCatalog}
        />,
      );

      fireEvent.click(screen.getByTestId('pub-filter-preview'));
      fireEvent.change(screen.getByTestId('pub-search'), { target: { value: 'no-match-text' } });
      expect(screen.getByText('No previews match the search query.')).toBeInTheDocument();
    });

    it('hides promote action when publish permission is denied', () => {
      const onPromote = vi.fn();
      const previews = [makePreview({ entryId: 'e1', endpointId: 'pep1' })];
      render(
        <PublishedEndpointsPanel
          items={[]} previewItems={previews}
          onUnpublish={onUnpublish} onPromotePreview={onPromote} onViewInCatalog={onViewInCatalog}
          publishPermission={{ canPublish: false, canUnpublish: true, canRepublish: true }}
        />,
      );

      fireEvent.click(screen.getByTestId('pub-filter-preview'));
      fireEvent.click(screen.getByTestId('pub-preview-actions-btn'));
      expect(screen.queryByTestId('pub-preview-action-promote')).not.toBeInTheDocument();
    });

    it('hides preview remove action when onRemovePreview is not provided', () => {
      const previews = [makePreview({ entryId: 'e1', endpointId: 'pep1' })];
      render(
        <PublishedEndpointsPanel
          items={[]}
          previewItems={previews}
          onUnpublish={onUnpublish}
          onViewInCatalog={onViewInCatalog}
        />,
      );

      fireEvent.click(screen.getByTestId('pub-filter-preview'));
      fireEvent.click(screen.getByTestId('pub-preview-actions-btn'));
      expect(screen.queryByTestId('pub-preview-action-remove')).not.toBeInTheDocument();
    });

    it('hides preview promote action when onPromotePreview is not provided', () => {
      const previews = [makePreview({ entryId: 'e1', endpointId: 'pep1' })];
      render(
        <PublishedEndpointsPanel
          items={[]}
          previewItems={previews}
          onUnpublish={onUnpublish}
          onRemovePreview={vi.fn()}
          onViewInCatalog={onViewInCatalog}
        />,
      );

      fireEvent.click(screen.getByTestId('pub-filter-preview'));
      fireEvent.click(screen.getByTestId('pub-preview-actions-btn'));
      expect(screen.queryByTestId('pub-preview-action-promote')).not.toBeInTheDocument();
    });
  });
});
