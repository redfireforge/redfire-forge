/** Lesson registry — all domains and lesson definitions */
import type { DemoDomain } from '../types';
import { wsMockServerLesson } from './protocols/ws-mock-server';
import { wsBasicsLesson } from './protocols/ws-basics';
import { wsConsoleLesson } from './protocols/ws-console';
import { wsTabsLesson } from './protocols/ws-tabs';
import { wsAuthTransportLesson } from './protocols/ws-auth-transport';
import { wsFilteringLesson } from './protocols/ws-filtering';
import { wsLoadTestingLesson } from './protocols/ws-load-testing';
import { sseStudioLesson } from './protocols/sse-studio';
import { wsWorkflowBuilderLesson } from './protocols/ws-workflow-builder';
import { wsSocketIoLesson } from './protocols/ws-socketio';
import { wsStompLesson } from './protocols/ws-stomp';
import { wsGraphqlLesson } from './protocols/ws-graphql';
import { wsMockServerAdvancedLesson } from './protocols/ws-mock-server-advanced';
import { wsWorkspaceLesson } from './protocols/ws-workspace';
import { wsReliabilityLesson } from './protocols/ws-reliability';
import { wsSessionRecordingLesson } from './protocols/ws-session-recording';
import { wsPowerUserLesson } from './protocols/ws-power-user';
import { sseStudioAdvancedLesson } from './protocols/sse-studio-advanced';
import { wsTlsLesson } from './protocols/ws-tls';
import { wsTestRunnerLesson } from './protocols/ws-test-runner';
import { kafkaTemplatesLesson } from './protocols/kafka-templates';
import { kafkaPublishLesson } from './protocols/kafka-publish';
import { kafkaConsumeLesson } from './protocols/kafka-consume';

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
  lessons: [kafkaPublishLesson, kafkaConsumeLesson, kafkaTemplatesLesson, wsMockServerLesson, wsBasicsLesson, wsConsoleLesson, wsTabsLesson, wsAuthTransportLesson, wsFilteringLesson, wsLoadTestingLesson, wsWorkflowBuilderLesson, sseStudioLesson, wsSocketIoLesson, wsStompLesson, wsGraphqlLesson, wsMockServerAdvancedLesson, wsWorkspaceLesson, wsReliabilityLesson, wsSessionRecordingLesson, wsPowerUserLesson, sseStudioAdvancedLesson, wsTlsLesson, wsTestRunnerLesson],
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
