import { build } from 'esbuild';
import { writeFileSync, readFileSync, chmodSync } from 'fs';

await build({
  entryPoints: ['cli/index.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  outfile: 'dist-cli/redfireforge.mjs',
  external: ['commander', 'yaml', 'uuid', 'undici'],
  minify: false,
  sourcemap: false,
});

let content = readFileSync('dist-cli/redfireforge.mjs', 'utf-8');
if (!content.startsWith('#!')) {
  content = '#!/usr/bin/env node\n' + content;
  writeFileSync('dist-cli/redfireforge.mjs', content);
}
chmodSync('dist-cli/redfireforge.mjs', 0o755);

console.log('  Built dist-cli/redfireforge.mjs');
