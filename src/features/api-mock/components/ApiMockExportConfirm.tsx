import { useEffect, useMemo, useRef, useState } from 'react';
import AppModalFrame from '../../../shared/components/AppModalFrame';
import {
  findTextExpandMatches,
  formatTextExpandCount,
  nextTextExpandMatch,
} from './apiMockTextExpand';
import {
  API_MOCK_CLI_SIMULATE,
  API_MOCK_CLI_VERIFY,
  type ApiMockExportResult,
} from '../apiMockExportActions';
import { CheckIcon, CopyIcon, ShieldCheckIcon } from './ApiMockIcons';

interface Props {
  result: ApiMockExportResult;
  onClose: () => void;
}

type CopiedId = 'preview' | 'cli' | 'verify';

/**
 * Confirmation after an Export menu download — preview, redaction proof,
 * WireMock loss, HAR count, and the CLI handoff. The file already saved;
 * this is what the viewer (and the round-trip import) can actually read.
 */
export function ApiMockExportConfirm({ result, onClose }: Props) {
  const previewRef = useRef<HTMLTextAreaElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const copiedTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [query, setQuery] = useState('');
  const [matchIndex, setMatchIndex] = useState(0);
  const [copied, setCopied] = useState<CopiedId | null>(null);

  const matches = useMemo(() => findTextExpandMatches(result.text, query), [result.text, query]);

  useEffect(() => { setMatchIndex(0); }, [query, result.text]);

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

  const selectMatch = (index: number) => {
    const el = previewRef.current;
    const needle = query.trim();
    if (!el || !needle || matches.length === 0) return;
    const start = matches[index] ?? 0;
    el.focus();
    el.setSelectionRange(start, start + needle.length);
  };

  const goMatch = (direction: 1 | -1) => {
    const next = nextTextExpandMatch(matchIndex, matches.length, direction);
    setMatchIndex(next);
    selectMatch(next);
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
      headerActions={(
        <div className="am-export-search">
          <input
            ref={searchRef}
            className="am-input am-export-search-input"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search preview"
            aria-label="Search export preview"
            data-testid="api-mock-export-search"
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                goMatch(e.shiftKey ? -1 : 1);
              }
            }}
          />
          <span className="am-export-search-count" data-testid="api-mock-export-search-count">
            {formatTextExpandCount(matchIndex, matches.length)}
          </span>
          <button type="button" className="am-btn small" aria-label="Previous match" data-testid="api-mock-export-search-prev" onClick={() => goMatch(-1)}>▲</button>
          <button type="button" className="am-btn small" aria-label="Next match" data-testid="api-mock-export-search-next" onClick={() => goMatch(1)}>▼</button>
        </div>
      )}
      footer={(
        <div className="api-mock-root am-in-modal am-modal-toolbar am-export-confirm-footer">
          <span className="am-export-filename" title={result.filename} data-testid="api-mock-export-filename">{result.filename}</span>
          <span className="am-spacer" />
          {copyButton('preview', result.nativeJson ?? result.text, 'api-mock-export-copy', 'Copy JSON')}
          <button type="button" className="am-btn primary" onClick={onClose} data-testid="api-mock-export-close">Close</button>
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
          <div className="am-section-heading">Preview</div>
          <textarea
            ref={previewRef}
            className="am-textarea am-export-preview"
            readOnly
            value={result.text}
            aria-label="Export preview"
            data-testid="api-mock-export-preview"
          />
        </section>
      </div>
    </AppModalFrame>
  );
}
