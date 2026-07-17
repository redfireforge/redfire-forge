/** Full-width history entry preview (request / variables / response tabs). */
import { useEffect, useState, type ReactNode } from 'react';
import type { GraphqlHistoryItem } from '../../../shared/types/graphql';
import { buildHistoryPreviewData } from '../utils/historyItemParse';

export interface GraphqlHistoryPreviewPanelProps {
  item: GraphqlHistoryItem;
  onClose: () => void;
  onLoadIntoEditor: (item: GraphqlHistoryItem) => void;
  onRunInEditor?: (item: GraphqlHistoryItem) => void;
  onSaveToCollection: (item: GraphqlHistoryItem) => void;
}

type HistoryPreviewTab = 'request' | 'variables' | 'response';

const PREVIEW_TABS: { id: HistoryPreviewTab; label: string }[] = [
  { id: 'request', label: 'Request' },
  { id: 'variables', label: 'Variables' },
  { id: 'response', label: 'Response' },
];

function copyClipboard(text: string): void {
  navigator.clipboard.writeText(text).catch(() => {});
}

function operationTypeLabel(type: GraphqlHistoryItem['operation']['operationType']): string {
  if (type === 'mutation') return 'Mutation';
  if (type === 'subscription') return 'Subscription';
  return 'Query';
}

function HistoryPreviewTabPanel({
  copyLabel,
  copyText,
  testId,
  children,
}: {
  copyLabel: string;
  copyText: string;
  testId: string;
  children: ReactNode;
}) {
  return (
    <div className="gql-history-preview-tab-panel" data-testid={testId} role="tabpanel">
      <div className="gql-history-preview-tab-toolbar">
        <button
          type="button"
          className="gql-history-preview-copy-btn"
          onClick={() => copyClipboard(copyText)}
          aria-label={copyLabel}
          title={copyLabel}
        >
          Copy
        </button>
      </div>
      <div className="gql-history-preview-tab-body">
        {children}
      </div>
    </div>
  );
}

export function GraphqlHistoryPreviewPanel({
  item,
  onClose,
  onLoadIntoEditor,
  onRunInEditor,
  onSaveToCollection,
}: GraphqlHistoryPreviewPanelProps) {
  const preview = buildHistoryPreviewData(item);
  const variablesDisplay = preview.variablesText ?? '{}';
  const [activeTab, setActiveTab] = useState<HistoryPreviewTab>('response');
  const opName = item.operation.name ?? 'Anonymous';
  const opType = item.operation.operationType;
  const when = new Date(item.timestamp).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const httpLabel = preview.httpStatus !== null ? `HTTP ${preview.httpStatus}` : null;
  const statusOk = item.status === 'success' && !preview.hasGraphqlErrors;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    setActiveTab('response');
  }, [item.id]);

  return (
    <div className="gql-history-preview" data-testid="gql-history-preview" role="complementary" aria-label="History entry preview">
      <div className="gql-history-preview-header">
        <button
          type="button"
          className="gql-history-preview-back"
          onClick={onClose}
          aria-label="Back to history list"
          title="Back to list"
          data-testid="gql-history-preview-back"
        >
          ←
        </button>
        <div className="gql-history-preview-header-main">
          <span className={`gql-history-badge gql-history-badge--${opType}`} aria-hidden="true">
            {opType === 'query' ? 'Q' : opType === 'mutation' ? 'M' : 'S'}
          </span>
          <div className="gql-history-preview-heading">
            <h3 className="gql-history-preview-name">{opName}</h3>
            <span className="gql-history-preview-subtitle">{operationTypeLabel(opType)}</span>
          </div>
        </div>
        <button type="button" className="gql-history-preview-close" onClick={onClose} aria-label="Close preview" title="Close (Esc)">
          ✕
        </button>
      </div>

      <div className="gql-history-preview-meta" aria-label="Execution metadata">
        <span className={`gql-history-preview-chip gql-history-preview-chip--${statusOk ? 'ok' : 'error'}`}>
          {statusOk ? 'Success' : 'Error'}
        </span>
        {httpLabel && (
          <span className="gql-history-preview-chip">{httpLabel}</span>
        )}
        <span className="gql-history-preview-chip">{item.latencyMs} ms</span>
        <span className="gql-history-preview-chip gql-history-preview-chip--muted">{when}</span>
      </div>

      <div className="gql-history-preview-body">
        <div className="gql-history-preview-tabs" role="tablist" aria-label="History entry content">
          {PREVIEW_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`gql-history-preview-tab-${tab.id}`}
              aria-selected={activeTab === tab.id}
              aria-controls={`gql-history-preview-panel-${tab.id}`}
              className={`gql-history-preview-tab${activeTab === tab.id ? ' gql-history-preview-tab--active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
              data-testid={`gql-history-preview-tab-${tab.id}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="gql-history-preview-tab-content">
          {activeTab === 'request' && (
            <HistoryPreviewTabPanel
              copyLabel="Copy query"
              copyText={preview.queryText}
              testId="gql-history-preview-request"
            >
              <pre className="gql-history-preview-pre">{preview.queryText}</pre>
            </HistoryPreviewTabPanel>
          )}

          {activeTab === 'variables' && (
            <HistoryPreviewTabPanel
              copyLabel="Copy variables"
              copyText={variablesDisplay}
              testId="gql-history-preview-variables"
            >
              <pre className="gql-history-preview-pre">{variablesDisplay}</pre>
            </HistoryPreviewTabPanel>
          )}

          {activeTab === 'response' && (
            <>
              {preview.isTruncated && (
                onRunInEditor
                  ? (
                    <button
                      type="button"
                      className="gql-history-truncation-banner gql-history-truncation-banner--clickable"
                      onClick={() => onRunInEditor(item)}
                      data-testid="gql-history-truncation-rerun"
                    >
                      Response truncated — re-execute to load the full payload
                    </button>
                  )
                  : (
                    <div className="gql-history-truncation-banner" role="status">
                      Response truncated — re-execute to load the full payload
                    </div>
                  )
              )}
              <HistoryPreviewTabPanel
                copyLabel="Copy response body"
                copyText={preview.responseBodyText}
                testId="gql-history-preview-response"
              >
                <pre className="gql-history-preview-pre">{preview.responseBodyText}</pre>
              </HistoryPreviewTabPanel>
            </>
          )}
        </div>
      </div>

      <div className="gql-history-preview-actions">
        {onRunInEditor && (
          <button
            type="button"
            className="gql-history-preview-btn gql-history-preview-btn--primary"
            onClick={() => onRunInEditor(item)}
            data-testid="gql-history-run"
          >
            Open &amp; Run
          </button>
        )}
        <button
          type="button"
          className="gql-history-preview-btn"
          onClick={() => onLoadIntoEditor(item)}
          data-testid="gql-history-load"
        >
          Load into editor
        </button>
        <button
          type="button"
          className="gql-history-preview-btn"
          onClick={() => onSaveToCollection(item)}
          data-testid="gql-history-save-to-col"
        >
          Save to Collection
        </button>
      </div>
    </div>
  );
}
