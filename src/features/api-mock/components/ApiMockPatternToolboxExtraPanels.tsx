import { evaluateXPath } from '../../../shared/api-mock/xpathMatcher';
import { ApiMockExpandableText } from './ApiMockExpandableText';
import { SCHEMA_PRESETS, XPATH_PRESETS } from './apiMockPatternToolboxConstants';

interface XPathPanelProps {
  xmlSample: string;
  xpath: string;
  xpathValue: string;
  onXmlSample: (value: string) => void;
  onXpath: (value: string) => void;
  onXpathValue: (value: string) => void;
}

export function ApiMockXPathToolboxPanel({
  xmlSample, xpath, xpathValue, onXmlSample, onXpath, onXpathValue,
}: XPathPanelProps) {
  // Same evaluator Apply writes: empty Equals value → exists, otherwise equals.
  const evaluated = evaluateXPath(xmlSample, xpath);
  const resolved = !evaluated.ok
    ? '(not XML or invalid expression)'
    : evaluated.values.length === 0 ? '(no match)' : evaluated.values.join(', ');
  const equalsMode = xpathValue.trim().length > 0;
  const passes = equalsMode
    ? evaluated.values.some(v => v === xpathValue)
    : evaluated.matched;
  const operator = equalsMode ? 'xpath_equals' : 'xpath_exists';

  return (
    <div className="am-tool-layout am-tool-layout-library" data-testid="api-mock-toolbox-xpath">
      <aside className="am-tool-library">
        <div className="am-panel-head"><span className="am-panel-title">XPath presets</span></div>
        <div className="am-tool-library-list">
          {XPATH_PRESETS.map(p => (
            <button
              key={p.name}
              type="button"
              className={`am-pattern-entry${xpath === p.expr ? ' active' : ''}`}
              onClick={() => { onXpath(p.expr); onXmlSample(p.sample); }}
              data-testid={`api-mock-toolbox-xpath-preset-${p.name}`}
            >
              <strong>{p.name}</strong>
              <span className="am-pattern-entry-pattern am-mono">{p.expr}</span>
            </button>
          ))}
        </div>
      </aside>

      <div className="am-tool-xpath-main">
        <div className="am-detail-pane am-tool-pane am-tool-xpath-sample">
          <div className="am-tool-block-head">
            <h3 className="am-tool-block-title">Sample XML</h3>
            <span
              className={`am-badge ${evaluated.ok ? 'success' : 'danger'}`}
              data-testid="api-mock-toolbox-xpath-valid"
            >{evaluated.ok ? 'Well-formed XML' : 'Not XML'}</span>
          </div>
          <div className="am-tool-json-textarea-wrap">
            <ApiMockExpandableText
              label="Sample XML"
              value={xmlSample}
              onChange={onXmlSample}
              testId="api-mock-toolbox-xpath-sample"
              multiline
              className="am-textarea--expand"
              ariaLabel="Sample XML"
            />
            <div className="am-tool-json-hint">Expand to read the full envelope. Use local-name() for namespaced SOAP.</div>
          </div>
        </div>

        <section className="am-tool-xpath-matcher" aria-label="Generated matcher">
          <div className="am-tool-block-head">
            <h3 className="am-tool-block-title">Generated matcher</h3>
            <span
              className={`am-matcher-result ${passes ? 'pass' : 'fail'}`}
              aria-hidden="true"
            >{passes ? '✓' : '×'}</span>
          </div>
          <div className="am-tool-xpath-fields">
            <label className="am-tool-xpath-field am-tool-xpath-field--path">
              <span>XPath</span>
              <input
                className="am-input am-input--fill mono"
                value={xpath}
                title={xpath}
                onChange={e => onXpath(e.target.value)}
                data-testid="api-mock-toolbox-xpath-expr"
              />
            </label>
            <label className="am-tool-xpath-field">
              <span>Resolved</span>
              <input
                className="am-input am-input--fill mono am-tool-json-resolved"
                value={resolved}
                title={resolved}
                readOnly
                tabIndex={-1}
                aria-label="Resolved XPath value"
                data-testid="api-mock-toolbox-xpath-resolved"
              />
            </label>
            <label className="am-tool-xpath-field">
              <span>Equals value</span>
              <span className="am-tool-xpath-equals">
                <input
                  className="am-input am-input--fill mono"
                  value={xpathValue}
                  title={xpathValue}
                  onChange={e => onXpathValue(e.target.value)}
                  placeholder="leave empty for exists"
                  data-testid="api-mock-toolbox-xpath-value"
                />
                <span
                  className={`am-matcher-result ${passes ? 'pass' : 'fail'}`}
                  aria-label={passes ? 'expression matches the sample' : 'expression does not match the sample'}
                  data-testid="api-mock-toolbox-xpath-result"
                >{passes ? '✓' : '×'}</span>
              </span>
            </label>
          </div>
          <div className="am-notice am-notice--flush">
            <span>
              <strong>Add condition</strong> attaches a body predicate using the runtime XPath evaluator —
              <span className="am-mono"> {operator}</span>
              {equalsMode ? ' because Equals is set.' : ' while Equals is empty.'}
            </span>
          </div>
        </section>
      </div>
    </div>
  );
}

interface SchemaPanelProps {
  kind: 'json' | 'xml';
  schema: string;
  onKind: (kind: 'json' | 'xml') => void;
  onSchema: (value: string) => void;
}

export function ApiMockSchemaToolboxPanel({ kind, schema, onKind, onSchema }: SchemaPanelProps) {
  return (
    <div className="am-tool-layout am-tool-layout-library" data-testid="api-mock-toolbox-schema">
      <aside className="am-tool-library">
        <div className="am-panel-head"><span className="am-panel-title">Schema presets</span></div>
        <div className="am-tool-library-list">
          {SCHEMA_PRESETS.map(p => (
            <button
              key={p.name}
              type="button"
              className="am-pattern-entry"
              onClick={() => { onKind(p.kind); onSchema(p.value); }}
              data-testid={`api-mock-toolbox-schema-preset-${p.name}`}
            >
              <strong>{p.name}</strong>
            </button>
          ))}
        </div>
      </aside>
      <article className="am-tool-editor am-tool-editor--fill">
        <div className="am-builder-tabs" role="tablist" aria-label="Schema kind">
          {(['json', 'xml'] as const).map(id => (
            <button
              key={id}
              type="button"
              className={`am-builder-tab${kind === id ? ' active' : ''}`}
              data-testid={`api-mock-toolbox-schema-kind-${id}`}
              onClick={() => onKind(id)}
            >{id === 'json' ? 'JSON Schema' : 'XML names / XSD'}</button>
          ))}
        </div>
        <textarea
          className="am-textarea mono am-textarea--expand"
          value={schema}
          onChange={e => onSchema(e.target.value)}
          data-testid="api-mock-toolbox-schema-editor"
        />
        <p className="am-hint am-hint--wrap">
          XML matching is a well-formedness plus required element-name subset, not a full XSD engine.
        </p>
      </article>
    </div>
  );
}
