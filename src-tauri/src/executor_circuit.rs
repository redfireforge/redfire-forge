use crate::types::CircuitBreakerConfig;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};

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
