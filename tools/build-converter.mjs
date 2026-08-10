/**
 * Builds the swagger-to-openapi converter into a single self-contained HTML file.
 * Usage: node tools/build-converter.mjs
 * Output: tools/swagger-to-openapi-standalone.html
 */
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// 1. Read the app script from the HTML
const html = readFileSync(resolve(__dirname, 'swagger-to-openapi.html'), 'utf8');
const appScriptMatch = html.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/);
if (!appScriptMatch) { throw new Error('Could not find app script in HTML'); }
const appScript = appScriptMatch[1];

// 2. Bundle the conversion libraries + app logic together
const entryCode = `
import { convertObj } from 'swagger2openapi';
import YAML from 'yaml';

// Expose as globals for the app code
window.swagger2openapi = { convertObj };
window.YAML = YAML;

// Run app code after DOM is ready
document.addEventListener('DOMContentLoaded', () => {
${appScript}
});
`;

const result = await build({
  stdin: {
    contents: entryCode,
    resolveDir: resolve(__dirname, '..'),
    loader: 'js',
  },
  bundle: true,
  format: 'iife',
  platform: 'browser',
  write: false,
  minify: true,
  target: 'es2020',
  define: {
    'process.env.NODE_ENV': '"production"',
    'process.env': '{}',
    'process.version': '"v18.0.0"',
    'process.platform': '"browser"',
    'process.stdout': '{}',
    'process.stderr': '{}',
  },
  // Shim out Node.js built-ins that swagger2openapi imports but doesn't use
  // when resolve:false is set (no file I/O needed for in-memory conversion)
  plugins: [{
    name: 'node-shims',
    setup(build) {
      const shims = ['fs', 'path', 'url', 'http', 'https', 'stream', 'zlib', 'net', 'tls'];
      for (const mod of shims) {
        build.onResolve({ filter: new RegExp(`^${mod}$`) }, () => ({
          path: mod,
          namespace: 'node-shim',
        }));
      }
      build.onLoad({ filter: /.*/, namespace: 'node-shim' }, (args) => {
        // Provide minimal stubs
        if (args.path === 'fs') {
          return { contents: 'module.exports = { readFileSync() { return ""; }, existsSync() { return false; } };' };
        }
        if (args.path === 'path') {
          return { contents: 'module.exports = { resolve(...a) { return a.join("/"); }, join(...a) { return a.join("/"); }, dirname(p) { return p; }, basename(p) { return p; }, extname(p) { return ""; }, relative(a,b) { return b; }, normalize(p) { return p; }, isAbsolute() { return false; } };' };
        }
        if (args.path === 'url') {
          return { contents: 'module.exports = { resolve(a,b) { return b || a; }, parse(u) { return {}; }, format(u) { return ""; }, URL: globalThis.URL };' };
        }
        if (args.path === 'http') {
          return { contents: 'module.exports = { STATUS_CODES: {}, get() {} };' };
        }
        return { contents: 'module.exports = {};' };
      });
    }
  }],
});

let bundledJs = result.outputFiles[0].text;
// Escape ALL occurrences of </ in the bundled JS so the HTML parser
// never sees anything that looks like a closing tag inside the script block.
// Using split/join because template literals in minified code make regex tricky.
bundledJs = bundledJs.split('</').join('\\x3c/');

// 3. Replace the comment marker + remove the original app script, inject bundled code
let output = html.replace(
  /<!-- Libraries are bundled inline by build-converter\.mjs -->/,
  ''
);
// Use function replacement to avoid $-substitution in minified JS
output = output.replace(
  /<script>[\s\S]*?<\/script>\s*<\/body>/,
  () => `<script>\n${bundledJs}\n</script>\n</body>`
);

// 4. Write standalone file
const outPath = resolve(__dirname, 'swagger-to-openapi-standalone.html');
writeFileSync(outPath, output);
console.log(`✅ Built: ${outPath} (${(Buffer.byteLength(output) / 1024).toFixed(0)} KB)`);
