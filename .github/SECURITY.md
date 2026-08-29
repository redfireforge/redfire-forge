# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| Latest stable release | ✅ |
| Older releases | ❌ Upgrade recommended |

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Email: **security@redfireforge.com**

Include:
- Description of the vulnerability
- Steps to reproduce
- Affected versions (app version shown in the title bar or `rff --version`)
- Any suggested fix

You will receive an acknowledgement within **48 hours**. We aim to release a patch within **14 days** of confirmation.

## Disclosure Policy

We follow coordinated disclosure: we will work with you to understand and fix the issue before public disclosure. Credit will be given in the release notes unless you prefer to remain anonymous.

## Scope

The following are **in scope** for security reports:

- Authentication or authorization bypass in the RedfireForge desktop app or web build
- Injection vulnerabilities (XSS, prototype pollution, command injection) in request/scenario handling
- Insecure data storage — secrets, credentials, or API tokens stored in plaintext
- Vulnerabilities in the CLI (`redfireforge-cli`) that allow arbitrary code execution
- Vulnerabilities in the Tauri IPC layer or Rust backend

The following are **out of scope**:

- Vulnerabilities in third-party Docker backends used in demo lessons (e.g. `graphql-yoga`, `mosquitto`) — report those to the upstream project
- Self-XSS or attacks that require physical access to the victim's machine
- Rate limiting or denial-of-service against external APIs you are testing with RedfireForge

## Security-Related Configuration

RedfireForge stores all user data locally (on-device) by default:
- Desktop app: Tauri secure storage + local filesystem
- Web app: browser IndexedDB / localStorage

No user data is transmitted to RedfireForge servers. The only outbound network call made by the app itself is the Tauri auto-updater's check against GitHub Releases.
