import type { Page } from '@playwright/test';
import { GQL1_LESSON, GQL2_LESSON, GQL3_LESSON } from './constants';
import {
  prepareGql1DockerLesson,
  prepareGql2DockerLesson,
  prepareGql3DockerLesson,
} from './prepare-lessons';
import { walkFullGql1Lesson, walkFullGql2Lesson, walkFullGql3Lesson } from './walk-lessons';

export type GqlSmokeLessonId = 'gql1' | 'gql2' | 'gql3';

const SMOKE_LESSONS: Record<
  GqlSmokeLessonId,
  {
    name: string;
    steps: number;
    prepare: typeof prepareGql1DockerLesson;
    walk: (page: Page) => Promise<void>;
  }
> = {
  gql1: { ...GQL1_LESSON, prepare: prepareGql1DockerLesson, walk: walkFullGql1Lesson },
  gql2: { ...GQL2_LESSON, prepare: prepareGql2DockerLesson, walk: walkFullGql2Lesson },
  gql3: { ...GQL3_LESSON, prepare: prepareGql3DockerLesson, walk: walkFullGql3Lesson },
};

export function getGqlSmokeLesson(id: GqlSmokeLessonId) {
  return SMOKE_LESSONS[id];
}

export const GQL_SMOKE_LESSON_IDS: GqlSmokeLessonId[] = ['gql1', 'gql2', 'gql3'];
