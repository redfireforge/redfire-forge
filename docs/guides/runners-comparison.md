# Test Runner vs Workflow Runner

RedfireForge provides two specialized runners for different testing scenarios. This guide helps you choose the right one for your needs.

## Quick Comparison

| Aspect | Test Runner | Workflow Runner |
|--------|-------------|-----------------|
| **Purpose** | Run scenario-based tests with data-driven parameterization | Run workflow graphs under load with full topology |
| **Input** | Feature Groups → Scenarios → Tests | Workflow definitions (visual graph) |
| **Data Source** | CSV/JSON data sources, shared data sources | Workflow variables (initial context) |
| **Execution** | Weighted random selection from test pool | Full graph traversal (conditions, forks, joins, loops) |
| **Host/Auth** | Configurable per environment/microservice | Defined in workflow HTTP nodes or Service Registry |
| **Validation** | Per-test assertions, selective/full modes | Per-step assertions in workflow |
| **Results Grouping** | Feature → Scenario → Test → Data Row | Iteration → Workflow Step |
| **Use Case** | API contract testing, regression suites | End-to-end flow performance, orchestration testing |

---

## When to Use Test Runner

### Best For:
- **API Contract Testing** — Validate that endpoints return expected responses
- **Regression Suites** — Run the same tests across multiple environments
- **Data-Driven Testing** — Test with many input variations (CSV/JSON data sources)
- **Microservice-Focused Testing** — Test individual services in isolation
- **Simple Load Testing** — Run N requests with M concurrency

### Key Features:
- Select specific feature groups, scenarios, or individual tests
- Apply data sources with tag filtering
- Choose validation mode (none, selective, full)
- Configure per-environment base URLs and auth
- Weight scenarios for realistic traffic distribution

### Example Use Cases:
```
✓ "Run all user API tests against staging"
✓ "Test the /orders endpoint with 100 different order payloads"
✓ "Validate all endpoints return 200 OK under load"
✓ "Run regression suite for payment-service microservice"
```

---

## When to Use Workflow Runner

### Best For:
- **End-to-End Flow Testing** — Test complete user journeys
- **Orchestration Testing** — Test multi-step processes with dependencies
- **Conditional Logic Testing** — Test workflows with branching paths
- **Parallel Execution Testing** — Test fork/join patterns under load
- **Complex Integration Testing** — Test workflows that span multiple services

### Key Features:
- Run entire workflow graphs under load (not just HTTP requests)
- Full topology support: conditions, forks, joins, loops, delays
- Per-iteration isolation (no state leakage between runs)
- Variable extraction and chaining between steps
- Per-step and per-iteration metrics

### Example Use Cases:
```
✓ "Run the order-to-fulfillment workflow 100 times"
✓ "Load test the payment flow with conditional retry logic"
✓ "Test the parallel notification dispatch workflow"
✓ "Measure end-to-end latency of the checkout process"
```

---

## Feature Comparison

### Input & Configuration

| Feature | Test Runner | Workflow Runner |
|---------|-------------|-----------------|
| Input selection | Feature groups, scenarios, tests | Single workflow |
| Data source | CSV/JSON files, shared data sources | Workflow variables |
| Variable substitution | `{{column}}` from data rows | `{{variable}}` from context |
| Host override | Environment + Microservice dropdown | Defined per step in workflow |
| Auth configuration | Inherited or per-test | Service Registry or per-node |

### Execution Model

| Feature | Test Runner | Workflow Runner |
|---------|-------------|-----------------|
| Execution unit | Single HTTP request | Complete workflow iteration |
| Request selection | Weighted random from pool | Sequential graph traversal |
| Concurrency | Concurrent requests | Concurrent iterations |
| Branching | Not supported | Condition nodes, Switch nodes |
| Parallelism | Not supported | Fork/Join nodes |
| Loops | Via data source rows | Loop nodes with counters |
| Delays | Not supported | Delay nodes (fixed/random) |
| Variable extraction | Post-request extractions | Extractions + node-to-node chaining |

### Results & Metrics

| Feature | Test Runner | Workflow Runner |
|---------|-------------|-----------------|
| Primary grouping | Scenario name | Iteration index |
| Secondary grouping | Data row | Workflow step |
| Pass/fail granularity | Per-request | Per-iteration + per-step |
| Metrics | TPS, response time, error rate | Same + per-step + per-iteration |
| Charts | Response time over time | Iteration performance chart |

---

## Results Interpretation

### Test Runner Results

Results are grouped by **scenario** and optionally by **data row**:

```
Results
├── GET /users (500 requests, 98% pass, avg 45ms)
│   ├── Row: admin-user (100 requests, 100% pass)
│   ├── Row: regular-user (100 requests, 95% pass)
│   └── ...
├── POST /orders (500 requests, 100% pass, avg 120ms)
└── ...
```

**Key questions answered:**
- Which endpoint is slowest?
- Which data rows are failing?
- What's the overall error rate per scenario?

### Workflow Runner Results

Results are grouped by **iteration** and **step**:

```
Workflow Execution Summary
├── Iteration Performance Chart (bar chart, pass/fail per iteration)
├── Per-Step Metrics
│   ├── Step 1: Get User (100 runs, avg 45ms, p95 80ms)
│   ├── Step 2: Create Order (100 runs, avg 120ms, p95 200ms)
│   └── ...
└── Per-Iteration Detail
    ├── Iteration #1: 250ms total, 3/3 passed
    ├── Iteration #2: 280ms total, 3/3 passed
    └── ...
```

**Key questions answered:**
- How long does a complete workflow take?
- Which step is the bottleneck?
- Which iterations failed and why?

---

## Migration Guide

### From Test Runner to Workflow Runner

If you have a sequence of tests that should run in order:

**Before (Test Runner):**
```yaml
tests:
  - name: Get User
    url: /users/1
  - name: Create Order
    url: /orders
    body: '{"userId": 1}'
  - name: Get Order
    url: /orders/{{orderId}}
```
⚠️ Tests run in random order, no variable chaining

**After (Workflow Runner):**
```
[Start] → [Get User] → [Create Order] → [Get Order] → [End]
                            ↓
                    Extract: orderId
```
✅ Sequential execution, variable extraction between steps

### From Workflow Runner to Test Runner

If you need to test endpoints independently with many data variations:

**Before (Workflow Runner):**
- Single workflow with 3 HTTP nodes
- Limited to workflow variables

**After (Test Runner):**
- 3 separate test scenarios
- Each with its own data source (100+ rows)
- Tag filtering for targeted testing

---

## Decision Flowchart

```
                    ┌─────────────────────────┐
                    │ What are you testing?   │
                    └───────────┬─────────────┘
                                │
              ┌─────────────────┴─────────────────┐
              │                                   │
              ▼                                   ▼
    ┌─────────────────┐               ┌─────────────────────┐
    │ Individual APIs │               │ Multi-step flows    │
    │ or endpoints    │               │ with dependencies   │
    └────────┬────────┘               └──────────┬──────────┘
             │                                   │
             ▼                                   ▼
    ┌─────────────────┐               ┌─────────────────────┐
    │ Need many data  │               │ Need branching,     │
    │ variations?     │               │ loops, or parallel? │
    └────────┬────────┘               └──────────┬──────────┘
             │                                   │
      Yes ───┴─── No                      Yes ───┴─── No
        │         │                         │         │
        ▼         ▼                         ▼         ▼
   ┌─────────┐ ┌─────────┐           ┌───────────┐ ┌─────────┐
   │  Test   │ │  Test   │           │ Workflow  │ │  Either │
   │ Runner  │ │ Runner  │           │  Runner   │ │  works  │
   │ + Data  │ │ (basic) │           │           │ │         │
   └─────────┘ └─────────┘           └───────────┘ └─────────┘
```

---

## Common Patterns

### Pattern 1: API Regression Suite
**Runner:** Test Runner  
**Setup:** Feature groups organized by service, scenarios by endpoint, data sources for edge cases

### Pattern 2: E2E Order Flow
**Runner:** Workflow Runner  
**Setup:** Visual workflow with user login → browse → add to cart → checkout → confirmation

### Pattern 3: Load Test Single Endpoint
**Runner:** Test Runner  
**Setup:** Single scenario, high concurrency, no data source

### Pattern 4: Stress Test Complete Journey
**Runner:** Workflow Runner  
**Setup:** Workflow with realistic user flow, high iteration count, moderate concurrency

### Pattern 5: Contract Testing with Variations
**Runner:** Test Runner  
**Setup:** Assertions for response schema, data source with valid/invalid inputs, tag filtering

### Pattern 6: Conditional Business Logic
**Runner:** Workflow Runner  
**Setup:** Workflow with condition nodes branching based on response data

---

## Summary

| If you need... | Use |
|----------------|-----|
| Data-driven testing with many variations | **Test Runner** |
| Sequential multi-step flows | **Workflow Runner** |
| Per-endpoint load testing | **Test Runner** |
| End-to-end journey testing | **Workflow Runner** |
| Conditional branching under load | **Workflow Runner** |
| Microservice-specific testing | **Test Runner** |
| Variable chaining between requests | **Workflow Runner** |
| Tag-based test filtering | **Test Runner** |

Both runners share the same results infrastructure, so you can compare runs across both types in the Results dashboard.
