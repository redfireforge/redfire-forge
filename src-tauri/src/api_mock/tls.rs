//! rustls server config from PEM (HTTPS + optional mTLS).
//! TLS advertises `h2` then `http/1.1` (ALPN). Plaintext listeners stay HTTP/1.1 (no h2c).

use crate::api_mock::types::TlsSettings;
use rustls::pki_types::{CertificateDer, PrivateKeyDer};
use rustls::server::WebPkiClientVerifier;
use rustls::{RootCertStore, ServerConfig};
use std::io::Cursor;
use std::sync::Arc;

pub fn build_server_config(tls: &TlsSettings) -> Result<Arc<ServerConfig>, String> {
    let _ = rustls::crypto::ring::default_provider().install_default();
    let certs = load_certs(&tls.cert_pem)?;
    let key = load_key(&tls.key_pem, tls.passphrase.as_deref())?;
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
    config.alpn_protocols = vec![b"h2".to_vec(), b"http/1.1".to_vec()];
    Ok(Arc::new(config))
}

fn load_certs(pem: &str) -> Result<Vec<CertificateDer<'static>>, String> {
    let mut cursor = Cursor::new(pem.as_bytes());
    rustls_pemfile::certs(&mut cursor)
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("TLS material rejected: {e}"))
}

fn load_key(pem: &str, passphrase: Option<&str>) -> Result<PrivateKeyDer<'static>, String> {
    if let Some(pass) = passphrase.filter(|p| !p.is_empty()) {
        match openssl::pkey::PKey::private_key_from_pem_passphrase(pem.as_bytes(), pass.as_bytes()) {
            Ok(key) => return openssl_key_to_der(key),
            Err(encrypted_err) => {
                if let Ok(key) = load_unencrypted_key(pem) {
                    return Ok(key);
                }
                return Err(format!("TLS material rejected: {encrypted_err}"));
            }
        }
    }
    load_unencrypted_key(pem)
}

fn openssl_key_to_der(
    key: openssl::pkey::PKey<openssl::pkey::Private>,
) -> Result<PrivateKeyDer<'static>, String> {
    let pem = key
        .private_key_to_pem_pkcs8()
        .map_err(|e| format!("TLS material rejected: {e}"))?;
    let pem_str = String::from_utf8(pem).map_err(|e| format!("TLS material rejected: {e}"))?;
    load_unencrypted_key(&pem_str)
}

fn load_unencrypted_key(pem: &str) -> Result<PrivateKeyDer<'static>, String> {
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
pub(crate) fn test_self_signed_pem() -> (String, String) {
    test_self_signed_pem_with_passphrase(None)
}

#[cfg(test)]
fn test_self_signed_pem_with_passphrase(passphrase: Option<&str>) -> (String, String) {
    use openssl::asn1::Asn1Time;
    use openssl::bn::BigNum;
    use openssl::hash::MessageDigest;
    use openssl::nid::Nid;
    use openssl::pkey::PKey;
    use openssl::rsa::Rsa;
    use openssl::symm::Cipher;
    use openssl::x509::{X509NameBuilder, X509};

    let rsa = Rsa::generate(2048).unwrap();
    let pkey = PKey::from_rsa(rsa).unwrap();
    let mut name = X509NameBuilder::new().unwrap();
    name.append_entry_by_nid(Nid::COMMONNAME, "localhost").unwrap();
    let name = name.build();
    let mut builder = X509::builder().unwrap();
    builder.set_version(2).unwrap();
    let serial = BigNum::from_u32(1).unwrap().to_asn1_integer().unwrap();
    builder.set_serial_number(&serial).unwrap();
    builder.set_subject_name(&name).unwrap();
    builder.set_issuer_name(&name).unwrap();
    builder.set_pubkey(&pkey).unwrap();
    builder
        .set_not_before(Asn1Time::days_from_now(0).unwrap().as_ref())
        .unwrap();
    builder
        .set_not_after(Asn1Time::days_from_now(1).unwrap().as_ref())
        .unwrap();
    builder.sign(&pkey, MessageDigest::sha256()).unwrap();
    let cert_pem = String::from_utf8(builder.build().to_pem().unwrap()).unwrap();
    let key_pem = match passphrase {
        Some(pass) => String::from_utf8(
            pkey.private_key_to_pem_pkcs8_passphrase(Cipher::aes_256_cbc(), pass.as_bytes())
                .unwrap(),
        )
        .unwrap(),
        None => String::from_utf8(pkey.private_key_to_pem_pkcs8().unwrap()).unwrap(),
    };
    (cert_pem, key_pem)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::api_mock::types::TlsSettings;

    fn sample_tls(passphrase: Option<&str>) -> (String, String) {
        test_self_signed_pem_with_passphrase(passphrase)
    }

    #[test]
    fn advertises_h2_then_http11() {
        let (cert_pem, key_pem) = sample_tls(None);
        let tls = TlsSettings {
            enabled: true,
            cert_pem,
            key_pem,
            ..Default::default()
        };
        let config = build_server_config(&tls).expect("tls");
        assert_eq!(
            config.alpn_protocols,
            vec![b"h2".to_vec(), b"http/1.1".to_vec()]
        );
    }

    #[test]
    fn passphrase_protected_key_loads() {
        let (cert_pem, key_pem) = sample_tls(Some("secret"));
        let tls = TlsSettings {
            enabled: true,
            cert_pem,
            key_pem,
            passphrase: Some("secret".into()),
            ..Default::default()
        };
        build_server_config(&tls).expect("encrypted PEM should load with the passphrase");
    }

    #[test]
    fn wrong_passphrase_is_rejected() {
        let (cert_pem, key_pem) = sample_tls(Some("secret"));
        let tls = TlsSettings {
            enabled: true,
            cert_pem,
            key_pem,
            passphrase: Some("nope".into()),
            ..Default::default()
        };
        let err = build_server_config(&tls).unwrap_err();
        assert!(err.contains("TLS material rejected"), "{err}");
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
