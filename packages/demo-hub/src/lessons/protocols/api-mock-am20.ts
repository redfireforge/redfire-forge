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
  <text x="42" y="262" fill="#f1f5f9" font-family="system-ui" font-size="12" font-weight="600">
    <tspan x="42" dy="0">The private key never leaves the workspace. Exports show ***REDACTED***.</tspan>
    <tspan x="42" dy="16">Desktop parity warnings surface when TLS cannot bind.</tspan>
  </text>
  <text x="42" y="298" fill="#a8b8cc" font-family="system-ui" font-size="11">Stop the listener. The PEMs stay in Settings so the next Start is still HTTPS.</text>

  <rect x="26" y="328" width="648" height="78" rx="8" fill="#1e293b" stroke="#22c55e" />
  <text x="42" y="348" fill="#22c55e" font-family="system-ui" font-size="12" font-weight="600">
    <tspan x="42" dy="0">Generate → inspect → Start HTTPS → live 200 → mTLS bundle → cert predicate</tspan>
    <tspan x="42" dy="16">→ Simulate both ways → redact + Stop</tspan>
  </text>
  <text x="42" y="388" fill="#a8b8cc" font-family="system-ui" font-size="11">TLS is a server setting. Who may call is a Match condition. Identity is not a header you parse by hand.</text>
</svg>
`;

export const apiMockAm20Lesson: DemoLesson = {
  id: 'am-20-tls-mtls',
  domainId: 'api-mock',
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
  contentVersion: 5,
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
        'A client configured to refuse plaintext will not accept a *story* '
        + 'about a certificate — it needs a real one presented at the '
        + 'handshake. The usual path is an OpenSSL incantation in a terminal; '
        + 'the whole point of **Generate self-signed** (on the server bar’s '
        + 'TLS tab, the definition — not Runtime Settings) is that you never '
        + 'leave Studio to get one.\n\n'
        + 'One click mints a 365-day localhost certificate and private key, '
        + 'with SANs for the bind host, straight into the server definition. '
        + 'Watching the PEM fields fill *is* the point — that is a working '
        + 'cert, no ceremony, ready for the listener to bind.',
      highlight: API_MOCK.SETTINGS,
      action: runAm20GenerateTls,
      verify: API_MOCK.SETTINGS_TLS_CERT,
    },
    {
      id: 'inspect-cert',
      title: 'Know what you generated: the public half, and where the key lives',
      description:
        'A generated cert is two halves with opposite rules, and knowing which '
        + 'is which is the entire security habit. The **Certificate** is the '
        + 'public half — you hand it to clients so they will trust this mock. '
        + 'The **Private key** is the half that proves the mock is the mock, '
        + 'and it must never leave here.\n\n'
        + 'The hint under the key states that contract out loud: *Never share '
        + 'this. Redacted from all exports.* A later step will prove the '
        + 'redaction actually happens — for now, just register that the key '
        + 'lives in this workspace and never belongs in a ticket.',
      highlight: API_MOCK.SETTINGS_TLS_CERT,
      preAction: ensureAm20ForInspect,
      action: runAm20InspectCert,
      verify: API_MOCK.SETTINGS_TLS_KEY,
    },
    {
      id: 'https-live',
      title: 'The address changes scheme, and HTTP/2 comes free via ALPN',
      description:
        'A cert sitting in Settings is not serving anything yet — the listener '
        + 'has to bind it. Save the definition and **Start**, and the proof is '
        + 'right there in the chrome: the listen address flips from `http://` '
        + 'to `https://`.\n\n'
        + 'The **HTTP/2** badge is the bonus you did not have to ask for. ALPN '
        + 'negotiates HTTP/2 during the TLS handshake, so switching on HTTPS '
        + 'quietly upgrades the protocol too (plaintext stays HTTP/1.1). '
        + 'Between the scheme and the badge, both transport facts are visible '
        + 'without ever opening a client.',
      highlight: API_MOCK.SETTINGS_SAVE,
      preAction: ensureAm20ForHttpsLive,
      action: runAm20HttpsLive,
      verify: API_MOCK.LISTEN_URL,
    },
    {
      id: 'prove-https',
      title: 'A real TLS request, not a claim',
      description:
        'The badge tells you TLS is *configured*; a live request tells you it '
        + `*works*. A \`GET ${AM20_HEALTH}\` goes out through the app proxy and `
        + 'lands in the journal as a real **200 (OK)** — the very same health '
        + 'rule as before, now answered over an encrypted connection.\n\n'
        + 'That is the distinction worth holding: nothing about the rule '
        + 'changed, only the transport beneath it. Had the handshake failed, '
        + 'the fetch would never have reached 200 and the address would still '
        + 'read `http://`.',
      highlight: API_MOCK.ADDRESS,
      preAction: ensureAm20ForProveHttps,
      action: runAm20ProveHttps,
      verify: API_MOCK.JOURNAL_FIRST_ROW,
    },
    {
      id: 'mtls',
      title: 'Now make the client prove identity',
      description:
        'So far TLS proved the *server* to the client. **mTLS** flips the '
        + 'requirement around: the client must now present a certificate of '
        + 'its own, or the handshake fails. That normally means standing up a '
        + 'CA — so Studio plays the CA for you, issuing a named bundle (cert, '
        + 'key, and CA) you can download and hand straight to the caller.\n\n'
        + `Here the client is \`CN=${AM20_CN}\`. **Restart** is what makes the `
        + 'running listener actually *demand* the cert — until then it is only '
        + 'a saved intention. A browser has no way to attach that PEM, which '
        + 'is exactly why the next steps prove identity through **Simulate** '
        + 'rather than a live fetch.',
      highlight: API_MOCK.SETTINGS_MTLS_ENABLED,
      preAction: ensureAm20ForMtls,
      action: runAm20Mtls,
      verify: API_MOCK.HTTP2_BADGE,
    },
    {
      id: 'cert-predicate',
      title: 'A rule only certain clients can reach',
      description:
        'Requiring *a* client cert is coarse — it lets in anyone the CA ever '
        + 'issued. The sharper control is admitting exactly *one* client, and '
        + 'that lives on the rule as a **Match condition**, not in the listen '
        + 'settings.\n\n'
        + 'Add a condition whose source is **security** — the product’s way to '
        + 'read *verified* identity — and whose selector is **certSubject**, '
        + `pinned to \`${AM20_CERT_SUBJECT}\`. You are not string-parsing a `
        + 'certificate header by hand; the mock hands the rule the verified '
        + 'subject and the rule decides. This is what lets one mock answer one '
        + 'client and turn another away by name.',
      highlight: API_MOCK.ADD_CONDITION,
      preAction: ensureAm20ForCertPredicate,
      action: runAm20CertPredicate,
      verify: API_MOCK.FIRST_CONDITION,
    },
    {
      id: 'prove-cert-match',
      title: 'Browsers cannot attach a PEM, so Simulate carries the subject',
      description:
        'Because no browser can attach a client PEM, **Simulate** is how you '
        + 'exercise the condition — it carries the cert subject straight into '
        + `the match engine. Run it once with the pinned \`${AM20_CERT_SUBJECT}\` `
        + 'and the verdict is **MATCHED**.\n\n'
        + 'The miss is the half people skip. Change the subject to a different '
        + 'CN and run again — **UNMATCHED**. Both verdicts together are the '
        + 'real proof: the rule is not "any valid cert", it is *this name*. '
        + 'The guarantee only becomes true once you have seen it fail closed.',
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
        'A workspace export is a file you *will* share, so the one thing it '
        + 'must never contain is the private key. **Export → Workspace** and '
        + 'the TLS key comes out as `***REDACTED***` — the public cert '
        + 'travels, the secret half does not, so a shared file cannot leak the '
        + 'mock’s identity.\n\n'
        + 'If this platform could not bind TLS the same way, a native parity '
        + 'warning explains why (a clean bind shows none). Finally **Stop** the '
        + 'listener — and notice the PEMs stay in Settings, so the next Start '
        + 'is still HTTPS. Turning the mock off does not throw away the '
        + 'certificate you just made.',
      highlight: API_MOCK.EXPORT,
      preAction: ensureAm20ForRedaction,
      action: runAm20RedactionParity,
      verify: API_MOCK.SETTINGS_TLS_CERT,
    },
  ],
};
