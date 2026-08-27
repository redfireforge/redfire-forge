export { wfFirstWorkflowLesson } from './wf-first-workflow';
export { wfVariablesExtractionLesson } from './wf-variables-extraction';
export { wfConditionalLogicLesson } from './wf-conditional-logic';
export { wfLoopsParallelLesson } from './wf-loops-parallel';
export { wfErrorHandlingLesson } from './wf-error-handling';
export { wfDebugConsoleLesson } from './wf-debug-console';
export { wfVersionServicesLesson } from './wf-version-services';
export { wfProtocolNodesLesson } from './wf-protocol-nodes';
export { wfHarImportLesson } from './wf-har-import';

import type { DemoLesson } from '../../types';
import { wfFirstWorkflowLesson } from './wf-first-workflow';
import { wfVariablesExtractionLesson } from './wf-variables-extraction';
import { wfConditionalLogicLesson } from './wf-conditional-logic';
import { wfLoopsParallelLesson } from './wf-loops-parallel';
import { wfErrorHandlingLesson } from './wf-error-handling';
import { wfDebugConsoleLesson } from './wf-debug-console';
import { wfVersionServicesLesson } from './wf-version-services';
import { wfProtocolNodesLesson } from './wf-protocol-nodes';
import { wfHarImportLesson } from './wf-har-import';

export const workflowLessons: DemoLesson[] = [
  wfFirstWorkflowLesson,
  wfVariablesExtractionLesson,
  wfHarImportLesson,
  wfConditionalLogicLesson,
  wfLoopsParallelLesson,
  wfErrorHandlingLesson,
  wfDebugConsoleLesson,
  wfVersionServicesLesson,
  wfProtocolNodesLesson,
];
