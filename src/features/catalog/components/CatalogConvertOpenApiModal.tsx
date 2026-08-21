import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import FullPanelModal from '../../../shared/components/FullPanelModal';
import { SearchMatchBar } from '../../../shared/components/SearchMatchBar';
import { useSearchMatchNavigation } from '../../../shared/hooks/useSearchMatchNavigation';
import { useCopyToClipboard } from '../../../shared/hooks/useCopyToClipboard';
import { saveFile } from '../../../shared/utils/fileSaver';
import {
  convertSwaggerToOpenApiYaml,
  upgradeOpenApi3Yaml,
  detectSpecFormat,
  availableTargets,
  ENGINE_TARGETS,
  type ConvertEngine,
  type ConvertTarget,
  type ConvertSwaggerResult,
} from '../utils/swaggerToOpenApi';
import { loadConvertPref, saveConvertPref, loadPrettyPref, savePrettyPref } from '../utils/convertPrefs';
import { prettifyOpenApiYaml } from '../utils/prettyYaml';
import { lintOpenApi, type LintResult } from '../utils/openApiLint';
import type { ToastType } from '../../workflow/components/WorkflowToastProvider';
import {
  countOperations,
  escapeHtml,
  extractWarningSearchTerm,
  highlightRawLine,
} from './catalogConvertOpenApiHelpers';

/** Metadata handed back to the host when saving the converted result as a version. */
export interface SaveAsVersionArgs {
  yaml: string;
  openapiVersion: string;
  engineUsed: ConvertEngine;
  /** `'convert'` for Swagger 2.0 → OpenAPI 3; `'upgrade'` for OpenAPI 3.0/3.1 → higher. */
  mode: 'convert' | 'upgrade';
}

interface Props {
  /** Display name of the source catalog entry (used for title + filename). */
  specName: string;
  /** Raw source spec text (Swagger 2.0 or OpenAPI 3.0/3.1) — loaded + confirmed to have
   *  at least one forward target by the opener. The modal auto-routes Convert vs Upgrade. */
  rawSpec: string;
  onClose: () => void;
  showToast?: (type: ToastType, title: string, subtitle?: string) => void;
  /** When provided, renders a "Save as new version" action (P2). Host persists + closes. */
  onSaveAsVersion?: (args: SaveAsVersionArgs) => Promise<void>;
}

interface CompareEngineRun {
  engine: ConvertEngine;
  result?: ConvertSwaggerResult;
  error?: string;
}

const ENGINE_LABELS: Record<ConvertEngine, string> = {
  swagger2openapi: 'swagger2openapi',
  scalar: 'Scalar',
};

/** Every target the UI can offer; availability is narrowed per source format + engine. */
const ALL_TARGETS: ConvertTarget[] = ['3.0', '3.1', '3.2'];


/**
 * Convert / Upgrade to OpenAPI modal (P1 + P4-A/D). Auto-routes on the source format:
 * Convert Swagger 2.0 → 3.0/3.1 (selectable engine) or Upgrade OpenAPI 3.0/3.1 → 3.1/3.2
 * (Scalar-only). Live-converts on engine/target change and shows a structural validation
 * badge, summary chips, normalized warnings, an on-demand deep lint, and a copyable +
 * searchable YAML preview. Download / Save are gated on valid output.
 */
export default function CatalogConvertOpenApiModal({ specName, rawSpec, onClose, showToast, onSaveAsVersion }: Props) {
  const [engine, setEngine] = useState<ConvertEngine>('swagger2openapi');
  const [target, setTarget] = useState<ConvertTarget>('3.0');
  const [prefLoaded, setPrefLoaded] = useState(false);
  const [converting, setConverting] = useState(false);
  const [result, setResult] = useState<ConvertSwaggerResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [savingVersion, setSavingVersion] = useState(false);
  const [linting, setLinting] = useState(false);
  const [lintResult, setLintResult] = useState<LintResult | null>(null);
  const [comparingEngines, setComparingEngines] = useState(false);
  const [compareRuns, setCompareRuns] = useState<CompareEngineRun[] | null>(null);
  // Pretty-YAML normalization (canonical key order via openapi-format).
  const [pretty, setPretty] = useState(true);
  const [prettifying, setPrettifying] = useState(false);
  const [effectiveYaml, setEffectiveYaml] = useState('');

  const searchInputRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const pendingScrollRef = useRef(false);

  // ── Source format drives Convert (Swagger 2) vs Upgrade (OpenAPI 3.0/3.1) routing ──
  const format = useMemo(() => detectSpecFormat(rawSpec), [rawSpec]);
  const isUpgrade = format === 'oas30' || format === 'oas31';
  const sourceTargets = useMemo(() => availableTargets(format), [format]);

  // A target is offered when the source can reach it and (for the convert flow) the
  // selected engine can emit it. In the upgrade flow the engine is always Scalar.
  const targetAllowed = useCallback((t: ConvertTarget): boolean => {
    if (!sourceTargets.includes(t)) return false;
    return isUpgrade || ENGINE_TARGETS[engine].includes(t);
  }, [sourceTargets, isUpgrade, engine]);

  // ── Load persisted engine/target + prettify toggle once ──
  useEffect(() => {
    let cancelled = false;
    void loadConvertPref().then(pref => {
      if (cancelled) return;
      setEngine(pref.engine);
      setTarget(pref.target);
      setPrefLoaded(true);
    });
    void loadPrettyPref().then(p => { if (!cancelled) setPretty(p); });
    return () => { cancelled = true; };
  }, []);

  // ── Keep target valid for the source + engine (drops 3.1 for swagger2openapi, snaps
  //    an upgrade flow to its first available target, etc.) ──
  useEffect(() => {
    if (!targetAllowed(target)) {
      const firstAllowed = ALL_TARGETS.find(targetAllowed);
      if (firstAllowed) setTarget(firstAllowed);
    }
  }, [targetAllowed, target]);

  // ── Persist the last valid choice (convert flow only; upgrade forces Scalar) ──
  useEffect(() => {
    if (!prefLoaded || isUpgrade || !ENGINE_TARGETS[engine].includes(target)) return;
    void saveConvertPref({ engine, target });
  }, [engine, target, prefLoaded, isUpgrade]);

  // ── Live convert/upgrade on engine / target change ──
  useEffect(() => {
    if (!prefLoaded || !targetAllowed(target)) return; // wait for corrected target
    let cancelled = false;
    setConverting(true);
    setError(null);
    const run = isUpgrade
      ? upgradeOpenApi3Yaml(rawSpec, { target })
      : convertSwaggerToOpenApiYaml(rawSpec, { engine, target });
    run
      .then(res => { if (!cancelled) setResult(res); })
      .catch(err => {
        if (cancelled) return;
        setResult(null);
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => { if (!cancelled) setConverting(false); });
    return () => { cancelled = true; };
  }, [rawSpec, engine, target, prefLoaded, isUpgrade, targetAllowed]);

  // ── Prettify (canonical key order) the converted YAML for preview/download/save ──
  // Falls back to the engine's raw YAML on toggle-off or any openapi-format failure.
  useEffect(() => {
    if (!result) { setEffectiveYaml(''); return; }
    if (!pretty) { setEffectiveYaml(result.yaml); return; }
    let cancelled = false;
    setPrettifying(true);
    void prettifyOpenApiYaml(result.openapi)
      .then(({ yaml }) => { if (!cancelled) setEffectiveYaml(yaml); })
      .catch(() => { if (!cancelled) setEffectiveYaml(result.yaml); })
      .finally(() => { if (!cancelled) setPrettifying(false); });
    return () => { cancelled = true; };
  }, [result, pretty]);

  const togglePretty = useCallback(() => {
    setPretty(prev => {
      const next = !prev;
      void savePrettyPref(next);
      return next;
    });
  }, []);

  // ── Search over YAML preview ──
  const yamlText = effectiveYaml;
  const lines = useMemo(() => yamlText.split('\n'), [yamlText]);
  const [searchQuery, setSearchQueryRaw] = useState('');

  const matchLineIndices = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    const idx: number[] = [];
    lines.forEach((l, i) => { if (l.toLowerCase().includes(q)) idx.push(i); });
    return idx;
  }, [searchQuery, lines]);
  const matchCount = matchLineIndices.length;

  const { currentMatchIndex, setCurrentMatchIndex, clear: clearNav } = useSearchMatchNavigation(matchCount);
  const [copied, copyYaml] = useCopyToClipboard();
  const handleCopyYaml = useCallback(() => {
    if (yamlText) void copyYaml(yamlText);
  }, [yamlText, copyYaml]);

  const setSearchQuery = useCallback((v: string) => {
    setSearchQueryRaw(v);
    setCurrentMatchIndex(0);
  }, [setCurrentMatchIndex]);

  const clearSearch = useCallback(() => {
    setSearchQueryRaw('');
    clearNav();
  }, [clearNav]);

  const scrollToMatch = useCallback((i: number) => {
    if (!bodyRef.current || matchLineIndices.length === 0) return;
    const lineIdx = matchLineIndices[i];
    const gutter = bodyRef.current.querySelectorAll('.cat-convert-lineno');
    const el = gutter[lineIdx] as HTMLElement | undefined;
    el?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
  }, [matchLineIndices]);

  // Auto-scroll to first match when triggered by warning click
  useEffect(() => {
    if (pendingScrollRef.current && matchLineIndices.length > 0) {
      pendingScrollRef.current = false;
      const lineIdx = matchLineIndices[0];
      const gutter = bodyRef.current?.querySelectorAll('.cat-convert-lineno');
      const el = gutter?.[lineIdx] as HTMLElement | undefined;
      el?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
    }
  }, [matchLineIndices]);

  const handleWarningClick = useCallback((warning: string) => {
    const term = extractWarningSearchTerm(warning);
    if (!term) return;
    pendingScrollRef.current = true;
    setSearchQuery(term);
    searchInputRef.current?.focus();
  }, [setSearchQuery]);

  const goNext = useCallback(() => {
    if (matchCount === 0) return;
    const n = (currentMatchIndex + 1) % matchCount;
    setCurrentMatchIndex(n);
    scrollToMatch(n);
  }, [matchCount, currentMatchIndex, setCurrentMatchIndex, scrollToMatch]);

  const goPrev = useCallback(() => {
    if (matchCount === 0) return;
    const p = (currentMatchIndex - 1 + matchCount) % matchCount;
    setCurrentMatchIndex(p);
    scrollToMatch(p);
  }, [matchCount, currentMatchIndex, setCurrentMatchIndex, scrollToMatch]);

  const highlighted = useMemo(() => {
    if (!searchQuery.trim()) return escapeHtml(yamlText);
    const q = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(q, 'gi');
    return lines.map((line, i) => {
      if (!matchLineIndices.includes(i)) return escapeHtml(line);
      const active = matchLineIndices[currentMatchIndex] === i;
      return highlightRawLine(line, re, active);
    }).join('\n');
  }, [yamlText, lines, searchQuery, matchLineIndices, currentMatchIndex]);

  // ── Cmd/Ctrl+F focuses search; Escape clears then closes ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'Escape') {
        if (searchQuery) clearSearch();
        else onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, searchQuery, clearSearch]);

  // A fresh conversion/upgrade invalidates any prior lint findings.
  useEffect(() => { setLintResult(null); }, [result]);
  // A fresh conversion/upgrade also invalidates engine-compare output.
  useEffect(() => { setCompareRuns(null); }, [result]);

  const canSaveResult = !!result && result.valid && !converting;
  const endpointCount = result ? countOperations(result.openapi) : 0;
  const verbing = isUpgrade ? 'Upgrading…' : 'Converting…';

  const handleLint = useCallback(async () => {
    if (!result || converting) return;
    setLinting(true);
    try {
      setLintResult(await lintOpenApi(result.openapi, result.openapiVersion));
    } finally {
      setLinting(false);
    }
  }, [result, converting]);

  const handleCompareEngines = useCallback(async () => {
    if (isUpgrade || converting) return;
    setComparingEngines(true);
    try {
      const runs = await Promise.all(
        (Object.keys(ENGINE_TARGETS) as ConvertEngine[]).map(async (en): Promise<CompareEngineRun> => {
          try {
            const compared = await convertSwaggerToOpenApiYaml(rawSpec, {
              engine: en,
              target: '3.0',
              fallbackOnInvalid: false,
            });
            return { engine: en, result: compared };
          } catch (err) {
            return { engine: en, error: err instanceof Error ? err.message : String(err) };
          }
        }),
      );
      setCompareRuns(runs);
    } finally {
      setComparingEngines(false);
    }
  }, [isUpgrade, converting, rawSpec]);

  const handleDownload = useCallback(async () => {
    if (!result || !result.valid) return;
    setDownloading(true);
    try {
      const filename = `${specName.replace(/[^a-zA-Z0-9_-]/g, '_')}-openapi-${target}.yaml`;
      const blob = new Blob([yamlText || result.yaml], { type: 'text/yaml' });
      await saveFile(blob, { filename, mimeType: 'text/yaml', description: 'OpenAPI 3 YAML spec' });
      const fellBackNote = result.fellBack ? ` · fell back to ${ENGINE_LABELS[result.engineUsed]}` : '';
      const warnNote = result.warnings.length
        ? ` · ${result.warnings.length} warning${result.warnings.length > 1 ? 's' : ''}`
        : '';
      const verb = isUpgrade ? 'Upgraded to' : 'Converted to';
      showToast?.('success', `${verb} OpenAPI ${result.openapiVersion}`, `Saved ${filename}${fellBackNote}${warnNote}`);
      onClose();
    } catch (err) {
      showToast?.('error', 'Download failed', err instanceof Error ? err.message : String(err));
    } finally {
      setDownloading(false);
    }
  }, [result, yamlText, specName, target, showToast, onClose, isUpgrade]);

  const handleSaveAsVersion = useCallback(async () => {
    if (!result || !result.valid || !onSaveAsVersion) return;
    setSavingVersion(true);
    try {
      // Host persists the converted YAML as a new version and closes this modal on success.
      await onSaveAsVersion({
        yaml: yamlText || result.yaml,
        openapiVersion: result.openapiVersion,
        engineUsed: result.engineUsed,
        mode: isUpgrade ? 'upgrade' : 'convert',
      });
    } finally {
      setSavingVersion(false);
    }
  }, [result, yamlText, onSaveAsVersion, isUpgrade]);

  const actionsBusy = downloading || savingVersion;

  return (
    <FullPanelModal
      title={`${isUpgrade ? 'Upgrade OpenAPI' : 'Convert to OpenAPI'} — ${specName}`}
      onClose={onClose}
      overlayClassName="cat-convert-overlay"
      dialogClassName="cat-modal cat-convert-modal"
      bodyScrollable={false}
      movable
      resizable
      minWidth={860}
      minHeight={520}
      footer={(
        <>
          <button className="cat-btn" onClick={onClose}>Cancel</button>
          <button
            className="cat-btn cat-btn-primary"
            data-testid="catalog-convert-download-btn"
            onClick={handleDownload}
            disabled={!canSaveResult || actionsBusy}
            title={canSaveResult ? 'Download the converted OpenAPI 3 YAML' : 'Fix validation errors before downloading'}
          >
            {downloading ? 'Saving…' : 'Download YAML'}
          </button>
          {onSaveAsVersion && (
            <button
              className="cat-btn cat-btn-outline"
              data-testid="catalog-convert-save-btn"
              onClick={handleSaveAsVersion}
              disabled={!canSaveResult || actionsBusy}
              title={canSaveResult ? 'Save the converted spec as a new Catalog version' : 'Fix validation errors before saving'}
            >
              {savingVersion ? 'Saving…' : 'Save as new version'}
            </button>
          )}
        </>
      )}
    >
      <div className="cat-convert-layout" data-testid="catalog-convert-modal">
        {/* ── Options ── */}
        <div className="cat-convert-options">
          {isUpgrade ? (
            <div className="cat-convert-field">
              <span className="cat-convert-field-label">Engine</span>
              <span className="cat-convert-engine-fixed">Scalar · only engine that emits 3.1 / 3.2</span>
            </div>
          ) : (
            <div className="cat-convert-field">
              <span className="cat-convert-field-label">Engine</span>
              <div className="cat-convert-segmented" role="radiogroup" aria-label="Conversion engine">
                {(Object.keys(ENGINE_TARGETS) as ConvertEngine[]).map(en => (
                  <button
                    key={en}
                    type="button"
                    role="radio"
                    aria-checked={engine === en}
                    data-testid={`catalog-convert-engine-${en}`}
                    className={`cat-convert-seg${engine === en ? ' active' : ''}`}
                    onClick={() => setEngine(en)}
                  >
                    {ENGINE_LABELS[en]}{en === 'swagger2openapi' ? ' · default' : ''}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="cat-convert-field">
            <span className="cat-convert-field-label">Target</span>
            <div className="cat-convert-segmented" role="radiogroup" aria-label="Target OpenAPI version">
              {ALL_TARGETS.map(t => {
                const offered = sourceTargets.includes(t);
                const allowed = targetAllowed(t);
                if (!offered) return null;
                return (
                  <button
                    key={t}
                    type="button"
                    role="radio"
                    aria-checked={target === t}
                    disabled={!allowed}
                    data-testid={`catalog-convert-target-${t}`}
                    title={allowed ? undefined : `${ENGINE_LABELS[engine]} cannot target OpenAPI ${t}`}
                    className={`cat-convert-seg${target === t ? ' active' : ''}`}
                    onClick={() => { if (allowed) setTarget(t); }}
                  >
                    OpenAPI {t}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Status badge + chips ── */}
        <div className="cat-convert-status">
          {converting ? (
            <span className="cat-convert-badge cat-convert-badge-pending">{verbing}</span>
          ) : error ? (
            <span className="cat-convert-badge cat-convert-badge-invalid">Conversion failed</span>
          ) : result ? (
            <>
              <span
                data-testid="catalog-convert-badge"
                className={`cat-convert-badge ${result.valid ? 'cat-convert-badge-valid' : 'cat-convert-badge-invalid'}`}
              >
                {result.valid ? `Valid OpenAPI ${result.openapiVersion}` : 'Invalid OpenAPI'}
              </span>
              <span className="cat-convert-chip">
                {result.fellBack
                  ? `${ENGINE_LABELS[engine]} → ${ENGINE_LABELS[result.engineUsed]} (fallback: ${result.fallbackReason === 'threw' ? 'error' : 'invalid output'})`
                  : `engine: ${ENGINE_LABELS[result.engineUsed]}`}
              </span>
              <span className="cat-convert-chip">{endpointCount} endpoint{endpointCount === 1 ? '' : 's'}</span>
              <span className={`cat-convert-chip${result.warnings.length ? ' cat-convert-chip-warn' : ''}`}>
                {result.warnings.length} warning{result.warnings.length === 1 ? '' : 's'}
              </span>
              {!isUpgrade && (
                <button
                  type="button"
                  className="cat-convert-lint-btn"
                  data-testid="catalog-convert-compare-btn"
                  onClick={handleCompareEngines}
                  disabled={comparingEngines || converting}
                  title="Run both engines on this Swagger source and compare outputs"
                >
                  {comparingEngines ? 'Comparing…' : 'Compare engines'}
                </button>
              )}
              <button
                type="button"
                className="cat-convert-lint-btn"
                data-testid="catalog-convert-lint-btn"
                onClick={handleLint}
                disabled={linting}
                title="Run a deep OpenAPI 3.0 lint (schema + best-practice rules) — advisory, does not block download"
              >
                {linting ? 'Linting…' : 'Deep lint'}
              </button>
            </>
          ) : null}
        </div>

        {/* ── Validation errors / conversion error ── */}
        {result && !result.valid && result.validationErrors.length > 0 && (
          <div className="cat-convert-errors">
            <div className="cat-convert-errors-title">Validation errors ({result.validationErrors.length})</div>
            <ul>
              {result.validationErrors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          </div>
        )}
        {error && (
          <div className="cat-convert-errors">
            <div className="cat-convert-error-msg">{error}</div>
          </div>
        )}

        {/* ── Warnings ── */}
        {result && result.warnings.length > 0 && (
          <details className="cat-convert-warnings" open>
            <summary>{result.warnings.length} conversion warning{result.warnings.length === 1 ? '' : 's'}</summary>
            <ul>
              {result.warnings.map((w, i) => {
                const searchable = extractWarningSearchTerm(w);
                return (
                  <li
                    key={i}
                    className={searchable ? 'cat-convert-warning-clickable' : undefined}
                    onClick={searchable ? () => handleWarningClick(w) : undefined}
                    title={searchable ? `Search YAML for "${searchable}"` : undefined}
                  >
                    {w}
                    {searchable && <span className="cat-convert-warning-search-icon" aria-hidden="true">⌕</span>}
                  </li>
                );
              })}
            </ul>
          </details>
        )}

        {/* ── Engine compare results (P4-B) ── */}
        {compareRuns && (
          <details className="cat-convert-lint" open data-testid="catalog-convert-compare-result">
            <summary>
              Engine compare (Swagger 2.0 → OpenAPI 3.0)
            </summary>
            <ul className="cat-convert-lint-list">
              {compareRuns.map((run) => (
                <li key={run.engine}>
                  <code className="cat-convert-lint-rule">{ENGINE_LABELS[run.engine]}</code>
                  {run.error ? (
                    <span>{' — '}failed: {run.error}</span>
                  ) : run.result ? (
                    <span>
                      {' — '}
                      {run.result.valid ? 'valid' : 'invalid'} · OpenAPI {run.result.openapiVersion} ·
                      {' '}{run.result.warnings.length} warning{run.result.warnings.length === 1 ? '' : 's'}
                      {run.result.valid ? '' : ` · ${run.result.validationErrors.length} validation error${run.result.validationErrors.length === 1 ? '' : 's'}`}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
            {(() => {
              const ok = compareRuns.filter(r => r.result?.valid);
              if (ok.length !== 2) return null;
              return (
                <div className="cat-convert-lint-note">
                  {ok[0].result?.yaml === ok[1].result?.yaml
                    ? 'Both engines produced identical YAML output for target 3.0.'
                    : 'Engines produced different YAML output for target 3.0.'}
                </div>
              );
            })()}
          </details>
        )}

        {/* ── Deep lint results (P4-D) ── */}
        {lintResult && (
          <div className="cat-convert-lint" data-testid="catalog-convert-lint-result" role="status">
            {!lintResult.supported ? (
              <div className="cat-convert-lint-note">
                {lintResult.unavailable
                  ? 'Deep lint is unavailable in this build — the structural validation gate above still applies.'
                  : `Deep lint supports OpenAPI 3.0 only; ${result?.openapiVersion ?? 'this target'} uses the structural checks above.`}
              </div>
            ) : lintResult.schemaError ? (
              <div className="cat-convert-lint-error">
                <span className="cat-convert-lint-title">Deep lint — schema error</span>
                <div className="cat-convert-error-msg">{lintResult.schemaError}</div>
              </div>
            ) : lintResult.clean ? (
              <div className="cat-convert-lint-clean">Deep lint passed — no schema or best-practice issues.</div>
            ) : (
              <details className="cat-convert-lint-findings" open>
                <summary>
                  Deep lint — {lintResult.findings.length} advisory finding{lintResult.findings.length === 1 ? '' : 's'}
                </summary>
                <ul>
                  {lintResult.findings.map((f, i) => (
                    <li key={i}>
                      <code className="cat-convert-lint-rule">{f.rule ?? 'rule'}</code>
                      {' — '}{f.message}
                      {f.pointer && <span className="cat-convert-lint-ptr"> ({f.pointer})</span>}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}

        {/* ── Preview toolbar + search ── */}
        <div className="cat-convert-preview-toolbar">
          <div className="cat-convert-preview-toolbar-left">
            <span className="cat-convert-preview-label">OpenAPI 3 YAML preview</span>
            <button
              type="button"
              className={`cat-convert-copy-btn${copied ? ' copied' : ''}`}
              data-testid="catalog-convert-copy-btn"
              onClick={handleCopyYaml}
              disabled={!yamlText}
              title="Copy the full YAML preview to the clipboard"
            >
              {copied ? '✓ Copied' : 'Copy YAML'}
            </button>
            <label
              className="cat-convert-pretty-toggle"
              title="Sort keys into a canonical, diff-friendly order (openapi-format)"
            >
              <input
                type="checkbox"
                data-testid="catalog-convert-pretty-toggle"
                checked={pretty}
                onChange={togglePretty}
              />
              <span>Prettify{prettifying ? '…' : ''}</span>
            </label>
          </div>
          <SearchMatchBar
            className="cat-convert-search-bar"
            value={searchQuery}
            onChange={setSearchQuery}
            currentMatch={currentMatchIndex + 1}
            totalMatches={matchCount}
            onPrev={goPrev}
            onNext={goNext}
            onClear={clearSearch}
            placeholder="Search… (Cmd+F)"
            inputClassName="cat-convert-search-input"
            inputTestId="catalog-convert-search-input"
            countClassName="cat-convert-search-count"
            navClassName="cat-convert-search-nav"
            controlsVisible={!!searchQuery}
            showNavWhenEmpty
            hideClear
            navStyle="text"
            inputRef={searchInputRef}
            prevTitle="Previous match (Shift+Enter)"
            nextTitle="Next match (Enter)"
            onKeyDown={(e) => {
              if (e.key === 'Escape') clearSearch();
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); goNext(); }
              if (e.key === 'Enter' && e.shiftKey) { e.preventDefault(); goPrev(); }
            }}
          />
        </div>

        {/* ── Preview ── */}
        <div className="cat-convert-preview" data-testid="catalog-convert-preview" ref={bodyRef}>
          {!result && !error ? (
            <div className="cat-convert-preview-empty">{verbing}</div>
          ) : yamlText ? (
            <>
              <div className="cat-convert-gutter" aria-hidden="true">
                {lines.map((_, i) => (
                  <div
                    key={i}
                    className={`cat-convert-lineno${matchLineIndices.includes(i) ? ' cat-convert-lineno--match' : ''}`}
                  >
                    {i + 1}
                  </div>
                ))}
              </div>
              <pre className="cat-convert-code" dangerouslySetInnerHTML={{ __html: highlighted }} />
            </>
          ) : (
            <div className="cat-convert-preview-empty">No output produced.</div>
          )}
        </div>
      </div>
    </FullPanelModal>
  );
}
