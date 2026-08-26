import { useState, useCallback, useMemo } from 'react';
import WorkflowEditorModalFrame from './modals/WorkflowEditorModalFrame';
import type { HarParseResult, ParsedHarEntry } from '../utils/harParser';
import { detectChains } from '../utils/harChainDetector';

interface Props {
  open: boolean;
  parseResult: HarParseResult;
  fileName: string;
  onClose: () => void;
  /** Called with the user-selected entries and the workflow name they typed */
  onImport: (entries: ParsedHarEntry[], workflowName: string) => void;
}

function statusTone(status: number): 'success' | 'warning' | 'danger' | 'info' | '' {
  if (status >= 500) return 'danger';
  if (status >= 400) return 'warning';
  if (status >= 300) return 'info';
  if (status >= 200) return 'success';
  return '';
}

/**
 * Review modal shown after a HAR file is parsed.
 * The user can:
 * - Name the resulting workflow
 * - Deselect entries they don't want included
 * - See which sensitive headers were replaced with {{variables}}
 * - See how many tracking/analytics requests were filtered out
 */
export function HarImportPreviewModal({
  open,
  parseResult,
  fileName,
  onClose,
  onImport,
}: Props) {
  // Default workflow name: hostname of the first entry, or the file name without extension
  const defaultName = useMemo(() => {
    if (parseResult.entries[0]?.host) return `${parseResult.entries[0].host} import`;
    return fileName.replace(/\.har$/i, '') + ' import';
  }, [parseResult.entries, fileName]);

  const [workflowName, setWorkflowName] = useState(defaultName);

  // All accepted entries are checked by default
  const [selected, setSelected] = useState<Set<number>>(
    () => new Set(parseResult.entries.map((_, i) => i)),
  );

  const toggleEntry = useCallback((i: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelected(new Set(parseResult.entries.map((_, i) => i)));
  }, [parseResult.entries]);

  const selectNone = useCallback(() => {
    setSelected(new Set());
  }, []);

  const handleImport = useCallback(() => {
    const selectedEntries = parseResult.entries.filter((_, i) => selected.has(i));
    if (selectedEntries.length === 0) return;
    const field = document.getElementById('har-import-wf-name');
    const fromField = field instanceof HTMLInputElement ? field.value : workflowName;
    onImport(selectedEntries, fromField.trim() || 'HAR import');
  }, [parseResult.entries, selected, workflowName, onImport]);

  // Build a map of redacted header name → replacement variable from entry data
  // (avoids coupling to harParser internals)
  const redactedMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const entry of parseResult.entries) {
      for (const name of entry.redactedHeaderNames) {
        if (!map.has(name)) {
          map.set(name, entry.headers[name] ?? '{{variable}}');
        }
      }
    }
    return map;
  }, [parseResult.entries]);

  // Run chain detection speculatively on the currently selected entries so we can
  // show the user what variable chains will be auto-detected before they confirm.
  const chainSummary = useMemo(() => {
    const selectedEntries = parseResult.entries.filter((_, i) => selected.has(i));
    if (selectedEntries.length < 2) return [];
    const { chains } = detectChains(selectedEntries);
    return chains.map(
      (c) =>
        `Step ${c.sourceIndex + 1} → Step ${c.targetIndex + 1}: ${c.jsonPath} → {{${c.variableName}}}`,
    );
  }, [parseResult.entries, selected]);

  const canImport = selected.size > 0 && !parseResult.error;
  const entryCount = parseResult.entries.length;
  const allSelected = entryCount > 0 && selected.size === entryCount;

  const footer = (
    <div className="har-import-footer">
      <button
        type="button"
        className="btn btn-sm btn-secondary"
        onClick={onClose}
        data-testid="har-import-cancel"
      >
        Cancel
      </button>
      <button
        type="button"
        className="btn btn-sm btn-primary"
        onClick={handleImport}
        disabled={!canImport}
        data-testid="har-import-confirm"
      >
        Import as Workflow
        {selected.size > 0 && ` (${selected.size} step${selected.size !== 1 ? 's' : ''})`}
        {' →'}
      </button>
    </div>
  );

  return (
    <WorkflowEditorModalFrame
      open={open}
      title="Import from HAR"
      onClose={onClose}
      footer={footer}
      overlayClassName="wf-config-modal-overlay"
      dialogClassName="wf-config-modal har-import-modal"
      hideExpandButton
    >
      <div className="har-import-body">
      {parseResult.error && (
        <div className="har-import-error" data-testid="har-import-error" role="alert">
          <strong>Cannot parse HAR file</strong>
          <span>{parseResult.error}</span>
        </div>
      )}

      {!parseResult.error && (
        <p className="har-import-summary" data-testid="har-import-summary">
          Found{' '}
          <strong data-testid="har-import-entry-count">{entryCount}</strong>{' '}
          request{entryCount !== 1 ? 's' : ''}
          {parseResult.entries[0]?.host && ` from ${parseResult.entries[0].host}`}
          {parseResult.filteredCount > 0 &&
            ` · ${parseResult.filteredCount} filtered out automatically`}
        </p>
      )}

      <div className="har-import-name-row">
        <label htmlFor="har-import-wf-name" className="har-import-name-label">
          Workflow name
        </label>
        <div className="har-import-name-control">
          <input
            id="har-import-wf-name"
            type="text"
            className="har-import-name-input"
            value={workflowName}
            onChange={(e) => setWorkflowName(e.target.value)}
            data-testid="har-import-wf-name"
            autoComplete="off"
            placeholder="Name the imported workflow"
          />
        </div>
      </div>

      {!parseResult.error && parseResult.entries.length > 0 && (
        <div className="har-import-list-card">
          <div className="har-import-list-toolbar">
            <span className="har-import-list-count">
              {selected.size} of {entryCount} selected
            </span>
            <span className="har-import-select-controls">
              <button
                type="button"
                className="har-import-select-btn"
                onClick={selectAll}
                disabled={allSelected}
                data-testid="har-import-select-all"
              >
                All
              </button>
              <button
                type="button"
                className="har-import-select-btn"
                onClick={selectNone}
                disabled={selected.size === 0}
                data-testid="har-import-select-none"
              >
                None
              </button>
            </span>
          </div>
          <div className="har-import-entry-list" data-testid="har-import-entry-list">
            {parseResult.entries.map((entry, i) => (
              <label
                key={i}
                className={`har-import-entry-row${selected.has(i) ? '' : ' har-import-entry-row--unchecked'}`}
                data-testid={`har-entry-${i}`}
              >
                <input
                  type="checkbox"
                  checked={selected.has(i)}
                  onChange={() => toggleEntry(i)}
                  data-testid={`har-entry-checkbox-${i}`}
                  aria-label={`${entry.method} ${entry.path}`}
                />
                <span
                  className={`har-import-method har-import-method--${entry.method.toLowerCase()}`}
                  data-testid={`har-entry-method-${i}`}
                >
                  {entry.method}
                </span>
                <span className="har-import-entry-path" data-testid={`har-entry-path-${i}`} title={entry.url}>
                  {entry.path}
                </span>
                <span
                  className={`har-import-status har-import-status--${statusTone(entry.responseStatus)}`}
                  data-testid={`har-entry-status-${i}`}
                >
                  {entry.responseStatus}
                </span>
                {entry.warnings.length > 0 && (
                  <span
                    className="har-import-entry-warning"
                    title={entry.warnings.join(' ')}
                    data-testid={`har-entry-warning-${i}`}
                    aria-label="localhost or private IP warning"
                  >
                    !
                  </span>
                )}
              </label>
            ))}
          </div>
        </div>
      )}

      {chainSummary.length > 0 && (
        <div
          className="har-import-info-box"
          data-testid="har-import-chain-summary"
          role="note"
        >
          <strong>
            {chainSummary.length} variable chain{chainSummary.length !== 1 ? 's' : ''} detected automatically:
          </strong>
          <ul className="har-import-chain-list">
            {chainSummary.map((line, i) => (
              <li key={i} data-testid={`har-chain-line-${i}`}>
                <code>{line}</code>
              </li>
            ))}
          </ul>
          <p className="har-import-chain-note">
            These steps will be linked automatically — response values extracted and injected into downstream URLs.
          </p>
        </div>
      )}

      {redactedMap.size > 0 && (
        <div
          className="har-import-warning-box"
          data-testid="har-import-redaction-warning"
          role="note"
        >
          <strong>
            {redactedMap.size} sensitive header{redactedMap.size !== 1 ? 's' : ''} replaced with
            variables:
          </strong>
          <ul className="har-import-redacted-list">
            {Array.from(redactedMap.entries()).map(([name, variable]) => (
              <li key={name}>
                <code>{name}</code> → <code>{variable}</code>
              </li>
            ))}
          </ul>
          <p className="har-import-redaction-note">
            Set these variables in the workflow's Variables panel before running.
          </p>
        </div>
      )}

      {parseResult.trackingFilteredCount > 0 && (
        <div
          className="har-import-info-box"
          data-testid="har-import-tracking-notice"
          role="note"
        >
          {parseResult.trackingFilteredCount} analytics / tracking request
          {parseResult.trackingFilteredCount !== 1 ? 's were' : ' was'} filtered out automatically.
        </div>
      )}

      {parseResult.globalWarnings.map((w, i) => (
        <div
          key={i}
          className="har-import-warning-box"
          data-testid={`har-import-global-warning-${i}`}
          role="note"
        >
          {w}
        </div>
      ))}
      </div>
    </WorkflowEditorModalFrame>
  );
}
