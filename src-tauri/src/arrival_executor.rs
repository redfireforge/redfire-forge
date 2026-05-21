use crate::executor::{
    apply_think_time, build_weighted_pool, execute_with_retry, filter_batch, round_ms,
    validate_and_cap, CircuitBreakerState,
};
use crate::histogram::{MetricsSnapshot, StreamingMetrics};
use crate::types::*;
use reqwest::Client;
use std::sync::atomic::{AtomicU32, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::Emitter;
use tokio::sync::{mpsc, Semaphore};
use tokio_util::sync::CancellationToken;

const BATCH_INTERVAL: Duration = Duration::from_millis(100);

pub fn compute_current_rps(
    base_rps: f64,
    elapsed_sec: f64,
    ramp: &Option<ArrivalRampConfig>,
) -> f64 {
    match ramp {
        None => base_rps,
        Some(cfg) => {
            let ramp_dur = cfg.ramp_duration_sec as f64;
            if ramp_dur <= 0.0 || elapsed_sec >= ramp_dur {
                cfg.end_rps.max(0.0)
            } else {
                let t = elapsed_sec / ramp_dur;
                let start = cfg.start_rps.max(0.0);
                let end = cfg.end_rps.max(0.0);
                start + (end - start) * t
            }
        }
    }
}

#[allow(clippy::too_many_arguments)]
pub async fn run_constant_arrival(
    app: tauri::AppHandle,
    client: Arc<Client>,
    scenarios: Vec<RustScenario>,
    target_rps: f64,
    duration_sec: u64,
    max_in_flight: u32,
    timeout: Duration,
    retry_count: u32,
    retry_delay_ms: u64,
    think_time: ThinkTimeConfig,
    breaker_config: CircuitBreakerConfig,
    ramp_config: Option<ArrivalRampConfig>,
    cancel: CancellationToken,
    detail_level: DetailLevel,
) -> (Vec<ExecutionResult>, bool, Option<MetricsSnapshot>) {
    if scenarios.is_empty() || !target_rps.is_finite() || target_rps <= 0.0 {
        return (Vec::new(), false, None);
    }

    let weighted_pool = build_weighted_pool(&scenarios);
    let breaker = Arc::new(CircuitBreakerState::new(breaker_config));
    let completed = Arc::new(AtomicU64::new(0));
    let in_flight = Arc::new(AtomicU32::new(0));
    let dropped = Arc::new(AtomicU64::new(0));
    let effective_max = max_in_flight.max(1);
    let semaphore = Arc::new(Semaphore::new(effective_max as usize));
    let start = Instant::now();
    let duration = Duration::from_secs(duration_sec);
    let metrics = Mutex::new(StreamingMetrics::new());

    let (tx, mut rx) = mpsc::unbounded_channel::<ExecutionResult>();

    let producer_cancel = cancel.clone();
    let producer_breaker = breaker.clone();
    let producer_in_flight = in_flight.clone();
    let producer_dropped = dropped.clone();
    let producer_tx = tx.clone();
    let producer_client = client.clone();
    let producer_completed = completed.clone();
    let producer_semaphore = semaphore.clone();
    let producer_ramp_config = ramp_config.clone();

    let producer = tokio::spawn(async move {
        let mut idx = 0usize;
        let initial_rps = compute_current_rps(target_rps, 0.0, &producer_ramp_config);
        let initial_interval = Duration::from_secs_f64(1.0 / initial_rps.max(0.001));
        let mut ticker = tokio::time::interval(initial_interval);
        ticker.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Burst);
        let mut current_period = initial_interval;
        // Consume the immediate first tick
        ticker.tick().await;

        loop {
            if producer_cancel.is_cancelled() || producer_breaker.should_stop() {
                break;
            }
            if start.elapsed() >= duration {
                break;
            }

            // Wait for next tick or cancellation
            tokio::select! {
                _ = ticker.tick() => {}
                _ = producer_cancel.cancelled() => { break; }
            }

            if start.elapsed() >= duration {
                break;
            }

            // Adjust interval only when ramped and RPS actually changed
            if producer_ramp_config.is_some() {
                let elapsed_sec = start.elapsed().as_secs_f64();
                let current_rps = compute_current_rps(target_rps, elapsed_sec, &producer_ramp_config);
                if current_rps.is_finite() && current_rps > 0.0 {
                    let new_period = Duration::from_secs_f64(1.0 / current_rps);
                    if new_period != current_period {
                        ticker = tokio::time::interval(new_period);
                        ticker.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Burst);
                        ticker.tick().await;
                        current_period = new_period;
                    }
                }
            }

            // Try to acquire a semaphore permit (non-blocking)
            let permit = match producer_semaphore.clone().try_acquire_owned() {
                Ok(p) => p,
                Err(_) => {
                    producer_dropped.fetch_add(1, Ordering::Relaxed);
                    continue;
                }
            };

            let scenario_idx = weighted_pool[idx % weighted_pool.len()];
            idx += 1;
            let scenario = scenarios[scenario_idx].clone();

            producer_in_flight.fetch_add(1, Ordering::Relaxed);

            let client = producer_client.clone();
            let tx = producer_tx.clone();
            let completed = producer_completed.clone();
            let in_flight_c = producer_in_flight.clone();
            let breaker = producer_breaker.clone();
            let cancel = producer_cancel.clone();
            let think_time = think_time.clone();

            tokio::spawn(async move {
                let mut result = execute_with_retry(
                    &client, &scenario, timeout, retry_count, retry_delay_ms, &cancel,
                )
                .await;

                validate_and_cap(&mut result, &scenario.validation, &scenario.assertions);

                completed.fetch_add(1, Ordering::Relaxed);

                let is_error = !result.passed.unwrap_or(true);
                breaker.record(is_error);

                let _ = tx.send(result);

                // Think time blocks the in-flight slot (k6 parity):
                // keep in_flight high and permit held during think time
                apply_think_time(&think_time, &cancel).await;
                in_flight_c.fetch_sub(1, Ordering::Relaxed);
                drop(permit);
            });
        }
    });

    drop(tx);

    let mut all_results = Vec::new();
    let mut batch = Vec::new();
    let mut last_emit = Instant::now();
    let is_metrics_only = matches!(detail_level, DetailLevel::MetricsOnly);

    while let Some(result) = rx.recv().await {
        {
            let is_error = !result.passed.unwrap_or(true);
            metrics.lock().unwrap().record(result.response_time_ms, is_error);
        }
        if !is_metrics_only {
            batch.push(result.clone());
        }
        all_results.push(result);

        let should_emit = last_emit.elapsed() >= BATCH_INTERVAL
            || cancel.is_cancelled()
            || breaker.should_stop();

        if should_emit {
            let elapsed_sec = start.elapsed().as_secs_f64();
            let elapsed_ms = round_ms(elapsed_sec * 1000.0);
            let current_rps = compute_current_rps(target_rps, elapsed_sec, &ramp_config);
            let actual_rps_val = if elapsed_sec > 0.0 {
                round_ms(completed.load(Ordering::Relaxed) as f64 / elapsed_sec)
            } else {
                0.0
            };
            let batch_results = filter_batch(&detail_level, &mut batch);
            let progress = ProgressBatch {
                completed: completed.load(Ordering::Relaxed),
                total: -1,
                results: batch_results,
                elapsed_ms,
                current_in_flight: in_flight.load(Ordering::Relaxed),
                target_concurrency: effective_max,
                breaker_tripped: breaker.should_stop(),
                metrics: Some(metrics.lock().unwrap().snapshot(elapsed_ms)),
                target_rps: Some(round_ms(current_rps)),
                actual_rps: Some(actual_rps_val),
                dropped_requests: Some(dropped.load(Ordering::Relaxed)),
            };
            let _ = app.emit("load-test-progress", &progress);
            last_emit = Instant::now();
        }
    }

    let _ = producer.await;

    if !batch.is_empty() {
        let elapsed_ms = round_ms(start.elapsed().as_secs_f64() * 1000.0);
        let elapsed_sec = start.elapsed().as_secs_f64();
        let actual_rps_val = if elapsed_sec > 0.0 {
            round_ms(completed.load(Ordering::Relaxed) as f64 / elapsed_sec)
        } else {
            0.0
        };
        let progress = ProgressBatch {
            completed: completed.load(Ordering::Relaxed),
            total: -1,
            results: std::mem::take(&mut batch),
            elapsed_ms,
            current_in_flight: 0,
            target_concurrency: effective_max,
            breaker_tripped: breaker.should_stop(),
            metrics: Some(metrics.lock().unwrap().snapshot(elapsed_ms)),
            target_rps: Some(round_ms(target_rps)),
            actual_rps: Some(actual_rps_val),
            dropped_requests: Some(dropped.load(Ordering::Relaxed)),
        };
        let _ = app.emit("load-test-progress", &progress);
    }

    if !matches!(detail_level, DetailLevel::Full) && !all_results.is_empty() {
        let _ = app.emit("load-test-final-results", &FinalResults {
            results: all_results.clone(),
        });
    }

    let tripped = breaker.should_stop();
    let final_elapsed = round_ms(start.elapsed().as_secs_f64() * 1000.0);
    let final_metrics = if all_results.is_empty() {
        None
    } else {
        Some(metrics.lock().unwrap().snapshot(final_elapsed))
    };
    (all_results, tripped, final_metrics)
}
