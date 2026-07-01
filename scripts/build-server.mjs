import { build } from 'esbuild';
import { writeFileSync, readFileSync, chmodSync, mkdirSync } from 'fs';

// Ensure output directory exists
mkdirSync('dist-server', { recursive: true });

await build({
  entryPoints: ['src-server/index.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  outfile: 'dist-server/index.mjs',
  external: ['express', 'node-cron', 'kafkajs', '@grpc/grpc-js', 'protobufjs', 'grpc-js-reflection-client', '@grpc/proto-loader', 'lodash'],
  minify: false,
  sourcemap: true,
  banner: {
    js: '#!/usr/bin/env node',
  },
});

// Make executable
chmodSync('dist-server/index.mjs', 0o755);

console.log('✅ Built dist-server/index.mjs');
