# HAR Import Examples

Sample HAR files for testing the **Import HAR** feature in the Workflow Designer.

## How to use

1. Open the **Workflow** tab in RedfireForge
2. Click **Import HAR** in the toolbar (↓ arrow button, far right)
3. Select one of the `.har` files below
4. Review detected requests in the preview modal
5. Click **Confirm** to generate the workflow

---

## petstore-session.har

**Scenario:** Login → Get user → List pets (3 requests)

```
[Start] → [POST /auth/login] → [GET /users/{{userId}}] → [GET /users/{{id}}/pets]
```

**What gets generated:**
- `{{baseUrl}}` = `https://api.petstore.example.com`
- `Authorization` header replaced with `{{authToken}}` placeholder (sensitive header redacted)
- Chain variables detected: `{{userId}}` (from login response → `GET /users/{{userId}}`) and `{{id}}` (from GET user response → `GET /users/{{id}}/pets`)

**To try:** Import → all 3 entries checked → Confirm → open Variables panel to see `{{baseUrl}}`

---

## ecommerce-checkout.har

**Scenario:** Add to cart → Checkout → Get order → Get tracking (4 requests)

```
[Start] → [POST /cart/items] → [POST /orders] → [GET /orders/{{orderId}}] → [GET /orders/{{orderId}}/tracking]
```

**What gets generated:**
- `{{baseUrl}}` = `https://api.shop.example.com`
- `X-Api-Key` header replaced with `{{apiKey}}` placeholder
- Chain variable detected: `{{orderId}}` (from POST /orders response → GET /orders/{{orderId}} and GET /orders/{{orderId}}/tracking)

**To try:** Import → Confirm → notice the chain detection summary "⚡ 2 variable chains detected automatically"

---

## github-search.har

**Scenario:** Search repositories → Get repo details → List open issues (3 requests)

```
[Start] → [GET /search/repositories] → [GET /repos/acme-org/redfire-core] → [GET /repos/acme-org/{{name}}/issues]
```

**What gets generated:**
- `{{baseUrl}}` = `https://api.github.com`
- `Authorization` header replaced with `{{authToken}}`
- Chain variable detected: `{{name}}` (repo name `redfire-core` from search response → `GET /repos/acme-org/redfire-core/{{name}}/issues`, step 3 only)

**To try:** Import → review redacted `Authorization` header warning → Confirm

---

## Notes

- These are **synthetic** HAR files — the URLs and tokens are not real
- To use real traffic: export from Chrome (F12 → Network → right-click → Save all as HAR)
- Sensitive **headers** (`Authorization`, `Cookie`, `X-Api-Key`, and others) are always redacted on import — you fill in real values via node headers after import
- **Request bodies are NOT automatically redacted** — if your HAR contains passwords or tokens in POST bodies, remove them manually from the node config after import
