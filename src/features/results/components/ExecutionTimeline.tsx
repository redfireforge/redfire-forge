import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { WorkflowExecutionTrace, WorkflowIterationTrace } from '../../../shared/types';
import { isSampledIteration } from '../utils/sampledIterations';
import {
  buildTimelineBars,
  generateTicks,
  getTimelineSpan,
  buildAggregateBars,
  calcP95,
  topologicalNodeOrder,
  type TimelineBar,
} from '../utils/timelineLayout';

const BAR_HEIGHT = 28;
const BAR_GAP = 4;
const ROW_HEIGHT = BAR_HEIGHT + BAR_GAP;
const LABEL_WIDTH = 160;
const AXIS_HEIGHT = 32;
const MIN_SVG_WIDTH = 400;
const PADDING_LEFT = 20;
const PADDING_RIGHT = 40;
const PADDING_TOP = 8;
const BAR_RADIUS = 4;
const MIN_VISIBLE_BAR_PX = 14;

const COLOR_PASS = '#22c55e';
const COLOR_FAIL = '#ef4444';
const COLOR_SKIPPED = '#64748b';
const COLOR_SUB_PASS = '#818cf8';
const COLOR_PASS_DIM = 'rgba(34, 197, 94, 0.4)';
const COLOR_FAIL_DIM = 'rgba(239, 68, 68, 0.4)';
const COLOR_SKIPPED_DIM = 'rgba(100, 116, 139, 0.4)';
const COLOR_SUB_PASS_DIM = 'rgba(129, 140, 248, 0.4)';

function barColor(state: 'pass' | 'fail' | 'skipped', nodeType?: string): string {
  if (state === 'fail') return COLOR_FAIL;
  if (state === 'skipped') return COLOR_SKIPPED;
  if (nodeType === 'subWorkflow') return COLOR_SUB_PASS;
  return COLOR_PASS;
}

function barColorDim(state: 'pass' | 'fail' | 'skipped', nodeType?: string): string {
  if (state === 'fail') return COLOR_FAIL_DIM;
  if (state === 'skipped') return COLOR_SKIPPED_DIM;
  if (nodeType === 'subWorkflow') return COLOR_SUB_PASS_DIM;
  return COLOR_PASS_DIM;
}

interface Props {
  trace: WorkflowExecutionTrace;
  selectedIteration: number | undefined;
  selectedNodeId?: string;
  onNodeClick?: (nodeId: string) => void;
  onDrillDown?: (childTrace: WorkflowExecutionTrace, parentNodeId: string) => void;
  searchQuery?: string;
  stateFilter?: 'all' | 'pass' | 'fail' | 'skipped';
}

export default function ExecutionTimeline({
  trace,
  selectedIteration,
  selectedNodeId,
  onNodeClick,
  onDrillDown,
  searchQuery = '',
  stateFilter = 'all',
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [hoveredBar, setHoveredBar] = useState<TimelineBar | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [chartWidth, setChartWidth] = useState(0);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const obs = new ResizeObserver(entries => {
      for (const entry of entries) {
        setChartWidth(entry.contentRect.width);
      }
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const isAggregate = selectedIteration === undefined;

  const currentIteration = useMemo<WorkflowIterationTrace | undefined>(() => {
    if (selectedIteration === undefined) return undefined;
    return trace.iterations[selectedIteration];
  }, [trace.iterations, selectedIteration]);

  const bars = useMemo<TimelineBar[]>(() => {
    if (!isAggregate && currentIteration) {
      return buildTimelineBars(currentIteration.events);
    }
    const allBars = buildAggregateBars(trace.iterations);
    return allBars.length > 0 ? allBars[0] : [];
  }, [isAggregate, currentIteration, trace.iterations]);

  const aggregateBarSets = useMemo<TimelineBar[][] | null>(() => {
    if (!isAggregate) return null;
    return buildAggregateBars(trace.iterations);
  }, [isAggregate, trace.iterations]);

  const topoOrder = useMemo(
    () => topologicalNodeOrder(
      trace.workflowSnapshot.nodes as Array<{ id: string; type?: string; data?: { label?: string; name?: string } }>,
      trace.workflowSnapshot.edges as Array<{ source: string; target: string }>,
    ),
    [trace.workflowSnapshot.nodes, trace.workflowSnapshot.edges],
  );

  // Build ordered list of unique nodes following topological (execution) order
  // Includes skipped nodes (in snapshot but with no events) as empty rows
  const snapshotNodes = trace.workflowSnapshot.nodes as Array<{ id: string; type?: string; data?: { label?: string; name?: string } }>;

  const uniqueNodes = useMemo(() => {
    const barMap = new Map<string, TimelineBar>();
    if (isAggregate && aggregateBarSets) {
      for (const iterBars of aggregateBarSets) {
        for (const bar of iterBars) {
          if (!barMap.has(bar.nodeId)) barMap.set(bar.nodeId, bar);
        }
      }
    } else {
      for (const bar of bars) {
        if (!barMap.has(bar.nodeId)) barMap.set(bar.nodeId, bar);
      }
    }

    const ordered: TimelineBar[] = [];
    for (const nodeId of topoOrder) {
      const bar = barMap.get(nodeId);
      if (bar) {
        ordered.push(bar);
        barMap.delete(nodeId);
      } else {
        const snapNode = snapshotNodes.find(n => n.id === nodeId);
        if (snapNode) {
          ordered.push({
            nodeId,
            nodeLabel: snapNode.data?.label || snapNode.data?.name || nodeId,
            nodeType: snapNode.type || 'unknown',
            state: 'skipped',
            startMs: 0,
            durationMs: 0,
            lane: 0,
          });
        }
      }
    }
    for (const bar of barMap.values()) {
      ordered.push(bar);
    }
    return ordered;
  }, [bars, isAggregate, aggregateBarSets, topoOrder, snapshotNodes]);

  // Compute aggregate state per node (same logic as modal's nodeStateCounts)
  const nodeAggregateState = useMemo(() => {
    const stateMap = new Map<string, 'pass' | 'fail' | 'skipped'>();
    for (const bar of uniqueNodes) {
      stateMap.set(bar.nodeId, 'skipped');
    }
    for (const iter of trace.iterations) {
      for (const ev of iter.events) {
        if (!stateMap.has(ev.nodeId)) continue;
        const cur = stateMap.get(ev.nodeId)!;
        if (ev.state === 'fail') stateMap.set(ev.nodeId, 'fail');
        else if (ev.state === 'pass' && cur !== 'fail') stateMap.set(ev.nodeId, 'pass');
      }
    }
    return stateMap;
  }, [uniqueNodes, trace.iterations]);

  // Search/filter: which nodes match?
  const matchingNodeIds = useMemo(() => {
    const searchLower = searchQuery.toLowerCase().trim();
    const matched = new Set<string>();
    for (const bar of uniqueNodes) {
      const matchesSearch = !searchLower || bar.nodeLabel.toLowerCase().includes(searchLower);
      const aggState = nodeAggregateState.get(bar.nodeId) ?? bar.state;
      const matchesState = stateFilter === 'all' || aggState === stateFilter;
      if (matchesSearch && matchesState) matched.add(bar.nodeId);
    }
    return matched;
  }, [uniqueNodes, nodeAggregateState, searchQuery, stateFilter]);

  /*
   * Timeline visual rules:
   *
   * Universal node rule (always applies, never overridden):
   *   • Executed node (aggState pass/fail) → green dot + bold + full opacity + green bars
   *   • Not-executed node (aggState skipped) → gray dot + normal weight + dim (0.3) + no bars
   *
   * Filter buttons (Pass/Fail/Skip) and search:
   *   • All nodes remain visible — full timeline context is preserved.
   *   • Matching nodes get a subtle indigo highlight (background tint + left accent bar)
   *     on the label row AND a faint indigo strip across the chart row, so they're easy
   *     to spot without changing dot color, weight, or opacity.
   *   • When 0 matches (e.g. Fail(0)) → overlay shown.
   */
  const filterActive = searchQuery.trim() !== '' || stateFilter !== 'all';
  const noMatches = filterActive && matchingNodeIds.size === 0;

  // Map nodeId → row index (kept against full list since rows are never hidden).
  const nodeRowIndex = useMemo(() => {
    const map = new Map<string, number>();
    uniqueNodes.forEach((bar, i) => map.set(bar.nodeId, i));
    return map;
  }, [uniqueNodes]);

  const barSpanMs = useMemo(() => {
    if (!isAggregate) return getTimelineSpan(bars);
    if (!aggregateBarSets || aggregateBarSets.length === 0) return 0;
    return Math.max(...aggregateBarSets.map(getTimelineSpan));
  }, [bars, isAggregate, aggregateBarSets]);

  const rowCount = uniqueNodes.length;

  const aggregateP95 = useMemo(() => {
    if (!isAggregate) return 0;
    const durations = trace.iterations
      .filter(isSampledIteration)
      .map(i => i.durationMs);
    return calcP95(durations);
  }, [isAggregate, trace.iterations]);

  const aggregateAvg = useMemo(() => {
    if (!isAggregate) return 0;
    const durations = trace.iterations
      .filter(isSampledIteration)
      .map(i => i.durationMs);
    return durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
  }, [isAggregate, trace.iterations]);

  // totalMs drives the time axis: use bar span, but extend to include avg/P95 markers
  const totalMs = useMemo(() => {
    if (!isAggregate) return barSpanMs;
    return Math.max(barSpanMs, aggregateP95 * 1.02);
  }, [isAggregate, barSpanMs, aggregateP95]);

  const ticks = useMemo(() => generateTicks(totalMs), [totalMs]);

  const baseWidth = chartWidth > 0 ? chartWidth : MIN_SVG_WIDTH;
  const svgWidth = Math.max(MIN_SVG_WIDTH, baseWidth * zoom);
  const svgHeight = AXIS_HEIGHT + PADDING_TOP + Math.max(1, rowCount) * ROW_HEIGHT + 16;

  const msToX = useCallback((ms: number) => {
    if (totalMs <= 0) return PADDING_LEFT;
    return PADDING_LEFT + (ms / totalMs) * (svgWidth - PADDING_LEFT - PADDING_RIGHT);
  }, [totalMs, svgWidth]);

  const handleBarClick = useCallback((bar: TimelineBar) => {
    onNodeClick?.(bar.nodeId);
  }, [onNodeClick]);

  const handleBarMouseEnter = useCallback((bar: TimelineBar, e: React.MouseEvent) => {
    setHoveredBar(bar);
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      setTooltipPos({ x: e.clientX - rect.left + 12, y: e.clientY - rect.top - 8 });
    }
  }, []);

  const handleBarMouseLeave = useCallback(() => {
    setHoveredBar(null);
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setZoom(prev => Math.max(0.1, Math.min(10, prev * delta)));
    }
  }, []);

  const handlePaneClick = useCallback(() => {
    onNodeClick?.('');
  }, [onNodeClick]);

  const renderBar = useCallback((bar: TimelineBar, opacity = 1, key?: string) => {
    const rowIdx = nodeRowIndex.get(bar.nodeId) ?? 0;
    const x = msToX(bar.startMs);
    const rawWidth = msToX(bar.startMs + bar.durationMs) - x;
    const width = Math.max(rawWidth, MIN_VISIBLE_BAR_PX);
    const y = AXIS_HEIGHT + PADDING_TOP + rowIdx * ROW_HEIGHT;
    const isSelected = bar.nodeId === selectedNodeId;

    const color = opacity < 1 ? barColorDim(bar.state, bar.nodeType) : barColor(bar.state, bar.nodeType);

    return (
      <rect
        key={key ?? `${bar.nodeId}-${bar.startMs}`}
        x={x}
        y={y}
        width={width}
        height={BAR_HEIGHT}
        rx={BAR_RADIUS}
        ry={BAR_RADIUS}
        fill={color}
        opacity={opacity}
        stroke={isSelected ? '#fff' : 'none'}
        strokeWidth={isSelected ? 2 : 0}
        className="timeline-bar"
        data-testid={`timeline-bar-${bar.nodeId}`}
        onClick={() => handleBarClick(bar)}
        onMouseEnter={(e) => handleBarMouseEnter(bar, e)}
        onMouseLeave={handleBarMouseLeave}
        style={{ cursor: 'pointer' }}
      />
    );
  }, [msToX, nodeRowIndex, selectedNodeId, handleBarClick, handleBarMouseEnter, handleBarMouseLeave]);

  const handleDrillDownClick = useCallback((bar: TimelineBar, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onDrillDown || bar.nodeType !== 'subWorkflow') return;
    const iter = currentIteration ?? trace.iterations[0];
    if (!iter) return;
    const ev = iter.events.find(ev => ev.nodeId === bar.nodeId);
    const childTrace = ev?.details?.subWorkflowTrace;
    if (childTrace) onDrillDown(childTrace, bar.nodeId);
  }, [onDrillDown, currentIteration, trace.iterations]);

  const renderDrillDownIcon = useCallback((bar: TimelineBar) => {
    if (bar.nodeType !== 'subWorkflow' || !onDrillDown) return null;
    const rowIdx = nodeRowIndex.get(bar.nodeId) ?? 0;
    const x = msToX(bar.startMs);
    const rawWidth = msToX(bar.startMs + bar.durationMs) - x;
    const width = Math.max(rawWidth, MIN_VISIBLE_BAR_PX);
    const y = AXIS_HEIGHT + PADDING_TOP + rowIdx * ROW_HEIGHT;
    const iconSize = 14;
    const iconX = x + width - iconSize - 3;
    const iconY = y + (BAR_HEIGHT - iconSize) / 2;

    return (
      <g
        key={`drill-${bar.nodeId}`}
        className="timeline-drilldown-icon"
        onClick={(e) => handleDrillDownClick(bar, e)}
        style={{ cursor: 'pointer' }}
        data-testid={`timeline-drilldown-${bar.nodeId}`}
      >
        <circle
          cx={iconX + iconSize / 2}
          cy={iconY + iconSize / 2}
          r={iconSize / 2}
          fill="rgba(255,255,255,0.85)"
        />
        <text
          x={iconX + iconSize / 2}
          y={iconY + iconSize / 2 + 1}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize="9"
          fontWeight="700"
          fill="#4f46e5"
        >⤵</text>
      </g>
    );
  }, [nodeRowIndex, msToX, onDrillDown, handleDrillDownClick]);

  if (bars.length === 0 && !isAggregate) {
    return (
      <div className="timeline-empty" data-testid="timeline-empty">
        <p>No execution events to display</p>
      </div>
    );
  }

  return (
    <div className="timeline-container" ref={containerRef} data-testid="execution-timeline">
      {/* Label column */}
      <div className="timeline-labels" style={{ width: LABEL_WIDTH }}>
        <div className="timeline-label-header" style={{ height: AXIS_HEIGHT + PADDING_TOP }}>
          Node
        </div>
        {uniqueNodes.map(bar => {
          const aggState = nodeAggregateState.get(bar.nodeId) ?? bar.state;
          const executed = aggState !== 'skipped';

          const isSubWorkflow = bar.nodeType === 'subWorkflow';
          const dotClass = !executed ? 'skipped' : isSubWorkflow ? 'subworkflow' : 'pass';
          const bold = executed;
          const baseOpacity = executed ? 1 : 0.3;
          const isMatched = filterActive && matchingNodeIds.has(bar.nodeId);
          const searchActive = searchQuery.trim() !== '';
          const labelOpacity = searchActive && !matchingNodeIds.has(bar.nodeId) ? 0.3 : baseOpacity;

          const classes = ['timeline-label-row'];
          if (bar.nodeId === selectedNodeId) classes.push('timeline-label-selected');
          if (isMatched) classes.push('timeline-label-matched');

          return (
            <div
              key={bar.nodeId}
              className={classes.join(' ')}
              style={{ height: ROW_HEIGHT, fontWeight: bold ? 600 : 400, opacity: labelOpacity }}
              onClick={() => onNodeClick?.(bar.nodeId)}
              data-testid={`timeline-label-${bar.nodeId}`}
            >
              <span className={`timeline-node-dot timeline-dot-${dotClass}`} />
              <span className="timeline-label-text" title={bar.nodeLabel}>
                {bar.nodeLabel}
              </span>
              {isSubWorkflow && <span className="timeline-sub-badge">SUB</span>}
            </div>
          );
        })}
      </div>

      {/* SVG chart area */}
      <div
        ref={scrollRef}
        className="timeline-chart-scroll"
        onWheel={handleWheel}
      >
        <svg
          width={svgWidth}
          height={svgHeight}
          className="timeline-svg"
          data-testid="timeline-svg"
          onClick={handlePaneClick}
        >
          {/* Time axis */}
          <line
            x1={PADDING_LEFT}
            y1={AXIS_HEIGHT}
            x2={svgWidth}
            y2={AXIS_HEIGHT}
            stroke="#334155"
            strokeWidth={1}
          />
          {ticks.map(tick => {
            const x = msToX(tick.positionMs);
            return (
              <g key={tick.positionMs} data-testid={`timeline-tick-${tick.positionMs}`}>
                <line x1={x} y1={AXIS_HEIGHT - 6} x2={x} y2={AXIS_HEIGHT} stroke="#475569" strokeWidth={1} />
                <text
                  x={x}
                  y={AXIS_HEIGHT - 10}
                  textAnchor="middle"
                  className="timeline-tick-label"
                >
                  {tick.label}
                </text>
                {/* Grid line */}
                <line
                  x1={x}
                  y1={AXIS_HEIGHT}
                  x2={x}
                  y2={svgHeight}
                  stroke="#1e293b"
                  strokeWidth={1}
                  strokeDasharray="4 4"
                />
              </g>
            );
          })}

          {/* Aggregate mode: P95 and Avg markers */}
          {isAggregate && totalMs > 0 && (
            <>
              <line
                x1={msToX(aggregateAvg)}
                y1={AXIS_HEIGHT}
                x2={msToX(aggregateAvg)}
                y2={svgHeight}
                stroke="#60a5fa"
                strokeWidth={1.5}
                strokeDasharray="6 3"
                data-testid="timeline-avg-marker"
              />
              <text
                x={msToX(aggregateAvg)}
                y={AXIS_HEIGHT + 14}
                textAnchor="start"
                className="timeline-marker-label timeline-marker-avg"
                dx={4}
              >
                avg
              </text>
              <line
                x1={msToX(aggregateP95)}
                y1={AXIS_HEIGHT}
                x2={msToX(aggregateP95)}
                y2={svgHeight}
                stroke="#f59e0b"
                strokeWidth={1.5}
                strokeDasharray="6 3"
                data-testid="timeline-p95-marker"
              />
              <text
                x={msToX(aggregateP95)}
                y={AXIS_HEIGHT + 14}
                textAnchor="start"
                className="timeline-marker-label timeline-marker-p95"
                dx={4}
              >
                P95
              </text>
            </>
          )}

          {/* Highlight strips for filter-matched rows (drawn beneath bars) */}
          {filterActive && uniqueNodes.map(node => {
            if (!matchingNodeIds.has(node.nodeId)) return null;
            const rowIdx = nodeRowIndex.get(node.nodeId) ?? 0;
            const stripY = AXIS_HEIGHT + PADDING_TOP + rowIdx * ROW_HEIGHT - 2;
            return (
              <rect
                key={`match-strip-${node.nodeId}`}
                x={0}
                y={stripY}
                width={svgWidth}
                height={ROW_HEIGHT}
                fill="#6366f1"
                opacity={0.1}
                data-testid={`timeline-match-strip-${node.nodeId}`}
              />
            );
          })}

          {/* Bars */}
          {isAggregate && aggregateBarSets
            ? aggregateBarSets.map((iterBars, iterIdx) =>
                iterBars.map(bar =>
                  renderBar(bar, 0.5, `agg-${iterIdx}-${bar.nodeId}-${bar.startMs}`),
                ),
              )
            : bars.map(bar => renderBar(bar))
          }

          {/* Drill-down icons on sub-workflow bars */}
          {!isAggregate && bars.map(bar => renderDrillDownIcon(bar))}
        </svg>
      </div>

      {/* Tooltip */}
      {hoveredBar && (
        <div
          className="timeline-tooltip"
          style={{ left: tooltipPos.x, top: tooltipPos.y }}
          data-testid="timeline-tooltip"
        >
          <div className="timeline-tooltip-title">{hoveredBar.nodeLabel}</div>
          <div className="timeline-tooltip-row">
            <span className="timeline-tooltip-key">Status</span>
            <span className={`timeline-tooltip-val timeline-tooltip-${hoveredBar.state}`}>
              {hoveredBar.state}
            </span>
          </div>
          <div className="timeline-tooltip-row">
            <span className="timeline-tooltip-key">Duration</span>
            <span className="timeline-tooltip-val">{hoveredBar.durationMs.toFixed(0)}ms</span>
          </div>
          {hoveredBar.statusCode !== undefined && (
            <div className="timeline-tooltip-row">
              <span className="timeline-tooltip-key">HTTP</span>
              <span className="timeline-tooltip-val">{hoveredBar.statusCode}</span>
            </div>
          )}
          <div className="timeline-tooltip-row">
            <span className="timeline-tooltip-key">Start</span>
            <span className="timeline-tooltip-val">+{hoveredBar.startMs.toFixed(0)}ms</span>
          </div>
          <div className="timeline-tooltip-row">
            <span className="timeline-tooltip-key">Type</span>
            <span className="timeline-tooltip-val">{hoveredBar.nodeType}</span>
          </div>
        </div>
      )}

      {/* Zoom indicator */}
      {zoom !== 1 && (
        <div className="timeline-zoom-badge" data-testid="timeline-zoom-badge">
          {Math.round(zoom * 100)}%
        </div>
      )}

      {/* No matches overlay */}
      {noMatches && (
        <div className="timeline-no-matches" data-testid="timeline-no-matches">
          No {stateFilter !== 'all' ? stateFilter : 'matching'} nodes
        </div>
      )}
    </div>
  );
}
