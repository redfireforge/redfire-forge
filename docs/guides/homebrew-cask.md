# Homebrew Cask — Submission Guide

Installing via Homebrew Cask bypasses macOS Gatekeeper entirely — users get a
zero-warning install with a single command:

```bash
brew install --cask redfireforge
```

---

## Prerequisites

1. A **stable GitHub Release** with a publicly accessible `.dmg` URL must exist.
   The URL pattern Tauri produces is:
   ```
   https://github.com/redfireforge/redfireforge-public/releases/download/vX.Y.Z/RedfireForge_X.Y.Z_aarch64.dmg
   ```
2. The **SHA256** of that `.dmg` — found in `SHA256SUMS.txt` attached to the release.

---

## Cask Formula

Create `Casks/r/redfireforge.rb` in a fork of
[homebrew-cask](https://github.com/Homebrew/homebrew-cask):

```ruby
cask "redfireforge" do
  arch arm: "aarch64", intel: "x64"

  version "0.8.2"
  sha256 arm:   "<sha256_aarch64_dmg>",  # from SHA256SUMS.txt on the release page
         intel: "<sha256_x64_dmg>"

  url "https://github.com/redfireforge/redfireforge-public/releases/download/v#{version}/RedfireForge_#{version}_#{arch}.dmg"
  name "RedfireForge"
  desc "Visual performance workbench — HTTP, GraphQL, gRPC, WebSocket, Kafka"
  homepage "https://github.com/redfireforge/redfireforge-public"

  app "RedfireForge.app"

  zap trash: [
    "~/Library/Application Support/RedfireForge",
    "~/Library/Application Support/com.redfireforge.desktop",
    "~/Library/Preferences/com.redfireforge.desktop.plist",
    "~/Library/Saved Application State/com.redfireforge.desktop.savedState",
  ]
end
```

The `arch` stanza serves both Apple Silicon and Intel from a single cask — Homebrew
selects the correct `.dmg` automatically based on the machine's architecture.

---

## Submission Steps

1. **Fork** `https://github.com/Homebrew/homebrew-cask`
2. **Clone** your fork:
   ```bash
   git clone https://github.com/<your-username>/homebrew-cask.git
   cd homebrew-cask
   ```
3. **Create the file** at `Casks/r/redfireforge.rb` (alphabetical by first letter).
4. **Validate** locally:
   ```bash
   brew install --cask Casks/r/redfireforge.rb
   brew audit --cask redfireforge
   brew style --fix Casks/r/redfireforge.rb
   ```
5. **Commit and push**:
   ```bash
   git checkout -b add-redfireforge-cask
   git add Casks/r/redfireforge.rb
   git commit -m "Add redfireforge cask"
   git push origin add-redfireforge-cask
   ```
6. **Open a PR** against `Homebrew/homebrew-cask` — maintainers typically
   review and merge within 1–3 days for well-formed casks.

---

## Updating the Cask After a New Release

After each new tag/release:
1. Get the new SHA256 from `SHA256SUMS.txt` on the release page.
2. Open a PR to `homebrew-cask` updating `version` and `sha256`.
3. Or use `brew bump-cask-pr redfireforge` (Homebrew will open the PR for you
   once the cask is merged and the new release is published).

---

## Windows: SignPath Foundation (Free Code Signing)

SignPath provides **free code signing** for verified open-source projects.
Eliminates the SmartScreen "Windows protected your PC" warning entirely.

- **Apply at:** https://signpath.org → "For Open Source Projects"
- Submit the GitHub repo URL; verification takes a few days
- Once approved, add to `build-release.yml`:
  ```yaml
  - uses: signpath/github-action-submit-signing-request@v1
    with:
      api-token: ${{ secrets.SIGNPATH_API_TOKEN }}
      organization-id: ${{ secrets.SIGNPATH_ORG_ID }}
      project-slug: redfireforge-public
      signing-policy-slug: release-signing
      artifact-configuration-slug: windows-installer
      github-artifact-name: windows-build
      wait-for-completion: true
      output-artifact-directory: signed/
  ```

Apply before the first public launch so the certificate is ready for v1.0.0.

---

## Linux: Snapcraft & Flathub (Optional, High Discoverability)

| Channel | Command | Notes |
|---------|---------|-------|
| **Snapcraft** | `snap install redfireforge` | Ubuntu Software Center listing |
| **Flathub** | `flatpak install redfireforge` | Major Linux distros |
| AUR (Arch) | `yay -S redfireforge` | Community-maintained |

Both Snapcraft and Flathub submissions are free and significantly increase
discoverability. Snapcraft takes ~1 hour to set up; see
[snapcraft.io/docs](https://snapcraft.io/docs).
