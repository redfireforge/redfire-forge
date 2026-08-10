/**
 * Demo boot: initial surface hint.
 *
 * When a live demo starts, the app switches to the lesson's `initialTab` and
 * the lesson's `setup()` then navigates to whichever sub-panel step 1 targets
 * (e.g. gRPC Studio → Advanced → Mock server). That navigation happens *after*
 * the tab has already painted its default sub-panel, so the viewer sees a
 * brief unrelated screen before step 1 lands.
 *
 * This module lets a lesson declare its landing surface *before* the tab
 * mounts. Page components read the hint in their `useState` initializer, so
 * the very first paint is already the correct sub-panel — no post-mount hop to
 * hide, and therefore no interstitial veil needed.
 *
 * Module-level state (not storage) is deliberate: the hint must be readable
 * synchronously inside a React state initializer during the same commit that
 * `navigateToTab` triggers.
 */

/** gRPC Studio top-level panel view. Mirrors `GrpcStudioPanelView`. */
export type DemoGrpcPanelView = 'studio' | 'collections' | 'history' | 'advanced';

/** gRPC Studio Advanced sub-tab. Mirrors `GrpcAdvancedFeatureTab`. */
export type DemoGrpcAdvancedTab =
  | 'load_test'
  | 'mock_server'
  | 'schema_diff'
  | 'rpc_statistics'
  | 'native_diagnostics';

/** API Catalog main-panel sub-view. Mirrors `ApiCatalog` view tabs. */
export type DemoCatalogView = 'overview' | 'endpoints' | 'export' | 'published';

export interface DemoInitialSurface {
  /** Land gRPC Studio on this panel instead of the default `studio` view. */
  grpcPanelView?: DemoGrpcPanelView;
  /** Land the gRPC Advanced shell on this tab instead of the default `load_test`. */
  grpcAdvancedTab?: DemoGrpcAdvancedTab;
  /** Land API Catalog on this sub-view instead of restoring a saved Overview hop. */
  catalogView?: DemoCatalogView;
}

let pendingSurface: DemoInitialSurface | null = null;

/** Dispatched when the armed surface changes so already-mounted pages can sync. */
export const DEMO_INITIAL_SURFACE_EVENT = 'demo-initial-surface';

function notifySurfaceChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(DEMO_INITIAL_SURFACE_EVENT));
}

/** Arm the hint. Call immediately before the tab-switch commit. */
export function setDemoInitialSurface(surface: DemoInitialSurface | null): void {
  pendingSurface = surface && Object.keys(surface).length > 0 ? { ...surface } : null;
  notifySurfaceChanged();
}

/**
 * Read the hint without clearing it. Multiple components consume the same
 * hint during one mount (panel view + advanced tab live in different trees),
 * so reads must be non-destructive.
 */
export function peekDemoInitialSurface(): DemoInitialSurface | null {
  return pendingSurface;
}

/** Disarm the hint once boot has landed, so later manual tab switches are unaffected. */
export function clearDemoInitialSurface(): void {
  pendingSurface = null;
  notifySurfaceChanged();
}
