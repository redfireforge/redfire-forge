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
  return (
    <div className="am-tool-layout" data-testid="api-mock-toolbox-xpath">
      <aside className="am-tool-library">
        <div className="am-panel-head"><span className="am-panel-title">XPath presets</span></div>
        <div className="am-tool-library-list">
          {XPATH_PRESETS.map(p => (
            <button
              key={p.name}
              type="button"
              className="am-pattern-entry"
              onClick={() => { onXpath(p.expr); onXmlSample(p.sample); }}
              data-testid={`api-mock-toolbox-xpath-preset-${p.name}`}
            >
              <strong>{p.name}</strong>
              <span className="am-pattern-entry-pattern am-mono">{p.expr}</span>
            </button>
          ))}
        </div>
      </aside>
      <article className="am-tool-editor">
        <label className="am-faint">Sample XML</label>
        <textarea
          className="am-textarea mono"
          value={xmlSample}
          onChange={e => onXmlSample(e.target.value)}
          data-testid="api-mock-toolbox-xpath-sample"
        />
        <label className="am-faint">XPath</label>
        <input
          className="am-input mono"
          value={xpath}
          onChange={e => onXpath(e.target.value)}
          data-testid="api-mock-toolbox-xpath-expr"
        />
        <label className="am-faint">Equals value (optional)</label>
        <input
          className="am-input mono"
          value={xpathValue}
          onChange={e => onXpathValue(e.target.value)}
          placeholder="leave empty for exists"
          data-testid="api-mock-toolbox-xpath-value"
        />
      </article>
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
    <div className="am-tool-layout" data-testid="api-mock-toolbox-schema">
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
      <article className="am-tool-editor">
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
          className="am-textarea mono"
          value={schema}
          onChange={e => onSchema(e.target.value)}
          data-testid="api-mock-toolbox-schema-editor"
        />
        <p className="am-hint">
          XML matching is a well-formedness plus required element-name subset, not a full XSD engine.
        </p>
      </article>
    </div>
  );
}
