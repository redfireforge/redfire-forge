import { useState, useCallback, useRef, useMemo, useId, useEffect, type RefObject } from 'react';
import DataMapper from './DataMapper';
import DriftBanner from './DriftBanner';
import SchemaDiffModal from './SchemaDiffModal';
import type { MapperAdapter, Mapping, ValidationIssue } from './types';
import { resolveCapabilities } from './types';
import type { ClassifiedDrift } from './utils/schemaDrift';
import type { DriftIndicator } from './SourceTreeNode';
import { captureSchemaSnapshot, captureSnapshotPair, loadSnapshot, saveSnapshot } from './utils/schemaSnapshot';
import type { SchemaSnapshot } from './utils/schemaSnapshot';
import { diffSchemas, findAffectedMappings, classifyDrift } from './utils/schemaDrift';
import { suggestRepairs, applyRepair } from './utils/schemaRepair';
import type { RepairSuggestion } from './utils/schemaRepair';
import '../../../styles/data-mapper-modal.css';

interface DataMapperModalProps<TOutput = unknown> {
  adapter: MapperAdapter<TOutput>;
  initialData?: TOutput;
  onSave: (output: TOutput, options?: { unorderedArrays?: boolean }) => void;
  onCancel: () => void;
  fullScreenDefault?: boolean;
  doneLabel?: string;
  unorderedArrays?: boolean;
}

interface SnapshotPairRef {
  side: 'source' | 'target';
  sourceId?: string;
  saved: SchemaSnapshot;
  current: SchemaSnapshot;
}

/**
 * Detect unmapped required target fields.
 * Checks both fieldConstraints and target.fields for required markers.
 */
function findUnmappedRequired(
  adapter: MapperAdapter<unknown>,
  mappings: Mapping[],
): ValidationIssue[] {
  const mappedTargets = new Set(mappings.map((m) => m.targetPath));
  const issues: ValidationIssue[] = [];
  const reported = new Set<string>();

  const constraints = adapter.target.fieldConstraints;
  if (constraints) {
    for (const [path, constraint] of Object.entries(constraints)) {
      if (constraint.required && !mappedTargets.has(path)) {
        issues.push({
          targetPath: path,
          severity: 'warning',
          message: `Required field "${path}" is not mapped.`,
        });
        reported.add(path);
      }
    }
  }

  const fields = adapter.target.fields;
  if (fields) {
    for (const field of fields) {
      if (field.required && !mappedTargets.has(field.path) && !reported.has(field.path)) {
        issues.push({
          targetPath: field.path,
          severity: 'warning',
          message: `Required field "${field.path}" is not mapped.`,
        });
      }
    }
  }

  return issues;
}

export default function DataMapperModal<TOutput = unknown>({
  adapter,
  initialData,
  onSave,
  onCancel,
  fullScreenDefault = false,
  doneLabel = 'Save',
  unorderedArrays: initialUnorderedArrays,
}: DataMapperModalProps<TOutput>) {
  const caps = useMemo(() => resolveCapabilities(adapter.capabilities), [adapter.capabilities]);
  const titleId = useId();
  const [isFullScreen, setIsFullScreen] = useState(fullScreenDefault);
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([]);
  const [driftEntries, setDriftEntries] = useState<ClassifiedDrift[]>([]);
  const [showDriftBanner, setShowDriftBanner] = useState(false);
  const [showDiffModal, setShowDiffModal] = useState(false);
  const currentMappingsRef = useRef<Mapping[]>([]);
  const currentAssertionsRef = useRef<import('../../types').Assertion[]>([]);
  const mapperFlushRef = useRef<(() => void) | null>(null);
  const mappingsReadyRef = useRef(false);
  const sourceSampleOverridesRef = useRef<Record<string, unknown>>({});
  const savedSnapshotsRef = useRef<SnapshotPairRef[]>([]);
  const [repairTick, setRepairTick] = useState(0);
  const [unorderedArrays, setUnorderedArrays] = useState(initialUnorderedArrays ?? false);

  // Detect schema drift on mount by comparing saved snapshot with current source data.
  // Deferred until mappingsReadyRef is true so findAffectedMappings uses real mappings.
  useEffect(() => {
    let cancelled = false;

    const runDriftDetection = async () => {
      // Wait for child DataMapper to fire handleMappingsChange at least once
      const deadline = Date.now() + 500;
      while (!mappingsReadyRef.current && Date.now() < deadline) {
        await new Promise((r) => requestAnimationFrame(r));
        if (cancelled) return;
      }

      const savedPair = await loadSnapshot(adapter.contextId).catch(() => null);
      if (cancelled || !savedPair) return;

      const allDrifts: ClassifiedDrift[] = [];
      const snapPairs: SnapshotPairRef[] = [];

      const overrides = sourceSampleOverridesRef.current;
      for (const savedSource of savedPair.source) {
        const adapterSrc = adapter.sources.find((s) => s.id === savedSource.sourceId);
        const sourceData = overrides[savedSource.sourceId ?? ''] ?? adapterSrc?.sampleData;
        if (sourceData == null) continue;
        const currentSnap = captureSchemaSnapshot(adapter.contextId, 'source', sourceData, savedSource.sourceId);
        const rawDrifts = diffSchemas(savedSource, currentSnap);
        if (rawDrifts.length > 0) {
          const tagged = rawDrifts.map((d) => ({ ...d, sourceId: savedSource.sourceId }));
          const withMappings = findAffectedMappings(tagged, currentMappingsRef.current, 'source');
          allDrifts.push(...classifyDrift(withMappings));
          snapPairs.push({
            side: 'source',
            sourceId: savedSource.sourceId,
            saved: savedSource,
            current: currentSnap,
          });
        }
      }

      if (savedPair.target && adapter.target.sampleData != null) {
        const currentTargetSnap = captureSchemaSnapshot(
          adapter.contextId,
          'target',
          adapter.target.sampleData,
        );
        const targetDrifts = diffSchemas(savedPair.target, currentTargetSnap);
        if (targetDrifts.length > 0) {
          const withMappings = findAffectedMappings(targetDrifts, currentMappingsRef.current, 'target');
          allDrifts.push(...classifyDrift(withMappings));
          snapPairs.push({
            side: 'target',
            saved: savedPair.target,
            current: currentTargetSnap,
          });
        }
      }

      if (allDrifts.length > 0 && !cancelled) {
        savedSnapshotsRef.current = snapPairs;
        setDriftEntries(allDrifts);
        setShowDriftBanner(true);
      }
    };

    runDriftDetection();

    return () => { cancelled = true; };
  }, [adapter]);

  const handleMappingsChange = useCallback((mappings: Mapping[]) => {
    currentMappingsRef.current = mappings;
    mappingsReadyRef.current = true;
    setValidationIssues([]);
  }, []);

  const handleAssertionsChange = useCallback((assertions: import('../../types').Assertion[]) => {
    currentAssertionsRef.current = assertions;
  }, []);

  const handleToggleUnorderedArray = useCallback((_arrayPath: string) => {
    setUnorderedArrays((prev) => !prev);
  }, []);


  const handleSourceSampleChange = useCallback((overrides: Record<string, unknown>) => {
    sourceSampleOverridesRef.current = overrides;
  }, []);

  const handleAcceptDrift = useCallback(() => {
    const overrides = sourceSampleOverridesRef.current;
    const effectiveSources = adapter.sources.map((s) => ({
      id: s.id,
      sampleData: overrides[s.id] ?? s.sampleData,
    }));
    const pair = captureSnapshotPair(
      adapter.contextId,
      effectiveSources,
      adapter.target.sampleData,
    );
    saveSnapshot(adapter.contextId, pair).catch(() => {});
    savedSnapshotsRef.current = [];
    setDriftEntries([]);
    setShowDriftBanner(false);
  }, [adapter]);

  const handleDismissDrift = useCallback(() => {
    setShowDriftBanner(false);
  }, []);

  const handleShowDiff = useCallback(() => {
    setShowDiffModal(true);
  }, []);

  const handleCloseDiff = useCallback(() => {
    setShowDiffModal(false);
  }, []);

  const driftMap = useMemo(() => {
    if (driftEntries.length === 0) return undefined;
    const map = new Map<string, DriftIndicator>();
    for (const d of driftEntries) {
      if (d.severity === 'info' || d.severity === 'warning' || d.severity === 'breaking') {
        const indicator = { severity: d.severity, label: d.description };
        map.set(d.path, indicator);
        // Also register with [*] → [0] normalization so tree nodes with numeric
        // indices (from buildJsonTree) match snapshot paths that use [*]
        const numericPath = d.path.replace(/\.\[\*\]/g, '[0]');
        if (numericPath !== d.path) {
          map.set(numericPath, indicator);
        }
        // Root-level array: `[*].name` → also register `.[*].name` for tree normalization
        if (d.path.startsWith('[*]')) {
          map.set('.' + d.path, indicator);
        }
      }
    }
    return map;
  }, [driftEntries]);

  const driftMappingIds = useMemo(() => {
    if (driftEntries.length === 0) return undefined;
    const result = new Map<string, 'warning' | 'breaking'>();
    for (const d of driftEntries) {
      if (d.severity !== 'info') {
        for (const mid of d.affectedMappingIds) {
          const existing = result.get(mid);
          if (!existing || d.severity === 'breaking') {
            result.set(mid, d.severity as 'warning' | 'breaking');
          }
        }
      }
    }
    return result;
  }, [driftEntries]);

  const repairSuggestions = useMemo(() => {
    if (driftEntries.length === 0 || savedSnapshotsRef.current.length === 0) return undefined;
    const breaking = driftEntries.filter((d) => d.severity === 'breaking' && d.affectedMappingIds.length > 0);
    if (breaking.length === 0) return undefined;
    const map = new Map<string, RepairSuggestion[]>();
    for (const drift of breaking) {
      const pair = drift.sourceId != null
        ? savedSnapshotsRef.current.find((p) => p.side === 'source' && p.sourceId === drift.sourceId)
        : savedSnapshotsRef.current.find((p) => p.side === 'target');
      if (!pair) continue;
      for (const mid of drift.affectedMappingIds) {
        const suggestions = suggestRepairs(
          drift.path,
          mid,
          pair.current,
          pair.saved,
          drift.sourceId != null ? 'source' : 'target',
        );
        if (suggestions.length > 0) {
          const existing = map.get(drift.path) ?? [];
          const merged = [...existing, ...suggestions];
          const deduped: RepairSuggestion[] = [];
          const seen = new Set<string>();
          for (const suggestion of merged.sort((a, b) => b.confidence - a.confidence)) {
            const key = `${suggestion.mappingId}:${suggestion.suggestedPath}:${suggestion.side ?? 'source'}`;
            if (seen.has(key)) continue;
            seen.add(key);
            deduped.push(suggestion);
          }
          map.set(drift.path, deduped);
        }
      }
    }
    return map.size > 0 ? map : undefined;
  }, [driftEntries]);

  const applyRepairSet = useCallback((repairs: Array<{ mappingId: string; suggestion: RepairSuggestion }>) => {
    if (repairs.length === 0) return 0;
    let appliedCount = 0;
    const repairedMappingIds = new Set<string>();
    const latestByMapping = new Map<string, RepairSuggestion>();
    for (const { mappingId, suggestion } of repairs) {
      const prev = latestByMapping.get(mappingId);
      if (!prev || suggestion.confidence > prev.confidence) {
        latestByMapping.set(mappingId, suggestion);
      }
    }

    currentMappingsRef.current = currentMappingsRef.current.map((mapping) => {
      const suggestion = latestByMapping.get(mapping.id);
      if (!suggestion) return mapping;
      appliedCount += 1;
      repairedMappingIds.add(mapping.id);
      return applyRepair(mapping, suggestion);
    });

    if (appliedCount === 0) return 0;

    setRepairTick((t) => t + 1);
    setDriftEntries((prev) =>
      prev.map((d) => ({
        ...d,
        affectedMappingIds: d.affectedMappingIds.filter((id) => !repairedMappingIds.has(id)),
      })).filter((d) => d.severity !== 'breaking' || d.affectedMappingIds.length > 0),
    );
    return appliedCount;
  }, []);

  const handleRepairMapping = useCallback((mappingId: string, suggestion: RepairSuggestion) => {
    applyRepairSet([{ mappingId, suggestion }]);
  }, [applyRepairSet]);

  const handleRepairBatch = useCallback((repairs: Array<{ mappingId: string; suggestion: RepairSuggestion }>) => {
    applyRepairSet(repairs);
  }, [applyRepairSet]);

  const handleDone = useCallback(() => {
    // Flush any pending DSL debounce so assertions/fields are up-to-date before save
    mapperFlushRef.current?.();

    const mappings = currentMappingsRef.current;

    const unresolvedBreakingDrift = driftEntries.filter(
      (entry) => entry.severity === 'breaking' && entry.affectedMappingIds.length > 0,
    );
    if (unresolvedBreakingDrift.length > 0) {
      const message = unresolvedBreakingDrift.length === 1
        ? '1 breaking schema drift issue must be repaired or accepted before saving.'
        : `${unresolvedBreakingDrift.length} breaking schema drift issues must be repaired or accepted before saving.`;
      setValidationIssues((prev) => {
        const filtered = prev.filter((issue) => !issue.message.includes('schema drift issue'));
        return [
          ...filtered,
          {
            severity: 'error',
            message,
          },
        ];
      });
      setShowDiffModal(true);
      return;
    }

    let adapterIssues: ReturnType<NonNullable<typeof adapter.validate>> = [];
    try {
      adapterIssues = adapter.validate?.(mappings) ?? [];
    } catch (err) {
      adapterIssues = [{
        severity: 'warning' as const,
        message: `Validation error: ${err instanceof Error ? err.message : String(err)}`,
      }];
    }
    const requiredIssues = findUnmappedRequired(adapter, mappings);
    const allIssues = [...adapterIssues, ...requiredIssues];

    const errors = allIssues.filter((i) => i.severity === 'error');
    if (errors.length > 0) {
      setValidationIssues(allIssues);
      return;
    }

    if (allIssues.length > 0) {
      setValidationIssues(allIssues);
    }

    let output: TOutput;
    try {
      output = adapter.serialize(mappings);
    } catch (err) {
      setValidationIssues(prev => [
        ...prev.filter(i => !i.message.startsWith('Save failed:')),
        {
          severity: 'warning',
          message: `Save failed: ${err instanceof Error ? err.message : String(err)}. Try again or adjust mappings.`,
        },
      ]);
      return;
    }

    // Capture schema snapshot for drift detection (fire-and-forget)
    // Use effective source data (user paste/fetch overrides merged with adapter defaults)
    const overrides = sourceSampleOverridesRef.current;
    const effectiveSources = adapter.sources.map((s) => ({
      id: s.id,
      sampleData: overrides[s.id] ?? s.sampleData,
    }));
    const pair = captureSnapshotPair(
      adapter.contextId,
      effectiveSources,
      adapter.target.sampleData,
    );
    saveSnapshot(adapter.contextId, pair).catch(() => {});

    const assertions = currentAssertionsRef.current;
    if (output && typeof output === 'object' && !Array.isArray(output)) {
      (output as Record<string, unknown>).assertions = assertions;
    }

    onSave(output, { unorderedArrays });
  }, [adapter, driftEntries, onSave, unorderedArrays]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // Don't close if a nested dialog (expression editor or schema diff) is open
      if (document.querySelector('.dm-expr-overlay')) return;
      if (document.querySelector('.dm-diff-overlay')) return;
      // Don't close if focus is in an editable field (let the field handle Escape)
      const el = e.target as HTMLElement;
      const tag = el?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (el?.isContentEditable || el?.contentEditable === 'true') return;
      // Don't close if focus is inside a Monaco editor (e.g. Validation Rules)
      if (el?.closest?.('.monaco-editor')) return;
      e.preventDefault();
      onCancel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  const errorCount = useMemo(
    () => validationIssues.filter((i) => i.severity === 'error').length,
    [validationIssues],
  );
  const warningCount = useMemo(
    () => validationIssues.filter((i) => i.severity === 'warning').length,
    [validationIssues],
  );
  const footerStatus = errorCount > 0
    ? `${errorCount} error${errorCount !== 1 ? 's' : ''} must be fixed before saving`
    : warningCount > 0
      ? `${warningCount} warning${warningCount !== 1 ? 's' : ''} will be saved`
      : 'Review mappings and save when ready';

  return (
    <div
      className={`dm-modal-overlay ${isFullScreen ? 'dm-modal--fullscreen' : ''}`}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div className="dm-modal-shell">
        <div className="dm-modal-header">
          <div className="dm-modal-title-block">
            <h2 id={titleId} className="dm-modal-title">{adapter.title}</h2>
            <p className="dm-modal-subtitle">Map source fields to target outputs.</p>
          </div>
          <div className="dm-modal-header-actions">
            <button
              className="dm-modal-header-btn"
              onClick={() => setIsFullScreen((f) => !f)}
              aria-label={isFullScreen ? 'Exit full screen' : 'Enter full screen'}
              title={isFullScreen ? 'Restore modal size' : 'Use full screen workspace'}
            >
              {isFullScreen ? 'Exit full screen' : 'Full screen'}
            </button>
          </div>
        </div>

        {showDriftBanner && driftEntries.length > 0 && (
          <DriftBanner
            drifts={driftEntries}
            onAcceptAndUpdate={handleAcceptDrift}
            onDismiss={handleDismissDrift}
            onShowDiff={handleShowDiff}
          />
        )}

        <div className="dm-modal-body">
          <DataMapper
            adapter={adapter}
            initialData={initialData}
            onChange={handleMappingsChange}
            onAssertionsChange={handleAssertionsChange}
            onSourceSampleChange={handleSourceSampleChange}
            height="100%"
            driftMap={driftMap}
            driftMappingIds={driftMappingIds}
            repairTick={repairTick}
            repairedMappingsRef={currentMappingsRef}
            repairSuggestions={repairSuggestions}
            onApplyRepair={handleRepairMapping}
            onShowDrift={driftEntries.length > 0 ? handleShowDiff : undefined}
            unorderedDefault={unorderedArrays}
            onToggleUnorderedArray={caps.unorderedArrays ? handleToggleUnorderedArray : undefined}
            hideAdvanced={caps.hideAdvanced}
            flushRef={mapperFlushRef as RefObject<(() => void) | null>}
          />
        </div>

        {validationIssues.length > 0 && (
          <div className="dm-validation-bar" aria-live="polite">
            {errorCount > 0 && (
              <span className="dm-validation-count dm-validation-count--error">
                {errorCount} error{errorCount !== 1 ? 's' : ''}
              </span>
            )}
            {warningCount > 0 && (
              <span className="dm-validation-count dm-validation-count--warning">
                {warningCount} warning{warningCount !== 1 ? 's' : ''}
              </span>
            )}
            <div className="dm-validation-issues">
              {validationIssues.map((issue, idx) => (
                <div
                  key={idx}
                  className={`dm-validation-issue dm-validation-issue--${issue.severity}`}
                >
                  <span className="dm-validation-icon">
                    {issue.severity === 'error' ? '✕' : issue.severity === 'warning' ? '⚠' : 'ℹ'}
                  </span>
                  <span className="dm-validation-msg">{issue.message}</span>
                  {issue.targetPath && (
                    <span className="dm-validation-path">{issue.targetPath}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="dm-modal-footer">
          <div className="dm-modal-footer-status" role="status" aria-live="polite">
            {footerStatus}
          </div>
          {caps.unorderedArrays && (
            <label className="dm-modal-footer-option">
              <input
                type="checkbox"
                checked={unorderedArrays}
                onChange={(e) => setUnorderedArrays(e.target.checked)}
              />
              <span>Unordered array matching</span>
            </label>
          )}
          <div className="dm-modal-footer-actions">
            <button className="dm-modal-btn dm-modal-btn--secondary" onClick={onCancel}>
              Cancel
            </button>
            <button
              className="dm-modal-btn dm-modal-btn--primary"
              onClick={handleDone}
              disabled={errorCount > 0}
              title={errorCount > 0 ? 'Fix errors before saving' : 'Save mappings'}
            >
              {doneLabel}
            </button>
          </div>
        </div>
      </div>
      {showDiffModal && driftEntries.length > 0 && (
        <SchemaDiffModal
          drifts={driftEntries}
          onClose={handleCloseDiff}
          repairSuggestions={repairSuggestions}
          onApplyRepair={handleRepairMapping}
          onApplyRepairBatch={handleRepairBatch}
        />
      )}
    </div>
  );
}
