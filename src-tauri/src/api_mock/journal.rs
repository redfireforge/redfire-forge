//! Bounded in-memory journal (newest retained; persistToDisk is a native gap).

use crate::api_mock::types::ServerSettings;
use serde_json::{json, Value};

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
}

impl Journal {
    pub fn new(settings: &ServerSettings) -> Self {
        Self {
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
        }
    }

    pub fn update_settings(&mut self, settings: &ServerSettings) {
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
        while self.entries.len() > self.max_entries && self.max_entries > 0 {
            self.entries.remove(0);
            self.drops += 1;
        }
    }

    pub fn append(&mut self, mut tx: Value) {
        self.cursor += 1;
        if !self.enabled || self.max_entries == 0 {
            return;
        }
        tx["id"] = json!(format!("tx-{}", self.cursor));
        self.redact(&mut tx);
        self.truncate(&mut tx);
        if self.entries.len() >= self.max_entries {
            self.entries.remove(0);
            self.drops += 1;
        }
        self.entries.push(tx);
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
    }

    pub fn stats(&self) -> Value {
        json!({
            "drops": self.drops,
            "truncations": self.truncations,
            "size": self.entries.len(),
            "maxEntries": self.max_entries,
        })
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

    fn truncate(&mut self, tx: &mut Value) {
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
        if truncated || res_trunc {
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
        body.truncate(max);
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
}
