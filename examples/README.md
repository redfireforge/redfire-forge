# RedfireForge Examples

This directory contains sample configurations demonstrating various features of RedfireForge.

## Test Examples (CLI)

Simple test files for CLI execution with `npx redfireforge run <file>`:

### `sample-api-test.yaml`
Basic API testing with JSONPlaceholder API. Demonstrates:
- Multiple test steps
- JSON validation with JSONPath
- Test weights for load distribution

**Run:**
```bash
npx redfireforge run examples/sample-api-test.yaml -c 5 -t 20
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

# Run with custom concurrency and transactions
npx redfireforge run examples/sample-api-test.yaml -c 10 -t 100

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
