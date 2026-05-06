# Test Runner Guide

Configure and execute performance tests with the Test Runner — control concurrency, execution modes, and real-time monitoring.

## Overview

The **Test Runner** executes your scenarios as performance tests with:
- Configurable concurrency and transaction counts
- Multiple execution modes
- Real-time progress monitoring
- Detailed results and metrics

## Getting Started

1. Go to **Harness** → **Runner** tab
2. Select scenarios to run
3. Configure execution settings
4. Click **▶ Run Test**

## Execution Modes

### Sequential

Executes one request at a time, in order.

```
Request 1 → Wait → Request 2 → Wait → Request 3 → ...
```

**Use when:**
- Testing exact request sequences
- Target service can't handle concurrent load
- Debugging specific issues

**Settings:**
- Concurrency: Fixed to 1
- Transactions: Total requests to execute

### Batch

Fires N requests simultaneously, waits for all to complete, then fires the next N.

```
[Req 1, Req 2, Req 3, Req 4, Req 5] → Wait for all → [Req 6, Req 7, ...
```

**Use when:**
- Testing specific concurrent load levels
- Simulating periodic batch operations

**Settings:**
- Concurrency: N requests per batch
- Transactions: Total requests to execute

### Continuous Pool

Maintains exactly N requests in-flight at all times. When any request completes, a new one starts immediately.

```
[Req 1, Req 2, Req 3, Req 4, Req 5]
   ↓ (Req 2 completes)
[Req 1, Req 6, Req 3, Req 4, Req 5]
   ↓ (Req 4 completes)
[Req 1, Req 6, Req 3, Req 7, Req 5]
```

**Use when:**
- Maximum throughput testing
- Realistic continuous load simulation

**Settings:**
- Concurrency: N parallel requests
- Transactions: Total requests to execute

### Load Profile

Time-based execution with configurable patterns (ramp up, constant, spike).

```
Ramp Up (30s)    Constant (60s)    Ramp Down (30s)
     ╱──────────────────────────────╲
    ╱                                ╲
───╱                                  ╲───
```

**Use when:**
- Simulating realistic traffic patterns
- Stress testing with gradual load increase
- Testing system recovery

**Settings:**
- Duration: Total test duration
- Profile shape: Ramp up/down, constant, spike

### Workflow

Executes a workflow graph as a performance test. See [Workflow Runner Guide](./workflow-runner-guide.md).

## Configuration Options

### Core Settings

| Setting | Description | Default |
|---------|-------------|---------|
| **Concurrency** | Parallel requests | 1 |
| **Transactions** | Total requests | 10 |
| **Timeout** | Per-request timeout (seconds) | 30 |

### Retry Settings

| Setting | Description | Default |
|---------|-------------|---------|
| **Retries** | Retry count on failure | 0 |
| **Retry Delay** | Delay between retries (ms) | 0 |

### Error Policy

| Policy | Behavior |
|--------|----------|
| **Continue** | Ignore errors, keep running |
| **Stop First** | Stop on first failure |
| **Threshold** | Stop when error rate exceeds limit |

For **Threshold** mode:
- **Max Errors**: Stop after N errors
- **Max Error Rate**: Stop at X% error rate

### Host Selection

| Option | Behavior |
|--------|----------|
| **Original** | Use URL as defined in test |
| **Settings** | Replace host with environment's base URL |
| **Custom** | Use a specific custom URL |

### Skip Validation

Toggle to disable response validation for pure throughput testing.

### Unordered Arrays

Toggle to match array items regardless of order during validation.

## Scenario Selection

### Selecting Tests

- Check individual scenarios to include them
- Use **Select All** to include everything
- Deselected scenarios are skipped

### Test Weights

Adjust relative frequency of tests:

| Test | Weight | ~Distribution |
|------|--------|---------------|
| List Users | 5 | 50% |
| Get User | 3 | 30% |
| Create User | 2 | 20% |

Weight `0` = skip without deselecting.

## Think Time

Add realistic delays between requests to simulate user behavior:

| Mode | Behavior |
|------|----------|
| **None** | No delays |
| **Constant** | Fixed delay (e.g., 1000ms) |
| **Uniform** | Random delay in range (e.g., 500-1500ms) |
| **Gaussian** | Normal distribution around mean |

## Live Progress

### Progress Bar

```
Progress: ████████████░░░░░░░░ 60% (600/1000)
```

### Real-Time Metrics

| Metric | Description |
|--------|-------------|
| **TPS** | Current transactions per second |
| **Avg Response** | Running average response time |
| **Error Rate** | Current error percentage |

### Context Tags

Tags show active configuration:

```
[Pool] [C:10] [T:1000] [Settings Host] [Think: 500ms]
```

## Stopping a Run

Click **■ Stop** to abort:
- In-flight requests complete
- Results up to that point are saved
- Partial metrics available

The run may also stop automatically:
- **Circuit breaker** triggered (error policy)
- All transactions completed
- Timeout reached

## After the Run

### Auto-Navigate to Results

After completion, automatically shows the Results dashboard with:
- Summary metrics
- Pass/fail breakdown
- Individual request details

### Run History

Previous runs are saved and selectable from the Results dropdown.

## Tips & Best Practices

### 1. Start Small

Begin with low concurrency/transactions, then scale up:

```
First: C:1, T:10 (validation)
Then:  C:5, T:100 (small load)
Then:  C:20, T:1000 (medium load)
Finally: C:50, T:5000 (stress test)
```

### 2. Use Think Time for Realism

Real users don't fire requests continuously:

```
100 concurrent users with 2s think time
≈ 50 TPS sustained load
```

### 3. Monitor Error Rate

Stop tests if errors spike — continued load with failures wastes resources.

### 4. Use Skip Validation for Throughput

When testing pure performance, disable validation:
- Removes CPU overhead
- Higher achievable TPS
- Still captures HTTP errors

### 5. Validate Before Load Testing

Always run a quick sequential test first:

```
C:1, T:5, Mode: Sequential
```

Confirms tests work before applying load.

### 6. Use Appropriate Timeouts

- Too short: False failures on slow endpoints
- Too long: Tests take forever to fail
- Recommended: 2-3x expected response time

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + Enter` | Start run |
| `Esc` | Stop run |

## Related Guides

- [Scenarios Guide](./scenarios-guide.md) — Organize tests
- [Results Guide](./results-guide.md) — Analyze results
- [Runners Comparison](./runners-comparison.md) — Test Runner vs Workflow Runner
- [Workflow Runner Guide](./workflow-runner-guide.md) — Workflow-based testing
