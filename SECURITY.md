# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| Latest release | ✅ |
| Older releases | ❌ — please upgrade |

---

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

If you discover a security vulnerability in RedfireForge, please report it responsibly:

1. **Open a [GitHub Security Advisory](https://github.com/redfireforge/redfireforge-public/security/advisories/new)** — this is the preferred path. It keeps the report private until a fix is released.

2. Alternatively, email the maintainers directly. Include:
   - A description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Any suggested mitigations (optional)

---

## What to Expect

- **Acknowledgement** within 3 business days.
- **Status update** within 10 business days with a timeline for a fix or a decision not to fix (with reasoning).
- Credit in the release notes for responsibly disclosed issues (unless you prefer to remain anonymous).

---

## Scope

This policy covers:

- The RedfireForge desktop application (`src-tauri/`)
- The web UI (`src/`)
- The companion server (`src-server/`)
- The CLI (`cli/`)

Out of scope:

- Third-party dependencies — please report those to the relevant upstream project.
- Issues in demonstration/example code that cannot be triggered in production.

---

## Security Design Notes

- RedfireForge does not transmit your API credentials or test data to any third-party server.
- All test execution is local or to targets you configure.
- Sensitive values (auth headers, TLS keys, tokens) are redacted before export and never written to logs.
