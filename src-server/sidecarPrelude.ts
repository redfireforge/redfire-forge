/**
 * Sidecar prelude — must be imported before anything else.
 *
 * A few server modules load optional/heavy packages through
 * `createRequire(import.meta.url)` so they stay lazy. esbuild cannot see those
 * ids, so in the bundled sidecar (which ships without `node_modules`) they fail
 * to resolve. Importing them statically here pulls them into the bundle, and
 * patching `createRequire` hands the bundled copy back to those call sites.
 *
 * Only affects the packaged sidecar; `tsx src-server/index.ts` never loads it.
 */
import Module from 'node:module';

import * as kafkajs from 'kafkajs';
import kafkajsSnappy from 'kafkajs-snappy';
import * as grpcJs from '@grpc/grpc-js';
import * as undici from 'undici';

const BUNDLED: Record<string, unknown> = {
  'kafkajs': kafkajs,
  'kafkajs-snappy': kafkajsSnappy,
  '@grpc/grpc-js': grpcJs,
  'undici': undici,
};

type CreateRequire = typeof Module.createRequire;
const original: CreateRequire = Module.createRequire;

(Module as { createRequire: CreateRequire }).createRequire = ((path: string | URL) => {
  const real = original(path);
  const patched = ((id: string) => (id in BUNDLED ? BUNDLED[id] : real(id))) as ReturnType<CreateRequire>;
  return Object.assign(patched, real);
}) as CreateRequire;

// Tauri keeps a stdin pipe open to the sidecar for its lifetime. If the desktop
// app exits — including a crash or SIGKILL, where no shutdown hook runs — the
// pipe closes and we exit too, rather than leaking a process holding the port.
if (process.env['RF_SIDECAR'] === '1') {
  const exit = () => process.exit(0);
  process.stdin.on('end', exit);
  process.stdin.on('close', exit);
  process.stdin.on('error', exit);
  process.stdin.resume();
}
