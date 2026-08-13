//! rustls server config from PEM (HTTPS + optional mTLS). HTTP/2 is not enabled.

use crate::api_mock::types::TlsSettings;
use rustls::pki_types::{CertificateDer, PrivateKeyDer};
use rustls::server::WebPkiClientVerifier;
use rustls::{RootCertStore, ServerConfig};
use std::io::Cursor;
use std::sync::Arc;

pub fn build_server_config(tls: &TlsSettings) -> Result<Arc<ServerConfig>, String> {
    if tls.passphrase.as_deref().is_some_and(|p| !p.is_empty()) {
        return Err("Passphrase-protected TLS keys are not supported on the native listener.".into());
    }
    let certs = load_certs(&tls.cert_pem)?;
    let key = load_key(&tls.key_pem)?;
    let builder = if tls.mtls.as_ref().is_some_and(|m| m.enabled) {
        let ca = tls
            .mtls
            .as_ref()
            .map(|m| m.client_ca_pem.as_str())
            .unwrap_or("");
        if ca.trim().is_empty() {
            return Err("Client certificates are required but no client CA is configured.".into());
        }
        let mut roots = RootCertStore::empty();
        let ca_certs = load_certs(ca)?;
        for c in ca_certs {
            roots
                .add(c)
                .map_err(|e| format!("invalid client CA: {e}"))?;
        }
        let verifier = WebPkiClientVerifier::builder(Arc::new(roots))
            .build()
            .map_err(|e| format!("mTLS verifier: {e}"))?;
        ServerConfig::builder()
            .with_client_cert_verifier(verifier)
            .with_single_cert(certs, key)
    } else {
        ServerConfig::builder()
            .with_no_client_auth()
            .with_single_cert(certs, key)
    };
    let mut config = builder.map_err(|e| format!("TLS material rejected: {e}"))?;
    config.alpn_protocols = vec![b"http/1.1".to_vec()];
    Ok(Arc::new(config))
}

fn load_certs(pem: &str) -> Result<Vec<CertificateDer<'static>>, String> {
    let mut cursor = Cursor::new(pem.as_bytes());
    rustls_pemfile::certs(&mut cursor)
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("TLS material rejected: {e}"))
}

fn load_key(pem: &str) -> Result<PrivateKeyDer<'static>, String> {
    let mut cursor = Cursor::new(pem.as_bytes());
    let keys = rustls_pemfile::private_key(&mut cursor)
        .map_err(|e| format!("TLS material rejected: {e}"))?;
    keys.ok_or_else(|| "TLS is enabled but no certificate and key are configured.".into())
}

/// Extract `CN=...` from a DER certificate for `certSubject` matching.
pub fn cert_subject_cn(der: &[u8]) -> Option<String> {
    let needle = [0x06, 0x03, 0x55, 0x04, 0x03];
    let mut i = 0;
    while i + 5 < der.len() {
        if der[i..].starts_with(&needle) {
            let rest = &der[i + 5..];
            if rest.len() >= 2 {
                let tag = rest[0];
                let len = rest[1] as usize;
                if matches!(tag, 0x0c | 0x13 | 0x16) && rest.len() >= 2 + len {
                    let cn = String::from_utf8_lossy(&rest[2..2 + len]).trim().to_string();
                    if !cn.is_empty() {
                        return Some(format!("CN={cn}"));
                    }
                }
            }
        }
        i += 1;
    }
    None
}

pub fn cert_fingerprint_sha256(der: &[u8]) -> String {
    use sha2::{Digest, Sha256};
    hex::encode(Sha256::digest(der))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::api_mock::types::TlsSettings;

    #[test]
    fn passphrase_is_rejected() {
        let tls = TlsSettings {
            enabled: true,
            passphrase: Some("secret".into()),
            ..Default::default()
        };
        let err = build_server_config(&tls).unwrap_err();
        assert!(err.contains("Passphrase-protected"));
    }

    #[test]
    fn missing_key_is_rejected() {
        let tls = TlsSettings {
            enabled: true,
            cert_pem: "not-a-cert".into(),
            key_pem: String::new(),
            ..Default::default()
        };
        assert!(build_server_config(&tls).is_err());
    }
}
