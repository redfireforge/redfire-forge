import { build } from 'esbuild';
import { writeFileSync, readFileSync, chmodSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

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
  alias: {
    '@shared': resolve(root, 'src/shared'),
    '@engine': resolve(root, 'src/engine'),
    '@engine/core': resolve(root, 'src/engine/core'),
    '@engine/grpc': resolve(root, 'src/engine/grpc'),
    '@engine/load': resolve(root, 'src/engine/load'),
    '@graphql': resolve(root, 'src/features/graphql'),
    '@grpc': resolve(root, 'src/features/grpc'),
    '@workflow': resolve(root, 'src/features/workflow'),
    '@app': resolve(root, 'src/app'),
  },
});

let content = readFileSync('dist-cli/redfireforge.mjs', 'utf-8');
if (!content.startsWith('#!')) {
  content = '#!/usr/bin/env node\n' + content;
  writeFileSync('dist-cli/redfireforge.mjs', content);
}
chmodSync('dist-cli/redfireforge.mjs', 0o755);

console.log('  Built dist-cli/redfireforge.mjs');
