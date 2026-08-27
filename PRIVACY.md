# Privacy Policy

**Last updated:** 2026-08-26

RedfireForge is a local-first API/protocol testing tool. This policy explains what data the desktop and web apps handle today, and what will change if the optional cloud waitlist and SaaS offering (planned, not yet live) launch.

---

## 1. Who is collecting data?

RedfireForge is developed and maintained by the RedfireForge project (see [README.md](./README.md) for maintainer/contact details). Questions about this policy can be sent to **privacy@redfireforge.com**.

## 2. What data does the app collect today?

**Short answer: none, by default.** RedfireForge is designed to run entirely on your machine:

- Test runs, requests, collections, environments, workflows, and mock server configurations are stored **locally only** — in the OS-native Tauri store (desktop) or `localStorage`/IndexedDB (browser/web demo). None of this data is transmitted to us or any third party.
- The desktop app's **auto-updater** periodically checks GitHub Releases for new versions. This is a standard HTTPS request to GitHub's servers and only includes the metadata any HTTP request carries (IP address, user agent) — no telemetry, usage analytics, or identifying data is sent by RedfireForge itself.
- There is currently **no analytics, crash reporting, or usage-tracking SDK** built into the app.

## 3. What data will the waitlist/SaaS features collect? (planned, not yet live)

When the optional cloud waitlist form goes live, submitting it will collect:
- Your email address
- An optional description of your use case
- The page/source you signed up from
- The app version, if you signed up from inside the app

We collect this **only** to notify you about RedfireForge Cloud availability and to send infrequent, relevant product updates. We will never sell this data or use it for third-party advertising.

## 4. Where is data stored?

- **App data** (requests, workflows, mock configs, test runs): stored **locally on your device**. We never see it.
- **Waitlist data** (once live): stored with our form provider (e.g. Tally) and/or a spreadsheet/database backend (e.g. Google Sheets initially, migrating to a managed Postgres provider such as Supabase). Both are standard, reputable data processors.

## 5. How long is data kept?

- **Local app data**: kept until you delete it yourself (uninstalling the app or clearing browser storage removes it).
- **Waitlist data** (once live): kept until RedfireForge Cloud launches and the waitlist is closed, or until you request deletion — whichever comes first.

## 6. Your rights

You can request access to or deletion of any waitlist data we hold about you at any time by emailing **privacy@redfireforge.com**. We will act on deletion requests within 30 days.

Since local app data never leaves your device, you always have full control over it — deleting it locally (uninstall, clear storage) is immediate and complete on our end too, because we never had a copy.

## 7. Cookies and analytics

The desktop app has no cookies. The web demo does not use advertising or third-party tracking cookies. If anonymous, opt-in usage analytics are ever added to the web demo, this policy will be updated first, and such analytics will always be opt-in.

## 8. Children's privacy

RedfireForge is a developer tool not directed at children. We do not knowingly collect data from anyone under 16.

## 9. Changes to this policy

We may update this policy as features (like the cloud waitlist) go live. Material changes will be reflected here with an updated "Last updated" date, and significant changes will also be noted in [CHANGELOG.md](./CHANGELOG.md).

## 10. Contact

Questions, deletion requests, or concerns: **privacy@redfireforge.com**
