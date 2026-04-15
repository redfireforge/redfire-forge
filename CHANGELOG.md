# Changelog

All notable changes to RedfireForge will be documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/). Versions follow [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

_Changes merged into `develop` that haven't been released yet._

### Added
- **Multi-Sheet Excel Template Export**: 3-step export wizard — (1) select URL path variables, (2) customize column names, (3) review & download. Generates `.xlsx` with styled Data sheet (Request/Response category headers) and Metadata sheet (COLUMN MAPPINGS, CONFIG, HEADERS sections with formatted tables)
- **Excel Template Import**: Import `.xlsx` templates with comprehensive file-level and row-level validation. Supports dynamic column detection for user-added validation fields. Backward compatible with legacy CSV imports
- **Response Error Display in Results**: Failed requests (HTTP 4xx/5xx) now show a clickable error snippet in the result row. Click to open a Response Detail modal with error message, validation failure table, and full response body
- **Detail Header Row in Grouped Results**: Expanding a group now shows column headers (Test Name, URL, Status, Validation, Time, Passed, Error/Details) above the individual result rows
- **Multi-Level Grouped Results**: Group results by Feature, Scenario, or Test Name with cascading sub-group options (Feature → Scenario → Test). Collapsible rows with per-group stats (total, passed, failed, validation failed, avg/min/max response time)
- **Advanced Search in Scenario Builder**: Boolean search engine with AND, OR, NOT/-, "quoted phrases", and (parentheses). Searches across test name, URL, method, headers, body, auth config, validation rules and expected values. Inline syntax help via ? button
- **Results Search**: Text search in the Results Dashboard Request Details — filter by name, URL, feature, group, or error message
- **Host Badge on Progress**: Shows the active host (Settings URL, custom URL, or Original) next to the execution mode tag in the Progress section
- **Request Timeout**: Per-request timeout (0–300s, default 10s). Timed-out requests are recorded as failures and execution moves to the next test
- **Retry on Failure**: Retry failed requests up to N times with configurable delay between attempts. Final result reflects the last attempt
- **Error Policy (Circuit Breaker)**: Three policies — Continue (ignore errors), Stop on First Error, or Stop at Threshold (configurable max error count and max error rate %). Applies across all execution modes including Load Profile

### Changed
- **Excel replaces CSV as primary template format**: Export button renamed "Export Template", import button renamed "Import Template". Both support `.xlsx` (preferred) and legacy `.csv`
- **Error extraction from HTTP error responses**: Executor now parses `message`, `error`, `detail`, or `errorMessage` from 4xx/5xx response bodies for meaningful error messages
- **xlsx-js-style replaces xlsx**: Switched to `xlsx-js-style` for Excel cell styling support (bold headings, colored backgrounds, merged cells)
- **Results Group By replaces Scenario dropdown**: The old "All Scenarios" dropdown (listing 100+ individual tests) is replaced by the Group By controls and search
- **Feature/Scenario/Test hierarchy in results**: `featureGroupName` and `groupName` are now threaded from the test hierarchy through execution into `RequestResult` for accurate grouping
- **Unified Execution Config**: Execution Mode, Concurrency, Transactions, Timeout, Retry, and Error Policy grouped into a single card. Load Profile Configuration appears as part of the same group when selected
- **Skip Validation moved**: Relocated from a standalone checkbox to the "Select Scenarios to Test" header row
- **Concurrency/Transactions always visible**: Disabled (not hidden) when Load Profile mode is active, keeping layout consistent

---

## [0.3.4] — 2026-04-14

### Added
- **CSV/Excel Template Import**: Create bulk tests from CSV files with metadata header, path variables, query parameters, and validation rules
- **CSV Template Export**: Generate a CSV template from an existing test, with smart URL analysis to identify variable path segments and query parameters
- **Drag-and-Drop CSV Import**: Drag CSV/Excel files directly into the import modal
- **Create Feature Group on Import**: Option to create a new Feature Group during CSV import (not just a new Scenario)
- **Verify Rules Button**: Invoke the API with current test config and compare response against validation rules, with host override option and detailed discrepancy table
- **Auto-Refreshing Token Manager**: OAuth2 tokens are shared across all tests with the same credentials and auto-refresh on JWT expiry (30s buffer), eliminating redundant token requests
- **Reusable CSV Generator Script**: `scripts/generate-csv-from-db.cjs` for generating importable CSV templates from PostgreSQL databases
- **CSV Generator Cursor Skill**: `.cursor/skills/generate-csv-template/` with instructions and reusable script for DB-to-CSV workflow
- **Sample CSV Templates**: Pre-built `sample_t01_100.csv` and `sample_prod_100.csv` with 100 diverse test records each

### Changed
- **Validation UI Consistency**: Imported tests now display validation rules in the same table format as manually configured tests (consistent header, auto-table view for array fields, "+ Add Manual Rule" button)
- **Token Acquisition**: Replaced upfront per-scenario token loop with lazy `TokenManager` — startup is instant regardless of test count
- **Unordered Array Matching**: CSV template export/import now correctly persists the `unorderedArrays` setting in metadata

### Fixed
- **JSONPath `$` Prefix**: Validator now correctly strips `$` or `$.` prefix from JSON paths (e.g., `$.offers[0].offerName`)
- **Unordered Array Mismatch Reporting**: Partial matches now report only mismatched fields with context (e.g., `matched by associatedOfferingCode=XYZ at [3]`) instead of generic "no matching item found"

---

## [0.3.3] — 2026-04-13

### Added
- **Load Profile Execution Mode**: New "Load Profile" option alongside Sequential, Batch, and Pool modes for time-based load testing
- **Ramp-Up Profile**: Gradually increase from 1 to N concurrent users over a configurable ramp period, then sustain
- **Sustained Load Profile**: Maintain a constant number of concurrent users for a specified duration
- **Spike Test Profile**: Run at base concurrency, then burst to a peak for a configurable window
- **Live Response Time Chart**: Streaming area chart of average response times (ms) per second during execution
- **Live Throughput Chart**: Streaming area chart of transactions per second (TPS) during execution
- **Live Error Rate Chart**: Streaming line chart of error percentage per second during execution
- **Live Concurrency Chart**: Step-area chart showing actual in-flight request count over time (load profile mode)
- **SVG Profile Preview**: Inline preview of the concurrency shape for the selected load profile configuration
- **Active Connections Gauge**: Real-time "Concurrency: X / Y" metric card during load profile runs
- **Roadmap Document**: Added `ROADMAP.md` tracking planned features across 5 phases

### Changed
- Test Runner progress section now shows time-based progress (elapsed/duration) for load profile runs
- Results Dashboard badge displays load profile details (type, peak, duration) instead of generic Batch/Concurrency/Total
- Load profile configuration (type, duration, concurrency) persists per project/environment/microservice context

---

## [0.3.2] — 2026-04-13

### Added
- **Response & Validation Version History**: Save snapshots of both the JSON response and validation rules as named versions, with restore and delete support
- **Save as Version**: Manually snapshot the current response + validation state at any time from the Validation tab
- **Visual Diff Comparison Modal**: Full-screen pop-up modal with side-by-side JSON diff (monokai dark theme) for comparing any two versions
- **Tabbed Comparison**: Compare modal has separate "Response" and "Validation Rules" tabs, each with full visual diff
- **Unordered Array Matching**: Toggle in compare modal to ignore array element order when diffing (works for arrays of objects)
- **Identical Version Banner**: Green checkmark banner when two compared versions are identical
- **Duplicate Version Prevention**: Automatically skips creating a new version when the response and validation rules are unchanged (uses canonical JSON comparison with sorted keys)
- **Excluded Paths for Deduplication**: Paths marked as excluded in validation rules are also ignored during duplicate version detection (handles dynamic fields like timestamps)
- **Manual Validation Rule Input**: "+ Add Manual Rule" now renders editable input fields for JSON path and expected value (previously showed empty non-editable text)
- **Host Override Persistence**: "Host Override" checkbox and URL value in the test editor now persist across close/reopen

### Changed
- Auth badge styling: consistent green highlight for configured types, reduced font size (0.75rem), bold, rounded corners
- "No Auth" badge now has rounded corners matching other badges
- Diff viewer uses monokai dark theme with green/red/blue tinting for added/removed/modified lines

### Fixed
- Project delete button was double-confirming (SettingsModal + App.tsx both called confirm), making deletion appear broken
- Response version diff was hard to read on dark backgrounds (switched to monokai theme with custom inline-diff styling)
- Unordered array comparison was not working for arrays of objects (library built-in sort failed; replaced with custom deep sort)
- Validation rule comparison showed false diffs due to array ordering of expectedFields and excludedPaths

---

## [0.3.1-beta.1] — 2026-04-12

### Added
- Per-context runner config: Concurrency and Total Transactions are now saved independently per project + environment + microservice combination
- Custom host URL input always visible in Test Runner (disabled when not in custom mode, dimmed styling)

### Changed
- Tagline renamed from "API Performance Studio" to "Redfire Performance Workbench"
- Sidebar: clicking a microservice or environment name only toggles expand/collapse, no longer changes content selection
- Git branching rules strengthened: all code changes must go through feature/* or hotfix/* branches

### Fixed
- Auth badge on test cards showing "Auth: none" when inheriting through scenario → feature → global auth profile chain
- Scenario-level "Verify Inherited Auth" button now resolves through feature to global auth profile
- Settings modal header clipped behind app header in desktop mode

---

## [0.3.0-beta.1] — 2026-04-12

### Added
- Project hierarchy: Project > Feature > Scenario > Test
- Each project contains its own environments, microservices, auth profiles, and feature groups
- Cross-project move for feature groups, scenarios, and tests with automatic dependency copy
- Copy/Move/Add for environments, microservices, and auth profiles between projects
- Global auth profiles (app-level, shared across all projects)
- Auth profile selector with separate Global and Project-level optgroups
- Project name context tag displayed on Feature Groups, Test Runner, and Results pages
- Project name stored in test run metadata and shown in results dropdown
- Reset All to 1 / Reset All to 0 buttons for test weight distribution
- Settings modal redesigned with sidebar navigation (Projects, Global Auth Profiles, Export & Import, Storage)
- Full-screen Settings modal with thin custom scrollbar
- Move dialog with hierarchical picker for target project/feature/scenario

### Changed
- Total Transactions now respects exact count — picks top-weighted tests when fewer slots than active tests
- Settings modal uses split layout with left nav tabs instead of single scrollable column
- Export/import updated to handle project-based v2 format with legacy v1 backward compatibility
- Test runner config persists correctly across tab switches (fixed race condition)
- Codebase modularized: App.tsx (1240→298 lines), ScenarioBuilder.tsx (2068→1287 lines)
- Monolithic App.css split into 8 focused CSS modules under src/styles/
- Extracted reusable components: SettingsModal, Sidebar, TestEditorModal
- Extracted hooks: useProjects (project state, CRUD, moves, persistence)

### Fixed
- Feature groups with orphaned env/svc references now visible as unassigned for reassignment
- Cross-project feature group move now copies referenced environments, microservices, and auth profiles
- Test runner config (host mode, custom URL) no longer resets when switching tabs

---

## [0.2.0-beta.1] — 2026-04-12

### Added
- Desktop application using Tauri (macOS, Windows, Linux)
- Native HTTP client for desktop mode (no CORS proxy needed)
- File-system storage for desktop mode (AppData directory)
- Global authentication profiles (Settings → manage named auth configs)
- Auth inheritance chain: Global Profile → Feature Group → Scenario → Test
- Import Center with conflict resolution (skip, overwrite, keep both)
- Export Center with standardized file naming (`{env}-{microservice}-{level}-{name}-{timestamp}.json`)
- Drag-and-drop reordering for scenarios and tests
- Cross-scenario/feature drag-and-drop moving
- Version badge in app header
- Version bump script (`scripts/version.sh`) with branch-aware tagging
- Git Flow branching strategy (master, develop, release/*, feature/*)
- GitHub Actions CI/CD for multi-platform builds
- `RELEASE.md` with full release process documentation

### Changed
- Renamed application from "Performance Test" to "RedfireForge"
- Storage layer converted to async (supports both localStorage and Tauri FS)
- Window title: "RedfireForge — Redfire Performance Workbench"
- Web header shows "Redfire Performance Workbench" subtitle; desktop omits it

### Fixed
- Tauri file path separator bug causing data loss on rebuilds
- URL scope permissions for Tauri HTTP plugin (all hosts/ports allowed)
- TypeScript build errors in ImportCenter, ScenarioBuilder, TestRunner

---

## [0.1.0] — 2026-04-10

### Added
- Initial web-based performance testing tool
- Feature Groups, Scenarios, and Tests hierarchy
- Environment and Microservice management
- Test Runner with configurable concurrency (sequential, parallel, ramp-up)
- OAuth2 authentication support
- JSON response validation builder
- Results Dashboard with historical test runs
- Export/Import functionality
- Sidebar navigation with environment/microservice filtering
- Vite dev server with CORS proxy for API requests

---

<!-- Template for new releases:

## [X.Y.Z] — YYYY-MM-DD

### Added
- New features

### Changed
- Changes to existing features

### Fixed
- Bug fixes

### Removed
- Removed features

-->
