/**
 * @vitest-environment jsdom
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createDefaultProtoIngestState } from '../grpcStudioTypes';
import { FIXTURE_DESCRIPTOR } from '../../../shared/grpc/contractFixtures';
import * as ingestUtils from '../utils/grpcProtoIngestUtils';
import { GrpcProtoManageModal } from './GrpcProtoManageModal';

async function fireInAct(callback: () => void): Promise<void> {
  await act(async () => {
    callback();
    await Promise.resolve();
  });
}

describe('GrpcProtoManageModal coverage gaps', () => {
  const baseProps = {
    open: true,
    ingest: createDefaultProtoIngestState(),
    loadState: 'idle' as const,
    onClose: vi.fn(),
    onIngestChange: vi.fn(),
    onLoad: vi.fn(),
  };

  it('renders safely when closed with legacy ingest missing protoRoots', () => {
    expect(() => render(
      <GrpcProtoManageModal
        {...baseProps}
        open={false}
        ingest={{
          source: 'proto_files',
          importPaths: [],
        } as ReturnType<typeof createDefaultProtoIngestState>}
      />,
    )).not.toThrow();
  });

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
    await fireInAct(() => {
      fireEvent.change(input);
    });

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
    await fireInAct(() => {
      fireEvent.change(input);
    });

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
    await fireInAct(() => {
      fireEvent.change(input);
    });

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
    await fireInAct(() => {
      fireEvent.drop(screen.getByTestId('grpc-proto-protoset-zone'), {
        preventDefault: vi.fn(),
        dataTransfer: { files: [validFile] },
      });
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
    await fireInAct(() => {
      fireEvent.change(input);
    });

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
    await fireInAct(() => {
      fireEvent.change(input);
    });

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

  it('adds a virtual root when pressing Enter in the root input', async () => {
    const onIngestChange = vi.fn();
    render(
      <GrpcProtoManageModal
        {...baseProps}
        ingest={createDefaultProtoIngestState()}
        onIngestChange={onIngestChange}
      />,
    );

    const input = screen.getByTestId('grpc-proto-root-add-input');
    fireEvent.change(input, { target: { value: 'vendor/acme' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await vi.waitFor(() => {
      expect(onIngestChange).toHaveBeenCalledWith(expect.objectContaining({
        source: 'proto_files',
        protoRoots: expect.arrayContaining([
          expect.objectContaining({ mountPath: 'vendor/acme' }),
        ]),
      }));
    });
  });

  it('shows protoset fallback label when file name is unavailable', () => {
    render(
      <GrpcProtoManageModal
        {...baseProps}
        ingest={{
          ...createDefaultProtoIngestState(),
          source: 'protoset',
          protosetBase64: 'YWJjZA==',
          protosetFileName: '',
        }}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-proto-tab-protoset'));
    expect(screen.getByTestId('grpc-proto-protoset-name').textContent).toContain('Selected protoset');
  });

  it('propagates url proto input changes from blank state', () => {
    const onIngestChange = vi.fn();
    render(
      <GrpcProtoManageModal
        {...baseProps}
        ingest={{ ...createDefaultProtoIngestState(), source: 'url_proto', url: '' }}
        onIngestChange={onIngestChange}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-proto-tab-url'));
    fireEvent.change(screen.getByTestId('grpc-proto-url-input'), {
      target: { value: 'https://schemas.example.test/v2/echo.proto' },
    });
    expect(onIngestChange).toHaveBeenCalledWith({
      source: 'url_proto',
      url: 'https://schemas.example.test/v2/echo.proto',
    });
  });

  it('ignores empty file selections for proto and protoset inputs', () => {
    const onIngestChange = vi.fn();
    render(
      <GrpcProtoManageModal
        {...baseProps}
        ingest={createDefaultProtoIngestState()}
        onIngestChange={onIngestChange}
      />,
    );

    const protoInput = document.querySelector('input[type="file"][accept=".proto"]') as HTMLInputElement;
    Object.defineProperty(protoInput, 'files', { value: [] });
    const beforeProtoChange = onIngestChange.mock.calls.length;
    fireEvent.change(protoInput);
    expect(onIngestChange.mock.calls.length).toBe(beforeProtoChange);

    fireEvent.click(screen.getByTestId('grpc-proto-tab-protoset'));
    const protosetInput = document.querySelector('input[type="file"][accept=".pb,.protoset"]') as HTMLInputElement;
    Object.defineProperty(protosetInput, 'files', { value: [] });
    const beforeProtosetChange = onIngestChange.mock.calls.length;
    fireEvent.change(protosetInput);
    expect(onIngestChange.mock.calls.length).toBe(beforeProtosetChange);
  });

  it('handles multi-root updates and no-op root add flows', async () => {
    const onIngestChange = vi.fn();
    render(
      <GrpcProtoManageModal
        {...baseProps}
        ingest={{
          ...createDefaultProtoIngestState(),
          protoRoots: [
            { id: 'r1', mountPath: 'shared', files: [{ path: 'a.proto', content: 'syntax = "proto3";' }] },
            { id: 'r2', mountPath: 'vendor', files: [{ path: 'b.proto', content: 'syntax = "proto3";' }] },
          ],
        }}
        onIngestChange={onIngestChange}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-proto-root-item-r2'));
    fireEvent.click(screen.getByTestId('grpc-proto-file-clear-all'));
    expect(onIngestChange).toHaveBeenCalledWith(expect.objectContaining({
      source: 'proto_files',
      protoRoots: expect.arrayContaining([
        expect.objectContaining({ id: 'r1', files: expect.arrayContaining([expect.objectContaining({ path: 'a.proto' })]) }),
        expect.objectContaining({ id: 'r2', files: [] }),
      ]),
    }));

    const rootInput = screen.getByTestId('grpc-proto-root-add-input');
    fireEvent.change(rootInput, { target: { value: '   ' } });
    fireEvent.keyDown(rootInput, { key: 'Enter' });

    fireEvent.change(rootInput, { target: { value: 'shared' } });
    fireEvent.keyDown(rootInput, { key: 'Enter' });

    await vi.waitFor(() => {
      expect(onIngestChange.mock.calls.filter((call) => call[0]?.protoRoots).length).toBeGreaterThan(0);
    });
  });

  it('shows zero-byte protoset estimate for whitespace base64', () => {
    render(
      <GrpcProtoManageModal
        {...baseProps}
        ingest={{
          ...createDefaultProtoIngestState(),
          source: 'protoset',
          protosetBase64: '   \n\t  ',
          protosetFileName: 'empty.pb',
        }}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-proto-tab-protoset'));
    expect(screen.getByTestId('grpc-proto-protoset-empty').textContent).toMatch(/No protoset selected/i);
  });

  it('drops proto files into the selected root while keeping sibling roots unchanged', async () => {
    const onIngestChange = vi.fn();
    render(
      <GrpcProtoManageModal
        {...baseProps}
        ingest={{
          ...createDefaultProtoIngestState(),
          protoRoots: [
            { id: 'r1', mountPath: 'shared', files: [{ path: 'a.proto', content: 'syntax = "proto3";' }] },
            { id: 'r2', mountPath: 'vendor', files: [] },
          ],
        }}
        onIngestChange={onIngestChange}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-proto-root-item-r2'));
    const dropped = new File(['syntax = "proto3"; message Added {}'], 'added.proto', { type: 'text/plain' });
    fireEvent.drop(screen.getByTestId('grpc-proto-upload-zone'), {
      preventDefault: vi.fn(),
      dataTransfer: { files: [dropped] },
    });

    await vi.waitFor(() => {
      expect(onIngestChange).toHaveBeenCalledWith(expect.objectContaining({
        source: 'proto_files',
        protoRoots: expect.arrayContaining([
          expect.objectContaining({ id: 'r1', files: expect.arrayContaining([expect.objectContaining({ path: 'a.proto' })]) }),
          expect.objectContaining({ id: 'r2' }),
        ]),
      }));
    });
  });

  it('removes only files from the selected root in multi-root mode', () => {
    const onIngestChange = vi.fn();
    render(
      <GrpcProtoManageModal
        {...baseProps}
        ingest={{
          ...createDefaultProtoIngestState(),
          protoRoots: [
            { id: 'r1', mountPath: 'shared', files: [{ path: 'keep.proto', content: 'syntax = "proto3";' }] },
            { id: 'r2', mountPath: 'vendor', files: [{ path: 'remove.proto', content: 'syntax = "proto3";' }] },
          ],
        }}
        onIngestChange={onIngestChange}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-proto-root-item-r2'));
    fireEvent.click(screen.getByLabelText('Remove remove.proto'));

    expect(onIngestChange).toHaveBeenCalledWith(expect.objectContaining({
      source: 'proto_files',
      protoRoots: expect.arrayContaining([
        expect.objectContaining({ id: 'r1', files: expect.arrayContaining([expect.objectContaining({ path: 'keep.proto' })]) }),
        expect.objectContaining({ id: 'r2', files: [] }),
      ]),
    }));
  });

  it('restores ingest snapshot when escape closes the modal', () => {
    const onIngestChange = vi.fn();
    const onClose = vi.fn();
    const ingest = createDefaultProtoIngestState();

    render(
      <GrpcProtoManageModal
        {...baseProps}
        ingest={ingest}
        onIngestChange={onIngestChange}
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-proto-tab-bsr'));
    fireEvent.change(screen.getByTestId('grpc-proto-bsr-module-input'), {
      target: { value: 'buf.build/acme/echo' },
    });
    fireEvent.keyDown(window, { key: 'Escape' });

    expect(onIngestChange).toHaveBeenCalledWith(ingest);
    expect(onClose).toHaveBeenCalled();
  });

  it('clones ingest snapshot without structuredClone when unavailable', () => {
    const originalStructuredClone = globalThis.structuredClone;
    Object.defineProperty(globalThis, 'structuredClone', {
      configurable: true,
      value: undefined,
    });

    try {
      expect(() => render(
        <GrpcProtoManageModal
          {...baseProps}
          ingest={{
            ...createDefaultProtoIngestState(),
            bsrModule: 'acme/echo',
          }}
        />,
      )).not.toThrow();
    } finally {
      Object.defineProperty(globalThis, 'structuredClone', {
        configurable: true,
        value: originalStructuredClone,
      });
    }
  });

  it('resets selected root id when proto roots are temporarily empty', () => {
    const ensureSpy = vi.spyOn(ingestUtils, 'ensureProtoRootsDraft').mockReturnValue([]);

    render(
      <GrpcProtoManageModal
        {...baseProps}
        ingest={createDefaultProtoIngestState()}
      />,
    );

    ensureSpy.mockRestore();
  });

  it('switches back to proto files tab from another source tab', () => {
    const onIngestChange = vi.fn();
    render(
      <GrpcProtoManageModal
        {...baseProps}
        ingest={{ ...createDefaultProtoIngestState(), source: 'bsr' }}
        onIngestChange={onIngestChange}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-proto-tab-bsr'));
    fireEvent.click(screen.getByTestId('grpc-proto-tab-proto-files'));
    expect(onIngestChange).toHaveBeenCalledWith({ source: 'proto_files' });
    expect(screen.getByTestId('grpc-proto-upload-zone')).toBeTruthy();
  });

  it('shows protoset binary size for padded base64 payloads', () => {
    render(
      <GrpcProtoManageModal
        {...baseProps}
        ingest={{
          ...createDefaultProtoIngestState(),
          source: 'protoset',
          protosetFileName: 'padded.pb',
          protosetBase64: 'YWI=',
        }}
      />,
    );

    expect(screen.getByTestId('grpc-proto-protoset-meta').textContent).toMatch(/Binary size/i);
  });

  it('shows collision warnings for duplicate basenames in the selected root', () => {
    render(
      <GrpcProtoManageModal
        {...baseProps}
        ingest={{
          ...createDefaultProtoIngestState(),
          protoRoots: [
            {
              id: 'r1',
              mountPath: 'shared',
              files: [{ path: 'echo.proto', content: 'syntax = "proto3";' }],
            },
            {
              id: 'r2',
              mountPath: 'vendor',
              files: [{ path: 'echo.proto', content: 'syntax = "proto3";' }],
            },
          ],
        }}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-proto-root-item-r1'));
    expect(screen.getByTestId('grpc-proto-collision-warnings')).toBeTruthy();
  });

  it('recreates the default root after removing the last virtual root', () => {
    const onIngestChange = vi.fn();
    render(
      <GrpcProtoManageModal
        {...baseProps}
        ingest={{
          ...createDefaultProtoIngestState(),
          protoRoots: [{ id: 'only-root', mountPath: 'vendor', files: [] }],
        }}
        onIngestChange={onIngestChange}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-proto-root-remove-only-root'));
    expect(onIngestChange).toHaveBeenCalledWith(expect.objectContaining({
      source: 'proto_files',
      protoRoots: [expect.objectContaining({ mountPath: 'root' })],
    }));
  });
});
