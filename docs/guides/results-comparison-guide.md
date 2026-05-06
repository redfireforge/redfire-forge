# Results Comparison Guide

Compare test runs to identify performance trends, regressions, and improvements over time.

## Overview

**Results comparison** helps you:
- Detect performance regressions
- Validate optimizations
- Track trends over time
- Establish baselines

## Comparing Two Runs

### Selecting Runs

1. Go to **Harness** → **Results**
2. Select first run from dropdown
3. Click **Compare**
4. Select second run to compare

### Comparison View

```
┌─────────────────────────────────────────────────────────────────┐
│ Comparison: Run #45 vs Run #42 (baseline)                       │
├─────────────────────────────────────────────────────────────────┤
│ Summary                                                         │
│ ┌─────────────┬──────────┬──────────┬──────────────────────────┤
│ │ Metric      │ Run #45  │ Run #42  │ Change                   │
│ ├─────────────┼──────────┼──────────┼──────────────────────────┤
│ │ TPS         │ 125      │ 115      │ ↑ +8.7% ✓               │
│ │ Avg Response│ 145ms    │ 165ms    │ ↓ -12.1% ✓              │
│ │ P95         │ 280ms    │ 320ms    │ ↓ -12.5% ✓              │
│ │ P99         │ 450ms    │ 520ms    │ ↓ -13.5% ✓              │
│ │ Error Rate  │ 1.2%     │ 2.1%     │ ↓ -0.9% ✓               │
│ └─────────────┴──────────┴──────────┴──────────────────────────┘
│                                                                 │
│ Overall: ✓ Performance Improved                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Metric Indicators

| Symbol | Meaning |
|--------|---------|
| ↑ (green) | Improved (higher is better, e.g., TPS) |
| ↓ (green) | Improved (lower is better, e.g., response time) |
| ↑ (red) | Regressed (higher is worse) |
| ↓ (red) | Regressed (lower is worse) |
| → | No significant change |

## Per-Test Comparison

### Detailed Breakdown

See changes at the test level:

```
┌────────────────────────────────────────────────────────────────┐
│ Per-Test Comparison                                            │
├────────────────┬───────────┬───────────┬───────────┬──────────┤
│ Test           │ Run #45   │ Run #42   │ Change    │ Status   │
├────────────────┼───────────┼───────────┼───────────┼──────────┤
│ List Users     │ 89ms      │ 95ms      │ -6.3%     │ ✓        │
│ Get User       │ 45ms      │ 48ms      │ -6.2%     │ ✓        │
│ Create User    │ 165ms     │ 152ms     │ +8.5%     │ ⚠️       │
│ Update User    │ 132ms     │ 145ms     │ -9.0%     │ ✓        │
│ Delete User    │ 78ms      │ 82ms      │ -4.9%     │ ✓        │
└────────────────┴───────────┴───────────┴───────────┴──────────┘
```

### Identifying Regressions

Tests with significant regressions are highlighted:

```
⚠️ Create User: +8.5% slower
   Run #45: 165ms (avg)
   Run #42: 152ms (avg)
   
   P95: 280ms → 310ms (+10.7%)
   P99: 380ms → 420ms (+10.5%)
```

## Baseline Management

### Setting a Baseline

Mark a run as the baseline for comparison:

1. Select a run
2. Click **Set as Baseline**
3. Future comparisons default to this baseline

### Baseline Indicators

```
Run #42 ★ (Baseline)
Run #43
Run #44
Run #45 (Current)
```

### Clearing Baseline

Remove baseline designation:

1. Click the baseline run
2. Click **Remove Baseline**

## Trend Analysis

### Viewing Trends

See performance over multiple runs:

```
Avg Response Time Trend (Last 10 Runs)

180ms │     ●
      │   ●   ●
160ms │ ●       ●
      │           ●
140ms │             ● ● ●
      │                   ●
120ms │─────────────────────────
      └─────────────────────────
        #36 #38 #40 #42 #44 #46
```

### Trend Indicators

| Pattern | Interpretation |
|---------|----------------|
| Downward slope | Improving |
| Upward slope | Degrading |
| Flat line | Stable |
| Sudden spike | Anomaly (investigate) |

### Time-Based Trends

View trends by date:

```
Performance: Last 30 Days
          Week 1   Week 2   Week 3   Week 4
TPS       120      118      125      130
Avg Resp  150ms    155ms    148ms    142ms
Errors    2.1%     2.3%     1.8%     1.5%
```

## Comparison Thresholds

### Configuring Thresholds

Set what constitutes a regression:

```
Thresholds:
  Response Time: > 10% = Warning, > 20% = Critical
  Error Rate: > 5% = Warning, > 10% = Critical
  TPS: < -10% = Warning, < -20% = Critical
```

### Threshold Indicators

```
Test: Create User
  Response Time: +8.5% (within threshold ✓)
  
Test: Delete User
  Response Time: +15.2% (⚠️ Warning)
  
Test: Get User
  Response Time: +25.1% (❌ Critical)
```

## Export Comparison

### Comparison Report

Export comparison as Markdown:

```markdown
# Performance Comparison Report

## Summary

| Metric | Current | Baseline | Change |
|--------|---------|----------|--------|
| TPS | 125 | 115 | +8.7% ✓ |
| Avg Response | 145ms | 165ms | -12.1% ✓ |

## Regressions

### Create User
- Current: 165ms
- Baseline: 152ms
- Change: +8.5%
- Impact: Medium

## Improvements

### List Users
- Current: 89ms
- Baseline: 95ms
- Change: -6.3%
```

### JSON Export

For programmatic analysis:

```json
{
  "comparison": {
    "current": { "runId": "45", "timestamp": "..." },
    "baseline": { "runId": "42", "timestamp": "..." }
  },
  "summary": {
    "tps": { "current": 125, "baseline": 115, "change": 8.7 },
    "avgResponse": { "current": 145, "baseline": 165, "change": -12.1 }
  },
  "perTest": [...]
}
```

## CI/CD Integration

### Automated Comparison

Compare against baseline in CI:

```bash
redfireforge run tests.yaml \
  --compare-baseline run-42.json \
  --fail-threshold 10
```

### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Pass (within thresholds) |
| 1 | Fail (exceeded thresholds) |
| 2 | Errors occurred |

### CI Report Example

```
Performance Test Results
========================

Compared to baseline (run-42):

  TPS:          125 (+8.7%)    ✓
  Avg Response: 145ms (-12.1%) ✓
  P95:          280ms (-12.5%) ✓
  Error Rate:   1.2% (-0.9%)   ✓

All metrics within acceptable thresholds.
```

## Best Practices

### 1. Establish a Good Baseline

Choose a baseline from:
- A stable release
- Before a significant change
- After performance optimization

### 2. Compare Like with Like

Ensure comparable conditions:
- Same test configuration
- Same environment
- Similar server load
- Same data set

### 3. Look at Multiple Metrics

Don't just compare averages:
- P95/P99 for tail latency
- Error rates
- Throughput (TPS)

### 4. Investigate Outliers

Sudden changes warrant investigation:
- Was there a code change?
- Did the environment change?
- Was there external load?

### 5. Track Trends Over Time

Single comparisons can be noisy:
- Look at 5-10 run trends
- Identify consistent patterns
- Distinguish noise from real changes

## Troubleshooting

### "No baseline set"

Set a baseline run first, or specify one explicitly.

### "Runs not comparable"

Runs may differ too much in:
- Test count
- Configuration
- Duration

### "Metrics missing"

Some metrics may not be available if:
- Tests were skipped
- Errors prevented measurement
- Different test versions

## Related Guides

- [Results Guide](./results-guide.md) — Results dashboard
- [Test Runner Guide](./test-runner-guide.md) — Running tests
- [CLI CI/CD Guide](./cli-ci-cd.md) — CI integration
