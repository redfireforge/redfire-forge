import { useCallback, useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import type { GrpcDescriptor } from '../../../shared/grpc/contracts';
import type { GrpcDescriptorLoadState, GrpcTabProtoIngestState } from '../grpcStudioTypes';
import {
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
  onOpenMethodInTab?: (serviceFullName: string, methodName: string) => void;
  onExportProtoset?: () => void | Promise<void>;
  exportProtosetBusy?: boolean;
  exportError?: string;
  grpcurlExportContext?: GrpcGrpcurlExportContext;
}

export type ProtoModalTab = GrpcTabProtoIngestState['source'] | 'schema_browser';

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
  const [importPathDraft, setImportPathDraft] = useState('');
  const [uploadError, setUploadError] = useState<string | undefined>();
  const [dragActive, setDragActive] = useState(false);
  const protoInputRef = useRef<HTMLInputElement>(null);
  const protosetInputRef = useRef<HTMLInputElement>(null);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setActiveTab(initialTab ?? ingest.source);
      setUploadError(undefined);
    }
    wasOpenRef.current = open;
  }, [open, initialTab, ingest.source]);

  const loading = loadState === 'loading';

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && loadState !== 'loading') {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose, loadState]);

  const switchTab = useCallback((tab: ProtoModalTab) => {
    setActiveTab(tab);
    setUploadError(undefined);
    if (tab !== 'schema_browser') {
      onIngestChange({ source: tab });
    }
  }, [onIngestChange]);

  const handleProtoFiles = useCallback(async (files: FileList | File[]) => {
    try {
      const drafts = await readProtoFilesFromFileList(files);
      onIngestChange({
        source: 'proto_files',
        protoFiles: mergeProtoFileDrafts(ingest.protoFiles, drafts),
      });
      setUploadError(undefined);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Failed to read proto files');
    }
  }, [ingest.protoFiles, onIngestChange]);

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

  const addImportPath = () => {
    const trimmed = normalizeImportRoot(importPathDraft);
    if (!trimmed) return;
    if (ingest.importPaths.includes(trimmed)) {
      setImportPathDraft('');
      return;
    }
    onIngestChange({ importPaths: [...ingest.importPaths, trimmed] });
    setImportPathDraft('');
  };

  const removeImportPath = (path: string) => {
    onIngestChange({ importPaths: ingest.importPaths.filter((entry) => entry !== path) });
  };

  const removeProtoFile = (path: string) => {
    onIngestChange({
      protoFiles: ingest.protoFiles.filter((file) => file.path !== path),
    });
  };

  const canLoad = activeTab !== 'schema_browser' && (
    activeTab === 'proto_files'
      ? ingest.protoFiles.length > 0
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
      className="grpc-proto-modal-overlay"
      data-testid="grpc-proto-manage-modal"
      onMouseDown={(event) => {
        if (loading) return;
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={`grpc-proto-modal${isSchemaBrowser ? ' grpc-proto-modal--schema-browser' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Manage schemas"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="grpc-proto-modal-header">
          <h2 className="grpc-proto-modal-title">Manage Schemas</h2>
          <p className="grpc-proto-modal-subtitle">
            {isSchemaBrowser
              ? 'Browse loaded services, methods, messages, and enums — or switch tabs to load a new schema source.'
              : 'Load service definitions from proto files, protoset, URL, or Buf Schema Registry.'}
          </p>
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

        <div className={`grpc-proto-modal-body${isSchemaBrowser ? ' grpc-proto-modal-body--schema-browser' : ''}`}>
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
              <div
                className={`grpc-proto-upload-zone${dragActive ? ' grpc-proto-upload-zone--drag' : ''}`}
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

              {ingest.protoFiles.length > 0 && (
                <ul className="grpc-proto-file-list" data-testid="grpc-proto-file-list">
                  {ingest.protoFiles.map((file) => (
                    <li key={file.path} className="grpc-proto-file-item">
                      <span className="grpc-proto-file-name">{file.path}</span>
                      <span className="grpc-proto-file-size">
                        {formatProtoFileSize(file.sizeBytes ?? file.content.length)}
                      </span>
                      <button
                        type="button"
                        className="grpc-proto-file-remove"
                        aria-label={`Remove ${file.path}`}
                        onClick={() => removeProtoFile(file.path)}
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="grpc-proto-import-section">
                <label className="grpc-proto-import-label" htmlFor="grpc-proto-import-path-input">
                  Import roots
                </label>
                <p className="grpc-proto-import-hint">
                  Optional virtual roots for resolving short import paths (e.g. `shared` for `shared/common.proto`).
                </p>
                <div className="grpc-proto-import-row">
                  <input
                    id="grpc-proto-import-path-input"
                    className="grpc-proto-import-input"
                    data-testid="grpc-proto-import-path-input"
                    value={importPathDraft}
                    onChange={(event) => setImportPathDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        addImportPath();
                      }
                    }}
                    placeholder="e.g. shared or vendor/acme"
                    spellCheck={false}
                  />
                  <button
                    type="button"
                    className="grpc-proto-import-add-btn"
                    data-testid="grpc-proto-import-path-add"
                    onClick={addImportPath}
                  >
                    Add
                  </button>
                </div>
                {ingest.importPaths.length > 0 && (
                  <ul className="grpc-proto-import-list" data-testid="grpc-proto-import-path-list">
                    {ingest.importPaths.map((path) => (
                      <li key={path} className="grpc-proto-import-item">
                        <code>{path}</code>
                        <button
                          type="button"
                          className="grpc-proto-import-remove"
                          aria-label={`Remove import root ${path}`}
                          onClick={() => removeImportPath(path)}
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}

          {activeTab === 'protoset' && (
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
              {ingest.protosetFileName && (
                <p className="grpc-proto-protoset-name" data-testid="grpc-proto-protoset-name">
                  Selected: <strong>{ingest.protosetFileName}</strong>
                </p>
              )}
              <input
                ref={protosetInputRef}
                type="file"
                accept=".pb,.protoset"
                hidden
                onChange={onProtosetInputChange}
              />
            </div>
          )}

          {activeTab === 'url_proto' && (
            <div className="grpc-proto-remote-section">
              <label className="grpc-proto-import-label" htmlFor="grpc-proto-url-input">
                Proto URL
              </label>
              <p className="grpc-proto-import-hint">
                HTTPS URL to a `.proto` file — fetched server-side (SSRF-protected).
              </p>
              <input
                id="grpc-proto-url-input"
                className="grpc-proto-import-input grpc-proto-remote-input"
                data-testid="grpc-proto-url-input"
                value={ingest.url ?? ''}
                onChange={(event) => onIngestChange({ source: 'url_proto', url: event.target.value })}
                placeholder="https://example.com/schemas/echo.proto"
                spellCheck={false}
              />
            </div>
          )}

          {activeTab === 'bsr' && (
            <div className="grpc-proto-remote-section">
              <label className="grpc-proto-import-label" htmlFor="grpc-proto-bsr-module-input">
                BSR module
              </label>
              <p className="grpc-proto-import-hint">
                Module reference such as `buf.build/acme/echo` or `acme/echo`.
              </p>
              <input
                id="grpc-proto-bsr-module-input"
                className="grpc-proto-import-input grpc-proto-remote-input"
                data-testid="grpc-proto-bsr-module-input"
                value={ingest.bsrModule ?? ''}
                onChange={(event) => onIngestChange({ source: 'bsr', bsrModule: event.target.value })}
                placeholder="buf.build/acme/echo"
                spellCheck={false}
              />
              <label className="grpc-proto-import-label" htmlFor="grpc-proto-bsr-version-input">
                Version / label
              </label>
              <input
                id="grpc-proto-bsr-version-input"
                className="grpc-proto-import-input grpc-proto-remote-input"
                data-testid="grpc-proto-bsr-version-input"
                value={ingest.bsrVersion ?? ''}
                onChange={(event) => onIngestChange({ bsrVersion: event.target.value })}
                placeholder="main (default)"
                spellCheck={false}
              />
              <label className="grpc-proto-import-label" htmlFor="grpc-proto-bsr-token-input">
                API token
              </label>
              <p className="grpc-proto-import-hint">
                Optional — required for private modules. Sent server-side only.
              </p>
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
            </div>
          )}
        </div>

        <footer className="grpc-proto-modal-footer">
          <button
            type="button"
            className="grpc-proto-modal-cancel"
            data-testid="grpc-proto-cancel-btn"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
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
      </div>
    </div>
  );
}
