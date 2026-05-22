#[cfg(test)]
mod tests {
    use crate::histogram::StreamingMetrics;

    #[test]
    fn empty_snapshot_returns_zeros() {
        let m = StreamingMetrics::new();
        let s = m.snapshot(1000.0);
        assert_eq!(s.p50, 0.0);
        assert_eq!(s.p95, 0.0);
        assert_eq!(s.p99, 0.0);
        assert_eq!(s.p999, 0.0);
        assert_eq!(s.min, 0.0);
        assert_eq!(s.max, 0.0);
        assert_eq!(s.avg, 0.0);
        assert_eq!(s.total, 0);
        assert_eq!(s.errors, 0);
        assert_eq!(s.tps, 0.0);
    }

    #[test]
    fn single_record_all_percentiles_equal() {
        let mut m = StreamingMetrics::new();
        m.record(50.0, false);
        let s = m.snapshot(1000.0);
        assert_eq!(s.total, 1);
        assert_eq!(s.errors, 0);
        // All percentiles should be ~50ms (within HDR precision)
        assert!((s.p50 - 50.0).abs() < 0.5);
        assert!((s.p95 - 50.0).abs() < 0.5);
        assert!((s.p99 - 50.0).abs() < 0.5);
        assert!((s.p999 - 50.0).abs() < 0.5);
        assert!((s.min - 50.0).abs() < 0.01);
        assert!((s.max - 50.0).abs() < 0.01);
        assert!((s.avg - 50.0).abs() < 0.01);
    }

    #[test]
    fn two_records_min_max() {
        let mut m = StreamingMetrics::new();
        m.record(10.0, false);
        m.record(90.0, false);
        let s = m.snapshot(1000.0);
        assert_eq!(s.total, 2);
        assert!((s.min - 10.0).abs() < 0.01);
        assert!((s.max - 90.0).abs() < 0.01);
        assert!((s.avg - 50.0).abs() < 0.01);
    }

    #[test]
    fn known_uniform_distribution_p50() {
        let mut m = StreamingMetrics::new();
        for i in 1..=100 {
            m.record(i as f64, false);
        }
        let s = m.snapshot(1000.0);
        assert!((s.p50 - 50.0).abs() < 2.0, "p50={}, expected ~50", s.p50);
    }

    #[test]
    fn known_uniform_distribution_p95() {
        let mut m = StreamingMetrics::new();
        for i in 1..=100 {
            m.record(i as f64, false);
        }
        let s = m.snapshot(1000.0);
        assert!((s.p95 - 95.0).abs() < 2.0, "p95={}, expected ~95", s.p95);
    }

    #[test]
    fn known_uniform_distribution_p99() {
        let mut m = StreamingMetrics::new();
        for i in 1..=100 {
            m.record(i as f64, false);
        }
        let s = m.snapshot(1000.0);
        assert!((s.p99 - 99.0).abs() < 2.0, "p99={}, expected ~99", s.p99);
    }

    #[test]
    fn large_sample_p999() {
        let mut m = StreamingMetrics::new();
        for i in 1..=10_000 {
            m.record(i as f64, false);
        }
        let s = m.snapshot(10_000.0);
        assert_eq!(s.total, 10_000);
        // P99.9 of [1..10000] is ~9990
        assert!(
            (s.p999 - 9990.0).abs() < 20.0,
            "p999={}, expected ~9990",
            s.p999
        );
    }

    #[test]
    fn error_counting() {
        let mut m = StreamingMetrics::new();
        for i in 0..10 {
            m.record(10.0, i < 3); // first 3 are errors
        }
        let s = m.snapshot(1000.0);
        assert_eq!(s.total, 10);
        assert_eq!(s.errors, 3);
    }

    #[test]
    fn tps_calculation() {
        let mut m = StreamingMetrics::new();
        for _ in 0..100 {
            m.record(5.0, false);
        }
        let s = m.snapshot(2000.0); // 100 requests in 2 seconds
        assert!((s.tps - 50.0).abs() < 0.1, "tps={}, expected 50.0", s.tps);
    }

    #[test]
    fn avg_calculation() {
        let mut m = StreamingMetrics::new();
        m.record(10.0, false);
        m.record(20.0, false);
        m.record(30.0, false);
        let s = m.snapshot(1000.0);
        assert!((s.avg - 20.0).abs() < 0.01, "avg={}, expected 20.0", s.avg);
    }

    #[test]
    fn zero_response_time() {
        let mut m = StreamingMetrics::new();
        m.record(0.0, false);
        let s = m.snapshot(1000.0);
        assert_eq!(s.total, 1);
        // 0ms → clamped to 1μs = 0.001ms in histogram, min tracked as 0.0
        assert!(s.min <= 0.01);
    }

    #[test]
    fn max_range_boundary() {
        let mut m = StreamingMetrics::new();
        m.record(300_000.0, false); // 5 minutes
        let s = m.snapshot(1000.0);
        assert_eq!(s.total, 1);
        assert!(s.max >= 299_000.0, "max={}, expected ~300000", s.max);
    }

    #[test]
    fn above_max_range_saturates() {
        let mut m = StreamingMetrics::new();
        m.record(500_000.0, false); // 8+ minutes — beyond range
        let s = m.snapshot(1000.0);
        assert_eq!(s.total, 1);
        // saturating_record clamps to max trackable, but our min/max fields track the real value
        assert!((s.max - 500_000.0).abs() < 0.01);
    }

    #[test]
    fn fractional_ms_precision() {
        let mut m = StreamingMetrics::new();
        m.record(1.5, false);
        let s = m.snapshot(1000.0);
        // 1.5ms → 1500μs → p50 should be ~1.5ms (within HDR 3-digit precision)
        assert!(
            (s.p50 - 1.5).abs() < 0.01,
            "p50={}, expected ~1.5",
            s.p50
        );
    }

    #[test]
    fn snapshot_is_idempotent() {
        let mut m = StreamingMetrics::new();
        for i in 1..=50 {
            m.record(i as f64, false);
        }
        let s1 = m.snapshot(1000.0);
        let s2 = m.snapshot(1000.0);
        assert_eq!(s1.p50, s2.p50);
        assert_eq!(s1.p95, s2.p95);
        assert_eq!(s1.total, s2.total);
        assert_eq!(s1.min, s2.min);
        assert_eq!(s1.max, s2.max);
    }

    #[test]
    fn incremental_recording() {
        let mut m = StreamingMetrics::new();
        for i in 1..=50 {
            m.record(i as f64, false);
        }
        let s1 = m.snapshot(500.0);
        assert_eq!(s1.total, 50);

        for i in 51..=100 {
            m.record(i as f64, false);
        }
        let s2 = m.snapshot(1000.0);
        assert_eq!(s2.total, 100);
        assert!(s2.p95 > s1.p95, "p95 should grow: {} vs {}", s2.p95, s1.p95);
    }

    #[test]
    fn all_errors_tps_still_correct() {
        let mut m = StreamingMetrics::new();
        for _ in 0..100 {
            m.record(5.0, true);
        }
        let s = m.snapshot(2000.0);
        assert_eq!(s.errors, 100);
        assert!((s.tps - 50.0).abs() < 0.1, "tps={}", s.tps);
    }

    #[test]
    fn elapsed_zero_tps_infinity_guard() {
        let mut m = StreamingMetrics::new();
        m.record(10.0, false);
        let s = m.snapshot(0.0);
        assert_eq!(s.tps, 0.0);
        assert!(!s.tps.is_nan());
        assert!(!s.tps.is_infinite());
    }

    #[test]
    fn high_volume_10k_records() {
        let mut m = StreamingMetrics::new();
        let start = std::time::Instant::now();
        for i in 0..10_000 {
            m.record((i % 500) as f64 + 1.0, i % 20 == 0);
        }
        let elapsed = start.elapsed();
        assert!(
            elapsed.as_millis() < 50,
            "10K records took {}ms, expected <50ms",
            elapsed.as_millis()
        );
        let s = m.snapshot(10_000.0);
        assert_eq!(s.total, 10_000);
        assert_eq!(s.errors, 500);
    }

    #[test]
    fn negative_response_time_clamped() {
        let mut m = StreamingMetrics::new();
        m.record(-5.0, false);
        let s = m.snapshot(1000.0);
        assert_eq!(s.total, 1);
        // -5.0ms * 1000 = -5000, .round() = -5000, .max(1.0) = 1 → recorded as 1μs
        assert!(s.min < 0.0, "min should track actual value: {}", s.min);
    }

    #[test]
    fn serde_snapshot_roundtrip() {
        let mut m = StreamingMetrics::new();
        m.record(42.0, false);
        m.record(100.0, true);
        let s = m.snapshot(1000.0);
        let json = serde_json::to_string(&s).unwrap();
        let parsed: crate::histogram::MetricsSnapshot = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.total, 2);
        assert_eq!(parsed.errors, 1);
        assert!((parsed.avg - 71.0).abs() < 0.01);
    }

    #[test]
    fn serde_snapshot_camel_case_keys() {
        let mut m = StreamingMetrics::new();
        m.record(10.0, false);
        let s = m.snapshot(1000.0);
        let json = serde_json::to_string(&s).unwrap();
        // Verify camelCase field names for JS interop
        assert!(json.contains("\"p999\""), "missing p999 key: {json}");
        assert!(json.contains("\"tps\""), "missing tps key: {json}");
        assert!(!json.contains("\"p_999\""), "should be camelCase: {json}");
    }

    #[test]
    fn record_nan_is_rejected() {
        let mut m = StreamingMetrics::new();
        m.record(f64::NAN, false);
        m.record(f64::INFINITY, false);
        m.record(f64::NEG_INFINITY, true);
        let s = m.snapshot(1000.0);
        assert_eq!(s.total, 0, "NaN/Infinity should not increment total");
        assert_eq!(s.errors, 0, "NaN/Infinity should not increment errors");
        assert_eq!(s.avg, 0.0, "avg should be 0 when no valid records");
    }

    #[test]
    fn record_nan_mixed_with_valid() {
        let mut m = StreamingMetrics::new();
        m.record(50.0, false);
        m.record(f64::NAN, false);
        m.record(100.0, false);
        let s = m.snapshot(1000.0);
        assert_eq!(s.total, 2, "only valid records counted");
        assert!((s.avg - 75.0).abs() < 0.01, "avg of 50+100 = 75: {}", s.avg);
    }

    #[test]
    fn default_impl_matches_new() {
        let from_new = StreamingMetrics::new();
        let from_default = StreamingMetrics::default();
        assert_eq!(from_new.snapshot(1000.0).total, from_default.snapshot(1000.0).total);
    }
}
