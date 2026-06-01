/**
 * SVG icon badges for workflow nodes (Phase 1 Visual Foundation).
 * Each icon is a Lucide-style SVG rendered in a colored badge container.
 */

type Category = 'trigger' | 'action' | 'logic' | 'data' | 'flow' | 'terminal' | 'integration';

interface NodeIconProps {
  type: string;
  className?: string;
}

const ICON_MAP: Record<string, { category: Category; svg: React.ReactElement }> = {
  start: {
    category: 'trigger',
    svg: <polygon points="6 3 20 12 6 21 6 3" />,
  },
  end: {
    category: 'terminal',
    svg: <rect x="6" y="6" width="12" height="12" rx="2" />,
  },
  http: {
    category: 'action',
    svg: (
      <>
        <path d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.66 0 3-4.03 3-9s-1.34-9-3-9m0 18c-1.66 0-3-4.03-3-9s1.34-9 3-9" />
      </>
    ),
  },
  kafkaProduce: {
    category: 'integration',
    svg: (
      <>
        <rect x="4" y="5" width="14" height="14" rx="2" />
        <path d="M14 9l4 3-4 3" />
        <path d="M10 12h8" />
      </>
    ),
  },
  kafkaConsume: {
    category: 'integration',
    svg: (
      <>
        <rect x="6" y="5" width="14" height="14" rx="2" />
        <path d="M10 9l-4 3 4 3" />
        <path d="M6 12h8" />
      </>
    ),
  },
  kafkaTrigger: {
    category: 'trigger',
    svg: (
      <>
        {/* Lightning bolt (trigger) overlaid with Kafka-style arrow */}
        <path d="M13 2L4.5 13H11L10 22L19.5 11H13L13 2Z" />
      </>
    ),
  },
  kafkaWait: {
    category: 'integration',
    svg: (
      <>
        {/* Pause bars inside a rounded rect — represents wait/correlation */}
        <rect x="4" y="5" width="14" height="14" rx="2" />
        <line x1="9"  y1="9" x2="9"  y2="15" strokeWidth="2" />
        <line x1="13" y1="9" x2="13" y2="15" strokeWidth="2" />
      </>
    ),
  },
  condition: {
    category: 'logic',
    svg: (
      <>
        <polyline points="16 3 21 3 21 8" />
        <line x1="4" y1="20" x2="21" y2="3" />
        <polyline points="21 16 21 21 16 21" />
        <line x1="15" y1="15" x2="21" y2="21" />
        <line x1="4" y1="4" x2="9" y2="9" />
      </>
    ),
  },
  delay: {
    category: 'action',
    svg: (
      <>
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </>
    ),
  },
  fork: {
    category: 'flow',
    svg: (
      <>
        <line x1="12" y1="3" x2="12" y2="9" />
        <line x1="12" y1="9" x2="5" y2="16" />
        <line x1="12" y1="9" x2="19" y2="16" />
        <circle cx="5" cy="18" r="2" />
        <circle cx="19" cy="18" r="2" />
        <circle cx="12" cy="3" r="2" />
      </>
    ),
  },
  join: {
    category: 'flow',
    svg: (
      <>
        <line x1="5" y1="6" x2="5" y2="9" />
        <line x1="19" y1="6" x2="19" y2="9" />
        <line x1="5" y1="9" x2="12" y2="16" />
        <line x1="19" y1="9" x2="12" y2="16" />
        <line x1="12" y1="16" x2="12" y2="21" />
        <circle cx="5" cy="5" r="2" />
        <circle cx="19" cy="5" r="2" />
        <circle cx="12" cy="21" r="2" />
      </>
    ),
  },
  switch: {
    category: 'logic',
    svg: (
      <>
        <path d="M18 8L22 12L18 16" />
        <path d="M2 12h20" />
        <path d="M6 8L2 12L6 16" />
      </>
    ),
  },
  loop: {
    category: 'logic',
    svg: (
      <>
        <polyline points="1 4 1 10 7 10" />
        <polyline points="23 20 23 14 17 14" />
        <path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15" />
      </>
    ),
  },
  setVariable: {
    category: 'data',
    svg: (
      <>
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
      </>
    ),
  },
  aggregate: {
    category: 'data',
    svg: (
      <>
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
      </>
    ),
  },
  webhook: {
    category: 'trigger',
    svg: (
      <>
        <path d="M18 16.98h-5.99c-1.1 0-1.95.94-2.48 1.9A4 4 0 012 17c.01-.7.2-1.4.57-2" />
        <path d="M6 17l3.13-5.78c.53-.97.1-2.18-.5-3.1a4 4 0 113.36-2.11" />
        <path d="M12 6l-3.13 5.78c-.53.97-.1 2.18.5 3.1a4 4 0 01-3.36 2.11" />
      </>
    ),
  },
  schedule: {
    category: 'trigger',
    svg: (
      <>
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </>
    ),
  },
  errorHandler: {
    category: 'flow',
    svg: (
      <>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </>
    ),
  },
  logDebug: {
    category: 'data',
    svg: (
      <>
        <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
        <line x1="8" y1="7" x2="16" y2="7" />
        <line x1="8" y1="11" x2="14" y2="11" />
      </>
    ),
  },
  waitForCondition: {
    category: 'logic',
    svg: (
      <>
        <path d="M6 2l.01 6L10 12l-3.99 4L6 22h12v-6l-4-4 4-4V2H6z" />
      </>
    ),
  },
  subWorkflow: {
    category: 'flow',
    svg: (
      <>
        <rect x="2" y="3" width="20" height="18" rx="2" />
        <rect x="6" y="7" width="12" height="10" rx="1" />
        <polyline points="10 12 12 14 16 10" />
      </>
    ),
  },
  script: {
    category: 'data',
    svg: (
      <>
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
      </>
    ),
  },
  correlationWait: {
    category: 'action',
    svg: (
      <>
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      </>
    ),
  },
};

export function NodeIcon({ type, className }: NodeIconProps) {
  const entry = ICON_MAP[type];
  if (!entry) return null;

  return (
    <div className={`wf-node-icon-badge wf-node-icon-badge--${entry.category} ${className ?? ''}`}>
      <svg viewBox="0 0 24 24">{entry.svg}</svg>
    </div>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function getNodeCategory(type: string): string {
  const entry = ICON_MAP[type];
  if (!entry) return '';
  const labels: Record<Category, string> = {
    trigger: 'Trigger',
    action: 'Action',
    logic: 'Logic',
    data: 'Data',
    flow: 'Flow',
    terminal: 'Terminal',
    integration: 'Integration',
  };
  return labels[entry.category];
}
