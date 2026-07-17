/**
 * Coverage gaps — grpcSpringServletPathResolver.ts (Phase 10D).
 */
import { describe, expect, it } from 'vitest';
import {
  normalizeSpringServletMethodSegment,
  normalizeSpringServletServiceSegment,
  resetSpringServletPathResolverForTests,
  SpringServletPathResolutionError,
} from './grpcSpringServletPathResolver';

describe('grpcSpringServletPathResolver coverage gaps', () => {
  it('rejects service name that is empty after normalization', () => {
    expect(() => normalizeSpringServletServiceSegment('///')).toThrow(SpringServletPathResolutionError);
    expect(() => normalizeSpringServletServiceSegment('///')).toThrow(/empty after normalization/i);
  });

  it('rejects method name that is empty after normalization', () => {
    expect(() => normalizeSpringServletMethodSegment('///')).toThrow(SpringServletPathResolutionError);
    expect(() => normalizeSpringServletMethodSegment('///')).toThrow(/empty after normalization/i);
  });

  it('rejects method segment containing backslash', () => {
    expect(() => normalizeSpringServletMethodSegment('Echo\\Inject')).toThrow(SpringServletPathResolutionError);
    expect(() => normalizeSpringServletMethodSegment('Echo\\Inject')).toThrow(/Invalid Spring Servlet method segment/i);
  });

  it('resetSpringServletPathResolverForTests is a no-op symmetry hook', () => {
    expect(() => resetSpringServletPathResolverForTests()).not.toThrow();
  });
});
