# Results Guide

Analyze test results with the Results Dashboard — metrics, filtering, grouping, and export options.

## Overview

The **Results Dashboard** displays:
- Summary metrics (TPS, response times, error rates)
- Response time distribution
- Grouped request details
- Historical run comparison

## Accessing Results

### After a Test Run

Results automatically display after a test completes.

### Historical Runs

1. Go to **Harness** → **Results** tab
2. Select a run from the dropdown
3. Runs are filtered by environment and microservice

## Summary Metrics

### Row 1: Performance Metrics

| Metric | Description |
|--------|-------------|
| **TPS** | Requests per second |
| **TPM** | Requests per minute |
| **TPH** | Requests per hour |
| **Avg Response** | Mean response time |
| **Min / Max** | Fastest and slowest response |

### Row 2: Quality Metrics

| Metric | Description |
|--------|-------------|
| **P95** | 95th percentile response time |
| **P99** | 99th percentile response time |
| **Error Rate** | Percentage of failed requests |
| **Total Duration** | Wall-clock run time |
| **Total Requests** | Number of requests executed |
| **Validation Failures** | Requests that failed assertions |

### Context Tags

Tags show run configuration:

```
[Staging] [user-service] [Pool] [C:10] [T:1000]
```

## Response Time Distribution

A histogram shows response time distribution:

```
     │ ████
     │ ████████
Freq │ ████████████
     │ ████████████████
     │ ████████████████████
     └─────────────────────────
       0   100  200  300  400  500ms
```

Hover over bars for exact counts.

## Request Details

### Grouping Options

Group results by:

| Group By | Description |
|----------|-------------|
| **Feature** | Group by Feature Group |
| **Scenario** | Group by Scenario |
| **Test** | Group by Test name |
| **URL** | Group by request URL |
| **Status** | Group by HTTP status code |

### Nested Grouping

Apply two levels:

```
Group By: Feature → Then By: Scenario

User Management
  ├── User Registration (45 requests)
  │     ├── ✓ 42 passed
  │     └── ✗ 3 failed
  └── User Login (30 requests)
        └── ✓ 30 passed
```

### Per-Group Stats

Each group shows:
- Total requests
- Passed count
- Failed count
- Validation failures
- Avg / Min / Max response times

### Expanding Groups

Click a group to see individual requests:

```
▼ User Registration
  ┌─────────────────────────────────────────────────────┐
  │ Test      │ URL           │ Status │ Time  │ Result │
  ├───────────┼───────────────┼────────┼───────┼────────┤
  │ Create    │ POST /users   │ 201    │ 145ms │ ✓      │
  │ Verify    │ POST /verify  │ 200    │ 89ms  │ ✓      │
  │ Create    │ POST /users   │ 400    │ 52ms  │ ✗      │
  └─────────────────────────────────────────────────────┘
```

## Filtering

### Status Filter

| Filter | Shows |
|--------|-------|
| **All** | All requests |
| **Passed** | Only successful requests |
| **Failed** | Only failed requests |

### Search

Search by:
- Test name
- URL
- Feature group
- Scenario
- Error message

```
Search: "timeout"
→ Shows requests with "timeout" in name, URL, or error
```

### Run Type Filter

Filter between regular tests and workflow runs:

| Filter | Shows |
|--------|-------|
| **All** | Both test and workflow runs |
| **Tests** | Regular test runs only |
| **Workflows** | Workflow runs only |

## Error Details

### Error Snippets

Failed requests show error snippets:

```
[HTTP Error] Connection refused
[Validation] Expected $.status=200, got 500
[Timeout] Request timed out after 10s
```

### Response Detail Modal

Click an error snippet to see full details:

```
┌─────────────────────────────────────────────────────┐
│ Response Detail                              [✕]    │
├─────────────────────────────────────────────────────┤
│ POST Create User                                    │
│ Status: 400 Bad Request                             │
│ Time: 52ms                                          │
│ URL: https://api.example.com/users                  │
├─────────────────────────────────────────────────────┤
│ Error: Validation Failed                            │
│                                                     │
│ Assertion Failures:                                 │
│ ┌───────────┬──────────┬──────────┐                │
│ │ Path      │ Expected │ Actual   │                │
│ ├───────────┼──────────┼──────────┤                │
│ │ $.status  │ 201      │ 400      │                │
│ │ $.data.id │ exists   │ missing  │                │
│ └───────────┴──────────┴──────────┘                │
├─────────────────────────────────────────────────────┤
│ Response Body:                                      │
│ {                                                   │
│   "error": "Validation failed",                     │
│   "details": ["email is required"]                  │
│ }                                                   │
└─────────────────────────────────────────────────────┘
```

## Workflow Results

### Workflow Execution Summary

For workflow runs, an additional summary shows:

```
┌─────────────────────────────────────────────────────┐
│ Workflow Execution Summary                          │
├─────────────────────────────────────────────────────┤
│ Iterations: 50    │ Steps: 5     │ Pass Rate: 96%  │
├─────────────────────────────────────────────────────┤
│ Per-Step Metrics:                                   │
│ ┌──────────────┬───────┬────────┬────────┐         │
│ │ Step         │ Avg   │ P95    │ Pass % │         │
│ ├──────────────┼───────┼────────┼────────┤         │
│ │ Create User  │ 145ms │ 250ms  │ 100%   │         │
│ │ Get Token    │ 89ms  │ 150ms  │ 100%   │         │
│ │ Update Prof  │ 132ms │ 220ms  │ 92%    │         │
│ └──────────────┴───────┴────────┴────────┘         │
└─────────────────────────────────────────────────────┘
```

### Iteration Chart

A chart shows per-iteration response times:

```
Response Time (ms)
     │    ●
 300 │  ●   ●      ●
     │ ● ●   ●  ● ●  ●
 200 │●   ● ●  ● ● ●  ● ●
     │      ●●      ●   ●●
 100 │               ●
     └────────────────────────
       1  5  10  15  20  25  30
              Iteration
```

### Per-Iteration Details

Expand to see individual iteration results:

```
▼ Iteration 5 (failed)
  Step 1: Create User → 145ms ✓
  Step 2: Get Token → 89ms ✓
  Step 3: Update Profile → 132ms ✗ (timeout)
```

## Export Options

### Export JSON

Full run data as structured JSON:

```json
{
  "id": "run-123",
  "timestamp": "2024-01-15T10:30:00Z",
  "config": { ... },
  "summary": { ... },
  "results": [ ... ]
}
```

**Use for:** Programmatic analysis, import into other tools

### Export CSV

Flat table format:

```csv
timestamp,test,url,method,status,time_ms,passed
2024-01-15T10:30:01Z,Create User,/users,POST,201,145,true
2024-01-15T10:30:01Z,Get User,/users/1,GET,200,89,true
```

**Use for:** Spreadsheet analysis, Excel pivot tables

### Export Markdown

Human-readable summary:

```markdown
# Test Run Summary

**Date:** 2024-01-15 10:30:00
**Duration:** 45.2s
**Total Requests:** 1000

## Metrics

| Metric | Value |
|--------|-------|
| TPS | 22.1 |
| Avg Response | 145ms |
| P95 | 280ms |
| Error Rate | 2.3% |
```

**Use for:** Reports, documentation, sharing

### Export to File

1. Click **Export JSON**, **Export CSV**, or **Export Markdown**
2. Native save dialog appears
3. Choose location and filename

## Run Management

### Deleting Runs

1. Select a run
2. Click **Delete** button
3. Confirm deletion

### Storage Limits

- Default: 50 runs stored
- Configurable in Settings (1-500)
- Oldest runs auto-deleted when limit exceeded

### Run Metadata

Each run stores:
- Timestamp
- Configuration (mode, concurrency, etc.)
- Environment and microservice
- All request results
- Summary metrics

## Tips & Best Practices

### 1. Check Error Rate First

High error rate often indicates configuration issues:
- Wrong auth
- Invalid URLs
- Server overload

### 2. Use Grouping for Patterns

Group by Status to quickly find:
- Which status codes are occurring
- Distribution of successes vs failures

### 3. Compare Percentiles

If P99 >> P95, there are significant outliers:
- May indicate occasional timeouts
- Or specific requests that are slow

### 4. Export for Deep Analysis

For complex analysis:
- Export CSV
- Use Excel or Python
- Create custom charts

### 5. Filter Before Exporting

Apply filters first:
- Export only failed requests
- Export only specific tests
- Reduces data volume

## Related Guides

- [Test Runner Guide](./test-runner-guide.md) — Running tests
- [Workflow Runner Guide](./workflow-runner-guide.md) — Workflow testing
- [Results Export Guide](./results-export-guide.md) — Export formats
