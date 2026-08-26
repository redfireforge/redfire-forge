# Contributing to RedfireForge

Thank you for your interest in contributing! Here's everything you need to get started.

---

## CLA

Before your first Pull Request can be merged, you must agree to the [Contributor License Agreement](CLA.md). By opening a PR you signify acceptance of the CLA.

---

## Quick Start

### Prerequisites

- **Node.js** >= 18
- **npm**
- **Rust** (desktop builds only — install via [rustup](https://rustup.rs/))

### Setup

```bash
git clone https://github.com/redfireforge/redfire-forge.git
cd redfire-forge
npm install
npm run dev        # web dev server at http://localhost:5173
npm run tauri:dev  # or native desktop with hot-reload
```

### Run tests

```bash
npm run typecheck          # TypeScript check (must always pass)
npm run test:product       # unit tests for product code
npm run test:e2e           # E2E tests (no Docker required)
npm run lint               # ESLint
```

---

## Branching Strategy

| Branch | Purpose |
|--------|---------|
| `develop` | Main integration branch — all PRs target this |
| `feature/<name>` | New features or improvements |
| `fix/<name>` | Bug fixes |
| `hotfix/<name>` | Critical production fixes |
| `release/<version>` | Release preparation |

**Always branch from `develop`.** Do not open PRs directly to `master`.

---

## Pull Request Guidelines

1. **One concern per PR** — keep changes focused and reviewable.
2. **Tests required** — all new behaviour must have unit or E2E coverage. The TypeScript check and product test suite must pass.
3. **No internal-only docs** — keep runbooks, planning docs, and design specs out of the public repo.
4. **Conventional commits** encouraged but not required:
   - `feat:` new user-visible feature
   - `fix:` bug fix
   - `docs:` documentation only
   - `refactor:` no behaviour change
   - `test:` test-only change
   - `chore:` maintenance
5. **PR description** — describe what changed and why. Link any relevant issues.

---

## Code Style

- TypeScript strict mode is enforced (`npx tsc -b --noEmit` must pass).
- ESLint rules are enforced (`npm run lint` must pass).
- Source files have a 900-line monolith limit enforced by `npm run lint:max-lines`.
- No raw `any` in production code — prefer explicit types or `unknown`.

---

## Reporting Issues

- **Bugs** — use the Bug Report issue template.
- **Feature requests** — use the Feature Request issue template.
- **Security vulnerabilities** — see [SECURITY.md](SECURITY.md). Do not open a public issue.

---

## License

By contributing, you agree that your contributions will be licensed under the [GNU Affero General Public License v3](LICENSE) and the terms of the [CLA](CLA.md).
