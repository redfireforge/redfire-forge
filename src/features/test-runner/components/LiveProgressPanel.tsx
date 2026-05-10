import type { TestSummary, Scenario, RequestResult } from '../../../shared/types';
import type { LoadProfileConfig, ThinkTimeConfig } from '../../../shared/types';
import type { TimeSeriesPoint } from '../hooks/useTestExecution';
import type { ProgressMeta } from '../../../engine/executor';
import { LiveCharts } from './LiveCharts';
import { profileLabel } from './RunnerExecutionConfig';
import { thinkTimeLabel } from '../utils/runnerProgressStorage';
import { getExecutionModeMeta } from '../../../shared/utils/executionMode';
import type { ExecutionMode } from '../../../shared/types';

interface Props {
  isRunning: boolean;
  completed: number;
  total: number;
  summary: TestSummary | null;
  timeSeries: TimeSeriesPoint[];
  profileMeta: ProgressMeta | null;
  executionMode: ExecutionMode;
  concurrency: number;
  loadProfile: LoadProfileConfig;
  thinkTime?: ThinkTimeConfig;
  hostLabel?: string;
  /** Live results for per-test progress breakdown */
  liveResults?: RequestResult[];
  /** Selected tests for per-test progress breakdown */
  selectedTests?: Scenario[];
  /** Test weights for per-test progress breakdown */
  weights?: Record<string, number>;
  onClear?: () => void;
}

export default function LiveProgressPanel({
  isRunning,
  completed,
  total,
  summary,
  timeSeries,
  profileMeta,
  executionMode,
  concurrency,
  loadProfile,
  thinkTime,
  hostLabel,
  liveResults,
  selectedTests,
  weights,
  onClear,
}: Props) {
  const isTimeBased = executionMode === 'load-profile' || (isRunning && total === -1);
  
  const progressPct = isTimeBased
    ? (profileMeta ? Math.min(100, Math.round((profileMeta.elapsedMs / profileMeta.durationMs) * 100)) : 0)
    : (total > 0 ? Math.round((completed / total) * 100) : 0);

  const thinkLabel = thinkTimeLabel(thinkTime);
  const executionModeMeta = getExecutionModeMeta(executionMode);

  return (
    <div className="progress-section">
      <div className="progress-header-row">
        <h3>Progress <span className="progress-mode-tag">
          {isTimeBased ? (
            <>
              {profileLabel(loadProfile.type)}
              {' · '}Peak:{loadProfile.maxConcurrency}
              {' · '}{loadProfile.durationSec}s
              {loadProfile.type === 'ramp-up' && ` · ramp ${loadProfile.rampUpSec ?? loadProfile.durationSec}s`}
              {loadProfile.type === 'spike' && ` · spike to ${loadProfile.spikeConcurrency ?? loadProfile.maxConcurrency * 3}`}
            </>
          ) : (
            <>
              {executionModeMeta.progressLabel}
              {' · '}C:{executionMode === 'sequential' ? 1 : concurrency}
              {' · '}I:{total}
            </>
          )}
        </span>
        {thinkLabel && (
          <span className="progress-mode-tag think-time-tag">{thinkLabel}</span>
        )}
        {hostLabel && (
          <span className="progress-host-tag">{hostLabel}</span>
        )}
        </h3>
        {!isRunning && onClear && (
          <button className="btn btn-xs btn-ghost" onClick={onClear} title="Clear progress">✕ Clear</button>
        )}
      </div>

      <div className="progress-bar-container">
        <div className="progress-bar" style={{ width: `${progressPct}%` }}></div>
        <span className="progress-text">
          {isTimeBased ? (
            <>
              {profileMeta ? `${(profileMeta.elapsedMs / 1000).toFixed(1)}s` : '0s'} / {profileMeta ? (profileMeta.durationMs / 1000).toFixed(0) : loadProfile.durationSec}s
              {' '}({completed} requests)
            </>
          ) : executionMode === 'workflow' ? (
            <>
              {completed} / {total} iterations ({progressPct}%)
              {summary && summary.totalRequests > 0 && (
                <> — {summary.successfulRequests} / {summary.totalRequests} requests ({Math.round((summary.successfulRequests / summary.totalRequests) * 100)}%)</>
              )}
            </>
          ) : (
            <>{completed} / {total} requests ({progressPct}%)</>
          )}
        </span>
      </div>

      {/* Per-test progress breakdown */}
      {isRunning && liveResults && liveResults.length > 0 && selectedTests && selectedTests.some(t => t.dataSource) && weights && (
        <div className="runner-per-test-progress">
          {selectedTests.filter(t => (weights[t.id] ?? 1) > 0).map(t => {
            const results = liveResults.filter(r => r.scenarioId === t.id);
            const passed = results.filter(r => r.passed).length;
            const failed = results.length - passed;
            const expectedRows = t.dataSource?.rows.filter(r => r.enabled).length ?? 1;
            return (
              <div key={t.id} className="runner-per-test-row">
                <span className="runner-per-test-name">{t.name}:</span>
                <span className="runner-per-test-counts">
                  {results.length}/{expectedRows}
                  {passed > 0 && <span className="runner-per-test-pass"> ✓{passed}</span>}
                  {failed > 0 && <span className="runner-per-test-fail"> ✗{failed}</span>}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {summary && (
        <div className="live-metrics">
          <div className="metric-card">
            <div className="metric-value">{summary.tps}</div>
            <div className="metric-label">TPS</div>
          </div>
          <div className="metric-card">
            <div className="metric-value">{summary.avgResponseTime} ms</div>
            <div className="metric-label">
              Avg Response
              {summary.avgIterationTime !== undefined && (
                <span className="metric-info" data-tooltip="Average duration of individual HTTP requests">ⓘ</span>
              )}
            </div>
          </div>
          {summary.avgIterationTime !== undefined && (
            <div className="metric-card">
              <div className="metric-value">{summary.avgIterationTime} ms</div>
              <div className="metric-label">
                Avg Iteration
                <span className="metric-info" data-tooltip="Average duration of complete workflow iterations (all nodes)">ⓘ</span>
              </div>
            </div>
          )}
          <div className="metric-card">
            <div className="metric-value">{summary.errorRate}%</div>
            <div className="metric-label">Error Rate <span className="metric-info" data-tooltip="Percentage of requests that received a non-2xx HTTP status (e.g. 400, 404, 500). Includes intentional negative tests that expect error responses.">ⓘ</span></div>
          </div>
          <div className="metric-card">
            <div className="metric-value">{summary.failedValidations}</div>
            <div className="metric-label">Validation Failures <span className="metric-info" data-tooltip="Requests whose actual response did not match expected assertions. 0 means every test got the response it expected — even negative tests that assert error codes.">ⓘ</span></div>
          </div>
          {isTimeBased && profileMeta && (
            <div className="metric-card">
              <div className="metric-value">{profileMeta.currentInFlight} / {profileMeta.targetConcurrency}</div>
              <div className="metric-label">Concurrency</div>
            </div>
          )}
        </div>
      )}

      {/* Charts */}
      {timeSeries.length >= 2 && (
        <LiveCharts data={timeSeries} isTimeBased={isTimeBased} />
      )}
    </div>
  );
}
