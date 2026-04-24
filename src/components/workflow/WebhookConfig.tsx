import { useState } from 'react';
import type { WebhookTriggerNodeData } from '../../types/workflow';

interface Props {
  data: WebhookTriggerNodeData;
  onChange: (patch: Partial<WebhookTriggerNodeData>) => void;
  workflowId?: string;
  nodeId?: string;
}

export default function WebhookConfig({ data, onChange, workflowId, nodeId }: Props) {
  const [copied, setCopied] = useState(false);
  const [curlCopied, setCurlCopied] = useState(false);

  const webhookUrl = workflowId && nodeId
    ? `http://127.0.0.1:3001/webhooks/${workflowId}/${nodeId}`
    : null;

  const handleCopyUrl = async () => {
    if (webhookUrl) {
      try {
        await navigator.clipboard.writeText(webhookUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    }
  };

  const handleCopyCurl = async () => {
    if (!webhookUrl) return;
    const payload = data.samplePayload?.trim() || '{}';
    const escaped = payload.replace(/'/g, "'\\''");
    const curl = `curl --noproxy '*' -X ${data.method} '${webhookUrl}' \\\n  -H 'Content-Type: application/json' \\\n  -d '${escaped}'`;
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
    </>
  );
}
