import type { WaitForConditionNodeData } from '../../types/workflow';
import type { WorkflowVariableHint } from '../../utils/workflowVariableHints';
import InsertVarField from '../expression/InsertVarField';
import AvailableVariables from '../expression/AvailableVariables';
import { KafkaCard, KafkaFormRow } from './KafkaConfigUi';

export default function WaitForConditionConfig({
  data,
  onChange,
  onRequestVariableInsert,
  variableHints = [],
}: {
  data: WaitForConditionNodeData;
  onChange: (d: WaitForConditionNodeData) => void;
  onRequestVariableInsert?: (apply: (snippet: string) => void) => void;
  variableHints?: WorkflowVariableHint[];
}) {
  return (
    <div className="wf-config-body wf-waitcond-config" data-testid="wait-for-condition-config">
      <KafkaCard
        title="Wait for Condition"
        hint="Poll a subgraph until the expression becomes true."
      >
        <div className="wf-kafka-form wf-kafka-form--waitcond">
          <KafkaFormRow label="Label">
            <input
              className="wf-kafka-form-input"
              value={data.label}
              onChange={(e) => onChange({ ...data, label: e.target.value })}
              aria-label="Wait for Condition label"
            />
          </KafkaFormRow>

          <KafkaFormRow
            label="Expression"
            hint={
              <>
                Evaluated after each poll. Supports <code>==</code>, <code>!=</code>, <code>&gt;</code>,{' '}
                <code>&lt;</code>, <code>&gt;=</code>, <code>&lt;=</code>, <code>contains</code>,{' '}
                <code>!contains</code>. Uses <code>{'{{variable}}'}</code> syntax.
              </>
            }
          >
            <InsertVarField
              onRequestVariableInsert={onRequestVariableInsert}
              shortRef
              onInsert={(snippet) =>
                onChange({ ...data, conditionExpression: data.conditionExpression + snippet })
              }
            >
              <input
                className="wf-kafka-form-input wf-kafka-form-input--mono"
                value={data.conditionExpression}
                onChange={(e) => onChange({ ...data, conditionExpression: e.target.value })}
                placeholder="e.g. {{status}} == done"
                aria-label="Condition expression"
              />
            </InsertVarField>
          </KafkaFormRow>
        </div>
      </KafkaCard>

      <KafkaCard
        title="Polling"
        hint="How often to re-run the Poll body and when to stop waiting."
      >
        <div className="wf-kafka-form wf-kafka-form--waitcond wf-kafka-form--waitcond-polling">
          <KafkaFormRow
            label="Poll interval"
            hint="How long to wait between each poll attempt."
            compact
          >
            <div className="wf-waitcond-number-ctrl">
              <input
                className="wf-kafka-form-input"
                type="number"
                min={100}
                step={100}
                value={data.pollIntervalMs}
                onChange={(e) =>
                  onChange({
                    ...data,
                    pollIntervalMs: Math.max(100, parseInt(e.target.value) || 1000),
                  })
                }
                aria-label="Polling interval"
              />
              <span className="unit">ms</span>
            </div>
          </KafkaFormRow>

          <KafkaFormRow
            label="Timeout"
            hint="Max wait time. 0 = no timeout (use Max attempts)."
            compact
          >
            <div className="wf-waitcond-number-ctrl">
              <input
                className="wf-kafka-form-input"
                type="number"
                min={0}
                step={1000}
                value={data.timeoutMs}
                onChange={(e) =>
                  onChange({
                    ...data,
                    timeoutMs: Math.max(0, parseInt(e.target.value) || 0),
                  })
                }
                aria-label="Timeout"
              />
              <span className="unit">ms</span>
            </div>
          </KafkaFormRow>

          <KafkaFormRow
            label="Max attempts"
            hint="Max polls. 0 = unlimited (bounded by timeout)."
            compact
          >
            <div className="wf-waitcond-number-ctrl">
              <input
                className="wf-kafka-form-input"
                type="number"
                min={0}
                max={1000}
                value={data.maxAttempts}
                onChange={(e) =>
                  onChange({
                    ...data,
                    maxAttempts: Math.max(0, Math.min(1000, parseInt(e.target.value) || 0)),
                  })
                }
                aria-label="Max attempts"
              />
            </div>
          </KafkaFormRow>
        </div>
      </KafkaCard>

      <AvailableVariables hints={variableHints} />

      <div className="wf-config-section-info">
        <div className="wf-config-info-title">How it works</div>
        <ul>
          <li>
            <strong>Poll</strong> handle: connect to the HTTP step(s) that will be re-executed each poll
            cycle.
          </li>
          <li>
            <strong>Done</strong> handle: continues the workflow after the condition is met or polling
            exhausted.
          </li>
          <li>
            Each poll cycle re-runs the body subgraph, then evaluates the condition against updated
            variables.
          </li>
          <li>
            Sets <code>{'{{wait.attempts}}'}</code> and <code>{'{{wait.elapsed}}'}</code> variables on
            completion.
          </li>
          <li>
            If the condition is never met, the node marks as <strong>fail</strong> (unless
            timeout/maxAttempts = 0, which polls forever until aborted).
          </li>
        </ul>
      </div>
    </div>
  );
}
