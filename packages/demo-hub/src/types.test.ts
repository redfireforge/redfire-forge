import { describe, it, expect } from 'vitest';
import { calcReadingTime, MIN_STEP_DISPLAY } from './types';
import type { DemoStep } from './types';

function makeStep(overrides: Partial<DemoStep> = {}): DemoStep {
  return {
    id: 'step-1',
    title: 'Test Step',
    description: 'A simple description.',
    ...overrides,
  };
}

describe('calcReadingTime', () => {
  it('returns at least MIN_STEP_DISPLAY for short text', () => {
    const step = makeStep({ title: 'Hi', description: 'Short.' });
    expect(calcReadingTime(step)).toBeGreaterThanOrEqual(MIN_STEP_DISPLAY);
  });

  it('increases with word count', () => {
    const shortStep = makeStep({ title: 'Short', description: 'A few words.' });
    const longStep = makeStep({
      title: 'Long Step Title',
      description: 'This is a much longer description that contains many words and should result in a higher reading time calculation compared to the short description above with fewer total words in it.',
    });
    expect(calcReadingTime(longStep)).toBeGreaterThanOrEqual(calcReadingTime(shortStep));
  });

  it('adds extra time when highlight is present', () => {
    const noHighlight = makeStep({ description: 'Some words here for testing the time.' });
    const withHighlight = makeStep({ description: 'Some words here for testing the time.', highlight: '.my-button' });
    expect(calcReadingTime(withHighlight)).toBeGreaterThan(calcReadingTime(noHighlight));
  });

  it('returns a rounded integer', () => {
    const step = makeStep();
    const result = calcReadingTime(step);
    expect(Number.isInteger(result)).toBe(true);
  });

  it('handles empty strings', () => {
    const step = makeStep({ title: '', description: '' });
    expect(calcReadingTime(step)).toBe(MIN_STEP_DISPLAY);
  });
});
