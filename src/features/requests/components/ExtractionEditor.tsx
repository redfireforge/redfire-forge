import { useState, useCallback, useMemo, useEffect } from 'react';
import type { Extraction, ExtractionSource } from '@shared/types';
import type { WorkflowVariableHint } from '../../workflow/utils/workflowVariableHints';
import type { FetchErrorDetail } from '@shared/components/data-mapper/types';
import { suggestedVariableNameFromJsonPath, buildJsonTree, type JsonTreeNode } from '@shared/utils/jsonTreeModel';
import { CustomSelect } from '@shared/components/CustomSelect';
import ExpressionInput from '../../workflow/components/expression/ExpressionInput';
import FetchErrorBanner from '@shared/components/data-mapper/FetchErrorBanner';

export interface ExtractionFetchSampleProps {
  onFetch: () => void | Promise<void>;
  fetching: boolean;
  error: FetchErrorDetail | null;
  host?: {
    enabled: boolean;
    setEnabled: (v: boolean) => void;
    override: string;
    setOverride: (v: string) => void;
    resolvedBaseUrl: string;
  };
}
import {
  DataMapperModal,
  createExtractionAdapter,
  createWsExtractionAdapter,
  splitExtractions,
} from '@shared/components/data-mapper';

interface Props {
  extractions: Extraction[];
  onChange: (extractions: Extraction[]) => void;
  /** Optional sample JSON to seed the path picker (e.g. last response body). */
  sampleResponseBody?: string;
  /** Optional: Fetch Response + host row inside the picker (Harness test editor). */
  fetchSample?: ExtractionFetchSampleProps;
  /** Variable hints for autocomplete in expression/fallback fields. */
  variableHints?: WorkflowVariableHint[];
  /** Scope prefix for schema snapshots (e.g. test ID) to prevent cross-instance drift false positives. */
  contextScope?: string;
  /** Transport type — WS uses wsExtractionAdapter, restricts sources to body-only. */
  transportType?: 'http' | 'ws';
}

const HTTP_SOURCES: { value: ExtractionSource; label: string; hint: string }[] = [
  { value: 'body', label: 'Body', hint: '$.data.id' },
  { value: 'header', label: 'Header', hint: 'Location' },
  { value: 'status', label: 'Status', hint: '(auto)' },
];

const WS_SOURCES: { value: ExtractionSource; label: string; hint: string }[] = [
  { value: 'body', label: 'Body', hint: '$.data.id' },
];

export default function ExtractionEditor({ extractions, onChange, sampleResponseBody, fetchSample, variableHints = [], contextScope, transportType = 'http' }: Props) {
  const [pickerIdx, setPickerIdx] = useState<number | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [mapperOpen, setMapperOpen] = useState(false);

  useEffect(() => {
    if (pickerIdx !== null && pickerIdx >= extractions.length) {
      setPickerIdx(null);
    }
  }, [pickerIdx, extractions.length]);

  const { nonBody: nonBodyExtractions } = useMemo(
    () => splitExtractions(extractions),
    [extractions],
  );

  const nonBodyFingerprint = useMemo(
    () => JSON.stringify(nonBodyExtractions),
    [nonBodyExtractions],
  );

  const jsonPathHints = useMemo((): string[] => {
    if (!sampleResponseBody?.trim()) return [];
    try {
      const parsed = JSON.parse(sampleResponseBody);
      const tree = buildJsonTree(parsed, '$', '', { maxDepth: 5, maxArrayItems: 3 });
      const paths: string[] = [];
      const collect = (node: JsonTreeNode) => {
        if (node.path) paths.push(node.path);
        if (node.children) node.children.forEach(collect);
      };
      collect(tree);
      return paths;
    } catch {
      return [];
    }
  }, [sampleResponseBody]);

  const fetchSampleData = useMemo(() => {
    if (!fetchSample?.onFetch) return undefined;
    return async () => {
      await fetchSample.onFetch();
      return undefined;
    };
  }, [fetchSample]);

  const isWs = transportType === 'ws';

  const extractionAdapter = useMemo(
    () => isWs
      ? createWsExtractionAdapter({ sampleMessage: sampleResponseBody })
      : createExtractionAdapter({ sampleResponseBody, nonBodyExtractions, fetchSampleData }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isWs, sampleResponseBody, nonBodyFingerprint, fetchSampleData],
  );

  const pickerInitialData = useMemo(
    () => pickerIdx !== null && extractions[pickerIdx] ? [extractions[pickerIdx]] : null,
    [pickerIdx, extractions],
  );

  const pickerAdapter = useMemo(
    () => pickerIdx !== null
      ? (isWs
        ? createWsExtractionAdapter({ sampleMessage: sampleResponseBody })
        : createExtractionAdapter({ sampleResponseBody, nonBodyExtractions, fetchSampleData }))
      : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pickerIdx, isWs, sampleResponseBody, nonBodyFingerprint, fetchSampleData],
  );

  const update = (idx: number, patch: Partial<Extraction>) => {
    const next = extractions.map((e, i) => i === idx ? { ...e, ...patch } : e);
    onChange(next);
  };
  const remove = (idx: number) => onChange(extractions.filter((_, i) => i !== idx));
  const add = () => onChange([...extractions, { name: '', source: 'body', expression: '', fallback: '' }]);

  const handleDragStart = useCallback((idx: number) => { setDragIdx(idx); }, []);
  const handleDragOver = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDragOverIdx(idx);
  }, []);
  const handleDrop = useCallback((targetIdx: number) => {
    if (dragIdx !== null && dragIdx !== targetIdx) {
      const next = [...extractions];
      const [moved] = next.splice(dragIdx, 1);
      next.splice(targetIdx, 0, moved);
      onChange(next);
    }
    setDragIdx(null);
    setDragOverIdx(null);
  }, [dragIdx, extractions, onChange]);
  const handleDragEnd = useCallback(() => { setDragIdx(null); setDragOverIdx(null); }, []);

  return (
    <div className="extraction-editor">
      <p className="extraction-hint">
        Extract response values into <code>{'{{variables}}'}</code> for workflow/chained steps.
        Optional on a standalone request unless you reference them later.
      </p>

      <div className="ext-fetch-section">
        <div className="ext-fetch-bar">
          {fetchSample && (
            <button
              type="button"
              className="ext-toolbar-btn ext-toolbar-btn--primary"
              onClick={() => void fetchSample.onFetch()}
              disabled={fetchSample.fetching}
            >
              {fetchSample.fetching ? 'Fetching…' : 'Fetch Response'}
            </button>
          )}
          <button
            type="button"
            className="ext-toolbar-btn"
            onClick={() => setMapperOpen(true)}
          >
            Data Mapper
          </button>
          {fetchSample?.host && (
            <label className="checkbox-label ext-host-toggle">
              <input
                type="checkbox"
                checked={fetchSample.host.enabled}
                onChange={(e) => fetchSample.host!.setEnabled(e.target.checked)}
              />
              Override host
            </label>
          )}
          {fetchSample?.host && fetchSample.host.enabled && (
            <input
              type="text"
              className="ext-host-input"
              value={fetchSample.host.override}
              onChange={(e) => fetchSample.host!.setOverride(e.target.value)}
              placeholder={fetchSample.host.resolvedBaseUrl || 'https://...'}
            />
          )}
          {fetchSample?.host && !fetchSample.host.enabled && fetchSample.host.resolvedBaseUrl && (
            <span className="ext-resolved-url">
              Target: <code>{fetchSample.host.resolvedBaseUrl}</code>
            </span>
          )}
        </div>
        {fetchSample?.error && (
          <FetchErrorBanner error={fetchSample.error} />
        )}
        {sampleResponseBody && (
          <span className="ext-sample-status">
            Sample response loaded ({Math.round(sampleResponseBody.length / 1024)} KB)
          </span>
        )}
      </div>

      {extractions.length === 0 ? (
        <div className="extraction-empty">
          <p className="extraction-empty-title">No extractions yet</p>
          <p className="extraction-empty-text">
            Map response fields into variables — for example <code>orderId</code> from <code>$.data.id</code>.
          </p>
        </div>
      ) : (
        <div className="ext-table" role="table" aria-label="Extractions">
          <div className="ext-thead" role="row">
            <span className="ext-th ext-th-grip" />
            <span className="ext-th ext-th-var">Variable</span>
            <span className="ext-th ext-th-source">Source</span>
            <span className="ext-th ext-th-expr">Expression</span>
            <span className="ext-th ext-th-fb">Fallback</span>
            <span className="ext-th ext-th-del" aria-hidden />
          </div>

          {extractions.map((ext, i) => {
            const activeSources = isWs ? WS_SOURCES : HTTP_SOURCES;
            const sourceInfo = activeSources.find(s => s.value === ext.source) ?? activeSources[0];
            const isDragging = dragIdx === i;
            const isOver = dragOverIdx === i && dragIdx !== i;
            return (
              <div
                key={i}
                className={`ext-row${isDragging ? ' ext-row-dragging' : ''}${isOver ? ' ext-row-dragover' : ''}`}
                role="row"
                draggable
                onDragStart={() => handleDragStart(i)}
                onDragOver={(e) => handleDragOver(e, i)}
                onDrop={() => handleDrop(i)}
                onDragEnd={handleDragEnd}
              >
                <span className="ext-cell ext-cell-grip" title="Drag to reorder">⠿</span>

                <span className="ext-cell ext-cell-var">
                  <input
                    value={ext.name}
                    onChange={(e) => update(i, { name: e.target.value.replace(/[{}]/g, '') })}
                    placeholder="variableName"
                    className="ext-input"
                    aria-label={`Variable name ${i + 1}`}
                  />
                </span>

                <span className="ext-cell ext-cell-source">
                  <CustomSelect
                    value={ext.source}
                    onChange={(v) => update(i, { source: v as ExtractionSource })}
                    options={activeSources}
                    className="ext-select"
                    aria-label={`Source ${i + 1}`}
                  />
                </span>

                <span className="ext-cell ext-cell-expr">
                  <ExpressionInput
                    value={ext.expression}
                    onChange={(val) => update(i, { expression: val })}
                    placeholder={sourceInfo.hint}
                    disabled={ext.source === 'status'}
                    className="ext-input"
                    aria-label={`Expression ${i + 1}`}
                    variableHints={variableHints}
                    jsonPathHints={ext.source === 'body' ? jsonPathHints : undefined}
                  />
                  {ext.source === 'body' && (
                    <button
                      type="button"
                      className="ext-pick-btn"
                      onClick={() => setPickerIdx(i)}
                      title="Browse JSON and pick a path"
                      aria-label={`Pick JSON path for extraction ${i + 1}`}
                    >
                      ⋯
                    </button>
                  )}
                </span>

                <span className="ext-cell ext-cell-fb">
                  <ExpressionInput
                    value={ext.fallback ?? ''}
                    onChange={(val) => update(i, { fallback: val || undefined })}
                    placeholder="default"
                    className="ext-input"
                    aria-label={`Fallback ${i + 1}`}
                    variableHints={variableHints}
                  />
                </span>

                <span className="ext-cell ext-cell-del">
                  <button
                    type="button"
                    className="ext-del-btn"
                    onClick={() => remove(i)}
                    title="Remove extraction"
                    aria-label={`Remove extraction ${i + 1}`}
                  >
                    ×
                  </button>
                </span>
              </div>
            );
          })}
        </div>
      )}

      <div className="ext-footer">
        <button type="button" className="ext-add-btn" onClick={add}>
          + Add Extraction
        </button>
      </div>

      {pickerIdx !== null && pickerInitialData && extractions[pickerIdx]?.source === 'body' && pickerAdapter && (
        <DataMapperModal
          adapter={pickerAdapter}
          initialData={pickerInitialData}
          onSave={(result) => {
            const bodyResult = result.filter(e => e.source === 'body');
            if (bodyResult.length > 0) {
              const mapped = bodyResult[0];
              const row = extractions[pickerIdx];
              const nameEmpty = !row?.name?.trim();
              const suggested = suggestedVariableNameFromJsonPath(mapped.expression);
              update(pickerIdx, {
                expression: mapped.expression,
                ...(mapped.fallback !== undefined ? { fallback: mapped.fallback } : {}),
                ...(nameEmpty && suggested ? { name: suggested } : {}),
              });
            }
            setPickerIdx(null);
          }}
          onCancel={() => setPickerIdx(null)}
          contextScope={contextScope}
        />
      )}

      {mapperOpen && (
        <DataMapperModal
          adapter={extractionAdapter}
          initialData={extractions}
          onSave={(mapped) => {
            onChange(mapped);
            setMapperOpen(false);
          }}
          onCancel={() => setMapperOpen(false)}
          contextScope={contextScope}
        />
      )}
    </div>
  );
}
