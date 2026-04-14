---
name: generate-csv-template
description: >-
  Generate CSV test templates from PostgreSQL MCP databases for RedfireForge import.
  Use when the user asks to create CSV samples, generate test templates from database,
  populate CSV from t01/p01/prod, or create importable test data from event_msg_publish.
---

# Generate CSV Template from PostgreSQL

Generate importable CSV test templates for RedfireForge by querying PostgreSQL
databases via MCP tools. Supports any environment (t01, p01, prod, etc.).

## Prerequisites

- A PostgreSQL MCP server must be connected (e.g., `user-pg-t01`, `user-pg-p01`)
- The database must have the `spaa.event_msg_publish` table

## Workflow

### Step 1: Identify the MCP Server

Ask which environment/database to use. Available MCP servers follow the naming
pattern `user-pg-{env}`. Check available servers in the MCP folder:

```
/Users/dz5jxr/.cursor/projects/Users-dz5jxr-workspace-gmai-performance-test/mcps/
```

### Step 2: Discover the Schema

If column names are unknown, query the schema first:

```sql
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'spaa' AND table_name = 'event_msg_publish'
ORDER BY ordinal_position
```

Key columns (as of April 2026):
- `vin_nbr` — VIN
- `status_cd` — SUCCESS / FAILURE
- `content_payload_val` — bytea, must use `convert_from(..., 'UTF8')` to read
- `addl_properties_val` — JSON with environment info
- `created_timstm` — timestamp

### Step 3: Query the Data

```sql
SELECT vin_nbr,
       convert_from(content_payload_val, 'UTF8') as payload,
       created_timstm
FROM spaa.event_msg_publish
WHERE status_cd = 'SUCCESS'
  AND convert_from(content_payload_val, 'UTF8') LIKE '%associatedOfferingCode%'
ORDER BY created_timstm DESC
LIMIT 300
```

**Important**: The `content_payload_val` column is `bytea` — always wrap with
`convert_from(..., 'UTF8')`.

### Step 4: Save Raw Data

Save the MCP query result to a temp file for processing:

```
/Users/dz5jxr/workspace/gmai/performance-test/_raw_{env}.json
```

### Step 5: Generate CSV via Script

Run the generator script (see [scripts/generate.cjs](scripts/generate.cjs)):

```bash
cd /Users/dz5jxr/workspace/gmai/performance-test
ENV=t01 COUNT=100 node scripts/generate-csv-from-db.cjs
```

Or create a one-off script in `scripts/` if parameters differ from defaults.

### Step 6: Clean Up

Delete the temp `_raw_{env}.json` file after generation.

## CSV Template Format

The generated CSV must follow this exact format for RedfireForge import:

### Line 1 — Metadata (JSON comment)

```
#META:{"version":1,"method":"GET","urlPattern":"https://...{{vin}}.../vehiclePurchaseOffers","headers":[{"key":"Accept-Language","value":"en-US"},{"key":"Content-Type","value":"application/json"}],"body":"","auth":{"type":"inherit"},"validationMode":"selective","unorderedArrays":true,"pathVariables":["vin"]}
```

Key metadata fields:
- `urlPattern` — URL with `{{variable}}` placeholders matching `pathVariables`
- `validationMode` — `"selective"` for field-level validation
- `unorderedArrays` — `true` to match array items by value, not position
- `auth.type` — `"inherit"` to use scenario-level auth

### Line 2 — Header Row

```
name,path:vin,param:channel,param:enrollmentType,param:country,param:accountType,param:vehicleUsageCode,validate:$.offers[0].associatedOfferingCode,validate:$.offers[0].offerName,...
```

Column prefixes:
- `name` — test name (no prefix)
- `path:` — URL path variable
- `param:` — query parameter
- `validate:` — JSONPath validation rule (expected value per row)

### Lines 3+ — Data Rows

One row per test. Empty validation cells mean "don't validate this offer index."

## URL Patterns by Environment

| Environment | URL Pattern |
|---|---|
| t01 (test) | `https://sales-product-autoassign.apps.gmna.test.cvca.atmosdt.gm.com/sales/product/autoassign/v1/vehicles/management/{{vin}}/onboarding/vehiclePurchaseOffers` |
| p01 (prod) | `https://sales-product-autoassign.apps.gmna.cvca.atmosdt.gm.com/sales/product/autoassign/v1/vehicles/management/{{vin}}/onboarding/vehiclePurchaseOffers` |

## Payload Structure

The `content_payload_val` JSON contains:

```json
{
  "offers": [
    {
      "associatedOfferingCode": "ONZFCNCP01MUSUL",
      "offerName": "OnStar One - Trial - 1 Month",
      "rank": 1,
      "productCode": "OnStar One",
      "billingCadence": "Prepaid",
      "duration": { "unit": "Months", "value": 1 }
    }
  ],
  "enrollmentType": "ONBOARD_AS_NEW",
  "country": "US",
  "channel": "MC_WEBRNW",
  "accountType": "PN",
  "vin": "1GYC3R1L9T10799D0"
}
```

## Diversity Quotas

When selecting 100 samples, aim for this distribution:

| Country-AccountType | Target |
|---|---|
| US-PN | 30 |
| US-FL | 15 |
| US-DD | 10 |
| US-BN | 5 |
| CA-PN | 10 |
| CA-FL | 5 |
| CA-BN | 3 |
| CA-RN | 2 |
| MX-PN | 10 |
| MX-FL | 5 |
| MX-RN | 2 |
| US-CV | 3 |

Adjust quotas based on available data. Fill remaining slots from any bucket.

## Troubleshooting

- **Token expired**: User must re-authenticate the MCP in Cursor Settings > MCP
- **Column not found**: Re-run the schema discovery query (Step 2)
- **Empty results**: Check `status_cd` values with `SELECT DISTINCT status_cd FROM spaa.event_msg_publish`
- **Hex payload**: Always use `convert_from(content_payload_val, 'UTF8')` — the column is `bytea`
