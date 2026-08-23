import type { TestRun } from '@shared/types';
import { thinkTimeLabel } from '../../test-runner/utils/runnerProgressStorage';

interface Props {
  selectedRun: TestRun;
}

export function ResultsContextTags({ selectedRun }: Props) {
  return (
    <div className="context-tags">
      {selectedRun.svcName && selectedRun.config.executionMode !== 'workflow' && (
        <span className="context-tag svc-tag">{selectedRun.svcName}</span>
      )}
      {selectedRun.envName && <span className="context-tag env-tag">{selectedRun.envName}</span>}
      {selectedRun.config.executionMode === 'workflow' && selectedRun.workflowName ? (
        <span className="context-tag workflow-name-tag" title={selectedRun.workflowName}>⚡ {selectedRun.workflowName}</span>
      ) : selectedRun.baseUrl ? (
        <span className="context-tag base-url-tag" title={selectedRun.baseUrl}>Host: {selectedRun.baseUrl}</span>
      ) : (
        <span className="context-tag base-url-tag hardcoded">Host: hardcoded</span>
      )}
      <span className="context-tag exec-mode-tag">
        {selectedRun.config.executionMode === 'constant-arrival' && selectedRun.config.arrivalRate ? (
          <>
            Arrival Rate
            {' · '}{selectedRun.config.arrivalRate.targetRps} RPS
            {' · '}{selectedRun.config.arrivalRate.durationSec}s
            {selectedRun.config.arrivalRate.ramp && ` · ramp ${selectedRun.config.arrivalRate.ramp.startRps}→${selectedRun.config.arrivalRate.ramp.endRps}`}
          </>
        ) : selectedRun.config.executionMode === 'load-profile' && selectedRun.config.loadProfile ? (
          <>
            {selectedRun.config.loadProfile.type === 'ramp-up' ? 'Ramp-Up' : selectedRun.config.loadProfile.type === 'spike' ? 'Spike' : 'Sustained'}
            {' · '}Peak:{selectedRun.config.loadProfile.maxConcurrency}
            {' · '}{selectedRun.config.loadProfile.durationSec}s
            {selectedRun.config.loadProfile.type === 'spike' && ` · Spike:${selectedRun.config.loadProfile.spikeConcurrency}`}
          </>
        ) : (
          <>
            {selectedRun.config.executionMode === 'pool' ? 'Pool' : selectedRun.config.executionMode === 'sequential' ? 'Sequential' : selectedRun.config.executionMode === 'workflow' ? 'Workflow' : 'Batch'}
            {' · '}C:{selectedRun.config.concurrency}{' · '}I:{selectedRun.config.iterations}
          </>
        )}
      </span>
      {thinkTimeLabel(selectedRun.config.thinkTime) && (
        <span className="context-tag think-time-tag">{thinkTimeLabel(selectedRun.config.thinkTime)}</span>
      )}
    </div>
  );
}
