# Source Restructuring Plan (Living)

> Status: On hold (core restructure not scheduled)
> Last Updated: 2026-08-22
> Purpose: Track only actionable restructuring work.

## Current Reality

- Partial modularization is complete in high-impact areas (workflow and kafka paths).
- Full repository-wide directory migration is still deferred.
- Current priority remains feature delivery and stability.

## When to Resume Full Restructure

Resume only when all are true:
- No active release-critical features in flight
- A dedicated stabilization window is approved
- Team capacity exists for import-path churn and verification

## Active Restructuring Scope (Minimal)

Use incremental restructuring only where it provides immediate value:
- Co-locate new feature files and tests under domain folders.
- Move only touched files when improving boundaries.
- Avoid broad directory sweeps during active feature work.

## Deferred Scope (Explicit)

Still deferred:
- End-to-end migration of all legacy flat folders.
- Global move-only operations across pages/components/hooks/utils.
- Final cleanup of all old empty directories.

## Guardrails

For each incremental move:
- Move files without behavior changes.
- Update imports and run `npx tsc -b --noEmit`.
- Run touched tests before proceeding.
- Batch related moves; avoid scattered micro-migrations.

## Archive Policy

Verbose phase tables and exhaustive file-by-file move lists were removed intentionally.
Use git history for legacy migration details.
