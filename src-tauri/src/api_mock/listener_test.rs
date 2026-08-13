use crate::api_mock::registry::ApiMockNativeState;
use crate::api_mock::types::ServerDefinition;

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
