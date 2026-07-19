/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import Requests, { type PreviewRequest } from './Requests';
import type { UseRequestsReturn } from './hooks/useRequests';
import type { RequestCollection, RequestItem } from '../../shared/types';

const findAncestorSubCollection = vi.fn();
const findRequestInCollection = vi.fn();
vi.mock('./utils/requestTree', () => ({
  findAncestorSubCollection: (...args: unknown[]) => findAncestorSubCollection(...args),
  findRequestInCollection: (...args: unknown[]) => findRequestInCollection(...args),
}));

vi.mock('./components/RequestTabBar', () => ({
  RequestTabBar: () => <div data-testid="request-tab-bar" />,
}));

interface EditorProps {
  onUpdateRequest: (patch: Partial<RequestItem>) => void;
  onEnvChange: (id: string) => void;
  onSendToHarness?: () => void;
  isInHarness: boolean;
  parentSubCollection?: unknown;
  activeSubTab?: string;
  responseSubTab?: string;
  inputMode?: string;
  activeHistoryId?: string | null;
  onActiveSubTabChange?: (tab: string) => void;
  onResponseSubTabChange?: (tab: string) => void;
  onInputModeChange?: (mode: string) => void;
  onActiveHistoryIdChange?: (id: string | null) => void;
}
let lastEditorProps: EditorProps | null = null;
vi.mock('./components/RequestEditor', () => ({
  default: (props: EditorProps) => {
    lastEditorProps = props;
    return (
      <div data-testid="request-editor">
        <button onClick={() => props.onUpdateRequest({ name: 'patched' })}>update</button>
        <button onClick={() => props.onUpdateRequest({ name: '' })}>update-empty-name</button>
        <button onClick={() => props.onUpdateRequest({ method: 'POST' as RequestItem['method'] })}>update-no-name</button>
        <button onClick={() => props.onEnvChange('env-x')}>env</button>
        <button onClick={() => props.onActiveSubTabChange?.('auth')}>active-subtab</button>
        <button onClick={() => props.onResponseSubTabChange?.('console')}>response-subtab</button>
        <button onClick={() => props.onInputModeChange?.('raw')}>input-mode</button>
        <button onClick={() => props.onActiveHistoryIdChange?.('h2')}>active-history</button>
        <span data-testid="in-harness">{String(props.isInHarness)}</span>
        <span data-testid="has-send">{String(!!props.onSendToHarness)}</span>
      </div>
    );
  },
}));

const req: RequestItem = {
  id: 'r1',
  name: 'Ping',
  method: 'GET',
  url: '/health',
  headers: [],
  body: '',
  auth: { type: 'none' },
};

const collection: RequestCollection = {
  id: 'c1',
  name: 'API',
  mode: 'direct',
  requests: [req],
  folders: [],
};

function makeWb(overrides: Partial<UseRequestsReturn> = {}): UseRequestsReturn {
  return {
    loaded: true,
    collections: [collection],
    selectedCollection: collection,
    selectedRequest: req,
    environments: [],
    selectedEnvId: undefined,
    setSelectedEnvId: vi.fn(),
    updateRequest: vi.fn(),
    ...overrides,
  } as unknown as UseRequestsReturn;
}

import type { RequestTab } from '../../shared/types';

const defaultTabProps = {
  tabs: [] as RequestTab[],
  activeTabId: '',
  activeTab: null as RequestTab | null,
  onSelectTab: vi.fn(),
  onCloseTab: vi.fn(),
  onAddTab: vi.fn(),
  onRenameTab: vi.fn(),
  onEnvChange: vi.fn(),
  onUpdateTabUI: vi.fn(),
};

beforeEach(() => {
  lastEditorProps = null;
  findAncestorSubCollection.mockReset();
  findAncestorSubCollection.mockReturnValue(null);
  findRequestInCollection.mockReset();
  findRequestInCollection.mockReturnValue(null);
});

describe('Requests', () => {
  it('shows loading state when not loaded', () => {
    render(<Requests wb={makeWb({ loaded: false })} appGlobalAuthProfiles={[]} appMicroservices={[]} appEnvironments={[]} {...defaultTabProps} />);
    expect(screen.getByText('Loading Requests...')).toBeInTheDocument();
  });

  it('renders empty state with create message when no collections', () => {
    render(<Requests wb={makeWb({ collections: [], selectedCollection: null, selectedRequest: null })} appGlobalAuthProfiles={[]} appMicroservices={[]} appEnvironments={[]} {...defaultTabProps} />);
    expect(screen.getByText('No Request Selected')).toBeInTheDocument();
    expect(screen.getByText(/Create a collection to get started/)).toBeInTheDocument();
  });

  it('renders empty state with select message when collections exist but none selected', () => {
    render(<Requests wb={makeWb({ selectedCollection: null, selectedRequest: null })} appGlobalAuthProfiles={[]} appMicroservices={[]} appEnvironments={[]} {...defaultTabProps} />);
    expect(screen.getByText(/Select a request from the sidebar/)).toBeInTheDocument();
  });

  it('renders the editor when a request is selected and wires update/env callbacks', () => {
    const updateRequest = vi.fn();
    const onEnvChange = vi.fn();
    render(
      <Requests
        wb={makeWb({ updateRequest })}
        appGlobalAuthProfiles={[]}
        appMicroservices={[]}
        appEnvironments={[]}
        harnessRequestIds={new Set(['r1'])}
        onSendToHarness={vi.fn()}
        {...defaultTabProps}
        onEnvChange={onEnvChange}
      />,
    );
    expect(screen.getByTestId('request-editor')).toBeInTheDocument();
    expect(screen.getByTestId('in-harness')).toHaveTextContent('true');
    expect(screen.getByTestId('has-send')).toHaveTextContent('true');
    fireEvent.click(screen.getByText('update'));
    expect(updateRequest).toHaveBeenCalledWith('c1', 'r1', { name: 'patched' });
    fireEvent.click(screen.getByText('env'));
    expect(onEnvChange).toHaveBeenCalledWith('env-x');
  });

  it('updates the request even when no sync-tab-label callback is provided', () => {
    const updateRequest = vi.fn();
    render(
      <Requests
        wb={makeWb({ updateRequest })}
        appGlobalAuthProfiles={[]}
        appMicroservices={[]}
        appEnvironments={[]}
        {...defaultTabProps}
      />, 
    );

    fireEvent.click(screen.getByText('update'));
    expect(updateRequest).toHaveBeenCalledWith('c1', 'r1', { name: 'patched' });
  });

  it('does not call updateRequest when collection or request is missing', () => {
    const updateRequest = vi.fn();
    render(
      <Requests
        wb={makeWb({ updateRequest, selectedRequest: null })}
        appGlobalAuthProfiles={[]}
        appMicroservices={[]}
        appEnvironments={[]}
        {...defaultTabProps}
      />,
    );
    expect(screen.queryByTestId('request-editor')).toBeNull();
  });

  it('resolves parent sub-collection via findAncestorSubCollection', () => {
    findAncestorSubCollection.mockReturnValue({ id: 'sub1', name: 'Sub', requests: [], folders: [] });
    render(<Requests wb={makeWb()} appGlobalAuthProfiles={[]} appMicroservices={[]} appEnvironments={[]} {...defaultTabProps} />);
    expect(findAncestorSubCollection).toHaveBeenCalled();
    expect(lastEditorProps?.parentSubCollection).toMatchObject({ id: 'sub1' });
  });

  it('uses empty folders fallback when selected collection folders are undefined', () => {
    const colWithNoFolders = { ...collection, folders: undefined as unknown as RequestCollection['folders'] };
    render(
      <Requests
        wb={makeWb({ collections: [colWithNoFolders], selectedCollection: colWithNoFolders })}
        appGlobalAuthProfiles={[]}
        appMicroservices={[]}
        appEnvironments={[]}
        {...defaultTabProps}
      />,
    );
    expect(findAncestorSubCollection).toHaveBeenCalledWith([], 'r1');
  });

  it('renders tab bar when tabs exist outside preview and wires tab UI callbacks', () => {
    const onUpdateTabUI = vi.fn();
    const tab = {
      id: 'tab-1',
      collectionId: 'c1',
      requestId: 'r1',
      label: 'Ping',
      activeSubTab: 'params' as const,
      responseSubTab: 'preview' as const,
      inputMode: 'builder' as const,
      activeHistoryId: null,
    };
    findRequestInCollection.mockImplementation((col: RequestCollection, requestId: string) =>
      col.id === 'c1' && requestId === 'r1' ? req : null,
    );

    render(
      <Requests
        wb={makeWb()}
        appGlobalAuthProfiles={[]}
        appMicroservices={[]}
        appEnvironments={[]}
        {...defaultTabProps}
        tabs={[tab]}
        activeTabId="tab-1"
        activeTab={tab}
        onUpdateTabUI={onUpdateTabUI}
      />,
    );

    expect(screen.getByTestId('request-tab-bar')).toBeInTheDocument();
    fireEvent.click(screen.getByText('active-subtab'));
    fireEvent.click(screen.getByText('response-subtab'));
    fireEvent.click(screen.getByText('input-mode'));
    fireEvent.click(screen.getByText('active-history'));

    expect(onUpdateTabUI).toHaveBeenCalledWith('tab-1', { activeSubTab: 'auth' });
    expect(onUpdateTabUI).toHaveBeenCalledWith('tab-1', { responseSubTab: 'console' });
    expect(onUpdateTabUI).toHaveBeenCalledWith('tab-1', { inputMode: 'raw' });
    expect(onUpdateTabUI).toHaveBeenCalledWith('tab-1', { activeHistoryId: 'h2' });
  });

  it('does not emit tab UI updates when no active tab is present', () => {
    const onUpdateTabUI = vi.fn();
    render(
      <Requests
        wb={makeWb()}
        appGlobalAuthProfiles={[]}
        appMicroservices={[]}
        appEnvironments={[]}
        {...defaultTabProps}
        onUpdateTabUI={onUpdateTabUI}
      />,
    );

    fireEvent.click(screen.getByText('active-subtab'));
    fireEvent.click(screen.getByText('response-subtab'));
    fireEvent.click(screen.getByText('input-mode'));
    fireEvent.click(screen.getByText('active-history'));
    expect(onUpdateTabUI).not.toHaveBeenCalled();
  });

  it('falls back to selected collection/request when active tab points to a missing collection', () => {
    const tab = {
      id: 'tab-missing-col',
      collectionId: 'missing-collection',
      requestId: 'missing-request',
      label: 'Missing',
    };

    render(
      <Requests
        wb={makeWb()}
        appGlobalAuthProfiles={[]}
        appMicroservices={[]}
        appEnvironments={[]}
        {...defaultTabProps}
        tabs={[tab] as unknown as RequestTab[]}
        activeTabId="tab-missing-col"
        activeTab={tab as unknown as RequestTab}
      />,
    );

    expect(screen.getByTestId('request-editor')).toBeInTheDocument();
  });

  it('computes method map from valid tab requests and skips missing collection/request entries', () => {
    const tabValid = { id: 't-valid', collectionId: 'c1', requestId: 'r1', label: 'Valid' };
    const tabMissingCollection = { id: 't-missing-col', collectionId: 'missing', requestId: 'r1', label: 'Missing Col' };
    const tabMissingRequest = { id: 't-missing-req', collectionId: 'c1', requestId: 'missing', label: 'Missing Req' };

    findRequestInCollection.mockImplementation((col: RequestCollection, requestId: string) =>
      col.id === 'c1' && requestId === 'r1' ? req : null,
    );

    render(
      <Requests
        wb={makeWb()}
        appGlobalAuthProfiles={[]}
        appMicroservices={[]}
        appEnvironments={[]}
        {...defaultTabProps}
        tabs={[tabValid, tabMissingCollection, tabMissingRequest] as unknown as RequestTab[]}
        activeTabId="t-valid"
        activeTab={tabValid as unknown as RequestTab}
      />,
    );

    expect(findRequestInCollection).toHaveBeenCalledWith(collection, 'r1');
    expect(findRequestInCollection).toHaveBeenCalledWith(collection, 'missing');
  });

  it('syncs tab label using explicit name, request url fallback, and Untitled fallback', () => {
    const updateRequest = vi.fn();
    const onSyncTabLabel = vi.fn();
    const noNameRequest = { ...req, name: '', url: '/from-url' };
    render(
      <Requests
        wb={makeWb({ selectedRequest: noNameRequest, updateRequest })}
        appGlobalAuthProfiles={[]}
        appMicroservices={[]}
        appEnvironments={[]}
        {...defaultTabProps}
        onSyncTabLabel={onSyncTabLabel}
      />,
    );

    fireEvent.click(screen.getByText('update'));
    fireEvent.click(screen.getByText('update-empty-name'));
    fireEvent.click(screen.getByText('update-no-name'));
    expect(onSyncTabLabel).toHaveBeenCalledWith('r1', 'patched');
    expect(onSyncTabLabel).toHaveBeenCalledWith('r1', '/from-url');
    expect(onSyncTabLabel).toHaveBeenCalledTimes(2);
  });

  it('uses Untitled fallback when both updated name and request url are empty', () => {
    const onSyncTabLabel = vi.fn();
    const noNameNoUrlRequest = { ...req, name: '', url: '' };
    render(
      <Requests
        wb={makeWb({ selectedRequest: noNameNoUrlRequest })}
        appGlobalAuthProfiles={[]}
        appMicroservices={[]}
        appEnvironments={[]}
        {...defaultTabProps}
        onSyncTabLabel={onSyncTabLabel}
      />,
    );

    fireEvent.click(screen.getByText('update-empty-name'));
    expect(onSyncTabLabel).toHaveBeenCalledWith('r1', 'Untitled');
  });

  describe('preview mode', () => {
    const preview: PreviewRequest = { collection, request: req, entryName: 'Gallery Sample' };

    it('hides the tab bar when preview mode is active even if tabs exist', () => {
      render(
        <Requests
          wb={makeWb({ selectedCollection: null, selectedRequest: null })}
          appGlobalAuthProfiles={[]}
          appMicroservices={[]}
          appEnvironments={[]}
          previewRequest={preview}
          {...defaultTabProps}
          tabs={[{ id: 'tab-1', collectionId: 'c1', requestId: 'r1', label: 'Alpha', activeSubTab: 'params', responseSubTab: 'preview', inputMode: 'builder' }] as RequestTab[]}
          activeTabId="tab-1"
          activeTab={{ id: 'tab-1', collectionId: 'c1', requestId: 'r1', label: 'Alpha', activeSubTab: 'params', responseSubTab: 'preview', inputMode: 'builder' }}
        />,
      );

      expect(screen.queryByTestId('request-tab-bar')).toBeNull();
    });

    it('renders preview banner with import and close buttons', () => {
      const onImportPreview = vi.fn();
      const onClearPreview = vi.fn();
      render(
        <Requests
          wb={makeWb({ selectedCollection: null, selectedRequest: null })}
          appGlobalAuthProfiles={[]}
          appMicroservices={[]}
          appEnvironments={[]}
          previewRequest={preview}
          onImportPreview={onImportPreview}
          onClearPreview={onClearPreview}
          {...defaultTabProps}
        />,
      );
      expect(screen.getByText('Gallery Sample')).toBeInTheDocument();
      fireEvent.click(screen.getByText('Import'));
      expect(onImportPreview).toHaveBeenCalled();
      fireEvent.click(screen.getByText(/Close Preview/));
      expect(onClearPreview).toHaveBeenCalled();
    });

    it('renders preview banner without optional action buttons', () => {
      render(
        <Requests
          wb={makeWb({ selectedCollection: null, selectedRequest: null })}
          appGlobalAuthProfiles={[]}
          appMicroservices={[]}
          appEnvironments={[]}
          previewRequest={preview}
          {...defaultTabProps}
        />,
      );
      expect(screen.queryByText('Import')).toBeNull();
      expect(screen.queryByText(/Close Preview/)).toBeNull();
    });

    it('does not pass tab-driven sub-state props in preview mode', () => {
      const activeTab = {
        id: 'tab-1',
        collectionId: 'c1',
        requestId: 'r1',
        label: 'Alpha',
        activeSubTab: 'auth' as const,
        responseSubTab: 'console' as const,
        inputMode: 'curlExport' as const,
        activeHistoryId: 'h-1',
      };
      render(
        <Requests
          wb={makeWb()}
          appGlobalAuthProfiles={[]}
          appMicroservices={[]}
          appEnvironments={[]}
          previewRequest={preview}
          {...defaultTabProps}
          tabs={[activeTab]}
          activeTabId="tab-1"
          activeTab={activeTab}
        />,
      );
      expect(lastEditorProps?.activeSubTab).toBeUndefined();
      expect(lastEditorProps?.responseSubTab).toBeUndefined();
      expect(lastEditorProps?.inputMode).toBeUndefined();
      expect(lastEditorProps?.activeHistoryId).toBeUndefined();
      expect(lastEditorProps?.onActiveSubTabChange).toBeUndefined();
      expect(lastEditorProps?.onResponseSubTabChange).toBeUndefined();
      expect(lastEditorProps?.onInputModeChange).toBeUndefined();
      expect(lastEditorProps?.onActiveHistoryIdChange).toBeUndefined();
    });

    it('makes preview editor read-only (update is a no-op, send hidden)', () => {
      const updateRequest = vi.fn();
      render(
        <Requests
          wb={makeWb({ updateRequest })}
          appGlobalAuthProfiles={[]}
          appMicroservices={[]}
          appEnvironments={[]}
          previewRequest={preview}
          onSendToHarness={vi.fn()}
          harnessRequestIds={new Set(['r1'])}
          {...defaultTabProps}
        />,
      );
      expect(screen.getByTestId('has-send')).toHaveTextContent('false');
      expect(screen.getByTestId('in-harness')).toHaveTextContent('false');
      fireEvent.click(screen.getByText('update'));
      expect(updateRequest).not.toHaveBeenCalled();
      fireEvent.click(screen.getByText('env'));
    });
  });
});
