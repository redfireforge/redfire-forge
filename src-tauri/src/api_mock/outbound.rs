//! Outbound URL policy for callbacks (and later proxy): allowlist, SSRF, anti-recursion.

use std::net::{IpAddr, Ipv4Addr, Ipv6Addr};

pub const ANTI_RECURSION_HEADER: &str = "x-redfireforge-mock";

const BLOCKED_METADATA: &[&str] = &[
    "metadata.google.internal",
    "metadata.goog",
    "169.254.169.254",
    "fd00::1",
];

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PolicyCheck {
    pub allowed: bool,
    pub reason: Option<String>,
}

pub fn check_proxy_url(url: &str, allowed_upstreams: &[String], active_ports: &[u16]) -> PolicyCheck {
    let parsed = match reqwest::Url::parse(url) {
        Ok(u) => u,
        Err(_) => {
            return PolicyCheck {
                allowed: false,
                reason: Some(format!("Invalid URL: {url}")),
            };
        }
    };
    let scheme = parsed.scheme();
    if scheme != "http" && scheme != "https" {
        return deny(format!("Unsupported protocol: {scheme}:"));
    }
    let hostname = url_hostname(&parsed);
    if BLOCKED_METADATA.iter().any(|h| *h == hostname) {
        return deny(format!("Blocked metadata host: {hostname}"));
    }
    if let Some(v4) = ipv4_from_hostname(&hostname) {
        // checkProxyUrl PRIVATE_IPV4 includes 127/8; DNS validation treats loopback separately.
        if ipv4_is_private_or_reserved(v4) || v4.is_loopback() {
            return deny(format!("Blocked private IPv4: {hostname}"));
        }
    } else if is_blocked_private_ipv4_host(&hostname) {
        return deny(format!("Blocked private IPv4: {hostname}"));
    }
    if hostname == "::1" || hostname.starts_with("fe80:") {
        return deny(format!("Blocked IPv6 loopback: {hostname}"));
    }

    let port = parsed
        .port()
        .unwrap_or(if scheme == "https" { 443 } else { 80 });
    if is_localhost(&hostname) && active_ports.contains(&port) {
        return deny(format!("Self-recursion: port {port} is an active mock listener"));
    }
    if is_localhost(&hostname) && port == 3001 {
        return deny("Blocked: control plane port 3001".into());
    }

    let port_suffix = parsed.port().map(|p| format!(":{p}")).unwrap_or_default();
    let origin = format!("{scheme}://{hostname}{port_suffix}");
    let allowed = allowed_upstreams
        .iter()
        .any(|u| origin.starts_with(u.as_str()) || url.starts_with(u.as_str()));
    if !allowed {
        return deny(format!("Host not in allowlist: {origin}"));
    }
    PolicyCheck {
        allowed: true,
        reason: None,
    }
}

pub fn add_anti_recursion_header(headers: &mut Vec<(String, String)>) {
    headers.retain(|(k, _)| !k.eq_ignore_ascii_case(ANTI_RECURSION_HEADER));
    headers.push((ANTI_RECURSION_HEADER.into(), "true".into()));
}

const HOP_BY_HOP: &[&str] = &[
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "proxy-connection",
    "te",
    "trailer",
    "transfer-encoding",
    "upgrade",
];

const CREDENTIAL_HEADERS: &[&str] = &[
    "authorization",
    "proxy-authorization",
    "cookie",
    "x-api-key",
    "api-key",
    "x-auth-token",
];

pub fn is_hop_by_hop(name: &str) -> bool {
    HOP_BY_HOP.iter().any(|h| name.eq_ignore_ascii_case(h))
}

pub fn strip_hop_by_hop(headers: &mut Vec<(String, String)>) {
    headers.retain(|(k, _)| !is_hop_by_hop(k));
}

pub fn strip_credential_headers(headers: &mut Vec<(String, String)>, forward_list: &[String]) {
    let allowed: Vec<String> = forward_list.iter().map(|h| h.to_ascii_lowercase()).collect();
    headers.retain(|(k, _)| {
        let lk = k.to_ascii_lowercase();
        !CREDENTIAL_HEADERS.contains(&lk.as_str()) || allowed.iter().any(|a| a == &lk)
    });
}

pub fn strip_set_cookie(headers: &mut Vec<(String, String)>) {
    headers.retain(|(k, _)| !k.eq_ignore_ascii_case("set-cookie"));
}

/// DNS-rebinding / private-IP check. Matches Node `validateServerOutboundUrlWithDns`.
pub async fn validate_outbound_url_with_dns(raw_url: &str) -> Result<(), String> {
    let parsed = validate_outbound_url(raw_url)?;
    let hostname = url_hostname(&parsed);
    let hostname = hostname.strip_suffix('.').unwrap_or(&hostname);
    if should_skip_dns(hostname) {
        return Ok(());
    }
    let port = parsed.port_or_known_default().unwrap_or(80);
    let addrs = tokio::net::lookup_host((hostname, port))
        .await
        .map_err(|e| format!("Outbound fetch DNS resolution failed for host: {hostname}: {e}"))?;
    let addrs: Vec<_> = addrs.collect();
    if addrs.is_empty() {
        return Err(format!(
            "Outbound fetch DNS resolution returned no addresses for host: {hostname}"
        ));
    }
    for addr in addrs {
        reject_resolved(addr.ip(), parsed.scheme())?;
    }
    Ok(())
}

fn validate_outbound_url(raw_url: &str) -> Result<reqwest::Url, String> {
    let parsed = reqwest::Url::parse(raw_url.trim()).map_err(|_| "Invalid outbound fetch URL".to_string())?;
    let scheme = parsed.scheme();
    if scheme != "http" && scheme != "https" {
        return Err("Outbound fetch URL must use http or https".into());
    }
    if !parsed.username().is_empty() || parsed.password().is_some() {
        return Err("Outbound fetch URL must not include embedded credentials".into());
    }
    let hostname = url_hostname(&parsed);
    let hostname = hostname.strip_suffix('.').unwrap_or(&hostname).to_string();
    if hostname == "metadata.google.internal" || hostname == "metadata.goog" {
        return Err(format!("Outbound fetch blocked for host: {hostname}"));
    }
    let local = is_localhost(&hostname) || hostname == "127.0.0.1";
    if scheme == "http" && !local {
        return Err("http:// outbound fetch is allowed only for localhost in dev mode".into());
    }
    if scheme == "https" && (is_ipv4_loopback(&hostname) || is_localhost(&hostname)) {
        return Err("https:// outbound fetch to loopback hosts is not allowed".into());
    }
    if is_grpc_private_ipv4_host(&hostname) && hostname != "127.0.0.1" {
        return Err(format!("Outbound fetch blocked for private network host: {hostname}"));
    }
    if hostname.starts_with('[') || hostname.contains('%') {
        return Err("IPv6 literal hosts are not supported for outbound fetch".into());
    }
    Ok(parsed)
}

fn reject_resolved(ip: IpAddr, scheme: &str) -> Result<(), String> {
    // Node `parseIpv4MappedIpv6`: ::ffff:10.x must be treated as IPv4, not skipped as IPv6.
    let ip = match ip {
        IpAddr::V6(v6) => v6.to_ipv4_mapped().map(IpAddr::V4).unwrap_or(ip),
        other => other,
    };
    match ip {
        IpAddr::V4(v4) => {
            if scheme == "https" && v4.is_loopback() {
                return Err(format!("Outbound fetch DNS resolution blocked loopback address: {ip}"));
            }
            if ipv4_is_private_or_reserved(v4) && v4 != Ipv4Addr::LOCALHOST {
                return Err(format!(
                    "Outbound fetch DNS resolution blocked private network address: {ip}"
                ));
            }
            Ok(())
        }
        IpAddr::V6(v6) => {
            if v6.is_loopback() {
                return Err(format!("Outbound fetch DNS resolution blocked loopback address: {ip}"));
            }
            if is_private_or_reserved_v6(v6) {
                return Err(format!(
                    "Outbound fetch DNS resolution blocked private network address: {ip}"
                ));
            }
            Ok(())
        }
    }
}

/// RFC 1918 + link-local + 0/8. Loopback is handled separately (https-only in DNS).
fn ipv4_is_private_or_reserved(ip: Ipv4Addr) -> bool {
    ip.is_private() || ip.is_link_local() || ip.is_unspecified() || ip.octets()[0] == 0
}

fn url_hostname(parsed: &reqwest::Url) -> String {
    let raw = parsed.host_str().unwrap_or("").to_ascii_lowercase();
    // `Url::host_str` wraps IPv6 in brackets; JS `URL.hostname` does not.
    raw.strip_prefix('[')
        .and_then(|s| s.strip_suffix(']'))
        .unwrap_or(&raw)
        .to_string()
}

fn ipv4_from_hostname(hostname: &str) -> Option<Ipv4Addr> {
    match hostname.parse::<IpAddr>().ok()? {
        IpAddr::V4(v4) => Some(v4),
        IpAddr::V6(v6) => v6.to_ipv4_mapped(),
    }
}

fn is_private_or_reserved_v6(ip: Ipv6Addr) -> bool {
    if ip.is_unspecified() || ip.is_loopback() {
        return true;
    }
    let segs = ip.segments();
    // ULA fc00::/7, link-local fe80::/10
    (segs[0] & 0xfe00) == 0xfc00 || (segs[0] & 0xffc0) == 0xfe80
}

fn should_skip_dns(hostname: &str) -> bool {
    hostname.parse::<Ipv4Addr>().is_ok()
        || hostname.starts_with('[')
        || hostname.contains(':')
        || is_localhost(hostname)
}

fn is_localhost(hostname: &str) -> bool {
    hostname == "localhost"
        || hostname == "127.0.0.1"
        || hostname == "::1"
        || hostname.ends_with(".localhost")
}

fn is_ipv4_loopback(hostname: &str) -> bool {
    hostname
        .parse::<Ipv4Addr>()
        .map(|ip| ip.octets()[0] == 127)
        .unwrap_or(false)
}

fn is_blocked_private_ipv4_host(hostname: &str) -> bool {
    hostname.starts_with("127.") || is_grpc_private_ipv4_host(hostname)
}

/// gRPC `PRIVATE_IPV4_PATTERN` — 10/8, 169.254, 172.16–31, 192.168, 0/8 (not 127).
fn is_grpc_private_ipv4_host(hostname: &str) -> bool {
    if hostname.starts_with("10.")
        || hostname.starts_with("169.254.")
        || hostname.starts_with("192.168.")
        || hostname.starts_with("0.")
    {
        return true;
    }
    let Some(rest) = hostname.strip_prefix("172.") else {
        return false;
    };
    let Some((second, _)) = rest.split_once('.') else {
        return false;
    };
    second
        .parse::<u8>()
        .map(|n| (16..=31).contains(&n))
        .unwrap_or(false)
}

fn deny(reason: String) -> PolicyCheck {
    PolicyCheck {
        allowed: false,
        reason: Some(reason),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::net::IpAddr;

    fn allow(url: &str) -> Vec<String> {
        vec![url.into()]
    }

    #[test]
    fn rejects_allowlist_miss() {
        let r = check_proxy_url(
            "https://hooks.example.com/event",
            &["https://other.example.com/x".into()],
            &[4600],
        );
        assert!(!r.allowed);
        assert!(r.reason.unwrap().contains("allowlist"));
    }

    #[test]
    fn rejects_metadata_host() {
        let r = check_proxy_url("http://169.254.169.254/meta", &allow("http://169.254.169.254/meta"), &[]);
        assert!(!r.allowed);
        assert!(r.reason.unwrap().contains("metadata"));
    }

    #[test]
    fn rejects_private_ipv4() {
        let r = check_proxy_url("http://10.0.0.5/x", &allow("http://10.0.0.5/x"), &[]);
        assert!(!r.allowed);
        assert!(r.reason.unwrap().contains("private IPv4"));
    }

    #[test]
    fn rejects_loopback_ipv4_literal() {
        let r = check_proxy_url("http://127.0.0.1/x", &allow("http://127.0.0.1/x"), &[]);
        assert!(!r.allowed);
        assert!(r.reason.unwrap().contains("private IPv4"));
    }

    #[test]
    fn rejects_mapped_ipv4_private_literal() {
        let r = check_proxy_url(
            "http://[::ffff:10.0.0.5]/x",
            &allow("http://[::ffff:10.0.0.5]/x"),
            &[],
        );
        assert!(!r.allowed, "{:?}", r.reason);
        assert!(r.reason.unwrap().contains("private IPv4"));
    }

    #[test]
    fn rejects_mapped_loopback_literal() {
        let r = check_proxy_url(
            "https://[::ffff:127.0.0.1]/x",
            &allow("https://[::ffff:127.0.0.1]/x"),
            &[],
        );
        assert!(!r.allowed, "{:?}", r.reason);
    }

    #[test]
    fn allows_mapped_public_ipv4() {
        let url = "https://[::ffff:8.8.8.8]/hook";
        let r = check_proxy_url(url, &allow(url), &[]);
        assert!(r.allowed, "{:?}", r.reason);
    }

    #[test]
    fn rejects_localhost_active_mock_port() {
        let r = check_proxy_url(
            "http://localhost:4600/hook",
            &allow("http://localhost:4600/hook"),
            &[4600],
        );
        assert!(!r.allowed);
        assert!(r.reason.unwrap().contains("Self-recursion"));
    }

    #[test]
    fn rejects_ipv6_loopback_literal() {
        let r = check_proxy_url("http://[::1]/test", &allow("http://[::1]/test"), &[]);
        assert!(!r.allowed, "{:?}", r.reason);
        assert!(r.reason.unwrap().contains("IPv6 loopback"));
    }

    #[test]
    fn rejects_control_plane_port() {
        let r = check_proxy_url(
            "http://localhost:3001/x",
            &allow("http://localhost:3001/x"),
            &[],
        );
        assert!(!r.allowed);
        assert!(r.reason.unwrap().contains("3001"));
    }

    #[test]
    fn allows_https_exact_allowlist() {
        let url = "https://hooks.example.com/event";
        let r = check_proxy_url(url, &allow(url), &[4600]);
        assert!(r.allowed, "{:?}", r.reason);
    }

    #[test]
    fn prefix_allowlist_matches_origin() {
        let r = check_proxy_url(
            "https://hooks.example.com/event",
            &["https://hooks.example.com".into()],
            &[],
        );
        assert!(r.allowed, "{:?}", r.reason);
    }

    #[test]
    fn dns_blocks_private_literal() {
        let err = validate_outbound_url("https://10.1.2.3/x").unwrap_err();
        assert!(err.contains("private"), "{err}");
    }

    #[test]
    fn dns_skips_lookup_for_ipv4() {
        // 8.8.8.8 is public; http is still blocked (non-localhost).
        let err = validate_outbound_url("http://8.8.8.8/").unwrap_err();
        assert!(err.contains("localhost"), "{err}");
    }

    #[test]
    fn dns_reject_mapped_private_ipv4() {
        let mapped: IpAddr = "::ffff:10.1.2.3".parse().unwrap();
        let err = reject_resolved(mapped, "https").unwrap_err();
        assert!(err.contains("private"), "{err}");
    }

    #[test]
    fn dns_allows_mapped_public_ipv4() {
        let mapped: IpAddr = "::ffff:8.8.8.8".parse().unwrap();
        reject_resolved(mapped, "https").expect("public mapped IPv4 must pass");
    }

    #[test]
    fn dns_https_blocks_mapped_loopback() {
        let mapped: IpAddr = "::ffff:127.0.0.1".parse().unwrap();
        let err = reject_resolved(mapped, "https").unwrap_err();
        assert!(err.contains("loopback"), "{err}");
    }

    #[test]
    fn strips_hop_by_hop_headers() {
        let mut h = vec![
            ("Connection".into(), "keep-alive".into()),
            ("X-Trace".into(), "1".into()),
            ("Transfer-Encoding".into(), "chunked".into()),
        ];
        strip_hop_by_hop(&mut h);
        assert_eq!(h, vec![("X-Trace".into(), "1".into())]);
    }

    #[test]
    fn strips_credentials_unless_forwarded() {
        let mut h = vec![
            ("Authorization".into(), "Bearer x".into()),
            ("X-Trace".into(), "1".into()),
            ("Cookie".into(), "a=1".into()),
        ];
        strip_credential_headers(&mut h, &[]);
        assert_eq!(h, vec![("X-Trace".into(), "1".into())]);

        let mut h = vec![
            ("Authorization".into(), "Bearer x".into()),
            ("Cookie".into(), "a=1".into()),
        ];
        strip_credential_headers(&mut h, &["cookie".into()]);
        assert_eq!(h, vec![("Cookie".into(), "a=1".into())]);
    }

    #[test]
    fn strips_set_cookie() {
        let mut h = vec![
            ("Set-Cookie".into(), "session=abc".into()),
            ("Content-Type".into(), "application/json".into()),
        ];
        strip_set_cookie(&mut h);
        assert_eq!(h.len(), 1);
        assert_eq!(h[0].0, "Content-Type");
    }
}
