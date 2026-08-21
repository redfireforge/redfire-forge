/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import { kafkaQuickStartLesson } from './kafka-quick-start';

describe('kafkaQuickStartLesson boot surface', () => {
  it('clears clusters via prepareBeforeNavigate so Start skips Edit→Delete flash', () => {
    expect(kafkaQuickStartLesson.initialTab).toBe('kafka-settings');
    expect(typeof kafkaQuickStartLesson.prepareBeforeNavigate).toBe('function');
    expect(typeof kafkaQuickStartLesson.setup).toBe('function');
    expect(typeof kafkaQuickStartLesson.cleanup).toBe('function');
  });
});
