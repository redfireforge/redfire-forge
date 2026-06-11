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
vi.mock('./utils/requestTree', () => ({
  findAncestorSubCollection: (...args: unknown[]) => findAncestorSubCollection(...args),
}));

interface EditorProps {
  onUpdateRequest: (patch: Partial<RequestItem>) => void;
  onEnvChange: (id: string) => void;
  onSendToHarness?: () => void;
  isInHarness: boolean;
  parentSubCollection?: unknown;
}
let lastEditorProps: EditorProps | null = null;
vi.mock('./components/RequestEditor', () => ({
  default: (props: EditorProps) => {
    lastEditorProps = props;
    return (
      <div data-testid="request-editor">
        <button onClick={() => props.onUpdateRequest({ name: 'patched' })}>update</button>
        <button onClick={() => props.onEnvChange('env-x')}>env</button>
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

beforeEach(() => {
  lastEditorProps = null;
  findAncestorSubCollection.mockReset();
  findAncestorSubCollection.mockReturnValue(null);
});

describe('Requests', () => {
  it('shows loading state when not loaded', () => {
    render(<Requests wb={makeWb({ loaded: false })} appGlobalAuthProfiles={[]} appMicroservices={[]} appEnvironments={[]} />);
    expect(screen.getByText('Loading Requests...')).toBeInTheDocument();
  });

  it('renders empty state with create message when no collections', () => {
    render(<Requests wb={makeWb({ collections: [], selectedCollection: null, selectedRequest: null })} appGlobalAuthProfiles={[]} appMicroservices={[]} appEnvironments={[]} />);
    expect(screen.getByText('No Request Selected')).toBeInTheDocument();
    expect(screen.getByText(/Create a collection to get started/)).toBeInTheDocument();
  });

  it('renders empty state with select message when collections exist but none selected', () => {
    render(<Requests wb={makeWb({ selectedCollection: null, selectedRequest: null })} appGlobalAuthProfiles={[]} appMicroservices={[]} appEnvironments={[]} />);
    expect(screen.getByText(/Select a request from the sidebar/)).toBeInTheDocument();
  });

  it('renders the editor when a request is selected and wires update/env callbacks', () => {
    const updateRequest = vi.fn();
    const setSelectedEnvId = vi.fn();
    render(
      <Requests
        wb={makeWb({ updateRequest, setSelectedEnvId })}
        appGlobalAuthProfiles={[]}
        appMicroservices={[]}
        appEnvironments={[]}
        harnessRequestIds={new Set(['r1'])}
        onSendToHarness={vi.fn()}
      />,
    );
    expect(screen.getByTestId('request-editor')).toBeInTheDocument();
    expect(screen.getByTestId('in-harness')).toHaveTextContent('true');
    expect(screen.getByTestId('has-send')).toHaveTextContent('true');
    fireEvent.click(screen.getByText('update'));
    expect(updateRequest).toHaveBeenCalledWith('c1', 'r1', { name: 'patched' });
    fireEvent.click(screen.getByText('env'));
    expect(setSelectedEnvId).toHaveBeenCalledWith('env-x');
  });

  it('does not call updateRequest when collection or request is missing', () => {
    const updateRequest = vi.fn();
    render(
      <Requests
        wb={makeWb({ updateRequest, selectedRequest: null })}
        appGlobalAuthProfiles={[]}
        appMicroservices={[]}
        appEnvironments={[]}
      />,
    );
    // editor not rendered (no request) -> empty state
    expect(screen.queryByTestId('request-editor')).toBeNull();
  });

  it('resolves parent sub-collection via findAncestorSubCollection', () => {
    findAncestorSubCollection.mockReturnValue({ id: 'sub1', name: 'Sub', requests: [], folders: [] });
    render(<Requests wb={makeWb()} appGlobalAuthProfiles={[]} appMicroservices={[]} appEnvironments={[]} />);
    expect(findAncestorSubCollection).toHaveBeenCalled();
    expect(lastEditorProps?.parentSubCollection).toMatchObject({ id: 'sub1' });
  });

  describe('preview mode', () => {
    const preview: PreviewRequest = { collection, request: req, entryName: 'Gallery Sample' };

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
        />,
      );
      expect(screen.queryByText('Import')).toBeNull();
      expect(screen.queryByText(/Close Preview/)).toBeNull();
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
        />,
      );
      expect(screen.getByTestId('has-send')).toHaveTextContent('false');
      expect(screen.getByTestId('in-harness')).toHaveTextContent('false');
      fireEvent.click(screen.getByText('update'));
      expect(updateRequest).not.toHaveBeenCalled();
      fireEvent.click(screen.getByText('env'));
      // onEnvChange is a no-op in preview; nothing throws
    });
  });
});
