import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AppModalFrame from '../../../shared/components/AppModalFrame';
import { CustomSelect } from '../../../shared/components/CustomSelect';
import { matchPath } from '../../../shared/api-mock/pathMatcher';
import { formatJsonPathValue, jsonPathFromSelection } from '../../../shared/api-mock/jsonPathFromCursor';
import { evaluateOperator, resolveSimpleJsonPath } from '../../../shared/api-mock/predicateEvaluatorHelpers';
import type { ApiMockPathMatcherV1, ApiMockPathMatcherKind, ApiMockPredicateV1 } from '../../../shared/api-mock/contracts';
import {
  DEFAULT_JSON_SAMPLE,
  KIND_OPTIONS,
  PATH_PRESETS,
  REGEX_LIBRARY,
  initialJsonPathDraft,
  initialRegexPattern,
  initialRegexSamples,
  initialSchemaKind,
  initialSchemaText,
  initialXPathDraft,
  type ConstraintDraft,
  type ToolTab,
} from './apiMockPatternToolboxConstants';
import { ApiMockSchemaToolboxPanel, ApiMockXPathToolboxPanel } from './ApiMockPatternToolboxExtraPanels';
import * as regexUtils from './apiMockPatternToolboxRegexUtils';
import { ApiMockPatternToolboxConstraintsTab } from './ApiMockPatternToolboxConstraintsTab';
import { applyPatternToolbox } from './apiMockPatternToolboxApply';

interface Props {
  initial: ApiMockPathMatcherV1;
  onApply: (matcher: ApiMockPathMatcherV1) => void;
  /** Applies composed query/header/cookie constraints as rule match conditions. */
  onApplyConditions?: (predicates: ApiMockPredicateV1[]) => void;
  onApplyPredicate?: (patch: Partial<ApiMockPredicateV1>) => void;
  onClose: () => void;
  contextLabel?: string;
  initialTab?: ToolTab;
  predicateExpected?: ApiMockPredicateV1['expected'];
  predicateOperator?: ApiMockPredicateV1['operator'];
  /** Seed Ignore case from the open matcher row (`options.caseSensitive === false`). */
  predicateCaseInsensitive?: boolean;
  /** When opened from a Match row, Applied condition must name that row — not a hardcoded pathParam. */
  predicateSource?: ApiMockPredicateV1['source'];
  predicateSelector?: string;
}


interface SampleRow {
  id: string;
  value: string;
  shouldMatch: boolean;
}

/**
 * Mockup 02 Pattern Toolbox — library | editor | explanation with Regex / Path / JSONPath / Constraints tabs.
 */
export function ApiMockPatternToolboxModal({
  initial, onApply, onApplyConditions, onApplyPredicate, onClose, contextLabel, initialTab,
  predicateExpected, predicateOperator, predicateCaseInsensitive,
  predicateSource, predicateSelector,
}: Props) {
  const [tab, setTab] = useState<ToolTab>(initialTab ?? (initial.kind === 'regex' ? 'regex' : 'path'));
  const [constraints, setConstraints] = useState<ConstraintDraft[]>([
    { id: 'c1', source: 'header', selector: '', operator: 'exact', expected: '' },
  ]);
  const [kind, setKind] = useState<ApiMockPathMatcherKind>(initial.kind);
  const [value, setValue] = useState(initial.value);
  const [caseInsensitive, setCaseInsensitive] = useState(
    predicateOperator === 'regex' || predicateOperator === 'glob'
      ? Boolean(predicateCaseInsensitive)
      : (initial.flags?.caseInsensitive ?? false),
  );
  const [unicode, setUnicode] = useState(false);
  const [multiline, setMultiline] = useState(false);
  const [sample, setSample] = useState(initial.value.replace(/[:{][^/}]+\}?/g, '123'));
  const [regexPattern, setRegexPattern] = useState(
    initialRegexPattern(predicateOperator, predicateExpected, initial.kind, initial.value),
  );
  const [libraryQuery, setLibraryQuery] = useState('');
  const [samples, setSamples] = useState<SampleRow[]>(() => initialRegexSamples(predicateSource));
  const jsonPathDraft = initialJsonPathDraft(predicateOperator, predicateExpected);
  const xpathDraft = initialXPathDraft(predicateOperator, predicateExpected);
  const [jsonSample, setJsonSample] = useState(() => JSON.stringify(DEFAULT_JSON_SAMPLE, null, 2));
  const [jsonPath, setJsonPath] = useState(jsonPathDraft.path);
  const [jsonExpected, setJsonExpected] = useState(jsonPathDraft.value);
  const [xmlSample, setXmlSample] = useState('<Order><Id>1</Id></Order>');
  const [xpath, setXpath] = useState(xpathDraft.expr);
  const [xpathValue, setXpathValue] = useState(xpathDraft.value);
  const [schemaKind, setSchemaKind] = useState<'json' | 'xml'>(() => initialSchemaKind(predicateOperator, predicateExpected));
  const [schemaText, setSchemaText] = useState(() => initialSchemaText(predicateOperator, predicateExpected));
  const jsonTextareaRef = useRef<HTMLTextAreaElement>(null);
  const jsonSelectRafRef = useRef<number | null>(null);

  /** Read textarea selection after the browser finalizes it (mouseup may land outside). */
  const handleJsonSelect = useCallback(() => {
    if (jsonSelectRafRef.current != null) {
      cancelAnimationFrame(jsonSelectRafRef.current);
    }
    jsonSelectRafRef.current = requestAnimationFrame(() => {
      jsonSelectRafRef.current = null;
      const ta = jsonTextareaRef.current;
      if (!ta) return;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      if (start == null || end == null) return;
      const result = jsonPathFromSelection(jsonSample, start, end);
      if (result) {
        setJsonPath(result.path);
        setJsonExpected(result.value);
      }
    });
  }, [jsonSample]);

  // Drag-select often ends with mouseup on the modal chrome, not the textarea —
  // listen on document while the sample editor is focused.
  useEffect(() => {
    const onDocMouseUp = () => {
      const ta = jsonTextareaRef.current;
      if (!ta || document.activeElement !== ta) return;
      handleJsonSelect();
    };
    document.addEventListener('mouseup', onDocMouseUp);
    return () => {
      document.removeEventListener('mouseup', onDocMouseUp);
      if (jsonSelectRafRef.current != null) cancelAnimationFrame(jsonSelectRafRef.current);
    };
  }, [handleJsonSelect]);
  const [pathParts, setPathParts] = useState(() => {
    const segs = (initial.value || '/users/42/orders/A-1098').split('/').filter(Boolean);
    return segs.length ? segs : ['users', '42', 'orders', 'A-1098'];
  });

  /** Live JSONPath evaluation against the pasted sample, using the runtime resolver. */
  const jsonEval = useMemo(() => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonSample);
    } catch (err) {
      return { valid: false, error: err instanceof Error ? err.message : 'Invalid JSON', resolved: undefined as unknown };
    }
    const resolved = resolveSimpleJsonPath(parsed, jsonPath);
    return { valid: true, error: undefined as string | undefined, resolved };
  }, [jsonSample, jsonPath]);

  const jsonResolvedText = jsonEval.resolved === undefined
    ? '(no match)'
    : formatJsonPathValue(jsonEval.resolved);
  // Same operators Apply writes: empty Expected → exists, otherwise equals
  // (including pretty vs compact object JSON).
  const jsonEqualsExpected = jsonExpected.trim()
    ? evaluateOperator('jsonPath_equals', jsonSample, [jsonPath, jsonExpected])
    : Boolean(jsonEval.valid && jsonEval.resolved !== undefined);

  let pathResult: { matched: boolean; params: Record<string, string> } = { matched: false, params: {} };  try {
    pathResult = matchPath(
      { kind, value, flags: caseInsensitive ? { caseInsensitive: true } : undefined },
      sample || '/',
    );
  } catch { /* invalid pattern */ }

  const regexApplied = regexUtils.regexTabMatcher(regexPattern, predicateOperator, Boolean(onApplyPredicate));
  const regexValidity = useMemo(() => {
    if (predicateOperator === 'glob') return true;
    try {
      void RegExp(regexPattern, `${caseInsensitive ? 'i' : ''}${unicode ? 'u' : ''}${multiline ? 'm' : ''}`);
      return true;
    } catch {
      return false;
    }
  }, [regexPattern, caseInsensitive, unicode, multiline, predicateOperator]);

  const generalizedTemplate = '/' + pathParts.map(p => {
    if (/^\d+$/.test(p)) return ':id';
    if (/^[A-Z]-?\d+$/i.test(p) || /^[A-Z]{1,3}-\d+$/i.test(p)) return ':orderId';
    return p;
  }).join('/');

  const applyLibrary = (_name: string, pattern: string, pass: string[], fail: string[]) => {
    setRegexPattern(pattern);
    setTab('regex');
    setSamples([
      ...pass.map((v, i) => ({ id: `p${i}`, value: v, shouldMatch: true })),
      ...fail.map((v, i) => ({ id: `f${i}`, value: v, shouldMatch: false })),
    ]);
  };

  const handleApply = () => {
    applyPatternToolbox({
      tab,
      jsonPath,
      jsonExpected,
      xpath,
      xpathValue,
      schemaKind,
      schemaText,
      constraints,
      predicateOperator,
      regexApplied,
      caseInsensitive,
      kind,
      value,
      onApply,
      onApplyConditions,
      onApplyPredicate,
      onClose,
    });
  };

  const filteredLibrary = REGEX_LIBRARY.map(cat => ({
    ...cat,
    entries: cat.entries.filter(e =>
      !libraryQuery.trim()
      || e.name.toLowerCase().includes(libraryQuery.toLowerCase())
      || e.pattern.toLowerCase().includes(libraryQuery.toLowerCase()),
    ),
  })).filter(c => c.entries.length > 0);

  const explanationLines = regexUtils.explainRegex(regexPattern).split('\n').filter(Boolean);
  const activeLibrary = REGEX_LIBRARY.flatMap(cat => cat.entries).find(e => e.pattern === regexPattern)?.name;
  const appliedSource = predicateSource ?? 'path';
  const appliedSelector = (predicateSelector ?? '').trim()
    || (predicateSource ? '—' : (initial.value || '/'));
  const appliedOperator = predicateOperator === 'glob' ? 'glob' : 'regex';

  return (
    <AppModalFrame
      title={
        <div className="am-modal-title-block">
          <div className="am-modal-title">Pattern Toolbox</div>
          {contextLabel && <div className="am-modal-subtitle">{contextLabel}</div>}
        </div>
      }
      onClose={onClose}
      closeOnOverlayClick={false}
      showExpandButton={false}
      dialogClassName="modal am-studio-modal am-pattern-toolbox-modal"
      bodyClassName="am-studio-modal-body"
      footerClassName="am-studio-modal-footer"
      minWidth={880}
      minHeight={560}
      overlayTestId="api-mock-toolbox-overlay"
      footer={
        <div className="api-mock-root am-in-modal am-modal-toolbar am-pattern-toolbox-footer">
          <span className="am-badge success">Runtime-parity evaluator</span>
          <span className="am-spacer" />
          <button className="am-btn" onClick={onClose} data-testid="api-mock-toolbox-cancel">Cancel</button>
          <button className="am-btn primary" onClick={handleApply} data-testid="api-mock-toolbox-apply">
            {tab === 'constraints' || tab === 'jsonpath' || tab === 'xpath' || tab === 'schema'
              ? (onApplyPredicate ? 'Apply matcher' : 'Add conditions')
              : 'Apply pattern'}
          </button>
        </div>
      }
    >
      <div className="api-mock-root am-in-modal am-pattern-toolbox" data-testid="api-mock-pattern-toolbox">
        <div className="am-builder-tabs am-pattern-tabs" role="tablist" aria-label="Pattern toolbox sections">
          {([
            ['regex', 'Regex builder'],
            ['path', 'Path template'],
            ['jsonpath', 'JSON body / JSONPath'],
            ['xpath', 'XPath'],
            ['schema', 'Schema'],
            ['constraints', 'Query & headers'],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              className={`am-builder-tab${tab === id ? ' active' : ''}`}
              data-testid={`api-mock-toolbox-tab-${id}`}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'regex' && (
          <div className="am-tool-layout">
            <aside className="am-tool-library">
              <div className="am-panel-head"><span className="am-panel-title">Pattern library</span></div>
              <div className="am-tool-library-search">
                <input
                  className="am-search"
                  placeholder="Search patterns…"
                  value={libraryQuery}
                  onChange={e => setLibraryQuery(e.target.value)}
                  aria-label="Search patterns"
                  data-testid="api-mock-toolbox-library-search"
                />
              </div>
              <div className="am-tool-library-list">
                {filteredLibrary.map(cat => (
                  <div key={cat.category} className="am-pattern-category">
                    <div className="am-pattern-category-label">{cat.category}</div>
                    {cat.entries.map(e => (
                      <button
                        key={e.name}
                        type="button"
                        className={`am-pattern-entry${activeLibrary === e.name ? ' active' : ''}`}
                        onClick={() => applyLibrary(e.name, e.pattern, e.pass, e.fail)}
                        data-testid={`api-mock-toolbox-lib-${e.name}`}
                      >
                        <strong>{e.name}</strong>
                        <span className="am-pattern-entry-pattern am-mono">
                          {e.pattern.length > 36 ? `${e.pattern.slice(0, 34)}…` : e.pattern}
                        </span>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </aside>

            <article className="am-tool-editor">
              <div className="am-tool-block">
                <div className="am-tool-block-head">
                  <h3 className="am-tool-block-title">Expression</h3>
                </div>
                <div className="am-form-grid">
                  <div className="am-form-row">
                    <div className="am-form-label">Regex</div>
                    <div className="am-form-control">
                      <input
                        className="am-input am-input--fill mono"
                        value={regexPattern}
                        onChange={e => setRegexPattern(e.target.value)}
                        data-testid="api-mock-toolbox-regex"
                      />
                    </div>
                  </div>
                  <div className="am-form-row am-form-row--tall">
                    <div className="am-form-label">Flags</div>
                    <div className="am-form-control">
                      <div className="am-flag-chips" role="group" aria-label="Regex flags">
                        <label
                          className={`am-chip${caseInsensitive ? '' : ' active'}`}
                          data-testid="api-mock-toolbox-flag-cs"
                        >
                          <input type="checkbox" checked={!caseInsensitive} onChange={() => setCaseInsensitive(false)} />
                          Case sensitive
                        </label>
                        <label
                          className={`am-chip${caseInsensitive ? ' active' : ''}`}
                          data-testid="api-mock-toolbox-flag-ci"
                        >
                          <input type="checkbox" checked={caseInsensitive} onChange={() => setCaseInsensitive(true)} />
                          Ignore case
                        </label>
                        <label className={`am-chip${unicode ? ' active' : ''}`}>
                          <input type="checkbox" checked={unicode} onChange={e => setUnicode(e.target.checked)} />
                          Unicode
                        </label>
                        <label className={`am-chip${multiline ? ' active' : ''}`}>
                          <input type="checkbox" checked={multiline} onChange={e => setMultiline(e.target.checked)} />
                          Multiline
                        </label>
                      </div>
                    </div>
                  </div>
                  <div className="am-form-row">
                    <div className="am-form-label">Safety</div>
                    <div className="am-form-control">
                      <div className="am-form-control-inline">
                        <span
                          className={`am-badge ${regexValidity ? 'success' : 'danger'}`}
                          data-testid="api-mock-toolbox-safety"
                        >{regexValidity ? 'Valid' : 'Invalid'}</span>
                        <span className="am-hint">Anchored · no nested quantifiers · estimated linear scan</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="am-tool-block">
                <div className="am-tool-block-head">
                  <h3 className="am-tool-block-title">Live samples</h3>
                  <button
                    type="button"
                    className="am-btn small"
                    onClick={() => setSamples(s => [...s, { id: `s-${s.length + 1}`, value: '', shouldMatch: true }])}
                  >
                    + Sample
                  </button>
                </div>
                <div className="am-sample-list">
                  <div className="am-sample-head" aria-hidden="true">
                    <span>You expect</span>
                    <span>Value</span>
                    <span>Pattern</span>
                    <span>Check</span>
                    <span />
                  </div>
                  {samples.map(s => {
                    const actual = regexApplied.kind === 'glob'
                      ? evaluateOperator(
                        'glob',
                        s.value,
                        regexApplied.value,
                        { caseSensitive: caseInsensitive ? false : true },
                      )
                      : regexUtils.testRegex(regexApplied.value, s.value, !caseInsensitive);
                    const expectationOk = actual !== 'invalid' && actual === s.shouldMatch;
                    const actualText = regexUtils.sampleActualLabel(actual);
                    const checkText = regexUtils.sampleCheckLabel(expectationOk);
                    return (
                      <div
                        key={s.id}
                        className={`am-sample-row${expectationOk ? ' pass' : ' fail'}`}
                        data-testid={`api-mock-toolbox-sample-row-${s.id}`}
                      >
                        <button
                          type="button"
                          className="am-badge am-sample-expectation"
                          onClick={() => setSamples(rows => rows.map(r => r.id === s.id ? { ...r, shouldMatch: !r.shouldMatch } : r))}
                          title="Toggle whether you expect this value to match"
                          data-testid={`api-mock-toolbox-sample-expect-${s.id}`}
                        >
                          {regexUtils.sampleExpectLabel(s.shouldMatch)}
                        </button>
                        <input
                          className="am-input am-input--fill mono"
                          value={s.value}
                          onChange={e => setSamples(rows => rows.map(r => r.id === s.id ? { ...r, value: e.target.value } : r))}
                          aria-label="Sample value"
                          data-testid={`api-mock-toolbox-sample-value-${s.id}`}
                        />
                        <span
                          className={`am-sample-actual${actual === true ? ' match' : actual === false ? ' miss' : ''}`}
                          data-testid={`api-mock-toolbox-sample-actual-${s.id}`}
                        >
                          {actualText}
                        </span>
                        <span
                          className={`am-sample-check ${expectationOk ? 'pass' : 'fail'}`}
                          aria-label={checkText}
                          data-testid={`api-mock-toolbox-sample-check-${s.id}`}
                        >
                          {expectationOk ? '✓' : '✕'} {checkText}
                        </span>
                        <button
                          type="button"
                          className="am-sample-delete"
                          onClick={() => setSamples(rows => rows.filter(r => r.id !== s.id))}
                          aria-label="Delete sample"
                          title="Delete sample"
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}
                </div>
                <div className="am-notice am-notice--flush">
                  <span>
                    <strong>Matches</strong> / <strong>Does not match</strong> is what the pattern did.
                    The check is only whether that agreed with <strong>Expect match</strong>.
                  </span>
                </div>
              </div>
            </article>

            <aside className="am-tool-preview">
              <div className="am-panel-head"><span className="am-panel-title">Explanation</span></div>
              <div className="am-detail-pane am-tool-preview-body">
                <div className="am-tool-preview-intro">
                  <strong>Anchored expression</strong>
                  <p className="am-muted">Evaluated against the selected field with runtime-parity flags.</p>
                </div>
                <ul className="am-explain-list">
                  {explanationLines.map(line => (
                    <li key={line} className="am-mono">{line}</li>
                  ))}
                </ul>
                <div className="am-tool-block-title am-tool-preview-subtitle">Applied condition</div>
                <dl className="am-kv-list">
                  <div><dt>Source</dt><dd className="am-mono" data-testid="api-mock-toolbox-applied-source">{appliedSource}</dd></div>
                  <div><dt>Selector</dt><dd className="am-mono" data-testid="api-mock-toolbox-applied-selector">{appliedSelector}</dd></div>
                  <div><dt>Operator</dt><dd className="am-mono" data-testid="api-mock-toolbox-applied-operator">{appliedOperator}</dd></div>
                  <div><dt>Expected</dt><dd className="am-mono" data-testid="api-mock-toolbox-applied-expected">{regexPattern || '—'}</dd></div>
                  <div><dt>Case sensitive</dt><dd className="am-mono">{String(!caseInsensitive)}</dd></div>
                </dl>
                <div className="am-notice warning">
                  <span>Tight patterns (e.g. numeric-only IDs) help resolve overlaps with literal routes like <span className="am-mono">GET /users/admin</span>.</span>
                </div>
              </div>
            </aside>
          </div>
        )}

        {tab === 'path' && (
          <div className="am-tool-layout am-tool-layout-path">
            <aside className="am-tool-library">
              <div className="am-panel-head"><span className="am-panel-title">Path presets</span></div>
              <div className="am-tool-library-list">
                {PATH_PRESETS.map(p => (
                  <button
                    key={p.label}
                    type="button"
                    className="am-pattern-entry"
                    onClick={() => { setKind(p.kind); setValue(p.value); setSample(p.sample); }}
                    data-testid={`api-mock-toolbox-preset-${p.label}`}
                  >
                    <strong>{p.label}</strong>
                    <span className="am-pattern-entry-pattern am-mono">{p.value}</span>
                  </button>
                ))}
              </div>
            </aside>
            <article className="am-tool-editor">
              <div className="am-tool-block">
                <div className="am-tool-block-head">
                  <h3 className="am-tool-block-title">Path matcher</h3>
                </div>
                <div className="am-form-grid">
                  <div className="am-form-row">
                    <div className="am-form-label">Kind</div>
                    <div className="am-form-control">
                      <CustomSelect
                        value={kind}
                        onChange={v => setKind(v as ApiMockPathMatcherKind)}
                        options={KIND_OPTIONS}
                        className="am-cs am-cs--md"
                        aria-label="Pattern kind"
                        data-testid="api-mock-toolbox-kind"
                      />
                    </div>
                  </div>
                  <div className="am-form-row">
                    <div className="am-form-label">Pattern</div>
                    <div className="am-form-control">
                      <input className="am-input am-input--fill mono" value={value} onChange={e => setValue(e.target.value)} data-testid="api-mock-toolbox-pattern" />
                    </div>
                  </div>
                  <div className="am-form-row">
                    <div className="am-form-label">Case-insensitive</div>
                    <div className="am-form-control">
                      <button
                        type="button"
                        className={`am-toggle${caseInsensitive ? ' on' : ''}`}
                        role="switch"
                        aria-checked={caseInsensitive}
                        aria-label="Case-insensitive matching"
                        onClick={() => setCaseInsensitive(v => !v)}
                        data-testid="api-mock-toolbox-ci"
                      />
                    </div>
                  </div>
                  <div className="am-form-row">
                    <div className="am-form-label">Test path</div>
                    <div className="am-form-control">
                      <input className="am-input am-input--fill mono" value={sample} onChange={e => setSample(e.target.value)} placeholder="/users/42" data-testid="api-mock-toolbox-sample" />
                    </div>
                  </div>
                </div>
              </div>
              <div className="am-tool-block">
                <div className="am-tool-block-head">
                  <h3 className="am-tool-block-title">Generalize imported path</h3>
                </div>
                <div className="am-path-parts" data-testid="api-mock-toolbox-segments">
                  {pathParts.map((p, i) => {
                    const dynamic = /^\d+$/.test(p) || /^[A-Z]-?\d+/i.test(p);
                    return (
                      <button
                        key={`${p}-${i}`}
                        type="button"
                        data-testid={`api-mock-toolbox-segment-${i}`}
                        className={`am-path-part${dynamic ? ' dynamic' : ''}`}
                        onClick={() => {
                          const next = [...pathParts];
                          next[i] = dynamic ? p : `:${p || 'id'}`;
                          setPathParts(next);
                          setValue('/' + next.join('/'));
                          setKind('parameterized');
                        }}
                      >
                        {dynamic ? `${p} → :param` : p}
                      </button>
                    );
                  })}
                </div>
                <div className="am-hint am-hint--wrap" data-testid="api-mock-toolbox-suggested">
                  Suggested template: <span className="am-mono">{generalizedTemplate}</span>
                </div>
                <div className={`am-notice ${pathResult.matched ? '' : 'danger'}`} data-testid="api-mock-toolbox-result">
                  <span>
                    {pathResult.matched ? '✓ Matches' : '✕ Does not match'}
                    {Object.keys(pathResult.params).length > 0 && <> · {Object.entries(pathResult.params).map(([k, v]) => `${k}=${v}`).join(', ')}</>}
                  </span>
                </div>
              </div>
            </article>
            <aside className="am-tool-preview">
              <div className="am-panel-head"><span className="am-panel-title">Extraction</span></div>
              <div className="am-detail-pane am-tool-preview-body" data-testid="api-mock-toolbox-extraction">
                {Object.keys(pathResult.params).length === 0 ? (
                  <div className="am-muted am-tool-empty">No path parameters extracted.</div>
                ) : (
                  <div className="am-chip-wrap">
                    {Object.entries(pathResult.params).map(([k, v]) => (
                      <span key={k} className="am-chip active">{k} = {v}</span>
                    ))}
                  </div>
                )}
              </div>
            </aside>
          </div>
        )}

        {tab === 'jsonpath' && (
          <div className="am-tool-layout am-tool-layout-2">
            <div className="am-detail-pane am-tool-pane">
              <div className="am-tool-block-head">
                <h3 className="am-tool-block-title">Sample JSON body</h3>
                <span className={`am-badge ${jsonEval.valid ? 'success' : 'danger'}`} data-testid="api-mock-toolbox-json-valid">
                  {jsonEval.valid ? 'Valid JSON' : 'Invalid JSON'}
                </span>
              </div>
              <div className="am-tool-json-textarea-wrap">
                <textarea
                  ref={jsonTextareaRef}
                  className="am-textarea"
                  value={jsonSample}
                  onChange={e => setJsonSample(e.target.value)}
                  onSelect={handleJsonSelect}
                  onMouseUp={handleJsonSelect}
                  onKeyUp={handleJsonSelect}
                  aria-label="Sample JSON body"
                  data-testid="api-mock-toolbox-json-sample"
                  spellCheck={false}
                />
                <div className="am-tool-json-hint">Click a key/value, or select a JSON node (select-all → $)</div>
              </div>
              {!jsonEval.valid && (
                <div className="am-hint am-hint--error" style={{ marginTop: 6 }}>{jsonEval.error}</div>
              )}
            </div>
            <div className="am-detail-pane am-tool-pane">
              <div className="am-tool-block-title">Generated matcher</div>
              <div className="am-form-grid">
                <div className="am-form-row">
                  <div className="am-form-label">JSONPath</div>
                  <div className="am-form-control">
                    <input className="am-input am-input--fill mono" value={jsonPath} onChange={e => setJsonPath(e.target.value)} data-testid="api-mock-toolbox-jsonpath" />
                  </div>
                </div>
                <div className="am-form-row">
                  <div className="am-form-label">Resolved</div>
                  <div className="am-form-control">
                    <input
                      className="am-input am-input--fill mono am-tool-json-resolved"
                      value={jsonResolvedText}
                      readOnly
                      tabIndex={-1}
                      aria-label="Resolved JSONPath value"
                      data-testid="api-mock-toolbox-json-resolved"
                    />
                  </div>
                </div>
                <div className="am-form-row">
                  <div className="am-form-label">Expected</div>
                  <div className="am-form-control">
                    <input className="am-input am-input--fill mono" value={jsonExpected} onChange={e => setJsonExpected(e.target.value)} data-testid="api-mock-toolbox-json-expected" />
                    <span className={`am-matcher-result ${jsonEqualsExpected ? 'pass' : 'fail'}`} data-testid="api-mock-toolbox-json-result">
                      {jsonEqualsExpected ? '✓' : '×'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="am-notice am-notice--flush">
                <span>
                  <strong>Add condition</strong> attaches a body predicate using the runtime JSONPath evaluator —
                  <span className="am-mono"> jsonPath_equals</span> when an expected value is set, otherwise
                  <span className="am-mono"> jsonPath_exists</span>.
                </span>
              </div>
            </div>
          </div>
        )}

        {tab === 'xpath' && (
          <ApiMockXPathToolboxPanel
            xmlSample={xmlSample}
            xpath={xpath}
            xpathValue={xpathValue}
            onXmlSample={setXmlSample}
            onXpath={setXpath}
            onXpathValue={setXpathValue}
          />
        )}

        {tab === 'schema' && (
          <ApiMockSchemaToolboxPanel
            kind={schemaKind}
            schema={schemaText}
            onKind={setSchemaKind}
            onSchema={setSchemaText}
          />
        )}

        {tab === 'constraints' && (
          <ApiMockPatternToolboxConstraintsTab
            constraints={constraints}
            setConstraints={setConstraints}
          />
        )}
      </div>
    </AppModalFrame>
  );
}
