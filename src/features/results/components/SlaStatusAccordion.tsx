/**
 * SlaStatusAccordion — expandable Feature → Scenario → Check tree (Phase C, SLA-C5).
 *
 * Inserted between AggregatedTimingTable and Request Details in ResultsDashboard.
 * Auto-opens and auto-expands failing nodes when tree.overall === 'fail'.
 * Skips the feature-group level when all scenarios are ungrouped (no featureGroupName
 * on results), which is the common single-feature-group case.
 */
import { useState, useMemo, useEffect, Fragment } from 'react';
import type { TestSummary, RequestResult } from '@shared/types';
import {
  evaluateSlaTree,
  SLA_METRIC_LABELS,
  SLA_METRIC_UNITS,
  type SlaTarget,
  type SlaCheck,
  type SlaStatus,
  type SlaFeatureNode,
  type SlaScenarioNode,
} from '../utils/slaTargets';

interface SlaStatusAccordionProps {
  targets: SlaTarget[];
  results: RequestResult[];
  summary: TestSummary;
}

// ── Sub-components ──

function StatusDot({ status }: { status: SlaStatus | null }) {
  return <span className={`sla-status-dot sla-dot-${status ?? 'nodata'}`} aria-hidden="true" />;
}

function CheckRow({ check, level }: { check: SlaCheck; level: 0 | 1 | 2 }) {
  const { target, actual, status } = check;
  const unit = SLA_METRIC_UNITS[target.metric];
  const label = target.label ?? SLA_METRIC_LABELS[target.metric];
  const op = target.operator === 'lte' ? '≤' : '≥';
  const actualDisplay = actual !== null ? `${actual.toFixed(1)}${unit}` : '—';

  const levelClass = level === 0 ? '' : level === 1 ? ' sla-check-l1' : ' sla-check-l2';

  return (
    <div className={`sla-check-row sla-check-${status}${levelClass}`}>
      <StatusDot status={status} />
      <span className="sla-check-label">{label}</span>
      <span className={`sla-check-actual sla-actual-${status}`}>{actualDisplay}</span>
      <span className="sla-check-threshold">{op} {target.value}{unit}</span>
    </div>
  );
}

function ScenarioSection({
  node,
  expanded,
  onToggle,
  level,
}: {
  node: SlaScenarioNode;
  expanded: boolean;
  onToggle: () => void;
  level: 0 | 1;
}) {
  const checkLevel = level === 0 ? 1 : 2;
  const statusClass = ` sla-scenario-${node.status ?? 'nodata'}`;
  const rowClass = (level === 0 ? 'sla-scenario-row' : 'sla-scenario-row sla-scenario--nested') + statusClass;
  return (
    <Fragment>
      <div
        className={rowClass}
        onClick={node.checks.length > 0 ? onToggle : undefined}
        style={node.checks.length === 0 ? { cursor: 'default' } : undefined}
      >
        <StatusDot status={node.status} />
        <span className="sla-scenario-name">{node.scenarioName}</span>
        <span className="sla-scenario-badge">
          {node.checks.length} check{node.checks.length !== 1 ? 's' : ''}
        </span>
        {node.checks.length > 0 && (
          <span className={`sla-chevron${expanded ? ' sla-chevron-open' : ''}`}>›</span>
        )}
      </div>
      {expanded &&
        node.checks.map((check, i) => (
          <CheckRow key={check.target.id ?? i} check={check} level={checkLevel as 1 | 2} />
        ))}
    </Fragment>
  );
}

function FeatureSection({
  node,
  expanded,
  onToggle,
  expandedScenarios,
  onToggleScenario,
}: {
  node: SlaFeatureNode;
  expanded: boolean;
  onToggle: () => void;
  expandedScenarios: Set<string>;
  onToggleScenario: (sc: string) => void;
}) {
  const hasContent = node.featureChecks.length > 0 || node.scenarios.length > 0;
  const failChecks = [...node.featureChecks, ...node.scenarios.flatMap(s => s.checks)].filter(c => c.status === 'fail').length;
  const passChecks = [...node.featureChecks, ...node.scenarios.flatMap(s => s.checks)].filter(c => c.status === 'pass').length;
  return (
    <Fragment>
      <div
        className={`sla-feature-row sla-feature-${node.status ?? 'nodata'}`}
        onClick={hasContent ? onToggle : undefined}
        style={!hasContent ? { cursor: 'default' } : undefined}
      >
        <StatusDot status={node.status} />
        <span className="sla-feature-name">
          {node.featureGroupName || 'Ungrouped'}
        </span>
        <span className="sla-feature-meta">
          {failChecks > 0 && <span className="sla-feature-count sla-count-fail">{failChecks} failing</span>}
          {passChecks > 0 && <span className="sla-feature-count sla-count-pass">{passChecks} passing</span>}
          {node.scenarios.length > 0 && (
            <span className="sla-feature-badge">{node.scenarios.length} scenario{node.scenarios.length !== 1 ? 's' : ''}</span>
          )}
        </span>
        {hasContent && (
          <span className={`sla-chevron${expanded ? ' sla-chevron-open' : ''}`}>›</span>
        )}
      </div>
      {expanded && (
        <>
          {node.featureChecks.map((check, i) => (
            <CheckRow key={check.target.id ?? i} check={check} level={1} />
          ))}
          {node.scenarios.map((sn) => (
            <ScenarioSection
              key={sn.scenarioName}
              node={sn}
              level={1}
              expanded={expandedScenarios.has(sn.scenarioName)}
              onToggle={() => onToggleScenario(sn.scenarioName)}
            />
          ))}
        </>
      )}
    </Fragment>
  );
}

// ── Main component ──

export function SlaStatusAccordion({ targets, results, summary }: SlaStatusAccordionProps) {
  const tree = useMemo(
    () => evaluateSlaTree(results, summary, targets),
    [results, summary, targets],
  );

  // Auto-open when status is 'fail' on initial render
  const [expandedFeatures, setExpandedFeatures] = useState<Set<string>>(() => {
    if (tree.overall !== 'fail') return new Set();
    const allNodes = [...tree.featureNodes, ...tree.derivedFeatureNodes];
    return new Set(allNodes.filter((n) => n.status === 'fail').map((n) => n.featureGroupName));
  });
  const [expandedScenarios, setExpandedScenarios] = useState<Set<string>>(() => {
    if (tree.overall !== 'fail') return new Set();
    const allNodes = [...tree.featureNodes, ...tree.derivedFeatureNodes];
    return new Set(
      allNodes
        .flatMap((n) => n.scenarios)
        .filter((s) => s.status === 'fail')
        .map((s) => s.scenarioName),
    );
  });

  // Re-open and re-expand whenever the set of failing nodes changes.
  // Using a stable key derived from failing node identities prevents spurious
  // re-expansions when the user manually collapses a node (the key only
  // changes when a new failing node appears or an existing one is resolved).
  const failingNodeKey = useMemo(() => {
    if (tree.overall !== 'fail') return '';
    const allNodes = [...tree.featureNodes, ...tree.derivedFeatureNodes];
    const fgKeys = allNodes
      .filter((n) => n.status === 'fail')
      .map((n) => n.featureGroupName)
      .sort()
      .join(',');
    const scKeys = allNodes
      .flatMap((n) => n.scenarios)
      .filter((s) => s.status === 'fail')
      .map((s) => s.scenarioName)
      .sort()
      .join(',');
    return `${fgKeys}|${scKeys}`;
  }, [tree]);

  useEffect(() => {
    if (tree.overall === 'fail') {
      const allNodes = [...tree.featureNodes, ...tree.derivedFeatureNodes];
      setExpandedFeatures(
        new Set(allNodes.filter((n) => n.status === 'fail').map((n) => n.featureGroupName)),
      );
      setExpandedScenarios(
        new Set(
          allNodes
            .flatMap((n) => n.scenarios)
            .filter((s) => s.status === 'fail')
            .map((s) => s.scenarioName),
        ),
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [failingNodeKey]);

  if (targets.length === 0) return null;

  // Summary counts: only from configured checks (aggregate + explicit featureNodes).
  // derivedFeatureNodes provide drill-down context and are excluded from the pill totals
  // to avoid inflating the count for aggregate-only (CLI-imported) runs.
  const allChecks = [
    ...tree.aggregateChecks,
    ...tree.featureNodes.flatMap((fn) => [...fn.featureChecks, ...fn.scenarios.flatMap((s) => s.checks)]),
  ];
  const failCount = allChecks.filter((c) => c.status === 'fail').length;
  const warnCount = allChecks.filter((c) => c.status === 'warn').length;
  const passCount = allChecks.filter((c) => c.status === 'pass').length;

  const toggleFeature = (fg: string) => {
    setExpandedFeatures((prev) => {
      const next = new Set(prev);
      if (next.has(fg)) next.delete(fg);
      else next.add(fg);
      return next;
    });
  };

  const toggleScenario = (sc: string) => {
    setExpandedScenarios((prev) => {
      const next = new Set(prev);
      if (next.has(sc)) next.delete(sc);
      else next.add(sc);
      return next;
    });
  };

  // Skip feature-group level when there is exactly one ungrouped node (no FG structure defined)
  const skipFeatureLevel =
    tree.featureNodes.length === 1 &&
    tree.featureNodes[0].featureGroupName === '' &&
    tree.featureNodes[0].featureChecks.length === 0;

  // Same logic for derived nodes (always one ungrouped node with no featureChecks)
  const skipDerivedFeatureLevel =
    tree.derivedFeatureNodes.length === 1 &&
    tree.derivedFeatureNodes[0].featureGroupName === '' &&
    tree.derivedFeatureNodes[0].featureChecks.length === 0;

  return (
    <div className="sla-status-panel">
      {/* Summary stats bar */}
      <div className="sla-summary-bar">
        {failCount > 0 && (
          <span className="sla-sum-pill sla-sum-fail">
            <span className="sla-status-dot sla-dot-fail" /> {failCount} Failing
          </span>
        )}
        {warnCount > 0 && (
          <span className="sla-sum-pill sla-sum-warn">
            <span className="sla-status-dot sla-dot-warn" /> {warnCount} Warning{warnCount !== 1 ? 's' : ''}
          </span>
        )}
        {passCount > 0 && (
          <span className="sla-sum-pill sla-sum-pass">
            <span className="sla-status-dot sla-dot-pass" /> {passCount} Passing
          </span>
        )}
        <span className="sla-sum-total">{allChecks.length} check{allChecks.length !== 1 ? 's' : ''} total</span>
      </div>

      {/* Tree body */}
      <div className="sla-tree-body">
        {tree.aggregateChecks.map((check, i) => (
          <CheckRow key={check.target.id ?? i} check={check} level={0} />
        ))}

        {skipFeatureLevel ? (
          tree.featureNodes[0].scenarios.map((sn) => (
            <ScenarioSection
              key={sn.scenarioName}
              node={sn}
              level={0}
              expanded={expandedScenarios.has(sn.scenarioName)}
              onToggle={() => toggleScenario(sn.scenarioName)}
            />
          ))
        ) : (
          tree.featureNodes.map((fn) => (
            <FeatureSection
              key={fn.featureGroupName}
              node={fn}
              expanded={expandedFeatures.has(fn.featureGroupName)}
              onToggle={() => toggleFeature(fn.featureGroupName)}
              expandedScenarios={expandedScenarios}
              onToggleScenario={toggleScenario}
            />
          ))
        )}

        {/* Per-test breakdown derived from aggregate targets — shown for aggregate-only runs
            (e.g. CLI imports). Provides the same expandable scenario tree as fully-configured
            runs so users can see exactly which test drove each metric violation. */}
        {tree.derivedFeatureNodes.length > 0 && (
          <>
            <div className="sla-per-test-header">Per-Test Breakdown</div>
            {skipDerivedFeatureLevel ? (
              tree.derivedFeatureNodes[0].scenarios.map((sn) => (
                <ScenarioSection
                  key={sn.scenarioName}
                  node={sn}
                  level={0}
                  expanded={expandedScenarios.has(sn.scenarioName)}
                  onToggle={() => toggleScenario(sn.scenarioName)}
                />
              ))
            ) : (
              tree.derivedFeatureNodes.map((fn) => (
                <FeatureSection
                  key={fn.featureGroupName}
                  node={fn}
                  expanded={expandedFeatures.has(fn.featureGroupName)}
                  onToggle={() => toggleFeature(fn.featureGroupName)}
                  expandedScenarios={expandedScenarios}
                  onToggleScenario={toggleScenario}
                />
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
}
