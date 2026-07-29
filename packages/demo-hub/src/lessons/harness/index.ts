/** Test Harness lessons barrel — incrementally expanded as lessons are implemented. */
import type { DemoLesson } from '../../types';
import { thOverviewStructureLesson } from './th-overview-structure';
import { thAuthorTestsLesson } from './th-author-tests';
import { thValidationAssertionsLesson } from './th-validation-assertions';
import { thTestRunnerLesson } from './th-test-runner';
import { thDataSourcesLesson } from './th-data-sources';
import { thParameterizedRunnerLesson } from './th-parameterized-runner';
import { thResultsAnalysisLesson } from './th-results-analysis';
import { thLoadTestingLesson } from './th-load-testing';
import { thAdvancedFeaturesLesson } from './th-advanced-features';
import { thAssertionsDeepDiveLesson } from './th-assertions-deep-dive';
import { thDataMapperLesson } from './th-data-mapper';
import { thValidationVersioningLesson } from './th-validation-versioning';
import { thSlaConfigurationLesson } from './th-sla-configuration';
import { thAuthInheritanceLesson } from './th-auth-inheritance';
import { thImportExportCurlLesson } from './th-import-export-curl';
import { thAdvancedSearchLesson } from './th-advanced-search';
import { thMapperExpressionsDslLesson } from './th-mapper-expressions-dsl';
import { thDataSourceAdvancedLesson } from './th-data-source-advanced';
import { thSchemaDriftRepairLesson } from './th-schema-drift-repair';
import { thBaselineRegressionLesson } from './th-baseline-regression';
import { thWorkflowRunnerLesson } from './th-workflow-runner';
import { thSharedDataSourcesLesson } from './th-shared-data-sources';

export const harnessLessons: DemoLesson[] = [
  thOverviewStructureLesson,
  thAuthorTestsLesson,
  thValidationAssertionsLesson,
  thTestRunnerLesson,
  thDataSourcesLesson,
  thParameterizedRunnerLesson,
  thResultsAnalysisLesson,
  thLoadTestingLesson,
  thAdvancedFeaturesLesson,
  thAssertionsDeepDiveLesson,
  thDataMapperLesson,
  thValidationVersioningLesson,
  thSlaConfigurationLesson,
  thAuthInheritanceLesson,
  thImportExportCurlLesson,
  thAdvancedSearchLesson,
  thMapperExpressionsDslLesson,
  thDataSourceAdvancedLesson,
  thSharedDataSourcesLesson,
  thSchemaDriftRepairLesson,
  thBaselineRegressionLesson,
  thWorkflowRunnerLesson,
];
