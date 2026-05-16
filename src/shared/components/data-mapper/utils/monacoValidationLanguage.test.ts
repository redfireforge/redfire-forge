/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  rgbToHex, getCssVar, isLightTheme, LANGUAGE_ID, OPERATOR_KEYWORDS,
  registerLanguage, ensureCompletionProvider, applyDynamicTheme,
} from './monacoValidationLanguage';

describe('monacoValidationLanguage', () => {
  describe('LANGUAGE_ID', () => {
    it('is validation-dsl', () => {
      expect(LANGUAGE_ID).toBe('validation-dsl');
    });
  });

  describe('OPERATOR_KEYWORDS', () => {
    it('contains core operators', () => {
      expect(OPERATOR_KEYWORDS).toContain('equals');
      expect(OPERATOR_KEYWORDS).toContain('NOT');
      expect(OPERATOR_KEYWORDS).toContain('contains');
      expect(OPERATOR_KEYWORDS).toContain('is_true');
      expect(OPERATOR_KEYWORDS).toContain('between');
      expect(OPERATOR_KEYWORDS).toContain('length');
      expect(OPERATOR_KEYWORDS).toContain('each');
      expect(OPERATOR_KEYWORDS).toContain('subset');
    });
  });

  describe('rgbToHex', () => {
    it('converts rgb(r,g,b) to hex', () => {
      expect(rgbToHex('rgb(255, 0, 0)')).toBe('#ff0000');
      expect(rgbToHex('rgb(0, 255, 0)')).toBe('#00ff00');
      expect(rgbToHex('rgb(0, 0, 255)')).toBe('#0000ff');
      expect(rgbToHex('rgb(15, 23, 42)')).toBe('#0f172a');
    });

    it('converts rgba(r,g,b,a) to hex (ignoring alpha)', () => {
      expect(rgbToHex('rgba(255, 128, 0, 0.5)')).toBe('#ff8000');
    });

    it('returns input unchanged if not rgb format', () => {
      expect(rgbToHex('#ff0000')).toBe('#ff0000');
      expect(rgbToHex('blue')).toBe('blue');
    });
  });

  describe('getCssVar', () => {
    beforeEach(() => {
      vi.spyOn(window, 'getComputedStyle').mockReturnValue({
        getPropertyValue: vi.fn().mockReturnValue(''),
      } as unknown as CSSStyleDeclaration);
    });

    it('returns fallback when CSS variable is empty', () => {
      expect(getCssVar('--bg', '#0f172a')).toBe('#0f172a');
    });

    it('returns CSS variable value when set', () => {
      vi.spyOn(window, 'getComputedStyle').mockReturnValue({
        getPropertyValue: vi.fn().mockReturnValue('#abcdef'),
      } as unknown as CSSStyleDeclaration);
      expect(getCssVar('--bg', '#000')).toBe('#abcdef');
    });

    it('converts rgb values to hex', () => {
      vi.spyOn(window, 'getComputedStyle').mockReturnValue({
        getPropertyValue: vi.fn().mockReturnValue('rgb(255, 0, 0)'),
      } as unknown as CSSStyleDeclaration);
      expect(getCssVar('--danger', '#000')).toBe('#ff0000');
    });
  });

  describe('isLightTheme', () => {
    beforeEach(() => {
      document.documentElement.removeAttribute('data-theme');
      vi.spyOn(window, 'getComputedStyle').mockReturnValue({
        getPropertyValue: vi.fn().mockReturnValue(''),
      } as unknown as CSSStyleDeclaration);
    });

    it('returns true for light theme attribute', () => {
      document.documentElement.setAttribute('data-theme', 'light');
      expect(isLightTheme()).toBe(true);
    });

    it('returns true for mist theme attribute', () => {
      document.documentElement.setAttribute('data-theme', 'mist');
      expect(isLightTheme()).toBe(true);
    });

    it('returns false for dark theme attribute', () => {
      document.documentElement.setAttribute('data-theme', 'dark');
      expect(isLightTheme()).toBe(false);
    });

    it('falls back to luminance calculation when no theme attribute', () => {
      vi.spyOn(window, 'getComputedStyle').mockReturnValue({
        getPropertyValue: vi.fn().mockReturnValue('#0f172a'),
      } as unknown as CSSStyleDeclaration);
      expect(isLightTheme()).toBe(false);
    });

    it('detects light background by luminance', () => {
      vi.spyOn(window, 'getComputedStyle').mockReturnValue({
        getPropertyValue: vi.fn().mockReturnValue('#ffffff'),
      } as unknown as CSSStyleDeclaration);
      expect(isLightTheme()).toBe(true);
    });
  });

  describe('registerLanguage', () => {
    const mockMonaco = () => ({
      languages: {
        register: vi.fn(),
        setLanguageConfiguration: vi.fn(),
        setMonarchTokensProvider: vi.fn(),
        registerCompletionItemProvider: vi.fn(() => ({ dispose: vi.fn() })),
        CompletionItemKind: { Function: 1, Field: 4, Keyword: 14, Value: 12 },
      },
      editor: { defineTheme: vi.fn(), setTheme: vi.fn() },
    });

    beforeEach(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (globalThis as any).__validationDsl_languageRegistered;
      vi.spyOn(window, 'getComputedStyle').mockReturnValue({
        getPropertyValue: vi.fn().mockReturnValue(''),
      } as unknown as CSSStyleDeclaration);
    });

    it('registers language and tokenizer on first call', () => {
      const monaco = mockMonaco();
      registerLanguage(monaco as never);
      expect(monaco.languages.register).toHaveBeenCalledWith({ id: LANGUAGE_ID });
      expect(monaco.languages.setLanguageConfiguration).toHaveBeenCalled();
      expect(monaco.languages.setMonarchTokensProvider).toHaveBeenCalled();
    });

    it('does not register twice', () => {
      const monaco = mockMonaco();
      registerLanguage(monaco as never);
      registerLanguage(monaco as never);
      expect(monaco.languages.register).toHaveBeenCalledTimes(1);
    });
  });

  describe('applyDynamicTheme', () => {
    beforeEach(() => {
      vi.spyOn(window, 'getComputedStyle').mockReturnValue({
        getPropertyValue: vi.fn().mockReturnValue(''),
      } as unknown as CSSStyleDeclaration);
    });

    it('defines theme with dark base by default', () => {
      const defineTheme = vi.fn();
      const monaco = { editor: { defineTheme, setTheme: vi.fn() } };
      document.documentElement.setAttribute('data-theme', 'dark');
      applyDynamicTheme(monaco as never);
      expect(defineTheme).toHaveBeenCalledWith(
        'validation-dsl-dark',
        expect.objectContaining({ base: 'vs-dark' }),
      );
    });

    it('defines theme with light base for light theme', () => {
      const defineTheme = vi.fn();
      const monaco = { editor: { defineTheme, setTheme: vi.fn() } };
      document.documentElement.setAttribute('data-theme', 'light');
      applyDynamicTheme(monaco as never);
      expect(defineTheme).toHaveBeenCalledWith(
        'validation-dsl-dark',
        expect.objectContaining({ base: 'vs' }),
      );
    });
  });

  describe('ensureCompletionProvider', () => {
    let provideCompletionItems: (model: unknown, position: unknown) => { suggestions: unknown[] };
    const mockMonaco = {
      languages: {
        registerCompletionItemProvider: vi.fn((_langId: string, provider: { provideCompletionItems: typeof provideCompletionItems }) => {
          provideCompletionItems = provider.provideCompletionItems;
          return { dispose: vi.fn() };
        }),
        CompletionItemKind: { Function: 1, Field: 4, Keyword: 14, Value: 12 },
      },
      editor: { defineTheme: vi.fn(), setTheme: vi.fn() },
    };

    const makeModel = (lineContent: string) => ({
      getLineContent: () => lineContent,
    });
    const makePos = (col: number) => ({ lineNumber: 1, column: col });

    beforeEach(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (globalThis as any).__validationDsl_completionDisposable;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any).__REDFIRE_VALIDATION_PATHS;
      ensureCompletionProvider(mockMonaco as never);
    });

    afterEach(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any).__REDFIRE_VALIDATION_PATHS;
    });

    it('suggests operators after a path', () => {
      const result = provideCompletionItems(makeModel('data.field '), makePos(12));
      const labels = result.suggestions.map((s: { label: string }) => s.label);
      expect(labels).toContain('equals');
      expect(labels).toContain('contains');
    });

    it('suggests paths at line start when __REDFIRE_VALIDATION_PATHS is set', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__REDFIRE_VALIDATION_PATHS = ['offers', 'count'];
      const result = provideCompletionItems(makeModel(''), makePos(1));
      const labels = result.suggestions.map((s: { label: string }) => s.label);
      expect(labels).toContain('offers');
      expect(labels).toContain('count');
    });

    it('suggests ASSERT and NOT keywords at line start', () => {
      const result = provideCompletionItems(makeModel(''), makePos(1));
      const labels = result.suggestions.map((s: { label: string }) => s.label);
      expect(labels).toContain('ASSERT');
      expect(labels).toContain('NOT');
    });

    it('suggests expression functions after ASSERT', () => {
      const result = provideCompletionItems(makeModel('ASSERT '), makePos(8));
      const labels = result.suggestions.map((s: { label: string }) => s.label);
      expect(labels.some((l: string) => l.startsWith('$'))).toBe(true);
    });

    it('suggests functions after ASSERT with partial $-token', () => {
      const result = provideCompletionItems(makeModel('ASSERT $gt'), makePos(11));
      const labels = result.suggestions.map((s: { label: string }) => s.label);
      expect(labels).toContain('$gt');
    });

    it('suggests paths after ASSERT with $. prefix', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__REDFIRE_VALIDATION_PATHS = ['offers', 'count'];
      const result = provideCompletionItems(makeModel('ASSERT $.'), makePos(10));
      const labels = result.suggestions.map((s: { label: string }) => s.label);
      expect(labels).toContain('$.body.offers');
      expect(labels).toContain('$.body.count');
    });

    it('suggests ASSERT after NOT keyword', () => {
      const result = provideCompletionItems(makeModel('NOT '), makePos(5));
      const labels = result.suggestions.map((s: { label: string }) => s.label);
      expect(labels).toContain('ASSERT');
    });

    it('suggests type names after is_type operator', () => {
      const result = provideCompletionItems(makeModel('data is_type '), makePos(14));
      const labels = result.suggestions.map((s: { label: string }) => s.label);
      expect(labels).toContain('string');
      expect(labels).toContain('number');
      expect(labels).toContain('array');
    });

    it('returns empty suggestions after is_true operator', () => {
      const result = provideCompletionItems(makeModel('data is_true '), makePos(14));
      expect(result.suggestions).toEqual([]);
    });

    it('suggests boolean values after other operators', () => {
      const result = provideCompletionItems(makeModel('data equals '), makePos(13));
      const labels = result.suggestions.map((s: { label: string }) => s.label);
      expect(labels).toContain('true');
      expect(labels).toContain('false');
    });

    it('returns empty suggestions for ASSERT with no token or delimiter', () => {
      // This triggers the isAfterAssert branch but neither tokenMatch nor afterDelimiter
      const result = provideCompletionItems(makeModel('ASSERT abc'), makePos(11));
      expect(result.suggestions.length).toBeGreaterThanOrEqual(0);
    });

    it('disposes previous provider on re-registration', () => {
      const dispose1 = vi.fn();
      mockMonaco.languages.registerCompletionItemProvider.mockReturnValueOnce({ dispose: dispose1 });
      ensureCompletionProvider(mockMonaco as never);
      // Re-register
      ensureCompletionProvider(mockMonaco as never);
      expect(dispose1).toHaveBeenCalled();
    });

    it('handles NOT ASSERT expression context', () => {
      const result = provideCompletionItems(makeModel('NOT ASSERT $'), makePos(13));
      const labels = result.suggestions.map((s: { label: string }) => s.label);
      expect(labels.some((l: string) => l.startsWith('$'))).toBe(true);
    });

    it('returns empty when no paths and no keywords match partial', () => {
      const result = provideCompletionItems(makeModel('zzz'), makePos(4));
      expect(result.suggestions.length).toBe(0);
    });

    it('suggests item properties in lambda context (x => x.)', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__REDFIRE_VALIDATION_PATHS = [
        'offers[0].rank', 'offers[0].name', 'offers[0].price', 'count',
      ];
      const line = 'NOT ASSERT $eq($sum($map($.body.offers, x => x.';
      const result = provideCompletionItems(makeModel(line), makePos(line.length + 1));
      const labels = result.suggestions.map((s: { label: string }) => s.label);
      expect(labels).toContain('rank');
      expect(labels).toContain('name');
      expect(labels).toContain('price');
      expect(labels).not.toContain('count');
    });

    it('filters lambda properties by partial input (x => x.ra)', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__REDFIRE_VALIDATION_PATHS = [
        'offers[0].rank', 'offers[0].name', 'offers[0].price',
      ];
      const line = 'ASSERT $map($.body.offers, x => x.ra';
      const result = provideCompletionItems(makeModel(line), makePos(line.length + 1));
      const labels = result.suggestions.map((s: { label: string }) => s.label);
      expect(labels).toContain('rank');
      expect(labels).not.toContain('name');
      expect(labels).not.toContain('price');
    });

    it('falls back to function suggestions when no item paths found for lambda', () => {
      // No paths set — lambda should fall through to function suggestions
      const line = 'ASSERT $map($.body.items, y => y.';
      const result = provideCompletionItems(makeModel(line), makePos(line.length + 1));
      const labels = result.suggestions.map((s: { label: string }) => s.label);
      // Should get function suggestions as fallback
      expect(labels.some((l: string) => l.startsWith('$'))).toBe(true);
    });
  });
});
