/** Demo Player — type definitions */

// ─── State Machine ───────────────────────────────────────────────
export type HubView = 'domains' | 'lessons' | 'concept' | 'live';
export type SpeedMultiplier = 0.5 | 1 | 1.5 | 2;

/** Minimum ms to display a step (floor, even for very short descriptions) */
export const MIN_STEP_DISPLAY = 4500;

/** Words-per-minute for reading time calculation.
 *  160 wpm = comfortable pace for reading while also looking at UI changes. */
const READING_WPM = 160;

/** Extra ms added when a step has a highlight — gives user time to
 *  glance between the narration panel and the spotlighted element. */
const LOOK_AT_TARGET_MS = 1500;

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
  /** docker compose command the user must run to start the required container. */
  dockerCommand?: string;
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
  highlight?: string;
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'auto';
  /** Invisible setup before spotlight (navigate to tab, switch mode, etc.) */
  preAction?: (ctx: DemoActionContext) => Promise<void>;
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
  lastDomain?: string;
  lastLesson?: string;
  /** Last navigation view the user was on — used to restore position after a hard refresh.
   *  Never stored as 'live' since live mode requires setup to have run. */
  lastView?: 'domains' | 'lessons' | 'concept';
  speed: SpeedMultiplier;
}

