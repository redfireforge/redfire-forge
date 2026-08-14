/**
 * AM-20 `am-20-tls-mtls` — HTTPS, HTTP/2 & mTLS with Cert-Subject Matching.
 *
 * Scenario: a plaintext health mock is already in the workspace. Server
 * Settings → TLS generates a self-signed cert, Start binds HTTPS with
 * HTTP/2, a live GET proves 200 over TLS, then mTLS issues a named client
 * bundle. A security `certSubject` condition pins that CN; Simulate proves
 * match and miss because browsers cannot attach a PEM. Export redacts the
 * private key. Curriculum:
 * `docs/plan/future/apimock/apimock-demo-curriculum-v2.md` §5 Track E.
 */
import { API_MOCK } from '@shared/selectors';
import type { DemoLesson } from '../../types';
import {
  AM20_CERT_SUBJECT,
  AM20_CN,
  AM20_HEALTH,
  cleanupAm20,
  ensureAm20ForCertPredicate,
  ensureAm20ForHttpsLive,
  ensureAm20ForInspect,
  ensureAm20ForMtls,
  ensureAm20ForProveCert,
  ensureAm20ForProveHttps,
  ensureAm20ForRedaction,
  prepareAm20Workspace,
  runAm20CertPredicate,
  runAm20GenerateTls,
  runAm20HttpsLive,
  runAm20InspectCert,
  runAm20Mtls,
  runAm20ProveCertMatch,
  runAm20ProveHttps,
  runAm20RedactionParity,
} from './api-mock-am20-helpers';

const DIAGRAM = `
<svg viewBox="0 0 700 430" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="HTTPS, HTTP/2, and mTLS with cert-subject matching">
  <rect x="0" y="0" width="700" height="430" fill="#0f172a" />

  <text x="26" y="34" fill="#f1f5f9" font-family="system-ui" font-size="16" font-weight="600">TLS is generated in Studio. Identity is a matcher.</text>
  <text x="26" y="54" fill="#64748b" font-family="system-ui" font-size="10">self-signed PEM · HTTP/2 via ALPN · mTLS client bundle · certSubject</text>

  <rect x="26" y="72" width="210" height="150" rx="8" fill="#1e293b" stroke="#38bdf8" />
  <text x="42" y="96" fill="#38bdf8" font-family="system-ui" font-size="12" font-weight="600">HTTPS + HTTP/2</text>
  <text x="42" y="118" fill="#f1f5f9" font-family="ui-monospace" font-size="11">Generate self-signed</text>
  <text x="42" y="138" fill="#a8b8cc" font-family="system-ui" font-size="11">https:// listen address</text>
  <text x="42" y="158" fill="#a8b8cc" font-family="system-ui" font-size="11">HTTP/2 badge (ALPN)</text>
  <text x="42" y="202" fill="#22c55e" font-family="system-ui" font-size="10">GET /health → 200 over TLS</text>

  <rect x="252" y="72" width="210" height="150" rx="8" fill="#1e293b" stroke="#f59e0b" />
  <text x="268" y="96" fill="#f59e0b" font-family="system-ui" font-size="12" font-weight="600">mTLS</text>
  <text x="268" y="118" fill="#f1f5f9" font-family="ui-monospace" font-size="11">Require client cert</text>
  <text x="268" y="138" fill="#f1f5f9" font-family="ui-monospace" font-size="11">CN=${AM20_CN}</text>
  <text x="268" y="158" fill="#a8b8cc" font-family="system-ui" font-size="11">Issue + download bundle</text>
  <text x="268" y="202" fill="#64748b" font-family="system-ui" font-size="10">Restart so the listener requires it</text>

  <rect x="478" y="72" width="196" height="150" rx="8" fill="#1e293b" stroke="#a78bfa" />
  <text x="494" y="96" fill="#a78bfa" font-family="system-ui" font-size="12" font-weight="600">Cert subject</text>
  <text x="494" y="118" fill="#f1f5f9" font-family="system-ui" font-size="11">security → certSubject</text>
  <text x="494" y="138" fill="#f1f5f9" font-family="ui-monospace" font-size="11">${AM20_CERT_SUBJECT}</text>
  <text x="494" y="158" fill="#a8b8cc" font-family="system-ui" font-size="11">Simulate match ⟂ miss</text>
  <text x="494" y="202" fill="#22c55e" font-family="system-ui" font-size="10">Browsers cannot attach a PEM</text>

  <rect x="26" y="240" width="648" height="70" rx="8" fill="#1e293b" stroke="#3b4a60" />
  <text x="42" y="268" fill="#f1f5f9" font-family="system-ui" font-size="12" font-weight="600">The private key never leaves the workspace. Exports show ***REDACTED***. Desktop parity warnings surface when TLS cannot bind.</text>
  <text x="42" y="290" fill="#a8b8cc" font-family="system-ui" font-size="11">Stop the listener. The PEMs stay in Settings so the next Start is still HTTPS.</text>

  <rect x="26" y="328" width="648" height="78" rx="8" fill="#1e293b" stroke="#22c55e" />
  <text x="42" y="356" fill="#22c55e" font-family="system-ui" font-size="12" font-weight="600">Generate → inspect → Start HTTPS → live 200 → mTLS bundle → cert predicate → Simulate both ways → redact + Stop</text>
  <text x="42" y="378" fill="#a8b8cc" font-family="system-ui" font-size="11">TLS is a server setting. Who may call is a Match condition. Identity is not a header you parse by hand.</text>
</svg>
`;

export const apiMockAm20Lesson: DemoLesson = {
  id: 'am-20-tls-mtls',
  domainId: 'protocols',
  category: 'api-mock',
  name: 'HTTPS, HTTP/2 & mTLS with Cert-Subject Matching',
  description:
    'Open Server Settings on a plaintext health mock. Enable TLS, click '
    + '**Generate self-signed**, and hold the PEM fields while they fill. '
    + 'Save and Start — the address becomes `https://` and the HTTP/2 badge '
    + 'appears. Fetch `/health` for a real 200 over TLS. Then require a '
    + `client cert, issue \`${AM20_CN}\`, and pin \`certSubject\` on the `
    + 'rule. Simulate the matching CN and a wrong one. Export redacts the '
    + 'private key; Stop leaves the PEMs in the workspace.',
  estimatedMinutes: 8,
  initialTab: 'api-mock-studio',
  contentVersion: 1,
  concept: {
    title: 'HTTPS is a listen setting. Who may call is a matcher.',
    body:
      'Clients that refuse plaintext need a real certificate on the mock, not '
      + 'a story about one. **Generate self-signed** mints a 365-day localhost '
      + 'cert with SANs in the workspace — no OpenSSL ceremony. After Save and '
      + 'Start the listen address switches to `https://`, and **HTTP/2** comes '
      + 'along for free via ALPN. Plaintext stays HTTP/1.1.\n\n'
      + '**mTLS** is the other direction: the *client* must present a cert. '
      + 'Studio acts as the CA, issues a named bundle you can download, and '
      + 'Restart makes the running listener require it. Browsers cannot attach '
      + 'that PEM, so **Simulate** carries the cert subject while a live fetch '
      + 'would fail closed.\n\n'
      + 'A **security → certSubject** condition is how a rule admits only that '
      + 'client. The private key is redacted from every export. Stop the '
      + 'listener; the PEMs stay local for the next Start.',
    keyTerms: [
      { term: 'Self-signed TLS', definition: 'A certificate and private key generated in Studio for localhost, with SANs for the bind host. Clients must trust the cert (or skip verification) because no public CA signed it.' },
      { term: 'HTTP/2 (ALPN)', definition: 'When HTTPS is on, the companion negotiates HTTP/2. The HTTP/2 badge appears next to the listen address; plaintext stays HTTP/1.1.' },
      { term: 'mTLS', definition: 'Mutual TLS — the mock requires a client certificate. Studio issues the client cert, key, and CA so you can hand a ready bundle to the caller.' },
      { term: 'certSubject', definition: 'A Security-source matcher that reads the client certificate common name (for example CN=acme-client) without parsing a header yourself.' },
      { term: 'PEM redaction', definition: 'Export strips the private key to ***REDACTED*** so a shared workspace file cannot leak the mock identity.' },
      { term: 'Native parity warning', definition: 'A desktop/web notice when TLS cannot bind the same way on this platform. The keys still live in the workspace.' },
    ],
    diagram: DIAGRAM,
  },
  prepareBeforeNavigate: prepareAm20Workspace,
  cleanup: cleanupAm20,
  steps: [
    {
      id: 'generate-tls',
      title: 'Clients that refuse plaintext need a real certificate, not OpenSSL',
      description:
        'Click **Settings** on the server bar — that is the server modal, not '
        + 'Runtime Settings. Open the **TLS** tab, toggle **HTTPS** on, then '
        + 'click **Generate self-signed**.\n\n'
        + 'Hold the certificate and key fields while the PEMs fill. This is a '
        + '365-day localhost cert with SANs for the bind host. You did not '
        + 'leave Studio, and you do not need a terminal.',
      highlight: API_MOCK.SETTINGS,
      action: runAm20GenerateTls,
      verify: API_MOCK.SETTINGS_TLS_CERT,
    },
    {
      id: 'inspect-cert',
      title: 'Know what you generated: the public half, and where the key lives',
      description:
        'Hold the **Certificate** PEM — that is the public half you can share '
        + 'with clients so they trust this mock. Then hold **Private key**.\n\n'
        + 'The hint under the key is the contract: **Never share this. '
        + 'Redacted from all exports.** The key stays in this workspace. A '
        + 'later export step will prove the redaction; do not copy the key '
        + 'into a ticket.',
      highlight: API_MOCK.SETTINGS_TLS_CERT,
      preAction: ensureAm20ForInspect,
      action: runAm20InspectCert,
      verify: API_MOCK.SETTINGS_TLS_KEY,
    },
    {
      id: 'https-live',
      title: 'The address changes scheme, and HTTP/2 comes free via ALPN',
      description:
        'Click **Save settings**. The modal closes and the definition now has '
        + 'TLS on. Click **Start**. Hold the listen **address** — it is '
        + '`https://`, not `http://`.\n\n'
        + 'Then hold the **HTTP/2** badge. ALPN negotiates HTTP/2 only when '
        + 'TLS is on; a plaintext mock stays 1.1. The badge is how you see '
        + 'the protocol without opening a client.',
      highlight: API_MOCK.SETTINGS_SAVE,
      preAction: ensureAm20ForHttpsLive,
      action: runAm20HttpsLive,
      verify: API_MOCK.HTTP2_BADGE,
    },
    {
      id: 'prove-https',
      title: 'A real TLS request, not a claim',
      description:
        `Watch the listen address, then fetch \`GET ${AM20_HEALTH}\` through `
        + 'the app proxy. Open the new journal row.\n\n'
        + 'Hold **200** on the response. That status arrived over TLS — the '
        + 'same health rule as before, now on `https://`. If this fetch had '
        + 'stayed on plaintext, the address would still say `http://`.',
      highlight: API_MOCK.ADDRESS,
      preAction: ensureAm20ForProveHttps,
      action: runAm20ProveHttps,
      verify: API_MOCK.JOURNAL_FIRST_ROW,
    },
    {
      id: 'mtls',
      title: 'Now make the client prove identity',
      description:
        'Toggle **Require client cert**. Fill the common name with '
        + `\`${AM20_CN}\`, then click **Generate client certificate**. Hold `
        + 'the issued bundle and the download hints — cert, key, and CA — '
        + 'for a couple of seconds so the filenames are readable.\n\n'
        + '**Save settings**, then **Restart** so the running listener '
        + 'actually requires the client cert. A browser cannot attach that '
        + 'PEM; the next steps use Simulate for the match proof.',
      highlight: API_MOCK.SETTINGS_MTLS_ENABLED,
      preAction: ensureAm20ForMtls,
      action: runAm20Mtls,
      verify: API_MOCK.HTTP2_BADGE,
    },
    {
      id: 'cert-predicate',
      title: 'A rule only certain clients can reach',
      description:
        'Back on **Match**, click **+ Condition**. Set the source to '
        + '**security** — that is the product\'s way to read identity without '
        + 'parsing a header. Set the selector to **certSubject**, then fill '
        + `the expected value \`${AM20_CERT_SUBJECT}\`.\n\n`
        + 'Hold the row. This condition is why mTLS is not only a listen '
        + 'flag: the mock can answer one client and reject another by name.',
      highlight: API_MOCK.ADD_CONDITION,
      preAction: ensureAm20ForCertPredicate,
      action: runAm20CertPredicate,
      verify: API_MOCK.FIRST_CONDITION,
    },
    {
      id: 'prove-cert-match',
      title: 'Browsers cannot attach a PEM, so Simulate carries the subject',
      description:
        'Click **Simulate**. Fill **Client cert subject** with the pinned '
        + `\`${AM20_CERT_SUBJECT}\`, review the request, then hold **Run `
        + 'simulation** before the click. The outcome is **MATCHED**.\n\n'
        + 'Change the subject to a different CN and run again. **UNMATCHED** '
        + 'is the other half of the proof — the rule is not "any cert", it is '
        + 'this name. Close Simulate when both verdicts have been held.',
      highlight: API_MOCK.SIMULATE,
      preAction: ensureAm20ForProveCert,
      action: async (ctx) => {
        await runAm20ProveCertMatch(ctx);
      },
      verify: API_MOCK.SIMULATE_OUTCOME,
    },
    {
      id: 'redaction-parity',
      title: 'PEMs are stripped from exports; Stop keeps the keys local',
      description:
        'Click **Export** → **Workspace**. Hold the redaction note, then the '
        + 'TLS key placeholder — `***REDACTED***`, never the PEM. Close the '
        + 'confirmation.\n\n'
        + 'If a native parity warning is showing, hold it; it is absent when '
        + 'this platform bound HTTPS cleanly. Click **Stop**. The listener '
        + 'is down and the keys are still in Settings for the next Start.',
      highlight: API_MOCK.EXPORT,
      preAction: ensureAm20ForRedaction,
      action: runAm20RedactionParity,
      verify: API_MOCK.START,
    },
  ],
};
