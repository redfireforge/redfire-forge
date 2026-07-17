#[cfg(test)]
mod tests {
    use crate::executor::*;
    use crate::executor_test_helpers::make_scenario;

    // ── Weighted Pool ────────────────────────────────────

    #[test]
    fn weighted_pool_uniform() {
        let scenarios = vec![make_scenario("a", None), make_scenario("b", None)];
        let pool = build_weighted_pool(&scenarios);
        assert_eq!(pool.len(), 2);
        assert!(pool.contains(&0));
        assert!(pool.contains(&1));
    }

    #[test]
    fn weighted_pool_respects_weights() {
        let scenarios = vec![
            make_scenario("a", Some(3.0)),
            make_scenario("b", Some(1.0)),
        ];
        let pool = build_weighted_pool(&scenarios);
        assert_eq!(pool.len(), 4);
        let a_count = pool.iter().filter(|&&i| i == 0).count();
        let b_count = pool.iter().filter(|&&i| i == 1).count();
        assert_eq!(a_count, 3);
        assert_eq!(b_count, 1);
    }

    #[test]
    fn weighted_pool_empty() {
        let pool = build_weighted_pool(&[]);
        assert!(pool.is_empty());
    }

    #[test]
    fn weighted_pool_zero_weight() {
        let scenarios = vec![make_scenario("a", Some(0.0))];
        let pool = build_weighted_pool(&scenarios);
        // weight=0 → treated as 1
        assert_eq!(pool.len(), 1);
        assert_eq!(pool[0], 0);
    }

    #[test]
    fn weighted_pool_negative_weight() {
        let scenarios = vec![make_scenario("a", Some(-5.0))];
        let pool = build_weighted_pool(&scenarios);
        // .max(0.0) → 0.0 → treated as 1
        assert_eq!(pool.len(), 1);
    }

    #[test]
    fn weighted_pool_single_scenario() {
        let scenarios = vec![make_scenario("only", Some(5.0))];
        let pool = build_weighted_pool(&scenarios);
        assert_eq!(pool.len(), 5);
        assert!(pool.iter().all(|&i| i == 0));
    }

}
