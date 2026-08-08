/** Shared fit-view options for Results Explorer replay canvas controls. */
import { getNodesBounds, getViewportForBounds } from '@xyflow/react';
import type { Node } from '@xyflow/react';

export const REPLAY_CANVAS_FIT_VIEW_OPTIONS = {
  /** Tight padding so compact chains fill the diagram pane (matches Workflow Designer feel). */
  padding: 0.08,
  duration: 300,
  /** Allow zoom-in on small graphs; ReactFlow canvas maxZoom is 2.0. */
  maxZoom: 2,
  minZoom: 0.25,
  includeHiddenNodes: true,
} as const;

const DEFAULT_NODE_WIDTH = 220;
const DEFAULT_NODE_HEIGHT = 80;
const MAX_FIT_ATTEMPTS = 14;

type Viewport = { x: number; y: number; zoom: number };
type Rect = { x: number; y: number; width: number; height: number };

type FitViewCapable = {
  fitView: (options?: {
    padding?: number;
    duration?: number;
    maxZoom?: number;
    minZoom?: number;
    includeHiddenNodes?: boolean;
    nodes?: Node[];
  }) => void | Promise<boolean>;
  getNodes?: () => Node[];
  /** Prefer store-aware bounds from useReactFlow (avoids sub-flow console warning). */
  getNodesBounds?: (nodes: (Node | string)[]) => Rect;
  setViewport?: (viewport: Viewport, options?: { duration?: number }) => void | Promise<boolean>;
};

function normalizeNodesForBounds(nodes: Node[]): Node[] {
  return nodes.map((node) => ({
    ...node,
    width: node.measured?.width ?? node.width ?? DEFAULT_NODE_WIDTH,
    height: node.measured?.height ?? node.height ?? DEFAULT_NODE_HEIGHT,
  }));
}

/**
 * Bounds for fit-view. Prefer instance.getNodesBounds (useReactFlow); otherwise
 * pass nodeLookup so the standalone util does not warn about sub-flows.
 */
function computeNodesBounds(nodes: Node[], instance?: FitViewCapable | null): Rect {
  const normalized = normalizeNodesForBounds(nodes);
  if (typeof instance?.getNodesBounds === 'function') {
    return instance.getNodesBounds(normalized);
  }
  const nodeLookup = new Map(normalized.map((node) => [node.id, node]));
  // Standalone util requires nodeLookup when not called via useReactFlow.
  return getNodesBounds(normalized, { nodeLookup: nodeLookup as never });
}

function hasFitBounds(nodes: Node[], instance?: FitViewCapable | null): boolean {
  if (nodes.length === 0) return false;
  const bounds = computeNodesBounds(nodes, instance);
  return bounds.width > 0 && bounds.height > 0;
}

function resolveDiagramPane(containerEl?: HTMLElement | null): HTMLElement | null {
  if (containerEl) {
    const flow = containerEl.classList.contains('react-flow')
      ? containerEl
      : containerEl.querySelector<HTMLElement>('.react-flow');
    if (flow && flow.clientWidth > 0 && flow.clientHeight > 0) return flow;
  }
  return document.querySelector<HTMLElement>('.results-explorer-canvas-wrap .react-flow')
    ?? document.querySelector<HTMLElement>('.results-explorer-diagram .react-flow');
}

/**
 * Fit nodes into the Results Explorer diagram pane.
 *
 * Prefer setViewport + getViewportForBounds (deterministic, matches Workflow Designer
 * outcomes). xyflow's fitView() queues via fitViewQueued and can silently no-op when
 * nodesInitialized/measured lag — which is why the toolbar Fit view felt broken.
 */
export function runReplayFitView(
  instance: FitViewCapable | null | undefined,
  options: typeof REPLAY_CANVAS_FIT_VIEW_OPTIONS = REPLAY_CANVAS_FIT_VIEW_OPTIONS,
  containerEl?: HTMLElement | null,
): boolean {
  if (!instance) return false;

  const nodes = instance.getNodes?.() ?? [];
  const fitOpts = {
    padding: options.padding,
    duration: options.duration,
    maxZoom: options.maxZoom,
    minZoom: options.minZoom,
    includeHiddenNodes: options.includeHiddenNodes,
  };

  if (nodes.length === 0) {
    // Store may still have nodes even when getNodes isn't available — match Designer.
    void instance.fitView(fitOpts);
    return true;
  }

  if (!hasFitBounds(nodes, instance)) {
    // Last resort: ask React Flow to fit whatever it has measured.
    void instance.fitView(fitOpts);
    return true;
  }

  const bounds = computeNodesBounds(nodes, instance);
  const pane = resolveDiagramPane(containerEl);
  const width = pane?.clientWidth ?? 0;
  const height = pane?.clientHeight ?? 0;

  if (width > 0 && height > 0 && typeof instance.setViewport === 'function') {
    const viewport = getViewportForBounds(
      bounds,
      width,
      height,
      options.minZoom,
      options.maxZoom,
      options.padding,
    );
    void instance.setViewport(viewport, { duration: options.duration });
    return true;
  }

  // Fallback when pane size is unknown — same options as Workflow Designer Fit view.
  void instance.fitView(fitOpts);
  return true;
}

/**
 * Defer fit until after React Flow has measured nodes and the diagram pane
 * has its final layout size (detail panel / console resize).
 */
export function scheduleReplayFitView(
  instance: FitViewCapable | null | undefined,
  options: typeof REPLAY_CANVAS_FIT_VIEW_OPTIONS = REPLAY_CANVAS_FIT_VIEW_OPTIONS,
  containerEl?: HTMLElement | null,
): boolean {
  if (!instance) return false;

  let attempts = 0;
  const attempt = () => {
    const nodes = instance.getNodes?.() ?? [];
    if (nodes.length > 0 && (hasFitBounds(nodes, instance) || attempts >= MAX_FIT_ATTEMPTS - 1)) {
      runReplayFitView(instance, options, containerEl);
      return;
    }
    attempts += 1;
    if (attempts < MAX_FIT_ATTEMPTS) {
      requestAnimationFrame(attempt);
      return;
    }
    runReplayFitView(instance, options, containerEl);
  };

  requestAnimationFrame(() => {
    requestAnimationFrame(attempt);
  });
  return true;
}
