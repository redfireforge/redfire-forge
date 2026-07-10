#![cfg(test)]

#[cfg(test)]
use crate::types::*;

pub fn make_scenario(id: &str, weight: Option<f64>) -> RustScenario {
    RustScenario {
        id: id.to_string(),
        name: id.to_string(),
        url: format!("http://example.com/{id}"),
        method: "GET".to_string(),
        headers: Default::default(),
        body: None,
        feature_group_name: None,
        group_name: None,
        weight,
        data_row_id: None,
        data_row_label: None,
        validation: Default::default(),
        assertions: vec![],
    }
}

pub fn make_execution_result(id: &str) -> ExecutionResult {
    ExecutionResult {
        id: id.into(),
        scenario_id: "s1".into(),
        scenario_name: "test".into(),
        feature_group_name: None,
        group_name: None,
        url: "http://example.com".into(),
        method: "GET".into(),
        http_status: 200,
        response_time_ms: 10.0,
        response_body: "".into(),
        response_headers: Default::default(),
        timestamp: 0,
        error_message: None,
        data_row_id: None,
        data_row_label: None,
        request_log: RequestLog { headers: Default::default(), body: None },
        timing: TimingBreakdown { dns_lookup: 0.0, tcp_connect: 0.0, tls_handshake: 0.0, ttfb: 0.0, download: 0.0, total: 0.0 },
        retry_count: 0,
        passed: None,
        failure_details: vec![],
        validation_mode: String::new(),
    }
}
