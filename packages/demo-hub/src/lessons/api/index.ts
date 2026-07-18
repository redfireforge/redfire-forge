/** API Testing demo lessons — Requests & Catalog */
import type { DemoLesson } from '../../types';
import { reqQuickStartLesson } from './req-quick-start';
import { reqCollectionsLesson } from './req-collections';
import { reqMultiEnvLesson } from './req-multi-env';
import { reqBodyAuthLesson } from './req-body-auth';
import { reqSendHarnessLesson } from './req-send-harness';
import { reqVersioningLesson } from './req-versioning';
import { catConvertOpenApiLesson } from './cat-convert-openapi';

export const requestLessons: DemoLesson[] = [
  reqQuickStartLesson,
  reqCollectionsLesson,
  reqMultiEnvLesson,
  reqBodyAuthLesson,
  reqSendHarnessLesson,
  reqVersioningLesson,
];

export const catalogLessons: DemoLesson[] = [
  catConvertOpenApiLesson,
];

export const apiLessons: DemoLesson[] = [
  ...requestLessons,
  ...catalogLessons,
];
