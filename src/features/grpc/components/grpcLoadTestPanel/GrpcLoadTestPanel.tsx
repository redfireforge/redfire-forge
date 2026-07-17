import { useEffect, useMemo, useState } from 'react';
import type { UseGrpcStudioAdvancedFeaturesReturn } from '../../hooks/useGrpcStudioAdvancedFeatures';
import {
  formatGrpcLoadTestCallTypeBadge,
  presentGrpcAdvancedOperationStatus,
} from '../../utils/grpcStudioAdvancedModel';
import { GrpcLoadTestConfigSection } from './GrpcLoadTestConfigSection';
import { GrpcLoadTestResultsSection } from './GrpcLoadTestResultsSection';
import {
  buildCompareDetailRows,
  buildCompareDeltas,
  buildCompareStatusComposition,
  buildLatencyHistogram,
  buildStatusBreakdown,
  buildThroughputTimeline,
} from './grpcLoadTestPanelUtils';

export interface GrpcLoadTestPanelProps {
  advanced: UseGrpcStudioAdvancedFeaturesReturn;
}

export function GrpcLoadTestPanel({ advanced }: GrpcLoadTestPanelProps) {
  const [profileName, setProfileName] = useState('');
  const [compareRunId, setCompareRunId] = useState('');
  const [configCollapsed, setConfigCollapsed] = useState(false);
  const [resultsCollapsed, setResultsCollapsed] = useState(false);

  useEffect(() => {
    if (!advanced.selectedLoadTestProfileId) {
      setProfileName('');
      return;
    }
    const selected = advanced.loadTestProfiles.find(
      (profile) => profile.id === advanced.selectedLoadTestProfileId,
    );
    setProfileName(selected?.name ?? '');
  }, [advanced.selectedLoadTestProfileId, advanced.loadTestProfiles]);

  const status = presentGrpcAdvancedOperationStatus(
    advanced.runtime.loadTest.status,
    advanced.runtime.loadTest.cancellationRequested,
  );
  const summary = advanced.loadTest.lastSummary;
  const selectedRunId = advanced.loadTest.selectedRunId ?? summary?.runId;
  const runHistory = useMemo(
    () => advanced.loadTest.runHistory ?? [],
    [advanced.loadTest.runHistory],
  );
  const config = advanced.loadTest.config;
  const live = advanced.loadTest.live;
  const canStart = !advanced.loadTestRunning;
  const canStop = advanced.loadTestRunning;
  const callTypeBadge = formatGrpcLoadTestCallTypeBadge(advanced.activeLoadTestCallType);
  const statusBreakdown = useMemo(() => (summary ? buildStatusBreakdown(summary) : []), [summary]);
  const latencyHistogram = useMemo(() => (summary ? buildLatencyHistogram(summary) : []), [summary]);
  const throughputTimeline = useMemo(() => (summary ? buildThroughputTimeline(summary) : []), [summary]);
  const compareSummary = useMemo(
    () => runHistory.find((entry) => entry.summary.runId === compareRunId)?.summary,
    [compareRunId, runHistory],
  );

  useEffect(() => {
    if (runHistory.length < 2 || !summary) {
      setCompareRunId('');
      return;
    }
    if (compareRunId && compareRunId !== summary.runId) {
      return;
    }
    const fallback = runHistory.find((entry) => entry.summary.runId !== summary.runId)?.summary.runId;
    setCompareRunId(fallback ?? '');
  }, [compareRunId, runHistory, summary]);

  const compareDeltas = useMemo(() => {
    if (!summary || !compareSummary) {
      return undefined;
    }
    return buildCompareDeltas(summary, compareSummary);
  }, [compareSummary, summary]);

  const compareDetailRows = useMemo(() => {
    if (!summary || !compareSummary) {
      return [];
    }
    return buildCompareDetailRows(summary, compareSummary);
  }, [compareSummary, summary]);

  const compareStatusComposition = useMemo(() => {
    if (!summary || !compareSummary) {
      return [];
    }
    return buildCompareStatusComposition(summary, compareSummary);
  }, [compareSummary, summary]);

  return (
    <section className="grpc-advanced-panel" data-testid="grpc-load-test-panel">
      <GrpcLoadTestConfigSection
        advanced={advanced}
        profileName={profileName}
        setProfileName={setProfileName}
        status={status}
        callTypeBadge={callTypeBadge}
        canStart={canStart}
        canStop={canStop}
        collapsed={configCollapsed}
        onToggleCollapse={() => setConfigCollapsed((v) => !v)}
      />
      <GrpcLoadTestResultsSection
        advanced={advanced}
        summary={summary}
        live={live}
        config={config}
        selectedRunId={selectedRunId}
        runHistory={runHistory}
        compareRunId={compareRunId}
        setCompareRunId={setCompareRunId}
        compareSummary={compareSummary}
        compareDeltas={compareDeltas}
        compareDetailRows={compareDetailRows}
        compareStatusComposition={compareStatusComposition}
        statusBreakdown={statusBreakdown}
        latencyHistogram={latencyHistogram}
        throughputTimeline={throughputTimeline}
        collapsed={resultsCollapsed}
        onToggleCollapse={() => setResultsCollapsed((v) => !v)}
      />
    </section>
  );
}
