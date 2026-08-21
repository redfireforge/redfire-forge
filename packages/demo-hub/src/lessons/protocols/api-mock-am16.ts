/**
 * AM-16 `am-16-export` — Export & Round-Trip: JSON/YAML, WireMock, HAR, Redaction.
 *
 * Scenario: a store library already has rules, a TLS key, and a secret variable.
 * Export is six shapes for six jobs. Redaction is the proof that keys never
 * leave the machine. WireMock and HAR carry an honest loss note. The real test
 * of an export is importing it back as a copy. The CLI line is the CI artifact.
 * Curriculum: `docs/plan/future/apimock/apimock-demo-curriculum-v2.md` §5 Track D.
 */
import { API_MOCK } from '@shared/selectors';
import type { DemoLesson } from '../../types';
import {
  AM16_CLI,
  AM16_TLS_REDACTED,
  cleanupAm16,
  ensureAm16ForCi,
  ensureAm16ForExportMenu,
  ensureAm16ForInterop,
  ensureAm16ForNarrower,
  ensureAm16ForRedaction,
  ensureAm16ForRoundTrip,
  prepareAm16Workspace,
  runAm16CiHandoff,
  runAm16ExportMenu,
  runAm16Interop,
  runAm16NarrowerScopes,
  runAm16Redaction,
  runAm16RoundTrip,
} from './api-mock-am16-helpers';

const DIAGRAM = `
<svg viewBox="0 0 700 430" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Six export shapes, redaction, and a round-trip copy">
  <rect x="0" y="0" width="700" height="430" fill="#0f172a" />

  <text x="26" y="34" fill="#f1f5f9" font-family="system-ui" font-size="16" font-weight="600">Six shapes. Keys stay here. The file is what CI runs.</text>
  <text x="26" y="54" fill="#64748b" font-family="system-ui" font-size="10">JSON · YAML · server · routes · WireMock · HAR</text>

  <rect x="26" y="72" width="210" height="150" rx="8" fill="#1e293b" stroke="#3b82f6" />
  <text x="42" y="96" fill="#3b82f6" font-family="system-ui" font-size="12" font-weight="600">Workspace</text>
  <text x="42" y="118" fill="#f1f5f9" font-family="system-ui" font-size="11">JSON for the whole library</text>
  <text x="42" y="138" fill="#a8b8cc" font-family="system-ui" font-size="11">YAML for source control</text>
  <text x="42" y="158" fill="#a8b8cc" font-family="system-ui" font-size="11">One server for a teammate</text>
  <text x="42" y="178" fill="#64748b" font-family="system-ui" font-size="10">Rules alone graft onto another mock</text>
  <text x="42" y="202" fill="#64748b" font-family="system-ui" font-size="10">Confirmation is the readable artifact</text>

  <rect x="248" y="72" width="210" height="150" rx="8" fill="#1e293b" stroke="#f59e0b" />
  <text x="264" y="96" fill="#f59e0b" font-family="system-ui" font-size="12" font-weight="600">Redaction</text>
  <text x="264" y="118" fill="#f1f5f9" font-family="ui-monospace" font-size="11">${AM16_TLS_REDACTED}</text>
  <text x="264" y="138" fill="#a8b8cc" font-family="system-ui" font-size="11">TLS private key is stripped</text>
  <text x="264" y="158" fill="#a8b8cc" font-family="system-ui" font-size="11">Sensitive vars become [REDACTED]</text>
  <text x="264" y="178" fill="#64748b" font-family="system-ui" font-size="10">The callout is the contract</text>
  <text x="264" y="202" fill="#22c55e" font-family="system-ui" font-size="10">Keys never leave this workspace</text>

  <rect x="470" y="72" width="204" height="150" rx="8" fill="#1e293b" stroke="#a78bfa" />
  <text x="486" y="96" fill="#a78bfa" font-family="system-ui" font-size="12" font-weight="600">Interop + CI</text>
  <text x="486" y="118" fill="#f1f5f9" font-family="system-ui" font-size="11">WireMock + a loss note</text>
  <text x="486" y="138" fill="#a8b8cc" font-family="system-ui" font-size="11">HAR from journal samples</text>
  <text x="486" y="158" fill="#a8b8cc" font-family="system-ui" font-size="11">Import as copy duplicates ids</text>
  <text x="486" y="178" fill="#64748b" font-family="system-ui" font-size="10">Footer carries the CLI line</text>
  <text x="486" y="202" fill="#22c55e" font-family="system-ui" font-size="10">${AM16_CLI}</text>

  <rect x="26" y="240" width="648" height="70" rx="8" fill="#1e293b" stroke="#3b4a60" />
  <text x="42" y="268" fill="#f1f5f9" font-family="system-ui" font-size="12" font-weight="600">A download you cannot read is not a demo.</text>
  <text x="42" y="290" fill="#a8b8cc" font-family="system-ui" font-size="11">Every export opens a confirmation: preview, redaction proof, loss notes, entry count. Use last export is the round-trip beat.</text>

  <rect x="26" y="328" width="648" height="78" rx="8" fill="#1e293b" stroke="#22c55e" />
  <text x="42" y="356" fill="#22c55e" font-family="system-ui" font-size="12" font-weight="600">Export → read the file → import as copy → hand CI the same artifact</text>
  <text x="42" y="378" fill="#a8b8cc" font-family="system-ui" font-size="11">Six shapes, one redaction proof, one loss note, one duplicated library, one copyable command. That is the export contract.</text>
</svg>
`;

export const apiMockAm16Lesson: DemoLesson = {
  id: 'am-16-export',
  domainId: 'api-mock',
  category: 'api-mock',
  name: 'Export & Round-Trip: JSON/YAML, WireMock, HAR, Redaction',
  description:
    'Open Export and read the six shapes. Download workspace JSON, then YAML, '
    + 'one server, and rules alone. Hold the redaction callout until the TLS '
    + `private key is \`${AM16_TLS_REDACTED}\`. Hand a WireMock mapping set with `
    + 'its loss note, then a HAR of the journal samples. Import that native '
    + 'file back as a copy so duplicated rules appear with new ids. The footer '
    + `CLI line — \`${AM16_CLI}\` — is the artifact CI runs against.`,
  estimatedMinutes: 6,
  initialTab: 'api-mock-studio',
  contentVersion: 7,
  concept: {
    title: 'The export is the file. Redaction is why you can share it.',
    body:
      'A mock that only lives in this Studio is a local convenience. The moment '
      + 'you hand it to a teammate, a PR, or CI, it has to be a **file** — and '
      + 'that file must not contain the TLS private key or the token you marked '
      + 'sensitive.\n\n'
      + '**Export** is six shapes for six jobs. **Workspace JSON** is the whole '
      + 'library. **YAML** is the same contract in a diff-friendly form. **Active '
      + 'server** is one tab. **Routes** is the rule set you graft onto someone '
      + 'else\'s mock. **WireMock** is the subset another team can load, plus a '
      + '**loss note** for helpers that have no equivalent. **HAR** is the journal '
      + '(and saved samples) other tools already know how to replay.\n\n'
      + `Redaction writes \`${AM16_TLS_REDACTED}\` over the private key and `
      + '`[REDACTED]` over sensitive variables. **Import as copy** is the round-trip '
      + 'test: new ids, duplicated rows, nothing clobbered. The footer line '
      + `\`${AM16_CLI}\` is how that same file runs in CI.`,
    keyTerms: [
      { term: 'Workspace JSON / YAML', definition: 'The full library, every server. JSON for tools; YAML for source control. Both are redacted.' },
      { term: 'Server / routes export', definition: 'Narrower scopes. One tab for a teammate, or just the rules to graft onto another mock.' },
      { term: 'Redaction', definition: 'TLS private keys and sensitive variables are stripped from every native export. The confirmation shows the placeholders.' },
      { term: 'WireMock loss note', definition: 'An honest list of Studio features (templates, weights, glob paths) that have no WireMock equivalent.' },
      { term: 'HAR (journal)', definition: 'Captured traffic and saved samples, packaged so other tools can replay the same requests.' },
      { term: 'Import as copy', definition: 'The round-trip mode. Duplicates every imported rule with a new id so the original set stays intact.' },
      { term: 'redfireforge mock simulate', definition: 'The CI command that runs the exported file as a unit-level suite. The Studio footer keeps it copyable.' },
    ],
    diagram: DIAGRAM,
  },
  prepareBeforeNavigate: prepareAm16Workspace,
  cleanup: cleanupAm16,
  steps: [
    {
      id: 'export-map',
      title: 'The Export menu is a map, not a button',
      description:
        'A mock that only lives in this Studio cannot be shared. The moment it '
        + 'has to reach a teammate, a PR, or CI, it becomes a **file** — and the '
        + 'Export menu is where you choose which shape of file to make.\n\n'
        + 'Read the map before downloading anything. The six shapes fall into '
        + 'three groups, one per audience:\n'
        + '- **Workspace** — the entire library (JSON for tools and CI, YAML for source control)\n'
        + '- **This server** — just this tab, or just its rules to graft onto another mock\n'
        + '- **Interop** — files for tools that are not RedfireForge (WireMock, HAR)\n\n'
        + 'To make it concrete, take the baseline: **Workspace JSON**. The '
        + 'confirmation is the point — a download you cannot read is not a demo. '
        + 'Note the two ways out: **Save to disk** writes the file to Downloads; '
        + '**Copy** only puts it on the clipboard.',
      highlight: API_MOCK.EXPORT,
      preAction: ensureAm16ForExportMenu,
      action: runAm16ExportMenu,
      verify: API_MOCK.EXPORT_SAVE,
    },
    {
      id: 'redaction',
      title: 'The same file — and it is already safe to share',
      description:
        'The whole reason a mock can leave your laptop is that the file does '
        + '**not** carry your secrets. Stay on the Workspace JSON you just made '
        + '— no new download — and read the **redaction callout** at the top.\n\n'
        + `The TLS private key reads \`${AM16_TLS_REDACTED}\`, not the PEM that `
        + 'still sits untouched in Settings. The `apiToken` you marked sensitive '
        + 'reads `[REDACTED]`. The callout is the contract: keys and secrets are '
        + 'stripped from every native export, so this file is safe to attach to '
        + 'a PR.',
      highlight: API_MOCK.EXPORT,
      preAction: ensureAm16ForRedaction,
      action: runAm16Redaction,
      verify: API_MOCK.EXPORT_TLS_KEY,
    },
    {
      id: 'scopes',
      title: 'Hand over exactly as much as the reader needs',
      description:
        'You rarely send the whole library. The same contract has narrower cuts, '
        + 'each matched to a different reader — that is one idea, three exports.\n'
        + '- **Workspace YAML** — the same library in a diff-friendly form, so a reviewer reads the change in a PR instead of a wall of JSON\n'
        + '- **Active server** — one tab for a teammate who only needs this mock\n'
        + '- **Active server routes** — the rules alone, to graft onto someone else\'s mock\n\n'
        + 'Watch the preview shrink as the scope narrows: the whole library, then '
        + 'one server, then just its rules.',
      highlight: API_MOCK.EXPORT,
      preAction: ensureAm16ForNarrower,
      action: runAm16NarrowerScopes,
      verify: API_MOCK.EXPORT_CONFIRM,
    },
    {
      id: 'interop',
      title: 'Leaving RedfireForge — honestly',
      description:
        'Some readers are not on RedfireForge at all. The Interop group speaks '
        + 'their formats, and the honest part is that it tells you what does '
        + 'not survive the trip.\n\n'
        + '**HAR (journal)** packages captured traffic and saved samples so any '
        + 'HAR tool can replay the same requests — the two store probes travel '
        + 'even though the listener never ran, and cookies and auth are redacted '
        + 'on the way out. So you share the *shape* of traffic, not a session.\n\n'
        + '**WireMock mappings** hands a set to a team still on WireMock. Studio '
        + 'features like `{{pathParam}}` templates and weighted variants have no '
        + 'WireMock equivalent — so they are named in a **loss report** rather '
        + 'than dropped in silence. A mapping file without that note would lie.',
      highlight: API_MOCK.EXPORT,
      preAction: ensureAm16ForInterop,
      action: runAm16Interop,
      verify: API_MOCK.EXPORT_LOSS,
    },
    {
      id: 'round-trip',
      title: 'The real test of an export is importing it back',
      description:
        'An export you never re-read is a guess. Prove this one round-trips: '
        + '**Import**, switch to **RedfireForge export**, and choose **Import as '
        + 'copy** so the originals are never at risk.\n\n'
        + '**Use last export** is the power-user beat — it pulls the JSON you '
        + 'just confirmed straight back in, no fishing in Downloads. **Pretty '
        + 'format** so it is readable, then parse and confirm.\n\n'
        + 'The payoff is the **duplicated rows**: new ids, `(copy)` names, '
        + 'originals untouched. A round-trip that clobbered the library would '
        + 'not be a round-trip.',
      highlight: API_MOCK.IMPORT_MENU,
      preAction: ensureAm16ForRoundTrip,
      action: runAm16RoundTrip,
      verify: API_MOCK.COPIED_ROUTE,
    },
    {
      id: 'ci-handoff',
      title: 'The file is the artifact CI runs against',
      description:
        'The last question is how the file runs without a person. The footer '
        + 'tally is the library you just duplicated — enabled and draft counts, '
        + 'the same set CI will load.\n\n'
        + `The copyable \`${AM16_CLI}\` line closes the loop: it runs the exported `
        + 'file as a unit-level suite. Studio authors it, Simulate proves it, and '
        + 'this command is how the very same contract leaves the laptop.',
      highlight: API_MOCK.ROUTES_FOOTER,
      preAction: ensureAm16ForCi,
      action: runAm16CiHandoff,
      verify: API_MOCK.CLI_SIMULATE,
    },
  ],
};
