use crate::histogram::{MetricsSnapshot, StreamingMetrics};
use crate::types::*;
use crate::validation_result::build_validation_result;
use crate::validation_types::{Assertion, ValidationConfig, ValidationMode};
use rand::Rng;
use reqwest::Client;
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, AtomicU32, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::Emitter;
use tokio::sync::{mpsc, Semaphore};
use tokio_util::sync::CancellationToken;

const MAX_BODY_LEN: usize = 2000;
const BATCH_INTERVAL: Duration = Duration::from_millis(100);
const SAMPLED_BATCH_CAP: usize = 10;

static RESULT_COUNTER: AtomicU64 = AtomicU64::new(0);

pub fn reset_result_counter() {
    RESULT_COUNTER.store(0, Ordering::Relaxed);
}

pub(crate) fn next_result_id() -> String {
    format!("rr-{}", RESULT_COUNTER.fetch_add(1, Ordering::Relaxed))
}

fn timestamp_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

/// Truncate body to MAX_BODY_LEN, safe for multi-byte UTF-8.
pub(crate) fn cap_body(body: &str) -> String {
    if body.len() <= MAX_BODY_LEN {
        return body.to_string();
    }
    // Find the nearest char boundary at or before MAX_BODY_LEN
    let mut end = MAX_BODY_LEN;
    while end > 0 && !body.is_char_boundary(end) {
        end -= 1;
    }
    body[..end].to_string()
}

pub(crate) fn round_ms(ms: f64) -> f64 {
    (ms * 100.0).round() / 100.0
}

// ── Think Time ───────────────────────────────────────────

pub fn compute_think_time(config: &ThinkTimeConfig) -> u64 {
    match config {
        ThinkTimeConfig::None => 0,
        ThinkTimeConfig::Constant { delay_ms } => *delay_ms,
        ThinkTimeConfig::Uniform { min_ms, max_ms } => {
            if max_ms <= min_ms {
                return *min_ms;
            }
            rand::rng().random_range(*min_ms..=*max_ms)
        }
        ThinkTimeConfig::Gaussian { mean_ms, std_dev_ms } => {
            let mean = *mean_ms as f64;
            let std_dev = *std_dev_ms as f64;
            // Box-Muller: guard against u1=0 to avoid ln(0) = -inf
            let mut u1: f64 = rand::rng().random();
            while u1 == 0.0 {
                u1 = rand::rng().random();
            }
            let u2: f64 = rand::rng().random();
            let z = (-2.0 * u1.ln()).sqrt() * (2.0 * std::f64::consts::PI * u2).cos();
            let value = mean + z * std_dev;
            value.max(0.0) as u64
        }
    }
}

pub async fn apply_think_time(config: &ThinkTimeConfig, cancel: &CancellationToken) {
    let delay = compute_think_time(config);
    if delay == 0 || cancel.is_cancelled() {
        return;
    }
    tokio::select! {
        _ = tokio::time::sleep(Duration::from_millis(delay)) => {}
        _ = cancel.cancelled() => {}
    }
}

// ── Circuit Breaker ──────────────────────────────────────

pub struct CircuitBreakerState {
    config: CircuitBreakerConfig,
    total: AtomicU64,
    errors: AtomicU64,
    tripped: AtomicBool,
}

impl CircuitBreakerState {
    pub fn new(config: CircuitBreakerConfig) -> Self {
        Self {
            config,
            total: AtomicU64::new(0),
            errors: AtomicU64::new(0),
            tripped: AtomicBool::new(false),
        }
    }

    pub fn record(&self, is_error: bool) {
        self.total.fetch_add(1, Ordering::Relaxed);
        if is_error {
            self.errors.fetch_add(1, Ordering::Relaxed);
        }
        match &self.config {
            CircuitBreakerConfig::Continue => {}
            CircuitBreakerConfig::StopFirst => {
                if is_error {
                    self.tripped.store(true, Ordering::Relaxed);
                }
            }
            CircuitBreakerConfig::StopThreshold {
                max_errors,
                max_error_rate,
                min_sample_size,
            } => {
                let errs = self.errors.load(Ordering::Relaxed);
                if errs >= *max_errors {
                    self.tripped.store(true, Ordering::Relaxed);
                    return;
                }
                let total = self.total.load(Ordering::Relaxed);
                if total >= *min_sample_size && total > 0 {
                    let rate = errs as f64 / total as f64;
                    if rate >= *max_error_rate {
                        self.tripped.store(true, Ordering::Relaxed);
                    }
                }
            }
        }
    }

    pub fn should_stop(&self) -> bool {
        self.tripped.load(Ordering::Relaxed)
    }
}

// ── Result Builder Helper ────────────────────────────────

#[allow(clippy::too_many_arguments)]
fn build_result(
    scenario: &RustScenario,
    request_log: RequestLog,
    http_status: u16,
    response_time_ms: f64,
    response_body: String,
    response_headers: HashMap<String, String>,
    error_message: Option<String>,
    timing: TimingBreakdown,
    retry_count: u32,
) -> ExecutionResult {
    ExecutionResult {
        id: next_result_id(),
        scenario_id: scenario.id.clone(),
        scenario_name: scenario.name.clone(),
        feature_group_name: scenario.feature_group_name.clone(),
        group_name: scenario.group_name.clone(),
        url: scenario.url.clone(),
        method: scenario.method.clone(),
        http_status,
        response_time_ms,
        response_body,
        response_headers,
        timestamp: timestamp_ms(),
        error_message,
        data_row_id: scenario.data_row_id.clone(),
        data_row_label: scenario.data_row_label.clone(),
        request_log,
        timing,
        retry_count,
        passed: None,
        failure_details: vec![],
        validation_mode: String::new(),
    }
}

// ── Single Request Execution ─────────────────────────────

pub async fn execute_one(
    client: &Client,
    scenario: &RustScenario,
    timeout: Duration,
    cancel: &CancellationToken,
) -> ExecutionResult {
    let start = Instant::now();
    let method: reqwest::Method = scenario
        .method
        .parse()
        .unwrap_or(reqwest::Method::GET);

    let mut builder = client.request(method, &scenario.url);
    for (k, v) in &scenario.headers {
        builder = builder.header(k.as_str(), v.as_str());
    }
    if let Some(body) = &scenario.body {
        if scenario.method != "GET" && scenario.method != "HEAD" {
            builder = builder.body(body.clone());
        }
    }
    if !timeout.is_zero() {
        builder = builder.timeout(timeout);
    }

    let request_log = RequestLog {
        headers: scenario.headers.clone(),
        body: scenario.body.clone(),
    };

    tokio::select! {
        _ = cancel.cancelled() => {
            let elapsed = round_ms(start.elapsed().as_secs_f64() * 1000.0);
            build_result(
                scenario,
                request_log,
                0,
                elapsed,
                String::new(),
                HashMap::new(),
                Some("Cancelled".into()),
                TimingBreakdown { dns_lookup: 0.0, tcp_connect: 0.0, tls_handshake: 0.0, ttfb: elapsed, download: 0.0, total: elapsed },
                0,
            )
        }
        result = builder.send() => {
            match result {
                Ok(resp) => {
                    let status = resp.status().as_u16();
                    let resp_headers: HashMap<String, String> = resp.headers().iter()
                        .map(|(k, v)| (k.to_string(), v.to_str().unwrap_or("").to_string()))
                        .collect();
                    let ttfb = round_ms(start.elapsed().as_secs_f64() * 1000.0);
                    let body_text = resp.text().await.unwrap_or_default();
                    let total_ms = round_ms(start.elapsed().as_secs_f64() * 1000.0);
                    let download = round_ms((total_ms - ttfb).max(0.0));

                    build_result(
                        scenario,
                        request_log,
                        status,
                        total_ms,
                        body_text,
                        resp_headers,
                        None,
                        TimingBreakdown { dns_lookup: 0.0, tcp_connect: 0.0, tls_handshake: 0.0, ttfb, download, total: total_ms },
                        0,
                    )
                }
                Err(e) => {
                    let elapsed = round_ms(start.elapsed().as_secs_f64() * 1000.0);
                    build_result(
                        scenario,
                        request_log,
                        0,
                        elapsed,
                        String::new(),
                        HashMap::new(),
                        Some(e.to_string()),
                        TimingBreakdown { dns_lookup: 0.0, tcp_connect: 0.0, tls_handshake: 0.0, ttfb: elapsed, download: 0.0, total: elapsed },
                        0,
                    )
                }
            }
        }
    }
}

pub async fn execute_with_retry(
    client: &Client,
    scenario: &RustScenario,
    timeout: Duration,
    retry_count: u32,
    retry_delay_ms: u64,
    cancel: &CancellationToken,
) -> ExecutionResult {
    let mut last_result = execute_one(client, scenario, timeout, cancel).await;
    if retry_count == 0 || last_result.http_status > 0 || cancel.is_cancelled() {
        return last_result;
    }
    for attempt in 1..=retry_count {
        if cancel.is_cancelled() {
            break;
        }
        tokio::select! {
            _ = tokio::time::sleep(Duration::from_millis(retry_delay_ms)) => {}
            _ = cancel.cancelled() => { break; }
        }
        last_result = execute_one(client, scenario, timeout, cancel).await;
        last_result.retry_count = attempt;
        if last_result.http_status > 0 || cancel.is_cancelled() {
            break;
        }
    }
    last_result
}

// ── Weighted Scenario Iterator ───────────────────────────

pub fn build_weighted_pool(scenarios: &[RustScenario]) -> Vec<usize> {
    let mut pool: Vec<usize> = Vec::new();
    for (i, s) in scenarios.iter().enumerate() {
        let w = s.weight.unwrap_or(1.0).max(0.0) as usize;
        let count = if w == 0 { 1 } else { w };
        for _ in 0..count {
            pool.push(i);
        }
    }
    if pool.is_empty() && !scenarios.is_empty() {
        pool.push(0);
    }
    // Fisher-Yates shuffle
    let mut rng = rand::rng();
    for i in (1..pool.len()).rev() {
        let j = rng.random_range(0..=i);
        pool.swap(i, j);
    }
    pool
}

// ── Load Profile Target Concurrency ──────────────────────

#[allow(clippy::too_many_arguments)]
pub fn get_target_concurrency(
    profile_type: &str,
    max_concurrency: u32,
    elapsed_sec: f64,
    duration_sec: u64,
    ramp_up_sec: Option<u64>,
    spike_concurrency: Option<u32>,
    spike_start_sec: Option<u64>,
    spike_duration_sec: Option<u64>,
) -> u32 {
    let max_c = max_concurrency.max(1);
    match profile_type {
        "ramp-up" => {
            // Match JS: rampUpSec of 0 or None → use durationSec (JS `|| durationSec`)
            let ramp = match ramp_up_sec {
                Some(r) if r > 0 => r as f64,
                _ => duration_sec as f64,
            };
            if ramp <= 0.0 || elapsed_sec >= ramp {
                return max_c;
            }
            // Match JS: affine interpolation 1 → max_c (not linear from 0)
            let t = elapsed_sec / ramp;
            let m = max_c as f64;
            (1.0 + (m - 1.0) * t).ceil().max(1.0) as u32
        }
        "spike" => {
            // Match JS: defaults derived from duration/concurrency, not hardcoded
            let dur_f = duration_sec as f64;
            let start = spike_start_sec.unwrap_or((dur_f * 0.3).floor() as u64) as f64;
            let dur = spike_duration_sec.unwrap_or((dur_f * 0.2).ceil() as u64) as f64;
            let spike_c = spike_concurrency.unwrap_or(max_concurrency * 3);
            if elapsed_sec >= start && elapsed_sec < start + dur {
                spike_c.max(1)
            } else {
                max_c
            }
        }
        _ => max_c, // "sustained"
    }
}

// ── Validation Wiring ────────────────────────────────────

pub(crate) fn validate_and_cap(
    result: &mut ExecutionResult,
    validation: &ValidationConfig,
    assertions: &[Assertion],
) {
    let mode_str = match &validation.mode {
        ValidationMode::None => "none",
        ValidationMode::Full => "full",
        ValidationMode::Selective => "selective",
    };

    let needs_body_parse =
        validation.mode != ValidationMode::None || !assertions.is_empty();

    let parsed: serde_json::Value = if needs_body_parse {
        serde_json::from_str(&result.response_body).unwrap_or(serde_json::Value::Null)
    } else {
        serde_json::Value::Null
    };

    let output = build_validation_result(
        result.http_status,
        result.response_time_ms,
        &result.response_headers,
        &result.response_body,
        &parsed,
        result.error_message.as_deref(),
        validation,
        assertions,
    );

    result.passed = Some(output.passed);
    result.failure_details = output.failure_details;
    result.validation_mode = mode_str.to_string();

    // Cap body AFTER validation so validation sees the full response
    if result.response_body.len() > MAX_BODY_LEN {
        result.response_body = cap_body(&result.response_body);
    }
}

// ── Pool Executor ────────────────────────────────────────

#[allow(clippy::too_many_arguments)]
pub async fn run_pool(
    app: tauri::AppHandle,
    client: Arc<Client>,
    scenarios: Vec<RustScenario>,
    concurrency: u32,
    timeout: Duration,
    retry_count: u32,
    retry_delay_ms: u64,
    think_time: ThinkTimeConfig,
    breaker_config: CircuitBreakerConfig,
    cancel: CancellationToken,
    detail_level: DetailLevel,
) -> (Vec<ExecutionResult>, bool, Option<MetricsSnapshot>) {
    let total = scenarios.len() as i64;
    let breaker = Arc::new(CircuitBreakerState::new(breaker_config));
    let completed = Arc::new(AtomicU64::new(0));
    let in_flight = Arc::new(AtomicU32::new(0));
    let effective_concurrency = concurrency.max(1);
    let semaphore = Arc::new(Semaphore::new(effective_concurrency as usize));
    let start = Instant::now();
    let metrics = Mutex::new(StreamingMetrics::new());

    let (tx, mut rx) = mpsc::unbounded_channel::<ExecutionResult>();

    for scenario in scenarios {
        if cancel.is_cancelled() || breaker.should_stop() {
            break;
        }

        // select! on permit acquire + cancellation/breaker to avoid blocking
        let permit = tokio::select! {
            p = semaphore.clone().acquire_owned() => {
                match p {
                    Ok(p) => p,
                    Err(_) => break,
                }
            }
            _ = cancel.cancelled() => { break; }
        };

        if breaker.should_stop() {
            drop(permit);
            break;
        }

        let client = client.clone();
        let tx = tx.clone();
        let completed = completed.clone();
        let in_flight = in_flight.clone();
        let breaker = breaker.clone();
        let cancel = cancel.clone();
        let think_time = think_time.clone();

        tokio::spawn(async move {
            in_flight.fetch_add(1, Ordering::Relaxed);

            let mut result = execute_with_retry(
                &client, &scenario, timeout, retry_count, retry_delay_ms, &cancel,
            )
            .await;

            validate_and_cap(&mut result, &scenario.validation, &scenario.assertions);

            in_flight.fetch_sub(1, Ordering::Relaxed);
            completed.fetch_add(1, Ordering::Relaxed);

            let is_error = !result.passed.unwrap_or(true);
            breaker.record(is_error);

            let _ = tx.send(result);

            // Think time AFTER request, before releasing permit (paces next launch)
            apply_think_time(&think_time, &cancel).await;
            drop(permit);
        });
    }
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
            let elapsed_ms = round_ms(start.elapsed().as_secs_f64() * 1000.0);
            let batch_results = filter_batch(&detail_level, &mut batch);
            let progress = ProgressBatch {
                completed: completed.load(Ordering::Relaxed),
                total,
                results: batch_results,
                elapsed_ms,
                current_in_flight: in_flight.load(Ordering::Relaxed),
                target_concurrency: effective_concurrency,
                breaker_tripped: breaker.should_stop(),
                metrics: Some(metrics.lock().unwrap().snapshot(elapsed_ms)),
                target_rps: None,
                actual_rps: None,
                dropped_requests: None,
            };
            let _ = app.emit("load-test-progress", &progress);
            last_emit = Instant::now();
        }
    }

    // Final drain — always sends full results for any stragglers
    if !batch.is_empty() {
        let elapsed_ms = round_ms(start.elapsed().as_secs_f64() * 1000.0);
        let progress = ProgressBatch {
            completed: completed.load(Ordering::Relaxed),
            total,
            results: std::mem::take(&mut batch),
            elapsed_ms,
            current_in_flight: 0,
            target_concurrency: effective_concurrency,
            breaker_tripped: breaker.should_stop(),
            metrics: Some(metrics.lock().unwrap().snapshot(elapsed_ms)),
            target_rps: None,
            actual_rps: None,
            dropped_requests: None,
        };
        let _ = app.emit("load-test-progress", &progress);
    }

    // For non-Full modes, emit full results so JS has the complete set
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

pub(crate) fn filter_batch(detail_level: &DetailLevel, batch: &mut Vec<ExecutionResult>) -> Vec<ExecutionResult> {
    match detail_level {
        DetailLevel::Full => std::mem::take(batch),
        DetailLevel::MetricsOnly => {
            batch.clear();
            vec![]
        }
        DetailLevel::Sampled => {
            let cap = batch.len().min(SAMPLED_BATCH_CAP);
            let sampled: Vec<ExecutionResult> = batch.drain(..cap).collect();
            batch.clear();
            sampled
        }
    }
}

// ── Load Profile Executor ────────────────────────────────

#[allow(clippy::too_many_arguments)]
pub async fn run_load_profile(
    app: tauri::AppHandle,
    client: Arc<Client>,
    scenarios: Vec<RustScenario>,
    max_concurrency: u32,
    duration_sec: u64,
    timeout: Duration,
    retry_count: u32,
    retry_delay_ms: u64,
    think_time: ThinkTimeConfig,
    breaker_config: CircuitBreakerConfig,
    profile_type: String,
    ramp_up_sec: Option<u64>,
    spike_concurrency: Option<u32>,
    spike_start_sec: Option<u64>,
    spike_duration_sec: Option<u64>,
    cancel: CancellationToken,
    detail_level: DetailLevel,
) -> (Vec<ExecutionResult>, bool, Option<MetricsSnapshot>) {
    if scenarios.is_empty() {
        return (Vec::new(), false, None);
    }

    let weighted_pool = build_weighted_pool(&scenarios);
    let breaker = Arc::new(CircuitBreakerState::new(breaker_config));
    let completed = Arc::new(AtomicU64::new(0));
    let in_flight = Arc::new(AtomicU32::new(0));
    let start = Instant::now();
    let duration = Duration::from_secs(duration_sec);
    let metrics = Mutex::new(StreamingMetrics::new());

    let (tx, mut rx) = mpsc::unbounded_channel::<ExecutionResult>();

    let profile_type_for_progress = profile_type.clone();
    let producer_cancel = cancel.clone();
    let producer_breaker = breaker.clone();
    let producer_in_flight = in_flight.clone();
    let producer_tx = tx.clone();
    let producer_client = client.clone();
    let producer_completed = completed.clone();

    let producer = tokio::spawn(async move {
        let mut idx = 0usize;

        loop {
            if producer_cancel.is_cancelled() || producer_breaker.should_stop() {
                break;
            }
            if start.elapsed() >= duration {
                break;
            }

            let elapsed_sec = start.elapsed().as_secs_f64();
            let target = get_target_concurrency(
                &profile_type,
                max_concurrency,
                elapsed_sec,
                duration_sec,
                ramp_up_sec,
                spike_concurrency,
                spike_start_sec,
                spike_duration_sec,
            );

            // Wait until in-flight drops below target (matches JS `while (inFlight < target)`)
            if target == 0 {
                tokio::time::sleep(Duration::from_millis(10)).await;
                continue;
            }
            let current_in_flight = producer_in_flight.load(Ordering::Relaxed);
            if current_in_flight >= target {
                // Back-pressure: wait briefly then re-check target (concurrency may change)
                tokio::select! {
                    _ = tokio::time::sleep(Duration::from_millis(10)) => { continue; }
                    _ = producer_cancel.cancelled() => { break; }
                }
            }

            let scenario_idx = weighted_pool[idx % weighted_pool.len()];
            idx += 1;
            let scenario = scenarios[scenario_idx].clone();

            if producer_breaker.should_stop() || start.elapsed() >= duration {
                break;
            }

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

                in_flight_c.fetch_sub(1, Ordering::Relaxed);
                completed.fetch_add(1, Ordering::Relaxed);

                let is_error = !result.passed.unwrap_or(true);
                breaker.record(is_error);

                let _ = tx.send(result);

                apply_think_time(&think_time, &cancel).await;
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
            let target = get_target_concurrency(
                &profile_type_for_progress,
                max_concurrency,
                elapsed_sec,
                duration_sec,
                ramp_up_sec,
                spike_concurrency,
                spike_start_sec,
                spike_duration_sec,
            );
            let batch_results = filter_batch(&detail_level, &mut batch);
            let progress = ProgressBatch {
                completed: completed.load(Ordering::Relaxed),
                total: -1,
                results: batch_results,
                elapsed_ms,
                current_in_flight: in_flight.load(Ordering::Relaxed),
                target_concurrency: target,
                breaker_tripped: breaker.should_stop(),
                metrics: Some(metrics.lock().unwrap().snapshot(elapsed_ms)),
                target_rps: None,
                actual_rps: None,
                dropped_requests: None,
            };
            let _ = app.emit("load-test-progress", &progress);
            last_emit = Instant::now();
        }
    }

    // Wait for producer to finish
    let _ = producer.await;

    // Final drain — always sends full results for any stragglers
    if !batch.is_empty() {
        let elapsed_ms = round_ms(start.elapsed().as_secs_f64() * 1000.0);
        let progress = ProgressBatch {
            completed: completed.load(Ordering::Relaxed),
            total: -1,
            results: std::mem::take(&mut batch),
            elapsed_ms,
            current_in_flight: 0,
            target_concurrency: max_concurrency.max(1),
            breaker_tripped: breaker.should_stop(),
            metrics: Some(metrics.lock().unwrap().snapshot(elapsed_ms)),
            target_rps: None,
            actual_rps: None,
            dropped_requests: None,
        };
        let _ = app.emit("load-test-progress", &progress);
    }

    // For non-Full modes, emit full results so JS has the complete set
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
