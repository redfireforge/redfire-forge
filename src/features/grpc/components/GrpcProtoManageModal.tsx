import { useCallback, useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import type { GrpcDescriptor, GrpcProtoRootInput } from '../../../shared/grpc/contracts';
import type { GrpcDescriptorLoadState, GrpcTabProtoIngestState } from '../grpcStudioTypes';
import { useModalDrag } from '../../../shared/hooks/useModalDrag';
import { useModalResize } from '../../../shared/hooks/useModalResize';
import { GRPC } from '@shared/selectors';
import {
  computeCanonicalProtoPath,
  DEFAULT_PROTO_ROOT_ID,
  DEFAULT_PROTO_ROOT_MOUNT,
  detectProtoRootCollisions,
  ensureProtoRootsDraft,
  formatProtoFileSize,
  mergeProtoFileDrafts,
  normalizeImportRoot,
  readProtoFilesFromFileList,
  readProtosetBase64FromFile,
} from '../utils/grpcProtoIngestUtils';
import { GrpcSchemaBrowser } from './GrpcSchemaBrowser';
import type { GrpcGrpcurlExportContext } from '../utils/grpcGrpcurlTypes';

export interface GrpcProtoManageModalProps {
  open: boolean;
  ingest: GrpcTabProtoIngestState;
  loadState: GrpcDescriptorLoadState;
  loadError?: string;
  descriptor?: GrpcDescriptor;
  targetAddress?: string;
  tlsMode?: 'disabled' | 'tls' | 'mtls';
  selectedService?: string;
  selectedMethod?: string;
  initialTab?: ProtoModalTab;
  onClose: () => void;
  onIngestChange: (patch: Partial<GrpcTabProtoIngestState>) => void;
  onLoad: () => void;
  onSelectMethod?: (serviceFullName: string, methodName: string) => void;
  onOpenMethodInTab?: (
    serviceFullName: string,
    methodName: string,
    requestBody: Record<string, unknown>,
    mode: 'minimal' | 'full',
  ) => void;
  onExportProtoset?: () => void | Promise<void>;
  exportProtosetBusy?: boolean;
  exportError?: string;
  grpcurlExportContext?: GrpcGrpcurlExportContext;
}

export type ProtoModalTab = GrpcTabProtoIngestState['source'] | 'schema_browser';

const TAB_HINTS: Record<ProtoModalTab, string> = {
  proto_files: 'Add virtual roots on the left, then upload `.proto` files to the selected root on the right.',
  protoset: 'Upload a compiled `.pb` or `.protoset` descriptor bundle — no proto compiler needed.',
  url_proto: 'Fetch a remote `.proto` over HTTPS. The request is made server-side with SSRF protection.',
  bsr: 'Pull a module from Buf Schema Registry. Private modules need an API token (sent server-side only).',
  schema_browser: 'Browse services, methods, messages, and enums from the loaded descriptor.',
};

/**
 * Anchor to the right workspace panel so the service explorer + Manage Schemas
 * trigger remain visible (expected lesson/layout behavior).
 */
const GRPC_PROTO_MODAL_ANCHOR = {
  selector: `${GRPC.STUDIO_PAGE} .grpc-studio-main`,
  hAlign: 'left' as const,
  vAlign: 'top' as const,
  padding: { top: 4, left: 6, right: 8 },
};

type ProtoRootDraft = GrpcProtoRootInput;

function ensureProtoRoots(ingest: GrpcTabProtoIngestState): ProtoRootDraft[] {
  return ensureProtoRootsDraft(ingest.protoRoots);
}

function estimateBase64DecodedBytes(base64: string): number {
  const compact = base64.trim().replace(/\s+/g, '');
  if (!compact) {
    return 0;
  }
  const paddingMatch = compact.match(/=+$/);
  const padding = paddingMatch?.[0]?.length ?? 0;
  return Math.max(0, Math.floor((compact.length * 3) / 4) - padding);
}

function cloneIngestState(ingest: GrpcTabProtoIngestState): GrpcTabProtoIngestState {
  if (typeof structuredClone === 'function') {
    return structuredClone(ingest);
  }
  return JSON.parse(JSON.stringify(ingest)) as GrpcTabProtoIngestState;
}

function ModalDragGrip() {
  return (
    <span className="grpc-proto-modal-drag-grip" aria-hidden="true" title="Drag to move">
      <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor">
        <circle cx="2" cy="2" r="1.2" /><circle cx="8" cy="2" r="1.2" />
        <circle cx="2" cy="8" r="1.2" /><circle cx="8" cy="8" r="1.2" />
        <circle cx="2" cy="14" r="1.2" /><circle cx="8" cy="14" r="1.2" />
      </svg>
    </span>
  );
}

export function GrpcProtoManageModal({
  open,
  ingest,
  loadState,
  loadError,
  descriptor,
  targetAddress,
  tlsMode = 'disabled',
  selectedService,
  selectedMethod,
  initialTab,
  onClose,
  onIngestChange,
  onLoad,
  onSelectMethod,
  onOpenMethodInTab,
  onExportProtoset,
  exportProtosetBusy = false,
  exportError,
  grpcurlExportContext,
}: GrpcProtoManageModalProps) {
  const [activeTab, setActiveTab] = useState<ProtoModalTab>(ingest.source);
  const [rootMountDraft, setRootMountDraft] = useState('');
  const [uploadError, setUploadError] = useState<string | undefined>();
  const [dragActive, setDragActive] = useState(false);
  const [selectedRootId, setSelectedRootId] = useState<string>(DEFAULT_PROTO_ROOT_ID);
  const protoInputRef = useRef<HTMLInputElement>(null);
  const protosetInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const wasOpenRef = useRef(false);
  const ingestSnapshotRef = useRef<GrpcTabProtoIngestState | null>(null);
  const { onDragStart, isDragged, overlayStyle, modalStyle } = useModalDrag(open, {
    modalRef,
    anchor: GRPC_PROTO_MODAL_ANCHOR,
  });
  const { resizeStyle, onCorner, resetSize } = useModalResize(760, 500);

  const combinedModalStyle = resizeStyle
    ? {
        ...(modalStyle ?? {}),
        ...resizeStyle,
      }
    : modalStyle;

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setActiveTab(initialTab ?? ingest.source);
      setUploadError(undefined);
      ingestSnapshotRef.current = cloneIngestState(ingest);
    }
    if (!open) {
      ingestSnapshotRef.current = null;
      resetSize();
    }
    wasOpenRef.current = open;
  }, [open, initialTab, ingest, resetSize]);

  const handleCancel = useCallback(() => {
    if (ingestSnapshotRef.current) {
      onIngestChange(ingestSnapshotRef.current);
    }
    onClose();
  }, [onClose, onIngestChange]);

  const handleSave = useCallback(() => {
    onClose();
  }, [onClose]);

  const protoRoots = ensureProtoRoots(ingest);
  const selectedRoot = protoRoots.find((root) => root.id === selectedRootId) ?? protoRoots[0];

  useEffect(() => {
    if (!selectedRoot) {
      setSelectedRootId(DEFAULT_PROTO_ROOT_ID);
      return;
    }
    if (!protoRoots.some((root) => root.id === selectedRootId)) {
      setSelectedRootId(selectedRoot.id);
    }
  }, [protoRoots, selectedRoot, selectedRootId]);

  const loading = loadState === 'loading';

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && loadState !== 'loading') {
        event.preventDefault();
        handleCancel();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, handleCancel, loadState]);

  const switchTab = useCallback((tab: ProtoModalTab) => {
    setActiveTab(tab);
    setUploadError(undefined);
    if (tab !== 'schema_browser') {
      onIngestChange({ source: tab });
    }
  }, [onIngestChange]);

  const applyProtoRoots = useCallback((nextRoots: ProtoRootDraft[]) => {
    onIngestChange({
      source: 'proto_files',
      protoRoots: nextRoots,
    });
  }, [onIngestChange]);

  const handleProtoFiles = useCallback(async (files: FileList | File[]) => {
    try {
      const drafts = await readProtoFilesFromFileList(files);
      const roots = ensureProtoRoots(ingest);
      const nextRoots = roots.map((root) => {
        if (root.id !== (selectedRoot?.id ?? roots[0]?.id)) {
          return root;
        }
        return {
          ...root,
          files: mergeProtoFileDrafts(root.files, drafts),
        };
      });
      applyProtoRoots(nextRoots);
      setUploadError(undefined);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Failed to read proto files');
    }
  }, [applyProtoRoots, ingest, selectedRoot]);

  const handleProtosetFile = useCallback(async (file: File) => {
    try {
      const { base64, fileName } = await readProtosetBase64FromFile(file);
      onIngestChange({
        source: 'protoset',
        protosetBase64: base64,
        protosetFileName: fileName,
      });
      setUploadError(undefined);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Failed to read protoset file');
    }
  }, [onIngestChange]);

  const onProtoInputChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files?.length) return;
    await handleProtoFiles(files);
    event.target.value = '';
  };

  const onProtosetInputChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await handleProtosetFile(file);
    event.target.value = '';
  };

  const onDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
    const files = event.dataTransfer.files;
    if (!files.length) return;
    if (activeTab === 'protoset') {
      const file = files[0];
      if (file) await handleProtosetFile(file);
      return;
    }
    await handleProtoFiles(files);
  };

  const removeProtoFile = (path: string) => {
    const roots = ensureProtoRoots(ingest);
    const targetRootId = selectedRoot?.id ?? roots[0]?.id;
    const nextRoots = roots.map((root) => {
      if (root.id !== targetRootId) return root;
      return {
        ...root,
        files: root.files.filter((file) => file.path !== path),
      };
    });
    applyProtoRoots(nextRoots);
  };

  const clearSelectedRootFiles = () => {
    const roots = ensureProtoRoots(ingest);
    const targetRootId = selectedRoot?.id ?? roots[0]?.id;
    const nextRoots = roots.map((root) => {
      if (root.id !== targetRootId) return root;
      return {
        ...root,
        files: [],
      };
    });
    applyProtoRoots(nextRoots);
  };

  const clearProtosetSelection = () => {
    onIngestChange({
      source: 'protoset',
      protosetBase64: undefined,
      protosetFileName: undefined,
    });
  };

  const addProtoRoot = () => {
    const mountPath = normalizeImportRoot(rootMountDraft);
    if (!mountPath) return;
    const roots = ensureProtoRoots(ingest);
    const existing = roots.find((root) => normalizeImportRoot(root.mountPath) === mountPath);
    if (existing) {
      setSelectedRootId(existing.id);
      setRootMountDraft('');
      return;
    }
    const nextRoot: ProtoRootDraft = {
      id: `root-${Date.now().toString(36)}`,
      mountPath,
      files: [],
    };
    const nextRoots = [...roots, nextRoot];
    applyProtoRoots(nextRoots);
    setSelectedRootId(nextRoot.id);
    setRootMountDraft('');
  };

  const removeProtoRoot = (rootId: string) => {
    const roots = ensureProtoRoots(ingest);
    const nextRootsRaw = roots.filter((root) => root.id !== rootId);
    const nextRoots = nextRootsRaw.length > 0
      ? nextRootsRaw
      : [{ id: DEFAULT_PROTO_ROOT_ID, mountPath: DEFAULT_PROTO_ROOT_MOUNT, files: [] }];
    applyProtoRoots(nextRoots);
    setSelectedRootId(nextRoots[0]!.id);
  };

  const canLoad = activeTab !== 'schema_browser' && (
    activeTab === 'proto_files'
      ? protoRoots.some((root) => root.files.length > 0)
      : activeTab === 'protoset'
        ? Boolean(ingest.protosetBase64?.trim())
        : activeTab === 'url_proto'
          ? Boolean(ingest.url?.trim())
          : Boolean(ingest.bsrModule?.trim())
  );

  const isSchemaBrowser = activeTab === 'schema_browser';

  if (!open) return null;

  return (
    <div
      className={`grpc-proto-modal-overlay${isDragged ? ' grpc-proto-modal-overlay--positioned' : ''}`}
      data-testid="grpc-proto-manage-modal"
      style={overlayStyle}
      onMouseDown={(event) => {
        if (loading || isDragged) return;
        if (event.target === event.currentTarget) handleCancel();
      }}
    >
      <div
        ref={modalRef}
        className={`grpc-proto-modal${isDragged ? ' grpc-proto-modal--dragged' : ''}`}
        style={combinedModalStyle}
        role="dialog"
        aria-modal="true"
        aria-label="Manage schemas"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header
          className="grpc-proto-modal-header grpc-proto-modal-header--draggable"
          data-testid="grpc-proto-modal-header"
          onMouseDown={onDragStart}
        >
          <ModalDragGrip />
          <div className="grpc-proto-modal-header-text">
            <h2 className="grpc-proto-modal-title">Manage Schemas</h2>
            <p className="grpc-proto-modal-subtitle">
              Load service definitions from proto files, protoset, URL, BSR, or browse the loaded schema.
            </p>
          </div>
        </header>

        <nav className="grpc-proto-modal-tabs" aria-label="Schema source">
          <button
            type="button"
            className={`grpc-proto-modal-tab${activeTab === 'proto_files' ? ' grpc-proto-modal-tab--active' : ''}`}
            data-testid="grpc-proto-tab-proto-files"
            onClick={() => switchTab('proto_files')}
          >
            Proto files
          </button>
          <button
            type="button"
            className={`grpc-proto-modal-tab${activeTab === 'protoset' ? ' grpc-proto-modal-tab--active' : ''}`}
            data-testid="grpc-proto-tab-protoset"
            onClick={() => switchTab('protoset')}
          >
            Protoset
          </button>
          <button
            type="button"
            className={`grpc-proto-modal-tab${activeTab === 'url_proto' ? ' grpc-proto-modal-tab--active' : ''}`}
            data-testid="grpc-proto-tab-url"
            onClick={() => switchTab('url_proto')}
          >
            URL
          </button>
          <button
            type="button"
            className={`grpc-proto-modal-tab${activeTab === 'bsr' ? ' grpc-proto-modal-tab--active' : ''}`}
            data-testid="grpc-proto-tab-bsr"
            onClick={() => switchTab('bsr')}
          >
            BSR
          </button>
          <button
            type="button"
            className={`grpc-proto-modal-tab${activeTab === 'schema_browser' ? ' grpc-proto-modal-tab--active' : ''}`}
            data-testid="grpc-proto-tab-schema-browser"
            onClick={() => switchTab('schema_browser')}
            disabled={!descriptor}
            title={descriptor ? 'Browse loaded schema' : 'Load a schema first'}
          >
            Schema browser
          </button>
        </nav>

        <div className="grpc-proto-modal-body">
          {loadError && (
            <p className="grpc-proto-modal-error grpc-proto-modal-load-error" data-testid="grpc-proto-load-error">
              {loadError}
            </p>
          )}
          {exportError && (
            <p className="grpc-proto-modal-error" data-testid="grpc-proto-export-error">
              {exportError}
            </p>
          )}
          {uploadError && (
            <p className="grpc-proto-modal-error" data-testid="grpc-proto-upload-error">
              {uploadError}
            </p>
          )}

          <p
            className="grpc-proto-modal-tab-hint"
            data-testid={`grpc-proto-tab-hint-${activeTab}`}
          >
            {TAB_HINTS[activeTab]}
          </p>

          <div
            className={`grpc-proto-modal-tab-panel${
              isSchemaBrowser ? ' grpc-proto-modal-tab-panel--schema-browser' : ''
            }${activeTab === 'protoset' ? ' grpc-proto-modal-tab-panel--centered' : ''}`}
          >
          {isSchemaBrowser && (
            descriptor
              ? (
                <GrpcSchemaBrowser
                  descriptor={descriptor}
                  targetAddress={targetAddress}
                  tlsMode={tlsMode}
                  selectedService={selectedService}
                  selectedMethod={selectedMethod}
                  grpcurlExportContext={grpcurlExportContext}
                  onSelectMethod={onSelectMethod}
                  onOpenInTab={onOpenMethodInTab}
                  onExportProtoset={onExportProtoset}
                  exportProtosetBusy={exportProtosetBusy}
                />
              )
              : (
                <p className="grpc-schema-browser-empty" data-testid="grpc-schema-browser-empty">
                  Load a schema via Reflect or the ingest tabs to browse services and types.
                </p>
              )
          )}

          {activeTab === 'proto_files' && (
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
                          onChange={(event) => setRootMountDraft(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault();
                              addProtoRoot();
                            }
                          }}
                          placeholder="e.g. shared or vendor/acme"
                          spellCheck={false}
                        />
                        <button
                          type="button"
                          className="grpc-proto-import-add-btn"
                          data-testid="grpc-proto-root-add-btn"
                          onClick={addProtoRoot}
                        >
                          Add root
                        </button>
                      </div>
                    </div>

                    <ul className="grpc-proto-root-list" data-testid="grpc-proto-root-list">
                      {protoRoots.map((root) => {
                        const active = selectedRoot?.id === root.id;
                        return (
                          <li key={root.id} className="grpc-proto-root-item">
                            <button
                              type="button"
                              className={`grpc-proto-root-item-btn${active ? ' grpc-proto-root-item-btn--active' : ''}`}
                              data-testid={`grpc-proto-root-item-${root.id}`}
                              onClick={() => setSelectedRootId(root.id)}
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
                              onClick={() => removeProtoRoot(root.id)}
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
                    onDragEnter={(event) => {
                      event.preventDefault();
                      setDragActive(true);
                    }}
                    onDragOver={(event) => {
                      event.preventDefault();
                      setDragActive(true);
                    }}
                    onDragLeave={(event) => {
                      event.preventDefault();
                      setDragActive(false);
                    }}
                    onDrop={onDrop}
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
                      Selected root: <strong>{selectedRoot?.mountPath ?? DEFAULT_PROTO_ROOT_MOUNT}</strong>
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

                  {(() => {
                    const selectedFiles = selectedRoot?.files ?? [];
                    const mountPath = selectedRoot?.mountPath ?? DEFAULT_PROTO_ROOT_MOUNT;
                    const diagnostics = detectProtoRootCollisions(protoRoots)
                      .filter((diag) => diag.affectedFiles.some((file) => file.rootId === selectedRoot?.id));
                    const rows = selectedFiles.map((file) => ({
                      file,
                      canonicalPath: computeCanonicalProtoPath(mountPath, file.path),
                    }));

                    return (
                      <div className="grpc-proto-form-card grpc-proto-files-table-card" data-testid="grpc-proto-canonical-preview">
                        <div className="grpc-proto-file-list-header grpc-proto-file-list-header--table">
                          <span className="grpc-proto-upload-hint">
                            Uploaded files in <strong>{mountPath}</strong>
                          </span>
                          <button
                            type="button"
                            className="grpc-proto-import-remove"
                            data-testid="grpc-proto-file-clear-all"
                            onClick={clearSelectedRootFiles}
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
                                      onClick={() => removeProtoFile(file.path)}
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
                    );
                  })()}
                </section>
              </div>
            </>
          )}

          {activeTab === 'protoset' && (
            <>
              <div
                className={`grpc-proto-upload-zone${dragActive ? ' grpc-proto-upload-zone--drag' : ''}`}
                data-testid="grpc-proto-protoset-zone"
                onDragEnter={(event) => {
                  event.preventDefault();
                  setDragActive(true);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={(event) => {
                  event.preventDefault();
                  setDragActive(false);
                }}
                onDrop={onDrop}
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
                    onClick={clearProtosetSelection}
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
          )}

          {activeTab === 'url_proto' && (
            <div className="grpc-proto-form-card">
              <div className="grpc-proto-form-row">
                <div className="grpc-proto-form-label-col">
                  <label className="grpc-proto-import-label" htmlFor="grpc-proto-url-input">
                    Proto URL
                  </label>
                </div>
                <div className="grpc-proto-form-ctrl-col">
                  <input
                    id="grpc-proto-url-input"
                    className="grpc-proto-import-input grpc-proto-remote-input"
                    data-testid="grpc-proto-url-input"
                    value={ingest.url ?? ''}
                    onChange={(event) => onIngestChange({ source: 'url_proto', url: event.target.value })}
                    placeholder="https://example.com/schemas/echo.proto"
                    spellCheck={false}
                  />
                  <p className="grpc-proto-import-hint">
                    HTTPS URL to a `.proto` file — fetched server-side (SSRF-protected).
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'bsr' && (
            <div className="grpc-proto-form-card">
              <div className="grpc-proto-form-row">
                <div className="grpc-proto-form-label-col">
                  <label className="grpc-proto-import-label" htmlFor="grpc-proto-bsr-module-input">
                    BSR module
                  </label>
                </div>
                <div className="grpc-proto-form-ctrl-col">
                  <input
                    id="grpc-proto-bsr-module-input"
                    className="grpc-proto-import-input grpc-proto-remote-input"
                    data-testid="grpc-proto-bsr-module-input"
                    value={ingest.bsrModule ?? ''}
                    onChange={(event) => onIngestChange({ source: 'bsr', bsrModule: event.target.value })}
                    placeholder="buf.build/acme/echo"
                    spellCheck={false}
                  />
                  <p className="grpc-proto-import-hint">
                    Module reference such as `buf.build/acme/echo` or `acme/echo`.
                  </p>
                </div>
              </div>
              <div className="grpc-proto-form-row">
                <div className="grpc-proto-form-label-col">
                  <label className="grpc-proto-import-label" htmlFor="grpc-proto-bsr-version-input">
                    Version / label
                  </label>
                </div>
                <div className="grpc-proto-form-ctrl-col">
                  <input
                    id="grpc-proto-bsr-version-input"
                    className="grpc-proto-import-input grpc-proto-remote-input"
                    data-testid="grpc-proto-bsr-version-input"
                    value={ingest.bsrVersion ?? ''}
                    onChange={(event) => onIngestChange({ bsrVersion: event.target.value })}
                    placeholder="main (default)"
                    spellCheck={false}
                  />
                </div>
              </div>
              <div className="grpc-proto-form-row">
                <div className="grpc-proto-form-label-col">
                  <label className="grpc-proto-import-label" htmlFor="grpc-proto-bsr-token-input">
                    API token
                  </label>
                </div>
                <div className="grpc-proto-form-ctrl-col">
                  <input
                    id="grpc-proto-bsr-token-input"
                    className="grpc-proto-import-input grpc-proto-remote-input"
                    data-testid="grpc-proto-bsr-token-input"
                    type="password"
                    autoComplete="off"
                    value={ingest.bsrToken ?? ''}
                    onChange={(event) => onIngestChange({ bsrToken: event.target.value })}
                    placeholder="Bearer token for private BSR modules"
                    spellCheck={false}
                  />
                  <p className="grpc-proto-import-hint">
                    Optional — required for private modules. Sent server-side only.
                  </p>
                </div>
              </div>
            </div>
          )}
          </div>
        </div>

        <footer className="grpc-proto-modal-footer">
          <button
            type="button"
            className="grpc-proto-modal-cancel"
            data-testid="grpc-proto-cancel-btn"
            onClick={handleCancel}
            disabled={loading}
          >
            Cancel
          </button>
          {!isSchemaBrowser && (
            <button
              type="button"
              className="grpc-proto-modal-save"
              data-testid="grpc-proto-save-btn"
              onClick={handleSave}
              disabled={loading}
            >
              Save
            </button>
          )}
          {!isSchemaBrowser && (
            <button
              type="button"
              className="grpc-proto-modal-load"
              data-testid="grpc-proto-load-btn"
              onClick={onLoad}
              disabled={loading || !canLoad}
              aria-label="Load descriptor from selected schema source"
            >
              {loading ? 'Loading…' : 'Load'}
            </button>
          )}
        </footer>

        <div
          className="modal-resize-corner"
          onMouseDown={onCorner}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
