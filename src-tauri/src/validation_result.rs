use std::collections::HashMap;

use serde_json::Value;

use crate::assertion_evaluator::evaluate_assertions;
use crate::json_validator::validate;
use crate::validation_types::{
    Assertion, AssertionContext, FailureDetail, ValidationConfig, ValidationMode, ValidationOutput,
};

/// Port of `buildValidationResult()` from `validationResult.ts` (64 lines).
///
/// Evaluates assertions + JSON validation and determines pass/fail.
/// Replicates the exact combination logic from the JS implementation.
#[allow(clippy::too_many_arguments)]
pub fn build_validation_result(
    http_status: u16,
    response_time_ms: f64,
    response_headers: &HashMap<String, String>,
    response_body: &str,
    response_obj: &Value,
    error_message: Option<&str>,
    validation: &ValidationConfig,
    assertions: &[Assertion],
) -> ValidationOutput {
    // 1. Evaluate assertions if any
    let (assertion_failures, status_asserted) = if !assertions.is_empty() {
        let ctx = AssertionContext {
            http_status,
            response_time_ms,
            response_headers,
            response_body: response_obj,
            raw_body: response_body,
        };
        let result = evaluate_assertions(assertions, &ctx);
        (result.failures, result.status_asserted)
    } else {
        (vec![], false)
    };

    // 2. http_ok: status > 0 and < 400
    let http_ok = http_status > 0 && http_status < 400;

    // 3. status_ok: if status was explicitly asserted, check whether the assertion passed
    let status_ok = if status_asserted {
        assertion_failures
            .iter()
            .all(|f| f.path != "(status)")
    } else {
        http_ok
    };

    // 4. JSON validation: only when mode != none AND status_ok
    let json_failures = if validation.mode != ValidationMode::None && status_ok {
        validate(validation, response_obj)
    } else {
        vec![]
    };

    // 5. Merge: assertion_failures first, then json_failures
    let mut failure_details: Vec<FailureDetail> =
        [assertion_failures.clone(), json_failures].concat();

    // 6. HTTP failure overlay: when !status_asserted && (status >= 400 || status == 0)
    let http_failed = !status_asserted && (http_status >= 400 || http_status == 0);
    if http_failed {
        let actual = if let Some(msg) = error_message {
            if !msg.is_empty() {
                msg.to_string()
            } else if http_status == 0 {
                "network error".to_string()
            } else {
                format!("HTTP {}", http_status)
            }
        } else if http_status == 0 {
            "network error".to_string()
        } else {
            format!("HTTP {}", http_status)
        };

        let http_failure = FailureDetail {
            path: "(http)".to_string(),
            expected: "2xx".to_string(),
            actual,
        };
        // DROP json_failures — only keep [(http_failure), ...assertion_failures]
        failure_details = std::iter::once(http_failure)
            .chain(assertion_failures)
            .collect();
    }

    // 7-8. network_error and passed
    let network_error = http_status == 0 && !status_asserted;
    let passed = !network_error && failure_details.is_empty();

    ValidationOutput {
        failure_details,
        passed,
        error_message: error_message.map(|s| s.to_string()),
    }
}
