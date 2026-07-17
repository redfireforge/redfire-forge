/**
 * GraphqlFileUpload — "Files" tab inside the Variables bottom panel.
 *
 * Phase 2.0 Sprint 4 — 2E-1 (UI) + 2E-5 (client-side validation)
 *
 * Features:
 *   - Drag-and-drop dropzone + "Browse files" button
 *   - Per-file row: variable path input, filename, MIME, human-readable size, × remove
 *   - null placeholder is injected automatically in the multipart payload by buildMultipartFormData
 *     (the Variables editor is NOT modified)
 *   - Client-side size validation on selection (configurable soft cap + 200 MB hard cap)
 *   - Multiple files supported with numbered defaults: "files.0", "files.1" etc.
 */

import { useCallback, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { FileEntry } from '../utils/multipartBuilder';

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_MAX_FILE_SIZE_MB = 50;
const HARD_CAP_MB = 200;
const DEFAULT_MAX_BYTES = DEFAULT_MAX_FILE_SIZE_MB * 1024 * 1024;
const HARD_CAP_BYTES = HARD_CAP_MB * 1024 * 1024;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function validateFileSize(file: File, maxBytes: number): string | null {
  if (file.size > HARD_CAP_BYTES) {
    return `File exceeds the ${HARD_CAP_MB} MB hard cap and cannot be uploaded`;
  }
  if (file.size > maxBytes) {
    const fileMb = (file.size / (1024 * 1024)).toFixed(1);
    const maxMb = (maxBytes / (1024 * 1024)).toFixed(0);
    return `File too large (${fileMb} MB) — maximum is ${maxMb} MB`;
  }
  return null;
}

function makeDefaultVarPath(index: number, totalCount: number): string {
  // When the only file being added results in exactly one total entry → "avatar".
  // For multi-file adds (or adding to an existing list) → "files.N".
  if (totalCount === 1) return 'avatar';
  return `files.${index}`;
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface GraphqlFileUploadProps {
  entries: FileEntry[];
  onEntriesChange: (entries: FileEntry[]) => void;
  /** Configurable soft cap in MB (default 50 MB). 0 = use hard cap only. */
  maxFileSizeMb?: number;
  /** Sprint 8 (2E-4): 0–100 while uploading, null when idle. Shows a progress bar. */
  uploadProgress?: number | null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function GraphqlFileUpload({
  entries,
  onEntriesChange,
  maxFileSizeMb = DEFAULT_MAX_FILE_SIZE_MB,
  uploadProgress,
}: GraphqlFileUploadProps) {
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const maxBytes = maxFileSizeMb > 0 ? maxFileSizeMb * 1024 * 1024 : DEFAULT_MAX_BYTES;

  // ── Add files ───────────────────────────────────────────────────────────────

  const addFiles = useCallback((fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;

    const startIdx = entries.length;
    const totalAfter = startIdx + files.length;

    const newEntries: FileEntry[] = files.map((file, i) => ({
      id: uuidv4(),
      file,
      varPath: makeDefaultVarPath(startIdx + i, totalAfter),
      error: validateFileSize(file, maxBytes),
    }));

    onEntriesChange([...entries, ...newEntries]);
  }, [entries, onEntriesChange, maxBytes]);

  // ── Remove file ─────────────────────────────────────────────────────────────

  const removeEntry = useCallback((id: string) => {
    const next = entries.filter((e) => e.id !== id);
    onEntriesChange(next);
  }, [entries, onEntriesChange]);

  // ── Update varPath ──────────────────────────────────────────────────────────

  const updateVarPath = useCallback((id: string, varPath: string) => {
    onEntriesChange(
      entries.map((e) => e.id === id ? { ...e, varPath } : e)
    );
  }, [entries, onEntriesChange]);

  // ── Drag-and-drop handlers ───────────────────────────────────────────────────

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  }, [addFiles]);

  const onDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const onDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    // Only clear drag-over when truly leaving the dropzone (not just moving to a child)
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
      setDragOver(false);
    }
  }, []);

  // ── Browse picker ─────────────────────────────────────────────────────────

  const onInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files);
      // Reset so re-selecting the same file triggers onChange
      e.target.value = '';
    }
  }, [addFiles]);

  // ── Derived state ──────────────────────────────────────────────────────────

  const hasErrors = entries.some((e) => e.error !== null);
  const validCount = entries.filter((e) => e.error === null && e.varPath.trim() !== '').length;

  return (
    <div className="gql-file-upload" data-testid="gql-file-upload">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        style={{ display: 'none' }}
        onChange={onInputChange}
        data-testid="gql-file-input"
        aria-hidden="true"
        tabIndex={-1}
      />

      {/* Dropzone */}
      <div
        className={`gql-file-dropzone${dragOver ? ' gql-file-dropzone--over' : ''}`}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDragEnter={onDragEnter}
        data-testid="gql-file-dropzone"
        role="button"
        tabIndex={0}
        aria-label="Drop files here or click to browse"
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInputRef.current?.click(); } }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        <span className="gql-file-dropzone-label">
          {dragOver ? 'Release to add files' : 'Drop files here'}
        </span>
        <button
          type="button"
          className="gql-file-browse-btn"
          onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
          data-testid="gql-file-browse-btn"
          aria-label="Browse files"
        >
          Browse
        </button>
        <span className="gql-file-dropzone-hint">
          Max {maxFileSizeMb} MB per file · {HARD_CAP_MB} MB hard cap
        </span>
      </div>

      {/* File list */}
      {entries.length > 0 && (
        <div className="gql-file-list" data-testid="gql-file-list">
          {/* Header row */}
          <div className="gql-file-list-header">
            <span>Variable path</span>
            <span>File</span>
            <span>Size</span>
            <span></span>
          </div>

          {entries.map((entry) => (
            <div
              key={entry.id}
              className={`gql-file-row${entry.error ? ' gql-file-row--error' : ''}`}
              data-testid="gql-file-row"
            >
              {/* Variable path input */}
              <input
                type="text"
                className="gql-file-var-input"
                value={entry.varPath}
                onChange={(e) => updateVarPath(entry.id, e.target.value)}
                placeholder="avatar"
                aria-label={`Variable path for ${entry.file.name}`}
                data-testid="gql-file-var-input"
                spellCheck={false}
              />

              {/* Filename + MIME */}
              <div className="gql-file-name-col">
                <span className="gql-file-name" title={entry.file.name}>
                  {entry.file.name}
                </span>
                {entry.file.type && (
                  <span className="gql-file-mime" title={entry.file.type}>
                    {entry.file.type}
                  </span>
                )}
              </div>

              {/* Size */}
              <span className={`gql-file-size${entry.error ? ' gql-file-size--error' : ''}`}>
                {formatBytes(entry.file.size)}
              </span>

              {/* Remove button */}
              <button
                type="button"
                className="gql-file-remove-btn"
                onClick={() => removeEntry(entry.id)}
                aria-label={`Remove ${entry.file.name}`}
                data-testid="gql-file-remove-btn"
                title={`Remove ${entry.file.name}`}
              >
                ×
              </button>

              {/* Inline error message */}
              {entry.error && (
                <div className="gql-file-error" role="alert" data-testid="gql-file-error">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  {entry.error}
                </div>
              )}
            </div>
          ))}

          {/* Footer summary */}
          <div className="gql-file-list-footer">
            {hasErrors ? (
              <span className="gql-file-footer-error">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                Fix file errors before executing
              </span>
            ) : (
              <span className="gql-file-footer-ok">
                {validCount} file{validCount !== 1 ? 's' : ''} ready to upload
              </span>
            )}
          </div>

          {/* Sprint 8 (2E-4): upload progress bar */}
          {uploadProgress != null && (
            <div className="gql-file-progress" data-testid="gql-files-progress">
              <div className="gql-file-progress-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={uploadProgress}>
                <div
                  className={`gql-file-progress-fill${uploadProgress === 0 ? ' gql-file-progress-fill--indeterminate' : ''}`}
                  style={uploadProgress === 0 ? undefined : { width: `${uploadProgress}%` }}
                />
              </div>
              <span className="gql-file-progress-label">
                {uploadProgress === 0
                  ? 'Uploading…'
                  : uploadProgress < 98
                    ? `Uploading… ${uploadProgress}%`
                    : 'Processing…'}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Instructions when no files */}
      {entries.length === 0 && (
        <div className="gql-file-empty-hint" data-testid="gql-file-empty-hint">
          <p>
            Add files here to include them in the GraphQL mutation via the{' '}
            <a
              href="https://github.com/jaydenseric/graphql-multipart-request-spec"
              target="_blank"
              rel="noopener noreferrer"
              className="gql-file-spec-link"
            >
              multipart request spec
            </a>
            .
          </p>
          <p>
            Set each file's <strong>variable path</strong> to match the corresponding variable name
            in your mutation, e.g. <code>"avatar"</code> for a mutation that declares <code>$avatar: Upload!</code>.
            The <code>null</code> placeholder is injected automatically in the multipart payload — no need to
            edit your variables.
          </p>
        </div>
      )}
    </div>
  );
}
