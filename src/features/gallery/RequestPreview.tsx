import { useState, useCallback } from 'react';
import type { Scenario } from '../../shared/types';
import { prettyJson } from '../../shared/utils/helpers';

type PreviewTab = 'request' | 'response';

interface Props {
  scenario: Scenario;
  /** Called when the user clicks the ↗ expand button; receives the active tab and its text content. */
  onExpand?: (tab: PreviewTab, content: string) => void;
}

/**
 * Tabbed preview for request gallery entries:
 * - Request tab: method, URL, headers, assertions
 * - Response tab: fetch-on-demand from the live API
 */
export default function RequestPreview({ scenario, onExpand }: Props) {
  const [activeTab, setActiveTab] = useState<PreviewTab>('request');
  const [responseText, setResponseText] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const requestText = buildRequestPreview(scenario);

  const handleFetch = useCallback(async () => {
    setFetching(true);
    setFetchError(null);
    try {
      const res = await fetch(scenario.url, {
        method: scenario.method,
        headers: scenario.headers?.length
          ? Object.fromEntries(scenario.headers.map(h => [h.key, h.value]))
          : undefined,
        body: scenario.method !== 'GET' && scenario.body ? scenario.body : undefined,
      });
      const text = await res.text();
      const body = prettyJson(text);
      setResponseText(
        `// ${scenario.method} ${scenario.url}\n// Status: ${res.status}\n${body}`
      );
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : String(err));
    } finally {
      setFetching(false);
    }
  }, [scenario]);

  const handleExpand = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const content = activeTab === 'request' ? requestText : (responseText ?? '');
    onExpand?.(activeTab, content);
  }, [activeTab, requestText, responseText, onExpand]);

  const apiHost = (() => {
    try { return new URL(scenario.url).hostname; } catch { return scenario.url; }
  })();

  return (
    <div className="gallery-tabbed-preview">
      {/* Tab bar */}
      <div className="gallery-tab-bar">
        <button
          type="button"
          className={`gallery-tab-btn${activeTab === 'request' ? ' active' : ''}`}
          onClick={() => setActiveTab('request')}
        >
          Request
        </button>
        <button
          type="button"
          className={`gallery-tab-btn${activeTab === 'response' ? ' active' : ''}`}
          onClick={() => setActiveTab('response')}
        >
          Response
        </button>
      </div>

      {/* Tab panels */}
      <div className="gallery-tab-panel">
        {/* Expand button — only when there's content to expand */}
        {(activeTab === 'request' || responseText) && (
          <button
            type="button"
            className="gallery-tab-expand-btn"
            title={`View full ${activeTab} in modal`}
            onClick={handleExpand}
          >
            ↗
          </button>
        )}

        {activeTab === 'request' && (
          <pre className="gallery-tab-code">{requestText}</pre>
        )}

        {activeTab === 'response' && (
          <>
            {!responseText && !fetching && !fetchError && (
              <div className="gallery-tab-empty">
                <div className="gallery-tab-empty-text">
                  Fetch a sample response from the live API to preview what this request returns
                </div>
                <button type="button" className="gallery-tab-fetch-btn" onClick={handleFetch}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                  Fetch Sample
                </button>
              </div>
            )}
            {fetching && (
              <div className="gallery-tab-loading">
                <span className="gallery-tab-spinner" />
                <span>Fetching from {apiHost}…</span>
              </div>
            )}
            {fetchError && (
              <div className="gallery-tab-error">⚠ {fetchError}</div>
            )}
            {responseText && (
              <pre className="gallery-tab-code">{responseText}</pre>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function buildRequestPreview(scenario: Scenario): string {
  const lines: string[] = ['// Scenario that will be imported'];
  lines.push('{');
  lines.push(`  "method": "${scenario.method}",`);
  lines.push(`  "url": "${scenario.url}",`);

  if (scenario.headers && scenario.headers.length > 0) {
    lines.push('  "headers": {');
    scenario.headers.forEach((h, i) => {
      const comma = i < scenario.headers!.length - 1 ? ',' : '';
      lines.push(`    "${h.key}": "${h.value}"${comma}`);
    });
    lines.push('  },');
  }

  if (scenario.body) {
    const bodyPreview = scenario.body.length > 100
      ? scenario.body.slice(0, 100) + '…'
      : scenario.body;
    lines.push(`  "body": ${JSON.stringify(bodyPreview)},`);
  }

  if (scenario.validation?.assertions?.length) {
    lines.push('  "validation": {');
    lines.push('    "assertions": [');
    for (const a of scenario.validation.assertions) {
      const parts: string[] = [];
      parts.push(`"type": "${a.type}"`);
      if ('expected' in a && a.expected) parts.push(`"expected": "${a.expected}"`);
      if ('jsonPath' in a && a.jsonPath) parts.push(`"jsonPath": "${a.jsonPath}"`);
      if ('operator' in a && a.operator) parts.push(`"op": "${a.operator}"`);
      if ('value' in a && a.value !== undefined) parts.push(`"value": ${JSON.stringify(a.value)}`);
      lines.push(`      { ${parts.join(', ')} }`);
    }
    lines.push('    ]');
    lines.push('  }');
  }

  lines.push('}');
  return lines.join('\n');
}
