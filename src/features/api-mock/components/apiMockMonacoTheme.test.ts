/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, afterEach, vi } from 'vitest';
import {
  API_MOCK_MONACO_THEME,
  defineApiMockMonacoTheme,
  isApiMockLightTheme,
  readCssColor,
} from './apiMockMonacoTheme';

describe('apiMockMonacoTheme', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.style.removeProperty('--bg');
    vi.unstubAllGlobals();
  });

  it('reads CSS tokens and falls back when unset', () => {
    document.documentElement.style.setProperty('--bg', '#0f172a');
    expect(readCssColor('--bg', '#000')).toBe('#0f172a');
    expect(readCssColor('--missing-token', '#abc')).toBe('#abc');
  });

  it('treats named light themes as light and others as dark', () => {
    document.documentElement.setAttribute('data-theme', 'mist');
    expect(isApiMockLightTheme()).toBe(true);
    document.documentElement.setAttribute('data-theme', 'dark');
    expect(isApiMockLightTheme()).toBe(false);
  });

  it('infers light vs dark from --bg when data-theme is empty', () => {
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.style.setProperty('--bg', '#f8fafc');
    expect(isApiMockLightTheme()).toBe(true);
    document.documentElement.style.setProperty('--bg', '#0f172a');
    expect(isApiMockLightTheme()).toBe(false);
  });

  it('defines a Studio theme on --bg, not vs-dark charcoal', () => {
    document.documentElement.setAttribute('data-theme', 'dark');
    document.documentElement.style.setProperty('--bg', '#0f172a');
    document.documentElement.style.setProperty('--text', '#f1f5f9');
    const defineTheme = vi.fn();
    defineApiMockMonacoTheme({ editor: { defineTheme } });
    expect(defineTheme).toHaveBeenCalledWith(
      API_MOCK_MONACO_THEME,
      expect.objectContaining({
        base: 'vs-dark',
        colors: expect.objectContaining({
          'editor.background': '#0f172a',
          'editorGutter.background': '#0f172a',
          'editor.foreground': '#f1f5f9',
        }),
      }),
    );
  });

  it('falls back when document is missing or --bg is not hex', () => {
    vi.stubGlobal('document', undefined);
    expect(readCssColor('--bg', '#abc123')).toBe('#abc123');
    expect(isApiMockLightTheme()).toBe(false);
    vi.unstubAllGlobals();

    document.documentElement.removeAttribute('data-theme');
    document.documentElement.style.setProperty('--bg', '#zzzzzz');
    expect(isApiMockLightTheme()).toBe(false);
  });

  it('uses the vs base on a light theme', () => {
    document.documentElement.setAttribute('data-theme', 'light');
    const defineTheme = vi.fn();
    defineApiMockMonacoTheme({ editor: { defineTheme } });
    expect(defineTheme).toHaveBeenCalledWith(
      API_MOCK_MONACO_THEME,
      expect.objectContaining({ base: 'vs' }),
    );
  });
});
