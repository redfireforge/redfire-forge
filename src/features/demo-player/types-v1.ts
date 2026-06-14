/** Demo Player — type definitions */

export interface DemoStep {
  /** Unique step ID for tracking */
  id: string;
  /** Short step title shown in the player */
  title: string;
  /** Longer description explaining what the user is seeing and why */
  description: string;
  /** CSS selector of the element to highlight (spotlight) */
  highlight?: string;
  /** Where to position the player panel relative to the highlighted element */
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'auto';
  /** Async action to execute when this step is reached */
  action?: (ctx: DemoActionContext) => Promise<void>;
  /** Optional delay (ms) after action before moving to next step in auto-play */
  pauseAfter?: number;
}

export interface DemoSuite {
  /** Unique suite ID */
  id: string;
  /** Suite display name */
  name: string;
  /** Short description shown in suite picker */
  description: string;
  /** Icon emoji or short string */
  icon: string;
  /** Estimated duration in minutes */
  estimatedMinutes: number;
  /** The ordered list of steps */
  steps: DemoStep[];
  /** Optional: tab to navigate to before starting */
  initialTab?: string;
}

export interface DemoActionContext {
  /** Navigate to a tab */
  navigateToTab: (tab: string) => void;
  /** Click an element by selector */
  click: (selector: string) => Promise<void>;
  /** Fill an input by selector */
  fill: (selector: string, value: string) => Promise<void>;
  /** Select an option in a <select> */
  selectOption: (selector: string, value: string) => Promise<void>;
  /** Wait for an element to appear */
  waitFor: (selector: string, timeout?: number) => Promise<void>;
  /** Small delay */
  delay: (ms: number) => Promise<void>;
}

export interface DemoPlayerState {
  /** Currently loaded suite */
  suite: DemoSuite | null;
  /** Current step index (0-based) */
  stepIndex: number;
  /** Is the player open/visible */
  isOpen: boolean;
  /** Is auto-play running */
  isPlaying: boolean;
  /** Auto-play speed in seconds per step */
  playSpeed: number;
}
