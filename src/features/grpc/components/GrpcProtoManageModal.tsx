import { useCallback, useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import type { GrpcDescriptor, GrpcProtoRootInput } from '../../../shared/grpc/contracts';
import type { GrpcDescriptorLoadState, GrpcTabProtoIngestState } from '../grpcStudioTypes';
import { useModalDrag } from '../../../shared/hooks/useModalDrag';
import { useModalResize } from '../../../shared/hooks/useModalResize';
import { GRPC } from '@shared/selectors';
import {
  DEFAULT_PROTO_ROOT_ID,
  DEFAULT_PROTO_ROOT_MOUNT,
  ensureProtoRootsDraft,
  mergeProtoFileDrafts,
  normalizeImportRoot,
  readProtoFilesFromFileList,
  readProtosetBase64FromFile,
} from '../utils/grpcProtoIngestUtils';
import { GrpcSchemaBrowser } from './GrpcSchemaBrowser';
import { GrpcProtoFilesPanel, GrpcProtosetPanel } from './GrpcProtoManageModalPanels';
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

  const dragHandlers = {
    onDragEnter: (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setDragActive(true);
    },
    onDragOver: (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setDragActive(true);
    },
    onDragLeave: (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setDragActive(false);
    },
    onDrop,
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
            <GrpcProtoFilesPanel
              protoRoots={protoRoots}
              selectedRoot={selectedRoot}
              selectedRootId={selectedRootId}
              rootMountDraft={rootMountDraft}
              dragActive={dragActive}
              protoInputRef={protoInputRef}
              onSetRootMountDraft={setRootMountDraft}
              onSelectRoot={setSelectedRootId}
              onAddProtoRoot={addProtoRoot}
              onRemoveProtoRoot={removeProtoRoot}
              onClearSelectedRootFiles={clearSelectedRootFiles}
              onRemoveProtoFile={removeProtoFile}
              onProtoInputChange={onProtoInputChange}
              dragHandlers={dragHandlers}
            />
          )}

          {activeTab === 'protoset' && (
            <GrpcProtosetPanel
              ingest={ingest}
              dragActive={dragActive}
              protosetInputRef={protosetInputRef}
              onProtosetInputChange={onProtosetInputChange}
              onClearProtosetSelection={clearProtosetSelection}
              dragHandlers={dragHandlers}
            />
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
