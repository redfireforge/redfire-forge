# Refactoring Plan (Living)

> Status: Mostly complete
> Last Updated: 2026-06-20
> Purpose: Keep only current refactoring direction and remaining actions.

## Summary

Major refactoring work is complete:
- Coverage and stability targets are met.
- Workflow designer decomposition is complete.
- Kafka modularization and gallery factory deduplication are complete.

This file now tracks only future refactoring work that still matters.

## Completed Milestones

- WorkflowDesigner decomposition completed.
- ScenarioBuilder size reduced via hook extraction.
- Kafka service modularized into focused modules.
- Gallery node factory duplication removed.
- Coverage and test gates achieved in prior cycles.

## Remaining Work

### 1) Code Quality Cleanup
- Remove remaining duplicated helpers and stale branches.
- Replace avoidable `any` usage with strict types in touched modules.
- Continue extracting reusable logic when duplicate patterns appear.

### 2) Focused Performance Hygiene
- Memoize remaining expensive UI computations in hot paths.
- Reduce avoidable rerenders in large canvas and results views.

### 3) Validation Discipline
Before closing any new refactoring item:
- `npx tsc -b --noEmit` passes
- Touched unit tests pass
- Relevant E2E subset passes when behavior is impacted

## Archive Policy

Historical item-by-item logs, round plans, and old completion checklists were intentionally removed to reduce token overhead.
Use git history for deep retrospective details.
