#[cfg(test)]
mod tests {
    use crate::executor::*;

    // ── Target Concurrency ───────────────────────────────

    #[test]
    fn sustained_constant() {
        assert_eq!(get_target_concurrency("sustained", 100, 5.0, 60, None, None, None, None), 100);
    }

    #[test]
    fn sustained_unknown_type() {
        assert_eq!(get_target_concurrency("unknown-type", 100, 5.0, 60, None, None, None, None), 100);
    }

    #[test]
    fn ramp_up_affine() {
        // JS formula: ceil(1 + (M-1) * t) — affine 1→M, not linear from 0
        assert_eq!(get_target_concurrency("ramp-up", 100, 0.0, 60, Some(60), None, None, None), 1);
        // t=0.5 → ceil(1 + 99*0.5) = ceil(50.5) = 51
        assert_eq!(get_target_concurrency("ramp-up", 100, 30.0, 60, Some(60), None, None, None), 51);
        assert_eq!(get_target_concurrency("ramp-up", 100, 60.0, 60, Some(60), None, None, None), 100);
        // Beyond ramp → stays at max
        assert_eq!(get_target_concurrency("ramp-up", 100, 90.0, 60, Some(60), None, None, None), 100);
    }

    #[test]
    fn ramp_up_zero_ramp() {
        // rampUpSec=0 → use durationSec as ramp (match JS `|| durationSec`)
        // t=0 with ramp=60 → ceil(1 + 99*0) = 1
        assert_eq!(get_target_concurrency("ramp-up", 100, 0.0, 60, Some(0), None, None, None), 1);
    }

    #[test]
    fn ramp_up_no_ramp_specified() {
        // None → use durationSec=60 as ramp, t=0.5 → ceil(1 + 99*0.5) = 51
        assert_eq!(get_target_concurrency("ramp-up", 100, 30.0, 60, None, None, None, None), 51);
    }

    #[test]
    fn spike_inside_window() {
        let c = get_target_concurrency(
            "spike", 100, 15.0, 60, None, Some(500), Some(10), Some(20),
        );
        assert_eq!(c, 500);
    }

    #[test]
    fn spike_outside_window() {
        let c = get_target_concurrency(
            "spike", 100, 35.0, 60, None, Some(500), Some(10), Some(20),
        );
        assert_eq!(c, 100);
    }

    #[test]
    fn spike_before_window() {
        let c = get_target_concurrency(
            "spike", 100, 5.0, 60, None, Some(500), Some(10), Some(20),
        );
        assert_eq!(c, 100);
    }

    #[test]
    fn spike_at_exact_boundary() {
        // At spike_start_sec boundary → should be spike concurrency
        let c = get_target_concurrency(
            "spike", 100, 10.0, 60, None, Some(500), Some(10), Some(20),
        );
        assert_eq!(c, 500);
        // At spike_end boundary (10+20=30) → back to normal
        let c2 = get_target_concurrency(
            "spike", 100, 30.0, 60, None, Some(500), Some(10), Some(20),
        );
        assert_eq!(c2, 100);
    }

    #[test]
    fn concurrency_zero_clamped_to_one() {
        assert_eq!(get_target_concurrency("sustained", 0, 5.0, 60, None, None, None, None), 1);
        assert_eq!(get_target_concurrency("ramp-up", 0, 30.0, 60, Some(60), None, None, None), 1);
        // spike: raw 0*3=0 → spike_c.max(1)=1 inside window [18, 30); baseline max(0,1)=1 outside
        assert_eq!(get_target_concurrency("spike", 0, 20.0, 60, None, None, None, None), 1);
        assert_eq!(get_target_concurrency("spike", 0, 5.0, 60, None, None, None, None), 1);
    }

    #[test]
    fn spike_defaults() {
        // Match JS: start=floor(60*0.3)=18, dur=ceil(60*0.2)=12, peak=100*3=300
        // elapsed=5.0 is before spike window [18, 30) → baseline=100
        let before = get_target_concurrency("spike", 100, 5.0, 60, None, None, None, None);
        assert_eq!(before, 100);
        // elapsed=20.0 is inside spike window [18, 30) → peak=300
        let during = get_target_concurrency("spike", 100, 20.0, 60, None, None, None, None);
        assert_eq!(during, 300);
        // elapsed=35.0 is after spike window → baseline=100
        let after = get_target_concurrency("spike", 100, 35.0, 60, None, None, None, None);
        assert_eq!(after, 100);
    }

    #[test]
    fn spike_defaults_dur100_max5() {
        // Match JS test: durationSec=100, maxConcurrency=5
        // start=floor(100*0.3)=30, dur=ceil(100*0.2)=20, peak=5*3=15
        // Window is [30, 50)
        assert_eq!(get_target_concurrency("spike", 5, 10.0, 100, None, None, None, None), 5);
        assert_eq!(get_target_concurrency("spike", 5, 35.0, 100, None, None, None, None), 15);
    }

    #[test]
    fn ramp_up_m1_constant() {
        // maxConcurrency=1 → ceil(1 + 0*t) = 1 always
        assert_eq!(get_target_concurrency("ramp-up", 1, 0.0, 60, Some(60), None, None, None), 1);
        assert_eq!(get_target_concurrency("ramp-up", 1, 30.0, 60, Some(60), None, None, None), 1);
        assert_eq!(get_target_concurrency("ramp-up", 1, 60.0, 60, Some(60), None, None, None), 1);
    }

    #[test]
    fn ramp_up_small_values() {
        // M=10, ramp=10, t=0.5 → ceil(1 + 9*0.5) = ceil(5.5) = 6
        assert_eq!(get_target_concurrency("ramp-up", 10, 5.0, 60, Some(10), None, None, None), 6);
        // M=10, ramp=10, t=0.1 → ceil(1 + 9*0.1) = ceil(1.9) = 2
        assert_eq!(get_target_concurrency("ramp-up", 10, 1.0, 60, Some(10), None, None, None), 2);
    }

    #[test]
    fn ramp_up_duration_zero() {
        // durationSec=0 with None rampUpSec → ramp=0 → ramp<=0 → return max_c
        assert_eq!(get_target_concurrency("ramp-up", 100, 0.0, 0, None, None, None, None), 100);
    }

}
