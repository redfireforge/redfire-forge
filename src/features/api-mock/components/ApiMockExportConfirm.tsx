import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import AppModalFrame from '../../../shared/components/AppModalFrame';
import {
  findTextExpandMatches,
  formatTextExpandCount,
  nextTextExpandMatch,
} from './apiMockTextExpand';
import {
  API_MOCK_CLI_SIMULATE,
  API_MOCK_CLI_VERIFY,
  apiMockExportCopyLabel,
  saveApiMockExportToDisk,
  type ApiMockExportResult,
} from '../apiMockExportActions';
import { CheckIcon, CopyIcon, DownloadIcon, MaximizeIcon, ShieldCheckIcon } from './ApiMockIcons';
import { ApiMockTextExpandModal } from './ApiMockTextExpandModal';
import JsonPreview, { buildJTree, collectJTreePaths } from '../../requests/components/JsonTreePreview';
import { SearchMatchBar } from '../../../shared/components/SearchMatchBar';
import { useSearchMatchNavigation } from '../../../shared/hooks/useSearchMatchNavigation';
import { useJsonTreeCollapseState } from '../../../shared/hooks/useJsonTreeCollapseState';

interface Props {
  result: ApiMockExportResult;
  onClose: () => void;
}

type CopiedId = 'preview' | 'cli' | 'verify';

/**
 * Confirmation after an Export menu pick — preview, redaction proof,
 * WireMock loss, HAR count, and the CLI handoff. Save to disk writes the
 * file; Copy keeps it on the clipboard. Auto-download from the menu is
 * skipped while a live demo is open so Chrome cannot freeze Acting.
 */
export function ApiMockExportConfirm({ result, onClose }: Props) {
  const previewRef = useRef<HTMLTextAreaElement>(null);
  const previewBackdropRef = useRef<HTMLPreElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const copiedTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [query, setQuery] = useState('');
  const [matchIndex, setMatchIndex] = useState(0);
  const [copied, setCopied] = useState<CopiedId | null>(null);
  const [previewExpanded, setPreviewExpanded] = useState(false);
  const [jsonPreviewSearch, setJsonPreviewSearchState] = useState('');
  const [jsonPreviewMatchCount, setJsonPreviewMatchCount] = useState(0);
  const {
    collapsedSet: jsonPreviewCollapsed,
    handleTreeToggle: toggleJsonPreviewNode,
    handleCollapseAll: collapseAllJsonPreview,
    handleExpandAll: expandAllJsonPreview,
    expandAllActive: jsonPreviewExpandAllActive,
  } = useJsonTreeCollapseState();
  const {
    currentMatchIndex: jsonPreviewMatchIdx,
    setCurrentMatchIndex: setJsonPreviewMatchIdx,
    goNext: jsonPreviewGoNext,
    goPrev: jsonPreviewGoPrev,
    clear: clearJsonPreviewNav,
  } = useSearchMatchNavigation(jsonPreviewMatchCount);

  const setJsonPreviewSearch = (value: string) => {
    setJsonPreviewSearchState(value);
    setJsonPreviewMatchIdx(0);
  };
  const clearJsonPreviewSearch = () => {
    setJsonPreviewSearchState('');
    clearJsonPreviewNav();
  };

  // Structured tree source: YAML downloads carry the equivalent JSON envelope in
  // `nativeJson`; every other format's `text` is already JSON. Either way we render
  // the parsed structure as a collapsible tree — a YAML export shows the same tree as
  // its JSON round-trip. Unparseable bodies fall back to the plain text preview.
  const jsonPreviewTree = useMemo(() => {
    const source = result.format === 'yaml' ? result.nativeJson : result.text;
    if (!source) return null;
    try { return buildJTree(JSON.parse(source), ''); }
    catch { return null; }
  }, [result.format, result.text, result.nativeJson]);

  const jsonPreviewAllPaths = useMemo(
    () => (jsonPreviewTree ? collectJTreePaths(jsonPreviewTree, '') : []),
    [jsonPreviewTree],
  );
  const collapseAllJsonPreviewNodes = () => collapseAllJsonPreview(new Set(jsonPreviewAllPaths));

  // The inline Preview shows the tree (and the maximized popup uses it too) whenever the
  // export parses into a structure — the two share one search/collapse state so a query
  // typed inline carries into the maximized view. An unparseable body keeps the plain
  // text preview with its own text-match search.
  const showInlineTree = !!jsonPreviewTree;

  useEffect(() => {
    // Preserve the inline tree's search when the maximized popup closes; only reset
    // the popup-only case (unparseable body → popup uses the raw text preview).
    if (previewExpanded || showInlineTree) return;
    setJsonPreviewSearchState('');
    setJsonPreviewMatchCount(0);
  }, [previewExpanded, showInlineTree]);

  const needle = query.trim();
  const matches = useMemo(() => findTextExpandMatches(result.text, query), [result.text, query]);

  // Marked up copy of the preview text, rendered behind the (invisible-text) textarea so
  // matches stay visible without needing focus — typing in the search input keeps focus there.
  // The current match's whole line gets a row highlight, like the Requests-tab response search.
  const previewNodes = useMemo(() => {
    if (!needle || matches.length === 0) return result.text;
    const text = result.text;

    const markMatches = (from: number, to: number): ReactNode[] => {
      const nodes: ReactNode[] = [];
      let cursor = from;
      matches.forEach((start, i) => {
        const end = start + needle.length;
        if (end <= from || start >= to) return;
        const clampedStart = Math.max(start, from);
        const clampedEnd = Math.min(end, to);
        if (clampedStart > cursor) nodes.push(text.slice(cursor, clampedStart));
        nodes.push(
          <mark
            key={start}
            className={i === matchIndex ? 'am-export-preview-match am-export-preview-match-current' : 'am-export-preview-match'}
          >
            {text.slice(clampedStart, clampedEnd)}
          </mark>,
        );
        cursor = clampedEnd;
      });
      if (cursor < to) nodes.push(text.slice(cursor, to));
      return nodes;
    };

    const currentStart = matches[matchIndex] ?? 0;
    const lineStart = text.lastIndexOf('\n', currentStart) + 1;
    const lineEndIdx = text.indexOf('\n', currentStart);
    const lineEnd = lineEndIdx === -1 ? text.length : lineEndIdx;

    return [
      ...markMatches(0, lineStart),
      <span key="current-line" className="am-export-preview-current-line">{markMatches(lineStart, lineEnd)}</span>,
      ...markMatches(lineEnd, text.length),
    ];
  }, [result.text, matches, needle, matchIndex]);

  const syncPreviewScroll = () => {
    const el = previewRef.current;
    const backdrop = previewBackdropRef.current;
    if (!el || !backdrop) return;
    backdrop.scrollTop = el.scrollTop;
    backdrop.scrollLeft = el.scrollLeft;
  };

  useEffect(() => { setMatchIndex(0); }, [query, result.text]);

  // Scroll the current match into view without touching focus.
  useEffect(() => {
    const el = previewRef.current;
    const backdrop = previewBackdropRef.current;
    if (!el || !backdrop || !needle || matches.length === 0) return;
    const current = backdrop.querySelector<HTMLElement>('.am-export-preview-match-current');
    if (!current) return;
    el.scrollTop = Math.max(0, current.offsetTop - el.clientHeight / 2 + current.clientHeight / 2);
    backdrop.scrollTop = el.scrollTop;
  }, [matchIndex, matches, needle]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'f') return;
      if (!searchRef.current) return;
      e.preventDefault();
      searchRef.current.focus();
      searchRef.current.select();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => () => { if (copiedTimer.current) clearTimeout(copiedTimer.current); }, []);

  const markCopied = (id: CopiedId) => {
    setCopied(id);
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(null), 1600);
  };

  const copyText = async (id: CopiedId, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      markCopied(id);
    } catch {
      /* clipboard may be unavailable in tests / restricted iframes */
    }
  };

  const goMatch = (direction: 1 | -1) => {
    const next = nextTextExpandMatch(matchIndex, matches.length, direction);
    setMatchIndex(next);
  };

  const verifyCommand = result.cliCommand.replace(API_MOCK_CLI_SIMULATE, API_MOCK_CLI_VERIFY);
  const showRedaction = result.redacted && (result.tlsKeyPem != null || result.sensitiveValues.length > 0);
  const showSecrets = result.tlsKeyPem != null || result.sensitiveValues.length > 0;
  const title = result.format === 'wiremock'
    ? 'WireMock mappings exported'
    : result.format === 'har'
      ? 'HAR journal exported'
      : result.format === 'yaml'
        ? 'Workspace YAML exported'
        : result.scope === 'workspace'
          ? 'Workspace JSON exported'
          : result.scope === 'servers'
            ? 'Server JSON exported'
            : 'Routes exported';

  const copyButton = (id: CopiedId, text: string, testId: string, label = 'Copy') => (
    <button
      type="button"
      className="am-btn small"
      onClick={() => { void copyText(id, text); }}
      data-testid={testId}
    >
      {copied === id ? <CheckIcon size={12} /> : <CopyIcon size={12} />}
      {copied === id ? 'Copied' : label}
    </button>
  );

  // Copy the exported artifact in its native shape: YAML text for a YAML download,
  // the JSON envelope otherwise (matches the "Copy YAML" / "Copy JSON" label).
  const previewCopyText = result.format === 'yaml' ? result.text : (result.nativeJson ?? result.text);

  // Inline Preview search binds to the tree when it is shown, else to the text search.
  const inlineSearchValue = showInlineTree ? jsonPreviewSearch : query;
  const setInlineSearch = showInlineTree ? setJsonPreviewSearch : setQuery;
  const inlineGoPrev = showInlineTree ? jsonPreviewGoPrev : () => goMatch(-1);
  const inlineGoNext = showInlineTree ? jsonPreviewGoNext : () => goMatch(1);
  const inlineCountLabel = showInlineTree
    ? (jsonPreviewMatchCount > 0 ? `${jsonPreviewMatchIdx + 1}/${jsonPreviewMatchCount}` : '0/0')
    : formatTextExpandCount(matchIndex, matches.length);

  return (
    <AppModalFrame
      title={title}
      onClose={onClose}
      overlayClassName="am-studio-modal-overlay"
      dialogClassName="modal am-studio-modal am-export-confirm-modal"
      bodyClassName="am-studio-modal-body"
      footerClassName="am-studio-modal-footer"
      showExpandButton={false}
      closeOnOverlayClick={false}
      dialogTestId="api-mock-export-confirm"
      footer={(
        <div className="api-mock-root am-in-modal am-modal-toolbar am-export-confirm-footer">
          <span className="am-export-filename" title={result.filename} data-testid="api-mock-export-filename">{result.filename}</span>
          <span className="am-spacer" />
          {copyButton('preview', previewCopyText, 'api-mock-export-copy', apiMockExportCopyLabel(result.format))}
          <button
            type="button"
            className="am-btn primary"
            onClick={() => { saveApiMockExportToDisk(result); }}
            data-testid="api-mock-export-save"
          >
            <DownloadIcon size={12} />
            Save to disk
          </button>
          <button type="button" className="am-btn" onClick={onClose} data-testid="api-mock-export-close">Close</button>
        </div>
      )}
    >
      <div className="api-mock-root am-in-modal am-export-confirm" data-testid="api-mock-export-confirm-body">
        {showRedaction && (
          <div className="am-notice success am-export-banner" data-testid="api-mock-export-redaction">
            <ShieldCheckIcon size={16} />
            <div className="am-export-banner-copy">
              <strong>Secrets stayed in the workspace</strong>
              <p>TLS private keys and sensitive variables never leave the workspace. They are stripped from this file.</p>
            </div>
          </div>
        )}

        {showSecrets && (
          <section className="am-export-card">
            <div className="am-section-heading">Stripped from this file</div>
            <div className="am-form-grid">
              {result.tlsKeyPem != null && (
                <div className="am-form-row">
                  <div className="am-form-label">TLS private key</div>
                  <div className="am-form-control">
                    <span className="am-export-redacted" data-testid="api-mock-export-tls-key">{result.tlsKeyPem || '(empty)'}</span>
                  </div>
                </div>
              )}
              {result.sensitiveValues.map(v => (
                <div className="am-form-row" key={v.key}>
                  <div className="am-form-label">{v.key}</div>
                  <div className="am-form-control">
                    <span className="am-export-redacted" data-testid="api-mock-export-secret">{v.value}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {result.entryCount != null && (
          <div className="am-notice" data-testid="api-mock-export-har-count">
            HAR export: {result.entryCount} {result.entryCount === 1 ? 'entry' : 'entries'}
            {result.lossNotes.length > 0 ? ` · ${result.lossNotes.length} loss note(s)` : ''}
          </div>
        )}
        {result.mappingCount != null && (
          <div className="am-notice" data-testid="api-mock-export-mapping-count">
            WireMock export: {result.mappingCount} mapping{result.mappingCount === 1 ? '' : 's'}
          </div>
        )}
        {result.lossNotes.length > 0 && (
          <div className="am-notice warning" data-testid="api-mock-export-loss">
            <strong>Lossy features</strong>
            <ul>
              {result.lossNotes.map((note, i) => (
                <li key={`${i}-${note.slice(0, 24)}`}>{note}</li>
              ))}
            </ul>
          </div>
        )}

        <section className="am-export-card">
          <div className="am-section-heading">
            Next steps
            <span className="am-hint">Replay or verify this file from the CLI</span>
          </div>
          <div className="am-form-grid">
            <div className="am-form-row">
              <div className="am-form-label">CI handoff</div>
              <div className="am-form-control">
                <code className="am-export-cli-cmd" data-testid="api-mock-export-cli">{result.cliCommand}</code>
                {copyButton('cli', result.cliCommand, 'api-mock-export-cli-copy')}
              </div>
            </div>
            <div className="am-form-row">
              <div className="am-form-label">Live journal</div>
              <div className="am-form-control">
                <code className="am-export-cli-cmd" data-testid="api-mock-export-cli-verify">{verifyCommand}</code>
                {copyButton('verify', verifyCommand, 'api-mock-export-cli-verify-copy')}
              </div>
            </div>
          </div>
        </section>

        <section className="am-export-preview-block">
          <div className="am-section-heading">
            Preview
            <div className="am-export-search">
              <input
                ref={searchRef}
                className="am-input am-export-search-input"
                value={inlineSearchValue}
                onChange={e => setInlineSearch(e.target.value)}
                placeholder="Search preview"
                aria-label="Search export preview"
                data-testid="api-mock-export-search"
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (e.shiftKey) inlineGoPrev(); else inlineGoNext();
                  }
                }}
              />
              <span className="am-export-search-count" data-testid="api-mock-export-search-count">
                {inlineCountLabel}
              </span>
              <button type="button" className="am-btn small" aria-label="Previous match" data-testid="api-mock-export-search-prev" onClick={inlineGoPrev}>▲</button>
              <button type="button" className="am-btn small" aria-label="Next match" data-testid="api-mock-export-search-next" onClick={inlineGoNext}>▼</button>
            </div>
            {showInlineTree && (
              <>
                <button type="button" className="am-btn small" onClick={expandAllJsonPreview} data-testid="api-mock-export-preview-inline-expand-all">Expand all</button>
                <button type="button" className="am-btn small" onClick={collapseAllJsonPreviewNodes} data-testid="api-mock-export-preview-inline-collapse-all">Collapse all</button>
              </>
            )}
            <button
              type="button"
              className="am-icon-btn"
              aria-label="Expand preview"
              title="Expand preview"
              onClick={() => setPreviewExpanded(true)}
              data-testid="api-mock-export-preview-expand"
            >
              <MaximizeIcon size={15} />
            </button>
          </div>
          {showInlineTree ? (
            <div className="am-export-preview-tree-wrap" data-testid="api-mock-export-preview-tree">
              <JsonPreview
                body={result.text}
                search={jsonPreviewSearch}
                currentMatchIdx={jsonPreviewMatchIdx}
                onMatchCountChange={setJsonPreviewMatchCount}
                collapsedSet={jsonPreviewCollapsed}
                onToggle={toggleJsonPreviewNode}
                prebuiltTree={jsonPreviewTree}
                forceExpandAll={jsonPreviewExpandAllActive}
              />
            </div>
          ) : (
            <div className="am-export-preview-wrap">
              <pre ref={previewBackdropRef} className="am-export-preview-backdrop" aria-hidden="true">{previewNodes}</pre>
              <textarea
                ref={previewRef}
                className="am-textarea am-export-preview"
                readOnly
                value={result.text}
                aria-label="Export preview"
                data-testid="api-mock-export-preview"
                onScroll={syncPreviewScroll}
              />
            </div>
          )}
        </section>
      </div>
      {previewExpanded && showInlineTree && (
        <AppModalFrame
          title="Preview"
          onClose={() => setPreviewExpanded(false)}
          overlayClassName="am-studio-modal-overlay"
          dialogClassName="modal am-studio-modal am-export-preview-json-modal"
          bodyClassName="am-studio-modal-body"
          footerClassName="am-studio-modal-footer"
          showExpandButton={false}
          closeOnOverlayClick={false}
          dialogTestId="api-mock-export-preview-json-modal"
          controlsClassName="am-export-preview-json-header-controls"
          headerActions={(
            <div className="api-mock-root am-in-modal am-export-preview-json-toolbar" data-testid="api-mock-export-preview-json-toolbar">
              <SearchMatchBar
                className="am-export-preview-json-search"
                value={jsonPreviewSearch}
                onChange={setJsonPreviewSearch}
                currentMatch={jsonPreviewMatchIdx + 1}
                totalMatches={jsonPreviewMatchCount}
                onPrev={jsonPreviewGoPrev}
                onNext={jsonPreviewGoNext}
                onClear={clearJsonPreviewSearch}
                inputType="search"
                placeholder="Search keys or values…"
                inputClassName="am-input am-export-preview-json-search-input"
                countClassName="am-export-preview-json-search-count"
                navClassName="am-icon-btn am-export-preview-json-search-nav"
                clearClassName="am-icon-btn am-export-preview-json-search-clear"
                showNavWhenEmpty
                ariaLabel="Search preview"
                inputTestId="api-mock-export-preview-json-search"
                prevTitle="Previous match (Shift+Enter)"
                nextTitle="Next match (Enter)"
                onKeyDown={e => {
                  if (e.key !== 'Enter') return;
                  e.preventDefault();
                  if (e.shiftKey) jsonPreviewGoPrev(); else jsonPreviewGoNext();
                }}
              />
              <div className="am-export-preview-json-header-btns">
                <button type="button" className="am-btn small" onClick={expandAllJsonPreview} data-testid="api-mock-export-preview-json-expand-all">Expand all</button>
                <button type="button" className="am-btn small" onClick={collapseAllJsonPreviewNodes} data-testid="api-mock-export-preview-json-collapse-all">Collapse all</button>
                {copyButton('preview', previewCopyText, 'api-mock-export-preview-json-copy', apiMockExportCopyLabel(result.format))}
              </div>
            </div>
          )}
          footer={(
            <div className="api-mock-root am-in-modal am-modal-toolbar am-export-preview-json-footer">
              <span className="am-spacer" />
              <button type="button" className="am-btn" onClick={() => setPreviewExpanded(false)} data-testid="api-mock-export-preview-json-close">Close</button>
            </div>
          )}
        >
          <div className="api-mock-root am-in-modal am-export-preview-json-body" data-testid="api-mock-export-preview-json-body">
            <JsonPreview
              body={result.text}
              search={jsonPreviewSearch}
              currentMatchIdx={jsonPreviewMatchIdx}
              onMatchCountChange={setJsonPreviewMatchCount}
              collapsedSet={jsonPreviewCollapsed}
              onToggle={toggleJsonPreviewNode}
              prebuiltTree={jsonPreviewTree}
              forceExpandAll={jsonPreviewExpandAllActive}
            />
          </div>
        </AppModalFrame>
      )}
      {previewExpanded && !showInlineTree && (
        <ApiMockTextExpandModal
          title="Preview"
          value={result.text}
          readOnly
          onClose={() => setPreviewExpanded(false)}
        />
      )}
    </AppModalFrame>
  );
}
