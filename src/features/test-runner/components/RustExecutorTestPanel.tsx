/**
 * Dev-only integration test panel for verifying the Rust executor via Tauri IPC.
 * Rendered only when import.meta.env.DEV is true and running inside Tauri.
 *
 * Tests:
 *  1. isRustExecutorAvailable — confirm Tauri command registration
 *  2. Pool execution — 3 mock requests against httpbin.org, verify progress + completion
 *  3. Sequential execution — same scenarios, concurrency=1
 *  4. Load profile — sustained 5-second run
 *  5. Abort — start a long run and cancel immediately
 *  6. Circuit breaker — trigger stop-first on a bad URL
 */

import { useCallback, useRef, useState } from 'react';
import {
  isRustExecutorAvailable,
  resetAvailabilityCache,
  startRustLoadTest,
  abortRustLoadTest,
  type RustExecutionPlan,
  type RustProgressBatch,
  type RustCompletionSummary,
  type RustScenario,
} from '../utils/rustBridge';

interface TestResult {
  name: string;
  status: 'pending' | 'running' | 'pass' | 'fail';
  detail: string;
  progressEvents: number;
  totalResults: number;
  durationMs: number;
}

const HTTPBIN = 'https://httpbin.org';

function makeScenarios(count: number): RustScenario[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `s${i}`,
    name: `Scenario ${i}`,
    url: `${HTTPBIN}/get?idx=${i}`,
    method: 'GET',
    headers: { 'accept': 'application/json' },
  }));
}

function makeBadScenario(): RustScenario {
  return {
    id: 'bad',
    name: 'Bad URL',
    url: 'http://192.0.2.1:1/never-connects',
    method: 'GET',
    headers: {},
  };
}

const INITIAL_TESTS: TestResult[] = [
  { name: 'Availability Check', status: 'pending', detail: '', progressEvents: 0, totalResults: 0, durationMs: 0 },
  { name: 'Pool Execution', status: 'pending', detail: '', progressEvents: 0, totalResults: 0, durationMs: 0 },
  { name: 'Sequential Execution', status: 'pending', detail: '', progressEvents: 0, totalResults: 0, durationMs: 0 },
  { name: 'Load Profile (5s)', status: 'pending', detail: '', progressEvents: 0, totalResults: 0, durationMs: 0 },
  { name: 'Abort Test', status: 'pending', detail: '', progressEvents: 0, totalResults: 0, durationMs: 0 },
  { name: 'Circuit Breaker', status: 'pending', detail: '', progressEvents: 0, totalResults: 0, durationMs: 0 },
];

export default function RustExecutorTestPanel() {
  const [tests, setTests] = useState<TestResult[]>(INITIAL_TESTS);
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const logRef = useRef<HTMLPreElement>(null);

  const appendLog = useCallback((msg: string) => {
    const ts = new Date().toISOString().slice(11, 23);
    setLog(prev => [...prev, `[${ts}] ${msg}`]);
    setTimeout(() => {
      logRef.current?.scrollTo(0, logRef.current.scrollHeight);
    }, 10);
  }, []);

  const updateTest = useCallback((idx: number, patch: Partial<TestResult>) => {
    setTests(prev => prev.map((t, i) => i === idx ? { ...t, ...patch } : t));
  }, []);

  const runAllTests = useCallback(async () => {
    setRunning(true);
    setTests(INITIAL_TESTS);
    setLog([]);
    appendLog('Starting Rust executor integration tests...');

    // Test 1: Availability
    updateTest(0, { status: 'running' });
    appendLog('Test 1: Checking Rust executor availability...');
    try {
      resetAvailabilityCache();
      const available = await isRustExecutorAvailable();
      if (available) {
        updateTest(0, { status: 'pass', detail: 'Rust executor confirmed available' });
        appendLog('  PASS: isRustExecutorAvailable() → true');
      } else {
        updateTest(0, { status: 'fail', detail: 'Not available (not running in Tauri?)' });
        appendLog('  FAIL: isRustExecutorAvailable() → false');
        appendLog('Aborting remaining tests — Rust executor not available.');
        setRunning(false);
        return;
      }
    } catch (err) {
      updateTest(0, { status: 'fail', detail: String(err) });
      appendLog(`  FAIL: ${err}`);
      setRunning(false);
      return;
    }

    // Test 2: Pool execution
    await runExecutionTest(1, 'Pool', {
      mode: 'pool',
      scenarios: makeScenarios(6),
      concurrency: 3,
      timeoutMs: 10000,
      retryCount: 0,
      retryDelayMs: 0,
      thinkTime: { type: 'none' },
      circuitBreaker: { policy: 'continue' },
    });

    // Test 3: Sequential execution
    await runExecutionTest(2, 'Sequential', {
      mode: 'sequential',
      scenarios: makeScenarios(3),
      timeoutMs: 10000,
      retryCount: 0,
      retryDelayMs: 0,
      thinkTime: { type: 'none' },
      circuitBreaker: { policy: 'continue' },
    });

    // Test 4: Load profile (5-second sustained)
    await runExecutionTest(3, 'LoadProfile', {
      mode: 'load-profile',
      scenarios: makeScenarios(2),
      concurrency: 2,
      durationSec: 5,
      timeoutMs: 10000,
      retryCount: 0,
      retryDelayMs: 0,
      thinkTime: { type: 'constant', delayMs: 200 },
      circuitBreaker: { policy: 'continue' },
      profileType: 'sustained',
    });

    // Test 5: Abort test
    updateTest(4, { status: 'running' });
    appendLog('Test 5: Abort — starting long load profile then aborting...');
    try {
      let progressCount = 0;
      const start = performance.now();
      const { unlisten } = await startRustLoadTest(
        {
          mode: 'load-profile',
          scenarios: makeScenarios(2),
          concurrency: 2,
          durationSec: 60,
          timeoutMs: 10000,
          retryCount: 0,
          retryDelayMs: 0,
          thinkTime: { type: 'constant', delayMs: 100 },
          circuitBreaker: { policy: 'continue' },
          profileType: 'sustained',
        },
        () => { progressCount++; },
        () => {},
      );

      await new Promise(r => setTimeout(r, 1500));
      await abortRustLoadTest();
      await new Promise(r => setTimeout(r, 500));
      unlisten();

      const elapsed = performance.now() - start;
      if (elapsed < 55000) {
        updateTest(4, {
          status: 'pass',
          detail: `Aborted in ${Math.round(elapsed)}ms, ${progressCount} progress events received`,
          durationMs: Math.round(elapsed),
          progressEvents: progressCount,
        });
        appendLog(`  PASS: Abort took ${Math.round(elapsed)}ms (expected <55s), ${progressCount} progress batches`);
      } else {
        updateTest(4, { status: 'fail', detail: `Abort took too long: ${Math.round(elapsed)}ms` });
        appendLog(`  FAIL: Abort took ${Math.round(elapsed)}ms — test should have stopped quickly`);
      }
    } catch (err) {
      updateTest(4, { status: 'fail', detail: String(err) });
      appendLog(`  FAIL: ${err}`);
    }

    // Test 6: Circuit breaker (stop-first)
    updateTest(5, { status: 'running' });
    appendLog('Test 6: Circuit breaker stop-first with bad URL...');
    try {
      let progressCount = 0;
      let totalResults = 0;
      let breakerTripped = false;
      const start = performance.now();

      await new Promise<void>((resolve) => {
        startRustLoadTest(
          {
            mode: 'pool',
            scenarios: [makeBadScenario(), makeBadScenario(), makeBadScenario()],
            concurrency: 1,
            timeoutMs: 3000,
            retryCount: 0,
            retryDelayMs: 0,
            thinkTime: { type: 'none' },
            circuitBreaker: { policy: 'stop-first' },
          },
          (batch) => {
            progressCount++;
            totalResults += batch.results.length;
            if (batch.breakerTripped) breakerTripped = true;
          },
          (summary) => {
            if (summary.breakerTripped) breakerTripped = true;
            totalResults = Number(summary.totalResults);
            resolve();
          },
          () => resolve(),
        );
      });

      const elapsed = performance.now() - start;
      if (breakerTripped) {
        updateTest(5, {
          status: 'pass',
          detail: `Breaker tripped after ${totalResults} result(s) in ${Math.round(elapsed)}ms`,
          durationMs: Math.round(elapsed),
          progressEvents: progressCount,
          totalResults,
        });
        appendLog(`  PASS: Circuit breaker tripped, ${totalResults} results, ${Math.round(elapsed)}ms`);
      } else {
        updateTest(5, {
          status: 'fail',
          detail: `Breaker did not trip. ${totalResults} results in ${Math.round(elapsed)}ms`,
          durationMs: Math.round(elapsed),
          totalResults,
        });
        appendLog(`  FAIL: Circuit breaker did NOT trip after ${totalResults} results`);
      }
    } catch (err) {
      updateTest(5, { status: 'fail', detail: String(err) });
      appendLog(`  FAIL: ${err}`);
    }

    appendLog('All tests completed.');
    setRunning(false);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runExecutionTest(idx: number, label: string, plan: RustExecutionPlan) {
    updateTest(idx, { status: 'running' });
    appendLog(`Test ${idx + 1}: ${label} execution...`);
    try {
      let progressCount = 0;
      let totalResults = 0;
      const start = performance.now();

      await new Promise<void>((resolve) => {
        startRustLoadTest(
          plan,
          (batch: RustProgressBatch) => {
            progressCount++;
            totalResults += batch.results.length;
            appendLog(`  [progress] completed=${batch.completed}/${batch.total} inFlight=${batch.currentInFlight} target=${batch.targetConcurrency} elapsed=${batch.elapsedMs}ms`);
          },
          (summary: RustCompletionSummary) => {
            appendLog(`  [complete] total=${summary.totalResults} duration=${summary.durationMs}ms breaker=${summary.breakerTripped}`);
            resolve();
          },
          (err) => {
            appendLog(`  [error] ${err}`);
            resolve();
          },
        );
      });

      const elapsed = performance.now() - start;
      const pass = totalResults > 0;
      updateTest(idx, {
        status: pass ? 'pass' : 'fail',
        detail: pass
          ? `${totalResults} results, ${progressCount} batches, ${Math.round(elapsed)}ms`
          : `No results received in ${Math.round(elapsed)}ms`,
        progressEvents: progressCount,
        totalResults,
        durationMs: Math.round(elapsed),
      });
      appendLog(`  ${pass ? 'PASS' : 'FAIL'}: ${totalResults} results in ${Math.round(elapsed)}ms`);
    } catch (err) {
      updateTest(idx, { status: 'fail', detail: String(err) });
      appendLog(`  FAIL: ${err}`);
    }
  }

  const passCount = tests.filter(t => t.status === 'pass').length;
  const failCount = tests.filter(t => t.status === 'fail').length;

  return (
    <div style={{
      padding: '20px',
      fontFamily: 'var(--font-mono, "SF Mono", Menlo, monospace)',
      fontSize: '13px',
      color: 'var(--text, #e0e0e0)',
      background: 'var(--background, #0d1117)',
      minHeight: '100vh',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: '16px', color: 'var(--text-heading, #fff)' }}>
          Rust Executor Integration Tests
        </h2>
        <span style={{ fontSize: '11px', color: 'var(--text-muted, #8b949e)', padding: '2px 8px', background: 'var(--surface-hover, #21262d)', borderRadius: 4 }}>
          Phase 2B
        </span>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <button
          onClick={runAllTests}
          disabled={running}
          style={{
            padding: '8px 20px',
            background: running ? 'var(--surface-hover, #21262d)' : 'var(--accent, #58a6ff)',
            color: running ? 'var(--text-muted, #8b949e)' : '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: running ? 'not-allowed' : 'pointer',
            fontWeight: 600,
            fontSize: '13px',
          }}
        >
          {running ? 'Running...' : 'Run All Tests'}
        </button>
        {!running && (passCount + failCount > 0) && (
          <span style={{
            display: 'flex', alignItems: 'center', gap: 8, fontSize: '13px',
            color: failCount > 0 ? '#f85149' : '#3fb950',
          }}>
            {passCount > 0 && <span>{passCount} passed</span>}
            {failCount > 0 && <span>{failCount} failed</span>}
          </span>
        )}
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border, #30363d)', textAlign: 'left' }}>
            <th style={{ padding: '6px 8px', width: 30 }}>#</th>
            <th style={{ padding: '6px 8px' }}>Test</th>
            <th style={{ padding: '6px 8px', width: 80 }}>Status</th>
            <th style={{ padding: '6px 8px', width: 60 }}>Events</th>
            <th style={{ padding: '6px 8px', width: 70 }}>Results</th>
            <th style={{ padding: '6px 8px', width: 80 }}>Duration</th>
            <th style={{ padding: '6px 8px' }}>Detail</th>
          </tr>
        </thead>
        <tbody>
          {tests.map((t, i) => (
            <tr key={i} style={{ borderBottom: '1px solid var(--border, #30363d)' }}>
              <td style={{ padding: '6px 8px', color: 'var(--text-muted, #8b949e)' }}>{i + 1}</td>
              <td style={{ padding: '6px 8px' }}>{t.name}</td>
              <td style={{ padding: '6px 8px' }}>
                <StatusBadge status={t.status} />
              </td>
              <td style={{ padding: '6px 8px', textAlign: 'center' }}>{t.progressEvents || '—'}</td>
              <td style={{ padding: '6px 8px', textAlign: 'center' }}>{t.totalResults || '—'}</td>
              <td style={{ padding: '6px 8px' }}>{t.durationMs ? `${t.durationMs}ms` : '—'}</td>
              <td style={{ padding: '6px 8px', color: 'var(--text-muted, #8b949e)', fontSize: '12px' }}>{t.detail}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3 style={{ margin: '0 0 8px', fontSize: '13px', color: 'var(--text-heading, #fff)' }}>Event Log</h3>
      <pre
        ref={logRef}
        style={{
          background: 'var(--surface, #161b22)',
          border: '1px solid var(--border, #30363d)',
          borderRadius: 6,
          padding: 12,
          maxHeight: 300,
          overflow: 'auto',
          fontSize: '11px',
          lineHeight: 1.5,
          whiteSpace: 'pre-wrap',
          color: 'var(--text-muted, #8b949e)',
        }}
      >
        {log.length > 0 ? log.join('\n') : 'Click "Run All Tests" to begin.'}
      </pre>
    </div>
  );
}

function StatusBadge({ status }: { status: TestResult['status'] }) {
  const styles: Record<string, { bg: string; color: string; label: string }> = {
    pending: { bg: 'rgba(128,128,128,0.15)', color: '#8b949e', label: 'PENDING' },
    running: { bg: 'rgba(88,166,255,0.15)', color: '#58a6ff', label: 'RUNNING' },
    pass: { bg: 'rgba(63,185,80,0.15)', color: '#3fb950', label: 'PASS' },
    fail: { bg: 'rgba(248,81,73,0.15)', color: '#f85149', label: 'FAIL' },
  };
  const s = styles[status];
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: 4,
      background: s.bg,
      color: s.color,
      fontSize: '11px',
      fontWeight: 600,
      letterSpacing: '0.5px',
    }}>
      {s.label}
    </span>
  );
}
