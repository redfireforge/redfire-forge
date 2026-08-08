/** Demo Player — type definitions */
import type { DemoInitialSurface } from '@shared/demoInitialSurface';

export type { DemoInitialSurface } from '@shared/demoInitialSurface';

// ─── State Machine ───────────────────────────────────────────────
export type HubView = 'domains' | 'lessons' | 'concept' | 'live';
export type SpeedMultiplier = 0.5 | 1 | 1.5 | 2;

/** Minimum ms to display a step (floor, even for very short descriptions) */
export const MIN_STEP_DISPLAY = 6500;

/** Words-per-minute for reading time calculation.
 *  130 wpm = slower pacing so users can read and track UI highlights. */
const READING_WPM = 130;

/** Extra ms added when a step has a highlight — gives user time to
 *  glance between the narration panel and the spotlighted element. */
const LOOK_AT_TARGET_MS = 2200;

/** Calculate how long a user needs to read a step's narration (ms). */
export function calcReadingTime(step: DemoStep): number {
  const words = (step.title + ' ' + step.description).split(/\s+/).length;
  const readMs = (words / READING_WPM) * 60_000;
  const lookMs = step.highlight ? LOOK_AT_TARGET_MS : 0;
  return Math.max(MIN_STEP_DISPLAY, Math.round(readMs + lookMs));
}

/** Phases within a single step's execution */
export type StepPhase = 'pre' | 'spotlight' | 'reading' | 'action' | 'verify' | 'done';

// ─── Content Types ───────────────────────────────────────────────
export interface DemoCategoryMeta {
  id: string;
  label: string;
  icon: string;
}

export interface DemoDomain {
  id: string;
  name: string;
  icon: string;
  description: string;
  lessons: DemoLesson[];
  available: boolean;
  /** When set, the lesson list shows filter tabs for these categories. */
  categories?: DemoCategoryMeta[];
}

export interface DemoLesson {
  id: string;
  domainId: string;
  /** Category within the domain (e.g. 'websocket', 'sse', 'kafka'). */
  category?: string;
  name: string;
  description: string;
  estimatedMinutes: number;
  initialTab?: string;
  /**
   * Sub-panel the `initialTab` should mount on, armed before the tab-switch
   * commit. Set this when step 1 targets a non-default sub-panel — otherwise
   * the tab paints its default view and `setup()` visibly hops to the right
   * one, which reads as a flash between Concept and step 1.
   */
  initialSurface?: DemoInitialSurface;
  /** Additional tabs the lesson may navigate to without triggering the auto-exit guard.
   *  Use when a lesson spans multiple app tabs (e.g. Workflow Builder → Workflow Runner). */
  allowedTabs?: string[];
  concept: ConceptContent;
  steps: DemoStep[];
  /** Runs once before step 0 — start servers, reset state, etc. */
  setup?: (ctx: DemoActionContext) => Promise<void>;
  /** Runs when exiting or restarting — disconnect, stop servers, reset UI */
  cleanup?: (ctx: DemoActionContext) => Promise<void>;
  /** Badge label shown on the lesson card (e.g. '🐳 Docker'). */
  tag?: string;
  /** HTTP or WS URL to probe before allowing the live demo to start.
   *  When set, LessonPlayer renders a PrerequisiteGate below the concept slide. */
  dockerEndpoint?: string;
  /** When multiple containers must be up (e.g. TLS + mTLS), all probes must succeed. */
  dockerEndpoints?: string[];
  /** Optional friendly names parallel to `dockerEndpoints` — overrides the port-derived labels in the gate. */
  dockerEndpointLabels?: string[];
  /** docker compose command the user must run to start the required container. */
  dockerCommand?: string;
  /** Optional PrerequisiteGate title (default: 🐳 Docker Required). */
  gateLabel?: string;
  /** GraphQL Studio demo tabs this lesson needs (default 1). User cap = 8 − tabBudget. */
  tabBudget?: number;
  /**
   * When true, skip creating a dedicated WebSocket/gRPC "demo" connection tab
   * at live-demo start. Use for lessons that teach the tab bar itself (e.g. Tabs
   * & Multi-Connection) — isolation add/rename/close flashes must not run.
   */
  skipStudioTabIsolation?: boolean;
  /** When true, the live demo can only run in the Tauri desktop app — web shows a gate and disables Start Demo. */
  desktopOnly?: boolean;
  /** Bumped when lesson content changes meaningfully (new steps, rewritten
   *  content). Users who completed an older version see an "Updated" badge.
   *  Defaults to 1 when omitted. */
  contentVersion?: number;
  /** How many steps the previous contentVersion had.
   *  Used as fallback for users who completed before step-count tracking
   *  was added — tells the UI which steps are genuinely new. */
  previousStepCount?: number;
}

export interface ConceptContent {
  title: string;
  body: string;
  keyTerms?: KeyTerm[];
  diagram?: string;
}

export interface KeyTerm {
  term: string;
  definition: string;
}

export interface DemoStep {
  id: string;
  title: string;
  description: string;
  /** Optional inline SVG diagram rendered below the step description. */
  diagram?: string;
  highlight?: string;
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'auto';
  /** Invisible setup before spotlight (navigate to tab, switch mode, etc.) */
  preAction?: (ctx: DemoActionContext) => Promise<void>;
  /** Poll/sync UI during reading pause (e.g. async IDB schema cache on Tauri). */
  readingSync?: (ctx: DemoActionContext, signal?: AbortSignal) => Promise<void>;
  /** Visible action after user has read narration (click button, etc.) */
  action?: (ctx: DemoActionContext) => Promise<void>;
  /** Selector to poll after action — step won't advance until this appears */
  verify?: string;
  fallbackImage?: string;
  /** Step display duration. A number overrides the auto-calculated reading time (ms);
   *  `true` keeps the auto-calculated reading time (used as an explicit "pause to read"
   *  marker). Otherwise the time is derived from word count. */
  pauseAfter?: number | boolean;
}

// ─── Action Context ──────────────────────────────────────────────
export interface DemoActionContext {
  navigateToTab: (tab: string) => void;
  click: (selector: string) => Promise<void>;
  fill: (selector: string, value: string) => Promise<void>;
  selectOption: (selector: string, value: string) => Promise<void>;
  waitFor: (selector: string, timeout?: number) => Promise<void>;
  delay: (ms: number) => Promise<void>;
}

// ─── Hub State ───────────────────────────────────────────────────
export interface DemoHubState {
  view: HubView;
  selectedDomain: DemoDomain | null;
  selectedLesson: DemoLesson | null;
  stepIndex: number;
  isPlaying: boolean;
  speed: SpeedMultiplier;
}

// ─── Progress Persistence ────────────────────────────────────────
export interface DemoProgress {
  completedLessons: string[];
  lessonSteps: Record<string, number>;
  /** Maps lesson id → contentVersion the user completed at.
   *  When a lesson's contentVersion exceeds the stored value the UI
   *  shows an "Updated" indicator so the user knows to re-review. */
  completedVersions: Record<string, number>;
  /** Maps lesson id → number of steps the lesson had when the user completed it.
   *  Steps beyond this count are shown as "new" in the sidebar. */
  completedStepCounts: Record<string, number>;
  lastDomain?: string;
  lastLesson?: string;
  /** Last navigation view the user was on — used to restore position after a hard refresh.
   *  Never stored as 'live' since live mode requires setup to have run. */
  lastView?: 'domains' | 'lessons' | 'concept';
  /** Last active category tab inside LessonList — takes priority over the
   *  selectedLesson.category hint so the correct protocol tab is restored
   *  even when the user browsed a tab without opening a specific lesson. */
  lastCategory?: string;
  speed: SpeedMultiplier;
}

