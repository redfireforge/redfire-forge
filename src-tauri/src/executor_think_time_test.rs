#[cfg(test)]
mod tests {
    use crate::executor::*;
    use crate::types::*;

    // ── Think Time ───────────────────────────────────────

    #[test]
    fn think_time_none_returns_zero() {
        assert_eq!(compute_think_time(&ThinkTimeConfig::None), 0);
    }

    #[test]
    fn think_time_constant_returns_exact() {
        assert_eq!(compute_think_time(&ThinkTimeConfig::Constant { delay_ms: 42 }), 42);
    }

    #[test]
    fn think_time_constant_zero() {
        assert_eq!(compute_think_time(&ThinkTimeConfig::Constant { delay_ms: 0 }), 0);
    }

    #[test]
    fn think_time_uniform_in_range() {
        for _ in 0..100 {
            let v = compute_think_time(&ThinkTimeConfig::Uniform {
                min_ms: 10,
                max_ms: 50,
            });
            assert!(v >= 10 && v <= 50, "got {v}");
        }
    }

    #[test]
    fn think_time_uniform_min_equals_max() {
        let v = compute_think_time(&ThinkTimeConfig::Uniform {
            min_ms: 25,
            max_ms: 25,
        });
        assert_eq!(v, 25);
    }

    #[test]
    fn think_time_uniform_inverted_range() {
        let v = compute_think_time(&ThinkTimeConfig::Uniform {
            min_ms: 50,
            max_ms: 10,
        });
        assert_eq!(v, 50);
    }

    #[test]
    fn think_time_gaussian_nonneg() {
        for _ in 0..500 {
            let v = compute_think_time(&ThinkTimeConfig::Gaussian {
                mean_ms: 100,
                std_dev_ms: 30,
            });
            // Must never be negative (guaranteed by .max(0.0))
            assert!(v < 10_000, "outlier {v}");
        }
    }

    #[test]
    fn think_time_gaussian_zero_stddev() {
        for _ in 0..50 {
            let v = compute_think_time(&ThinkTimeConfig::Gaussian {
                mean_ms: 42,
                std_dev_ms: 0,
            });
            assert_eq!(v, 42);
        }
    }

}
