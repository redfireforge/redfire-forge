import { describe, it, expect } from 'vitest';
import { SDL_DIFF_GOLDEN_CASES, indentSdlLinesForGoldenCase } from './sdlDiffGoldenCases';

describe('SDL_DIFF_GOLDEN_CASES', () => {
  it('includes all golden cases with valid SDL pairs', () => {
    expect(SDL_DIFF_GOLDEN_CASES.length).toBeGreaterThan(5);
    for (const c of SDL_DIFF_GOLDEN_CASES) {
      expect(c.oldSdl.trim().length).toBeGreaterThan(0);
      expect(c.newSdl.trim().length).toBeGreaterThan(0);
      expect(c.stats.removed + c.stats.added + c.stats.modified + c.stats.unchanged).toBeGreaterThan(0);
    }
  });

  it('indentSdlLinesForGoldenCase preserves empty lines and indents content', () => {
    expect(indentSdlLinesForGoldenCase('type Query {\n\n}')).toBe('  type Query {\n\n  }');
    expect(indentSdlLinesForGoldenCase('')).toBe('');
  });
});
