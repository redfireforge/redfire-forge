/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import { kafkaPublishLesson } from './kafka-publish';

describe('kafkaPublishLesson boot surface', () => {
  it('seeds via prepareBeforeNavigate so Start skips Settings→Connect flash', () => {
    expect(kafkaPublishLesson.initialTab).toBe('kafka-message-studio');
    expect(typeof kafkaPublishLesson.prepareBeforeNavigate).toBe('function');
    expect(kafkaPublishLesson.allowedTabs).toEqual(['kafka-message-studio']);
  });
});
