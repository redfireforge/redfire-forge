# Training Manual Tracks — Implementation Plan

## Overview

A new dedicated view that presents all training manuals organized by learning paths, with progress tracking, "What's New" highlights, and direct links to associated gallery samples.

**Mockup**: `docs/training-tracks-mockup.html`

---

## Goals

1. **Unified View** — All training manuals in one place, organized by paths and phases
2. **Progress Tracking** — Mark manuals as Not Started / In Progress / Completed
3. **What's New** — Highlight recently added or updated content
4. **Sample Integration** — One-click navigation to associated gallery samples
5. **Filtering & Search** — Find manuals by keyword, difficulty, or completion status

---

## Data Model

### New Types (`src/data/galleries/trainingPaths/types.ts`)

```typescript
/** Manual completion status */
export type ManualStatus = 'not_started' | 'in_progress' | 'completed';

/** User progress for a single manual */
export interface ManualProgress {
  manualPath: string;        // Unique identifier (file path)
  status: ManualStatus;
  lastViewedAt?: number;     // Unix timestamp
  completedAt?: number;      // Unix timestamp
}

/** Aggregated user progress across all manuals */
export interface TrainingProgress {
  manuals: Record<string, ManualProgress>;  // keyed by manualPath
  lastUpdated: number;
  streak?: number;           // consecutive days with activity
}

/** Manual metadata for "What's New" and versioning */
export interface ManualMetadata {
  manualPath: string;
  addedAt: number;           // Unix timestamp when first added
  updatedAt?: number;        // Unix timestamp of last update
  changeNote?: string;       // Brief description of what changed
}
```

### Storage Keys

| Key | Type | Purpose |
|-----|------|---------|
| `training_progress` | `TrainingProgress` | User's completion status for all manuals |
| `training_metadata` | `ManualMetadata[]` | Version info for "What's New" detection |

---

## UI Components

### New Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `TrainingTracksView.tsx` | `src/features/training/` | Main page container |
| `TrainingProgressDashboard.tsx` | `src/features/training/components/` | Stats cards (completed, in progress, streak) |
| `WhatsNewBanner.tsx` | `src/features/training/components/` | Collapsible new/updated items |
| `TrainingPathCard.tsx` | `src/features/training/components/` | Expandable path with progress bar |
| `TrainingPhaseSection.tsx` | `src/features/training/components/` | Collapsible phase within a path |
| `ManualRow.tsx` | `src/features/training/components/` | Individual manual with status, actions |
| `ContinueLearningCard.tsx` | `src/features/training/components/` | Resume last-viewed manual |

### New Hooks

| Hook | Purpose |
|------|---------|
| `useTrainingProgress.ts` | Read/write progress to storage, calculate stats |
| `useWhatsNew.ts` | Detect new/updated manuals within last N days |
| `useManualSearch.ts` | Filter manuals by search term, difficulty, status |

---

## Implementation Phases

### Phase 1: Core Infrastructure ✅ COMPLETED (2026-05-05)

**Scope**: Data model, storage, and basic hooks

| Task | Files | Status |
|------|-------|--------|
| Define new types | `src/data/galleries/trainingPaths/types.ts` | ✅ |
| Create `useTrainingProgress` hook | `src/features/training/hooks/useTrainingProgress.ts` | ✅ |
| Add metadata to existing manuals | `src/data/galleries/trainingPaths/manualMetadata.ts` | ✅ |
| Create `useWhatsNew` hook | `src/features/training/hooks/useWhatsNew.ts` | ✅ |
| Unit tests for hooks | `src/features/training/hooks/*.test.ts` | ✅ (45 tests) |
| Barrel export | `src/features/training/index.ts` | ✅ |

**Deliverable**: Progress persistence working, "What's New" detection functional

**Files Created**:
- `src/data/galleries/trainingPaths/types.ts` — Added `ManualStatus`, `ManualProgress`, `TrainingProgress`, `ManualMetadata` types
- `src/data/galleries/trainingPaths/manualMetadata.ts` — Metadata for ~80 manuals with addedAt/updatedAt timestamps
- `src/features/training/hooks/useTrainingProgress.ts` — Hook for progress CRUD, streak calculation, stats
- `src/features/training/hooks/useTrainingProgress.test.ts` — 19 unit tests
- `src/features/training/hooks/useWhatsNew.ts` — Hook for detecting new/updated content within N days
- `src/features/training/hooks/useWhatsNew.test.ts` — 26 unit tests
- `src/features/training/index.ts` — Barrel export for the training feature

---

### Phase 2: Main View & Navigation

**Scope**: Page structure, sidebar entry, routing

| Task | Files | Estimate |
|------|-------|----------|
| Add sidebar nav item | `src/app/Sidebar.tsx` | S |
| Add route | `src/app/App.tsx` | S |
| Create `TrainingTracksView` scaffold | `src/features/training/TrainingTracksView.tsx` | M |
| Create `TrainingProgressDashboard` | `src/features/training/components/TrainingProgressDashboard.tsx` | M |
| Create `ContinueLearningCard` | `src/features/training/components/ContinueLearningCard.tsx` | S |

**Deliverable**: Navigate to Training Tracks page, see progress stats

---

### Phase 3: Path & Manual Display

**Scope**: Expandable paths, phases, manual rows

| Task | Files | Estimate |
|------|-------|----------|
| Create `TrainingPathCard` | `src/features/training/components/TrainingPathCard.tsx` | M |
| Create `TrainingPhaseSection` | `src/features/training/components/TrainingPhaseSection.tsx` | M |
| Create `ManualRow` | `src/features/training/components/ManualRow.tsx` | M |
| Wire up expand/collapse state | `TrainingTracksView.tsx` | S |
| Add CSS styles | `src/features/training/training.css` | M |

**Deliverable**: Full hierarchy visible, paths expand to show phases and manuals

---

### Phase 4: Progress Interaction

**Scope**: Status toggling, progress updates, sample navigation

| Task | Files | Estimate |
|------|-------|----------|
| Implement status toggle in `ManualRow` | `ManualRow.tsx` | S |
| Connect toggle to `useTrainingProgress` | `ManualRow.tsx`, hook | S |
| Add "Open Manual" button (new tab) | `ManualRow.tsx` | S |
| Add "View Sample" button (navigate to gallery) | `ManualRow.tsx` | M |
| Update `ContinueLearningCard` with last-viewed | Hook integration | S |

**Deliverable**: Users can track progress, open manuals, jump to samples

---

### Phase 5: What's New Banner

**Scope**: Highlight new/updated content

| Task | Files | Estimate |
|------|-------|----------|
| Create `WhatsNewBanner` | `src/features/training/components/WhatsNewBanner.tsx` | M |
| Add NEW/UPDATED badges to `ManualRow` | `ManualRow.tsx` | S |
| Add collapse/expand toggle | `WhatsNewBanner.tsx` | S |
| Persist "dismissed" state | Hook or localStorage | S |

**Deliverable**: Users see what's new, badges appear on recent items

---

### Phase 6: Search & Filtering

**Scope**: Search box, difficulty filter, status tabs

| Task | Files | Estimate |
|------|-------|----------|
| Create `useManualSearch` hook | `src/features/training/hooks/useManualSearch.ts` | M |
| Add search input UI | `TrainingTracksView.tsx` | S |
| Add difficulty filter buttons | `TrainingTracksView.tsx` | S |
| Add status tabs (All / In Progress / Completed) | `TrainingTracksView.tsx` | S |
| Filter path/phase display based on filters | Integration | M |

**Deliverable**: Full search and filter functionality

---

### Phase 7: Polish & Testing

**Scope**: Animations, accessibility, tests

| Task | Files | Estimate |
|------|-------|----------|
| Add expand/collapse animations | CSS | S |
| Add keyboard navigation | Components | M |
| Unit tests for hooks | `*.test.ts` | M |
| Unit tests for components | `*.test.tsx` | M |
| E2E test for Training Tracks | `e2e/training-tracks.spec.ts` | M |
| Responsive design adjustments | CSS | S |

**Deliverable**: Production-ready feature with >90% test coverage

---

## File Structure

```
src/features/training/
├── TrainingTracksView.tsx          # Main page
├── training.css                    # Styles
├── components/
│   ├── TrainingProgressDashboard.tsx
│   ├── ContinueLearningCard.tsx
│   ├── WhatsNewBanner.tsx
│   ├── TrainingPathCard.tsx
│   ├── TrainingPhaseSection.tsx
│   └── ManualRow.tsx
├── hooks/
│   ├── useTrainingProgress.ts
│   ├── useTrainingProgress.test.ts
│   ├── useWhatsNew.ts
│   ├── useWhatsNew.test.ts
│   ├── useManualSearch.ts
│   └── useManualSearch.test.ts
└── index.ts                        # Barrel export
```

---

## Integration Points

### Sidebar (`src/app/Sidebar.tsx`)

Add new nav item after "Gallery":

```tsx
{ icon: '📖', label: 'Training Tracks', path: '/training' }
```

### Router (`src/app/App.tsx`)

Add route:

```tsx
<Route path="/training" element={<TrainingTracksView />} />
```

### Gallery Detail Panel

Keep existing "Training Manuals" section in `GalleryDetailPanel.tsx` — it provides context-sensitive manual links when viewing a sample.

---

## Storage Format

### `training_progress` Example

```json
{
  "manuals": {
    "tests/parameterized-basics-easy.html": {
      "manualPath": "tests/parameterized-basics-easy.html",
      "status": "completed",
      "lastViewedAt": 1714924800000,
      "completedAt": 1714924800000
    },
    "tests/parameterized-country-validation-medium.html": {
      "manualPath": "tests/parameterized-country-validation-medium.html",
      "status": "in_progress",
      "lastViewedAt": 1714928400000
    }
  },
  "lastUpdated": 1714928400000,
  "streak": 4
}
```

### Manual Metadata Example

```typescript
// In contentPaths.ts or separate metadata file
export const manualMetadata: ManualMetadata[] = [
  {
    manualPath: 'tests/parameterized-auth-rotation-advanced.html',
    addedAt: 1714838400000,  // May 4, 2026
    changeNote: 'New manual for Auth Token Rotation sample'
  },
  {
    manualPath: 'tests/parameterized-basics-easy.html',
    addedAt: 1704067200000,  // Jan 1, 2024
    updatedAt: 1714752000000, // May 3, 2026
    changeNote: 'Added new section on column types'
  }
];
```

---

## "What's New" Logic

1. **New Content**: `addedAt` within last 14 days
2. **Updated Content**: `updatedAt` within last 14 days AND `updatedAt > addedAt`
3. **Sort Order**: Most recent first
4. **Limit**: Show top 5, with "Show all" option

---

## Progress Calculation

```typescript
function calculatePathProgress(path: TrainingPath, progress: TrainingProgress) {
  const allManuals = path.phases.flatMap(p => p.manuals);
  const completed = allManuals.filter(m => 
    progress.manuals[m.manualPath]?.status === 'completed'
  ).length;
  return {
    completed,
    total: allManuals.length,
    percentage: Math.round((completed / allManuals.length) * 100)
  };
}
```

---

## Streak Calculation

- Increment streak when user completes a manual on a new calendar day
- Reset to 1 if >24 hours since last completion
- Store `lastCompletionDate` to track day boundaries

---

## Accessibility

- All interactive elements keyboard-accessible
- ARIA labels for status buttons
- `aria-expanded` for collapsible sections
- Focus management on expand/collapse
- Screen reader announcements for status changes

---

## Testing Strategy

### Unit Tests

| Area | Coverage Target |
|------|-----------------|
| `useTrainingProgress` | 95% |
| `useWhatsNew` | 90% |
| `useManualSearch` | 90% |
| Component rendering | 90% |

### E2E Tests

| Test Case | Priority |
|-----------|----------|
| Navigate to Training Tracks page | High |
| Expand/collapse path | High |
| Toggle manual status | High |
| Search filters results | Medium |
| "Continue Learning" navigates correctly | Medium |
| Progress persists across reload | High |
| "View Sample" navigates to gallery | Medium |

---

## Dependencies

- No new npm packages required
- Uses existing storage abstraction (`src/shared/utils/storage.ts`)
- Uses existing gallery data structures

---

## Success Metrics

1. **Adoption**: >50% of users visit Training Tracks within first week
2. **Engagement**: Average 3+ manuals marked per user
3. **Completion**: >20% of started paths reach 50% completion
4. **Retention**: Users return to continue learning (streak > 1)

---

## Open Questions

1. **Sync Progress?** — Should progress sync across devices (requires backend)?
2. **Gamification** — Add badges/achievements for completing paths?
3. **Recommendations** — Suggest next manual based on current progress?
4. **Export** — Allow users to export their progress?

---

## Changelog

| Date | Change |
|------|--------|
| 2026-05-05 | Initial plan created |
| 2026-05-05 | Phase 1 completed: types, hooks, metadata, tests (45 passing) |
