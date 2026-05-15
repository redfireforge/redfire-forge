import { useMemo, useCallback, useState } from 'react';
import type { ConnectionLine } from './hooks/useConnectionLines';
import type { MappingTrace } from './utils/mappingTrace';
import type { ExpressionSuggestion } from './utils/expressionSuggestions';
import type { RepairSuggestion } from './utils/schemaRepair';

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
  expressionSuggestions?: Map<string, ExpressionSuggestion[]>;
  onApplySuggestion?: (mappingId: string, expression: string) => void;
  repairSuggestions?: Map<string, RepairSuggestion[]>;
  onApplyRepair?: (mappingId: string, suggestion: RepairSuggestion) => void;
  totalMappingCount?: number;
  failedMappingIds?: Set<string>;
  highlightedMappingIds?: Set<string> | null;
  onRemapDragStart?: (mappingId: string) => void;
  onRemapDragEnd?: () => void;
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
  expressionSuggestions,
  onApplySuggestion,
  repairSuggestions,
  onApplyRepair,
  totalMappingCount = 0,
  failedMappingIds,
  highlightedMappingIds,
  onRemapDragStart,
  onRemapDragEnd,
}: MappingCanvasProps) {
  const [hoveredMappingId, setHoveredMappingId] = useState<string | null>(null);

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
      {paths.length === 0 && (
        <g className="dm-canvas-empty-guide">
          <rect
            className="dm-canvas-empty-guide-bg"
            x={Math.max(8, width / 2 - 130)}
            y={Math.max(8, Math.max(height, 100) / 2 - 28)}
            width={Math.min(260, Math.max(120, width - 16))}
            height={56}
            rx={8}
          />
          <text
            className="dm-canvas-empty-guide-title"
            x={width / 2}
            y={Math.max(height, 100) / 2 - 6}
            textAnchor="middle"
          >
            {totalMappingCount > 0 ? 'Lines hidden' : 'No mappings yet'}
          </text>
          <text
            className="dm-canvas-empty-guide-subtitle"
            x={width / 2}
            y={Math.max(height, 100) / 2 + 12}
            textAnchor="middle"
          >
            {totalMappingCount > 0
              ? 'Click a node to show its connections'
              : 'Drag fields from Source to Target to draw lines'}
          </text>
        </g>
      )}
      {paths.map((p) => {
        const isSelected = p.mappingId === selectedMappingId || (selectedMappingIds?.has(p.mappingId) ?? false);
        const isHovered = p.mappingId === hoveredMappingId;
        const isHighlighted = highlightedMappingIds?.has(p.mappingId) ?? false;
        const hasAnySelection = selectedMappingId !== null || (selectedMappingIds != null && selectedMappingIds.size > 0);
        const hasAnyHover = hoveredMappingId !== null;
        const hasAnyHighlight = highlightedMappingIds != null && highlightedMappingIds.size > 0;
        const isDimmed = (hasAnySelection && !isSelected)
          || (hasAnyHover && !isHovered && !isSelected)
          || (hasAnyHighlight && !isHighlighted && !isSelected && !isHovered);
        return (
          <g key={p.id}>
            <path
              d={p.d}
              fill="none"
              stroke="transparent"
              strokeWidth={12}
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHoveredMappingId(p.mappingId)}
              onMouseLeave={() => setHoveredMappingId((prev) => prev === p.mappingId ? null : prev)}
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
              className={`dm-connection-line ${isSelected || isHovered || isHighlighted ? 'dm-connection-line--selected' : ''} ${isDimmed ? 'dm-connection-line--dimmed' : ''} ${p.hasExpression ? 'dm-connection-line--expression' : ''} ${p.isAutoMapped && !p.hasExpression ? 'dm-connection-line--auto' : ''} ${p.isFromPattern ? 'dm-connection-line--pattern' : ''} ${p.hasTypeMismatch ? 'dm-connection-line--mismatch' : ''} ${p.isPending ? 'dm-connection-line--pending' : ''} ${p.arrayKind ? `dm-connection-line--${p.arrayKind}` : ''} ${p.driftSeverity ? `dm-connection-line--drift-${p.driftSeverity}` : ''} ${debugMode && p.traceError ? 'dm-connection-line--trace-error' : ''} ${debugMode && p.traceValue != null && p.traceValue !== '' && !p.traceError ? 'dm-connection-line--trace-ok' : ''} ${failedMappingIds?.has(p.mappingId) ? 'dm-connection-line--verify-fail' : ''}`}
              strokeWidth={isSelected || isHovered || isHighlighted ? 2.5 : 1.5}
            />
            {(() => {
              const midX = width / 2;
              const midY = (p.sourceY + p.targetY) / 2;
              const topBadges: Array<{
                label: string;
                variant: string;
                cursor?: string;
                onClick?: (e: React.MouseEvent) => void;
              }> = [];
              const bottomBadges: Array<{
                label: string;
                variant: string;
                cursor?: string;
                onClick?: (e: React.MouseEvent) => void;
              }> = [];

              if (p.driftSeverity) {
                topBadges.push({
                  label: p.driftSeverity === 'breaking' ? '✕ drift' : '⚠ drift',
                  variant: `drift-${p.driftSeverity}`,
                });
              }

              if (p.driftSeverity === 'breaking' && repairSuggestions?.has(p.mappingId) && onApplyRepair) {
                const topRepair = repairSuggestions.get(p.mappingId)?.[0];
                if (topRepair) {
                  const shortPath = topRepair.suggestedPath.length > 12
                    ? topRepair.suggestedPath.slice(-12)
                    : topRepair.suggestedPath;
                  topBadges.push({
                    label: `🔧 repair → ${shortPath}`,
                    variant: 'repair',
                    cursor: 'pointer',
                    onClick: (e) => {
                      e.stopPropagation();
                      onApplyRepair(p.mappingId, topRepair);
                    },
                  });
                }
              }

              if (p.hasExpression) {
                topBadges.push({
                  label: 'ƒx expression',
                  variant: 'expression',
                  cursor: onEditExpression ? 'pointer' : undefined,
                  onClick: onEditExpression
                    ? (e) => {
                      e.stopPropagation();
                      onEditExpression(p.mappingId);
                    }
                    : undefined,
                });
              } else if (p.arrayKind && p.arrayLabel) {
                topBadges.push({
                  label: p.arrayKind === 'loop'
                    ? `∞ ${p.arrayLabel}`
                    : p.arrayKind === 'aggregate'
                      ? `Σ ${p.arrayLabel}`
                      : p.arrayLabel,
                  variant: p.arrayKind,
                });
              }

              if (p.hasTypeMismatch && !p.driftSeverity) {
                bottomBadges.push({
                  label: '⚠ mismatch',
                  variant: 'mismatch',
                });
              }

              if (!p.hasExpression && expressionSuggestions?.has(p.mappingId) && onApplySuggestion) {
                const topSuggestion = expressionSuggestions.get(p.mappingId)?.[0];
                if (topSuggestion) {
                  bottomBadges.push({
                    label: `💡 ${topSuggestion.label}`,
                    variant: 'suggestion',
                    cursor: 'pointer',
                    onClick: (e) => {
                      e.stopPropagation();
                      onApplySuggestion(p.mappingId, topSuggestion.expression);
                    },
                  });
                }
              }

              if (p.isFromPattern && !p.hasExpression && !p.driftSeverity) {
                bottomBadges.push({
                  label: '↻ pattern',
                  variant: 'pattern',
                });
              }

              if (p.confidenceScore != null && p.isPending) {
                bottomBadges.push({
                  label: `${p.confidenceScore}%`,
                  variant: p.confidenceScore > 80
                    ? 'confidence-high'
                    : p.confidenceScore >= 50
                      ? 'confidence-mid'
                      : 'confidence-low',
                });
              }

              return (
                <>
                  {topBadges.map((badge, index) => (
                    <CanvasBadge
                      key={`${p.mappingId}-top-${badge.variant}-${index}`}
                      x={midX}
                      y={midY - 10 - (index * 16)}
                      label={badge.label}
                      variant={badge.variant}
                      cursor={badge.cursor}
                      onClick={badge.onClick}
                    />
                  ))}
                  {bottomBadges.map((badge, index) => (
                    <CanvasBadge
                      key={`${p.mappingId}-bottom-${badge.variant}-${index}`}
                      x={midX}
                      y={midY + 10 + (index * 16)}
                      label={badge.label}
                      variant={badge.variant}
                      cursor={badge.cursor}
                      onClick={badge.onClick}
                    />
                  ))}
                </>
              );
            })()}
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
            {onRemapDragStart && !p.isPending && (
              <RemapHandle
                x={width}
                y={p.targetY}
                mappingId={p.mappingId}
                onDragStart={onRemapDragStart}
                onDragEnd={onRemapDragEnd}
              />
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
      className={`dm-canvas-badge dm-canvas-badge--${variant} ${onClick ? 'dm-canvas-badge--clickable' : ''}`}
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

const REMAP_TEXT_PREFIX = 'mapper-remap:';

function RemapHandle({
  x,
  y,
  mappingId,
  onDragStart,
  onDragEnd,
}: {
  x: number;
  y: number;
  mappingId: string;
  onDragStart: (mappingId: string) => void;
  onDragEnd?: () => void;
}) {
  const handleDragStart = useCallback((e: React.DragEvent) => {
    e.stopPropagation();
    e.dataTransfer.effectAllowed = 'move';
    const payload = JSON.stringify({ kind: 'remap', mappingId });
    e.dataTransfer.setData('application/mapper-remap', payload);
    e.dataTransfer.setData('text/plain', `${REMAP_TEXT_PREFIX}${payload}`);
    onDragStart(mappingId);
  }, [mappingId, onDragStart]);

  const handleDragEnd = useCallback(() => {
    onDragEnd?.();
  }, [onDragEnd]);

  const size = 14;
  const inset = 6;
  return (
    <foreignObject
      x={x - size - inset}
      y={y - size / 2}
      width={size}
      height={size}
      className="dm-remap-handle-fo"
    >
      <div
        draggable
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        className="dm-remap-handle"
        title="Drag to remap to a different target"
      />
    </foreignObject>
  );
}
