/** Lesson registry — all domains and lesson definitions */
import type { DemoDomain } from '../types';
import { wsBasicsLesson } from './protocols/ws-basics';
import { wsAuthTransportLesson } from './protocols/ws-auth-transport';

// ─── Domains ─────────────────────────────────────────────────────

export const protocolsDomain: DemoDomain = {
  id: 'protocols',
  name: 'Protocols',
  icon: '📡',
  description: 'Master WebSocket, SSE, and Kafka real-time protocols.',
  available: true,
  categories: [
    { id: 'kafka',     label: 'Kafka',     icon: '📨' },
    { id: 'websocket', label: 'WebSocket', icon: '🔌' },
    { id: 'sse',       label: 'SSE',       icon: '📡' },
  ],
  lessons: [wsBasicsLesson, wsAuthTransportLesson],
};

export const apiDomain: DemoDomain = {
  id: 'api',
  name: 'API Testing',
  icon: '🔌',
  description: 'HTTP methods, assertions, environments, and chaining.',
  available: false,
  lessons: [],
};

export const workflowDomain: DemoDomain = {
  id: 'workflow',
  name: 'Workflows',
  icon: '⚡',
  description: 'Build automated test sequences with conditional logic.',
  available: false,
  lessons: [],
};

export const harnessDomain: DemoDomain = {
  id: 'harness',
  name: 'Test Harness',
  icon: '🧪',
  description: 'SLA validation, parallel runs, and CI/CD integration.',
  available: false,
  lessons: [],
};

// ─── All domains in display order ────────────────────────────────
export const allDomains: DemoDomain[] = [
  protocolsDomain,
  apiDomain,
  workflowDomain,
  harnessDomain,
];
