/**
 * Global Vitest setup — polyfills required by Monaco Editor in jsdom.
 */
if (typeof document !== 'undefined' && typeof document.queryCommandSupported !== 'function') {
  document.queryCommandSupported = () => false;
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
