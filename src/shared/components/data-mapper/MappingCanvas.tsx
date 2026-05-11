import { useMemo, useCallback } from 'react';
import type { ConnectionLine } from './hooks/useConnectionLines';
import type { MappingTrace } from './utils/mappingTrace';

export interface ErrorDetailData {
  mappingId: string;
  sourcePath: string;
  targetPath: string;
  expression?: string;
  sourceValue?: string;
  targetValue?: string;
  error?: string;
}

interface MappingCanvasProps {
  lines: ConnectionLine[];
  width: number;
  height: number;
  selectedMappingId: string | null;
  selectedMappingIds?: Set<string>;
  onSelectMapping: (id: string | null) => void;
  onToggleSelectMapping?: (id: string) => void;
  onRemoveMapping: (id: string) => void;
  onEditExpression?: (mappingId: string) => void;
  onAcceptPending?: (id: string) => void;
  onRejectPending?: (id: string) => void;
  debugMode?: boolean;
  traceByMappingId?: Map<string, MappingTrace> | null;
  onShowErrorDetail?: (data: ErrorDetailData, y: number) => void;
}

function bezierPath(sourceY: number, targetY: number, width: number): string {
  const x1 = 0;
  const x2 = width;
  const cp = width * 0.45;
  return `M ${x1},${sourceY} C ${cp},${sourceY} ${x2 - cp},${targetY} ${x2},${targetY}`;
}

export default function MappingCanvas({
  lines,
  width,
  height,
  selectedMappingId,
  selectedMappingIds,
  onSelectMapping,
  onToggleSelectMapping,
  onRemoveMapping,
  onEditExpression,
  onAcceptPending,
  onRejectPending,
  debugMode,
  traceByMappingId,
  onShowErrorDetail,
}: MappingCanvasProps) {
  const handleErrorClick = useCallback((mappingId: string, midY: number) => {
    if (!traceByMappingId || !onShowErrorDetail) return;
    const trace = traceByMappingId.get(mappingId);
    if (!trace) return;
    const formatVal = (v: unknown): string => {
      if (v === undefined) return 'undefined';
      if (v === null) return 'null';
      if (typeof v === 'string') return v;
      try { return JSON.stringify(v); } catch { return String(v); }
    };
    onShowErrorDetail({
      mappingId,
      sourcePath: trace.sourcePath,
      targetPath: trace.targetPath,
      expression: trace.expression,
      sourceValue: formatVal(trace.sourceValue),
      targetValue: formatVal(trace.targetValue),
      error: trace.error,
    }, midY);
  }, [traceByMappingId, onShowErrorDetail]);

  const paths = useMemo(
    () =>
      lines.map((line) => ({
        ...line,
        d: bezierPath(line.sourceY, line.targetY, width),
      })),
    [lines, width],
  );

  if (lines.length === 0 && height === 0) return null;

  return (
    <svg
      className="dm-canvas"
      width={width}
      height={Math.max(height, 100)}
      aria-hidden="true"
      viewBox={`0 0 ${width} ${Math.max(height, 100)}`}
    >
      {paths.map((p) => {
        const isSelected = p.mappingId === selectedMappingId || (selectedMappingIds?.has(p.mappingId) ?? false);
        const hasAnySelection = selectedMappingId !== null || (selectedMappingIds != null && selectedMappingIds.size > 0);
        const isDimmed = hasAnySelection && !isSelected;
        return (
          <g key={p.id}>
            <path
              d={p.d}
              fill="none"
              stroke="transparent"
              strokeWidth={12}
              style={{ cursor: 'pointer' }}
              onClick={(e) => {
                if ((e.shiftKey || e.metaKey || e.ctrlKey) && onToggleSelectMapping) {
                  onToggleSelectMapping(p.mappingId);
                } else {
                  onSelectMapping(isSelected ? null : p.mappingId);
                }
              }}
            />
            <path
              d={p.d}
              fill="none"
              className={`dm-connection-line ${isSelected ? 'dm-connection-line--selected' : ''} ${isDimmed ? 'dm-connection-line--dimmed' : ''} ${p.hasExpression ? 'dm-connection-line--expression' : ''} ${p.isAutoMapped && !p.hasExpression ? 'dm-connection-line--auto' : ''} ${p.hasTypeMismatch ? 'dm-connection-line--mismatch' : ''} ${p.isPending ? 'dm-connection-line--pending' : ''} ${p.arrayKind ? `dm-connection-line--${p.arrayKind}` : ''} ${p.driftSeverity ? `dm-connection-line--drift-${p.driftSeverity}` : ''} ${debugMode && p.traceError ? 'dm-connection-line--trace-error' : ''} ${debugMode && p.traceValue != null && p.traceValue !== '' && !p.traceError ? 'dm-connection-line--trace-ok' : ''}`}
              strokeWidth={isSelected ? 2.5 : 1.5}
            />
            {p.driftSeverity && (
              <CanvasBadge
                x={width / 2}
                y={(p.sourceY + p.targetY) / 2 - (p.hasExpression || (p.arrayKind && p.arrayLabel) ? 24 : 10)}
                label={p.driftSeverity === 'breaking' ? '✕ drift' : '⚠ drift'}
                variant={`drift-${p.driftSeverity}`}
              />
            )}
            {p.hasExpression && (
              <CanvasBadge
                x={width / 2}
                y={(p.sourceY + p.targetY) / 2 - 10}
                label="ƒx expression"
                variant="expression"
                cursor={onEditExpression ? 'pointer' : undefined}
                onClick={onEditExpression ? (e) => { e.stopPropagation(); onEditExpression(p.mappingId); } : undefined}
              />
            )}
            {p.arrayKind && p.arrayLabel && !p.hasExpression && (
              <CanvasBadge
                x={width / 2}
                y={(p.sourceY + p.targetY) / 2 - 10}
                label={p.arrayKind === 'loop' ? `∞ ${p.arrayLabel}` : p.arrayKind === 'aggregate' ? `Σ ${p.arrayLabel}` : p.arrayLabel}
                variant={p.arrayKind}
              />
            )}
            {p.hasTypeMismatch && !p.driftSeverity && (
              <CanvasBadge
                x={width / 2}
                y={(p.sourceY + p.targetY) / 2 + (p.hasExpression || (p.arrayKind && p.arrayLabel) ? 10 : -10)}
                label="⚠ mismatch"
                variant="mismatch"
              />
            )}
            {debugMode && p.traceValue != null && p.traceValue !== '' && (
              <g className={`dm-trace-badge ${p.traceError ? 'dm-trace-badge--error' : 'dm-trace-badge--ok'}`}>
                <title>{p.traceValue}</title>
                <rect
                  x={width / 2 - Math.min(p.traceValue.length * 3.5 + 8, 60)}
                  y={(p.sourceY + p.targetY) / 2 + 6}
                  width={Math.min(p.traceValue.length * 7 + 16, 120)}
                  height={16}
                  rx={4}
                />
                <text
                  x={width / 2}
                  y={(p.sourceY + p.targetY) / 2 + 17}
                  textAnchor="middle"
                  className="dm-trace-badge-text"
                >
                  {p.traceValue.length > 16 ? p.traceValue.slice(0, 15) + '…' : p.traceValue}
                </text>
              </g>
            )}
            {debugMode && p.traceError && (
              <g
                className="dm-error-inline"
                style={{ cursor: 'pointer' }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleErrorClick(p.mappingId, (p.sourceY + p.targetY) / 2);
                }}
              >
                <text
                  x={width / 2}
                  y={(p.sourceY + p.targetY) / 2 + 30}
                  textAnchor="middle"
                  className="dm-error-inline-text"
                >
                  ⚠ Click for details
                </text>
              </g>
            )}
            {isSelected && !p.isPending && (
              <g
                className="dm-remove-btn"
                transform={`translate(${width / 2 + 14}, ${(p.sourceY + p.targetY) / 2 - 8})`}
                onClick={(e) => { e.stopPropagation(); onRemoveMapping(p.mappingId); }}
                style={{ cursor: 'pointer' }}
              >
                <circle r={8} />
                <text textAnchor="middle" dy="0.35em" fontSize={12}>×</text>
              </g>
            )}
            {p.isPending && onAcceptPending && onRejectPending && (
              <>
                <g
                  className="dm-pending-accept"
                  transform={`translate(${width / 2 - 12}, ${(p.sourceY + p.targetY) / 2 - 8})`}
                  onClick={(e) => { e.stopPropagation(); onAcceptPending(p.mappingId); }}
                  style={{ cursor: 'pointer' }}
                >
                  <circle r={8} />
                  <text textAnchor="middle" dy="0.35em" fontSize={11}>✓</text>
                </g>
                <g
                  className="dm-pending-reject"
                  transform={`translate(${width / 2 + 12}, ${(p.sourceY + p.targetY) / 2 - 8})`}
                  onClick={(e) => { e.stopPropagation(); onRejectPending(p.mappingId); }}
                  style={{ cursor: 'pointer' }}
                >
                  <circle r={8} />
                  <text textAnchor="middle" dy="0.35em" fontSize={11}>✗</text>
                </g>
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function CanvasBadge({
  x,
  y,
  label,
  variant,
  cursor,
  onClick,
}: {
  x: number;
  y: number;
  label: string;
  variant: string;
  cursor?: string;
  onClick?: (e: React.MouseEvent) => void;
}) {
  const textLen = label.length * 5.2 + 12;
  const w = Math.max(textLen, 30);
  return (
    <g
      className={`dm-canvas-badge--${variant}`}
      style={cursor ? { cursor } : undefined}
      onClick={onClick}
    >
      <rect
        className="dm-canvas-badge-bg"
        x={x - w / 2}
        y={y - 8}
        width={w}
        height={16}
      />
      <text
        className="dm-canvas-badge-text"
        x={x}
        y={y}
      >
        {label}
      </text>
    </g>
  );
}
