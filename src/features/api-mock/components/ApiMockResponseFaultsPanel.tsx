import type { ApiMockFaultKind, ApiMockResponseVariantV1 } from '@shared/api-mock/contracts';
import { clampTimeoutHoldMs, DEFAULT_SETTINGS } from '@shared/api-mock/defaults';
import { FAULT_CARDS } from './apiMockResponseEditorConstants';

interface Props {
  variant: ApiMockResponseVariantV1;
  onUpdateVariant: (patch: Partial<ApiMockResponseVariantV1>) => void;
  /** Server-wide Timeout hold ceiling (`settings.limits.longRunningMaxMs`). */
  timeoutHoldMaxMs?: number;
}

function nextFaultBehavior(
  variant: ApiMockResponseVariantV1,
  cardId: ApiMockFaultKind,
  timeoutHoldMaxMs: number,
) {
  const next = {
    ...variant.behavior,
    fault: cardId === 'none' ? undefined : cardId,
    ...(cardId === 'dribble' && !variant.behavior.chunkSchedule?.length
      ? { chunkSchedule: [{ afterMs: 50, body: (variant.body.content ?? '').slice(0, 8) || '…' }, { afterMs: 100, body: '' }] }
      : cardId !== 'dribble' ? { chunkSchedule: undefined } : {}),
  };
  if (cardId === 'timeout') {
    next.longRunningMs = clampTimeoutHoldMs(variant.behavior.longRunningMs, timeoutHoldMaxMs);
  }
  return next;
}

export function ApiMockResponseFaultsPanel({
  variant,
  onUpdateVariant,
  timeoutHoldMaxMs = DEFAULT_SETTINGS.limits.longRunningMaxMs,
}: Props) {
  const cap = timeoutHoldMaxMs > 0 ? timeoutHoldMaxMs : DEFAULT_SETTINGS.limits.longRunningMaxMs;
  const timeoutSelected = (variant.behavior.fault ?? 'none') === 'timeout';
  const holdMs = clampTimeoutHoldMs(variant.behavior.longRunningMs, cap);

  return (
    <div data-testid="api-mock-faults-panel">
      <div className="am-notice warning" style={{ marginBottom: 12 }}>
        <span>Faults operate at connection level on the live listener. Simulation still renders the intended timeline without opening a socket.</span>
      </div>
      <div className="am-fault-grid">
        {FAULT_CARDS.map(card => {
          const selected = (variant.behavior.fault ?? 'none') === card.id;
          return (
            <button
              key={card.id}
              type="button"
              className={`am-fault-card${selected ? ' selected' : ''}`}
              data-testid={`api-mock-fault-${card.id}`}
              onClick={() => onUpdateVariant({ behavior: nextFaultBehavior(variant, card.id, cap) })}
            >
              <strong>{card.title}</strong>
              <p>{card.description}</p>
            </button>
          );
        })}
      </div>
      {timeoutSelected && (
        <div className="am-form-grid am-form-grid--aligned am-timeout-hold" data-testid="api-mock-fault-timeout-hold-panel">
          <div className="am-form-row">
            <div className="am-form-label">Hold for (ms)</div>
            <div className="am-form-control">
              <input
                className="am-input num mono"
                type="number"
                min={1}
                max={cap}
                value={holdMs}
                aria-label="Timeout hold milliseconds"
                data-testid="api-mock-fault-timeout-hold"
                onChange={e => {
                  const raw = parseInt(e.target.value, 10);
                  onUpdateVariant({
                    behavior: {
                      ...variant.behavior,
                      longRunningMs: clampTimeoutHoldMs(Number.isFinite(raw) ? raw : undefined, cap),
                    },
                  });
                }}
              />
              <span className="am-hint">
                Each hung Timeout occupies one connection until this hold ends. Capped at {cap} ms
                (Settings → Network → Limits).
              </span>
            </div>
          </div>
        </div>
      )}
      {(variant.behavior.fault ?? 'none') === 'dribble' && (
        <div className="am-chunk-schedule" data-testid="api-mock-chunk-schedule">
          <div className="am-chunk-schedule-head">
            <span className="am-chunk-schedule-title">Chunk schedule</span>
            <span className="am-spacer" />
            <button
              type="button"
              className="am-btn small"
              data-testid="api-mock-chunk-add"
              onClick={() => onUpdateVariant({
                behavior: {
                  ...variant.behavior,
                  chunkSchedule: [
                    ...(variant.behavior.chunkSchedule ?? []),
                    { afterMs: 50, body: '' },
                  ],
                },
              })}
            >
              + Chunk
            </button>
          </div>
          {(variant.behavior.chunkSchedule ?? []).length > 0 && (
            <div className="am-chunk-table">
              <div className="am-chunk-table-header">
                <span className="am-chunk-col-num">#</span>
                <span className="am-chunk-col-delay">Delay (ms)</span>
                <span className="am-chunk-col-body">Body payload</span>
                <span className="am-chunk-col-remove" />
              </div>
              {(variant.behavior.chunkSchedule ?? []).map((chunk, idx) => (
                <div key={`chunk-${idx}`} className="am-chunk-row" data-testid={`api-mock-chunk-row-${idx}`}>
                  <span className="am-chunk-col-num am-muted">{idx + 1}</span>
                  <div className="am-chunk-col-delay">
                    <input
                      className="am-input num mono"
                      type="number"
                      min={0}
                      aria-label={`Chunk ${idx + 1} delay ms`}
                      value={chunk.afterMs}
                      onChange={e => {
                        const next = [...(variant.behavior.chunkSchedule ?? [])];
                        next[idx] = { ...next[idx], afterMs: Math.max(0, parseInt(e.target.value, 10) || 0) };
                        onUpdateVariant({
                          behavior: { ...variant.behavior, chunkSchedule: next },
                        });
                      }}
                    />
                  </div>
                  <div className="am-chunk-col-body">
                    <input
                      className="am-input mono"
                      aria-label={`Chunk ${idx + 1} body`}
                      value={chunk.body}
                      placeholder="empty delay — no bytes"
                      onChange={e => {
                        const next = [...(variant.behavior.chunkSchedule ?? [])];
                        next[idx] = { ...next[idx], body: e.target.value };
                        onUpdateVariant({
                          behavior: { ...variant.behavior, chunkSchedule: next },
                        });
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    className="am-icon-btn am-chunk-remove"
                    aria-label={`Remove chunk ${idx + 1}`}
                    data-testid={`api-mock-chunk-remove-${idx}`}
                    onClick={() => {
                      const next = (variant.behavior.chunkSchedule ?? []).filter((_, i) => i !== idx);
                      onUpdateVariant({
                        behavior: { ...variant.behavior, chunkSchedule: next.length ? next : undefined },
                      });
                    }}
                  >×</button>
                </div>
              ))}
            </div>
          )}
          {(variant.behavior.chunkSchedule ?? []).length > 0 && (
            <p className="am-hint am-hint--wrap" data-testid="api-mock-chunk-empty-hint">
              An empty payload is a pause with no bytes. End stream does not send the rest of the
              body — paste remaining characters into a later row if you want them on the wire.
              Rendered response shows what hit the wire and the intended body underneath.
            </p>
          )}
          {(variant.behavior.chunkSchedule ?? []).length === 0 && (
            <div className="am-chunk-empty">No chunks defined — runtime splits the body evenly if empty.</div>
          )}
        </div>
      )}
    </div>
  );
}
