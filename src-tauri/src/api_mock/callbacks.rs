//! Fire-and-forget outbound callbacks after a matched mock response (Phase 9D / native).

use crate::api_mock::outbound::{
    add_anti_recursion_header, check_proxy_url, validate_outbound_url_with_dns,
};
use crate::api_mock::render::apply_template;
use crate::api_mock::types::{
    CallbackRule, CallbackSettings, CapturedRequest, ScenarioState, ServerDefinition,
};
use std::collections::HashMap;
use std::future::Future;
use std::str::FromStr;
use std::time::Duration;

const BACKOFF_MS: [u64; 5] = [1_000, 4_000, 16_000, 32_000, 60_000];
const MAX_RETRIES: u32 = 5;
const MAX_TIMEOUT_MS: u64 = 60_000;
const MAX_BODY_BYTES: usize = 256 * 1024;

#[derive(Debug, Clone)]
#[allow(dead_code)]
pub struct CallbackFireResult {
    pub callback_id: String,
    pub ok: bool,
    pub attempts: u32,
    pub status: Option<u16>,
    pub error: Option<String>,
}

#[derive(Clone)]
pub struct CallbackContext {
    pub request: CapturedRequest,
    pub path_params: HashMap<String, String>,
    pub def: ServerDefinition,
    pub scenario: ScenarioState,
    pub seed: String,
}

#[derive(Clone)]
pub struct PreparedCallback {
    pub method: String,
    pub url: String,
    pub headers: Vec<(String, String)>,
    pub body: String,
    pub timeout_ms: u64,
}

fn fail(id: &str, attempts: u32, error: impl Into<String>) -> CallbackFireResult {
    CallbackFireResult {
        callback_id: id.into(),
        ok: false,
        attempts,
        status: None,
        error: Some(error.into()),
    }
}

fn render_maybe(raw: &str, ctx: Option<&CallbackContext>) -> String {
    if ctx.is_none() || !raw.contains("{{") {
        return raw.to_string();
    }
    let ctx = ctx.unwrap();
    apply_template(
        raw,
        &ctx.request,
        &ctx.path_params,
        &ctx.def,
        &ctx.scenario,
        &ctx.seed,
    )
}

pub async fn execute_callback(
    callback: CallbackRule,
    settings: &CallbackSettings,
    active_mock_ports: &[u16],
    ctx: Option<&CallbackContext>,
    block_private_networks: bool,
) -> CallbackFireResult {
    execute_callback_with(
        callback,
        settings,
        active_mock_ports,
        ctx,
        block_private_networks,
        default_fetch,
    )
    .await
}

pub async fn execute_callback_with<F, Fut>(
    callback: CallbackRule,
    settings: &CallbackSettings,
    active_mock_ports: &[u16],
    ctx: Option<&CallbackContext>,
    block_private_networks: bool,
    mut fetch: F,
) -> CallbackFireResult
where
    F: FnMut(PreparedCallback) -> Fut,
    Fut: Future<Output = Result<u16, String>>,
{
    if !callback.enabled {
        return fail(&callback.id, 0, "disabled");
    }
    let url = callback.url.trim().to_string();
    if url.is_empty() {
        return fail(&callback.id, 0, "empty url");
    }
    if !settings.allowlist.iter().any(|u| u == &url) {
        return fail(&callback.id, 0, "URL not in callback allowlist");
    }

    let timeout_ms = callback.timeout_ms.clamp(1, MAX_TIMEOUT_MS);
    let max_retries = callback.max_retries.min(MAX_RETRIES);
    let body = render_maybe(&callback.body_template, ctx);
    if body.len() > MAX_BODY_BYTES {
        return fail(&callback.id, 0, "Callback body exceeds ceiling");
    }

    let mut last_error = "unknown".to_string();
    let mut attempts = 0u32;
    for attempt in 0..=max_retries {
        attempts = attempt + 1;
        let policy = check_proxy_url(&url, &settings.allowlist, active_mock_ports);
        if !policy.allowed {
            return fail(
                &callback.id,
                attempts,
                policy.reason.unwrap_or_else(|| "policy rejected".into()),
            );
        }
        if block_private_networks {
            if let Err(e) = validate_outbound_url_with_dns(&url).await {
                return fail(&callback.id, attempts, e);
            }
        }

        let mut headers = vec![("content-type".into(), "application/json".into())];
        for h in &callback.headers {
            if !h.enabled || h.key.is_empty() {
                continue;
            }
            headers.push((h.key.clone(), render_maybe(&h.value, ctx)));
        }
        add_anti_recursion_header(&mut headers);

        let prepared = PreparedCallback {
            method: if callback.method.is_empty() {
                "POST".into()
            } else {
                callback.method.clone()
            },
            url: url.clone(),
            headers,
            body: body.clone(),
            timeout_ms,
        };
        match fetch(prepared).await {
            Ok(status) if (200..300).contains(&status) => {
                return CallbackFireResult {
                    callback_id: callback.id,
                    ok: true,
                    attempts,
                    status: Some(status),
                    error: None,
                };
            }
            Ok(status) => last_error = format!("HTTP {status}"),
            Err(e) => last_error = e,
        }
        if attempt < max_retries {
            let delay = BACKOFF_MS[attempt.min(BACKOFF_MS.len() as u32 - 1) as usize];
            tokio::time::sleep(Duration::from_millis(delay)).await;
        }
    }
    fail(&callback.id, attempts, last_error)
}

pub async fn execute_callbacks(
    callbacks: Vec<CallbackRule>,
    settings: CallbackSettings,
    active_mock_ports: Vec<u16>,
    ctx: Option<CallbackContext>,
    block_private_networks: bool,
) -> Vec<CallbackFireResult> {
    let list: Vec<_> = callbacks.into_iter().filter(|c| c.enabled).collect();
    if list.is_empty() {
        return Vec::new();
    }
    let futs = list.into_iter().map(|callback| {
        let settings = settings.clone();
        let ports = active_mock_ports.clone();
        let ctx = ctx.clone();
        async move {
            execute_callback(
                callback,
                &settings,
                &ports,
                ctx.as_ref(),
                block_private_networks,
            )
            .await
        }
    });
    futures::future::join_all(futs).await
}

/// Never awaited on the mock HTTP path.
pub fn spawn_execute_callbacks(
    callbacks: Vec<CallbackRule>,
    settings: CallbackSettings,
    active_mock_ports: Vec<u16>,
    ctx: Option<CallbackContext>,
    block_private_networks: bool,
) {
    tokio::spawn(async move {
        let _ = execute_callbacks(
            callbacks,
            settings,
            active_mock_ports,
            ctx,
            block_private_networks,
        )
        .await;
    });
}

async fn default_fetch(req: PreparedCallback) -> Result<u16, String> {
    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .timeout(Duration::from_millis(req.timeout_ms))
        .no_proxy()
        .build()
        .map_err(|e| e.to_string())?;
    let method = reqwest::Method::from_str(&req.method).unwrap_or(reqwest::Method::POST);
    let mut builder = client.request(method, &req.url);
    for (k, v) in &req.headers {
        builder = builder.header(k, v);
    }
    let res = builder.body(req.body).send().await.map_err(|e| e.to_string())?;
    Ok(res.status().as_u16())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::api_mock::types::{HeaderKV, ScenarioState};

    fn cb(overrides: impl FnOnce(&mut CallbackRule)) -> CallbackRule {
        let mut c = CallbackRule {
            id: "cb1".into(),
            enabled: true,
            url: "https://hooks.example.com/event".into(),
            method: "POST".into(),
            headers: vec![],
            body_template: r#"{"ok":true}"#.into(),
            timeout_ms: 5_000,
            max_retries: 0,
        };
        overrides(&mut c);
        c
    }

    fn settings() -> CallbackSettings {
        CallbackSettings {
            allowlist: vec!["https://hooks.example.com/event".into()],
        }
    }

    #[tokio::test]
    async fn rejects_allowlist_miss() {
        let result = execute_callback(
            cb(|_| {}),
            &CallbackSettings {
                allowlist: vec!["https://other.example.com/x".into()],
            },
            &[4600],
            None,
            false,
        )
        .await;
        assert!(!result.ok);
        assert!(result.error.unwrap().to_lowercase().contains("allowlist"));
    }

    #[tokio::test]
    async fn disabled_and_empty_url() {
        let d = execute_callback(cb(|c| c.enabled = false), &settings(), &[], None, false).await;
        assert_eq!(d.error.as_deref(), Some("disabled"));
        assert_eq!(d.attempts, 0);

        let e = execute_callback(cb(|c| c.url = "   ".into()), &settings(), &[], None, false).await;
        assert_eq!(e.error.as_deref(), Some("empty url"));
    }

    #[tokio::test]
    async fn oversized_body() {
        let huge = "x".repeat(MAX_BODY_BYTES + 1);
        let result = execute_callback(
            cb(|c| c.body_template = huge),
            &settings(),
            &[],
            None,
            false,
        )
        .await;
        assert_eq!(result.error.as_deref(), Some("Callback body exceeds ceiling"));
    }

    #[tokio::test]
    async fn succeeds_on_2xx_with_anti_recursion_header() {
        let seen = std::sync::Arc::new(std::sync::Mutex::new(None::<PreparedCallback>));
        let seen2 = seen.clone();
        let result = execute_callback_with(
            cb(|_| {}),
            &settings(),
            &[4600],
            None,
            false,
            move |req| {
                *seen2.lock().unwrap() = Some(req);
                async { Ok(200) }
            },
        )
        .await;
        assert!(result.ok);
        assert_eq!(result.status, Some(200));
        let sent = seen.lock().unwrap().take().unwrap();
        assert!(sent
            .headers
            .iter()
            .any(|(k, v)| k.eq_ignore_ascii_case("x-redfireforge-mock") && v == "true"));
    }

    #[tokio::test]
    async fn retries_on_http_500() {
        let calls = std::sync::Arc::new(std::sync::atomic::AtomicU32::new(0));
        let calls2 = calls.clone();
        let result = execute_callback_with(
            cb(|c| c.max_retries = 1),
            &settings(),
            &[4600],
            None,
            false,
            move |_req| {
                calls2.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
                async { Ok(500) }
            },
        )
        .await;
        assert!(!result.ok);
        assert_eq!(result.attempts, 2);
        assert_eq!(calls.load(std::sync::atomic::Ordering::SeqCst), 2);
        assert_eq!(result.error.as_deref(), Some("HTTP 500"));
    }

    #[tokio::test]
    async fn renders_body_and_header_templates() {
        let def: ServerDefinition = serde_json::from_value(serde_json::json!({
            "id": "s",
            "port": 1,
            "variables": [{ "key": "token", "value": "abc" }],
            "routes": []
        }))
        .unwrap();
        let ctx = CallbackContext {
            request: CapturedRequest {
                method: "GET".into(),
                path: "/users/1".into(),
                ..Default::default()
            },
            path_params: HashMap::new(),
            def,
            scenario: ScenarioState::default(),
            seed: "seed".into(),
        };
        let seen = std::sync::Arc::new(std::sync::Mutex::new(None::<PreparedCallback>));
        let seen2 = seen.clone();
        let result = execute_callback_with(
            cb(|c| {
                c.body_template = r#"{"path":"{{request.path}}","token":"{{variables.token}}"}"#.into();
                c.headers = vec![HeaderKV {
                    key: "X-Path".into(),
                    value: "{{request.path}}".into(),
                    enabled: true,
                    ..Default::default()
                }];
            }),
            &settings(),
            &[],
            Some(&ctx),
            false,
            move |req| {
                *seen2.lock().unwrap() = Some(req);
                async { Ok(204) }
            },
        )
        .await;
        assert!(result.ok);
        let sent = seen.lock().unwrap().take().unwrap();
        assert!(sent.body.contains("/users/1"), "{}", sent.body);
        assert!(sent.body.contains("abc"), "{}", sent.body);
        assert!(sent
            .headers
            .iter()
            .any(|(k, v)| k == "X-Path" && v == "/users/1"));
    }

    #[tokio::test]
    async fn execute_callbacks_skips_disabled() {
        let results = execute_callbacks(
            vec![cb(|c| {
                c.id = "b".into();
                c.enabled = false;
            })],
            settings(),
            vec![],
            None,
            false,
        )
        .await;
        assert!(results.is_empty());
    }

    #[tokio::test]
    async fn blocks_metadata_via_policy() {
        let result = execute_callback(
            cb(|c| c.url = "http://169.254.169.254/meta".into()),
            &CallbackSettings {
                allowlist: vec!["http://169.254.169.254/meta".into()],
            },
            &[],
            None,
            false,
        )
        .await;
        assert!(!result.ok);
        assert!(result.error.unwrap().to_lowercase().contains("metadata"));
    }
}
