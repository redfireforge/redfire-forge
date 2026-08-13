//! Native listener pool keyed by server id (port ownership + lifecycle).

use crate::api_mock::capabilities::native_capability_warnings;
use crate::api_mock::journal::Journal;
use crate::api_mock::listener::{spawn_listener, ListenerShared};
use crate::api_mock::tls::build_server_config;
use crate::api_mock::types::ServerDefinition;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::net::{IpAddr, Ipv4Addr, SocketAddr};
use std::sync::{Arc, Mutex};
use tokio::task::JoinHandle;
use tokio_util::sync::CancellationToken;

#[derive(Debug)]
pub struct NativeError {
    pub code: String,
    pub message: String,
}

impl NativeError {
    fn new(code: &str, message: impl Into<String>) -> Self {
        Self {
            code: code.into(),
            message: message.into(),
        }
    }
}

struct NativeEntry {
    port: u16,
    running: bool,
    shared: Arc<Mutex<ListenerShared>>,
    stop: CancellationToken,
    task: Option<JoinHandle<()>>,
}

pub struct ApiMockNativeState {
    inner: Mutex<HashMap<String, NativeEntry>>,
}

impl ApiMockNativeState {
    pub fn new() -> Self {
        Self {
            inner: Mutex::new(HashMap::new()),
        }
    }

    pub fn shutdown_all(&self) {
        let mut map = self.inner.lock().unwrap_or_else(|e| e.into_inner());
        for entry in map.values_mut() {
            entry.stop.cancel();
            if let Some(task) = entry.task.take() {
                task.abort();
            }
            entry.running = false;
            if let Ok(mut g) = entry.shared.lock() {
                g.running = false;
            }
        }
    }

    pub async fn start(&self, def: ServerDefinition) -> Result<Value, NativeError> {
        self.start_inner(def, false).await
    }

    pub async fn restart(&self, def: ServerDefinition) -> Result<Value, NativeError> {
        let _ = self.stop(&def.id).await;
        self.start_inner(def, true).await
    }

    async fn start_inner(&self, def: ServerDefinition, replacing: bool) -> Result<Value, NativeError> {
        if def.id.trim().is_empty() {
            return Err(NativeError::new(
                "MOCK_VALIDATION_ERROR",
                "Server definition with id is required",
            ));
        }
        if def.settings.tls.as_ref().is_some_and(|t| t.enabled)
            && def
                .settings
                .tls
                .as_ref()
                .and_then(|t| t.passphrase.as_deref())
                .is_some_and(|p| !p.is_empty())
        {
            return Err(NativeError::new(
                "MOCK_VALIDATION_ERROR",
                "Passphrase-protected TLS keys are not supported on the native listener.",
            ));
        }

        {
            let map = self.inner.lock().unwrap_or_else(|e| e.into_inner());
            if !replacing {
                if let Some(existing) = map.get(&def.id) {
                    if existing.running {
                        return Err(NativeError::new(
                            "MOCK_RUNTIME_ERROR",
                            format!("Server \"{}\" is already running on port {}", def.id, existing.port),
                        ));
                    }
                }
            }
            if let Some(owner) = map.values().find(|e| {
                e.running && e.port == def.port && {
                    let id = e.shared.lock().ok().map(|g| g.def.id.clone());
                    id.as_deref() != Some(def.id.as_str())
                }
            }) {
                let owner_id = owner
                    .shared
                    .lock()
                    .ok()
                    .map(|g| g.def.id.clone())
                    .unwrap_or_else(|| "unknown".into());
                return Err(NativeError::new(
                    "MOCK_PORT_OWNED",
                    format!("Port {} is owned by server \"{}\"", def.port, owner_id),
                ));
            }
        }

        let tls = if def.settings.tls.as_ref().is_some_and(|t| t.enabled) {
            let tls = def.settings.tls.as_ref().unwrap();
            Some(build_server_config(tls).map_err(|m| NativeError::new("MOCK_VALIDATION_ERROR", m))?)
        } else {
            None
        };

        let host = if def.host == "0.0.0.0" {
            IpAddr::V4(Ipv4Addr::UNSPECIFIED)
        } else {
            IpAddr::V4(Ipv4Addr::LOCALHOST)
        };
        let addr = SocketAddr::new(host, def.port);
        let warnings = native_capability_warnings(&def);
        let port = def.port;
        let server_id = def.id.clone();
        let shared = Arc::new(Mutex::new(ListenerShared::new(def)));
        let stop = CancellationToken::new();
        let task = spawn_listener(shared.clone(), stop.clone(), addr, tls).map_err(|m| {
            let code = if m.contains("EADDRINUSE") || m.contains("already in use") {
                "MOCK_PORT_IN_USE"
            } else {
                "MOCK_RUNTIME_ERROR"
            };
            NativeError::new(code, m)
        })?;

        {
            let mut map = self.inner.lock().unwrap_or_else(|e| e.into_inner());
            map.insert(
                server_id.clone(),
                NativeEntry {
                    port,
                    running: true,
                    shared,
                    stop,
                    task: Some(task),
                },
            );
        }

        Ok(json!({
            "serverId": server_id,
            "port": port,
            "state": "running",
            "generation": 1,
            "warnings": warnings,
        }))
    }

    pub async fn stop(&self, server_id: &str) -> Result<Value, NativeError> {
        let (port, generation, task, shared, drain_ms) = {
            let mut map = self.inner.lock().unwrap_or_else(|e| e.into_inner());
            let Some(entry) = map.get_mut(server_id) else {
                return Err(NativeError::new(
                    "NOT_FOUND",
                    format!("Server \"{server_id}\" not found"),
                ));
            };
            let port = entry.port;
            let generation = entry
                .shared
                .lock()
                .ok()
                .map(|g| g.generation)
                .unwrap_or(0);
            let drain_ms = entry
                .shared
                .lock()
                .ok()
                .map(|g| g.def.settings.limits.graceful_drain_ms)
                .unwrap_or(5_000);
            entry.stop.cancel();
            let task = entry.task.take();
            entry.running = false;
            if let Ok(mut g) = entry.shared.lock() {
                g.running = false;
            }
            (port, generation, task, entry.shared.clone(), drain_ms)
        };

        let deadline = std::time::Instant::now() + std::time::Duration::from_millis(drain_ms.min(30_000));
        while std::time::Instant::now() < deadline {
            let in_flight = shared.lock().ok().map(|g| g.in_flight).unwrap_or(0);
            if in_flight == 0 {
                break;
            }
            tokio::time::sleep(std::time::Duration::from_millis(10)).await;
        }
        if let Some(task) = task {
            task.abort();
            let _ = task.await;
        }
        if let Ok(mut g) = shared.lock() {
            g.in_flight = 0;
        }
        wait_for_port_release(port, 40, 25).await;
        Ok(json!({
            "serverId": server_id,
            "port": port,
            "state": "stopped",
            "generation": generation,
        }))
    }

    pub fn commit(&self, server_id: &str, def: ServerDefinition) -> Result<Value, NativeError> {
        let map = self.inner.lock().unwrap_or_else(|e| e.into_inner());
        let Some(entry) = map.get(server_id) else {
            return Err(NativeError::new(
                "NOT_FOUND",
                format!("Server \"{server_id}\" is not running"),
            ));
        };
        if !entry.running {
            return Err(NativeError::new(
                "NOT_FOUND",
                format!("Server \"{server_id}\" is not running"),
            ));
        }
        let mut g = entry.shared.lock().unwrap_or_else(|e| e.into_inner());
        g.journal.update_settings(&def.settings);
        g.def = def;
        g.generation = g.generation.saturating_add(1);
        g.diagnostics.reset();
        Ok(json!({
            "serverId": server_id,
            "port": entry.port,
            "state": "running",
            "generation": g.generation,
            "warnings": native_capability_warnings(&g.def),
        }))
    }

    pub fn status(&self, server_id: &str) -> Result<Value, NativeError> {
        let map = self.inner.lock().unwrap_or_else(|e| e.into_inner());
        let Some(entry) = map.get(server_id) else {
            return Err(NativeError::new(
                "NOT_FOUND",
                format!("Server \"{server_id}\" not found"),
            ));
        };
        let generation = entry
            .shared
            .lock()
            .ok()
            .map(|g| g.generation)
            .unwrap_or(0);
        Ok(json!({
            "serverId": server_id,
            "port": entry.port,
            "state": if entry.running { "running" } else { "stopped" },
            "generation": generation,
        }))
    }

    pub fn transactions(&self, server_id: &str, limit: Option<usize>, after_cursor: Option<u64>) -> Result<Value, NativeError> {
        self.with_journal(server_id, |j| j.query(limit, after_cursor))
    }

    pub fn clear_transactions(&self, server_id: &str) -> Result<Value, NativeError> {
        self.with_journal_mut(server_id, |j| {
            j.clear();
            json!({ "cleared": true })
        })
    }

    pub fn scenario_state(&self, server_id: &str) -> Result<Value, NativeError> {
        let map = self.inner.lock().unwrap_or_else(|e| e.into_inner());
        let Some(entry) = map.get(server_id) else {
            return Err(NativeError::new(
                "NOT_RUNNING",
                format!("Server \"{server_id}\" is not running"),
            ));
        };
        let g = entry.shared.lock().unwrap_or_else(|e| e.into_inner());
        Ok(json!({
            "states": g.runtime.scenario.states,
            "counters": g.runtime.scenario.counters,
            "sequencePositions": g.runtime.sequence.positions,
        }))
    }

    pub fn reset_state(&self, server_id: &str) -> Result<Value, NativeError> {
        let map = self.inner.lock().unwrap_or_else(|e| e.into_inner());
        let Some(entry) = map.get(server_id) else {
            return Err(NativeError::new(
                "NOT_RUNNING",
                format!("Server \"{server_id}\" is not running"),
            ));
        };
        let mut g = entry.shared.lock().unwrap_or_else(|e| e.into_inner());
        g.runtime.scenario.states.clear();
        g.runtime.scenario.counters.clear();
        g.runtime.sequence.positions.clear();
        g.runtime.variant_match_counts.clear();
        Ok(json!({ "reset": true }))
    }

    pub fn diagnostics(&self, server_id: &str) -> Result<Value, NativeError> {
        let map = self.inner.lock().unwrap_or_else(|e| e.into_inner());
        let Some(entry) = map.get(server_id) else {
            return Err(NativeError::new(
                "NOT_FOUND",
                format!("No diagnostics for \"{server_id}\""),
            ));
        };
        let g = entry.shared.lock().unwrap_or_else(|e| e.into_inner());
        let predicate_count: usize = g.def.routes.iter().map(count_predicates).sum();
        Ok(json!({
            "generation": g.generation,
            "routeCount": g.def.routes.len(),
            "predicateCount": predicate_count,
            "openConnections": g.connections,
            "inFlight": g.in_flight,
            "matchDuration": g.diagnostics.snapshot(),
            "outcomes": g.diagnostics.outcomes_json(),
            "journal": g.journal.stats(),
            "templateErrors": g.diagnostics.template_errors(),
        }))
    }

    fn with_journal<F>(&self, server_id: &str, f: F) -> Result<Value, NativeError>
    where
        F: FnOnce(&Journal) -> Value,
    {
        let map = self.inner.lock().unwrap_or_else(|e| e.into_inner());
        let Some(entry) = map.get(server_id) else {
            return Err(NativeError::new(
                "NOT_FOUND",
                format!("No journal for \"{server_id}\""),
            ));
        };
        let g = entry.shared.lock().unwrap_or_else(|e| e.into_inner());
        Ok(f(&g.journal))
    }

    fn with_journal_mut<F>(&self, server_id: &str, f: F) -> Result<Value, NativeError>
    where
        F: FnOnce(&mut Journal) -> Value,
    {
        let map = self.inner.lock().unwrap_or_else(|e| e.into_inner());
        let Some(entry) = map.get(server_id) else {
            return Err(NativeError::new(
                "NOT_FOUND",
                format!("No journal for \"{server_id}\""),
            ));
        };
        let mut g = entry.shared.lock().unwrap_or_else(|e| e.into_inner());
        Ok(f(&mut g.journal))
    }
}

fn count_predicates(route: &crate::api_mock::types::Route) -> usize {
    fn walk(group: &crate::api_mock::types::PredicateGroup) -> usize {
        group.children.iter().map(|c| match c {
            crate::api_mock::types::PredicateNode::Group(g) => walk(g),
            crate::api_mock::types::PredicateNode::Leaf(_) => 1,
        }).sum()
    }
    walk(&route.predicates)
}

impl Default for ApiMockNativeState {
    fn default() -> Self {
        Self::new()
    }
}

fn is_port_available(port: u16) -> bool {
    let addr = std::net::SocketAddr::from(([127, 0, 0, 1], port));
    match std::net::TcpListener::bind(addr) {
        Ok(listener) => {
            drop(listener);
            true
        }
        Err(_) => false,
    }
}

async fn wait_for_port_release(port: u16, attempts: usize, delay_ms: u64) {
    for _ in 0..attempts {
        if is_port_available(port) {
            return;
        }
        tokio::time::sleep(std::time::Duration::from_millis(delay_ms)).await;
    }
}
