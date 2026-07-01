import type { NodeRunStatus } from '../../types/workflow';
import type { GrpcNodeStatusMeta } from '../../types/workflow/node-grpc';
import { grpcStatusLabel } from '../../utils/grpcWorkflowOutputAdapter';

interface Props {
  nodeRunStatus?: NodeRunStatus | null;
}

const STATE_LABELS: Record<string, string> = {
  pass: 'Passed',
  fail: 'Failed',
  running: 'Running',
  skipped: 'Skipped',
  paused: 'Paused',
};

function GrpcMetaSection({ grpcMeta }: { grpcMeta: GrpcNodeStatusMeta }) {
  const isAssert = grpcMeta.callType === 'assert';
  return (
    <div className="wf-output-section">
      <div className="wf-output-section-title">
        {isAssert ? 'Assert' : grpcMeta.callType === 'server_streaming' ? 'Server Stream' : 'Unary'} Details
      </div>
      <div className="wf-output-meta">
        {!isAssert && grpcMeta.grpcStatus !== undefined && (
          <div className="wf-output-meta-item">
            <div className="wf-output-meta-label">gRPC Status</div>
            <div className={`wf-output-meta-value ${grpcMeta.grpcStatus === 0 ? 'wf-output-meta-ok' : 'wf-output-meta-err'}`}>
              {grpcMeta.grpcStatus} {grpcStatusLabel(grpcMeta.grpcStatus)}
              {grpcMeta.grpcStatusMessage ? ` — ${grpcMeta.grpcStatusMessage}` : ''}
            </div>
          </div>
        )}
        {!isAssert && grpcMeta.target && (
          <div className="wf-output-meta-item">
            <div className="wf-output-meta-label">Target</div>
            <div className="wf-output-meta-value wf-output-meta-info wf-config-var-mono">{grpcMeta.target}</div>
          </div>
        )}
        {!isAssert && (
          <div className="wf-output-meta-item">
            <div className="wf-output-meta-label">Method</div>
            <div className="wf-output-meta-value wf-output-meta-info wf-config-var-mono">{grpcMeta.service}/{grpcMeta.method}</div>
          </div>
        )}
        {grpcMeta.callType === 'server_streaming' && grpcMeta.messageCount !== undefined && (
          <div className="wf-output-meta-item">
            <div className="wf-output-meta-label">Messages</div>
            <div className="wf-output-meta-value wf-output-meta-info">{grpcMeta.messageCount}</div>
          </div>
        )}
        {grpcMeta.streamStopReason && (
          <div className="wf-output-meta-item">
            <div className="wf-output-meta-label">Stop reason</div>
            <div className="wf-output-meta-value wf-output-meta-info wf-config-var-mono">{grpcMeta.streamStopReason}</div>
          </div>
        )}
        {grpcMeta.attempts !== undefined && grpcMeta.attempts > 1 && (
          <div className="wf-output-meta-item">
            <div className="wf-output-meta-label">Attempts</div>
            <div className="wf-output-meta-value wf-output-meta-info">{grpcMeta.attempts}</div>
          </div>
        )}
        {isAssert && grpcMeta.target && (
          <div className="wf-output-meta-item">
            <div className="wf-output-meta-label">Source</div>
            <div className="wf-output-meta-value wf-output-meta-info wf-config-var-mono">{grpcMeta.target}</div>
          </div>
        )}
      </div>
      {isAssert && grpcMeta.assertionFailures !== undefined && (
        grpcMeta.assertionFailures.length === 0
          ? (
            <div className="wf-output-section">
              <div className="wf-output-meta-value wf-output-meta-ok" style={{ fontSize: 13, fontWeight: 600 }}>✓ All assertions passed</div>
            </div>
          )
          : (
            <div className="wf-output-section">
              <div className="wf-output-section-title">Assertion Failures</div>
              {grpcMeta.assertionFailures.map((f, i) => (
                <div key={i} className="wf-output-body wf-output-body-err">{f}</div>
              ))}
            </div>
          )
      )}
      {!isAssert && grpcMeta.bodyPreview && (
        <div className="wf-output-section">
          <div className="wf-output-section-title">{grpcMeta.callType === 'server_streaming' ? 'Last Message' : 'Response'}</div>
          <pre className="wf-output-body">{grpcMeta.bodyPreview}</pre>
        </div>
      )}
    </div>
  );
}

export default function NodeConfigOutputTab({ nodeRunStatus }: Props) {
  const hasData = nodeRunStatus && nodeRunStatus.state !== 'idle' && nodeRunStatus.state !== 'pending';

  if (!hasData) {
    return (
      <div className="wf-config-tab-content">
        <div className="wf-config-tab-empty">No execution data yet. Run a Quick Test to see results here.</div>
      </div>
    );
  }

  const isGrpcNode = nodeRunStatus.grpcMeta !== undefined;
  const stateLabel = nodeRunStatus.statusCode
    ? `${nodeRunStatus.statusCode}`
    : STATE_LABELS[nodeRunStatus.state] ?? nodeRunStatus.state;

  return (
    <div className="wf-config-tab-content">
      <div className="wf-output-header">
        <span className="wf-output-label">Last Quick Test</span>
        <span className={`wf-output-status wf-output-status-${nodeRunStatus.state}`}>
          <svg className="wf-inline-icon" viewBox="0 0 24 24" fill="currentColor" stroke="none"><circle cx="12" cy="12" r="6"/></svg> {stateLabel}
        </span>
      </div>
      <div className="wf-output-meta">
        {/* HTTP-style status code — only shown for non-gRPC nodes */}
        {nodeRunStatus.statusCode != null && !isGrpcNode && (
          <div className="wf-output-meta-item">
            <div className="wf-output-meta-label">Status</div>
            <div className={`wf-output-meta-value ${nodeRunStatus.statusCode < 400 ? 'wf-output-meta-ok' : 'wf-output-meta-err'}`}>{nodeRunStatus.statusCode}</div>
          </div>
        )}
        {nodeRunStatus.responseTimeMs != null && (
          <div className="wf-output-meta-item">
            <div className="wf-output-meta-label">Duration</div>
            <div className="wf-output-meta-value wf-output-meta-info">{nodeRunStatus.responseTimeMs}ms</div>
          </div>
        )}
        {nodeRunStatus.statusCode == null && nodeRunStatus.responseTimeMs == null && !isGrpcNode && (
          <div className="wf-output-meta-item">
            <div className="wf-output-meta-label">Result</div>
            <div className={`wf-output-meta-value ${nodeRunStatus.state === 'pass' ? 'wf-output-meta-ok' : nodeRunStatus.state === 'fail' ? 'wf-output-meta-err' : 'wf-output-meta-info'}`}>
              {stateLabel}
            </div>
          </div>
        )}
      </div>
      {/* gRPC-specific diagnostics panel */}
      {isGrpcNode && <GrpcMetaSection grpcMeta={nodeRunStatus.grpcMeta!} />}
      {nodeRunStatus.extracted && Object.keys(nodeRunStatus.extracted).length > 0 && (
        <div className="wf-output-section">
          <div className="wf-output-section-title">Extracted Variables</div>
          <table className="wf-config-var-table">
            <thead><tr><th>Name</th><th>Value</th></tr></thead>
            <tbody>
              {Object.entries(nodeRunStatus.extracted).map(([k, v]) => (
                <tr key={k}>
                  <td className="wf-config-var-ref">{k}</td>
                  <td className="wf-config-var-source wf-config-var-mono">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {/* responseDetail used for non-gRPC protocols; gRPC uses GrpcMetaSection above */}
      {nodeRunStatus.responseDetail && !isGrpcNode && (
        <div className="wf-output-section">
          <div className="wf-output-section-title">Response</div>
          <pre className="wf-output-body">{nodeRunStatus.responseDetail}</pre>
        </div>
      )}
      {nodeRunStatus.error && (
        <div className="wf-output-section">
          <div className="wf-output-section-title">Error</div>
          <pre className="wf-output-body wf-output-body-err">{nodeRunStatus.error}</pre>
        </div>
      )}
    </div>
  );
}
