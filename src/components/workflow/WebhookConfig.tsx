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
    const curl = `curl -X ${data.method} '${webhookUrl}' \\\n  -H 'Content-Type: application/json' \\\n  -d '${escaped}'`;
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
        <div className="wf-config-section" style={{ padding: '12px', borderRadius: '6px', border: '1px solid var(--border)' }}>
          <div className="wf-config-label" style={{ marginBottom: '8px', fontWeight: '600' }}>
            🔗 Webhook URL
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              type="text"
              className="wf-config-input"
              value={webhookUrl}
              readOnly
              style={{ fontFamily: 'monospace', fontSize: '0.85rem', flex: 1 }}
              onFocus={(e) => e.target.select()}
            />
            <button
              type="button"
              onClick={handleCopyUrl}
              style={{
                padding: '8px 16px',
                backgroundColor: copied ? '#4caf50' : '#2196f3',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: '500',
                whiteSpace: 'nowrap',
                transition: 'background-color 0.2s',
              }}
            >
              {copied ? '✓ Copied!' : 'Copy'}
            </button>
            <button
              type="button"
              onClick={handleCopyCurl}
              title="Copy as cURL command with sample payload"
              style={{
                padding: '8px 16px',
                backgroundColor: curlCopied ? '#4caf50' : '#6366f1',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: '500',
                whiteSpace: 'nowrap',
                transition: 'background-color 0.2s',
              }}
            >
              {curlCopied ? '✓ Copied!' : 'Copy cURL'}
            </button>
          </div>
          <div style={{ marginTop: '8px', fontSize: '0.8rem', color: '#666' }}>
            💡 Tip: Server must be running (<code>npm run server</code>) to receive webhooks
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
            className="wf-config-textarea"
            rows={8}
            value={data.samplePayload}
            onChange={(e) => onChange({ samplePayload: e.target.value })}
            placeholder='{\n  "event": "example",\n  "data": {}\n}'
            style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
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
