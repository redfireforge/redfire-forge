/**
 * ScenarioSlaPanel — read-only SLA summary showing all test-level targets in a scenario.
 *
 * Displays a collapsible table summarizing SLA targets defined on individual tests.
 * Clicking a row opens the TestSlaModal for that test.
 */
import { useState, useMemo } from 'react';
import type { Scenario } from '@shared/types';
import { SLA_METRIC_LABELS, SLA_METRIC_UNITS } from '../../results/utils/slaTargets';

interface ScenarioSlaPanelProps {
  /** All tests in this scenario. */
  tests: Scenario[];
  /** Opens the TestSlaModal for the given test. */
  onEditTest: (test: Scenario) => void;
}

export default function ScenarioSlaPanel({ tests, onEditTest }: ScenarioSlaPanelProps) {
  const [expanded, setExpanded] = useState(false);

  const testsWithSla = useMemo(
    () => tests.filter((t) => (t.slaTargets?.length ?? 0) > 0),
    [tests],
  );

  const totalTargets = useMemo(
    () => testsWithSla.reduce((sum, t) => sum + (t.slaTargets?.length ?? 0), 0),
    [testsWithSla],
  );

  if (totalTargets === 0) return null;

  return (
    <div className="scenario-sla-panel">
      <button
        className="scenario-sla-panel-header"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        type="button"
      >
        <span className="scenario-sla-panel-title">
          🎯 SLA Summary
          <span className="scenario-sla-count-badge">{totalTargets}</span>
        </span>
        <span className="scenario-sla-panel-hint">
          {testsWithSla.length} test{testsWithSla.length === 1 ? '' : 's'} with SLA targets
        </span>
        <span className="scenario-sla-panel-chevron">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="scenario-sla-panel-body">
          <table className="sla-summary-table">
            <thead>
              <tr>
                <th>Test</th>
                <th>Metric</th>
                <th>Op</th>
                <th>Fail at</th>
                <th>Warn at</th>
                <th>Label</th>
              </tr>
            </thead>
            <tbody>
              {testsWithSla.flatMap((test) =>
                (test.slaTargets ?? []).map((target, idx) => {
                  const unit = SLA_METRIC_UNITS[target.metric];
                  return (
                    <tr
                      key={`${test.id}-${target.id}`}
                      className="sla-summary-row"
                      onClick={() => onEditTest(test)}
                      title="Click to edit SLA targets for this test"
                    >
                      {idx === 0 ? (
                        <td rowSpan={test.slaTargets!.length} className="sla-summary-test-name">
                          <span className={`method-badge method-${test.method.toLowerCase()}`}>{test.method}</span>
                          {test.name}
                        </td>
                      ) : null}
                      <td>{SLA_METRIC_LABELS[target.metric]}</td>
                      <td className="sla-summary-op">{target.operator === 'lte' ? '≤' : '≥'}</td>
                      <td>{target.value}{unit}</td>
                      <td>{target.warnAt != null ? `${target.warnAt}${unit}` : '—'}</td>
                      <td className="sla-summary-label">{target.label ?? '—'}</td>
                    </tr>
                  );
                }),
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
