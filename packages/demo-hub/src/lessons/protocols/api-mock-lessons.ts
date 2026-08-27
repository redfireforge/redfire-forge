/**
 * Canonical lesson order (AM-01 … AM-24) for API Mock demo curriculum v2.
 *
 * Lessons are appended one at a time as they pass the 5-item done checklist;
 * `api-mock-lessons.test.ts` pins the order so slots cannot drift.
 */
import type { DemoLesson } from '../../types';
import { apiMockAm01Lesson } from './api-mock-am01';
import { apiMockAm02Lesson } from './api-mock-am02';
import { apiMockAm03Lesson } from './api-mock-am03';
import { apiMockAm04Lesson } from './api-mock-am04';
import { apiMockAm05Lesson } from './api-mock-am05';
import { apiMockAm06Lesson } from './api-mock-am06';
import { apiMockAm07Lesson } from './api-mock-am07';
import { apiMockAm08Lesson } from './api-mock-am08';
import { apiMockAm09Lesson } from './api-mock-am09-lesson';
import { apiMockAm10Lesson } from './api-mock-am10';
import { apiMockAm11Lesson } from './api-mock-am11';
import { apiMockAm12Lesson } from './api-mock-am12';
import { apiMockAm13Lesson } from './api-mock-am13-lesson';
import { apiMockAm14Lesson } from './api-mock-am14';
import { apiMockAm15Lesson } from './api-mock-am15';
import { apiMockAm16Lesson } from './api-mock-am16';
import { apiMockAm17Lesson } from './api-mock-am17';
import { apiMockAm18Lesson } from './api-mock-am18';
import { apiMockAm19Lesson } from './api-mock-am19';
import { apiMockAm20Lesson } from './api-mock-am20';
import { apiMockAm21Lesson } from './api-mock-am21';
import { apiMockAm22Lesson } from './api-mock-am22';
import { apiMockAm23Lesson } from './api-mock-am23';
import { apiMockAm24Lesson } from './api-mock-am24';
import { apiMockAm25Lesson } from './api-mock-am25';

export const apiMockLessons: DemoLesson[] = [
  apiMockAm01Lesson,
  apiMockAm02Lesson,
  apiMockAm03Lesson,
  apiMockAm04Lesson,
  apiMockAm05Lesson,
  apiMockAm06Lesson,
  apiMockAm07Lesson,
  apiMockAm08Lesson,
  apiMockAm09Lesson,
  apiMockAm10Lesson,
  apiMockAm11Lesson,
  apiMockAm12Lesson,
  apiMockAm13Lesson,
  apiMockAm14Lesson,
  apiMockAm15Lesson,
  apiMockAm16Lesson,
  apiMockAm17Lesson,
  apiMockAm18Lesson,
  apiMockAm19Lesson,
  apiMockAm20Lesson,
  apiMockAm21Lesson,
  apiMockAm22Lesson,
  apiMockAm23Lesson,
  apiMockAm24Lesson,
  apiMockAm25Lesson,
];
