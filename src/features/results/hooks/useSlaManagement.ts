import { useState, useEffect, useCallback } from 'react';
import type { TestRun } from '@shared/types';
import { resolveTargetsForRun, saveRunSlaTargets, computeRunSlaStatus } from '../utils/slaTargets';
import type { SlaTarget, SlaStatus } from '../utils/slaTargets';

export function useSlaManagement(selectedRun: TestRun | null, selectedRunId: string, runs: TestRun[]) {
  const [slaTargets, setSlaTargets] = useState<SlaTarget[]>([]);
  const [slaScope, setSlaScope] = useState<'run' | 'workflow-def' | null>(null);
  const [runSlaStatuses, setRunSlaStatuses] = useState<Map<string, SlaStatus | null>>(new Map());
  const [slaStatusVersion, setSlaStatusVersion] = useState(0);

  // Load SLA targets for the selected run (per-run resolution: run-level → ad-hoc → null)
  useEffect(() => {
    let cancelled = false;
    if (!selectedRun) {
      setSlaTargets([]);
      setSlaScope(null);
      return;
    }
    resolveTargetsForRun(selectedRun).then((resolved) => {
      if (cancelled) return;
      setSlaTargets(resolved?.targets ?? []);
      // Determine effective scope for display:
      // - 'run' scope from a workflow run → came from workflow definition embedding (Phase A)
      // - null scope → ad-hoc post-run targets or no targets
      const effectiveScope: 'run' | 'workflow-def' | null =
        resolved?.scope === 'run' && selectedRun.config.workflowId
          ? 'workflow-def'
          : (resolved?.scope ?? null);
      setSlaScope(effectiveScope);
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRunId]);

  const handleSaveSlaTargets = useCallback(async (targets: SlaTarget[]) => {
    if (!selectedRun || slaScope === 'run' || slaScope === 'workflow-def') return;
    await saveRunSlaTargets(selectedRun.id, targets);
    setSlaScope(null); // per-run targets: shows '⚗ Ad-hoc' badge (SLA-D3)
    setSlaTargets(targets);
    // Trigger SLA dot recompute for all visible runs (picks up newly saved targets from storage)
    setSlaStatusVersion((v) => v + 1);
  }, [selectedRun, slaScope]);

  // Lazily compute the SLA status dot for every visible run (does not block initial render)
  useEffect(() => {
    let cancelled = false;
    Promise.all(
      runs.map((run) =>
        computeRunSlaStatus(run, run.results).then(
          (status) => [run.id, status] as const,
        ),
      ),
    ).then((entries) => {
      if (!cancelled) setRunSlaStatuses(new Map(entries));
    }).catch(() => {
      // SLA dots are best-effort; silently ignore storage errors
    });
    return () => { cancelled = true; };
  }, [runs, slaStatusVersion]);

  return {
    slaTargets,
    setSlaTargets,
    slaScope,
    runSlaStatuses,
    handleSaveSlaTargets,
  };
}
