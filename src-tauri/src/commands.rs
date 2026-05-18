use crate::executor;
use crate::types::*;
use reqwest::Client;
use std::sync::Arc;
use std::time::Duration;
use tauri::Emitter;
use tokio_util::sync::CancellationToken;

pub struct ExecutorState {
    pub client: Arc<Client>,
    pub cancel_token: std::sync::Mutex<Option<CancellationToken>>,
}

impl ExecutorState {
    pub fn new() -> Self {
        let client = Client::builder()
            .pool_max_idle_per_host(200)
            .pool_idle_timeout(Duration::from_secs(90))
            .tcp_nodelay(true)
            .redirect(reqwest::redirect::Policy::none())
            .danger_accept_invalid_certs(true)
            .build()
            .expect("Failed to create reqwest client");

        Self {
            client: Arc::new(client),
            cancel_token: std::sync::Mutex::new(None),
        }
    }
}

#[tauri::command]
pub async fn start_load_test(
    app: tauri::AppHandle,
    state: tauri::State<'_, ExecutorState>,
    plan: ExecutionPlan,
) -> Result<CompletionSummary, String> {
    let cancel = CancellationToken::new();
    {
        let mut token = state.cancel_token.lock().map_err(|e| e.to_string())?;
        *token = Some(cancel.clone());
    }

    let client = state.client.clone();
    let start = std::time::Instant::now();
    executor::reset_result_counter();

    let (results, breaker_tripped) = match plan {
        ExecutionPlan::Pool {
            scenarios,
            concurrency,
            timeout_ms,
            retry_count,
            retry_delay_ms,
            think_time,
            circuit_breaker,
        } => {
            executor::run_pool(
                app.clone(),
                client,
                scenarios,
                concurrency,
                Duration::from_millis(timeout_ms),
                retry_count,
                retry_delay_ms,
                think_time,
                circuit_breaker,
                cancel.clone(),
            )
            .await
        }
        ExecutionPlan::Sequential {
            scenarios,
            timeout_ms,
            retry_count,
            retry_delay_ms,
            think_time,
            circuit_breaker,
        } => {
            executor::run_pool(
                app.clone(),
                client,
                scenarios,
                1,
                Duration::from_millis(timeout_ms),
                retry_count,
                retry_delay_ms,
                think_time,
                circuit_breaker,
                cancel.clone(),
            )
            .await
        }
        ExecutionPlan::LoadProfile {
            scenarios,
            concurrency,
            duration_sec,
            timeout_ms,
            retry_count,
            retry_delay_ms,
            think_time,
            circuit_breaker,
            profile_type,
            ramp_up_sec,
            spike_concurrency,
            spike_start_sec,
            spike_duration_sec,
        } => {
            executor::run_load_profile(
                app.clone(),
                client,
                scenarios,
                concurrency,
                duration_sec,
                Duration::from_millis(timeout_ms),
                retry_count,
                retry_delay_ms,
                think_time,
                circuit_breaker,
                profile_type,
                ramp_up_sec,
                spike_concurrency,
                spike_start_sec,
                spike_duration_sec,
                cancel.clone(),
            )
            .await
        }
    };

    let duration_ms = executor::round_ms(start.elapsed().as_secs_f64() * 1000.0);

    let summary = CompletionSummary {
        total_results: results.len() as u64,
        duration_ms,
        breaker_tripped,
    };
    let _ = app.emit("load-test-complete", &summary);

    // Cleanup cancel token
    {
        let mut token = state.cancel_token.lock().map_err(|e| e.to_string())?;
        *token = None;
    }

    Ok(summary)
}

#[tauri::command]
pub async fn abort_load_test(
    state: tauri::State<'_, ExecutorState>,
) -> Result<(), String> {
    let token = state.cancel_token.lock().map_err(|e| e.to_string())?;
    if let Some(cancel) = token.as_ref() {
        cancel.cancel();
    }
    Ok(())
}

#[tauri::command]
pub fn is_rust_executor_available() -> bool {
    true
}
