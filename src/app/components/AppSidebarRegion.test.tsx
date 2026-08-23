/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import AppSidebarRegion from './AppSidebarRegion';
import type { AppSidebarRegionProps } from './AppSidebarRegion';
import type { RequestCollection } from '@shared/types';
import {
  beginDemoAppSidebarSession,
  DEMO_SIDEBAR_PIN_KEY,
  DEMO_SIDEBAR_SESSION_KEY,
  isDemoAppSidebarPinned,
} from '@shared/demoAppSidebarSession';

const h = vi.hoisted(() => {
  const call = (p: Record<string, unknown>, k: string, ...args: unknown[]) => {
    const f = p[k];
    if (typeof f === 'function') (f as (...a: unknown[]) => unknown)(...args);
  };
  return {
    call,
    catalogProps: {} as Record<string, unknown>,
    requestsProps: {} as Record<string, unknown>,
    workflowProps: {} as Record<string, unknown>,
    harnessProps: {} as Record<string, unknown>,
    exportModalProps: {} as Record<string, unknown>,
  };
});

vi.mock('../../features/catalog/components/CatalogSidebar', () => ({
  default: (props: Record<string, unknown>) => {
    h.catalogProps = props;
    return <div data-testid="catalog-sidebar" />;
  },
}));

vi.mock('../../features/requests/components/RequestsSidebar', () => ({
  default: (props: Record<string, unknown>) => {
    h.requestsProps = props;
    return <div data-testid="requests-sidebar" />;
  },
}));

vi.mock('../../features/workflow/components/panels/WorkflowSidebar', () => ({
  default: (props: Record<string, unknown>) => {
    h.workflowProps = props;
    return <div data-testid="workflow-sidebar" />;
  },
}));

vi.mock('../Sidebar', () => ({
  default: (props: Record<string, unknown>) => {
    h.harnessProps = props;
    return <div data-testid="harness-sidebar" />;
  },
}));

vi.mock('../../features/api-mock/components/ApiMockSidebar', () => ({
  default: () => <div data-testid="api-mock-sidebar" />,
}));

vi.mock('../../features/api-mock/components/ExportToApiMockModal', () => ({
  ExportToApiMockModal: (props: Record<string, unknown>) => {
    h.exportModalProps = props;
    return <div data-testid="export-to-mock-modal" />;
  },
}));

function makeProps(overrides: Partial<AppSidebarRegionProps> = {}): AppSidebarRegionProps {
  const setActiveTab = vi.fn();
  const setSidebarCollapsed = vi.fn();
  const setSidebarView = vi.fn();
  const setGalleryInitialDomain = vi.fn();
  const setCatalogReimportId = vi.fn();
  const setShowCatalogImport = vi.fn();
  const setCatalogVersionHistoryId = vi.fn();
  const setCatalogEditId = vi.fn();
  const setBatchHarnessTarget = vi.fn();

  const collection: RequestCollection = {
    id: 'col-1',
    name: 'Orders',
    requests: [{
      id: 'req-1',
      name: 'Get order',
      method: 'GET',
      url: '/orders/1',
      headers: [{ key: 'Accept', value: 'application/json', enabled: true }],
      body: '',
    }],
    folders: [],
    groups: [],
  };

  return {
    activeTab: 'requests',
    setActiveTab,
    sidebarCollapsed: false,
    setSidebarCollapsed,
    sidebarWidth: 280,
    handleResizeStart: vi.fn(),
    catalog: {
      loaded: true,
      entries: [],
      selectedEntryId: null,
      selectEntry: vi.fn(),
      removeEntry: vi.fn(),
    } as AppSidebarRegionProps['catalog'],
    wb: {
      loaded: true,
      collections: [collection],
      selectedCollection: collection,
      selectedRequest: collection.requests[0],
      selectCollection: vi.fn(),
      duplicateCollection: vi.fn(),
      duplicateRequest: vi.fn(),
      addFolder: vi.fn(),
      addSubCollection: vi.fn(),
      renameFolder: vi.fn(),
      duplicateFolder: vi.fn(),
      moveFolder: vi.fn(),
      moveFolderTo: vi.fn(),
      moveRequest: vi.fn(),
      countAllRequests: vi.fn(() => 1),
      importCollection: vi.fn(),
      importFolder: vi.fn(),
      addGroup: vi.fn(),
      renameGroup: vi.fn(),
      deleteGroup: vi.fn(),
      moveToGroup: vi.fn(),
      duplicateGroup: vi.fn(),
    } as AppSidebarRegionProps['wb'],
    wfHook: {
      workflows: [],
      selectedId: null,
      select: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      duplicate: vi.fn(),
      reorder: vi.fn(),
    } as AppSidebarRegionProps['wfHook'],
    wfFolders: {
      folders: [],
      loaded: true,
      toggleCollapse: vi.fn(),
      setCollapsed: vi.fn(),
      create: vi.fn(),
      rename: vi.fn(),
      remove: vi.fn(),
      move: vi.fn(),
    } as AppSidebarRegionProps['wfFolders'],
    environments: [],
    microservices: [],
    featureGroups: [],
    selectedEnvId: 'env-1',
    selectedSvcId: 'svc-1',
    setSelectedEnvId: vi.fn(),
    setSelectedSvcId: vi.fn(),
    sidebarView: 'env',
    setSidebarView,
    harnessRequestIds: new Set<string>(),
    setGalleryInitialDomain,
    setCatalogReimportId,
    setShowCatalogImport,
    setCatalogVersionHistoryId,
    setCatalogEditId,
    setBatchHarnessTarget,
    handleExportSpec: vi.fn(),
    handleConvertToOpenApi: vi.fn(),
    handleBatchConvertToOpenApi: vi.fn(),
    handleWorkflowExport: vi.fn(),
    handleExportFolder: vi.fn(),
    handleWorkflowImport: vi.fn(),
    handleWbNewCollection: vi.fn(),
    handleWbEditCollection: vi.fn(),
    handleWbNewRequest: vi.fn(),
    handleEditSubCollection: vi.fn(),
    reqTabs: {
      openTabRequestIds: new Set<string>(),
      selectRequest: vi.fn(),
      removeCollection: vi.fn(),
      removeRequest: vi.fn(),
      removeFolder: vi.fn(),
      moveRequestToCollection: vi.fn(),
      moveFolderToCollection: vi.fn(),
      mergeCollectionInto: vi.fn(),
    } as AppSidebarRegionProps['reqTabs'],
    ...overrides,
  };
}

describe('AppSidebarRegion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.catalogProps = {};
    h.requestsProps = {};
    h.workflowProps = {};
    h.harnessProps = {};
    h.exportModalProps = {};
    sessionStorage.removeItem(DEMO_SIDEBAR_PIN_KEY);
    sessionStorage.removeItem(DEMO_SIDEBAR_SESSION_KEY);
  });

  it('renders requests sidebar and tab toggles on api tabs', () => {
    const props = makeProps({ activeTab: 'requests' });
    render(<AppSidebarRegion {...props} />);

    expect(screen.getByTestId('requests-sidebar')).toBeTruthy();
    expect(screen.getByTestId('requests-sidebar').parentElement?.style.display).toBe('contents');
    expect(screen.getByTestId('catalog-sidebar').parentElement?.style.display).toBe('none');

    fireEvent.click(screen.getByRole('button', { name: 'Catalog' }));
    expect(props.setActiveTab).toHaveBeenCalledWith('catalog');

    fireEvent.click(screen.getByRole('button', { name: 'Requests' }));
    expect(props.setActiveTab).toHaveBeenCalledWith('requests');
  });

  it('renders catalog sidebar when catalog tab is active', () => {
    const props = makeProps({ activeTab: 'catalog' });
    render(<AppSidebarRegion {...props} />);
    expect(screen.getByTestId('catalog-sidebar').parentElement?.style.display).toBe('contents');
    expect(screen.getByTestId('requests-sidebar').parentElement?.style.display).toBe('none');
  });

  it('wires catalog sidebar callbacks', () => {
    const props = makeProps({ activeTab: 'catalog' });
    render(<AppSidebarRegion {...props} />);

    h.call(h.catalogProps, 'onSelectEntry', 'entry-1');
    expect(props.catalog.selectEntry).toHaveBeenCalledWith('entry-1');
    expect(props.setActiveTab).toHaveBeenCalledWith('catalog');

    h.call(h.catalogProps, 'onImport');
    expect(props.setCatalogReimportId).toHaveBeenCalledWith(undefined);
    expect(props.setShowCatalogImport).toHaveBeenCalledWith(true);

    h.call(h.catalogProps, 'onReimport', 'entry-2');
    expect(props.setCatalogReimportId).toHaveBeenCalledWith('entry-2');

    h.call(h.catalogProps, 'onVersionHistory', 'entry-3');
    expect(props.setCatalogVersionHistoryId).toHaveBeenCalledWith('entry-3');

    h.call(h.catalogProps, 'onEdit', 'entry-4');
    expect(props.setCatalogEditId).toHaveBeenCalledWith('entry-4');

    h.call(h.catalogProps, 'onExportSpec', 'entry-5');
    expect(props.handleExportSpec).toHaveBeenCalledWith('entry-5');

    h.call(h.catalogProps, 'onConvertToOpenApi', 'entry-6');
    expect(props.handleConvertToOpenApi).toHaveBeenCalledWith('entry-6');

    h.call(h.catalogProps, 'onDeleteEntry', 'entry-7');
    expect(props.catalog.removeEntry).toHaveBeenCalledWith('entry-7');
  });

  it('wires requests sidebar callbacks including export to api mock', () => {
    const props = makeProps({ activeTab: 'requests' });
    render(<AppSidebarRegion {...props} />);

    h.call(h.requestsProps, 'onSelectCollection', 'col-1');
    expect(props.wb.selectCollection).toHaveBeenCalledWith('col-1');

    h.call(h.requestsProps, 'onSelectRequest', 'col-1', 'req-1');
    expect(props.reqTabs.selectRequest).toHaveBeenCalledWith('col-1', 'req-1');

    h.call(h.requestsProps, 'onDeleteCollection', 'col-1');
    expect(props.reqTabs.removeCollection).toHaveBeenCalledWith('col-1');

    h.call(h.requestsProps, 'onNewCollection', 'direct', 'group-1');
    expect(props.handleWbNewCollection).toHaveBeenCalledWith('direct', 'group-1');

    h.call(h.requestsProps, 'onEditCollection', props.wb.collections[0]);
    expect(props.handleWbEditCollection).toHaveBeenCalledWith(props.wb.collections[0]);

    h.call(h.requestsProps, 'onNewRequest', 'col-1', 'folder-1', 'New req');
    expect(props.handleWbNewRequest).toHaveBeenCalledWith('col-1', 'folder-1', 'New req');

    h.call(h.requestsProps, 'onEditSubCollection', 'col-1', 'folder-1');
    expect(props.handleEditSubCollection).toHaveBeenCalledWith('col-1', 'folder-1');

    h.call(h.requestsProps, 'onSendCollectionToHarness', 'col-1');
    expect(props.setBatchHarnessTarget).toHaveBeenCalledWith({ colId: 'col-1' });

    h.call(h.requestsProps, 'onSendFolderToHarness', 'col-1', 'folder-1');
    expect(props.setBatchHarnessTarget).toHaveBeenCalledWith({ colId: 'col-1', folderId: 'folder-1' });

    act(() => {
      h.call(h.requestsProps, 'onExportToApiMock', 'col-1', 'req-1');
    });
    expect(screen.getByTestId('export-to-mock-modal')).toBeTruthy();
    expect(h.exportModalProps.items).toEqual([{
      method: 'GET',
      url: '/orders/1',
      headers: [{ key: 'Accept', value: 'application/json', enabled: true }],
      body: undefined,
      label: 'Get order',
    }]);

    act(() => {
      h.call(h.exportModalProps, 'onClose');
    });
    expect(screen.queryByTestId('export-to-mock-modal')).toBeNull();
  });

  it('ignores export to api mock when collection or request is missing', () => {
    const props = makeProps({
      activeTab: 'requests',
      wb: {
        ...makeProps().wb,
        collections: [],
      } as AppSidebarRegionProps['wb'],
    });
    render(<AppSidebarRegion {...props} />);
    act(() => {
      h.call(h.requestsProps, 'onExportToApiMock', 'missing', 'req-1');
    });
    expect(screen.queryByTestId('export-to-mock-modal')).toBeNull();

    const props2 = makeProps({ activeTab: 'requests' });
    render(<AppSidebarRegion {...props2} />);
    act(() => {
      h.call(h.requestsProps, 'onExportToApiMock', 'col-1', 'missing');
    });
    expect(screen.queryByTestId('export-to-mock-modal')).toBeNull();
  });

  it('clears export modal when leaving requests tab', () => {
    const props = makeProps({ activeTab: 'requests' });
    const { rerender } = render(<AppSidebarRegion {...props} />);
    act(() => {
      h.call(h.requestsProps, 'onExportToApiMock', 'col-1', 'req-1');
    });
    expect(screen.getByTestId('export-to-mock-modal')).toBeTruthy();

    rerender(<AppSidebarRegion {...props} activeTab="catalog" />);
    expect(screen.queryByTestId('export-to-mock-modal')).toBeNull();
  });

  it('renders workflow sidebar and wires callbacks', () => {
    const props = makeProps({ activeTab: 'workflow' });
    render(<AppSidebarRegion {...props} />);
    expect(screen.getByTestId('workflow-sidebar')).toBeTruthy();

    h.call(h.workflowProps, 'onSelect', 'wf-1');
    expect(props.wfHook.select).toHaveBeenCalledWith('wf-1');
    expect(props.setActiveTab).toHaveBeenCalledWith('workflow');

    h.call(h.workflowProps, 'onNew', 'My flow');
    expect(props.wfHook.create).toHaveBeenCalledWith('My flow');
    expect(props.setSidebarCollapsed).toHaveBeenCalledWith(true);

    h.call(h.workflowProps, 'onBrowseTemplates');
    expect(props.setGalleryInitialDomain).toHaveBeenCalledWith('workflows');
    expect(props.setActiveTab).toHaveBeenCalledWith('gallery');

    h.call(h.workflowProps, 'onRename', 'wf-1', 'Renamed');
    expect(props.wfHook.update).toHaveBeenCalledWith('wf-1', { name: 'Renamed' });

    h.call(h.workflowProps, 'onDelete', 'wf-1');
    expect(props.wfHook.remove).toHaveBeenCalledWith('wf-1');

    h.call(h.workflowProps, 'onDuplicate', 'wf-1');
    expect(props.wfHook.duplicate).toHaveBeenCalledWith('wf-1');

    h.call(h.workflowProps, 'onExport', 'wf-1');
    expect(props.handleWorkflowExport).toHaveBeenCalledWith('wf-1');

    h.call(h.workflowProps, 'onExportFolder', 'folder-1');
    expect(props.handleExportFolder).toHaveBeenCalledWith('folder-1');

    h.call(h.workflowProps, 'onImport');
    expect(props.handleWorkflowImport).toHaveBeenCalled();

    h.call(h.workflowProps, 'onToggleFolderCollapse', 'folder-1');
    expect(props.wfFolders.toggleCollapse).toHaveBeenCalledWith('folder-1');

    h.call(h.workflowProps, 'onSetFolderCollapsed', 'folder-1', true);
    expect(props.wfFolders.setCollapsed).toHaveBeenCalledWith('folder-1', true);

    h.call(h.workflowProps, 'onCreateFolder', 'New folder');
    expect(props.wfFolders.create).toHaveBeenCalledWith('New folder');

    h.call(h.workflowProps, 'onRenameFolder', 'folder-1', 'Renamed folder');
    expect(props.wfFolders.rename).toHaveBeenCalledWith('folder-1', 'Renamed folder');

    h.call(h.workflowProps, 'onDeleteFolder', 'folder-1');
    expect(props.wfFolders.remove).toHaveBeenCalledWith('folder-1', props.wfFolders.folders);

    h.call(h.workflowProps, 'onMoveFolder', 'folder-1', 'folder-2', 1);
    expect(props.wfFolders.move).toHaveBeenCalledWith('folder-1', 'folder-2', 1);

    h.call(h.workflowProps, 'onMoveWorkflowToFolder', 'wf-1', 'folder-1', 2);
    expect(props.wfHook.reorder).toHaveBeenCalledWith('wf-1', 'folder-1', 2);

    h.call(h.workflowProps, 'onMoveWorkflowsToFolder', ['wf-1', 'wf-2'], 'folder-1', 0);
    expect(props.wfHook.reorder).toHaveBeenCalledWith('wf-1', 'folder-1', 0);
    expect(props.wfHook.reorder).toHaveBeenCalledWith('wf-2', 'folder-1', 1);
  });

  it('renders harness sidebar on harness tabs', () => {
    const props = makeProps({ activeTab: 'scenarios' });
    render(<AppSidebarRegion {...props} />);
    expect(screen.getByTestId('harness-sidebar')).toBeTruthy();

    h.call(h.harnessProps, 'onEnvSelect', 'env-2');
    expect(props.setSelectedEnvId).toHaveBeenCalledWith('env-2');

    h.call(h.harnessProps, 'onSvcSelect', 'svc-2');
    expect(props.setSelectedSvcId).toHaveBeenCalledWith('svc-2');

    h.call(h.harnessProps, 'onSidebarViewChange', 'svc');
    expect(props.setSidebarView).toHaveBeenCalledWith('svc');
  });

  it('hides sidebar for settings, gallery, protocols, and demo domains', () => {
    for (const tab of ['preferences', 'gallery', 'kafka-message-studio', 'demo-hub'] as const) {
      const props = makeProps({ activeTab: tab });
      const { unmount } = render(<AppSidebarRegion {...props} />);
      expect(screen.queryByRole('complementary')).toBeNull();
      expect(screen.queryByText('⚙ Settings')).toBeNull();
      unmount();
    }
  });

  it('supports sidebar collapse toggle and resize handle', () => {
    const props = makeProps({ activeTab: 'requests', sidebarCollapsed: false });
    render(<AppSidebarRegion {...props} />);

    fireEvent.click(screen.getByTitle('Hide sidebar'));
    expect(props.setSidebarCollapsed).toHaveBeenCalledWith(true);

    fireEvent.mouseDown(document.querySelector('.usb-resize-handle')!);
    expect(props.handleResizeStart).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: '⚙ Settings' }));
    expect(props.setActiveTab).toHaveBeenCalledWith('preferences');
  });

  it('shows collapsed toggle when sidebar is collapsed', () => {
    const props = makeProps({ activeTab: 'requests', sidebarCollapsed: true });
    render(<AppSidebarRegion {...props} />);
    expect(screen.getByTitle('Show sidebar').textContent).toBe('▶');
    expect(document.querySelector('.usb-toggle-btn.collapsed')).toBeTruthy();
  });

  it('expands the sidebar when navigating to API Mock', () => {
    const props = makeProps({ activeTab: 'requests', sidebarCollapsed: true });
    const { rerender } = render(<AppSidebarRegion {...props} />);
    expect(props.setSidebarCollapsed).not.toHaveBeenCalled();

    rerender(<AppSidebarRegion {...props} activeTab="api-mock-studio" />);
    expect(props.setSidebarCollapsed).toHaveBeenCalledWith(false);
  });

  it('does not reopen the sidebar when the user hides it on API Mock', () => {
    const props = makeProps({ activeTab: 'api-mock-studio', sidebarCollapsed: false });
    render(<AppSidebarRegion {...props} />);
    props.setSidebarCollapsed.mockClear();

    fireEvent.click(screen.getByTitle('Hide sidebar'));
    expect(props.setSidebarCollapsed).toHaveBeenCalledWith(true);
    expect(props.setSidebarCollapsed).not.toHaveBeenCalledWith(false);
  });

  it('does not auto-expand API Mock during a live demo session', () => {
    beginDemoAppSidebarSession();
    const props = makeProps({ activeTab: 'requests', sidebarCollapsed: true });
    const { rerender } = render(<AppSidebarRegion {...props} />);
    rerender(<AppSidebarRegion {...props} activeTab="api-mock-studio" />);
    expect(props.setSidebarCollapsed).not.toHaveBeenCalledWith(false);
  });

  it('keeps the sidebar shown after the user clicks Show during a demo', () => {
    beginDemoAppSidebarSession();
    const props = makeProps({ activeTab: 'api-mock-studio', sidebarCollapsed: true });
    render(<AppSidebarRegion {...props} />);
    fireEvent.click(screen.getByTitle('Show sidebar'));
    expect(props.setSidebarCollapsed).toHaveBeenCalledWith(false);
    expect(isDemoAppSidebarPinned()).toBe(true);
  });

  it('skips catalog and requests sidebars when not loaded', () => {
    const props = makeProps({
      activeTab: 'requests',
      catalog: { ...makeProps().catalog, loaded: false } as AppSidebarRegionProps['catalog'],
      wb: { ...makeProps().wb, loaded: false } as AppSidebarRegionProps['wb'],
    });
    render(<AppSidebarRegion {...props} />);
    expect(screen.queryByTestId('catalog-sidebar')).toBeNull();
    expect(screen.queryByTestId('requests-sidebar')).toBeNull();
  });
});
