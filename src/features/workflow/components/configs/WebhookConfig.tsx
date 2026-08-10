import { useState, useMemo } from 'react';
import type { WebhookTriggerNodeData } from '../../types/workflow';
import { DataMapperModal, createWebhookExtractionAdapter } from '../../../../shared/components/data-mapper';
import type { WebhookExtractionOutput } from '../../../../shared/components/data-mapper';
import { useCopyToClipboard } from '../../../../shared/hooks/useCopyToClipboard';
import { CustomSelect } from '../../../../shared/components/CustomSelect';
import { KafkaAddButton, KafkaCard, KafkaEmptyState, KafkaFormRow } from './KafkaConfigUi';

interface Props {
  data: WebhookTriggerNodeData;
  onChange: (patch: Partial<WebhookTriggerNodeData>) => void;
  workflowId?: string;
  nodeId?: string;
}

const EMPTY_EXTRACT_VARS: WebhookExtractionOutput = [];

const METHOD_OPTIONS = [
  { value: 'POST', label: 'POST' },
  { value: 'PUT', label: 'PUT' },
  { value: 'PATCH', label: 'PATCH' },
];

export default function WebhookConfig({ data, onChange, workflowId, nodeId }: Props) {
  const [copied, copyUrl] = useCopyToClipboard(2000);
  const [curlCopied, copyCurl] = useCopyToClipboard(2000);
  const [showMapper, setShowMapper] = useState(false);

  const mapperAdapter = useMemo(
    () => createWebhookExtractionAdapter({ samplePayload: data.samplePayload }),
    [data.samplePayload],
  );

  const webhookUrl = workflowId && nodeId
    ? `http://127.0.0.1:3001/webhooks/${workflowId}/${nodeId}`
    : null;

  const extractVariables = data.extractVariables ?? [];

  const handleCopyUrl = async () => {
    await copyUrl(webhookUrl as string);
  };

  const handleCopyCurl = async () => {
    const url = webhookUrl!;
    const payload = data.samplePayload?.trim() || '{}';
    const escaped = payload.replace(/'/g, "'\\''");
    const curl = `curl --noproxy '*' -X ${data.method} '${url}' \\\n  -H 'Content-Type: application/json' \\\n  -d '${escaped}'`;
    await copyCurl(curl);
  };

  const addExtractVar = () => {
    onChange({ extractVariables: [...extractVariables, { name: '', jsonPath: '' }] });
  };

  const updateExtractVar = (index: number, field: 'name' | 'jsonPath', value: string) => {
    const vars = [...extractVariables];
    vars[index] = { ...vars[index], [field]: value };
    onChange({ extractVariables: vars });
  };

  const removeExtractVar = (index: number) => {
    onChange({ extractVariables: extractVariables.filter((_, i) => i !== index) });
  };

  return (
    <>
      <div className="wf-config-body wf-webhook-config" data-testid="webhook-config">
        {webhookUrl && (
          <KafkaCard
            title="Webhook URL"
            hint="POST this URL from your external system. The local server must be running."
            testId="webhook-url-panel"
          >
            <div className="wf-webhook-url-panel">
              <div className="wf-webhook-url-row">
                <input
                  type="text"
                  className="wf-kafka-form-input wf-webhook-url-input"
                  value={webhookUrl}
                  readOnly
                  onFocus={(e) => e.target.select()}
                  aria-label="Webhook URL"
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
              <p className="wf-webhook-url-hint">
                Server must be running (<code>npm run server</code>) to receive webhooks
              </p>
            </div>
          </KafkaCard>
        )}

        <KafkaCard
          title="Request"
          hint="Method and path shown on the canvas. Path is documentation for your integration."
        >
          <div className="wf-kafka-form wf-kafka-form--connection wf-kafka-form--webhook">
            <KafkaFormRow label="Label" hint="Canvas node title" compact>
              <input
                className="wf-kafka-form-input"
                value={data.label}
                onChange={(e) => onChange({ label: e.target.value })}
                placeholder="Webhook Trigger"
                aria-label="Webhook label"
              />
            </KafkaFormRow>

            <KafkaFormRow label="HTTP method" hint="Accepted verb" compact>
              <CustomSelect
                value={data.method}
                onChange={(v) => onChange({ method: v as 'POST' | 'PUT' | 'PATCH' })}
                options={METHOD_OPTIONS}
              />
            </KafkaFormRow>

            <KafkaFormRow
              label="Endpoint path"
              hint={<>e.g. <code>/api/webhook</code></>}
              compact
            >
              <input
                type="text"
                className="wf-kafka-form-input wf-kafka-form-input--mono"
                value={data.path}
                onChange={(e) => onChange({ path: e.target.value })}
                placeholder="/api/webhook"
              />
            </KafkaFormRow>
          </div>
        </KafkaCard>

        <KafkaCard
          title="Sample payload"
          hint="JSON used for Quick Test and as the source tree in Data Mapper."
        >
          <div className="wf-kafka-subsection wf-kafka-subsection--body-template">
            <div className="wf-kafka-subsection-toolbar">
              <span className="wf-kafka-subsection-label">Message body (JSON)</span>
            </div>
            <textarea
              className="wf-config-textarea wf-kafka-form-textarea wf-config-textarea-mono"
              rows={8}
              value={data.samplePayload ?? ''}
              onChange={(e) => onChange({ samplePayload: e.target.value })}
              placeholder={`{\n  "event": "example",\n  "data": {}\n}`}
              aria-label="Sample Payload (JSON)"
            />
          </div>
        </KafkaCard>

        <KafkaCard
          title="Extract Variables"
          hint="Pull fields from the webhook body into workflow variables via JSONPath."
          action={(
            <div className="wf-webhook-extract-actions">
              <button
                type="button"
                className="wf-webhook-mapper-btn"
                onClick={() => setShowMapper(true)}
                title="Open Data Mapper to drag-and-drop fields from the payload sample"
              >
                Data Mapper
              </button>
              <KafkaAddButton label="Add Variable" onClick={addExtractVar} />
            </div>
          )}
        >
          {extractVariables.length === 0 ? (
            <KafkaEmptyState
              title="No extractions"
              text="Map payload fields to workflow variables, or open Data Mapper to pick paths visually."
            />
          ) : (
            <div className="wf-kafka-extract-panel">
              <div className="wf-kafka-extract-header" aria-hidden="true">
                <span className="wf-kafka-extract-col-name">Variable name</span>
                <span className="wf-kafka-extract-col-path">JSONPath</span>
                <span className="wf-kafka-extract-col-del" />
              </div>
              <div className="wf-kafka-extract-list">
                {extractVariables.map((ev, i) => (
                  <div key={i} className="wf-kafka-extract-row">
                    <div className="wf-kafka-extract-col-name">
                      <input
                        className="wf-kafka-form-input"
                        value={ev.name}
                        onChange={(e) => updateExtractVar(i, 'name', e.target.value)}
                        placeholder="Variable name"
                      />
                    </div>
                    <div className="wf-kafka-extract-col-path">
                      <input
                        className="wf-kafka-form-input wf-kafka-form-input--mono"
                        value={ev.jsonPath}
                        onChange={(e) => updateExtractVar(i, 'jsonPath', e.target.value)}
                        placeholder="$.path.to.value"
                      />
                    </div>
                    <div className="wf-kafka-extract-col-del">
                      <button
                        type="button"
                        className="btn btn-sm btn-danger"
                        onClick={() => removeExtractVar(i)}
                        title="Remove variable"
                        aria-label="Remove variable"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </KafkaCard>

        <KafkaCard title="Notes" hint="Optional description for teammates.">
          <div className="wf-kafka-card-pad">
            <textarea
              className="wf-config-textarea wf-kafka-form-textarea"
              rows={3}
              value={data.notes ?? ''}
              onChange={(e) => onChange({ notes: e.target.value })}
              placeholder="Documentation or notes about this webhook..."
              aria-label="Notes (optional)"
            />
          </div>
        </KafkaCard>
      </div>

      {showMapper && (
        <DataMapperModal
          adapter={mapperAdapter}
          initialData={data.extractVariables ?? EMPTY_EXTRACT_VARS}
          onSave={(result: WebhookExtractionOutput) => {
            onChange({ extractVariables: result });
            setShowMapper(false);
          }}
          onCancel={() => setShowMapper(false)}
          contextScope={nodeId}
        />
      )}
    </>
  );
}
