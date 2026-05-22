use hdrhistogram::Histogram;
use serde::{Deserialize, Serialize};

/// Streaming percentile metrics powered by HdrHistogram.
///
/// Records response times as microseconds (u64) for integer precision.
/// Thread safety: wrap in `Arc<Mutex<StreamingMetrics>>` for concurrent access.
pub struct StreamingMetrics {
    histogram: Histogram<u64>,
    total_count: u64,
    error_count: u64,
    sum_response_time: f64,
    min_time: f64,
    max_time: f64,
}

/// A point-in-time snapshot of streaming metrics, serialized to JS via Tauri events.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MetricsSnapshot {
    pub p50: f64,
    pub p95: f64,
    pub p99: f64,
    pub p999: f64,
    pub min: f64,
    pub max: f64,
    pub avg: f64,
    pub total: u64,
    pub errors: u64,
    pub tps: f64,
}

impl StreamingMetrics {
    /// Range: 1μs to 300,000ms (5 min) stored as microseconds, 3 significant digits.
    /// Memory: ~186KB for the histogram bucket array.
    pub fn new() -> Self {
        let histogram = Histogram::<u64>::new_with_bounds(1, 300_000_000, 3)
            .expect("valid histogram bounds");
        Self {
            histogram,
            total_count: 0,
            error_count: 0,
            sum_response_time: 0.0,
            min_time: f64::MAX,
            max_time: 0.0,
        }
    }

    /// Record a single response time. Values are clamped to the histogram range
    /// (0ms → 1μs, >300,000ms → 300,000ms) via `saturating_record`.
    /// Non-finite values (NaN, ±Infinity) are silently rejected to prevent
    /// poisoning the running average.
    pub fn record(&mut self, response_time_ms: f64, is_error: bool) {
        if !response_time_ms.is_finite() {
            return;
        }
        let micros = (response_time_ms * 1000.0).round().max(1.0) as u64;
        self.histogram.saturating_record(micros);

        self.total_count += 1;
        self.sum_response_time += response_time_ms;

        if response_time_ms < self.min_time {
            self.min_time = response_time_ms;
        }
        if response_time_ms > self.max_time {
            self.max_time = response_time_ms;
        }

        if is_error {
            self.error_count += 1;
        }
    }

    /// Take a point-in-time snapshot of all metrics.
    /// `elapsed_ms` is the wall-clock time since test start (for TPS calculation).
    pub fn snapshot(&self, elapsed_ms: f64) -> MetricsSnapshot {
        if self.total_count == 0 {
            return MetricsSnapshot {
                p50: 0.0, p95: 0.0, p99: 0.0, p999: 0.0,
                min: 0.0, max: 0.0, avg: 0.0,
                total: 0, errors: 0, tps: 0.0,
            };
        }

        let to_ms = |micros: u64| micros as f64 / 1000.0;

        MetricsSnapshot {
            p50: to_ms(self.histogram.value_at_quantile(0.50)),
            p95: to_ms(self.histogram.value_at_quantile(0.95)),
            p99: to_ms(self.histogram.value_at_quantile(0.99)),
            p999: to_ms(self.histogram.value_at_quantile(0.999)),
            min: (self.min_time * 100.0).round() / 100.0,
            max: (self.max_time * 100.0).round() / 100.0,
            avg: ((self.sum_response_time / self.total_count as f64) * 100.0).round() / 100.0,
            total: self.total_count,
            errors: self.error_count,
            tps: if elapsed_ms > 0.0 {
                ((self.total_count as f64 / (elapsed_ms / 1000.0)) * 100.0).round() / 100.0
            } else {
                0.0
            },
        }
    }
}

impl Default for StreamingMetrics {
    fn default() -> Self {
        Self::new()
    }
}
