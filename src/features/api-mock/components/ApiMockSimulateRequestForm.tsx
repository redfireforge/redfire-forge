import type { RefObject } from 'react';
import { CustomSelect } from '../../../shared/components/CustomSelect';
import { ApiMockExpandableText } from './ApiMockExpandableText';
import { SIMULATE_METHOD_OPTIONS, SIMULATE_SEED_HELP } from './apiMockSimulateModalHelpers';

export function ApiMockSimulateHiddenFields({
  method,
  setMethod,
  path,
  setPath,
  headers,
  setHeaders,
  body,
  setBody,
  clientCertSubject,
  setClientCertSubject,
  seed,
  setSeed,
}: {
  method: string;
  setMethod: (value: string) => void;
  path: string;
  setPath: (value: string) => void;
  headers: string;
  setHeaders: (value: string) => void;
  body: string;
  setBody: (value: string) => void;
  clientCertSubject: string;
  setClientCertSubject: (value: string) => void;
  seed: string;
  setSeed: (value: string) => void;
}) {
  return (
    <div className="am-sr-only">
      <CustomSelect value={method} onChange={setMethod} options={SIMULATE_METHOD_OPTIONS} className="am-cs" aria-label="Simulate method" data-testid="api-mock-simulate-method" />
      <input value={path} onChange={e => setPath(e.target.value)} data-testid="api-mock-simulate-path" />
      <textarea value={headers} onChange={e => setHeaders(e.target.value)} data-testid="api-mock-simulate-headers" />
      <textarea value={body} onChange={e => setBody(e.target.value)} data-testid="api-mock-simulate-body" />
      <input value={clientCertSubject} onChange={e => setClientCertSubject(e.target.value)} data-testid="api-mock-simulate-cert-subject" />
      <input value={seed} onChange={e => setSeed(e.target.value || '0')} aria-label="Replay seed" data-testid="api-mock-simulate-seed" />
    </div>
  );
}

export function ApiMockSimulateRequestForm({
  method,
  setMethod,
  path,
  setPath,
  headers,
  setHeaders,
  body,
  setBody,
  clientCertSubject,
  setClientCertSubject,
  seed,
  setSeed,
  requestReadOnly,
  selectedIsAdHoc,
  selectedIsFromRules,
  selectedName,
  nameInputRef,
  onSaveAsSample,
  onRenameSavedSample,
  onEditInAdhoc,
}: {
  method: string;
  setMethod: (value: string) => void;
  path: string;
  setPath: (value: string) => void;
  headers: string;
  setHeaders: (value: string) => void;
  body: string;
  setBody: (value: string) => void;
  clientCertSubject: string;
  setClientCertSubject: (value: string) => void;
  seed: string;
  setSeed: (value: string) => void;
  requestReadOnly: boolean;
  selectedIsAdHoc: boolean;
  selectedIsFromRules: boolean;
  selectedName?: string;
  nameInputRef: RefObject<HTMLInputElement | null>;
  onSaveAsSample: () => void;
  onRenameSavedSample: (name: string) => void;
  onEditInAdhoc: () => void;
}) {
  return (
    <div className={`am-form-grid am-sim-adhoc-form${requestReadOnly ? ' am-sim-adhoc-form--readonly' : ''}`}>
      <div className="am-form-row">
        <div className="am-form-label">Method</div>
        <div className="am-form-control">
          <CustomSelect
            value={method}
            onChange={setMethod}
            options={SIMULATE_METHOD_OPTIONS}
            className="am-cs"
            aria-label="Simulate method"
            data-testid="api-mock-simulate-method"
            disabled={requestReadOnly}
          />
        </div>
      </div>
      <div className="am-form-row">
        <div className="am-form-label">Path</div>
        <div className="am-form-control">
          <input
            className="am-input wide mono"
            value={path}
            onChange={e => setPath(e.target.value)}
            placeholder="/users/42?active=true"
            data-testid="api-mock-simulate-path"
            readOnly={requestReadOnly}
          />
        </div>
      </div>
      <div className="am-form-row am-form-row--tall">
        <div className="am-form-label">Headers</div>
        <div className="am-form-control">
          <ApiMockExpandableText
            label="Request headers"
            value={headers}
            onChange={setHeaders}
            placeholder={'X-Tenant: acme\nAuthorization: Bearer …'}
            testId="api-mock-simulate-headers"
            multiline
            className="am-textarea--compact"
            readOnly={requestReadOnly}
            variant="headers"
          />
        </div>
      </div>
      <div className="am-form-row am-form-row--tall">
        <div className="am-form-label">Body</div>
        <div className="am-form-control">
          <ApiMockExpandableText
            label="Request body"
            value={body}
            onChange={setBody}
            placeholder='{"name":"Alice"}'
            testId="api-mock-simulate-body"
            multiline
            className="am-textarea--compact"
            readOnly={requestReadOnly}
          />
        </div>
      </div>
      <div className="am-form-row">
        <div className="am-form-label">Client cert subject</div>
        <div className="am-form-control">
          <input
            className="am-input wide mono"
            value={clientCertSubject}
            onChange={e => setClientCertSubject(e.target.value)}
            placeholder="CN=client-name"
            aria-label="Simulate client certificate subject"
            data-testid="api-mock-simulate-cert-subject"
            readOnly={requestReadOnly}
          />
        </div>
      </div>
      {selectedIsAdHoc ? (
        <div className="am-form-row">
          <div className="am-form-label">Keep this request</div>
          <div className="am-form-control am-form-control-stack">
            <button
              type="button"
              className="am-btn primary"
              onClick={onSaveAsSample}
              data-testid="api-mock-simulate-save-sample"
            >
              Save as sample
            </button>
            <span className="am-hint">Stores method, path, headers, and body under Saved samples. Name it after saving.</span>
          </div>
        </div>
      ) : (
        <>
          {!selectedIsFromRules && (
            <div className="am-form-row">
              <div className="am-form-label">Sample name</div>
              <div className="am-form-control">
                <input
                  ref={nameInputRef}
                  className="am-input wide"
                  value={selectedName ?? ''}
                  onChange={e => onRenameSavedSample(e.target.value)}
                  placeholder="Health check — happy path"
                  aria-label="Sample name"
                  data-testid="api-mock-simulate-sample-name"
                />
              </div>
            </div>
          )}
          <div className="am-form-row">
            <div className="am-form-label">Change this request</div>
            <div className="am-form-control am-form-control-stack">
              <button
                type="button"
                className="am-btn primary"
                onClick={onEditInAdhoc}
                data-testid="api-mock-sim-edit-adhoc"
              >
                Edit in Ad-hoc
              </button>
              <span className="am-hint">Copies this probe into the scratch pad so you can change method, path, or headers.</span>
            </div>
          </div>
        </>
      )}
      <div className="am-form-row am-form-row--tall">
        <div className="am-form-label">Replay seed</div>
        <div className="am-form-control am-form-control-stack">
          <label className="am-seed-field">
            <input
              className="am-input mono"
              value={seed}
              onChange={e => setSeed(e.target.value || '0')}
              aria-label="Replay seed"
              title={SIMULATE_SEED_HELP}
              data-testid="api-mock-simulate-seed"
            />
          </label>
          <span className="am-hint">{SIMULATE_SEED_HELP}</span>
        </div>
      </div>
    </div>
  );
}
