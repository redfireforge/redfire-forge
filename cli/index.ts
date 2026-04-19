#!/usr/bin/env node

import { Command } from 'commander';
import { readFileSync, writeFileSync } from 'fs';
import { resolve, basename, dirname } from 'path';
import { fileURLToPath } from 'url';
import { loadTestFile, buildScenarios, buildTestConfig } from './loader';
import { runTest } from '../src/engine/executor';
import { computeMetrics } from '../src/engine/metrics';
import {
  buildJsonReport,
  buildJunitXml,
  buildMarkdownReport,
  printConsoleSummary,
} from './reporters';
import type { RequestResult } from '../src/types';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(resolve(__dirname, '..', 'package.json'), 'utf-8'));

const program = new Command();

program
  .name('redfireforge')
  .description('RedfireForge CLI — run API performance tests from YAML/JSON files')
  .version(pkg.version);

program
  .command('run')
  .description('Execute a test file')
  .argument('<file>', 'Path to a .yaml, .yml, or .json test file')
  .option('-c, --concurrency <n>', 'Number of concurrent requests', parseInt)
  .option('-t, --transactions <n>', 'Total number of requests', parseInt)
  .option('-m, --mode <mode>', 'Execution mode: sequential, batch, pool, load-profile')
  .option('--timeout <sec>', 'Per-request timeout in seconds', parseInt)
  .option('--retries <n>', 'Retry count on failure', parseInt)
  .option('--retry-delay <ms>', 'Delay between retries in milliseconds', parseInt)
  .option('--duration <sec>', 'Duration in seconds (load-profile mode)', parseInt)
  .option('--base-url <url>', 'Override the base URL for all tests')
  .option('--env <name>', 'Environment name (metadata only)')
  .option('--error-policy <policy>', 'Error policy: continue, stop-first, stop-threshold')
  .option('--max-errors <n>', 'Stop after N errors (threshold mode)', parseInt)
  .option('--max-error-rate <pct>', 'Stop at error rate % (threshold mode)', parseFloat)
  .option('--fail-on-error', 'Exit code 1 if any request fails (HTTP or validation)')
  .option('--fail-threshold <pct>', 'Exit code 1 if error rate exceeds this %', parseFloat)
  .option('-o, --output <path>', 'Write JSON report to file')
  .option('--junit <path>', 'Write JUnit XML report to file')
  .option('--markdown <path>', 'Write Markdown report to file')
  .option('-q, --quiet', 'Suppress progress output')
  .action(async (filePath: string, opts) => {
    try {
      const absPath = resolve(filePath);
      const file = loadTestFile(absPath);

      if (!opts.quiet) {
        console.log(`\n  Loading: ${basename(absPath)}`);
        console.log(`  Tests:   ${file.tests.length}`);
        if (file.name) console.log(`  Suite:   ${file.name}`);
      }

      const scenarios = buildScenarios(file, opts.baseUrl);
      const config = buildTestConfig(file, scenarios, {
        concurrency: opts.concurrency,
        transactions: opts.transactions,
        mode: opts.mode,
        timeout: opts.timeout,
        retries: opts.retries,
        retryDelay: opts.retryDelay,
        duration: opts.duration,
        errorPolicy: opts.errorPolicy,
        maxErrors: opts.maxErrors,
        maxErrorRate: opts.maxErrorRate,
      });

      if (!opts.quiet) {
        console.log(`  Mode:    ${config.executionMode} (C:${config.concurrency} T:${config.totalTransactions})`);
        console.log('');
      }

      const abortController = new AbortController();
      process.on('SIGINT', () => {
        if (!opts.quiet) console.log('\n  Aborting...');
        abortController.abort();
      });

      let lastPrinted = 0;
      const onProgress = (completed: number, total: number, _results: RequestResult[]) => {
        if (opts.quiet) return;
        const now = Date.now();
        if (now - lastPrinted < 500 && completed < total) return;
        lastPrinted = now;
        const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
        process.stdout.write(`\r  Progress: ${completed}/${total} (${pct}%)`);
      };

      const t0 = performance.now();
      const results = await runTest(config, scenarios, onProgress, abortController.signal);
      const elapsed = performance.now() - t0;
      const summary = computeMetrics(results, elapsed);

      if (!opts.quiet) {
        process.stdout.write('\r' + ' '.repeat(60) + '\r');
      }

      printConsoleSummary(summary, config, results);

      const suiteName = file.name || basename(absPath, '.yaml').replace(/\.yml$|\.json$/, '');
      const meta = { name: file.name, env: opts.env || file.env, file: basename(absPath) };

      if (opts.output) {
        const report = buildJsonReport(results, summary, config, meta);
        writeFileSync(resolve(opts.output), JSON.stringify(report, null, 2));
        console.log(`  JSON report: ${opts.output}`);
      }

      if (opts.junit) {
        const xml = buildJunitXml(results, summary, suiteName);
        writeFileSync(resolve(opts.junit), xml);
        console.log(`  JUnit XML:   ${opts.junit}`);
      }

      if (opts.markdown) {
        const md = buildMarkdownReport(summary, config, meta, results);
        writeFileSync(resolve(opts.markdown), md);
        console.log(`  Markdown:    ${opts.markdown}`);
      }

      // Exit code logic
      const passed = summary.failedRequests === 0 && summary.failedValidations === 0;
      if (opts.failOnError && !passed) {
        process.exit(1);
      }
      if (opts.failThreshold != null && summary.errorRate > opts.failThreshold) {
        if (!opts.quiet) {
          console.log(`  Error rate ${summary.errorRate}% exceeds threshold ${opts.failThreshold}%`);
        }
        process.exit(1);
      }

      process.exit(0);
    } catch (err) {
      console.error(`\n  Error: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(2);
    }
  });

program
  .command('validate')
  .description('Validate a test file without running it')
  .argument('<file>', 'Path to a .yaml, .yml, or .json test file')
  .action((filePath: string) => {
    try {
      const absPath = resolve(filePath);
      const file = loadTestFile(absPath);
      const scenarios = buildScenarios(file);
      console.log(`\n  ✅ Valid test file: ${basename(absPath)}`);
      console.log(`  Tests: ${scenarios.length}`);
      for (const s of scenarios) {
        console.log(`    - ${s.method} ${s.url}  (${s.name})`);
      }
      console.log('');
      process.exit(0);
    } catch (err) {
      console.error(`\n  ❌ Invalid: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(2);
    }
  });

program.parse();
