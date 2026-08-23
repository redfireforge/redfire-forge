/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { getCustomSelectValue, selectOption } from '../../../test-utils/customSelectHelper';
import { FIXTURE_UNARY_CALL_REQUEST } from '@shared/grpc/contractFixtures';
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

describe('GrpcSaveRequestModal coverage gaps', () => {
  it('uses defaultName when provided', () => {
    render(
      <GrpcSaveRequestModal
        open
        collections={[{ id: 'col-1', name: 'Default', savedRequests: [] }]}
        resolveSnapshot={() => ({ snapshot: makeSnapshot() })}
        defaultName="Custom Name"
        onClose={vi.fn()}
        onSave={vi.fn()}
      />,
    );
    expect(screen.getByTestId('grpc-save-request-name')).toHaveProperty('value', 'Custom Name');
  });

  it('shows hint when preview snapshot is missing and no error', () => {
    render(
      <GrpcSaveRequestModal
        open
        collections={[]}
        resolveSnapshot={() => ({ snapshot: null })}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />,
    );
    expect(screen.getByText(/Select a method and configure/i)).toBeTruthy();
  });

  it('updates name and collection via controlled inputs', () => {
    render(
      <GrpcSaveRequestModal
        open
        collections={[
          { id: 'col-1', name: 'Default', savedRequests: [] },
          { id: 'col-2', name: 'Staging', savedRequests: [] },
        ]}
        resolveSnapshot={() => ({ snapshot: makeSnapshot() })}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByTestId('grpc-save-request-name'), { target: { value: 'Renamed' } });
    selectOption(screen.getByTestId('grpc-save-request-collection'), 'Staging');

    expect(screen.getByTestId('grpc-save-request-name')).toHaveProperty('value', 'Renamed');
    expect(getCustomSelectValue(screen.getByTestId('grpc-save-request-collection'))).toBe('Staging');
  });

  it('does not close on Escape while busy', async () => {
    const onClose = vi.fn();
    let resolveSave: (() => void) | undefined;
    const onSave = vi.fn(() => new Promise<void>((resolve) => {
      resolveSave = resolve;
    }));

    render(
      <GrpcSaveRequestModal
        open
        collections={[{ id: 'col-1', name: 'Default', savedRequests: [] }]}
        resolveSnapshot={() => ({ snapshot: makeSnapshot() })}
        onClose={onClose}
        onSave={onSave}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-save-request-submit'));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();

    resolveSave?.();
    await waitFor(() => expect(onSave).toHaveBeenCalled());
  });

  it('shows error when save throws a non-Error value', async () => {
    const onSave = vi.fn().mockRejectedValue('boom');
    render(
      <GrpcSaveRequestModal
        open
        collections={[{ id: 'col-1', name: 'Default', savedRequests: [] }]}
        resolveSnapshot={() => ({ snapshot: makeSnapshot() })}
        onClose={vi.fn()}
        onSave={onSave}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-save-request-submit'));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('Failed to save request');
  });

  it('surfaces save Error message when onSave rejects', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('disk full'));
    render(
      <GrpcSaveRequestModal
        open
        collections={[{ id: 'col-1', name: 'Default', savedRequests: [] }]}
        resolveSnapshot={() => ({ snapshot: makeSnapshot() })}
        onClose={vi.fn()}
        onSave={onSave}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-save-request-submit'));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('disk full');
  });

  it('surfaces error when onCreateCollection rejects', async () => {
    const onCreateCollection = vi.fn().mockRejectedValue(new Error('create failed'));
    render(
      <GrpcSaveRequestModal
        open
        collections={[]}
        resolveSnapshot={() => ({ snapshot: makeSnapshot() })}
        onClose={vi.fn()}
        onCreateCollection={onCreateCollection}
        onSave={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-save-request-submit'));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('create failed');
  });

  it('cancel button invokes onClose', () => {
    const onClose = vi.fn();
    render(
      <GrpcSaveRequestModal
        open
        collections={[{ id: 'col-1', name: 'Default', savedRequests: [] }]}
        resolveSnapshot={() => ({ snapshot: makeSnapshot() })}
        onClose={onClose}
        onSave={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('grpc-save-request-cancel'));
    expect(onClose).toHaveBeenCalled();
  });
});
