import { useState, useMemo } from 'react';
import type { WebhookTriggerNodeData } from '../../types/workflow';
import ConfigSectionGroup from './ConfigSectionGroup';
import { DataMapperModal, createWebhookExtractionAdapter } from '../../../../shared/components/data-mapper';
import type { WebhookExtractionOutput } from '../../../../shared/components/data-mapper';

interface Props {
  data: WebhookTriggerNodeData;
  onChange: (patch: Partial<WebhookTriggerNodeData>) => void;
  workflowId?: string;
  nodeId?: string;
}

const EMPTY_EXTRACT_VARS: WebhookExtractionOutput = [];

export default function WebhookConfig({ data, onChange, workflowId, nodeId }: Props) {
  const [copied, setCopied] = useState(false);
  const [curlCopied, setCurlCopied] = useState(false);
  const [showMapper, setShowMapper] = useState(false);

  const mapperAdapter = useMemo(
    () => createWebhookExtractionAdapter({ samplePayload: data.samplePayload }),
    [data.samplePayload],
  );

  const webhookUrl = workflowId && nodeId
    ? `http://127.0.0.1:3001/webhooks/${workflowId}/${nodeId}`
    : null;

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(webhookUrl as string);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleCopyCurl = async () => {
    const url = webhookUrl!;
    const payload = data.samplePayload?.trim() || '{}';
    const escaped = payload.replace(/'/g, "'\\''");
    const curl = `curl --noproxy '*' -X ${data.method} '${url}' \\\n  -H 'Content-Type: application/json' \\\n  -d '${escaped}'`;
    try {
      await navigator.clipboard.writeText(curl);
      setCurlCopied(true);
      setTimeout(() => setCurlCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy cURL:', err);
    }
  };
  return (
    <>
      {webhookUrl && (
        <div className="wf-config-section wf-webhook-url-panel">
          <div className="wf-config-label wf-webhook-url-title">
            Webhook URL
          </div>
          <div className="wf-webhook-url-row">
            <input
              type="text"
              className="wf-config-input wf-webhook-url-input"
              value={webhookUrl}
              readOnly
              onFocus={(e) => e.target.select()}
            />
            <button
              type="button"
              className={`wf-webhook-copy-btn ${copied ? 'copied' : ''}`}
              onClick={handleCopyUrl}
            >
              {copied ? '✓ Copied!' : 'Copy'}
            </button>
            <button
              type="button"
              className={`wf-webhook-copy-btn wf-webhook-curl-btn ${curlCopied ? 'copied' : ''}`}
              onClick={handleCopyCurl}
              title="Copy as cURL command with sample payload"
            >
              {curlCopied ? '✓ Copied!' : 'Copy cURL'}
            </button>
          </div>
          <div className="wf-webhook-url-hint">
            Server must be running (<code>npm run server</code>) to receive webhooks
          </div>
        </div>
      )}
      <ConfigSectionGroup title="Request Settings">
        <div className="wf-config-section">
          <label className="wf-config-label">
            HTTP Method
            <select
              className="wf-config-input"
              value={data.method}
              onChange={(e) => onChange({ method: e.target.value as 'POST' | 'PUT' | 'PATCH' })}
            >
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="PATCH">PATCH</option>
            </select>
          </label>
        </div>
        <div className="wf-config-section">
          <label className="wf-config-label">
            Endpoint Path
            <input
              type="text"
              className="wf-config-input"
              value={data.path}
              onChange={(e) => onChange({ path: e.target.value })}
              placeholder="/api/webhook"
            />
          </label>
        </div>
      </ConfigSectionGroup>
      <ConfigSectionGroup title="Payload">
        <div className="wf-config-section">
          <label className="wf-config-label">
            Sample Payload (JSON)
            <textarea
              className="wf-config-textarea wf-config-textarea-mono"
              rows={8}
              value={data.samplePayload}
              onChange={(e) => onChange({ samplePayload: e.target.value })}
              placeholder='{\n  "event": "example",\n  "data": {}\n}'
            />
          </label>
        </div>
      </ConfigSectionGroup>
      <ConfigSectionGroup title="Extract Variables" defaultOpen={(data.extractVariables ?? []).length > 0}>
        <div className="wf-config-section">
          <span className="wf-config-hint">
            Variables to extract from the webhook payload into the workflow context.
          </span>
          <div className="wf-extract-vars-list">
            {(data.extractVariables ?? []).map((ev, i) => (
              <div key={i} className="wf-extract-var-row">
                <input
                  className="wf-extract-var-name"
                  value={ev.name}
                  onChange={(e) => {
                    const vars = [...(data.extractVariables ?? [])];
                    vars[i] = { ...vars[i], name: e.target.value };
                    onChange({ extractVariables: vars });
                  }}
                  placeholder="Variable name"
                />
                <input
                  className="wf-extract-var-path"
                  value={ev.jsonPath}
                  onChange={(e) => {
                    const vars = [...(data.extractVariables ?? [])];
                    vars[i] = { ...vars[i], jsonPath: e.target.value };
                    onChange({ extractVariables: vars });
                  }}
                  placeholder="$.path.to.value"
                />
                <button
                  className="wf-extract-var-remove"
                  onClick={() => {
                    const vars = (data.extractVariables ?? []).filter((_, idx) => idx !== i);
                    onChange({ extractVariables: vars });
                  }}
                  title="Remove variable"
                  aria-label="Remove variable"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
          <div className="wf-extract-var-actions">
            <button
              className="wf-extract-var-add"
              onClick={() => {
                const vars = [...(data.extractVariables ?? []), { name: '', jsonPath: '' }];
                onChange({ extractVariables: vars });
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Add Variable
            </button>
            <button
              className="wf-extract-var-mapper-btn"
              onClick={() => setShowMapper(true)}
              title="Open Visual Mapper to drag-and-drop fields from the payload sample"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <rect x="3" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
                <path d="M10 7h4l-4 10h4" />
              </svg>
              Visual Mapper
            </button>
          </div>
        </div>
      </ConfigSectionGroup>
      <ConfigSectionGroup title="Notes" defaultOpen={!!data.notes}>
        <div className="wf-config-section">
          <label className="wf-config-label">
            Notes (optional)
            <textarea
              className="wf-config-textarea"
              rows={3}
              value={data.notes ?? ''}
              onChange={(e) => onChange({ notes: e.target.value })}
              placeholder="Documentation or notes about this webhook..."
            />
          </label>
        </div>
      </ConfigSectionGroup>

      {showMapper && (
        <DataMapperModal
          adapter={mapperAdapter}
          initialData={data.extractVariables ?? EMPTY_EXTRACT_VARS}
          onSave={(result: WebhookExtractionOutput) => {
            onChange({ extractVariables: result });
            setShowMapper(false);
          }}
          onCancel={() => setShowMapper(false)}
        />
      )}
    </>
  );
}
