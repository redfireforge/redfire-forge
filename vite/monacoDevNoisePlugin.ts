import fs from 'node:fs';
import type { Logger, Plugin } from 'vite';
import { createLogger } from 'vite';

const MONACO_PACKAGES = ['monaco-graphql', 'monaco-editor'] as const;

const EMPTY_SOURCEMAP = JSON.stringify({
  version: 3,
  sources: [],
  names: [],
  mappings: '',
});

function isMonacoPackageId(id: string): boolean {
  const normalized = id.split('?')[0] ?? id;
  return MONACO_PACKAGES.some((pkg) => normalized.includes(`node_modules/${pkg}/`));
}

function stripSourceMappingComments(code: string): string {
  return code.replace(/\n?\s*\/\/[#@]\s*sourceMappingURL=.*$/gm, '');
}

function isMonacoSourcemapLog(message: string): boolean {
  if (!message.includes('Sourcemap for') && !message.includes('Failed to load source map')) {
    return false;
  }
  return MONACO_PACKAGES.some((pkg) => message.includes(pkg))
    || (message.includes('Failed to load source map') && message.includes('monaco-editor'));
}

/**
 * Monaco packages ship broken sourcemaps (missing `src/` and `.map` peers).
 * Serve stripped JS and stub `.map` files before Vite parses sourcemap comments.
 */
function shouldInterceptMonacoLoad(id: string): boolean {
  if (id.includes('?worker') || id.includes('?url') || id.includes('?raw')) {
    return false;
  }
  const filePath = id.split('?')[0] ?? id;
  if (!isMonacoPackageId(filePath)) {
    return false;
  }
  if (filePath.endsWith('.worker.js') || filePath.includes('/worker/')) {
    return false;
  }
  return filePath.endsWith('.js') || filePath.endsWith('.mjs') || filePath.endsWith('.map');
}

export function monacoDevNoisePlugin(): Plugin {
  return {
    name: 'monaco-dev-noise',
    enforce: 'pre',
    load(id) {
      if (!shouldInterceptMonacoLoad(id)) {
        return null;
      }
      const filePath = id.split('?')[0] ?? id;
      if (filePath.endsWith('.map')) {
        return EMPTY_SOURCEMAP;
      }
      const code = fs.readFileSync(filePath, 'utf-8');
      return stripSourceMappingComments(code);
    },
    transform(code, id) {
      if (!isMonacoPackageId(id) || !code.includes('sourceMappingURL')) {
        return null;
      }
      const stripped = stripSourceMappingComments(code);
      return stripped === code ? null : { code: stripped, map: null };
    },
  };
}

/** Wrap Vite's logger to drop known Monaco sourcemap warnings (dev + vitest). */
export function createMonacoAwareLogger(baseLogger?: Logger): Logger {
  const logger = baseLogger ?? createLogger();
  const wrap = (method: 'warn' | 'warnOnce' | 'info') => {
    const original = logger[method].bind(logger);
    logger[method] = (msg, options) => {
      if (typeof msg === 'string' && isMonacoSourcemapLog(msg)) {
        return;
      }
      original(msg, options);
    };
  };
  wrap('warn');
  wrap('warnOnce');
  wrap('info');
  return logger;
}
