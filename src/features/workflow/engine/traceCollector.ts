/**
 * TraceCollector: Captures execution events during workflow runs for Phase 7e Visual Execution Replay.
 * Tracks node start/end times, state changes, variable snapshots, and edge traversals.
 */
import type { ExecutionEvent, ExecutionEventDetails } from '../../../shared/types';
import type { WorkflowNode } from '../types/workflow';

export class TraceCollector {
  private events: ExecutionEvent[] = [];
  private traversedEdges = new Set<string>();
  private nodeStartTimes = new Map<string, number>();
  private nodesById: Map<string, WorkflowNode>;

  constructor(nodes: WorkflowNode[]) {
    this.nodesById = new Map(nodes.map(n => [n.id, n]));
  }

  /**
   * Record that a node has started executing.
   */
  onNodeStart(nodeId: string): void {
    this.nodeStartTimes.set(nodeId, Date.now());
  }

  /**
   * Record that a node has completed execution.
   */
  onNodeComplete(
    nodeId: string,
    state: 'pass' | 'fail' | 'skipped',
    details?: ExecutionEventDetails,
  ): void {
    const node = this.nodesById.get(nodeId);
    if (!node) return;

    const startTime = this.nodeStartTimes.get(nodeId) ?? Date.now();
    
    const nodeType = node.type;
    const hasOwnTiming = nodeType === 'http' || nodeType === 'correlationWait' || nodeType === 'subWorkflow'
      || nodeType === 'wsConnect' || nodeType === 'wsSend' || nodeType === 'wsReceive'
      || nodeType === 'grpcUnary' || nodeType === 'grpcServerStream' || nodeType === 'grpcAssert'
      || nodeType === 'grpcLoadTest' || nodeType === 'grpcSchemaDiff' || nodeType === 'grpcMockAssert';
    
    let durationMs: number | undefined;
    if (hasOwnTiming) {
      if (details?.responseTimeMs !== undefined) {
        durationMs = details.responseTimeMs;
      } else if (nodeType === 'correlationWait' && details?.waitDurationMs !== undefined) {
        durationMs = details.waitDurationMs;
      } else if (nodeType === 'subWorkflow' && details?.subWorkflowTrace?.totalDurationMs !== undefined) {
        durationMs = details.subWorkflowTrace.totalDurationMs;
      } else {
        const endTime = Date.now();
        durationMs = endTime - startTime;
      }
    }

    const event: ExecutionEvent = {
      nodeId,
      nodeType: nodeType as ExecutionEvent['nodeType'],
      nodeLabel: (node.data as { label?: string })?.label || nodeType,
      timestamp: startTime,
      state,
      durationMs,
      details,
    };

    this.events.push(event);
    this.nodeStartTimes.delete(nodeId);
  }

  /**
   * Record that an edge was traversed (both source and target nodes executed).
   */
  onEdgeTraversed(edgeId: string): void {
    this.traversedEdges.add(edgeId);
  }

  /**
   * Get all recorded events in chronological order.
   */
  getEvents(): ExecutionEvent[] {
    return [...this.events].sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Get all traversed edge IDs.
   */
  getTraversedEdges(): string[] {
    return Array.from(this.traversedEdges);
  }

  /**
   * Clear all collected data (useful for new iteration).
   */
  reset(): void {
    this.events = [];
    this.traversedEdges.clear();
    this.nodeStartTimes.clear();
  }
}
