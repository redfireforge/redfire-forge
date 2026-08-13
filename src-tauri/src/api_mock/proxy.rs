//! Allowlisted unmatched-request proxy. Same outbound policy stack as callbacks.

use crate::api_mock::outbound::{
    add_anti_recursion_header, check_proxy_url, strip_credential_headers, strip_hop_by_hop,
    strip_set_cookie, validate_outbound_url_with_dns,
};
use crate::api_mock::types::{CapturedRequest, ProxySettings};
use std::future::Future;
use std::str::FromStr;
use std::time::Duration;

const MAX_REDIRECTS: u32 = 10;
const MAX_TIMEOUT_MS: u64 = 60_000;
const MAX_RESPONSE_BYTES: usize = 10_485_760;

#[derive(Debug, Clone)]
pub struct ProxyExecutorResult {
    pub ok: bool,
    pub status: u16,
    pub headers: Vec<(String, String)>,
    pub body: String,
    pub error: Option<String>,
    #[allow(dead_code)]
    pub redirected: bool,
}

#[derive(Debug, Clone)]
pub struct PreparedProxyRequest {
    pub method: String,
    pub url: String,
    pub headers: Vec<(String, String)>,
    pub body: Option<String>,
    pub timeout_ms: u64,
}

#[derive(Debug, Clone)]
pub struct ProxyFetchResponse {
    pub status: u16,
    pub headers: Vec<(String, String)>,
    pub body: Vec<u8>,
}

fn fail(error: impl Into<String>) -> ProxyExecutorResult {
    ProxyExecutorResult {
        ok: false,
        status: 502,
        headers: vec![],
        body: String::new(),
        error: Some(error.into()),
        redirected: false,
    }
}

pub fn build_upstream_url(allowlist_origin: &str, inbound_path: &str, inbound_url: &str) -> String {
    // Node `replace(/\/$/, '')` strips a single trailing slash, not all of them.
    let base = allowlist_origin.strip_suffix('/').unwrap_or(allowlist_origin);
    let mut path = if inbound_path.is_empty() {
        "/".to_string()
    } else {
        inbound_path.to_string()
    };
    if let Ok(base_url) = reqwest::Url::parse("http://localhost") {
        if let Ok(parsed) = base_url.join(inbound_url) {
            path = parsed.path().to_string();
            if let Some(q) = parsed.query() {
                path.push('?');
                path.push_str(q);
            } else if inbound_url.contains('?') {
                // `new URL('/x?', base).search` is `"?"` even when the query is empty.
                path.push('?');
            }
        }
    }
    format!("{base}{}", if path.starts_with('/') { path } else { format!("/{path}") })
}

pub fn pick_allowlisted_origin(proxy: &ProxySettings, inbound_host_hint: Option<&str>) -> Option<String> {
    if !proxy.enabled || proxy.allowlist.is_empty() {
        return None;
    }
    if let Some(hint) = inbound_host_hint {
        if let Some(hit) = proxy.allowlist.iter().find(|a| hint.starts_with(a.as_str()) || a.contains(hint))
        {
            return Some(hit.clone());
        }
    }
    proxy.allowlist.first().cloned()
}

pub fn proxy_error_json(code: &str, message: &str) -> String {
    serde_json::json!({ "error": code, "message": message }).to_string()
}

pub async fn execute_proxy(
    captured: &CapturedRequest,
    proxy: &ProxySettings,
    upstream_url: &str,
    active_mock_ports: &[u16],
) -> ProxyExecutorResult {
    execute_proxy_with(captured, proxy, upstream_url, active_mock_ports, default_proxy_fetch).await
}

pub async fn execute_proxy_with<F, Fut>(
    captured: &CapturedRequest,
    proxy: &ProxySettings,
    upstream_url: &str,
    active_mock_ports: &[u16],
    mut fetch: F,
) -> ProxyExecutorResult
where
    F: FnMut(PreparedProxyRequest) -> Fut,
    Fut: Future<Output = Result<ProxyFetchResponse, String>>,
{
    let timeout_ms = proxy.timeout_ms.clamp(1, MAX_TIMEOUT_MS);
    let max_redirects = proxy.max_redirects.min(MAX_REDIRECTS);
    let max_bytes = proxy.max_response_bytes.clamp(1, MAX_RESPONSE_BYTES);
    let forward_list = if proxy.forward_auth {
        proxy.forward_credential_headers.as_slice()
    } else {
        &[]
    };

    let mut current_url = upstream_url.to_string();
    for hop in 0..=max_redirects {
        let policy = check_proxy_url(&current_url, &proxy.allowlist, active_mock_ports);
        if !policy.allowed {
            return fail(policy.reason.unwrap_or_else(|| "policy rejected".into()));
        }
        if proxy.block_private_networks {
            if let Err(e) = validate_outbound_url_with_dns(&current_url).await {
                return fail(e);
            }
        }

        let mut headers = flatten_inbound_headers(&captured.headers);
        if proxy.strip_hop_by_hop {
            strip_hop_by_hop(&mut headers);
        }
        strip_credential_headers(&mut headers, forward_list);
        add_anti_recursion_header(&mut headers);
        headers.retain(|(k, _)| {
            !k.eq_ignore_ascii_case("host") && !k.eq_ignore_ascii_case("content-length")
        });

        let method = if captured.method.is_empty() {
            "GET".into()
        } else {
            captured.method.clone()
        };
        let send_body = !is_get_or_head(&method);
        let prepared = PreparedProxyRequest {
            method,
            url: current_url.clone(),
            headers,
            body: if send_body { captured.body.clone() } else { None },
            timeout_ms,
        };

        let res = match fetch(prepared).await {
            Ok(r) => r,
            Err(e) => return fail(e),
        };

        if (300..400).contains(&res.status) {
            // Node `headers.get('location')` is falsy for missing/empty — do not follow.
            if let Some(loc) = header_value(&res.headers, "location") {
                if !loc.is_empty() {
                    current_url = match join_redirect(&current_url, &loc) {
                        Ok(u) => u,
                        Err(e) => return fail(e),
                    };
                    if hop == max_redirects {
                        return fail("Redirect limit exceeded");
                    }
                    continue;
                }
            }
        }

        let truncated = if res.body.len() > max_bytes {
            &res.body[..max_bytes]
        } else {
            &res.body[..]
        };
        let mut headers = res.headers;
        strip_set_cookie(&mut headers);
        if proxy.strip_hop_by_hop {
            strip_hop_by_hop(&mut headers);
        }
        // reqwest (gzip/brotli features) may decode the body while leaving encoding
        // headers in place; we also buffer/truncate. Stale length/encoding would lie.
        strip_buffered_body_headers(&mut headers);
        return ProxyExecutorResult {
            ok: true,
            status: res.status,
            headers,
            body: String::from_utf8_lossy(truncated).into_owned(),
            error: None,
            redirected: hop > 0,
        };
    }

    fail("Proxy failed")
}

fn is_get_or_head(method: &str) -> bool {
    method.eq_ignore_ascii_case("GET") || method.eq_ignore_ascii_case("HEAD")
}

fn flatten_inbound_headers(headers: &std::collections::HashMap<String, Vec<String>>) -> Vec<(String, String)> {
    let mut out = Vec::new();
    for (k, values) in headers {
        if k.starts_with(':') || values.is_empty() {
            continue;
        }
        let joined = if k.eq_ignore_ascii_case("cookie") {
            values.join("; ")
        } else {
            values.join(", ")
        };
        out.push((k.clone(), joined));
    }
    out
}

fn header_value(headers: &[(String, String)], name: &str) -> Option<String> {
    headers
        .iter()
        .find(|(k, _)| k.eq_ignore_ascii_case(name))
        .map(|(_, v)| v.clone())
}

fn strip_buffered_body_headers(headers: &mut Vec<(String, String)>) {
    headers.retain(|(k, _)| {
        !k.eq_ignore_ascii_case("content-length")
            && !k.eq_ignore_ascii_case("transfer-encoding")
            && !k.eq_ignore_ascii_case("content-encoding")
    });
}

fn join_redirect(current: &str, location: &str) -> Result<String, String> {
    let base = reqwest::Url::parse(current).map_err(|e| format!("Invalid redirect base: {e}"))?;
    base.join(location)
        .map(|u| u.to_string())
        .map_err(|e| format!("Invalid redirect location: {e}"))
}

async fn default_proxy_fetch(req: PreparedProxyRequest) -> Result<ProxyFetchResponse, String> {
    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .timeout(Duration::from_millis(req.timeout_ms))
        .no_proxy()
        .build()
        .map_err(|e| e.to_string())?;
    let method = reqwest::Method::from_str(&req.method).unwrap_or(reqwest::Method::GET);
    let mut builder = client.request(method, &req.url);
    for (k, v) in &req.headers {
        builder = builder.header(k, v);
    }
    if let Some(body) = req.body {
        builder = builder.body(body);
    }
    let res = builder.send().await.map_err(|e| e.to_string())?;
    let status = res.status().as_u16();
    let mut headers = Vec::new();
    for (k, v) in res.headers().iter() {
        headers.push((k.as_str().to_string(), v.to_str().unwrap_or("").to_string()));
    }
    let body = res.bytes().await.map_err(|e| e.to_string())?.to_vec();
    Ok(ProxyFetchResponse { status, headers, body })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;
    use std::sync::{Arc, Mutex};

    fn proxy(allow: &str) -> ProxySettings {
        ProxySettings {
            enabled: true,
            allowlist: vec![allow.into()],
            block_private_networks: false,
            ..Default::default()
        }
    }

    fn captured(method: &str, headers: Vec<(&str, Vec<&str>)>, body: Option<&str>) -> CapturedRequest {
        let mut map = HashMap::new();
        for (k, vs) in headers {
            map.insert(k.into(), vs.into_iter().map(|s| s.to_string()).collect());
        }
        CapturedRequest {
            method: method.into(),
            path: "/hello".into(),
            raw_path: "/hello".into(),
            headers: map,
            body: body.map(|s| s.to_string()),
            ..Default::default()
        }
    }

    fn ok_json() -> ProxyFetchResponse {
        ProxyFetchResponse {
            status: 200,
            headers: vec![
                ("content-type".into(), "application/json".into()),
                ("set-cookie".into(), "session=abc".into()),
                ("connection".into(), "keep-alive".into()),
                ("content-length".into(), "99".into()),
                ("content-encoding".into(), "gzip".into()),
                ("transfer-encoding".into(), "chunked".into()),
            ],
            body: b"{\"ok\":true}".to_vec(),
        }
    }

    #[test]
    fn build_upstream_preserves_path_and_query() {
        assert_eq!(
            build_upstream_url("https://api.example.com", "/x", "/users?id=1"),
            "https://api.example.com/users?id=1"
        );
        assert_eq!(
            build_upstream_url("https://api.example.com/", "no-slash", "/users?q=1"),
            "https://api.example.com/users?q=1"
        );
        assert_eq!(
            build_upstream_url("https://api.example.com", "", ""),
            "https://api.example.com/"
        );
        assert_eq!(
            build_upstream_url("https://api.example.com", "/x", "/users?a=b+c"),
            "https://api.example.com/users?a=b+c"
        );
        assert_eq!(
            build_upstream_url("https://api.example.com", "/x", "/users?"),
            "https://api.example.com/users?"
        );
        assert_eq!(
            build_upstream_url("https://api.example.com///", "/x", "/users"),
            "https://api.example.com///users"
        );
    }

    #[test]
    fn pick_origin_first_or_hint() {
        let p = ProxySettings {
            enabled: true,
            allowlist: vec!["https://hooks.example.com".into(), "https://api.example.com".into()],
            ..Default::default()
        };
        assert_eq!(
            pick_allowlisted_origin(&p, None).as_deref(),
            Some("https://hooks.example.com")
        );
        assert_eq!(
            pick_allowlisted_origin(&p, Some("hooks.example.com")).as_deref(),
            Some("https://hooks.example.com")
        );
        assert_eq!(
            pick_allowlisted_origin(&p, Some("unknown.host")).as_deref(),
            Some("https://hooks.example.com")
        );
        let empty = ProxySettings {
            enabled: true,
            allowlist: vec![],
            ..Default::default()
        };
        assert!(pick_allowlisted_origin(&empty, None).is_none());
    }

    #[tokio::test]
    async fn blocks_disallowed_upstreams() {
        let result = execute_proxy(
            &captured("GET", vec![], None),
            &proxy("https://api.example.com"),
            "http://169.254.169.254/latest/meta-data",
            &[4600],
        )
        .await;
        assert!(!result.ok);
        assert_eq!(result.status, 502);
        assert!(result.error.as_ref().unwrap().to_lowercase().contains("metadata"));
    }

    #[tokio::test]
    async fn forwards_and_strips_set_cookie_and_auth() {
        let seen = Arc::new(Mutex::new(None::<PreparedProxyRequest>));
        let seen2 = seen.clone();
        let result = execute_proxy_with(
            &captured("GET", vec![("authorization", vec!["Bearer x"]), ("x-trace", vec!["1"])], None),
            &proxy("https://api.example.com"),
            "https://api.example.com/hello",
            &[4600],
            move |req| {
                *seen2.lock().unwrap() = Some(req);
                async { Ok(ok_json()) }
            },
        )
        .await;
        assert!(result.ok);
        assert_eq!(result.status, 200);
        assert_eq!(result.body, "{\"ok\":true}");
        assert!(!result.headers.iter().any(|(k, _)| k.eq_ignore_ascii_case("set-cookie")));
        assert!(!result.headers.iter().any(|(k, _)| k.eq_ignore_ascii_case("content-length")));
        assert!(!result.headers.iter().any(|(k, _)| k.eq_ignore_ascii_case("content-encoding")));
        assert!(!result.headers.iter().any(|(k, _)| k.eq_ignore_ascii_case("transfer-encoding")));
        let sent = seen.lock().unwrap().take().unwrap();
        assert!(!sent.headers.iter().any(|(k, _)| k.eq_ignore_ascii_case("authorization")));
        assert!(sent
            .headers
            .iter()
            .any(|(k, v)| k.eq_ignore_ascii_case("x-redfireforge-mock") && v == "true"));
        assert!(sent.body.is_none());
    }

    #[tokio::test]
    async fn skips_pseudo_headers() {
        let seen = Arc::new(Mutex::new(None::<PreparedProxyRequest>));
        let seen2 = seen.clone();
        let _ = execute_proxy_with(
            &captured(
                "GET",
                vec![
                    (":method", vec!["GET"]),
                    (":path", vec!["/hello"]),
                    ("x-trace", vec!["1"]),
                ],
                None,
            ),
            &proxy("https://api.example.com"),
            "https://api.example.com/hello",
            &[],
            move |req| {
                *seen2.lock().unwrap() = Some(req);
                async { Ok(ok_json()) }
            },
        )
        .await;
        let sent = seen.lock().unwrap().take().unwrap();
        assert!(!sent.headers.iter().any(|(k, _)| k.starts_with(':')));
        assert!(sent.headers.iter().any(|(k, v)| k == "x-trace" && v == "1"));
    }

    #[tokio::test]
    async fn joins_cookies_and_forwards_listed_auth() {
        let seen = Arc::new(Mutex::new(None::<PreparedProxyRequest>));
        let seen2 = seen.clone();
        let mut p = proxy("https://api.example.com");
        p.forward_auth = true;
        p.forward_credential_headers = vec!["cookie".into(), "authorization".into()];
        p.strip_hop_by_hop = false;
        let _ = execute_proxy_with(
            &captured(
                "GET",
                vec![
                    ("cookie", vec!["session=abc", "theme=dark"]),
                    ("authorization", vec!["Bearer x"]),
                    ("x-trace", vec!["1"]),
                ],
                None,
            ),
            &p,
            "https://api.example.com/hello",
            &[],
            move |req| {
                *seen2.lock().unwrap() = Some(req);
                async { Ok(ok_json()) }
            },
        )
        .await;
        let sent = seen.lock().unwrap().take().unwrap();
        assert_eq!(
            sent.headers
                .iter()
                .find(|(k, _)| k.eq_ignore_ascii_case("cookie"))
                .map(|(_, v)| v.as_str()),
            Some("session=abc; theme=dark")
        );
        assert!(sent
            .headers
            .iter()
            .any(|(k, v)| k.eq_ignore_ascii_case("authorization") && v == "Bearer x"));
    }

    #[tokio::test]
    async fn posts_body_not_get() {
        let seen = Arc::new(Mutex::new(None::<PreparedProxyRequest>));
        let seen2 = seen.clone();
        let _ = execute_proxy_with(
            &captured("POST", vec![], Some("{\"a\":1}")),
            &proxy("https://api.example.com"),
            "https://api.example.com/hello",
            &[],
            move |req| {
                *seen2.lock().unwrap() = Some(req);
                async { Ok(ok_json()) }
            },
        )
        .await;
        assert_eq!(seen.lock().unwrap().as_ref().unwrap().body.as_deref(), Some("{\"a\":1}"));
    }

    #[tokio::test]
    async fn follows_redirect_and_caps() {
        let calls = Arc::new(Mutex::new(Vec::<String>::new()));
        let calls2 = calls.clone();
        let result = execute_proxy_with(
            &captured("GET", vec![], None),
            &proxy("https://api.example.com"),
            "https://api.example.com/from",
            &[],
            move |req| {
                calls2.lock().unwrap().push(req.url.clone());
                let hop = calls2.lock().unwrap().len();
                async move {
                    if hop == 1 {
                        Ok(ProxyFetchResponse {
                            status: 302,
                            headers: vec![("location".into(), "/to".into())],
                            body: vec![],
                        })
                    } else {
                        Ok(ok_json())
                    }
                }
            },
        )
        .await;
        assert!(result.ok);
        assert!(result.redirected);
        assert_eq!(calls.lock().unwrap().len(), 2);

        let mut p = proxy("https://api.example.com");
        p.max_redirects = 0;
        let capped = execute_proxy_with(
            &captured("GET", vec![], None),
            &p,
            "https://api.example.com/from",
            &[],
            |_req| async {
                Ok(ProxyFetchResponse {
                    status: 302,
                    headers: vec![("location".into(), "https://api.example.com/to".into())],
                    body: vec![],
                })
            },
        )
        .await;
        assert!(!capped.ok);
        assert_eq!(capped.error.as_deref(), Some("Redirect limit exceeded"));
    }

    #[tokio::test]
    async fn redirect_without_location_is_final() {
        let result = execute_proxy_with(
            &captured("GET", vec![], None),
            &proxy("https://api.example.com"),
            "https://api.example.com/hello",
            &[],
            |_req| async {
                Ok(ProxyFetchResponse {
                    status: 304,
                    headers: vec![("x-trace".into(), "1".into())],
                    body: b"cached".to_vec(),
                })
            },
        )
        .await;
        assert!(result.ok);
        assert_eq!(result.status, 304);
        assert_eq!(result.body, "cached");
        assert!(!result.redirected);
    }

    #[tokio::test]
    async fn empty_location_is_final_not_a_redirect() {
        let calls = Arc::new(Mutex::new(0u32));
        let calls2 = calls.clone();
        let result = execute_proxy_with(
            &captured("GET", vec![], None),
            &proxy("https://api.example.com"),
            "https://api.example.com/hello",
            &[],
            move |_req| {
                *calls2.lock().unwrap() += 1;
                async {
                    Ok(ProxyFetchResponse {
                        status: 302,
                        headers: vec![("location".into(), String::new())],
                        body: b"stay".to_vec(),
                    })
                }
            },
        )
        .await;
        assert!(result.ok);
        assert_eq!(result.status, 302);
        assert_eq!(result.body, "stay");
        assert!(!result.redirected);
        assert_eq!(*calls.lock().unwrap(), 1);
    }

    #[tokio::test]
    async fn strips_length_encoding_even_when_hop_by_hop_off() {
        let mut p = proxy("https://api.example.com");
        p.strip_hop_by_hop = false;
        let result = execute_proxy_with(
            &captured("GET", vec![], None),
            &p,
            "https://api.example.com/hello",
            &[],
            |_req| async { Ok(ok_json()) },
        )
        .await;
        assert!(result.ok);
        assert!(result.headers.iter().any(|(k, _)| k.eq_ignore_ascii_case("connection")));
        assert!(!result.headers.iter().any(|(k, _)| k.eq_ignore_ascii_case("content-length")));
        assert!(!result.headers.iter().any(|(k, _)| k.eq_ignore_ascii_case("transfer-encoding")));
        assert!(!result.headers.iter().any(|(k, _)| k.eq_ignore_ascii_case("content-encoding")));
    }

    #[tokio::test]
    async fn truncates_body_and_surfaces_fetch_error() {
        let mut p = proxy("https://api.example.com");
        p.max_response_bytes = 5;
        let truncated = execute_proxy_with(
            &captured("GET", vec![], None),
            &p,
            "https://api.example.com/hello",
            &[],
            |_req| async {
                Ok(ProxyFetchResponse {
                    status: 200,
                    headers: vec![],
                    body: b"abcdefghij".to_vec(),
                })
            },
        )
        .await;
        assert!(truncated.ok);
        assert_eq!(truncated.body, "abcde");

        let err = execute_proxy_with(
            &captured("GET", vec![], None),
            &proxy("https://api.example.com"),
            "https://api.example.com/hello",
            &[],
            |_req| async { Err("boom".into()) },
        )
        .await;
        assert!(!err.ok);
        assert_eq!(err.error.as_deref(), Some("boom"));
    }
}
