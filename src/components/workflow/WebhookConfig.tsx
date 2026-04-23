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
  return (
    <>
      {webhookUrl && (
        <div className="wf-config-section" style={{ backgroundColor: '#f8f9fa', padding: '12px', borderRadius: '6px', border: '1px solid #e0e0e0' }}>
          <div className="wf-config-label" style={{ marginBottom: '8px', fontWeight: '600', color: '#333' }}>
            🔗 Webhook URL
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              type="text"
              className="wf-config-input"
              value={webhookUrl}
              readOnly
              style={{ fontFamily: 'monospace', fontSize: '0.85rem', flex: 1, backgroundColor: '#fff' }}
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
