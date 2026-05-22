# Phase 3D — Distributed Execution: Detailed Implementation Plan

> **Goal**: Break past single-machine limits by coordinating load generation across
> multiple machines. A controller dispatches work to remote Rust workers, aggregates
> streaming HDR metrics, and presents unified progress in the existing UI.
>
> **Target**: 50,000+ RPS (horizontally scalable — linear with worker count)
> **Effort**: 4–6 weeks across 6 PRs
> **Risk**: Highest of all phases — network protocol, fault tolerance, aggregation correctness
> **Prerequisites**: Phases 3A–3C complete (validation, streaming percentiles, constant arrival)
> **Status**: NOT YET IMPLEMENTED — this is a future implementation plan

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Current State Analysis](#2-current-state-analysis)
3. [Re-evaluation Findings](#3-re-evaluation-findings)
4. [PR Breakdown](#4-pr-breakdown)
   - [PR1: Executor Decoupling](#pr1-executor-decoupling-the-foundation)
   - [PR2: Protocol & Types](#pr2-protocol--types-the-wire)
   - [PR3: Worker Binary](#pr3-worker-binary-the-muscle)
   - [PR4: Controller](#pr4-controller-the-brain)
   - [PR5: Frontend UI](#pr5-frontend-ui-the-experience)
   - [PR6: Fault Tolerance & Polish](#pr6-fault-tolerance--polish)
5. [Plan Splitting Strategy](#5-plan-splitting-strategy)
6. [Metrics Aggregation](#6-metrics-aggregation)
7. [Risks & Mitigations](#7-risks--mitigations)
8. [Files Created/Modified](#8-files-createdmodified)
9. [Testing Strategy](#9-testing-strategy)
10. [Open Questions](#10-open-questions)

---

## 1. Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│  RedfireForge Desktop App (Tauri) — CONTROLLER                      │
│                                                                      │
│  ┌──────────────┐    ┌─────────────┐    ┌────────────────────────┐  │
│  │ RunnerConfig  │───▶│ handleRun() │───▶│ rustBridge.ts          │  │
│  │ (React)       │    │ (React)     │    │ invoke start_dist_test │  │
│  └──────────────┘    └─────────────┘    └────────┬───────────────┘  │
│                                                   │                  │
│                                   ┌───────────────▼──────────────┐  │
│                                   │ commands.rs                   │  │
│                                   │ start_distributed_load_test   │  │
│                                   └───────────────┬──────────────┘  │
│                                                   │                  │
│  ┌────────────────────────────────────────────────▼──────────────┐  │
│  │ controller.rs                                                 │  │
│  │                                                               │  │
│  │  1. Start WebSocket server on port 9876                       │  │
│  │  2. Accept worker connections                                 │  │
│  │  3. split_plan() across workers                               │  │
│  │  4. Send AssignWork to each worker                            │  │
│  │  5. Receive Progress batches from workers                     │  │
│  │  6. Merge HDR histograms + aggregate counts                   │  │
│  │  7. Emit combined ProgressBatch via Tauri events              │  │
│  │  8. On all workers Complete → emit CompletionSummary          │  │
│  └──────┬────────────┬────────────┬──────────────────────────────┘  │
│         │            │            │                                  │
└─────────┼────────────┼────────────┼──────────────────────────────────┘
          │ WS         │ WS         │ WS
          ▼            ▼            ▼
   ┌──────────┐  ┌──────────┐  ┌──────────┐
   │ Worker 1 │  │ Worker 2 │  │ Worker N │    redfireforge-worker binary
   │          │  │          │  │          │    (headless, no Tauri/webview)
   │ executor │  │ executor │  │ executor │
   │ + HDR    │  │ + HDR    │  │ + HDR    │
   └──────────┘  └──────────┘  └──────────┘
```

### Design Principles

1. **Controller aggregates, frontend is unchanged** — The controller emits the same `ProgressBatch` shape to the UI; `useTestExecution` and `LiveCharts` need minimal modifications.
2. **Workers are headless Rust binaries** — Reuse all executor/validation/histogram modules; no Tauri or webview dependency.
3. **Full plan sent to controller, split in Rust** — Frontend builds the same `ExecutionPlan`; `planner.rs` distributes it.
4. **WebSocket v1, gRPC later** — JSON over `tokio-tungstenite`; migrate to protobuf only if >10 workers.
5. **Local controller also executes** — Controller always runs one share locally (acts as worker 0) so a single-machine distributed test works.

---

## 2. Current State Analysis

### What Exists (reusable as-is)

| Component | File | Reusable? | Notes |
|-----------|------|-----------|-------|
| Execution plan types | `types.rs` (`ExecutionPlan` enum with 4 variants: `Pool`, `Sequential`, `ConstantArrival`, `LoadProfile`) | 100% — serde JSON, no Tauri deps | Serde tag: `#[serde(tag = "mode")]` |
| Pool executor | `executor.rs::run_pool` | 90% — needs `AppHandle` decoupling | Takes `app: tauri::AppHandle` as first param |
| Load profile executor | `executor.rs::run_load_profile` | 90% — same | Takes `app: tauri::AppHandle` as first param |
| Constant arrival executor | `arrival_executor.rs::run_constant_arrival` | 90% — same | Takes `app: tauri::AppHandle` as first param |
| HTTP execution | `executor.rs::execute_one/execute_with_retry` | 100% — pure reqwest | |
| Circuit breaker | `executor.rs::CircuitBreakerState` | 100% | |
| Think time | `executor.rs::compute_think_time/apply_think_time` | 100% | |
| HDR histogram | `histogram.rs::StreamingMetrics` | 90% — needs `merge()` method + field access for merge | Private fields: `histogram`, `total_count`, `error_count`, `sum_response_time`, `min_time`, `max_time` |
| Metrics snapshot | `histogram.rs::MetricsSnapshot` | 100% | Defined in `histogram.rs`, imported by `types.rs`. Fields: `p50`, `p95`, `p99`, `p999`, `min`, `max`, `avg`, `total`, `errors`, `tps` |
| Full Rust validation | `validation_result.rs` + stack | 100% — no Tauri deps | |
| Progress batch types | `types.rs::ProgressBatch` | 100% | Note: `total` field is `i64` (not `u64`) — `-1` is used as sentinel for "unknown total" |
| Completion summary | `types.rs::CompletionSummary` | 100% | Fields: `total_results`, `duration_ms`, `breaker_tripped`, `final_metrics` |
| Final results | `types.rs::FinalResults` | 100% | Contains only `results: Vec<ExecutionResult>` |
| JS plan builder | `rustBridge.ts::buildExecutionPlan` | 100% | Handles all 4 modes including `constant-arrival` |
| JS result mapper | `rustBridge.ts::mapRustResult` | 100% | |
| JS ProgressMeta | `executor.ts::ProgressMeta` | 100% | Has `targetRps?`, `actualRps?`, `droppedRequests?`, `metrics?` — no `workerBreakdown` yet |
| TS TestSummary | `shared/types/index.ts::TestSummary` | 100% | Has `droppedRequests?`, `peakRps?`, `targetRps?` |
| CLI reporters | `cli/reporters.ts` | Reference only (Node.js) | |

### What Doesn't Exist (new work)

| Component | Description |
|-----------|-------------|
| Progress sink abstraction | Replace `AppHandle` with trait/callback in executors |
| WebSocket protocol | `ControllerMessage` / `WorkerMessage` enums |
| Worker binary | `redfireforge-worker` standalone Rust binary |
| Controller | WebSocket server, plan splitting, aggregation |
| Plan splitter | `split_plan()` for pool/profile/arrival modes |
| HDR histogram merge | `StreamingMetrics::merge()` for cross-worker aggregation |
| Frontend distributed UI | Toggle, worker panel, controller port config |
| Tauri commands | `start_distributed_load_test`, `start_controller`, `stop_controller` |
| Worker lifecycle events | `worker-connected`, `worker-disconnected` Tauri events |

### Current Cargo.toml State

Key dependencies already present:
- `clap = { version = "4", features = ["derive"] }` — already used for `--cli` mode
- `tokio = { version = "1", features = ["full"] }` — async runtime
- `hdrhistogram = "7"` — HDR histogram
- `reqwest = { version = "0.13", features = ["json", "gzip", "brotli"] }` — HTTP client

Not yet present:
- `tokio-tungstenite` — needed for WebSocket
- `futures-util` — needed for WebSocket stream handling

No `[[bin]]` target exists — only the default Tauri binary from `src/main.rs` and a lib target (`app_lib`).

### Current Module Visibility

| Module | Visibility | Phase 3D impact |
|--------|------------|-----------------|
| `arrival_executor` | `mod` (private) | Needs `pub(crate)` for worker access |
| `commands` | `mod` (private) | New commands added |
| `executor` | `mod` (private) | Needs `pub(crate)` for worker access |
| `types` | `mod` (private) | Needs `pub` for worker binary |
| `histogram` | `pub mod` | Already public — merge method added here |
| `validation_result` | `pub mod` | Already public — no changes |

---

## 3. Re-evaluation Findings

After deep analysis of the existing codebase, the original Phase 3D plan in
`throughput-improvement-plan.md` is **well-aligned** with the architecture. The following
findings refine the plan:

### Finding 1: Executor-Tauri Coupling is the Critical Prerequisite

All three executors (`run_pool`, `run_load_profile`, `run_constant_arrival`) take
`app: tauri::AppHandle` as their first parameter and call `app.emit(...)` directly for
`"load-test-progress"` and `"load-test-final-results"` events. The `"load-test-complete"`
event is emitted in `commands.rs`, not in the executors.

This must be abstracted to a trait or callback **before** any distributed work begins.
This is PR1 — a pure refactor with no behavior change.

### Finding 2: Controller Should Also Execute Locally

The plan implies the controller only dispatches. But for single-machine use and for
odd-worker-count scenarios, the controller should run one share locally (as "worker 0").
This avoids the requirement of having at least one external worker connected.

### Finding 3: `StreamingMetrics` Needs Explicit Merge

The underlying `hdrhistogram::Histogram<u64>` supports `add()` for merging, but
`StreamingMetrics` wrapper doesn't expose this. All fields are private. The merge must handle:
- `histogram` → `self.histogram.add(&other.histogram)` (internal `Histogram<u64>` merge)
- `min_time` → take minimum of both
- `max_time` → take maximum of both
- `sum_response_time` → add both
- `total_count` / `error_count` → add both
- TPS → recompute from merged total / controller elapsed time (not sum of worker TPS)

### Finding 4: Plan Splitting for Constant Arrival is Non-Trivial

Simply dividing `target_rps / N` works for steady-state. But with ramp enabled,
each worker needs the same ramp curve scaled proportionally:
- `start_rps / N`, `end_rps / N`, same `ramp_duration_sec`
- `max_in_flight / N` (or proportional to worker capability)

### Finding 5: Results Accumulation Must Handle Out-of-Order Workers

Workers complete at different times. The controller must:
- Accept final results from each worker independently
- Merge `FinalResults` from sampled/metrics-only detail levels
- Not emit `CompletionSummary` until all workers finish (or timeout/disconnect)

### Finding 6: CLI Path Unchanged

The Node.js CLI (`cli/index.ts`) stays at JS performance level. Distributed testing
is a Tauri desktop feature. The standalone `redfireforge-worker` binary is CLI-style
but Rust-native, not part of the existing Node CLI.

### Finding 7: Frontend Changes are Minimal if Controller Aggregates

If the Rust controller merges metrics and emits standard `ProgressBatch`/`CompletionSummary`
via Tauri events, the existing `useTestExecution` → `LiveProgressPanel` → `LiveCharts`
pipeline needs only:
- Extended `ProgressMeta` with optional `workerBreakdown[]`
- A worker status panel in `LiveProgressPanel`
- A "Distributed" toggle in `RunnerExecutionConfig`

### Finding 8: Module Visibility Must Be Widened

Currently `executor`, `arrival_executor`, and `types` are `mod` (private). The worker
binary needs access to executor functions and types. These must be promoted to
`pub(crate)` at minimum, or the shared code extracted into the `app_lib` crate (which
already has `crate-type = ["staticlib", "cdylib", "rlib"]`).

### Finding 9: `ProgressBatch.total` is `i64` — Not `u64`

The `total` field in `ProgressBatch` uses `i64` (not `u64`) because `-1` is used as a
sentinel value for "unknown total" in time-based modes (load-profile, constant-arrival).
The aggregation logic must preserve this sentinel and NOT treat it as a negative count.

---

## 4. PR Breakdown

### PR1: Executor Decoupling — "The Foundation"

**Goal**: Remove `tauri::AppHandle` from executor function signatures, replacing it with
a transport-agnostic progress callback. Zero behavior change — pure refactor.

**Estimated effort**: 2–3 days

#### Step 1.1 — Define progress sink trait

```rust
// src-tauri/src/progress_sink.rs — NEW

pub trait ProgressSink: Send + Sync + 'static {
    fn emit_progress(&self, batch: &ProgressBatch);
    fn emit_final_results(&self, results: &FinalResults);
    fn emit_complete(&self, summary: &CompletionSummary);
}
```

#### Step 1.2 — Implement Tauri adapter

```rust
// src-tauri/src/progress_sink.rs

pub struct TauriProgressSink {
    app: tauri::AppHandle,
}

impl ProgressSink for TauriProgressSink {
    fn emit_progress(&self, batch: &ProgressBatch) {
        let _ = self.app.emit("load-test-progress", batch);
    }
    fn emit_final_results(&self, results: &FinalResults) {
        let _ = self.app.emit("load-test-final-results", results);
    }
    fn emit_complete(&self, summary: &CompletionSummary) {
        let _ = self.app.emit("load-test-complete", summary);
    }
}
```

> **Note**: Currently `"load-test-complete"` is emitted in `commands.rs`, not in the executors.
> Decide whether to move the completion emit into the ProgressSink trait or keep it in commands.
> Recommendation: Move it into the trait for symmetry — then `commands.rs` just calls
> `sink.emit_complete(...)`.

#### Step 1.3 — Refactor executors

Change signatures from:
```rust
pub async fn run_pool(app: tauri::AppHandle, client: Arc<Client>, scenarios: Vec<RustScenario>,
    concurrency: u32, timeout: Duration, retry_count: u32, retry_delay_ms: u64,
    think_time: ThinkTimeConfig, breaker_config: CircuitBreakerConfig,
    cancel: CancellationToken, detail_level: DetailLevel,
) -> (Vec<ExecutionResult>, bool, Option<MetricsSnapshot>)
```
To:
```rust
pub async fn run_pool(sink: Arc<dyn ProgressSink>, client: Arc<Client>, scenarios: Vec<RustScenario>,
    concurrency: u32, timeout: Duration, retry_count: u32, retry_delay_ms: u64,
    think_time: ThinkTimeConfig, breaker_config: CircuitBreakerConfig,
    cancel: CancellationToken, detail_level: DetailLevel,
) -> (Vec<ExecutionResult>, bool, Option<MetricsSnapshot>)
```

Apply to: `run_pool`, `run_load_profile` (18 params), `run_constant_arrival` (16 params).

#### Step 1.4 — Update commands.rs

Wrap `AppHandle` in `TauriProgressSink` and pass to executors:
```rust
let sink = Arc::new(TauriProgressSink::new(app.clone()));
executor::run_pool(sink, client, scenarios, ...).await
```

#### Step 1.5 — Promote module visibility

```rust
// src-tauri/src/lib.rs — CHANGE
pub mod progress_sink;      // NEW
pub(crate) mod executor;    // was: mod executor
pub(crate) mod arrival_executor;  // was: mod arrival_executor
pub(crate) mod types;       // was: mod types (needed for worker binary)
```

#### Step 1.6 — Tests

- All existing Rust unit tests pass unchanged (they don't use AppHandle)
- `commands.rs` integration path tested via Tauri app
- JS-side `rustBridge.ts` tests unchanged (IPC contract identical)

#### Verification

- `cargo build` — compiles
- `cargo test` — all Rust tests pass
- `npx tsc -b --noEmit` — 0 TS errors
- Tauri dev app: run pool, load-profile, and constant-arrival tests → identical behavior

---

### PR2: Protocol & Types — "The Wire"

**Goal**: Define the WebSocket message protocol and add histogram merge capability.

**Estimated effort**: 2–3 days

#### Step 2.1 — Protocol messages

```rust
// src-tauri/src/distributed/protocol.rs — NEW

#[derive(Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum ControllerMessage {
    AssignWork {
        plan_id: String,
        plan: ExecutionPlan,
    },
    Abort {
        plan_id: String,
    },
    Ping,
}

#[derive(Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum WorkerMessage {
    Ready {
        worker_id: String,
        capabilities: WorkerCapabilities,
    },
    Progress {
        plan_id: String,
        batch: ProgressBatch,
    },
    FinalResults {
        plan_id: String,
        results: Vec<ExecutionResult>,
    },
    Complete {
        plan_id: String,
        summary: WorkerCompletionSummary,
    },
    Error {
        plan_id: String,
        error: String,
    },
    Pong,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct WorkerCapabilities {
    pub max_concurrency: u32,
    pub cpu_cores: u32,
    pub memory_mb: u64,
}

#[derive(Serialize, Deserialize)]
pub struct WorkerCompletionSummary {
    pub total_results: u64,
    pub duration_ms: f64,
    pub breaker_tripped: bool,
    pub final_metrics: Option<MetricsSnapshot>,
    pub dropped_requests: Option<u64>,
}
```

> **Note**: `WorkerCompletionSummary` is a NEW type, distinct from the existing
> `CompletionSummary` in `types.rs`. The existing `CompletionSummary` does not have
> a `dropped_requests` field. `WorkerCompletionSummary` adds it for per-worker tracking.

#### Step 2.2 — Histogram merge

```rust
// src-tauri/src/histogram.rs — ADD merge method

impl StreamingMetrics {
    /// Merge another StreamingMetrics into this one.
    /// Both must use the same histogram bounds (guaranteed by both using `new()`).
    pub fn merge(&mut self, other: &StreamingMetrics) {
        self.histogram.add(&other.histogram).expect("histograms must have same bounds");
        self.total_count += other.total_count;
        self.error_count += other.error_count;
        self.sum_response_time += other.sum_response_time;
        if other.min_time < self.min_time {
            self.min_time = other.min_time;
        }
        if other.max_time > self.max_time {
            self.max_time = other.max_time;
        }
    }
}
```

> **Implementation note**: The `merge()` method accesses private fields (`histogram`,
> `total_count`, `error_count`, `sum_response_time`, `min_time`, `max_time`) directly
> because it's an `impl` method on the same struct. No public getters needed.

#### Step 2.3 — Module structure

```rust
// src-tauri/src/distributed/mod.rs — NEW
pub mod protocol;
// planner, controller, worker, aggregator added in PR3/PR4

// src-tauri/src/lib.rs — ADD
pub mod distributed;
```

#### Step 2.4 — Tests

| Test file | Tests | Description |
|-----------|-------|-------------|
| `distributed/protocol_test.rs` | ~15 | Serde round-trip for all message variants |
| `histogram_test.rs` | +5 | Merge correctness: percentiles, min/max, empty merge, mismatched bounds |

---

### PR3: Worker Binary — "The Muscle"

**Goal**: Create `redfireforge-worker`, a standalone headless Rust binary that connects
to a controller via WebSocket, receives work, executes using the shared executor core,
and streams progress back.

**Estimated effort**: 5–7 days

#### Step 3.1 — Cargo.toml binary target

```toml
# src-tauri/Cargo.toml — ADD

[[bin]]
name = "redfireforge-worker"
path = "src/worker_main.rs"

[dependencies]
# ADD to existing [dependencies]:
tokio-tungstenite = "0.24"    # verify compatibility with tokio = "1"
futures-util = "0.3"
```

> **Note**: `clap` is already in `Cargo.toml` (`version = "4", features = ["derive"]`),
> so the worker binary can use it for CLI arg parsing without adding a new dependency.

#### Step 3.2 — Worker entry point

```rust
// src-tauri/src/worker_main.rs — NEW

use clap::Parser;

#[derive(Parser)]
struct Args {
    /// Controller WebSocket endpoint
    #[arg(long)]
    controller: String,  // ws://host:9876

    /// Worker display name (auto-generated if omitted)
    #[arg(long)]
    name: Option<String>,

    /// Maximum concurrent requests this worker can handle
    #[arg(long, default_value = "100")]
    max_concurrency: u32,
}

#[tokio::main]
async fn main() {
    let args = Args::parse();
    app_lib::distributed::worker::run_worker(
        args.controller, args.name, args.max_concurrency
    ).await;
}
```

> **Important**: The worker binary imports from `app_lib` (the lib crate defined in
> `Cargo.toml`). This is why module visibility must be widened in PR1 — the executor,
> types, and histogram modules must be accessible from the lib crate's public API.

#### Step 3.3 — Worker WebSocket client

```rust
// src-tauri/src/distributed/worker.rs — NEW

pub async fn run_worker(controller_url: String, name: Option<String>, max_concurrency: u32) {
    // 1. Connect to controller WebSocket
    // 2. Send WorkerMessage::Ready with capabilities (CPU cores, memory from sys_info)
    // 3. Enter message loop:
    //    - ControllerMessage::AssignWork → spawn executor task
    //    - ControllerMessage::Abort → cancel via CancellationToken
    //    - ControllerMessage::Ping → send Pong
    // 4. Executor progress → send WorkerMessage::Progress via WebSocket
    // 5. Executor complete → send WorkerMessage::Complete
    // 6. On disconnect → attempt reconnect with backoff
}
```

#### Step 3.4 — WebSocket progress sink

```rust
// src-tauri/src/distributed/worker.rs

struct WebSocketProgressSink {
    tx: futures_util::stream::SplitSink<WebSocketStream, Message>,
    plan_id: String,
}

impl ProgressSink for WebSocketProgressSink {
    fn emit_progress(&self, batch: &ProgressBatch) {
        let msg = WorkerMessage::Progress { plan_id: self.plan_id.clone(), batch: batch.clone() };
        // Send JSON via WebSocket
    }
    // ...
}
```

#### Step 3.5 — Build and test worker binary

```bash
# Build worker binary (no Tauri/webview linked)
cargo build --bin redfireforge-worker

# Run worker
./target/release/redfireforge-worker --controller ws://localhost:9876 --max-concurrency 50
```

#### Step 3.6 — Tests

| Test file | Tests | Description |
|-----------|-------|-------------|
| `distributed/worker_test.rs` | ~10 | Connection lifecycle, message handling, graceful disconnect |

---

### PR4: Controller — "The Brain"

**Goal**: Implement the controller that runs inside the Tauri app, accepts worker
connections, splits plans, and aggregates progress for the UI.

**Estimated effort**: 7–10 days

#### Step 4.1 — Plan splitter

```rust
// src-tauri/src/distributed/planner.rs — NEW

pub fn split_plan(
    plan: ExecutionPlan,
    worker_count: usize,
    capabilities: &[WorkerCapabilities],
) -> Vec<ExecutionPlan> {
    match &plan {
        ExecutionPlan::Pool { scenarios, concurrency, timeout_ms,
            retry_count, retry_delay_ms, think_time, circuit_breaker, detail_level } => {
            // Partition scenarios across workers (ceil division)
            // Each worker gets ceil(scenarios.len() / worker_count) scenarios
            // Concurrency is SPLIT: each worker gets ceil(concurrency / worker_count)
            //   (total concurrency across all workers ≈ original concurrency)
            // All other fields (timeout, retry, think_time, circuit_breaker, detail_level)
            //   are COPIED unchanged to each worker's plan
        }
        ExecutionPlan::Sequential { scenarios, timeout_ms,
            retry_count, retry_delay_ms, think_time, circuit_breaker, detail_level } => {
            // Partition scenarios across workers
            // Each worker runs its share sequentially (concurrency=1)
            // All other fields copied unchanged
            // Note: Sequential has NO concurrency field — it's implicitly 1
        }
        ExecutionPlan::LoadProfile { scenarios, concurrency, duration_sec,
            timeout_ms, retry_count, retry_delay_ms, think_time, circuit_breaker,
            profile_type, ramp_up_sec, spike_concurrency, spike_start_sec,
            spike_duration_sec, detail_level } => {
            // Each worker gets proportional concurrency: ceil(concurrency / worker_count)
            // Same duration_sec for all workers
            // All workers share the same scenario pool (NOT partitioned — all get all scenarios)
            // Ramp-up: each worker ramps to their proportional max
            // Spike: each worker gets ceil(spike_concurrency / worker_count)
        }
        ExecutionPlan::ConstantArrival { scenarios, target_rps, duration_sec,
            max_in_flight, timeout_ms, retry_count, retry_delay_ms, think_time,
            circuit_breaker, ramp_config, detail_level } => {
            // Each worker gets target_rps / worker_count
            // max_in_flight: ceil(max_in_flight / worker_count), minimum 1
            // Ramp: start_rps / worker_count, end_rps / worker_count, same ramp_duration_sec
            // Same duration_sec for all workers
            // All workers share the same scenario pool
        }
    }
}
```

> **Design decision — Concurrency splitting**:
> - **Pool mode**: Concurrency is SPLIT across workers (e.g., `C:30` with 3 workers → each gets `C:10`).
>   This preserves the total system concurrency at the configured level.
> - **Load Profile mode**: Same approach — `concurrency / N` per worker.
> - **Constant Arrival**: `target_rps / N` per worker.
> - **Sequential**: No concurrency parameter — each worker runs its scenarios sequentially.
>   Cross-worker parallelism is inherent (N workers each running sequentially = N-way parallel).

#### Step 4.2 — Controller WebSocket server

```rust
// src-tauri/src/distributed/controller.rs — NEW

pub struct DistributedController {
    workers: Arc<Mutex<HashMap<String, ConnectedWorker>>>,
    port: u16,
    cancel_token: CancellationToken,
}

struct ConnectedWorker {
    id: String,
    capabilities: WorkerCapabilities,
    tx: SplitSink<WebSocketStream, Message>,
    status: WorkerStatus,  // Connected, Running, Complete, Disconnected
}

impl DistributedController {
    pub async fn start(&self) -> Result<(), String> {
        // 1. Bind TCP listener on self.port
        // 2. Accept WebSocket upgrade
        // 3. Receive Ready → store worker
        // 4. Return when cancelled
    }

    pub async fn run_distributed_test(
        &self,
        plan: ExecutionPlan,
        sink: Arc<dyn ProgressSink>,
    ) -> (Vec<ExecutionResult>, bool, Option<MetricsSnapshot>) {
        // 1. split_plan() for connected workers + local worker 0
        // 2. Local worker 0: spawn executor with local share
        // 3. Send AssignWork to each remote worker
        // 4. Aggregation loop:
        //    - Receive Progress from workers
        //    - Merge metrics (HDR histogram merge)
        //    - Sum completed, in_flight, dropped
        //    - Emit combined ProgressBatch via sink
        // 5. Wait for all Complete messages
        // 6. Merge final results
        // 7. Return combined results + merged metrics
    }

    pub async fn abort(&self) {
        // Send Abort to all workers + cancel local worker 0
    }

    pub fn connected_workers(&self) -> Vec<WorkerInfo> {
        // Return worker list for UI
    }
}
```

#### Step 4.3 — Progress aggregation engine

```rust
// src-tauri/src/distributed/aggregator.rs — NEW

pub struct ProgressAggregator {
    merged_metrics: Mutex<StreamingMetrics>,
    per_worker: HashMap<String, WorkerProgress>,
    total_completed: AtomicU64,
    total_dropped: AtomicU64,
    original_total: i64,   // From original plan — i64 because -1 = unknown (time-based modes)
    start_time: Instant,
}

struct WorkerProgress {
    completed: u64,
    in_flight: u32,
    last_batch_time: Instant,
    latest_metrics: Option<MetricsSnapshot>,
}

impl ProgressAggregator {
    pub fn ingest(&self, worker_id: &str, batch: &ProgressBatch) -> ProgressBatch {
        // 1. Update per_worker state
        // 2. If batch.metrics is Some, merge into merged_metrics
        // 3. Sum all worker completed / in_flight / dropped
        // 4. Build combined ProgressBatch:
        //    - completed: sum of all workers
        //    - total: original_total (NOT split total — keep original plan's total)
        //    - current_in_flight: sum of all workers
        //    - metrics: merged snapshot (with controller elapsed_ms for TPS)
        //    - target_rps: original plan target (NOT split)
        //    - actual_rps: sum of all worker actual_rps
        //    - dropped_requests: sum of all worker dropped
        //    - elapsed_ms: controller wall clock (NOT max of workers)
        //    - results: batch.results (passthrough for this tick)
        // 5. Return combined batch
    }
}
```

#### Step 4.4 — Tauri commands

```rust
// src-tauri/src/commands.rs — ADD

#[tauri::command]
pub async fn start_controller(state: State<'_, ExecutorState>, port: u16) -> Result<(), String> {
    // Start WebSocket server, store controller in state
}

#[tauri::command]
pub async fn stop_controller(state: State<'_, ExecutorState>) -> Result<(), String> {
    // Stop WebSocket server, disconnect all workers
}

#[tauri::command]
pub async fn get_connected_workers(state: State<'_, ExecutorState>) -> Result<Vec<WorkerInfo>, String> {
    // Return list of connected workers with capabilities
}

#[tauri::command]
pub async fn start_distributed_load_test(
    app: AppHandle,
    state: State<'_, ExecutorState>,
    plan: ExecutionPlan,
) -> Result<CompletionSummary, String> {
    // 1. Get controller from state
    // 2. Create TauriProgressSink
    // 3. controller.run_distributed_test(plan, sink).await
    // 4. Build and return CompletionSummary
}
```

#### Step 4.5 — Tests

| Test file | Tests | Description |
|-----------|-------|-------------|
| `distributed/planner_test.rs` | ~20 | Plan splitting: even division, pool/sequential/profile/arrival, edge cases (1 worker, 0 scenarios, fractional RPS, ramp splitting) |
| `distributed/aggregator_test.rs` | ~15 | Metric merge correctness, partial batches, worker disconnect, `total=-1` sentinel preservation |
| `distributed/controller_test.rs` | ~15 | Worker lifecycle, concurrent connections, abort propagation |

---

### PR5: Frontend UI — "The Experience"

**Goal**: Add distributed execution controls to the Test Runner UI: controller
management, worker panel, and distributed progress display.

**Estimated effort**: 5–7 days

#### Step 5.1 — TypeScript types

```typescript
// src/shared/types/index.ts — ADD

export interface WorkerInfo {
  workerId: string;
  name?: string;
  capabilities: WorkerCapabilities;
  status: 'connected' | 'running' | 'complete' | 'disconnected';
  completed?: number;
  inFlight?: number;
  tps?: number;
}

export interface WorkerCapabilities {
  maxConcurrency: number;
  cpuCores: number;
  memoryMb: number;
}

export interface DistributedConfig {
  enabled: boolean;
  controllerPort: number;
}
```

#### Step 5.2 — Rust bridge extensions

```typescript
// src/features/test-runner/utils/rustBridge.ts — ADD

export async function startController(port: number): Promise<void>;
export async function stopController(): Promise<void>;
export async function getConnectedWorkers(): Promise<WorkerInfo[]>;
export function startDistributedLoadTest(...): Promise<TestResult>;
```

#### Step 5.3 — RunnerExecutionConfig changes

- Add **"Distributed"** toggle (checkbox, gated by `isTauri()`)
- When enabled, show:
  - **Controller Port** input (default `9876`)
  - **Start Controller** / **Stop Controller** button
  - **Connected Workers** table: ID, Name, CPU Cores, Memory, Status
  - **Worker count** badge next to the Distributed label
- When distributed is enabled + 0 workers connected: show "Waiting for workers..."
- Run button enabled when ≥0 workers (controller always runs local share)
- All existing execution modes work with distributed (pool, batch, load-profile, constant-arrival)

#### Step 5.4 — LiveProgressPanel changes

- Add `Distributed · N workers` badge in progress header (next to execution mode tag)
- Optional per-worker progress section (collapsible):
  - Table rows: Worker ID, Status, Completed, In-Flight, TPS
  - Highlight disconnected workers in red
- Existing metric cards and charts unchanged (controller aggregates)

#### Step 5.5 — Config persistence

- Add `distributed?: DistributedConfig` to `RunnerConfig` in `runnerConfigDefaults.ts`
- Add `distributed?: DistributedConfig` to `ResolvedConfig` in `runnerConfigDefaults.ts`
- Add `distributed?: DistributedConfig` to `useRunnerConfig` state + auto-save
- Add `workerCount?: number` to `PersistedProgress` in `runnerProgressStorage.ts`

#### Step 5.6 — Extended ProgressMeta

```typescript
// src/engine/executor.ts — ADD to ProgressMeta

export interface ProgressMeta {
  // ... existing fields (elapsedMs, targetConcurrency, currentInFlight,
  //     durationMs, avgIterationTimeMs?, metrics?, targetRps?, actualRps?,
  //     droppedRequests?) ...
  workerBreakdown?: WorkerProgressSnapshot[];
}

export interface WorkerProgressSnapshot {
  workerId: string;
  completed: number;
  inFlight: number;
  tps?: number;
  status: 'running' | 'complete' | 'disconnected';
}
```

#### Step 5.7 — Tests

| Test file | Tests | Description |
|-----------|-------|-------------|
| `RunnerExecutionConfig.test.tsx` | +8 | Distributed toggle, disabled on web, controller controls, worker table |
| `LiveProgressPanel.test.tsx` | +4 | Distributed badge, per-worker breakdown rendering |
| `rustBridge.test.ts` | +5 | Distributed config mapping, plan passthrough |

---

### PR6: Fault Tolerance & Polish — "The Shield"

**Goal**: Handle worker disconnects, controller restarts, and edge cases gracefully.

**Estimated effort**: 3–5 days

#### Step 6.1 — Heartbeat protocol

- Controller sends `Ping` every 5 seconds
- Worker responds with `Pong`
- Controller marks worker as `disconnected` after 3 missed pongs (15 seconds)
- Disconnected worker's incomplete work is NOT redistributed in v1
  (simplicity > completeness; controller logs warning, continues with remaining workers)

#### Step 6.2 — Worker reconnection

- Worker attempts reconnect with exponential backoff (1s, 2s, 4s, 8s, max 30s)
- On reconnect, worker sends `Ready` again
- Controller assigns new work only if a new test is started

#### Step 6.3 — Graceful shutdown

- Controller `stop_controller` sends `Abort` to all workers before closing
- Worker `SIGTERM` / `SIGINT` handler sends `Complete` with partial results before exit
- Controller waits up to 5 seconds for worker completion messages on abort

#### Step 6.4 — Error boundaries

- Worker execution error → `WorkerMessage::Error` → controller logs, continues with other workers
- Controller crash → workers detect disconnect, enter reconnect loop
- Network partition → heartbeat timeout → mark disconnected, don't wait forever

#### Step 6.5 — Tests

| Test file | Tests | Description |
|-----------|-------|-------------|
| `distributed/controller_test.rs` | +10 | Heartbeat timeout, worker disconnect mid-run, abort propagation |
| `distributed/worker_test.rs` | +5 | Reconnect backoff, graceful shutdown, error reporting |

---

## 5. Plan Splitting Strategy

### Design Decision: Concurrency Splitting

For all modes, the **concurrency/throughput parameter is SPLIT** across workers so the
total system load equals the configured value. Scenarios are either partitioned (Pool,
Sequential, Batch) or shared (Load Profile, Constant Arrival).

### Pool / Batch Mode

```
Input:  100 scenarios, concurrency=30, 3 workers
Output: Worker 0: scenarios[0..34],  concurrency=10
        Worker 1: scenarios[34..67], concurrency=10
        Worker 2: scenarios[67..100], concurrency=10
        Each keeps same timeout, retry, think time, circuit breaker, detail_level
        Total system concurrency: 30 (10 × 3)
```

### Sequential Mode

```
Input:  100 scenarios, 3 workers
Output: Worker 0: scenarios[0..34], concurrency=1
        Worker 1: scenarios[34..67], concurrency=1
        Worker 2: scenarios[67..100], concurrency=1
        Execution within each worker is sequential; across workers is parallel
        Note: ExecutionPlan::Sequential has NO concurrency field — it's implicitly 1
        Wall-clock time ≈ max(worker_times), not sum
```

### Load Profile Mode

```
Input:  concurrency=30, duration=60s, sustained, 3 workers
Output: Worker 0: concurrency=10, duration=60s, sustained, ALL scenarios
        Worker 1: concurrency=10, duration=60s, sustained, ALL scenarios
        Worker 2: concurrency=10, duration=60s, sustained, ALL scenarios
        Ramp-up: each worker ramps from 1 to 10 (not from 1 to 30)
        Spike: each worker gets ceil(spike_concurrency / 3)
        All workers run ALL scenarios (not partitioned) — weighted random selection
```

### Constant Arrival Mode

```
Input:  target_rps=300, duration=60s, max_in_flight=3000, 3 workers
Output: Worker 0: target_rps=100, duration=60s, max_in_flight=1000, ALL scenarios
        Worker 1: target_rps=100, duration=60s, max_in_flight=1000, ALL scenarios
        Worker 2: target_rps=100, duration=60s, max_in_flight=1000, ALL scenarios
        Ramp: start_rps/3, end_rps/3, same ramp_duration_sec
        All workers run ALL scenarios
```

### Capability-Weighted Split (future enhancement)

```
Input:  target_rps=300, Worker A (8 cores), Worker B (4 cores), Worker C (4 cores)
Output: Worker A: target_rps=150 (8/16 × 300)
        Worker B: target_rps=75  (4/16 × 300)
        Worker C: target_rps=75  (4/16 × 300)
```

v1: Even split only. Capability-weighted is a post-v1 enhancement.

---

## 6. Metrics Aggregation

### Aggregated values (controller computes)

| Metric | Aggregation | Notes |
|--------|-------------|-------|
| `completed` | Sum across all workers | |
| `total` | Original plan total (NOT sum of split totals) | `i64` — preserve `-1` sentinel for time-based modes |
| `current_in_flight` | Sum across all workers | |
| `target_concurrency` | Original plan concurrency (un-split) | Display value for UI |
| `elapsed_ms` | Controller wall clock (not max of workers) | |
| `target_rps` | Original plan target (un-split) | |
| `actual_rps` | Sum of all worker actual_rps | |
| `dropped_requests` | Sum across all workers | |
| `breaker_tripped` | Any worker tripped → `true` | |
| Percentiles (p50–p999) | From merged HDR histogram | Statistically exact — standard approach (JMeter, Gatling, wrk2) |
| `min` (response time) | Min across all workers' `min_time` | |
| `max` (response time) | Max across all workers' `max_time` | |
| `avg` (response time) | `sum_response_time / total_count` | Weighted average — NOT average of averages |
| TPS | `merged total_count / controller_elapsed_sec` | Cumulative average — NOT sum of worker TPS values |

### HDR histogram merge correctness

HDR histograms with the same range and significant digits can be merged via `add()`.
The merged histogram produces correct percentiles for the combined distribution.
This is the standard approach used by HdrHistogram in JMeter, Gatling, and wrk2.

### Important: TPS is NOT summed

Each worker reports its own TPS as `worker_total_count / worker_elapsed_sec`. Summing these
would double-count if workers started at slightly different times. Instead, the controller
computes TPS from the merged total count divided by its own elapsed time — this gives
the true system-wide throughput.

---

## 7. Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| Network latency inflating perceived response times | Medium | Workers measure locally; latency is only in progress delivery, not in timing |
| Clock skew between controller and workers | Low | Workers send elapsed_ms relative to their own start; controller uses its own wall clock for combined elapsed |
| Worker binary size without Tauri | Low | `cargo build --bin redfireforge-worker` doesn't link Tauri/webview; should be ~10-15MB |
| WebSocket throughput bottleneck at high worker count | Medium | Progress batches are small JSON (~1KB per 100ms per worker); only a concern at >50 workers; gRPC upgrade path exists |
| Plan splitting producing uneven work distribution | Medium | v1 uses even split; weighted split is a post-v1 optimization; monitor per-worker completion times |
| Worker NAT traversal / firewall | Medium | v1 requires direct WebSocket connectivity; document port requirements; mDNS is future |
| Merged histogram precision loss | Low | HdrHistogram merge is mathematically exact for same-bound histograms (no precision loss) |
| Controller OOM from accumulating all worker results | Medium | Use `DetailLevel::Sampled` for distributed; final results merged from workers' sampled sets |
| No work redistribution on worker disconnect | Low (by design) | v1 accepts reduced throughput on disconnect; log warning; user can abort and retry |
| Deadlock in aggregation mutex | Low | Use `tokio::sync::Mutex` (async-aware); lock scope minimized |
| `ProgressBatch.total` sentinel (-1) corrupted by splitting | Medium | Aggregator preserves original plan's `total` value; never sums split workers' totals |
| Module visibility insufficient for worker binary | Medium | PR1 promotes `executor`, `arrival_executor`, `types` to `pub(crate)` or `pub`; worker imports via `app_lib` |

---

## 8. Files Created/Modified

### New files

| File | PR | Description |
|------|-----|-------------|
| `src-tauri/src/progress_sink.rs` | PR1 | ProgressSink trait + TauriProgressSink adapter |
| `src-tauri/src/distributed/mod.rs` | PR2 | Module root |
| `src-tauri/src/distributed/protocol.rs` | PR2 | ControllerMessage / WorkerMessage enums |
| `src-tauri/src/distributed/protocol_test.rs` | PR2 | Serde round-trip tests |
| `src-tauri/src/distributed/planner.rs` | PR4 | split_plan() |
| `src-tauri/src/distributed/planner_test.rs` | PR4 | Plan splitting tests |
| `src-tauri/src/distributed/worker.rs` | PR3 | Worker WebSocket client |
| `src-tauri/src/distributed/worker_test.rs` | PR3 | Worker lifecycle tests |
| `src-tauri/src/distributed/controller.rs` | PR4 | Controller WebSocket server |
| `src-tauri/src/distributed/controller_test.rs` | PR4 | Controller lifecycle tests |
| `src-tauri/src/distributed/aggregator.rs` | PR4 | ProgressAggregator |
| `src-tauri/src/distributed/aggregator_test.rs` | PR4 | Aggregation correctness tests |
| `src-tauri/src/worker_main.rs` | PR3 | Worker binary entry point |

### Modified files

| File | PR | Changes |
|------|-----|---------|
| `src-tauri/src/executor.rs` | PR1 | Replace `AppHandle` with `Arc<dyn ProgressSink>` in `run_pool`, `run_load_profile`; promote to `pub(crate)` |
| `src-tauri/src/arrival_executor.rs` | PR1 | Replace `AppHandle` with `Arc<dyn ProgressSink>` in `run_constant_arrival`; promote to `pub(crate)` |
| `src-tauri/src/commands.rs` | PR1, PR4 | Wrap AppHandle in TauriProgressSink; add distributed commands |
| `src-tauri/src/lib.rs` | PR1, PR2 | Add `pub mod progress_sink`, promote module visibility, `pub mod distributed` |
| `src-tauri/src/histogram.rs` | PR2 | Add `merge()` method |
| `src-tauri/src/histogram_test.rs` | PR2 | Add merge tests |
| `src-tauri/Cargo.toml` | PR3 | Add `[[bin]]`, `tokio-tungstenite`, `futures-util` |
| `src/shared/types/index.ts` | PR5 | WorkerInfo, WorkerCapabilities, DistributedConfig |
| `src/features/test-runner/utils/rustBridge.ts` | PR5 | startController, stopController, getConnectedWorkers |
| `src/features/test-runner/hooks/useRunnerConfig.ts` | PR5 | distributed state |
| `src/features/test-runner/hooks/runnerConfigDefaults.ts` | PR5 | DistributedConfig defaults on RunnerConfig, ResolvedConfig |
| `src/features/test-runner/utils/runnerProgressStorage.ts` | PR5 | workerCount on PersistedProgress |
| `src/features/test-runner/components/RunnerExecutionConfig.tsx` | PR5 | Distributed toggle, worker panel |
| `src/features/test-runner/components/LiveProgressPanel.tsx` | PR5 | Distributed badge, per-worker table |
| `src/engine/executor.ts` | PR5 | ProgressMeta.workerBreakdown, WorkerProgressSnapshot |

---

## 9. Testing Strategy

### Unit tests (Rust)

| Category | File | Count | Scope |
|----------|------|-------|-------|
| Protocol serde | `protocol_test.rs` | ~15 | All message variants round-trip |
| Histogram merge | `histogram_test.rs` | +5 | Merge correctness, edge cases |
| Plan splitting | `planner_test.rs` | ~20 | All modes × worker counts × edge cases |
| Aggregation | `aggregator_test.rs` | ~15 | Metric merge, partial batches, TPS recompute, `-1` total sentinel |
| Controller | `controller_test.rs` | ~15 | Worker lifecycle, abort, heartbeat |
| Worker | `worker_test.rs` | ~10 | Connection, execution, disconnect |

### Unit tests (TypeScript)

| Category | File | Count | Scope |
|----------|------|-------|-------|
| Config UI | `RunnerExecutionConfig.test.tsx` | +8 | Distributed toggle, worker table |
| Live panel | `LiveProgressPanel.test.tsx` | +4 | Distributed badge, per-worker rows |
| Bridge | `rustBridge.test.ts` | +5 | Distributed config mapping |

### Integration tests (manual / E2E)

| Scenario | Setup | Expected |
|----------|-------|----------|
| Single-machine distributed | Controller app + 0 external workers | Controller runs all work locally (as worker 0); identical to non-distributed |
| Two-machine pool test | Controller + 1 worker on LAN | Work split 50/50; aggregated metrics match; total concurrency = original |
| Three-machine arrival rate | Controller + 2 workers | Each gets target_rps/3; combined actual_rps ≈ target |
| Worker disconnect mid-run | Kill worker process during test | Controller logs warning, continues with remaining workers; metrics from surviving workers saved |
| Abort distributed test | Click ■ Stop during distributed run | All workers stop; partial results saved; P50/P95/P99/P99.9 available |

---

## 10. Open Questions

| # | Question | Options | Recommendation |
|---|----------|---------|----------------|
| 1 | Should workers be trusted with full plan (including URLs, headers, secrets)? | A: Yes (simpler). B: Controller proxies requests (slower). | A — workers are trusted internal machines; encrypt WebSocket with TLS for production |
| 2 | Should controller also run its own share? | A: Yes (always, as worker 0). B: No (pure coordinator). | A — avoids requiring external workers for basic use |
| 3 | Capability-weighted splitting in v1? | A: Even split only. B: Weighted by CPU cores. | A — simplicity first; weighted is post-v1 |
| 4 | Worker auto-discovery (mDNS)? | A: Manual endpoint only. B: mDNS in v1. | A — manual only; mDNS is complex and not critical |
| 5 | Should disconnected worker's work be redistributed? | A: No (accept reduced throughput). B: Reassign to remaining workers. | A — redistribution is complex; abort + retry is simpler |
| 6 | Per-worker charts in live dashboard? | A: Aggregated only. B: Per-worker sparklines. | A — aggregated for v1; per-worker adds N×5 chart complexity |
| 7 | WebSocket TLS? | A: Plain ws:// for v1. B: wss:// with self-signed certs. | A — LAN only for v1; TLS as post-v1 security enhancement |
| 8 | CLI distributed mode? | A: Desktop only. B: Also support `redfireforge-worker` as controller. | A — desktop only for v1; CLI controller is a separate feature |

---

## Timeline Estimate

| PR | Description | Effort | Dependencies |
|----|-------------|--------|--------------|
| PR1 | Executor Decoupling | 2–3 days | None (pure refactor) |
| PR2 | Protocol & Types | 2–3 days | PR1 (needs ProgressSink trait) |
| PR3 | Worker Binary | 5–7 days | PR1 + PR2 |
| PR4 | Controller | 7–10 days | PR1 + PR2 + PR3 |
| PR5 | Frontend UI | 5–7 days | PR4 (needs commands) |
| PR6 | Fault Tolerance | 3–5 days | PR3 + PR4 |
| **Total** | | **24–35 days** | **~4–6 weeks** |

PR1 and PR2 can be done in the first week. PR3 and PR4 are the critical path.
PR5 can start once PR4's commands are defined. PR6 can run in parallel with PR5.

```
Week 1: ─── PR1 ──── PR2 ───
Week 2: ────── PR3 (worker) ──────
Week 3: ──────── PR4 (controller) ────────
Week 4: ──── PR4 cont ──── PR5 (UI) ────
Week 5: ── PR5 cont ── PR6 (fault tol) ──
Week 6: ── PR6 ── Integration testing ────
```
