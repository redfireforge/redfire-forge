/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createDefaultProtoIngestState } from '../grpcStudioTypes';
import { FIXTURE_DESCRIPTOR } from '../../../shared/grpc/contractFixtures';
import * as ingestUtils from '../utils/grpcProtoIngestUtils';
import { GrpcProtoManageModal } from './GrpcProtoManageModal';

describe('GrpcProtoManageModal coverage gaps', () => {
  const baseProps = {
    open: true,
    ingest: createDefaultProtoIngestState(),
    loadState: 'idle' as const,
    onClose: vi.fn(),
    onIngestChange: vi.fn(),
    onLoad: vi.fn(),
  };

  it('supports drag/drop upload, keyboard activation, and file removal', async () => {
    const onIngestChange = vi.fn();
    render(
      <GrpcProtoManageModal
        {...baseProps}
        ingest={{
          ...createDefaultProtoIngestState(),
          protoRoots: [{
            id: 'root-default',
            mountPath: 'root',
            files: [{ path: 'old.proto', content: 'syntax = "proto3";', sizeBytes: 10 }],
          }],
          importPaths: ['shared'],
        }}
        onIngestChange={onIngestChange}
      />,
    );

    const zone = screen.getByTestId('grpc-proto-upload-zone');
    fireEvent.dragEnter(zone, { preventDefault: vi.fn() });
    fireEvent.dragOver(zone, { preventDefault: vi.fn() });
    fireEvent.dragLeave(zone, { preventDefault: vi.fn() });
    fireEvent.keyDown(zone, { key: 'Enter' });

    fireEvent.click(screen.getByLabelText('Remove old.proto'));
    expect(onIngestChange).toHaveBeenCalledWith(expect.objectContaining({
      source: 'proto_files',
      protoRoots: [expect.objectContaining({ files: [] })],
    }));
  });

  it('renders BSR/version/token inputs', () => {
    render(<GrpcProtoManageModal {...baseProps} />);

    fireEvent.click(screen.getByTestId('grpc-proto-tab-bsr'));
    fireEvent.change(screen.getByTestId('grpc-proto-bsr-version-input'), { target: { value: 'v1' } });
    fireEvent.change(screen.getByTestId('grpc-proto-bsr-token-input'), { target: { value: 'secret' } });
    expect(baseProps.onIngestChange).toHaveBeenCalledWith({ bsrVersion: 'v1' });
    expect(baseProps.onIngestChange).toHaveBeenCalledWith({ bsrToken: 'secret' });
  });

  it('shows schema browser empty state and export errors', () => {
    render(
      <GrpcProtoManageModal
        {...baseProps}
        initialTab="schema_browser"
        exportError="Export failed"
      />,
    );
    expect(screen.getByTestId('grpc-schema-browser-empty')).toBeTruthy();
    expect(screen.getByTestId('grpc-proto-export-error').textContent).toContain('Export failed');
  });

  it('shows upload errors when protoset selection fails', async () => {
    render(<GrpcProtoManageModal {...baseProps} />);
    fireEvent.click(screen.getByTestId('grpc-proto-tab-protoset'));

    const badFile = new File(['x'], 'schema.bin', { type: 'application/octet-stream' });
    const input = document.querySelector('input[type="file"][accept=".pb,.protoset"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [badFile] });
    fireEvent.change(input);

    await vi.waitFor(() => {
      expect(screen.getByTestId('grpc-proto-upload-error').textContent).toMatch(/\.pb or \.protoset/i);
    });
  });

  it('renders schema browser when descriptor is available', () => {
    render(
      <GrpcProtoManageModal
        {...baseProps}
        descriptor={FIXTURE_DESCRIPTOR}
        targetAddress="localhost:50051"
        initialTab="schema_browser"
        selectedService="echo.EchoService"
        selectedMethod="Echo"
        onSelectMethod={vi.fn()}
        onOpenMethodInTab={vi.fn()}
        onExportProtoset={vi.fn()}
      />,
    );
    expect(screen.getByTestId('grpc-schema-browser')).toBeTruthy();
  });

  it('supports URL tab, load button, and overlay close', () => {
    const onClose = vi.fn();
    const onLoad = vi.fn();
    render(
      <GrpcProtoManageModal
        {...baseProps}
        onClose={onClose}
        onLoad={onLoad}
        ingest={{ ...createDefaultProtoIngestState(), source: 'url_proto', url: 'https://example.com/echo.proto' }}
      />,
    );
    fireEvent.click(screen.getByTestId('grpc-proto-tab-url'));
    fireEvent.change(screen.getByTestId('grpc-proto-url-input'), {
      target: { value: 'https://example.com/echo.proto' },
    });
    fireEvent.click(screen.getByTestId('grpc-proto-load-btn'));
    expect(onLoad).toHaveBeenCalled();

    fireEvent.mouseDown(screen.getByTestId('grpc-proto-manage-modal'));
    expect(onClose).toHaveBeenCalled();
  });

  it('blocks escape while loading and shows load error banner', () => {
    const onClose = vi.fn();
    render(
      <GrpcProtoManageModal
        {...baseProps}
        loadState="loading"
        loadError="Descriptor failed"
        onClose={onClose}
      />,
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByTestId('grpc-proto-load-error').textContent).toContain('Descriptor failed');
  });

  it('uploads proto files into selected root', async () => {
    const onIngestChange = vi.fn();
    render(
      <GrpcProtoManageModal
        {...baseProps}
        ingest={createDefaultProtoIngestState()}
        onIngestChange={onIngestChange}
      />,
    );

    const protoFile = new File(['syntax = "proto3";'], 'echo.proto', { type: 'text/plain' });
    const input = document.querySelector('input[type="file"][accept=".proto"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [protoFile] });
    fireEvent.change(input);

    await vi.waitFor(() => {
      expect(onIngestChange).toHaveBeenCalledWith(expect.objectContaining({ source: 'proto_files' }));
    });
  });

  it('updates BSR module field and enables load for BSR source', () => {
    const onIngestChange = vi.fn();
    render(
      <GrpcProtoManageModal
        {...baseProps}
        ingest={{ ...createDefaultProtoIngestState(), source: 'bsr', bsrModule: 'acme/echo' }}
        onIngestChange={onIngestChange}
      />,
    );
    fireEvent.change(screen.getByTestId('grpc-proto-bsr-module-input'), {
      target: { value: 'buf.build/acme/echo' },
    });
    expect(onIngestChange).toHaveBeenCalledWith({
      source: 'bsr',
      bsrModule: 'buf.build/acme/echo',
    });
    expect((screen.getByTestId('grpc-proto-load-btn') as HTMLButtonElement).disabled).toBe(false);
  });

  it('supports protoset drag/drop, keyboard activation, and successful selection', async () => {
    const onIngestChange = vi.fn();
    render(
      <GrpcProtoManageModal
        {...baseProps}
        ingest={{ ...createDefaultProtoIngestState(), source: 'protoset' }}
        onIngestChange={onIngestChange}
      />,
    );

    const zone = screen.getByTestId('grpc-proto-protoset-zone');
    fireEvent.dragEnter(zone, { preventDefault: vi.fn() });
    fireEvent.dragOver(zone, { preventDefault: vi.fn() });
    fireEvent.dragLeave(zone, { preventDefault: vi.fn() });
    fireEvent.keyDown(zone, { key: ' ' });

    const validFile = new File(['abc'], 'schema.pb', { type: 'application/octet-stream' });
    const input = document.querySelector('input[type="file"][accept=".pb,.protoset"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [validFile] });
    fireEvent.change(input);

    await vi.waitFor(() => {
      expect(onIngestChange).toHaveBeenCalledWith(expect.objectContaining({
        source: 'protoset',
        protosetFileName: 'schema.pb',
      }));
    });
  });

  it('shows export busy state in schema browser tab', () => {
    render(
      <GrpcProtoManageModal
        {...baseProps}
        descriptor={FIXTURE_DESCRIPTOR}
        targetAddress="localhost:50051"
        initialTab="schema_browser"
        onExportProtoset={vi.fn()}
        exportProtosetBusy
      />,
    );
    expect(screen.getByTestId('grpc-schema-export-protoset-btn').textContent).toMatch(/Exporting/i);
  });

  it('drops protoset files on the protoset upload zone', async () => {
    const onIngestChange = vi.fn();
    render(
      <GrpcProtoManageModal
        {...baseProps}
        ingest={{ ...createDefaultProtoIngestState(), source: 'protoset' }}
        onIngestChange={onIngestChange}
      />,
    );

    const validFile = new File(['abc'], 'schema.pb', { type: 'application/octet-stream' });
    fireEvent.drop(screen.getByTestId('grpc-proto-protoset-zone'), {
      preventDefault: vi.fn(),
      dataTransfer: { files: [validFile] },
    });

    await vi.waitFor(() => {
      expect(onIngestChange).toHaveBeenCalledWith(expect.objectContaining({
        source: 'protoset',
        protosetFileName: 'schema.pb',
      }));
    });
  });

  it('switches to schema browser tab when descriptor is loaded', () => {
    render(
      <GrpcProtoManageModal
        {...baseProps}
        descriptor={FIXTURE_DESCRIPTOR}
        targetAddress="localhost:50051"
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-proto-tab-schema-browser'));
    expect(screen.getByTestId('grpc-schema-browser')).toBeTruthy();
    expect(screen.getByText(/Browse services, methods, messages, and enums/i)).toBeTruthy();
  });

  it('does not close when clicking inside the modal body', () => {
    const onClose = vi.fn();
    render(<GrpcProtoManageModal {...baseProps} onClose={onClose} />);
    fireEvent.mouseDown(screen.getByRole('dialog'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('shows upload errors when proto file ingestion fails', async () => {
    vi.spyOn(ingestUtils, 'readProtoFilesFromFileList').mockRejectedValueOnce('broken');
    render(<GrpcProtoManageModal {...baseProps} />);

    const protoFile = new File(['bad'], 'broken.proto', { type: 'text/plain' });
    const input = document.querySelector('input[type="file"][accept=".proto"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [protoFile] });
    fireEvent.change(input);

    await vi.waitFor(() => {
      expect(screen.getByTestId('grpc-proto-upload-error').textContent).toMatch(/Failed to read proto files/i);
    });
    vi.restoreAllMocks();
  });

  it('shows upload errors when protoset ingestion fails', async () => {
    vi.spyOn(ingestUtils, 'readProtosetBase64FromFile').mockRejectedValueOnce(new Error('corrupt protoset'));
    render(
      <GrpcProtoManageModal
        {...baseProps}
        ingest={{ ...createDefaultProtoIngestState(), source: 'protoset' }}
      />,
    );

    const validFile = new File(['abc'], 'schema.pb', { type: 'application/octet-stream' });
    const input = document.querySelector('input[type="file"][accept=".pb,.protoset"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [validFile] });
    fireEvent.change(input);

    await vi.waitFor(() => {
      expect(screen.getByTestId('grpc-proto-upload-error').textContent).toMatch(/corrupt protoset/i);
    });
    vi.restoreAllMocks();
  });

  it('enables load for protoset source when base64 is present', () => {
    render(
      <GrpcProtoManageModal
        {...baseProps}
        ingest={{
          ...createDefaultProtoIngestState(),
          source: 'protoset',
          protosetBase64: 'abc123',
          protosetFileName: 'schema.pb',
        }}
      />,
    );
    fireEvent.click(screen.getByTestId('grpc-proto-tab-protoset'));
    expect(screen.getByTestId('grpc-proto-protoset-name').textContent).toContain('schema.pb');
    expect(screen.getByTestId('grpc-proto-load-btn')).toHaveProperty('disabled', false);
  });

  it('ignores drop events without files', () => {
    render(<GrpcProtoManageModal {...baseProps} />);

    fireEvent.drop(screen.getByTestId('grpc-proto-upload-zone'), {
      preventDefault: vi.fn(),
      dataTransfer: { files: [] },
    });
    expect(baseProps.onIngestChange).not.toHaveBeenCalledWith(expect.objectContaining({ source: 'proto_files' }));
  });

  it('activates proto upload zone with Space key', () => {
    const clickSpy = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => undefined);
    render(<GrpcProtoManageModal {...baseProps} />);
    fireEvent.keyDown(screen.getByTestId('grpc-proto-upload-zone'), { key: ' ' });
    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();
  });

  it('disables cancel while loading', () => {
    render(<GrpcProtoManageModal {...baseProps} loadState="loading" />);
    expect(screen.getByTestId('grpc-proto-cancel-btn')).toHaveProperty('disabled', true);
  });
});
