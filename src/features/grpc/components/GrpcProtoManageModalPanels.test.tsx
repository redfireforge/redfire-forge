/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  GrpcProtoFilesPanel,
  GrpcProtosetPanel,
  estimateBase64DecodedBytes,
} from './GrpcProtoManageModalPanels';

const mockDetectProtoRootCollisions = vi.fn();
const mockFormatProtoFileSize = vi.fn((size: number) => `${size}b`);
const mockComputeCanonicalProtoPath = vi.fn((mountPath: string, path: string) => `${mountPath}/${path}`);

vi.mock('../utils/grpcProtoIngestUtils', () => ({
  computeCanonicalProtoPath: (...args: unknown[]) => mockComputeCanonicalProtoPath(...(args as [string, string])),
  DEFAULT_PROTO_ROOT_MOUNT: '/default-root',
  detectProtoRootCollisions: (...args: unknown[]) => mockDetectProtoRootCollisions(...args),
  formatProtoFileSize: (...args: unknown[]) => mockFormatProtoFileSize(...(args as [number])),
}));

beforeEach(() => {
  mockDetectProtoRootCollisions.mockReset();
  mockFormatProtoFileSize.mockReset();
  mockComputeCanonicalProtoPath.mockReset();
  mockFormatProtoFileSize.mockImplementation((size: number) => `${size}b`);
  mockComputeCanonicalProtoPath.mockImplementation((mountPath: string, path: string) => `${mountPath}/${path}`);
  mockDetectProtoRootCollisions.mockReturnValue([]);
});

describe('GrpcProtoFilesPanel', () => {
  it('renders empty state, uses default mount path, and handles upload controls', () => {
    const onAddProtoRoot = vi.fn();
    const onSetRootMountDraft = vi.fn();
    const onSelectRoot = vi.fn();
    const onRemoveProtoRoot = vi.fn();
    const onClearSelectedRootFiles = vi.fn();
    const onRemoveProtoFile = vi.fn();
    const onProtoInputChange = vi.fn();
    const inputRef = { current: document.createElement('input') };

    render(
      <GrpcProtoFilesPanel
        protoRoots={[]}
        selectedRoot={undefined}
        selectedRootId=""
        rootMountDraft="shared"
        dragActive={false}
        protoInputRef={inputRef}
        onSetRootMountDraft={onSetRootMountDraft}
        onSelectRoot={onSelectRoot}
        onAddProtoRoot={onAddProtoRoot}
        onRemoveProtoRoot={onRemoveProtoRoot}
        onClearSelectedRootFiles={onClearSelectedRootFiles}
        onRemoveProtoFile={onRemoveProtoFile}
        onProtoInputChange={onProtoInputChange}
        dragHandlers={{
          onDragEnter: vi.fn(),
          onDragOver: vi.fn(),
          onDragLeave: vi.fn(),
          onDrop: vi.fn(),
        }}
      />,
    );

    expect(screen.getByTestId('grpc-proto-files-empty')).toBeInTheDocument();
    expect(screen.getByTestId('grpc-proto-selected-root')).toHaveTextContent('/default-root');
    expect(screen.getByTestId('grpc-proto-file-clear-all')).toBeDisabled();

    fireEvent.change(screen.getByTestId('grpc-proto-root-add-input'), { target: { value: 'vendor/acme' } });
    expect(onSetRootMountDraft).toHaveBeenCalledWith('vendor/acme');

    fireEvent.keyDown(screen.getByTestId('grpc-proto-root-add-input'), { key: 'Enter' });
    expect(onAddProtoRoot).toHaveBeenCalled();

    fireEvent.keyDown(screen.getByTestId('grpc-proto-upload-zone'), { key: 'Enter' });
    fireEvent.keyDown(screen.getByTestId('grpc-proto-upload-zone'), { key: ' ' });

    expect(onSelectRoot).not.toHaveBeenCalled();
    expect(onRemoveProtoRoot).not.toHaveBeenCalled();
    expect(onRemoveProtoFile).not.toHaveBeenCalled();
    expect(onProtoInputChange).not.toHaveBeenCalled();
  });

  it('renders uploaded files, canonical paths, diagnostics, and removal actions', () => {
    const onSelectRoot = vi.fn();
    const onRemoveProtoRoot = vi.fn();
    const onClearSelectedRootFiles = vi.fn();
    const onRemoveProtoFile = vi.fn();
    const onProtoInputChange = vi.fn();
    const selectedRoot = {
      id: 'root-1',
      mountPath: 'shared',
      files: [
        { path: 'api.proto', content: 'syntax = "proto3";', sizeBytes: 17 },
      ],
    };

    mockDetectProtoRootCollisions.mockReturnValue([
      {
        type: 'collision',
        message: 'Collision detected',
        affectedFiles: [{ rootId: 'root-1', path: 'api.proto' }],
      },
    ]);

    render(
      <GrpcProtoFilesPanel
        protoRoots={[selectedRoot]}
        selectedRoot={selectedRoot}
        selectedRootId="root-1"
        rootMountDraft="shared"
        dragActive={true}
        protoInputRef={{ current: null }}
        onSetRootMountDraft={vi.fn()}
        onSelectRoot={onSelectRoot}
        onAddProtoRoot={vi.fn()}
        onRemoveProtoRoot={onRemoveProtoRoot}
        onClearSelectedRootFiles={onClearSelectedRootFiles}
        onRemoveProtoFile={onRemoveProtoFile}
        onProtoInputChange={onProtoInputChange}
        dragHandlers={{
          onDragEnter: vi.fn(),
          onDragOver: vi.fn(),
          onDragLeave: vi.fn(),
          onDrop: vi.fn(),
        }}
      />,
    );

    expect(screen.getByTestId('grpc-proto-upload-zone')).toHaveClass('grpc-proto-upload-zone--drag');
    expect(screen.getByTestId('grpc-proto-root-item-root-1')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('grpc-proto-collision-warnings')).toBeInTheDocument();
    expect(screen.getByTestId('grpc-proto-file-list')).toBeInTheDocument();
    expect(screen.getByText('api.proto')).toBeInTheDocument();
    expect(screen.getByText('shared/api.proto')).toBeInTheDocument();
    expect(screen.getByText('17b')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('grpc-proto-root-item-root-1'));
    expect(onSelectRoot).toHaveBeenCalledWith('root-1');

    fireEvent.click(screen.getByTestId('grpc-proto-root-remove-root-1'));
    expect(onRemoveProtoRoot).toHaveBeenCalledWith('root-1');

    fireEvent.click(screen.getByTestId('grpc-proto-file-remove-0'));
    expect(onRemoveProtoFile).toHaveBeenCalledWith('api.proto');

    fireEvent.click(screen.getByTestId('grpc-proto-file-clear-all'));
    expect(onClearSelectedRootFiles).toHaveBeenCalled();

    expect(mockDetectProtoRootCollisions).toHaveBeenCalled();
    expect(mockFormatProtoFileSize).toHaveBeenCalledWith(17);
    expect(mockComputeCanonicalProtoPath).toHaveBeenCalledWith('shared', 'api.proto');
    expect(onProtoInputChange).not.toHaveBeenCalled();
  });
});

describe('GrpcProtosetPanel', () => {
  it('renders empty state and upload controls when no protoset is selected', () => {
    const onClearProtosetSelection = vi.fn();
    const inputRef = { current: document.createElement('input') };

    render(
      <GrpcProtosetPanel
        ingest={{}}
        dragActive={false}
        protosetInputRef={inputRef}
        onProtosetInputChange={vi.fn()}
        onClearProtosetSelection={onClearProtosetSelection}
        dragHandlers={{
          onDragEnter: vi.fn(),
          onDragOver: vi.fn(),
          onDragLeave: vi.fn(),
          onDrop: vi.fn(),
        }}
      />,
    );

    expect(screen.getByTestId('grpc-proto-protoset-empty')).toBeInTheDocument();

    fireEvent.keyDown(screen.getByTestId('grpc-proto-protoset-zone'), { key: 'Enter' });
    fireEvent.keyDown(screen.getByTestId('grpc-proto-protoset-zone'), { key: ' ' });

    expect(onClearProtosetSelection).not.toHaveBeenCalled();
  });

  it('renders selected protoset summary and clear action', () => {
    const onClearProtosetSelection = vi.fn();

    render(
      <GrpcProtosetPanel
        ingest={{ protosetBase64: 'AQID', protosetFileName: 'descriptor.pb' }}
        dragActive={true}
        protosetInputRef={{ current: null }}
        onProtosetInputChange={vi.fn()}
        onClearProtosetSelection={onClearProtosetSelection}
        dragHandlers={{
          onDragEnter: vi.fn(),
          onDragOver: vi.fn(),
          onDragLeave: vi.fn(),
          onDrop: vi.fn(),
        }}
      />,
    );

    expect(screen.getByTestId('grpc-proto-protoset-zone')).toHaveClass('grpc-proto-upload-zone--drag');
    expect(screen.getByTestId('grpc-proto-protoset-summary')).toBeInTheDocument();
    expect(screen.getByTestId('grpc-proto-protoset-status')).toHaveTextContent('Ready to load');
    expect(screen.getByTestId('grpc-proto-protoset-name')).toHaveTextContent('descriptor.pb');
    expect(screen.getByTestId('grpc-proto-protoset-meta')).toHaveTextContent('Binary size: 3b');

    fireEvent.click(screen.getByTestId('grpc-proto-protoset-clear'));
    expect(onClearProtosetSelection).toHaveBeenCalled();
  });

  it('falls back to the default protoset label when no filename is provided', () => {
    render(
      <GrpcProtosetPanel
        ingest={{ protosetBase64: 'AQID' }}
        dragActive={false}
        protosetInputRef={{ current: null }}
        onProtosetInputChange={vi.fn()}
        onClearProtosetSelection={vi.fn()}
        dragHandlers={{
          onDragEnter: vi.fn(),
          onDragOver: vi.fn(),
          onDragLeave: vi.fn(),
          onDrop: vi.fn(),
        }}
      />,
    );

    expect(screen.getByTestId('grpc-proto-protoset-name')).toHaveTextContent('Selected protoset');
    expect(screen.getByTestId('grpc-proto-protoset-meta')).toHaveTextContent('Binary size: 3b');
  });

  it('shows zero-byte protoset size when the base64 payload is only whitespace', () => {
    expect(estimateBase64DecodedBytes('   \n\t  ')).toBe(0);
  });
});