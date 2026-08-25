# RedfireForge — Before Launching: Additional Implementation Plan

> **Created:** 2026-08-24
> **Branch context:** Feature work on `feature/*` → merge into `develop` → `release/0.8.x`
> **Purpose:** Detail plans for all items that must be completed or strongly recommended before the public open-source launch. Derived from `long-term-enhancement-plan.md` audit (2026-08-24).
>
> **Execution order:** Items are sorted by effort (smallest first) so the repo becomes launch-legal and contributor-ready as fast as possible, then higher-effort items follow.

---

## Status Legend

| Status | Meaning |
|--------|---------|
| `TODO` | Not started |
| `IN PROGRESS` | Active work on a feature branch |
| `DONE` | Completed |
| `DEFERRED` | Intentionally postponed |

---

## Phase Tracker

| ID | Feature | Effort | Priority | Status |
|----|---------|--------|----------|--------|
| [L-0](#l-0-cla-setup--contributor-license-agreement) | CLA Setup | 30 min | 🔴 Critical | `TODO` |
| [L-1](#l-1-license-file) | LICENSE file (AGPL v3) | 5 min | 🔴 Critical | `TODO` |
| [L-2](#l-2-contributingmd--code-of-conduct) | CONTRIBUTING.md + CoC | 2 hrs | 🔴 Critical | `TODO` |
| [L-3](#l-3-npm-first-publish) | npm first publish | 30 min | 🔴 Critical | `TODO` |
| [L-4](#l-4-pr-status-checks--branch-protection) | PR Status Checks | 15 min | 🔴 Critical | `TODO` |
| [L-5](#l-5-live-demo-deployment) | Live Demo (Vercel) | 1 day | 🔴 Critical | `TODO` |
| [L-6](#l-6-readme-rewrite) | README Rewrite | 4 hrs | 🟠 High | `TODO` |
| [L-7](#l-7-ci-e2e-pipeline) | CI E2E Pipeline | 4 hrs | 🟠 High | `TODO` |
| [L-8](#l-8-dark-mode-system-preference-auto-detect) | Dark Mode auto-detect | 1 hr | 🟡 Medium | `TODO` |
| [L-9](#l-9-undoredo-wiring-in-workflow-editor) | Undo/Redo wiring | 2 hrs | 🟡 Medium | `TODO` |
| [L-10](#l-10-har-to-workflow-conversion) | HAR-to-Workflow import | 4 days | 🟡 Medium | `TODO` |
| [L-11](#l-11-desktop-distribution-windows--macos) | Desktop distribution (Windows + macOS) | 2 hrs | 🟠 High | `TODO` |
| [L-12](#l-12-saas-waitlist--lead-capture) | SaaS waitlist / lead capture | 2 hrs | 🟠 High | `TODO` |
| [L-13](#l-13-github-community-profile) | GitHub Community Profile | 30 min | 🔴 Critical | `TODO` |
| [L-14](#l-14-dependency-automation-dependabot--sbom) | Dependabot + SBOM | 30 min | 🟠 High | `TODO` |
| [L-15](#l-15-contributor-pre-commit-hooks) | Contributor pre-commit hooks | 1 hr | 🟡 Medium | `TODO` |
| [L-16](#l-16-social-preview-image) | Social preview image | 2 hrs | 🟡 Medium | `TODO` |
| [L-17](#l-17-launch-promotion-plan) | Launch promotion plan | 1 hr | 🟠 High | `TODO` |
| [L-18](#l-18-privacy-policy) | Privacy Policy | 1 hr | 🔴 Critical | `TODO` |
| [L-19](#l-19-good-first-issue-seeds) | "good first issue" seeds | 30 min | 🟠 High | `TODO` |
| [L-20](#l-20-fundingyml--sponsor-button) | FUNDING.yml / Sponsor button | 5 min | 🟡 Medium | `TODO` |
| [L-21](#l-21-codeowners) | CODEOWNERS | 15 min | 🟡 Medium | `TODO` |
| [L-22](#l-22-packagejson-metadata-cleanup) | `package.json` metadata cleanup | 5 min | 🔴 Critical | `TODO` |
| [L-23](#l-23-first-release-tag--release-workflow-procedure) | First release tag + release procedure | 30 min | 🔴 Critical | `TODO` |
| [L-24](#l-24-domain-registration--social-media-handles) | Domain registration + social handles | 1 hr | 🔴 Critical | `TODO` |

---

## L-0: CLA Setup / Contributor License Agreement

**Effort:** ~30 minutes (one-time GitHub configuration)  
**Blocks:** Legal right to re-license, dual-license, and pursue infringers — must be in place before the first external PR  
**Complexity:** Trivial

### Background
When contributors submit code under AGPL v3, they retain copyright on their patch by default. If 50 contributors each own part of the codebase, changing the license later (e.g., adding a commercial tier, moving to BSL, or offering enterprise licenses) requires getting written permission from all 50 people — practically impossible.

A CLA (Contributor License Agreement) is a one-time electronic signature where contributors grant RedfireForge the right to use their contribution in any way (including commercially), while they retain their own copyright. This is what **k6, Grafana, MongoDB, SAP, and Elastic** all require.

### CLA vs DCO

| | CLA | DCO (Developer Certificate of Origin) |
|--|-----|---------------------------------------|
| Legal effect | Grants rights to RedfireForge | Just confirms contributor had the right to submit |
| Re-license later | ✅ Yes | ❌ Need everyone's permission |
| Commercial license | ✅ Clean | ⚠️ Legally murky |
| Contributor friction | One-time sign (bot-automated) | `git commit -s` on every commit |
| Used by | k6, Grafana, MongoDB | Linux kernel, GitLab |

**Use CLA** — given the SaaS + dual-license plans, DCO is not sufficient.

### Tool: CLA Assistant (free)

https://cla-assistant.io — GitHub OAuth app, free for open source, stores signatures in a GitHub Gist.

### Implementation Steps

1. **Create the CLA document** — save as `.github/CLA.md`:
   ```markdown
   # RedfireForge Contributor License Agreement

   By signing this CLA, you agree to the following terms:

   1. **Grant of Rights:** You grant RedfireForge a perpetual, worldwide,
      non-exclusive, royalty-free, irrevocable license to reproduce, modify,
      distribute, sublicense, and otherwise use your Contribution, including
      for commercial purposes.

   2. **Copyright Retention:** You retain ownership of the copyright in your
      Contribution. This CLA does not transfer copyright to RedfireForge.

   3. **Right to Submit:** You confirm you have the legal right to make the
      Contribution (it is your original work, or you have permission from
      your employer if applicable).

   4. **No Warranties:** Your Contribution is provided "as is" without any
      warranty.

   5. **Corporate Contributors:** If you are contributing on behalf of a
      company, your company's authorized representative must also sign the
      Corporate CLA.
   ```

2. **Connect CLA Assistant to the repo:**
   - Go to https://cla-assistant.io
   - Sign in with GitHub
   - Click "Configure CLA"
   - Select the `redfireforge/redfire-forge` repository
   - Point it to `.github/CLA.md` as the CLA document
   - CLA Assistant will automatically create a Gist to track signatures

3. **Add CLA bot to the repo** — CLA Assistant adds a GitHub App. Enable it.

4. **Test the flow** — open a test PR from a second account:
   - Bot should comment: _"Please sign our CLA before we can merge this PR."_
   - Click the link → sign → bot marks PR with ✅ CLA Signed

5. **Add CLA status as a required check** in branch protection (alongside CI jobs).

6. **Add to CONTRIBUTING.md:**
   > Before your first PR can be merged, you must sign our [Contributor License Agreement](.github/CLA.md).
   > The CLA bot will automatically prompt you when you open a PR — it takes under 1 minute.

### Corporate Contributors (CCLA)
For companies whose employees contribute (common with enterprise users), a Corporate CLA is needed. Add a note in CONTRIBUTING.md directing companies to email you for a CCLA before their employees submit PRs.

### Success Criteria
- [ ] `.github/CLA.md` created with correct legal text
- [ ] CLA Assistant connected to the repo at cla-assistant.io
- [ ] Bot auto-comments on new PRs from unsigned contributors
- [ ] CLA signed status appears as a required check
- [ ] CONTRIBUTING.md mentions the CLA requirement
- [ ] Test PR from a second account confirms the full flow works

---

## L-1: LICENSE File

**Effort:** 5 minutes  
**Blocks:** All open-source use, npm publish legitimacy, contributor trust  
**Complexity:** Trivial

### Background
No `LICENSE` file exists in the repo root. Without a license, the repo is legally "all rights reserved" even if publicly visible — contributors cannot fork, use, or submit PRs without legal risk.

### Decision
**AGPL v3 (GNU Affero General Public License v3)**

Rationale:
- Matches the k6 / Grafana licensing model — the industry standard for SaaS-backed load testing tools
- Prevents competitors from hosting RedfireForge as a managed cloud service without open-sourcing their platform
- You (copyright owner) are exempt from your own license — you can freely offer a paid SaaS alongside the AGPL OSS version
- Enables dual-licensing: AGPL for OSS, commercial license sold to enterprises that need non-AGPL terms
- Well understood by the developer tooling community

### Implementation Steps

1. Create `LICENSE` at repo root with the full AGPL v3 text (canonical text from https://www.gnu.org/licenses/agpl-3.0.txt). Key header:
   ```
   GNU AFFERO GENERAL PUBLIC LICENSE
   Version 3, 19 November 2007

   Copyright (C) 2024–2026 RedfireForge
   ...
   ```
   The full AGPL v3 text is ~680 lines — copy verbatim from the GNU website. Do not modify it.

2. Add a short license header comment to the top of every source file (optional but professional):
   ```typescript
   // SPDX-License-Identifier: AGPL-3.0-or-later
   // Copyright (C) 2024–2026 RedfireForge
   ```
   Can be added gradually — not required on day 1.

3. Update both `package.json` files:
   ```json
   "license": "AGPL-3.0-or-later"
   ```

4. Confirm GitHub detects the license (shows "AGPL-3.0" badge on repo page).

5. Add a `COMMERCIAL-LICENSE.md` placeholder at repo root:
   ```markdown
   # Commercial License

   RedfireForge is available under the AGPL v3 for open-source and self-hosted use.

   For commercial licenses (if your use case is not compatible with AGPL v3,
   or if you want to embed RedfireForge in a proprietary product), contact:
   [your email]
   ```

### Success Criteria
- [ ] `LICENSE` file present in repo root with full AGPL v3 text
- [ ] GitHub repo page shows "AGPL-3.0" in the right sidebar
- [ ] Both `package.json` files have `"license": "AGPL-3.0-or-later"`
- [ ] `COMMERCIAL-LICENSE.md` placeholder created
- [ ] README mentions the license with a badge

---

## L-2: CONTRIBUTING.md + Code of Conduct

**Effort:** ~2 hours  
**Blocks:** First external PRs, contributor trust  
**Complexity:** Low

### Background
No `CONTRIBUTING.md` exists. Without it, potential contributors have no idea how to set up the project, what coding standards to follow, how to run tests, or how to submit PRs.

### Required Sections

```
CONTRIBUTING.md
├── 0. CLA Requirement (sign before first PR — CLA bot will prompt automatically)
├── 1. Prerequisites (Node 20+, Rust toolchain, pnpm/npm)
├── 2. Repository Setup (clone, install deps, env setup)
├── 3. Development Workflow
│   ├── Start dev server (npm run dev)
│   ├── Run unit tests (npx vitest run <path>)
│   ├── TypeScript check (npx tsc --noEmit)
│   └── Lint (npx eslint src/)
├── 4. Branch & PR Rules
│   ├── feature/* branches only (never commit to develop/master)
│   ├── PR template / checklist
│   └── Commit message format ([RedfireForge] description)
├── 5. Code Standards
│   ├── Coverage >90% for all new files
│   ├── No monolithic files >900 lines
│   ├── No raw alert() — use ConfirmModal
│   └── TypeScript strict — no `any`
├── 6. Running E2E Tests
├── 7. Building Tauri Desktop App
├── 8. Issue / Bug Report Template note
├── 9. Corporate Contributors (CCLA — email us before your employees contribute)
└── 10. Code of Conduct reference
```

### Implementation Steps

1. Create `CONTRIBUTING.md` at repo root with all sections above.
2. Create `.github/PULL_REQUEST_TEMPLATE.md` with checklist:
   - [ ] Tests pass (`npx vitest run`)
   - [ ] TypeScript clean (`npx tsc --noEmit`)
   - [ ] No lint errors (`npx eslint src/`)
   - [ ] Coverage ≥90% on changed files
   - [ ] No monolithic files added (>900 lines)
3. Create `.github/ISSUE_TEMPLATE/bug_report.md` and `feature_request.md`.
4. Add `CODE_OF_CONDUCT.md` (Contributor Covenant v2.1 — copy from https://www.contributor-covenant.org/).

### Success Criteria
- [ ] `CONTRIBUTING.md` covers CLA requirement, setup, workflow, standards, and E2E
- [ ] PR template appears when opening a new PR on GitHub
- [ ] Issue templates appear when clicking "New Issue"
- [ ] `CODE_OF_CONDUCT.md` present
- [ ] Corporate contributor CCLA contact path documented

---

## L-3: npm First Publish

**Effort:** ~30 minutes  
**Blocks:** CLI distribution, "install in one command" story  
**Complexity:** Low (workflow already exists)

### Background
`publish-cli.yml` is fully wired to trigger on `v*` tags or `workflow_dispatch`. The workflow builds the CLI, runs `npm publish`, and supports `dry_run` mode. The package has **never been published** — the npm registry returns 404 for `redfireforge-cli` as of 2026-08-18.

### Pre-Conditions
- `NPM_TOKEN` must be set as a GitHub Actions secret (Settings → Secrets → `NPM_TOKEN`)
- The npm account must own the `redfireforge-cli` package name (reserve it first if needed)
- Version in `cli/package.json` must be bumped to intended first public version

### Implementation Steps

1. **Reserve the npm package name** (if not already done):
   ```bash
   npm login
   # Create minimal package to reserve the name:
   cd cli && npm publish --dry-run
   # If 403 "not found", the name is available — publish for real
   ```

2. **Set `NPM_TOKEN` secret** in GitHub repo Settings → Secrets and variables → Actions.

3. **Dry-run first** via `workflow_dispatch` with `dry_run: true` to verify the workflow completes without error.

4. **Trigger real publish**:
   ```bash
   # Option A: push a version tag
   git tag v0.7.0
   git push origin v0.7.0

   # Option B: run workflow_dispatch with dry_run: false from GitHub UI
   ```

5. **Verify** on https://www.npmjs.com/package/redfireforge-cli.

6. **Add install badge to README**:
   ```md
   [![npm](https://img.shields.io/npm/v/redfireforge-cli)](https://www.npmjs.com/package/redfireforge-cli)
   ```

### Success Criteria
- [ ] `NPM_TOKEN` secret configured
- [ ] Dry-run passes via `workflow_dispatch`
- [ ] Package visible at `npmjs.com/package/redfireforge-cli`
- [ ] `npm install -g redfireforge-cli` works from a clean machine
- [ ] npm badge added to README

---

## L-4: PR Status Checks / Branch Protection

**Effort:** ~15 minutes (GitHub UI, no code)  
**Blocks:** Quality gates on the public repo  
**Complexity:** Trivial

### Background
The `ci.yml` runs tsc + ESLint + unit tests on push/PR, but these jobs are not configured as **required checks** in GitHub branch protection. Any PR can be merged without CI passing.

### Implementation Steps (GitHub UI)

1. Go to: **Settings → Branches → Add branch protection rule**

2. Configure for `master` branch:
   - ✅ Require a pull request before merging
   - ✅ Require status checks to pass before merging
     - Add **exactly** these required checks (copy names verbatim from `ci.yml` `name:` fields):
       - `TypeScript Check`
       - `ESLint`
       - `Unit Tests (product)`
       - `Unit Tests (demo)`
       - `Frontend Build (vite)`
       - `CLA Assistant` (added automatically by cla-assistant GitHub App after L-0)
       - `E2E Tests` (add after L-7 CI E2E job is created — it won't exist yet on Day 1)
     - **Important:** the exact string in the required-checks field must match the `name:` field of the GitHub Actions job, not the job key. If you type `Unit Tests` instead of `Unit Tests (product)`, the check will never match and every PR will be blocked.
   - ✅ Require branches to be up to date before merging
   - ✅ Require review from Code Owners (requires `.github/CODEOWNERS` to exist — complete L-21 first)
   - ✅ Do not allow bypassing the above settings for administrators (for the public `master` branch)
   - ✅ Require linear history (optional but keeps `git log --oneline` readable)

3. Configure for `develop` branch (slightly less strict — maintainer can bypass for hotfixes):
   - ✅ Require a pull request before merging
   - ✅ Require status checks to pass: same list as `master` minus E2E (until L-7 is done)
   - ✅ Allow maintainer bypass (your GitHub account)

4. **Verify job names in `ci.yml` are stable** (not generated dynamically — dynamic names break required checks):
   ```yaml
   jobs:
     type-check:
       name: TypeScript Check     # ← this exact string is the required check name
     lint:
       name: ESLint
     unit-tests-product:
       name: Unit Tests (product)
     unit-tests-demo:
       name: Unit Tests (demo)
     build:
       name: Frontend Build (vite)
   ```
   If any job is renamed in `ci.yml`, the required check entry in branch protection goes stale and becomes permanently unsatisfied — update branch protection immediately whenever a job is renamed.

### Success Criteria
- [ ] `master` branch protection rule active with all 5 CI checks required
- [ ] `develop` branch protection rule active (maintainer bypass allowed)
- [ ] CLA Assistant check added to required checks after L-0 is done
- [ ] E2E Tests check added to required checks after L-7 is done
- [ ] Test: open a PR with a failing test — confirm merge button is greyed out
- [ ] Test: open a PR from an unsigned account — confirm CLA Assistant blocks merge

---

## L-5: Live Demo Deployment

**Effort:** ~1 day  
**Blocks:** Adoption — "try it in 10 seconds" is the #1 driver for dev tool adoption  
**Complexity:** Medium (Vite SPA + feature flags)

### Background
No Vercel/Netlify deployment exists. The app is a Vite React SPA that builds to `dist/`. The Tauri-specific code paths are guarded by feature flags (`VITE_TAURI_ENV`). A browser-only build without Tauri should work as-is.

### Architecture Decision
Use **Vercel** (zero-config for Vite). The build produces `dist/index.html` + assets. Tauri IPC calls are guarded behind `window.__TAURI__` checks.

### Implementation Steps

1. **Verify browser-only build** — confirm Tauri-gated paths don't crash in browser:
   ```bash
   npm run build
   npx serve dist/   # test locally in browser
   ```
   - Navigate all protocol studios (HTTP, GraphQL, gRPC, WebSocket, SSE, Kafka)
   - Confirm Tauri executor gracefully falls back to JS executor
   - Fix any `window.__TAURI__` access that throws without guard

2. **Create `vercel.json`** at repo root:
   ```json
   {
     "buildCommand": "npm run build",
     "outputDirectory": "dist",
     "framework": "vite",
     "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }],
     "env": {
       "VITE_DEMO_MODE": "true"
     }
   }
   ```

3. **Add `.env.demo`** (or extend `.env.production.demo`):
   ```
   VITE_DEMO_MODE=true
   VITE_HIDE_TAURI_FEATURES=true
   ```

4. **Connect to Vercel**:
   - Go to vercel.com → New Project → Import from GitHub
   - Set environment variables: `VITE_DEMO_MODE=true`
   - Deploy

5. **Add auto-deploy GitHub Action** (extend `ci.yml` or new `deploy.yml`):
   ```yaml
   name: Deploy Demo
   on:
     push:
       branches: [master]
   jobs:
     deploy:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - uses: amondnet/vercel-action@v25
           with:
             vercel-token: ${{ secrets.VERCEL_TOKEN }}
             vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
             vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
             vercel-args: '--prod'
   ```

6. **Demo mode UI indicator** — small "Demo Mode" banner when `VITE_DEMO_MODE=true` to set expectations (Tauri features disabled).

7. **Update README** with demo link badge:
   ```md
   [![Live Demo](https://img.shields.io/badge/demo-live-brightgreen)](https://redfireforge.vercel.app)
   ```

### Feature Flag Audit
Scan for Tauri-only code paths that need browser guards:
- `window.__TAURI_INTERNALS__` — already has `canUseRustExecutor` guard
- File system ops (`fs.readFile`, `dialog.open`) — wrap in `isTauri()` check
- `invoke()` calls — must be gated

### Success Criteria
- [ ] `npm run build` completes without error
- [ ] All protocol studios load and are functional in browser (no Tauri crashes)
- [ ] Vercel deployment live at a stable URL
- [ ] Auto-deploy on `master` push working
- [ ] Demo mode banner shown in browser build
- [ ] README has live demo badge + link

---

## L-6: README Rewrite

**Effort:** ~4 hours  
**Blocks:** First impression for every GitHub visitor  
**Complexity:** Low (writing + asset capture)

### Background
Current `README.md` is 1,282 lines — too long, developer-internal, no GIFs/screenshots. For open-source adoption, the README must answer in <30 seconds: "What is this? Why should I care? How do I start?"

### Target Structure

```
README.md (target: ~300–400 lines, heavily visual)
├── Hero: Logo + tagline + badges (npm, license, CI, demo link)
├── 1-sentence pitch: "Visual load testing workbench..."
├── Screenshot/GIF: main UI (3 seconds to grab attention)
├── Feature highlights (6 bullets with icons, no paragraphs)
├── Quick Start (5 commands, <2 minutes)
│   ├── Web: npx serve (or Vercel link)
│   └── Desktop: Download .dmg / .exe / AppImage
├── CLI Quick Start (npm install -g redfireforge-cli; rf run test.yaml)
├── Protocol support table (HTTP, GraphQL, gRPC, WebSocket, SSE, Kafka)
├── Comparison table (vs k6, JMeter, Postman, Bruno)
├── Documentation link
└── Contributing / License
```

### Badges Row
```md
[![npm](https://img.shields.io/npm/v/redfireforge-cli)](https://npmjs.com/package/redfireforge-cli)
[![CI](https://github.com/redfireforge/redfire-forge/actions/workflows/ci.yml/badge.svg)](...)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Live Demo](https://img.shields.io/badge/demo-live-brightgreen)](https://redfireforge.vercel.app)
```

### Asset Capture Plan
Use Playwright to auto-capture screenshots:
- `scripts/capture-readme-screenshots.ts` — launch app, navigate to each studio, screenshot
- Save to `docs/assets/screenshots/`
- GIF of HTTP test run (record with LICEcap or ffmpeg)

### Comparison Table

Include this table in the README (adapt phrasing for tone — this is the suggested content):

| Feature | RedfireForge | k6 | Postman | Bruno | JMeter |
|---------|:-----------:|:--:|:-------:|:-----:|:------:|
| REST | ✅ | ✅ | ✅ | ✅ | ✅ |
| GraphQL | ✅ | ⚠️ partial | ✅ | ✅ | ⚠️ plugin |
| gRPC | ✅ | ✅ | ✅ paid | ❌ | ⚠️ plugin |
| WebSocket | ✅ | ✅ | ✅ paid | ❌ | ⚠️ |
| Kafka | ✅ | ❌ | ❌ | ❌ | ⚠️ plugin |
| SSE | ✅ | ❌ | ❌ | ❌ | ❌ |
| Visual workflow designer | ✅ | ❌ code only | ✅ | ❌ | ❌ |
| Load testing | ✅ | ✅ | ❌ | ❌ | ✅ |
| Desktop app | ✅ | ❌ | ✅ | ✅ | ✅ |
| CLI for CI | ✅ | ✅ | ✅ | ✅ | ✅ |
| Open source | ✅ AGPL | ✅ AGPL | ❌ | ✅ MIT | ✅ Apache |

Notes for accuracy before publishing:
- Postman gRPC and WebSocket were added as paid/beta features — verify current status
- Bruno gRPC support: check their current roadmap (may have changed)
- k6 WebSocket: native support exists but limited to client-send — verify

### Implementation Steps

1. Archive current `README.md` to `docs/archive/README-v0.6.md`
2. Write new README following the structure above (hero → pitch → screenshots → features → quick start → CLI → comparison → contributing → license)
3. Capture screenshots/GIFs with Playwright script
4. Move old developer docs (architecture notes, dev setup) to `docs/development.md`
5. Test the Quick Start section verbatim on a clean machine before publishing

### Success Criteria
- [ ] README is ≤400 lines
- [ ] At least 2 screenshots or 1 GIF in the hero section
- [ ] All 4 badges render correctly
- [ ] Quick start works verbatim on a clean machine (tested)
- [ ] Comparison table present
- [ ] Old content preserved in `docs/development.md` or `docs/archive/`

---

## L-7: CI E2E Pipeline

**Effort:** ~4 hours  
**Blocks:** Automated regression protection in the public repo  
**Complexity:** Medium (headless Playwright + artifact upload)

### Background
`ci.yml` runs unit tests + tsc + ESLint but has no Playwright E2E job. This means regressions in UI flows can slip through PRs undetected.

### Design Decisions
- Run E2E on PRs to `develop` and `master` only (not every feature push — too slow)
- Use `ubuntu-latest` with `xvfb` for headless Chromium
- Upload Playwright HTML report as artifact on failure
- Skip tests requiring Docker (Kafka) and external WS server — gate with `--grep-invert` tag or `@requires-docker` annotation

### Implementation Steps

1. **Tag environment-dependent tests** so CI can skip them:
   ```typescript
   // In each test that requires Docker/WS server:
   test.skip(process.env.CI === 'true' && !process.env.DOCKER_AVAILABLE, 'requires Docker');
   ```
   Or use Playwright project config to exclude:
   ```typescript
   // playwright.config.ts
   projects: [
     {
       name: 'ci',
       testIgnore: ['**/kafka/**', '**/ws-server/**'],
     }
   ]
   ```

2. **Add E2E job to `ci.yml`**:
   ```yaml
   e2e:
     name: E2E Tests
     runs-on: ubuntu-latest
     needs: [unit-tests, type-check, lint]
     if: github.event_name == 'pull_request'
     steps:
       - uses: actions/checkout@v4
       - uses: actions/setup-node@v4
         with: { node-version: '20', cache: 'npm' }
       - run: npm ci
       - run: npx playwright install --with-deps chromium
       - run: npm run build
       - name: Run E2E
         run: npx playwright test --project=ci --reporter=list
         env:
           CI: true
       - uses: actions/upload-artifact@v4
         if: failure()
         with:
           name: playwright-report
           path: playwright-report/
           retention-days: 7
   ```

3. **Create `ci` Playwright project** in `playwright.config.ts`:
   - Uses `chromium` only
   - Sets 30s timeout
   - Excludes Kafka, Docker-gated, TLS, and WS-server-gated tests

4. **Verify locally first**:
   ```bash
   CI=true npx playwright test --project=ci --reporter=list
   ```
   All tests must pass before merging the CI job.

5. **Add E2E job as required check** in GitHub branch protection (Step L-4 above).

### Success Criteria
- [ ] E2E job runs on PR open/update to `develop` and `master`
- [ ] All non-environmental E2E tests pass in CI (exit code 0)
- [ ] Playwright HTML report uploaded as artifact on failure
- [ ] Job completes in under 10 minutes
- [ ] E2E job added to required checks in branch protection

---

## L-8: Dark Mode System Preference Auto-Detect

**Effort:** ~1 hour  
**Blocks:** UX completeness — current theme picker defaults to `'dark'` hardcoded  
**Complexity:** Low (single `matchMedia` call + listener)

### Background
`useTheme.ts` initializes with `useState<string>('dark')` — hardcoded to dark regardless of system preference. Users on light-mode systems see the wrong theme on first load. The fix is to read `prefers-color-scheme` on mount and set the initial theme accordingly, falling back to the saved preference if one exists.

### Current State
```typescript
// src/app/hooks/useTheme.ts — line ~36
const [theme, setTheme] = useState<string>('dark');  // ← hardcoded
```

### Implementation

**Step 1** — Add a `getInitialTheme()` helper:
```typescript
function getInitialTheme(): string {
  // Saved preference always wins
  const saved = loadTheme();           // from @shared/utils/storage
  if (saved) return saved;
  // Fall back to system preference
  return window.matchMedia('(prefers-color-scheme: light)').matches
    ? 'light'
    : 'dark';
}
```

**Step 2** — Update `useState`:
```typescript
const [theme, setTheme] = useState<string>(getInitialTheme);
```

**Step 3** — Add a live listener for system preference changes (only fires if no saved preference):
```typescript
useEffect(() => {
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const handleChange = (e: MediaQueryListEvent) => {
    const saved = loadTheme();
    if (!saved) setTheme(e.matches ? 'dark' : 'light');
  };
  mq.addEventListener('change', handleChange);
  return () => mq.removeEventListener('change', handleChange);
}, []);
```

**Step 4** — Update `useTheme.test.ts` to cover:
- Initial theme from system preference (mock `matchMedia`)
- Saved preference overrides system preference
- Live change fires when no saved preference
- Live change does NOT fire when saved preference exists

### Success Criteria
- [ ] First load on a light-mode OS defaults to `'light'` theme (not `'dark'`)
- [ ] First load on a dark-mode OS defaults to `'dark'` theme
- [ ] User-saved theme overrides system preference
- [ ] Toggling system preference live updates theme if user hasn't picked one
- [ ] `useTheme.test.ts` coverage ≥90%

---

## L-9: Undo/Redo Wiring in Workflow Editor

**Effort:** ~2–4 hours  
**Blocks:** Core workflow UX — undo/redo buttons exist but are always disabled  
**Complexity:** Low–Medium (ReactFlow has built-in history; just needs wiring)

### Background
`WorkflowCanvasControls.tsx` renders Undo (⌘Z) and Redo (⌘⇧Z) buttons that accept `canUndo`, `canRedo`, `onUndo`, `onRedo` props — but `WorkflowDesignerFlowCanvas.tsx` never passes these props, so the buttons are always disabled. ReactFlow (v11+) provides `useStoreApi` / `useReactFlow` with `getNodes`, `setNodes`, `getEdges`, `setEdges` — the history stack needs to be tracked manually (ReactFlow does not have a built-in undo manager).

### Implementation Plan

**Option A — Custom lightweight history hook** (recommended, ~80 lines):
```typescript
// src/features/workflow/hooks/useWorkflowHistory.ts
export function useWorkflowHistory(nodes, edges, setNodes, setEdges) {
  const past = useRef<HistoryEntry[]>([]);
  const future = useRef<HistoryEntry[]>([]);

  const snapshot = useCallback(() => {
    past.current = [...past.current.slice(-50), { nodes, edges }];
    future.current = [];
  }, [nodes, edges]);

  const undo = useCallback(() => {
    if (!past.current.length) return;
    future.current = [{ nodes, edges }, ...future.current];
    const prev = past.current.pop()!;
    setNodes(prev.nodes);
    setEdges(prev.edges);
  }, [nodes, edges, setNodes, setEdges]);

  const redo = useCallback(() => {
    if (!future.current.length) return;
    past.current = [...past.current, { nodes, edges }];
    const next = future.current.shift()!;
    setNodes(next.nodes);
    setEdges(next.edges);
  }, [nodes, edges, setNodes, setEdges]);

  return { snapshot, undo, redo, canUndo: past.current.length > 0, canRedo: future.current.length > 0 };
}
```

**Option B — `use-undoable` npm package** (minimal code, ~5 lines) — evaluates if package is acceptable dependency.

### Integration Steps

1. Create `src/features/workflow/hooks/useWorkflowHistory.ts` (Option A).
2. Wire into `WorkflowDesignerFlowCanvas.tsx`:
   - Call `snapshot()` whenever nodes/edges change (on `onNodesChange`, `onEdgesChange` from ReactFlow that are "committed" changes — not drag moves mid-drag)
   - Pass `onUndo={undo}`, `onRedo={redo}`, `canUndo`, `canRedo` to `WorkflowCanvasControls`
3. Add keyboard shortcuts (⌘Z / ⌘⇧Z) in `WorkflowDesignerFlowCanvas`.
4. Add `useWorkflowHistory.test.ts` with coverage ≥90%.

### Edge Cases to Handle
- Snapshot only on "committed" changes (not during node drag — snapshot on `mouseUp`)
- Maximum history depth: 50 entries (prevent memory leak on large graphs)
- Clear future stack on new action after undo

### Success Criteria
- [ ] Undo/Redo buttons are enabled after making changes
- [ ] ⌘Z undoes last node/edge add or delete
- [ ] ⌘⇧Z redoes the undone action
- [ ] History cleared on workflow load/reset
- [ ] `useWorkflowHistory.test.ts` ≥90% coverage
- [ ] Max history depth enforced (50 steps)

---

## L-10: HAR-to-Workflow Conversion

**Effort:** ~3–4 days  
**Blocks:** Zero-setup onboarding — record in browser → import → test  
**Complexity:** High

### Background
HAR (HTTP Archive) is the standard format exported by Chrome/Firefox DevTools (Network → Export HAR). Converting a HAR file into a RedfireForge workflow graph would enable a user to go from "recording real traffic" to "running load tests" in under 2 minutes — the strongest possible new-user story.

### Architecture

```
HAR File (.har JSON)
    ↓
harParser.ts          — parse + filter HAR entries
    ↓
harToWorkflow.ts      — convert to WorkflowDefinition (nodes + edges)
    ↓
WorkflowDesigner      — open with imported workflow pre-populated
```

### HAR File Structure (relevant fields)
```json
{
  "log": {
    "entries": [{
      "request": {
        "method": "POST",
        "url": "https://api.example.com/users",
        "headers": [{ "name": "Authorization", "value": "Bearer ..." }],
        "postData": { "mimeType": "application/json", "text": "{...}" }
      },
      "response": {
        "status": 200,
        "content": { "mimeType": "application/json", "text": "{...}" }
      }
    }]
  }
}
```

### Implementation Steps

**Phase 1 — Parser (Day 1)**
1. Create `src/features/workflow/utils/harParser.ts`:
   - Parse HAR JSON, validate structure
   - Filter out browser internals (analytics, tracking pixels, OPTIONS preflight)
   - Deduplicate identical requests
   - Extract headers (filter sensitive ones: `Cookie`, `Authorization` → replace with `{{variable}}`)
   - Extract request bodies, query params
   - Return `ParsedHarEntry[]`

2. Add `harParser.test.ts` with real HAR fixtures (add sample `.har` to `test-data/`)

**Phase 2 — Converter (Day 2)**
1. Create `src/features/workflow/utils/harToWorkflow.ts`:
   - Convert `ParsedHarEntry[]` → `WorkflowDefinition`
   - Each HTTP request → HTTP Request node
   - Chain nodes sequentially with edges (linear flow)
   - Auto-generate variable names from URLs (`GET /users/{id}` → `userId` variable)
   - Set node positions in a top-to-bottom layout (`y += 120` per node)

2. Add `harToWorkflow.test.ts`

**Phase 3 — Import UI (Day 3)**
1. Add "Import from HAR" button to Workflow Designer toolbar (near existing import/export)
2. Open file picker (`input[type=file][accept=".har,application/json"]`)
3. Parse + convert → show preview modal:
   - "Found 12 requests. Import as 12-node workflow?"
   - List of method + URL per entry (checkboxes to exclude)
   - "Sensitive headers replaced with variables" notice
4. On confirm → open workflow designer with the generated workflow
5. Show warning if HAR entries reference `localhost` or internal IPs

**Phase 4 — Variable Extraction (Day 4)**
1. Detect response JSON fields that are used as path params in subsequent requests (basic chain detection)
2. Auto-insert extraction nodes: `Extract {{userId}} from response.body.id`
3. Add to `harToWorkflow` as optional step when chain detection finds matches

### File Layout
```
src/features/workflow/utils/
├── harParser.ts               — HAR parse + filter
├── harParser.test.ts
├── harToWorkflow.ts           — HAR → WorkflowDefinition
├── harToWorkflow.test.ts
src/features/workflow/components/
├── HarImportButton.tsx        — toolbar button
├── HarImportPreviewModal.tsx  — preview + confirm modal
test-data/
├── sample.har                 — sample HAR for testing
```

### Security Considerations
- Strip `Authorization`, `Cookie`, `Set-Cookie` headers — replace with `{{authToken}}` variable
- Warn on `localhost` / private IP URLs (192.168.x.x, 10.x.x.x)
- Never log HAR content — it may contain credentials

### Success Criteria
- [ ] Import a Chrome DevTools HAR → workflow graph renders correctly
- [ ] Sensitive headers replaced with `{{variables}}`
- [ ] Preview modal shows all requests with option to deselect
- [ ] Sequential chain of nodes with edges created
- [ ] `harParser.test.ts` and `harToWorkflow.test.ts` ≥90% coverage
- [ ] Works with HAR files from Chrome, Firefox, and Safari DevTools

---

## L-11: Desktop Distribution (Windows + macOS)

**Effort:** ~2 hours (documentation + GitHub Actions release job + Homebrew Cask PR)  
**Blocks:** Users actually being able to install the desktop app without fear  
**Complexity:** Low

### Background
Tauri produces `.msi`/`.exe` (Windows), `.dmg`/`.app` (macOS), and `.AppImage`/`.deb`/`.rpm` (Linux) binaries. Without code signing, both Windows and macOS show security warnings. The approach is: document the workarounds clearly, use Homebrew Cask for macOS to eliminate friction for technical users, and define a roadmap for paid signing certificates.

---

### Windows

#### What Happens Without Signing
Windows Defender SmartScreen shows:
```
"Windows protected your PC"
Microsoft Defender SmartScreen prevented an unrecognized app from starting.
Publisher: Unknown Publisher
[Don't run]   [More info ▼]
```
User clicks **More info** → **Run anyway**. It is a one-extra-click friction, not a hard block. Technical users (your target audience) handle this routinely.

#### Actions

1. **Document in README** (installation section):
   ```md
   ### Windows
   Windows may show a SmartScreen warning on first launch — this is expected
   for open-source apps without a paid certificate.
   1. Click **More info**
   2. Click **Run anyway**
   This warning reduces automatically as more users run the app.
   ```

2. **Add to GitHub Releases** — include a pinned note on the release page:
   > ⚠️ Windows users: If SmartScreen appears, click "More info" → "Run anyway". This is normal for unsigned open-source software.

3. **Free option: SignPath Foundation (recommended — eliminates SmartScreen entirely)**
   - Non-profit that provides free code signing certificates for verified open-source projects
   - Unlike Certum, signing happens **inside GitHub Actions** — no local certificate needed
   - Produces a properly signed `.exe`/`.msi` that removes SmartScreen with zero user friction
   - Apply at: https://signpath.org → "For Open Source Projects" → submit GitHub repo URL
   - Verification takes a few days; once approved, add their GitHub Actions step:
     ```yaml
     - uses: signpath/github-action-submit-signing-request@v1
       with:
         api-token: ${{ secrets.SIGNPATH_API_TOKEN }}
         organization-id: ${{ secrets.SIGNPATH_ORG_ID }}
         project-slug: redfire-forge
         signing-policy-slug: release-signing
         artifact-configuration-slug: windows-installer
         github-artifact-name: windows-build
         wait-for-completion: true
         output-artifact-directory: signed/
     ```
   - Apply before launch so the certificate is ready for the first public release

4. **Free backup: Certum OSS Certificate**
   - If SignPath verification is taking too long, Certum provides a free certificate for verified OSS projects
   - Apply at: https://www.certum.eu/en/cert_offer_oss/
   - Signing happens locally (not in CI) — you sign the artifact on your machine then upload to the release
   - Reduces (but may not fully eliminate) SmartScreen — acceptable while waiting for SignPath approval
   - Takes 1–2 weeks to verify

5. **Paid fallback (after first revenue): Microsoft Trusted Signing**
   - Cost: $9.99/month via Azure
   - Alternative if both SignPath and Certum are denied or too slow
   - Set up at: https://learn.microsoft.com/en-us/azure/trusted-signing/

---

### macOS

#### What Happens Without Signing + Notarization
macOS Gatekeeper shows:
```
"RedfireForge" can't be opened because Apple cannot check it
for malicious software.
[Move to Trash]   [Cancel]
```
The override is **hidden** — users must go to System Settings → Privacy & Security → "Open Anyway". More friction than Windows.

**Right-click workaround** (bypasses Gatekeeper, works on all macOS versions):
1. Right-click (Control+click) the `.app`
2. Select **Open** from the context menu
3. Click **Open** in the dialog

This is the standard workaround for all unsigned OSS macOS apps.

#### Actions

1. **Document in README** (installation section):
   ```md
   ### macOS
   macOS may block RedfireForge on first launch.

   **Quick fix:** Right-click the app → **Open** → **Open**

   Or: System Settings → Privacy & Security → scroll down → **Open Anyway**
   ```

2. **Submit to Homebrew Cask** (highest priority — free, eliminates friction for technical users)

   Homebrew installs bypass Gatekeeper automatically. Command for users:
   ```bash
   brew install --cask redfireforge
   ```

   **How to submit:**
   - Fork https://github.com/Homebrew/homebrew-cask
   - Create `Casks/r/redfireforge.rb`:
     ```ruby
     cask "redfireforge" do
       version "0.7.0"
       sha256 "<sha256_of_dmg>"

       url "https://github.com/redfireforge/redfire-forge/releases/download/v#{version}/RedfireForge_#{version}_aarch64.dmg"
       name "RedfireForge"
       desc "Visual API testing workbench with load testing and multi-protocol support"
       homepage "https://github.com/redfireforge/redfire-forge"

       app "RedfireForge.app"

       zap trash: [
         "~/Library/Application Support/RedfireForge",
         "~/Library/Preferences/com.redfireforge.app.plist",
       ]
     end
     ```
   - Open a PR to `homebrew-cask` — maintainers typically merge within 1–3 days
   - **Must have a stable GitHub Release URL first** (L-11 depends on a tagged release existing)

3. **Automate SHA256 in release workflow** — add to `release.yml`:
   ```yaml
   - name: Compute SHA256
     run: shasum -a 256 RedfireForge_*.dmg > RedfireForge.dmg.sha256
   - name: Upload checksums
     uses: actions/upload-release-asset@v1
     with:
       asset_path: RedfireForge.dmg.sha256
   ```
   The Homebrew Cask formula requires the SHA256 of the `.dmg` file.

4. **Future (after first revenue): Apple Developer Program ($99/year)**
   - Provides Developer ID certificate → sign + notarize the `.dmg`
   - After notarization: **zero warnings** on download and open
   - Required steps: `codesign` + `xcrun notarytool` + `xcrun stapler`
   - Tauri's build pipeline supports this natively via `tauri.conf.json`

---

### Linux

Linux distributions have no equivalent of SmartScreen or Gatekeeper — no signing required.

**Distribution channels:**

| Channel | How | Notes |
|---------|-----|-------|
| GitHub Releases | `.AppImage`, `.deb`, `.rpm` | Already produced by Tauri build |
| **Snapcraft** | `snap install redfireforge` | Free, Ubuntu Software Center listing |
| **Flathub** | `flatpak install redfireforge` | Free, major Linux distros |
| AUR (Arch) | `yay -S redfireforge` | Community-maintained, users submit it |

Snapcraft and Flathub submissions are free and significantly increase discoverability on Linux. Snapcraft is ~1 hour to set up.

---

### Two-Variant Strategy

The repo already has full infrastructure for two parallel builds:

| | Standard | Demo Hub (Learning Hub) |
|-|----------|------------------------|
| **Tauri config** | `src-tauri/tauri.conf.json` | `src-tauri/tauri.conf.demo.json` |
| **App name** | `RedfireForge` | `RedfireForge Learning Hub` |
| **Bundle ID** | `com.redfireforge.desktop` | `com.redfireforge.desktop.demo` |
| **Build script** | `npm run build` | `npm run build:demo` |
| **Tauri build** | `tauri:build:prod` | `tauri:build:demo` |
| **Env flag** | `VITE_ENABLE_DEMO_HUB=false` | `VITE_ENABLE_DEMO_HUB=true` |
| **Updater JSON** | `latest.json` | `latest-demo.json` |

Both are distinct Tauri apps with different `identifier`s — they install and auto-update independently and can coexist on the same machine.

### GitHub Release Workflow

Add/extend `.github/workflows/release.yml` to build **both variants on all platforms** in a single release. Each release publishes 8 Tauri artifact sets (4 platforms × 2 variants) plus checksums.

```yaml
name: Release
on:
  push:
    tags: ['v*']

jobs:
  release:
    strategy:
      fail-fast: false
      matrix:
        include:
          # ── Standard variant ──────────────────────────────────────────
          - os: ubuntu-latest
            target: x86_64-unknown-linux-gnu
            variant: standard
            tauri_config: ""          # uses default tauri.conf.json
            build_cmd: npm run build
          - os: macos-latest
            target: aarch64-apple-darwin
            variant: standard
            tauri_config: ""
            build_cmd: npm run build
          - os: macos-latest
            target: x86_64-apple-darwin
            variant: standard
            tauri_config: ""
            build_cmd: npm run build
          - os: windows-latest
            target: x86_64-pc-windows-msvc
            variant: standard
            tauri_config: ""
            build_cmd: npm run build
          # ── Demo Hub variant ──────────────────────────────────────────
          - os: ubuntu-latest
            target: x86_64-unknown-linux-gnu
            variant: demo
            tauri_config: "--config src-tauri/tauri.conf.demo.json"
            build_cmd: npm run build:demo
          - os: macos-latest
            target: aarch64-apple-darwin
            variant: demo
            tauri_config: "--config src-tauri/tauri.conf.demo.json"
            build_cmd: npm run build:demo
          - os: macos-latest
            target: x86_64-apple-darwin
            variant: demo
            tauri_config: "--config src-tauri/tauri.conf.demo.json"
            build_cmd: npm run build:demo
          - os: windows-latest
            target: x86_64-pc-windows-msvc
            variant: demo
            tauri_config: "--config src-tauri/tauri.conf.demo.json"
            build_cmd: npm run build:demo

    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
        with: { targets: ${{ matrix.target }} }
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: ${{ matrix.build_cmd }}   # builds frontend with correct VITE_ flags
      - uses: tauri-apps/tauri-action@v0
        with:
          tagName: ${{ github.ref_name }}
          releaseName: RedfireForge ${{ github.ref_name }}
          # tauri-action runs `tauri build` — pass variant config + target
          args: --target ${{ matrix.target }} ${{ matrix.tauri_config }}
          # Avoid duplicate release creation across matrix jobs
          includeUpdaterJson: true
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

  checksums:
    name: SHA256 checksums
    needs: release
    runs-on: ubuntu-latest
    steps:
      - uses: actions/download-artifact@v4
        with: { path: artifacts }
      - name: Compute checksums
        run: |
          find artifacts -type f \( -name "*.dmg" -o -name "*.msi" -o -name "*.AppImage" -o -name "*.deb" \) \
            -exec sha256sum {} \; > checksums.txt
      - uses: actions/upload-release-asset@v1
        with:
          asset_path: checksums.txt
          asset_name: checksums.txt
          asset_content_type: text/plain
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Artifact Naming Convention

Tauri names artifacts after `productName` from the config, so the two variants produce distinct filenames automatically:

| Platform | Standard | Demo Hub |
|----------|----------|----------|
| macOS arm64 | `RedfireForge_0.7.0_aarch64.dmg` | `RedfireForge-Learning-Hub_0.7.0_aarch64.dmg` |
| macOS x64 | `RedfireForge_0.7.0_x64.dmg` | `RedfireForge-Learning-Hub_0.7.0_x64.dmg` |
| Windows | `RedfireForge_0.7.0_x64-setup.exe` | `RedfireForge-Learning-Hub_0.7.0_x64-setup.exe` |
| Linux | `redfire-forge_0.7.0_amd64.AppImage` | `redfireforge-learning-hub_0.7.0_amd64.AppImage` |

### Homebrew Cask (Two Formulas)

Since the two apps have different bundle IDs and artifact URLs, each needs its own formula:

- `Casks/r/redfireforge.rb` — standard (no Learning Hub)
- `Casks/r/redfireforge-learning-hub.rb` — demo variant

```ruby
# Casks/r/redfireforge-learning-hub.rb
cask "redfireforge-learning-hub" do
  version "0.7.0"
  sha256 "<sha256_of_demo_dmg>"

  url "https://github.com/redfireforge/redfire-forge/releases/download/v#{version}/RedfireForge-Learning-Hub_#{version}_aarch64.dmg"
  name "RedfireForge Learning Hub"
  desc "RedfireForge with interactive protocol lessons and guided demos"
  homepage "https://github.com/redfireforge/redfire-forge"

  app "RedfireForge Learning Hub.app"

  zap trash: [
    "~/Library/Application Support/com.redfireforge.desktop.demo",
    "~/Library/Preferences/com.redfireforge.desktop.demo.plist",
  ]
end
```

### Auto-Updater JSON

The two Tauri configs already point to different updater endpoints:
- Standard: `.../releases/latest/download/latest.json`
- Demo: `.../releases/latest/download/latest-demo.json`

`tauri-action` generates these JSON files and uploads them automatically when `includeUpdaterJson: true`. No extra work needed beyond the release workflow above.

### Vercel Deployments (Web)

Two separate Vercel projects, same GitHub repo, different build commands:

| Project | Build command | Domain |
|---------|---------------|--------|
| `redfire-forge` | `npm run build` | `app.redfireforge.com` |
| `redfire-forge-demo` | `npm run build:demo` | `demo.redfireforge.com` |

Both auto-deploy on push to `master`. Set up in Vercel dashboard → New Project → select repo → override Build Command.

### Success Criteria
- [ ] Windows README section documents SmartScreen workaround (both variants)
- [ ] macOS README section documents right-click workaround (both variants)
- [ ] SignPath Foundation application submitted (apply early — verification takes a few days)
- [ ] SignPath GitHub Actions step added to release workflow once approved
- [ ] Certum OSS application submitted as backup if SignPath is delayed
- [ ] Release workflow matrix produces all 8 artifact sets (4 platforms × 2 variants)
- [ ] `latest.json` and `latest-demo.json` both uploaded per release (auto-updater works)
- [ ] SHA256 checksums published with each release
- [ ] Two Homebrew Cask formulas created and PRs opened (`redfireforge` + `redfireforge-learning-hub`)
- [ ] Linux: Snapcraft submission completed for standard variant
- [ ] README has per-platform download links for both variants
- [ ] Two Vercel deployments configured (`app.*` and `demo.*` subdomains)

---

## L-12: SaaS Waitlist / Lead Capture

**Effort:** ~2 hours (Phase 1) + ~3 hours (Phase 2, when building SaaS)  
**Blocks:** Nothing for launch — but every day without it is a missed lead  
**Complexity:** Trivial (Phase 1), Low (Phase 2)

### Background
GitHub does not share the email addresses of people who star or download your repo. To build a candidate list for the future SaaS, you must give users an explicit reason to hand over their contact info. The approach is a two-phase escalation: zero-infrastructure capture at launch (Tally + Google Sheet), then migrate to your own database when building the SaaS.

---

### Where Data Is Stored

| Phase | Stack | Who stores it | You own it? |
|-------|-------|---------------|-------------|
| **Phase 1** | Tally form → Google Sheet (via Zapier) | Tally + Google | After export |
| **Phase 2** | Vercel API route → Supabase (Postgres) | Your Supabase project | ✅ Fully |

Phase 1 collects: email, source (README / in-app banner / demo site), signup date, app version.

---

### Phase 1 — Zero-Infrastructure Capture (Launch Day)

**Effort:** ~2 hours total

#### Step 1: Create the waitlist form (Tally.so — free, unlimited responses)

1. Go to https://tally.so → New form
2. Fields:
   - Email address (required)
   - How are you using RedfireForge? (optional, single-select: Personal / Team / Enterprise)
   - Hidden field: `source` (set per embed/link — `readme`, `in-app`, `demo-site`)
3. Success message: *"You're on the list! We'll notify you when RedfireForge Cloud launches."*
4. Connect Tally → Google Sheets via Tally's native integration (Settings → Integrations → Google Sheets)
   - Each submission appends a row: `timestamp | email | use_case | source`
5. Copy the form's shareable URL (e.g. `https://tally.so/r/xxxxxxx`)

#### Step 2: Add `source` parameter to each entry point

Create three links pointing to the same form with different `source` query params:
- README: `https://tally.so/r/xxxxxxx?source=readme`
- In-app banner: `https://tally.so/r/xxxxxxx?source=in-app`
- Demo site: `https://tally.so/r/xxxxxxx?source=demo-site`

Tally passes the hidden field value automatically — no extra config.

#### Step 3: Add in-app waitlist banner

Add a dismissible banner to the main app layout (shown once, dismissible to localStorage):

```tsx
// src/app/components/AppCloudWaitlistBanner.tsx
export function AppCloudWaitlistBanner() {
  const [dismissed, setDismissed] = useLocalStorage('cloud-waitlist-dismissed', false);
  if (dismissed) return null;
  return (
    <div className="cloud-waitlist-banner">
      <span>☁️ <strong>RedfireForge Cloud</strong> is coming — hosted testing, team workspaces, CI integration.</span>
      <a href="https://tally.so/r/xxxxxxx?source=in-app" target="_blank" rel="noopener">Join the waitlist →</a>
      <button onClick={() => setDismissed(true)} aria-label="Dismiss">✕</button>
    </div>
  );
}
```

Show it on the main app shell, beneath the header. Style to match the app's existing banner patterns.

#### Step 4: Add waitlist link to README and demo site

In README, add a prominent section near the top:
```md
## ☁️ RedfireForge Cloud — Coming Soon
Hosted load testing, team workspaces, and CI integration.  
[→ Join the waitlist](https://tally.so/r/xxxxxxx?source=readme)
```

On `demo.redfireforge.com`: add a modal or banner after the user completes their first demo lesson:
> *"Enjoyed the demo? Join the waitlist for RedfireForge Cloud."*

#### Step 5: Verify data flows into Google Sheet

- Submit a test entry via each entry point (README link, in-app banner, demo site)
- Confirm three rows appear in the Sheet with correct `source` values
- Add a filter view: sort by `source` to see which channel drives the most signups

---

### Phase 2 — Own Your Data (Before SaaS Launch)

**Effort:** ~3 hours  
**Trigger:** When you start building the SaaS backend

#### Step 1: Create Supabase project

1. Go to https://supabase.com → New project (free tier: 500MB, unlimited rows)
2. Create table:
   ```sql
   create table waitlist (
     id uuid default gen_random_uuid() primary key,
     email text not null unique,
     use_case text,
     source text,
     app_version text,
     created_at timestamptz default now()
   );
   ```
3. Copy the project URL and `anon` key

#### Step 2: Add Vercel serverless API route

Create `src-server/api/waitlist.ts` (or a Vercel Edge Function):

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!   // service key — server-side only, never exposed to client
);

export default async function handler(req: Request) {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
  const { email, useCase, source, appVersion } = await req.json();
  // Basic input validation
  if (!email || !/^[^@]+@[^@]+\.[^@]+$/.test(email)) {
    return new Response(JSON.stringify({ error: 'Invalid email' }), { status: 400 });
  }
  const { error } = await supabase.from('waitlist').upsert(
    { email, use_case: useCase, source, app_version: appVersion },
    { onConflict: 'email' }   // idempotent — re-submitting same email is a no-op
  );
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
}
```

#### Step 3: Update in-app banner to POST directly

Replace the Tally URL with a direct API call:
```typescript
await fetch('/api/waitlist', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, source: 'in-app', appVersion: APP_VERSION }),
});
```

#### Step 4: Import Phase 1 data

Export the Google Sheet as CSV → import into Supabase via the dashboard Table Editor → Import CSV. All early signups migrate in one step.

---

### Privacy / Legal

- Add a privacy policy page (even a minimal one) — required for GDPR compliance when collecting emails in the EU
- The waitlist form must include: *"By submitting, you agree to receive product updates from RedfireForge. We will never share your email."*
- Tally is GDPR-compliant; Supabase EU region is available if needed
- Add a one-line privacy policy link to the in-app banner and README waitlist section

### Success Criteria
- [ ] Tally form created with `source` hidden field and three entry-point URLs
- [ ] Google Sheet integration active (submissions auto-append rows)
- [ ] In-app `AppCloudWaitlistBanner` component added (dismissible, localStorage-persisted)
- [ ] README waitlist section added with link
- [ ] Demo site post-lesson waitlist prompt added
- [ ] Test submissions from all three sources appear in Google Sheet with correct `source` values
- [ ] Privacy notice text present on form and in-app banner
- [ ] (Phase 2) Supabase `waitlist` table created
- [ ] (Phase 2) `/api/waitlist` endpoint deployed and accepting submissions
- [ ] (Phase 2) Phase 1 CSV data imported into Supabase

---

## L-13: GitHub Community Profile

**Effort:** ~30 minutes (GitHub UI only, zero code)  
**Blocks:** Credibility — GitHub shows a "Community profile" health score on every public repo; a score below 100% is a visible signal of neglect  
**Complexity:** Trivial

### Background
GitHub's Community profile (`github.com/<org>/redfire-forge/community`) checks for: description, website, topics, README, CONTRIBUTING, LICENSE, CODE_OF_CONDUCT, SECURITY policy, and issue templates. L-1 and L-2 cover most of these. The three gaps are `SECURITY.md`, repo metadata, and GitHub Discussions.

### Step 1: SECURITY.md

Create `.github/SECURITY.md`:

```markdown
# Security Policy

## Supported Versions

| Version | Supported |
|---------|----------|
| Latest stable | ✅ |
| Older releases | ❌ (upgrade recommended) |

## Reporting a Vulnerability

Please **do not** open a public GitHub issue for security vulnerabilities.

Email: security@redfireforge.com (or your personal address until a dedicated one is set up)

Include:
- Description of the vulnerability
- Steps to reproduce
- Affected versions
- Any suggested fix

You will receive an acknowledgement within 48 hours. We aim to release a patch within 14 days of confirmation.

## Disclosure Policy

We follow coordinated disclosure: we will work with you to understand and fix the issue before public disclosure. Credit will be given in the release notes unless you prefer to remain anonymous.
```

### Step 2: GitHub repo metadata (GitHub UI → repo Settings → General)

- **Description:** `Visual API testing workbench with multi-protocol load testing — REST, GraphQL, gRPC, WebSocket, Kafka, SSE`
- **Website:** `https://demo.redfireforge.com` (or waitlist URL until demo is live)
- **Topics:** `load-testing` `api-testing` `typescript` `tauri` `grpc` `websocket` `kafka` `graphql` `sse` `playwright` `vite` `react` `performance-testing` `developer-tools`

Topics are the primary mechanism for GitHub search and the "Explore" page — they directly drive organic discovery.

### Step 3: Enable GitHub Discussions

GitHub UI → repo Settings → Features → tick **Discussions**.

Create three starter categories:
| Category | Type | Purpose |
|----------|------|---------|
| Q&A | Q&A | Users ask how-to questions |
| Show & Tell | Open | Users share what they built |
| Ideas | Open | Feature requests (separate from Issues) |

Pinned announcement: *"Welcome to RedfireForge Discussions! Use Q&A for questions, Show & Tell to share your setups, and Ideas for feature requests. For bugs, open an Issue."*

This keeps bug Issues clean and gives your community a home.

### Success Criteria
- [ ] `.github/SECURITY.md` created with contact email and disclosure policy
- [ ] GitHub Community profile score reaches 100%
- [ ] Repo description, website URL, and ≥10 topics set
- [ ] GitHub Discussions enabled with Q&A, Show & Tell, Ideas categories
- [ ] Welcome pinned announcement posted in Discussions

---

## L-14: Dependency Automation (Dependabot + SBOM)

**Effort:** ~30 minutes  
**Blocks:** Security hygiene — without Dependabot, CVEs accumulate silently in npm and Cargo deps  
**Complexity:** Trivial

### Dependabot

Create `.github/dependabot.yml`:

```yaml
version: 2
updates:
  # npm — root workspace
  - package-ecosystem: npm
    directory: /
    schedule:
      interval: weekly
      day: monday
    open-pull-requests-limit: 10
    groups:
      # Batch minor/patch updates into one PR per week instead of one per package
      minor-and-patch:
        update-types: [minor, patch]

  # npm — CLI package
  - package-ecosystem: npm
    directory: /cli
    schedule:
      interval: weekly
      day: monday
    open-pull-requests-limit: 5
    groups:
      minor-and-patch:
        update-types: [minor, patch]

  # Cargo — Tauri / Rust deps
  - package-ecosystem: cargo
    directory: /src-tauri
    schedule:
      interval: weekly
      day: monday
    open-pull-requests-limit: 5

  # GitHub Actions
  - package-ecosystem: github-actions
    directory: /
    schedule:
      interval: weekly
      day: monday
```

The `groups` key batches minor/patch updates into a single PR per week instead of one PR per package — critical for a repo with 600+ npm deps.

### SBOM (Software Bill of Materials)

Add to the release workflow (`.github/workflows/release.yml`) as a final job after artifacts are uploaded:

```yaml
  sbom:
    name: Generate SBOM
    needs: release
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: anchore/sbom-action@v0
        with:
          format: spdx-json
          output-file: sbom.spdx.json
      - uses: actions/upload-release-asset@v1
        with:
          asset_path: sbom.spdx.json
          asset_name: sbom.spdx.json
          asset_content_type: application/json
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

Enterprise users and security scanners (Snyk, Grype, Trivy) can consume `sbom.spdx.json` directly from the release page to audit the dependency tree before approving the tool for internal use.

### Success Criteria
- [ ] `.github/dependabot.yml` committed with npm (root + cli), Cargo, and GitHub Actions sections
- [ ] First Dependabot PRs appear within a week
- [ ] Dependabot PRs added to branch protection: require CI to pass before merge
- [ ] `sbom.spdx.json` appears as a release asset on the next tagged release

---

## L-15: Contributor Pre-commit Hooks

**Effort:** ~1 hour  
**Blocks:** Contributor experience — without this, contributors only learn about lint/type errors after pushing; CI fails and they need a round-trip  
**Complexity:** Low

### Background
Currently lint and TypeScript errors are only caught in CI. A pre-commit hook runs the same checks locally before the commit is made, giving instant feedback. This is especially important for first-time contributors who may not know to run `npx tsc --noEmit` manually.

### Implementation

**Step 1 — Install Husky and lint-staged:**
```bash
npm install --save-dev husky lint-staged
npx husky init
```

**Step 2 — Configure `.husky/pre-commit`:**
```sh
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"
npx lint-staged
```

**Step 3 — Add `lint-staged` config to root `package.json`:**
```json
"lint-staged": {
  "*.{ts,tsx}": [
    "eslint --max-warnings=0",
    "bash -c 'npx tsc -b --noEmit'"
  ],
  "*.{ts,tsx,css,json,md}": [
    "prettier --write"
  ]
}
```

**Step 4 — Add `prepare` script** so Husky installs automatically after `npm ci`:
```json
"scripts": {
  "prepare": "husky"
}
```

**Note:** The `tsc -b --noEmit` check runs on the whole project (not just staged files) because TypeScript's type-checking is cross-file. This adds ~5–10 seconds to the commit. If it becomes too slow, replace with `tsc --noEmit --incremental` or skip in CI (where `tsc` runs separately anyway via `--no-verify` is available for emergency overrides).

### Success Criteria
- [ ] `husky` and `lint-staged` installed and committed
- [ ] `.husky/pre-commit` blocks commits with ESLint errors
- [ ] `.husky/pre-commit` blocks commits with TypeScript errors
- [ ] `npm ci` on a fresh clone automatically installs the hooks (via `prepare` script)
- [ ] `git commit --no-verify` documented in CONTRIBUTING.md as an emergency override only

---

## L-16: Social Preview Image

**Effort:** ~1–2 hours (design)  
**Blocks:** Social sharing — every link share on Slack, LinkedIn, Twitter, and Hacker News shows this image  
**Complexity:** Low (design work, no code)

### Background
GitHub generates a social preview card (Open Graph image) for every repo. Without a custom image, GitHub shows a generic grey card with the repo name. A well-designed preview card dramatically increases click-through when the link is shared in Slack channels, newsletters, or on HN.

Required size: **1280 × 640 pixels**, PNG or JPG.

### What to Include

```
┌────────────────────────────────────────────────────────────────┐
│  🔥 RedfireForge                    [app screenshot]  │
│                                                        │
│  Visual API testing workbench                          │
│  REST · GraphQL · gRPC · WebSocket · Kafka · SSE       │
│                                                        │
│  github.com/redfireforge/redfire-forge                 │
└────────────────────────────────────────────────────────────────┘
```

Key elements:
- Logo / wordmark on the left
- Actual app screenshot (workflow designer or test runner) on the right
- Protocol badges: `REST` `GraphQL` `gRPC` `WebSocket` `Kafka` `SSE` in pill style
- Dark background (matches the app's dark theme)
- GitHub URL in small text at the bottom

### Tools
- **Figma** (free) — recommended if you have design experience
- **Canva** (free) — use the "GitHub Social Preview" template
- **OG Image generators** (code-based): `@vercel/og` can generate this from a React component deployed as a Vercel Edge Function — useful when the image should auto-update with version numbers

### Upload
GitHub UI → repo Settings → General → **Social preview** → Edit → Upload image.

Also use the same image as:
- The README hero image (scaled down)
- Twitter/X profile banner for a project account
- Open Graph meta tag on the live demo site

### Success Criteria
- [ ] 1280×640px social preview image uploaded to GitHub repo settings
- [ ] Preview visible when pasting the repo URL into Slack / Twitter / LinkedIn
- [ ] Same image used as README hero banner
- [ ] Demo site `og:image` meta tag points to the image

---

## L-17: Launch Promotion Plan

**Effort:** ~1 hour (write the posts + schedule)  
**Blocks:** Discoverability — without a coordinated announcement, the repo launches silently  
**Complexity:** Trivial

### Background
A well-timed, multi-channel launch announcement drives the initial wave of GitHub stars, waitlist signups, and community momentum. The first 48 hours after a Show HN post determine whether you reach the front page and get lasting organic traffic.

### Channels and Post Format

#### 1. Hacker News — Show HN (highest impact)

Post format:
```
Show HN: RedfireForge – visual API testing for REST, GraphQL, gRPC, WebSocket, Kafka, SSE
```
URL: link to the GitHub repo (not the demo site — HN audience prefers the source).

First comment (post immediately after submitting — this is the "pitch"):
```
Hi HN! I built RedfireForge because I was tired of switching between Postman,
k6, wscat, and grpcurl every time I needed to test a different protocol.

It’s a visual desktop workbench (Tauri + React) that handles REST, GraphQL,
gRPC, WebSocket, Server-Sent Events, and Kafka from a single UI — with a
workflow designer for chaining calls, load testing, and a CLI for CI pipelines.

The demo hub version includes interactive guided lessons for each protocol.

Would love feedback on: (1) which protocols matter most to your team,
(2) whether the workflow designer is intuitive, (3) what’s missing.

GitHub: https://github.com/redfireforge/redfire-forge
Live demo: https://demo.redfireforge.com
npm: npm install -g redfireforge-cli
```

**Timing:** Tuesday–Thursday, 9–11am US Eastern time. This is when HN is most active.

#### 2. Reddit

| Subreddit | Title | Notes |
|-----------|-------|-------|
| r/programming | `RedfireForge – open source visual API testing workbench (REST/GraphQL/gRPC/WebSocket/Kafka)` | Link post to GitHub |
| r/devops | `Show r/devops: RedfireForge – visual load testing + workflow designer for multiple protocols` | Emphasize CI/load testing angle |
| r/softwaretesting | `RedfireForge – multi-protocol API test runner with visual workflow designer` | Emphasize testing angle |
| r/rust | `RedfireForge – built with Tauri + React, visual API workbench for REST/gRPC/Kafka/WS` | Emphasize Tauri/Rust angle |
| r/webdev | `Open source Postman alternative with gRPC, WebSocket, Kafka, and load testing built in` | Emphasize Postman alternative angle |

Do **not** post all subreddits on the same day — space them out by 1–2 days to avoid looking like spam.

#### 3. Product Hunt

Full launch page with:
- Tagline: `Visual API testing workbench for REST, GraphQL, gRPC, WebSocket, Kafka, and SSE`
- Gallery: 5–6 screenshots (workflow designer, test runner, each protocol, results dashboard)
- Video: 90-second demo GIF or screen recording
- Link to live demo and GitHub

**Note:** Schedule Product Hunt for a Tuesday (launches at midnight SF time). Ask a few users from the waitlist to upvote on launch day — early upvotes determine front-page placement.

#### 4. Dev.to Article

Write a 600–1000-word article: *"Why I built RedfireForge: one tool for all your API protocols"*
- Tell the story: the problem, the decision to build it open source, what it does
- Include screenshots
- End with: GitHub link, npm install command, waitlist link

Dev.to articles rank well in Google for long-tail searches like "grpc testing tool open source".

#### 5. Twitter/X Thread

```
Tweet 1: 🚀 Just open-sourced RedfireForge — a visual API testing workbench
that handles REST, GraphQL, gRPC, WebSocket, Kafka, and SSE from one UI.

No more tab-switching between Postman + wscat + grpcurl + k6.

[screenshot of workflow designer]

Tweet 2: Built with Tauri (Rust) + React + TypeScript.
Desktop app for macOS, Windows, Linux.
CLI for CI pipelines: npm install -g redfireforge-cli

Tweet 3: Features:
• Visual workflow designer — chain API calls into test flows
• Load testing built in
• Results dashboard with SLA tracking
• Interactive protocol lessons (Demo Hub)
• AGPL v3 + commercial license available

Tweet 4: GitHub: [link]
Live demo: [link]
Join the cloud waitlist: [tally link]

⭐ Star it if you find it useful!
```

#### 6. LinkedIn Post

Same content as the Twitter thread but written as a single post. LinkedIn algorithm favors posts that keep users on the platform — include a short summary paragraph instead of just a link.

#### 7. Discord / Slack Communities

| Community | Channel |
|-----------|--------|
| Tauri Discord | `#showcase` |
| Playwright Discord | `#general` or `#show-and-tell` |
| Software Testing Slack | announcements channel |
| Rust Discord | `#projects` |
| DevOps Lounge Discord | `#tools` |

Post a brief 2–3 sentence description + GitHub link. Do not post the same message to multiple channels of the same server.

### Launch Sequence

```
Week before launch:
  — Finalize README, demo site, social preview image (L-6, L-5, L-16)
  — Write and review HN Show HN post + first comment
  — Write Dev.to article draft
  — Set up Product Hunt page (schedule for Tuesday)
  — Notify waitlist signups ("We’re launching next Tuesday!")

Launch day (Tuesday, 9am ET):
  — Submit Show HN post
  — Post first comment immediately
  — Post Twitter/X thread
  — Post LinkedIn
  — Post r/programming
  — Post in Discord communities
  — Product Hunt goes live (midnight SF time the night before)

Day 2:
  — Post r/devops
  — Publish Dev.to article

Day 3–5:
  — Post remaining subreddits (r/softwaretesting, r/rust, r/webdev)
  — Respond to all HN / Reddit comments
```

### Success Criteria
- [ ] Show HN post + first comment text written and reviewed
- [ ] Dev.to article drafted
- [ ] Product Hunt page prepared (screenshots, video, tagline)
- [ ] Twitter/X thread written
- [ ] Discord / Slack communities identified and introduction message drafted
- [ ] Launch sequence scheduled (day-by-day calendar)
- [ ] Waitlist notified 1 week before launch

---

## L-18: Privacy Policy

**Effort:** ~1 hour  
**Blocks:** Waitlist launch (L-12) — collecting emails without a privacy policy violates GDPR (EU) and CCPA (California)  
**Complexity:** Low

### Background
The moment a waitlist form goes live, any EU user who submits their email triggers GDPR obligations. A simple, plain-language privacy policy hosted at a stable URL is the minimum requirement. It does not need a lawyer — at this stage a clear, honest one-pager is sufficient.

### What to Cover

The privacy policy must answer six questions:
1. **Who** is collecting data? (RedfireForge, your name/contact)
2. **What** data is collected? (email, optional use-case field, source tag, app version)
3. **Why** is it collected? (product updates, SaaS launch notifications)
4. **Where** is it stored? (Phase 1: Tally + Google Sheets; Phase 2: Supabase)
5. **How long** is it kept? (until you request deletion, or we shut down the waitlist)
6. **How** can you opt out or request deletion? (email address)

### Implementation

**Option A (fastest): Hosted on the demo site**

Create `src/privacy-policy.html` (or a React route `/privacy`) deployed to `demo.redfireforge.com/privacy`.

Minimum viable content:
```html
<h1>RedfireForge Privacy Policy</h1>
<p>Last updated: 2026-08-24</p>

<h2>What we collect</h2>
<p>When you join the waitlist, we collect your email address, an optional
description of how you use RedfireForge, and the page you signed up from.
We do not collect passwords, payment information, or any other personal data.</p>

<h2>Why we collect it</h2>
<p>To notify you when RedfireForge Cloud launches and to send infrequent
product update emails. We will never sell your data or use it for advertising.</p>

<h2>Where it is stored</h2>
<p>Waitlist data is stored in Google Sheets (early phase) and later in Supabase
(a PostgreSQL service). Both providers are GDPR-compliant.</p>

<h2>Your rights</h2>
<p>You may request deletion of your data at any time by emailing
<a href="mailto:privacy@redfireforge.com">privacy@redfireforge.com</a>.
We will delete your record within 30 days.</p>

<h2>Cookies and analytics</h2>
<p>The demo site does not use advertising cookies. If anonymous usage analytics
are enabled, they are opt-in only and collected via PostHog with data stored
in the EU.</p>
```

**Option B: Generator tools (5 minutes)**
- https://www.privacypolicygenerator.info — generates a compliant policy from a questionnaire
- https://www.iubenda.com — free tier generates a hosted policy with a stable URL

Option B is acceptable for launch and can be replaced with a custom-written policy later.

### Link Requirements
Once created, the privacy policy URL must appear in:
- [ ] The Tally waitlist form (Settings → Legal → Privacy Policy URL)
- [ ] The in-app `AppCloudWaitlistBanner` (small "Privacy Policy" link)
- [ ] The README footer
- [ ] The demo site footer

### Success Criteria
- [ ] Privacy policy page live at a stable URL (e.g. `demo.redfireforge.com/privacy`)
- [ ] Covers: what is collected, why, where stored, how to request deletion
- [ ] Tally form links to the privacy policy
- [ ] In-app banner links to the privacy policy
- [ ] README and demo site footer link to the privacy policy

---

## L-19: "good first issue" Seeds

**Effort:** ~30 minutes  
**Blocks:** Contributor trust — HN and Reddit audiences actively check for these before deciding whether to contribute  
**Complexity:** Trivial

### Background
A repo with zero `good first issue` labels signals "solo project, not ready for contributors" even if CONTRIBUTING.md says otherwise. Creating 3–5 well-scoped issues before the announcement gives newcomers a concrete on-ramp and shows the project is actively welcoming contributions. These are among the first things a technical person checks when evaluating whether to contribute.

### GitHub Label Setup

First, set up a standardised label set in GitHub UI (Issues → Labels → Edit/Create):

| Label | Color | Purpose |
|-------|-------|---------|
| `good first issue` | `#7057ff` | Small, well-scoped, beginner-friendly |
| `help wanted` | `#008672` | Good for external contributors, any skill level |
| `bug` | `#d73a4a` | Something isn't working |
| `feature` | `#a2eeef` | New functionality |
| `documentation` | `#0075ca` | Docs improvements |
| `breaking change` | `#e4e669` | Changes public API or file format |
| `protocol: grpc` | `#f9d0c4` | gRPC-specific |
| `protocol: kafka` | `#f9d0c4` | Kafka-specific |
| `protocol: websocket` | `#f9d0c4` | WebSocket-specific |

### Seed Issues to Create

Create these as real GitHub Issues before the announcement — each with a clear title, description, acceptance criteria, and pointers to the relevant files:

1. **Add keyboard shortcut cheat-sheet modal** *(good first issue)*  
   Scope: create a `KeyboardShortcutsModal` triggered by `?` key — list all existing shortcuts from `useDemoShortcuts.ts` and `useAppShortcuts.ts`. No new shortcuts needed, just display existing ones.

2. **Add copy-to-clipboard button to response body panel** *(good first issue)*  
   Scope: add a clipboard icon button to the response body viewer that copies the raw JSON/text. One-line behaviour, existing copy utility already exists.

3. **Add "Reset to defaults" button in Preferences** *(good first issue)*  
   Scope: button that clears all localStorage preference keys and reloads. Simple, self-contained.

4. **Improve empty-state messages in Results Dashboard** *(good first issue)*  
   Scope: when no test has been run yet, the results panel shows a blank area. Add a friendly empty-state illustration/message with a "Run a test" CTA button.

5. **Add `--output json` flag to CLI run command** *(help wanted)*  
   Scope: `redfireforge-cli run` currently prints human-readable output. Add a `--output json` flag that prints structured JSON for CI parsing. Relevant file: `cli/reporters.ts`.

### Success Criteria
- [ ] `good first issue` label created with correct colour
- [ ] `help wanted` label created
- [ ] All standard labels created (bug, feature, documentation, breaking change, protocol:*)
- [ ] At least 4 `good first issue` issues created with clear scope, acceptance criteria, and file pointers
- [ ] At least 1 `help wanted` issue created for a slightly larger task
- [ ] Issues are present and visible before the Show HN post goes live

---

## L-20: FUNDING.yml / Sponsor Button

**Effort:** ~5 minutes  
**Blocks:** Nothing — but GitHub shows a "Sponsor" button on the repo header only when this file exists; without it there is no visible way to support the project  
**Complexity:** Trivial

### Background
A Sponsor button signals long-term commitment and gives grateful users a way to give back. Even if you never receive a single dollar, its presence increases perceived project health and sustainability — which matters to enterprises evaluating whether to adopt your tool.

### Implementation

Create `.github/FUNDING.yml`:

```yaml
# Funding links shown in the GitHub "Sponsor" button
github: [your-github-username]       # GitHub Sponsors (requires enrolment at github.com/sponsors)
ko_fi: redfireforge                  # Ko-fi (instant, no approval needed — create at ko-fi.com)
# open_collective: redfireforge      # Uncomment when Open Collective account is set up
# patreon: redfireforge              # Uncomment if Patreon is set up
```

**Ko-fi setup** (5 minutes, no approval needed):
1. Go to https://ko-fi.com
2. Create account as `redfireforge`
3. Set goal: "Support RedfireForge development"
4. Add the handle to `FUNDING.yml`

**GitHub Sponsors** (requires application and approval — apply separately):
1. Go to https://github.com/sponsors
2. Apply as an individual maintainer
3. Approval takes days to weeks

### Success Criteria
- [ ] `.github/FUNDING.yml` committed with at least Ko-fi handle
- [ ] Ko-fi page created at `ko-fi.com/redfireforge`
- [ ] "Sponsor" button appears on the GitHub repo header
- [ ] GitHub Sponsors application submitted (async — can complete after launch)

---

## L-21: CODEOWNERS

**Effort:** ~15 minutes  
**Blocks:** PR review workflow — without this, external PRs have no automatic reviewer assignment and can sit unreviewed indefinitely  
**Complexity:** Trivial

### Background
`CODEOWNERS` tells GitHub which user or team to automatically request as a reviewer when a PR touches specific paths. This is especially important once external contributors start opening PRs — without it, PRs go unassigned and contributors lose confidence and disengage.

### Implementation

Create `.github/CODEOWNERS`:

```
# Default owner for everything not matched below
*                                   @your-github-username

# Protocol-specific areas — assign to specialist if/when team grows
src/features/graphql/               @your-github-username
src/features/grpc/                  @your-github-username
src/features/kafka/                 @your-github-username
src/features/websocket/             @your-github-username
src/features/sse/                   @your-github-username

# CLI — separate review focus
cli/                                @your-github-username

# Tauri / desktop
src-tauri/                         @your-github-username

# Demo hub lessons — lesson authors when team grows
packages/demo-hub/src/lessons/      @your-github-username

# CI/CD and release — require extra scrutiny
.github/workflows/                  @your-github-username
.github/FUNDING.yml                 @your-github-username
.github/CLA.md                      @your-github-username
```

Replace `@your-github-username` with the actual GitHub handle. When the team grows, split ownership by adding team members to specific paths.

### Effect
- GitHub auto-requests your review on every PR touching those paths
- `CODEOWNERS` review becomes a required status check when combined with branch protection (tick "Require review from Code Owners" in the branch protection rule added in L-4)

### Success Criteria
- [ ] `.github/CODEOWNERS` committed with correct GitHub handle
- [ ] "Require review from Code Owners" enabled in branch protection for `master` and `develop`
- [ ] Test: open a draft PR and confirm the correct reviewer is auto-requested

---

## L-24: Domain Registration + Social Media Handles

**Effort:** ~1 hour (across multiple sites)  
**Blocks:** Everything — once you share the project name publicly, domain squatters and username squatters can take `redfireforge.com` and `@redfireforge` before you do. This must be done before the first public mention anywhere (HN, Reddit, Slack, anywhere).  
**Complexity:** Trivial

### Background
Domain and username squatting is a real risk at launch. Squatters monitor Show HN posts and Product Hunt upcoming pages specifically for new project names. A $12 domain registration and 30 minutes of account creation is the cheapest insurance in this entire plan.

---

### Step 1: Register the Domain (do today)

**Recommended registrar: Cloudflare Registrar** (https://dash.cloudflare.com → Domain Registration)  
- At-cost pricing — no markup (`.com` ≈ $10/year, `.io` ≈ $27/year)  
- Free DNS management, free privacy protection (no WHOIS exposure)  
- No upsell dark patterns

**Domains to register:**

| Domain | Cost/year | Priority | Purpose |
|--------|-----------|----------|---------|
| `redfireforge.com` | ~$10 | 🔴 Register today | Primary — most credible TLD |
| `redfireforge.io` | ~$27 | 🟠 Recommended | Developers associate `.io` with dev tools; someone else getting it will confuse users |

**What to do with the domains right now (no website needed):**
- `redfireforge.com` → HTTP 301 redirect to `https://github.com/your-username/redfire-forge` (one Cloudflare redirect rule, free)
- `demo.redfireforge.com` → Vercel deployment (L-5 and L-11 already plan this subdomain)
- `redfireforge.io` → redirect to `redfireforge.com`

Once you have the domain, update these plan items to use it:
- L-13 (GitHub repo website field): change from Vercel URL to `redfireforge.com`
- L-18 (privacy policy URL): `redfireforge.com/privacy`
- L-12 (waitlist form): update the `source` tracking links if they used a Vercel URL

---

### Step 2: Social Media Handles

Create these accounts now — you do not need to post anything yet. Claiming the handle is the goal.

| Platform | Handle | Priority | Why |
|----------|--------|----------|-----|
| **Twitter / X** | `@redfireforge` | 🔴 Critical | Highest dev mindshare for OSS tool announcements; the L-17 Twitter thread needs this account |
| **Product Hunt** | maker account under your real name | 🔴 Critical | Required to submit the L-17 Product Hunt launch; do this under your personal account, not a brand account |
| **Dev.to** | `redfireforge` or your real name | 🟠 High | The L-17 Dev.to article needs an author account; personal name preferred |
| **Ko-fi** | `redfireforge` | 🟠 High | Required for L-20 (FUNDING.yml); takes 5 minutes, no approval |
| **npm** | `redfireforge` org (optional) | 🟠 High | Reserve the npm org name so no one else publishes a malicious `@redfireforge/anything` package |
| **Bluesky** | `redfireforge.bsky.social` | 🟡 Medium | Growing OSS/developer community migrating from Twitter; low effort to claim |
| **LinkedIn** | Add as project on your personal profile (no separate account) | 🟡 Medium | Do not create a separate LinkedIn account — against ToS; add as a project/experience entry |
| **Hacker News** | your existing personal account | ℹ️ Informational | HN does not allow brand accounts; Show HN is always posted from a personal account |
| **Reddit** | your existing personal account | ℹ️ Informational | Same as HN — subreddit posts are from personal accounts |

**What to skip for now:**
- Instagram, TikTok, Facebook — wrong audience for a developer tool
- Mastodon / Fosstodon — consider after launch if the OSS community reception is strong
- Discord server — consider only after 50+ engaged users; premature Discord servers feel empty and hurt perception

---

### Step 3: Twitter/X Account Setup

If `@redfireforge` is available:
1. Create account with your Gmail
2. Profile photo: the RedfireForge logo (same as GitHub org avatar)
3. Bio: `Visual API testing workbench — REST · GraphQL · gRPC · WebSocket · Kafka · SSE | Open source | github.com/your-username/redfire-forge`
4. Link: `redfireforge.com` (or GitHub repo until domain redirects are set up)
5. Pin a tweet after launch: the announcement thread from L-17

Post nothing until launch day — an account with 0 posts but 0 followers looks fine. An account with 3 random test posts looks worse.

---

### Step 4: npm Org (optional but recommended)

Someone could publish `@redfireforge/anything` as a malicious scoped package once the project is public. Reserving the org is free:

```bash
npm org create redfireforge
```

This costs nothing and takes 30 seconds. You do not need to publish any scoped packages — just hold the org name.

---

### Step 5: Update Email References in the Plan

Now that you have `redfireforge.com`, update all placeholder emails in plan files to use the real domain (after setting up Gmail "Send mail as" for the domain):
- `security@redfireforge.com` → L-13 (SECURITY.md contact)
- `privacy@redfireforge.com` → L-18 (privacy policy)

Gmail "Send mail as" setup: Gmail Settings → Accounts and Import → Send mail as → Add another email address → enter `security@redfireforge.com` → use Gmail's SMTP. Free, takes 5 minutes after the domain is registered.

### Success Criteria
- [ ] `redfireforge.com` registered
- [ ] `redfireforge.io` registered (optional but recommended)
- [ ] `redfireforge.com` → GitHub repo redirect active (Cloudflare redirect rule)
- [ ] `demo.redfireforge.com` CNAME record created pointing to Vercel (ready for L-5)
- [ ] Twitter/X `@redfireforge` account created
- [ ] Product Hunt maker account ready (personal name)
- [ ] Dev.to account created
- [ ] Ko-fi account created at `ko-fi.com/redfireforge`
- [ ] npm org `redfireforge` reserved
- [ ] Bluesky `redfireforge.bsky.social` claimed
- [ ] Gmail "Send mail as" configured for `privacy@redfireforge.com` and `security@redfireforge.com`
- [ ] L-13 SECURITY.md and L-18 privacy policy updated to use `@redfireforge.com` email addresses

---

## L-22: `package.json` Metadata Cleanup

**Effort:** ~5 minutes  
**Blocks:** npm publish (L-3) and L-23 — every npm user sees the `homepage`, `repository`, and `bugs` fields on the npmjs.com package page; placeholder "your-org" URLs are publicly visible and destroy credibility  
**Complexity:** Trivial

### Background
The CLI `cli/package.json` already has `homepage`, `bugs`, and `repository` fields, but they point to `"https://github.com/your-org/redfireforge#readme"` placeholders. The root `package.json` has none of these fields at all. Both must be corrected before publishing or tagging a release.

### What to Fix

**Root `package.json`** — add missing fields:
```json
{
  "name": "redfire-forge",
  "version": "0.8.0",
  "description": "Visual API testing workbench with multi-protocol load testing — REST, GraphQL, gRPC, WebSocket, Kafka, SSE",
  "homepage": "https://github.com/redfireforge/redfire-forge#readme",
  "repository": {
    "type": "git",
    "url": "https://github.com/redfireforge/redfire-forge.git"
  },
  "bugs": {
    "url": "https://github.com/redfireforge/redfire-forge/issues"
  },
  "license": "AGPL-3.0-or-later",
  ...
}
```

**`cli/package.json`** — replace "your-org" placeholder with correct org:
```json
{
  "homepage": "https://github.com/redfireforge/redfire-forge/tree/master/cli#readme",
  "repository": {
    "type": "git",
    "url": "https://github.com/redfireforge/redfire-forge.git",
    "directory": "cli"
  },
  "bugs": {
    "url": "https://github.com/redfireforge/redfire-forge/issues"
  },
  "license": "AGPL-3.0-or-later",
  ...
}
```

Note the `directory` field in `repository` — this tells npm and pkg tools that the CLI is a subdirectory of a monorepo.

### Also Check
- `src-tauri/tauri.conf.json`: verify `productName`, `identifier`, and `version` are correct for the standard variant
- `src-tauri/tauri.conf.demo.json`: verify same for the Demo Hub variant
- Both configs should reference `0.8.0` (or whatever the first public version will be)

### Success Criteria
- [ ] Root `package.json` has `description`, `homepage`, `repository`, `bugs`, `license` fields with correct URLs
- [ ] `cli/package.json` has no "your-org" placeholder — all URLs point to `redfireforge/redfire-forge`
- [ ] Both Tauri configs have correct `productName` and `version`
- [ ] `npm info redfireforge-cli` shows correct homepage and repository after publish (verify after L-3)

---

## L-23: First Release Tag + Release Workflow Procedure

**Effort:** ~30 minutes  
**Blocks:** Both L-3 (npm publish) and L-11 (Tauri artifact release) — both workflows trigger on `v*` tags; without a clear procedure these can be accidentally triggered or done out of order  
**Complexity:** Low

### Background
The release workflow (`release.yml`) triggers on `push: tags: ['v*']`. The CLI publish workflow (`publish-cli.yml`) triggers on the same. Pushing a version tag simultaneously triggers both workflows — Tauri builds an 8-job matrix (4 platforms × 2 variants) and the npm publish job. Getting the first release right matters because the Homebrew Cask formula (L-11) will hardcode the SHA256 of the first `.dmg`, and the npm registry considers version `0.8.0` published forever (cannot overwrite or delete).

### Pre-Release Checklist (do in order)

Before pushing any tag, verify:
- [ ] L-22 done — all `package.json` metadata correct
- [ ] L-1 done — `LICENSE` file present in repo root
- [ ] Root `package.json` version field: `"version": "0.8.0"` (or intended first public version)
- [ ] `cli/package.json` version field: matches (same version or its own semver — confirm your versioning policy)
- [ ] `src-tauri/tauri.conf.json` version: `0.8.0`
- [ ] `src-tauri/tauri.conf.demo.json` version: `0.8.0`
- [ ] `CHANGELOG.md` has an entry for `0.8.0` with a user-facing summary
- [ ] `NPM_TOKEN` secret set in GitHub repo Settings → Secrets and variables → Actions
- [ ] Release workflow dry-run passes (see Step 1 below)

### Step 1: Dry-Run the Release Workflow

Before creating a real tag, trigger the CLI publish workflow in dry-run mode:
1. GitHub UI → Actions → `Publish CLI` → Run workflow → tick `dry_run: true`
2. Wait for the workflow to complete — it should succeed without actually publishing
3. Fix any errors before proceeding to the real release

### Step 2: Create the Release Commit

```bash
# Ensure you're on master and up to date
git checkout master && git pull

# Confirm all versions are aligned
grep '"version"' package.json cli/package.json src-tauri/tauri.conf.json

# Confirm build passes
npm run build && npx tsc --noEmit
```

### Step 3: Push the Release Tag

```bash
# Create the annotated tag (not lightweight — annotated tags have a creation date
# and are shown in GitHub Releases correctly)
git tag -a v0.8.0 -m "Release v0.8.0 — initial public open-source release"

# Push the tag — this triggers both release.yml and publish-cli.yml simultaneously
git push origin v0.8.0
```

### Step 4: Monitor the Workflows

- Go to GitHub Actions — you should see two workflows starting: `Release` (Tauri matrix) and `Publish CLI`
- The Release matrix runs 8 parallel jobs (2–10 minutes each on their respective OS runners)
- Watch for any failures — the matrix uses `fail-fast: false` so other jobs continue even if one fails
- If the npm publish fails but Tauri succeeds, the tag is already pushed — do NOT push a new tag; instead re-trigger the publish workflow manually via `workflow_dispatch`

### Step 5: Post-Release Tasks

After all workflows complete:
1. **Verify npm:** `npm info redfireforge-cli` — confirm version `0.8.0` is live
2. **Verify GitHub Release:** check that all 8 Tauri artifact sets are attached to the `v0.8.0` release
3. **Compute SHA256 for Homebrew Cask:**
   ```bash
   curl -sL "https://github.com/redfireforge/redfire-forge/releases/download/v0.8.0/RedfireForge_0.8.0_aarch64.dmg" | shasum -a 256
   ```
   Use this hash to populate the Homebrew Cask formula (L-11)
4. **Update Homebrew Cask PRs** with the real SHA256 and download URL (L-11)
5. **Post release announcement** per L-17 schedule

### Versioning Policy Decision

Make this decision before the first release:

| Option | Description | Recommended? |
|--------|-------------|-------------|
| Monorepo single version | `package.json`, `cli/package.json`, and both Tauri configs all share one version number | ✅ Simplest — use `./scripts/version.sh` to bump all at once |
| Independent CLI version | CLI has its own semver independent of the app | ❌ Creates confusion for users about which CLI version goes with which app version |

**Recommendation:** monorepo single version. Update `./scripts/version.sh` to bump all four files (`package.json`, `cli/package.json`, `tauri.conf.json`, `tauri.conf.demo.json`) in one command.

### Success Criteria
- [ ] Release workflow dry-run passes before the first real tag
- [ ] `git tag -a v0.8.0 -m "..."` used (annotated tag, not lightweight)
- [ ] All 8 Tauri artifact sets appear on the GitHub Release page
- [ ] npm package `redfireforge-cli@0.8.0` is live and installable
- [ ] `checksums.txt` (or SHA256 per file) uploaded to the GitHub Release
- [ ] Homebrew Cask formulas (L-11) updated with correct SHA256 from this release
- [ ] Versioning policy decided and `scripts/version.sh` updated to bump all four version files

---

## Recommended Execution Order

```
Day 0 (TODAY)    — L-24 Domain registration + social handles (~1 hour)
                   ↑ do this BEFORE sharing the project name with anyone, anywhere
                   (register redfireforge.com, claim @redfireforge on Twitter/X, Ko-fi, npm org)

Day 1 (morning)  — L-1 LICENSE file AGPL v3 (5 min)
                   ↑ decide and commit the license FIRST — the CLA document references it
                 — L-0 CLA Setup (cla-assistant.io, 30 min)
                   ↑ CLA must exist before accepting any external PRs
                 — L-21 CODEOWNERS (15 min)
                   ↑ must exist BEFORE branch protection enforces "Require Code Owners review"
                 — L-4 Branch Protection (15 min)
                   ↑ add CLA, CI required checks, and Code Owners review in one pass
                 — L-13 GitHub Community Profile (30 min)
                   (SECURITY.md, repo description/topics, Discussions)
                 — L-19 Seed "good first issue" issues (30 min)
                 — L-20 FUNDING.yml + Ko-fi (5 min)
                   (~2.5 hours total — repo is legally sound, contributor-ready, and discoverable)

Day 1 (afternoon) — L-2 CONTRIBUTING.md + PR template + Issue templates + CoC
                   (~2 hours — complete contributor on-ramp in place)

Day 2 (morning)  — L-8 Dark mode auto-detect (~1 hr)
                 — L-9 Undo/Redo wiring (~2–3 hrs)
                   (~3 hours — UX polish before the README shows screenshots)

Day 2 (afternoon) — L-6 README Rewrite (~4 hours)
                   (include comparison table, screenshots, badges — all polish items done first)

Day 3            — L-22 package.json metadata cleanup (~5 min)
                   ↑ must be correct BEFORE npm publish — npmjs.com shows these URLs publicly
                 — L-23 First release tag procedure (~30 min)
                   (dry-run → confirm → git tag v0.8.0 → git push --tags → monitor workflows)
                 — L-3 npm First Publish (~30 min)
                   ↑ triggered by the tag pushed in L-23; verify npm page after
                 — L-11 Desktop Distribution (~2 hours)
                   (README install instructions, SignPath application, Homebrew Cask PR with real SHA256 from L-23)
                 — L-7 CI E2E Pipeline (~4 hours)
                   (add to branch protection required checks once job is green in CI)
                 — L-18 Privacy Policy (~1 hour)
                   ↑ MUST go live BEFORE the waitlist form — GDPR requires it
                 — L-12 SaaS Waitlist (~2 hours)
                   (Tally form + Google Sheet + in-app banner + README section)
                 — L-14 Dependabot + SBOM (~30 min)
                 — L-15 Pre-commit hooks (~1 hour)
                 — L-16 Social preview image (~1–2 hours)
                   ↑ do this last on Day 3 so you have final README screenshots to pull from

Day 4–6          — L-5 Live Demo Deployment (~1 day)
                   (browser-only Vite build → Vercel → auto-deploy on master push)

Day 7–10         — L-10 HAR-to-Workflow Conversion (~4 days)
                   (most complex feature — done in isolation so release workflow is already green)

Week before launch — L-17 Launch Promotion (write posts, schedule calendar, notify waitlist)
```

### "Show HN" Readiness Checklist
Before posting on Hacker News / Reddit / Dev.to, all of the following must be true:
- [ ] L-0 CLA bot active
- [ ] L-1 AGPL v3 LICENSE present
- [ ] L-2 CONTRIBUTING.md + CoC present
- [ ] L-3 npm package published
- [ ] L-4 Branch protection rules active
- [ ] L-5 Live demo URL in README
- [ ] L-6 README with screenshots/GIFs
- [ ] L-7 CI badge green in README
- [ ] L-11 README has Windows + macOS install instructions
- [ ] L-11 Homebrew Cask PR opened (macOS users can `brew install --cask redfireforge`)
- [ ] L-12 Tally waitlist form live with Google Sheet integration
- [ ] L-12 In-app `AppCloudWaitlistBanner` added
- [ ] L-12 README has waitlist link
- [ ] L-13 SECURITY.md present
- [ ] L-13 GitHub Community profile score = 100%
- [ ] L-13 GitHub Discussions enabled
- [ ] L-14 Dependabot config committed
- [ ] L-16 Social preview image uploaded (repo link looks good when shared on Slack/Twitter)
- [ ] L-17 Show HN post + first comment written
- [ ] L-17 Product Hunt page prepared
- [ ] L-17 Waitlist notified 1 week before launch
- [ ] L-18 Privacy policy page live and linked from waitlist form + banner
- [ ] L-19 At least 4 "good first issue" GitHub issues created
- [ ] L-20 FUNDING.yml committed + Ko-fi page live
- [ ] L-22 All `package.json` metadata correct (no "your-org" placeholders visible on npmjs.com)
- [ ] L-23 Tagged release exists (v0.8.0 or later) — all 8 Tauri artifact sets attached, npm published, checksums uploaded
- [ ] L-24 `redfireforge.com` registered and redirecting to repo or demo
- [ ] L-24 Twitter/X `@redfireforge` account live with bio and link
- [ ] L-24 Ko-fi `redfireforge` account live (required for L-20 FUNDING.yml)

---

## Notes

- All items should be implemented on `feature/*` branches per git-branching rules.
- L-4 (branch protection) is a GitHub UI operation — no branch needed, apply directly. It must be done after L-21 (CODEOWNERS) so the "Require Code Owners" option works immediately.
- L-1 must be done before L-0: the CLA document references the project's license — commit the LICENSE file first so the CLA text can cite it correctly.
- L-3 (npm publish) requires a maintainer with npm registry access — cannot be automated without the `NPM_TOKEN` secret.
- L-5 (live demo) requires Vercel account connection — one-time manual step, then auto-deploys.
- L-11 (desktop distribution) depends on a tagged GitHub Release existing — complete L-3 (npm publish / version tag) first.
- macOS Gatekeeper bypass via right-click is reliable for technical users; Homebrew Cask is the best free solution for smooth install.
- Windows Certum free OSS certificate takes 1–2 weeks — apply early.
- L-12 Phase 1 (Tally + Google Sheet) takes ~2 hours and should go live on launch day — every day without it is a missed lead.
- L-12 Phase 2 (Supabase + own API) is deferred until SaaS development begins; Phase 1 Google Sheet data migrates via CSV import.
- L-13 is the single highest-effort-to-reward ratio item — 30 minutes for a 100% GitHub Community profile score and topic-driven discoverability.
- L-14 Dependabot grouping (minor-and-patch batching) is critical for a 600+ dep repo — without it, Dependabot opens dozens of PRs per week and becomes noise.
- L-15 Husky hooks run `tsc -b --noEmit` on the full project; if this is too slow on large changesets, switch to `--incremental`. Emergency override: `git commit --no-verify`.
- L-16 (social preview image) should be ready before the README is shared anywhere — once a link is posted without it the cached generic card lingers for days.
- L-11 SignPath Foundation (free, OSS-verified Windows code signing) eliminates SmartScreen entirely — apply early, verification takes a few days. Certum OSS is the free backup if SignPath is delayed. Microsoft Trusted Signing ($9.99/mo) is the paid fallback if both are denied.
- L-17 (launch promotion) should be prepared the week before launch, not on launch day — write and review all posts in advance so launch day is just hitting send.
- L-18 (privacy policy) must go live **before** the waitlist form, not simultaneously — if you link the form in the README and someone signs up before the policy page is live, you are already in violation.
- L-22 (package.json metadata) is a 5-minute prerequisite for L-3 and L-23 — "your-org" placeholder URLs are instantly visible on npmjs.com to every person who runs `npm info redfireforge-cli` and destroy credibility.
- L-23 (first release tag) is the single most consequential action in the launch sequence: it simultaneously triggers Tauri's 8-job build matrix and the npm publish. Test the release workflow via dry-run first. Do NOT re-tag if a workflow fails — re-trigger the specific failed workflow instead.
- L-24 (domain + social handles) is the only item that must happen before Day 1 — domain squatting happens the moment a project name is shared publicly, even in a private Slack or Discord. Register the domain today.
- For social accounts: Twitter/X and Ko-fi are the only two that must exist before launch. Product Hunt, Dev.to, and Bluesky can be created the week before launch. Do not create a separate LinkedIn account — add RedfireForge as a project on your personal profile instead.
- L-19 ("good first issue" seeds) should be created before the Show HN post — HN readers check for them immediately.
- L-20 (FUNDING.yml) is 5 minutes; Ko-fi requires no approval and can go live the same day.
- L-21 (CODEOWNERS) should have "Require review from Code Owners" enabled in branch protection (L-4) to be effective.
- After completing L-0 through L-7 + L-11 through L-13 + L-16 through L-21, the project is ready for the L-17 launch sequence.
