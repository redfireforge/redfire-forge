# Catalog — Workflow Exposure: Deferred Items & Open Questions

> **Status:** ✅ Done (bug-fix pass 2026-07-24)  
> **Parent:** `workflow-exposure-preview-vs-published-plan.md` (P1–P6 ✅ Done)  
> **Created:** 2026-07-24  
> **Goal:** Implement all deferred features and resolve open questions from the original plan.

---

## Item Status Tracker

| ID | Title | Status | Depends On |
|---|---|---|---|
| D1 | View Usage — show workflow references | ✅ Done | P3 (management panel) |
| D2 | Bulk Republish All Stale | ✅ Done | P5 (republish), D1 |
| D3 | Orphaned node warning badge | ✅ Done | P0 (catalogRef) |
| D4 | Batch Publish (promote previewed endpoints) | ✅ Done | P1 (preview storage) |
| D5 | Preview-to-Published values carry-over | ✅ Done | P2 (publish modal) |

---

## D1 — View Usage: Show Workflow References

### Goal

Add a **"View Usage"** action to the Published Endpoints management panel's ⋮ menu that shows which workflows and nodes reference a given endpoint via `catalogRef`.

### Approach

- Reuse `scanWorkflowsForCatalogRef(entryId, endpointId)` from `workflowExposureScanner.ts` — it already returns `AffectedWorkflowInfo[]` with `workflowId`, `workflowName`, `nodeIds`, `nodeLabels`.
- Add a lightweight inline expansion or popover under the row showing usage info.
- No modal needed — keep it lightweight.

### Changes

| File | Action |
|---|---|
| `src/features/catalog/components/PublishedEndpointsPanel.tsx` | **MODIFY** — add "View Usage" menu item, inline usage display |
| `src/features/catalog/components/PublishedEndpointsPanel.test.tsx` | **MODIFY** — test usage action |

### Test Plan

- Unit: "View Usage" calls scanner, renders workflow names and node counts
- Unit: "No workflows use this endpoint" empty state

---

## D2 — Bulk Republish All Stale

### Goal

Add a **"Republish All Stale"** button to the management panel toolbar that updates all stale endpoints to the current spec version in one click.

### Approach

- Show button only when `staleCount > 0`
- On click, iterate all stale items and call `onRepublish` for each
- Show confirmation count before execution

### Changes

| File | Action |
|---|---|
| `src/features/catalog/components/PublishedEndpointsPanel.tsx` | **MODIFY** — add "Republish All Stale" button in toolbar |
| `src/features/catalog/components/PublishedEndpointsPanel.test.tsx` | **MODIFY** — test bulk republish |
| `src/features/catalog/ApiCatalog.tsx` | **MODIFY** — add `handleBulkRepublish` callback |

### Test Plan

- Unit: Button renders only when stale items exist
- Unit: Clicking calls `onRepublish` for each stale item
- Unit: Button hidden when no stale items

---

## D3 — Orphaned Node Warning Badge

### Goal

When a Published endpoint is un-published via "Remove from Palette Only", workflow nodes that still have a `catalogRef` pointing to the now-removed endpoint should show a **"⚠ Source unpublished"** warning badge.

### Approach

- `HttpStepNode` already renders `data.sourceType === 'catalog'` badge ("CAT")
- Add a check: if `data.catalogRef` is present, check whether the referenced catalog endpoint still has `workflowPublication` set
- Since nodes are rendered in the Workflow Designer context, we need a lightweight lookup: pass the set of published `entryId::endpointId` keys via React context
- Add a badge: `⚠ Source unpublished` with amber styling

### Changes

| File | Action |
|---|---|
| `src/features/workflow/components/nodes/HttpStepNode.tsx` | **MODIFY** — add orphaned badge when catalogRef doesn't resolve |
| `src/features/workflow/components/nodes/HttpStepNode.test.tsx` | **MODIFY** — test orphaned badge |
| `src/features/workflow/contexts/PublishedCatalogContext.tsx` | **CREATE** — React context providing published endpoint keys |
| `src/features/workflow/components/WorkflowDesignerBody.tsx` | **MODIFY** — provide context with published endpoint keys |
| `src/styles/workflow.css` | **MODIFY** — orphaned badge styling |

### Test Plan

- Unit: Orphaned badge renders when `catalogRef` present but endpoint not in published set
- Unit: No badge when endpoint is still published
- Unit: No badge when no `catalogRef` at all

---

## D4 — Batch Publish (Promote Previewed Endpoints)

### Goal

In the management panel, show Preview endpoints alongside Published ones with a **"Promote to Published"** action.

### Approach

- Add a "Previews" filter pill alongside All/Current/Stale
- Show preview items in the table with a distinct badge
- Each preview row has a "Publish" action in its ⋮ menu
- Bulk select + "Publish selected" for batch promotion

### Changes

| File | Action |
|---|---|
| `src/features/catalog/components/PublishedEndpointsPanel.tsx` | **MODIFY** — show preview entries, add promote action |
| `src/features/catalog/components/PublishedEndpointsPanel.test.tsx` | **MODIFY** — test preview display and promotion |
| `src/features/catalog/ApiCatalog.tsx` | **MODIFY** — pass preview data to panel, wire promote callback |

### Test Plan

- Unit: Preview items render with correct badge
- Unit: "Publish" action triggers publish flow
- Unit: Filter pills include "Previews"

---

## D5 — Preview-to-Published Values Carry-Over

### Goal

When promoting an endpoint from Preview to Published, pre-fill the Publish Confirmation modal with the values the user had set during Preview.

### Approach

- When `handleSetWorkflowExposure` transitions from `preview` → `published`, look up the preview entry from `previewMap`
- Pass the preview's `values` to the `PublishEndpointModal` as default values
- User can modify before confirming

### Changes

| File | Action |
|---|---|
| `src/features/catalog/ApiCatalog.tsx` | **MODIFY** — pass preview values to publish request |
| `src/features/catalog/components/PublishEndpointModal.tsx` | **MODIFY** — pre-fill "Include values" checkbox and display values |
| `src/features/catalog/components/PublishEndpointModal.test.tsx` | **MODIFY** — test value carry-over |

### Test Plan

- Unit: Preview values pre-populate the publish modal
- Unit: "Include current values" checkbox is checked by default when values exist
- Unit: User can modify values before confirming

---

## Implementation Order

```
D5 (values carry-over) — independent, small
D1 (view usage) — independent, moderate
D2 (bulk republish) — depends on existing republish
D3 (orphaned badge) — independent, moderate (new context)
D4 (batch publish) — depends on D5
```

Recommended: D5 → D1 → D2 → D3 → D4

---

## Post-Implementation Bug Fixes (2026-07-24)

Four bugs found and fixed during thorough review:

| # | Area | Bug | Fix |
|---|---|---|---|
| 1 | D5 | `handleSetWorkflowExposure` read `previewMap` but didn't list it in `useCallback` deps — stale closure during Preview→Published promotion | Added `previewMap` to dep array |
| 2 | D1 | `handleViewUsage` `.then()` didn't guard against stale key — rapid A→B clicks could show A's workflow data under B | Added `usageKeyRef` with eager sync update; `.then()` skips write when key changed |
| 3 | D3 | `publishedCatalogKeys` only checked `ep.workflowPublication`, not legacy `ep.workflowExposure === 'published'` — false orphan badge on pre-migration data | Added `isPublished()` helper that checks both fields |
| 4 | D4 | `handlePublishConfirm` used `catalog.selectedEntry` — promotion from management panel could target a non-selected entry, causing silent failure | Stored `entryId` in `pendingPublishRef`; `handlePublishConfirm` now uses `pending.entryId` + `applyPublicationToEntry` directly |
