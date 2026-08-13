# Templates, Responses, Faults & Outbound

## 1. Response editor tabs

On a route → **Response** (variant editor):

| Tab | Purpose |
|---|---|
| **Content** | Status, content-type, Monaco body editor with `{{` completions; **Map body** (Data Mapper) |
| **Headers** | Response headers |
| **Timing** | Delay / long-running / expires |
| **Faults** | Connection-level faults |
| **Selection** | Variant conditions, state transitions, weighted/sequence metadata |
| **Outbound** | Transforms + per-variant callbacks |

Rule-level **Behavior** tab covers delay/jitter/probability/max matches shared across modes.

## 2. Response modes

| Mode | Behavior |
|---|---|
| Rules / default | First eligible variant by conditions |
| Sequence | Ordered variants with position state |
| Weighted | Random weighted pick |
| State machine | Transitions advance scenario state |

## 3. Template syntax

Handlebars-compatible restricted expressions:

- `{{var}}` / path params from parameterized routes
- Server / runtime variables
- Curated Faker helpers (deterministic with seed)

### Faker helpers (`FAKER_HELPER_PATHS`)

Use forms like `{{faker 'person.firstName'}}`:

- `person.firstName`, `person.lastName`, `person.fullName`
- `internet.email`, `internet.userName`
- `location.city`
- `lorem.word`, `lorem.sentence`
- `string.alphanumeric`, `string.uuid`
- `number.int`, `datatype.boolean`
- `commerce.product`, `phone.number`

Not a full `@faker-js/faker` port — curated subset only.

## 4. Faults

| Kind | UI label |
|---|---|
| `none` | None |
| `timeout` | Timeout (no response) |
| `close` | Close connection |
| `reset` | Reset connection |
| `malformed` | Malformed body |
| `dribble` | Dribble (slow drip) + chunk schedule |

Fault preview helpers exist for virtual delay timelines in the UI.

## 5. Data Mapper

**Map body** opens the shared Data Mapper with `createApiMockBodyAdapter` so you can visually build JSON bodies with `{{var}}` placeholders, then sync back to the template string.

## 6. Examples tab

Save durable samples per route (expected status/body). **Try in Requests**, edit, delete. Journal **Save as example** promotes a captured exchange with `routeId`.
