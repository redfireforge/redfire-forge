/** CLI domain lessons barrel — incrementally expanded as lessons are implemented. */
import type { DemoLesson } from '../../types';
import { cliQuickStartLesson } from './cli-quick-start';
import { cliValidateAuthoringLesson } from './cli-validate-authoring';
import { cliExecutionModesLesson } from './cli-execution-modes';
import { cliErrorPoliciesLesson } from './cli-error-policies';
import { cliDataDrivenLesson } from './cli-data-driven';
import { cliReportsCiLesson } from './cli-reports-ci';
import { cliSlaGatesLesson } from './cli-sla-gates';
import { cliBaselineRegressionLesson } from './cli-baseline-regression';
import { cliWorkflowCommandLesson } from './cli-workflow-command';
import { cliMockStudioLesson } from './cli-mock-studio';
import { cliDesktopParityLesson } from './cli-desktop-parity';

export const cliLessons: DemoLesson[] = [
  cliQuickStartLesson,
  cliValidateAuthoringLesson,
  cliExecutionModesLesson,
  cliErrorPoliciesLesson,
  cliDataDrivenLesson,
  cliReportsCiLesson,
  cliSlaGatesLesson,
  cliBaselineRegressionLesson,
  cliWorkflowCommandLesson,
  cliMockStudioLesson,
  cliDesktopParityLesson,
];
