# Data Mapper — Validation Guide

Use the Data Mapper to visually build validation rules with 24 field operators, array assertions, DSL code editing, and live verification.

## Overview

The **Validation Data Mapper** is opened from **Test Editor → Validation tab → Data Mapper**. It provides a visual interface for:

- Mapping response fields to expected values with **24 operators** (equals, contains, between, regex, etc.)
- Adding **array assertions** (length, contains, each, subset) to collection nodes
- Writing **DSL rules** in a Monaco code editor with syntax highlighting and autocomplete
- Running **live verification** against sample data with pass/fail indicators
- Using **ASSERT expressions** with 125+ functions and lambda syntax
- **Negating** any rule with the universal `NOT` modifier

> **Terminology:** The Data Mapper component is used in two contexts:
> - **Validation Data Mapper** — from the Validation tab (supports operators, assertions, DSL rules, verification)
> - **Extraction Data Mapper** — from the Extract tab (supports variable extraction only)

## Getting Started

1. Open a test scenario → **Edit** → **Validation** tab
2. Set **Body Validation** to **Selective Fields**
3. Click **Fetch Response** (or paste JSON) to populate sample data
4. Click **Data Mapper** to open the Validation Data Mapper modal

## Source & Target Panels

The Data Mapper has two tree panels:

- **Source Panel** (left) — shows the response JSON structure with actual values
- **Target Panel** (right) — shows mapped fields with operator pills, values, and assertions

### Mapping Fields

Drag a source field to a target field to create a mapping. The default operator is `equals` (green pill).

### Auto-Map

Click **Auto-map** in the toolbar to automatically map all matching source fields. Auto-mapped fields default to the `exists` operator to prevent false failures on type mismatches.

## Field Operators (24 Total)

Each mapped field shows an **operator pill** — a colored badge indicating the validation rule. Click the pill to open the operator picker.

### Equality (green)

| Operator | Symbol | Description |
|----------|--------|-------------|
| `equals` | `=` | Exact match against expected value |
| `not_equals` | `≠` | Must not match expected value |

### Comparison (amber)

| Operator | Symbol | Description | Value Input |
|----------|--------|-------------|-------------|
| `greater_than` | `>` | Strictly greater | Number |
| `greater_than_or_equal` | `>=` | At least | Number |
| `less_than` | `<` | Strictly less | Number |
| `less_than_or_equal` | `<=` | At most | Number |
| `between` | `↔` | Within range (inclusive) | Min, Max (two inputs) |
| `close_to` | `≈` | Within tolerance | Value, Tolerance (two inputs) |

### String (purple)

| Operator | Symbol | Description |
|----------|--------|-------------|
| `contains` | `⊃` | Substring match |
| `not_contains` | `⊅` | Must not contain substring |
| `starts_with` | `⊳` | Prefix match |
| `ends_with` | `⊲` | Suffix match |
| `regex` | `/r/` | Regular expression match |

### Boolean (red)

| Operator | Symbol | Description |
|----------|--------|-------------|
| `is_true` | `✓` | Value must be `true` |
| `is_false` | `✗` | Value must be `false` |

### Existence & Null (gray)

| Operator | Symbol | Description |
|----------|--------|-------------|
| `exists` | `∃` | Path must exist (even if null) |
| `not_exists` | `∄` | Path must not exist |
| `is_null` | `∅` | Value must be null |
| `is_not_null` | `⊙` | Value must not be null |
| `is_empty` | `∅` | Must be empty string or empty array |
| `is_not_empty` | `⊙` | Must not be empty |

### Type Check (teal)

| Operator | Symbol | Description |
|----------|--------|-------------|
| `is_type` | `τ` | Value must match type (dropdown: string, number, boolean, object, array, null) |

### Set Membership (blue)

| Operator | Symbol | Description |
|----------|--------|-------------|
| `in` | `∈` | Value must be in the set |
| `not_in` | `∉` | Value must not be in the set |

## Array Assertions

Right-click an array node (e.g., `offers`) to add array-level assertions:

| Type | Symbol | Description | Example |
|------|--------|-------------|---------|
| **LENGTH** | `#` | Assert array size | `offers LENGTH >= 3` |
| **CONTAINS** | `∋` | Must contain exact item | `offers CONTAINS {"offerName": "EV Access"}` |
| **EACH** | `∀` | Every item must match | `offers[*] EACH rank >= 0` |
| **SUBSET** | `⊆` | Must contain partial object (deep match) | `offers SUBSET {"productCode": "SAFE-24"}` |

Multiple assertions can be stacked on a single array node. Inline editing: click the value to edit, Enter to commit, Escape to cancel.

> **CONTAINS vs SUBSET:** CONTAINS does exact field comparison. SUBSET does deep recursive partial matching — extra fields in actual data are ignored. Use SUBSET for nested objects where you don't want to specify every field.

## Universal Negation (NOT)

Any operator or assertion can be negated:

- **Operator picker** — toggle the NOT button at the top
- **Context menu** — right-click a node → Negate (NOT)
- **DSL syntax** — prefix with `NOT`: `status NOT equals "deleted"`

Negated rules show a red `NOT` badge alongside the operator pill.

## DSL Code Editor (Validation Rules Modal)

Click **Rules** in the toolbar to open the Validation Rules Modal — a Monaco code editor for writing validation rules in DSL syntax.

### DSL Syntax

```
# Field assertions
status                    equals          "active"
count                     >=              10
offers[0].offerName       contains        "Acme"
isActive                  is_true
offers[0].duration.value  between         1, 365
latitude                  close_to        40.7, 0.1

# Collection assertions
offers                    length >=       3
offers                    contains_any    {"offerName": "EV Access - 8 Years"}
offers[*].rank            each >=         0

# Negation
status                    NOT equals      "deleted"
offers                    NOT length >=   100

# Custom predicates (ASSERT)
ASSERT $gt($count($.body.offers), 0)
ASSERT $all($.body.offers, x => $gte(x.rank, 1))
NOT ASSERT $isEmpty($.body.tags)
```

### Features

- **Syntax highlighting** — paths (cyan), operators (colored by category), values (green/amber), comments (gray)
- **Autocomplete** — auto-suggests paths from the JSON tree, operators, and contextual values as you type
- **Inline error markers** — red squiggles and gutter bars for parse errors
- **Pass/fail line decorations** — green/red gutter bars after verification
- **Bi-directional sync** — visual mappings ↔ DSL rules stay synchronized

### Modal Modes

| Mode | Description |
|------|-------------|
| **Docked** (default) | Anchored at bottom, resizable height |
| **Floating** | Draggable, resizable window |
| **Full Screen** | Takes entire mapper area |

### DSL Reference Panel

Click **Reference** in the modal header to toggle the DSL Reference Panel — an accordion-style reference with 8 categories, search, insert, and copy functionality.

## ASSERT Custom Predicates

Use `ASSERT` followed by any expression to create custom validation logic:

```
ASSERT $gt($count($.body.offers), 0)
ASSERT $eq($sum($map($.body.offers, x => x.rank)), 6)
NOT ASSERT $isEmpty($.body.offers)
```

The expression engine supports **125+ functions** across 8 categories (String, Math, Array, Object, Conditional, JSON, Date/Time, Encoding) and **lambda syntax** (`x => expr`, `(acc, x) => expr`).

## Live Verification

### Verify All

Click **Verify All** in the toolbar to evaluate all rules against sample data:

- **Per-node badges** — green ✓ (pass) or red ✗ (fail) on each target node
- **Canvas line colors** — green for passed, red for failed
- **Toolbar stats** — aggregated pass/fail counts
- **Status column** — in the Mapping View table, shows "✓ pass" / "✗ fail" after verification

### Fetch & Verify

Click **Fetch & Verify** to make a live HTTP request and verify against fresh data.

### Auto-Verify

Enable the **Auto** checkbox to automatically re-verify after every edit (~500ms debounce).

### Inline Verification (Rules Modal)

Click **▶ Verify** inside the Rules modal for step-by-step debugging:

- Failed rules strip with line numbers, paths, expected/actual values
- Expandable evaluation steps (path resolution → operator evaluation → result)
- Input data preview with expand/collapse for large payloads
- Undefined path enrichment (shows available sibling keys for typos)

## Mapping View

The bottom section shows mappings in three views:

### Code View

Textual representation of all mappings and assertions with line numbers.

### List View (Table)

Tabular view with columns: #, Target, Source/Expression, Before, After, Trace, Status.

- **Status column** — "— same" / "△ changed" before verification; "✓ pass" / "✗ fail" after Verify All
- **Trace** — click Inspect to see step-by-step data flow (Source Input → Path Resolution → Target Output)

### Pivot View

Cross-tabulation for array data — rows are array indices, columns are field names. Useful for comparing values across array items. Available when mappings share a common array prefix (e.g., `offers[0].name`, `offers[1].name`).

### Layout Controls

- **Hide/Show Panels** — collapse the Source/Target panels to give the Mapping View full height
- **Drag resize** — drag the handle between panels and Mapping View to adjust vertical split
- **Search** — filter rows by target/source/value
- **Focus matches** — toggle to show only matching rows

## Expression Editor

Right-click a mapped node → **Edit expression** to open the Expression Editor:

- Type `$.` to get path autocomplete from the response JSON
- 125+ built-in functions with live preview
- Lambda syntax: `$filter($.offers, x => x.isActive)`
- Step-through debugger for tracing intermediate values

## Tips & Best Practices

### 1. Start with Auto-Map + Exists

Auto-map all fields first (defaults to `exists`), then selectively set stricter operators on critical fields.

### 2. Use DSL for Bulk Rules

The DSL editor is faster than clicking for creating many rules at once. Write them in the Rules modal, then verify.

### 3. Combine Operators + ASSERT

Use field operators for simple checks and ASSERT for complex cross-field logic:

```
status            equals      "active"
count             >=          1
ASSERT $all($.body.offers, x => $gte(x.rank, 1))
```

### 4. Use Negation Thoughtfully

`NOT equals "deleted"` is clearer than `not_equals "deleted"` for documenting intent.

### 5. Check the Mapping View

After Verify All, switch to the Table view to see a complete summary with pass/fail status for every mapping and assertion.

## Related Guides

- [Assertions Guide](./assertions-guide.md) — Test Editor assertion types
- [Validation Modes Guide](./validation-modes-guide.md) — None, Selective, Full modes
- [Scenarios Guide](./scenarios-guide.md) — Test organization
- [Test Runner Guide](./test-runner-guide.md) — Running tests
