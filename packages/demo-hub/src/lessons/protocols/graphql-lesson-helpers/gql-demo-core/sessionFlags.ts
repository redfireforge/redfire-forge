import { resetLesson2VariablesHistoryFlags } from '../lesson2-variables-history';

/** Mutable session state shared across gql-demo-core modules. */
export const gqlLessonSession = {
  endpointSet: false,
  schemaLoaded: false,
  queryWritten: false,
  executed: false,
  userAId: '',
  userBId: '',
  usersSeeded: false,
  paramQueryWritten: false,
  varAExecuted: false,
  varBExecuted: false,
};

/** Reset Lesson 1 session flags — call from lesson setup/cleanup. */
export function resetGqlLessonSessionFlags(): void {
  gqlLessonSession.endpointSet = false;
  gqlLessonSession.schemaLoaded = false;
  gqlLessonSession.queryWritten = false;
  gqlLessonSession.executed = false;
}

/** Reset Lesson 2 session flags — call from lesson setup/cleanup. */
export function resetGqlLesson2SessionFlags(): void {
  gqlLessonSession.userAId = '';
  gqlLessonSession.userBId = '';
  gqlLessonSession.usersSeeded = false;
  gqlLessonSession.paramQueryWritten = false;
  gqlLessonSession.varAExecuted = false;
  gqlLessonSession.varBExecuted = false;
  resetLesson2VariablesHistoryFlags();
}

export function getDemoUserAId(): string {
  return gqlLessonSession.userAId;
}

export function getDemoUserBId(): string {
  return gqlLessonSession.userBId;
}

/** Options for preAction execute guards — history steps must not refocus the Response pane. */
export interface GqlExecuteGuardOpts {
  /** When true, skip Response tab clicks and avoid re-opening Variables (for History sidebar steps). */
  skipResponseFocus?: boolean;
}

/** True after Alice and Bob GetUser runs completed in the studio (Lesson 2). */
export function areLesson2StudioExecutionsDone(): boolean {
  return gqlLessonSession.varAExecuted && gqlLessonSession.varBExecuted;
}
