# Matching & Conflicts

## 1. Path matchers

| Kind | Example | Notes |
|---|---|---|
| **Exact** | `/health` | Full path equality |
| **Parameterized** | `/users/:id` or `/users/{id}` | Captures become template vars |
| **Glob** | `/assets/*.png`, `/api/**` | `*` / `**` / `?` |
| **Regex** | `^/v[0-9]+/.*$` | Optional case-insensitive flag |

Edited on the rule **Match** tab. Use **Pattern Toolbox** → **Path template** for presets and live test path.

## 2. Predicate tree

Combinators: **All of** / **Any of** / **None of** (`all` / `any` / `not`).

Leaf sources include: header, query, cookie, body, form, security selectors (`scheme`, `certSubject`, …).

Operators include (Node companion and Tauri native): exact, contains, prefix, suffix, regex, glob, present/absent, JSONPath exists/equals, JSON strict/subset, JSON Schema, XPath, XML Schema (well-formed + element subset), multipart, `binary_sha256`, and more exposed in the Match picker.

Unavailable operators are gated in UI (`UNAVAILABLE_PREDICATE_OPERATORS` and `NATIVE_UNAVAILABLE_OPERATORS` are both empty).

## 3. Selection policies

Per server (**Server Settings → Selection** or **Runtime → Settings**):

| Policy | Behavior |
|---|---|
| Multiple match: **Choose highest priority** | Winner by priority |
| Multiple match: **Reject all multiple matches** | Ambiguous → reject |
| Equal priority: **Reject as ambiguous** | Tie → reject |
| Equal priority: **Specificity, then stable ID** | Deterministic tie-break |

## 4. Pattern Toolbox

Open from Match rows (wand) or related actions. Tabs:

| Tab | Purpose |
|---|---|
| **Regex builder** | Library + live samples |
| **Path template** | Kind presets + generalize imported path |
| **JSON body / JSONPath** | Click/select sample JSON → path; Add conditions |
| **Query & headers** | Compose header/query/cookie constraints |
| **XPath** | exists/equals helpers |
| **Schema** | JSON Schema / XML Schema text presets |

Footer: **Cancel** / **Apply pattern** or **Add conditions**. Backdrop click does **not** close the modal.

JSONPath tips (shared `getByPath` / `jsonPathFromCursor`):

- Select-all on the sample → `$`
- Click a key or value inside an array → includes `[n]` (e.g. `$.items[0].sku`)
- Drag a multi-token range → tightest containing object/array/value span
- Backdrop click does **not** dismiss the toolbox (use Cancel / Escape)

## 5. Conflict Inspector

Workspace nav → **Conflicts**.

Finding kinds:

- `definite_overlap`
- `potential_overlap`
- `duplicate`
- `shadowed`
- `unreachable`

Actions:

- Filter by kind
- Inspect dimensions / policy outcome
- **Simulate** witness
- Adjust priority
- Acknowledge by fingerprint (stale when definition changes)
- Apply gating respects configured severity policy

Empty-state explainer: `ApiMockConflictGuide` in the UI.

## 6. Simulation

**Simulate** runs the same engine as CLI `mock simulate` — offline, side-effect-free — with trace of match / render / assertions for saved samples.
