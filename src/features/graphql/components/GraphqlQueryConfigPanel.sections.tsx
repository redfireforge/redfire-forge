import { CustomSelect } from '@shared/components/CustomSelect';
import type { GraphqlAuth } from '@shared/types/graphql';
import type { WorkflowVariableHint } from '../../workflow/utils/workflowVariableHints';
import { useListCrud } from '@shared/hooks/useListCrud';
import InsertVarField from '../../workflow/components/expression/InsertVarField';
import ExpressionInput from '../../workflow/components/expression/ExpressionInput';
import type { GraphqlNodeHeaderRow } from '../../workflow/types/workflow';
import {
  GqlWfFormRow,
} from './GraphqlWfConfigLayout';

export interface GqlHeadersSectionProps {
  headers: GraphqlNodeHeaderRow[];
  headerCrud: ReturnType<typeof useListCrud<GraphqlNodeHeaderRow>>;
  onAdd: () => void;
  variableHints: WorkflowVariableHint[];
  onRequestVariableInsert?: (apply: (snippet: string) => void) => void;
}

export function GqlHeadersSection({
  headers,
  headerCrud,
  onAdd,
  variableHints,
  onRequestVariableInsert,
}: GqlHeadersSectionProps) {
  return (
    <div className="gql-wf-headers" data-testid="gql-wf-headers-section">
      <div className="gql-wf-section-toolbar">
        <div className="gql-wf-section-toolbar-text">
          <h4 className="gql-wf-section-title">Request Headers</h4>
          <p className="gql-wf-section-subtitle">
            Sent with the GraphQL HTTP request. Use <code>{'{{variable}}'}</code> in values for
            workflow or upstream data.
          </p>
        </div>
        <div className="gql-wf-section-toolbar-actions">
          <button
            type="button"
            className="btn btn-sm gql-wf-section-add-btn"
            onClick={onAdd}
            data-testid="gql-wf-headers-add-btn"
          >
            + Add header
          </button>
        </div>
      </div>

      {headers.length === 0 ? (
        <div className="gql-wf-headers-empty">
          <span>No headers yet.</span>
          <span>
            Click <strong>+ Add header</strong> to send custom HTTP headers with the request.
          </span>
        </div>
      ) : (
        <div className="gql-wf-headers-table" role="table" aria-label="Request headers">
          <div className="gql-wf-headers-col-headers" aria-hidden="true">
            <span className="gql-wf-headers-col gql-wf-headers-col-toggle">On</span>
            <span className="gql-wf-headers-col gql-wf-headers-col-key">Name</span>
            <span className="gql-wf-headers-col gql-wf-headers-col-value">Value</span>
            <span className="gql-wf-headers-col gql-wf-headers-col-del" />
          </div>
          <div className="gql-wf-headers-list">
            {headers.map((row, index) => (
              <div key={row.id} className="gql-wf-headers-row">
                <div className="gql-wf-headers-col gql-wf-headers-col-toggle">
                  <input
                    type="checkbox"
                    checked={row.enabled}
                    onChange={(e) => headerCrud.update(index, { enabled: e.target.checked })}
                    aria-label={`Enable header ${row.key || index + 1}`}
                  />
                </div>
                <div className="gql-wf-headers-col gql-wf-headers-col-key">
                  <input
                    value={row.key}
                    placeholder="Header name"
                    onChange={(e) => headerCrud.update(index, { key: e.target.value })}
                    data-testid="gql-wf-header-key"
                    spellCheck={false}
                    aria-label={`Header name ${index + 1}`}
                  />
                </div>
                <div className="gql-wf-headers-col gql-wf-headers-col-value">
                  <InsertVarField
                    onRequestVariableInsert={onRequestVariableInsert}
                    shortRef
                    onInsert={(snippet) => headerCrud.update(index, { value: `${row.value}${snippet}` })}
                  >
                    <ExpressionInput
                      value={row.value}
                      onChange={(value) => headerCrud.update(index, { value })}
                      placeholder="value or {{variable}}"
                      variableHints={variableHints}
                    />
                  </InsertVarField>
                </div>
                <div className="gql-wf-headers-col gql-wf-headers-col-del">
                  <button
                    type="button"
                    className="btn btn-sm btn-danger"
                    onClick={() => headerCrud.remove(index)}
                    aria-label={`Remove header ${row.key || index + 1}`}
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function GqlAuthSection({
  auth,
  onChange,
  variableHints,
  onRequestVariableInsert,
}: {
  auth?: GraphqlAuth;
  onChange: (auth: GraphqlAuth | undefined) => void;
  variableHints: WorkflowVariableHint[];
  onRequestVariableInsert?: (apply: (snippet: string) => void) => void;
}) {
  const type = auth?.type ?? 'none';
  const update = (patch: Partial<GraphqlAuth>) =>
    onChange({ ...auth, type: type as GraphqlAuth['type'], ...patch } as GraphqlAuth);

  const setType = (newType: string) => {
    if (newType === 'none') { onChange(undefined); return; }
    onChange({ ...auth, type: newType as GraphqlAuth['type'] });
  };

  const authTypeOptions = [
    { value: 'none', label: 'None' },
    { value: 'inherit', label: 'Inherited' },
    { value: 'bearer', label: 'Bearer token' },
    { value: 'basic', label: 'Basic auth' },
    { value: 'apiKey', label: 'API key' },
    { value: 'custom', label: 'Custom header' },
    ...(type === 'oauth2'
      ? [{ value: 'oauth2', label: 'OAuth 2.0 (not yet supported)', disabled: true }]
      : []),
  ];

  const credentialRows = type !== 'none';

  return (
    <div className="gql-wf-auth-section" data-testid="gql-wf-auth-section">
      <GqlWfFormRow label="Auth type" last={!credentialRows}>
        <CustomSelect
          className="gql-wf-auth-type-select"
          value={type}
          onChange={(v) => setType(v)}
          options={[...authTypeOptions]}
          data-testid="gql-wf-auth-type-select"
          aria-label="Auth type"
          size="sm"
        />
        {type === 'none' && (
          <span className="gql-wf-inline-hint">
            No credentials — use when the endpoint is public or auth is handled elsewhere.
          </span>
        )}
      </GqlWfFormRow>

      {type === 'bearer' && (
        <GqlWfFormRow label="Token" last>
          <InsertVarField
            onRequestVariableInsert={onRequestVariableInsert}
            shortRef
            onInsert={(snippet) => update({ token: `${auth?.token ?? ''}${snippet}` })}
          >
            <ExpressionInput
              value={auth?.token ?? ''}
              onChange={(value) => update({ token: value })}
              placeholder="{{authToken}}"
              variableHints={variableHints}
            />
          </InsertVarField>
        </GqlWfFormRow>
      )}

      {type === 'basic' && (
        <>
          <GqlWfFormRow label="Username">
            <ExpressionInput
              value={auth?.username ?? ''}
              onChange={(value) => update({ username: value })}
              placeholder="user"
              variableHints={variableHints}
            />
          </GqlWfFormRow>
          <GqlWfFormRow label="Password" last>
            <input
              type="password"
              value={auth?.password ?? ''}
              onChange={(e) => update({ password: e.target.value })}
              placeholder="••••"
              data-testid="gql-wf-auth-password"
            />
          </GqlWfFormRow>
        </>
      )}

      {(type === 'apiKey' || type === 'custom') && (
        <>
          <GqlWfFormRow label="Header name">
            <input
              value={auth?.headerName ?? ''}
              onChange={(e) => update({ headerName: e.target.value })}
              placeholder={type === 'apiKey' ? 'X-API-Key' : 'X-Custom-Header'}
              data-testid="gql-wf-auth-header-name"
            />
          </GqlWfFormRow>
          <GqlWfFormRow label="Header value" last>
            <InsertVarField
              onRequestVariableInsert={onRequestVariableInsert}
              shortRef
              onInsert={(snippet) => update({ headerValue: `${auth?.headerValue ?? ''}${snippet}` })}
            >
              <ExpressionInput
                value={auth?.headerValue ?? ''}
                onChange={(value) => update({ headerValue: value })}
                placeholder="{{apiKey}}"
                variableHints={variableHints}
              />
            </InsertVarField>
          </GqlWfFormRow>
        </>
      )}

      {type === 'inherit' && (
        <GqlWfFormRow label="Inherited profile" last>
          <span className="gql-wf-inline-hint">Uses the currently selected global auth profile.</span>
        </GqlWfFormRow>
      )}

      {type === 'oauth2' && (
        <GqlWfFormRow label="OAuth2" last>
          <span className="gql-wf-inline-hint">OAuth 2.0 is not yet supported in this panel.</span>
        </GqlWfFormRow>
      )}
    </div>
  );
}