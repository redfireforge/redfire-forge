import type { WebhookTriggerNodeData } from '../../types/workflow';

interface Props {
  data: WebhookTriggerNodeData;
  onChange: (patch: Partial<WebhookTriggerNodeData>) => void;
}

export default function WebhookConfig({ data, onChange }: Props) {
  return (
    <>
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
