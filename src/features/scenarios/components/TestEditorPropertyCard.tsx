import type { Scenario, ScenarioActionType } from '../../../shared/types';

const TRANSPORT_GROUPS: { label: string; options: { value: ScenarioActionType; label: string }[] }[] = [
  { label: 'HTTP', options: [{ value: 'http', label: 'HTTP' }] },
  { label: 'WebSocket', options: [{ value: 'wsConnect', label: 'WS Connect' }, { value: 'wsSend', label: 'WS Send' }, { value: 'wsReceive', label: 'WS Receive' }] },
  { label: 'Kafka', options: [{ value: 'kafkaProduce', label: 'Kafka Produce' }, { value: 'kafkaConsume', label: 'Kafka Consume' }] },
];

const TRANSPORT_LABEL_MAP: Record<string, string> = Object.fromEntries(
  TRANSPORT_GROUPS.flatMap(g => g.options.map(o => [o.value, o.label])),
);

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;

export interface TestEditorPropertyCardProps {
  draft: Scenario;
  onDraftChange: (draft: Scenario) => void;
  effectiveTransport: ScenarioActionType;
  isHttp: boolean;
  transportDropOpen: boolean;
  setTransportDropOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  transportDropRef: React.RefObject<HTMLDivElement | null>;
  handleTransportChange: (actionType: ScenarioActionType) => void;
  methodDropOpen: boolean;
  setMethodDropOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  methodDropRef: React.RefObject<HTMLDivElement | null>;
  baseUrl: string;
  handleBaseUrlChange: (newBaseUrl: string) => void;
  resolvedBaseUrl: string;
  displayUrl: string;
}

export default function TestEditorPropertyCard({
  draft,
  onDraftChange,
  effectiveTransport,
  isHttp,
  transportDropOpen,
  setTransportDropOpen,
  transportDropRef,
  handleTransportChange,
  methodDropOpen,
  setMethodDropOpen,
  methodDropRef,
  baseUrl,
  handleBaseUrlChange,
  resolvedBaseUrl,
  displayUrl,
}: TestEditorPropertyCardProps) {
  return (
    <div className="te-prop-card">
      <div className="te-prop-row">
        <div className="te-prop-label">Name</div>
        <div className="te-prop-ctrl">
          <input data-testid="te-name-input" value={draft.name} onChange={(e) => onDraftChange({ ...draft, name: e.target.value })} placeholder="e.g. Get User Profile" />
        </div>
      </div>

      <div className="te-prop-row">
        <div className="te-prop-label">Transport</div>
        <div className="te-prop-ctrl">
          <div className="te-dropdown-wrapper" ref={transportDropRef}>
            <button
              type="button"
              className="te-dropdown-trigger"
              aria-label="Transport type"
              onClick={() => setTransportDropOpen(o => !o)}
            >
              <span>{TRANSPORT_LABEL_MAP[effectiveTransport] ?? effectiveTransport}</span>
              <span className="te-dropdown-arrow">{transportDropOpen ? '▲' : '▼'}</span>
            </button>
            {transportDropOpen && (
              <div className="te-dropdown-menu">
                {TRANSPORT_GROUPS.map(g => (
                  <div key={g.label} className="te-dropdown-group">
                    <span className="te-dropdown-group-label">{g.label}</span>
                    {g.options.map(o => (
                      <button
                        key={o.value}
                        type="button"
                        className={`te-dropdown-item ${effectiveTransport === o.value ? 'active' : ''}`}
                        onClick={() => { handleTransportChange(o.value); setTransportDropOpen(false); }}
                      >
                        {o.label}
                        {effectiveTransport === o.value && <span className="te-dropdown-check">✓</span>}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {isHttp && (
        <>
          <div className="te-prop-row">
            <div className="te-prop-label">URL</div>
            <div className="te-prop-ctrl te-prop-ctrl--url">
              <div className="te-method-wrapper" ref={methodDropRef}>
                <button
                  type="button"
                  className={`te-method-trigger method-color-${draft.method.toLowerCase()}`}
                  onClick={() => setMethodDropOpen(o => !o)}
                  aria-label="HTTP method"
                >
                  {draft.method}
                  <span className="te-dropdown-arrow">{methodDropOpen ? '▲' : '▼'}</span>
                </button>
                {methodDropOpen && (
                  <div className="te-dropdown-menu te-method-menu">
                    {HTTP_METHODS.map(m => (
                      <button
                        key={m}
                        type="button"
                        className={`te-dropdown-item method-color-${m.toLowerCase()} ${draft.method === m ? 'active' : ''}`}
                        onClick={() => { onDraftChange({ ...draft, method: m as Scenario['method'] }); setMethodDropOpen(false); }}
                      >
                        {m}
                        {draft.method === m && <span className="te-dropdown-check">✓</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <input
                className="url-input"
                value={baseUrl}
                onChange={(e) => handleBaseUrlChange(e.target.value)}
                placeholder={resolvedBaseUrl ? `${resolvedBaseUrl}/...` : 'https://api.example.com/endpoint'}
              />
              {resolvedBaseUrl && !draft.url && (
                <button type="button" className="btn btn-sm url-fill-btn" onClick={() => handleBaseUrlChange(resolvedBaseUrl)} title="Use resolved base URL">Use</button>
              )}
            </div>
          </div>

          {draft.url && (
            <div className="te-prop-row">
              <div className="te-prop-label">URL Preview</div>
              <div className="te-prop-ctrl">
                <code className="te-url-preview-code">{displayUrl}</code>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
