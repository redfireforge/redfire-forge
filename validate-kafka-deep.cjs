/**
 * Deep Kafka Demo Validation
 * 
 * For each lesson step, compares what the lesson file says SHOULD happen
 * against what the DOM actually shows after the action runs.
 * 
 * Assertions are derived directly from each lesson's step definitions:
 * - Fill actions → check the field has the expected value
 * - Click actions → check the expected element appeared
 * - Navigation preActions → check the correct page/tab is visible
 * - Informational steps → check the spotlight target exists in the DOM
 */

const { chromium } = require('playwright');

// ── Assertion results ──────────────────────────────────────────────────────────
const RESULTS = [];

function pass(lesson, step, label) {
  RESULTS.push({ status: 'PASS', lesson, step, label });
  console.log(`    ✓ ${label}`);
}
function fail(lesson, step, label, actual) {
  RESULTS.push({ status: 'FAIL', lesson, step, label, actual });
  console.log(`    ✗ ${label} — actual: ${actual}`);
}
function skip(lesson, step, label) {
  RESULTS.push({ status: 'SKIP', lesson, step, label });
  console.log(`    ~ ${label} (requires Docker)`);
}

// ── Assertion helpers (run inside page.evaluate) ──────────────────────────────
async function assert(page, lesson, stepLabel, checks) {
  for (const c of checks) {
    if (c.type === 'skip') {
      skip(lesson, stepLabel, c.label);
      continue;
    }
    const result = await page.evaluate((check) => {
      const el = document.querySelector(check.sel);
      if (!el) return { found: false };
      if (check.type === 'exists') return { found: true };
      if (check.type === 'value') {
        const v = el.value ?? el.textContent?.trim();
        return { found: true, value: v };
      }
      if (check.type === 'contains') {
        const v = el.value ?? el.textContent?.trim() ?? '';
        return { found: true, value: v, ok: v.includes(check.expected) };
      }
      if (check.type === 'attr') {
        return { found: true, value: el.getAttribute(check.attr) };
      }
      if (check.type === 'checked') {
        const chk = el.getAttribute('aria-checked') === 'true' || el.checked;
        return { found: true, value: chk };
      }
      if (check.type === 'notExists') {
        return { found: false }; // element found but should NOT exist
      }
      return { found: true };
    }, c);

    if (c.type === 'notExists') {
      if (!result.found) pass(lesson, stepLabel, c.label);
      else fail(lesson, stepLabel, c.label, 'element still present');
      continue;
    }
    if (!result.found) { fail(lesson, stepLabel, c.label, 'element not in DOM'); continue; }
    if (c.type === 'exists') { pass(lesson, stepLabel, c.label); continue; }
    if (c.type === 'value') {
      if (result.value === c.expected) pass(lesson, stepLabel, c.label);
      else fail(lesson, stepLabel, c.label, JSON.stringify(result.value));
      continue;
    }
    if (c.type === 'contains') {
      if (result.ok) pass(lesson, stepLabel, c.label);
      else fail(lesson, stepLabel, c.label, JSON.stringify(result.value?.substring(0, 60)));
      continue;
    }
    if (c.type === 'checked') {
      if (result.value === c.expected) pass(lesson, stepLabel, c.label);
      else fail(lesson, stepLabel, c.label, `checked=${result.value}`);
      continue;
    }
    if (c.type === 'attr') {
      if (result.value === c.expected) pass(lesson, stepLabel, c.label);
      else fail(lesson, stepLabel, c.label, JSON.stringify(result.value));
      continue;
    }
  }
}

// ── Step validation map (derived from lesson source files) ────────────────────
// Key = lesson title, value = map of step_index → array of checks
const STEP_CHECKS = {

  'Quick Start': {
    // s0: ks-intro — preAction: navigateToTab('kafka-settings')
    0: [{ type: 'exists', sel: '[data-testid="kafka-settings-page"]', label: 'Settings page is visible' }],
    // s1: ks-create — action: click empty-create-btn (if no clusters)
    1: [{ type: 'exists', sel: '[data-testid="kafka-cluster-editor"]', label: 'Cluster editor opened' }],
    // s2: ks-fill — action: fill '#kafka-cluster-name' with "Demo Cluster"
    2: [{ type: 'value', sel: '#kafka-cluster-name', expected: 'Demo Cluster', label: 'Cluster name = "Demo Cluster"' }],
    // s3: ks-save — needs broker, just check Save btn
    3: [{ type: 'exists', sel: '[data-testid="kafka-save-cluster-btn"]', label: 'Save button present' }],
    // s4: ks-connect — requires live broker (DISCONNECT_BTN only appears when connected)
    4: [{ type: 'skip', label: 'ks-connect: Connected status (requires running Docker broker)' }],
    // s5: ks-status — requires live broker
    5: [{ type: 'skip', label: 'ks-status: Connected badge (requires running Docker broker)' }],
    // s6: ks-studio — preAction: navigateToTab('kafka-message-studio')
    6: [
      { type: 'exists', sel: '[data-testid="tab-publish"]', label: 'Publish tab visible in Studio' },
      { type: 'exists', sel: '[data-testid="tab-consume"]', label: 'Consume tab visible in Studio' },
    ],
  },

  'Publish Studio': {
    // s0: pub-intro — preAction: click PUBLISH_TAB
    0: [{ type: 'exists', sel: '#kms-pub-topic', label: 'Publish form is visible (topic input in DOM)' }],
    // s1: pub-topic — action: fill PUB_TOPIC_INPUT with "orders.created"
    1: [{ type: 'value', sel: '#kms-pub-topic', expected: 'orders.created', label: 'Topic = "orders.created"' }],
    // s2: pub-body — action: fill PUB_BODY_TEXTAREA with DEMO_BODY
    2: [{ type: 'contains', sel: '#kms-pub-body', expected: 'orderId', label: 'Body contains "orderId"' },
        { type: 'contains', sel: '#kms-pub-body', expected: 'DEMO-001', label: 'Body contains "DEMO-001"' }],
    // s3: pub-key — action: fill PUB_KEY_INPUT with "order-demo-001"
    3: [{ type: 'value', sel: '#kms-pub-key', expected: 'order-demo-001', label: 'Key = "order-demo-001"' }],
    // s4: pub-acks — informational; acks dropdown exists
    4: [{ type: 'exists', sel: '#kms-pub-acks', label: 'Acks dropdown is visible' }],
    // s5: pub-format — action: click format; body should now be multi-line JSON
    5: [{ type: 'contains', sel: '#kms-pub-body', expected: '\n', label: 'Body is formatted (contains newlines)' }],
    // s6: pub-send — requires broker
    6: [{ type: 'skip', label: 'pub-send: Result panel (requires running Docker broker)' }],
    // s7: pub-result — requires broker
    7: [{ type: 'skip', label: 'pub-result: partition + offset display (requires running Docker broker)' }],
    // s8: pub-clear — requires broker (Clear button only enabled after a result)
    8: [{ type: 'skip', label: 'pub-clear: Clear result (requires running Docker broker)' }],
  },

  'Consume Studio': {
    // s0: con-intro — preAction: click CONSUME_TAB + CON_MODE_ONCE
    0: [{ type: 'exists', sel: '#kms-con-topic', label: 'Consume form visible (topic input in DOM)' },
        { type: 'exists', sel: '[data-testid="con-mode-tabs"]', label: 'Mode tabs (Once/Stream) visible' }],
    // s1: con-topic — action: fill CON_TOPIC_INPUT with "orders.created"
    1: [{ type: 'value', sel: '#kms-con-topic', expected: 'orders.created', label: 'Consume topic = "orders.created"' }],
    // s2: con-position — action: selectOption 'earliest'
    2: [{ type: 'value', sel: '#kms-con-pos', expected: 'earliest', label: 'Start position = "earliest"' }],
    // s3: con-max — action: fill '5'
    3: [{ type: 'value', sel: '#kms-con-max', expected: '5', label: 'Max messages = "5"' }],
    // s4: con-consume — requires broker
    4: [{ type: 'skip', label: 'con-consume: Results table (requires running Docker broker)' }],
    // s5-s8: all require broker data
    5: [{ type: 'skip', label: 'con-table: Results table rows (requires broker data)' }],
    6: [{ type: 'skip', label: 'con-row: Detail pane (requires broker data + row click)' }],
    7: [{ type: 'skip', label: 'con-detail: Detail pane content (requires broker data)' }],
    8: [{ type: 'skip', label: 'con-export: Export button (requires broker results)' }],
  },

  'Headers & Filters': {
    // s0: hf-headers-intro — preAction: click PUBLISH_TAB + clear header rows
    0: [{ type: 'exists', sel: '.kafka-ms-add-btn', label: 'Headers "+ Add" button visible' }],
    // s1: hf-add-header — action: click PUB_HEADER_ADD_BTN
    1: [{ type: 'exists', sel: '.kafka-ms-kv-row:last-child input[placeholder="key"]', label: 'Header row key input appeared' },
        { type: 'exists', sel: '.kafka-ms-kv-row:last-child input[placeholder="value"]', label: 'Header row value input appeared' }],
    // s2: hf-fill-header — preAction fills header key/value + topic + key + body
    2: [{ type: 'value', sel: '.kafka-ms-kv-row:last-child input[placeholder="key"]', expected: 'traceId', label: 'Header key = "traceId"' },
        { type: 'value', sel: '.kafka-ms-kv-row:last-child input[placeholder="value"]', expected: 'abc-001', label: 'Header value = "abc-001"' },
        { type: 'value', sel: '#kms-pub-topic', expected: 'headers.demo', label: 'Publish topic = "headers.demo"' },
        { type: 'value', sel: '#kms-pub-key', expected: 'HDR-001', label: 'Message key = "HDR-001"' },
        { type: 'contains', sel: '#kms-pub-body', expected: 'us-east', label: 'Body contains "us-east"' }],
    // s3: hf-send-header — requires broker
    3: [{ type: 'skip', label: 'hf-send-header: Send with header (requires broker)' }],
    // s4: hf-filter-intro — preAction: click CONSUME_TAB + set groupId="" + maxMessages="1" + clear filters
    4: [{ type: 'exists', sel: '#kms-con-key', label: 'Key Equals filter input visible' },
        { type: 'exists', sel: '#kms-con-header', label: 'Header Match filter input visible' },
        { type: 'exists', sel: '#kms-con-jsonpath', label: 'JSONPath filter input visible' },
        { type: 'exists', sel: '#kms-con-jsonval', label: 'JSONPath Equals filter input visible' }],
    // s5-s8: require broker
    5: [{ type: 'skip', label: 'hf-key-filter: Consume with key filter (requires broker)' }],
    6: [{ type: 'skip', label: 'hf-header-filter: Consume with header filter (requires broker)' }],
    7: [{ type: 'skip', label: 'hf-jsonpath: Consume with JSONPath filter (requires broker)' }],
    8: [{ type: 'skip', label: 'hf-detail: Detail pane with headers (requires broker)' }],
  },

  'Templates': {
    // s0: tmpl-intro — informational, PUB_SAVE_BTN exists
    0: [{ type: 'exists', sel: '.kafka-ms-template-controls > .kafka-ms-template-btn', label: 'Publish Save template button visible' }],
    // s1: tmpl-fill-pub — action: fill topic + body
    1: [{ type: 'value', sel: '#kms-pub-topic', expected: 'orders.events', label: 'Topic = "orders.events"' },
        { type: 'contains', sel: '#kms-pub-body', expected: 'test', label: 'Body contains "test"' }],
    // s2: tmpl-save-pub — action: click Save → fill "Orders Template" → confirm
    2: [{ type: 'exists', sel: '.kafka-ms-template-controls', label: 'Template controls still visible after save' }],
    // s3: tmpl-load-pub — action: clear topic → Load → click template
    3: [{ type: 'value', sel: '#kms-pub-topic', expected: 'orders.events', label: 'Topic restored to "orders.events" by template' }],
    // s4: tmpl-delete-pub — action: Load → click × delete
    4: [{ type: 'exists', sel: '.kafka-ms-template-controls', label: 'Template controls still present after delete' }],
    // s5: tmpl-consume — preAction: click CONSUME_TAB
    5: [{ type: 'exists', sel: '#kms-con-topic', label: 'Consume form visible (switched to Consume tab)' }],
    // s6: tmpl-persist — preAction: click PUBLISH_TAB
    6: [{ type: 'exists', sel: '.kafka-ms-template-controls .kafka-ms-template-dropdown-anchor', label: 'Load ▾ button visible (Publish tab)' }],
  },

  'Topic Explorer': {
    // s0: te-intro — preAction: click TOPICS_TAB
    0: [{ type: 'exists', sel: '[data-testid="topic-explorer-page"]', label: 'Topic Explorer page visible' },
        { type: 'exists', sel: '[data-testid="topic-search"]', label: 'Topic search input visible' }],
    // s1: te-list — informational
    1: [{ type: 'exists', sel: '.kafka-explorer-topic-table', label: 'Topic table visible' }],
    // s2: te-search — preAction: fill TOPIC_SEARCH with "orders"
    2: [{ type: 'value', sel: '[data-testid="topic-search"]', expected: 'orders', label: 'Search = "orders"' }],
    // s3: te-chips — preAction: fill TOPIC_SEARCH with ""
    3: [{ type: 'value', sel: '[data-testid="topic-search"]', expected: '', label: 'Search cleared' },
        { type: 'exists', sel: '[data-testid="domain-chips"]', label: 'Domain chips visible' }],
    // s4: te-filters — informational
    4: [{ type: 'exists', sel: '[data-testid="health-filter"]', label: 'Health filter visible' }],
    // s5: te-select — action: click first row; detail panel needs broker data
    5: [{ type: 'skip', label: 'te-select: Detail panel (requires running Docker broker + topics)' }],
    // s6-s8: require broker data
    6: [{ type: 'skip', label: 'te-metrics: Partition metrics (requires broker data)' }],
    7: [{ type: 'skip', label: 'te-tabs: Partition details tab (requires broker data)' }],
    8: [{ type: 'skip', label: 'te-cg: Consumer groups tab (requires broker data)' }],
  },

  'Schema Registry': {
    // s0: sr-intro — preAction: click SCHEMA_TAB
    0: [{ type: 'exists', sel: '[data-testid="schema-registry-page"]', label: 'Schema Registry page visible' },
        { type: 'exists', sel: '[data-testid="registry-url-input"]', label: 'Registry URL input visible' }],
    // s1: sr-url — preAction: fill URL "http://localhost:8085"
    1: [{ type: 'value', sel: '[data-testid="registry-url-input"]', expected: 'http://localhost:8085', label: 'Registry URL = "http://localhost:8085"' }],
    // s2-s8: require Docker schema registry
    2: [{ type: 'skip', label: 'sr-connect: Subject list (requires Docker schema-registry stack)' }],
    3: [{ type: 'skip', label: 'sr-list: Subject rows (requires Docker schema-registry stack)' }],
    4: [{ type: 'skip', label: 'sr-filter: Filtered subjects (requires Docker schema-registry stack)' }],
    5: [{ type: 'skip', label: 'sr-select: Schema detail panel (requires Docker schema-registry stack)' }],
    6: [{ type: 'skip', label: 'sr-schema: Schema content (requires Docker schema-registry stack)' }],
    7: [{ type: 'skip', label: 'sr-version: Version dropdown (requires Docker schema-registry stack)' }],
    8: [{ type: 'skip', label: 'sr-copy: Copy schema (requires Docker schema-registry stack)' }],
  },

  'Stream Mode': {
    // s0: sm-intro — preAction: click CONSUME_TAB
    0: [{ type: 'exists', sel: '[data-testid="con-mode-tabs"]', label: 'Mode tabs (Once/Stream) visible' },
        { type: 'exists', sel: '[data-testid="con-mode-stream"]', label: '"Stream" mode button visible' }],
    // s1: sm-topic — preAction: click Stream mode + fill topic + select latest
    1: [{ type: 'value', sel: '#kms-con-topic', expected: 'redfireforge.debug.consume', label: 'Stream topic = "redfireforge.debug.consume"' },
        { type: 'value', sel: '#kms-con-pos', expected: 'latest', label: 'Start position = "latest"' }],
    // s2: sm-start — action: click Start Stream; LIVE badge requires broker
    2: [{ type: 'skip', label: 'sm-start: LIVE badge (requires running Docker broker)' }],
    // s3-s4: informational
    3: [{ type: 'exists', sel: '[data-testid="stream-results-zone"]', label: 'Stream results zone exists' }],
    4: [{ type: 'exists', sel: '[data-testid="stream-results-zone"]', label: 'Stream results zone still visible' }],
    // s5: sm-row: no data without broker
    5: [{ type: 'skip', label: 'sm-row: Row click (requires messages from broker)' }],
    // s6: sm-stop — action: click Stop Stream
    6: [{ type: 'exists', sel: '[data-testid="stream-start-btn"]', label: 'Start Stream button visible again (stream stopped)' }],
    // s7: sm-export — action: click Export
    7: [{ type: 'exists', sel: '[data-testid="stream-export-btn"]', label: 'Export Stream button exists' }],
  },

  'Workflow: Produce Node': {
    // s0: wp-intro — preAction: select "Kafka Produce Demo" workflow
    0: [{ type: 'exists', sel: '[data-testid="rf"]', label: 'Workflow canvas visible' }],
    // s1: wp-canvas — informational
    1: [{ type: 'exists', sel: '.wf-node-kafkaProduce', label: 'kafkaProduce node on canvas' }],
    // s2: wp-palette — preAction: open palette toggle
    2: [{ type: 'exists', sel: '[data-testid="palette"]', label: 'Node palette visible' }],
    // s3: wp-config — action: click kafkaProduce node → config panel
    3: [{ type: 'exists', sel: '[data-testid="node-config"]', label: 'Node config panel opened' }],
    // s4: wp-fields — informational
    4: [{ type: 'exists', sel: 'input[placeholder="orders.events"]', label: 'Topic template input visible' }],
    // s5: wp-bindings — informational
    5: [{ type: 'exists', sel: '[data-testid="node-binding-add-btn"]', label: 'Output bindings section visible' }],
    // s6: wp-quicktest — requires broker
    6: [{ type: 'skip', label: 'wp-quicktest: Quick Test result (requires running Docker broker)' }],
    // s7: wp-result — console always visible
    7: [{ type: 'exists', sel: '[data-testid="console"]', label: 'Workflow console visible' }],
    // s8: wp-summary
    8: [{ type: 'exists', sel: '[data-testid="rf"]', label: 'Workflow canvas still visible' }],
  },

  'Workflow: Consume & Wait': {
    // s0: cw-intro — preAction: select "Kafka Consume & Wait Demo" workflow
    0: [{ type: 'exists', sel: '[data-testid="rf"]', label: 'Workflow canvas visible' }],
    // s1: cw-consume-node — action: click kafkaConsume node
    1: [{ type: 'exists', sel: '[data-testid="node-config"]', label: 'kafkaConsume config panel opened' }],
    // s2: cw-consume-binding — informational
    2: [{ type: 'exists', sel: '[data-testid="node-binding-add-btn"]', label: 'Output bindings section visible in consume config' }],
    // s3: cw-wait-node — action: click kafkaWait node
    3: [{ type: 'exists', sel: '[data-testid="node-config"]', label: 'kafkaWait config panel opened' }],
    // s4: cw-wait-config — informational
    4: [{ type: 'exists', sel: '[data-testid="kafka-wait-config"]', label: 'Wait config section visible' }],
    // s5: cw-sample-payload — informational
    5: [{ type: 'exists', sel: '[data-testid="wait-sample-payload"]', label: 'Sample payload textarea visible' }],
    // s6: cw-load-mode — action: click WAIT_LOAD_MODE_SELECT
    6: [{ type: 'exists', sel: '[data-testid="wait-load-mode"]', label: 'Load test behavior dropdown exists' }],
    // s7: cw-quicktest — requires broker
    7: [{ type: 'skip', label: 'cw-quicktest: Quick Test (requires running Docker broker)' }],
    // s8: cw-console
    8: [{ type: 'exists', sel: '[data-testid="console"]', label: 'Workflow console visible' }],
    // s9: cw-summary
    9: [{ type: 'exists', sel: '[data-testid="rf"]', label: 'Workflow canvas still visible' }],
  },

  'Secure Cluster (SASL)': {
    // s0: sec-intro — preAction: navigateToTab('kafka-settings')
    0: [{ type: 'exists', sel: '[data-testid="kafka-settings-page"]', label: 'Settings page visible' }],
    // s1: sec-new — action: click NEW_CLUSTER_BTN
    1: [{ type: 'exists', sel: '[data-testid="kafka-cluster-editor"]', label: 'Cluster editor opened' }],
    // s2: sec-broker — preAction: fill name "Local Secure" + broker "127.0.0.1:19093"
    2: [{ type: 'value', sel: 'input[placeholder="127.0.0.1:19092"]', expected: '127.0.0.1:19093', label: 'Broker = "127.0.0.1:19093"' }],
    // s3: sec-auth — action: selectOption SCRAM-SHA-256
    3: [{ type: 'value', sel: '#kafka-auth-mode', expected: 'SCRAM-SHA-256', label: 'Auth mode = SCRAM-SHA-256' },
        { type: 'exists', sel: '#kafka-auth-username', label: 'Username field appeared' },
        { type: 'exists', sel: '#kafka-auth-password', label: 'Password field appeared' }],
    // s4: sec-creds — preAction: fill user + pass
    4: [{ type: 'value', sel: '#kafka-auth-username', expected: 'redfireforge-app', label: 'Username = "redfireforge-app"' }],
    // s5-s8: require Docker secure stack
    5: [{ type: 'skip', label: 'sec-test: Test connection (requires Docker secure stack on :19093)' }],
    6: [{ type: 'skip', label: 'sec-save: Connect (requires Docker secure stack)' }],
    7: [{ type: 'skip', label: 'sec-publish: Publish over SASL (requires Docker secure stack)' }],
    8: [{ type: 'skip', label: 'sec-result: Result panel (requires Docker secure stack)' }],
  },

  'TLS-Encrypted Cluster': {
    // s0: tls-intro — preAction: navigateToTab('kafka-settings')
    0: [{ type: 'exists', sel: '[data-testid="kafka-settings-page"]', label: 'Settings page visible' }],
    // s1: tls-new — action: click NEW_CLUSTER_BTN
    1: [{ type: 'exists', sel: '[data-testid="kafka-cluster-editor"]', label: 'Cluster editor opened' }],
    // s2: tls-broker — preAction: fill name "Local TLS" + broker "127.0.0.1:19095"
    2: [{ type: 'value', sel: 'input[placeholder="127.0.0.1:19092"]', expected: '127.0.0.1:19095', label: 'Broker = "127.0.0.1:19095"' }],
    // s3: tls-auth — action: select SCRAM + fill creds
    3: [{ type: 'value', sel: '#kafka-auth-mode', expected: 'SCRAM-SHA-256', label: 'Auth mode = SCRAM-SHA-256' },
        { type: 'value', sel: '#kafka-auth-username', expected: 'redfireforge-app', label: 'Username = "redfireforge-app"' }],
    // s4: tls-enable — action: click TLS toggle (if not already checked)
    4: [{ type: 'exists', sel: '[data-testid="kafka-tls-toggle"]', label: 'TLS toggle visible' }],
    // s5: tls-ca — action: click verify toggle to uncheck
    5: [{ type: 'exists', sel: '[data-testid="kafka-tls-verify-toggle"]', label: 'TLS verify toggle visible' }],
    // s6-s8: require Docker TLS stack
    6: [{ type: 'skip', label: 'tls-test: Test connection (requires Docker TLS stack on :19095)' }],
    7: [{ type: 'skip', label: 'tls-save: Connect (requires Docker TLS stack)' }],
    8: [{ type: 'skip', label: 'tls-publish: Publish over TLS (requires Docker TLS stack)' }],
  },

  'Harness: Run Kafka Workflow': {
    // s0: kr-intro — setup navigates to workflow-runner tab
    0: [{ type: 'exists', sel: '[data-testid="workflow-select"]', label: 'Workflow selector dropdown visible' }],
    // s1: kr-pick — action: open dropdown and select "Kafka Produce Demo"
    1: [{ type: 'exists', sel: '.wfp-var-row, [data-testid="var-row"]', label: 'Initial Variables row appeared (workflow selected)' }],
    // s2: kr-vars — informational
    2: [{ type: 'exists', sel: '.wfp-var-row', label: 'Variable row visible' }],
    // s3: kr-iterations — preAction: fill iterations=3, concurrency=1
    3: [{ type: 'value', sel: '.wfp-iterations-input, [data-testid="wfp-iterations"], input[placeholder*="Iter"]', expected: '3', label: 'Iterations = "3"' }],
    // s4-s7: require broker for actual run results
    4: [{ type: 'skip', label: 'kr-run: Workflow execution (requires running Docker broker)' }],
    5: [{ type: 'skip', label: 'kr-results: Completion banner (requires running Docker broker)' }],
    6: [{ type: 'skip', label: 'kr-dashboard: Results Dashboard (requires broker run results)' }],
    7: [{ type: 'skip', label: 'kr-badges: PRODUCE badges (requires broker run results)' }],
  },
};

// ── Lesson runner ─────────────────────────────────────────────────────────────
async function ensureKafkaList(page) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const state = await page.evaluate(() => ({
      lessonItems: document.querySelectorAll('.demo-lesson-item').length,
      hasBreadcrumb: document.querySelectorAll('.demo-hub-breadcrumb-item').length,
      hasDomainCards: !!document.querySelector('.demo-domain-card'),
    }));
    if (state.lessonItems >= 13) return true;
    if (state.hasBreadcrumb >= 2) {
      await page.evaluate(() => document.querySelectorAll('.demo-hub-breadcrumb-item')[1]?.click());
      await page.waitForTimeout(600); continue;
    }
    if (state.hasBreadcrumb === 1) {
      await page.evaluate(() => document.querySelector('.demo-hub-breadcrumb-item')?.click());
      await page.waitForTimeout(600); continue;
    }
    if (state.hasDomainCards) {
      await page.evaluate(() => document.querySelector('.demo-domain-card')?.click());
      await page.waitForTimeout(600); continue;
    }
    await page.locator('button:has-text("Demo Hub")').first().click({ timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(800);
  }
  return false;
}

async function runLesson(page, title, lessonNum) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`L${lessonNum}: ${title}`);
  console.log('═'.repeat(60));

  const checks = STEP_CHECKS[title] || {};

  await ensureKafkaList(page);
  const cnt = await page.evaluate(() => document.querySelectorAll('.demo-lesson-item').length);
  if (cnt < 13) {
    fail(title, 'nav', `Navigation failed (${cnt} lesson items)`);
    return;
  }

  // Ensure Kafka tab active
  await page.evaluate(() => {
    const tabs = Array.from(document.querySelectorAll('.demo-category-tab'));
    const kafka = tabs.find(t => t.textContent.includes('Kafka'));
    if (kafka && !kafka.classList.contains('active')) kafka.click();
  });
  await page.waitForTimeout(300);

  // Click lesson by name
  const clicked = await page.evaluate((name) => {
    const items = Array.from(document.querySelectorAll('.demo-lesson-item'));
    const item = items.find(el => el.querySelector('.demo-lesson-name')?.textContent?.trim() === name);
    if (!item) return false;
    item.click(); return true;
  }, title);
  if (!clicked) { fail(title, 'nav', `Lesson not found: "${title}"`); return; }
  await page.waitForTimeout(700);

  const hasStart = await page.evaluate(() => !!document.querySelector('.demo-start-btn'));
  if (!hasStart) { fail(title, 'nav', 'No Start Demo button'); return; }
  await page.evaluate(() => document.querySelector('.demo-start-btn')?.click());
  await page.waitForTimeout(3500);

  let s = 0;
  while (s < 15) {
    const appeared = await page.locator('.demo-live-phase-badge.skippable').waitFor({ timeout: 12000 }).then(() => true).catch(() => false);
    if (!appeared) { console.log(`  s${s}: badge timeout — demo ended`); break; }

    const counter = await page.locator('.demo-live-step-counter, .demo-live-step-num').first().textContent().catch(() => '?');
    const stepTitle = await page.locator('.demo-live-step-title').first().textContent().catch(() => '?');
    console.log(`\n  s${s}: ${counter} — "${stepTitle}"`);

    // Click skip-reading
    await page.evaluate(() => document.querySelector('.demo-live-phase-badge.skippable')?.click());
    await page.waitForTimeout(2800);

    // Screenshot
    await page.screenshot({ path: `/tmp/deep-L${lessonNum}-s${s}.png` });

    // Run assertions for this step
    const stepChecks = checks[s] || [];
    if (stepChecks.length === 0) {
      console.log('    (no assertions configured for this step)');
    } else {
      await assert(page, title, `s${s}`, stepChecks);
    }

    // Check if done
    const isLast = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('.demo-live-btn'));
      const next = btns.find(b =>
        !b.classList.contains('demo-live-play-btn') &&
        !b.classList.contains('demo-live-restart-btn') &&
        !b.classList.contains('demo-live-exit-btn')
      );
      return !next || next.disabled;
    });
    if (isLast) { console.log(`\n  → demo ended at s${s}`); break; }

    // Advance
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('.demo-live-btn'));
      const next = btns.find(b =>
        !b.classList.contains('demo-live-play-btn') &&
        !b.classList.contains('demo-live-restart-btn') &&
        !b.classList.contains('demo-live-exit-btn') &&
        !b.disabled
      );
      next?.click();
    });
    await page.waitForTimeout(600);
    s++;
  }

  await page.evaluate(() => document.querySelector('.demo-live-exit-btn')?.click());
  await page.waitForTimeout(2500);
}

// ── Main ──────────────────────────────────────────────────────────────────────
const LESSONS = [
  'Quick Start', 'Publish Studio', 'Consume Studio', 'Headers & Filters',
  'Templates', 'Topic Explorer', 'Schema Registry', 'Stream Mode',
  'Workflow: Produce Node', 'Workflow: Consume & Wait',
  'Secure Cluster (SASL)', 'TLS-Encrypted Cluster', 'Harness: Run Kafka Workflow',
];

(async () => {
  const browser = await chromium.launch({ headless: false, channel: 'chrome', args: ['--start-maximized'] });
  const ctx = await browser.newContext({ viewport: null });
  const page = await ctx.newPage();
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(600);

  await page.locator('button:has-text("Demo Hub")').first().click({ timeout: 8000 });
  await page.waitForTimeout(500);
  await page.evaluate(() => document.querySelector('.demo-domain-card')?.click());
  await page.waitForTimeout(600);

  for (let i = 0; i < LESSONS.length; i++) {
    try { await runLesson(page, LESSONS[i], i + 1); }
    catch (e) {
      console.error(`\nEXCEPTION L${i+1}: ${e.message.split('\n')[0]}`);
      RESULTS.push({ status: 'FAIL', lesson: LESSONS[i], step: '?', label: `Exception: ${e.message.split('\n')[0]}` });
      await page.evaluate(() => document.querySelector('.demo-live-exit-btn')?.click()).catch(() => {});
      await page.waitForTimeout(2500);
    }
  }

  // ── Final Summary ──────────────────────────────────────────────────────────
  const passes = RESULTS.filter(r => r.status === 'PASS');
  const fails  = RESULTS.filter(r => r.status === 'FAIL');
  const skips  = RESULTS.filter(r => r.status === 'SKIP');

  console.log('\n\n' + '═'.repeat(60));
  console.log('DEEP VALIDATION SUMMARY');
  console.log('═'.repeat(60));
  console.log(`✓ PASSED: ${passes.length}`);
  console.log(`✗ FAILED: ${fails.length}`);
  console.log(`~ SKIPPED: ${skips.length} (requires Docker stacks)`);

  if (fails.length > 0) {
    console.log('\nFAILED ASSERTIONS:');
    for (const f of fails) console.log(`  ✗ [${f.lesson}] ${f.step}: ${f.label}${f.actual ? ' — actual: ' + f.actual : ''}`);
  }

  const dockerSkipGroups = {};
  for (const s of skips) {
    if (!dockerSkipGroups[s.lesson]) dockerSkipGroups[s.lesson] = 0;
    dockerSkipGroups[s.lesson]++;
  }
  console.log('\nSkipped by lesson (requires Docker):');
  for (const [lesson, count] of Object.entries(dockerSkipGroups)) {
    console.log(`  ~ ${lesson}: ${count} check(s)`);
  }

  console.log(fails.length === 0
    ? '\n✅ ALL ASSERTABLE STEPS PASSED — No UI regressions found'
    : `\n⚠️  ${fails.length} ASSERTION(S) FAILED — See above`);

  await new Promise(() => {}); // keep browser open for inspection
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
