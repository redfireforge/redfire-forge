import { useMemo } from 'react';
import type { ConnectionLine } from './hooks/useConnectionLines';

interface MappingCanvasProps {
  lines: ConnectionLine[];
  width: number;
  height: number;
  selectedMappingId: string | null;
  onSelectMapping: (id: string | null) => void;
  onRemoveMapping: (id: string) => void;
  onEditExpression?: (mappingId: string) => void;
  onAcceptPending?: (id: string) => void;
  onRejectPending?: (id: string) => void;
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
  onSelectMapping,
  onRemoveMapping,
  onEditExpression,
  onAcceptPending,
  onRejectPending,
}: MappingCanvasProps) {
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
      viewBox={`0 0 ${width} ${Math.max(height, 100)}`}
    >
      {paths.map((p) => {
        const isSelected = p.mappingId === selectedMappingId;
        const isDimmed = selectedMappingId !== null && !isSelected;
        return (
          <g key={p.id}>
            {/* Wider invisible hit area for easier clicking */}
            <path
              d={p.d}
              fill="none"
              stroke="transparent"
              strokeWidth={12}
              style={{ cursor: 'pointer' }}
              onClick={() => onSelectMapping(isSelected ? null : p.mappingId)}
            />
            <path
              d={p.d}
              fill="none"
              className={`dm-connection-line ${isSelected ? 'dm-connection-line--selected' : ''} ${isDimmed ? 'dm-connection-line--dimmed' : ''} ${p.isAutoMapped ? 'dm-connection-line--auto' : ''} ${p.hasTypeMismatch ? 'dm-connection-line--mismatch' : ''} ${p.isPending ? 'dm-connection-line--pending' : ''}`}
              strokeWidth={isSelected ? 2.5 : 1.5}
            />
            {p.hasExpression && (
              <text
                x={width / 2}
                y={(p.sourceY + p.targetY) / 2 - 6}
                className="dm-expression-badge"
                textAnchor="middle"
                style={onEditExpression ? { cursor: 'pointer' } : undefined}
                onClick={onEditExpression ? (e) => { e.stopPropagation(); onEditExpression(p.mappingId); } : undefined}
              >
                fx
              </text>
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
