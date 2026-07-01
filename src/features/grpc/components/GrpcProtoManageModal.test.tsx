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
  });

  it('switches to protoset tab', () => {
    render(<GrpcProtoManageModal {...baseProps} />);
    fireEvent.click(screen.getByTestId('grpc-proto-tab-protoset'));
    expect(baseProps.onIngestChange).toHaveBeenCalledWith({ source: 'protoset' });
    expect(screen.getByTestId('grpc-proto-protoset-zone')).toBeTruthy();
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
          protoFiles: [{ path: 'echo.proto', content: 'syntax = "proto3";', sizeBytes: 20 }],
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

  it('adds import path on Add click', () => {
    render(<GrpcProtoManageModal {...baseProps} />);
    fireEvent.change(screen.getByTestId('grpc-proto-import-path-input'), {
      target: { value: 'shared' },
    });
    fireEvent.click(screen.getByTestId('grpc-proto-import-path-add'));
    expect(baseProps.onIngestChange).toHaveBeenCalledWith({ importPaths: ['shared'] });
  });

  it('merges newly uploaded proto files with existing draft', async () => {
    const onIngestChange = vi.fn();
    render(
      <GrpcProtoManageModal
        {...baseProps}
        ingest={{
          ...createDefaultProtoIngestState(),
          protoFiles: [{ path: 'existing.proto', content: 'syntax = "proto3";', sizeBytes: 20 }],
        }}
        onIngestChange={onIngestChange}
      />,
    );

    const file = new File(['syntax = "proto3"; package new;'], 'new.proto', { type: 'text/plain' });
    const input = document.querySelector('input[type="file"][accept=".proto"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [file] });
    fireEvent.change(input);

    await vi.waitFor(() => {
      expect(onIngestChange).toHaveBeenCalled();
    });

    const lastCall = onIngestChange.mock.calls.at(-1)?.[0];
    expect(lastCall?.protoFiles?.map((entry: { path: string }) => entry.path).sort()).toEqual([
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
});
