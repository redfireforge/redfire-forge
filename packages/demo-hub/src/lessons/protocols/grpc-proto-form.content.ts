import type { GrpcDemoLesson } from './grpc-lesson-contract';

export const grpcProtoFormConcept: GrpcDemoLesson['concept'] = {
  title: 'Full Form Editor',
  body: `When a gRPC request has complex nested fields, the compact JSON composer on the **Form Input** tab offers an **Open Full Form Editor** button. This opens a resizable modal with three synchronized views:

| View | What it shows |
|---|---|
| **Form View** | One guided row per field — type badges, inline JSON sub-editors, + Add / × remove controls, oneof radio pills. Insight chips at the top show complexity at a glance. |
| **Focus View** | A two-panel layout: a searchable field navigator on the left; a single-field detail editor on the right. Ideal for deeply nested or wide schemas. |
| **JSON View** | The raw JSON draft with a live assist sidebar that summarises active oneof branches, map entry counts, and repeated item counts. |

All three views edit the **same working draft**. Switching tabs never loses your work. Click **Apply to Request** to push the draft back into the compact composer; click **Discard** to abandon it.

**What you will do in this lesson:**
1. **See** the compact JSON composer and the **Open Full Form Editor** button.
2. **Open** the Full Form Editor for \`CreateComplexEcho\`.
3. **Form View** — fill the scalar \`message\` field; view insight chips.
4. **Form View** — edit the nested \`shipping_address\` JSON sub-editor.
5. **Form View** — add and remove \`labels\` repeated items.
6. **Form View** — add \`attributes\` map entries.
7. **Form View** — switch the \`payment_method\` oneof from card to invoice.
8. **Focus View** — navigate to \`deadline\` and set its Timestamp value.
9. **JSON View** — edit the raw JSON draft; see the assist sidebar.
10. **Apply to Request**, then **Send** — the server echoes every field back.`,
  keyTerms: [
    {
      term: 'Full Form Editor',
      definition:
        'The resizable modal opened from the compact JSON composer. Provides three synchronized views '
        + '(Form View, Focus View, JSON View) for editing complex proto request bodies.',
    },
    {
      term: 'Form View',
      definition:
        'A guided-form view inside the Full Form Editor. Renders one row per top-level field with type '
        + 'badges, inline JSON sub-editors for nested messages, + Add / × controls for repeated and map fields, '
        + 'and radio pills for oneof groups.',
    },
    {
      term: 'Focus View',
      definition:
        'A two-panel view inside the Full Form Editor. A searchable field navigator on the left lets you pick '
        + 'any field by name; a detail editor on the right shows only that field\'s input, keeping the view '
        + 'uncluttered for schemas with many fields.',
    },
    {
      term: 'JSON View',
      definition:
        'A raw JSON editor inside the Full Form Editor, paired with a live assist sidebar that tracks active '
        + 'oneof branches, map entry counts, and repeated item counts to help you hand-edit complex bodies.',
    },
    {
      term: 'Apply to Request',
      definition:
        'The footer button in the Full Form Editor that pushes the working draft back to the compact JSON '
        + 'composer on the Form Input tab and closes the modal.',
    },
    {
      term: 'Insight chips',
      definition:
        'The complexity summary at the top of Form View showing counts of oneof groups, map fields, and '
        + 'repeated fields in the request schema — a quick orientation before you start filling fields.',
    },
  ],
  diagram: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 340" style="display:block;width:100%;height:auto;font-family:system-ui,sans-serif">
  <defs>
    <marker id="grpc20-arr" markerWidth="7" markerHeight="7" refX="4" refY="3.5" orient="auto">
      <path d="M1,1 L6,3.5 L1,6 Z" fill="#3b82f6"/>
    </marker>
    <marker id="grpc20-arr-back" markerWidth="7" markerHeight="7" refX="3" refY="3.5" orient="auto">
      <path d="M6,1 L1,3.5 L6,6 Z" fill="#22c55e"/>
    </marker>
  </defs>

  <!-- Compact composer -->
  <rect x="14" y="30" width="180" height="72" rx="8" fill="#0f172a" stroke="#3b4a60" stroke-width="1.2"/>
  <text x="104" y="50" text-anchor="middle" font-size="10" fill="#a8b8cc">Form Input</text>
  <rect x="26" y="58" width="156" height="22" rx="4" fill="#1e293b" stroke="#3b82f6"/>
  <text x="104" y="73" text-anchor="middle" font-size="8" fill="#93c5fd">{ "message": "..." }</text>
  <text x="104" y="95" text-anchor="middle" font-size="7.5" fill="#64748b">Open Full Form Editor ↗</text>

  <!-- Arrow: open modal -->
  <line x1="194" y1="66" x2="272" y2="66" stroke="#3b82f6" stroke-width="1.4" marker-end="url(#grpc20-arr)"/>
  <text x="233" y="60" text-anchor="middle" font-size="7.5" fill="#93c5fd">open</text>

  <!-- Full Form Editor modal outline -->
  <rect x="274" y="16" width="412" height="280" rx="8" fill="#0d1520" stroke="#3b82f6" stroke-width="1.6"/>
  <text x="480" y="36" text-anchor="middle" font-size="11" fill="#f1f5f9">Full Form Editor</text>

  <!-- Tabs -->
  <rect x="286" y="44" width="88" height="22" rx="4" fill="#1e3a5f" stroke="#3b82f6"/>
  <text x="330" y="59" text-anchor="middle" font-size="8.5" fill="#93c5fd">Form View</text>
  <rect x="382" y="44" width="88" height="22" rx="4" fill="#1e293b" stroke="#3b4a60"/>
  <text x="426" y="59" text-anchor="middle" font-size="8.5" fill="#a8b8cc">Focus View</text>
  <rect x="478" y="44" width="88" height="22" rx="4" fill="#1e293b" stroke="#3b4a60"/>
  <text x="522" y="59" text-anchor="middle" font-size="8.5" fill="#a8b8cc">JSON View</text>

  <!-- Insight chips -->
  <rect x="286" y="74" width="388" height="18" rx="4" fill="#0f2b1a" stroke="#22c55e" stroke-width="0.8"/>
  <text x="480" y="87" text-anchor="middle" font-size="7.5" fill="#4ade80">oneof: 1  ·  map: 1  ·  repeated: 1</text>

  <!-- Form rows -->
  <rect x="286" y="100" width="388" height="20" rx="3" fill="#1e293b" stroke="#3b4a60" stroke-width="0.8"/>
  <text x="370" y="113" font-size="7.5" fill="#f1f5f9">message</text>
  <text x="560" y="113" font-size="7" fill="#4ade80">string</text>
  <rect x="286" y="126" width="388" height="20" rx="3" fill="#1e293b" stroke="#3b4a60" stroke-width="0.8"/>
  <text x="370" y="139" font-size="7.5" fill="#f1f5f9">shipping_address  { street, city... }</text>
  <text x="630" y="139" font-size="7" fill="#818cf8">msg</text>
  <rect x="286" y="152" width="388" height="20" rx="3" fill="#1e293b" stroke="#3b4a60" stroke-width="0.8"/>
  <text x="370" y="165" font-size="7.5" fill="#f1f5f9">labels  [ alpha, gamma ]  + Add item</text>
  <text x="636" y="165" font-size="7" fill="#3b82f6">rep</text>
  <rect x="286" y="178" width="388" height="20" rx="3" fill="#1e293b" stroke="#3b4a60" stroke-width="0.8"/>
  <text x="370" y="191" font-size="7.5" fill="#f1f5f9">payment_method  ● invoice  ○ card</text>
  <text x="623" y="191" font-size="7" fill="#f59e0b">oneof</text>

  <!-- Footer -->
  <rect x="286" y="264" width="388" height="24" rx="4" fill="#1e293b" stroke="#3b4a60" stroke-width="0.8"/>
  <text x="390" y="280" font-size="8" fill="#a8b8cc">Discard</text>
  <rect x="544" y="268" width="110" height="16" rx="3" fill="#1e3a5f" stroke="#3b82f6"/>
  <text x="599" y="280" text-anchor="middle" font-size="7.5" fill="#93c5fd">Apply to Request</text>

  <!-- Arrow: apply back -->
  <line x1="272" y1="80" x2="194" y2="80" stroke="#22c55e" stroke-width="1.4" marker-end="url(#grpc20-arr-back)"/>
  <text x="233" y="76" text-anchor="middle" font-size="7.5" fill="#4ade80">apply</text>

  <text x="350" y="325" text-anchor="middle" font-size="10" fill="#a8b8cc">Working draft → Apply to Request → compact composer</text>
</svg>`,
};
