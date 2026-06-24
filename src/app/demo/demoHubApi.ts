/** Minimal Demo Hub surface used by the app shell (no demo-player imports). */

export type DemoHubView = 'domains' | 'lessons' | 'concept' | 'live';

export type DemoHubStepPhase = 'pre' | 'spotlight' | 'reading' | 'action' | 'verify' | 'done' | 'idle';

export interface DemoHubLessonRef {
  initialTab?: string;
  allowedTabs?: string[];
}

export interface DemoHubStateSlice {
  view: DemoHubView;
  selectedLesson: DemoHubLessonRef | null;
  stepIndex: number;
  isPlaying: boolean;
  speed: number;
}

export interface DemoHubApi {
  state: DemoHubStateSlice;
  stepPhase: DemoHubStepPhase;
  exitLiveDemo: () => Promise<void>;
  nextStep: () => void;
  toggleAutoPlay: () => void;
  skipReading: () => void;
  restartDemo: () => void;
  confirmLessonComplete: () => void;
}

export const DEMO_HUB_STUB: DemoHubApi = {
  state: {
    view: 'domains',
    selectedLesson: null,
    stepIndex: 0,
    isPlaying: false,
    speed: 1,
  },
  stepPhase: 'idle',
  exitLiveDemo: async () => {},
  nextStep: () => {},
  toggleAutoPlay: () => {},
  skipReading: () => {},
  restartDemo: () => {},
  confirmLessonComplete: () => {},
};
