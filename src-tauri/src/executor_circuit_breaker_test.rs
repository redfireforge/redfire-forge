#[cfg(test)]
mod tests {
    use crate::executor::*;

    // ── Circuit Breaker ──────────────────────────────────

    #[test]
    fn breaker_continue_never_trips() {
        let b = CircuitBreakerState::new(CircuitBreakerConfig::Continue);
        for _ in 0..100 {
            b.record(true);
        }
        assert!(!b.should_stop());
    }

    #[test]
    fn breaker_stop_first_on_error() {
        let b = CircuitBreakerState::new(CircuitBreakerConfig::StopFirst);
        b.record(false);
        assert!(!b.should_stop());
        b.record(true);
        assert!(b.should_stop());
    }

    #[test]
    fn breaker_stop_first_no_error() {
        let b = CircuitBreakerState::new(CircuitBreakerConfig::StopFirst);
        b.record(false);
        b.record(false);
        assert!(!b.should_stop());
    }

    #[test]
    fn breaker_threshold_trips_on_count() {
        let b = CircuitBreakerState::new(CircuitBreakerConfig::StopThreshold {
            max_errors: 3,
            max_error_rate: 1.0,
            min_sample_size: 100,
        });
        b.record(true);
        b.record(true);
        assert!(!b.should_stop());
        b.record(true);
        assert!(b.should_stop());
    }

    #[test]
    fn breaker_threshold_trips_on_rate() {
        let b = CircuitBreakerState::new(CircuitBreakerConfig::StopThreshold {
            max_errors: 100,
            max_error_rate: 0.5,
            min_sample_size: 4,
        });
        b.record(true);
        b.record(true);
        b.record(false);
        assert!(!b.should_stop()); // 3 samples < 4 min
        b.record(true);
        assert!(b.should_stop()); // 3/4 = 0.75 >= 0.5
    }

    #[test]
    fn breaker_threshold_respects_min_sample() {
        let b = CircuitBreakerState::new(CircuitBreakerConfig::StopThreshold {
            max_errors: 100,
            max_error_rate: 0.3,
            min_sample_size: 10,
        });
        for _ in 0..3 {
            b.record(true);
        }
        for _ in 0..2 {
            b.record(false);
        }
        assert!(!b.should_stop());
    }

    #[test]
    fn breaker_threshold_exact_boundary() {
        let b = CircuitBreakerState::new(CircuitBreakerConfig::StopThreshold {
            max_errors: 100,
            max_error_rate: 0.5,
            min_sample_size: 2,
        });
        b.record(true);
        b.record(false);
        // 1/2 = 0.5 which is >= 0.5 threshold
        assert!(b.should_stop());
    }

    #[test]
    fn breaker_stays_tripped() {
        let b = CircuitBreakerState::new(CircuitBreakerConfig::StopFirst);
        b.record(true);
        assert!(b.should_stop());
        // Successes after tripping don't un-trip
        b.record(false);
        b.record(false);
        assert!(b.should_stop());
    }

}
