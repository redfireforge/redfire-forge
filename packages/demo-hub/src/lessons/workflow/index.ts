export { wfFirstWorkflowLesson } from './wf-first-workflow';
export { wfVariablesExtractionLesson } from './wf-variables-extraction';
export { wfConditionalLogicLesson } from './wf-conditional-logic';
export { wfLoopsParallelLesson } from './wf-loops-parallel';

import type { DemoLesson } from '../../types';
import { wfFirstWorkflowLesson } from './wf-first-workflow';
import { wfVariablesExtractionLesson } from './wf-variables-extraction';
import { wfConditionalLogicLesson } from './wf-conditional-logic';
import { wfLoopsParallelLesson } from './wf-loops-parallel';

export const workflowLessons: DemoLesson[] = [
  wfFirstWorkflowLesson,
  wfVariablesExtractionLesson,
  wfConditionalLogicLesson,
  wfLoopsParallelLesson,
];
