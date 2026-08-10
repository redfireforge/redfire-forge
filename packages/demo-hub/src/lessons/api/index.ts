/** API Testing demo lessons — Requests & Catalog */
import type { DemoLesson } from '../../types';
import { reqQuickStartLesson } from './req-quick-start';
import { reqCollectionsLesson } from './req-collections';
import { reqMultiEnvLesson } from './req-multi-env';
import { reqBodyAuthLesson } from './req-body-auth';
import { reqSendHarnessLesson } from './req-send-harness';
import { reqVersioningLesson } from './req-versioning';
import { reqMultiTabLesson } from './req-multi-tab';
import { catConvertOpenApiLesson } from './cat-convert-openapi';
import { catImportBrowseLesson } from './cat-import-browse';
import { catTryItOutLesson } from './cat-try-it-out';
import { catExportPromoteLesson } from './cat-export-promote';
import { catVersionLifecycleLesson } from './cat-version-lifecycle';

export const requestLessons: DemoLesson[] = [
  reqQuickStartLesson,
  reqCollectionsLesson,
  reqMultiEnvLesson,
  reqBodyAuthLesson,
  reqSendHarnessLesson,
  reqVersioningLesson,
  reqMultiTabLesson,
];

export const catalogLessons: DemoLesson[] = [
  catImportBrowseLesson,
  catTryItOutLesson,
  catExportPromoteLesson,
  catVersionLifecycleLesson,
  catConvertOpenApiLesson,
];

export const apiLessons: DemoLesson[] = [
  ...requestLessons,
  ...catalogLessons,
];
