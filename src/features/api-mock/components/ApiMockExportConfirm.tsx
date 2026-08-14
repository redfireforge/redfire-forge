import { useEffect, useMemo, useRef, useState } from 'react';
import AppModalFrame from '../../../shared/components/AppModalFrame';
import {
  findTextExpandMatches,
  formatTextExpandCount,
  nextTextExpandMatch,
} from './apiMockTextExpand';
import type { ApiMockExportResult } from '../apiMockExportActions';

interface Props {
  result: ApiMockExportResult;
  onClose: () => void;
}

/**
 * Confirmation after an Export menu download — preview, redaction proof,
 * WireMock loss, HAR count, and the CLI handoff. The file already saved;
 * this is what the viewer (and the round-trip import) can actually read.
 */
export function ApiMockExportConfirm({ result, onClose }: Props) {
  const previewRef = useRef<HTMLTextAreaElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [matchIndex, setMatchIndex] = useState(0);

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

  const copyPreview = async () => {
    try {
      await navigator.clipboard.writeText(result.nativeJson ?? result.text);
    } catch {
      /* clipboard may be unavailable in tests / restricted iframes */
    }
  };

  const copyCli = async () => {
    try {
      await navigator.clipboard.writeText(result.cliCommand);
    } catch {
      /* same as copyPreview */
    }
  };

  const verifyCommand = result.cliCommand.replace('cli mock simulate', 'cli mock verify');

  const copyCliVerify = async () => {
    try {
      await navigator.clipboard.writeText(verifyCommand);
    } catch {
      /* same as copyPreview */
    }
  };

  const showRedaction = result.redacted && (result.tlsKeyPem != null || result.sensitiveValues.length > 0);
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

  return (
    <AppModalFrame
      title={title}
      onClose={onClose}
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
        <div className="api-mock-root am-in-modal am-modal-toolbar" style={{ width: '100%' }}>
          <span className="am-faint" data-testid="api-mock-export-filename">{result.filename}</span>
          <span className="am-spacer" />
          <button type="button" className="am-btn" onClick={() => { void copyPreview(); }} data-testid="api-mock-export-copy">Copy</button>
          <button type="button" className="am-btn primary" onClick={onClose} data-testid="api-mock-export-close">Close</button>
        </div>
      )}
    >
      <div className="api-mock-root am-in-modal am-export-confirm" data-testid="api-mock-export-confirm-body">
        {showRedaction && (
          <div className="am-notice" data-testid="api-mock-export-redaction">
            TLS private keys and sensitive variables never leave the workspace. They are stripped from this file.
          </div>
        )}
        {result.tlsKeyPem != null && (
          <div className="am-export-secret-row">
            <span className="am-muted">TLS private key</span>
            <code className="mono" data-testid="api-mock-export-tls-key">{result.tlsKeyPem || '(empty)'}</code>
          </div>
        )}
        {result.sensitiveValues.map(v => (
          <div className="am-export-secret-row" key={v.key}>
            <span className="am-muted">{v.key}</span>
            <code className="mono" data-testid="api-mock-export-secret">{v.value}</code>
          </div>
        ))}
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
        <label className="am-export-cli-row">
          <span className="am-muted">CI handoff</span>
          <code className="mono" data-testid="api-mock-export-cli">{result.cliCommand}</code>
          <button type="button" className="am-btn small" onClick={() => { void copyCli(); }} data-testid="api-mock-export-cli-copy">Copy</button>
        </label>
        <label className="am-export-cli-row">
          <span className="am-muted">Live journal</span>
          <code className="mono" data-testid="api-mock-export-cli-verify">{verifyCommand}</code>
          <button type="button" className="am-btn small" onClick={() => { void copyCliVerify(); }} data-testid="api-mock-export-cli-verify-copy">Copy</button>
        </label>
        <textarea
          ref={previewRef}
          className="am-textarea mono am-export-preview"
          readOnly
          value={result.text}
          aria-label="Export preview"
          data-testid="api-mock-export-preview"
        />
      </div>
    </AppModalFrame>
  );
}
