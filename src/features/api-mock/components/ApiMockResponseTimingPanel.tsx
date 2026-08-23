import type { ApiMockResponseVariantV1 } from '@shared/api-mock/contracts';
import { formatEligibilitySummary, formatTimingSpread } from '../apiMockExpiresFormat';
import { ApiMockResponseExpiresPicker } from './ApiMockResponseExpiresPicker';

/** Timing tab: delay, jitter, eligibility, and expiry. */

interface Props {
  variant: ApiMockResponseVariantV1;
  onUpdateVariant: (patch: Partial<ApiMockResponseVariantV1>) => void;
}

export function ApiMockResponseTimingPanel({ variant, onUpdateVariant }: Props) {
  return (
    <div className="am-form-grid am-form-grid--aligned" data-testid="api-mock-timing-panel">
      <div className="am-form-row">
        <div className="am-form-label">Delay (ms)</div>
        <div className="am-form-control">
          <input
            className="am-input num mono"
            type="number"
            value={variant.behavior.delayMs}
            onChange={e => onUpdateVariant({
              behavior: { ...variant.behavior, delayMs: parseInt(e.target.value, 10) || 0 },
            })}
            data-testid="api-mock-variant-delay"
          />
          <span className="am-hint">Fixed latency before the response is sent</span>
        </div>
      </div>
      <div className="am-form-row">
        <div className="am-form-label">Jitter (ms)</div>
        <div className="am-form-control">
          <input
            className="am-input num mono"
            type="number"
            value={variant.behavior.jitterMs}
            onChange={e => onUpdateVariant({
              behavior: { ...variant.behavior, jitterMs: parseInt(e.target.value, 10) || 0 },
            })}
            data-testid="api-mock-variant-jitter"
          />
          <span className="am-hint">± random added to delay</span>
        </div>
      </div>
      <div className="am-form-row">
        <div className="am-form-label">Spread</div>
        <div className="am-form-control">
          <span className="am-hint" data-testid="api-mock-timing-spread">
            {formatTimingSpread(variant.behavior.delayMs, variant.behavior.jitterMs)}
          </span>
        </div>
      </div>
      <div className="am-form-row">
        <div className="am-form-label">Match limit</div>
        <div className="am-form-control">
          <input
            className="am-input num mono"
            type="number"
            min={0}
            placeholder="∞"
            value={variant.behavior.maxMatches ?? ''}
            onChange={e => {
              const raw = e.target.value.trim();
              onUpdateVariant({
                behavior: {
                  ...variant.behavior,
                  maxMatches: raw === '' ? undefined : Math.max(0, parseInt(raw, 10) || 0),
                },
              });
            }}
            data-testid="api-mock-variant-max-matches"
          />
          <span className="am-hint">Disable after N successful matches (empty = unlimited)</span>
        </div>
      </div>
      <div className="am-form-row">
        <div className="am-form-label">Expires at</div>
        <div className="am-form-control">
          <ApiMockResponseExpiresPicker
            value={variant.behavior.expiresAt}
            onChange={iso => onUpdateVariant({
              behavior: { ...variant.behavior, expiresAt: iso },
            })}
          />
        </div>
      </div>
      <div className="am-form-row">
        <div className="am-form-label">Probability</div>
        <div className="am-form-control">
          <input
            className="am-input num mono"
            type="number"
            min={0}
            max={1}
            step={0.05}
            placeholder="1"
            value={variant.behavior.probability ?? ''}
            onChange={e => {
              const raw = e.target.value.trim();
              const n = raw === '' ? undefined : Math.min(1, Math.max(0, Number(raw)));
              onUpdateVariant({
                behavior: { ...variant.behavior, probability: n },
              });
            }}
            data-testid="api-mock-variant-probability"
          />
          <span className="am-hint">0–1 gate; empty = always eligible</span>
        </div>
      </div>
      <div className="am-form-row">
        <div className="am-form-label">Eligibility</div>
        <div className="am-form-control">
          <span className="am-hint" data-testid="api-mock-eligibility-summary">
            {formatEligibilitySummary(variant.behavior)}
          </span>
        </div>
      </div>
    </div>
  );
}
