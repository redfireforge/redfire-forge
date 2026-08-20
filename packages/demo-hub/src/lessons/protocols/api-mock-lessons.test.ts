/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { apiMockLessons } from './api-mock-lessons';

describe('API Mock lesson roster (curriculum v2)', () => {
  it('registers lessons in AM-01 … AM-24 order with unique ids', () => {
    const ids = apiMockLessons.map(l => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual([...ids].sort());
  });

  it('ships every lesson under the api-mock category with a concept and steps', () => {
    expect(apiMockLessons.length).toBeGreaterThan(0);
    for (const lesson of apiMockLessons) {
      expect(lesson.domainId).toBe('protocols');
      expect(lesson.category).toBe('api-mock');
      expect(['api-mock-studio', 'workflow', 'test-runner', 'runner']).toContain(lesson.initialTab);
      expect(lesson.allowedTabs ?? [lesson.initialTab]).toContain(lesson.initialTab);
      expect(lesson.concept.body.length).toBeGreaterThan(400);
      expect(lesson.concept.keyTerms?.length ?? 0).toBeGreaterThanOrEqual(5);
      expect(lesson.concept.diagram).toContain('<svg');
      // Consolidation contract: steps are multi-beat, so a lesson lands in the
      // 6–12 range. More than 12 means beats that belong together were split.
      expect(lesson.steps.length, `${lesson.id} step count`).toBeGreaterThanOrEqual(6);
      expect(lesson.steps.length, `${lesson.id} step count`).toBeLessThanOrEqual(12);
      expect(lesson.estimatedMinutes).toBeGreaterThan(0);
    }
  });

  it('keeps AM-xx codes out of viewer-facing text — names and narration use titles', () => {
    const code = /\bAM-\d{1,2}\b/;
    for (const lesson of apiMockLessons) {
      expect(lesson.name, `${lesson.id} name`).not.toMatch(code);
      expect(lesson.description, `${lesson.id} description`).not.toMatch(code);
      expect(lesson.concept.body, `${lesson.id} concept body`).not.toMatch(code);
      for (const term of lesson.concept.keyTerms ?? []) {
        expect(term.definition, `${lesson.id} key term ${term.term}`).not.toMatch(code);
      }
      for (const step of lesson.steps) {
        expect(step.title, `${lesson.id}/${step.id} title`).not.toMatch(code);
        expect(step.description, `${lesson.id}/${step.id} narration`).not.toMatch(code);
      }
    }
  });

  it('keeps every step active — at most one pause-only step per lesson', () => {
    for (const lesson of apiMockLessons) {
      const pauseOnly = lesson.steps.filter(s => !s.action);
      expect(pauseOnly.length, `${lesson.id} pause-only steps: ${pauseOnly.map(s => s.id).join(', ')}`)
        .toBeLessThanOrEqual(1);
    }
  });

  it('gives every step a unique id, narration, and a spotlight', () => {
    for (const lesson of apiMockLessons) {
      const stepIds = lesson.steps.map(s => s.id);
      expect(new Set(stepIds).size, `${lesson.id} step ids`).toBe(stepIds.length);
      for (const step of lesson.steps) {
        expect(step.title.length, `${lesson.id}/${step.id} title`).toBeGreaterThan(0);
        expect(step.description.length, `${lesson.id}/${step.id} narration`).toBeGreaterThan(120);
        expect(step.highlight, `${lesson.id}/${step.id} highlight`).toBeTruthy();
      }
    }
  });

  it('recovers from rapid Next — every step after the first guards its state', () => {
    for (const lesson of apiMockLessons) {
      for (const step of lesson.steps.slice(1)) {
        expect(step.preAction, `${lesson.id}/${step.id} preAction`).toBeTypeOf('function');
      }
    }
  });

  it('AM-24 grades POST /orders before the GET /health overlap', () => {
    const am24 = apiMockLessons.find(l => l.id === 'am-24-capstone');
    expect(am24?.steps.map(s => s.id)).toEqual([
      'from-spec',
      'matching',
      'response',
      'variants',
      'resilience',
      'suite',
      'conflicts',
      'live',
      'export',
      'ship',
    ]);
  });
});
