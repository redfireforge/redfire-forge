/**
 * WebhookLoadDriverPanel - Configuration UI for webhook load testing
 * 
 * Shown when a workflow starts with a Webhook Trigger node instead of a Start node.
 * Allows configuring:
 * - Request rate (fixed RPS, ramp up/down, burst)
 * - Payload template with generator placeholders
 * - Duration and total request count
 */

import { useState, useMemo } from 'react';
import type { WebhookRateConfig, WebhookRateMode } from '../../workflow/engine/webhookLoadDriver';
import { calculateTotalRequests } from '../../workflow/engine/webhookLoadDriver';
import { getAvailableGenerators, validatePayloadTemplate } from '../../workflow/engine/payloadTemplateEngine';

export interface WebhookLoadConfig {
  /** Full webhook URL (auto-derived from workflow + trigger node). */
  webhookUrl: string;
  /** HTTP method from trigger node. */
  method: 'POST' | 'PUT' | 'PATCH';
  /** Payload template with {{$generator}} placeholders. */
  payloadTemplate: string;
  /** Rate configuration. */
  rate: WebhookRateConfig;
  /** Custom headers. */
  headers: Record<string, string>;
}

interface Props {
  /** Initial webhook URL (derived from workflow's webhook trigger). */
  webhookUrl: string;
  /** Initial method from webhook trigger node. */
  method: 'POST' | 'PUT' | 'PATCH';
  /** Initial payload template (from trigger's samplePayload). */
  initialPayload: string;
  /** Current configuration. */
  config: WebhookLoadConfig;
  /** Called when configuration changes. */
  onChange: (config: WebhookLoadConfig) => void;
  /** Whether the test is currently running. */
  disabled?: boolean;
}

export default function WebhookLoadDriverPanel({
  webhookUrl,
  method,
  initialPayload,
  config,
  onChange,
  disabled = false,
}: Props) {
  const [showGenerators, setShowGenerators] = useState(false);
  const generators = useMemo(() => getAvailableGenerators(), []);
  
  const totalRequests = useMemo(() => calculateTotalRequests(config.rate), [config.rate]);
  const templateErrors = useMemo(() => validatePayloadTemplate(config.payloadTemplate), [config.payloadTemplate]);
  
  const updateRate = (updates: Partial<WebhookRateConfig>) => {
    onChange({
      ...config,
      rate: { ...config.rate, ...updates },
    });
  };
  
  const handleModeChange = (mode: WebhookRateMode) => {
    const newRate: WebhookRateConfig = { mode };
    
    switch (mode) {
      case 'fixed':
        newRate.rps = config.rate.rps || 10;
        newRate.durationSec = config.rate.durationSec || 60;
        break;
      case 'ramp':
        newRate.rps = config.rate.rps || 1;
        newRate.endRps = config.rate.endRps || 50;
        newRate.durationSec = config.rate.durationSec || 120;
        break;
      case 'burst':
        newRate.burstCount = config.rate.burstCount || 100;
        break;
    }
    
    onChange({ ...config, rate: newRate });
  };
  
  const insertGenerator = (syntax: string) => {
    const textarea = document.querySelector('.webhook-payload-editor') as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newPayload = config.payloadTemplate.slice(0, start) + syntax + config.payloadTemplate.slice(end);
      onChange({ ...config, payloadTemplate: newPayload });
      // Restore cursor position after the inserted text
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + syntax.length, start + syntax.length);
      }, 0);
    } else {
      // Fallback: append to end
      onChange({ ...config, payloadTemplate: config.payloadTemplate + syntax });
    }
  };
  
  const resetPayload = () => {
    onChange({ ...config, payloadTemplate: initialPayload });
  };

  return (
    <div className="webhook-load-driver-panel">
      <div className="config-section">
        <div className="config-section-header">
          <span className="config-section-icon">🔗</span>
          <h3>Webhook Load Test</h3>
          <span className="config-section-badge">{method}</span>
        </div>

        {/* Server requirement notice */}
        <div className="webhook-server-notice">
          <span className="notice-icon">⚠️</span>
          <div className="notice-content">
            <strong>Requires webhook server on port 3001</strong>
            <p>
              This mode sends HTTP requests to the webhook endpoint. Ensure the correlation server 
              is running (<code>npm run server</code>) to receive and process webhooks.
              For testing without a server, use <strong>Single Run</strong> mode instead.
            </p>
          </div>
        </div>
        
        {/* Webhook URL (read-only) */}
        <div className="webhook-url-display">
          <label>Endpoint</label>
          <code>{webhookUrl}</code>
        </div>
        
        {/* Rate Mode Selection */}
        <div className="webhook-rate-mode">
          <label>Rate Mode</label>
          <div className="rate-mode-buttons">
            <button
              type="button"
              className={`rate-mode-btn ${config.rate.mode === 'fixed' ? 'active' : ''}`}
              onClick={() => handleModeChange('fixed')}
              disabled={disabled}
            >
              Fixed
            </button>
            <button
              type="button"
              className={`rate-mode-btn ${config.rate.mode === 'ramp' ? 'active' : ''}`}
              onClick={() => handleModeChange('ramp')}
              disabled={disabled}
            >
              Ramp
            </button>
            <button
              type="button"
              className={`rate-mode-btn ${config.rate.mode === 'burst' ? 'active' : ''}`}
              onClick={() => handleModeChange('burst')}
              disabled={disabled}
            >
              Burst
            </button>
          </div>
        </div>
        
        {/* Rate Configuration */}
        <div className="webhook-rate-config">
          {config.rate.mode === 'fixed' && (
            <>
              <div className="rate-field">
                <label>Requests/sec</label>
                <input
                  type="number"
                  min={1}
                  max={1000}
                  value={config.rate.rps || 10}
                  onChange={(e) => updateRate({ rps: Math.max(1, parseInt(e.target.value) || 10) })}
                  disabled={disabled}
                />
              </div>
              <div className="rate-field">
                <label>Duration (sec)</label>
                <input
                  type="number"
                  min={1}
                  max={3600}
                  value={config.rate.durationSec || 60}
                  onChange={(e) => updateRate({ durationSec: Math.max(1, parseInt(e.target.value) || 60) })}
                  disabled={disabled}
                />
              </div>
            </>
          )}
          
          {config.rate.mode === 'ramp' && (
            <>
              <div className="rate-field">
                <label>Start RPS</label>
                <input
                  type="number"
                  min={1}
                  max={1000}
                  value={config.rate.rps || 1}
                  onChange={(e) => updateRate({ rps: Math.max(1, parseInt(e.target.value) || 1) })}
                  disabled={disabled}
                />
              </div>
              <div className="rate-field">
                <label>End RPS</label>
                <input
                  type="number"
                  min={1}
                  max={1000}
                  value={config.rate.endRps || 50}
                  onChange={(e) => updateRate({ endRps: Math.max(1, parseInt(e.target.value) || 50) })}
                  disabled={disabled}
                />
              </div>
              <div className="rate-field">
                <label>Duration (sec)</label>
                <input
                  type="number"
                  min={1}
                  max={3600}
                  value={config.rate.durationSec || 120}
                  onChange={(e) => updateRate({ durationSec: Math.max(1, parseInt(e.target.value) || 120) })}
                  disabled={disabled}
                />
              </div>
            </>
          )}
          
          {config.rate.mode === 'burst' && (
            <div className="rate-field">
              <label>Total Requests</label>
              <input
                type="number"
                min={1}
                max={10000}
                value={config.rate.burstCount || 100}
                onChange={(e) => updateRate({ burstCount: Math.max(1, parseInt(e.target.value) || 100) })}
                disabled={disabled}
              />
            </div>
          )}
        </div>
        
        {/* Estimated Total */}
        <div className="webhook-total-estimate">
          <span className="estimate-label">Estimated total:</span>
          <span className="estimate-value">{totalRequests.toLocaleString()} requests</span>
          {config.rate.mode !== 'burst' && (
            <span className="estimate-duration">
              over {config.rate.durationSec || 60}s
            </span>
          )}
        </div>
      </div>
      
      {/* Payload Template */}
      <div className="config-section">
        <div className="config-section-header">
          <span className="config-section-icon">📝</span>
          <h3>Payload Template</h3>
          <div className="config-section-actions">
            <button
              type="button"
              className="cat-btn-sm"
              onClick={() => setShowGenerators(!showGenerators)}
              disabled={disabled}
            >
              {showGenerators ? 'Hide' : 'Show'} Generators
            </button>
            <button
              type="button"
              className="cat-btn-sm"
              onClick={resetPayload}
              disabled={disabled}
              title="Reset to sample payload from workflow"
            >
              Reset
            </button>
          </div>
        </div>
        
        {/* Generator Reference */}
        {showGenerators && (
          <div className="generator-reference">
            <div className="generator-list">
              {generators.map((gen) => (
                <button
                  key={gen.name}
                  type="button"
                  className="generator-chip"
                  onClick={() => insertGenerator(gen.syntax)}
                  disabled={disabled}
                  title={`${gen.description}\nExample: ${gen.example}`}
                >
                  <code>{gen.syntax}</code>
                </button>
              ))}
            </div>
            <p className="generator-hint">
              Click a generator to insert at cursor position
            </p>
          </div>
        )}
        
        {/* Payload Editor */}
        <textarea
          className="webhook-payload-editor"
          value={config.payloadTemplate}
          onChange={(e) => onChange({ ...config, payloadTemplate: e.target.value })}
          disabled={disabled}
          rows={10}
          placeholder='{"event": "example", "id": "{{$uuid}}"}'
          spellCheck={false}
        />
        
        {/* Validation Errors */}
        {templateErrors.length > 0 && (
          <div className="payload-errors">
            {templateErrors.map((err, i) => (
              <div key={i} className="payload-error">{err}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
