/**
 * Onboarding hints shown to first-time users of the Workflow Designer.
 * Each hint is shown once, then dismissed permanently via localStorage.
 */

export interface OnboardingHint {
  id: string;
  target: string;
  title: string;
  message: string;
  placement: 'top' | 'bottom' | 'left' | 'right';
  triggerOn: 'mount' | 'first-node' | 'empty-canvas';
  priority: number;
}

export const ONBOARDING_HINTS: OnboardingHint[] = [
  {
    id: 'palette-drag',
    target: '.wf-palette-block',
    title: 'Drag to Add Nodes',
    message: 'Drag any block from here onto the canvas to add it to your workflow.',
    placement: 'right',
    triggerOn: 'mount',
    priority: 1,
  },
  {
    id: 'command-palette',
    target: '.wf-canvas-area',
    title: 'Quick Commands',
    message: 'Press ⌘K (or Ctrl+K) anytime to open the command palette for quick actions.',
    placement: 'top',
    triggerOn: 'empty-canvas',
    priority: 2,
  },
  {
    id: 'node-config',
    target: '.wf-node',
    title: 'Configure Node',
    message: 'Double-click any node to open its configuration panel and customize its settings.',
    placement: 'top',
    triggerOn: 'first-node',
    priority: 3,
  },
  {
    id: 'connect-nodes',
    target: '.wf-node',
    title: 'Connect Nodes',
    message: 'Drag from a node\'s output handle (bottom) to another node\'s input handle (top) to create a connection.',
    placement: 'bottom',
    triggerOn: 'first-node',
    priority: 4,
  },
  {
    id: 'quick-test',
    target: '.wf-quick-test-btn',
    title: 'Run Your Workflow',
    message: 'Click the play button or press ⌘Enter to execute your workflow and see results in real-time.',
    placement: 'bottom',
    triggerOn: 'first-node',
    priority: 5,
  },
];

export const ONBOARDING_STORAGE_KEY = 'redfire-onboarding-dismissed';
