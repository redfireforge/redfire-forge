use crate::api_mock::listener::normalize;
use crate::api_mock::recording::{RecordedCapture, RecordedCaptureResponse};
use crate::api_mock::registry::ApiMockNativeState;
use crate::api_mock::tls::test_self_signed_pem;
use crate::api_mock::types::{
    CapturedRequest, HeaderKV, Predicate, PredicateNode, RedactionSettings, ServerDefinition,
    TlsSettings,
};
use http::{HeaderMap, HeaderValue, Method};
use std::collections::HashMap;

fn free_port() -> u16 {
    std::net::TcpListener::bind("127.0.0.1:0")
        .unwrap()
        .local_addr()
        .unwrap()
        .port()
}

fn ping_def(id: &str, port: u16) -> ServerDefinition {
    serde_json::from_value(serde_json::json!({
        "id": id,
        "port": port,
        "routes": [{
            "id": "r1",
            "method": "GET",
            "path": { "kind": "exact", "value": "/ping" },
            "responses": [{
                "id": "v1",
                "enabled": true,
                "isDefault": true,
                "status": 200,
                "headers": [{ "key": "Content-Type", "value": "application/json", "enabled": true }],
                "body": { "kind": "json", "content": "{\"ok\":true}", "contentType": "application/json" }
            }]
        }]
    }))
    .unwrap()
}

#[tokio::test]
async fn start_get_journal_stop() {
    let port = free_port();
    let state = ApiMockNativeState::new();
    state.start(ping_def("s1", port)).await.expect("start");
    let url = format!("http://127.0.0.1:{port}/ping");
    let body = reqwest::Client::builder()
        .no_proxy()
        .build()
        .unwrap()
        .get(&url)
        .send()
        .await
        .expect("get")
        .text()
        .await
        .expect("text");
    assert!(body.contains("ok"), "{body}");
    let page = state.transactions("s1", None, None).expect("journal");
    assert_eq!(page["total"], 1);
    let status = state.status("s1").unwrap();
    assert_eq!(status["state"], "running");
    state.stop("s1").await.unwrap();
    let stopped = state.status("s1").unwrap();
    assert_eq!(stopped["state"], "stopped");
}

#[tokio::test]
async fn port_owned_by_other_server() {
    let port = free_port();
    let state = ApiMockNativeState::new();
    state.start(ping_def("a", port)).await.unwrap();
    let err = state.start(ping_def("b", port)).await.unwrap_err();
    assert_eq!(err.code, "MOCK_PORT_OWNED");
    state.stop("a").await.unwrap();
}

#[tokio::test]
async fn commit_and_reset_state() {
    let port = free_port();
    let state = ApiMockNativeState::new();
    state.start(ping_def("s1", port)).await.unwrap();
    let mut next = ping_def("s1", port);
    next.name = "renamed".into();
    let committed = state.commit("s1", next).unwrap();
    assert_eq!(committed["generation"], 2);
    let reset = state.reset_state("s1").unwrap();
    assert_eq!(reset["reset"], true);
    let diag = state.diagnostics("s1").unwrap();
    assert_eq!(diag["routeCount"], 1);
    state.stop("s1").await.unwrap();
}

fn http_client() -> reqwest::Client {
    reqwest::Client::builder()
        .no_proxy()
        .timeout(std::time::Duration::from_secs(2))
        .build()
        .unwrap()
}

#[tokio::test]
async fn timeout_fault_drops_without_http_500() {
    let port = free_port();
    let state = ApiMockNativeState::new();
    let mut def = ping_def("s-fault", port);
    def.routes[0].path.value = "/hang".into();
    def.routes[0].responses[0].behavior.fault = Some("timeout".into());
    state.start(def).await.expect("start");
    let url = format!("http://127.0.0.1:{port}/hang");
    let result = http_client().get(&url).send().await;
    match result {
        Ok(res) => panic!("timeout fault must not send HTTP {}, body={:?}", res.status(), res.text().await.ok()),
        Err(_) => {}
    }
    state.stop("s-fault").await.unwrap();
}

#[tokio::test]
async fn restart_rebinds_the_same_port() {
    let port = free_port();
    let state = ApiMockNativeState::new();
    state.start(ping_def("s-restart", port)).await.expect("start");
    let url = format!("http://127.0.0.1:{port}/ping");
    let first = http_client().get(&url).send().await.expect("get1").text().await.expect("text1");
    assert!(first.contains("ok"), "{first}");
    state.restart(ping_def("s-restart", port)).await.expect("restart");
    let second = http_client().get(&url).send().await.expect("get2").text().await.expect("text2");
    assert!(second.contains("ok"), "{second}");
    state.stop("s-restart").await.unwrap();
}

#[tokio::test]
async fn journal_duration_includes_delay() {
    let port = free_port();
    let state = ApiMockNativeState::new();
    let mut def = ping_def("s-delay", port);
    def.routes[0].responses[0].behavior.delay_ms = 40;
    state.start(def).await.expect("start");
    let url = format!("http://127.0.0.1:{port}/ping");
    let _ = http_client().get(&url).send().await.expect("get");
    let page = state.transactions("s-delay", None, None).expect("journal");
    let duration = page["transactions"][0]["durationMs"].as_u64().unwrap();
    assert!(duration >= 40, "durationMs={duration}");
    state.stop("s-delay").await.unwrap();
}

#[tokio::test]
async fn stop_cancels_delayed_in_flight_and_rebinds() {
    let port = free_port();
    let state = ApiMockNativeState::new();
    let mut def = ping_def("s-cancel", port);
    def.routes[0].responses[0].behavior.delay_ms = 8_000;
    def.settings.limits.graceful_drain_ms = 5_000;
    state.start(def).await.expect("start");
    let url = format!("http://127.0.0.1:{port}/ping");
    let client = http_client();
    let pending = tokio::spawn(async move { client.get(&url).send().await });
    tokio::time::sleep(std::time::Duration::from_millis(80)).await;
    let started = std::time::Instant::now();
    state.stop("s-cancel").await.unwrap();
    assert!(
        started.elapsed() < std::time::Duration::from_secs(2),
        "stop must not wait out the delayed response"
    );
    let _ = pending.await;
    state
        .start(ping_def("s-cancel", port))
        .await
        .expect("rebind after cancelling delayed in-flight");
    state.stop("s-cancel").await.unwrap();
}

#[tokio::test]
async fn unmatched_fallback_does_not_leak_placeholder() {
    let port = free_port();
    let state = ApiMockNativeState::new();
    let mut def = ping_def("s-unmatched", port);
    def.settings.fallback.unmatched_response.body =
        r#"{"error":"not_found","requestId":"{{requestId}}"}"#.into();
    state.start(def).await.expect("start");
    let url = format!("http://127.0.0.1:{port}/missing");
    let body = http_client().get(&url).send().await.expect("get").text().await.expect("text");
    assert!(!body.contains("{{requestId}}"), "{body}");
    let page = state.transactions("s-unmatched", None, None).expect("journal");
    let id = page["transactions"][0]["id"].as_str().unwrap();
    assert!(body.contains(id), "body={body} id={id}");
    state.stop("s-unmatched").await.unwrap();
}

#[tokio::test]
async fn cors_preflight_and_get_headers() {
    let port = free_port();
    let state = ApiMockNativeState::new();
    let mut def = ping_def("s-cors", port);
    def.settings.cors.enabled = true;
    def.settings.cors.allow_origins = vec!["https://app.test".into()];
    def.settings.cors.allow_credentials = true;
    def.settings.cors.expose_headers = vec!["X-Request-Id".into()];
    state.start(def).await.expect("start");
    let client = http_client();
    let preflight = client
        .request(reqwest::Method::OPTIONS, format!("http://127.0.0.1:{port}/ping"))
        .header("Origin", "https://app.test")
        .header("Access-Control-Request-Method", "GET")
        .send()
        .await
        .expect("options");
    assert_eq!(preflight.status(), 204);
    assert_eq!(
        preflight.headers().get("access-control-allow-origin").unwrap(),
        "https://app.test"
    );
    assert_eq!(
        preflight.headers().get("access-control-allow-credentials").unwrap(),
        "true"
    );
    assert!(preflight.headers().get("access-control-max-age").is_some());
    let page = state.transactions("s-cors", None, None).expect("journal");
    assert_eq!(page["total"], 0);

    let matched = client
        .get(format!("http://127.0.0.1:{port}/ping"))
        .header("Origin", "https://app.test")
        .send()
        .await
        .expect("get");
    assert_eq!(matched.status(), 200);
    assert_eq!(
        matched.headers().get("access-control-allow-origin").unwrap(),
        "https://app.test"
    );
    assert_eq!(
        matched.headers().get("access-control-expose-headers").unwrap(),
        "X-Request-Id"
    );
    state.stop("s-cors").await.unwrap();
}

#[tokio::test]
async fn reset_and_malformed_faults_drop_without_http_status() {
    for fault in ["reset", "malformed"] {
        let port = free_port();
        let id = format!("s-{fault}");
        let state = ApiMockNativeState::new();
        let mut def = ping_def(&id, port);
        def.routes[0].path.value = "/boom".into();
        def.routes[0].responses[0].behavior.fault = Some(fault.into());
        state.start(def).await.expect("start");
        let url = format!("http://127.0.0.1:{port}/boom");
        let result = http_client().get(&url).send().await;
        match result {
            Ok(res) => panic!("{fault} must not send HTTP {}", res.status()),
            Err(_) => {}
        }
        state.stop(&id).await.unwrap();
    }
}

#[tokio::test]
async fn dribble_fault_returns_full_body() {
    let port = free_port();
    let state = ApiMockNativeState::new();
    let mut def = ping_def("s-dribble", port);
    def.routes[0].responses[0].body.content = r#"{"ok":true}"#.into();
    def.routes[0].responses[0].behavior.fault = Some("dribble".into());
    def.routes[0].responses[0].behavior.chunk_schedule = Some(vec![
        serde_json::json!({ "afterMs": 0, "body": "{\"ok\":" }),
        serde_json::json!({ "afterMs": 5, "body": "true}" }),
    ]);
    state.start(def).await.expect("start");
    let url = format!("http://127.0.0.1:{port}/ping");
    let body = http_client().get(&url).send().await.expect("get").text().await.expect("text");
    assert_eq!(body, r#"{"ok":true}"#);
    let page = state.transactions("s-dribble", None, None).expect("journal");
    assert_eq!(page["transactions"][0]["outcome"], "fault");
    state.stop("s-dribble").await.unwrap();
}

#[tokio::test]
async fn anti_recursion_header_returns_508_without_journal() {
    let port = free_port();
    let state = ApiMockNativeState::new();
    state.start(ping_def("s-loop", port)).await.expect("start");
    let res = http_client()
        .get(format!("http://127.0.0.1:{port}/ping"))
        .header("x-redfireforge-mock", "true")
        .send()
        .await
        .expect("get");
    assert_eq!(res.status(), 508);
    let body = res.text().await.expect("text");
    assert!(body.contains("loop_detected"), "{body}");
    let page = state.transactions("s-loop", None, None).expect("journal");
    assert_eq!(page["total"], 0);
    state.stop("s-loop").await.unwrap();
}

#[tokio::test]
async fn callback_failure_does_not_block_mock_response() {
    let port = free_port();
    let state = ApiMockNativeState::new();
    let mut def = ping_def("s-cb", port);
    def.settings.callbacks = Some(crate::api_mock::types::CallbackSettings {
        allowlist: vec!["https://hooks.example.com/event".into()],
    });
    def.routes[0].responses[0].callbacks = Some(vec![crate::api_mock::types::CallbackRule {
        id: "c1".into(),
        enabled: true,
        url: "https://hooks.example.com/event".into(),
        method: "POST".into(),
        headers: vec![],
        body_template: r#"{"ok":true}"#.into(),
        timeout_ms: 5_000,
        max_retries: 0,
    }]);
    state.start(def).await.expect("start");
    let started = std::time::Instant::now();
    let res = http_client()
        .get(format!("http://127.0.0.1:{port}/ping"))
        .send()
        .await
        .expect("get");
    let elapsed = started.elapsed();
    assert_eq!(res.status(), 200);
    let body = res.text().await.expect("text");
    assert!(body.contains("ok"), "{body}");
    assert!(
        elapsed < std::time::Duration::from_millis(500),
        "mock response waited on callback: {elapsed:?}"
    );
    state.stop("s-cb").await.unwrap();
}

fn proxy_unmatched_def(id: &str, port: u16, allowlist: Vec<&str>) -> ServerDefinition {
    let mut def = ping_def(id, port);
    def.settings.fallback.mode = "proxy".into();
    def.settings.proxy = Some(crate::api_mock::types::ProxySettings {
        enabled: true,
        allowlist: allowlist.into_iter().map(|s| s.to_string()).collect(),
        ..Default::default()
    });
    def
}

#[tokio::test]
async fn unmatched_proxy_empty_allowlist_is_misconfigured() {
    let port = free_port();
    let state = ApiMockNativeState::new();
    state
        .start(proxy_unmatched_def("s-proxy-empty", port, vec![]))
        .await
        .expect("start");
    let res = http_client()
        .get(format!("http://127.0.0.1:{port}/missing"))
        .send()
        .await
        .expect("get");
    assert_eq!(res.status(), 502);
    let body = res.text().await.expect("text");
    assert!(body.contains("proxy_misconfigured"), "{body}");
    let page = state.transactions("s-proxy-empty", None, None).expect("journal");
    assert_eq!(page["transactions"][0]["outcome"], "error");
    let diag = state.diagnostics("s-proxy-empty").unwrap();
    assert_eq!(diag["outcomes"]["error"], 1);
    assert_eq!(diag["outcomes"]["unmatched"], 0);
    let drafts = state.recorded_drafts("s-proxy-empty").unwrap();
    assert_eq!(drafts["total"], 0);
    state.stop("s-proxy-empty").await.unwrap();
}

#[tokio::test]
async fn unmatched_proxy_upstream_failure_is_502() {
    let port = free_port();
    let state = ApiMockNativeState::new();
    state
        .start(proxy_unmatched_def(
            "s-proxy-fail",
            port,
            vec!["https://hooks.invalid.test"],
        ))
        .await
        .expect("start");
    let res = http_client()
        .get(format!("http://127.0.0.1:{port}/missing"))
        .send()
        .await
        .expect("get");
    assert_eq!(res.status(), 502);
    let body = res.text().await.expect("text");
    assert!(body.contains("proxy_failed"), "{body}");
    let page = state.transactions("s-proxy-fail", None, None).expect("journal");
    assert_eq!(page["transactions"][0]["outcome"], "error");
    let drafts = state.recorded_drafts("s-proxy-fail").unwrap();
    assert_eq!(drafts["total"], 0);
    state.stop("s-proxy-fail").await.unwrap();
}

fn test_capture(id: &str, fingerprint: &str) -> RecordedCapture {
    RecordedCapture {
        id: id.into(),
        fingerprint: fingerprint.into(),
        recorded_at: "2026-08-13T00:00:00.000Z".into(),
        request: CapturedRequest {
            method: "GET".into(),
            path: "/x".into(),
            ..Default::default()
        },
        response: RecordedCaptureResponse {
            status: 200,
            headers: HashMap::new(),
            body: "{}".into(),
        },
        redaction: RedactionSettings::default(),
    }
}

#[tokio::test]
async fn recorded_drafts_list_ack_clear_and_survive_restart() {
    let port = free_port();
    let state = ApiMockNativeState::new();
    state.start(ping_def("s-drafts", port)).await.expect("start");
    state
        .push_recorded_draft_for_test("s-drafts", test_capture("rec-aaaa", "GET /x → 200"))
        .unwrap();
    state
        .push_recorded_draft_for_test("s-drafts", test_capture("rec-bbbb", "GET /y → 200"))
        .unwrap();

    let listed = state.recorded_drafts("s-drafts").unwrap();
    assert_eq!(listed["total"], 2);
    assert_eq!(listed["captures"][0]["id"], "rec-aaaa");
    assert_eq!(listed["captures"][0]["fingerprint"], "GET /x → 200");

    let ack = state
        .ack_recorded_drafts("s-drafts", &["rec-aaaa".into()])
        .unwrap();
    assert_eq!(ack["removed"], 1);
    let listed = state.recorded_drafts("s-drafts").unwrap();
    assert_eq!(listed["total"], 1);
    assert_eq!(listed["captures"][0]["id"], "rec-bbbb");

    state.stop("s-drafts").await.unwrap();
    let after_stop = state.recorded_drafts("s-drafts").unwrap();
    assert_eq!(after_stop["total"], 1);

    state.start(ping_def("s-drafts", port)).await.expect("restart");
    let after_start = state.recorded_drafts("s-drafts").unwrap();
    assert_eq!(after_start["total"], 1);
    assert_eq!(after_start["captures"][0]["id"], "rec-bbbb");

    let cleared = state.clear_recorded_drafts("s-drafts").unwrap();
    assert_eq!(cleared["cleared"], true);
    assert_eq!(state.recorded_drafts("s-drafts").unwrap()["total"], 0);

    let missing = state.recorded_drafts("no-such").unwrap();
    assert_eq!(missing["total"], 0);
    assert_eq!(state.ack_recorded_drafts("no-such", &["x".into()]).unwrap()["removed"], 0);
    assert_eq!(state.clear_recorded_drafts("no-such").unwrap()["cleared"], true);

    state.stop("s-drafts").await.unwrap();
}

fn test_tls_pems() -> &'static (String, String) {
    static PEMS: std::sync::OnceLock<(String, String)> = std::sync::OnceLock::new();
    PEMS.get_or_init(test_self_signed_pem)
}

fn ping_def_tls(id: &str, port: u16) -> ServerDefinition {
    let (cert_pem, key_pem) = test_tls_pems();
    let mut def = ping_def(id, port);
    def.settings.tls = Some(TlsSettings {
        enabled: true,
        cert_pem: cert_pem.clone(),
        key_pem: key_pem.clone(),
        ..Default::default()
    });
    def
}

fn https_client(http2: bool) -> reqwest::Client {
    let mut builder = reqwest::Client::builder()
        .danger_accept_invalid_certs(true)
        .no_proxy()
        .timeout(std::time::Duration::from_secs(5));
    builder = if http2 {
        builder
    } else {
        builder.http1_only()
    };
    builder.build().unwrap()
}

fn assert_no_pseudo_headers(headers: &serde_json::Value) {
    let obj = headers.as_object().expect("headers object");
    for key in obj.keys() {
        assert!(!key.starts_with(':'), "journal must skip pseudo-header {key}");
    }
    let host = obj
        .get("host")
        .and_then(|v| v.as_array())
        .and_then(|v| v.first())
        .and_then(|v| v.as_str())
        .unwrap_or("");
    assert!(
        host.starts_with("127.0.0.1:") || host.starts_with("localhost:"),
        "host={host}"
    );
}

#[test]
fn normalize_maps_authority_to_host_when_host_absent() {
    let headers = HeaderMap::new();
    let captured = normalize(
        &Method::GET,
        "/users",
        None,
        &headers,
        None,
        Some("127.0.0.1:4600"),
    );
    assert_eq!(
        captured.headers.get("host"),
        Some(&vec!["127.0.0.1:4600".to_string()])
    );
    assert!(captured.headers.keys().all(|k| !k.starts_with(':')));
}

#[test]
fn normalize_keeps_explicit_host_over_authority() {
    let mut headers = HeaderMap::new();
    headers.insert("host", HeaderValue::from_static("api.test"));
    let captured = normalize(
        &Method::GET,
        "/",
        None,
        &headers,
        None,
        Some("ignored.example"),
    );
    assert_eq!(
        captured.headers.get("host"),
        Some(&vec!["api.test".to_string()])
    );
}

#[tokio::test]
async fn tls_serves_h2_and_http11_on_the_same_port() {
    let port = free_port();
    let state = ApiMockNativeState::new();
    state.start(ping_def_tls("s-h2", port)).await.expect("start");
    let url = format!("https://127.0.0.1:{port}/ping");

    let h2 = https_client(true).get(&url).send().await.expect("h2");
    assert_eq!(h2.status(), 200);
    assert_eq!(h2.version(), reqwest::Version::HTTP_2);
    let h2_body = h2.text().await.expect("h2 body");
    assert!(h2_body.contains("ok"), "{h2_body}");

    let h11 = https_client(false).get(&url).send().await.expect("h11");
    assert_eq!(h11.status(), 200);
    assert_eq!(h11.version(), reqwest::Version::HTTP_11);
    let h11_body = h11.text().await.expect("h11 body");
    assert!(h11_body.contains("ok"), "{h11_body}");

    let page = state.transactions("s-h2", None, None).expect("journal");
    assert_eq!(page["total"], 2);
    assert_no_pseudo_headers(&page["transactions"][0]["request"]["headers"]);
    assert_no_pseudo_headers(&page["transactions"][1]["request"]["headers"]);

    state.stop("s-h2").await.unwrap();
}

#[tokio::test]
async fn tls_http2_multiplexes_concurrent_streams() {
    let port = free_port();
    let state = ApiMockNativeState::new();
    state.start(ping_def_tls("s-h2-mux", port)).await.expect("start");
    let url = format!("https://127.0.0.1:{port}/ping");
    let client = https_client(true);
    let warm = client.get(&url).send().await.expect("warm");
    assert_eq!(warm.version(), reqwest::Version::HTTP_2);
    drop(warm.text().await);

    let (a, b) = tokio::join!(client.get(&url).send(), client.get(&url).send());
    let a = a.expect("mux a");
    let b = b.expect("mux b");
    assert_eq!(a.status(), 200);
    assert_eq!(b.status(), 200);
    assert_eq!(a.version(), reqwest::Version::HTTP_2);
    assert_eq!(b.version(), reqwest::Version::HTTP_2);

    state.stop("s-h2-mux").await.unwrap();
}

#[tokio::test]
async fn tls_http2_stop_closes_the_session() {
    let port = free_port();
    let state = ApiMockNativeState::new();
    state.start(ping_def_tls("s-h2-stop", port)).await.expect("start");
    let url = format!("https://127.0.0.1:{port}/ping");
    let client = https_client(true);
    let first = client.get(&url).send().await.expect("first");
    assert_eq!(first.status(), 200);
    assert_eq!(first.version(), reqwest::Version::HTTP_2);
    drop(first.text().await);

    state.stop("s-h2-stop").await.unwrap();
    assert!(client.get(&url).send().await.is_err());
}

#[tokio::test]
async fn plaintext_does_not_speak_h2c() {
    let port = free_port();
    let state = ApiMockNativeState::new();
    state.start(ping_def("s-no-h2c", port)).await.expect("start");
    let url = format!("http://127.0.0.1:{port}/ping");
    let client = reqwest::Client::builder()
        .http2_prior_knowledge()
        .no_proxy()
        .timeout(std::time::Duration::from_secs(2))
        .build()
        .unwrap();
    assert!(client.get(&url).send().await.is_err());
    let body = http_client().get(&url).send().await.expect("h11").text().await.expect("text");
    assert!(body.contains("ok"), "{body}");
    state.stop("s-no-h2c").await.unwrap();
}

#[tokio::test]
async fn tls_http2_maps_authority_so_host_predicates_match() {
    let port = free_port();
    let state = ApiMockNativeState::new();
    let mut def = ping_def_tls("s-h2-host", port);
    def.routes[0].predicates.children.push(PredicateNode::Leaf(Predicate {
        id: "p-host".into(),
        source: "header".into(),
        selector: Some("host".into()),
        operator: "contains".into(),
        expected: Some(serde_json::json!("127.0.0.1")),
        options: None,
    }));
    state.start(def).await.expect("start");
    let url = format!("https://127.0.0.1:{port}/ping");
    let res = https_client(true).get(&url).send().await.expect("h2");
    assert_eq!(res.status(), 200);
    assert_eq!(res.version(), reqwest::Version::HTTP_2);
    state.stop("s-h2-host").await.unwrap();
}

#[tokio::test]
async fn tls_http2_strips_hop_by_hop_response_headers() {
    let port = free_port();
    let state = ApiMockNativeState::new();
    let mut def = ping_def_tls("s-h2-hop", port);
    def.routes[0].responses[0].headers.extend([
        HeaderKV {
            id: "h-conn".into(),
            key: "Connection".into(),
            value: "close".into(),
            enabled: true,
        },
        HeaderKV {
            id: "h-te".into(),
            key: "Transfer-Encoding".into(),
            value: "chunked".into(),
            enabled: true,
        },
        HeaderKV {
            id: "h-proxy".into(),
            key: "Proxy-Authenticate".into(),
            value: "Basic".into(),
            enabled: true,
        },
    ]);
    state.start(def).await.expect("start");
    let url = format!("https://127.0.0.1:{port}/ping");
    let res = https_client(true).get(&url).send().await.expect("h2");
    assert_eq!(res.status(), 200);
    assert_eq!(res.version(), reqwest::Version::HTTP_2);
    assert!(res.headers().get("connection").is_none());
    assert!(res.headers().get("transfer-encoding").is_none());
    assert!(res.headers().get("proxy-authenticate").is_none());
    let body = res.text().await.expect("body");
    assert!(body.contains("ok"), "{body}");
    state.stop("s-h2-hop").await.unwrap();
}

#[tokio::test]
async fn tls_http2_malformed_stream_does_not_reset_siblings() {
    let port = free_port();
    let state = ApiMockNativeState::new();
    let mut def = ping_def_tls("s-h2-mux-fault", port);
    let mut boom = def.routes[0].clone();
    boom.id = "r-boom".into();
    boom.path.value = "/boom".into();
    boom.responses[0].id = "v-boom".into();
    boom.responses[0].behavior.fault = Some("malformed".into());
    def.routes.push(boom);
    state.start(def).await.expect("start");
    let ping_url = format!("https://127.0.0.1:{port}/ping");
    let boom_url = format!("https://127.0.0.1:{port}/boom");
    let client = https_client(true);
    let warm = client.get(&ping_url).send().await.expect("warm");
    assert_eq!(warm.version(), reqwest::Version::HTTP_2);
    drop(warm.text().await);

    let (ping, boom) = tokio::join!(client.get(&ping_url).send(), client.get(&boom_url).send());
    let ping = ping.expect("sibling ping");
    assert_eq!(ping.status(), 200);
    assert_eq!(ping.version(), reqwest::Version::HTTP_2);
    match boom {
        Ok(res) => panic!("malformed must not send HTTP {}", res.status()),
        Err(_) => {}
    }
    state.stop("s-h2-mux-fault").await.unwrap();
}

#[tokio::test]
async fn tls_http2_dribble_returns_full_body() {
    let port = free_port();
    let state = ApiMockNativeState::new();
    let mut def = ping_def_tls("s-h2-dribble", port);
    def.routes[0].responses[0].body.content = r#"{"ok":true}"#.into();
    def.routes[0].responses[0].behavior.fault = Some("dribble".into());
    def.routes[0].responses[0].behavior.chunk_schedule = Some(vec![
        serde_json::json!({ "afterMs": 0, "body": "{\"ok\":" }),
        serde_json::json!({ "afterMs": 5, "body": "true}" }),
    ]);
    state.start(def).await.expect("start");
    let url = format!("https://127.0.0.1:{port}/ping");
    let res = https_client(true).get(&url).send().await.expect("h2");
    assert_eq!(res.status(), 200);
    assert_eq!(res.version(), reqwest::Version::HTTP_2);
    let body = res.text().await.expect("text");
    assert_eq!(body, r#"{"ok":true}"#);
    state.stop("s-h2-dribble").await.unwrap();
}
