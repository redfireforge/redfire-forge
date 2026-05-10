# Choosing the Right Runner

RedfireForge provides **three specialized runners** for different testing scenarios. This guide helps you choose the right one for your needs.

## Quick Comparison

| Aspect | Test Runner | Parameterized Runner | Workflow Runner |
|--------|-------------|---------------------|-----------------|
| **Purpose** | Run standard scenario tests under load | Run data-driven scenarios with CSV/JSON data sources | Run workflow graphs under load |
| **Input** | Feature Groups → Standard Scenarios → Tests | Feature Groups → Parameterized Scenarios → Tests | Workflow definitions (visual graph) |
| **Data Source** | None (plain HTTP tests) | CSV/JSON data sources, shared data sources | Workflow variables (initial context) |
| **Execution** | Weighted random selection from test pool | Data-row expansion × iterations | Full graph traversal (conditions, forks, joins, loops) |
| **Host/Auth** | Configurable per environment/microservice | Same as Test Runner | Defined in workflow HTTP nodes or Service Registry |
| **Validation** | Per-test assertions, selective/full modes | Same as Test Runner | Per-step assertions in workflow |
| **Results Grouping** | Feature → Scenario → Test | Feature → Scenario → Test → Data Row | Iteration → Workflow Step |
| **Use Case** | API contract testing, regression suites | Data-driven testing with many input variations | End-to-end flow performance testing |

---

## When to Use Test Runner

### Best For:
- **API Contract Testing** — Validate that endpoints return expected responses
- **Regression Suites** — Run the same tests across multiple environments
- **Simple Load Testing** — Run N iterations with M concurrency
- **Microservice-Focused Testing** — Test individual services in isolation

### Key Features:
- Select specific feature groups and standard scenarios
- Choose validation mode (none, selective, full)
- Configure per-environment base URLs and auth
- Weight scenarios for realistic traffic distribution

### Example Use Cases:
```
✓ "Run all user API tests against staging"
✓ "Validate all endpoints return 200 OK under load"
✓ "Run regression suite for payment-service microservice"
```

---

## When to Use Parameterized Runner

### Best For:
- **Data-Driven Testing** — Test with many input variations (CSV/JSON)
- **Boundary Testing** — Validate edge cases systematically
- **Multi-User Simulation** — Different credentials/payloads per row
- **Tag-Based Filtering** — Run subsets of data rows by tag

### Key Features:
- Automatic data-row expansion: each row runs as a separate request
- Tag filtering for targeted testing
- Shared data sources across tests
- Execution plan preview showing row × iteration breakdown

### Example Use Cases:
```
✓ "Test the /orders endpoint with 100 different order payloads"
✓ "Run smoke-tagged rows only from 500-row data set"
✓ "Validate user registration with valid and invalid inputs"
```

---

## When to Use Workflow Runner

### Best For:
- **End-to-End Flow Testing** — Test complete user journeys
- **Orchestration Testing** — Test multi-step processes with dependencies
- **Conditional Logic Testing** — Test workflows with branching paths
- **Parallel Execution Testing** — Test fork/join patterns under load

### Key Features:
- Run entire workflow graphs under load
- Full topology support: conditions, forks, joins, loops, delays
- Per-iteration isolation (no state leakage between runs)
- Variable extraction and chaining between steps
- Per-step and per-iteration metrics

### Example Use Cases:
```
✓ "Run the order-to-fulfillment workflow 100 times"
✓ "Load test the payment flow with conditional retry logic"
✓ "Measure end-to-end latency of the checkout process"
```

---

## Feature Comparison

### Input & Configuration

| Feature | Test Runner | Parameterized Runner | Workflow Runner |
|---------|-------------|---------------------|-----------------|
| Input selection | Standard scenarios | Parameterized scenarios | Single workflow |
| Data source | None | CSV/JSON files, shared data sources | Workflow variables |
| Variable substitution | N/A | `{{column}}` from data rows | `{{variable}}` from context |
| Host override | Environment + Microservice | Same | Defined per step in workflow |
| Auth configuration | Inherited or per-test | Same | Service Registry or per-node |

### Execution Model

| Feature | Test Runner | Parameterized Runner | Workflow Runner |
|---------|-------------|---------------------|-----------------|
| Execution unit | Single HTTP request | Data-row-expanded HTTP request | Complete workflow iteration |
| Request selection | Weighted random from pool | All rows × iterations | Sequential graph traversal |
| Concurrency | Concurrent requests | Concurrent requests | Concurrent iterations |
| Branching | Not supported | Not supported | Condition/Switch nodes |
| Parallelism | Not supported | Not supported | Fork/Join nodes |
| Loops | Not supported | Via data source rows | Loop nodes with counters |

### Results & Metrics

| Feature | Test Runner | Parameterized Runner | Workflow Runner |
|---------|-------------|---------------------|-----------------|
| Primary grouping | Scenario name | Scenario name + Data row | Iteration index |
| Pass/fail granularity | Per-request | Per-request + per-row | Per-iteration + per-step |
| Metrics | TPS, response time, error rate | Same + per-row breakdown | Same + per-step + per-iteration |

---

## Decision Flowchart

```
                    ┌─────────────────────────┐
                    │ What are you testing?   │
                    └───────────┬─────────────┘
                                │
          ┌─────────────────────┼─────────────────────┐
          │                     │                     │
          ▼                     ▼                     ▼
 ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐
 │ Individual APIs │  │ APIs with many  │  │ Multi-step flows    │
 │ or endpoints    │  │ data variations │  │ with dependencies   │
 └────────┬────────┘  └────────┬────────┘  └──────────┬──────────┘
          │                    │                      │
          ▼                    ▼                      ▼
 ┌─────────────────┐  ┌──────────────────┐  ┌─────────────────────┐
 │   Test Runner   │  │  Parameterized   │  │  Workflow Runner    │
 │   (Standard)    │  │     Runner       │  │                     │
 └─────────────────┘  └──────────────────┘  └─────────────────────┘
```

---

## Common Patterns

### Pattern 1: API Regression Suite
**Runner:** Test Runner
**Setup:** Feature groups organized by service, standard scenarios by endpoint

### Pattern 2: Data-Driven API Validation
**Runner:** Parameterized Runner
**Setup:** Parameterized scenarios with CSV data sources, tag filtering for smoke vs. full

### Pattern 3: E2E Order Flow
**Runner:** Workflow Runner
**Setup:** Visual workflow with login → browse → add to cart → checkout → confirmation

### Pattern 4: Load Test Single Endpoint
**Runner:** Test Runner
**Setup:** Single standard scenario, high concurrency, high iteration count

### Pattern 5: Multi-Input Stress Test
**Runner:** Parameterized Runner
**Setup:** Large CSV data source (1000+ rows), moderate concurrency, targeted tags

### Pattern 6: Conditional Business Logic
**Runner:** Workflow Runner
**Setup:** Workflow with condition nodes branching based on response data

---

## Summary

| If you need... | Use |
|----------------|-----|
| Simple per-endpoint load testing | **Test Runner** |
| Data-driven testing with many variations | **Parameterized Runner** |
| Sequential multi-step flows | **Workflow Runner** |
| Tag-based test filtering with data | **Parameterized Runner** |
| End-to-end journey testing | **Workflow Runner** |
| Conditional branching under load | **Workflow Runner** |
| Microservice-specific regression | **Test Runner** |
| Variable chaining between requests | **Workflow Runner** |

All three runners share the same results infrastructure, so you can compare runs across all types in the Results dashboard.
