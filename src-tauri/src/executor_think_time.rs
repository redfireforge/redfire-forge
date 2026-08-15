use crate::types::ThinkTimeConfig;
use rand::Rng;
use std::time::Duration;
use tokio_util::sync::CancellationToken;

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
