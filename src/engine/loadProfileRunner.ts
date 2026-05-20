import type { LoadProfileConfig, RequestResult, Scenario, ScenarioWeight } from '../shared/types';
import { executeWithRetry, prepareScenario, buildErrorResult, type RunOpts } from './requestExecution';
import { applyThinkTime } from './thinkTime';

export function getTargetConcurrency(profile: LoadProfileConfig, elapsedMs: number): number {
  const elapsed = elapsedMs / 1000;
  const { type, durationSec, maxConcurrency } = profile;

  if (elapsed >= durationSec) return 0;

  switch (type) {
    case 'sustained':
      return maxConcurrency;

    case 'ramp-up': {
      const rampSec = profile.rampUpSec || durationSec;
      if (rampSec <= 0 || elapsed >= rampSec) return maxConcurrency;
      const t = elapsed / rampSec;
      return Math.max(1, Math.ceil(1 + (maxConcurrency - 1) * t));
    }

    case 'spike': {
      const spikeStart = profile.spikeStartSec ?? Math.floor(durationSec * 0.3);
      const spikeDur = profile.spikeDurationSec ?? Math.ceil(durationSec * 0.2);
      const spikePeak = profile.spikeConcurrency ?? maxConcurrency * 3;
      if (elapsed >= spikeStart && elapsed < spikeStart + spikeDur) {
        return Math.max(1, spikePeak);
      }
      return Math.max(1, maxConcurrency);
    }

    default:
      return maxConcurrency;
  }
}

function buildWeightedIterator(
  scenarios: Scenario[],
  weights: ScenarioWeight[]
): () => Scenario {
  const active = weights.filter((w) => w.weight > 0);
  const pool: Scenario[] = [];
  for (const sw of active) {
    const sc = scenarios.find((s) => s.id === sw.scenarioId);
    if (sc) {
      for (let i = 0; i < sw.weight; i++) pool.push(sc);
    }
  }
  if (pool.length === 0 && scenarios.length > 0) {
    pool.push(scenarios[0]);
  }
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  let idx = 0;
  return () => {
    const sc = pool[idx % pool.length];
    idx++;
    return sc;
  };
}

export async function runLoadProfile(
  profile: LoadProfileConfig,
  scenarios: Scenario[],
  weights: ScenarioWeight[],
  opts: RunOpts
): Promise<RequestResult[]> {
  const { tokenManager, timeoutMs, retryCount, retryDelayMs, breaker, onProgress, abortSignal, getThinkTimeMs } = opts;
  const allResults: RequestResult[] = [];
  let inFlight = 0;
  const durationMs = profile.durationSec * 1000;
  const startTime = performance.now();
  const nextScenario = buildWeightedIterator(scenarios, weights);

  return new Promise((resolve) => {
    let resolved = false;
    let timerStopped = false;

    function finish() {
      if (resolved) return;
      resolved = true;
      timerStopped = true;
      clearInterval(ticker);
      onProgress(allResults.length, -1, allResults, {
        elapsedMs: durationMs,
        targetConcurrency: getTargetConcurrency(profile, durationMs),
        currentInFlight: 0,
        durationMs,
      });
      resolve(allResults);
    }

    function launchOne() {
      const scenario = nextScenario();
      inFlight++;
      const prep = prepareScenario(scenario);
      const tokenPromise = prep.needsOAuth ? tokenManager.getToken(scenario) : Promise.resolve(undefined);
      tokenPromise.then((token) => {
        const headers = token ? { ...prep.baseHeaders, Authorization: `Bearer ${token}` } : prep.baseHeaders;
        return executeWithRetry(scenario, headers, prep.body, timeoutMs, retryCount, retryDelayMs, prep.resolvedUrl);
      }).then((result) => {
        allResults.push(result);
        breaker.record(result);
      }).catch((err) => {
        const errorResult = buildErrorResult(scenario, err, prep.body);
        allResults.push(errorResult);
        breaker.record(errorResult);
      }).finally(() => {
        inFlight--;
        if (abortSignal?.aborted || breaker.shouldStop) {
          timerStopped = true;
          if (inFlight === 0) finish();
          return;
        }
        if (timerStopped && inFlight === 0) {
          finish();
        } else if (!timerStopped) {
          const thinkMs = getThinkTimeMs();
          if (thinkMs > 0) {
            applyThinkTime(getThinkTimeMs, abortSignal).then(fillPool);
          } else {
            setTimeout(fillPool, 0);
          }
        }
      });
    }

    function fillPool() {
      if (abortSignal?.aborted || breaker.shouldStop) {
        timerStopped = true;
        if (inFlight === 0) finish();
        return;
      }
      const elapsed = performance.now() - startTime;
      if (elapsed >= durationMs) {
        timerStopped = true;
        if (inFlight === 0) finish();
        return;
      }
      const target = getTargetConcurrency(profile, elapsed);
      while (inFlight < target && !abortSignal?.aborted && !breaker.shouldStop) {
        launchOne();
      }
    }

    let lastProgressTime = startTime;
    const ticker = setInterval(() => {
      if (abortSignal?.aborted || breaker.shouldStop || performance.now() - startTime >= durationMs) {
        timerStopped = true;
        clearInterval(ticker);
        if (inFlight === 0) finish();
        return;
      }
      fillPool();
      const now = performance.now();
      if (now - lastProgressTime >= 500) {
        lastProgressTime = now;
        const elapsed = now - startTime;
        const target = getTargetConcurrency(profile, elapsed);
        onProgress(allResults.length, -1, allResults, {
          elapsedMs: elapsed,
          targetConcurrency: target,
          currentInFlight: inFlight,
          durationMs,
        });
      }
    }, 100);

    fillPool();
  });
}
