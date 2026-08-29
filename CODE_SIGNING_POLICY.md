# Code Signing Policy

## Windows

Free code signing provided by [SignPath.io](https://signpath.io), certificate by [SignPath Foundation](https://signpath.org).

Windows installers (`.msi`, `.exe`) distributed via [GitHub Releases](https://github.com/redfireforge/redfire-forge/releases) are signed using a certificate issued to SignPath Foundation. The private key is stored on SignPath Foundation's Hardware Security Module (HSM) and never leaves it. Signing is performed automatically inside GitHub Actions as part of the release pipeline.

## macOS

macOS disk images (`.dmg`) and application bundles (`.app`) are signed with an Apple Developer ID certificate and notarized with Apple's notarization service. Signed and notarized builds are distributed via [GitHub Releases](https://github.com/redfireforge/redfire-forge/releases).

## Linux

Linux packages (`.AppImage`, `.deb`, `.rpm`) are not code-signed. Linux distributions do not have an equivalent of Windows SmartScreen or macOS Gatekeeper. Packages are distributed via [GitHub Releases](https://github.com/redfireforge/redfire-forge/releases) and can be verified using the SHA-256 checksums published alongside each release.

## Verification

All release artifacts are built from source in GitHub Actions. The full build pipeline is defined in [`.github/workflows/release.yml`](.github/workflows/release.yml) and is publicly auditable.

SHA-256 checksums for all release artifacts are published on the [GitHub Releases](https://github.com/redfireforge/redfire-forge/releases) page.

## Committers and Approvers

Signing requests are submitted automatically by the GitHub Actions release workflow when a version tag (`v*`) is pushed to the `master` branch. Only repository maintainers with push access to `master` can trigger a release.

| Role | GitHub username |
|---|---|
| Maintainer / Approver | [@redfireforge](https://github.com/redfireforge) |

## Privacy

The signed binaries do not transmit any information to external systems unless explicitly requested by the user. See [PRIVACY.md](PRIVACY.md) for details.

## Contact

For questions about code signing, open an issue at [github.com/redfireforge/redfire-forge/issues](https://github.com/redfireforge/redfire-forge/issues).
