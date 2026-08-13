//! Bounded in-memory journal (newest retained) with optional persistToDisk snapshots.

use crate::api_mock::types::ServerSettings;
use serde_json::{json, Value};
use sha1::{Digest, Sha1};
use std::fs;
use std::path::PathBuf;

pub struct Journal {
    entries: Vec<Value>,
    cursor: u64,
    max_entries: usize,
    max_body_bytes: usize,
    enabled: bool,
    drops: u64,
    truncations: u64,
    redaction_headers: Vec<String>,
    redaction_json_paths: Vec<String>,
    preserve_scheme: bool,
    server_id: String,
    persist_file: Option<PathBuf>,
}

impl Journal {
    #[cfg(test)]
    pub fn new(settings: &ServerSettings) -> Self {
        Self::for_server(settings, "")
    }

    pub fn for_server(settings: &ServerSettings, server_id: &str) -> Self {
        let persist_file = if settings.journal.persist_to_disk && !server_id.is_empty() {
            Some(persist_path(server_id))
        } else {
            None
        };
        let mut journal = Self {
            entries: Vec::new(),
            cursor: 0,
            max_entries: settings.journal.max_entries.min(500),
            max_body_bytes: settings.journal.max_captured_body_bytes,
            enabled: settings.journal.enabled,
            drops: 0,
            truncations: 0,
            redaction_headers: settings
                .redaction
                .header_names
                .iter()
                .map(|h| h.to_ascii_lowercase())
                .collect(),
            redaction_json_paths: settings.redaction.json_paths.clone(),
            preserve_scheme: settings.redaction.preserve_scheme,
            server_id: server_id.to_string(),
            persist_file: persist_file.clone(),
        };
        if persist_file.is_some() && journal.enabled && journal.max_entries > 0 {
            journal.restore();
        }
        journal
    }

    pub fn update_settings(&mut self, settings: &ServerSettings) {
        let journal_enabling = settings.journal.enabled && !self.enabled;
        let next_persist = settings.journal.persist_to_disk && !self.server_id.is_empty();
        let persist_enabling = next_persist && self.persist_file.is_none();
        self.max_entries = settings.journal.max_entries.min(500);
        self.max_body_bytes = settings.journal.max_captured_body_bytes;
        self.enabled = settings.journal.enabled;
        self.redaction_headers = settings
            .redaction
            .header_names
            .iter()
            .map(|h| h.to_ascii_lowercase())
            .collect();
        self.redaction_json_paths = settings.redaction.json_paths.clone();
        self.preserve_scheme = settings.redaction.preserve_scheme;
        self.persist_file = if next_persist {
            Some(persist_path(&self.server_id))
        } else {
            None
        };
        while self.entries.len() > self.max_entries && self.max_entries > 0 {
            self.entries.remove(0);
            self.drops += 1;
        }
        if next_persist
            && self.enabled
            && self.entries.is_empty()
            && self.max_entries > 0
            && (persist_enabling || journal_enabling)
        {
            self.restore();
            return;
        }
        self.flush();
    }

    pub fn append(&mut self, mut tx: Value) {
        self.cursor += 1;
        if !self.enabled || self.max_entries == 0 {
            return;
        }
        if tx
            .get("id")
            .and_then(|v| v.as_str())
            .is_none_or(|s| s.is_empty())
        {
            tx["id"] = json!(format!("tx-{}", self.cursor));
        }
        self.redact(&mut tx);
        self.truncate(&mut tx, true);
        if self.entries.len() >= self.max_entries {
            self.entries.remove(0);
            self.drops += 1;
        }
        self.entries.push(tx);
        self.flush();
    }

    pub fn query(&self, limit: Option<usize>, after_cursor: Option<u64>) -> Value {
        let cap = match limit {
            Some(n) if n > 0 => n.min(500),
            _ => 500,
        };
        let start = after_cursor.unwrap_or(0) as usize;
        if start >= self.entries.len() {
            return json!({
                "transactions": [],
                "cursor": self.cursor,
                "total": self.entries.len(),
                "capped": self.max_entries > 0 && self.entries.len() >= self.max_entries,
            });
        }
        let end = (start + cap).min(self.entries.len());
        json!({
            "transactions": self.entries[start..end].to_vec(),
            "cursor": self.cursor,
            "total": self.entries.len(),
            "capped": self.max_entries > 0 && self.entries.len() >= self.max_entries,
        })
    }

    pub fn clear(&mut self) {
        self.entries.clear();
        self.drops = 0;
        self.truncations = 0;
        self.flush();
    }

    pub fn stats(&self) -> Value {
        json!({
            "drops": self.drops,
            "truncations": self.truncations,
            "size": self.entries.len(),
            "maxEntries": self.max_entries,
        })
    }

    fn restore(&mut self) {
        if self.max_entries == 0 {
            return;
        }
        let Some(path) = &self.persist_file else { return };
        let Ok(raw) = fs::read_to_string(path) else { return };
        let Ok(parsed) = serde_json::from_str::<Value>(&raw) else { return };
        let Some(cursor) = json_non_neg_int(parsed.get("cursor")) else { return };
        let Some(txs) = parsed.get("transactions").and_then(|v| v.as_array()) else { return };
        self.drops = json_non_neg_int(parsed.get("drops")).unwrap_or(0);
        self.truncations = json_non_neg_int(parsed.get("truncations")).unwrap_or(0);
        self.entries = txs.iter().cloned().filter(is_persistable).collect();
        if self.max_entries > 0 && self.entries.len() > self.max_entries {
            let extra = self.entries.len() - self.max_entries;
            self.entries.drain(0..extra);
        }
        self.cursor = cursor.max(self.entries.len() as u64);
        for i in 0..self.entries.len() {
            let mut tx = self.entries[i].clone();
            self.redact(&mut tx);
            self.truncate(&mut tx, false);
            self.entries[i] = tx;
        }
        self.flush();
    }

    fn flush(&self) {
        let Some(path) = &self.persist_file else { return };
        if let Some(dir) = path.parent() {
            let _ = fs::create_dir_all(dir);
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                let _ = fs::set_permissions(dir, fs::Permissions::from_mode(0o700));
            }
        }
        let snapshot = json!({
            "cursor": self.cursor,
            "transactions": self.entries,
            "drops": self.drops,
            "truncations": self.truncations,
        });
        let tmp = PathBuf::from(format!("{}.tmp", path.display()));
        if fs::write(&tmp, snapshot.to_string()).is_ok() {
            let _ = fs::rename(&tmp, path);
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                let _ = fs::set_permissions(path, fs::Permissions::from_mode(0o600));
            }
        }
    }

    #[cfg(test)]
    fn with_file(settings: &ServerSettings, path: PathBuf) -> Self {
        let mut journal = Self::new(settings);
        journal.server_id = "persist-test".into();
        journal.persist_file = Some(path);
        journal.restore();
        journal
    }

    fn redact(&self, tx: &mut Value) {
        if let Some(req) = tx.get_mut("request") {
            self.redact_header_map(req.get_mut("headers"));
            if self.redaction_headers.iter().any(|h| h == "cookie") {
                if let Some(Value::Object(cookies)) = req.get_mut("cookies") {
                    for v in cookies.values_mut() {
                        *v = json!("[REDACTED]");
                    }
                }
            }
            self.redact_json_body(req.get_mut("body"));
        }
        if let Some(res) = tx.get_mut("response") {
            self.redact_header_map(res.get_mut("headers"));
            self.redact_json_body(res.get_mut("body"));
        }
    }

    fn redact_header_map(&self, headers: Option<&mut Value>) {
        let Some(Value::Object(map)) = headers else {
            return;
        };
        let keys: Vec<String> = map.keys().cloned().collect();
        for key in keys {
            if !self.redaction_headers.iter().any(|h| h == &key.to_ascii_lowercase()) {
                continue;
            }
            if let Some(Value::Array(vals)) = map.get_mut(&key) {
                for v in vals.iter_mut() {
                    let raw = v.as_str().unwrap_or("").to_string();
                    *v = json!(self.redact_header_value(&key, &raw));
                }
            }
        }
    }

    fn redact_header_value(&self, key: &str, value: &str) -> String {
        let header = key.to_ascii_lowercase();
        if self.preserve_scheme && (header == "authorization" || header == "proxy-authorization") {
            if let Some(idx) = value.find(' ') {
                return format!("{} [REDACTED]", &value[..idx]);
            }
        }
        "[REDACTED]".into()
    }

    fn redact_json_body(&self, slot: Option<&mut Value>) {
        if self.redaction_json_paths.is_empty() {
            return;
        }
        let Some(Value::String(body)) = slot else {
            return;
        };
        let Ok(mut parsed) = serde_json::from_str::<Value>(body) else {
            return;
        };
        if !parsed.is_object() {
            return;
        }
        let mut changed = false;
        for path in &self.redaction_json_paths {
            if path.contains('[') {
                continue;
            }
            if set_dotted_path(&mut parsed, path, json!("[REDACTED]")) {
                changed = true;
            }
        }
        if changed {
            if let Ok(next) = serde_json::to_string(&parsed) {
                *body = next;
            }
        }
    }

    fn truncate(&mut self, tx: &mut Value, count: bool) {
        let mut truncated = false;
        truncated |= Self::truncate_body(tx.pointer_mut("/request/body"), self.max_body_bytes);
        if truncated {
            if let Some(req) = tx.get_mut("request") {
                req["bodyTruncated"] = json!(true);
            }
        }
        let res_trunc = Self::truncate_body(tx.pointer_mut("/response/body"), self.max_body_bytes);
        if res_trunc {
            if let Some(res) = tx.get_mut("response") {
                res["bodyTruncated"] = json!(true);
            }
        }
        if count && (truncated || res_trunc) {
            self.truncations += 1;
        }
    }

    fn truncate_body(slot: Option<&mut Value>, max: usize) -> bool {
        let Some(Value::String(body)) = slot else {
            return false;
        };
        if body.len() <= max {
            return false;
        }
        let mut end = max;
        while end > 0 && !body.is_char_boundary(end) {
            end -= 1;
        }
        body.truncate(end);
        true
    }
}

fn set_dotted_path(root: &mut Value, path: &str, val: Value) -> bool {
    let trimmed = path
        .trim()
        .trim_start_matches("$.")
        .trim_start_matches('$');
    let parts: Vec<&str> = trimmed.split('.').filter(|p| !p.is_empty()).collect();
    if parts.is_empty() {
        return false;
    }
    let mut cur = root;
    for (i, part) in parts.iter().enumerate() {
        if i + 1 == parts.len() {
            let Value::Object(map) = cur else {
                return false;
            };
            if !map.contains_key(*part) {
                return false;
            }
            map.insert((*part).to_string(), val);
            return true;
        }
        cur = match cur {
            Value::Object(map) => match map.get_mut(*part) {
                Some(next) => next,
                None => return false,
            },
            _ => return false,
        };
    }
    false
}

fn persist_path(server_id: &str) -> PathBuf {
    let digest = hex::encode(Sha1::digest(server_id.as_bytes()));
    let hash = &digest[..10.min(digest.len())];
    let mut safe: String = String::new();
    for c in server_id.chars() {
        if c.is_ascii_alphanumeric() || matches!(c, '.' | '_' | '-') {
            safe.push(c);
        } else if !safe.ends_with('_') {
            safe.push('_');
        }
    }
    while safe.contains("..") {
        safe = safe.replace("..", "_");
    }
    if safe.len() > 60 {
        safe.truncate(60);
    }
    if safe.is_empty() {
        safe = "server".to_string();
    }
    std::env::temp_dir()
        .join("redfireforge-api-mock-journals")
        .join(format!("{safe}-{hash}.json"))
}

fn json_non_neg_int(value: Option<&Value>) -> Option<u64> {
    let value = value?;
    if let Some(n) = value.as_u64() {
        return Some(n);
    }
    if let Some(n) = value.as_i64() {
        return u64::try_from(n).ok();
    }
    let n = value.as_f64()?;
    if n.is_finite() && n >= 0.0 {
        Some(n.floor() as u64)
    } else {
        None
    }
}

fn is_persistable(tx: &Value) -> bool {
    tx.get("id").and_then(|v| v.as_str()).is_some_and(|s| !s.is_empty())
        && tx.get("request").and_then(|r| r.get("method")).and_then(|v| v.as_str()).is_some()
        && tx.get("request").and_then(|r| r.get("path")).and_then(|v| v.as_str()).is_some()
        && tx
            .get("request")
            .and_then(|r| r.get("headers"))
            .is_some_and(|h| h.is_object())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::api_mock::types::ServerSettings;

    fn settings() -> ServerSettings {
        let mut s = ServerSettings::default();
        s.journal.max_entries = 3;
        s.redaction.header_names = vec!["authorization".into()];
        s
    }

    #[test]
    fn ring_evicts_oldest_and_redacts() {
        let mut j = Journal::new(&settings());
        for i in 0..4 {
            j.append(json!({
                "request": { "headers": { "authorization": ["Bearer secret"] }, "body": format!("{i}") },
                "response": { "body": "ok" },
            }));
        }
        let page = j.query(None, None);
        assert_eq!(page["transactions"].as_array().unwrap().len(), 3);
        assert_eq!(page["transactions"][0]["request"]["headers"]["authorization"][0], "Bearer [REDACTED]");
        assert!(j.stats()["drops"].as_u64().unwrap() >= 1);
    }

    #[test]
    fn after_cursor_past_end_is_empty() {
        let mut j = Journal::new(&settings());
        j.append(json!({ "request": {}, "response": {} }));
        let page = j.query(Some(500), Some(99));
        assert!(page["transactions"].as_array().unwrap().is_empty());
    }

    #[test]
    fn invalid_limit_uses_ceiling() {
        let mut j = Journal::new(&settings());
        j.append(json!({ "request": {}, "response": {} }));
        let page = j.query(Some(0), None);
        assert_eq!(page["transactions"].as_array().unwrap().len(), 1);
    }

    #[test]
    fn redacts_configured_json_paths() {
        let mut s = settings();
        s.redaction.json_paths = vec!["$.secret".into()];
        let mut j = Journal::new(&s);
        j.append(json!({
            "request": { "headers": {}, "body": "{\"secret\":\"token\",\"ok\":true}" },
            "response": { "body": "ok" },
        }));
        let page = j.query(None, None);
        let req_body = page["transactions"][0]["request"]["body"].as_str().unwrap();
        assert!(req_body.contains("[REDACTED]"), "{req_body}");
        assert!(!req_body.contains("token"), "{req_body}");
    }

    #[test]
    fn flags_truncated_bodies() {
        let mut s = settings();
        s.journal.max_captured_body_bytes = 8;
        let mut j = Journal::new(&s);
        j.append(json!({
            "request": { "headers": {}, "body": "short" },
            "response": { "body": "ABCDEFGHIJKLMNOP" },
        }));
        let tx = &j.query(None, None)["transactions"][0];
        assert_eq!(tx["response"]["bodyTruncated"], true);
        assert!(j.stats()["truncations"].as_u64().unwrap() >= 1);
    }

    #[test]
    fn truncate_does_not_panic_on_multibyte_boundary() {
        let mut s = settings();
        s.journal.max_captured_body_bytes = 3;
        let mut j = Journal::new(&s);
        j.append(json!({
            "request": { "headers": {}, "body": "éééé" },
            "response": { "body": "ok" },
        }));
        let page = j.query(None, None);
        let body = page["transactions"][0]["request"]["body"]
            .as_str()
            .unwrap();
        assert!(body.len() <= 3);
        assert!(j.stats()["truncations"].as_u64().unwrap() >= 1);
    }

    #[test]
    fn persist_round_trip() {
        let dir = std::env::temp_dir().join(format!("am-j-{}", uuid::Uuid::new_v4()));
        let _ = fs::create_dir_all(&dir);
        let path = dir.join("srv.json");
        let mut s = settings();
        s.journal.persist_to_disk = true;
        {
            let mut j = Journal::with_file(&s, path.clone());
            j.append(json!({
                "id": "tx-1",
                "request": { "method": "GET", "path": "/p", "headers": {} },
                "response": { "body": "ok" },
            }));
        }
        let restored = Journal::with_file(&s, path.clone());
        let page = restored.query(None, None);
        assert_eq!(page["transactions"].as_array().unwrap().len(), 1);
        assert_eq!(page["transactions"][0]["id"], "tx-1");
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn persist_path_matches_node_sanitization() {
        let path = persist_path("srv/../evil id!");
        let name = path.file_name().unwrap().to_string_lossy();
        assert!(name.starts_with("srv___evil_id_-"), "{name}");
        assert!(name.ends_with(".json"));
        assert_ne!(persist_path("foo/bar"), persist_path("foo_bar"));
        assert!(persist_path("").file_name().unwrap().to_string_lossy().starts_with("server-"));
    }

    #[test]
    fn restore_rejects_snapshot_without_cursor_and_skips_headerless_rows() {
        let dir = std::env::temp_dir().join(format!("am-j-{}", uuid::Uuid::new_v4()));
        let _ = fs::create_dir_all(&dir);
        let path = dir.join("srv.json");
        fs::write(
            &path,
            r#"{"transactions":[{"id":"tx-1","request":{"method":"GET","path":"/p"}}]}"#,
        )
        .unwrap();
        let mut s = settings();
        s.journal.persist_to_disk = true;
        let restored = Journal::with_file(&s, path.clone());
        assert!(restored.query(None, None)["transactions"].as_array().unwrap().is_empty());

        fs::write(
            &path,
            r#"{"cursor":1,"transactions":[{"id":"tx-1","request":{"method":"GET","path":"/p","headers":{}}},{"id":"bad","request":{"method":"GET","path":"/x"}}]}"#,
        )
        .unwrap();
        let restored = Journal::with_file(&s, path.clone());
        let page = restored.query(None, None);
        assert_eq!(page["transactions"].as_array().unwrap().len(), 1);
        assert_eq!(page["transactions"][0]["id"], "tx-1");
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn restore_cursor_is_at_least_row_count() {
        let dir = std::env::temp_dir().join(format!("am-j-{}", uuid::Uuid::new_v4()));
        let _ = fs::create_dir_all(&dir);
        let path = dir.join("srv.json");
        fs::write(
            &path,
            r#"{"cursor":1,"transactions":[{"id":"a","request":{"method":"GET","path":"/a","headers":{}}},{"id":"b","request":{"method":"GET","path":"/b","headers":{}}},{"id":"c","request":{"method":"GET","path":"/c","headers":{}}}]}"#,
        )
        .unwrap();
        let mut s = settings();
        s.journal.persist_to_disk = true;
        let mut restored = Journal::with_file(&s, path.clone());
        restored.append(json!({
            "request": { "method": "GET", "path": "/d", "headers": {} },
            "response": { "body": "ok" },
        }));
        let page = restored.query(None, None);
        assert_eq!(page["transactions"].as_array().unwrap().len(), 3);
        assert_eq!(page["cursor"], 4);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn raising_max_entries_does_not_reload_disk_into_an_empty_journal() {
        let dir = std::env::temp_dir().join(format!("am-j-{}", uuid::Uuid::new_v4()));
        let _ = fs::create_dir_all(&dir);
        let path = dir.join("srv.json");
        fs::write(
            &path,
            r#"{"cursor":9,"transactions":[{"id":"old","request":{"method":"GET","path":"/old","headers":{}}}]}"#,
        )
        .unwrap();
        let mut s = settings();
        s.journal.persist_to_disk = true;
        s.journal.max_entries = 0;
        let mut journal = Journal::with_file(&s, path.clone());
        s.journal.max_entries = 5;
        journal.update_settings(&s);
        assert!(journal.query(None, None)["transactions"].as_array().unwrap().is_empty());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn enabling_persist_on_empty_journal_restores_disk() {
        let server_id = format!("persist-enable-{}", uuid::Uuid::new_v4());
        let path = persist_path(&server_id);
        if let Some(dir) = path.parent() {
            let _ = fs::create_dir_all(dir);
        }
        fs::write(
            &path,
            r#"{"cursor":4,"transactions":[{"id":"tx-disk","request":{"method":"GET","path":"/p","headers":{}}}]}"#,
        )
        .unwrap();
        let mut off = settings();
        off.journal.persist_to_disk = false;
        let mut journal = Journal::for_server(&off, &server_id);
        assert!(journal.query(None, None)["transactions"].as_array().unwrap().is_empty());
        let mut on = settings();
        on.journal.persist_to_disk = true;
        journal.update_settings(&on);
        let page = journal.query(None, None);
        assert_eq!(page["transactions"].as_array().unwrap().len(), 1);
        assert_eq!(page["transactions"][0]["id"], "tx-disk");
        let _ = fs::remove_file(&path);
    }
}
