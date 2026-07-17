/**
 * GraphQL Studio demo lesson registry.
 * Add new lessons to `graphqlLessons` as they are implemented (Phase 5 tasks 4E-3–4E-9).
 */
import { gqlFirstQueryLesson } from './graphql-first-query';
import { gqlVariablesLesson } from './graphql-variables';
import { gqlMutationsLesson } from './graphql-mutations';
import { gqlSchemaLesson } from './graphql-schema-exploration';
import { gqlHttpsTlsLesson } from './graphql-https-tls';
import { gqlSubscriptionsLesson } from './graphql-subscriptions';
import { gqlAuthHeadersLesson } from './graphql-auth-headers';
import { gqlQueryBuilderLesson } from './graphql-query-builder';
import { gqlCollectionsHistoryLesson } from './graphql-collections-history';
import { gqlExportShareLesson } from './graphql-export-share';
import { gqlPerformanceTracingLesson } from './graphql-performance-tracing';
import { gqlWorkflowIntegrationLesson } from './graphql-workflow-integration';
import { gqlSchemaDiffLesson } from './graphql-schema-diff';
import { gqlMockServerLesson } from './graphql-mock-server';
import { gqlMultiTabLesson } from './graphql-multi-tab';
import { gqlBatchExecutionLesson } from './graphql-batch-execution';
import { gqlWorkflowRunnerLesson } from './graphql-workflow-runner';
import { gqlWorkflowMutationLesson } from './graphql-workflow-mutation';
import { gqlWorkflowSubscriptionLesson } from './graphql-workflow-subscription';

export {
  gqlFirstQueryLesson,
  gqlVariablesLesson,
  gqlMutationsLesson,
  gqlSchemaLesson,
  gqlHttpsTlsLesson,
  gqlSubscriptionsLesson,
  gqlAuthHeadersLesson,
  gqlQueryBuilderLesson,
  gqlCollectionsHistoryLesson,
  gqlExportShareLesson,
  gqlPerformanceTracingLesson,
  gqlWorkflowIntegrationLesson,
  gqlSchemaDiffLesson,
  gqlMockServerLesson,
  gqlMultiTabLesson,
  gqlBatchExecutionLesson,
  gqlWorkflowRunnerLesson,
  gqlWorkflowMutationLesson,
  gqlWorkflowSubscriptionLesson,
};

/**
 * All GraphQL category lessons in display order.
 * Matches §3.1 canonical roster (graphql-demo-lesson-enhancement.md) for implemented lessons.
 * GQL-20+ slots are omitted until those lessons are authored.
 */
export const graphqlLessons = [
  gqlFirstQueryLesson,           // GQL-1
  gqlVariablesLesson,            // GQL-2
  gqlSchemaLesson,               // GQL-3
  gqlAuthHeadersLesson,          // GQL-4
  gqlHttpsTlsLesson,             // GQL-5
  gqlMutationsLesson,            // GQL-6
  gqlSubscriptionsLesson,        // GQL-7
  gqlQueryBuilderLesson,         // GQL-8
  gqlCollectionsHistoryLesson,   // GQL-9
  gqlExportShareLesson,          // GQL-10
  gqlPerformanceTracingLesson,   // GQL-11
  gqlSchemaDiffLesson,           // GQL-12
  gqlMockServerLesson,           // GQL-13
  gqlMultiTabLesson,             // GQL-14
  gqlBatchExecutionLesson,       // GQL-15
  gqlWorkflowIntegrationLesson,  // GQL-16
  gqlWorkflowRunnerLesson,       // GQL-17
  gqlWorkflowMutationLesson,     // GQL-18
  gqlWorkflowSubscriptionLesson, // GQL-19
];
