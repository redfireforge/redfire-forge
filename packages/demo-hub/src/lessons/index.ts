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
import { sseTabsLesson } from './protocols/sse-tabs';
import { wsTlsLesson } from './protocols/ws-tls';
import { wsTlsLocalLesson } from './protocols/ws-tls-local';
import { wsTestRunnerLesson } from './protocols/ws-test-runner';
import { kafkaTemplatesLesson } from './protocols/kafka-templates';
import { kafkaPublishLesson } from './protocols/kafka-publish';
import { kafkaConsumeLesson } from './protocols/kafka-consume';
import { kafkaQuickStartLesson } from './protocols/kafka-quick-start';
import { kafkaHeadersFiltersLesson } from './protocols/kafka-headers-filters';
import { kafkaTopicExplorerLesson } from './protocols/kafka-topic-explorer';
import { kafkaSchemaRegistryLesson } from './protocols/kafka-schema-registry';
import { kafkaStreamModeLesson } from './protocols/kafka-stream-mode';
import { kafkaWorkflowProduceLesson } from './protocols/kafka-workflow-produce';
import { kafkaWorkflowConsumeWaitLesson } from './protocols/kafka-workflow-consume-wait';
import { kafkaSecureLesson } from './protocols/kafka-secure';
import { kafkaTlsLesson } from './protocols/kafka-tls';
import { kafkaTestRunnerLesson } from './protocols/kafka-test-runner';
import { graphqlLessons } from './protocols/graphql-lessons';
import { grpcLessons } from './protocols/grpc-lessons';
import { apiLessons } from './api';

// ─── Domains ─────────────────────────────────────────────────────

export const protocolsDomain: DemoDomain = {
  id: 'protocols',
  name: 'Protocols',
  icon: '📡',
  description: 'Master WebSocket, SSE, Kafka, GraphQL, and gRPC protocols.',
  available: true,
  categories: [
    { id: 'kafka',     label: 'Kafka',     icon: '📨' },
    { id: 'websocket', label: 'WebSocket', icon: '🔌' },
    { id: 'sse',       label: 'SSE',       icon: '📡' },
    { id: 'graphql',   label: 'GraphQL',   icon: '◈' },
    { id: 'grpc',      label: 'gRPC',      icon: '⚡' },
  ],
  lessons: [kafkaQuickStartLesson, kafkaPublishLesson, kafkaConsumeLesson, kafkaHeadersFiltersLesson, kafkaTemplatesLesson, kafkaTopicExplorerLesson, kafkaSchemaRegistryLesson, kafkaStreamModeLesson, kafkaWorkflowProduceLesson, kafkaWorkflowConsumeWaitLesson, kafkaSecureLesson, kafkaTlsLesson, kafkaTestRunnerLesson, wsMockServerLesson, wsBasicsLesson, wsConsoleLesson, wsTabsLesson, wsAuthTransportLesson, wsFilteringLesson, wsLoadTestingLesson, wsWorkflowBuilderLesson, sseStudioLesson, wsSocketIoLesson, wsStompLesson, wsGraphqlLesson, wsMockServerAdvancedLesson, wsWorkspaceLesson, wsReliabilityLesson, wsSessionRecordingLesson, wsPowerUserLesson, sseStudioAdvancedLesson, sseTabsLesson, wsTlsLesson, wsTlsLocalLesson, wsTestRunnerLesson, ...graphqlLessons, ...grpcLessons],
};

export const apiDomain: DemoDomain = {
  id: 'api',
  name: 'API Testing',
  icon: '🔌',
  description: 'HTTP Requests, API Catalog, and Test Promotion.',
  available: true,
  categories: [
    { id: 'requests', label: 'Requests', icon: '📤' },
    { id: 'catalog',  label: 'Catalog',  icon: '📚' },
  ],
  lessons: apiLessons,
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
