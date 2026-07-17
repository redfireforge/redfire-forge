/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FIXTURE_UNARY_CALL_REQUEST } from '../../../shared/grpc/contractFixtures';
import { GrpcSaveRequestModal } from './GrpcSaveRequestModal';

const TS = '2026-06-29T12:00:00.000Z';

function makeSnapshot(body: Record<string, unknown> = { message: 'hi' }) {
  return {
    tabId: 'tab-1',
    requestId: 'req-1',
    capturedAt: TS,
    callType: 'unary' as const,
    target: FIXTURE_UNARY_CALL_REQUEST.target,
    service: FIXTURE_UNARY_CALL_REQUEST.service,
    method: FIXTURE_UNARY_CALL_REQUEST.method,
    body,
    metadata: {},
    timeoutMs: 30_000,
    descriptorKey: 'desc-1',
  };
}

function snapshotResult(body: Record<string, unknown> = { message: 'hi' }) {
  return { snapshot: makeSnapshot(body) };
}

describe('GrpcSaveRequestModal (Phase 5H)', () => {
  it('does not render when closed', () => {
    render(
      <GrpcSaveRequestModal
        open={false}
        collections={[]}
        resolveSnapshot={() => snapshotResult()}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('grpc-save-request-modal')).toBeNull();
  });

  it('prefills name and saves to selected collection', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    render(
      <GrpcSaveRequestModal
        open
        collections={[{ id: 'col-1', name: 'Default', savedRequests: [] }]}
        resolveSnapshot={() => snapshotResult()}
        onClose={onClose}
        onSave={onSave}
      />,
    );

    expect(screen.getByTestId('grpc-save-request-name')).toHaveProperty(
      'value',
      `${FIXTURE_UNARY_CALL_REQUEST.service}/${FIXTURE_UNARY_CALL_REQUEST.method}`,
    );

    fireEvent.click(screen.getByTestId('grpc-save-request-submit'));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][0]).toBe('col-1');
    expect(onSave.mock.calls[0][1].service).toBe(FIXTURE_UNARY_CALL_REQUEST.service);
    expect(onClose).toHaveBeenCalled();
  });

  it('passes tabContext from resolveSnapshot into saved request', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <GrpcSaveRequestModal
        open
        collections={[{ id: 'col-1', name: 'Default', savedRequests: [] }]}
        resolveSnapshot={() => ({
          snapshot: makeSnapshot(),
          tabContext: { connectionId: 'profile-staging', rawTarget: '{{grpcHost}}' },
        })}
        onClose={vi.fn()}
        onSave={onSave}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-save-request-submit'));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][1].connectionId).toBe('profile-staging');
    expect(onSave.mock.calls[0][1].target).toBe('{{grpcHost}}');
  });

  it('re-resolves snapshot on submit so body edits while modal is open are captured', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const resolveSnapshot = vi.fn()
      .mockReturnValueOnce(snapshotResult({ message: 'stale' }))
      .mockReturnValueOnce(snapshotResult({ message: 'fresh' }));

    render(
      <GrpcSaveRequestModal
        open
        collections={[{ id: 'col-1', name: 'Default', savedRequests: [] }]}
        resolveSnapshot={resolveSnapshot}
        onClose={vi.fn()}
        onSave={onSave}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-save-request-submit'));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(resolveSnapshot).toHaveBeenCalledTimes(2);
    expect(onSave.mock.calls[0][1].body).toEqual({ message: 'fresh' });
  });

  it('creates a collection when none selected but new name provided', async () => {
    const onCreateCollection = vi.fn().mockResolvedValue({ id: 'col-new', name: 'New', savedRequests: [] });
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <GrpcSaveRequestModal
        open
        collections={[]}
        resolveSnapshot={() => snapshotResult()}
        onClose={vi.fn()}
        onCreateCollection={onCreateCollection}
        onSave={onSave}
      />,
    );

    fireEvent.change(screen.getByTestId('grpc-save-request-new-collection'), { target: { value: 'New' } });
    fireEvent.click(screen.getByTestId('grpc-save-request-submit'));

    await waitFor(() => expect(onCreateCollection).toHaveBeenCalledWith('New'));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith('col-new', expect.any(Object)));
  });

  it('auto-creates default collection when none exist and user only fills request name', async () => {
    const onCreateCollection = vi.fn().mockResolvedValue({ id: 'col-auto', name: 'Saved Requests', savedRequests: [] });
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <GrpcSaveRequestModal
        open
        collections={[]}
        resolveSnapshot={() => snapshotResult()}
        onClose={vi.fn()}
        onCreateCollection={onCreateCollection}
        onSave={onSave}
      />,
    );

    expect(screen.getByTestId('grpc-save-request-new-collection')).toHaveProperty('value', 'Saved Requests');
    fireEvent.click(screen.getByTestId('grpc-save-request-submit'));

    await waitFor(() => expect(onCreateCollection).toHaveBeenCalledWith('Saved Requests'));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith('col-auto', expect.any(Object)));
  });

  it('creates a new collection when name is provided and collections already exist', async () => {
    const onCreateCollection = vi.fn().mockResolvedValue({ id: 'col-staging', name: 'Staging', savedRequests: [] });
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <GrpcSaveRequestModal
        open
        collections={[{ id: 'col-1', name: 'Default', savedRequests: [] }]}
        resolveSnapshot={() => snapshotResult()}
        onClose={vi.fn()}
        onCreateCollection={onCreateCollection}
        onSave={onSave}
      />,
    );

    fireEvent.change(screen.getByTestId('grpc-save-request-new-collection'), { target: { value: 'Staging' } });
    fireEvent.click(screen.getByTestId('grpc-save-request-submit'));

    await waitFor(() => expect(onCreateCollection).toHaveBeenCalledWith('Staging'));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith('col-staging', expect.any(Object)));
  });

  it('reuses existing collection when new collection name matches an existing one', async () => {
    const onCreateCollection = vi.fn();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <GrpcSaveRequestModal
        open
        collections={[
          { id: 'col-1', name: 'Default', savedRequests: [] },
          { id: 'col-2', name: 'Staging', savedRequests: [] },
        ]}
        resolveSnapshot={() => snapshotResult()}
        onClose={vi.fn()}
        onCreateCollection={onCreateCollection}
        onSave={onSave}
      />,
    );

    fireEvent.change(screen.getByTestId('grpc-save-request-new-collection'), { target: { value: 'Staging' } });
    fireEvent.click(screen.getByTestId('grpc-save-request-submit'));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith('col-2', expect.any(Object)));
    expect(onCreateCollection).not.toHaveBeenCalled();
  });

  it('shows an error when snapshot is no longer valid on submit', async () => {
    const onSave = vi.fn();
    const resolveSnapshot = vi.fn()
      .mockReturnValueOnce(snapshotResult())
      .mockReturnValueOnce({ snapshot: null });

    render(
      <GrpcSaveRequestModal
        open
        collections={[{ id: 'col-1', name: 'Default', savedRequests: [] }]}
        resolveSnapshot={resolveSnapshot}
        onClose={vi.fn()}
        onSave={onSave}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-save-request-submit'));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/configure the request/i);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('shows prepare error message when snapshot preparation fails on submit', async () => {
    const onSave = vi.fn();
    render(
      <GrpcSaveRequestModal
        open
        collections={[{ id: 'col-1', name: 'Default', savedRequests: [] }]}
        resolveSnapshot={() => ({
          snapshot: null,
          errorMessage: 'descriptorKey is required before executing a call',
        })}
        onClose={vi.fn()}
        onSave={onSave}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-save-request-submit'));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/descriptorKey is required/i);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('closes on Escape when not busy', () => {
    const onClose = vi.fn();
    render(
      <GrpcSaveRequestModal
        open
        collections={[{ id: 'col-1', name: 'Default', savedRequests: [] }]}
        resolveSnapshot={() => snapshotResult()}
        onClose={onClose}
        onSave={vi.fn()}
      />,
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
