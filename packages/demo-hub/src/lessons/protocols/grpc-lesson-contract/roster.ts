/**
 * Phase 12A — canonical GRPC-1…GRPC-15 roster (metadata only).
 * Full step content ships per-lesson in Phase 12H; GRPC-1 is the pilot implementation.
 */
import {
  GRPC_DEMO_DOCKER_COMMAND,
  GRPC_DEMO_PREREQUISITE_ENDPOINTS,
  GRPC_EXPRESS_HEALTH_URL,
  GRPC_EXPRESS_ONLY_COMMAND,
  GRPC_SPRING_DOCKER_COMMAND,
  GRPC_STUDIO_LESSON_ALLOWED_TABS,
} from '../../../adapters';
import type { GrpcLessonRosterEntry } from './types';
import { GRPC_LESSON_SCHEMA_VERSION } from './types';

const GO_ECHO_FIXTURE = {
  requireGoEcho: true,
  requireExpressProxy: true,
} as const;

const GO_ECHO_DOCKER = {
  dockerEndpoints: [...GRPC_DEMO_PREREQUISITE_ENDPOINTS],
  dockerCommand: GRPC_DEMO_DOCKER_COMMAND,
  gateLabel: '🐳 Local setup required',
  tag: '🐳 Docker',
} as const;

const EXPRESS_PROXY_DOCKER = {
  dockerEndpoints: [GRPC_EXPRESS_HEALTH_URL],
  dockerCommand: GRPC_EXPRESS_ONLY_COMMAND,
  gateLabel: 'Local setup required',
} as const;

const STUDIO_TABS = [...GRPC_STUDIO_LESSON_ALLOWED_TABS] as const;

/** Immutable lesson ids — do not rename entries; append migrations in `versioning.ts`. */
export const GRPC_LESSON_ROSTER: readonly GrpcLessonRosterEntry[] = [
  {
    number: 1,
    id: 'grpc-first-call',
    title: 'Your First gRPC Call',
    keyConcept: 'Unary RPC, service explorer',
    phaseDependencies: [1],
    fixtures: GO_ECHO_FIXTURE,
    implementationStatus: 'shipped',
    introducedInSchemaVersion: 1,
    ...GO_ECHO_DOCKER,
    initialTab: 'grpc-studio',
    allowedTabs: STUDIO_TABS,
    estimatedMinutes: 4,
  },
  {
    number: 2,
    id: 'grpc-server-reflection',
    title: 'Service Discovery with Reflection',
    keyConcept: 'Reflection API',
    phaseDependencies: [1, 3],
    fixtures: GO_ECHO_FIXTURE,
    implementationStatus: 'planned',
    introducedInSchemaVersion: 1,
    ...GO_ECHO_DOCKER,
    initialTab: 'grpc-studio',
    allowedTabs: STUDIO_TABS,
    estimatedMinutes: 4,
  },
  {
    number: 3,
    id: 'grpc-proto-import',
    title: 'Importing Proto Files',
    keyConcept: 'Proto management',
    phaseDependencies: [3],
    fixtures: GO_ECHO_FIXTURE,
    implementationStatus: 'planned',
    introducedInSchemaVersion: 1,
    ...GO_ECHO_DOCKER,
    initialTab: 'grpc-studio',
    allowedTabs: STUDIO_TABS,
    estimatedMinutes: 5,
  },
  {
    number: 4,
    id: 'grpc-metadata',
    title: 'Request Metadata & Headers',
    keyConcept: 'Metadata key-value',
    phaseDependencies: [1],
    fixtures: GO_ECHO_FIXTURE,
    implementationStatus: 'planned',
    introducedInSchemaVersion: 1,
    ...GO_ECHO_DOCKER,
    initialTab: 'grpc-studio',
    allowedTabs: STUDIO_TABS,
    estimatedMinutes: 4,
  },
  {
    number: 5,
    id: 'grpc-tls',
    title: 'TLS & Secure Connections',
    keyConcept: 'TLS config panel',
    phaseDependencies: [4],
    fixtures: { requireExpressProxy: true },
    implementationStatus: 'planned',
    introducedInSchemaVersion: 1,
    ...EXPRESS_PROXY_DOCKER,
    initialTab: 'grpc-studio',
    allowedTabs: STUDIO_TABS,
    estimatedMinutes: 5,
  },
  {
    number: 6,
    id: 'grpc-server-streaming',
    title: 'Server Streaming RPC',
    keyConcept: 'Message log',
    phaseDependencies: [2],
    fixtures: GO_ECHO_FIXTURE,
    implementationStatus: 'planned',
    introducedInSchemaVersion: 1,
    ...GO_ECHO_DOCKER,
    initialTab: 'grpc-studio',
    allowedTabs: STUDIO_TABS,
    estimatedMinutes: 5,
  },
  {
    number: 7,
    id: 'grpc-client-streaming',
    title: 'Client Streaming RPC',
    keyConcept: 'EOF / send multiple',
    phaseDependencies: [2],
    fixtures: GO_ECHO_FIXTURE,
    implementationStatus: 'planned',
    introducedInSchemaVersion: 1,
    ...GO_ECHO_DOCKER,
    initialTab: 'grpc-studio',
    allowedTabs: STUDIO_TABS,
    estimatedMinutes: 5,
  },
  {
    number: 8,
    id: 'grpc-bidi-streaming',
    title: 'Bidirectional Streaming',
    keyConcept: 'Full duplex',
    phaseDependencies: [2],
    fixtures: GO_ECHO_FIXTURE,
    implementationStatus: 'planned',
    introducedInSchemaVersion: 1,
    ...GO_ECHO_DOCKER,
    initialTab: 'grpc-studio',
    allowedTabs: STUDIO_TABS,
    estimatedMinutes: 5,
  },
  {
    number: 9,
    id: 'grpc-collections',
    title: 'Saving & Organizing Requests',
    keyConcept: 'Collections tree',
    phaseDependencies: [5],
    fixtures: GO_ECHO_FIXTURE,
    implementationStatus: 'planned',
    introducedInSchemaVersion: 1,
    ...GO_ECHO_DOCKER,
    initialTab: 'grpc-studio',
    allowedTabs: STUDIO_TABS,
    estimatedMinutes: 4,
  },
  {
    number: 10,
    id: 'grpc-env-variables',
    title: 'Environments & Variables',
    keyConcept: '{{grpcHost}}',
    phaseDependencies: [9],
    fixtures: GO_ECHO_FIXTURE,
    implementationStatus: 'planned',
    introducedInSchemaVersion: 1,
    ...GO_ECHO_DOCKER,
    initialTab: 'grpc-studio',
    allowedTabs: [...STUDIO_TABS, 'environments'],
    estimatedMinutes: 5,
  },
  {
    number: 11,
    id: 'grpc-workflow-integration',
    title: 'gRPC in Workflows',
    keyConcept: 'Workflow node',
    phaseDependencies: [6],
    fixtures: GO_ECHO_FIXTURE,
    implementationStatus: 'planned',
    introducedInSchemaVersion: 1,
    ...GO_ECHO_DOCKER,
    initialTab: 'grpc-studio',
    allowedTabs: [...STUDIO_TABS, 'workflow'],
    estimatedMinutes: 6,
  },
  {
    number: 12,
    id: 'grpc-load-testing',
    title: 'Load Testing with gRPC Studio',
    keyConcept: 'ghz-style metrics',
    phaseDependencies: [11],
    fixtures: GO_ECHO_FIXTURE,
    implementationStatus: 'planned',
    introducedInSchemaVersion: 1,
    ...GO_ECHO_DOCKER,
    initialTab: 'grpc-studio',
    allowedTabs: STUDIO_TABS,
    estimatedMinutes: 5,
  },
  {
    number: 13,
    id: 'grpc-mock-server',
    title: 'Mocking gRPC APIs',
    keyConcept: 'Rule-based mock responses',
    phaseDependencies: [11],
    fixtures: { requireExpressProxy: true },
    implementationStatus: 'planned',
    introducedInSchemaVersion: 1,
    ...EXPRESS_PROXY_DOCKER,
    initialTab: 'grpc-studio',
    allowedTabs: STUDIO_TABS,
    estimatedMinutes: 5,
  },
  {
    number: 14,
    id: 'grpc-schema-diff',
    title: 'Proto Schema Diff in CI',
    keyConcept: 'Breaking-change detection',
    phaseDependencies: [11],
    fixtures: GO_ECHO_FIXTURE,
    implementationStatus: 'planned',
    introducedInSchemaVersion: 1,
    ...GO_ECHO_DOCKER,
    initialTab: 'grpc-studio',
    allowedTabs: STUDIO_TABS,
    estimatedMinutes: 4,
  },
  {
    number: 15,
    id: 'grpc-spring-boot',
    title: 'Spring Boot 4.1 + Spring gRPC',
    keyConcept: 'Netty vs Servlet transport behavior',
    phaseDependencies: [1, 4, 10],
    fixtures: {
      requireGoEcho: true,
      requireSpringBoot: true,
      requireExpressProxy: true,
    },
    implementationStatus: 'planned',
    introducedInSchemaVersion: 1,
    dockerEndpoints: [
      ...GRPC_DEMO_PREREQUISITE_ENDPOINTS,
      'http://localhost:9090/actuator/health',
    ],
    dockerCommand: GRPC_SPRING_DOCKER_COMMAND,
    gateLabel: '🐳 Local setup required',
    tag: '🐳 Docker',
    initialTab: 'grpc-studio',
    allowedTabs: STUDIO_TABS,
    estimatedMinutes: 6,
  },
  {
    number: 16,
    id: 'grpc-schema-discovery',
    title: 'Schema Discovery: Reflection & Proto Import',
    keyConcept: 'Descriptor sources, Schema Browser',
    phaseDependencies: [1, 3],
    fixtures: GO_ECHO_FIXTURE,
    implementationStatus: 'shipped',
    introducedInSchemaVersion: 1,
    ...GO_ECHO_DOCKER,
    initialTab: 'grpc-studio',
    allowedTabs: STUDIO_TABS,
    estimatedMinutes: 8,
  },
  {
    number: 17,
    id: 'grpc-streaming',
    title: 'Streaming RPCs: All Four Patterns',
    keyConcept: 'Server, client, and bidi streaming',
    phaseDependencies: [1, 2],
    fixtures: GO_ECHO_FIXTURE,
    implementationStatus: 'shipped',
    introducedInSchemaVersion: 1,
    ...GO_ECHO_DOCKER,
    initialTab: 'grpc-studio',
    allowedTabs: STUDIO_TABS,
    estimatedMinutes: 7,
  },
] as const;

export const GRPC_LESSON_ROSTER_BY_ID: Readonly<Record<string, GrpcLessonRosterEntry>> =
  Object.fromEntries(GRPC_LESSON_ROSTER.map((entry) => [entry.id, entry]));

export function getGrpcLessonRosterEntry(id: string): GrpcLessonRosterEntry | undefined {
  return GRPC_LESSON_ROSTER_BY_ID[id];
}

/** Roster rows that must have a shipped `GrpcDemoLesson` wrapper in `grpcLessons`. */
export function shippedGrpcLessonRosterEntries(): GrpcLessonRosterEntry[] {
  return GRPC_LESSON_ROSTER.filter((e) => e.implementationStatus === 'shipped');
}

export function assertRosterSchemaVersion(): void {
  for (const entry of GRPC_LESSON_ROSTER) {
    if (entry.introducedInSchemaVersion > GRPC_LESSON_SCHEMA_VERSION) {
      throw new Error(
        `Roster entry ${entry.id} introducedInSchemaVersion ${entry.introducedInSchemaVersion} `
        + `exceeds GRPC_LESSON_SCHEMA_VERSION ${GRPC_LESSON_SCHEMA_VERSION}`,
      );
    }
  }
}
