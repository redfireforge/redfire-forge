import type {
  ApiMockSimulationResultV1,
  ApiMockSimulationSampleV1,
  ApiMockTransactionOutcome,
} from '../../../shared/api-mock/contracts';

type Expected = NonNullable<ApiMockSimulationSampleV1['expected']>;

interface Props {
  expected?: Expected;
  result: ApiMockSimulationResultV1;
  winnerId?: string;
  canEdit: boolean;
  onPatchExpected?: (patch: Partial<Expected>) => void;
}

function resultBadge(ok: boolean | undefined, label: string) {
  if (ok == null) return <span className="am-badge">{label}</span>;
  return (
    <span
      className={`am-badge ${ok ? 'success' : 'danger'}`}
      data-testid={ok ? undefined : 'api-mock-sim-assert-fail'}
    >
      {ok ? 'Pass' : 'Fail'}
    </span>
  );
}

function parseStatus(raw: string): number | undefined {
  const n = Number(raw);
  if (raw === '' || !Number.isInteger(n) || n < 0 || n > 599) return undefined;
  return n;
}

export function ApiMockSimulateAssertionsTable({
  expected,
  result,
  winnerId,
  canEdit,
  onPatchExpected,
}: Props) {
  const body = result.renderedResponse?.body ?? '';
  const actualStatus = result.preview?.httpCompleted === false
    ? undefined
    : result.renderedResponse?.status;

  const patch = (next: Partial<Expected>) => {
    onPatchExpected?.({
      outcome: (expected?.outcome ?? result.outcome) as ApiMockTransactionOutcome,
      ...expected,
      ...next,
    });
  };

  return (
    <table className="am-data-table" aria-label="Simulation assertions" data-testid="api-mock-sim-assertions">
      <thead>
        <tr><th>Expectation</th><th>Expected</th><th>Actual</th><th>Result</th></tr>
      </thead>
      <tbody>
        <tr data-testid="api-mock-sim-assert-row-outcome">
          <td>Outcome</td>
          <td>{expected?.outcome ?? '—'}</td>
          <td>{result.outcome}</td>
          <td>{resultBadge(expected?.outcome ? expected.outcome === result.outcome : undefined, '—')}</td>
        </tr>
        <tr>
          <td>Rule</td>
          <td>{expected?.routeId ?? '—'}</td>
          <td>{winnerId ?? '—'}</td>
          <td>{resultBadge(expected?.routeId ? expected.routeId === winnerId : undefined, '—')}</td>
        </tr>
        <tr>
          <td>Response</td>
          <td>{expected?.responseId ?? '—'}</td>
          <td>{result.preview?.selectedResponseId ?? '—'}</td>
          <td>{resultBadge(expected?.responseId ? expected.responseId === result.preview?.selectedResponseId : undefined, '—')}</td>
        </tr>
        <tr data-testid="api-mock-sim-assert-row-status">
          <td>Status</td>
          <td>
            {canEdit ? (
              <input
                className="am-input"
                type="number"
                min={0}
                max={599}
                placeholder="—"
                value={expected?.status ?? ''}
                aria-label="Expected status"
                data-testid="api-mock-sim-assert-status"
                onChange={e => patch({ status: parseStatus(e.target.value) })}
              />
            ) : (expected?.status ?? '—')}
          </td>
          <td>{actualStatus ?? '—'}</td>
          <td>{resultBadge(expected?.status == null ? undefined : expected.status === actualStatus, '—')}</td>
        </tr>
        <tr data-testid="api-mock-sim-assert-row-body">
          <td>Body contains</td>
          <td>
            {canEdit ? (
              <input
                className="am-input"
                placeholder="optional substring"
                value={expected?.bodyContains ?? ''}
                aria-label="Expected body contains"
                data-testid="api-mock-sim-assert-body"
                onChange={e => patch({ bodyContains: e.target.value || undefined })}
              />
            ) : (expected?.bodyContains ?? '—')}
          </td>
          <td>{expected?.bodyContains ? (body.includes(expected.bodyContains) ? 'yes' : 'no') : '—'}</td>
          <td>{resultBadge(expected?.bodyContains == null ? undefined : body.includes(expected.bodyContains), '—')}</td>
        </tr>
        <tr>
          <td>Body exact</td>
          <td>{expected?.bodyExact ?? '—'}</td>
          <td>{expected?.bodyExact == null ? '—' : (body === expected.bodyExact ? 'yes' : 'no')}</td>
          <td>{resultBadge(expected?.bodyExact == null ? undefined : body === expected.bodyExact, '—')}</td>
        </tr>
        <tr>
          <td>Fault</td>
          <td>—</td>
          <td>{result.preview?.fault ?? 'none'}</td>
          <td>{resultBadge(undefined, '—')}</td>
        </tr>
        <tr>
          <td>Virtual delay</td>
          <td>—</td>
          <td>{result.preview?.virtualDelayMs ?? 0} ms</td>
          <td>{resultBadge(undefined, '—')}</td>
        </tr>
      </tbody>
    </table>
  );
}
