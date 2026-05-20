/**
 * Absolute-positioned overlays rendered inside the Results Explorer
 * `WorkflowExecutionCanvas` ReactFlow viewport:
 *
 * - `EdgePercentageOverlay` — % badge at the midpoint of each edge.
 * - `SwimLaneOverlay` — fork/join branch backgrounds with critical-path tab.
 *
 * Extracted from `WorkflowExecutionCanvas.tsx` to keep the parent file under
 * the monolithic-class threshold.
 */
import { useViewport } from '@xyflow/react';
import { BRANCH_COLORS, BRANCH_BORDER_COLORS } from '../utils/forkJoinDetection';

export interface EdgePercentageBadge {
  edgeId: string;
  pct: number;
  /** Midpoint in flow coordinates */
  x: number;
  y: number;
}

export function EdgePercentageOverlay({ badges }: { badges: EdgePercentageBadge[] }) {
  const { x, y, zoom } = useViewport();
  if (badges.length === 0) return null;
  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      {badges.map((b) => {
        const screenX = b.x * zoom + x;
        const screenY = b.y * zoom + y;
        const badgeScale = Math.max(0.6, Math.min(1.2, zoom));
        return (
          <div
            key={b.edgeId}
            className={`edge-pct-badge ${b.pct === 0 ? 'edge-pct-zero' : ''}`}
            style={{
              position: 'absolute',
              left: screenX,
              top: screenY,
              transform: `translate(-50%, -50%) scale(${badgeScale})`,
            }}
          >
            {b.pct}%
          </div>
        );
      })}
    </div>
  );
}

export interface SwimLaneBound {
  branchIndex: number;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isCriticalPath: boolean;
}

export function SwimLaneOverlay({ lanes }: { lanes: SwimLaneBound[] }) {
  const { x, y, zoom } = useViewport();
  if (lanes.length === 0) return null;
  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
      data-testid="swim-lane-overlay"
    >
      {lanes.map((lane) => {
        const colorIdx = lane.branchIndex % BRANCH_COLORS.length;
        const labelScale = Math.max(0.6, Math.min(1, zoom));
        const tabH = 20 * zoom;
        const screenX = lane.x * zoom + x;
        const screenY = lane.y * zoom + y - tabH;
        const screenW = lane.width * zoom;
        const screenH = lane.height * zoom + tabH;
        const borderColor = BRANCH_BORDER_COLORS[colorIdx];
        const tabBg = borderColor.replace('0.4)', '0.85)');

        return (
          <div
            key={`lane-${lane.branchIndex}`}
            className={`swim-lane${lane.isCriticalPath ? ' swim-lane-critical' : ''}`}
            style={{
              position: 'absolute',
              left: screenX,
              top: screenY,
              width: screenW,
              height: screenH,
            }}
            data-testid={`swim-lane-${lane.branchIndex}`}
          >
            {/* Tab label sitting on top edge */}
            <div
              className="swim-lane-label"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                height: tabH,
                display: 'flex',
                alignItems: 'center',
                gap: 6 * labelScale,
                padding: `0 ${8 * zoom}px`,
                fontSize: `${10 * labelScale}px`,
                fontWeight: 600,
                color: '#fff',
                background: tabBg,
                borderRadius: `${6 * zoom}px ${6 * zoom}px 0 0`,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                userSelect: 'none',
                whiteSpace: 'nowrap',
                maxWidth: screenW,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{lane.label}</span>
              {lane.isCriticalPath && (
                <span className="swim-lane-critical-badge" style={{ fontSize: `${9 * labelScale}px`, flexShrink: 0 }}>
                  ⏱ Critical Path
                </span>
              )}
            </div>
            {/* Body area */}
            <div
              style={{
                position: 'absolute',
                top: tabH,
                left: 0,
                width: '100%',
                height: screenH - tabH,
                background: BRANCH_COLORS[colorIdx],
                border: `2px ${lane.isCriticalPath ? 'solid' : 'dashed'} ${borderColor}`,
                borderTop: 'none',
                borderRadius: `0 ${6 * zoom}px ${6 * zoom}px ${6 * zoom}px`,
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
