import { vi } from 'vitest';

/**
 * Global Vitest setup — polyfills required by Monaco Editor in jsdom.
 */
if (typeof document !== 'undefined' && typeof document.queryCommandSupported !== 'function') {
  document.queryCommandSupported = () => false;
}

/**
 * Suppress jsdom "Not implemented" warnings that come through process.stderr
 * (jsdom's virtualConsole emits these before our console patches can catch them).
 */
if (typeof process !== 'undefined' && process.stderr) {
  const originalStderrWrite = process.stderr.write.bind(process.stderr);
  process.stderr.write = (chunk: unknown, ...args: unknown[]) => {
    const text = typeof chunk === 'string' ? chunk : chunk instanceof Buffer ? chunk.toString() : '';
    if (text.includes('Not implemented:') || text.includes('Error: Not implemented')) {
      return true;
    }
    return (originalStderrWrite as (...a: unknown[]) => boolean)(chunk, ...args);
  };
}

/** Known jsdom / Monaco noise that is safe to silence in unit tests. */
const CONSOLE_NOISE = [
  'Not implemented: navigation to another Document',
  'Sourcemap for',
  'Failed to load source map',
  'points to missing source files',
  'points to a source file outside its package',
] as const;

function formatConsoleArg(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value instanceof Error) return value.message;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function isKnownConsoleNoise(text: string): boolean {
  if (text.includes(CONSOLE_NOISE[0])) return true;
  if (text.includes(CONSOLE_NOISE[2]) && text.includes('monaco-editor')) return true;
  if (!text.includes(CONSOLE_NOISE[1])) return false;
  const monacoRelated = text.includes('monaco-graphql') || text.includes('monaco-editor');
  return monacoRelated && (text.includes(CONSOLE_NOISE[3]) || text.includes(CONSOLE_NOISE[4]));
}

for (const method of ['error', 'warn', 'info'] as const) {
  const original = console[method].bind(console);
  console[method] = (...args: unknown[]) => {
    const text = args.map(formatConsoleArg).join(' ');
    if (isKnownConsoleNoise(text)) return;
    original(...args);
  };
}

/**
 * Shared helper used across tests to avoid repeating vi.clearAllMocks().
 */
(globalThis as typeof globalThis & { resetAllMocks: () => void }).resetAllMocks = () => {
  vi.clearAllMocks();
};
