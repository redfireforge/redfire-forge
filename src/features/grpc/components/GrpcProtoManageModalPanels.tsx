import type { ChangeEvent, DragEvent, MutableRefObject } from 'react';
import {
  computeCanonicalProtoPath,
  DEFAULT_PROTO_ROOT_MOUNT,
  detectProtoRootCollisions,
  formatProtoFileSize,
} from '../utils/grpcProtoIngestUtils';
import type { GrpcTabProtoIngestState } from '../grpcStudioTypes';
import type { GrpcProtoRootInput } from '../../../shared/grpc/contracts';

interface DragStateHandlers {
  onDragEnter: (event: DragEvent<HTMLDivElement>) => void;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onDragLeave: (event: DragEvent<HTMLDivElement>) => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => Promise<void>;
}

export interface GrpcProtoFilesPanelProps {
  protoRoots: GrpcProtoRootInput[];
  selectedRoot: GrpcProtoRootInput | undefined;
  selectedRootId: string;
  rootMountDraft: string;
  dragActive: boolean;
  protoInputRef: MutableRefObject<HTMLInputElement | null>;
  onSetRootMountDraft: (value: string) => void;
  onSelectRoot: (rootId: string) => void;
  onAddProtoRoot: () => void;
  onRemoveProtoRoot: (rootId: string) => void;
  onClearSelectedRootFiles: () => void;
  onRemoveProtoFile: (path: string) => void;
  onProtoInputChange: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
  dragHandlers: DragStateHandlers;
}

export function GrpcProtoFilesPanel({
  protoRoots,
  selectedRoot,
  selectedRootId,
  rootMountDraft,
  dragActive,
  protoInputRef,
  onSetRootMountDraft,
  onSelectRoot,
  onAddProtoRoot,
  onRemoveProtoRoot,
  onClearSelectedRootFiles,
  onRemoveProtoFile,
  onProtoInputChange,
  dragHandlers,
}: GrpcProtoFilesPanelProps) {
  const selectedFiles = selectedRoot?.files ?? [];
  const mountPath = selectedRoot?.mountPath ?? DEFAULT_PROTO_ROOT_MOUNT;
  const diagnostics = detectProtoRootCollisions(protoRoots)
    .filter((diag) => diag.affectedFiles.some((file) => file.rootId === selectedRoot?.id));
  const rows = selectedFiles.map((file) => ({
    file,
    canonicalPath: computeCanonicalProtoPath(mountPath, file.path),
  }));

  return (
    <>
      <div className="grpc-proto-files-layout" data-testid="grpc-proto-files-layout">
        <section className="grpc-proto-files-col grpc-proto-files-col--roots">
          <div className="grpc-proto-root-panel" data-testid="grpc-proto-root-manager">
            <div className="grpc-proto-root-panel-header">
              <label className="grpc-proto-import-label" htmlFor="grpc-proto-root-add-input">
                Virtual roots
              </label>
              <div className="grpc-proto-import-row">
                <input
                  id="grpc-proto-root-add-input"
                  className="grpc-proto-import-input"
                  data-testid="grpc-proto-root-add-input"
                  value={rootMountDraft}
                  onChange={(event) => onSetRootMountDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      onAddProtoRoot();
                    }
                  }}
                  placeholder="e.g. shared or vendor/acme"
                  spellCheck={false}
                />
                <button
                  type="button"
                  className="grpc-proto-import-add-btn"
                  data-testid="grpc-proto-root-add-btn"
                  onClick={onAddProtoRoot}
                >
                  Add root
                </button>
              </div>
            </div>

            <ul className="grpc-proto-root-list" data-testid="grpc-proto-root-list">
              {protoRoots.map((root) => {
                const active = selectedRootId === root.id;
                return (
                  <li key={root.id} className="grpc-proto-root-item">
                    <button
                      type="button"
                      className={`grpc-proto-root-item-btn${active ? ' grpc-proto-root-item-btn--active' : ''}`}
                      data-testid={`grpc-proto-root-item-${root.id}`}
                      onClick={() => onSelectRoot(root.id)}
                      aria-pressed={active}
                    >
                      <span>{root.mountPath}</span>
                      <span className="grpc-proto-root-item-count">{root.files.length}</span>
                    </button>
                    <button
                      type="button"
                      className="grpc-proto-root-item-remove"
                      data-testid={`grpc-proto-root-remove-${root.id}`}
                      aria-label={`Remove root ${root.mountPath}`}
                      onClick={() => onRemoveProtoRoot(root.id)}
                    >
                      Remove
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        <section className="grpc-proto-files-col grpc-proto-files-col--files">
          <div
            className={`grpc-proto-upload-zone grpc-proto-upload-zone--compact${dragActive ? ' grpc-proto-upload-zone--drag' : ''}`}
            data-testid="grpc-proto-upload-zone"
            onDragEnter={dragHandlers.onDragEnter}
            onDragOver={dragHandlers.onDragOver}
            onDragLeave={dragHandlers.onDragLeave}
            onDrop={dragHandlers.onDrop}
            onClick={() => protoInputRef.current?.click()}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                protoInputRef.current?.click();
              }
            }}
            role="button"
            tabIndex={0}
            aria-label="Upload proto files"
          >
            <p className="grpc-proto-upload-hint" data-testid="grpc-proto-selected-root">
              Selected root: <strong>{mountPath}</strong>
            </p>
            <p className="grpc-proto-upload-title">Drop `.proto` files here</p>
            <p className="grpc-proto-upload-hint">or click to browse — multiple files supported</p>
            <input
              ref={protoInputRef}
              type="file"
              accept=".proto"
              multiple
              hidden
              onChange={onProtoInputChange}
            />
          </div>

          <div className="grpc-proto-form-card grpc-proto-files-table-card" data-testid="grpc-proto-canonical-preview">
            <div className="grpc-proto-file-list-header grpc-proto-file-list-header--table">
              <span className="grpc-proto-upload-hint">
                Uploaded files in <strong>{mountPath}</strong>
              </span>
              <button
                type="button"
                className="grpc-proto-import-remove"
                data-testid="grpc-proto-file-clear-all"
                onClick={onClearSelectedRootFiles}
                disabled={rows.length === 0}
              >
                Clear all
              </button>
            </div>

            {diagnostics.length > 0 && (
              <div className="grpc-proto-diagnostic-list" data-testid="grpc-proto-collision-warnings">
                {diagnostics.map((diag, idx) => (
                  <div
                    key={idx}
                    className={`grpc-proto-diagnostic grpc-proto-diagnostic--${diag.type}`}
                    data-testid={`grpc-proto-diagnostic-${diag.type}-${idx}`}
                  >
                    <span className="grpc-proto-diagnostic-icon">⚠️</span>
                    <span className="grpc-proto-diagnostic-message">{diag.message}</span>
                  </div>
                ))}
              </div>
            )}

            {rows.length > 0 ? (
              <div className="grpc-proto-file-list-scroll grpc-proto-file-list-scroll--table">
                <div className="grpc-proto-file-grid-header" role="presentation">
                  <span className="grpc-proto-grid-col-file">File</span>
                  <span className="grpc-proto-grid-col-canonical">Canonical path</span>
                  <span className="grpc-proto-grid-col-size">Size</span>
                  <span className="grpc-proto-grid-col-action">Action</span>
                </div>
                <div data-testid="grpc-proto-canonical-list">
                  <ul className="grpc-proto-file-list" data-testid="grpc-proto-file-list">
                    {rows.map(({ file, canonicalPath }, idx) => (
                      <li key={file.path} className="grpc-proto-file-item grpc-proto-file-item--table">
                        <span className="grpc-proto-file-name" title={file.path}>{file.path}</span>
                        <code className="grpc-proto-canonical-path" title={canonicalPath}>{canonicalPath}</code>
                        <span className="grpc-proto-file-size">
                          {formatProtoFileSize(file.sizeBytes ?? file.content.length)}
                        </span>
                        <button
                          type="button"
                          className="grpc-proto-file-remove"
                          data-testid={`grpc-proto-file-remove-${idx}`}
                          aria-label={`Remove ${file.path}`}
                          onClick={() => onRemoveProtoFile(file.path)}
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <div className="grpc-proto-files-empty" data-testid="grpc-proto-files-empty">
                No proto files uploaded for the selected root yet.
              </div>
            )}
          </div>
        </section>
      </div>
    </>
  );
}

export function estimateBase64DecodedBytes(base64: string): number {
  const compact = base64.trim().replace(/\s+/g, '');
  if (!compact) {
    return 0;
  }
  const paddingMatch = compact.match(/=+$/);
  const padding = paddingMatch?.[0]?.length ?? 0;
  return Math.max(0, Math.floor((compact.length * 3) / 4) - padding);
}

export interface GrpcProtosetPanelProps {
  ingest: GrpcTabProtoIngestState;
  dragActive: boolean;
  protosetInputRef: MutableRefObject<HTMLInputElement | null>;
  onProtosetInputChange: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
  onClearProtosetSelection: () => void;
  dragHandlers: DragStateHandlers;
}

export function GrpcProtosetPanel({
  ingest,
  dragActive,
  protosetInputRef,
  onProtosetInputChange,
  onClearProtosetSelection,
  dragHandlers,
}: GrpcProtosetPanelProps) {
  return (
    <>
      <div
        className={`grpc-proto-upload-zone${dragActive ? ' grpc-proto-upload-zone--drag' : ''}`}
        data-testid="grpc-proto-protoset-zone"
        onDragEnter={dragHandlers.onDragEnter}
        onDragOver={dragHandlers.onDragOver}
        onDragLeave={dragHandlers.onDragLeave}
        onDrop={dragHandlers.onDrop}
        onClick={() => protosetInputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            protosetInputRef.current?.click();
          }
        }}
        role="button"
        tabIndex={0}
        aria-label="Upload protoset file"
      >
        <p className="grpc-proto-upload-title">Drop a `.pb` or `.protoset` file</p>
        <p className="grpc-proto-upload-hint">or click to browse</p>
        <p className="grpc-proto-upload-hint">A selected file is staged for this tab only until you press Load.</p>
        <input
          ref={protosetInputRef}
          type="file"
          accept=".pb,.protoset"
          hidden
          onChange={onProtosetInputChange}
        />
      </div>

      {ingest.protosetBase64?.trim() ? (
        <div className="grpc-proto-protoset-summary" data-testid="grpc-proto-protoset-summary">
          <div className="grpc-proto-protoset-summary-main">
            <div className="grpc-proto-protoset-summary-title-row">
              <span className="grpc-proto-protoset-status" data-testid="grpc-proto-protoset-status">
                Ready to load
              </span>
              <span
                className="grpc-proto-protoset-file-name"
                data-testid="grpc-proto-protoset-name"
                title={ingest.protosetFileName || 'Selected protoset'}
              >
                {ingest.protosetFileName || 'Selected protoset'}
              </span>
            </div>
            <p className="grpc-proto-protoset-meta" data-testid="grpc-proto-protoset-meta">
              Binary size: {formatProtoFileSize(estimateBase64DecodedBytes(ingest.protosetBase64))}. Click Load to import this descriptor.
            </p>
          </div>
          <button
            type="button"
            className="grpc-proto-protoset-clear"
            data-testid="grpc-proto-protoset-clear"
            onClick={onClearProtosetSelection}
          >
            Remove file
          </button>
        </div>
      ) : (
        <div className="grpc-proto-protoset-empty" data-testid="grpc-proto-protoset-empty">
          No protoset selected yet.
        </div>
      )}
    </>
  );
}
