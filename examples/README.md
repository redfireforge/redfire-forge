# RedfireForge Examples

This directory contains sample configurations demonstrating various features of RedfireForge.

## API Mock Studio

See [`api-mock/README.md`](./api-mock/README.md) for `mock start` / `mock verify` / Docker / CI examples.

---

## Test Examples (CLI)

Simple test files for CLI execution with `npx redfireforge run <file>`:

### `sample-api-test.yaml`
Basic API testing with JSONPlaceholder API. Demonstrates:
- Multiple test steps
- JSON validation with JSONPath
- Test weights for load distribution

**Run:**
```bash
npx redfireforge run examples/sample-api-test.yaml -c 5 -i 20
```

### `auth-test.yaml`
Authentication scenarios including:
- Bearer token authentication
- Basic authentication
- API key in headers
- API key in query parameters

**Run:**
```bash
npx redfireforge run examples/auth-test.yaml --base-url https://httpbin.org
```

### `load-profile-test.yaml`
Load profile testing with staged execution patterns.

---

## Workflow Examples (GUI)

Complex workflow configurations for the Workflow Designer. Import these in the GUI or use them as templates.

### `webhook-trigger-workflow.yaml`
**Webhook-triggered order processing workflow**

Demonstrates:
- **Webhook trigger node**: Incoming order webhook with payload extraction
- **Variable extraction**: Extract orderId, customerId, totalAmount via JSONPath
- **Service registry**: Multiple API services with authentication
- **Conditional branching**: Check inventory stock levels
- **Multiple end states**: Success/failure paths

**Workflow:**
1. Webhook receives order → extracts order details
2. Check inventory availability
3. If in stock → Process order → Success
4. If out of stock → Send alert → Failure

**Key Features:**
- Demonstrates webhook payload variable extraction
- Shows how to use extracted variables in downstream HTTP calls
- Service-based URL management with auth profiles

### `schedule-trigger-workflow.yaml`
**Daily scheduled sales report generation**

Demonstrates:
- **Schedule trigger node**: Cron-based daily execution (9 AM EST)
- **Automatic time variables**: `triggerTime` (ISO), `triggerTimestamp` (epoch)
- **Input variables**: Pre-configured report parameters
- **Fork/Join nodes**: Parallel email delivery and archiving
- **Multi-step data flow**: Fetch → Generate → Deliver → Archive

**Workflow:**
1. Schedule triggers at 9 AM daily
2. Fetch sales data for previous day
3. Generate PDF report
4. Fork: Parallel execution
   - Branch A: Email report to recipients
   - Branch B: Archive to storage
5. Join: Wait for both branches
6. Complete

**Key Features:**
- Demonstrates cron expression configuration
- Uses automatic trigger time variables
- Shows fork/join parallel execution pattern
- Service-based architecture with multiple APIs

---

## Parameterized / Data Source Examples

### `parameterized-users.yaml`
Parameterized test example with inline data source. Demonstrates:
- Data-driven testing with `dataSource` configuration
- Column types: `param` (query parameter), `validate` (response assertion)
- Row tags: Categorize rows (e.g., `smoke`, `regression`, `edge-case`)
- Row labels and notes: Human-readable identifiers and annotations
- Distribution mode: `sequential`, `random`, or `roundRobin`

### `users-data.csv`
CSV data file for import as a data source. Demonstrates:
- Standard columns: `userId`, `name`, `validate:$.args.name`
- Special columns: `_tags` (semicolon-separated), `_label`, `_note`
- Row tagging patterns for filtering during test execution

**CSV Column Prefixes:**
| Prefix | Purpose |
|--------|---------|
| `path:` | Replace URL path variables (e.g., `path:id` → `/users/{{id}}`) |
| `param:` | Add query parameters (e.g., `param:q` → `?q=value`) |
| `header:` | Set request headers |
| `body:` | Replace body placeholders (e.g., `body:username`) |
| `validate:` | Assert response JSON path (e.g., `validate:$.name`) |
| `_tags` | Row tags (semicolon-separated, e.g., `smoke;critical`) |
| `_label` | Human-readable row label |
| `_note` | Row annotation/comment |
| `_enabled` | Enable/disable row (`true`/`false`) |

### `json-data-simple.json`
Simple JSON data file for import as a data source — flat array of objects.

### `json-data-structured.json`
Structured JSON data file for import — nested objects demonstrating how the importer handles complex JSON shapes.

---

## Workflow Examples (Additional)

Beyond the trigger examples above, these cover various workflow patterns:

### Easy Workflows
| File | Description |
|------|-------------|
| `easy-user-lookup-workflow.yaml` | Simple user lookup with HTTP node + variable extraction |
| `easy-payment-callback-workflow.yaml` | Payment callback with webhook and conditional paths |
| `easy-script-formatter-workflow.yaml` | Script node formatting JSON data |

### Medium Workflows
| File | Description |
|------|-------------|
| `medium-approval-workflow.yaml` | Multi-step approval with conditional branching |
| `medium-order-processing-workflow.yaml` | E-commerce order processing pipeline |
| `medium-cicd-build-callback-workflow.yaml` | CI/CD build trigger with webhook callback |
| `medium-script-validator-workflow.yaml` | Data validation using script nodes |

### Hard / Advanced Workflows
| File | Description |
|------|-------------|
| `hard-multi-region-deploy-workflow.yaml` | Multi-region deployment with parallel fork/join |
| `hard-parallel-payment-workflow.yaml` | Parallel payment processing across providers |
| `hard-script-data-pipeline-workflow.yaml` | ETL data pipeline using script nodes |

### Pattern-Specific Workflows
| File | Description |
|------|-------------|
| `conditional-retry-polling-workflow.yaml` | Retry loops with conditional exit |
| `deployment-pipeline-workflow.yaml` | Full deployment pipeline with rollback |
| `expression-functions-workflow.yaml` | Expression evaluation with built-in functions |
| `loop-aggregate-workflow.yaml` | Loop over items and aggregate results |
| `multi-api-aggregation-workflow.yaml` | Aggregate data from multiple API endpoints |
| `multi-region-healthcheck-workflow.yaml` | Health checks across multiple regions |
| `switch-routing-workflow.yaml` | Switch node for multi-path routing |
| `batch-user-provisioning-workflow.yaml` | Batch user creation with loop + error handling |

---

## Assertion Examples

Assertion preset examples demonstrating structured JSON body assertions (array length, numeric compare, date compare). Each corresponds to an in-app gallery preset and training manual.

### `assertion-api-healthcheck.yaml`
**Easy** — Verify a health endpoint returns 2xx and lists at least one service.
- Status code assertion + array length check on `$.services`

### `assertion-paginated-list.yaml`
**Easy** — Validate a paginated API returns items on the first page with a valid total.
- Array length on `$.data`, numeric checks on `$.page` and `$.total`

### `assertion-token-expiry.yaml`
**Medium** — Verify an auth endpoint returns a valid JWT token that hasn't expired.
- Regex on `$.token` (JWT format), date compare on `$.expiresAt` vs today, numeric on `$.expiresIn`

### `assertion-price-guard.yaml`
**Medium** — Validate a product API returns reasonable prices and at least one variant.
- Numeric range on `$.price` (> 0, < 10000), array length on `$.variants`

### `assertion-api-contract.yaml`
**Advanced** — Full contract validation with exact values, ranges, and format checks.
- Equals, numeric range, regex on JSONPlaceholder `/todos/1`

**Run:**
```bash
npx redfireforge run examples/assertion-api-healthcheck.yaml
npx redfireforge run examples/assertion-price-guard.yaml
```

---

## Usage

### CLI Examples
```bash
# Run with default settings
npx redfireforge run examples/sample-api-test.yaml

# Run with custom concurrency and iterations
npx redfireforge run examples/sample-api-test.yaml -c 10 -i 100

# Run with custom base URL
npx redfireforge run examples/auth-test.yaml --base-url https://your-api.com
```

### Workflow Examples
1. Open RedfireForge GUI
2. Navigate to **Workflow** tab
3. Click **Import** or **New Workflow**
4. Copy/paste the YAML content or use as a reference template
5. Modify service URLs and authentication to match your environment
6. Click **Run** to execute in simulate mode

---

## Environment Variables

For webhook and schedule examples, set these environment variables or configure them in the service registry:

```bash
export INVENTORY_API_TOKEN="your-inventory-token"
export ORDERS_API_KEY="your-orders-key"
export ANALYTICS_API_TOKEN="your-analytics-token"
export EMAIL_API_KEY="your-email-key"
```

---

## Notes

### Webhook Triggers
- **Simulate mode**: Uses `samplePayload` for variable extraction
- **Production mode** (Phase 5): Will receive actual HTTP requests
- **JSONPath extraction**: Supports nested object navigation (e.g., `$.data.items[0].id`)

### Schedule Triggers
- **Cron format**: Standard 5-field cron expressions (minute hour day month weekday)
- **Timezone**: IANA timezone identifiers (e.g., `America/New_York`, `UTC`)
- **Auto variables**: `triggerTime` (ISO date), `triggerTimestamp` (Unix epoch)
- **Input variables**: Pre-configured key-value pairs for parameterized runs

### Service Registry
- Centralized URL and auth management
- Per-environment endpoint configuration
- Supports Bearer, Basic, API Key authentication
- Microservice linking for auto-populated URLs

---

## More Information

- [Trigger Nodes Design](../docs/workflow/trigger-nodes-design.md)
- [Workflow Documentation](../docs/workflow/)
- [CLI Documentation](../README.md)
