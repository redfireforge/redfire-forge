use crate::validation_types::{DatePrecision, DateReference, Timezone};
use chrono::{Datelike, Local, Utc};

/// Resolve a DateReference to a `YYYY-MM-DD` string.
///
/// Port of JS `resolveDate()` from `validatorDateHelpers.ts`.
/// - Fixed: returns `iso[0..10]`
/// - Today/utc: returns UTC date
/// - Today/local: returns local date
pub fn resolve_date(date_ref: &DateReference) -> String {
    match date_ref {
        DateReference::Fixed { iso } => {
            if iso.len() >= 10 { iso[..10].to_string() } else { iso.clone() }
        }
        DateReference::Today { timezone } => match timezone {
            Timezone::Utc => {
                let now = Utc::now();
                format!("{:04}-{:02}-{:02}", now.year(), now.month(), now.day())
            }
            Timezone::Local => {
                let now = Local::now();
                format!("{:04}-{:02}-{:02}", now.year(), now.month(), now.day())
            }
        },
    }
}

/// Extract the day portion (`YYYY-MM-DD`) from a value.
///
/// Port of JS `toDayString()`:
/// - String: regex match `^\d{4}-\d{2}-\d{2}` prefix
/// - Number (epoch millis): convert to ISO day string in UTC
/// - Otherwise: None
pub fn to_day_string(val: &serde_json::Value) -> Option<String> {
    match val {
        serde_json::Value::String(s) => {
            let re = regex::Regex::new(r"^(\d{4}-\d{2}-\d{2})").ok()?;
            re.captures(s).map(|c| c[1].to_string())
        }
        serde_json::Value::Number(n) => {
            // JS `new Date(val)` accepts both integers and floats; truncate to integer millis
            let millis = n.as_i64().or_else(|| n.as_f64().map(|f| f as i64))?;
            let dt = chrono::DateTime::from_timestamp_millis(millis)?;
            Some(format!("{:04}-{:02}-{:02}", dt.year(), dt.month(), dt.day()))
        }
        _ => None,
    }
}

/// Truncate a millisecond timestamp to a given precision unit.
///
/// Port of JS `truncateToUnit()`:
/// - Millisecond: ms value unchanged
/// - Second: `ms / 1000`
/// - Minute: `ms / 60_000`
/// - Hour: `ms / 3_600_000`
/// - Day: `ms / 86_400_000`
///
/// All divisions use floor (integer division).
pub fn truncate_to_unit(epoch_millis: i64, precision: &DatePrecision) -> i64 {
    match precision {
        DatePrecision::Millisecond => epoch_millis,
        // Use div_euclid for Math.floor parity with JS (rounds toward -∞)
        DatePrecision::Second => epoch_millis.div_euclid(1_000),
        DatePrecision::Minute => epoch_millis.div_euclid(60_000),
        DatePrecision::Hour => epoch_millis.div_euclid(3_600_000),
        DatePrecision::Day => epoch_millis.div_euclid(86_400_000),
    }
}
