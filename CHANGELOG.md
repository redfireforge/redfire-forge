# Changelog

All notable changes to RedfireForge will be documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/). Versions follow [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

_Changes merged into `develop` that haven't been released yet._

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
- Window title: "RedfireForge — API Performance Studio"
- Web header shows "API Performance Studio" subtitle; desktop omits it

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
