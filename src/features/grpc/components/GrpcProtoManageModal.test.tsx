/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createDefaultProtoIngestState } from '../grpcStudioTypes';
import { FIXTURE_DESCRIPTOR } from '../../../shared/grpc/contractFixtures';
import { GrpcProtoManageModal } from './GrpcProtoManageModal';

describe('GrpcProtoManageModal', () => {
  const baseProps = {
    open: true,
    ingest: createDefaultProtoIngestState(),
    loadState: 'idle' as const,
    onClose: vi.fn(),
    onIngestChange: vi.fn(),
    onLoad: vi.fn(),
  };

  it('renders proto files tab by default', () => {
    render(<GrpcProtoManageModal {...baseProps} />);
    expect(screen.getByTestId('grpc-proto-manage-modal')).toBeTruthy();
    expect(screen.getByTestId('grpc-proto-upload-zone')).toBeTruthy();
    expect(screen.getByTestId('grpc-proto-load-btn')).toHaveProperty('disabled', true);
    expect(screen.getByTestId('grpc-proto-tab-hint-proto_files')).toBeTruthy();
  });

  it('renders draggable header with grip', () => {
    render(<GrpcProtoManageModal {...baseProps} />);
    const header = screen.getByTestId('grpc-proto-modal-header');
    expect(header.className).toContain('grpc-proto-modal-header--draggable');
    expect(header.querySelector('.grpc-proto-modal-drag-grip')).toBeTruthy();
  });

  it('shows contextual tab hint when switching tabs', () => {
    render(<GrpcProtoManageModal {...baseProps} />);
    fireEvent.click(screen.getByTestId('grpc-proto-tab-url'));
    expect(screen.getByTestId('grpc-proto-tab-hint-url_proto')).toBeTruthy();
  });

  it('switches to protoset tab', () => {
    render(<GrpcProtoManageModal {...baseProps} />);
    fireEvent.click(screen.getByTestId('grpc-proto-tab-protoset'));
    expect(baseProps.onIngestChange).toHaveBeenCalledWith({ source: 'protoset' });
    expect(screen.getByTestId('grpc-proto-protoset-zone')).toBeTruthy();
  });

  it('shows protoset summary when a file is staged', () => {
    render(
      <GrpcProtoManageModal
        {...baseProps}
        ingest={{
          ...createDefaultProtoIngestState(),
          source: 'protoset',
          protosetFileName: 'echo.protoset',
          protosetBase64: 'cHJvdG8=',
        }}
      />,
    );

    expect(screen.getByTestId('grpc-proto-protoset-summary')).toBeTruthy();
    expect(screen.getByTestId('grpc-proto-protoset-status').textContent).toContain('Ready to load');
    expect(screen.getByTestId('grpc-proto-protoset-meta').textContent).toContain('Binary size');
  });

  it('clears staged protoset selection from summary action', () => {
    const onIngestChange = vi.fn();
    render(
      <GrpcProtoManageModal
        {...baseProps}
        onIngestChange={onIngestChange}
        ingest={{
          ...createDefaultProtoIngestState(),
          source: 'protoset',
          protosetFileName: 'echo.protoset',
          protosetBase64: 'cHJvdG8=',
        }}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-proto-protoset-clear'));
    expect(onIngestChange).toHaveBeenCalledWith({
      source: 'protoset',
      protosetBase64: undefined,
      protosetFileName: undefined,
    });
  });

  it('switches to URL tab', () => {
    render(<GrpcProtoManageModal {...baseProps} />);
    fireEvent.click(screen.getByTestId('grpc-proto-tab-url'));
    expect(baseProps.onIngestChange).toHaveBeenCalledWith({ source: 'url_proto' });
    expect(screen.getByTestId('grpc-proto-url-input')).toBeTruthy();
  });

  it('switches to BSR tab', () => {
    render(<GrpcProtoManageModal {...baseProps} />);
    fireEvent.click(screen.getByTestId('grpc-proto-tab-bsr'));
    expect(baseProps.onIngestChange).toHaveBeenCalledWith({ source: 'bsr' });
    expect(screen.getByTestId('grpc-proto-bsr-module-input')).toBeTruthy();
  });

  it('shows schema browser tab when descriptor is loaded', () => {
    render(
      <GrpcProtoManageModal
        {...baseProps}
        descriptor={FIXTURE_DESCRIPTOR}
        targetAddress="localhost:50051"
        initialTab="schema_browser"
      />,
    );
    expect(screen.getByTestId('grpc-proto-tab-schema-browser')).toBeTruthy();
    expect(screen.getByTestId('grpc-schema-browser')).toBeTruthy();
    expect(screen.queryByTestId('grpc-proto-load-btn')).toBeNull();
  });

  it('keeps schema browser tab when ingest source changes while modal stays open', () => {
    const { rerender } = render(
      <GrpcProtoManageModal
        {...baseProps}
        descriptor={FIXTURE_DESCRIPTOR}
        targetAddress="localhost:50051"
        initialTab="schema_browser"
      />,
    );

    expect(screen.getByTestId('grpc-schema-browser')).toBeTruthy();

    rerender(
      <GrpcProtoManageModal
        {...baseProps}
        open
        ingest={{ ...createDefaultProtoIngestState(), source: 'protoset' }}
        descriptor={FIXTURE_DESCRIPTOR}
        targetAddress="localhost:50051"
        initialTab="schema_browser"
      />,
    );

    expect(screen.getByTestId('grpc-schema-browser')).toBeTruthy();
    expect(screen.queryByTestId('grpc-proto-protoset-zone')).toBeNull();
  });

  it('disables schema browser tab without descriptor', () => {
    render(<GrpcProtoManageModal {...baseProps} />);
    expect((screen.getByTestId('grpc-proto-tab-schema-browser') as HTMLButtonElement).disabled).toBe(true);
  });

  it('enables load when proto files are present', () => {
    render(
      <GrpcProtoManageModal
        {...baseProps}
        ingest={{
          ...createDefaultProtoIngestState(),
          protoRoots: [{ id: 'root-default', mountPath: 'root', files: [{ path: 'echo.proto', content: 'syntax = "proto3";', sizeBytes: 20 }] }],
        }}
      />,
    );
    expect(screen.getByTestId('grpc-proto-load-btn')).toHaveProperty('disabled', false);
  });

  it('closes on Escape', () => {
    render(<GrpcProtoManageModal {...baseProps} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(baseProps.onClose).toHaveBeenCalled();
  });

  it('does not close on Escape while loading', () => {
    const onClose = vi.fn();
    render(
      <GrpcProtoManageModal
        {...baseProps}
        loadState="loading"
        onClose={onClose}
      />,
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('does not close on Escape after loadState transitions idle to loading', () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <GrpcProtoManageModal
        {...baseProps}
        loadState="idle"
        onClose={onClose}
      />,
    );
    rerender(
      <GrpcProtoManageModal
        {...baseProps}
        loadState="loading"
        onClose={onClose}
      />,
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('does not close on overlay click while loading', () => {
    const onClose = vi.fn();
    const { container } = render(
      <GrpcProtoManageModal
        {...baseProps}
        loadState="loading"
        onClose={onClose}
      />,
    );
    const overlay = container.querySelector('.grpc-proto-modal-overlay');
    expect(overlay).toBeTruthy();
    fireEvent.mouseDown(overlay!);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('removes a root from the root list', () => {
    const onIngestChange = vi.fn();
    render(
      <GrpcProtoManageModal
        {...baseProps}
        onIngestChange={onIngestChange}
        ingest={{
          ...createDefaultProtoIngestState(),
          protoRoots: [
            { id: 'r1', mountPath: 'shared', files: [] },
            { id: 'r2', mountPath: 'api', files: [] },
          ],
        }}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-proto-root-remove-r2'));
    expect(onIngestChange).toHaveBeenCalledWith(expect.objectContaining({
      source: 'proto_files',
      protoRoots: [expect.objectContaining({ id: 'r1' })],
    }));
  });

  it('merges newly uploaded proto files with existing draft', async () => {
    const onIngestChange = vi.fn();
    render(
      <GrpcProtoManageModal
        {...baseProps}
        ingest={{
          ...createDefaultProtoIngestState(),
          protoRoots: [{ id: 'root-default', mountPath: 'root', files: [{ path: 'existing.proto', content: 'syntax = "proto3";', sizeBytes: 20 }] }],
        }}
        onIngestChange={onIngestChange}
      />,
    );

    const file = new File(['syntax = "proto3"; package new;'], 'new.proto', { type: 'text/plain' });
    const input = document.querySelector('input[type="file"][accept=".proto"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [file] });
    fireEvent.change(input);

    let uploadPayload: { protoRoots?: Array<{ files: Array<{ path: string }> }> } | undefined;
    await vi.waitFor(() => {
      uploadPayload = onIngestChange.mock.calls
        .map((call) => call[0])
        .find((payload) => payload?.source === 'proto_files' && payload?.protoRoots?.[0]?.files?.length === 2);
      expect(uploadPayload).toBeTruthy();
    });

    expect(uploadPayload?.protoRoots?.[0]?.files.map((entry: { path: string }) => entry.path).sort()).toEqual([
      'existing.proto',
      'new.proto',
    ]);
  });

  it('shows describe load error inside modal', () => {
    render(
      <GrpcProtoManageModal
        {...baseProps}
        loadState="error"
        loadError={'Unresolved import "missing/vendor.proto" (required by broken.proto)'}
      />,
    );
    expect(screen.getByTestId('grpc-proto-load-error').textContent).toMatch(/missing\/vendor\.proto/);
  });

  it('renders root manager and selected root hint', () => {
    render(<GrpcProtoManageModal {...baseProps} />);
    expect(screen.getByTestId('grpc-proto-files-layout')).toBeTruthy();
    expect(screen.getByTestId('grpc-proto-root-manager')).toBeTruthy();
    expect(screen.getByTestId('grpc-proto-root-list')).toBeTruthy();
    expect(screen.getByTestId('grpc-proto-selected-root').textContent).toContain('root');
  });

  it('adds a new virtual root', () => {
    render(<GrpcProtoManageModal {...baseProps} />);
    fireEvent.change(screen.getByTestId('grpc-proto-root-add-input'), {
      target: { value: 'shared' },
    });
    fireEvent.click(screen.getByTestId('grpc-proto-root-add-btn'));
    expect(baseProps.onIngestChange).toHaveBeenCalledWith(expect.objectContaining({
      source: 'proto_files',
      protoRoots: expect.arrayContaining([
        expect.objectContaining({ mountPath: 'shared' }),
      ]),
    }));
  });

  it('selects a root from the root list and updates selected root hint', () => {
    render(
      <GrpcProtoManageModal
        {...baseProps}
        ingest={{
          ...createDefaultProtoIngestState(),
          protoRoots: [
            { id: 'r1', mountPath: 'shared', files: [] },
            { id: 'r2', mountPath: 'api', files: [] },
          ],
        }}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-proto-root-item-r2'));
    expect(screen.getByTestId('grpc-proto-selected-root').textContent).toContain('api');
  });

  it('removes a single uploaded file from selected root', () => {
    const onIngestChange = vi.fn();
    render(
      <GrpcProtoManageModal
        {...baseProps}
        onIngestChange={onIngestChange}
        ingest={{
          ...createDefaultProtoIngestState(),
          protoRoots: [
            {
              id: 'root-default',
              mountPath: 'root',
              files: [
                { path: 'old.proto', content: 'syntax = "proto3";' },
                { path: 'new.proto', content: 'syntax = "proto3";' },
              ],
            },
          ],
        }}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-proto-file-remove-0'));
    expect(onIngestChange).toHaveBeenCalledWith(expect.objectContaining({
      source: 'proto_files',
      protoRoots: [
        expect.objectContaining({
          id: 'root-default',
          files: [expect.objectContaining({ path: 'new.proto' })],
        }),
      ],
    }));
  });

  it('clears all uploaded files from selected root', () => {
    const onIngestChange = vi.fn();
    render(
      <GrpcProtoManageModal
        {...baseProps}
        onIngestChange={onIngestChange}
        ingest={{
          ...createDefaultProtoIngestState(),
          protoRoots: [
            {
              id: 'root-default',
              mountPath: 'root',
              files: [{ path: 'old.proto', content: 'syntax = "proto3";' }],
            },
          ],
        }}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-proto-file-clear-all'));
    expect(onIngestChange).toHaveBeenCalledWith(expect.objectContaining({
      source: 'proto_files',
      protoRoots: [
        expect.objectContaining({
          id: 'root-default',
          files: [],
        }),
      ],
    }));
  });

  it('shows canonical path preview panel', () => {
    render(
      <GrpcProtoManageModal
        {...baseProps}
        ingest={{
          ...createDefaultProtoIngestState(),
          protoRoots: [
            {
              id: 'shared-root',
              mountPath: 'shared',
              files: [{ path: 'common.proto', content: 'syntax = "proto3";' }],
            },
          ],
        }}
      />,
    );
    expect(screen.getByTestId('grpc-proto-canonical-preview')).toBeTruthy();
    const list = screen.getByTestId('grpc-proto-canonical-list');
    expect(list.textContent).toContain('shared/common.proto');
  });

  it('displays collision diagnostics for basename conflicts', () => {
    render(
      <GrpcProtoManageModal
        {...baseProps}
        ingest={{
          ...createDefaultProtoIngestState(),
          protoRoots: [
            {
              id: 'r1',
              mountPath: 'shared',
              files: [{ path: 'common.proto', content: 'syntax = "proto3";' }],
            },
            {
              id: 'r2',
              mountPath: 'api',
              files: [{ path: 'common.proto', content: 'syntax = "proto3";' }],
            },
          ],
        }}
      />,
    );
    const warnings = screen.getByTestId('grpc-proto-collision-warnings');
    expect(warnings.textContent).toContain('appears in multiple roots');
  });

  it('displays collision diagnostics for path conflicts', () => {
    render(
      <GrpcProtoManageModal
        {...baseProps}
        ingest={{
          ...createDefaultProtoIngestState(),
          protoRoots: [
            {
              id: 'r1',
              mountPath: 'shared',
              files: [{ path: 'common.proto', content: 'syntax = "proto3";' }],
            },
            {
              id: 'r2',
              mountPath: 'shared',
              files: [{ path: 'common.proto', content: 'syntax = "proto3";' }],
            },
          ],
        }}
      />,
    );
    const warnings = screen.getByTestId('grpc-proto-collision-warnings');
    expect(warnings.textContent).toContain('duplicated');
  });
});
