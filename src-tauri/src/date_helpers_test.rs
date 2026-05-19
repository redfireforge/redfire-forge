#[cfg(test)]
mod tests {
    use crate::date_helpers::{resolve_date, to_day_string, truncate_to_unit};
    use crate::validation_types::{DatePrecision, DateReference, Timezone};
    use chrono::{Datelike, Local, Utc};
    use serde_json::json;

    // ── resolveDate ────────────────────────────────────────

    #[test]
    fn resolve_fixed_full_iso() {
        let r = resolve_date(&DateReference::Fixed { iso: "2024-03-15T12:00:00Z".into() });
        assert_eq!(r, "2024-03-15");
    }

    #[test]
    fn resolve_fixed_date_only() {
        let r = resolve_date(&DateReference::Fixed { iso: "2024-03-15".into() });
        assert_eq!(r, "2024-03-15");
    }

    #[test]
    fn resolve_fixed_short_string() {
        let r = resolve_date(&DateReference::Fixed { iso: "short".into() });
        assert_eq!(r, "short");
    }

    #[test]
    fn resolve_today_utc() {
        let r = resolve_date(&DateReference::Today { timezone: Timezone::Utc });
        let now = Utc::now();
        let expected = format!("{:04}-{:02}-{:02}", now.year(), now.month(), now.day());
        assert_eq!(r, expected);
    }

    #[test]
    fn resolve_today_local() {
        let r = resolve_date(&DateReference::Today { timezone: Timezone::Local });
        let now = Local::now();
        let expected = format!("{:04}-{:02}-{:02}", now.year(), now.month(), now.day());
        assert_eq!(r, expected);
    }

    // ── toDayString ────────────────────────────────────────

    #[test]
    fn day_string_from_iso() {
        assert_eq!(to_day_string(&json!("2024-03-15T12:30:00Z")), Some("2024-03-15".into()));
    }

    #[test]
    fn day_string_date_only() {
        assert_eq!(to_day_string(&json!("2024-03-15")), Some("2024-03-15".into()));
    }

    #[test]
    fn day_string_invalid_string() {
        assert_eq!(to_day_string(&json!("not-a-date")), None);
    }

    #[test]
    fn day_string_empty_string() {
        assert_eq!(to_day_string(&json!("")), None);
    }

    #[test]
    fn day_string_from_epoch_millis() {
        // 2024-03-15 00:00:00 UTC = 1710460800000
        assert_eq!(to_day_string(&json!(1710460800000_i64)), Some("2024-03-15".into()));
    }

    #[test]
    fn day_string_from_epoch_zero() {
        assert_eq!(to_day_string(&json!(0)), Some("1970-01-01".into()));
    }

    #[test]
    fn day_string_from_float_millis() {
        // JS: new Date(1.5).toISOString().slice(0,10) = "1970-01-01"
        assert_eq!(to_day_string(&json!(1.5)), Some("1970-01-01".into()));
        // Large float millis
        assert_eq!(to_day_string(&json!(1710460800000.7)), Some("2024-03-15".into()));
    }

    #[test]
    fn day_string_from_null() {
        assert_eq!(to_day_string(&json!(null)), None);
    }

    #[test]
    fn day_string_from_bool() {
        assert_eq!(to_day_string(&json!(true)), None);
    }

    #[test]
    fn day_string_from_object() {
        assert_eq!(to_day_string(&json!({"date": "2024-01-01"})), None);
    }

    #[test]
    fn day_string_from_array() {
        assert_eq!(to_day_string(&json!([2024])), None);
    }

    // ── truncateToUnit ─────────────────────────────────────

    #[test]
    fn truncate_millisecond() {
        assert_eq!(truncate_to_unit(1710460800123, &DatePrecision::Millisecond), 1710460800123);
    }

    #[test]
    fn truncate_second() {
        assert_eq!(truncate_to_unit(1710460800123, &DatePrecision::Second), 1710460800);
    }

    #[test]
    fn truncate_minute() {
        assert_eq!(truncate_to_unit(1710460800123, &DatePrecision::Minute), 28507680);
    }

    #[test]
    fn truncate_hour() {
        assert_eq!(truncate_to_unit(1710460800123, &DatePrecision::Hour), 475128);
    }

    #[test]
    fn truncate_day() {
        assert_eq!(truncate_to_unit(1710460800123, &DatePrecision::Day), 19797);
    }

    #[test]
    fn truncate_zero() {
        assert_eq!(truncate_to_unit(0, &DatePrecision::Day), 0);
        assert_eq!(truncate_to_unit(0, &DatePrecision::Millisecond), 0);
    }

    #[test]
    fn day_string_from_negative_epoch_millis() {
        // -86400000 ms = 1969-12-31T00:00:00Z
        // JS: new Date(-86400000).toISOString().slice(0, 10) → "1969-12-31"
        let r = to_day_string(&json!(-86400000));
        assert_eq!(r, Some("1969-12-31".to_string()));
    }

    #[test]
    fn truncate_negative_millis_floors_like_js() {
        // JS: Math.floor(-1000 / 1000) = -1
        assert_eq!(truncate_to_unit(-1000, &DatePrecision::Second), -1);
        // JS: Math.floor(-1001 / 1000) = -2 (rounds toward -∞)
        assert_eq!(truncate_to_unit(-1001, &DatePrecision::Second), -2);
        // JS: Math.floor(-86400001 / 86400000) = -2
        assert_eq!(truncate_to_unit(-86_400_001, &DatePrecision::Day), -2);
    }
}
